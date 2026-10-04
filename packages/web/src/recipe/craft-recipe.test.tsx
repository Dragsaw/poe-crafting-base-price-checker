import { compareByCodeUnit } from '@poe/contracts';
import type { CraftedTrackedEntry, CraftRecipe, CurrencyRate, DatasetEntry, ModifierWeight, TrackedEntry } from '@poe/contracts';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../App';
import { BELOW_THRESHOLD_NOTE, STATE_NOTES } from '../list/format';
import { uncostableCopy } from '../list/list-statement';
import { expandCopy } from '../list/RankedList';
import { SHORT_FORMS } from '../list/short-forms';
import { HAIR_SPACE } from '../list/TrustMark';
import { serveArtifacts, sharedServer, TEST_LEAGUE, VALID_BODIES } from '../test-support/artifact-server';
import { mount as mountNode, mountedContainer, rgb, settleTo, unmount } from '../test-support/dom';
import { banded, hoursBefore, priced, rawEntry, unpriced } from '../test-support/list-fixtures';
import { pastDebounce, typeInto } from '../test-support/threshold-input';
import { PageProvider } from '../theme/PageProvider';
import { colors, glyphs, stacks } from '../theme/tokens';
import { RECIPE_STORAGE_KEY } from './recipe-storage';

const server = await sharedServer();

afterEach(() => {
  unmount();
  localStorage.clear();
});

function mount(): void {
  mountNode(
    <PageProvider>
      <App />
    </PageProvider>,
  );
}

function frame(): HTMLElement {
  const found = mountedContainer()?.querySelector<HTMLElement>('[data-frame]');
  if (found === null || found === undefined) {
    throw new Error('no frame rendered');
  }
  return found;
}

// --- the fixture world --------------------------------------------------------

const nextSerial = ((): (() => number) => {
  let serial = 0;
  return () => {
    serial += 1;
    return serial;
  };
})();

function tier(statId: string, weight: number, itemLevelMin: number): ModifierWeight {
  const serial = nextSerial();
  return {
    sourceModifierId: `m${String(serial)}`,
    modGroup: `g${String(serial)}`,
    itemLevelMin,
    weight,
    weightSource: 'published',
    lines: [{ statId, ranges: [[1, 10]] }],
  };
}

/** One hybrid pool tier: one modifier carrying a line for each `statId`. */
function hybridTier(statIds: readonly string[], weight: number, itemLevelMin: number): ModifierWeight {
  const serial = nextSerial();
  return {
    sourceModifierId: `m${String(serial)}`,
    modGroup: `g${String(serial)}`,
    itemLevelMin,
    weight,
    weightSource: 'published',
    lines: statIds.map((statId) => ({ statId, ranges: [[1, 10]] })),
  };
}

const TARGET = 'explicit.stat_1';
const FILLER = 'explicit.stat_2';
const LOW = 'explicit.stat_3';
const SUFFIX = 'explicit.stat_4';

type Pools = readonly [readonly ModifierWeight[], readonly ModifierWeight[]];

/** At floor 44 the target is half the prefix pool; at floor 70 it is all of it. */
const BOWS: Pools = [[tier(TARGET, 10, 75), tier(FILLER, 10, 50), tier(LOW, 80, 1)], [tier(SUFFIX, 10, 80)]];
/**
 * At floor 44 the target is half the prefix pool; at floor 70 only its small
 * tier is in reach, a quarter of the pool. (A target with no tier in reach is
 * a reason, not P = 0: IMPLEMENTATION-NOTES.md §9.)
 */
const STAVES: Pools = [[tier(TARGET, 50, 50), tier(TARGET, 25, 75), tier(FILLER, 75, 75)], [tier(SUFFIX, 10, 80)]];
/** Every tier below both floors: no recipe reaches it (state 36). */
const WANDS: Pools = [[tier(TARGET, 10, 1)], [tier(SUFFIX, 10, 1)]];

