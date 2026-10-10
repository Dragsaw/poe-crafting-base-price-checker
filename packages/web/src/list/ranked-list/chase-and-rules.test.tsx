import type { PriceTrust } from '@poe/contracts';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mount, mountList, NOW, rgb, rowsIn, unmount } from '../../test-support/dom';
import { hover, leave } from '../../test-support/hover';
import { many } from '../../test-support/list-fixtures';
import { colors, spacing } from '../../theme/tokens';
import { PageProvider } from '../../theme/PageProvider';
import { CHASE_CELL_BUDGET } from './chase-count';
import type { AffixPart } from '../combination-text';
import type { ClassDisplayRow } from '../display-rows';
import { RankedList } from '../RankedList';

const CURRENT: PriceTrust = { verdict: 'current', reasons: [] };
const THREE_CELLS_FROM = 3 * CHASE_CELL_BUDGET + 426;

const observers = new Set<DrivenResizeObserver>();

/** jsdom lays out nothing: the list's width comes only from what a test feeds its observer. */
class DrivenResizeObserver implements ResizeObserver {
  readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(): void {
    observers.add(this);
  }

  unobserve(): void {}

  disconnect(): void {
    observers.delete(this);
  }
}

function resizeListTo(width: number): void {
  const entry: ResizeObserverEntry = {
    target: document.body,
    contentRect: DOMRectReadOnly.fromRect({ width, height: 0 }),
    borderBoxSize: [],
    contentBoxSize: [],
    devicePixelContentBoxSize: [],
  };
  act(() => {
    for (const observer of observers) {
      observer.callback([entry], observer);
    }
  });
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', DrivenResizeObserver);
});

afterEach(() => {
  unmount();
  vi.unstubAllGlobals();
  observers.clear();
});

const parts = (...affixes: readonly string[]): readonly AffixPart[] => affixes.map((text) => ({ text, verbatim: false }));

function craftedRow(index: number): ClassDisplayRow {
  return {
    key: `["crafted","accessory.ring","Rings ${String(index)}"]`,
    numeral: index + 1,
    tier: 1,
    unit: 'class',
    label: `Rings ${String(index)}`,
    itemLevel: 82,
    ev: { kind: 'figure', text: '1.00', negative: false },
    trust: CURRENT,
    provenance: 'measured',
    chase: [parts('T1 Mana', 'T1 Cold Res'), parts('T1 Life', 'T1 Cold Res'), parts('T1 ES', 'T1 Cold Res')],
    combinations: [],
    pruned: [],
  };
}

function mountCrafted(count: number): HTMLElement {
  return mount(
    <PageProvider>
      <RankedList rows={Array.from({ length: count }, (_, index) => craftedRow(index))} activeLeague="Forbidden Rites" />
    </PageProvider>,
  );
}

const cellCounts = (view: HTMLElement): number[] => rowsIn(view).map((row) => row.querySelectorAll('[data-chase-cell]').length);

/** A three-cell column's cell at the minimum frame (DESIGN.md *The chase column*). */
const CELL_WIDTH = 175;

/** Gives a cell the layout jsdom lacks: its text's width in a box of {@link CELL_WIDTH}. */
function layOut(cell: Element | undefined, textWidth: number): HTMLElement {
  if (!(cell instanceof HTMLElement)) {
    throw new TypeError('no chase cell');
  }
  Object.defineProperties(cell, {
    scrollWidth: { configurable: true, value: textWidth },
    clientWidth: { configurable: true, value: CELL_WIDTH },
  });
  return cell;
}

const ruleOf = (element: HTMLElement | undefined): string | undefined => element?.style.borderBottom;

