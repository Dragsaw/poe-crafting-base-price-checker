import nodePath from 'node:path';

import { defineConfig } from 'vitest/config';

// No PostCSS and no `@vitejs/plugin-react`: `@mantine/core` ships pre-built CSS and Vite 8 does JSX
// with Oxc. A taken port must fail loudly (`strictPort`), never silently move on (AGENTS.md).
export default defineConfig({
  // `import.meta.dirname`, not `fileURLToPath(import.meta.url)`: the config is
  // imported by its own test, where `import.meta.url` is not a `file:` URL.
  root: import.meta.dirname,
  // The seven AD-24 artifacts are served, never bundled: `publicDir` is the repo
  // `data/` folder, copied verbatim into `dist/` by the build and fetched at
  // runtime. Source never imports `data/**`.
  publicDir: nodePath.resolve(import.meta.dirname, '../../data'),
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
    exclude: ['**/*.data.test.{ts,tsx}', '**/node_modules/**'],
    setupFiles: ['../../test/setup.ts', './src/test-setup.ts'],
  },
});
