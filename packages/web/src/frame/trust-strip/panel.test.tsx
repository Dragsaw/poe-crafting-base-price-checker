import { afterEach, describe, expect, it, vi } from 'vitest';

import { rgb, unmount } from '../../test-support/dom';
import { colors, px, spacing } from '../../theme/tokens';
import { AFFORDANCE_CLOSED, AFFORDANCE_OPEN, PANEL_HEADINGS } from '../trust-facts';
import { affordance, click, COMMITTED_REPORT, mountStrip, panel, strip } from './test-support';

afterEach(() => {
  unmount();
  vi.restoreAllMocks();
});

describe('the toggle and the panel', () => {
  // Matrix: toggle.
  it('is closed on load, and a click anywhere on the strip opens then closes it', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    mountStrip();
    expect(panel()).toBeUndefined();
    expect(affordance()).toBe(AFFORDANCE_CLOSED);
    click(strip().querySelector('[data-trust-line="sync"]'));
    expect(panel()).not.toBeUndefined();
    expect(affordance()).toBe(AFFORDANCE_OPEN);
    click(strip().querySelector('[data-trust-line="weights"]'));
    expect(panel()).toBeUndefined();
    expect(affordance()).toBe(AFFORDANCE_CLOSED);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not close when the panel itself is clicked', () => {
    mountStrip();
    click(strip());
    click(panel());
    expect(panel()).not.toBeUndefined();
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
    mountStrip({ weights: undefined }, ['weights']);
    click(strip());
    const cover = panel()?.querySelectorAll('[data-panel-column]')[2];
    expect(cover?.querySelector('[data-figure-group]')?.textContent).toBe('unknown');
  });

  it('still toggles with sync-report.json absent, and every group reads unknown under its heading', () => {
    mountStrip({ syncReport: undefined }, ['syncReport']);
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
