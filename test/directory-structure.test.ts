import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { run } from '../tools/deferred-issues/deferred-issues.ts';

/** File-placement rules that ESLint and dependency-cruiser cannot count: a directory cap, catch-all names, nested barrels. */
const CAP = 25;

/** Directories above `CAP` today. A number only goes down, and an entry goes once its directory holds `CAP` or fewer. */
const OVER_CAP: Readonly<Record<string, number>> = {
  'packages/contracts/src': 44,
  'packages/sync/src': 27,
  'packages/web/src/list': 31,
};

const SCOPE = [/^packages\/[^/]+\/src\//, /^tools\//, /^test\//, /^\.claude\/skills\/tracked-json\/scripts\//];
const TYPESCRIPT = /\.tsx?$/;
const DECLARATION = /\.d\.ts$/;
const SKIPPED_SEGMENT = /^(?:node_modules|dist|fixtures?|.*-fixture)$/;
const BANNED_NAME = /^(?:helpers?|utils?|common|misc|extras?|stuff|part-?\d+)$/;
const PACKAGE_ROOT_INDEX = /^packages\/[^/]+\/src\/index\.tsx?$/;
const PACKAGE_SOURCE = /^packages\/[^/]+\/src\//;
const INDEX_FILE = /^index\.tsx?$/;

const parts = (file: string): { directory: string; name: string; segments: string[] } => {
  const segments = file.split('/');
  const name = segments.at(-1) ?? '';
  return { directory: segments.slice(0, -1).join('/'), name, segments: segments.slice(0, -1) };
};

const isInScope = (file: string): boolean => {
  const { segments } = parts(file);
  return (
    TYPESCRIPT.test(file) &&
    !DECLARATION.test(file) &&
    SCOPE.some((pattern) => pattern.test(file)) &&
    segments.every((segment) => !SKIPPED_SEGMENT.test(segment))
  );
};

function capViolations(files: readonly string[], overCap: Readonly<Record<string, number>>): string[] {
  const counts = new Map<string, number>();
  for (const file of files) {
    const { directory } = parts(file);
    counts.set(directory, (counts.get(directory) ?? 0) + 1);
  }
  const violations: string[] = [];
  for (const [directory, count] of counts) {
    const cap = overCap[directory] ?? CAP;
    if (count > cap) {
      violations.push(`${directory} holds ${count} TypeScript files, above its cap of ${cap}: move files into a subdirectory`);
    }
  }
  for (const [directory, cap] of Object.entries(overCap)) {
    const count = counts.get(directory) ?? 0;
    if (count <= CAP) {
      violations.push(`${directory} holds ${count} TypeScript files, at or below ${CAP}: delete its OVER_CAP entry`);
    } else if (count < cap) {
      violations.push(`${directory} holds ${count} TypeScript files, below its OVER_CAP number ${cap}: write ${count}`);
    }
  }
  return violations;
}

function nameViolations(file: string): string[] {
  const { name, segments } = parts(file);
  const violations: string[] = [];
  const [stem = ''] = name.split('.', 1);
  if (BANNED_NAME.test(stem)) {
    violations.push(`${file}: the file name "${stem}" says nothing, so name the concept the file owns`);
  }
  for (const segment of segments) {
    if (BANNED_NAME.test(segment)) {
      violations.push(`${file}: the directory name "${segment}" says nothing, so name the concept it owns`);
    }
  }
  return violations;
}

function barrelViolations(file: string): string[] {
  const { name } = parts(file);
  const isNestedBarrel = INDEX_FILE.test(name) && PACKAGE_SOURCE.test(file) && !PACKAGE_ROOT_INDEX.test(file);
  return isNestedBarrel ? [`${file}: a barrel is allowed only as packages/<package>/src/index.ts`] : [];
}

/** Returns one message per violation of the file-placement rules, for a repo-relative list of files. */
function checkStructure(files: readonly string[], overCap: Readonly<Record<string, number>>): string[] {
  const scoped = files.filter((file) => isInScope(file));
  return [...capViolations(scoped, overCap), ...scoped.flatMap((file) => [...nameViolations(file), ...barrelViolations(file)])];
}

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

function repositoryFiles(): string[] {
  const listed = run('git', ['-C', REPO_ROOT, 'ls-files', '--cached', '--others', '--exclude-standard']);
  if (listed.status !== 0) {
    throw new Error(`git ls-files failed: ${listed.stderr}`);
  }
  return listed.stdout.split('\n').filter((file) => file !== '' && existsSync(path.resolve(REPO_ROOT, file)));
}

const filesIn = (directory: string, count: number): string[] =>
  Array.from({ length: count }, (_unused, index) => `${directory}/file-${String(index)}.ts`);

describe('checkStructure', () => {
  it('fails a new directory with 26 files and passes one with 25', () => {
    expect(checkStructure(filesIn('packages/core/src', 25), {})).toEqual([]);
    expect(checkStructure(filesIn('packages/core/src', 26), {})).toHaveLength(1);
  });

  it('counts .tsx files and skips .d.ts files and non-TypeScript files', () => {
    const files = [
      ...filesIn('packages/web/src', 25),
      'packages/web/src/env.d.ts',
      'packages/web/src/style.css',
      'packages/web/src/Panel.tsx',
    ];
    expect(checkStructure(files, {})).toHaveLength(1);
    expect(checkStructure(files.slice(0, 25), {})).toEqual([]);
  });

  it('lets a listed directory hold its number and fails one more', () => {
    const overCap = { 'packages/contracts/src': 44 };
    expect(checkStructure(filesIn('packages/contracts/src', 44), overCap)).toEqual([]);
    const violations = checkStructure(filesIn('packages/contracts/src', 45), overCap);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('45');
    expect(violations[0]).toContain('cap of 44');
  });

  it('fails a listed directory that holds fewer files than its number and names the number to write', () => {
    const violations = checkStructure(filesIn('packages/contracts/src', 40), { 'packages/contracts/src': 44 });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('write 40');
  });

  it('fails a listed directory that holds 25 or fewer files and says to delete the entry', () => {
    const violations = checkStructure(filesIn('packages/contracts/src', 25), { 'packages/contracts/src': 44 });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('delete its OVER_CAP entry');
    expect(checkStructure([], { 'packages/contracts/src': 44 })).toHaveLength(1);
  });

  it('fails a banned file name, whatever follows the first dot', () => {
    expect(checkStructure(['packages/core/src/helpers.ts'], {})).toHaveLength(1);
    expect(checkStructure(['packages/core/src/utils.test.ts'], {})).toHaveLength(1);
    expect(checkStructure(['packages/core/src/part-2.ts'], {})).toHaveLength(1);
    expect(checkStructure(['packages/core/src/misc.ts'], {})).toHaveLength(1);
    expect(checkStructure(['packages/core/src/rank-helpers.ts'], {})).toEqual([]);
  });

  it('fails a banned directory name', () => {
    expect(checkStructure(['packages/core/src/common/rank.ts'], {})).toHaveLength(1);
    expect(checkStructure(['test/stuff/rank.ts'], {})).toHaveLength(1);
  });

  it('fails an index.ts below the package source root and passes the root one', () => {
    expect(checkStructure(['packages/core/src/rank/index.ts'], {})).toHaveLength(1);
    expect(checkStructure(['packages/web/src/list/index.tsx'], {})).toHaveLength(1);
    expect(checkStructure(['packages/core/src/index.ts'], {})).toEqual([]);
  });

  it('leaves an index.ts outside the packages alone', () => {
    expect(checkStructure(['tools/eslint-rules/index.ts'], {})).toEqual([]);
  });

  it('skips fixture directories and files outside the scope', () => {
    const files = [
      ...filesIn('tools/boundary-check/fixture/allowed', 30),
      ...filesIn('tools/boundary-check/case-fixture', 30),
      ...filesIn('tools/boundary-check/fixtures', 30),
      ...filesIn('docs', 30),
      ...filesIn('packages/core/dist', 30),
      'tools/boundary-check/fixture/helpers.ts',
    ];
    expect(checkStructure(files, {})).toEqual([]);
  });
});

describe('the repository tree', () => {
  it('holds no file-placement violation', () => {
    expect(checkStructure(repositoryFiles(), OVER_CAP)).toEqual([]);
  });
});
