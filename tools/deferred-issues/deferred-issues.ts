import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { parseLedger, type LedgerEntry } from './ledger.ts';
import { LEDGER_PATH, planDuplicateCloses, planSync, readMarker, type IssueInfo, type SyncPlan } from './plan.ts';

/**
 * `pnpm deferred:issues [--dry-run [--ref <ref>]] [--list]` creates one GitHub
 * issue, with the label `deferred`, for each entry of
 * `docs/stories/deferred-work.md` on `origin/master`. The issues are the work
 * queue of `deferred-work-sweep` and hold its run state; the ledger stays the
 * list of carved-out work.
 *
 * - The sync closes only a duplicate issue (two issues for one id, from a
 *   race): it keeps the lowest number. It reports every other mismatch.
 * - `--dry-run` prints the plan and writes nothing. `--ref` is allowed only
 *   with it.
 * - `--list` prints JSON, one object for each entry, for section 1 of the
 *   sweep. It writes nothing.
 *
 * Exit 0 on success. Exit 1 when the ledger or the issue list cannot be read
 * before any write (no write happens), or when the re-list after the creates
 * fails: the creates are then already done, and the next sync closes any
 * duplicate. Exit 2 when a write failed or the ledger has a duplicate id.
 *
 * Every `git` and `gh` call goes through one injectable `Runner`, so tests
 * spawn no process. Run by bare `node` (type stripping), so this module
 * imports only builtins and its siblings.
 */

export interface RunResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

export type Runner = (command: string, arguments_: readonly string[], stdin?: string) => RunResult;

export interface Output {
  write(text: string): unknown;
}

export const DEFAULT_REF = 'origin/master';
export const LIST_LIMIT = 2000;
/** Fixed color and description, so `--force` does not recolor a label on each writing run. */
export const LABELS = [
  { name: 'deferred', color: '5319e7', description: 'One entry of docs/stories/deferred-work.md' },
  { name: 'sweep:blocked', color: 'b60205', description: 'deferred-work-sweep could not close it; see the sweep-attempt comment' },
] as const;

const PROGRAM = 'pnpm deferred:issues';
const USAGE = `usage: ${PROGRAM} [--dry-run [--ref <ref>]] | [--list]\n`;

