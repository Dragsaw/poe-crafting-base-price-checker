import { execFile } from 'node:child_process';
import { existsSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The `PostToolUse` hook that registers in `.claude/settings.json`. After an
 * agent edits a TypeScript file it runs three checks on that file, in
 * parallel, and feeds the findings back:
 *
 * - lint: ESLint with `LINT_FAST=1`, which skips the slow type-aware block
 *   (`pnpm lint` and CI still run it). Findings that the baseline suppresses
 *   look stale without the type-aware rules, so the run passes
 *   `--pass-on-unpruned-suppressions`.
 * - typecheck: TypeScript has no per-file mode. This runs the incremental
 *   build of `pnpm typecheck` (`tsc -b`, then the declaration rewrite, so
 *   `dist` stays what `pnpm check` produces) and keeps only the diagnostics
 *   that sit in the edited files. A caller that the edit just broke is left
 *   for `pnpm check`, so the agent is not told off in the middle of a change.
 * - depcruise: dependency-cruiser follows the imports of the edited files and
 *   keeps the violations whose `from` is an edited file. Files under
 *   `packages/` only: the rules name nothing else.
 *
 * Clean: exit 0 and no output. Findings: grouped by check on stderr, exit 2,
 * which Claude Code returns to the agent. Nothing here fixes a file.
 *
 * The edited file comes from `tool_input.file_path` (Edit, Write, MultiEdit)
 * or the Serena `relative_path`. `rename_symbol` changes other files, and
 * `replace_in_files` may take a directory or no path at all, so those two
 * fall back to the TypeScript files in `git diff --name-only HEAD`.
 *
 * Fallback if a cold `tsc -b` is ever too slow: run typecheck only for files
 * under `packages/` (see `checkedBy`).
 *
 * Run by bare `node` (type stripping), so this module imports only builtins.
 */

export const CHECK_NAMES = ['lint', 'typecheck', 'depcruise'] as const;
export type CheckName = (typeof CHECK_NAMES)[number];

/** A check returns its findings as text, or an empty string when the files are clean. */
export type Check = (files: readonly string[]) => Promise<string>;

/** The overall budget. A check that is still running then reports a timeout. */
export const TIMEOUT_MS = 30_000;

/** The most files the `git diff` fallback hands to the checks. */
export const MAX_DIFF_FILES = 20;

const MAX_BUFFER = 64 * 1024 * 1024;
const TYPESCRIPT_FILE = /\.tsx?$/;
const SKIPPED_SEGMENT = /(^|\/)(node_modules|dist)\//;
const SERENA_PREFIX = 'mcp__serena__';

export interface HookPayload {
  readonly toolName: string;
  /** The raw path the tool names, absolute or relative to the project. Empty when it names none. */
  readonly path: string;
}

/** The hook JSON on stdin. Returns `undefined` for anything that is not a tool payload. */
export function parsePayload(text: string): HookPayload | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null) {return undefined;}
  const { tool_name: toolName, tool_input: input } = parsed as { tool_name?: unknown; tool_input?: unknown };
  const fields = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const candidate = fields.file_path ?? fields.relative_path;
  return {
    toolName: typeof toolName === 'string' ? toolName : '',
    path: typeof candidate === 'string' ? candidate : '',
  };
}

export type PathKind = 'file' | 'directory' | 'missing';

export interface SelectionDependencies {
  readonly root: string;
  readonly kindOf: (absolutePath: string) => PathKind;
  /** Repository-relative paths from `git diff --name-only HEAD`. */
  readonly changedFiles: () => Promise<readonly string[]>;
}

/** The repository-relative, forward-slash path, or `undefined` when `path` lies outside `root`. */
function insideRoot(root: string, candidate: string): string | undefined {
  const relativePath = path.relative(root, path.resolve(root, candidate));
  const isOutside = relativePath === '' || relativePath.startsWith('..') || path.isAbsolute(relativePath);
  return isOutside ? undefined : relativePath.replaceAll('\\', '/');
}

function wantedFile(candidate: string, dependencies: SelectionDependencies): string | undefined {
  const relativePath = insideRoot(dependencies.root, candidate);
  if (relativePath === undefined || !TYPESCRIPT_FILE.test(relativePath) || SKIPPED_SEGMENT.test(relativePath)) {
    return undefined;
  }
  return dependencies.kindOf(path.resolve(dependencies.root, relativePath)) === 'file' ? relativePath : undefined;
}

/**
 * Whether the tool can change files other than the one it names. A path that
 * is not one existing file (a directory, or none) means the whole project for
 * `replace_in_files`; a rename always reaches the references.
 */
