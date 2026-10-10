import type {
  CraftedTrackedEntry,
  CraftRecipe,
  CurrencyRate,
  DatasetEntry,
  ModifierWeight,
  TrackedEntry,
} from '@poe/contracts';
import { act } from 'react';

import { App } from '../../App';
import { serveArtifacts, sharedServer, TEST_LEAGUE, VALID_BODIES } from '../../test-support/artifact-server';
import { mount as mountNode, mountedContainer } from '../../test-support/dom';
import { banded, hoursBefore, priced, rawEntry } from '../../test-support/list-fixtures';
import { PageProvider } from '../../theme/PageProvider';

const server = await sharedServer();

export function mount(): void {
  mountNode(
    <PageProvider>
      <App />
    </PageProvider>,
  );
}

export function frame(): HTMLElement {
  const found = mountedContainer()?.querySelector<HTMLElement>('[data-frame]');
  if (found === null || found === undefined) {
    throw new Error('no frame rendered');
  }
  return found;
}

const nextSerial = ((): (() => number) => {
  let serial = 0;
  return () => {
    serial += 1;
    return serial;
  };
})();

/** One pool tier; a shared `modGroup` makes the recipe floor act on the tiers together (AD-17). */
export function tier(statId: string, weight: number, itemLevelMin: number, group?: string): ModifierWeight {
  const serial = nextSerial();
  return {
    sourceModifierId: `m${String(serial)}`,
    modGroup: group ?? `g${String(serial)}`,
    itemLevelMin,
    weight,
    weightSource: 'published',
    lines: [{ statId, ranges: [[1, 10]] }],
  };
}

