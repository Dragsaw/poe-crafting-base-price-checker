import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { serveArtifacts } from '../test-support/artifact-server';
import { settleTo, unmount } from '../test-support/dom';
import { server, mount, frame } from './test-support';

afterEach(unmount);

describe('the chase cells on the frozen data fixture', () => {
  it('shows at most three cells on every crafted row of each recipe, each curated, with no numeral but its tier', async () => {
    const committed = import.meta.glob<unknown>('../../../../test/fixtures/frozen-data/{dataset,tracked,recipes,weights,catalogue/stats}.json', {
      eager: true,
      import: 'default',
    });
    serveArtifacts(server, {
      tracked: { kind: 'json', body: committed['../../../../test/fixtures/frozen-data/tracked.json'] },
      dataset: { kind: 'json', body: committed['../../../../test/fixtures/frozen-data/dataset.json'] },
      recipes: { kind: 'json', body: committed['../../../../test/fixtures/frozen-data/recipes.json'] },
      weights: { kind: 'json', body: committed['../../../../test/fixtures/frozen-data/weights.json'] },
      catalogueStats: { kind: 'json', body: committed['../../../../test/fixtures/frozen-data/catalogue/stats.json'] },
    });
    mount();
    await settleTo('ready');
    for (const recipeId of ['greater', 'perfect']) {
      if (recipeId === 'perfect') {
        act(() => {
          frame().querySelector<HTMLElement>('[data-recipe-option="perfect"]')?.click();
        });
      }
      const crafted = [...frame().querySelectorAll<HTMLElement>('[data-ranked-row]:not([data-raw])')];
      expect(crafted.length, recipeId).toBeGreaterThan(0);
      let filled = 0;
      for (const row of crafted) {
        const slots = [...row.querySelectorAll<HTMLElement>('[data-chase-cell]')];
        expect(slots, recipeId).toHaveLength(3);
        for (const cell of slots) {
          expect(cell.querySelector('[data-verbatim]'), cell.textContent).toBeNull();
          expect(cell.textContent.replaceAll(/T\d+/g, ''), cell.textContent).not.toMatch(/\d/);
          filled += cell.textContent === '' ? 0 : 1;
        }
      }
      expect(filled, recipeId).toBeGreaterThan(0);
    }
  });
});
