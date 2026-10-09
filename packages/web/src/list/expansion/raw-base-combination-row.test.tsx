import { afterEach, describe, expect, it } from 'vitest';

import { cellIn as cell, NOW, rgb, unmount } from '../../test-support/dom';
import { hoursBefore, priced, rawEntry, unpriced } from '../../test-support/list-fixtures';
import { colors, glyphs } from '../../theme/tokens';
import { HREF, line1, line2, openOne, SEARCH } from './test-support';

afterEach(unmount);

describe('the Raw Base combination row', () => {
  // Matrix: priced raw.
  it('prints a priced raw entry: ● priced, 0.80, 10 listings, the raw note, both ages and ↗', () => {
    const belt = rawEntry('Wide Belt', 82);
    const row = openOne(belt, {
      ...priced(belt, 0.8, hoursBefore(NOW, 11), { search: SEARCH }),
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
    expect(phrase?.style.color).toBe(rgb(colors.text));
    // The link test reads the stored search, never the Price State.
    expect(cell(row, 'trade-link').querySelector('a')?.getAttribute('href')).toBe(HREF);
  });

  // Matrix: expansion of an unresolvable Raw Base (EXPERIENCE state 4).
  it('prints unresolvable: × unresolvable, not valued in trust-broken, no sample, the raw state-4 note, tried only', () => {
    const ring = rawEntry('Lost Ring');
    const row = openOne(ring, unpriced(ring, { state: 'unresolvable' }, hoursBefore(NOW, 5), SEARCH));
    expect(line1(row)).toEqual(['no affixes', `${glyphs.unresolvable}\u{A0}unresolvable`, 'not valued', 'no sample']);
    expect(line2(row)).toEqual(['its id is gone from the trade API — a patch did this', '', 'tried 5h ago']);
    const phrase = cell(row, 'figure').querySelector<HTMLElement>('[data-money-phrase]');
    expect(phrase?.style.fontStyle).toBe('italic');
    expect(phrase?.style.color).toBe(rgb(colors['trust-broken']));
    expect(row.dataset['priceState']).toBe('unresolvable');
    expect(cell(row, 'state').querySelector<HTMLElement>('[data-state-glyph]')?.style.color).toBe(rgb(colors['trust-broken']));
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
    const row = openOne(amulet, priced(amulet, 3, hoursBefore(NOW, 50), { league: 'Standard', search: { id: 'old', league: 'Standard' } }));
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
  it('leads line one with * pinned on a pinned entry, in text-tertiary at 600, roman', () => {
    const belt = { ...rawEntry('Wide Belt'), status: 'pinned' as const };
    const row = openOne(belt, priced(belt, 0.8, hoursBefore(NOW, 1)));
    expect(cell(row, 'combination').textContent).toBe('* pinned no affixes');
    const mark = cell(row, 'combination').querySelector<HTMLElement>('[data-curation-pinned]');
    expect(cell(row, 'combination').firstElementChild).toBe(mark);
    expect(mark?.style.fontWeight).toBe('600');
    expect(mark?.style.fontStyle).toBe('normal');
    expect(mark?.style.color).toBe(rgb(colors['text-tertiary']));
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