function canReachOtherFiles(payload: HookPayload, namedKind: PathKind): boolean {
  const name = payload.toolName.slice(SERENA_PREFIX.length);
  return payload.toolName.startsWith(SERENA_PREFIX) && (name === 'rename_symbol' || (name === 'replace_in_files' && namedKind !== 'file'));
}

/** The edited TypeScript files, repository-relative with forward slashes. Ignores other extensions and missing files. */
export async function selectFiles(payload: HookPayload, dependencies: SelectionDependencies): Promise<string[]> {
  const named = payload.path === '' ? undefined : wantedFile(payload.path, dependencies);
  const namedKind = payload.path === '' ? 'missing' : dependencies.kindOf(path.resolve(dependencies.root, payload.path));
  const files = new Set<string>(named === undefined ? [] : [named]);
  if (!canReachOtherFiles(payload, namedKind)) {return [...files];}
  const changed = await dependencies.changedFiles();
  for (const candidate of changed) {
    const file = wantedFile(candidate, dependencies);
    if (file !== undefined && files.size < MAX_DIFF_FILES) {files.add(file);}
  }
  return [...files];
}

/** Which of `files` a check applies to. */
export function checkedBy(check: CheckName, files: readonly string[]): string[] {
  // dependency-cruiser's rules name `packages/` only.
  return check === 'depcruise' ? files.filter((file) => file.startsWith('packages/')) : [...files];
}