function chase(categoryId: string, className: string): CraftedTrackedEntry {
  return {
    kind: 'crafted',
    categoryId,
    className,
    itemLevelMin: 82,
    prefix: { kind: 'banded', statId: TARGET, valueMin: 1, valueMax: 10 },
    // Contains the whole suffix pool, so P is the prefix's share.
    suffix: { kind: 'banded', statId: SUFFIX, valueMin: 1, valueMax: 10 },
    status: 'active',
  };
}

function recipe(id: string, modifierLevelMin: number, grade: string): CraftRecipe {
  return {
    id,
    currencies: [
      { currencyId: `${grade}-orb-of-transmutation`, quantity: 1 },
      { currencyId: `${grade}-orb-of-augmentation`, quantity: 1 },
    ],
    modifierLevelMin,
  };
}

function rate(currencyId: string, value: number): CurrencyRate {
  return { currencyId, rate: value, source: 'measured', league: TEST_LEAGUE, asOf: '2026-09-26T00:00:00Z' };
}

const RECIPES = [recipe('greater', 44, 'greater'), recipe('perfect', 70, 'perfect')];
const RATES = [
  rate('greater-orb-of-transmutation', 0.01),
  rate('greater-orb-of-augmentation', 0.02),
  rate('perfect-orb-of-transmutation', 0.1),
  rate('perfect-orb-of-augmentation', 0.2),
];

const bows = chase('weapon.bow', 'Bows');
const staves = chase('weapon.staff', 'Staves');
const belt = rawEntry('Wide Belt');
const amulet = rawEntry('Gold Amulet');

interface World {
  readonly tracked: readonly TrackedEntry[];
  readonly dataset: readonly DatasetEntry[];
  readonly classes: readonly (readonly [string, string, Pools])[];
  readonly recipes?: readonly unknown[];
  readonly rates?: readonly CurrencyRate[];
  /** The catalogue's stat texts, one explicit group. Absent: the empty catalogue. */
  readonly stats?: readonly { readonly id: string; readonly text: string }[];
}

function serveWorld(world: World): void {
  const bases: Record<string, Record<string, unknown>> = {};
  for (const [categoryId, className, [prefix, suffix]] of world.classes) {
    bases[categoryId] = {
      ...bases[categoryId],
      [className]: {
        prefix: { poolCoverage: 'complete', entries: prefix },
        suffix: { poolCoverage: 'complete', entries: suffix },
      },
    };
  }
  serveArtifacts(server, {
    tracked: { kind: 'json', body: { ...(VALID_BODIES.tracked as object), entries: world.tracked } },
    dataset: {
      kind: 'json',
      body: { ...(VALID_BODIES.dataset as object), entries: world.dataset, currencyRates: world.rates ?? RATES },
    },
    weights: { kind: 'json', body: { ...(VALID_BODIES.weights as object), bases } },
    recipes: { kind: 'json', body: { schemaVersion: '1.0.0', recipes: world.recipes ?? RECIPES } },
    catalogueStats: {
      kind: 'json',
      body: { schemaVersion: '1.0.0', result: [{ id: 'explicit', label: 'Explicit', entries: world.stats ?? [] }] },
    },
  });
}

/**
 * greater: Staves 0.5 × 2 − 0.03 = 0.97, Bows 0.5 × 1 − 0.03 = 0.47, Wide Belt 0.40, Gold Amulet 0.30.
 * perfect: Bows 1 × 1 − 0.3 = 0.70, Wide Belt 0.40, Gold Amulet 0.30, Staves 0.25 × 2 − 0.3 = 0.20.
 */
function standardWorld(overrides: Partial<World> = {}): World {
  const now = Date.now();
  return {
    tracked: [bows, staves, belt, amulet],
    dataset: [
      priced(bows, 1, hoursBefore(now, 1)),
      priced(staves, 2, hoursBefore(now, 1)),
      priced(belt, 0.4, hoursBefore(now, 1)),
      priced(amulet, 0.3, hoursBefore(now, 1)),
    ],
    classes: [
      ['weapon.bow', 'Bows', BOWS],
      ['weapon.staff', 'Staves', STAVES],
    ],
    ...overrides,
  };
}

// --- readers ---------------------------------------------------------------------

