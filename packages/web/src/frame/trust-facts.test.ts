import type { DatasetEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import type { Parsed } from '../load/artifacts';
import { VALID_BODIES } from '../test-support/artifact-server';
import { NOW } from '../test-support/dom';
import { priced, rawEntry, unpriced } from '../test-support/list-fixtures';
import { MINUTE_MS } from '../shared/time';
import {
  absenceLine,
  DIAGNOSIS_LEAD,
  groupText,
  lastSynced,
  NOT_MEASURED,
  NOT_SYNCED_YET,
  PANEL_HEADINGS,
  panelColumns,
  problemSummary,
  syncButtonFace,
  trackedListEdit,
  UNKNOWN,
  utcDate,
  weightsFacts,
  type FigureGroup,
  type PanelInput,
  type ProblemSummary,
} from './trust-facts';

type SyncReport = Parsed<'syncReport'>;
type Weights = Parsed<'weights'>;

const WEIGHTS = VALID_BODIES.weights as Weights;
const BASE_REPORT = VALID_BODIES.syncReport as SyncReport;

function report(overrides: Partial<SyncReport> = {}, figures: Partial<SyncReport['figures']> = {}): SyncReport {
  return { ...BASE_REPORT, ...overrides, figures: { ...BASE_REPORT.figures, ...figures } };
}

/** `n` dataset entries the catalogue lost (state `unresolvable`), plus one priced entry. */
function datasetWithBroken(n: number): DatasetEntry[] {
  const broken = Array.from({ length: n }, (_, index) => unpriced(rawEntry(`Lost ${String(index)}`), { state: 'unresolvable' }));
  return [...broken, priced(rawEntry('Kept'), 1, new Date(NOW).toISOString())];
}

/** Five report records that outlived a recovered id: they never count (AD-12). */
const STALE_RECORDS: SyncReport['records'] =
  Array.from({ length: 5 }, (_, index) => ({
    kind: 'unresolvable' as const,
    entryKey: `raw:Base ${String(index)}`,
    identifier: `Base ${String(index)}`,
    identifierKind: 'baseTypeId' as const,
  }));

const starvation = {
  kind: 'pinned-starvation' as const,
  discoveredAllowance: 4,
  declaredMinChunkSearches: 8,
  pinnedCount: 6,
  pinnedRefreshed: 5,
  activeRefreshed: 0,
};

// The loaded curation that the `starvation` fixture describes: 6 pinned, yardstick 8.
const CURATION = { pinnedCount: 6, minChunkSearches: 8 };

const lines = (summary: ProblemSummary): string[] => summary.lines.map((line) => groupText([line]));

describe('line one', () => {
  it('reads producer, generatedAt as a UTC date, and gamePatch from the header', () => {
    expect(weightsFacts(WEIGHTS)).toEqual([
      { name: 'producer', value: 'poe-mod-weights-producer' },
      { name: 'generatedAt', value: '2026-09-26' },
      { name: 'gamePatch', value: '0.5.5' },
    ]);
  });

  it('leaves all three unknown when weights.json is absent', () => {
    expect(weightsFacts(undefined).map((fact) => fact.value)).toEqual([undefined, undefined, undefined]);
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
    expect(trackedListEdit(undefined)).toBeUndefined();
  });

  it('reads Last synced from runFinishedAt, else runStartedAt, and unknown with no report', () => {
    expect(lastSynced(report({ runStartedAt: '2026-09-26T10:00:00Z', runFinishedAt: '2026-09-26T11:19:00Z' }), NOW)).toBe(
      '41 minutes ago',
    );
    const started = report({ runStartedAt: '2026-09-26T10:00:00Z' });
    delete started.runFinishedAt;
    expect(lastSynced(started, NOW)).toBe('2 hours ago');
    expect(lastSynced(undefined, NOW)).toBeUndefined();
  });
});

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
    const single = problemSummary([], report({ records: [{ ...starvation, pinnedCount: 1, pinnedRefreshed: 1 }] }), { pinnedCount: 1, minChunkSearches: 8 });
    expect(lines(single)).toEqual(['1 pinned entry takes every search, so nothing else rotates']);
  });

  it('counts nothing for a stale record: the pinned set or the yardstick changed since', () => {
    const records = [starvation];
    expect(problemSummary([], report({ records }), { pinnedCount: 8, minChunkSearches: 8 }).kind).toBeUndefined();
    expect(problemSummary([], report({ records }), { pinnedCount: 6, minChunkSearches: 10 }).kind).toBeUndefined();
  });

  it('reads the matching record, not the last by position, and counts nothing for an empty pinned set', () => {
    const matching = { ...starvation, pinnedCount: 8, pinnedRefreshed: 2 };
    expect(problemSummary([], report({ records: [matching, starvation] }), { pinnedCount: 8, minChunkSearches: 8 }).starved).toBe(6);
    const empty = { ...starvation, pinnedCount: 0, pinnedRefreshed: 0 };
    expect(problemSummary([], report({ records: [empty] }), { pinnedCount: 0, minChunkSearches: 8 }).kind).toBeUndefined();
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
    const summary = problemSummary([], report({ records: [large] }), { pinnedCount: 12_000, minChunkSearches: 8 });
    expect(lines(summary)).toEqual(['11,500 of 12,000 pinned entries are not being refreshed']);
  });
});

