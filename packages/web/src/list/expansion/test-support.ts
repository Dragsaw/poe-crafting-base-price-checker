import type { DatasetEntry, RawTrackedEntry } from '@poe/contracts';
import { act } from 'react';
import { expect } from 'vitest';

import { DEFAULT_THRESHOLD } from '../../shared/product';
import { TEST_LEAGUE } from '../../test-support/artifact-server';
import { cellIn as cell, mountList, rowsIn } from '../../test-support/dom';

export const SEARCH = { id: 'H4sIabc', league: TEST_LEAGUE } as const;
export const HREF = `https://www.pathofexile.com/trade2/search/poe2/Forbidden%20Rites/${SEARCH.id}`;

export function panelsIn(within: HTMLElement): HTMLElement[] {
  return [...within.querySelectorAll<HTMLElement>('[data-expansion-panel]')];
}

export function click(target: HTMLElement | null | undefined): void {
  act(() => {
    target?.click();
  });
}

export function linesIn(within: HTMLElement): HTMLElement[] {
  return [...within.querySelectorAll<HTMLElement>('[data-expansion-line]')];
}

/** Mounts one row, opens it, and returns its only expansion line. */
export function openOne(entry: RawTrackedEntry, published: DatasetEntry | undefined, threshold = DEFAULT_THRESHOLD): HTMLElement {
  const view = mountList([entry], published === undefined ? [] : [published], threshold);
  click(rowsIn(view)[0]);
  const lines = linesIn(view);
  expect(lines).toHaveLength(1);
  const [only] = lines;
  if (only === undefined) {
    throw new Error('no expansion line');
  }
  return only;
}

/** The line's combination, price and trust cells as text; the link cell is read on its own. */
export function lineText(line: HTMLElement): string[] {
  return ['combination', 'price', 'trust'].map((name) => cell(line, name).textContent);
}