function control(): HTMLElement {
  const found = frame().querySelector<HTMLElement>('[data-craft-recipe]');
  if (found === null) {
    throw new Error('no Craft Recipe control rendered');
  }
  return found;
}

function option(id: string): HTMLElement {
  const found = control().querySelector<HTMLElement>(`[data-recipe-option="${id}"]`);
  if (found === null) {
    throw new Error(`no option ${id}`);
  }
  return found;
}

function costLine(): string {
  return control().querySelector('[data-recipe-cost]')?.textContent ?? '';
}

function names(scope: ParentNode = frame()): string[] {
  return Array.from(scope.querySelectorAll('[data-ranked-row] [data-unit-name]'), (node) => node.textContent ?? '');
}

function cells(cell: string, scope: ParentNode = frame()): string[] {
  return Array.from(scope.querySelectorAll(`[data-ranked-row] [data-cell="${cell}"]`), (node) => node.textContent ?? '');
}

function statement(): HTMLElement | null {
  return frame().querySelector<HTMLElement>('[data-list-statement]');
}

function click(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function rowNamed(name: string): HTMLElement {
  const row = [...frame().querySelectorAll<HTMLElement>('[data-ranked-row]')].find(
    (candidate) => candidate.querySelector('[data-unit-name]')?.textContent === name,
  );
  if (row === undefined) {
    throw new Error(`no row ${name}`);
  }
  return row;
}

// --- the tests ---------------------------------------------------------------------

describe('the Craft Recipe control', () => {
  it('prints one word per recipe, divided by the pipe, the first recipe active, and the Craft Cost once', async () => {
    serveWorld(standardWorld());
    mount();
    await settleTo('ready');
    expect(control().closest('[data-recipe-slot]')).not.toBeNull();
    expect(control().querySelector('[data-recipe-label]')?.textContent).toBe('Craft Recipe');
    expect(control().querySelector('[data-recipe-options]')?.textContent).toBe('greater|perfect');
    const separator = control().querySelector<HTMLElement>('[data-separator]');
    expect(separator?.textContent).toBe('|');
    expect(separator?.style.color).toBe(rgb(colors['ink-tertiary']));
    // The active word is not a target; the inactive one is the only button.
    expect(option('greater').tagName).toBe('SPAN');
    expect(option('greater').getAttribute('aria-current')).toBe('true');
    expect(option('perfect').tagName).toBe('BUTTON');
    expect(control().querySelectorAll('button')).toHaveLength(1);
    // No form control of any kind.
    expect(control().querySelectorAll('input, select, [role="radio"], [role="switch"]')).toHaveLength(0);
    expect(costLine()).toBe('0.03Divine / craft');
    expect(control().querySelector('[data-recipe-cost-figure]')?.textContent).toBe('0.03');
    // Craft Cost prints nowhere else.
    expect(frame().textContent.split('/ craft')).toHaveLength(2);
    expect(control().style.width).toBe('216px');
  });

  it('ranks crafted rows with the class glyph, the Item Class name and the EV, beside raw rows', async () => {
    serveWorld(standardWorld());
    mount();
    await settleTo('ready');
    expect(names()).toEqual(['Staves', 'Bows', 'Wide Belt', 'Gold Amulet']);
    expect(cells('ev')).toEqual(['0.97', '0.47', '0.40', '0.30']);
    expect(cells('rank')).toEqual(['1', '2', '3', '4']);
    const glyph = rowNamed('Bows').querySelector<HTMLElement>('[data-unit-glyph]');
    expect(glyph?.dataset['unitGlyph']).toBe('class');
    expect(rowNamed('Bows').dataset['raw']).toBeUndefined();
    expect(statement()).toBeNull();
  });

  it('a click re-ranks in the same pass, raw rows keep their relative order, and the choice survives a reload', async () => {
    serveWorld(standardWorld());
    mount();
    await settleTo('ready');
    click(option('perfect'));
    // No timer has run: the click is not debounced.
    expect(option('perfect').tagName).toBe('SPAN');
    expect(option('greater').tagName).toBe('BUTTON');
    expect(names()).toEqual(['Bows', 'Wide Belt', 'Gold Amulet', 'Staves']);
    expect(cells('ev')).toEqual(['0.70', '0.40', '0.30', '0.20']);
    expect(costLine()).toBe('0.30Divine / craft');
    expect(localStorage.getItem(RECIPE_STORAGE_KEY)).toBe('perfect');
    unmount();
    serveWorld(standardWorld());
    mount();
    await settleTo('ready');
    expect(option('perfect').getAttribute('aria-current')).toBe('true');
    expect(names()).toEqual(['Bows', 'Wide Belt', 'Gold Amulet', 'Staves']);
  });

  it('a click on the active word does nothing', async () => {
    serveWorld(standardWorld());
    mount();
    await settleTo('ready');
    click(option('greater'));
    expect(localStorage.getItem(RECIPE_STORAGE_KEY)).toBeNull();
    expect(names()).toEqual(['Staves', 'Bows', 'Wide Belt', 'Gold Amulet']);
  });

  it('falls back to the first recipe in file order when the stored id is unknown', async () => {
    localStorage.setItem(RECIPE_STORAGE_KEY, 'vanished');
    serveWorld(standardWorld());
    mount();
    await settleTo('ready');
    expect(option('greater').getAttribute('aria-current')).toBe('true');
    expect(names()[0]).toBe('Staves');
  });

  it('keeps an open panel open across a switch, and its sub-line names the new recipe', async () => {
    serveWorld(standardWorld());
    mount();
    await settleTo('ready');
    click(rowNamed('Bows'));
    const sub = (): string => frame().querySelector('[data-expansion-panel] [data-panel-sub]')?.textContent ?? '';
    expect(sub()).toContain('Craft Recipe greater');
    click(option('perfect'));
    expect(frame().querySelectorAll('[data-expansion-panel]')).toHaveLength(1);
    expect(rowNamed('Bows').dataset['open']).toBeDefined();
    expect(sub()).toContain('Craft Recipe perfect');
  });

  it('keeps the slot empty, at its width, when recipes.json holds no recipe', async () => {
    serveWorld(standardWorld({ recipes: [] }));
    mount();
    await settleTo('ready');
    const slot = frame().querySelector<HTMLElement>('[data-recipe-slot]');
    expect(slot?.children).toHaveLength(0);
    expect(slot?.style.width).toBe('216px');
    expect(names()).toEqual(['Wide Belt', 'Gold Amulet']);
  });

  it('takes the refusal screen when two recipes derive one word, or one mixes grades', async () => {
    for (const recipes of [
      [recipe('greater', 44, 'greater'), recipe('greater-too', 50, 'greater')],
      [{ ...recipe('mixed', 44, 'greater'), currencies: [{ currencyId: 'greater-orb-of-transmutation', quantity: 1 }, { currencyId: 'perfect-orb-of-augmentation', quantity: 1 }] }],
    ]) {
      serveWorld(standardWorld({ recipes }));
      mount();
      // eslint-disable-next-line no-await-in-loop -- sequential on purpose: one mounted root and one served world at a time
      await settleTo('refused');
      expect(frame().querySelector('[data-artifact]')?.textContent).toBe('recipes.json');
      unmount();
    }
  });
});

describe('the crafted states', () => {
  it('state 25: nothing clears, every crafted pair ranks at minus its Craft Cost, numerals print', async () => {
    const now = Date.now();
    serveWorld(
      standardWorld({
        dataset: [priced(bows, 0.1, hoursBefore(now, 1)), priced(belt, 0.1, hoursBefore(now, 1))],
      }),
    );
    mount();
    await settleTo('ready');
    expect(statement()?.dataset['listStatement']).toBe('nothing-clears');
    expect(names()).toEqual(['Bows', 'Staves', 'Gold Amulet']);
    expect(cells('ev')).toEqual(['-0.03', '-0.03', 'no figure yet']);
    expect(cells('rank')).toEqual(['1', '2', '']);
  });

  it('state 35: an uncostable recipe splits the list into two branches, with no numerals and a declarative', async () => {
    serveWorld(standardWorld({ rates: RATES.slice(0, 2) }));
    mount();
    await settleTo('ready');
    expect(statement()).toBeNull();
    expect(costLine()).toBe('0.03Divine / craft');
    click(option('perfect'));
    expect(costLine()).toBe('no figure yet');
    expect(control().querySelector('[data-recipe-cost-figure]')).toBeNull();
    expect(statement()?.dataset['listStatement']).toBe('uncostable');
    expect(statement()?.textContent).toBe(uncostableCopy('perfect'));
    const [rawBranch, craftedBranch] = [...frame().querySelectorAll<HTMLElement>('[data-list-branch]')];
    expect(rawBranch?.dataset['listBranch']).toBe('raw');
    expect(craftedBranch?.dataset['listBranch']).toBe('crafted');
    expect(names(rawBranch)).toEqual(['Wide Belt', 'Gold Amulet']);
    // The crafted branch keeps the gross-payout order: Bows 1 × 1, Staves 0.25 × 2.
    expect(names(craftedBranch)).toEqual(['Bows', 'Staves']);
    expect(cells('ev', craftedBranch)).toEqual(['no figure yet', 'no figure yet']);
    expect(cells('rank')).toEqual(['', '', '', '']);
    // Tiers run per branch: each branch opens at tier 1.
    expect(Array.from(frame().querySelectorAll<HTMLElement>('[data-ranked-row]'), (row) => row.dataset['tier'])).toEqual([
      '1',
      '1',
      '1',
      '1',
    ]);
    expect(frame().querySelector('[data-appendix-row]')).toBeNull();
  });

  it('state 35 bounds each branch at the top 20, with one affordance under each', async () => {
    const now = Date.now();
    const raws = Array.from({ length: 21 }, (_, index) => rawEntry(`Base ${String(index).padStart(2, '0')}`));
    const classes = Array.from({ length: 22 }, (_, index) => {
      const n = String(index).padStart(2, '0');
      return [`fixture.class${n}`, `Class_${n}`, BOWS] as const;
    });
    const crafted = classes.map(([categoryId, className]) => chase(categoryId, className));
    serveWorld({
      tracked: [...raws, ...crafted],
      dataset: [
        ...raws.map((entry, index) => priced(entry, 1 + index / 100, hoursBefore(now, 1))),
        ...crafted.map((entry) => priced(entry, 1, hoursBefore(now, 1))),
      ],
      classes,
      rates: [],
    });
    mount();
    await settleTo('ready');
    const branches = [...frame().querySelectorAll<HTMLElement>('[data-list-branch]')];
    expect(branches).toHaveLength(2);
    expect(branches.map((branch) => branch.querySelectorAll('[data-ranked-row]').length)).toEqual([20, 20]);
    expect(branches.map((branch) => branch.querySelector('[data-expand-affordance]')?.textContent)).toEqual([
      expandCopy(1),
      expandCopy(2),
    ]);
  });

  it('state 23: a league reset lists crafted and raw rows in one canonical sequence, costable or uncostable', async () => {
    const now = Date.now();
    serveWorld(
      standardWorld({
        dataset: [
          priced(bows, 1, hoursBefore(now, 30 * 24), { league: 'Standard' }),
          priced(staves, 2, hoursBefore(now, 30 * 24), { league: 'Standard' }),
          priced(belt, 0.4, hoursBefore(now, 30 * 24), { league: 'Standard' }),
        ],
        // greater costable, perfect uncostable.
        rates: RATES.slice(0, 2),
      }),
    );
    mount();
    await settleTo('ready');
    const expectCanonicalSequence = (recipeId: string): void => {
      expect(statement()?.dataset['listStatement'], recipeId).toBe('honest-empty');
      expect(frame().querySelector('[data-list-branch="crafted"]'), recipeId).toBeNull();
      // Canonical key order: every crafted class key sorts before every raw key.
      expect(names(), recipeId).toEqual(['Bows', 'Staves', 'Gold Amulet', 'Wide Belt']);
      expect(cells('rank'), recipeId).toEqual(['', '', '', '']);
      expect(cells('ev'), recipeId).toEqual(['no figure yet', 'no figure yet', 'no figure yet', 'no figure yet']);
    };
    expectCanonicalSequence('greater');
    click(option('perfect'));
    expect(costLine()).toBe('no figure yet');
    expectCanonicalSequence('perfect');
  });

  it('state 36: a pair the recipe cannot reach is Unrankable under that recipe only', async () => {
    const now = Date.now();
    const wands = chase('weapon.wand', 'Wands');
    serveWorld(
      standardWorld({
        tracked: [bows, wands],
        dataset: [priced(bows, 1, hoursBefore(now, 1)), priced(wands, 1, hoursBefore(now, 1))],
        classes: [
          ['weapon.bow', 'Bows', BOWS],
          ['weapon.wand', 'Wands', WANDS],
        ],
        recipes: [{ id: 'regular', currencies: [{ currencyId: 'divine', quantity: 0.01 }], modifierLevelMin: 0 }, RECIPES[1]],
        rates: [...RATES, rate('divine', 1)],
      }),
    );
    mount();
    await settleTo('ready');
    expect(control().querySelector('[data-recipe-options]')?.textContent).toBe('regular|perfect');
    // At floor 0 every Wands tier is eligible and the target is all of its prefix pool.
    expect(names()).toEqual(['Wands', 'Bows']);
    expect(frame().querySelector('[data-appendix-row]')).toBeNull();
    click(option('perfect'));
    expect(names()).toEqual(['Bows']);
    const rows = Array.from(frame().querySelectorAll('[data-appendix-row]'), (row) => [
      row.querySelector('[data-appendix-class]')?.textContent,
      row.querySelector('[data-cell="reason"]')?.textContent,
    ]);
    expect(rows).toEqual([['Wands', 'recipe cannot reach this class']]);
  });
});

// --- Story 3.5: the chase cells and the crafted panel --------------------------------

const ATK_DMG = 'explicit.stat_2843214518';
const MANA = 'explicit.stat_1050105434';
const LIFE = 'explicit.stat_3299347043';
const ES = 'explicit.stat_3489782002';
const RARITY = 'explicit.stat_3917489142';
const COLD_RES = 'explicit.stat_4220027924';

/** Five prefixes and one suffix. Life's main tier sits below the perfect floor (70), so under perfect its entry's P is small. */
const RINGS: Pools = [
  [tier(ATK_DMG, 10, 75), tier(MANA, 10, 75), tier(LIFE, 10, 50), tier(LIFE, 1, 75), tier(ES, 10, 75), tier(RARITY, 10, 75)],
  [tier(COLD_RES, 10, 80)],
];

/** A ring whose suffix is cold resistance, the whole suffix pool: P is the prefix's share. */
function ring(prefix: string, status: CraftedTrackedEntry['status'] = 'active'): CraftedTrackedEntry {
  return {
    kind: 'crafted',
    categoryId: 'accessory.ring',
    className: 'Rings',
    itemLevelMin: 82,
    prefix: banded(prefix, 1, 10, 'T1'),
    suffix: banded(COLD_RES, 1, 10, 'T1'),
    status,
    ...((status === 'pruned') && { prunedReason: 'never sells' }),
  };
}

const atkCold = ring(ATK_DMG, 'pinned');
const mana = ring(MANA);
const life = ring(LIFE);
const es = ring(ES);
const rarity = ring(RARITY);
const SEARCH = { id: 'AbC123', league: TEST_LEAGUE };

/** Five summands under greater at the default threshold, ordered by price: 1000, 100, 1.5, 1.2, 0.5. */
function ringsWorld(overrides: Partial<World> = {}): World {
  const now = Date.now();
  return {
    tracked: [atkCold, mana, life, es, rarity],
    dataset: [
      priced(atkCold, 1000, hoursBefore(now, 1), { search: SEARCH }),
      priced(mana, 100, hoursBefore(now, 1)),
      priced(life, 1.5, hoursBefore(now, 1)),
      priced(es, 1.2, hoursBefore(now, 1)),
      priced(rarity, 0.5, hoursBefore(now, 1)),
    ],
    classes: [['accessory.ring', 'Rings', RINGS]],
    ...overrides,
  };
}

function chaseCells(row: HTMLElement): HTMLElement[] {
  return [...row.querySelectorAll<HTMLElement>('[data-cell="chase"] [data-chase-cell]')];
}

function chaseTexts(row: HTMLElement): string[] {
  return chaseCells(row).map((cell) => cell.textContent);
}

function panelRows(): HTMLElement[] {
  return [...frame().querySelectorAll<HTMLElement>('[data-expansion-panel] [data-combination-row]')];
}

function panelCell(row: HTMLElement, cell: string): string {
  return row.querySelector(`[data-cell="${cell}"]`)?.textContent ?? '';
}

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
    // Life is mostly out of reach under perfect: its P is small, so it sorts last among the summands.
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

// --- Provenance marks and the uniform-prior banner (Story 3.6) -------------------

const banner = (): HTMLElement | null => frame().querySelector<HTMLElement>('[data-uniform-prior-banner]');
const priorMarks = (): string[] =>
  Array.from(frame().querySelectorAll('[data-ranked-row] [data-cell="provenance"]'), (node) => node.textContent ?? '');

const invented = (item: ModifierWeight): ModifierWeight => ({ ...item, weightSource: 'absent' });

describe('Provenance marks and the banner', () => {
  /** An invented tier at floor 50 sits in the greater recipe's eligible set (floor 44) and under the perfect floor (70). */
  const priorBows: Pools = [[tier(TARGET, 10, 75), invented(tier(FILLER, 10, 50)), tier(LOW, 80, 1)], [tier(SUFFIX, 10, 80)]];
  const priorStaves: Pools = [[tier(TARGET, 50, 50), invented(tier(FILLER, 50, 50))], [tier(SUFFIX, 10, 80)]];

  it('prints prior only on a pair with an invented tier, raises the banner, and follows a recipe switch', async () => {
    serveWorld(standardWorld({ classes: [['weapon.bow', 'Bows', priorBows], ['weapon.staff', 'Staves', priorStaves]] }));
    mount();
    await settleTo('ready');
    expect(banner()).not.toBeNull();
    expect(banner()?.textContent).not.toMatch(/uniform-prior|absent|published/);
    const marks = priorMarks().filter((text) => text !== '');
    expect(marks).toHaveLength(2);
    expect(marks.every((text) => text === `${glyphs.prior}${HAIR_SPACE}prior only`)).toBe(true);
    // The raw rows stay silent, and no expansion repeats the mark.
    click(rowNamed('Bows'));
    expect(frame().querySelector('[data-expansion-panel] [data-trust-mark="prior"]')).toBeNull();
    click(option('perfect'));
    expect(banner()).toBeNull();
    expect(priorMarks().filter((text) => text !== '')).toEqual([]);
    click(option('greater'));
    expect(banner()).not.toBeNull();
  });

  it('keeps the banner down for the session once dismissed, across a recipe switch', async () => {
    serveWorld(standardWorld({ classes: [['weapon.bow', 'Bows', priorBows], ['weapon.staff', 'Staves', priorStaves]] }));
    mount();
    await settleTo('ready');
    click(banner()?.querySelector('[data-banner-dismiss]') as Element);
    expect(banner()).toBeNull();
    click(option('perfect'));
    click(option('greater'));
    expect(banner()).toBeNull();
    expect(priorMarks().filter((text) => text !== '')).toHaveLength(2);
  });

  it('lowers the banner while a measured crafted row is on the list, and prints no mark', async () => {
    serveWorld(standardWorld({ classes: [['weapon.bow', 'Bows', priorBows], ['weapon.staff', 'Staves', STAVES]] }));
    mount();
    await settleTo('ready');
    expect(banner()).toBeNull();
    expect(priorMarks().filter((text) => text !== '')).toHaveLength(1);
  });

  it('raises no banner with no crafted row', async () => {
    serveWorld(standardWorld({ tracked: [belt, amulet], dataset: [], classes: [] }));
    mount();
    await settleTo('ready');
    expect(banner()).toBeNull();
  });
});
