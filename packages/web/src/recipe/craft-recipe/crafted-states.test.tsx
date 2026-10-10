import { afterEach, describe, expect, it } from 'vitest';

import { MONEY_PHRASES } from '../../list/format';
import { honestEmptyCopy, uncostableCopy } from '../../list/list-statement';
import { RECIPE_COST_UNIT } from '../CraftRecipe';
import { expandCopy } from '../../list/RankedList';
import { MISSING_FIGURE } from '../../list/row/ExpectedValueCell';
import { MINUS } from '../../shared/money';
import { settleTo, unmount } from '../../test-support/dom';
import { hoursBefore, priced, rawEntry, unpriced } from '../../test-support/list-fixtures';
import { TEST_LEAGUE } from '../../test-support/artifact-server';
import {
  mount,
  frame,
  BOWS,
  WANDS,
  chase,
  rate,
  RECIPES,
  RATES,
  bows,
  staves,
  belt,
  serveWorld,
  standardWorld,
  control,
  option,
  costLine,
  names,
  cells,
  statement,
  click,
} from './test-support';

afterEach(() => {
  unmount();
  localStorage.clear();
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
    // Staves has no priced combination, so it reads `—` beside ○ (state 18), though it still ranks.
    expect(cells('ev')).toEqual([`${MINUS}0.03`, MISSING_FIGURE, MISSING_FIGURE]);
    expect(cells('rank')).toEqual(['1', '2', '']);
  });

  it('state 35: an uncostable recipe splits the list into two branches, with no numerals and a declarative', async () => {
    serveWorld(standardWorld({ rates: RATES.slice(0, 2) }));
    mount();
    await settleTo('ready');
    expect(statement()).toBeNull();
    expect(costLine()).toBe(`0.03 ${RECIPE_COST_UNIT}`);
    click(option('perfect'));
    expect(costLine()).toBe(MONEY_PHRASES.notYetSynced);
    expect(control().querySelector('[data-recipe-cost-figure]')).toBeNull();
    expect(statement()?.dataset['listStatement']).toBe('uncostable');
    expect(statement()?.textContent).toBe(uncostableCopy('perfect'));
    const [rawBranch, craftedBranch] = [...frame().querySelectorAll<HTMLElement>('[data-list-branch]')];
    expect(rawBranch?.dataset['listBranch']).toBe('raw');
    expect(craftedBranch?.dataset['listBranch']).toBe('crafted');
    expect(names(rawBranch)).toEqual(['Wide Belt', 'Gold Amulet']);
    // The crafted branch keeps the gross-payout order: Bows 1 × 1, Staves 0.25 × 2.
    expect(names(craftedBranch)).toEqual(['Bows', 'Staves']);
    expect(cells('ev', craftedBranch)).toEqual([MISSING_FIGURE, MISSING_FIGURE]);
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
      expect(cells('ev'), recipeId).toEqual([MISSING_FIGURE, MISSING_FIGURE, MISSING_FIGURE, MISSING_FIGURE]);
    };
    expectCanonicalSequence('greater');
    click(option('perfect'));
    expect(costLine()).toBe(MONEY_PHRASES.notYetSynced);
    expectCanonicalSequence('perfect');
  });

  it('state 23: a crafted row whose combinations are all broken drops "yet"; uncostable, it is pending and keeps it', async () => {
    serveWorld(
      standardWorld({
        tracked: [bows],
        dataset: [unpriced(bows, { state: 'unresolvable' })],
        // greater costable, perfect uncostable.
        rates: RATES.slice(0, 2),
      }),
    );
    mount();
    await settleTo('ready');
    expect(names()).toEqual(['Bows']);
    expect(statement()?.textContent).toBe(honestEmptyCopy(TEST_LEAGUE, true));
    click(option('perfect'));
    expect(statement()?.textContent).toBe(honestEmptyCopy(TEST_LEAGUE));
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
    expect(control().querySelector('[data-recipe-options]')?.textContent).toBe('regularperfect');
    // At floor 0 every Wands tier is eligible and the target is half of its prefix pool.
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
