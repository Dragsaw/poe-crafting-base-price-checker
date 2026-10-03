import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'sync',
    include: ['src/**/*.test.ts'],
    exclude: ['**/*.data.test.ts', '**/node_modules/**'],
    setupFiles: ['../../test/setup.ts'],
    globalSetup: ['../../test/global-setup.ts'],
  },
});
