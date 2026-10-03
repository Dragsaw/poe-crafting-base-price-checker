import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { SyncReportFileSchema } from '@poe/contracts';
import type { PinnedStarvationRecord, SyncReportFile, SyncRunRecord } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { buildSyncReport, carryRecords } from './sync-report.ts';

const STARTED = '2026-09-26T12:00:00.000Z';
const FINISHED = '2026-09-26T12:01:00.000Z';

const BROKEN: SyncRunRecord = { kind: 'stale-lock-broken', pid: 7, startedAt: '2026-09-26T05:00:00.000Z' };
const STARVED: PinnedStarvationRecord = {
  kind: 'pinned-starvation',
  discoveredAllowance: 2,
  declaredMinChunkSearches: 10,
  pinnedCount: 3,
  pinnedRefreshed: 1,
  activeRefreshed: 1,
};

function previousWith(records: readonly SyncRunRecord[]): SyncReportFile {
  return {
    runStartedAt: '2026-09-26T11:00:00.000Z',
    runFinishedAt: '2026-09-26T11:01:00.000Z',
    figures: {
      requestsBySource: { 'tracked-list': 40, 'league-validation': 1, 'session-probe': 0 },
      notReachedCount: 9,
    },
    records: [...records],
    schemaVersion: '1.0.0',
  };
}

describe('buildSyncReport', () => {
  it('first run: zero-fills the absent sources, no records, the finish stamped', () => {
    const report = buildSyncReport({
      previous: undefined,
      newRecords: [],
      figures: { requestsBySource: { 'tracked-list': 6 }, notReachedCount: 0 },
      runStartedAt: STARTED,
      runFinishedAt: FINISHED,
    });

    expect(report).toEqual({
      runStartedAt: STARTED,
      runFinishedAt: FINISHED,
      figures: {
        requestsBySource: { 'tracked-list': 6, 'league-validation': 0, 'session-probe': 0 },
        notReachedCount: 0,
      },
      records: [],
      schemaVersion: '1.2.0',
    });
    expect(SyncReportFileSchema.safeParse(report).success).toBe(true);
  });

  it('figures replace the previous figures; they are never summed', () => {
    const report = buildSyncReport({
      previous: previousWith([]),
      newRecords: [],
      figures: { requestsBySource: { 'tracked-list': 2 }, notReachedCount: 3 },
      runStartedAt: STARTED,
      runFinishedAt: FINISHED,
    });
    expect(report.figures).toEqual({
      requestsBySource: { 'tracked-list': 2, 'league-validation': 0, 'session-probe': 0 },
      notReachedCount: 3,
    });
  });

  it('carry-over: a previous record survives the next chunk', () => {
    const report = buildSyncReport({
      previous: previousWith([BROKEN]),
      newRecords: [STARVED],
      figures: { requestsBySource: {}, notReachedCount: 0 },
      runStartedAt: STARTED,
      runFinishedAt: FINISHED,
    });
    expect(report.records).toEqual([BROKEN, STARVED]);
  });

  it('dedup: the same starvation payload two chunks running is one record', () => {
    const report = buildSyncReport({
      previous: previousWith([STARVED]),
      newRecords: [{ ...STARVED }],
      figures: { requestsBySource: {}, notReachedCount: 0 },
      runStartedAt: STARTED,
      runFinishedAt: FINISHED,
    });
    expect(report.records).toEqual([STARVED]);
  });

  it('growth: a starvation whose measurement changed replaces the earlier record at its position', () => {
    const report = buildSyncReport({
      previous: previousWith([STARVED, BROKEN]),
      newRecords: [{ ...STARVED, discoveredAllowance: 1, pinnedRefreshed: 0, activeRefreshed: 0 }],
      figures: { requestsBySource: {}, notReachedCount: 0 },
      runStartedAt: STARTED,
      runFinishedAt: FINISHED,
    });
    expect(report.records).toEqual([
      { ...STARVED, discoveredAllowance: 1, pinnedRefreshed: 0, activeRefreshed: 0 },
      BROKEN,
    ]);
  });

  it('new subject: a starvation whose pinned set changed is a second record', () => {
    const report = buildSyncReport({
      previous: previousWith([STARVED]),
      newRecords: [{ ...STARVED, pinnedCount: 4 }],
      figures: { requestsBySource: {}, notReachedCount: 0 },
      runStartedAt: STARTED,
      runFinishedAt: FINISHED,
    });
    expect(report.records).toEqual([STARVED, { ...STARVED, pinnedCount: 4 }]);
  });

  it('legacy report: a previous figure with catalogue-refresh parses, and the next report has no such key', () => {
    const legacy = SyncReportFileSchema.parse({
      ...previousWith([]),
      figures: {
        requestsBySource: { 'tracked-list': 40, 'league-validation': 1, 'catalogue-refresh': 0 },
        notReachedCount: 9,
      },
    });
    expect('catalogue-refresh' in legacy.figures.requestsBySource).toBe(false);

    const report = buildSyncReport({
      previous: legacy,
      newRecords: [],
      figures: { requestsBySource: { 'tracked-list': 3, 'catalogue-refresh': 5 }, notReachedCount: 0 },
      runStartedAt: STARTED,
      runFinishedAt: FINISHED,
    });
    expect(report.figures.requestsBySource).toEqual({ 'tracked-list': 3, 'league-validation': 0, 'session-probe': 0 });
  });

  it('player cleared: a previous file with no records keeps only this chunk’s records', () => {
    const report = buildSyncReport({
      previous: previousWith([]),
      newRecords: [BROKEN],
      figures: { requestsBySource: {}, notReachedCount: 0 },
      runStartedAt: STARTED,
      runFinishedAt: FINISHED,
    });
    expect(report.records).toEqual([BROKEN]);
  });

  it('failure path: no runFinishedAt key at all', () => {
    const report = buildSyncReport({
      previous: undefined,
      newRecords: [{ kind: 'run-failure', reason: 'unrecoverable-error', message: 'boom' }],
      figures: { requestsBySource: {}, notReachedCount: 0 },
      runStartedAt: STARTED,
    });
    expect('runFinishedAt' in report).toBe(false);
    expect(SyncReportFileSchema.safeParse(report).success).toBe(true);
  });

  it('carries the tracked-list edit date with its tag', () => {
    const report = buildSyncReport({
      previous: undefined,
      newRecords: [],
      figures: {
        requestsBySource: {},
        notReachedCount: 0,
        trackedListEditedAt: { source: 'file-modified', at: STARTED },
      },
      runStartedAt: STARTED,
      runFinishedAt: FINISHED,
    });
    expect(report.figures.trackedListEditedAt).toEqual({ source: 'file-modified', at: STARTED });
  });
});

