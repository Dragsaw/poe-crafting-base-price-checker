import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import { isInvokedDirectly } from '../entry-guard/is-invoked-directly.ts';

// Post-emit step of `pnpm typecheck`: `rewriteRelativeImportExtensions` rewrites `.js` output
// only, so emitted `.d.ts` files keep `./x.ts`, which a consumer of `dist` cannot follow.
// Run by bare `node` (type stripping), so this module imports only builtins and `.ts` siblings.

const EXTENSION_MAP: Readonly<Record<string, string>> = {
  ts: 'js',
  tsx: 'js',
  mts: 'mjs',
  cts: 'cjs',
};

// Matches only relative specifiers that end in a TypeScript extension, in `from '…'`,
// `import('…')` or a side-effect `import '…'`.
const SPECIFIER =
  /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"\r\n]*?)\.(ts|tsx|mts|cts)\2/g;

/** Rewrites each relative `.ts`/`.tsx`/`.mts`/`.cts` specifier in declaration text. */
export function rewriteDtsSpecifiers(text: string): string {
  return text.replaceAll(
    SPECIFIER,
    (match, ...[lead, quote, stem, extension]: [string, string, string, string]) => {
      // `./types.d.ts` names a declaration file and is left as written.
      return stem.endsWith('.d') ? match : `${lead}${quote}${stem}.${EXTENSION_MAP[extension]}${quote}`;
    },
  );
}

function collectDeclarationFiles(directory: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(directory)) {
    const path = nodePath.join(directory, name);
    if (statSync(path).isDirectory()) {files.push(...collectDeclarationFiles(path));}
    else if (/\.d\.[mc]?ts$/.test(name)) {files.push(path);}
  }
  return files;
}

/** Rewrites every declaration file under `directory` in place; returns the files it changed. */
export function rewriteDtsSpecifiersIn(directory: string): string[] {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    throw new Error(`declaration directory not found: ${directory}`);
  }
  const changed: string[] = [];
  for (const file of collectDeclarationFiles(directory)) {
    const before = readFileSync(file, 'utf8');
    const after = rewriteDtsSpecifiers(before);
    if (after === before) {
      continue;
    }

    writeFileSync(file, after);
    changed.push(file);
  }
  return changed;
}

// The `emitDeclarationOnly` packages; `rewrite-dts-specifiers.test.ts` compares this list
// with the packages whose resolved `tsconfig.json` sets that option.
export const TARGET_PACKAGES: readonly string[] = ['contracts', 'core', 'sync'];

// The `dist` of each target package, which its `exports["."].types` names.
const TARGET_DIRS = TARGET_PACKAGES.map((package_) =>
  fileURLToPath(new URL(`../../packages/${package_}/dist`, import.meta.url)),
);

if (isInvokedDirectly(import.meta.url)) {
  try {
    for (const directory of TARGET_DIRS) {rewriteDtsSpecifiersIn(directory);}
  } catch (error: unknown) {
    process.stderr.write(`rewrite-dts-specifiers: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
