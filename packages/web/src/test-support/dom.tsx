/**
 * Shared DOM test helpers: the fixed test clock, the colour spelling jsdom
 * reports, and one mounted React root per test. Never imported by the app.
 *
 * A file that mounts through `mount` or `mountList` calls `unmount` in its
 * `afterEach`.
 */

import { rank } from '@poe/core';
import type { DatasetEntry, RawTrackedEntry } from '@poe/contracts';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { toDisplayRows } from '../list/display-rows';
import { RankedList } from '../list/RankedList';
import { DEFAULT_THRESHOLD } from '../shared/product';
import { TEST_LEAGUE } from './artifact-server';

/** The test clock every unit and list test reads as `now`. */
export const NOW = Date.parse('2026-09-26T12:00:00.000Z');

/** A token hex as the `rgb(...)` jsdom reports for an inline colour. */
export const rgb = (hex: string): string =>
  `rgb(${[1, 3, 5].map((index) => String(Number.parseInt(hex.slice(index, index + 2), 16))).join(', ')})`;

let container: HTMLDivElement | undefined;
let root: Root | undefined;

/** Unmounts any earlier root, renders `node` into a fresh container on `document.body` and returns the container. */
export function mount(node: ReactNode): HTMLDivElement {
  unmount();
  const host = document.createElement('div');
  container = host;
  document.body.append(host);
  const mounted = createRoot(host);
  root = mounted;
  act(() => {
    mounted.render(node);
  });
  return host;
}

/** Unmounts the mounted root, if any, and removes its container. */
export function unmount(): void {
  const mounted = root;
  if (mounted !== undefined) {
    act(() => {
      mounted.unmount();
    });
  }
  root = undefined;
  container?.remove();
  container = undefined;
}

/** Renders `node` into the kept root, so mounted components keep their state. */
function rerender(node: ReactNode): void {
  const mounted = root;
  if (mounted === undefined) {
    throw new Error('no mounted root');
  }
  act(() => {
    mounted.render(node);
  });
}

/** The ranked list for `tracked` against `dataset` at `threshold`, at `NOW`. */
function rankedList(tracked: readonly RawTrackedEntry[], dataset: readonly DatasetEntry[], threshold: number): ReactNode {
  const rows = toDisplayRows(rank({ tracked, dataset, activeLeague: TEST_LEAGUE, threshold, weights: null }), dataset, NOW);
  return <RankedList rows={rows} threshold={threshold} activeLeague={TEST_LEAGUE} />;
}

/** Ranks `tracked` against `dataset` at `threshold` and mounts the ranked list at `NOW`. */
export function mountList(
  tracked: readonly RawTrackedEntry[],
  dataset: readonly DatasetEntry[],
  threshold = DEFAULT_THRESHOLD,
): HTMLDivElement {
  return mount(rankedList(tracked, dataset, threshold));
}

/** Renders new ranked rows into the kept root, so `RankedList` keeps its state. */
export function rerenderList(
  tracked: readonly RawTrackedEntry[],
  dataset: readonly DatasetEntry[],
  threshold = DEFAULT_THRESHOLD,
): void {
  rerender(rankedList(tracked, dataset, threshold));
}

/** The ranked rows under `within`, in document order. */
export function rowsIn(within: HTMLElement): HTMLElement[] {
  return [...within.querySelectorAll<HTMLElement>('[data-ranked-row]')];
}

/** The one `[data-cell=name]` under `within`; throws when there is none. */
export function cellIn(within: HTMLElement | undefined, name: string): HTMLElement {
  const found = within?.querySelector<HTMLElement>(`[data-cell="${name}"]`);
  if (found === null || found === undefined) {
    throw new Error(`no ${name} cell`);
  }
  return found;
}
