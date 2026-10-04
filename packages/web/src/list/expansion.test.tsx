import type { DatasetEntry, RawTrackedEntry } from '@poe/contracts';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_THRESHOLD } from '../shared/product';
import { TEST_LEAGUE } from '../test-support/artifact-server';
import { cssNumber } from '../test-support/css-number';
import { cellIn as cell, mountList, NOW, rgb, rowsIn, unmount } from '../test-support/dom';
import { hoursBefore, priced, rawEntry, unpriced } from '../test-support/list-fixtures';
import { colors, columnSums, glyphs, spacing } from '../theme/tokens';
import { PANEL_ASKING_SENTENCE, RAW_NO_RECIPE_SENTENCE } from './format';

const SEARCH = { id: 'H4sIabc', league: TEST_LEAGUE } as const;
const HREF = `https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites/${SEARCH.id}`;

afterEach(() => {
  unmount();
  vi.restoreAllMocks();
});

function panelsIn(within: HTMLElement): HTMLElement[] {
  return [...within.querySelectorAll<HTMLElement>('[data-expansion-panel]')];
}

function click(target: HTMLElement | null | undefined): void {
  act(() => {
    target?.click();
  });
}

/** Mounts one row, opens it, and returns its only combination row. */
function openOne(entry: RawTrackedEntry, published: DatasetEntry | undefined, threshold = DEFAULT_THRESHOLD): HTMLElement {
  const view = mountList([entry], published === undefined ? [] : [published], threshold);
  click(rowsIn(view)[0]);
  const rows = [...view.querySelectorAll<HTMLElement>('[data-combination-row]')];
  expect(rows).toHaveLength(1);
  const [only] = rows;
  if (only === undefined) {
    throw new Error('no combination row');
  }
  return only;
}

function line1(row: HTMLElement): string[] {
  return ['combination', 'state', 'figure', 'sample'].map((name) => cell(row, name).textContent);
}

function line2(row: HTMLElement): string[] {
  return ['note', 'observed', 'attempted'].map((name) => cell(row, name).textContent);
}

function many(count: number): { tracked: RawTrackedEntry[]; dataset: DatasetEntry[] } {
  const tracked = Array.from({ length: count }, (_, index) => rawEntry(`Base ${String(index).padStart(2, '0')}`));
  return { tracked, dataset: tracked.map((entry, index) => priced(entry, 40 - index, hoursBefore(NOW, 1))) };
}

