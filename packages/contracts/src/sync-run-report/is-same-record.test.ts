import { describe, expect, it } from 'vitest';

import { isSameRecord, RECORD_SUBJECTS, SyncRunRecordSchema } from '../sync-run-report';
import type { SyncRunRecord } from '../sync-run-report';
import { byCodeUnit } from '../test-support';

/** A value of the same type that differs from `value`. */
function changed(value: unknown): unknown {
  return typeof value === 'number' ? value + 1 : `${String(value)}-changed`;
}

describe('isSameRecord', () => {
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
    const kinds = SyncRunRecordSchema.options.map((option) => option.shape.kind.value).toSorted(byCodeUnit);
    expect(Object.keys(RECORD_SUBJECTS).toSorted(byCodeUnit)).toEqual(kinds);
    expect(cases.map((c) => c.base.kind).toSorted(byCodeUnit)).toEqual(kinds);
  });

  for (const { base, observation } of cases) {
    it(`${base.kind}: the same record, ignoring observations`, () => {
      const sameRecords = observation === undefined ? [{ ...base }] : [{ ...base }, observation];
      expect(sameRecords.map((other) => isSameRecord(base, other))).toEqual(sameRecords.map(() => true));
    });

    const subjects: readonly string[] = RECORD_SUBJECTS[base.kind];
    for (const subjectKey of subjects) {
      it(`${base.kind}: a change to ${subjectKey} alone is a new record`, () => {
        const fields = base as Readonly<Record<string, unknown>>;
        const other: SyncRunRecord = Object.assign({}, base, { [subjectKey]: changed(fields[subjectKey]) });
        expect(isSameRecord(base, other)).toBe(false);
      });
    }
  }

  it('a record of another kind is never the same, whatever its fields', () => {
    const absent: SyncRunRecord = { kind: 'weights-absent', uncheckableClassNames: [] };
    const broken: SyncRunRecord = { kind: 'stale-lock-broken', pid: 1, startedAt: '2026-09-20T01:00:00Z' };
    expect(isSameRecord(absent, broken)).toBe(false);
    expect(isSameRecord(broken, absent)).toBe(false);
  });

  it('treats an absent optional subject on both sides as agreement', () => {
    const a: SyncRunRecord = { kind: 'run-failure', reason: 'unrecoverable-error', message: 'a' };
    const b: SyncRunRecord = { kind: 'run-failure', reason: 'unrecoverable-error', message: 'b' };
    expect(isSameRecord(a, b)).toBe(true);
    expect(isSameRecord(a, { ...b, status: 500 })).toBe(false);
  });
});
