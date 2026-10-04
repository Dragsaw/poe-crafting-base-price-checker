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

/** Mounts one row, opens it, and returns its only combination row. */
export function openOne(entry: RawTrackedEntry, published: DatasetEntry | undefined, threshold = DEFAULT_THRESHOLD): HTMLElement {
  const view = mountList([entry], published === undefined ? [] : [published], threshold);
  click(rowsIn(view)[0]);
  const rows = [...view.querySelectorAll<HTMLElement>('[data-combination-row]')];
  expect(rows).toHaveLength(1);
  const [only] = rows;
  if (only === undefined) {
    throw new Error('no combination row');
  }
  return only;
}

export function line1(row: HTMLElement): string[] {
  return ['combination', 'state', 'figure', 'sample'].map((name) => cell(row, name).textContent);
}

export function line2(row: HTMLElement): string[] {
  return ['note', 'observed', 'attempted'].map((name) => cell(row, name).textContent);
}
