import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { cellIn as cell, mountList, NOW, rerenderList, rowsIn, unmount } from '../../test-support/dom';
import { many, rawEntry } from '../../test-support/list-fixtures';
import { COLLAPSE_COPY, expandCopy } from '../RankedList';

afterEach(unmount);

describe('the top-20 bound', () => {
  // Matrix: 25 ranked rows.
  it('shows 20 rows and grows in place to 25, then back', () => {
    const { tracked, dataset } = many(25, NOW);
    const view = mountList(tracked, dataset);
    expect(rowsIn(view)).toHaveLength(20);
    const button = view.querySelector<HTMLButtonElement>('[data-expand-affordance]');
    expect(button?.textContent).toBe('+ Read the remaining 5 rows');
    expect(button?.textContent).toBe(expandCopy(5));
    act(() => {
      button?.click();
    });
    expect(rowsIn(view)).toHaveLength(25);
    expect(button?.textContent).toBe('− Show only the top 20');
    expect(button?.textContent).toBe(COLLAPSE_COPY);
    expect(rowsIn(view).slice(20).every((r) => r.dataset['tier'] === '3')).toBe(true);
    expect(cell(rowsIn(view)[24], 'rank').textContent).toBe('25');
    act(() => {
      button?.click();
    });
    expect(rowsIn(view)).toHaveLength(20);
  });

  // Matrix: grown, then shrink to 20, then grow back.
  it('forgets the grown state when the rows drop to 20, so a later rise opens collapsed', () => {
    const big = many(25, NOW);
    const view = mountList(big.tracked, big.dataset);
    act(() => {
      view.querySelector<HTMLButtonElement>('[data-expand-affordance]')?.click();
    });
    expect(rowsIn(view)).toHaveLength(25);
    const grown = view.querySelector<HTMLButtonElement>('[data-expand-affordance]');
    expect(grown?.getAttribute('aria-expanded')).toBe('true');
    expect(grown?.textContent).toBe(COLLAPSE_COPY);
    const small = many(20, NOW);
    rerenderList(small.tracked, small.dataset);
    expect(rowsIn(view)).toHaveLength(20);
    expect(view.querySelector('[data-expand-affordance]')).toBeNull();
    rerenderList(big.tracked, big.dataset);
    expect(rowsIn(view)).toHaveLength(20);
    const button = view.querySelector<HTMLButtonElement>('[data-expand-affordance]');
    expect(button?.textContent).toBe(expandCopy(5));
    expect(button?.getAttribute('aria-expanded')).toBe('false');
  });

  it('counts the unpriced trail toward the 20 and toward N', () => {
    const { tracked, dataset } = many(19, NOW);
    const extra = [rawEntry('Zz One'), rawEntry('Zz Two'), rawEntry('Zz Three')];
    const view = mountList([...tracked, ...extra], dataset);
    expect(rowsIn(view)).toHaveLength(20);
    expect(view.querySelector('[data-expand-affordance]')?.textContent).toBe(expandCopy(2));
  });

  // Matrix: one hidden row, many hidden rows.
  it('names one hidden row in the singular and two in the plural', () => {
    const one = many(21, NOW);
    expect(mountList(one.tracked, one.dataset).querySelector('[data-expand-affordance]')?.textContent).toBe(
      '+ Read the remaining 1 row',
    );
    unmount();
    const two = many(22, NOW);
    expect(mountList(two.tracked, two.dataset).querySelector('[data-expand-affordance]')?.textContent).toBe(
      '+ Read the remaining 2 rows',
    );
  });

  it('prints no affordance at 20 rows or fewer', () => {
    const { tracked, dataset } = many(20, NOW);
    expect(mountList(tracked, dataset).querySelector('[data-expand-affordance]')).toBeNull();
  });
});