/** The one runner of the real command: a process with no shell, stdout and stderr captured. */
export const run: Runner = (command, arguments_, stdin) => {
  const result = spawnSync(command, [...arguments_], {
    encoding: 'utf8',
    input: stdin,
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.error === undefined ? (result.stderr ?? '') : String(result.error),
  };
};

function firstLine(text: string): string {
  return text.trim().split(/\r?\n/, 1)[0] ?? '';
}

type Read<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

function readEntries(runner: Runner, reference: string): Read<LedgerEntry[]> {
  const shown = runner('git', ['show', `${reference}:${LEDGER_PATH}`]);
  if (shown.status !== 0) {
    return { ok: false, error: `git show ${reference}:${LEDGER_PATH} failed: ${firstLine(shown.stderr)}` };
  }
  const entries = parseLedger(shown.stdout);
  return entries.length === 0 ? { ok: false, error: `0 entries parse from ${LEDGER_PATH} on ${reference}` } : { ok: true, value: entries };
}

export function readIssues(runner: Runner): Read<IssueInfo[]> {
  const listed = runner('gh', [
    'issue',
    'list',
    '--label',
    'deferred',
    '--state',
    'all',
    '--json',
    'number,state,body',
    '--limit',
    String(LIST_LIMIT),
  ]);
  if (listed.status !== 0) {
    return { ok: false, error: `gh issue list failed: ${firstLine(listed.stderr)}` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(listed.stdout);
  } catch (error) {
    return { ok: false, error: `gh issue list printed no JSON: ${String(error)}` };
  }
  if (!Array.isArray(parsed) || !parsed.every(isIssue)) {
    return { ok: false, error: 'gh issue list printed an unexpected shape' };
  }
  return parsed.length >= LIST_LIMIT ? { ok: false, error: `gh issue list reached its limit of ${LIST_LIMIT}, so some issues may be missing` } : { ok: true, value: parsed };
}

function isIssue(value: unknown): value is IssueInfo {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record['number'] === 'number' &&
    typeof record['state'] === 'string' &&
    (typeof record['body'] === 'string' || record['body'] === null || record['body'] === undefined)
  );
}

function printPlan(plan: SyncPlan, out: Output): void {
  for (const create of plan.creates) {
    out.write(`would create: ${create.id} ${create.title}\n`);
  }
  for (const close of plan.closes) {
    out.write(`would close #${close.number} as not planned: Duplicate of #${close.keep}\n`);
  }
}

function printReports(reports: readonly string[], out: Output): void {
  for (const line of reports) {
    out.write(`report: ${line}\n`);
  }
}

/** One JSON object for each entry, in ledger order, with the lowest open issue. */
function listEntries(entries: readonly LedgerEntry[], issues: readonly IssueInfo[]): unknown[] {
  const open = new Map<string, number>();
  const byNumber = issues.toSorted((a, b) => a.number - b.number);
  for (const issue of byNumber) {
    const id = readMarker(issue.body);
    if (id !== undefined && issue.state === 'OPEN' && !open.has(id)) {
      open.set(id, issue.number);
    }
  }
  return entries.map((entry) => ({
    id: entry.id,
    sourceSpec: entry.sourceSpec,
    summary: entry.summary,
    evidence: entry.evidence,
    retryWhen: entry.retryWhen ?? null,
    issue: open.get(entry.id) ?? null,
  }));
}

export function main(argv: readonly string[], runner: Runner, out: Output, error_: Output): number {
  let values: { 'dry-run'?: boolean; ref?: string; list?: boolean };
  try {
    ({ values } = parseArgs({
      args: [...argv],
      options: { 'dry-run': { type: 'boolean' }, ref: { type: 'string' }, list: { type: 'boolean' } },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    error_.write(`${PROGRAM}: ${String(error)}\n${USAGE}`);
    return 1;
  }
  const isDryRun = values['dry-run'] === true;
  if (!isDryRun && values.ref !== undefined) {
    error_.write(`${PROGRAM}: --ref is allowed only with --dry-run\n${USAGE}`);
    return 1;
  }
  const isList = values.list === true;
  if (isList && isDryRun) {
    error_.write(`${PROGRAM}: --list and --dry-run do not combine\n${USAGE}`);
    return 1;
  }
  const reference = values.ref ?? DEFAULT_REF;

  const entries = readEntries(runner, reference);
  if (!entries.ok) {
    error_.write(`${PROGRAM}: ${entries.error}\n`);
    return 1;
  }
  const issues = readIssues(runner);
  if (!issues.ok) {
    error_.write(`${PROGRAM}: ${issues.error}\n`);
    return 1;
  }

  if (isList) {
    out.write(`${JSON.stringify(listEntries(entries.value, issues.value), null, 2)}\n`);
    return 0;
  }

  const plan = planSync(entries.value, issues.value, reference);
  if (isDryRun) {
    printPlan(plan, out);
    printReports(plan.reports, out);
    out.write(`dry run: ${plan.creates.length} to create, ${plan.closes.length} to close as duplicate, ${plan.reports.length} reported\n`);
    return plan.duplicateLedgerIds.length > 0 ? 2 : 0;
  }

  const reports = [...plan.reports];
  let isFailed = plan.duplicateLedgerIds.length > 0;

  // Labels are written only when an issue is: an up-to-date run writes nothing.
  if (plan.creates.length > 0 || plan.closes.length > 0) {
    for (const label of LABELS) {
      const made = runner('gh', [
        'label',
        'create',
        label.name,
        '--color',
        label.color,
        '--description',
        label.description,
        '--force',
      ]);
      if (made.status !== 0) {
        error_.write(`${PROGRAM}: gh label create ${label.name} failed: ${firstLine(made.stderr)}\n`);
        return 1;
      }
    }
  }

  let created = 0;
  for (const create of plan.creates) {
    const made = runner(
      'gh',
      ['issue', 'create', '--title', create.title, '--label', 'deferred', '--body-file', '-'],
      create.body,
    );
    if (made.status === 0) {
      created += 1;
      out.write(`created: ${create.id} ${firstLine(made.stdout)}\n`);
    } else {
      isFailed = true;
      reports.push(`Create failed: ${create.id}: ${firstLine(made.stderr)}`);
    }
  }

  // Race on create: another sync may have created an issue for the same id.
  let closes = plan.closes;
  if (created > 0) {
    const again = readIssues(runner);
    if (!again.ok) {
      printReports(reports, out);
      error_.write(`${PROGRAM}: ${again.error}\n`);
      return 1;
    }
    closes = planDuplicateCloses(again.value);
  }

  let closed = 0;
  for (const close of closes) {
    const done = runner('gh', [
      'issue',
      'close',
      String(close.number),
      '--reason',
      'not planned',
      '--comment',
      `Duplicate of #${close.keep}`,
    ]);
    if (done.status === 0) {
      closed += 1;
      out.write(`closed: #${close.number} as not planned, Duplicate of #${close.keep}\n`);
    } else {
      isFailed = true;
      reports.push(`Close failed: #${close.number}: ${firstLine(done.stderr)}`);
    }
  }

  printReports(reports, out);
  out.write(`${created} created, ${closed} closed as duplicate, ${reports.length} reported\n`);
  return isFailed ? 2 : 0;
}

function isInvokedDirectly(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  try {
    return realpathSync(resolve(entry)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isInvokedDirectly()) {
  // `process.exitCode`, not `process.exit(1)`: an immediate exit truncates a piped write.
  try {
    process.exitCode = main(process.argv.slice(2), run, process.stdout, process.stderr);
  } catch (error) {
    process.stderr.write(`${PROGRAM}: ${String(error)}\n`);
    process.exitCode = 1;
  }
}
