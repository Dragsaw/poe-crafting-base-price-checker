/** The Base Filter's file name: states 44 and 45, the `.filter` completion and its persisted value (FR-7, AD-15). */

/** The one fixed name of the downloaded file (EXPERIENCE.md Copy Deck, *Pick-up Filter*). */
export const GENERATED_FILE_NAME = 'crafting-bases.filter';

const FILTER_EXTENSION = '.filter';

export const FILTER_NAME_STORAGE_KEY = 'poe-cbpc.baseFilterName';

/** Why a name cannot be used (state 45). */
export type FilterNameError = 'quote-or-folder' | 'own-name';

export type FilterNameCheck =
  | { readonly kind: 'empty' }
  | { readonly kind: 'unusable'; readonly error: FilterNameError }
  | { readonly kind: 'usable'; readonly importName: string };

const QUOTE_OR_FOLDER = /["/\\]/;

function withExtension(name: string): string {
  return name.toLowerCase().endsWith(FILTER_EXTENSION) ? name : name + FILTER_EXTENSION;
}

/** The field's text as the generated filter's `Import` target, or the state it puts the modal in. */
export function checkFilterName(text: string): FilterNameCheck {
  const name = text.trim();
  if (name === '') {
    return { kind: 'empty' };
  }
  if (QUOTE_OR_FOLDER.test(name)) {
    return { kind: 'unusable', error: 'quote-or-folder' };
  }
  const importName = withExtension(name);
  return importName.toLowerCase() === GENERATED_FILE_NAME
    ? { kind: 'unusable', error: 'own-name' }
    : { kind: 'usable', importName };
}

function defaultStorage(): Storage {
  return globalThis.localStorage;
}

/** The saved name, read once at mount, or `''` when nothing is stored or storage throws. */
export function readStoredFilterName(storage?: Pick<Storage, 'getItem'>): string {
  try {
    return (storage ?? defaultStorage()).getItem(FILTER_NAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Persists the field's text. A storage that throws is ignored. */
export function writeStoredFilterName(text: string, storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? defaultStorage()).setItem(FILTER_NAME_STORAGE_KEY, text);
  } catch {
    // Browser storage is a convenience: a blocked write leaves the page as it is.
  }
}