/** A report whose run finished `minutesAgo` before `NOW`. */
function finished(minutesAgo: number): SyncReport {
  return report({
    runStartedAt: new Date(NOW - (minutesAgo + 1) * MINUTE_MS).toISOString(),
    runFinishedAt: new Date(NOW - minutesAgo * MINUTE_MS).toISOString(),
  });
}

describe('the sync button face', () => {
  const healthy = problemSummary([], undefined, CURATION);

  it('reads the compact age when healthy, and nothing else', () => {
    expect(syncButtonFace(healthy, finished(40), NOW)).toEqual({ kind: 'synced', text: 'Synced 40m ago' });
    expect(syncButtonFace(healthy, finished(0), NOW).text).toBe('Synced just now');
  });

  it('reads Not synced yet with no report and no problem', () => {
    expect(syncButtonFace(healthy, undefined, NOW)).toEqual({ kind: 'not-synced', text: NOT_SYNCED_YET });
  });

  it('puts the count in place of the age, with the kind of the summary', () => {
    const broken = problemSummary(datasetWithBroken(2), finished(40), CURATION);
    expect(syncButtonFace(broken, finished(40), NOW)).toEqual({ kind: 'problem', mark: 'broken', text: '2 problems' });
    const starved = problemSummary([], report({ records: [starvation] }), CURATION);
    expect(syncButtonFace(starved, finished(40), NOW)).toEqual({ kind: 'problem', mark: 'rough', text: '1 problem' });
    const both = problemSummary(datasetWithBroken(998), report({ records: [starvation] }), CURATION);
    expect(syncButtonFace(both, undefined, NOW).text).toBe('999 problems');
  });
});

function input(overrides: Partial<PanelInput> = {}): PanelInput {
  return {
    report: report(),
    weights: WEIGHTS,
    absent: [],
    now: NOW,
    problems: problemSummary([], undefined, CURATION),
    ...overrides,
  };
}

const texts = (groups: readonly FigureGroup[]): string[] => groups.map((group) => groupText(group));

