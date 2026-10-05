import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/** Child run of `test/guard-concurrent.test.ts`; loads the real setup file, not a copy. */
export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ['*.fixture.ts'],
    setupFiles: [fileURLToPath(new URL('../setup.ts', import.meta.url))],
  },
});
