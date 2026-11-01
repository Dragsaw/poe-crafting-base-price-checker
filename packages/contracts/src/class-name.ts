/** The `className` grammar, both arms, defined once for the weights schema, `sync` and `core`. */

/** `str` → armour, `dex` → evasion, `int` → energy shield (WEIGHTS-FILE-SCHEMA.md `5.1.0`). */
export const DEFENCE_OF_LETTER = { str: 'ar', dex: 'ev', int: 'es' } as const;
export type DefenceLetter = keyof typeof DEFENCE_OF_LETTER;

function isDefenceLetter(token: string): token is DefenceLetter {
  return Object.hasOwn(DEFENCE_OF_LETTER, token);
}

/** Arm 1's split: the maximal trailing run of defence tokens. `undefined` means plain. */
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

/** Arm 2's base type: a plain `className` with each `_` written as a space (WEIGHTS-FILE-SCHEMA.md `5.1.0`). */
export function plainClassBaseTypeOf(className: string): string {
  return className.replaceAll('_', ' ');
}
