import { WEIGHTS_SCHEMA_VERSION } from '@poe/contracts';
import type { TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { WEIGHTS_PATH } from '../../catalogue/weights-ids.ts';
import { CrossFileGateError } from '../cross-file-gate.ts';
import { LOCK_PATH } from '../lock.ts';
import { DATASET_PATH, PROGRESS_PATH } from '../run-chunk.ts';
import {
  A,
  catalogueWithout,
  harness,
  key,
  progressText,
  reportOf,
  run,
  scriptedStep,
} from './test-support.ts';

const bow = (valueMin: number, valueMax: number): TrackedEntry => ({
  kind: 'crafted',
  categoryId: 'weapon.bow',
  className: 'Bows',
  itemLevelMin: 82,
  prefix: { kind: 'banded', statId: 'explicit.stat_1', valueMin, valueMax },
  suffix: { kind: 'banded', statId: 'explicit.stat_2', valueMin: 1, valueMax: 2 },
  status: 'active',
});

describe('runChunk: the cross-file gate (AD-12, AD-17)', () => {
  /** A Bows class whose one prefix tier derives to `[43, 56.5]`. */
  const BOWS_WEIGHTS = JSON.stringify({
    schemaVersion: WEIGHTS_SCHEMA_VERSION,
    gamePatch: '0.5.5',
    producer: { id: 'test', generatedAt: '2026-09-26T00:00:00Z' },
    bases: {
      'weapon.bow': {
        Bows: {
          prefix: {
            poolCoverage: 'complete',
            entries: [
              {
                sourceModifierId: 'p1',
                modGroup: 'P',
                itemLevelMin: 60,
                weight: 100,
                weightSource: 'published',
                lines: [{ statId: 'explicit.stat_1', ranges: [[43, 56.5]] }],
              },
            ],
          },
          suffix: {
            poolCoverage: 'complete',
            entries: [
              {
                sourceModifierId: 's1',
                modGroup: 'S',
                itemLevelMin: 1,
                weight: 100,
                weightSource: 'published',
                lines: [{ statId: 'explicit.stat_2', ranges: [[1, 2]] }],
              },
            ],
          },
        },
      },
    },
  });
  const PREVIOUS_PROGRESS = progressText([key(A)]);

  it('throws before the order on any failure: one record per failure, no publish, progress untouched', async () => {
    const sentinel = bow(0, 9999);
    const { fs, ports } = harness([A, sentinel], {
      [WEIGHTS_PATH]: { contents: BOWS_WEIGHTS },
      [PROGRESS_PATH]: { contents: PREVIOUS_PROGRESS },
    });
    const { visited, step } = scriptedStep();

    await expect(run(ports, step)).rejects.toBeInstanceOf(CrossFileGateError);

    expect(visited).toEqual([]);
    expect(await fs.exists(DATASET_PATH)).toBe(false);
    expect(await fs.readTextFile(PROGRESS_PATH)).toBe(PREVIOUS_PROGRESS);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    const report = await reportOf(fs);
    const records = report?.records ?? [];
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ kind: 'cross-file-gate-failure', check: 'edge-alignment', entryKey: key(sentinel) });
  });

  it('keeps the run-start records and puts the gate records after them', async () => {
    const sentinel = bow(0, 9999);
    const { fs, ports } = harness(
      [A, sentinel],
      { [WEIGHTS_PATH]: { contents: BOWS_WEIGHTS } },
      { catalogue: () => Promise.resolve({ ok: true, value: catalogueWithout('A') }) },
    );

    await expect(run(ports, scriptedStep().step)).rejects.toBeInstanceOf(CrossFileGateError);

    const report = await reportOf(fs);
    const kinds = (report?.records ?? []).map((record) => record.kind);
    expect(kinds).toContain('unresolvable');
    expect(kinds.at(-1)).toBe('cross-file-gate-failure');
    expect(kinds.indexOf('unresolvable')).toBeLessThan(kinds.indexOf('cross-file-gate-failure'));
  });

  it('runs the chunk when every check passes', async () => {
    const { ports } = harness([A, bow(43, 56.5)], { [WEIGHTS_PATH]: { contents: BOWS_WEIGHTS } });
    const { visited, step } = scriptedStep();

    const outcome = await run(ports, step);

    expect(outcome.kind).toBe('completed');
    expect(visited).toContain(key(A));
  });

  it('skips the gate without a weights file', async () => {
    const { fs, ports } = harness([A, bow(0, 9999)]);
    await fs.deleteFile(WEIGHTS_PATH);

    const outcome = await run(ports, scriptedStep().step);
    expect(outcome.kind).toBe('completed');
  });

  it('keeps one record per (check, entry) across two failing runs', async () => {
    const sentinel = bow(0, 9999);
    const { fs, ports } = harness([sentinel], { [WEIGHTS_PATH]: { contents: BOWS_WEIGHTS } });
    await expect(run(ports, scriptedStep().step)).rejects.toBeInstanceOf(CrossFileGateError);
    await expect(run(ports, scriptedStep().step)).rejects.toBeInstanceOf(CrossFileGateError);

    const report = await reportOf(fs);
    const records = report?.records ?? [];
    expect(records.filter((record) => record.kind === 'cross-file-gate-failure')).toHaveLength(1);
  });
});
