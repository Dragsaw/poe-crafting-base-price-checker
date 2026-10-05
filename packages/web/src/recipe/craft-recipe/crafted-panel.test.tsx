import { afterEach, describe, expect, it } from 'vitest';

import { BELOW_THRESHOLD_NOTE, STATE_NOTES } from '../../list/format';
import { rgb, settleTo, unmount } from '../../test-support/dom';
import { hoursBefore, priced, unpriced } from '../../test-support/list-fixtures';
import { colors } from '../../theme/tokens';
import {
  mount,
  frame,
  serveWorld,
  click,
  rowNamed,
  RARITY,
  ring,
  atkCold,
  mana,
  life,
  es,
  SEARCH,
  ringsWorld,
  chaseTexts,
  panelRows,
  panelCell,
} from './test-support';

afterEach(() => {
  unmount();
  localStorage.clear();
});

describe('the crafted panel', () => {
  it('lists the summand, then the rest by canonical key, with their notes; the pruned entry has no row', async () => {
    const now = Date.now();
    const pruned = ring(RARITY, 'pruned');
    serveWorld(
      ringsWorld({
        tracked: [atkCold, life, es, mana, pruned],
        dataset: [
          priced(atkCold, 1000, hoursBefore(now, 2), { search: SEARCH }),
          priced(mana, 0.1, hoursBefore(now, 3)),
          unpriced(life, { state: 'no-listings' }, hoursBefore(now, 4)),
          unpriced(es, { state: 'unresolvable' }, hoursBefore(now, 5)),
          priced(pruned, 50, hoursBefore(now, 1)),
        ],
      }),
    );
    mount();
    await settleTo('ready');
    click(rowNamed('Rings'));
    const rows = panelRows();
    expect(rows.map((row) => panelCell(row, 'combination'))).toEqual([
      '* pinned T1 Atk Dmg · T1 Cold Res',
      'T1 Mana · T1 Cold Res',
      'T1 Life · T1 Cold Res',
      'T1 ES · T1 Cold Res',
    ]);
    expect(rows.map((row) => panelCell(row, 'note'))).toEqual([
      '',
      BELOW_THRESHOLD_NOTE,
      STATE_NOTES['no-listings'],
      STATE_NOTES.unresolvable,
    ]);
    expect(rows.map((row) => row.dataset['priceState'])).toEqual(['priced', 'priced', 'no-listings', 'unresolvable']);
    expect(rows.map((row) => panelCell(row, 'figure'))).toEqual(['1000.00', '0.10', 'an open question', 'not valued']);
    expect(rows.map((row) => panelCell(row, 'sample'))).toEqual(['10 listings', '10 listings', '0 listings found', 'no sample']);
    expect(rows.map((row) => panelCell(row, 'observed'))).toEqual(['priced 2h ago', 'priced 3h ago', '', '']);
    expect(rows.map((row) => panelCell(row, 'attempted'))).toEqual([
      'tried 2h ago',
      'tried 3h ago',
      'tried 4h ago',
      'tried 5h ago',
    ]);
    // State 4: the rust glyph and the rust money phrase.
    const unresolvable = rows[3];
    expect(unresolvable?.querySelector<HTMLElement>('[data-state-glyph]')?.style.color).toBe(rgb(colors.rust));
    expect(unresolvable?.querySelector<HTMLElement>('[data-money-phrase]')?.style.color).toBe(rgb(colors.rust));
    // The trade link follows the raw path: only the summand carries a stored search.
    const links = rows.map((row) => row.querySelector('[data-cell="trade-link"] a')?.getAttribute('href') ?? undefined);
    expect(links).toEqual(['https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites/AbC123', undefined, undefined, undefined]);
    expect(rows[0]?.querySelector('[data-cell="trade-link"] a')?.getAttribute('aria-label')).toBe(
      'Open the trade search for T1 Atk Dmg · T1 Cold Res on Rings',
    );
    // Nothing in the expansion is ellipsised.
    for (const node of frame().querySelectorAll<HTMLElement>('[data-expansion-panel] *')) {
      expect(node.style.textOverflow).toBe('');
    }
    expect(chaseTexts(rowNamed('Rings'))).toEqual(['T1 Atk Dmg · T1 Cold Res', '', '']);
  });

  it('prints never-synced and league-mismatch entries with their reasons and notes', async () => {
    const now = Date.now();
    serveWorld(
      ringsWorld({
        tracked: [atkCold, mana, life],
        dataset: [priced(atkCold, 1000, hoursBefore(now, 1)), priced(mana, 9, hoursBefore(now, 1), { league: 'Standard' })],
      }),
    );
    mount();
    await settleTo('ready');
    click(rowNamed('Rings'));
    const rows = panelRows();
    expect(rows.map((row) => panelCell(row, 'combination'))).toEqual([
      '* pinned T1 Atk Dmg · T1 Cold Res',
      'T1 Mana · T1 Cold Res',
      'T1 Life · T1 Cold Res',
    ]);
    expect(rows.map((row) => row.querySelector('[data-state-word]')?.textContent)).toEqual([
      'priced',
      'not-yet-synced · league-mismatch',
      'not-yet-synced · never-synced',
    ]);
    expect(rows.map((row) => panelCell(row, 'note'))).toEqual(['', STATE_NOTES['league-mismatch'], STATE_NOTES['never-synced']]);
  });
});
