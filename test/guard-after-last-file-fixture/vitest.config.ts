import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * The child run of `test/guard-after-last-file.test.ts`. The default pool and
 * `isolate`, so the fixture file is the last file of its worker. It loads the
 * **real** setup file and the **real** global setup.
 */
export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ['*.fixture.ts'],
    setupFiles: [fileURLToPath(new URL('../setup.ts', import.meta.url))],
    globalSetup: [fileURLToPath(new URL('../global-setup.ts', import.meta.url))],
  },
});
