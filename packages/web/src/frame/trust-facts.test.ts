import { describe, expect, it } from 'vitest';

import type { Parsed } from '../load/artifacts';
import { VALID_BODIES } from '../test-support/artifact-server';
import { NOW } from '../test-support/dom';
import {
  AFFORDANCE_CLOSED,
  AFFORDANCE_OPEN,
  groupText,
  healthSignals,
  lastSynced,
  NOT_MEASURED,
  panelColumns,
  trackedListEdit,
  UNKNOWN,
  utcDate,
  weightsFacts,
  type FigureGroup,
} from './trust-facts';

type SyncReport = Parsed<'syncReport'>;
type Weights = Parsed<'weights'>;

const WEIGHTS = VALID_BODIES.weights as Weights;
const BASE_REPORT = VALID_BODIES.syncReport as SyncReport;

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
    expect(lastSynced(report({ runStartedAt: '2026-09-26T10:00:00Z', runFinishedAt: '2026-09-26T11:19:00Z' }), NOW)).toBe(
      '41 minutes ago',
    );
    const started = report({ runStartedAt: '2026-09-26T10:00:00Z' });
    delete started.runFinishedAt;
    expect(lastSynced(started, NOW)).toBe('2 hours ago');
    expect(lastSynced(null, NOW)).toBeUndefined();
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
      '1 pinned-starvation record.\n2 of 5 pinned entries refreshed',
    ]);
    expect(cover.map(groupText)).toEqual(['86% of 29 tracked Item Classes.']);
  });

  // Matrix: one not reached, one unresolvable, one starvation record; zero and many unchanged.
  it('agrees each count with its noun and verb: singular at one, plural at zero and many', () => {
    const first = (group: FigureGroup): string => groupText(group).split('\n')[0] ?? '';

    const [oneRun, oneBroken] = panelColumns(report({ records: [...unresolvable(1), starvation] }, { notReachedCount: 1 }), true);
    expect(oneRun.map(first)[1]).toBe('1 tracked entry was not reached in the last sync pass.');
    expect(oneBroken.map(first)).toEqual(['1 entry is unresolvable.', '1 pinned-starvation record.']);

    const [manyRun, manyBroken] = panelColumns(
      report({ records: [...unresolvable(3), starvation, starvation] }, { notReachedCount: 3 }),
      true,
    );
    expect(manyRun.map(first)[1]).toBe('3 tracked entries were not reached in the last sync pass.');
    expect(manyBroken.map(first)).toEqual(['3 entries are unresolvable.', '2 pinned-starvation records.']);

    const onePinned = { ...starvation, pinnedCount: 1, pinnedRefreshed: 1 };
    const [, pinnedBroken, oneCover] = panelColumns(
      report({ records: [onePinned] }, { coverage: 1, rankableClassCount: 1 }),
      true,
    );
    expect(groupText(pinnedBroken[1] ?? [])).toBe('1 pinned-starvation record.\n1 of 1 pinned entry refreshed');
    expect(oneCover.map(groupText)).toEqual(['100% of 1 tracked Item Class.']);
    const [, , unknownCover] = panelColumns(report({}, { coverage: 0.5 }), true);
    expect(unknownCover.map(groupText)).toEqual(['50% of unknown tracked Item Classes.']);

    const [zeroRun] = panelColumns(report({}, { notReachedCount: 0 }), true);
    expect(zeroRun.map(first)[1]).toBe('0 tracked entries were not reached in the last sync pass.');
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

  it.each([
    [0.862, '86%'],
    [0.996, '99%'],
    [1, '100%'],
    [0.004, '1%'],
    [0, '0%'],
    [0.29, '29%'],
    [1 - 1e-12, '99%'],
    [0.01, '1%'],
  ])('prints coverage %s as %s', (coverage, percent) => {
    const [, , cover] = panelColumns(report({}, { coverage, rankableClassCount: 29 }), true);
    expect(cover.map(groupText)).toEqual([`${percent} of 29 tracked Item Classes.`]);
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