describe('the frozen sync-report.json fixture', () => {
  it('parses, legacy catalogue-refresh key and all, and the key is gone after the parse', () => {
    const text = readFileSync(
      fileURLToPath(new URL('../../../../test/fixtures/frozen-data/sync-report.json', import.meta.url)),
      'utf8',
    );
    const parsed = SyncReportFileSchema.parse(JSON.parse(text));
    expect(Object.keys(parsed.figures.requestsBySource).sort()).toEqual([
      'league-validation',
      'session-probe',
      'tracked-list',
    ]);
  });
});

describe('carryRecords', () => {
  it('replaces the first match only, and leaves a record of another kind in place', () => {
    const later = { ...STARVED, discoveredAllowance: 0 };
    expect(carryRecords([BROKEN, STARVED, STARVED], [later])).toEqual([BROKEN, later, STARVED]);
  });

  it('keeps previous duplicates as the player left them, and dedups new ones against each other', () => {
    expect(carryRecords([BROKEN, BROKEN], [STARVED, STARVED])).toEqual([BROKEN, BROKEN, STARVED]);
  });

  it('compares by value, whatever the key order', () => {
    const reordered = { startedAt: '2026-09-26T05:00:00.000Z', pid: 7, kind: 'stale-lock-broken' } as const;
    expect(carryRecords([BROKEN], [reordered])).toEqual([BROKEN]);
  });
});
