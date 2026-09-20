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
