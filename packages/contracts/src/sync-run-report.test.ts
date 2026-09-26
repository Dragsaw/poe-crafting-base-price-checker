import { describe, expect, it } from 'vitest';

import {
  PinnedStarvationRecordSchema,
  SyncRunFiguresSchema,
  SyncRunRecordSchema,
  SyncRunReportSchema,
} from './sync-run-report';

const figures = {
  requestsBySource: {
    'tracked-list': 8,
    'league-validation': 1,
    'catalogue-refresh': 0,
  },
  notReachedCount: 41,
};

describe('SyncRunFiguresSchema', () => {
  it('accounts requests per declared source, all three of them', () => {
    expect(SyncRunFiguresSchema.parse(figures)).toEqual(figures);
    expect(
      SyncRunFiguresSchema.safeParse({
        ...figures,
        requestsBySource: { 'tracked-list': 8 },
      }).success,
    ).toBe(false);
  });

  it('refuses a fourth request source', () => {
    expect(
      SyncRunFiguresSchema.safeParse({
        ...figures,
        requestsBySource: { ...figures.requestsBySource, 'currency-refresh': 2 },
      }).success,
    ).toBe(false);
  });

  it('carries coverage as a fraction in [0, 1] beside its denominator', () => {
    expect(
      SyncRunFiguresSchema.parse({ ...figures, coverage: 0.5, rankableClassCount: 12 }),
    ).toMatchObject({ coverage: 0.5, rankableClassCount: 12 });
    expect(SyncRunFiguresSchema.safeParse({ ...figures, coverage: 50 }).success).toBe(false);
  });

  it('omits coverage entirely where weights.json is absent, rather than reporting zero', () => {
    const parsed = SyncRunFiguresSchema.parse(figures);
    expect(parsed.coverage).toBeUndefined();
    expect(parsed.rankableClassCount).toBeUndefined();
  });

  it('carries the tracked-list edit date with its clock tag', () => {
    expect(
      SyncRunFiguresSchema.parse({
        ...figures,
        trackedListEditedAt: { source: 'file-modified', at: '2026-09-20T07:00:00Z' },
      }).trackedListEditedAt,
    ).toEqual({ source: 'file-modified', at: '2026-09-20T07:00:00Z' });

    expect(
      SyncRunFiguresSchema.safeParse({
        ...figures,
        trackedListEditedAt: '2026-09-20T07:00:00Z',
      }).success,
    ).toBe(false);
  });
});

describe('SyncRunRecordSchema', () => {
  it('names the pinned-starvation record’s five fields and no others', () => {
    const record = {
      kind: 'pinned-starvation',
      discoveredAllowance: 8,
      declaredMinChunkSearches: 30,
      pinnedCount: 20,
      pinnedRefreshed: 7,
      activeRefreshed: 1,
    };
    expect(PinnedStarvationRecordSchema.parse(record)).toEqual(record);
    expect(Object.keys(PinnedStarvationRecordSchema.shape).sort()).toEqual([
      'activeRefreshed',
      'declaredMinChunkSearches',
      'discoveredAllowance',
      'kind',
      'pinnedCount',
      'pinnedRefreshed',
    ]);
  });

  it('carries the other three record kinds', () => {
    expect(
      SyncRunRecordSchema.safeParse({
        kind: 'stale-lock-broken',
        pid: 4242,
        startedAt: '2026-09-20T01:00:00Z',
      }).success,
    ).toBe(true);
    expect(
      SyncRunRecordSchema.safeParse({
        kind: 'unresolvable',
        entryKey: '["raw","Advanced Dualstring Bow",82]',
        identifier: 'explicit.stat_1',
        identifierKind: 'statId',
      }).success,
    ).toBe(true);
    expect(
      SyncRunRecordSchema.safeParse({
        kind: 'cross-file-gate-failure',
        check: 'edge-alignment',
        entryKey: '["crafted","weapon.bow","Bows",79,["s",43,56.5],null]',
        detail: 'band edges are not the extremes of the containment set at floor 79',
      }).success,
    ).toBe(true);
  });

  it('carries a run-failure record, with the entry and status optional', () => {
    expect(
      SyncRunRecordSchema.safeParse({
        kind: 'run-failure',
        reason: 'trade-request-rejected',
        entryKey: '["raw","Advanced Dualstring Bow",82]',
        status: 400,
        message: 'the trade search answered 400; the chunk is aborted',
      }).success,
    ).toBe(true);
    expect(
      SyncRunRecordSchema.safeParse({
        kind: 'run-failure',
        reason: 'unrecoverable-error',
        message: 'boom',
      }).success,
    ).toBe(true);
  });

  it('refuses a run-failure record with an unknown reason or no message', () => {
    expect(
      SyncRunRecordSchema.safeParse({ kind: 'run-failure', reason: 'timeout', message: 'x' })
        .success,
    ).toBe(false);
    expect(
      SyncRunRecordSchema.safeParse({ kind: 'run-failure', reason: 'unrecoverable-error' })
        .success,
    ).toBe(false);
  });

  it('carries a weights-absent record naming the uncheckable classes', () => {
    expect(
      SyncRunRecordSchema.safeParse({
        kind: 'weights-absent',
        uncheckableClassNames: ['Body Armours', 'Bows'],
      }).success,
    ).toBe(true);
    expect(
      SyncRunRecordSchema.safeParse({ kind: 'weights-absent', uncheckableClassNames: [] }).success,
    ).toBe(true);
    expect(SyncRunRecordSchema.safeParse({ kind: 'weights-absent' }).success).toBe(false);
  });

  it('carries an uncatalogued-weights-id record for a statId or a categoryId only', () => {
    expect(
      SyncRunRecordSchema.safeParse({
        kind: 'uncatalogued-weights-id',
        identifier: 'explicit.stat_1',
        identifierKind: 'statId',
      }).success,
    ).toBe(true);
    expect(
      SyncRunRecordSchema.safeParse({
        kind: 'uncatalogued-weights-id',
        identifier: 'weapon.bow',
        identifierKind: 'categoryId',
      }).success,
    ).toBe(true);
    expect(
      SyncRunRecordSchema.safeParse({
        kind: 'uncatalogued-weights-id',
        identifier: 'Advanced Dualstring Bow',
        identifierKind: 'baseTypeId',
      }).success,
    ).toBe(false);
    expect(
      SyncRunRecordSchema.safeParse({
        kind: 'uncatalogued-weights-id',
        identifier: 'explicit.stat_1',
        identifierKind: 'statId',
        entryKey: 'x',
      }).success,
    ).toBe(false);
  });

  it('has no `failed push` record — revision 18 removed every git write', () => {
    expect(SyncRunRecordSchema.safeParse({ kind: 'failed-push', remote: 'origin' }).success).toBe(
      false,
    );
  });
});

describe('SyncRunReportSchema', () => {
  it('types figures apart from records', () => {
    const report = {
      runStartedAt: '2026-09-20T09:00:00Z',
      runFinishedAt: '2026-09-20T09:02:00Z',
      figures,
      records: [],
    };
    expect(SyncRunReportSchema.parse(report)).toEqual(report);
  });

  it('lets an aborted run publish with no finish time', () => {
    expect(
      SyncRunReportSchema.safeParse({
        runStartedAt: '2026-09-20T09:00:00Z',
        figures,
        records: [],
      }).success,
    ).toBe(true);
  });
});
