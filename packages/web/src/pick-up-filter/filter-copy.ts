/** The filter button's and the filter modal's strings (EXPERIENCE.md Copy Deck, *Pick-up Filter*). */

import { formatThreshold } from '../shared/money';
import { DIV_UNIT } from '../shared/product';
import { GENERATED_FILE_NAME, type FilterNameError } from './filter-name';

/** The button's word; its ▾ is the drawn open sign. */
export const FILTER_BUTTON_LABEL = 'Filter';

export const FILTER_MODAL_TITLE = 'Pick-up filter';

export const FOLDER_PATH = String.raw`%UserProfile%\Documents\My Games\Path of Exile 2`;

export const COPY_LABEL = 'Copy';
export const COPIED_LABEL = 'Copied';
/** How long the copy action reads `Copied`. */
export const COPIED_MS = 2000;

export const FILTER_STEPS = [
  'Download your NeverSink filter from FilterBlade for offline use, and save it in this folder:',
  "Enter that file's name:",
  'Download this filter and save it in the same folder, over the last one. Your browser must ask where to save each download (Settings › Downloads).',
  'In the game, select crafting-bases once. After each download, reload the filter.',
] as const;

export const FIELD_PLACEHOLDER = "e.g. NeverSink's filter 2 - 3-STRICT.filter";

export const FIELD_ERRORS: Readonly<Record<FilterNameError, string>> = {
  'quote-or-folder': 'Enter the file name only, with no double quotes or folders.',
  'own-name': "That is this filter's own name. Enter your own filter's file name.",
};

export const DOWNLOAD_LABEL = `Download ${GENERATED_FILE_NAME}`;

export const NO_RECIPE_LINE = 'No recipe is published, so this filter marks only bases to sell as is.';

export const NOTHING_QUALIFIES_LINE = 'Nothing qualifies right now. The filter holds only the import of your own filter.';

/** The lead's opening, which the Copy Deck owns. */
export const LEAD_OPENING = 'Shows the bases worth picking up';

/** The modal's lead: the live threshold, and the recipe's word unless none is published (state 43). */
export function filterLead(threshold: number, recipeWord: string | undefined): string {
  const recipe = recipeWord === undefined ? '' : ` with ${recipeWord} orbs`;
  return `${LEAD_OPENING} at your threshold of ${formatThreshold(threshold)} ${DIV_UNIT}${recipe}. Your NeverSink filter handles everything else.`;
}

/** State 46's line under an uncostable recipe (state 35). */
export function uncostableLine(recipeWord: string): string {
  return `The ${recipeWord} orbs have no Craft Cost figure yet, so this filter marks only bases to sell as is.`;
}

export interface FilterStateInput {
  /** The number of entries the purpose function returned. */
  readonly entryCount: number;
  /** The active recipe's word, or `undefined` under state 43. */
  readonly recipeWord: string | undefined;
  /** The active recipe is uncostable (state 35). */
  readonly isUncostable: boolean;
}

/** The one line above the download: state 47's replaces state 46's; `undefined` when neither holds. */
export function filterStateLine({ entryCount, recipeWord, isUncostable }: FilterStateInput): string | undefined {
  if (entryCount === 0) {
    return NOTHING_QUALIFIES_LINE;
  }
  if (recipeWord === undefined) {
    return NO_RECIPE_LINE;
  }
  return isUncostable ? uncostableLine(recipeWord) : undefined;
}
