import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ArtifactSet, Parsed, TolerableKey } from '../load/artifacts';
import { NBSP } from '../shared/text';
import { VALID_BODIES } from '../test-support/artifact-server';
import { rgb } from '../test-support/dom';
import { colors, px, spacing, stacks } from '../theme/tokens';
import { absenceLine } from './AbsenceLines';
import { AFFORDANCE_CLOSED, AFFORDANCE_OPEN, PANEL_HEADINGS, type DiagnosisFailure } from './trust-facts';
import { TrustStrip } from './TrustStrip';

type SyncReport = Parsed<'syncReport'>;

/** Not the shared `NOW`: this clock mirrors the committed report's run, so Last synced reads the committed copy. */
const REPORT_CLOCK = Date.parse('2026-09-26T21:32:00.000Z');
const BASE_SET = VALID_BODIES as unknown as ArtifactSet;
const COMMITTED_REPORT: SyncReport = {
  schemaVersion: '1.1.0',
  runStartedAt: '2026-09-26T20:51:10.620Z',
  runFinishedAt: '2026-09-26T20:51:13.533Z',
  figures: {
    requestsBySource: { 'tracked-list': 10, 'league-validation': 1, 'session-probe': 0 },
    notReachedCount: 0,
    trackedListEditedAt: { source: 'file-modified', at: '2026-09-26T11:23:42.140Z' },
  },
  records: [],
};

/**
 * A loaded curation of 5 pinned entries and `minChunkSearches: 8`, which the
 * 5/8 starvation fixtures describe. Two active entries prove only pinned
 * entries count toward M.
 */
const CURATION_5_OF_8: Partial<ArtifactSet> = {
  tracked: {
    ...BASE_SET.tracked,
    entries: [
      ...['Gold Amulet', 'Solar Amulet', 'Coral Ring', 'Wide Belt', 'Leather Belt'].map((baseTypeId) => ({
        kind: 'raw' as const,
        baseTypeId,
        itemLevelMin: 82,
        status: 'pinned' as const,
      })),
      ...['Iron Ring', 'Jade Amulet'].map((baseTypeId) => ({
        kind: 'raw' as const,
        baseTypeId,
        itemLevelMin: 82,
        status: 'active' as const,
      })),
    ],
  },
  config: { ...BASE_SET.config, minChunkSearches: 8 },
};

let container: HTMLDivElement | undefined;
let root: Root | undefined;

afterEach(() => {
  const mounted = root;
  if (mounted !== undefined) {
    act(() => {
      mounted.unmount();
    });
  }
  root = undefined;
  container?.remove();
  container = undefined;
  vi.restoreAllMocks();
});

function mountStrip(
  overrides: Partial<ArtifactSet> = {},
  absent: readonly TolerableKey[] = [],
  crossFileFailures: readonly DiagnosisFailure[] = [],
): HTMLDivElement {
  const set = { ...BASE_SET, syncReport: COMMITTED_REPORT, ...overrides } as ArtifactSet;
  container = document.createElement('div');
  document.body.append(container);
  const mounted = createRoot(container);
  root = mounted;
  act(() => {
    mounted.render(<TrustStrip set={set} absent={absent} now={REPORT_CLOCK} crossFileFailures={crossFileFailures} />);
  });
  return container;
}

function strip(): HTMLElement {
  const found = container?.querySelector<HTMLElement>('[data-trust-strip]');
  if (found === null || found === undefined) {
    throw new Error('no trust strip rendered');
  }
  return found;
}

const line = (name: string): string =>
  (strip().querySelector(`[data-trust-line="${name}"]`)?.textContent ?? '').replaceAll(NBSP, ' ');
const panel = (): HTMLElement | null => container?.querySelector<HTMLElement>('[data-sync-report-panel]') ?? null;
const affordance = (): string | null | undefined => strip().querySelector('[data-strip-affordance]')?.textContent;

function click(target: Element | null | undefined): void {
  act(() => {
    (target as HTMLElement).click();
  });
}

