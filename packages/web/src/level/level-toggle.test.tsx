import { canonicalKey, compareByCodeUnit, type CraftedTrackedEntry } from '@poe/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  blocksOf,
  captureDownloads,
  clickOn,
  downloadAction,
  enterName,
  expectedFilterText,
  openFilterModal,
  ready,
} from '../App/pick-up-filter-support';
import { RECIPE_STORAGE_KEY } from '../recipe/recipe-storage';
import { cells, chase, click, frame, names, rowNamed, SUFFIX, TARGET, tier, type Pools } from '../recipe/craft-recipe/test-support';
import { MISSING_FIGURE } from '../list/row/ExpectedValueCell';
import { flush, rgb, unmount } from '../test-support/dom';
import { hover, leave } from '../test-support/hover';
import { hoursBefore, priced, rawEntry, unpriced } from '../test-support/list-fixtures';
import { colors } from '../theme/tokens';
import { LEVEL_STORAGE_KEY } from './level-storage';
import { LEVEL_LABEL } from './LevelToggle';

afterEach(() => {
  unmount();
  vi.restoreAllMocks();
  localStorage.clear();
});

const OTHER = 'explicit.stat_8';
const HIGH = 'explicit.stat_9';
/** HIGH's banded tier at 50 sits under the perfect floor beside its tier at 75, so perfect never reaches an entry on it. */
const POOLS: Pools = [
  [tier(TARGET, 10, 1), tier(OTHER, 10, 1), tier(HIGH, 10, 50, 'high'), { ...tier(HIGH, 10, 75, 'high'), lines: [{ statId: HIGH, ranges: [[11, 20]] }] }],
  [tier(SUFFIX, 10, 1)],
];

const atFloor = (entry: CraftedTrackedEntry, itemLevelMin: number): CraftedTrackedEntry => ({ ...entry, itemLevelMin });
const low = atFloor(chase('weapon.bow', 'Bows'), 75);
const top: CraftedTrackedEntry = { ...chase('weapon.bow', 'Bows'), prefix: { kind: 'banded', statId: OTHER, valueMin: 1, valueMax: 10 } };
const reach: CraftedTrackedEntry = { ...low, prefix: { kind: 'banded', statId: HIGH, valueMin: 1, valueMax: 10 } };
const staves = chase('weapon.staff', 'Staves');
/** Above 79, and perfect never reaches it: the floor reason wins. */
const both: CraftedTrackedEntry = { ...staves, prefix: { kind: 'banded', statId: HIGH, valueMin: 1, valueMax: 10 } };
const belt = rawEntry('Wide Belt');
const amulet = rawEntry('Gold Amulet');
const recurveBow = rawEntry('Recurve Bow', 82, { categoryId: 'weapon.bow', className: 'Bows' });

// perfect (0.30 / craft), a third of the prefix pool each. At 82: Bows ⅓·1 + ⅓·2 − 0.30 = 0.70, Staves ⅓·2 − 0.30 = 0.37.
// At 79 the floor-82 entries drop out: Bows ⅓·1 − 0.30 = 0.03, and nothing of Staves counts.
function levelWorld(): NonNullable<Parameters<typeof ready>[0]> {
  const now = Date.now();
  return {
    tracked: [low, top, reach, staves, both, belt, amulet, recurveBow],
    dataset: [
      priced(low, 1, hoursBefore(now, 1)),
      priced(top, 2, hoursBefore(now, 1)),
      priced(reach, 3, hoursBefore(now, 1)),
      priced(staves, 2, hoursBefore(now, 1)),
      priced(both, 1, hoursBefore(now, 1)),
      priced(belt, 0.4, hoursBefore(now, 1)),
      priced(amulet, 0.3, hoursBefore(now, 1)),
      priced(recurveBow, 0.3, hoursBefore(now, 1)),
    ],
    classes: [
      ['weapon.bow', 'Bows', POOLS],
      ['weapon.staff', 'Staves', POOLS],
    ],
  };
}

function segment(level: string): HTMLElement {
  const found = frame().querySelector<HTMLElement>(`[data-level-option="${level}"]`);
  if (found === null) {
    throw new Error(`no level segment ${level}`);
  }
  return found;
}

const activeWords = (): string[] => [...frame().querySelectorAll('[data-header-bar] [aria-current]')].map((node) => node.textContent);

function panelGroup(): HTMLElement | null {
  return frame().querySelector<HTMLElement>('[data-expansion-panel] [data-show-more="not-counted"]');
}

function notCountedLines(): HTMLElement[] {
  return [...frame().querySelectorAll<HTMLElement>('[data-expansion-panel] [data-not-counted]')];
}

