import { existsSync } from 'node:fs';
import path from 'node:path';

import { isInvokedDirectly } from '../entry-guard/is-invoked-directly.ts';
import { readStandardInput, run } from './lint-on-edit.ts';

// A Stop hook: typechecks once per agent turn instead of on every edit. Run by bare `node`.

/** For `tsc -b` and the rewrite together; leaves the Stop hook timeout in `.claude/settings.json` room for `git status`. */
export const TYPECHECK_BUDGET_MS = 90_000;

/** `tsc -b` ran past its budget. */
export class TypecheckTimeout extends Error {
  constructor(budgetMs: number) {
    super(`\`tsc -b\` did not finish within ${String(budgetMs / 1000)} s. Run \`pnpm typecheck\` and fix what it reports.`);
    this.name = 'TypecheckTimeout';
  }
}

/** Returns the `tsc -b` diagnostics as text, or an empty string when the build is clean. Throws TypecheckTimeout. */
export type Typecheck = () => Promise<string>;

/** Returns the uncommitted paths (staged, unstaged, untracked), or undefined when git fails. */
export type ListChanged = () => Promise<readonly string[] | undefined>;

export interface StopResult {
  /** 2 blocks the stop and hands the report to the agent; 1 shows it to the user only. */
  readonly code: 0 | 1 | 2;
  readonly report: string;
}

/** True when the agent already continues because of a Stop hook. */
export function isRepeatStop(stdin: string): boolean {
  try {
    const parsed: unknown = JSON.parse(stdin);
    return typeof parsed === 'object' && parsed !== null && (parsed as { stop_hook_active?: unknown }).stop_hook_active === true;
  } catch {
    return false;
  }
}

/** True when the Stop payload lists a background subagent, which may still be editing (epic 4 retro L5). */
export function hasRunningSubagent(stdin: string): boolean {
  try {
    const tasks = (JSON.parse(stdin) as { background_tasks?: unknown } | null)?.background_tasks;
    return Array.isArray(tasks) && tasks.some((task: unknown) => (task as { type?: unknown } | null)?.type === 'subagent');
  } catch {
    return false;
  }
}

/** Parses `git status --porcelain=v1 -z`; a rename or copy record carries its source path as the next field. */
export function parsePorcelain(text: string): string[] {
  const fields = text.split('\0');
  const paths: string[] = [];
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index] ?? '';
    if (field.length < 4) {continue;}
    paths.push(field.slice(3));
    if (!/[RC]/.test(field.slice(0, 2))) {continue;}
    paths.push(fields[index + 1] ?? '');
    index += 1;
  }
  return paths;
}

/** A tsconfig edit changes the build as much as a source edit does. */
export function isTypescriptInput(file: string): boolean {
  return /\.[cm]?tsx?$/.test(file) || /(^|\/)tsconfig[^/]*\.json$/.test(file);
}

/** A repeat stop with errors left does not block again, or an unfixable error would loop the agent. */
export async function runStopHook(stdin: string, typecheck: Typecheck, listChanged: ListChanged): Promise<StopResult> {
  if (hasRunningSubagent(stdin)) {return { code: 0, report: '' };}
  const changed = await listChanged();
  if (changed?.every((file) => !isTypescriptInput(file)) === true) {return { code: 0, report: '' };}
  const code = isRepeatStop(stdin) ? 1 : 2;
  let output;
  try {
    output = await typecheck();
  } catch (error) {
    if (!(error instanceof TypecheckTimeout)) {throw error;}
    return { code, report: `typecheck-on-stop: ${error.message}` };
  }
  const findings = output.trim();
  if (findings === '') {return { code: 0, report: '' };}
  const heading = 'typecheck-on-stop: `tsc -b` found errors. Fix them. `pnpm check` runs the full gate.';
  return { code, report: `${heading}\n\n${findings}` };
}

/** `tsc -b` on the whole solution, then the `.d.ts` rewrite that `pnpm typecheck` runs. */
export function realTypecheck(
  root: string,
  tsc: string = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
  budgetMs: number = TYPECHECK_BUDGET_MS,
): Typecheck {
  const node = process.execPath;
  const rewrite = path.join(root, 'tools', 'dts-specifiers', 'rewrite-dts-specifiers.ts');
  return async () => {
    const deadline = Date.now() + budgetMs;
    const withinBudget = async (arguments_: readonly string[]) => {
      try {
        return await run(node, arguments_, root, { timeoutMs: Math.max(1, deadline - Date.now()) });
      } catch (error) {
        if (isTimeout(error)) {throw new TypecheckTimeout(budgetMs);}
        throw error;
      }
    };
    const result = await withinBudget([tsc, '-b', '--pretty', 'false']);
    if (existsSync(rewrite)) {await withinBudget([rewrite]);}
    return result.code === 0 ? '' : result.stdout + result.stderr;
  };
}

/** `execFile` also sets `killed` when output overflows `maxBuffer`, which is no timeout. */
function isTimeout(error: unknown): boolean {
  const { killed, code } = error as { killed?: unknown; code?: unknown };
  return killed === true && code !== 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
}

/** A git failure gives undefined, so the hook typechecks rather than skip. */
export function realListChanged(root: string): ListChanged {
  return async () => {
    try {
      const result = await run('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], root);
      return result.code === 0 ? parsePorcelain(result.stdout) : undefined;
    } catch {
      return;
    }
  };
}

if (isInvokedDirectly(import.meta.url)) {
  try {
    const root = path.resolve(import.meta.dirname, '../..');
    const result = await runStopHook(await readStandardInput(), realTypecheck(root), realListChanged(root));
    if (result.report !== '') {process.stderr.write(`${result.report}\n`);}
    process.exitCode = result.code;
  } catch (error) {
    process.stderr.write(`typecheck-on-stop: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
