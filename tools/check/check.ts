import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';

import { isInvokedDirectly } from '../entry-guard/is-invoked-directly.ts';

// Run by bare `node` (type stripping), so this module imports only builtins and `.ts` siblings.
// Every step runs even when another fails, so one run shows every problem.

export type Stage = 'A' | 'B';

export interface Step {
  readonly name: string;
  /** One shell command line. A shell runs it, so `pnpm` resolves to `pnpm.cmd` on Windows. */
  readonly command: string;
  readonly stage: Stage;
}

export const STEPS: readonly Step[] = [
  { name: 'typecheck', command: 'pnpm run typecheck', stage: 'A' },
  { name: 'lint', command: 'pnpm run lint', stage: 'A' },
  { name: 'depcruise', command: 'pnpm run depcruise', stage: 'A' },
  { name: 'dup', command: 'pnpm run dup', stage: 'A' },
  { name: 'knip', command: 'pnpm run knip', stage: 'A' },
  { name: 'test', command: 'pnpm run test', stage: 'B' },
  { name: 'test:data', command: 'pnpm run test:data', stage: 'B' },
  { name: 'build', command: 'pnpm run build', stage: 'B' },
];

export interface Options {
  readonly fast: boolean;
  /** Step names from `--only`, or `undefined` for all steps. */
  readonly only: readonly string[] | undefined;
  readonly bail: boolean;
}

/** The step names of a `--only` value. Throws on an empty list or an unknown name. */
function parseNames(raw: string | undefined, steps: readonly Step[]): string[] {
  const names = (raw ?? '').split(',').filter(Boolean);
  if (names.length === 0) {throw new Error('--only needs a comma-separated list of step names');}
  const known = steps.map((step) => step.name);
  const unknown = names.filter((name) => !known.includes(name)).map((name) => `"${name}"`);
  if (unknown.length > 0) {throw new Error(`unknown step ${unknown.join(', ')}; steps are ${known.join(', ')}`);}
  return names;
}

/** Throws on an unknown flag, a missing `--only` value or an unknown step name. */
export function parseArguments(argv: readonly string[], steps: readonly Step[] = STEPS): Options {
  const flags = new Set<string>();
  let only: string[] | undefined;
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index] ?? '';
    if (argument === '--fast' || argument === '--bail') {
      flags.add(argument);
    } else if (argument === '--only') {
      only = parseNames(argv[++index], steps);
    } else if (argument.startsWith('--only=')) {
      only = parseNames(argument.slice('--only='.length), steps);
    } else {
      throw new Error(`unknown argument "${argument}"; use --fast, --only a,b or --bail`);
    }
  }
  return { fast: flags.has('--fast'), only, bail: flags.has('--bail') };
}

/** The steps to run, in table order: `--fast` keeps stage A, `--only` keeps the named steps. */
export function selectSteps(options: Options, steps: readonly Step[] = STEPS): Step[] {
  return steps.filter(
    (step) => (!options.fast || step.stage === 'A') && (options.only === undefined || options.only.includes(step.name)),
  );
}

const STAGE_ORDER: readonly Stage[] = ['A', 'B'];

/** Steps grouped by stage, in stage order, without an empty stage. */
export function groupByStage(steps: readonly Step[]): Step[][] {
  return STAGE_ORDER.map((stage) => steps.filter((step) => step.stage === stage)).filter((group) => group.length > 0);
}

export type Status = 'passed' | 'failed' | 'aborted' | 'skipped';

export interface StepResult {
  readonly name: string;
  readonly status: Status;
  readonly durationMs: number;
  /** Combined stdout and stderr, in arrival order. */
  readonly output: string;
}

/** Runs one step. It must resolve (never reject) and must end the step when `signal` aborts. */
export type Runner = (step: Step, signal: AbortSignal) => Promise<StepResult>;

function skipped(step: Step): StepResult {
  return { name: step.name, status: 'skipped', durationMs: 0, output: '' };
}

/** Runs one stage in parallel. Aborts the running steps when `shouldBail` and one fails. */
async function runStage(
  stage: readonly Step[],
  runner: Runner,
  shouldBail: boolean,
  finish: (result: StepResult) => void,
): Promise<StepResult[]> {
  const controller = new AbortController();
  return Promise.all(
    stage.map(async (step) => {
      const result = await runner(step, controller.signal);
      finish(result);
      if (shouldBail && result.status === 'failed') {controller.abort();}
      return result;
    }),
  );
}

