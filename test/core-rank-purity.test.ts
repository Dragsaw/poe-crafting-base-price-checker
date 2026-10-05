import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

// AD-1, NFR-3: time, randomness and environment enter `core` only as arguments. Lives here, not
// in `core`, because `core`'s compilation carries no Node types to read a file with.
it('core/src/rank.ts references no Date, Math.random, process or import.meta', () => {
  const source = readFileSync(new URL('../packages/core/src/rank.ts', import.meta.url), 'utf8');
  // Whole identifiers only, so prose such as "processed" or "Dated" in a comment passes.
  for (const banned of [/\bDate\b/, /\bMath\.random\b/, /\bprocess\b/, /\bimport\.meta\b/]) {
    expect(source, `rank.ts references ${banned.source}`).not.toMatch(banned);
  }
});
