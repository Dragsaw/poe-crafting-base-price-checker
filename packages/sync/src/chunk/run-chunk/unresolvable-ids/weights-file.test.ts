import { WEIGHTS_SCHEMA_VERSION } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { WEIGHTS_PATH } from '../../../catalogue/weights-ids.ts';
import { DataFileError } from '../../../load-data-file.ts';
import { JSON_NULL } from '../../../test-support/json-null.ts';
import { LOCK_PATH } from '../../lock.ts';
import { DATASET_PATH, PROGRESS_PATH } from '../../run-chunk.ts';
import {
  A,
  catalogueWithout,
  harness,
  key,
  raw,
  reportOf,
  run,
  scriptedStep,
} from '../test-support.ts';
import { craftedEntry, withCatalogue } from './test-support.ts';

const weightsPoolOf = (...entries: unknown[]): unknown => ({ poolCoverage: 'complete', entries });

const weightsEntryOf = (id: string, ...lines: unknown[]): unknown => ({
  sourceModifierId: id,
  modGroup: id,
  itemLevelMin: 1,
  weight: 1,
  weightSource: 'published',
  lines,
});

const weightsLineOf = (statId: string | null): unknown => ({ statId, ranges: [] });

const coveredWeights = (suffixCoverage: 'complete' | 'partial'): string =>
  JSON.stringify({
    schemaVersion: WEIGHTS_SCHEMA_VERSION, gamePatch: '0.5.5', producer: { id: 'test', generatedAt: '2026-09-26T00:00:00Z' },
    bases: {
      'weapon.bow': {
        Bows: {
          prefix: { poolCoverage: 'complete', entries: [coverageTier('p1', 'explicit.ok')] },
          // `explicit.stat_suffix` is the suffix every `craftedEntry` carries.
          suffix: { poolCoverage: suffixCoverage, entries: [coverageTier('s1', 'explicit.stat_suffix')] },
        },
      },
    },
  });

const coverageTier = (id: string, statId: string): unknown => ({
  sourceModifierId: id, modGroup: id, itemLevelMin: 1, weight: 1,
  weightSource: 'published',
  lines: [{ statId, ranges: [] }],
});

