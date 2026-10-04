import { describe, expect, it } from 'vitest';

import {
  ChunkRequestSourceSchema,
  LeagueMismatchRecordSchema,
  PinnedStarvationRecordSchema,
  RECORD_SUBJECTS,
  RequestSourceSchema,
  RequestsBySourceSchema,
  sameRecord,
  SYNC_REPORT_SCHEMA_VERSION,
  SyncRunFiguresSchema,
  SyncRunRecordSchema,
  SyncRunReportSchema,
  type SyncRunRecord,
} from './sync-run-report';

const figures = {
  requestsBySource: {
    'tracked-list': 8,
    'league-validation': 1,
    'session-probe': 0,
  },
  notReachedCount: 41,
};

describe('RequestsBySourceSchema', () => {
  it('keeps four declared request sources, and keys the figure on the three chunk sources (AD-12, AD-30)', () => {
    expect(RequestSourceSchema.options).toEqual([
      'tracked-list',
      'league-validation',
      'catalogue-refresh',
      'session-probe',
    ]);
    expect(ChunkRequestSourceSchema.options).toEqual(['tracked-list', 'league-validation', 'session-probe']);
  });

  it('drops the legacy catalogue-refresh key of a 1.0.0 report', () => {
    const parsed = RequestsBySourceSchema.parse({
      'tracked-list': 8,
      'league-validation': 1,
      'catalogue-refresh': 0,
    });
    expect(parsed).toEqual({ 'tracked-list': 8, 'league-validation': 1, 'session-probe': 0 });
    expect('catalogue-refresh' in parsed).toBe(false);
  });

  it('reads a 1.1.0 figure with no session-probe key as 0 (IMPLEMENTATION-NOTES.md §13.7)', () => {
    expect(RequestsBySourceSchema.parse({ 'tracked-list': 8, 'league-validation': 1 })).toEqual({
      'tracked-list': 8,
      'league-validation': 1,
      'session-probe': 0,
    });
  });

  it('keeps a written session-probe count', () => {
    expect(
      RequestsBySourceSchema.parse({ 'tracked-list': 8, 'league-validation': 1, 'session-probe': 1 }),
    ).toEqual({ 'tracked-list': 8, 'league-validation': 1, 'session-probe': 1 });
  });

  it('refuses a negative or non-integer session-probe count', () => {
    for (const count of [-1, 0.5]) {
      expect(
        RequestsBySourceSchema.safeParse({ 'tracked-list': 8, 'league-validation': 1, 'session-probe': count })
          .success,
      ).toBe(false);
    }
  });

  it('refuses any other unknown key', () => {
    expect(
      RequestsBySourceSchema.safeParse({ 'tracked-list': 8, 'league-validation': 1, other: 0 })
        .success,
    ).toBe(false);
  });

  it('refuses a figure missing a chunk source, even beside the legacy key', () => {
    expect(RequestsBySourceSchema.safeParse({ 'tracked-list': 8, 'catalogue-refresh': 0 }).success).toBe(
      false,
    );
  });

  it('stamps a minor version, so a 1.0.0 or 1.1.0 report keeps its major', () => {
    expect(SYNC_REPORT_SCHEMA_VERSION).toBe('1.2.0');
  });
});

/** A value of the same type that differs from `value`. */
function changed(value: unknown): unknown {
  return typeof value === 'number' ? value + 1 : `${String(value)}-changed`;
}

