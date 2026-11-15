import { CRAFTING_ITEM_LEVELS } from '@poe/core';
import { afterEach, describe, expect, it } from 'vitest';

import { RECIPE_STORAGE_KEY } from '../recipe/recipe-storage';
import { FIRST_VISIT_CRAFTING_ITEM_LEVEL } from '../shared/product';
import { LEVEL_STORAGE_KEY, readStoredLevel, writeStoredLevel } from './level-storage';

const throwing = {
  getItem: (): string | null => {
    throw new Error('blocked');
  },
  setItem: (): void => {
    throw new Error('blocked');
  },
};

afterEach(() => {
  localStorage.clear();
});

describe('the persisted Crafting Item Level', () => {
  it('sits beside the recipe under its own key', () => {
    expect(LEVEL_STORAGE_KEY).toBe('poe-cbpc.craftingItemLevel');
    expect(LEVEL_STORAGE_KEY.split('.', 1)[0]).toBe(RECIPE_STORAGE_KEY.split('.', 1)[0]);
  });

  // I/O matrix: "First visit" and "Reload".
  it('reads 82 with nothing stored, and round-trips every offered level', () => {
    expect(readStoredLevel()).toBe(82);
    expect(FIRST_VISIT_CRAFTING_ITEM_LEVEL).toBe(82);
    for (const level of CRAFTING_ITEM_LEVELS) {
      writeStoredLevel(level);
      expect(localStorage.getItem(LEVEL_STORAGE_KEY)).toBe(String(level));
      expect(readStoredLevel()).toBe(level);
    }
  });

  // I/O matrix: "Bad stored level".
  it.each(['80', 'junk', '', ' 79', '79.0', '7.9e1', '0x4F', '82 '])('reads a stored %j, which is no offered level, as absent', (stored) => {
    localStorage.setItem(LEVEL_STORAGE_KEY, stored);
    expect(readStoredLevel()).toBe(FIRST_VISIT_CRAFTING_ITEM_LEVEL);
  });

  // I/O matrix: "Storage throws".
  it('survives a storage that throws on read and on write', () => {
    expect(readStoredLevel(throwing)).toBe(FIRST_VISIT_CRAFTING_ITEM_LEVEL);
    expect(() => {
      writeStoredLevel(79, throwing);
    }).not.toThrow();
  });
});
