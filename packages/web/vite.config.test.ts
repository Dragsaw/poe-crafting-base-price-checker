import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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

const sourceRoot = nodePath.resolve(import.meta.dirname, 'src');

function stylesheets(directory = sourceRoot): readonly (readonly [string, string])[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = nodePath.join(directory, entry.name);
    if (entry.isDirectory()) {
      return stylesheets(full);
    }
    return entry.name.endsWith('.css') ? [[full, readFileSync(full, 'utf8')] as const] : [];
  });
}

/** Each `--fg-color-*` a stylesheet reads is a current colour token (theme.ts sets one per token). */
it('reads no --fg-color-* name in a stylesheet that is not a current token', () => {
  // `tokens.test.ts` holds `colors` equal to these DESIGN.md names.
  const design = readFileSync(
    nodePath.resolve(import.meta.dirname, '../../docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/DESIGN.md'),
    'utf8',
  );
  const block = design.split(/^colors:$/m, 2)[1]?.split(/^typography:$/m, 1)[0] ?? '';
  const current = new Set(block.matchAll(/^ {2}([a-z-]+):/gm).map(([, name = '']) => name));
  expect(current.size).toBeGreaterThan(10);
  const sheets = stylesheets();
  expect(sheets.length).toBeGreaterThan(3);
  const unknown = sheets.flatMap(([path, text]) =>
    text
      .matchAll(/--fg-color-([a-z-]+)/g)
      .map(([, name = '']) => name)
      .filter((name) => !current.has(name))
      .map((name) => `${nodePath.basename(path)}: --fg-color-${name}`)
      .toArray(),
  );
  expect(unknown).toEqual([]);
});

/** NFR-7: Inter is bound to the DESIGN.md family name from the bundled package files only. */
it('serves Inter from the bundled package and fetches no font from a third party', () => {
  const sheets = stylesheets();
  const faces = sheets.find(([path]) => path.endsWith(nodePath.join('theme', 'inter.css')))?.[1] ?? '';
  const sources = faces.matchAll(/url\('([^']+)'\)/g).map(([, url = '']) => url).toArray();
  expect(faces).toMatch(/font-family: Inter;/);
  expect(sources.length).toBeGreaterThan(0);
  const fontPackage = nodePath.dirname(
    createRequire(import.meta.url).resolve('@fontsource-variable/inter/package.json'),
  );
  for (const url of sources) {
    expect(url).toMatch(/^@fontsource-variable\/inter\/files\/inter-[a-z-]+-wght-normal\.woff2$/);
    expect(existsSync(nodePath.join(fontPackage, url.replace('@fontsource-variable/inter/', ''))), url).toBe(true);
  }
  expect(readFileSync(nodePath.join(sourceRoot, 'main.tsx'), 'utf8')).toMatch(/^import '\.\/theme\/inter\.css';$/m);
  for (const [path, text] of sheets) {
    expect(text, path).not.toMatch(/fonts\.(googleapis|gstatic)\.com|url\(\s*['"]?https?:/);
  }
  expect(readFileSync(nodePath.resolve(import.meta.dirname, 'index.html'), 'utf8')).not.toMatch(/https?:\/\//);
});

it('pins @fontsource-variable/inter to the spine Stack table version exactly', () => {
  const spine = readFileSync(
    nodePath.resolve(
      import.meta.dirname,
      '../../docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md',
    ),
    'utf8',
  );
  const pinned = /\| Inter, bundled variable face \(`@fontsource-variable\/inter`\) \| (\S+) \|/.exec(spine)?.[1];
  const manifest = JSON.parse(readFileSync(nodePath.resolve(import.meta.dirname, 'package.json'), 'utf8')) as {
    readonly dependencies: Readonly<Record<string, string>>;
  };
  expect(pinned).toBe('5.3.0');
  expect(manifest.dependencies['@fontsource-variable/inter']).toBe(pinned);
});
