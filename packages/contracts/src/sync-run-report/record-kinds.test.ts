import { describe, expect, it } from 'vitest';

import { LeagueMismatchRecordSchema, PinnedStarvationRecordSchema, SyncRunRecordSchema } from '../sync-run-report';
import { byCodeUnit } from '../test-support';

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
    expect(Object.keys(PinnedStarvationRecordSchema.shape).toSorted(byCodeUnit)).toEqual([
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
    expect(Object.keys(LeagueMismatchRecordSchema.shape).toSorted(byCodeUnit)).toEqual([
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
