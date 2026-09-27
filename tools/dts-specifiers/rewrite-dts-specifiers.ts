import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Post-emit step of `pnpm typecheck`. `packages/contracts` is
 * `emitDeclarationOnly` with `allowImportingTsExtensions`, so its emitted
 * `.d.ts` files keep the source's `./x.ts` specifiers: TypeScript 6.0.3's
 * `rewriteRelativeImportExtensions` rewrites `.js` output only. A non-TypeScript
 * consumer of `dist` cannot follow `./x.ts`; `./x.js` resolves to the sibling
 * `x.d.ts` under every TypeScript module resolution mode.
 *
 * Only `pnpm typecheck` runs this rewrite: a bare `tsc -b`, watch mode or an
 * IDE build that re-emits contracts writes the `.ts` specifiers back.
 *
 * Run by bare `node` (type stripping), so this module imports only builtins.
 */

const EXTENSION_MAP: Readonly<Record<string, string>> = {
  ts: 'js',
  tsx: 'js',
  mts: 'mjs',
  cts: 'cjs',
};

/**
 * A module specifier in `from '…'`, `import('…')` or a side-effect
 * `import '…'`. Only relative specifiers (`./`, `../`) that end in a
 * TypeScript extension match.
 */
const SPECIFIER =
  /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"\r\n]*?)\.(ts|tsx|mts|cts)\2/g;

/** Rewrites each relative `.ts`/`.tsx`/`.mts`/`.cts` specifier in declaration text. */
export function rewriteDtsSpecifiers(text: string): string {
  return text.replace(
    SPECIFIER,
    (match, lead: string, quote: string, stem: string, extension: string) => {
      // `./types.d.ts` names a declaration file and is left as written.
      if (stem.endsWith('.d')) return match;
      return `${lead}${quote}${stem}.${EXTENSION_MAP[extension]}${quote}`;
    },
  );
}

function collectDeclarationFiles(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...collectDeclarationFiles(path));
    else if (/\.d\.[mc]?ts$/.test(name)) files.push(path);
  }
  return files;
}

/**
 * Rewrites every `**\/*.d.ts`, `.d.mts` and `.d.cts` under `dir` in place. Writes a file only when its
 * content changes, and returns the files it changed.
 */
export function rewriteDtsSpecifiersIn(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`declaration directory not found: ${dir}`);
  }
  const changed: string[] = [];
  for (const file of collectDeclarationFiles(dir)) {
    const before = readFileSync(file, 'utf8');
    const after = rewriteDtsSpecifiers(before);
    if (after !== before) {
      writeFileSync(file, after);
      changed.push(file);
    }
  }
  return changed;
}

/**
 * The directories the post-emit step rewrites. Only the contracts output: the
 * `@poe/contracts` `exports["."].types` surface.
 */
const TARGET_DIRS = [fileURLToPath(new URL('../../packages/contracts/dist', import.meta.url))];

/**
 * The entry guard. `node tools/dts-specifiers/rewrite-dts-specifiers.ts` runs
 * the rewrite; importing the module — which the co-located test does — runs
 * nothing. Realpaths both sides, as `packages/sync/src/sync.ts` and
 * `packages/sync/src/sync-batch.ts` do, so a
 * junction, symlink or drive-letter case mismatch still runs.
 */
function isInvokedDirectly(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(resolve(entry)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isInvokedDirectly()) {
  try {
    for (const dir of TARGET_DIRS) rewriteDtsSpecifiersIn(dir);
  } catch (error: unknown) {
    process.stderr.write(`rewrite-dts-specifiers: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
