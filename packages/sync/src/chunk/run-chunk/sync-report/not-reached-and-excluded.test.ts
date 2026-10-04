import { describe, expect, it } from 'vitest';

import {
  A,
  B,
  C,
  catalogueWithout,
  harness,
  key,
  PRUNED,
  raw,
  reportOf,
  run,
  scriptedStep,
} from '../test-support.ts';
import { D, E, P1, P2, P3, starvingStep } from './test-support.ts';

describe('runChunk: the Sync Report', () => {
  it('not reached: 5 eligible, bounded after 2, reports 3', async () => {
    const { fs, ports } = harness([A, B, C, D, E]);
    let remaining = 2;
    const outcome = await run(
      ports,
      scriptedStep(() => {
        remaining -= 1;
        return { kind: 'completed', searchRemaining: remaining };
      }).step,
    );
    expect(outcome).toMatchObject({ kind: 'bounded', completed: [key(A), key(B)] });
    const report = await reportOf(fs);
    expect(report?.figures.notReachedCount).toBe(3);
  });

  it('not reached: a yielded entry was attempted, so it is not counted', async () => {
    const { fs, ports } = harness([A, B, C]);
    await run(
      ports,
      scriptedStep((entry) => (({ kind: key(entry) === key(B) ? 'yielded' : 'completed' }))).step,
    );
    const report = await reportOf(fs);
    expect(report?.figures.notReachedCount).toBe(1);
  });

  it('not reached: a pinned entry cut by the cap counts', async () => {
    const { fs, ports } = harness([P1, P2, P3, A, B]);
    await run(ports, starvingStep());
    // Five in rows 1–3, four attempted: P3 was cut.
    const report = await reportOf(fs);
    expect(report?.figures.notReachedCount).toBe(1);
  });

  it('excluded: a pruned entry and an entry the catalogue check marked never count', async () => {
    const U = raw('U');
    const { fs, ports } = harness([A, B, PRUNED, U], {}, {
      catalogue: () => Promise.resolve({ ok: true, value: catalogueWithout('U') }),
    });
    const { visited, step } = scriptedStep(() => ({ kind: 'completed', searchRemaining: 0 }));

    await run(ports, step);

    expect(visited).toHaveLength(1);
    // A and B are eligible, one attempted.
    const report = await reportOf(fs);
    expect(report?.figures.notReachedCount).toBe(1);
  });
});