function tooltipOf(row: HTMLElement): string | undefined {
  const mark = row.querySelector('[data-row-mark]');
  hover(mark);
  const text = document.body.querySelector('[data-mark-tooltip]')?.textContent;
  leave(mark);
  return text;
}

describe('the level toggle in the header (FR-38; Interaction 1b)', () => {
  // I/O matrix: "First visit".
  it('reads `ilvl` · `79` `82`, with `82` and `perfect` active on a first visit', async () => {
    await ready(levelWorld(), false);
    expect(frame().querySelector('[data-level-toggle] [data-level-label]')?.textContent).toBe(LEVEL_LABEL);
    expect(frame().querySelector('[data-level-options]')?.textContent).toBe('7982');
    expect(activeWords()).toEqual(['perfect', '82']);
    expect(segment('82').tagName).toBe('SPAN');
    expect(segment('79').tagName).toBe('BUTTON');
    expect(segment('82').className).toBe('fg-segment');
    expect(segment('82').style.fontWeight).toBe('600');
  });

  // I/O matrix: "Switch to 79".
  it('re-ranks synchronously on a click, with no request: ranks, EV, verdicts and chase cells change in one render', async () => {
    await ready(levelWorld(), false);
    expect(names()).toEqual(['Bows', 'Wide Belt', 'Staves', 'Gold Amulet', 'Recurve Bow']);
    expect(cells('ev')).toEqual(['0.70', '0.40', '0.37', '0.30', '0.30']);
    const chaseBefore = rowNamed('Bows').querySelector('[data-cell="chase"]')?.textContent;
    const fetches = vi.spyOn(globalThis, 'fetch');
    click(segment('79'));
    // No timer has run and nothing was awaited: the click is not debounced.
    expect(activeWords()).toEqual(['perfect', '79']);
    expect(names()).toEqual(['Wide Belt', 'Gold Amulet', 'Recurve Bow', 'Bows', 'Staves']);
    expect(cells('ev')).toEqual(['0.40', '0.30', '0.30', '0.03', MISSING_FIGURE]);
    expect(rowNamed('Bows').querySelector('[data-cell="chase"]')?.textContent).not.toBe(chaseBefore);
    expect(rowNamed('Staves').querySelector('[data-cell="rank"]')?.textContent).toBe('');
    expect(localStorage.getItem(LEVEL_STORAGE_KEY)).toBe('79');
    await flush();
    expect(fetches).not.toHaveBeenCalled();
  });

  // I/O matrix: "Reload".
  it('brings back a stored 79 and a stored recipe', async () => {
    localStorage.setItem(LEVEL_STORAGE_KEY, '79');
    await ready(levelWorld(), 'greater');
    expect(activeWords()).toEqual(['greater', '79']);
  });

  // I/O matrix: "Bad stored level".
  it.each(['80', 'junk'])('reads a stored %s as absent: 82', async (stored) => {
    localStorage.setItem(LEVEL_STORAGE_KEY, stored);
    await ready(levelWorld(), false);
    expect(activeWords()).toEqual(['perfect', '82']);
  });

  // I/O matrix: "Storage throws".
  it('works at the first-visit values when storage throws, and the toggle still switches', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await ready(levelWorld(), false);
    expect(activeWords()).toEqual(['perfect', '82']);
    click(segment('79'));
    expect(activeWords()).toEqual(['perfect', '79']);
    expect(names()[0]).toBe('Wide Belt');
  });
});

