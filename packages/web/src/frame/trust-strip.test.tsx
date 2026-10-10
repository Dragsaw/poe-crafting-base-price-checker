import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ArtifactSet } from '../load/artifacts';
import { NBSP } from '../shared/text';
import { rgb, unmount } from '../test-support/dom';
import { colors, px, layout } from '../theme/tokens';
import { rawEntry, unpriced } from '../test-support/list-fixtures';
import { absenceLine } from './trust-facts';
import { BASE_SET, click, COMMITTED_REPORT, line, mountStrip, panel, strip, type SyncReport } from './trust-strip/test-support';

/** 5 pinned entries and `minChunkSearches: 8`; the two active ones prove only pinned count. */
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

afterEach(() => {
  unmount();
  vi.restoreAllMocks();
});

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

  it('sets labels in text 600, values in text-secondary, and | in text-tertiary padded 9px, with no mark', () => {
    mountStrip();
    const labels = strip().querySelectorAll<HTMLElement>('b');
    expect(Array.from(labels, (label) => label.textContent)).toEqual([
      'Weights File',
      'Last synced',
      'Tracked List last edited',
    ]);
    for (const label of labels) {
      expect(label.style.color).toBe(rgb(colors.text));
      expect(label.style.fontWeight).toBe('600');
    }
    expect(strip().style.color).toBe(rgb(colors['text-secondary']));
    const separator = strip().querySelector<HTMLElement>('[data-separator]');
    expect(separator?.style.color).toBe(rgb(colors['text-tertiary']));
    expect(separator?.style.padding).toBe(`0px ${px(layout.trustSeparatorPadX)}`);
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
    mountStrip({ weights: undefined }, ['weights']);
    expect(line('weights')).toBe('Weights File  producer unknown | generatedAt unknown | gamePatch unknown');
    expect(strip().querySelectorAll('[data-trust-line="weights"] [data-missing]')).toHaveLength(3);
    const absence = strip().querySelectorAll<HTMLElement>('[data-absence-lines] p');
    expect(Array.from(absence, (p) => p.textContent)).toEqual([absenceLine('weights')]);
    expect(absence[0]?.style.height).toBe(px(layout.absenceLineHeight));
  });

  it('orders absence lines weights, recipes, sync-report after line two and before the health line', () => {
    mountStrip(
      { syncReport: undefined, weights: undefined, recipes: undefined },
      ['syncReport', 'weights', 'recipes'],
    );
    const lines = Array.from(strip().querySelectorAll('[data-absence-lines] p'), (p) => p.textContent);
    expect(lines).toEqual([absenceLine('weights'), absenceLine('recipes'), absenceLine('syncReport')]);
    const lead = strip().querySelector<HTMLElement>('[data-absence-lines] p span');
    expect(lead?.textContent).toBe('Not published');
    expect(lead?.style.fontWeight).toBe('600');
    expect(lead?.style.color).toBe(rgb(colors.text));
    // With no report, Last synced is unknown and no health line is raised.
    expect(line('sync')).toBe('Last synced  unknown | Tracked List last edited  unknown');
    expect(strip().querySelector('[data-health-line]')).toBeNull();
  });

  // Matrix: broken.
  it('raises one trust-broken 700 health line for broken dataset entries and pinned starvation', () => {
    const records: SyncReport['records'] = [
      {
        kind: 'pinned-starvation' as const,
        discoveredAllowance: 4,
        declaredMinChunkSearches: 8,
        pinnedCount: 5,
        pinnedRefreshed: 2,
        activeRefreshed: 0,
      },
    ];
    const dataset = {
      ...BASE_SET.dataset,
      entries: Array.from({ length: 12 }, (_, index) => unpriced(rawEntry(`Lost ${String(index)}`), { state: 'unresolvable' })),
    };
    mountStrip({ syncReport: { ...COMMITTED_REPORT, records }, ...CURATION_5_OF_8, dataset }, ['recipes']);
    const health = strip().querySelector<HTMLElement>('[data-health-line]');
    expect(health?.style.height).toBe(px(layout.healthLineHeight));
    expect(health?.textContent?.replaceAll(NBSP, ' ')).toBe(
      '× 12 entries can no longer be priced|× 3 of 5 pinned entries are not being refreshed',
    );
    const signals = health?.querySelectorAll<HTMLElement>('[data-health-signal]') ?? [];
    expect(signals).toHaveLength(2);
    for (const signal of signals) {
      expect(signal.style.color).toBe(rgb(colors['trust-broken']));
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
  it('raises no health line for a starvation record of another curation, and the panel counts nothing', () => {
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
    expect(text).not.toContain('pinned');
  });
});
