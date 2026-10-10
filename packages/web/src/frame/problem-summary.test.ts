import { describe, expect, it } from 'vitest';

import { CURATION, datasetWithBroken, lines, report, STALE_RECORDS, starvation } from '../test-support/sync-report-fixtures';
import { problemSummary } from './problem-summary';

describe('the problem summary (AD-12)', () => {
  it('counts nothing on a healthy dataset, with or without a report', () => {
    for (const published of [report(), undefined]) {
      expect(problemSummary(datasetWithBroken(0), published, CURATION)).toEqual({ broken: 0, starved: 0, kind: undefined, lines: [] });
    }
  });

  it('counts the dataset entries in state unresolvable, never the report records', () => {
    const summary = problemSummary(datasetWithBroken(2), report({ records: STALE_RECORDS }), CURATION);
    expect(summary).toMatchObject({ broken: 2, starved: 0, kind: 'broken' });
    expect(lines(summary)).toEqual(['2 entries can no longer be priced']);
    expect(problemSummary(datasetWithBroken(0), report({ records: STALE_RECORDS }), CURATION).kind).toBeUndefined();
  });

  it('words one broken entry in the singular, and leads the line with the broken mark', () => {
    const summary = problemSummary(datasetWithBroken(1), undefined, CURATION);
    expect(lines(summary)).toEqual(['1 entry can no longer be priced']);
    expect(summary.lines[0]?.[0]).toMatchObject({ kind: 'mark', mark: 'broken' });
  });

  it('counts the starved pinned entries of the matching record as M − refreshed, led by the rough mark', () => {
    const summary = problemSummary(datasetWithBroken(0), report({ records: [{ ...starvation, pinnedRefreshed: 3 }] }), CURATION);
    expect(summary).toMatchObject({ broken: 0, starved: 3, kind: 'rough' });
    expect(lines(summary)).toEqual(['3 of 6 pinned entries are not being refreshed']);
    expect(summary.lines[0]?.[0]).toMatchObject({ kind: 'mark', mark: 'rough' });
    const one = problemSummary(datasetWithBroken(0), report({ records: [starvation] }), CURATION);
    expect(one.starved).toBe(1);
    expect(lines(one)).toEqual(['1 of 6 pinned entries are not being refreshed']);
  });

  it('counts a starvation that left out no entry as one, with its own wording', () => {
    const summary = problemSummary(datasetWithBroken(0), report({ records: [{ ...starvation, pinnedRefreshed: 6 }] }), CURATION);
    expect(summary).toMatchObject({ starved: 1, kind: 'rough' });
    expect(lines(summary)).toEqual(['6 pinned entries take every search, so nothing else rotates']);
    const single = problemSummary([], report({ records: [{ ...starvation, pinnedCount: 1, pinnedRefreshed: 1 }] }), { ...CURATION, pinnedCount: 1, minChunkSearches: 8 });
    expect(lines(single)).toEqual(['1 pinned entry takes every search, so nothing else rotates']);
  });

  it('counts nothing for a stale record: the pinned set or the yardstick changed since', () => {
    const records = [starvation];
    expect(problemSummary([], report({ records }), { ...CURATION, pinnedCount: 8, minChunkSearches: 8 }).kind).toBeUndefined();
    expect(problemSummary([], report({ records }), { ...CURATION, pinnedCount: 6, minChunkSearches: 10 }).kind).toBeUndefined();
  });

  it('reads the matching record, not the last by position, and counts nothing for an empty pinned set', () => {
    const matching = { ...starvation, pinnedCount: 8, pinnedRefreshed: 2 };
    expect(problemSummary([], report({ records: [matching, starvation] }), { ...CURATION, pinnedCount: 8, minChunkSearches: 8 }).starved).toBe(6);
    const empty = { ...starvation, pinnedCount: 0, pinnedRefreshed: 0 };
    expect(problemSummary([], report({ records: [empty] }), { ...CURATION, pinnedCount: 0, minChunkSearches: 8 }).kind).toBeUndefined();
  });

  it('leads with the broken mark when anything counted is broken, and lists broken first', () => {
    const summary = problemSummary(datasetWithBroken(2), report({ records: [starvation] }), CURATION);
    expect(summary).toMatchObject({ broken: 2, starved: 1, kind: 'broken' });
    expect(lines(summary)).toHaveLength(2);
    expect(lines(summary).join(' ')).not.toContain('this run');
  });

  it('ignores records of other kinds', () => {
    const other = { kind: 'stale-lock-broken' as const, pid: 1, startedAt: '2026-09-26T10:00:00Z' };
    expect(problemSummary([], report({ records: [other] }), CURATION).kind).toBeUndefined();
  });

  it('groups large counts the en-US way', () => {
    const large = { ...starvation, pinnedCount: 12_000, pinnedRefreshed: 500 };
    const summary = problemSummary([], report({ records: [large] }), { ...CURATION, pinnedCount: 12_000, minChunkSearches: 8 });
    expect(lines(summary)).toEqual(['11,500 of 12,000 pinned entries are not being refreshed']);
  });
});