describe('the resting strip', () => {
  // Matrix: committed.
  it('prints the committed weights header and a file-modified edit date, with no health line', () => {
    mountStrip();
    expect(line('weights')).toBe('Weights File  producer poe-mod-weights-producer | generatedAt 2026-09-26 | gamePatch 0.5.5');
    expect(line('sync')).toBe('Last synced  40 minutes ago | Tracked List last edited  2026-09-26 (not committed)');
    expect(strip().querySelector('[data-health-line]')).toBeNull();
    // No count of nothing: no zero count anywhere on a healthy strip.
    expect(strip().textContent).not.toMatch(/(^|[^.\d])0 [a-z]/);
  });

  it('sets labels in ink 600, values in ink-secondary, and | in ink-tertiary padded 9px, with no mark', () => {
    mountStrip();
    const labels = strip().querySelectorAll<HTMLElement>('b');
    expect(Array.from(labels, (label) => label.textContent)).toEqual([
      'Weights File',
      'Last synced',
      'Tracked List last edited',
    ]);
    for (const label of labels) {
      expect(label.style.color).toBe(rgb(colors.ink));
      expect(label.style.fontWeight).toBe('600');
    }
    expect(strip().style.color).toBe(rgb(colors['ink-secondary']));
    const separator = strip().querySelector<HTMLElement>('[data-separator]');
    expect(separator?.style.color).toBe(rgb(colors['ink-tertiary']));
    expect(separator?.style.padding).toBe(`0px ${px(spacing.trustSeparatorPadX)}`);
    expect(strip().textContent).not.toContain('×');
  });

  it('carries the class names the hover underline hangs on, and no inline rule on the affordance', () => {
    mountStrip();
    expect(strip().className).toBe('fg-trust-strip');
    const aff = strip().querySelector<HTMLElement>('[data-strip-affordance]');
    expect(aff?.className).toBe('fg-strip-affordance');
    expect(aff?.style.borderBottom).toBe('');
    expect(aff?.style.textDecoration).toBe('');
  });

  // Matrix: git date.
  it('prints a git-author-date bare', () => {
    mountStrip({
      syncReport: {
        ...COMMITTED_REPORT,
        figures: { ...COMMITTED_REPORT.figures, trackedListEditedAt: { source: 'git-author-date', at: '2026-08-01T09:00:00Z' } },
      },
    });
    expect(line('sync')).toMatch(/Tracked List last edited {2}2026-08-01$/);
  });

  // Matrix: no edit date.
  it('reads an italic unknown with no edit date', () => {
    const figures = { ...COMMITTED_REPORT.figures };
    delete figures.trackedListEditedAt;
    mountStrip({ syncReport: { ...COMMITTED_REPORT, figures } });
    expect(line('sync')).toMatch(/Tracked List last edited {2}unknown$/);
    const missing = strip().querySelector<HTMLElement>('[data-trust-line="sync"] [data-missing]');
    expect(missing?.style.fontStyle).toBe('italic');
  });

  // Matrix: weights absent.
  it('reads the three line-one values unknown and carries the absence line inside the strip', () => {
    mountStrip({ weights: null }, ['weights']);
    expect(line('weights')).toBe('Weights File  producer unknown | generatedAt unknown | gamePatch unknown');
    expect(strip().querySelectorAll('[data-trust-line="weights"] [data-missing]')).toHaveLength(3);
    const absence = strip().querySelectorAll<HTMLElement>('[data-absence-lines] p');
    expect(Array.from(absence, (p) => p.textContent)).toEqual([absenceLine('weights')]);
    expect(absence[0]?.style.height).toBe(px(spacing.frameReserveAbsenceLine));
  });

  it('orders absence lines weights, recipes, sync-report after line two and before the health line', () => {
    mountStrip(
      { syncReport: null, weights: null, recipes: null },
      ['syncReport', 'weights', 'recipes'],
    );
    const lines = Array.from(strip().querySelectorAll('[data-absence-lines] p'), (p) => p.textContent);
    expect(lines).toEqual([absenceLine('weights'), absenceLine('recipes'), absenceLine('syncReport')]);
    const lead = strip().querySelector<HTMLElement>('[data-absence-lines] p span');
    expect(lead?.textContent).toBe('Not published:');
    expect(lead?.style.fontWeight).toBe('600');
    expect(lead?.style.color).toBe(rgb(colors.ink));
    // With no report, Last synced is unknown and no health line is raised.
    expect(line('sync')).toBe('Last synced  unknown | Tracked List last edited  unknown');
    expect(strip().querySelector('[data-health-line]')).toBeNull();
  });

  // Matrix: broken.
  it('raises one rust 700 health line for unresolvable records and pinned starvation', () => {
    const records: SyncReport['records'] = [
      ...Array.from({ length: 12 }, (_, index) => ({
        kind: 'unresolvable' as const,
        entryKey: `raw:${String(index)}`,
        identifier: String(index),
        identifierKind: 'statId' as const,
      })),
      {
        kind: 'pinned-starvation' as const,
        discoveredAllowance: 4,
        declaredMinChunkSearches: 8,
        pinnedCount: 5,
        pinnedRefreshed: 2,
        activeRefreshed: 0,
      },
    ];
    mountStrip({ syncReport: { ...COMMITTED_REPORT, records }, ...CURATION_5_OF_8 }, ['recipes']);
    const health = strip().querySelector<HTMLElement>('[data-health-line]');
    expect(health?.style.height).toBe(px(spacing.frameReserveHealthLine));
    expect(health?.textContent?.replaceAll(NBSP, ' ')).toBe('× 12 unresolvable|× 3 of 5 pinned entries starved');
    const signals = health?.querySelectorAll<HTMLElement>('[data-health-signal]') ?? [];
    expect(signals).toHaveLength(2);
    for (const signal of signals) {
      expect(signal.style.color).toBe(rgb(colors.rust));
      expect(signal.style.fontWeight).toBe('700');
    }
    // The absence line sits before the health line.
    const children = [...strip().children] as HTMLElement[];
    const absenceIndex = children.findIndex((child) => child.dataset['absenceLines'] !== undefined);
    expect(absenceIndex).toBeGreaterThan(-1);
    expect(children.indexOf(health as HTMLElement)).toBe(absenceIndex + 1);
    // The five facts are unaffected.
    expect(line('weights')).toContain('producer poe-mod-weights-producer');
  });

  // Matrix: only a non-matching record, no unresolvable.
  it('raises no health line for a starvation record of another curation, and the panel still lists it', () => {
    const records: SyncReport['records'] = [
      {
        kind: 'pinned-starvation' as const,
        discoveredAllowance: 4,
        declaredMinChunkSearches: 8,
        pinnedCount: 8,
        pinnedRefreshed: 2,
        activeRefreshed: 0,
      },
    ];
    mountStrip({ syncReport: { ...COMMITTED_REPORT, records }, ...CURATION_5_OF_8 });
    expect(strip().querySelector('[data-health-line]')).toBeNull();
    click(strip());
    const text = panel()?.textContent ?? '';
    expect(text).toContain('1 pinned-starvation record.');
    expect(text).toContain('2 of 8 pinned entries refreshed');
  });
});

