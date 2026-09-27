import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { ALLOWLIST, prunePages } from '../tools/prune-pages.mjs';

/**
 * The prune step behind `pnpm build`. That its allowlist equals `ARTIFACTS` is
 * asserted in `packages/web/src/load/prune-allowlist.test.ts`, which can import
 * the web package; this file exercises what the step does to a `dist` tree.
 */

const scratch: string[] = [];

afterEach(() => {
  for (const dir of scratch.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tree(files: readonly string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'prune-pages-'));
  scratch.push(dir);
  for (const file of files) {
    const full = join(dir, ...file.split('/'));
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, '{}');
  }
  return dir;
}

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
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

const EIGHT: string[] = ALLOWLIST.map((entry: { readonly path: string }) => entry.path);
const UNFETCHED = ['sync-progress.json', 'currencies.json', 'catalogue/items.json', 'catalogue/filters.json'];
const BUNDLE = ['index.html', 'assets/index-abc123.js', 'assets/index-abc123.css'];

describe('the allowlist', () => {
  it('holds eight paths, five required and three tolerable', () => {
    expect(EIGHT).toHaveLength(8);
    expect(ALLOWLIST.filter((entry: { readonly required: boolean }) => !entry.required).map((entry: { readonly path: string }) => entry.path)).toEqual(
      ['sync-report.json', 'weights.json', 'recipes.json'],
    );
  });
});

describe('prunePages', () => {
  it('keeps the bundle and the eight artifacts, and deletes every other data/ file', () => {
    const data = tree([...EIGHT, ...UNFETCHED]);
    const dist = tree([...BUNDLE, ...EIGHT, ...UNFETCHED]);
    const result = prunePages(dist, data);
    expect(filesUnder(dist)).toEqual([...BUNDLE, ...EIGHT].sort());
    expect(result.removed.sort()).toEqual([...UNFETCHED].sort());
    expect(result.kept).toEqual(EIGHT);
  });

  it('removes a directory the prune leaves empty', () => {
    const data = tree([...EIGHT, 'extra/deep/file.json']);
    const dist = tree([...BUNDLE, ...EIGHT, 'extra/deep/file.json']);
    prunePages(dist, data);
    expect(readdirSync(dist).sort()).toEqual(['assets', 'catalogue', 'index.html', ...EIGHT.filter((p) => !p.includes('/'))].sort());
  });

  it('tolerates the three absent-tolerable artifacts being missing', () => {
    const present = EIGHT.filter((path) => !['sync-report.json', 'weights.json', 'recipes.json'].includes(path));
    const data = tree(present);
    const dist = tree([...BUNDLE, ...present]);
    expect(prunePages(dist, data).kept).toEqual(present);
  });

  it.each(['dataset.json', 'tracked.json', 'config.json', 'catalogue/stats.json', 'catalogue/static.json'])(
    'fails loudly, naming it, when required %s is missing',
    (missing) => {
      const present = EIGHT.filter((path) => path !== missing);
      const data = tree(present);
      const dist = tree([...BUNDLE, ...present]);
      expect(() => prunePages(dist, data)).toThrow(missing);
    },
  );

  it('fails when there is no build output', () => {
    const data = tree(EIGHT);
    expect(() => prunePages(join(data, 'no-such-dist'), data)).toThrow(/no build output/);
  });
});

describe('the CLI and the build script', () => {
  const SCRIPT = fileURLToPath(new URL('../tools/prune-pages.mjs', import.meta.url));
  const ROOT_MANIFEST = fileURLToPath(new URL('../package.json', import.meta.url));

  /** A temp repo root: `tools/prune-pages.mjs`, `data/`, and `packages/web/dist` as `vite build` leaves it. */
  function repo(dataFiles: readonly string[]): { readonly root: string; readonly script: string; readonly dist: string } {
    const root = tree([
      ...dataFiles.map((file) => `data/${file}`),
      ...BUNDLE.map((file) => `packages/web/dist/${file}`),
      ...dataFiles.map((file) => `packages/web/dist/${file}`),
    ]);
    const script = join(root, 'tools', 'prune-pages.mjs');
    mkdirSync(dirname(script), { recursive: true });
    copyFileSync(SCRIPT, script);
    return { root, script, dist: join(root, 'packages', 'web', 'dist') };
  }

  it('prunes packages/web/dist when run directly', () => {
    const { script, dist } = repo([...EIGHT, 'sync-progress.json']);
    execFileSync(process.execPath, [script], { stdio: 'pipe' });
    expect(existsSync(join(dist, 'sync-progress.json'))).toBe(false);
    expect(filesUnder(dist)).toEqual([...BUNDLE, ...EIGHT].sort());
  });

  it('exits non-zero when a required artifact is missing', () => {
    const { script } = repo([...EIGHT.filter((path) => path !== 'tracked.json'), 'sync-progress.json']);
    expect(() => execFileSync(process.execPath, [script], { stdio: 'pipe' })).toThrow(/tracked\.json/);
  });

  it('runs the prune after vite build in `pnpm build`', () => {
    const manifest = JSON.parse(readFileSync(ROOT_MANIFEST, 'utf8')) as { readonly scripts: Record<string, string> };
    expect(manifest.scripts['build']).toMatch(/&& node tools\/prune-pages\.mjs$/);
  });
});
