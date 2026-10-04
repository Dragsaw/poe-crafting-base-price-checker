import { SYNC_PROGRESS_SCHEMA_VERSION, SyncReportFileSchema } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { LOCK_PATH } from '../lock.ts';
import { PROGRESS_PATH, REPORT_PATH } from '../run-chunk.ts';
import {
  A,
  B,
  C,
  harness,
  key,
  progressOf,
  progressText,
  run,
  scriptedStep,
} from './test-support.ts';

describe('runChunk: resume and pass', () => {
  it('resume: starts after the completed entry, recomputed from the tracked list', async () => {
    const { fs, ports } = harness(undefined, {
      [PROGRESS_PATH]: { contents: progressText([key(A)]) },
    });
    const { visited, step } = scriptedStep();

    const outcome = await run(ports, step);

    expect(visited).toEqual([key(B), key(C)]);
    expect(outcome.completed).toEqual([key(B), key(C)]);
    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [key(A), key(B), key(C)],
    });
  });

  it('pass complete: every non-pruned key done restarts the pass with an empty completed set', async () => {
    const { fs, ports } = harness(undefined, {
      [PROGRESS_PATH]: { contents: progressText([key(A), key(B), key(C)]) },
    });
    const { visited, step } = scriptedStep((entry) =>
      key(entry) === key(A) ? { kind: 'completed', searchRemaining: 0 } : { kind: 'completed' },
    );

    await run(ports, step);

    expect(visited).toEqual([key(A)]);
    // The earlier pass's B and C are gone: only this pass's work is recorded.
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A)] });
  });

  // Story hybrid-mods 2, I/O matrix "Old progress keys": a key the 2.0.0 tracked
  // schema can no longer produce (an absent affix encoded as `null`) ages out.
  it('drops a progress key absent from the current tracked key set, without throwing', async () => {
    const oldKey = '["crafted","weapon.bow","Bows",82,["explicit.stat_1",1,2],null]';
    const { fs, ports } = harness(undefined, {
      [PROGRESS_PATH]: { contents: progressText([oldKey, key(A)]) },
    });
    const { visited, step } = scriptedStep();

    await run(ports, step);

    expect(visited).toEqual([key(B), key(C)]);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [key(A), key(B), key(C)] });
  });

  it('records completed entries only, never the planned ones', async () => {
    const { fs, ports } = harness();
    await run(ports, scriptedStep(() => ({ kind: 'yielded' })).step);
    expect(await progressOf(fs)).toEqual({ schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION, completed: [] });
  });

  it('refuses a progress file of an unknown major and still releases the lock', async () => {
    const { fs, ports } = harness(undefined, {
      [PROGRESS_PATH]: { contents: JSON.stringify({ schemaVersion: '9.0.0', completed: [] }) },
    });
    await expect(run(ports, scriptedStep().step)).rejects.toThrow(/9\.0\.0/);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    // Read before the gate now, it still fails the run at its usual place, with a report.
    const report = SyncReportFileSchema.parse(JSON.parse((await fs.readTextFile(REPORT_PATH)) ?? ''));
    expect(report.records).toEqual([expect.objectContaining({ kind: 'run-failure' })]);
    expect('runFinishedAt' in report).toBe(false);
  });

  it('serialises progress through writeArtifact: the schema’s key order, LF, one trailing newline', async () => {
    const { fs, ports } = harness([A]);
    await run(ports, scriptedStep().step);
    // `SyncProgressFileSchema` extends the progress shape with `schemaVersion`,
    // so the declared order puts it last.
    expect(await fs.readTextFile(PROGRESS_PATH)).toBe(
      `{\n  "completed": [\n    ${JSON.stringify(key(A))}\n  ],\n  "schemaVersion": "1.2.0"\n}\n`,
    );
  });
});
