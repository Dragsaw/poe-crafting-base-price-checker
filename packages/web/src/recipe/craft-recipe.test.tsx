import { afterEach, describe, expect, it } from 'vitest';

import { rgb, settleTo, unmount } from '../test-support/dom';
import { colors } from '../theme/tokens';
import { RECIPE_STORAGE_KEY } from './recipe-storage';
import {
  mount,
  frame,
  recipe,
  serveWorld,
  standardWorld,
  control,
  option,
  costLine,
  names,
  cells,
  statement,
  click,
  rowNamed,
} from './craft-recipe/test-support';

afterEach(() => {
  unmount();
  localStorage.clear();
});

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