describe('the panel copy', () => {
  it('has four columns, in the Copy Deck order', () => {
    expect(panelColumns(input())).toHaveLength(PANEL_HEADINGS.length);
  });

  it('prints the sync run requests per source, never session-probe, and the entries not reached', () => {
    const full = report({}, { requestsBySource: { 'tracked-list': 1200, 'league-validation': 1, 'session-probe': 7 }, notReachedCount: 12 });
    const [, run] = panelColumns(input({ report: full }));
    expect(texts(run)).toEqual(['Requests price searches 1,200 | league checks 1', '12 entries not reached in the last sync pass']);
    expect(texts(run).join(' ')).not.toMatch(/session|probe|7/);
    const [, one] = panelColumns(input({ report: report({}, { notReachedCount: 1 }) }));
    expect(texts(one)[1]).toBe('1 entry not reached in the last sync pass');
  });

  it('prints pool coverage with its denominator', () => {
    const cover = panelColumns(input({ report: report({}, { coverage: 0.862, rankableClassCount: 29 }) }))[2];
    expect(texts(cover)).toEqual(['Pool coverage 86% of 29 tracked Item Classes']);
    const single = panelColumns(input({ report: report({}, { coverage: 1, rankableClassCount: 1 }) }))[2];
    expect(texts(single)).toEqual(['Pool coverage 100% of 1 tracked Item Class']);
    const noDenominator = panelColumns(input({ report: report({}, { coverage: 0.5 }) }))[2];
    expect(texts(noDenominator)).toEqual(['Pool coverage 50% of unknown tracked Item Classes']);
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
    const cover = panelColumns(input({ report: report({}, { coverage, rankableClassCount: 29 }) }))[2];
    expect(texts(cover)).toEqual([`Pool coverage ${percent} of 29 tracked Item Classes`]);
  });

  it('reads omitted coverage as not measured with weights loaded, never 0', () => {
    expect(texts(panelColumns(input())[2])).toEqual([`Pool coverage ${NOT_MEASURED}`]);
  });

  it('prints the two attribution lines in Built from', () => {
    const published = report(
      { runStartedAt: '2026-09-26T11:18:00Z', runFinishedAt: '2026-09-26T11:19:00Z' },
      { trackedListEditedAt: { source: 'file-modified', at: '2026-09-25T09:00:00Z' } },
    );
    const built = panelColumns(input({ report: published }))[3];
    expect(texts(built)).toEqual([
      'Weights File producer poe-mod-weights-producer | generatedAt 2026-09-26 | gamePatch 0.5.5\nLast synced 41 minutes ago | Tracked List last edited 2026-09-25 (not committed)',
    ]);
  });

  it('reads a missing Tracked List date as unknown', () => {
    const figures = { ...BASE_REPORT.figures };
    delete figures.trackedListEditedAt;
    const built = panelColumns(input({ report: { ...BASE_REPORT, figures } }))[3];
    expect(groupText(built[0] ?? []).split('\n', 2)[1]).toBe(`Last synced < 1 minute ago | Tracked List last edited ${UNKNOWN}`);
  });

  it('adds one Not published line per absent tolerable file, in order, and counts none of them', () => {
    const [problems, , cover, built] = panelColumns(input({ weights: undefined, absent: ['syncReport', 'weights'] }));
    expect(texts(built)[1]).toBe([absenceLine('weights'), absenceLine('syncReport')].join('\n'));
    expect(texts(cover)).toEqual([`Pool coverage ${UNKNOWN}`]);
    expect(texts(built)[0]).toContain(`producer ${UNKNOWN} | generatedAt ${UNKNOWN} | gamePatch ${UNKNOWN}`);
    expect(texts(problems)).not.toContain(absenceLine('weights'));
  });

  it('reads every report figure unknown when sync-report.json is absent', () => {
    const [, run, cover, built] = panelColumns(input({ report: undefined, absent: ['syncReport'] }));
    expect(texts(run)).toEqual([`Requests ${UNKNOWN}`, `${UNKNOWN} entries not reached in the last sync pass`]);
    expect(texts(cover)).toEqual([`Pool coverage ${UNKNOWN}`]);
    expect(groupText(built[0] ?? []).split('\n', 2)[1]).toBe(`Last synced ${UNKNOWN} | Tracked List last edited ${UNKNOWN}`);
    expect(texts(built)[1]).toBe(absenceLine('syncReport'));
  });

  it('holds the problem lines in Problems, and nothing with no problem', () => {
    expect(panelColumns(input())[0]).toEqual([]);
    const problems = problemSummary(datasetWithBroken(2), report({ records: [starvation] }), CURATION);
    expect(texts(panelColumns(input({ problems }))[0])).toEqual([lines(problems).join('\n')]);
  });

  it('never says Chunk', () => {
    for (const column of panelColumns(input())) {
      for (const group of column) {
        expect(groupText(group)).not.toMatch(/chunk/i);
      }
    }
  });
});

describe('the cross-file diagnosis', () => {
  const failure = {
    check: 'empty-containment-set',
    entryKey: '["crafted","jewel","Emerald",1,["explicit.stat_1",12,15],null]',
    detail: 'prefix explicit.stat_1 band [12, 15] at floor 1: no scoped entry contains it (1 scoped entry carries that statId)',
  } as const;

  it('follows the problem lines under its lead, one verbatim line per failure, and is not counted', () => {
    const problems = problemSummary(datasetWithBroken(1), undefined, CURATION);
    const [column] = panelColumns(input({ problems, crossFileFailures: [failure, { ...failure, check: 'kind-agreement' }] }));
    expect(column).toHaveLength(2);
    expect(column[1]).toEqual([
      [{ kind: 'text', text: DIAGNOSIS_LEAD }],
      [{ kind: 'verbatim', text: `empty-containment-set · ${failure.entryKey} · ${failure.detail}` }],
      [{ kind: 'verbatim', text: `kind-agreement · ${failure.entryKey} · ${failure.detail}` }],
    ]);
    expect(problems.broken).toBe(1);
  });

  it('shows beside an absent report too, since web ran the checks itself', () => {
    expect(panelColumns(input({ report: undefined, crossFileFailures: [failure] }))[0]).toHaveLength(1);
  });

  it('renders nothing with no failure', () => {
    expect(panelColumns(input({ crossFileFailures: [] }))[0]).toEqual([]);
  });

  it('reads one unknown line when no weights envelope loaded, since the checks did not run', () => {
    for (const published of [report(), undefined]) {
      const [column] = panelColumns(input({ report: published, weights: undefined }));
      expect(column).toEqual([[[{ kind: 'text', text: DIAGNOSIS_LEAD }], [{ kind: 'missing', text: UNKNOWN }]]]);
    }
  });
});
