import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Child run of `test/guard-after-last-file.test.ts`: default pool and `isolate`, so the fixture is
// the last file of its worker; it loads the real setup file and global setup.
export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ['*.fixture.ts'],
    setupFiles: [fileURLToPath(new URL('../setup.ts', import.meta.url))],
    globalSetup: [fileURLToPath(new URL('../global-setup.ts', import.meta.url))],
  },
});
