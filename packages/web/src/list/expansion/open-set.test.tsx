import { afterEach, describe, expect, it } from 'vitest';

import { mountList, NOW, rowsIn, unmount } from '../../test-support/dom';
import { many } from '../../test-support/list-fixtures';
import { click, panelsIn } from './test-support';

afterEach(unmount);

describe('the open set', () => {
  // Matrix: two open, grow.
  it('keeps rows 3 and 22 open, with their panels, across a collapse and a regrow', () => {
    const { tracked, dataset } = many(25, NOW);
    const view = mountList(tracked, dataset);
    const affordance = view.querySelector<HTMLButtonElement>('[data-expand-affordance]');
    click(affordance);
    click(rowsIn(view)[2]);
    click(rowsIn(view)[21]);
    const openNames = (): (string | undefined)[] =>
      rowsIn(view)
        .filter((r) => r.dataset['open'] !== undefined)
        .map((r) => r.querySelector('[data-unit-name]')?.textContent ?? undefined);
    expect(openNames()).toEqual(['Base 02', 'Base 21']);
    expect(panelsIn(view)).toHaveLength(2);

    click(affordance);
    expect(openNames()).toEqual(['Base 02']);
    expect(panelsIn(view)).toHaveLength(1);

    click(affordance);
    expect(openNames()).toEqual(['Base 02', 'Base 21']);
    expect(panelsIn(view).map((p) => p.querySelector('[data-context-name]')?.textContent)).toEqual(['Base 02', 'Base 21']);
    for (const panel of panelsIn(view)) {
      expect(panel.previousElementSibling?.hasAttribute('data-open')).toBe(true);
    }
  });

  it('closes a panel only on a second click on its own row', () => {
    const { tracked, dataset } = many(3, NOW);
    const view = mountList(tracked, dataset);
    click(rowsIn(view)[0]);
    click(rowsIn(view)[2]);
    expect(panelsIn(view)).toHaveLength(2);
    // A click inside a panel closes nothing.
    click(panelsIn(view)[0]?.querySelector<HTMLElement>('[data-expansion-line]'));
    click(panelsIn(view)[0]?.querySelector<HTMLElement>('[data-context-line]'));
    expect(panelsIn(view)).toHaveLength(2);
    click(rowsIn(view)[2]);
    expect(panelsIn(view)).toHaveLength(1);
    expect(rowsIn(view)[0]?.hasAttribute('data-open')).toBe(true);
  });
});