describe('the expansion panel', () => {
  it('opens in place, flush under its row, as a bordered paper card with no top border', () => {
    const { tracked, dataset } = many(3);
    const view = mountList(tracked, dataset);
    expect(panelsIn(view)).toHaveLength(0);
    const second = rowsIn(view)[1];
    click(second);
    const [panel] = panelsIn(view);
    expect(second?.nextElementSibling).toBe(panel);
    expect(panel?.style.width).toBe('1012px');
    expect(panel?.style.boxSizing).toBe('border-box');
    expect(panel?.style.padding).toBe('18px 22px 20px');
    expect(panel?.style.margin).toBe('0px 0px 16px');
    expect(panel?.style.borderTopStyle).toBe('none');
    expect(panel?.style.borderLeft).toBe(`1px solid ${rgb(colors.edge)}`);
    expect(panel?.style.background).toBe(rgb(colors.paper));
    expect(panel?.style.transition).toBe('');
    expect(panel?.style.animation).toBe('');
    expect(second?.style.borderBottom).toContain(rgb(colors['rule-strong']));
    // Not a modal: nothing is an overlay or a dialog.
    expect(view.querySelector('[role="dialog"]')).toBeNull();
    expect(panel?.style.position).toBe('');
  });

  it('titles the panel with the sepia unit glyph and the italic name, then the sub-line', () => {
    const belt = rawEntry('Stellar Amulet', 82);
    const view = mountList([belt], [priced(belt, 1.27, hoursBefore(NOW, 11))], 0.5);
    click(rowsIn(view)[0]);
    const [panel] = panelsIn(view);
    const title = panel?.querySelector<HTMLElement>('[data-panel-title]');
    const glyph = title?.querySelector<HTMLElement>('[data-unit-glyph]');
    expect(glyph?.textContent).toBe(glyphs.unitRaw);
    expect(glyph?.style.color).toBe(rgb(colors.sepia));
    const name = title?.querySelector<HTMLElement>('[data-panel-name]');
    expect(name?.textContent).toBe('Stellar Amulet');
    expect(name?.style.fontStyle).toBe('italic');
    expect(title?.style.fontSize).toBe('20px');
    const sub = panel?.querySelector<HTMLElement>('[data-panel-sub]');
    expect(sub?.textContent).toBe(
      'Uncrafted at Item Level 82, valued at its own current asking price and not at a craft outcome. ' +
        'One Combination is tracked here: the degenerate Combination of no affixes. ' +
        `Payout Threshold 0.50 Divine. ${RAW_NO_RECIPE_SENTENCE} ${PANEL_ASKING_SENTENCE}`,
    );
    expect(sub?.style.margin).toBe('4px 0px 13px');
    expect(sub?.textContent).toContain('No Craft Recipe applies');
  });

  it('cuts the combination row into 460 + 250 + 116 + 116 + 24 and 560 + 200 + 206, at 28 + 20 minimum', () => {
    const belt = rawEntry('Wide Belt');
    const row = openOne(belt, priced(belt, 0.8, hoursBefore(NOW, 11), TEST_LEAGUE, SEARCH));
    const widths = (line: string): number[] =>
      Array.from(row.querySelectorAll<HTMLElement>(`[data-line="${line}"] > [data-cell]`), (c) => cssNumber(c.style.width));
    expect(widths('1')).toEqual([...columnSums.combinationLine1]);
    expect(widths('2')).toEqual([...columnSums.combinationLine2]);
    expect(row.style.minHeight).toBe(`${String(spacing.combinationRowHeight)}px`);
    expect(row.querySelector<HTMLElement>('[data-line="1"]')?.style.height).toBe('28px');
    expect(row.querySelector<HTMLElement>('[data-line="2"]')?.style.minHeight).toBe('20px');
    expect(row.querySelector<HTMLElement>('[data-line="2"]')?.style.lineHeight).toBe('20px');
    for (const c of row.querySelectorAll<HTMLElement>('[data-cell]')) {
      expect(c.style.boxSizing).toBe('border-box');
      expect(c.style.paddingRight).toBe(c.dataset['cell'] === 'trade-link' ? '' : '12px');
    }
  });

  it('never truncates, ellipsises or tooltips inside a combination row, and line two wraps', () => {
    const belt = rawEntry('Wide Belt');
    const row = openOne(belt, priced(belt, 0.8, hoursBefore(NOW, 11), TEST_LEAGUE, SEARCH));
    for (const node of [row, ...row.querySelectorAll<HTMLElement>('*')]) {
      expect(node.style.textOverflow).toBe('');
      expect(node.style.overflow).toBe('');
      expect(node.hasAttribute('title')).toBe(false);
    }
    expect(row.querySelector<HTMLElement>('[data-line="2"]')?.style.whiteSpace).toBe('normal');
  });
});

