import { describe, expect, it } from 'vitest';

import {
  DOWNLOAD_LABEL,
  FIELD_ERRORS,
  filterLead,
  filterStateLine,
  FOLDER_PATH,
  NO_RECIPE_LINE,
  NOTHING_QUALIFIES_LINE,
  uncostableLine,
} from './filter-copy';

describe('the filter modal copy', () => {
  it('leads with the live threshold at 2dp and the recipe word', () => {
    expect(filterLead(0.25, 'greater')).toBe(
      'Shows the bases worth picking up at your threshold of 0.25 div with greater orbs. Your NeverSink filter handles everything else.',
    );
    expect(filterLead(3, 'perfect')).toContain('threshold of 3.00 div with perfect orbs.');
  });

  // Matrix: state 43.
  it('drops the recipe from the lead when no recipe is published (state 43)', () => {
    expect(filterLead(0.5, undefined)).toBe(
      'Shows the bases worth picking up at your threshold of 0.50 div. Your NeverSink filter handles everything else.',
    );
  });

  it('prints the folder path verbatim, %UserProfile% unexpanded, and the fixed file name', () => {
    expect(FOLDER_PATH).toBe(String.raw`%UserProfile%\Documents\My Games\Path of Exile 2`);
    expect(FOLDER_PATH.split('\\')).toEqual(['%UserProfile%', 'Documents', 'My Games', 'Path of Exile 2']);
    expect(DOWNLOAD_LABEL).toBe('Download crafting-bases.filter');
    expect(FIELD_ERRORS['quote-or-folder']).toBe('Enter the file name only, with no double quotes or folders.');
    expect(FIELD_ERRORS['own-name']).toBe("That is this filter's own name. Enter your own filter's file name.");
  });
});

describe('filterStateLine', () => {
  it('prints no line when a costable recipe yields entries', () => {
    expect(filterStateLine({ entryCount: 3, recipeWord: 'greater', isUncostable: false })).toBeUndefined();
  });

  // Matrix: state 43.
  it('prints the state 43 line (state 46) when no recipe is published', () => {
    expect(filterStateLine({ entryCount: 2, recipeWord: undefined, isUncostable: false })).toBe(NO_RECIPE_LINE);
  });

  it('prints the state 35 line (state 46) under an uncostable recipe', () => {
    expect(filterStateLine({ entryCount: 2, recipeWord: 'perfect', isUncostable: true })).toBe(uncostableLine('perfect'));
    expect(uncostableLine('perfect')).toBe(
      'The perfect orbs have no Craft Cost figure yet, so this filter marks only bases to sell as is.',
    );
  });

  // Matrix: states 35 and 47.
  it.each([
    ['an uncostable recipe', 'perfect', true],
    ['no recipe', undefined, false],
    ['a costable recipe', 'greater', false],
  ] as const)('prints only the state 47 line when nothing qualifies under %s', (_case, recipeWord, isUncostable) => {
    expect(filterStateLine({ entryCount: 0, recipeWord, isUncostable })).toBe(NOTHING_QUALIFIES_LINE);
  });
});