describe('the not-counted lines (state 49; Interaction 3a)', () => {
  // I/O matrix: "Floor above level" and "Unreached".
  it('puts each entry that does not count last, behind `+ N not counted`, dimmed, `—`, its reason alone, no mark and no link', async () => {
    await ready(levelWorld(), false);
    click(segment('79'));
    click(rowNamed('Bows'));
    expect(frame().querySelectorAll('[data-expansion-panel] [data-expansion-line]:not([data-not-counted])')).toHaveLength(1);
    expect(notCountedLines()).toHaveLength(0);
    const group = panelGroup();
    expect(group?.textContent).toBe('+ 2 not counted');
    if (group === null) {
      throw new Error('no not-counted group');
    }
    click(group);
    expect(panelGroup()?.textContent).toBe('− 2 not counted');
    const lines = notCountedLines();
    expect(lines.map((line) => line.querySelector('[data-cell="trust"]')?.textContent ?? '').toSorted(compareByCodeUnit)).toEqual([
      'needs ilvl 82',
      "perfect orbs can't roll this at ilvl 79",
    ]);
    for (const line of lines) {
      expect(line.querySelector('[data-cell="price"]')?.textContent).toBe(MISSING_FIGURE);
      expect(line.querySelector<HTMLElement>('[data-cell="combination"]')?.style.color).toBe(rgb(colors['text-tertiary']));
      expect(line.querySelector('[style*="line-through"], [data-line-mark], a')).toBeNull();
      expect(line.querySelector<HTMLElement>('[data-cell="trust"]')?.textContent).not.toBe('');
    }
    // They come last: after the counted line and the toggle.
    const order = [...frame().querySelectorAll<HTMLElement>('[data-expansion-panel] [data-expansion-line], [data-expansion-panel] [data-show-more]')];
    expect(order.at(-1)?.dataset['showMore']).toBe('not-counted');
    expect(order[0]?.hasAttribute('data-not-counted')).toBe(false);
  });

  // I/O matrix: "Nothing counts" (state 48).
  it('reads a class with nothing counted as a trailing pending row, `—`, `nothing rolls at ilvl 79`, its panel only `+ N not counted`', async () => {
    await ready(levelWorld(), false);
    click(segment('79'));
    const row = rowNamed('Staves');
    expect(row.querySelector<HTMLElement>('[data-row-mark]')?.dataset['rowMark']).toBe('pending');
    expect(tooltipOf(row)).toBe('pending · nothing rolls at ilvl 79');
    click(row);
    expect(frame().querySelectorAll('[data-expansion-panel] [data-expansion-line]')).toHaveLength(0);
    const group = panelGroup();
    expect(group?.textContent).toBe('+ 2 not counted');
    if (group === null) {
      throw new Error('no not-counted group');
    }
    click(group);
    // I/O matrix: "Both": `both` is above 79 and perfect never reaches it, and the floor reason shows.
    expect(notCountedLines().map((line) => line.querySelector('[data-cell="trust"]')?.textContent)).toEqual(['needs ilvl 82', 'needs ilvl 82']);
  });

  // I/O matrix: "Nothing counts, all broken": all-broken reads the counted entries only.
  it('reads `nothing rolls at ilvl 79`, not all-broken, when every Staves entry is broken and none counts', async () => {
    const world = levelWorld();
    const broken = new Set([canonicalKey(staves), canonicalKey(both)]);
    await ready(
      {
        ...world,
        dataset: [
          ...world.dataset.filter((entry) => !broken.has(entry.entryKey)),
          unpriced(staves, { state: 'unresolvable' }),
          unpriced(both, { state: 'unresolvable' }),
        ],
      },
      false,
    );
    expect(rowNamed('Staves').querySelector<HTMLElement>('[data-row-mark]')?.dataset['rowMark']).toBe('broken');
    click(segment('79'));
    const row = rowNamed('Staves');
    expect(row.querySelector<HTMLElement>('[data-row-mark]')?.dataset['rowMark']).toBe('pending');
    expect(tooltipOf(row)).toBe('pending · nothing rolls at ilvl 79');
  });

  // I/O matrix: "Switch to 79" keeps panels open; "Panel closes".
  it('keeps an open panel open across a switch, and collapses the group again when the panel closes', async () => {
    await ready(levelWorld(), false);
    click(rowNamed('Bows'));
    expect(panelGroup()?.textContent).toBe('+ 1 not counted');
    click(segment('79'));
    expect(rowNamed('Bows').dataset['open']).toBeDefined();
    expect(panelGroup()?.textContent).toBe('+ 2 not counted');
    const group = panelGroup();
    if (group === null) {
      throw new Error('no not-counted group');
    }
    click(group);
    expect(notCountedLines()).toHaveLength(2);
    click(rowNamed('Bows'));
    expect(frame().querySelector('[data-expansion-panel]')).toBeNull();
    click(rowNamed('Bows'));
    expect(panelGroup()?.textContent).toBe('+ 2 not counted');
    expect(notCountedLines()).toHaveLength(0);
  });
});

describe('the filter at the level on screen (Interaction 9)', () => {
  // I/O matrix: "Filter".
  it('downloads the filter generated from the 79 ranking, which differs from the 82 one', async () => {
    const capture = captureDownloads();
    await ready(levelWorld(), false);
    const at79 = await expectedFilterText(0.25, 'perfect', 'My.filter', 79);
    const at82 = await expectedFilterText(0.25, 'perfect', 'My.filter', 82);
    expect(at79).not.toBe(at82);
    expect(blocksOf(at82)).toContain('Recurve Bow: Rarity Normal, ItemLevel >= 82 → craft');
    expect(blocksOf(at79)).toContain('Recurve Bow: Rarity Normal, ItemLevel >= 82 → sell-raw');
    click(segment('79'));
    openFilterModal();
    enterName('My');
    clickOn(downloadAction());
    expect(await capture.downloads[0]?.text).toBe(at79);
    expect(localStorage.getItem(RECIPE_STORAGE_KEY)).toBeNull();
  });
});