describe('the chase-cell count', () => {
  // Matrix: wide list.
  it('shows three cells on every crafted row from 3B + 426px of list width', () => {
    const view = mountCrafted(3);
    resizeListTo(THREE_CELLS_FROM);
    expect(cellCounts(view)).toEqual([3, 3, 3]);
    expect(rowsIn(view)[0]?.querySelector<HTMLElement>('[data-cell="chase"]')?.style.gridTemplateColumns).toBe(
      'repeat(3, minmax(0, 1fr))',
    );
  });

  // Matrix: narrow list.
  it('shows two cells, with one chase gap, on every crafted row below it, and switches back when the list widens', () => {
    const view = mountCrafted(3);
    resizeListTo(THREE_CELLS_FROM - 1);
    expect(cellCounts(view)).toEqual([2, 2, 2]);
    const column = rowsIn(view)[0]?.querySelector<HTMLElement>('[data-cell="chase"]');
    expect(column?.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
    expect(column?.style.columnGap).toBe(spacing['chase-gap']);
    expect(rowsIn(view)[0]?.textContent).not.toContain('T1 ES');
    resizeListTo(THREE_CELLS_FROM);
    expect(cellCounts(view)).toEqual([3, 3, 3]);
  });

  it('leaves a Raw Base row its sell-as-is line at either width', () => {
    const { tracked, dataset } = many(2, NOW);
    const view = mountList(tracked, dataset);
    resizeListTo(THREE_CELLS_FROM - 1);
    for (const row of rowsIn(view)) {
      expect(row.querySelector('[data-sell-as-is]')).not.toBeNull();
      expect(row.querySelector('[data-chase-cell]')).toBeNull();
    }
  });
});

describe('a cut chase cell', () => {
  // Matrix: cut cell hovered.
  it('opens its full text in the shared tooltip shell, the mod text magic and the tier and joiner secondary', () => {
    const view = mountCrafted(1);
    const cell = layOut(rowsIn(view)[0]?.querySelectorAll('[data-chase-cell]')[0], 300);
    hover(cell);
    const tooltip = document.body.querySelector<HTMLElement>('[data-chase-tooltip]');
    expect(tooltip?.textContent).toBe('T1 Mana · T1 Cold Res');
    expect(tooltip?.style.color).toBe(rgb(colors['rarity-magic']));
    const tones = [...(tooltip?.querySelectorAll<HTMLElement>('[data-tier], [data-joiner]') ?? [])];
    expect(tones).toHaveLength(3);
    for (const tone of tones) {
      expect(tone.style.color).toBe(rgb(colors['text-secondary']));
    }
    expect(tooltip?.closest('[role="tooltip"]')).not.toBeNull();
    leave(cell);
    expect(document.body.querySelector('[data-chase-tooltip]')).toBeNull();
  });

  // Matrix: uncut cell hovered.
  it('opens nothing when the cell holds its whole text', () => {
    const view = mountCrafted(1);
    const cell = layOut(rowsIn(view)[0]?.querySelectorAll('[data-chase-cell]')[1], CELL_WIDTH);
    hover(cell);
    expect(document.body.querySelector('[data-chase-tooltip]')).toBeNull();
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('leaves the row cursor as it is', () => {
    const view = mountCrafted(1);
    const cell = layOut(rowsIn(view)[0]?.querySelectorAll('[data-chase-cell]')[0], 300);
    hover(cell);
    expect(cell.style.cursor).toBe('');
  });
});

describe('the last row of a branch', () => {
  // Matrix: last row, show-more below.
  it('draws no rule under row 20 when show-more follows it, and the row above keeps its rule', () => {
    const { tracked, dataset } = many(21, NOW);
    const view = mountList(tracked, dataset);
    const rows = rowsIn(view);
    expect(rows).toHaveLength(20);
    expect(view.querySelector('[data-expand-affordance]')).not.toBeNull();
    expect(ruleOf(rows[19])).toBe('1px solid transparent');
    expect(ruleOf(rows[18])).toBe(`1px solid ${rgb(colors.line)}`);
  });

  it('moves the missing rule to row 21 when the list grows', () => {
    const { tracked, dataset } = many(21, NOW);
    const view = mountList(tracked, dataset);
    act(() => {
      view.querySelector<HTMLButtonElement>('[data-expand-affordance]')?.click();
    });
    const rows = rowsIn(view);
    expect(ruleOf(rows[19])).toBe(`1px solid ${rgb(colors.line)}`);
    expect(ruleOf(rows[20])).toBe('1px solid transparent');
  });

  // Matrix: last row open.
  it('draws no rule under its open panel either, while a panel under another row keeps its rule', () => {
    const { tracked, dataset } = many(3, NOW);
    const view = mountList(tracked, dataset);
    act(() => {
      rowsIn(view)[0]?.click();
      rowsIn(view)[2]?.click();
    });
    const panels = [...view.querySelectorAll<HTMLElement>('[data-expansion-panel]')];
    expect(panels).toHaveLength(2);
    expect(ruleOf(panels[0])).toBe(`1px solid ${rgb(colors.line)}`);
    expect(ruleOf(panels[1])).toBe('');
    expect(ruleOf(rowsIn(view)[2])).toBe('1px solid transparent');
  });
});
