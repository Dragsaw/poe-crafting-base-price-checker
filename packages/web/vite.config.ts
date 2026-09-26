import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

/**
 * No PostCSS and no `@vitejs/plugin-react`: `@mantine/core` ships pre-built CSS
 * and neither Fast Refresh nor DevTools naming is needed by a placeholder build
 * or a jsdom test. Vite 8 transforms JSX with Oxc and the automatic runtime is
 * its default, so no JSX option is configured either.
 *
 * `strictPort` is the load-bearing setting: a taken port must be a loud bind
 * failure, never a silent move to the next one — that is how an agent in a
 * second worktree ends up reporting on another worktree's build. Override the
 * port on the command line (`pnpm dev --port 5174`), never by editing this file.
 */
export default defineConfig({
  // `import.meta.dirname`, not `fileURLToPath(import.meta.url)`: the config is
  // imported by its own test, where `import.meta.url` is not a `file:` URL.
  root: import.meta.dirname,
  // The eight AD-24 artifacts are served, never bundled: `publicDir` is the repo
  // `data/` folder, copied verbatim into `dist/` by the build and fetched at
  // runtime. Source never imports `data/**`.
  publicDir: resolve(import.meta.dirname, '../../data'),
  // Relative asset and fetch URLs, so the static site works under any Pages path.
  base: './',
  // No SPA fallback: a missing artifact must answer 404 (absent), never
  // index.html with a 200 (which the loader would refuse as invalid).
  appType: 'mpa',
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'vite.config.test.ts'],
    setupFiles: ['../../test/setup.ts', './src/test-setup.ts'],
  },
});
