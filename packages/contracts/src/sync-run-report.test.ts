import { describe, expect, it } from 'vitest';

import {
  ChunkRequestSourceSchema,
  RequestSourceSchema,
  RequestsBySourceSchema,
  SYNC_REPORT_SCHEMA_VERSION,
  SyncRunFiguresSchema,
  SyncRunReportSchema,
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

  it('reads a 1.1.0 figure with no session-probe key as 0', () => {
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
