import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

/**
 * Story 2.2: the ranking is a pure function of its passed-in values (AD-1,
 * NFR-3). Time, randomness and environment enter `core` only as arguments, so
 * `rank.ts` names none of them. It lives here, not in `core`, because `core`'s
 * compilation carries no Node types to read a file with.
 */
it('core/src/rank.ts references no Date, Math.random, process or import.meta', () => {
  const source = readFileSync(new URL('../packages/core/src/rank.ts', import.meta.url), 'utf8');
  // Whole identifiers only, so prose such as "processed" or "Dated" in a comment passes.
  for (const banned of [/\bDate\b/, /\bMath\.random\b/, /\bprocess\b/, /\bimport\.meta\b/]) {
    expect(source, `rank.ts references ${banned.source}`).not.toMatch(banned);
  }
});