describe('sameRecord (IMPLEMENTATION-NOTES.md §12)', () => {
  /** One record per kind, plus an observation-only change where the kind has observations. */
  const cases: readonly {
    readonly base: SyncRunRecord;
    readonly observation: SyncRunRecord | undefined;
  }[] = [
    {
      base: { kind: 'stale-lock-broken', pid: 1, startedAt: '2026-09-20T01:00:00Z' },
      observation: undefined,
    },
    {
      base: {
        kind: 'pinned-starvation',
        discoveredAllowance: 3,
        declaredMinChunkSearches: 10,
        pinnedCount: 4,
        pinnedRefreshed: 2,
        activeRefreshed: 1,
      },
      observation: {
        kind: 'pinned-starvation',
        discoveredAllowance: 1,
        declaredMinChunkSearches: 10,
        pinnedCount: 4,
        pinnedRefreshed: 0,
        activeRefreshed: 0,
      },
    },
    {
      base: { kind: 'unresolvable', entryKey: 'k', identifier: 'a', identifierKind: 'statId' },
      observation: undefined,
    },
    {
      base: { kind: 'weights-absent', uncheckableClassNames: ['Bows'] },
      observation: { kind: 'weights-absent', uncheckableClassNames: ['Bows', 'Rings'] },
    },
    {
      base: { kind: 'uncatalogued-weights-id', identifier: 'a', identifierKind: 'statId' },
      observation: undefined,
    },
    {
      base: { kind: 'cross-file-gate-failure', check: 'co-occur', entryKey: 'k', detail: 'x' },
      observation: { kind: 'cross-file-gate-failure', check: 'co-occur', entryKey: 'k', detail: 'y' },
    },
    {
      base: { kind: 'run-failure', reason: 'unrecoverable-error', entryKey: 'k', status: 500, message: 'a' },
      observation: {
        kind: 'run-failure',
        reason: 'unrecoverable-error',
        entryKey: 'k',
        status: 500,
        message: 'b',
      },
    },
    {
      base: { kind: 'league-mismatch', configuredLeague: 'A', availableLeagues: ['B'] },
      observation: { kind: 'league-mismatch', configuredLeague: 'A', availableLeagues: ['B', 'C'] },
    },
  ];

  it('declares a subject list for every record kind', () => {
    const kinds = SyncRunRecordSchema.options.map((option) => option.shape.kind.value).sort();
    expect(Object.keys(RECORD_SUBJECTS).sort()).toEqual(kinds);
    expect(cases.map((c) => c.base.kind).sort()).toEqual(kinds);
  });

  for (const { base, observation } of cases) {
    it(`${base.kind}: the same record, ignoring observations`, () => {
      expect(sameRecord(base, { ...base })).toBe(true);
      if (observation !== undefined) {
        expect(sameRecord(base, observation)).toBe(true);
      }
    });

    const subjects: readonly string[] = RECORD_SUBJECTS[base.kind];
    for (const subjectKey of subjects) {
      it(`${base.kind}: a change to ${subjectKey} alone is a new record`, () => {
        const fields = base as Readonly<Record<string, unknown>>;
        const other = { ...fields, [subjectKey]: changed(fields[subjectKey]) } as SyncRunRecord;
        expect(sameRecord(base, other)).toBe(false);
      });
    }
  }

  it('a record of another kind is never the same, whatever its fields', () => {
    const absent: SyncRunRecord = { kind: 'weights-absent', uncheckableClassNames: [] };
    const broken: SyncRunRecord = { kind: 'stale-lock-broken', pid: 1, startedAt: '2026-09-20T01:00:00Z' };
    expect(sameRecord(absent, broken)).toBe(false);
    expect(sameRecord(broken, absent)).toBe(false);
  });

  it('treats an absent optional subject on both sides as agreement', () => {
    const a: SyncRunRecord = { kind: 'run-failure', reason: 'unrecoverable-error', message: 'a' };
    const b: SyncRunRecord = { kind: 'run-failure', reason: 'unrecoverable-error', message: 'b' };
    expect(sameRecord(a, b)).toBe(true);
    expect(sameRecord(a, { ...b, status: 500 })).toBe(false);
  });
});

describe('SyncRunFiguresSchema', () => {
  it('accounts requests per chunk source, each of them', () => {
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

  it('carries a league-mismatch record with the configured league and every available id', () => {
    const record = {
      kind: 'league-mismatch',
      configuredLeague: 'forbidden rites',
      availableLeagues: ['Forbidden Rites', 'Standard'],
    };
    expect(SyncRunRecordSchema.parse(record)).toEqual(record);
    expect(Object.keys(LeagueMismatchRecordSchema.shape).sort()).toEqual([
      'availableLeagues',
      'configuredLeague',
      'kind',
    ]);
    expect(
      SyncRunRecordSchema.safeParse({ ...record, availableLeagues: [] }).success,
    ).toBe(true);
  });

  it('refuses a league-mismatch record with no league, no list or an extra field', () => {
    expect(
      SyncRunRecordSchema.safeParse({ kind: 'league-mismatch', availableLeagues: [] }).success,
    ).toBe(false);
    expect(
      SyncRunRecordSchema.safeParse({ kind: 'league-mismatch', configuredLeague: 'Standard' })
        .success,
    ).toBe(false);
    expect(
      SyncRunRecordSchema.safeParse({
        kind: 'league-mismatch',
        configuredLeague: 'Standard',
        availableLeagues: [],
        message: 'x',
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
