/** The Crafting Item Level's persisted value, beside the recipe (EXPERIENCE.md *What survives a reload*; FR-7, AD-15). */

import { CRAFTING_ITEM_LEVELS, type CraftingItemLevel } from '@poe/core';

import { FIRST_VISIT_CRAFTING_ITEM_LEVEL } from '../shared/product';

export const LEVEL_STORAGE_KEY = 'poe-cbpc.craftingItemLevel';

function defaultStorage(): Storage {
  return globalThis.localStorage;
}

/** Read once at mount; anything but an offered level, written as `String(level)`, gives the first-visit level. */
export function readStoredLevel(storage?: Pick<Storage, 'getItem'>): CraftingItemLevel {
  try {
    const raw = (storage ?? defaultStorage()).getItem(LEVEL_STORAGE_KEY);
    return CRAFTING_ITEM_LEVELS.find((level) => String(level) === raw) ?? FIRST_VISIT_CRAFTING_ITEM_LEVEL;
  } catch {
    return FIRST_VISIT_CRAFTING_ITEM_LEVEL;
  }
}

/** Persists the Crafting Item Level. A storage that throws is ignored. */
export function writeStoredLevel(level: CraftingItemLevel, storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? defaultStorage()).setItem(LEVEL_STORAGE_KEY, String(level));
  } catch {
    // Browser storage is a convenience: a blocked write leaves the page as it is.
  }
}
