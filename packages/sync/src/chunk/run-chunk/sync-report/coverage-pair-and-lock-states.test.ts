import { createFakeClockPort, createFakeFilesystemPort } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { LOCK_PATH, serialiseLock } from '../../lock.ts';
import { DATASET_PATH, PROGRESS_PATH, REPORT_PATH, TRACKED_PATH } from '../../run-chunk.ts';
import {
  A,
  B,
  FIVE_HOURS_AGO,
  harness,
  key,
  NOW,
  PID,
  PUBLICATION,
  reportOf,
  run,
  scriptedStep,
  SEVEN_HOURS_AGO,
  shellPorts,
} from '../test-support.ts';
import { reportText } from './test-support.ts';

describe('runChunk: the Sync Report', () => {
  it('a failure before the weights read keeps the previous coverage pair', async () => {
    const withPair = JSON.stringify({
      schemaVersion: '1.1.0',
      runStartedAt: SEVEN_HOURS_AGO,
      figures: {
        requestsBySource: { 'tracked-list': 0, 'league-validation': 0, 'session-probe': 0 },
        notReachedCount: 0,
        coverage: 0.75,
        rankableClassCount: 4,
      },
      records: [],
    });
    const fs = createFakeFilesystemPort({
      [TRACKED_PATH]: { contents: '{not json' },
      [REPORT_PATH]: { contents: withPair },
    });
    await expect(
      run({ fs, clock: createFakeClockPort(NOW), pid: PID, ...shellPorts(), publication: PUBLICATION }, scriptedStep().step),
    ).rejects.toThrow(/tracked\.json/);

    const report = await reportOf(fs);
    const figures = report?.figures;
    expect(figures?.coverage).toBe(0.75);
    expect(figures?.rankableClassCount).toBe(4);
  });

  it('a failure before the weights read leaves the pair absent when the previous report has none', async () => {
    const fs = createFakeFilesystemPort({ [TRACKED_PATH]: { contents: '{not json' } });
    await expect(
      run({ fs, clock: createFakeClockPort(NOW), pid: PID, ...shellPorts(), publication: PUBLICATION }, scriptedStep().step),
    ).rejects.toThrow(/tracked\.json/);

    const finalReport = await reportOf(fs);
    const figures = finalReport?.figures;
    expect(figures?.coverage).toBeUndefined();
    expect(figures?.rankableClassCount).toBeUndefined();
  });

  it('busy: no report write', async () => {
    const { fs, ports } = harness([A], {
      [LOCK_PATH]: { contents: serialiseLock({ pid: 99, startedAt: FIVE_HOURS_AGO }) },
    });
    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('busy');
    expect(await fs.exists(REPORT_PATH)).toBe(false);
  });

  it('dispossessed: no report write, on a normal finish or on a throw', async () => {
    await Promise.all(
      [false, true].map(async (throws) => {
        const { fs, ports } = harness([A, B]);
        const successor = serialiseLock({ pid: 99, startedAt: NOW });
        const running = run(ports, (entry) => {
          fs.setFile(LOCK_PATH, { contents: successor });
          return throws && key(entry) === key(B)
            ? Promise.reject(new Error('late'))
            : Promise.resolve({ kind: 'completed' });
        });
        const [settled] = await Promise.allSettled([running]);
        expect(settled).toMatchObject(
          throws
            ? { status: 'rejected', reason: { message: 'late' } }
            : { status: 'fulfilled', value: { kind: 'dispossessed' } },
        );
        expect(await fs.exists(REPORT_PATH)).toBe(false);
        expect(await fs.exists(DATASET_PATH)).toBe(false);
        expect(await fs.readTextFile(LOCK_PATH)).toBe(successor);
      }),
    );
  });

  it('invalid previous: an unknown major refuses loudly and writes nothing', async () => {
    const previous = reportText([], '9.0.0');
    const { fs, ports } = harness([A], { [REPORT_PATH]: { contents: previous } });
    const { visited, step } = scriptedStep();

    await expect(run(ports, step)).rejects.toThrow(/sync-report\.json.*9\.0\.0/);

    expect(visited).toEqual([]);
    expect(await fs.readTextFile(REPORT_PATH)).toBe(previous);
    expect(await fs.exists(DATASET_PATH)).toBe(false);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });
});
