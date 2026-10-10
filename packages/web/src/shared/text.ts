/** Text helpers every view folder shares. */

/** The no-break space: a Price State glyph never parts from its word (mockup `.ps-*::before`). */
export const NBSP = String.fromCodePoint(0xA0);

/** `singular` at exactly one, else `pluralForm`; a word only, so verbs agree too. */
export function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

/** The middle dot between a word and its reason, two reasons, two affixes or two notes (EXPERIENCE.md Copy Deck). */
export const JOINER = ' · ';
