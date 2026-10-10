import { describe, expect, it } from 'vitest';

import { NOW } from '../test-support/dom';
import { BASE_REPORT, CURATION, datasetWithBroken, lines, report, starvation, WEIGHTS } from '../test-support/sync-report-fixtures';
import { panelColumns, type PanelInput } from './panel-columns';
import { problemSummary } from './problem-summary';
import { groupText, type FigureGroup } from './segments';
import { absenceLine, DIAGNOSIS_LEAD, NOT_MEASURED, PANEL_HEADINGS, UNKNOWN } from './trust-copy';

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