describe('the toggle and the panel', () => {
  // Matrix: toggle.
  it('is closed on load, and a click anywhere on the strip opens then closes it', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    mountStrip();
    expect(panel()).toBeNull();
    expect(affordance()).toBe(AFFORDANCE_CLOSED);
    click(strip().querySelector('[data-trust-line="sync"]'));
    expect(panel()).not.toBeNull();
    expect(affordance()).toBe(AFFORDANCE_OPEN);
    click(strip().querySelector('[data-trust-line="weights"]'));
    expect(panel()).toBeNull();
    expect(affordance()).toBe(AFFORDANCE_CLOSED);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not close when the panel itself is clicked', () => {
    mountStrip();
    click(strip());
    click(panel());
    expect(panel()).not.toBeNull();
  });

  it('holds three equal columns, one heading each, and the committed figures', () => {
    mountStrip();
    click(strip());
    const open = panel();
    expect(open?.style.maxHeight).toBe(px(spacing.syncReportMaxHeight));
    expect(open?.style.overflowY).toBe('auto');
    expect(open?.style.padding).toBe('14px 16px 12px');
    expect(open?.style.background).toBe(rgb(colors['paper-inset']));
    const columns = [...open?.querySelectorAll<HTMLElement>('[data-panel-column]') ?? []];
    expect(columns).toHaveLength(3);
    expect(columns.map((column) => column.querySelectorAll('[data-panel-heading]').length)).toEqual([1, 1, 1]);
    expect(columns.map((column) => column.querySelector('[data-panel-heading]')?.textContent)).toEqual([...PANEL_HEADINGS]);
    expect(columns.map((column) => column.style.paddingRight)).toEqual(['22px', '22px', '0px']);
    expect(columns.map((column) => column.querySelectorAll('[data-figure-group]').length)).toEqual([2, 2, 1]);
    const text = open?.textContent ?? '';
    expect(text).toContain('10 tracked list · 1 league validation request this pass.');
    expect(text).toContain('0 tracked entries were not reached in the last sync pass.');
    expect(text).toContain('0 entries are unresolvable.');
    expect(text).toContain('0 pinned-starvation records.');
    // Matrix: coverage omitted, weights loaded.
    expect(columns[2]?.textContent).toBe('What the weights covernot measured');
    expect(text).not.toContain('2026-09-26');
    expect(text).not.toMatch(/chunk/i);
    const figure = open?.querySelector<HTMLElement>('[data-figure]');
    expect(figure?.style.color).toBe(rgb(colors.ink));
    expect(figure?.style.fontVariantNumeric).toBe('tabular-nums');
  });

  // Matrix: coverage present.
  it('prints coverage as a percent of its denominator', () => {
    mountStrip({
      syncReport: { ...COMMITTED_REPORT, figures: { ...COMMITTED_REPORT.figures, coverage: 0.862, rankableClassCount: 29 } },
    });
    click(strip());
    const cover = panel()?.querySelectorAll('[data-panel-column]')[2];
    expect(cover?.querySelector('[data-figure-group]')?.textContent).toBe('86% of 29 tracked Item Classes.');
  });

  it('reads coverage unknown with weights absent', () => {
    mountStrip({ weights: null }, ['weights']);
    click(strip());
    const cover = panel()?.querySelectorAll('[data-panel-column]')[2];
    expect(cover?.querySelector('[data-figure-group]')?.textContent).toBe('unknown');
  });

  it('still toggles with sync-report.json absent, and every group reads unknown under its heading', () => {
    mountStrip({ syncReport: null }, ['syncReport']);
    click(strip());
    const groups = panel()?.querySelectorAll('[data-figure-group]') ?? [];
    expect(groups).toHaveLength(5);
    for (const group of groups) {
      expect(group.textContent).toBe('unknown');
      expect(group.querySelector<HTMLElement>('[data-missing]')?.style.fontStyle).toBe('italic');
    }
    expect(panel()?.querySelectorAll('[data-panel-heading]')).toHaveLength(3);
  });
});

