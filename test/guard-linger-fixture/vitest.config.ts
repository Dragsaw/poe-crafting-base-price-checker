import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/** Child run of `test/guard-linger.test.ts`; loads the real setup file, not a copy. */
export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ['*.fixture.ts'],
    setupFiles: [fileURLToPath(new URL('../setup.ts', import.meta.url))],
    // The file-level `afterAll` of `linger.fixture.ts` must run before the setup file's check.
    sequence: { hooks: 'stack' },
  },
});