/** One hybrid pool tier: one modifier carrying a line for each `statId`. */
export function hybridTier(statIds: readonly string[], weight: number, itemLevelMin: number): ModifierWeight {
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

export const TARGET = 'explicit.stat_1';
export const FILLER = 'explicit.stat_2';
export const LOW = 'explicit.stat_3';
export const SUFFIX = 'explicit.stat_4';

export type Pools = readonly [readonly ModifierWeight[], readonly ModifierWeight[]];

/** At floor 44 the target is half the prefix pool; at floor 70 it is all of it. */
export const BOWS: Pools = [[tier(TARGET, 10, 75, 'bows'), tier(FILLER, 10, 50, 'bows'), tier(LOW, 80, 1, 'bows')], [tier(SUFFIX, 10, 80)]];
/** Floor 44: the target is half the prefix pool; floor 70: a quarter. None in reach: a reason. */
export const STAVES: Pools = [[tier(TARGET, 50, 50, 'staves'), tier(TARGET, 25, 75, 'staves'), tier(FILLER, 75, 75)], [tier(SUFFIX, 10, 80)]];
/** The target shares a group with a tier at 75, so both floors remove it: no such recipe reaches it (state 36). */
export const WANDS: Pools = [[tier(TARGET, 10, 1, 'wands'), tier(FILLER, 10, 75, 'wands')], [tier(SUFFIX, 10, 1)]];

export function chase(categoryId: string, className: string): CraftedTrackedEntry {
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

export function recipe(id: string, modifierLevelMin: number, grade: string): CraftRecipe {
  return {
    id,
    currencies: [
      { currencyId: `${grade}-orb-of-transmutation`, quantity: 1 },
      { currencyId: `${grade}-orb-of-augmentation`, quantity: 1 },
    ],
    modifierLevelMin,
  };
}

export function rate(currencyId: string, value: number): CurrencyRate {
  return { currencyId, rate: value, source: 'measured', league: TEST_LEAGUE, asOf: '2026-09-26T00:00:00Z' };
}

export const RECIPES = [recipe('greater', 44, 'greater'), recipe('perfect', 70, 'perfect')];
export const RATES = [
  rate('greater-orb-of-transmutation', 0.01),
  rate('greater-orb-of-augmentation', 0.02),
  rate('perfect-orb-of-transmutation', 0.1),
  rate('perfect-orb-of-augmentation', 0.2),
];

export const bows = chase('weapon.bow', 'Bows');
export const staves = chase('weapon.staff', 'Staves');
export const belt = rawEntry('Wide Belt');
export const amulet = rawEntry('Gold Amulet');

interface World {
  readonly tracked: readonly TrackedEntry[];
  readonly dataset: readonly DatasetEntry[];
  readonly classes: readonly (readonly [string, string, Pools])[];
  readonly recipes?: readonly unknown[];
  readonly rates?: readonly CurrencyRate[];
  /** The catalogue's stat texts, one explicit group. Absent: the empty catalogue. */
  readonly stats?: readonly { readonly id: string; readonly text: string }[];
}

export function serveWorld(world: World): void {
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

// greater: Staves 0.5×2 − 0.03 = 0.97, Bows 0.5×1 − 0.03 = 0.47, Wide Belt 0.40, Gold Amulet 0.30.
// perfect: Bows 1×1 − 0.3 = 0.70, Wide Belt 0.40, Gold Amulet 0.30, Staves 0.25×2 − 0.3 = 0.20.
export function standardWorld(overrides: Partial<World> = {}): World {
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


export function control(): HTMLElement {
  const found = frame().querySelector<HTMLElement>('[data-craft-recipe]');
  if (found === null) {
    throw new Error('no Craft Recipe control rendered');
  }
  return found;
}

export function option(id: string): HTMLElement {
  const found = [...control().querySelectorAll<HTMLElement>('[data-recipe-option]')].find((node) => node.dataset['recipeOption'] === id);
  if (found === undefined) {
    throw new Error(`no option ${id}`);
  }
  return found;
}

export function costLine(): string {
  return control().querySelector('[data-recipe-cost]')?.textContent ?? '';
}

export function names(scope: ParentNode = frame()): string[] {
  return Array.from(scope.querySelectorAll(':scope [data-ranked-row] [data-unit-name]'), (node) => node.textContent ?? '');
}

export function cells(cell: string, scope: ParentNode = frame()): string[] {
  const found = [...scope.querySelectorAll<HTMLElement>(':scope [data-ranked-row] [data-cell]')].filter((node) => node.dataset['cell'] === cell);
  return found.map((node) => node.textContent ?? '');
}

export function statement(): HTMLElement | null {
  return frame().querySelector<HTMLElement>('[data-list-statement]');
}

export function click(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

export function rowNamed(name: string): HTMLElement {
  const row = [...frame().querySelectorAll<HTMLElement>('[data-ranked-row]')].find(
    (candidate) => candidate.querySelector('[data-unit-name]')?.textContent === name,
  );
  if (row === undefined) {
    throw new Error(`no row ${name}`);
  }
  return row;
}

const ATK_DMG = 'explicit.stat_2843214518';
const MANA = 'explicit.stat_1050105434';
const LIFE = 'explicit.stat_3299347043';
const ES = 'explicit.stat_3489782002';
export const RARITY = 'explicit.stat_3917489142';
export const COLD_RES = 'explicit.stat_4220027924';

/** Five prefixes, one suffix. Life's main tier is below the perfect floor (70): small P there. */
const RINGS: Pools = [
  [tier(ATK_DMG, 10, 75), tier(MANA, 10, 75), tier(LIFE, 10, 50, 'life'), tier(LIFE, 1, 75, 'life'), tier(ES, 10, 75), tier(RARITY, 10, 75)],
  [tier(COLD_RES, 10, 80)],
];

/** A ring whose suffix is cold resistance, the whole suffix pool: P is the prefix's share. */
export function ring(prefix: string, status: CraftedTrackedEntry['status'] = 'active'): CraftedTrackedEntry {
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

export const atkCold = ring(ATK_DMG, 'pinned');
export const mana = ring(MANA);
export const life = ring(LIFE);
export const es = ring(ES);
const rarity = ring(RARITY);
export const SEARCH = { id: 'AbC123', league: TEST_LEAGUE };

/** Five summands under greater at the default threshold, by price: 1000, 100, 1.5, 1.2, 0.5. */
export function ringsWorld(overrides: Partial<World> = {}): World {
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

export function chaseCells(row: HTMLElement): HTMLElement[] {
  return [...row.querySelectorAll<HTMLElement>(':scope [data-cell="chase"] [data-chase-cell]')];
}

export function chaseTexts(row: HTMLElement): string[] {
  return chaseCells(row).map((cell) => cell.textContent);
}

export function panelRows(): HTMLElement[] {
  return [...frame().querySelectorAll<HTMLElement>(':scope [data-expansion-panel] [data-expansion-line]')];
}

export function panelCell(row: HTMLElement, cell: string): string {
  const found = [...row.querySelectorAll<HTMLElement>('[data-cell]')].find((node) => node.dataset['cell'] === cell);
  return found?.textContent ?? '';
}
