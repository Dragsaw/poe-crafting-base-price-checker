import { describe, expect, it } from 'vitest';

import { DEFAULT_PORT, ownAncestry, parsePort, planStop, type ProcessInfo } from './dev-stop';

const ROOT = 'E:\\Projects\\poe';
const NONE = new Set<number>();

/** The chain observed under a background `pnpm dev` on Windows, harness shell included. */
const CHAIN: readonly ProcessInfo[] = [
  { pid: 1, ppid: 0, commandLine: 'C:\\Users\\me\\.local\\bin\\claude.exe' },
  { pid: 10, ppid: 1, commandLine: 'bash -c "pnpm dev --port 5199"' },
  { pid: 11, ppid: 10, commandLine: '"C:\\Program Files\\Git\\usr\\bin\\sh.exe" /c/Users/me/npm/pnpm dev --port 5199' },
  { pid: 12, ppid: 11, commandLine: 'C:\\Users\\me\\npm\\node_modules\\pnpm\\pnpm.exe dev --port 5199' },
  { pid: 13, ppid: 12, commandLine: 'cmd.exe /d /c ""C:\\pnpm\\12.5.1\\bin\\pnpm.cmd" dev --port 5199"' },
  { pid: 14, ppid: 13, commandLine: '"C:\\pnpm\\12.5.1\\pnpm.exe" dev --port 5199' },
  { pid: 15, ppid: 14, commandLine: 'cmd.exe /d /s /c vite --config packages/web/vite.config.ts "--port" "5199"' },
  {
    pid: 16,
    ppid: 15,
    commandLine: 'node "E:\\Projects\\poe\\node_modules\\.bin\\\\..\\vite\\bin\\vite.js" --config packages/web/vite.config.ts',
  },
];

describe('parsePort', () => {
  it('defaults to the vite.config.ts port', () => {
    expect(parsePort([])).toBe(DEFAULT_PORT);
  });

  it('reads --port <n> and --port=<n>', () => {
    expect(parsePort(['--port', '5199'])).toBe(5199);
    expect(parsePort(['--port=5174'])).toBe(5174);
  });

  it('rejects a port that is not an integer in range', () => {
    expect(() => parsePort(['--port'])).toThrow(/--port/);
    expect(() => parsePort(['--port', 'abc'])).toThrow(/"abc"/);
    expect(() => parsePort(['--port=70000'])).toThrow(/"70000"/);
  });
});

describe('planStop', () => {
  it('is idle when nothing listens', () => {
    expect(planStop([], CHAIN, ROOT, NONE)).toEqual({ kind: 'idle' });
  });

  it('climbs from Vite to the top of the pnpm dev chain and stops below the runtime', () => {
    expect(planStop([16], CHAIN, ROOT, NONE)).toEqual({ kind: 'kill', roots: [10] });
  });

  it('climbs from an orphaned chain whose launching shell is gone', () => {
    const orphaned = CHAIN.filter((info) => info.pid !== 10);
    expect(planStop([16], orphaned, ROOT, NONE)).toEqual({ kind: 'kill', roots: [11] });
  });

  it('stops below a reused PID whose process started after the orphan', () => {
    // Each process started in PID order; the launching shell 10 is gone, and
    // Windows gave its PID to another agent's later `pnpm test`.
    const timed = CHAIN.map((info) => ({ ...info, started: info.pid * 1000 }));
    const reused = timed.map((info) =>
      info.pid === 10 ? { pid: 10, ppid: 1, commandLine: 'bash -c "pnpm test"', started: 99_000 } : info,
    );
    expect(planStop([16], reused, ROOT, NONE)).toEqual({ kind: 'kill', roots: [11] });
  });

  it('ends the climb on a ppid cycle', () => {
    // A reused PID 10 that is a child of the listener closes the loop 16 → … → 11 → 10 → 16.
    const cyclic = CHAIN.map((info) =>
      info.pid === 10 ? { pid: 10, ppid: 16, commandLine: 'cmd.exe /c vite build' } : info,
    );
    expect(planStop([16], cyclic, ROOT, NONE)).toEqual({ kind: 'kill', roots: [10] });
  });

  it('stops at a parent that is not part of a pnpm dev chain', () => {
    const interactive = CHAIN.map((info) => (info.pid === 11 ? { ...info, commandLine: 'bash --login -i' } : info));
    expect(planStop([16], interactive, ROOT, NONE)).toEqual({ kind: 'kill', roots: [12] });
  });

  it('never climbs into a protected PID', () => {
    expect(planStop([16], CHAIN, ROOT, new Set([13]))).toEqual({ kind: 'kill', roots: [14] });
  });

  it('matches the checkout path case- and separator-insensitively', () => {
    expect(planStop([16], CHAIN, 'e:/projects/POE', NONE)).toMatchObject({ kind: 'kill' });
  });

  it("refuses another worktree's Vite", () => {
    expect(planStop([16], CHAIN, 'E:\\Projects\\poe-other', NONE)).toMatchObject({
      kind: 'refuse',
      reason: expect.stringContaining('PID 16 is not this checkout'),
    });
  });

  it('refuses a listener that is not Vite', () => {
    const other = [{ pid: 50, ppid: 1, commandLine: 'E:\\Projects\\poe\\node_modules\\x\\server.exe' }];
    expect(planStop([50], other, ROOT, NONE)).toMatchObject({ kind: 'refuse' });
  });

  it('refuses a listener missing from the process table', () => {
    expect(planStop([99], CHAIN, ROOT, NONE)).toMatchObject({
      kind: 'refuse',
      reason: expect.stringContaining('PID 99'),
    });
  });
});

describe('ownAncestry', () => {
  it('protects the caller and every live ancestor', () => {
    expect(ownAncestry(CHAIN, 13)).toEqual(new Set([13, 12, 11, 10, 1, 0]));
  });

  it('ends on a ppid cycle', () => {
    const cyclic = [
      { pid: 5, ppid: 6, commandLine: 'a' },
      { pid: 6, ppid: 5, commandLine: 'b' },
    ];
    expect(ownAncestry(cyclic, 5)).toEqual(new Set([5, 6]));
  });

  it('keeps a dev:stop run from inside the chain from killing its caller', () => {
    // dev:stop runs as a child of the pnpm at 14, so the climb stops below it.
    const inside = [...CHAIN, { pid: 20, ppid: 14, commandLine: 'node tools/dev-stop/dev-stop.ts' }];
    expect(planStop([16], inside, ROOT, ownAncestry(inside, 20))).toEqual({ kind: 'kill', roots: [15] });
  });
});
