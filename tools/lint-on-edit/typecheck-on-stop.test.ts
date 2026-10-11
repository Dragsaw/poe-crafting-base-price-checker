import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  hasRunningSubagent,
  isRepeatStop,
  isTypescriptInput,
  parsePorcelain,
  realTypecheck,
  runStopHook,
  TYPECHECK_BUDGET_MS,
  TypecheckTimeout,
} from './typecheck-on-stop';

const FIRST_STOP = JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: false });
const REPEAT_STOP = JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: true });
const ERROR = "tools/a.ts(3,5): error TS2322: Type 'string' is not assignable to type 'number'.";
const TS_CHANGED = () => Promise.resolve(['tools/a.ts']);

describe('isRepeatStop', () => {
  it('reads stop_hook_active', () => {
    expect(isRepeatStop(REPEAT_STOP)).toBe(true);
    expect(isRepeatStop(FIRST_STOP)).toBe(false);
  });

  it('is false for a payload without the field or for text that is not JSON', () => {
    expect(isRepeatStop('{}')).toBe(false);
    expect(isRepeatStop('null')).toBe(false);
    expect(isRepeatStop('garbage')).toBe(false);
  });
});

describe('parsePorcelain', () => {
  it('reads modified, untracked and both paths of a rename', () => {
    const text = [' M a.ts', '?? docs/b.md', 'R  new.ts', 'old.ts', 'A  c.tsx', ''].join('\0');
    expect(parsePorcelain(text)).toEqual(['a.ts', 'docs/b.md', 'new.ts', 'old.ts', 'c.tsx']);
  });

  it('is empty for a clean tree', () => {
    expect(parsePorcelain('')).toEqual([]);
  });
});

describe('isTypescriptInput', () => {
  it('accepts TypeScript sources and tsconfig files', () => {
    for (const file of ['a.ts', 'b.tsx', 'c.mts', 'd.cts', 'tsconfig.json', 'packages/web/tsconfig.app.json']) {
      expect(isTypescriptInput(file)).toBe(true);
    }
  });

  it('rejects docs, data and other config', () => {
    for (const file of ['README.md', 'data/tracked.json', 'package.json', 'a.ts.md']) {
      expect(isTypescriptInput(file)).toBe(false);
    }
  });
});

describe('runStopHook', () => {
  it('exits 0 and prints nothing when the build is clean', async () => {
    expect(await runStopHook(FIRST_STOP, () => Promise.resolve(' \n'), TS_CHANGED)).toEqual({ code: 0, report: '' });
  });

  it('blocks the first stop with every diagnostic, not just those of edited files', async () => {
    const result = await runStopHook(FIRST_STOP, () => Promise.resolve(`${ERROR}\n`), TS_CHANGED);
    expect(result.code).toBe(2);
    expect(result.report).toContain(ERROR);
  });

  it('does not block a repeat stop, so an unfixable error cannot loop the agent', async () => {
    const result = await runStopHook(REPEAT_STOP, () => Promise.resolve(ERROR), TS_CHANGED);
    expect(result.code).toBe(1);
    expect(result.report).toContain(ERROR);
  });

  it('skips the typecheck when no uncommitted file is a TypeScript input', async () => {
    let didRun = false;
    const typecheck = () => {
      didRun = true;
      return Promise.resolve(ERROR);
    };
    expect(await runStopHook(FIRST_STOP, typecheck, () => Promise.resolve(['docs/a.md']))).toEqual({ code: 0, report: '' });
    expect(await runStopHook(FIRST_STOP, typecheck, () => Promise.resolve([]))).toEqual({ code: 0, report: '' });
    expect(didRun).toBe(false);
  });

  it('typechecks when git cannot list the changes', async () => {
    const result = await runStopHook(FIRST_STOP, () => Promise.resolve(ERROR), () => Promise.resolve(undefined));
    expect(result.code).toBe(2);
  });
});

describe('runStopHook with background tasks', () => {
  it('exits 0 without a typecheck while a subagent runs', async () => {
    let didRun = false;
    const stdin = JSON.stringify({ stop_hook_active: false, background_tasks: [{ type: 'subagent', id: 'a1' }] });
    const typecheck = () => {
      didRun = true;
      return Promise.resolve(ERROR);
    };
    expect(await runStopHook(stdin, typecheck, TS_CHANGED)).toEqual({ code: 0, report: '' });
    expect(didRun).toBe(false);
  });

  it('typechecks as usual when only a shell task runs', async () => {
    const stdin = JSON.stringify({ stop_hook_active: false, background_tasks: [{ type: 'shell' }] });
    const result = await runStopHook(stdin, () => Promise.resolve(ERROR), TS_CHANGED);
    expect(result.code).toBe(2);
  });

  it('reads no subagent from a payload without the field or from text that is not JSON', () => {
    expect(hasRunningSubagent(FIRST_STOP)).toBe(false);
    expect(hasRunningSubagent('null')).toBe(false);
    expect(hasRunningSubagent('{"background_tasks":[null]}')).toBe(false);
    expect(hasRunningSubagent('garbage')).toBe(false);
  });
});

const timedOut = () => Promise.reject(new TypecheckTimeout(100_000));

describe('runStopHook on a typecheck timeout', () => {
  it('blocks the first stop and says to run pnpm typecheck', async () => {
    const result = await runStopHook(FIRST_STOP, timedOut, TS_CHANGED);
    expect(result.code).toBe(2);
    expect(result.report).toContain('`tsc -b` did not finish within 100 s');
    expect(result.report).toContain('pnpm typecheck');
  });

  it('does not block a repeat stop', async () => {
    const result = await runStopHook(REPEAT_STOP, timedOut, TS_CHANGED);
    expect(result.code).toBe(1);
  });
});

describe('realTypecheck', () => {
  const tsc = path.resolve(import.meta.dirname, '../../node_modules/typescript/bin/tsc');
  let project: string;

  beforeEach(() => {
    project = mkdtempSync(path.join(os.tmpdir(), 'typecheck-on-stop-'));
    writeFileSync(
      path.join(project, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { strict: true, noEmit: true, types: [] }, files: ['a.ts'] }),
    );
  });

  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  it('returns the diagnostics of a broken project', async () => {
    writeFileSync(path.join(project, 'a.ts'), "export const n: number = 'text';\n");
    expect(await realTypecheck(project, tsc)()).toContain('TS2322');
  }, 60_000);

  it('returns an empty string for a clean project', async () => {
    writeFileSync(path.join(project, 'a.ts'), 'export const n: number = 1;\n');
    expect(await realTypecheck(project, tsc)()).toBe('');
  }, 60_000);

  it('throws TypecheckTimeout when tsc -b runs past its budget', async () => {
    writeFileSync(path.join(project, 'a.ts'), 'export const n: number = 1;\n');
    await expect(realTypecheck(project, tsc, 1)()).rejects.toBeInstanceOf(TypecheckTimeout);
  }, 60_000);
});

describe('TYPECHECK_BUDGET_MS', () => {
  it('stays below the Stop hook timeout in .claude/settings.json, with room for git status', () => {
    const settingsPath = path.resolve(import.meta.dirname, '../../.claude/settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
      hooks: { Stop: { hooks: { command: string; timeout?: number }[] }[] };
    };
    const hook = settings.hooks.Stop.flatMap((group) => group.hooks).find((entry) =>
      entry.command.includes('typecheck-on-stop.ts'),
    );
    expect(hook?.timeout).toBeDefined();
    expect(TYPECHECK_BUDGET_MS / 1000 + 20).toBeLessThanOrEqual(hook?.timeout ?? 0);
  });
});