describe('runChunk: unresolvable ids, detected offline (Story 1.10)', () => {
  it('weights absent: a weights-absent record naming the uncheckable classes, the run otherwise unchanged', async () => {
    const X = craftedEntry('weapon.bow', 'explicit.ok', 'Bows');
    const Y = craftedEntry('armour.chest', 'explicit.ok', 'Body_Armours_str');
    const Z = craftedEntry('armour.chest', 'explicit.ok', 'Pruned_Class', 'pruned');
    const present = harness([A, X, Y, Z]);
    const absent = harness([A, X, Y, Z]);
    await absent.fs.deleteFile(WEIGHTS_PATH);
    const presentRun = scriptedStep();
    const absentRun = scriptedStep();

    await run(present.ports, presentRun.step);
    await run(absent.ports, absentRun.step);

    expect(absentRun.visited).toEqual(presentRun.visited);
    expect(await absent.fs.readTextFile(DATASET_PATH)).toBe(await present.fs.readTextFile(DATASET_PATH));
    const finalReport = await reportOf(absent.fs);
    expect(finalReport?.records).toEqual([
      { kind: 'weights-absent', uncheckableClassNames: ['Body_Armours_str', 'Bows'] },
    ]);
    // Weights present: no weights-absent record.
    const report = await reportOf(present.fs);
    expect(report?.records).toEqual([]);
  });

  describe('pool coverage (AD-27)', () => {
    // A `partial` suffix slot leaves a class uncovered and gets no pool check;
    // a weight-0 suffix would make the cross-file gate refuse the run.
    const X = craftedEntry('weapon.bow', 'explicit.ok', 'Bows');
    const Y = craftedEntry('armour.chest', 'explicit.ok', 'Body_Armours_str');

    it('a present file writes both fields, and a replaced file gives the new figure on the next chunk', async () => {
      const { fs, ports } = harness([X, Y], { [WEIGHTS_PATH]: { contents: coveredWeights('complete') } });

      await run(ports, scriptedStep().step);
      const first = await reportOf(fs);
      expect(first?.figures.coverage).toBe(0.5);
      expect(first?.figures.rankableClassCount).toBe(2);

      await fs.writeTextFile(WEIGHTS_PATH, coveredWeights('partial'));
      await run(ports, scriptedStep().step);
      const second = await reportOf(fs);
      expect(second?.figures.coverage).toBe(0);
      expect(second?.figures.rankableClassCount).toBe(2);
    });

    it('an absent file omits both fields', async () => {
      const { fs, ports } = harness([X]);
      await fs.deleteFile(WEIGHTS_PATH);

      await run(ports, scriptedStep().step);

      const report = await reportOf(fs);
      const figures = report?.figures;
      expect(figures !== undefined && 'coverage' in figures).toBe(false);
      expect(figures !== undefined && 'rankableClassCount' in figures).toBe(false);
    });

    it('a present file with no rankable class omits both fields', async () => {
      const { fs, ports } = harness([A], { [WEIGHTS_PATH]: { contents: coveredWeights('complete') } });

      await run(ports, scriptedStep().step);

      const report = await reportOf(fs);
      const figures = report?.figures;
      expect(figures !== undefined && 'coverage' in figures).toBe(false);
      expect(figures !== undefined && 'rankableClassCount' in figures).toBe(false);
    });
  });

  it('weights miss: one record per distinct uncatalogued id, nulls skipped, and the run continues', async () => {
    const weights = JSON.stringify({
      schemaVersion: WEIGHTS_SCHEMA_VERSION, gamePatch: '0.5.5', producer: { id: 'test', generatedAt: '2026-09-26T00:00:00Z' },
      bases: {
        'weapon.bow': {
          Bows: {
            prefix: weightsPoolOf(weightsEntryOf('p1', weightsLineOf('explicit.w1'), weightsLineOf(JSON_NULL))),
            suffix: weightsPoolOf(weightsEntryOf('s1', weightsLineOf('explicit.w1')), weightsEntryOf('s2', weightsLineOf('explicit.ok'))),
          },
        },
        'weapon.gone': { Gone: { prefix: weightsPoolOf(), suffix: weightsPoolOf() } },
      },
    });
    const { fs, ports } = harness(
      [A],
      { [WEIGHTS_PATH]: { contents: weights } },
      withCatalogue('explicit.w1', 'weapon.gone'),
    );
    const { visited, step } = scriptedStep();

    const outcome = await run(ports, step);

    expect(outcome.kind).toBe('completed');
    expect(visited).toEqual([key(A)]);
    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      { kind: 'uncatalogued-weights-id', identifier: 'weapon.gone', identifierKind: 'categoryId' },
      { kind: 'uncatalogued-weights-id', identifier: 'explicit.w1', identifierKind: 'statId' },
    ]);
    // The file is never rewritten.
    expect(await fs.readTextFile(WEIGHTS_PATH)).toBe(weights);
  });

  it('weights bad major: a run-failure record, the error rethrown, nothing searched, nothing published', async () => {
    // X is uncatalogued: a refusal before the order exists writes the report
    // only, so neither its mark nor its `unresolvable` record appears.
    const { fs, ports } = harness(
      [A, raw('X')],
      { [WEIGHTS_PATH]: { contents: JSON.stringify({ schemaVersion: '5.1.0', bases: {} }) } },
      { catalogue: () => Promise.resolve({ ok: true, value: catalogueWithout('X') }) },
    );
    const { visited, step } = scriptedStep();

    await expect(run(ports, step)).rejects.toThrow(/weights\.json.*5\.1\.0/);

    expect(visited).toEqual([]);
    expect(await fs.exists(DATASET_PATH)).toBe(false);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
    const report = await reportOf(fs);
    expect(report?.runFinishedAt).toBeUndefined();
    expect(report?.records).toEqual([
      expect.objectContaining({ kind: 'run-failure', reason: 'unrecoverable-error' }),
    ]);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('weights hard error: a DataFileError naming the file and the rule, nothing searched, nothing published', async () => {
    const weights = JSON.stringify({
      schemaVersion: WEIGHTS_SCHEMA_VERSION, gamePatch: '0.5.5', producer: { id: 'test', generatedAt: '2026-09-26T00:00:00Z' },
      bases: { 'weapon.bow': { Bows: { prefix: { entries: [] }, suffix: { poolCoverage: 'complete', entries: [] } } } },
    });
    const { fs, ports } = harness([A], { [WEIGHTS_PATH]: { contents: weights } });
    const { visited, step } = scriptedStep();

    const failure = run(ports, step);
    await expect(failure).rejects.toBeInstanceOf(DataFileError);
    await expect(failure).rejects.toMatchObject({ path: WEIGHTS_PATH, reason: 'invalid' });
    await expect(failure).rejects.toThrow(/data\/weights\.json: invalid: bases\.weapon\.bow\.Bows\.prefix\.poolCoverage: /);

    expect(visited).toEqual([]);
    expect(Object.values(ports.requests.snapshot()).every((count) => count === 0)).toBe(true);
    expect(await fs.exists(DATASET_PATH)).toBe(false);
    expect(await fs.exists(PROGRESS_PATH)).toBe(false);
  });
});
