#!/usr/bin/env node
// Trims the Pages copy of `data/` to the seven AD-24 artifacts.
//
// `vite build` copies all of `data/` into `packages/web/dist` (it is the web
// package's `publicDir`), including files the page never fetches:
// `sync-progress.json`, `currencies.json`, `catalogue/items.json`,
// `catalogue/filters.json` and `catalogue/static.json`. This step deletes
// every file that came from `data/` and is not on the allowlist, then removes
// any directory that leaves empty.
// It touches nothing the bundle emitted (`index.html`, `assets/`).
//
// A required artifact missing from `dist` fails the build loudly. The three
// absent-tolerable artifacts may be missing: the page renders and names each.
//
// The allowlist mirrors `ARTIFACTS` in `packages/web/src/load/artifacts.ts`;
// `packages/web/src/load/prune-allowlist.test.ts` asserts the two are equal.

import { existsSync, readdirSync, rmdirSync, rmSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/** The seven artifacts, by published path, in AD-24 order. */
export const ALLOWLIST = [
  { path: 'dataset.json', required: true },
  { path: 'sync-report.json', required: false },
  { path: 'weights.json', required: false },
  { path: 'recipes.json', required: false },
  { path: 'tracked.json', required: true },
  { path: 'config.json', required: true },
  { path: 'catalogue/stats.json', required: true },
];

/** Every file under `dir`, as a `/`-separated path relative to `dir`. */
function filesUnder(dir) {
  const out = [];
  const walk = (current) => {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        out.push(relative(dir, full).split(sep).join('/'));
      }
    }
  };
  walk(dir);
  return out.sort();
}

/** Removes `dir` and its parents up to (not including) `stop`, while each is empty. */
function removeEmptyDirectories(dir, stop) {
  let current = dir;
  while (current !== stop && current.startsWith(stop) && existsSync(current) && readdirSync(current).length === 0) {
    rmdirSync(current);
    current = resolve(current, '..');
  }
}

/**
 * Prunes `distDir` of every file that `dataDir` published and the allowlist
 * does not name. Returns what it kept and removed. Throws, naming each, when a
 * required artifact is missing from `distDir`.
 */
export function prunePages(distDir, dataDir) {
  if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
    throw new Error(`prune-pages: no build output at ${distDir}; run vite build first.`);
  }
  const allowed = new Set(ALLOWLIST.map((artifact) => artifact.path));
  const removed = [];
  for (const path of filesUnder(dataDir)) {
    if (allowed.has(path)) {
      continue;
    }
    const target = join(distDir, ...path.split('/'));
    if (!existsSync(target)) {
      continue;
    }

    rmSync(target);
    removed.push(path);
    removeEmptyDirectories(resolve(target, '..'), resolve(distDir));
  }
  const missing = ALLOWLIST.filter((artifact) => artifact.required && !existsSync(join(distDir, ...artifact.path.split('/'))));
  if (missing.length > 0) {
    throw new Error(
      `prune-pages: required artifact(s) missing from ${distDir}: ${missing.map((artifact) => artifact.path).join(', ')}`,
    );
  }
  const kept = ALLOWLIST.map((artifact) => artifact.path).filter((path) => existsSync(join(distDir, ...path.split('/'))));
  return { kept, removed };
}

// `import.meta.main` (Node >= 24.2), not a URL comparison with `process.argv[1]`:
// a junction, a symlink or a drive-letter case difference would make that
// comparison false, and the build would publish all of `data/` and exit 0.
if (import.meta.main) {
  const root = resolve(import.meta.dirname, '..');
  const distDir = resolve(root, 'packages/web/dist');
  try {
    const { kept, removed } = prunePages(distDir, resolve(root, 'data'));
    console.log(`prune-pages: kept ${kept.join(', ')}`);
    console.log(`prune-pages: removed ${removed.length === 0 ? 'nothing' : removed.join(', ')}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