describe('the Raw Base combination row', () => {
  // Matrix: priced raw.
  it('prints a priced raw entry: ● priced, 0.80, 10 listings, the raw note, both ages and ↗', () => {
    const belt = rawEntry('Wide Belt', 82);
    const row = openOne(belt, {
      ...priced(belt, 0.8, hoursBefore(NOW, 11), TEST_LEAGUE, SEARCH),
      lastAttemptedAt: hoursBefore(NOW, 11),
    });
    expect(line1(row)).toEqual(['no affixes', `${glyphs.priced}\u{A0}priced`, '0.80', '10 listings']);
    expect(line2(row)).toEqual([
      'no affixes — this Base Type priced as it drops, at Item Level 82',
      'priced 11h ago',
      'tried 11h ago',
    ]);
    const link = cell(row, 'trade-link').querySelector<HTMLAnchorElement>('a');
    expect(link?.textContent).toBe(glyphs.tradeLink);
    expect(link?.getAttribute('href')).toBe(HREF);
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toBe('noopener');
    expect(link?.style.fontWeight).toBe('400');
    expect(link?.className).toBe('fg-trade-glyph');
    expect(cell(row, 'note').style.fontStyle).toBe('italic');
    expect(cell(row, 'figure').style.textAlign).toBe('right');
  });

  // Matrix: tiny price.
  it('prints a tiny price as < 0.01', () => {
    const belt = rawEntry('Wide Belt');
    const row = openOne(belt, priced(belt, 0.003, hoursBefore(NOW, 2)), 0);
    expect(cell(row, 'figure').textContent).toBe('< 0.01');
    expect(cell(row, 'figure').querySelector('[data-money-phrase]')).toBeNull();
  });

  it('prints 1 listing in the singular', () => {
    const belt = rawEntry('Wide Belt');
    const one = priced(belt, 2, hoursBefore(NOW, 2));
    if (one.price.state !== 'priced') {
      throw new Error('fixture');
    }
    const row = openOne(belt, { ...one, price: { ...one.price, observation: { ...one.price.observation, sampleSize: 1 } } });
    expect(cell(row, 'sample').textContent).toBe('1 listing');
  });

  // Matrix: no listings.
  it('prints no-listings: ○, an open question, 0 listings found, the state-2 note, tried only', () => {
    const ring = rawEntry('Coral Ring');
    const row = openOne(ring, unpriced(ring, { state: 'no-listings' }, hoursBefore(NOW, 3), SEARCH));
    expect(line1(row)).toEqual(['no affixes', `${glyphs.noListings}\u{A0}no-listings`, 'an open question', '0 listings found']);
    expect(line2(row)).toEqual([
      'nobody is listing this right now — a jackpot and junk look alike here',
      '',
      'tried 3h ago',
    ]);
    const phrase = cell(row, 'figure').querySelector<HTMLElement>('[data-money-phrase]');
    expect(phrase?.style.fontStyle).toBe('italic');
    expect(phrase?.style.color).toBe(rgb(colors.ink));
    // The link test reads the stored search, never the Price State.
    expect(cell(row, 'trade-link').querySelector('a')?.getAttribute('href')).toBe(HREF);
  });

  // Matrix: expansion of an unresolvable Raw Base (EXPERIENCE state 4).
  it('prints unresolvable: × unresolvable, not valued in rust, no sample, the raw state-4 note, tried only', () => {
    const ring = rawEntry('Lost Ring');
    const row = openOne(ring, unpriced(ring, { state: 'unresolvable' }, hoursBefore(NOW, 5), SEARCH));
    expect(line1(row)).toEqual(['no affixes', `${glyphs.unresolvable}\u{A0}unresolvable`, 'not valued', 'no sample']);
    expect(line2(row)).toEqual(['its id is gone from the trade API — a patch did this', '', 'tried 5h ago']);
    const phrase = cell(row, 'figure').querySelector<HTMLElement>('[data-money-phrase]');
    expect(phrase?.style.fontStyle).toBe('italic');
    expect(phrase?.style.color).toBe(rgb(colors.rust));
    expect(row.dataset['priceState']).toBe('unresolvable');
    expect(cell(row, 'state').querySelector<HTMLElement>('[data-state-glyph]')?.style.color).toBe(rgb(colors.rust));
    expect(cell(row, 'state').querySelector<HTMLElement>('[data-state-word]')?.style.color).toBe('');
    // The link test reads the stored search, never the Price State.
    expect(cell(row, 'trade-link').querySelector('a')?.getAttribute('href')).toBe(HREF);
  });

  // Matrix: never synced.
  it('prints never-synced: ∆ with its reason, no figure yet, no sample, the state-5 note, no ages and no link', () => {
    const belt = rawEntry('Wide Belt');
    const row = openOne(belt, undefined);
    expect(line1(row)).toEqual([
      'no affixes',
      `${glyphs.notYetSynced}\u{A0}not-yet-synced · never-synced`,
      'no figure yet',
      'no sample',
    ]);
    expect(line2(row)).toEqual(['no request was ever issued for this entry', '', '']);
    expect(cell(row, 'observed').childNodes).toHaveLength(0);
    expect(cell(row, 'attempted').childNodes).toHaveLength(0);
    expect(cell(row, 'trade-link').childNodes).toHaveLength(0);
  });

  // Matrix: league mismatch, and an old-league search.
  it('prints a league mismatch with its reason and the state-6 note, and blanks an old-league link', () => {
    const amulet = rawEntry('Jade Amulet');
    const row = openOne(amulet, priced(amulet, 3, hoursBefore(NOW, 50), 'Standard', { id: 'old', league: 'Standard' }));
    expect(cell(row, 'state').textContent).toBe(`${glyphs.notYetSynced}\u{A0}not-yet-synced · league-mismatch`);
    expect(line2(row)).toEqual(['the observation belongs to another league', '', 'tried 2d ago']);
    const blank = cell(row, 'trade-link');
    expect(blank.childNodes).toHaveLength(0);
    expect(blank.style.opacity).toBe('');
  });

  it('prints no-exchange-rate with its note, and keeps its active-league link', () => {
    const ring = rawEntry('Coral Ring');
    const row = openOne(
      ring,
      unpriced(ring, { state: 'not-yet-synced', reason: 'no-exchange-rate' }, hoursBefore(NOW, 6), SEARCH),
    );
    expect(cell(row, 'state').textContent).toBe(`${glyphs.notYetSynced}\u{A0}not-yet-synced · no-exchange-rate`);
    expect(line2(row)).toEqual(['the listing currency had no rate at sync time', '', 'tried 6h ago']);
    expect(cell(row, 'trade-link').querySelector('a')?.getAttribute('href')).toBe(HREF);
  });

  // Matrix: pinned.
  it('leads line one with * pinned on a pinned entry, in ink-tertiary at 600, roman', () => {
    const belt = { ...rawEntry('Wide Belt'), status: 'pinned' as const };
    const row = openOne(belt, priced(belt, 0.8, hoursBefore(NOW, 1)));
    expect(cell(row, 'combination').textContent).toBe('* pinned no affixes');
    const mark = cell(row, 'combination').querySelector<HTMLElement>('[data-curation-pinned]');
    expect(cell(row, 'combination').firstElementChild).toBe(mark);
    expect(mark?.style.fontWeight).toBe('600');
    expect(mark?.style.fontStyle).toBe('normal');
    expect(mark?.style.color).toBe(rgb(colors['ink-tertiary']));
    expect(cell(row, 'state').textContent).not.toContain(glyphs.pinned);
  });

  it('leads line one with * pinned on a pinned unpriced entry: no-listings and never-synced', () => {
    const ring = { ...rawEntry('Coral Ring'), status: 'pinned' as const };
    const noListings = openOne(ring, unpriced(ring, { state: 'no-listings' }, hoursBefore(NOW, 3)));
    expect(cell(noListings, 'combination').textContent).toBe('* pinned no affixes');
    unmount();

    const belt = { ...rawEntry('Wide Belt'), status: 'pinned' as const };
    const never = openOne(belt, undefined);
    expect(cell(never, 'combination').textContent).toBe('* pinned no affixes');
  });

  it('marks nothing on an active entry', () => {
    const belt = rawEntry('Wide Belt');
    const row = openOne(belt, priced(belt, 0.8, hoursBefore(NOW, 1)));
    expect(cell(row, 'combination').textContent).toBe('no affixes');
    expect(row.querySelector('[data-curation-pinned]')).toBeNull();
  });
});

