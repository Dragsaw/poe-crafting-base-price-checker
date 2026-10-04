import { defineConfig } from 'vitest/config';

/**
 * `vitest.workspace.ts` does not exist in Vitest 5 — projects are declared here.
 * `packages/*` picks up each package's own config; the inline project carries
 * the workspace-level guards, which belong to no package.
 */
export default defineConfig({
  test: {
    projects: [
      'packages/*',
      {
        // The invariants of the live `data/`, run by `pnpm test:data` and
        // excluded from `pnpm test`. Every package project excludes `*.data.test.*`.
        test: {
          name: 'data',
          root: import.meta.dirname,
          include: ['packages/*/src/**/*.data.test.{ts,tsx}'],
          setupFiles: ['./test/setup.ts'],
          globalSetup: ['./test/global-setup.ts'],
        },
      },
      {
        test: {
          name: 'root',
          root: import.meta.dirname,
          include: [
            'test/**/*.test.ts',
            'tools/boundary-check/*.test.ts',
            'tools/deferred-issues/*.test.ts',
            'tools/dev-stop/*.test.ts',
            'tools/dts-specifiers/*.test.ts',
            'tools/lint-on-edit/*.test.ts',
            '.claude/skills/tracked-json/scripts/*.test.ts',
          ],
          setupFiles: ['./test/setup.ts'],
          globalSetup: ['./test/global-setup.ts'],
        },
      },
    ],
  },
});
