#!/usr/bin/env node
// Trims the Pages copy of `data/` to the AD-24 artifacts; the bundle's own output stays.
// A missing required artifact fails the build; the three optional ones may be absent.

import { existsSync, readdirSync, rmdirSync, rmSync, statSync } from 'node:fs';
import nodePath from 'node:path';

/** Mirrors `ARTIFACTS` in `packages/web/src/load/artifacts.ts`; a test pins both. */
export const ALLOWLIST = [
  { path: 'dataset.json', required: true },
  { path: 'sync-report.json', required: false },
  { path: 'weights.json', required: false },
  { path: 'recipes.json', required: false },
  { path: 'tracked.json', required: true },
  { path: 'config.json', required: true },
  { path: 'catalogue/stats.json', required: true },
];

/** Every file under `directory`, as a `/`-separated path relative to `directory`. */
function filesUnder(directory) {
  const out = [];
  const walk = (current) => {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = nodePath.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        out.push(nodePath.relative(directory, full).split(nodePath.sep).join('/'));
      }
    }
  };
  walk(directory);
  return out.toSorted((a, b) => Number(a > b) - Number(a < b));
}

/** Removes `directory` and its parents up to (not including) `stop`, while each is empty. */
function removeEmptyDirectories(directory, stop) {
  let current = directory;
  while (current !== stop && current.startsWith(stop) && existsSync(current) && readdirSync(current).length === 0) {
    rmdirSync(current);
    current = nodePath.resolve(current, '..');
  }
}

/** Returns what it kept and removed; throws, naming each, when a required artifact is missing. */
export function prunePages(distributionDirectory, dataDirectory) {
  if (!existsSync(distributionDirectory) || !statSync(distributionDirectory).isDirectory()) {
    throw new Error(`prune-pages: no build output at ${distributionDirectory}; run vite build first.`);
  }
  const allowed = new Set(ALLOWLIST.map((artifact) => artifact.path));
  const removed = [];
  for (const path of filesUnder(dataDirectory)) {
    if (allowed.has(path)) {
      continue;
    }
    const target = nodePath.join(distributionDirectory, ...path.split('/'));
    if (!existsSync(target)) {
      continue;
    }

    rmSync(target);
    removed.push(path);
    removeEmptyDirectories(nodePath.resolve(target, '..'), nodePath.resolve(distributionDirectory));
  }
  const missing = ALLOWLIST.filter((artifact) => artifact.required && !existsSync(nodePath.join(distributionDirectory, ...artifact.path.split('/'))));
  if (missing.length > 0) {
    throw new Error(
      `prune-pages: required artifact(s) missing from ${distributionDirectory}: ${missing.map((artifact) => artifact.path).join(', ')}`,
    );
  }
  const kept = ALLOWLIST.map((artifact) => artifact.path).filter((path) => existsSync(nodePath.join(distributionDirectory, ...path.split('/'))));
  return { kept, removed };
}

// `import.meta.main` (Node >= 24.2), not a URL comparison with `process.argv[1]`:
// a junction, a symlink or a drive-letter case difference would make that
// comparison false, and the build would publish all of `data/` and exit 0.
if (import.meta.main) {
  const root = nodePath.resolve(import.meta.dirname, '..');
  const distributionDirectory = nodePath.resolve(root, 'packages/web/dist');
  try {
    const { kept, removed } = prunePages(distributionDirectory, nodePath.resolve(root, 'data'));
    console.log(`prune-pages: kept ${kept.join(', ')}`);
    console.log(`prune-pages: removed ${removed.length === 0 ? 'nothing' : removed.join(', ')}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
