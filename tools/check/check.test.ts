import { describe, expect, it } from 'vitest';

import {
  exitCode,
  formatReport,
  formatStepLine,
  groupByStage,
  parseArguments,
  type Runner,
  runSteps,
  selectSteps,
  spawnRunner,
  type Step,
  STEPS,
  type StepResult,
} from './check';

const names = (steps: readonly { readonly name: string }[]): string[] => steps.map((step) => step.name);

const result = (name: string, status: StepResult['status'], output = ''): StepResult => ({
  name,
  status,
  durationMs: 1500,
  output,
});

describe('step table', () => {
  it('lists stage A then stage B, with the documented names', () => {
    expect(STEPS.map((step) => `${step.stage}:${step.name}`)).toEqual([
      'A:typecheck',
      'A:lint',
      'A:depcruise',
      'A:dup',
      'A:knip',
      'B:test',
      'B:test:data',
      'B:build',
    ]);
  });

  it('runs each step through its package script', () => {
    for (const step of STEPS) {expect(step.command).toBe(`pnpm run ${step.name}`);}
  });
});

describe('parseArguments', () => {
  it('defaults to everything', () => {
    expect(parseArguments([])).toEqual({ fast: false, only: undefined, bail: false });
  });

  it('reads the flags', () => {
    expect(parseArguments(['--fast', '--bail'])).toEqual({ fast: true, only: undefined, bail: true });
  });

  it('reads --only as a list, spaced or with =', () => {
    expect(parseArguments(['--only', 'lint,knip']).only).toEqual(['lint', 'knip']);
    expect(parseArguments(['--only=test:data']).only).toEqual(['test:data']);
  });

  it('rejects an unknown step name', () => {
    expect(() => parseArguments(['--only', 'lint,nope'])).toThrow(/unknown step "nope"/);
  });

  it('rejects an empty --only and an unknown flag', () => {
    expect(() => parseArguments(['--only'])).toThrow(/--only needs/);
    expect(() => parseArguments(['--wat'])).toThrow(/unknown argument "--wat"/);
  });
});

describe('selectSteps', () => {
  it('keeps stage A for --fast', () => {
    const selected = selectSteps({ fast: true, only: undefined, bail: false });
    expect(names(selected)).toEqual(['typecheck', 'lint', 'depcruise', 'dup', 'knip']);
  });

  it('keeps the table order for --only, whatever the order given', () => {
    const selected = selectSteps({ fast: false, only: ['build', 'knip', 'lint'], bail: false });
    expect(names(selected)).toEqual(['lint', 'knip', 'build']);
  });

  it('intersects --fast and --only', () => {
    const selected = selectSteps({ fast: true, only: ['lint', 'test'], bail: false });
    expect(names(selected)).toEqual(['lint']);
  });
});

describe('groupByStage', () => {
  it('splits into stage A and stage B and drops an empty stage', () => {
    expect(groupByStage(STEPS).map((group) => names(group))).toEqual([
      ['typecheck', 'lint', 'depcruise', 'dup', 'knip'],
      ['test', 'test:data', 'build'],
    ]);
    expect(groupByStage(selectSteps({ fast: false, only: ['build'], bail: false })).map((group) => names(group))).toEqual([['build']]);
  });
});

function outcome(wasAborted: boolean, isFailing: boolean): StepResult['status'] {
  if (wasAborted) {return 'aborted';}
  return isFailing ? 'failed' : 'passed';
}

/** A runner that records the call order and fails the steps named in `failing`. */
function fakeRunner(failing: readonly string[], log: string[]): Runner {
  return async (step, signal) => {
    log.push(`start ${step.name}`);
    await new Promise((done) => setTimeout(done, step.name === 'slow' ? 200 : 5));
    const wasAborted = signal.aborted;
    log.push(`end ${step.name}`);
    const status = outcome(wasAborted, failing.includes(step.name));
    return { name: step.name, status, durationMs: 1, output: `output of ${step.name}` };
  };
}

const step = (name: string, stage: Step['stage']): Step => ({ name, command: name, stage });