// A failing step never cancels its siblings, except with `shouldBail`: then the running
// siblings abort and later stages report `skipped`. Results keep the order of `steps`.
export async function runSteps(
  steps: readonly Step[],
  runner: Runner,
  shouldBail: boolean,
  onResult?: (result: StepResult) => void,
): Promise<StepResult[]> {
  const results = new Map<string, StepResult>();
  const finish = (result: StepResult): void => {
    results.set(result.name, result);
    onResult?.(result);
  };
  const runFrom = async (stages: readonly (readonly Step[])[], isStopped: boolean): Promise<void> => {
    const [stage, ...rest] = stages;
    if (stage === undefined) {return;}
    if (isStopped) {
      for (const step of stage) {finish(skipped(step));}
    }
    const stageResults = isStopped ? [] : await runStage(stage, runner, shouldBail, finish);
    const didStop = isStopped || (shouldBail && stageResults.some((result) => result.status === 'failed'));
    await runFrom(rest, didStop);
  };
  await runFrom(groupByStage(steps), false);
  return steps.map((step) => results.get(step.name) ?? skipped(step));
}

const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

const LABELS: Readonly<Record<Status, string>> = { passed: 'PASS', failed: 'FAIL', aborted: 'ABRT', skipped: 'SKIP' };

/** One line for a step: status, name, duration. */
export function formatStepLine(result: StepResult): string {
  return `${LABELS[result.status]}  ${result.name.padEnd(10)} ${seconds(result.durationMs)}`;
}

/** The buffered output of each failed step, then the totals line. */
export function formatReport(results: readonly StepResult[], totalMs: number): string {
  const count = (status: Status): number => results.filter((result) => result.status === status).length;
  const failures = results
    .filter((result) => result.status === 'failed')
    .map((result) => `\n===== ${result.name} output =====\n${result.output.trimEnd()}\n`);
  const extra = (['aborted', 'skipped'] as const)
    .filter((status) => count(status) > 0)
    .map((status) => `, ${count(status)} ${status}`)
    .join('');
  const summary = `check: ${count('passed')} passed, ${count('failed')} failed${extra} (${seconds(totalMs)})`;
  return `${failures.join('')}\n${summary}\n`;
}

export function exitCode(results: readonly StepResult[]): number {
  return results.some((result) => result.status === 'failed') ? 1 : 0;
}

/** A fixed path, not a PATH lookup. */
const TASKKILL = path.join(process.env['SystemRoot'] ?? String.raw`C:\Windows`, 'System32', 'taskkill.exe');

/** Kills a process and its descendants. A shell does not pass a signal on, and `taskkill /T` is the Windows tree kill. */
function killTree(pid: number): void {
  if (process.platform === 'win32') {
    spawnSync(TASKKILL, ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // Already gone.
  }
}

/** The real runner: a shell runs the command, with stdout and stderr buffered into one string. */
export const spawnRunner: Runner = (step, signal) =>
  new Promise((done) => {
    const started = Date.now();
    let output = '';
    let wasAborted = false;
    // POSIX: its own process group, so the abort reaches the grandchildren.
    const child = spawn(step.command, { shell: true, detached: process.platform !== 'win32', windowsHide: true });
    const onAbort = (): void => {
      wasAborted = true;
      if (child.pid !== undefined) {killTree(child.pid);}
    };
    if (signal.aborted) {onAbort();} else {signal.addEventListener('abort', onAbort, { once: true });}
    const collect = (chunk: Buffer): void => {
      output += chunk.toString('utf8');
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const end = (status: Status, note = ''): void => {
      signal.removeEventListener('abort', onAbort);
      done({ name: step.name, status, durationMs: Date.now() - started, output: output + note });
    };
    child.on('error', (error) => { end('failed', `${error.message}\n`); });
    child.on('close', (code) => {
      if (wasAborted) {end('aborted');} else {end(code === 0 ? 'passed' : 'failed', code === 0 ? '' : `exit code ${code}\n`);}
    });
  });

async function main(argv: readonly string[]): Promise<number> {
  const options = parseArguments(argv);
  const steps = selectSteps(options);
  const started = Date.now();
  const results = await runSteps(steps, spawnRunner, options.bail, (result) => {
    process.stdout.write(`${formatStepLine(result)}\n`);
  });
  process.stdout.write(formatReport(results, Date.now() - started));
  return exitCode(results);
}

if (isInvokedDirectly(import.meta.url)) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`check: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
