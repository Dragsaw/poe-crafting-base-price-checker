import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'sync',
    include: ['src/**/*.test.ts'],
    setupFiles: ['../../test/setup.ts'],
  },
});
