import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

// The layout stands in for the repo through `LINT_ON_EDIT_ROOT`, so the test never writes a
// violating file into the real source tree.
const HOOK = path.resolve(import.meta.dirname, 'lint-on-edit.ts');
const REPO_NODE_MODULES = path.resolve(import.meta.dirname, '../../node_modules');
const SLOW_MS = 90_000;

const FILES: Readonly<Record<string, string>> = {
  'eslint.config.mjs': [
    "import tseslint from 'typescript-eslint';",
    "export default tseslint.config({ files: ['**/*.ts'], extends: [tseslint.configs.base],",
    // The hook's eslint_d server also holds the repo config, so the root cannot be inferred.
    '  languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },',
    "  rules: { eqeqeq: 'error' } });",
  ].join('\n'),
  '.dependency-cruiser.mjs': `export default {
  forbidden: [{ name: 'no-a-to-b', severity: 'error', from: { path: '^packages/a/' }, to: { path: '^packages/b/' } }],
  options: { tsPreCompilationDeps: true },
};`,
  'tools/clean.ts': 'export const clean = 1;\n',
  'tools/lint-bad.ts': 'export const isOne = (value: number): boolean => value == 1;\n',
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
  // The server inherits the test runner's handles on Windows, so a caller that pipes the
  // output of `vitest` would wait for its idle exit.
  const server = path.join(REPO_NODE_MODULES, 'eslint_d', 'bin', 'eslint_d.js');
  spawnSync(process.execPath, [server, 'stop'], { cwd: tmpdir(), env: { ...process.env, ESLINT_D_ROOT: root }, stdio: 'ignore' });
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
    expect(stderr).not.toContain('== depcruise ==');
  }, SLOW_MS);

  it('reports a forbidden import from a Serena edit under depcruise only, and exits 2', () => {
    const { status, stderr } = serena('packages/a/a.ts');
    expect(status).toBe(2);
    expect(stderr).toContain('== depcruise ==');
    expect(stderr).toContain('no-a-to-b: packages/a/a.ts -> packages/b/b.ts');
    expect(stderr).not.toContain('== lint ==');
  }, SLOW_MS);
});
