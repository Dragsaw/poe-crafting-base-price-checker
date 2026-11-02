/** Drives the filter button and the filter modal, captures the `Blob` download, and reads its blocks back. */

import { crossFileChecks, pickUpPurposes, rank } from '@poe/core';
import type { PickUpPurpose } from '@poe/core';
import { act } from 'react';
import { onTestFinished, vi } from 'vitest';

import { loadArtifacts } from '../load/load-artifacts';
import { filterText, TREATMENTS } from '../pick-up-filter/filter-text';
import { option, serveWorld, standardWorld } from '../recipe/craft-recipe/test-support';
import { flush, settleTo } from '../test-support/dom';
import { hoursBefore, priced, rawEntry } from '../test-support/list-fixtures';
import { blur, typeInto } from '../test-support/threshold-input';
import { frame, mount } from './test-support';

export function filterButton(): HTMLButtonElement {
  const found = frame().querySelector<HTMLButtonElement>(':scope [data-header-bar] [data-slot="filter"] [data-filter-button]');
  if (found === null) {
    throw new Error('no filter button rendered');
  }
  return found;
}

/** The open modal's content, or `null` while it is closed. It renders in a portal, outside the frame. */
export function filterModal(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-filter-modal]');
}

/** One element of the open modal; throws when the modal is closed or lacks it. */
export function inModal<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = filterModal()?.querySelector<T>(selector);
  if (found === null || found === undefined) {
    throw new Error(`no ${selector} in the filter modal`);
  }
  return found;
}

