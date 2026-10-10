import { describe, expect, it } from 'vitest';

import { isRepeatStop, isTypescriptInput, parsePorcelain, runStopHook } from './typecheck-on-stop';

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