describe('the open set', () => {
  // Matrix: two open, grow.
  it('keeps rows 3 and 22 open, with their panels, across a collapse and a regrow', () => {
    const { tracked, dataset } = many(25);
    const view = mountList(tracked, dataset);
    const affordance = view.querySelector<HTMLButtonElement>('[data-expand-affordance]');
    click(affordance);
    click(rowsIn(view)[2]);
    click(rowsIn(view)[21]);
    const openNames = (): (string | null)[] =>
      rowsIn(view)
        .filter((r) => r.dataset['open'] !== undefined)
        .map((r) => r.querySelector('[data-unit-name]')?.textContent ?? null);
    expect(openNames()).toEqual(['Base 02', 'Base 21']);
    expect(panelsIn(view)).toHaveLength(2);

    click(affordance);
    expect(openNames()).toEqual(['Base 02']);
    expect(panelsIn(view)).toHaveLength(1);

    click(affordance);
    expect(openNames()).toEqual(['Base 02', 'Base 21']);
    expect(panelsIn(view).map((p) => p.querySelector('[data-panel-name]')?.textContent)).toEqual(['Base 02', 'Base 21']);
    for (const panel of panelsIn(view)) {
      expect(panel.previousElementSibling?.hasAttribute('data-open')).toBe(true);
    }
  });

  it('closes a panel only on a second click on its own row', () => {
    const { tracked, dataset } = many(3);
    const view = mountList(tracked, dataset);
    click(rowsIn(view)[0]);
    click(rowsIn(view)[2]);
    expect(panelsIn(view)).toHaveLength(2);
    // A click inside a panel closes nothing.
    click(panelsIn(view)[0]?.querySelector<HTMLElement>('[data-combination-row]'));
    click(panelsIn(view)[0]?.querySelector<HTMLElement>('[data-panel-title]'));
    expect(panelsIn(view)).toHaveLength(2);
    click(rowsIn(view)[2]);
    expect(panelsIn(view)).toHaveLength(1);
    expect(rowsIn(view)[0]?.hasAttribute('data-open')).toBe(true);
  });
});

// jsdom does not navigate; keep it from trying.
const stop = (event: Event): void => {
  event.preventDefault();
};

describe('the trade link', () => {
  it('does not toggle the row on a click, and no request fires on expand or on the click', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const openSpy = vi.spyOn(globalThis, 'open').mockImplementation(() => null);
    const belt = rawEntry('Wide Belt');
    const view = mountList([belt], [priced(belt, 0.8, hoursBefore(NOW, 1), TEST_LEAGUE, SEARCH)]);
    click(rowsIn(view)[0]);
    const link = view.querySelector<HTMLAnchorElement>('[data-cell="trade-link"] a');
    document.addEventListener('click', stop);
    try {
      click(link);
    } finally {
      document.removeEventListener('click', stop);
    }
    expect(rowsIn(view)[0]?.hasAttribute('data-open')).toBe(true);
    expect(panelsIn(view)).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  // Matrix: league with spaces.
  it('encodes the league segment alone', () => {
    const belt = rawEntry('Wide Belt');
    const row = openOne(belt, priced(belt, 0.8, hoursBefore(NOW, 1), TEST_LEAGUE, { id: 'A/b+c', league: TEST_LEAGUE }));
    expect(cell(row, 'trade-link').querySelector('a')?.getAttribute('href')).toBe(
      'https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites/A/b+c',
    );
  });
});
