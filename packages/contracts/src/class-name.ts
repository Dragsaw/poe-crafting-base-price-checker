/**
 * The inner `className` key's grammar (WEIGHTS-FILE-SCHEMA.md `5.1.0`,
 * IMPLEMENTATION-NOTES.md §10.2 arm 1), defined once. The weights schema's
 * distinctness and no-mixing rule and `sync`'s search-body discriminator both
 * read it from here.
 */

/** `str` → armour, `dex` → evasion, `int` → energy shield (WEIGHTS-FILE-SCHEMA.md `5.1.0`). */
export const DEFENCE_OF_LETTER = { str: 'ar', dex: 'ev', int: 'es' } as const;
export type DefenceLetter = keyof typeof DEFENCE_OF_LETTER;

function isDefenceLetter(token: string): token is DefenceLetter {
  return Object.hasOwn(DEFENCE_OF_LETTER, token);
}

/**
 * Arm 1's split: the **maximal trailing run** of `str` / `dex` / `int` tokens,
 * greedy from the right and without repetition, with at least one token before
 * it. `undefined` means the class is plain.
 */
export function defenceLettersOf(className: string): ReadonlySet<DefenceLetter> | undefined {
  const tokens = className.split('_');
  const letters = new Set<DefenceLetter>();
  let index = tokens.length - 1;
  while (index > 0) {
    const token = tokens[index];
    if (token === undefined || !isDefenceLetter(token) || letters.has(token)) {
      break;
    }
    letters.add(token);
    index -= 1;
  }
  return letters.size === 0 ? undefined : letters;
}
