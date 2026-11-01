import { afterEach, describe, expect, it } from 'vitest';

import { RECIPE_STORAGE_KEY } from '../recipe/recipe-storage';
import { THRESHOLD_STORAGE_KEY } from '../threshold/threshold-storage';
import {
  checkFilterName,
  FILTER_NAME_STORAGE_KEY,
  GENERATED_FILE_NAME,
  readStoredFilterName,
  writeStoredFilterName,
} from './filter-name';

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

describe('checkFilterName', () => {
  // Matrix: no extension.
  it.each(['My.filter', 'My'])('imports %s as My.filter', (text) => {
    expect(checkFilterName(text)).toEqual({ kind: 'usable', importName: 'My.filter' });
  });

  // Matrix: upper case.
  it('keeps an upper-case extension and adds no second one', () => {
    expect(checkFilterName('My.FILTER')).toEqual({ kind: 'usable', importName: 'My.FILTER' });
  });

  it('checks the trimmed name and imports it trimmed', () => {
    expect(checkFilterName("  NeverSink's filter 2 - 3-STRICT  ")).toEqual({
      kind: 'usable',
      importName: "NeverSink's filter 2 - 3-STRICT.filter",
    });
  });

  // Matrix: own name.
  it.each(['Crafting-Bases', 'crafting-bases', GENERATED_FILE_NAME, ' CRAFTING-BASES.Filter '])(
    'refuses %s as the generated filter itself (state 45)',
    (text) => {
      expect(checkFilterName(text)).toEqual({ kind: 'unusable', error: 'own-name' });
    },
  );

  // Matrix: quote or folder.
  it.each(['a"b', 'a/b', String.raw`a\b`, '"crafting-bases"'])('refuses %s as a quote or a folder (state 45)', (text) => {
    expect(checkFilterName(text)).toEqual({ kind: 'unusable', error: 'quote-or-folder' });
  });

  // Matrix: blank.
  it.each(['', ' '.repeat(3)])('reads %j as no file name (state 44), with no error', (text) => {
    expect(checkFilterName(text)).toEqual({ kind: 'empty' });
  });
});

describe('the persisted Base Filter name', () => {
  it('sits beside the threshold and the recipe under its own key', () => {
    expect(FILTER_NAME_STORAGE_KEY).toBe('poe-cbpc.baseFilterName');
    expect(new Set([FILTER_NAME_STORAGE_KEY, THRESHOLD_STORAGE_KEY, RECIPE_STORAGE_KEY]).size).toBe(3);
    expect(FILTER_NAME_STORAGE_KEY.split('.', 1)[0]).toBe(THRESHOLD_STORAGE_KEY.split('.', 1)[0]);
  });

  it('round-trips the text as typed, and reads nothing stored as empty', () => {
    expect(readStoredFilterName()).toBe('');
    writeStoredFilterName('My filter ');
    expect(localStorage.getItem(FILTER_NAME_STORAGE_KEY)).toBe('My filter ');
    expect(readStoredFilterName()).toBe('My filter ');
  });

  // Matrix: storage throws.
  it('survives a storage that throws on read and on write', () => {
    expect(readStoredFilterName(throwing)).toBe('');
    expect(() => {
      writeStoredFilterName('My', throwing);
    }).not.toThrow();
  });
});
