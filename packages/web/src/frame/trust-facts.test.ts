import { describe, expect, it } from 'vitest';

import type { Parsed } from '../load/artifacts';
import { VALID_BODIES } from '../test-support/artifact-server';
import {
  AFFORDANCE_CLOSED,
  AFFORDANCE_OPEN,
  groupText,
  healthSignals,
  lastSynced,
  NOT_MEASURED,
  panelColumns,
  relativeAge,
  trackedListEdit,
  UNKNOWN,
  utcDate,
  weightsFacts,
} from './trust-facts';

type SyncReport = Parsed<'syncReport'>;
type Weights = Parsed<'weights'>;

const WEIGHTS = VALID_BODIES.weights as Weights;
const BASE_REPORT = VALID_BODIES.syncReport as SyncReport;
const NOW = Date.parse('2026-09-26T15:00:00.000Z');
const MINUTE = 60_000;

function report(overrides: Partial<SyncReport> = {}, figures: Partial<SyncReport['figures']> = {}): SyncReport {
  return { ...BASE_REPORT, ...overrides, figures: { ...BASE_REPORT.figures, ...figures } };
}

const unresolvable = (n: number): SyncReport['records'] =>
  Array.from({ length: n }, (_, i) => ({
    kind: 'unresolvable' as const,
    entryKey: `raw:Base ${String(i)}`,
    identifier: `Base ${String(i)}`,
    identifierKind: 'baseTypeId' as const,
  }));

const starvation = {
  kind: 'pinned-starvation' as const,
  discoveredAllowance: 4,
  declaredMinChunkSearches: 8,
  pinnedCount: 5,
  pinnedRefreshed: 2,
  activeRefreshed: 0,
};

describe('line one', () => {
  it('reads producer, generatedAt as a UTC date, and gamePatch from the header', () => {
    expect(weightsFacts(WEIGHTS)).toEqual([
      { name: 'producer', value: 'poe-mod-weights-producer' },
      { name: 'generatedAt', value: '2026-09-26' },
      { name: 'gamePatch', value: '0.5.5' },
    ]);
  });

  it('leaves all three unknown when weights.json is absent', () => {
    expect(weightsFacts(null).map((fact) => fact.value)).toEqual([undefined, undefined, undefined]);
  });

  it('prints dates in UTC, never local time', () => {
    expect(utcDate('2026-09-26T23:59:59.999Z')).toBe('2026-09-26');
    expect(utcDate('2026-09-27T00:00:00Z')).toBe('2026-09-27');
  });
});

describe('line two', () => {
  it('suffixes a file-modified date with (not committed)', () => {
    const edited = report({}, { trackedListEditedAt: { source: 'file-modified', at: '2026-09-26T11:23:42.140Z' } });
    expect(trackedListEdit(edited)).toEqual({ date: '2026-09-26', suffix: ' (not committed)' });
  });

  it('prints a git-author-date bare', () => {
    const edited = report({}, { trackedListEditedAt: { source: 'git-author-date', at: '2026-08-01T10:00:00Z' } });
    expect(trackedListEdit(edited)).toEqual({ date: '2026-08-01', suffix: '' });
  });

  it('is unknown with no edit date, or with no report', () => {
    const figures = { ...BASE_REPORT.figures };
    delete figures.trackedListEditedAt;
    expect(trackedListEdit({ ...BASE_REPORT, figures })).toBeUndefined();
    expect(trackedListEdit(null)).toBeUndefined();
  });

  it('reads Last synced from runFinishedAt, else runStartedAt, and unknown with no report', () => {
    const at = (iso: string) => Date.parse(iso);
    expect(lastSynced(report({ runStartedAt: '2026-09-26T13:00:00Z', runFinishedAt: '2026-09-26T14:19:00Z' }), NOW)).toBe(
      '41 minutes ago',
    );
    const started = report({ runStartedAt: '2026-09-26T13:00:00Z' });
    delete started.runFinishedAt;
    expect(lastSynced(started, NOW)).toBe('2 hours ago');
    expect(lastSynced(null, at('2026-09-26T15:00:00Z'))).toBeUndefined();
  });

  it('steps the relative age through minutes, hours and days, singular at one', () => {
    expect(relativeAge(0)).toBe('< 1 minute ago');
    expect(relativeAge(59_999)).toBe('< 1 minute ago');
    expect(relativeAge(-5 * MINUTE)).toBe('< 1 minute ago');
    expect(relativeAge(MINUTE)).toBe('1 minute ago');
    expect(relativeAge(59 * MINUTE)).toBe('59 minutes ago');
    expect(relativeAge(60 * MINUTE)).toBe('1 hour ago');
    expect(relativeAge(23 * 60 * MINUTE + 59 * MINUTE)).toBe('23 hours ago');
    expect(relativeAge(24 * 60 * MINUTE)).toBe('1 day ago');
    expect(relativeAge(9 * 24 * 60 * MINUTE)).toBe('9 days ago');
  });
});

