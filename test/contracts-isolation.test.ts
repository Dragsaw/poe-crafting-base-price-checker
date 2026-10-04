import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const PACKAGES_DIR = fileURLToPath(new URL('../packages', import.meta.url));
const SCOPE = '@poe/';

/**
 * The declared graph. A manifest that declares only its allowed siblings is the
 * first of the two guards on AD-1's direction — an illegal import does not
 * resolve at all — and `dependency-cruiser` is the second.
 *
 * Read as: package name -> the sibling packages it may declare.
 */
const ALLOWED_EDGES: Readonly<Record<string, readonly string[]>> = {
  '@poe/contracts': [],
  '@poe/core': ['@poe/contracts'],
  '@poe/sync': ['@poe/contracts', '@poe/core'],
  '@poe/web': ['@poe/contracts', '@poe/core'],
};

interface Manifest {
  readonly name?: string;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
}

/**
 * Enumerated from disk, never hardcoded: a fifth package added without a rule
 * here must fail this test rather than slip past it.
 */
function readManifests(): { directory: string; manifest: Manifest }[] {
  return readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      directory: entry.name,
      manifest: JSON.parse(
        readFileSync(join(PACKAGES_DIR, entry.name, 'package.json'), 'utf8'),
      ) as Manifest,
    }));
}

/**
 * Every `@poe/*` entry counts, in any dependency field and under any range
 * protocol. `link:../web`, `"*"` and `file:` are workspace edges just as much as
 * `workspace:*` is, and matching only the `workspace:` prefix would have missed
 * all three.
 */
function workspaceEdgesOf(manifest: Manifest): string[] {
  const fields = [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ];
  const edges = new Set<string>();
  for (const field of fields) {
    const names = Object.keys(field ?? {});
    for (const name of names) {
      if (name.startsWith(SCOPE)) {
        edges.add(name);
      }
    }
  }
  return [...edges].toSorted((a, b) => Number(a > b) - Number(a < b));
}

it('declares a workspace edge only where the one-way graph allows one', () => {
  const manifests = readManifests();
  expect(manifests.length).toBeGreaterThan(0);

  for (const { directory, manifest } of manifests) {
    const name = manifest.name;
    expect(name, `packages/${directory}/package.json declares no name`).toBeDefined();

    const allowed = ALLOWED_EDGES[name ?? ''];
    expect(
      allowed,
      `packages/${directory} (${String(name)}) has no entry in ALLOWED_EDGES — add its rule before adding the package`,
    ).toBeDefined();

    for (const edge of workspaceEdgesOf(manifest)) {
      expect(allowed, `${String(name)} must not depend on ${edge}`).toContain(edge);
    }
  }
});

it('leaves contracts with no workspace dependency at all', () => {
  const contracts = readManifests().find(({ manifest }) => manifest.name === '@poe/contracts');
  expect(contracts).toBeDefined();
  expect(workspaceEdgesOf(contracts?.manifest ?? {})).toEqual([]);
});
