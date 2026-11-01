/** Drives the filter button and the filter modal, and captures the `Blob` download, for the Story 6.3 tests. */

import { crossFileChecks, pickUpPurposes, rank } from '@poe/core';
import { act } from 'react';
import { onTestFinished, vi } from 'vitest';

import { loadArtifacts } from '../load/load-artifacts';
import { filterText } from '../pick-up-filter/filter-text';
import { serveWorld, standardWorld } from '../recipe/craft-recipe/test-support';
import { settleTo } from '../test-support/dom';
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