describe('the health line', () => {
  it('raises nothing on a healthy run or an absent report', () => {
    expect(healthSignals(report())).toEqual([]);
    expect(healthSignals(null)).toEqual([]);
  });

  it('counts unresolvable records, and names pinned starvation without a count', () => {
    expect(healthSignals(report({ records: unresolvable(12) }))).toEqual(['12 unresolvable']);
    expect(healthSignals(report({ records: [starvation] }))).toEqual(['pinned entries starved this run']);
    expect(healthSignals(report({ records: [...unresolvable(12), starvation] }))).toEqual([
      '12 unresolvable',
      'pinned entries starved this run',
    ]);
  });

  it('ignores records of other kinds', () => {
    const other = { kind: 'stale-lock-broken' as const, pid: 1, startedAt: '2026-09-26T10:00:00Z' };
    expect(healthSignals(report({ records: [other] }))).toEqual([]);
  });
});

describe('the panel copy', () => {
  it('prints the five published figure groups, zeros included, in three columns', () => {
    const full = report(
      { records: [...unresolvable(12), starvation] },
      { requestsBySource: { 'tracked-list': 10, 'league-validation': 1 }, notReachedCount: 0, coverage: 0.862, rankableClassCount: 29 },
    );
    const [run, broken, cover] = panelColumns(full, true);
    expect(run.map(groupText)).toEqual([
      '10 tracked list · 1 league validation requests this pass.',
      '0 tracked entries were not reached in the last sync pass.',
    ]);
    expect(broken.map(groupText)).toEqual([
      '12 entries are unresolvable.',
      '1 pinned-starvation records.\n2 of 5 pinned entries refreshed',
    ]);
    expect(cover.map(groupText)).toEqual(['86% of 29 tracked Item Classes.']);
  });

  it('prints zero unresolvable and zero pinned-starvation records on a healthy run', () => {
    const [, broken] = panelColumns(report(), true);
    expect(broken.map(groupText)).toEqual(['0 entries are unresolvable.', '0 pinned-starvation records.']);
  });

  it('never says Chunk', () => {
    for (const column of panelColumns(report(), true)) {
      for (const group of column) {
        expect(groupText(group)).not.toMatch(/chunk/i);
      }
    }
  });

  it('reads omitted coverage as not measured with weights loaded, unknown without, never 0', () => {
    const [, , loaded] = panelColumns(report(), true);
    const [, , absent] = panelColumns(report(), false);
    expect(loaded).toEqual([[[{ kind: 'missing', text: NOT_MEASURED }]]]);
    expect(absent).toEqual([[[{ kind: 'missing', text: UNKNOWN }]]]);
  });

  it('reads every group unknown when sync-report.json is absent', () => {
    const columns = panelColumns(null, true);
    expect(columns.map((groups) => groups.length)).toEqual([2, 2, 1]);
    for (const groups of columns) {
      for (const group of groups) {
        expect(group).toEqual([[{ kind: 'missing', text: UNKNOWN }]]);
      }
    }
  });

  it('does not repeat the Tracked List edit date', () => {
    const edited = report({}, { trackedListEditedAt: { source: 'git-author-date', at: '2026-08-01T10:00:00Z' } });
    const all = panelColumns(edited, true).flatMap((groups) => groups.map(groupText)).join(' ');
    expect(all).not.toContain('2026-08-01');
  });
});

describe('the affordance', () => {
  it('reads + closed and U+2212 open', () => {
    expect(AFFORDANCE_CLOSED).toBe('+ the full sync report');
    expect(AFFORDANCE_OPEN).toBe('− the full sync report');
  });
});
