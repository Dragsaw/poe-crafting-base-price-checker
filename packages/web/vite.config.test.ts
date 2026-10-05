import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import config from './vite.config';

/** The dev-server port contract, asserted: deleting `strictPort` would keep the suite green. */
it('binds one explicit port and fails rather than moving', () => {
  expect(config.server?.strictPort).toBe(true);
  expect(config.server?.port).toBe(5173);
});

/** AD-24 artifacts are static files, never bundle contents; `base: './'` keeps URLs relative. */
it('serves the repo data/ folder as static files under a relative base', () => {
  expect(config.publicDir).toBe(nodePath.resolve(import.meta.dirname, '../../data'));
  expect(config.base).toBe('./');
  // A missing artifact must be a 404, never the SPA fallback's index.html.
  expect(config.appType).toBe('mpa');
});

it('never imports data/** from source', () => {
  const offenders: string[] = [];
  const walk = (directory: string): void => {
    const entries = readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const full = nodePath.join(directory, entry.name);
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
