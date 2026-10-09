import { DatasetFileSchema, SYNC_PROGRESS_SCHEMA_VERSION } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { LeagueMismatchError, LeagueRequestRejectedError } from '../../../league/league-gate.ts';
import { LOCK_PATH, serialiseLock } from '../../lock.ts';
import { DATASET_PATH, PROGRESS_PATH, REPORT_PATH } from '../../run-chunk.ts';
import { A, B, FIVE_HOURS_AGO, key, NOW, progressOf, reportOf, run } from '../test-support.ts';
import { gated, LEAGUES, ok, PREVIOUS_DATASET, PREVIOUS_PROGRESS, ZERO } from './test-support.ts';

describe('runChunk: the league gate (Story 1.11)', () => {
  it('match: the chunk runs, one league-validation request, no record', async () => {
    const { fs, ports, leaguesHttp, visited, step } = gated('Standard', ok(LEAGUES));

    const outcome = await run(ports, step);

    expect(outcome.kind).toBe('completed');
    expect(visited).toEqual([key(A), key(B)]);
    expect(leaguesHttp.requests).toHaveLength(1);
    const report = await reportOf(fs);
    expect(report?.figures.requestsBySource).toEqual({
      ...ZERO,
      'tracked-list': 2,
      'league-validation': 1,
      'session-probe': 0,
    });
    expect(report?.records).toEqual([]);
    expect(report?.runFinishedAt).toBe(NOW);
  });

  it('mismatch: a league-mismatch record, no dataset or progress write, lock released, no step', async () => {
    const { fs, ports, visited, step } = gated('Runes of Aldur', ok(LEAGUES), {
      [DATASET_PATH]: { contents: PREVIOUS_DATASET },
      [PROGRESS_PATH]: { contents: PREVIOUS_PROGRESS },
    });

    await expect(run(ports, step)).rejects.toBeInstanceOf(LeagueMismatchError);

    expect(visited).toEqual([]);
    expect(await fs.readTextFile(DATASET_PATH)).toBe(PREVIOUS_DATASET);
    expect(await fs.readTextFile(PROGRESS_PATH)).toBe(PREVIOUS_PROGRESS);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      {
        kind: 'league-mismatch',
        configuredLeague: 'Runes of Aldur',
        availableLeagues: ['Forbidden Rites', 'Standard'],
      },
    ]);
    expect(report?.figures.requestsBySource).toEqual({ ...ZERO, 'league-validation': 1 });
    expect(report !== undefined && 'runFinishedAt' in report).toBe(false);
  });

  it('case or spacing: ids compare byte for byte, so "forbidden rites" is a mismatch', async () => {
    const { fs, ports, visited, step } = gated('forbidden rites', ok(LEAGUES));

    await expect(run(ports, step)).rejects.toBeInstanceOf(LeagueMismatchError);

    expect(visited).toEqual([]);
    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      {
        kind: 'league-mismatch',
        configuredLeague: 'forbidden rites',
        availableLeagues: ['Forbidden Rites', 'Standard'],
      },
    ]);
  });

  it('empty list: a mismatch with no available leagues', async () => {
    const { fs, ports, step } = gated('Standard', ok({ result: [] }));

    await expect(run(ports, step)).rejects.toBeInstanceOf(LeagueMismatchError);

    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      { kind: 'league-mismatch', configuredLeague: 'Standard', availableLeagues: [] },
    ]);
  });

  it('rejected: a 404 is a trade-request-rejected run-failure with the status and no entry key', async () => {
    const { fs, ports, visited, step } = gated('Standard', { status: 404, headers: {}, body: '' });

    await expect(run(ports, step)).rejects.toBeInstanceOf(LeagueRequestRejectedError);

    expect(visited).toEqual([]);
    // The order exists, so the throw publishes the marks. A gate 4xx would be
    // refused again on the next tick, so it writes the abort notBefore.
    // With no previous dataset there is no earlier label, so the configured one is written.
    const published = DatasetFileSchema.parse(JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? ''));
    expect(published.league).toBe('Standard');
    expect(await progressOf(fs)).toEqual({
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
      completed: [],
      notBefore: '2026-09-26T18:00:00.000Z',
    });
    expect(await fs.exists(LOCK_PATH)).toBe(false);
    const report = await reportOf(fs);
    expect(report?.records).toEqual([
      {
        kind: 'run-failure',
        reason: 'trade-request-rejected',
        status: 404,
        message: 'the trade leagues request answered 404; the run is aborted',
      },
    ]);
  });

  it('rejected over a previous dataset labelled Old League: the publish keeps Old League', async () => {
    const { fs, ports, step } = gated(
      'Standard',
      { status: 404, headers: {}, body: '' },
      { [DATASET_PATH]: { contents: PREVIOUS_DATASET } },
    );

    await expect(run(ports, step)).rejects.toBeInstanceOf(LeagueRequestRejectedError);

    const published = DatasetFileSchema.parse(JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? ''));
    expect(published.league).toBe('Old League');
  });

  it('malformed: a body that is not the payload shape is an unrecoverable-error run-failure', async () => {
    const { fs, ports, visited, step } = gated('Standard', ok({ leagues: ['Standard'] }));

    await expect(run(ports, step)).rejects.toThrow(/unexpected body/);

    expect(visited).toEqual([]);
    const report = await reportOf(fs);
    const records = report?.records ?? [];
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ kind: 'run-failure', reason: 'unrecoverable-error' });
    expect(records[0] !== undefined && 'entryKey' in records[0]).toBe(false);
  });

  it('busy: a live lock means no leagues request at all', async () => {
    const { fs, ports, leaguesHttp, step } = gated('Standard', ok(LEAGUES), {
      [LOCK_PATH]: { contents: serialiseLock({ pid: 99, startedAt: FIVE_HOURS_AGO }) },
    });

    const outcome = await run(ports, step);
    expect(outcome.kind).toBe('busy');

    expect(leaguesHttp.requests).toEqual([]);
    expect(await fs.exists(REPORT_PATH)).toBe(false);
  });

  it('repeat: a mismatch two runs running leaves one league-mismatch record', async () => {
    const first = gated('Runes of Aldur', ok(LEAGUES));
    await expect(run(first.ports, first.step)).rejects.toBeInstanceOf(LeagueMismatchError);
    const second = gated('Runes of Aldur', ok(LEAGUES), {}, first.fs);
    await expect(run(second.ports, second.step)).rejects.toBeInstanceOf(LeagueMismatchError);

    const report = await reportOf(first.fs);
    expect(report?.records).toEqual([
      {
        kind: 'league-mismatch',
        configuredLeague: 'Runes of Aldur',
        availableLeagues: ['Forbidden Rites', 'Standard'],
      },
    ]);
  });
});
