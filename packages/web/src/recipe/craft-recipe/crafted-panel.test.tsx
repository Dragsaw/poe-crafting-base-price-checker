import { afterEach, describe, expect, it } from 'vitest';

import { BELOW_THRESHOLD_NOTE, CURATION_MARKS } from '../../list/format';
import { MISSING_FIGURE } from '../../list/row/ExpectedValueCell';
import { FIXED_ROW_REASONS, NO_LISTINGS_LINE, TRUST_JOINER, VERDICT_WORDS } from '../../list/row/trust-words';
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
  it('lists core’s order with each line’s price and trust, and the pruned entry behind + 1 pruned', async () => {
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
    // Core's order: the summand, then below-threshold, then pending, then broken (FR-8).
    expect(rows.map((row) => panelCell(row, 'combination'))).toEqual([
      `${CURATION_MARKS.pinned} T1 Atk Dmg · T1 Cold Res`,
      'T1 Mana · T1 Cold Res',
      'T1 Life · T1 Cold Res',
      'T1 ES · T1 Cold Res',
    ]);
    expect(rows.map((row) => panelCell(row, 'price'))).toEqual(['1000.00', '0.10', MISSING_FIGURE, MISSING_FIGURE]);
    expect(rows.map((row) => panelCell(row, 'trust'))).toEqual([
      '',
      BELOW_THRESHOLD_NOTE,
      [VERDICT_WORDS.pending, `tried 4 hours ago${TRUST_JOINER}${NO_LISTINGS_LINE}`].join(TRUST_JOINER),
      [VERDICT_WORDS.broken, FIXED_ROW_REASONS.unresolvable].join(TRUST_JOINER),
    ]);
    // State 20: dimmed, with no mark.
    const below = rows[1];
    expect(below?.hasAttribute('data-below-threshold')).toBe(true);
    expect(below?.querySelector<HTMLElement>('[data-cell="combination"]')?.style.color).toBe(rgb(colors['text-tertiary']));
    expect(below?.querySelector('[data-cell="trust"] svg')).toBeNull();
    expect(rows[3]?.querySelector('[data-cell="trust"] svg[data-mark="broken"]')).not.toBeNull();
    // The trade link follows the raw path: only the summand carries a stored search.
    const links = rows.map((row) => row.querySelector('[data-cell="trade-link"] a')?.getAttribute('href') ?? undefined);
    expect(links).toEqual(['https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites/AbC123', undefined, undefined, undefined]);
    expect(rows[0]?.querySelector('[data-cell="trade-link"] a')?.getAttribute('aria-label')).toBe(
      'Open the trade search for T1 Atk Dmg · T1 Cold Res on Rings',
    );
    // FR-15: the pruned entry sits behind `+ 1 pruned`, with its reason and no link.
    expect(frame().querySelector('[data-pruned-line]')).toBeNull();
    click(frame().querySelector<HTMLElement>('[data-show-more="pruned"]') ?? frame());
    const prunedLine = frame().querySelector<HTMLElement>('[data-pruned-line]');
    expect(prunedLine?.querySelector('[data-cell="combination"]')?.textContent).toBe(
      `${CURATION_MARKS.pruned} T1 Rarity · T1 Cold Res`,
    );
    expect(prunedLine?.querySelector('[data-prune-reason]')?.textContent).toBe('never sells');
    expect(prunedLine?.querySelector('a')).toBeNull();
    expect(chaseTexts(rowNamed('Rings'))).toEqual(['T1 Atk Dmg · T1 Cold Res', '', '']);
  });

  it('prints never-synced and league-mismatch entries with their own reasons', async () => {
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
      `${CURATION_MARKS.pinned} T1 Atk Dmg · T1 Cold Res`,
      'T1 Mana · T1 Cold Res',
      'T1 Life · T1 Cold Res',
    ]);
    // FR-9: the three not-yet-synced causes keep distinct words, and no age prints.
    expect(rows.map((row) => panelCell(row, 'trust'))).toEqual([
      '',
      [VERDICT_WORDS.pending, FIXED_ROW_REASONS['league-mismatch']].join(TRUST_JOINER),
      [VERDICT_WORDS.pending, FIXED_ROW_REASONS['never-synced']].join(TRUST_JOINER),
    ]);
  });
});
