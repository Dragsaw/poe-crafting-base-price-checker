import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

/**
 * AD-30, IMPLEMENTATION-NOTES.md §13: only the `pnpm sync` and
 * `pnpm sync:batch` shells read the session cookie, and only the auth holder
 * keeps it. `catalogue:refresh`, `fixtures:record` and `sync:dry` cannot reach
 * the holder. This scan keeps that boundary from eroding: in non-test source
 * under `packages/*\/src`, only the files below may name the variable or
 * import the holder module.
 */

const PACKAGES_DIR = fileURLToPath(new URL('../packages', import.meta.url));

const NAMES_VARIABLE = /poesessid/i;
const IMPORTS_HOLDER = /from\s+['"][^'"]*session-auth(?:\.ts)?['"]/;

/** May name the variable: the two shells and the holder. */
const MAY_NAME = new Set(['sync/src/sync.ts', 'sync/src/sync-batch.ts', 'sync/src/trade/session-auth.ts']);

/** May import the holder's values: the two shells. */
const MAY_IMPORT = new Set(['sync/src/sync.ts', 'sync/src/sync-batch.ts']);

/** May import the holder's type only (`import type`): the governor path. */
const MAY_IMPORT_TYPE = new Set(['sync/src/compose-chunk.ts', 'sync/src/trade/client.ts']);
const TYPE_IMPORT = /^\s*import\s+type\s/;

/** `fixtures-record.ts` already redacts a recorded header by this key; that one line is allowed. */
const FIXTURES_RECORD = 'sync/src/fixtures-record.ts';
const FIXTURES_RECORD_KEY = /^\s*'poesessid',\s*$/;

function sourceFilesUnder(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...sourceFilesUnder(path));
      continue;
    }
    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) {
      continue;
    }
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      found.push(path);
    }
  }
  return found;
}

function packageSources(): string[] {
  const sources: string[] = [];
  for (const entry of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      sources.push(...sourceFilesUnder(join(PACKAGES_DIR, entry.name, 'src')));
    } catch (error) {
      // A package with no `src` yet is not a failure; any other read fault is.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
  return sources;
}

it('only the sync shells and the holder name the session cookie or import the holder', () => {
  const offences: string[] = [];
  for (const path of packageSources()) {
    const name = relative(PACKAGES_DIR, path).split(sep).join('/');
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      const where = `${name}:${String(index + 1)}`;
      if (NAMES_VARIABLE.test(line) && !MAY_NAME.has(name) && !(name === FIXTURES_RECORD && FIXTURES_RECORD_KEY.test(line))) {
          offences.push(`${where} names the session cookie: ${line.trim()}`);
        }
      if (IMPORTS_HOLDER.test(line) && !MAY_IMPORT.has(name) && !(MAY_IMPORT_TYPE.has(name) && TYPE_IMPORT.test(line))) {
          offences.push(`${where} imports the auth holder: ${line.trim()}`);
        }
    });
  }
  expect(offences).toEqual([]);
});

it('the two shells do read the variable through the holder', () => {
  for (const shell of ['sync/src/sync.ts', 'sync/src/sync-batch.ts']) {
    const text = readFileSync(join(PACKAGES_DIR, shell), 'utf8');
    expect(text, shell).toMatch(/createSessionAuth\(env[,)]/);
  }
});