describe('runSteps', () => {
  it('runs every step when one fails, and keeps the step order', async () => {
    const log: string[] = [];
    const seen: string[] = [];
    const results = await runSteps(STEPS, fakeRunner(['lint'], log), false, (r) => {
      seen.push(r.name);
    });
    expect(results.map((r) => `${r.name}:${r.status}`)).toEqual([
      'typecheck:passed',
      'lint:failed',
      'depcruise:passed',
      'dup:passed',
      'knip:passed',
      'test:passed',
      'test:data:passed',
      'build:passed',
    ]);
    expect(seen).toHaveLength(STEPS.length);
    expect(exitCode(results)).toBe(1);
  });

  it('starts a stage together and stage B only after stage A ends', async () => {
    const log: string[] = [];
    await runSteps([step('a1', 'A'), step('a2', 'A'), step('b1', 'B')], fakeRunner([], log), false);
    expect(log.slice(0, 2)).toEqual(['start a1', 'start a2']);
    expect(log.indexOf('start b1')).toBeGreaterThan(log.indexOf('end a1'));
    expect(log.indexOf('start b1')).toBeGreaterThan(log.indexOf('end a2'));
  });

  it('without --bail runs stage B after a stage A failure', async () => {
    const results = await runSteps([step('a1', 'A'), step('b1', 'B')], fakeRunner(['a1'], []), false);
    expect(results.map((r) => r.status)).toEqual(['failed', 'passed']);
  });

  it('with --bail aborts running siblings and skips later stages', async () => {
    const steps = [step('a1', 'A'), step('slow', 'A'), step('b1', 'B')];
    const results = await runSteps(steps, fakeRunner(['a1'], []), true);
    expect(results.map((r) => r.status)).toEqual(['failed', 'aborted', 'skipped']);
    expect(exitCode(results)).toBe(1);
  });

  it('exits 0 when every step passes', async () => {
    expect(exitCode(await runSteps(STEPS, fakeRunner([], []), false))).toBe(0);
  });
});

describe('formatting', () => {
  it('formats one line per step with the status, name and duration', () => {
    expect(formatStepLine(result('lint', 'passed'))).toBe('PASS  lint       1.5s');
    expect(formatStepLine(result('test:data', 'failed'))).toBe('FAIL  test:data  1.5s');
    expect(formatStepLine(result('build', 'skipped'))).toMatch(/^SKIP {2}build/);
  });

  it('prints output for failed steps only, then the totals', () => {
    const report = formatReport(
      [result('typecheck', 'passed', 'quiet pass output'), result('lint', 'failed', 'src/a.ts 1:1 error\n')],
      61_234,
    );
    expect(report).toContain('===== lint output =====\nsrc/a.ts 1:1 error');
    expect(report).not.toContain('quiet pass output');
    expect(report.trimEnd().split('\n').pop()).toBe('check: 1 passed, 1 failed (61.2s)');
  });

  it('counts aborted and skipped steps in the totals', () => {
    const report = formatReport([result('a', 'failed'), result('b', 'aborted'), result('c', 'skipped')], 1000);
    expect(report).toContain('check: 0 passed, 1 failed, 1 aborted, 1 skipped (1.0s)');
  });
});

const timed = (name: string, stage: Step['stage'], milliseconds: number, exit = 0): Step => ({
  name,
  stage,
  command: `node -e "const s=Date.now();setTimeout(()=>{console.log(s+' '+Date.now());process.exitCode=${exit}},${milliseconds})"`,
});
const interval = (r: StepResult): [number, number] => {
  const [start = 0, end = 0] = (r.output.split(/\r?\n/, 1)[0] ?? '').trim().split(' ').map(Number);
  return [start, end];
};

// Real `node -e` processes that print their start and end time: the assertions compare
// intervals, not wall-clock budgets.
describe('spawnRunner', () => {
  it('runs a stage in parallel, runs stage B after A, and survives a failing step', async () => {
    const steps = [timed('a1', 'A', 400), timed('a2', 'A', 400, 3), timed('b1', 'B', 50)];
    const results = await runSteps(steps, spawnRunner, false);
    expect(results.map((r) => r.status)).toEqual(['passed', 'failed', 'passed']);
    const [a1, a2, b1] = results.map((r) => interval(r)) as [[number, number], [number, number], [number, number]];
    expect(a1[0]).toBeLessThan(a2[1]);
    expect(a2[0]).toBeLessThan(a1[1]);
    expect(b1[0]).toBeGreaterThanOrEqual(Math.max(a1[1], a2[1]));
  }, 30_000);

  it('buffers stdout and stderr and reports the exit code of a failure', async () => {
    const command = `node -e "console.log('out-line');console.error('err-line');process.exit(2)"`;
    const [finished] = await runSteps([{ name: 'x', stage: 'A', command }], spawnRunner, false);
    expect(finished?.status).toBe('failed');
    expect(finished?.output).toContain('out-line');
    expect(finished?.output).toContain('err-line');
    expect(finished?.output).toContain('exit code 2');
  }, 30_000);

  it('aborts a long step when a sibling fails under --bail', async () => {
    const long = timed('long', 'A', 60_000);
    const started = Date.now();
    const results = await runSteps([timed('bad', 'A', 300, 1), long, timed('later', 'B', 10)], spawnRunner, true);
    expect(results.map((r) => r.status)).toEqual(['failed', 'aborted', 'skipped']);
    expect(Date.now() - started).toBeLessThan(20_000);
  }, 30_000);
});
