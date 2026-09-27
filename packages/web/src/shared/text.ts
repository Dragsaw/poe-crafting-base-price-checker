/** Text helpers every view folder shares. */

/**
 * The no-break space that joins a strip label to its value and a glyph to its
 * word: a Price State glyph never parts from its word (mockup `.ps-*::before`).
 */
export const NBSP = String.fromCodePoint(0xa0);

/**
 * The form of a word that agrees with `count`: `singular` at exactly one,
 * `pluralForm` otherwise (zero included). It returns the word only, so a
 * caller can agree a verb as well as a noun: `plural(n, 'was', 'were')`.
 */
export function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}
