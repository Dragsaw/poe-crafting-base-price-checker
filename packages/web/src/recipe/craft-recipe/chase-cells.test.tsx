import { compareByCodeUnit } from '@poe/contracts';
import type { CraftedTrackedEntry } from '@poe/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { BELOW_THRESHOLD_NOTE } from '../../list/format';
import { SHORT_FORMS } from '../../list/short-forms';
import { rgb, settleTo, unmount } from '../../test-support/dom';
import { banded, hoursBefore, priced, rawEntry } from '../../test-support/list-fixtures';
import { pastDebounce, typeInto } from '../../test-support/threshold-input';
import { colors, stacks } from '../../theme/tokens';
import {
  mount,
  frame,
  tier,
  hybridTier,
  TARGET,
  SUFFIX,
  RATES,
  belt,
  serveWorld,
  standardWorld,
  option,
  cells,
  click,
  rowNamed,
  COLD_RES,
  atkCold,
  mana,
  ringsWorld,
  chaseCells,
  chaseTexts,
  panelRows,
  panelCell,
} from './test-support';

afterEach(() => {
  unmount();
  localStorage.clear();
});

describe('the chase cells', () => {
  it('prints the first three summands as three fixed 164px cells, tier plus short form, in chase emphasis on tier 1', async () => {
    serveWorld(ringsWorld());
    mount();
    await settleTo('ready');
    const row = rowNamed('Rings');
    expect(chaseTexts(row)).toEqual(['T1 Atk Dmg · T1 Cold Res', 'T1 Mana · T1 Cold Res', 'T1 Life · T1 Cold Res']);
    const column = row.querySelector<HTMLElement>('[data-cell="chase"]');
    expect(column?.style.width).toBe('492px');
    expect(column?.style.paddingRight).toBe('');
    for (const cell of chaseCells(row)) {
      expect(cell.style.width).toBe('164px');
      expect(cell.style.flex).toBe('0 0 164px');
      expect(cell.style.paddingRight).toBe('10px');
      expect(cell.style.whiteSpace).toBe('nowrap');
      expect(cell.style.textOverflow).toBe('ellipsis');
      expect(cell.style.overflow).toBe('hidden');
      expect(cell.style.color).toBe(rgb(colors['ink-chase-emphasis']));
      // A curated cell prints no numeral but its tier.
      expect(cell.textContent.replaceAll(/T\d+/g, '')).not.toMatch(/\d/);
      expect(cell.querySelector('[data-verbatim]')).toBeNull();
    }
  });

  it('holds the longest hybrid label the short-form table can build in the chase cell, ellipsised, and in the panel row, whole', async () => {
    // T1-T2 and the three longest distinct forms: the widest label a hybrid affix can print.
    const forms = [...new Set(Object.values(SHORT_FORMS))].toSorted((a, b) => b.length - a.length || (a < b ? -1 : 1)).slice(0, 3);
    const statIds = forms.map((form) => {
      const found = Object.entries(SHORT_FORMS).find(([, value]) => value === form);
      if (found === undefined) {
        throw new Error(`no statId for ${form}`);
      }
      return found[0];
    });
    const label = `T1-T2 ${forms.toSorted((a, b) => Number(a > b) - Number(a < b)).join(', ')}`;
    const widest: CraftedTrackedEntry = {
      kind: 'crafted',
      categoryId: 'accessory.ring',
      className: 'Rings',
      itemLevelMin: 82,
      prefix: {
        kind: 'hybrid',
        acceptedTier: 'T1-T2',
        lines: statIds.toSorted(compareByCodeUnit).map((statId) => ({ statId, valueMin: 1, valueMax: 10 })),
      },
      suffix: banded(COLD_RES, 1, 10, 'T1'),
      status: 'active',
    };
    const now = Date.now();
    serveWorld({
      tracked: [widest],
      dataset: [priced(widest, 100, hoursBefore(now, 1))],
      classes: [['accessory.ring', 'Rings', [[hybridTier(statIds, 10, 75)], [tier(COLD_RES, 10, 80)]]]],
    });
    mount();
    await settleTo('ready');
    const [cell] = chaseCells(rowNamed('Rings'));
    expect(cell?.textContent).toBe(`${label} · T1 Cold Res`);
    expect(cell?.style.whiteSpace).toBe('nowrap');
    expect(cell?.style.overflow).toBe('hidden');
    expect(cell?.style.textOverflow).toBe('ellipsis');
    expect(cell?.querySelector('[data-verbatim]')).toBeNull();
    click(rowNamed('Rings'));
    const [panel] = panelRows();
    expect(panel === undefined ? '' : panelCell(panel, 'combination')).toBe(`${label} · T1 Cold Res`);
    for (const node of frame().querySelectorAll<HTMLElement>('[data-expansion-panel] *')) {
      expect(node.style.textOverflow).toBe('');
    }
  });

  it('keeps the raw rows’ italic note in place of chase cells, and leaves unused slots empty', async () => {
    const now = Date.now();
    serveWorld(
      ringsWorld({
        tracked: [atkCold, belt],
        dataset: [priced(atkCold, 1000, hoursBefore(now, 1)), priced(belt, 0.4, hoursBefore(now, 1))],
      }),
    );
    mount();
    await settleTo('ready');
    const raw = rowNamed('Wide Belt');
    expect(raw.querySelector('[data-raw-note]')).not.toBeNull();
    expect(chaseCells(raw)).toHaveLength(0);
    expect(chaseTexts(rowNamed('Rings'))).toEqual(['T1 Atk Dmg · T1 Cold Res', '', '']);
  });

  it('takes ink-secondary below tier 1', async () => {
    const now = Date.now();
    const raws = Array.from({ length: 5 }, (_, index) => rawEntry(`Base ${String(index)}`));
    serveWorld(
      ringsWorld({
        tracked: [...raws, mana],
        dataset: [...raws.map((entry) => priced(entry, 5000, hoursBefore(now, 1))), priced(mana, 100, hoursBefore(now, 1))],
      }),
    );
    mount();
    await settleTo('ready');
    const row = rowNamed('Rings');
    expect(row.dataset['tier']).toBe('2');
    for (const cell of chaseCells(row)) {
      expect(cell.style.color).toBe(rgb(colors['ink-secondary']));
    }
  });

  it('state 21: no summand leaves three empty cells, the EV at minus its Craft Cost, numerals printed', async () => {
    serveWorld(ringsWorld({ tracked: [mana], dataset: [priced(mana, 0.1, hoursBefore(Date.now(), 1))] }));
    mount();
    await settleTo('ready');
    expect(chaseTexts(rowNamed('Rings'))).toEqual(['', '', '']);
    expect(cells('ev')).toEqual(['-0.03']);
    expect(cells('rank')).toEqual(['1']);
  });

  it('falls back to the raw statId plus the band, in mono, for a stat with no short form and no catalogue text', async () => {
    serveWorld(standardWorld());
    mount();
    await settleTo('ready');
    const [first] = chaseCells(rowNamed('Bows'));
    expect(first?.textContent).toBe(`${TARGET} 1–10 · ${SUFFIX} 1–10`);
    const verbatim = first?.querySelector<HTMLElement>('[data-verbatim]');
    expect(verbatim?.style.fontFamily).toBe(stacks.mono);
    // No ink, mark or glyph of its own, and the line's own size and weight.
    expect(verbatim?.style.color).toBe('');
    expect(verbatim?.style.fontSize).toBe('');
    expect(verbatim?.style.fontWeight).toBe('');
  });

  it('falls back to the catalogue stat text with the band in place of its #', async () => {
    serveWorld(standardWorld({ stats: [{ id: TARGET, text: '#% increased Target' }] }));
    mount();
    await settleTo('ready');
    expect(chaseTexts(rowNamed('Bows'))).toEqual([`1–10% increased Target · ${SUFFIX} 1–10`, '', '']);
  });

  it('rewrites the cells and the open panel in the same pass on a recipe switch, and after a raised threshold', async () => {
    serveWorld(ringsWorld());
    mount();
    await settleTo('ready');
    click(rowNamed('Rings'));
    const notes = (): string[] => panelRows().map((row) => panelCell(row, 'note'));
    expect(notes()).toEqual(['', '', '', '', '']);
    click(option('perfect'));
    // Life is mostly out of reach under perfect: its P is small, so it sorts last of the summands.
    expect(chaseTexts(rowNamed('Rings'))).toEqual(['T1 Atk Dmg · T1 Cold Res', 'T1 Mana · T1 Cold Res', 'T1 ES · T1 Cold Res']);
    expect(panelRows().map((row) => panelCell(row, 'combination'))).toEqual([
      '* pinned T1 Atk Dmg · T1 Cold Res',
      'T1 Mana · T1 Cold Res',
      'T1 ES · T1 Cold Res',
      'T1 Rarity · T1 Cold Res',
      'T1 Life · T1 Cold Res',
    ]);
    click(option('greater'));
    const field = frame().querySelector<HTMLInputElement>('[data-payout-threshold] input');
    if (field === null) {
      throw new Error('no threshold input');
    }
    typeInto(field, '2');
    await pastDebounce();
    expect(chaseTexts(rowNamed('Rings'))).toEqual(['T1 Atk Dmg · T1 Cold Res', 'T1 Mana · T1 Cold Res', '']);
    expect(notes()).toEqual(['', '', BELOW_THRESHOLD_NOTE, BELOW_THRESHOLD_NOTE, BELOW_THRESHOLD_NOTE]);
  });

  it('state 35: an uncostable recipe still prints the cells, because the threshold reads the gross price', async () => {
    serveWorld(ringsWorld({ rates: RATES.slice(0, 2) }));
    mount();
    await settleTo('ready');
    click(option('perfect'));
    const row = rowNamed('Rings');
    expect(row.querySelector('[data-cell="ev"]')?.textContent).toBe('no figure yet');
    expect(chaseTexts(row)).toEqual(['T1 Atk Dmg · T1 Cold Res', 'T1 Mana · T1 Cold Res', 'T1 ES · T1 Cold Res']);
  });
});
