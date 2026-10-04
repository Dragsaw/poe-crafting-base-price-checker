import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import config from './vite.config';

/**
 * The dev-server port contract, asserted rather than trusted. No acceptance
 * criterion may require a running server, so these two settings are otherwise
 * unguarded — delete `strictPort` and the suite would stay green while Vite
 * silently bumped a second worktree onto a free port, which is how an agent
 * ends up reporting on another agent's build.
 */
it('binds one explicit port and fails rather than moving', () => {
  expect(config.server?.strictPort).toBe(true);
  expect(config.server?.port).toBe(5173);
});

/**
 * The seven AD-24 artifacts are copied static files, never bundle contents
 * (AD-24). `publicDir` is what serves and copies them, and `base: './'` keeps
 * every URL relative so the built site works under any Pages path.
 */
it('serves the repo data/ folder as static files under a relative base', () => {
  expect(config.publicDir).toBe(nodePath.resolve(import.meta.dirname, '../../data'));
  expect(config.base).toBe('./');
  // A missing artifact must be a 404, never the SPA fallback's index.html.
  expect(config.appType).toBe('mpa');
});

it('never imports data/** from source', () => {
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = nodePath.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        const text = readFileSync(full, 'utf8');
        if (/from\s+['"][^'"]*\bdata\//.test(text) || /import\(\s*['"][^'"]*\bdata\//.test(text)) {
          offenders.push(full);
        }
      }
    }
  };
  walk(nodePath.resolve(import.meta.dirname, 'src'));
  expect(offenders).toEqual([]);
});
