import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

/**
 * End to end: the real script, real ESLint, `tsc -b` and dependency-cruiser,
 * run against a small repository layout in the temp directory. The layout
 * stands in for the repo through `LINT_ON_EDIT_ROOT`, so the test never writes
 * a violating file into the real source tree, where a parallel test or
 * `pnpm check` would see it. Its `node_modules` is a link to this repo's.
 *
 * The files below hold one violation each. Every run sees all of them in the
 * `tsc -b` output, so a run that stays quiet also proves the per-file filter.
 */
const HOOK = path.resolve(import.meta.dirname, 'lint-on-edit.ts');
const REPO_NODE_MODULES = path.resolve(import.meta.dirname, '../../node_modules');
const SLOW_MS = 90_000;

const FILES: Readonly<Record<string, string>> = {
  'tsconfig.base.json': JSON.stringify({
    compilerOptions: {
      target: 'ES2023',
      lib: ['ES2023'],
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      types: [],
      skipLibCheck: true,
      allowImportingTsExtensions: true,
    },
  }),
  'tsconfig.json': JSON.stringify({ files: [], references: [{ path: './tsconfig.tools.json' }] }),
  'tsconfig.tools.json': JSON.stringify({
    extends: './tsconfig.base.json',
    compilerOptions: { composite: true, noEmit: true, tsBuildInfoFile: './.cache/tools.tsbuildinfo' },
    include: ['tools/**/*.ts', 'packages/**/*.ts'],
  }),
  'eslint.config.mjs': [
    "import tseslint from 'typescript-eslint';",
    "export default tseslint.config({ files: ['**/*.ts'], extends: [tseslint.configs.base], rules: { eqeqeq: 'error' } });",
  ].join('\n'),
  '.dependency-cruiser.mjs': `export default {
  forbidden: [{ name: 'no-a-to-b', severity: 'error', from: { path: '^packages/a/' }, to: { path: '^packages/b/' } }],
  options: { tsPreCompilationDeps: true },
};`,
  'tools/clean.ts': 'export const clean = 1;\n',
  'tools/lint-bad.ts': 'export const isOne = (value: number): boolean => value == 1;\n',
  'tools/type-bad.ts': "export const wrong: number = 'text';\n",
  'tools/lib.ts': 'export function twice(value: number): number {\n  return value * 2;\n}\n',
  // The edit that breaks `caller.ts` is a change to `lib.ts`'s signature; the error sits in the caller.
  'tools/caller.ts': "import { twice } from './lib.ts';\nexport const four = twice('x');\n",
  'tools/notes.md': '# notes\n',
  'packages/a/a.ts': "import { b } from '../b/b.ts';\n\nexport const a = b;\n",
  'packages/b/b.ts': 'export const b = 1;\n',
};

function createLayout(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'lint-on-edit-'));
  for (const [name, text] of Object.entries(FILES)) {
    mkdirSync(path.dirname(path.join(directory, name)), { recursive: true });
    writeFileSync(path.join(directory, name), text);
  }
  symlinkSync(REPO_NODE_MODULES, path.join(directory, 'node_modules'), 'junction');
  return directory;
}

const root = createLayout();

afterAll(() => {
  // Remove the link first: `rmSync` on it must not reach the real `node_modules`.
  rmSync(path.join(root, 'node_modules'), { force: true });
  rmSync(root, { recursive: true, force: true });
});

interface Outcome {
  readonly status: number | null;
  readonly stderr: string;
  readonly stdout: string;
}

function runHook(toolName: string, input: Record<string, unknown>): Outcome {
  const result = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: toolName, tool_input: input }),
    env: { ...process.env, LINT_ON_EDIT_ROOT: root },
    encoding: 'utf8',
    timeout: SLOW_MS,
  });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

const edit = (file: string): Outcome => runHook('Edit', { file_path: path.join(root, file) });
const write = (file: string): Outcome => runHook('Write', { file_path: path.join(root, file) });
const serena = (file: string): Outcome => runHook('mcp__serena__replace_content', { relative_path: file });

describe('lint-on-edit, end to end', () => {
  it('stays silent and exits 0 for a clean file', () => {
    expect(edit('tools/clean.ts')).toEqual({ status: 0, stderr: '', stdout: '' });
  }, SLOW_MS);

  it('stays silent when the edit broke a different file', () => {
    // `caller.ts` has a type error, but the edited file is `lib.ts`.
    expect(edit('tools/lib.ts')).toEqual({ status: 0, stderr: '', stdout: '' });
    expect(serena('tools/lib.ts').status).toBe(0);
  }, SLOW_MS);

  it('does not run on a non-TypeScript file or a missing file', () => {
    for (const run of [edit, write, serena]) {
      expect(run('tools/notes.md')).toEqual({ status: 0, stderr: '', stdout: '' });
      expect(run('tools/deleted.ts')).toEqual({ status: 0, stderr: '', stdout: '' });
    }
  }, SLOW_MS);

  it('reports a lint finding from an Edit under lint only, and exits 2', () => {
    const { status, stderr } = edit('tools/lint-bad.ts');
    expect(status).toBe(2);
    expect(stderr).toContain('== lint ==');
    expect(stderr).toContain('eqeqeq');
    expect(stderr).not.toContain('== typecheck ==');
    expect(stderr).not.toContain('== depcruise ==');
  }, SLOW_MS);

  it('reports a type error from a Write under typecheck only, and exits 2', () => {
    const { status, stderr } = write('tools/type-bad.ts');
    expect(status).toBe(2);
    expect(stderr).toContain('== typecheck ==');
    expect(stderr).toContain('tools/type-bad.ts(1,14): error TS2322');
    expect(stderr).not.toContain('== lint ==');
    expect(stderr).not.toContain('caller.ts');
  }, SLOW_MS);

  it('reports a forbidden import from a Serena edit under depcruise only, and exits 2', () => {
    const { status, stderr } = serena('packages/a/a.ts');
    expect(status).toBe(2);
    expect(stderr).toContain('== depcruise ==');
    expect(stderr).toContain('no-a-to-b: packages/a/a.ts -> packages/b/b.ts');
    expect(stderr).not.toContain('== lint ==');
    expect(stderr).not.toContain('== typecheck ==');
  }, SLOW_MS);
});
