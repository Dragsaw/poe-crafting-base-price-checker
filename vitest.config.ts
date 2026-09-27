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
        test: {
          name: 'root',
          root: import.meta.dirname,
          include: [
            'test/**/*.test.ts',
            'tools/boundary-check/*.test.ts',
            'tools/deferred-issues/*.test.ts',
            'tools/dev-stop/*.test.ts',
            'tools/dts-specifiers/*.test.ts',
            '.claude/skills/tracked-json/scripts/*.test.ts',
          ],
          setupFiles: ['./test/setup.ts'],
        },
      },
    ],
  },
});