/** Compares paths of edited files and tool output: both use forward slashes, and Windows ignores case. */
function samePathKey(text: string): string {
  const normalized = text.replaceAll('\\', '/').replace(/^\.\//, '');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

const TSC_DIAGNOSTIC = /^(.+?)\((\d+),(\d+)\): (?:error|warning) TS\d+: /;

/**
 * The diagnostics of a `tsc` run that sit in `files`, with their indented
 * continuation lines. `output` is `tsc --pretty false` output, whose paths
 * are relative to the working directory (the repository root).
 */
export function filterTscDiagnostics(output: string, files: readonly string[]): string {
  const wanted = new Set(files.map((file) => samePathKey(file)));
  const kept: string[] = [];
  let isKeeping = false;
  for (const line of output.split(/\r?\n/)) {
    const match = TSC_DIAGNOSTIC.exec(line);
    // A diagnostic line sets the state; an indented line continues the last one; any other line ends it.
    if (match !== null) {isKeeping = wanted.has(samePathKey(match[1] ?? ''));}
    else if (!line.startsWith(' ') && !line.startsWith('\t')) {isKeeping = false;}
    if (isKeeping) {kept.push(line);}
  }
  return kept.join('\n');
}

interface DepcruiseViolation {
  readonly from?: string;
  readonly to?: string;
  readonly rule?: { readonly name?: string; readonly severity?: string };
}

/** The violations in `dependency-cruiser --output-type json` output whose `from` is one of `files`. */
export function filterDepcruiseViolations(json: string, files: readonly string[]): string {
  const wanted = new Set(files.map((file) => samePathKey(file)));
  const parsed = JSON.parse(json) as { summary?: { violations?: DepcruiseViolation[] } };
  return (parsed.summary?.violations ?? [])
    .filter((violation) => wanted.has(samePathKey(violation.from ?? '')) && violation.rule?.severity !== 'ignore')
    .map((violation) => {
      const { rule } = violation;
      return `${rule?.severity ?? 'error'} ${rule?.name ?? 'violation'}: ${violation.from ?? ''} -> ${violation.to ?? ''}`;
    })
    .join('\n');
}

/** The report for the checks that found something, grouped by check. Empty when all are clean. */
export function formatReport(findings: Readonly<Partial<Record<CheckName, string>>>): string {
  const sections = CHECK_NAMES.filter((name) => (findings[name]?.trim() ?? '') !== '').map(
    (name) => `== ${name} ==\n${findings[name]?.trim() ?? ''}`,
  );
  const heading = 'lint-on-edit: findings in the edited file. Fix them. `pnpm check` runs the full gate.';
  return sections.length === 0 ? '' : [heading, ...sections].join('\n\n');
}

export interface HookResult {
  readonly code: 0 | 2;
  readonly report: string;
}

export interface HookDependencies extends SelectionDependencies {
  readonly checks: Readonly<Record<CheckName, Check>>;
  readonly timeoutMs: number;
}

/** Runs one check; a throw or a timeout becomes a finding, because a silent failure would pass the file. */
async function guarded(name: CheckName, check: Check, files: readonly string[], timeoutMs: number): Promise<string> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<string>((done) => {
    timer = setTimeout(() => {
      done(`${name} did not finish within ${timeoutMs / 1000}s. Run \`pnpm check\`.`);
    }, timeoutMs);
  });
  try {
    return await Promise.race([check(files), timeout]);
  } catch (error) {
    return `${name} failed to run: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    clearTimeout(timer);
  }
}

/** The whole hook: stdin text in, exit code and stderr report out. The three checks run concurrently. */
export async function runHook(stdin: string, dependencies: HookDependencies): Promise<HookResult> {
  const payload = parsePayload(stdin);
  if (payload === undefined) {return { code: 0, report: '' };}
  const files = await selectFiles(payload, dependencies);
  if (files.length === 0) {return { code: 0, report: '' };}
  const results = await Promise.all(
    CHECK_NAMES.map(async (name) => {
      const own = checkedBy(name, files);
      const text = own.length === 0 ? '' : await guarded(name, dependencies.checks[name], own, dependencies.timeoutMs);
      return [name, text] as const;
    }),
  );
  const report = formatReport(Object.fromEntries(results));
  return { code: report === '' ? 0 : 2, report };
}

interface RunResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs a program to the end and never rejects on a non-zero exit. The timeout kills it. */
function run(file: string, arguments_: readonly string[], cwd: string, environment: NodeJS.ProcessEnv = process.env): Promise<RunResult> {
  return new Promise((done, fail) => {
    execFile(
      file,
      [...arguments_],
      { cwd, env: environment, timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER, windowsHide: true, encoding: 'utf8' },
      (error, stdout, stderr) => {
        const code = (error as { code?: unknown } | null)?.code;
        if (error !== null && typeof code !== 'number') {fail(error);}
        else {done({ code: typeof code === 'number' ? code : 0, stdout, stderr });}
      },
    );
  });
}

/** The checks, run through `node` on the repository's own `node_modules`. */
export function realChecks(root: string): Record<CheckName, Check> {
  const node = process.execPath;
  const bin = (...segments: string[]): string => path.join(root, 'node_modules', ...segments);
  const rewrite = path.join(root, 'tools', 'dts-specifiers', 'rewrite-dts-specifiers.ts');
  return {
    async lint(files) {
      const environment = { ...process.env, LINT_FAST: '1' };
      const flags = ['--no-warn-ignored', '--max-warnings=0', '--pass-on-unpruned-suppressions'];
      const result = await run(node, [bin('eslint', 'bin', 'eslint.js'), ...flags, ...files], root, environment);
      return result.code === 0 ? '' : result.stdout + result.stderr;
    },
    async typecheck(files) {
      const result = await run(node, [bin('typescript', 'bin', 'tsc'), '-b', '--pretty', 'false'], root);
      // `pnpm typecheck` runs this after `tsc -b`; run it too so `dist` ends up the same.
      if (existsSync(rewrite)) {await run(node, [rewrite], root);}
      return filterTscDiagnostics(result.stdout, files);
    },
    async depcruise(files) {
      const cruiser = bin('dependency-cruiser', 'bin', 'dependency-cruiser.mjs');
      const result = await run(node, [cruiser, ...files, '--config', '.dependency-cruiser.mjs', '--output-type', 'json'], root);
      if (result.stdout.trim() === '') {return result.code === 0 ? '' : result.stderr;}
      return filterDepcruiseViolations(result.stdout, files);
    },
  };
}

function statKind(absolutePath: string): PathKind {
  try {
    return statSync(absolutePath).isDirectory() ? 'directory' : 'file';
  } catch {
    return 'missing';
  }
}

async function changedFiles(root: string): Promise<string[]> {
  try {
    const result = await run('git', ['diff', '--name-only', 'HEAD'], root);
    return result.stdout.split(/\r?\n/).filter((line) => line !== '');
  } catch {
    return [];
  }
}

async function readStandardInput(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {chunks.push(chunk as Buffer);}
  return Buffer.concat(chunks).toString('utf8');
}

/** `LINT_ON_EDIT_ROOT` points the hook at another repository layout. The tests use it. */
async function main(): Promise<number> {
  const root = process.env.LINT_ON_EDIT_ROOT ?? path.resolve(import.meta.dirname, '../..');
  const result = await runHook(await readStandardInput(), {
    root,
    kindOf: statKind,
    changedFiles: () => changedFiles(root),
    checks: realChecks(root),
    timeoutMs: TIMEOUT_MS,
  });
  if (result.report !== '') {process.stderr.write(`${result.report}\n`);}
  return result.code;
}

/**
 * The entry guard, as in `tools/dev-stop/dev-stop.ts`: running the file runs
 * the hook, and importing it (the co-located test) runs nothing.
 */
function isInvokedDirectly(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {return false;}
  try {
    return realpathSync(path.resolve(entry)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isInvokedDirectly()) {
  try {
    process.exitCode = await main();
  } catch (error) {
    process.stderr.write(`lint-on-edit: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