export function clickOn(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

export function openFilterModal(): void {
  clickOn(filterButton());
}

export function pressEscape(): void {
  act(() => {
    (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
}

export const nameField = (): HTMLInputElement => inModal<HTMLInputElement>('[data-filter-name]');
export const downloadAction = (): HTMLButtonElement => inModal<HTMLButtonElement>('[data-filter-download]');

/** The state 46 or 47 line above the download, or `undefined` when neither holds. */
export function stateLine(): string | undefined {
  return filterModal()?.querySelector('[data-filter-state-line]')?.textContent ?? undefined;
}

interface CapturedDownload {
  readonly href: string;
  readonly download: string;
  readonly text: Promise<string>;
}

export interface DownloadCapture {
  readonly downloads: CapturedDownload[];
  readonly revoked: string[];
}

export function clickClose(): void {
  clickOn(inModal('[data-filter-close]'));
}

export function clickOverlay(): void {
  const overlay = document.querySelector('[data-filter-overlay]');
  if (overlay === null) {
    throw new Error('no filter modal overlay rendered');
  }
  clickOn(overlay);
}

/** jsdom has no object URLs and cannot follow an `<a download>`: record both until the test ends. */
export function captureDownloads(): DownloadCapture {
  const blobs = new Map<string, Blob>();
  const downloads: CapturedDownload[] = [];
  const revoked: string[] = [];
  const saved = {
    create: Object.getOwnPropertyDescriptor(URL, 'createObjectURL'),
    revoke: Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL'),
  };
  Object.defineProperties(URL, {
    createObjectURL: {
      configurable: true,
      writable: true,
      value: (blob: Blob): string => {
        const url = `blob:http://localhost/${String(blobs.size)}`;
        blobs.set(url, blob);
        return url;
      },
    },
    revokeObjectURL: {
      configurable: true,
      writable: true,
      value: (url: string): void => {
        revoked.push(url);
        blobs.delete(url);
      },
    },
  });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    const blob = blobs.get(this.href);
    downloads.push({ href: this.href, download: this.download, text: blob === undefined ? Promise.resolve('') : blob.text() });
  });
  onTestFinished(() => {
    click.mockRestore();
    for (const [name, descriptor] of [['createObjectURL', saved.create], ['revokeObjectURL', saved.revoke]] as const) {
      if (descriptor === undefined) {
        Reflect.deleteProperty(URL, name);
      } else {
        Object.defineProperty(URL, name, descriptor);
      }
    }
  });
  return { downloads, revoked };
}

/** The filter text for the served artifacts at `threshold` and `recipeId`, ranked as the page ranks them. */
export async function expectedFilterText(threshold: number, recipeId: string | undefined, importName: string): Promise<string> {
  const outcome = await loadArtifacts();
  if (outcome.kind !== 'ready') {
    throw new Error(`the artifacts did not load: ${outcome.kind}`);
  }
  const { set } = outcome;
  const ranking = rank({
    now: new Date().toISOString(),
    tracked: set.tracked.entries,
    dataset: set.dataset.entries,
    activeLeague: set.config.league,
    threshold,
    weights: set.weights,
    crossFileFailures: crossFileChecks(set.tracked.entries, set.weights).failures,
    recipes: set.recipes?.recipes ?? [],
    currencyRates: set.dataset.currencyRates,
  });
  return filterText(pickUpPurposes({ ranking, tracked: set.tracked.entries, recipeId }), importName);
}

/** A Bows Raw Base under the crafted Bows class, so the file holds a craft entry beside the sell-raw ones. */
const recurveBow = rawEntry('Recurve Bow', 82, { categoryId: 'weapon.bow', className: 'Bows' });

export function pickUpWorld(overrides: Parameters<typeof standardWorld>[0] = {}): ReturnType<typeof standardWorld> {
  const world = standardWorld();
  const bowPrice = priced(recurveBow, 0.3, hoursBefore(Date.now(), 1));
  return standardWorld({
    tracked: [...world.tracked, recurveBow],
    dataset: [...world.dataset, bowPrice],
    ...overrides,
  });
}

export async function ready(world: ReturnType<typeof standardWorld> = pickUpWorld()): Promise<void> {
  serveWorld(world);
  mount();
  await settleTo('ready');
}

export function enterName(text: string): void {
  typeInto(nameField(), text);
  blur(nameField());
}

function purposeOf(lines: readonly string[]): readonly [PickUpPurpose, number] {
  const matches = (Object.entries(TREATMENTS) as [PickUpPurpose, readonly string[]][]).filter(
    ([, treatment]) => lines.slice(-treatment.length).join('\n') === treatment.join('\n'),
  );
  const [match] = matches;
  if (match === undefined || matches.length > 1) {
    throw new Error(`not exactly one treatment ends the block: ${lines.join(' | ')}`);
  }
  return [match[0], match[1].length];
}

/**
 * Each `Show` block as `<base type>: <conditions> → <purpose>`, the purpose read back from its treatment, so a
 * test can compare the file with a purpose list derived by hand from FR-36 rather than from `pickUpPurposes`.
 * Sorted: the entry order is NFR-3's concern, which the core and serialiser tests own.
 */
export function blocksOf(text: string): string[] {
  return text
    .split('Show\n')
    .slice(1)
    .map((block) => {
      const lines = block
        .split('\n')
        .filter((line) => line.startsWith('\t'))
        .map((line) => line.slice(1));
      const [purpose, treatmentLength] = purposeOf(lines);
      const baseType = /^BaseType == "(.*)"$/u.exec(lines[0] ?? '')?.[1];
      if (baseType === undefined) {
        throw new Error(`the block does not open with a BaseType line: ${lines.join(' | ')}`);
      }
      return `${baseType}: ${lines.slice(1, -treatmentLength).join(', ')} → ${purpose}`;
    })
    .toSorted(byCodeUnit);
}

export function byCodeUnit(left: string, right: string): number {
  return left < right ? -1 : Number(left > right);
}

/** Downloads the filter as `My.filter` from a page serving `world`, under `recipeId` when one is given. */
export async function downloadedText(world: ReturnType<typeof standardWorld>, recipeId?: string): Promise<string> {
  const capture = captureDownloads();
  await ready(world);
  if (recipeId !== undefined) {
    clickOn(option(recipeId));
  }
  openFilterModal();
  enterName('My');
  clickOn(downloadAction());
  const [download] = capture.downloads;
  if (download === undefined) {
    throw new Error('the download action handed the browser no file');
  }
  const text = await download.text;
  // Let the deferred revoke run now, before a later test patches `URL` again.
  await flush();
  return text;
}
