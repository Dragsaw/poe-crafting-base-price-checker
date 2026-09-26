import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * The child run of `test/guard-linger.test.ts`. It loads the **real** setup
 * file, so the child observes the shipped hooks and not a copy of them.
 */
export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ['*.fixture.ts'],
    setupFiles: [fileURLToPath(new URL('../setup.ts', import.meta.url))],
    // The file-level `afterAll` of `linger.fixture.ts` must run before the setup file's check.
    sequence: { hooks: 'stack' },
  },
});
