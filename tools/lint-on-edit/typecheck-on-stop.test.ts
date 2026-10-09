import { describe, expect, it } from 'vitest';

import { isRepeatStop, runStopHook } from './typecheck-on-stop';

const FIRST_STOP = JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: false });
const REPEAT_STOP = JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: true });
const ERROR = "tools/a.ts(3,5): error TS2322: Type 'string' is not assignable to type 'number'.";

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

describe('runStopHook', () => {
  it('exits 0 and prints nothing when the build is clean', async () => {
    expect(await runStopHook(FIRST_STOP, () => Promise.resolve(' \n'))).toEqual({ code: 0, report: '' });
  });

  it('blocks the first stop with every diagnostic, not just those of edited files', async () => {
    const result = await runStopHook(FIRST_STOP, () => Promise.resolve(`${ERROR}\n`));
    expect(result.code).toBe(2);
    expect(result.report).toContain(ERROR);
  });

  it('does not block a repeat stop, so an unfixable error cannot loop the agent', async () => {
    const result = await runStopHook(REPEAT_STOP, () => Promise.resolve(ERROR));
    expect(result.code).toBe(1);
    expect(result.report).toContain(ERROR);
  });
});