describe('the cross-file diagnosis (AD-17)', () => {
  const FAILURES: readonly DiagnosisFailure[] = [
    {
      check: 'edge-alignment',
      entryKey: '["crafted","weapon.bow","Bows",82,["explicit.stat_1",0,9999],null]',
      detail: 'prefix explicit.stat_1 band [0, 9999] at floor 82: its edges are not the extremes [43, 56.5] of the tiers it contains',
    },
    {
      check: 'kind-agreement',
      entryKey: '["crafted","weapon.crossbow","Crossbows",82,null,["explicit.stat_2",null,null]]',
      detail: 'suffix explicit.stat_2 valueless at floor 82: 1 scoped line on that statId is banded',
    },
  ];

  it('leaves the strip unchanged', () => {
    mountStrip();
    const before = strip().textContent;
    act(() => {
      root?.unmount();
    });
    root = undefined;
    container?.remove();
    mountStrip({}, [], FAILURES);
    expect(strip().textContent).toBe(before);
    expect(strip().querySelector('[data-health-line]')).toBeNull();
  });

  it('lists one mono line per failure as the third group of the second column', () => {
    mountStrip({}, [], FAILURES);
    click(strip());
    const broken = panel()?.querySelectorAll<HTMLElement>('[data-panel-column]')[1];
    const groups = broken?.querySelectorAll<HTMLElement>('[data-figure-group]') ?? [];
    expect(groups).toHaveLength(3);
    const diagnosis = groups[2];
    expect(diagnosis?.style.marginTop).toBe(px(spacing.syncReportGroupGap));
    const lines = [...diagnosis?.querySelectorAll<HTMLElement>('[data-verbatim]') ?? []];
    expect(lines.map((element) => element.textContent)).toEqual(
      FAILURES.map((failure) => `${failure.check} · ${failure.entryKey} · ${failure.detail}`),
    );
    for (const verbatim of lines) {
      expect(verbatim.style.fontFamily).toBe(stacks.mono);
      expect(verbatim.style.fontSize).toBe('10.5px');
      expect(verbatim.style.fontWeight).toBe('400');
      expect(verbatim.style.lineHeight).toBe('1.85');
      expect(verbatim.style.color).toBe('');
    }
  });

  it('renders no group without a failure', () => {
    mountStrip();
    click(strip());
    const broken = panel()?.querySelectorAll('[data-panel-column]')[1];
    expect(broken?.querySelectorAll('[data-figure-group]')).toHaveLength(2);
    expect(panel()?.querySelector('[data-verbatim]')).toBeNull();
  });

  it('reads one italic unknown line with weights absent: the checks did not run', () => {
    mountStrip({ weights: null }, ['weights']);
    click(strip());
    const broken = panel()?.querySelectorAll('[data-panel-column]')[1];
    const groups = broken?.querySelectorAll<HTMLElement>('[data-figure-group]') ?? [];
    expect(groups).toHaveLength(3);
    const unknown = groups[2]?.querySelectorAll<HTMLElement>('[data-missing]') ?? [];
    expect(Array.from(unknown, (node) => node.textContent)).toEqual(['unknown']);
    expect(unknown[0]?.style.fontStyle).toBe('italic');
    expect(groups[2]?.textContent).toBe('unknown');
  });
});
