/** Shared DOM test helpers; a file that mounts calls `unmount` in `afterEach`. */

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

const mounted: { container?: HTMLDivElement; root?: Root } = {};

/** Unmounts any earlier root, renders `node` into a fresh container on `document.body` and returns the container. */
export function mount(node: ReactNode): HTMLDivElement {
  unmount();
  const host = document.createElement('div');
  mounted.container = host;
  document.body.append(host);
  const created = createRoot(host);
  mounted.root = created;
  act(() => {
    created.render(node);
  });
  return host;
}

/** The container of the last `mount`, until `unmount`. */
export function mountedContainer(): HTMLDivElement | undefined {
  return mounted.container;
}

/** Unmounts the mounted root, if any, and removes its container. */
export function unmount(): void {
  const { root, container } = mounted;
  if (root !== undefined) {
    act(() => {
      root.unmount();
    });
  }
  mounted.root = undefined;
  container?.remove();
  mounted.container = undefined;
}

/** Lets pending fetches and their continuations run, inside `act`. */
export async function flush(): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < 5; turn += 1) {
      // eslint-disable-next-line no-await-in-loop -- sequential on purpose: each turn is one macrotask, so chained continuations run in order
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

/** Flushes until the mounted `[data-frame]` has `data-state` equal to `state`; throws after 50. */
export async function settleTo(state: string): Promise<void> {
  const stateOf = (): string | undefined => {
    const frame = mounted.container?.querySelector<HTMLElement>('[data-frame]');
    if (frame === null || frame === undefined) {
      throw new Error('no frame rendered');
    }
    return frame.dataset['state'];
  };
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (stateOf() === state) {
      return;
    }
    // eslint-disable-next-line no-await-in-loop -- polling: each flush decides whether the next probe runs
    await flush();
  }
  throw new Error(`frame never reached ${state}; it is ${String(stateOf())}`);
}

/** Renders `node` into the kept root, so mounted components keep their state. */
function rerender(node: ReactNode): void {
  const { root } = mounted;
  if (root === undefined) {
    throw new Error('no mounted root');
  }
  act(() => {
    root.render(node);
  });
}

/** The ranked list for `tracked` against `dataset` at `threshold`, at `NOW`. */
function rankedList(tracked: readonly RawTrackedEntry[], dataset: readonly DatasetEntry[], threshold: number): ReactNode {
  const rows = toDisplayRows(rank({ tracked, dataset, activeLeague: TEST_LEAGUE, threshold, weights: undefined }), dataset, NOW);
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
