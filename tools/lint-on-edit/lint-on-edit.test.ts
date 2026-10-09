import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  type Check,
  type CheckName,
  checkedBy,
  filterDepcruiseViolations,
  formatReport,
  type HookDependencies,
  type HookPayload,
  MAX_DIFF_FILES,
  type PathKind,
  parsePayload,
  runHook,
  selectFiles,
} from './lint-on-edit';

/** A repository root that does not exist: the selection reads the file system only through `kindOf`. */
const ROOT = path.join(path.parse(process.cwd()).root, 'fake-repo');
const abs = (relativePath: string): string => path.join(ROOT, ...relativePath.split('/'));

const payload = (toolName: string, input: Record<string, unknown>): string => JSON.stringify({ tool_name: toolName, tool_input: input });

/** A tree of paths: a trailing `/` marks a directory. Anything else is missing. */
function tree(...entries: string[]): (absolutePath: string) => PathKind {
  const known = new Map(
    entries.map((entry) => [abs(entry.replace(/\/$/, '')), entry.endsWith('/') ? 'directory' : 'file'] as const),
  );
  return (absolutePath) => known.get(absolutePath) ?? 'missing';
}

interface Probe {
  readonly dependencies: HookDependencies;
  readonly received: Record<CheckName, string[][]>;
  /** How many `git diff` calls ran. */
  readonly diff: { calls: number };
}

function probe(
  entries: string[],
  findings: Partial<Record<CheckName, string>> = {},
  changed: string[] = [],
): Probe {
  const received: Record<CheckName, string[][]> = { lint: [], depcruise: [] };
  const diff = { calls: 0 };
  const check = (name: CheckName): Check => (files) => {
    received[name].push([...files]);
    return Promise.resolve(findings[name] ?? '');
  };
  const dependencies: HookDependencies = {
    root: ROOT,
    kindOf: tree(...entries),
    changedFiles: () => {
      diff.calls++;
      return Promise.resolve(changed);
    },
    checks: { lint: check('lint'), depcruise: check('depcruise') },
    timeoutMs: 1000,
  };
  return { dependencies, received, diff };
}

describe('parsePayload', () => {
  it('reads file_path from Edit, Write and MultiEdit', () => {
    for (const toolName of ['Edit', 'Write', 'MultiEdit']) {
      expect(parsePayload(payload(toolName, { file_path: '/repo/a.ts' }))).toEqual({ toolName, path: '/repo/a.ts' });
    }
  });

  it('reads relative_path from a Serena tool', () => {
    expect(parsePayload(payload('mcp__serena__replace_content', { relative_path: 'a/b.ts', needle: 'x' }))).toEqual({
      toolName: 'mcp__serena__replace_content',
      path: 'a/b.ts',
    });
  });

  it('gives an empty path when the tool names none', () => {
    expect(parsePayload(payload('mcp__serena__replace_in_files', {}))?.path).toBe('');
    expect(parsePayload(JSON.stringify({ tool_name: 'Edit' }))?.path).toBe('');
  });

  it.each(['', 'not json', '42', 'null', '"text"'])('rejects %j', (text) => {
    expect(parsePayload(text)).toBeUndefined();
  });
});

function parsed(text: string): HookPayload {
  const value = parsePayload(text);
  if (value === undefined) {throw new Error(`payload did not parse: ${text}`);}
  return value;
}

/** The selected files, and how many times the selection asked `git diff`. */
async function select(text: string, entries: string[], changed: string[] = []): Promise<{ files: string[]; diffCalls: number }> {
  const { dependencies, diff } = probe(entries, {}, changed);
  const files = await selectFiles(parsed(text), dependencies);
  return { files, diffCalls: diff.calls };
}

async function selected(text: string, entries: string[], changed: string[] = []): Promise<string[]> {
  const { files } = await select(text, entries, changed);
  return files;
}

describe('selectFiles', () => {
  it('takes the absolute file_path of an Edit or Write, as a repository-relative path', async () => {
    const entries = ['packages/core/src/a.ts', 'packages/web/src/b.tsx'];
    expect(await selected(payload('Edit', { file_path: abs('packages/core/src/a.ts') }), entries)).toEqual(['packages/core/src/a.ts']);
    expect(await selected(payload('Write', { file_path: abs('packages/web/src/b.tsx') }), entries)).toEqual(['packages/web/src/b.tsx']);
  });

  it('takes the relative_path of a Serena tool', async () => {
    const text = payload('mcp__serena__replace_content', { relative_path: 'tools/x/x.ts' });
    expect(await selected(text, ['tools/x/x.ts'])).toEqual(['tools/x/x.ts']);
  });

  it('ignores a non-TypeScript file, a missing file and a directory', async () => {
    const entries = ['README.md', 'data/', 'tools/a.mjs'];
    const files = ['README.md', 'tools/a.mjs', 'tools/gone.ts', 'data'];
    const results = await Promise.all(files.map((file) => selected(payload('Write', { file_path: abs(file) }), entries)));
    expect(results).toEqual([[], [], [], []]);
  });

  it('ignores a file outside the repository, in node_modules or in dist', async () => {
    const entries = ['node_modules/x/index.ts', 'packages/core/dist/index.d.ts'];
    const outside = path.join(path.parse(ROOT).root, 'elsewhere', 'a.ts');
    expect(await selected(payload('Edit', { file_path: outside }), [])).toEqual([]);
    expect(await selected(payload('Edit', { file_path: abs('node_modules/x/index.ts') }), entries)).toEqual([]);
    expect(await selected(payload('Edit', { file_path: abs('packages/core/dist/index.d.ts') }), entries)).toEqual([]);
  });

  it('does not ask git for an Edit, a Write or a symbol-body edit', async () => {
    const tools = ['Edit', 'Write', 'MultiEdit', 'mcp__serena__replace_symbol_body', 'mcp__serena__insert_after_symbol'];
    const results = await Promise.all(
      tools.map((toolName) => {
        const input = toolName.startsWith('mcp') ? { relative_path: 'a.ts' } : { file_path: abs('a.ts') };
        return select(payload(toolName, input), ['a.ts'], ['b.ts']);
      }),
    );
    expect(results.map((result) => result.files)).toEqual(tools.map(() => ['a.ts']));
    expect(results.map((result) => result.diffCalls)).toEqual(tools.map(() => 0));
  });

  it('adds the TypeScript files of git diff for rename_symbol', async () => {
    const entries = ['a.ts', 'b.ts', 'c.tsx', 'notes.md'];
    const text = payload('mcp__serena__rename_symbol', { relative_path: 'a.ts', name_path: 'f', new_name: 'g' });
    expect(await selected(text, entries, ['b.ts', 'c.tsx', 'notes.md', 'deleted.ts', 'a.ts'])).toEqual(['a.ts', 'b.ts', 'c.tsx']);
  });

  it('falls back to git diff for replace_in_files with a directory or no path', async () => {
    const entries = ['src/', 'src/a.ts', 'src/b.ts'];
    const inputs = [{ relative_path: 'src' }, { relative_path: '' }, {}];
    const results = await Promise.all(
      inputs.map((input) => selected(payload('mcp__serena__replace_in_files', input), entries, ['src/a.ts', 'src/b.ts'])),
    );
    expect(results).toEqual(inputs.map(() => ['src/a.ts', 'src/b.ts']));
  });

  it('keeps to the named file for replace_in_files on one file', async () => {
    const text = payload('mcp__serena__replace_in_files', { relative_path: 'src/a.ts' });
    expect(await select(text, ['src/a.ts', 'src/b.ts'], ['src/b.ts'])).toEqual({ files: ['src/a.ts'], diffCalls: 0 });
  });

  it('caps the git diff fallback', async () => {
    const names = Array.from({ length: MAX_DIFF_FILES + 10 }, (_, index) => `f${index}.ts`);
    const files = await selected(payload('mcp__serena__rename_symbol', { relative_path: 'f0.ts' }), names, names);
    expect(files).toHaveLength(MAX_DIFF_FILES);
    expect(files[0]).toBe('f0.ts');
  });
});

describe('filterDepcruiseViolations', () => {
  const rule = { name: 'no-a-to-b', severity: 'error' };
  const json = JSON.stringify({
    summary: {
      violations: [
        { from: 'packages/a/a.ts', to: 'packages/b/b.ts', rule },
        { from: 'packages/c/c.ts', to: 'packages/b/b.ts', rule },
        { from: 'packages/a/a.ts', to: 'x', rule: { name: 'quiet', severity: 'ignore' } },
      ],
    },
  });

  it('keeps the violations whose from is an edited file', () => {
    expect(filterDepcruiseViolations(json, ['packages/a/a.ts'])).toBe('error no-a-to-b: packages/a/a.ts -> packages/b/b.ts');
  });

  it('is empty for a file with no violation or an output with no summary', () => {
    expect(filterDepcruiseViolations(json, ['packages/z/z.ts'])).toBe('');
    expect(filterDepcruiseViolations('{}', ['packages/a/a.ts'])).toBe('');
  });
});

describe('formatReport', () => {
  it('is empty when no check found anything', () => {
    expect(formatReport({})).toBe('');
    expect(formatReport({ lint: '  \n', depcruise: '' })).toBe('');
  });

  it('groups the findings by check, in the order lint, depcruise', () => {
    const report = formatReport({ depcruise: 'D', lint: 'L' });
    expect(report).toContain('== lint ==\nL\n\n== depcruise ==\nD');
  });

  it('omits a clean check', () => {
    const report = formatReport({ depcruise: 'D' });
    expect(report).toContain('== depcruise ==');
    expect(report).not.toContain('== lint ==');
  });
});

describe('checkedBy', () => {
  it('limits dependency-cruiser to packages/ and gives lint every file', () => {
    const files = ['packages/a/a.ts', 'tools/x.ts'];
    expect(checkedBy('depcruise', files)).toEqual(['packages/a/a.ts']);
    expect(checkedBy('lint', files)).toEqual(files);
  });
});

const edit = (file: string): string => payload('Edit', { file_path: abs(file) });

describe('runHook', () => {
  it('exits 0 and prints nothing for a clean file', async () => {
    const { dependencies } = probe(['tools/a.ts']);
    expect(await runHook(edit('tools/a.ts'), dependencies)).toEqual({ code: 0, report: '' });
  });

  it('runs no check for a non-TypeScript file, a missing file or a bad payload', async () => {
    const state = probe(['notes.md']);
    const texts = [edit('notes.md'), edit('tools/gone.ts'), 'garbage'];
    const results = await Promise.all(texts.map((text) => runHook(text, state.dependencies)));
    expect(results).toEqual(texts.map(() => ({ code: 0, report: '' })));
    expect(Object.values(state.received).flat()).toEqual([]);
  });

  it('exits 2 and groups the findings under the check that found them', async () => {
    const { dependencies } = probe(['packages/a/a.ts'], { lint: 'lint text', depcruise: 'cruise text' });
    const result = await runHook(edit('packages/a/a.ts'), dependencies);
    expect(result.code).toBe(2);
    expect(result.report).toContain('== lint ==\nlint text');
    expect(result.report).toContain('== depcruise ==\ncruise text');
  });

  it('gives dependency-cruiser the files under packages/ only', async () => {
    const state = probe(['tools/a.ts']);
    await runHook(edit('tools/a.ts'), state.dependencies);
    expect(state.received).toEqual({ lint: [['tools/a.ts']], depcruise: [] });
  });

  it('starts the checks before any of them finishes', async () => {
    const order: string[] = [];
    const slow = (name: CheckName): Check => async () => {
      order.push(`start ${name}`);
      await new Promise((done) => setTimeout(done, 20));
      order.push(`end ${name}`);
      return '';
    };
    const { dependencies } = probe(['packages/a/a.ts']);
    const checks = { lint: slow('lint'), depcruise: slow('depcruise') };
    await runHook(edit('packages/a/a.ts'), { ...dependencies, checks });
    expect(order.slice(0, 2).every((entry) => entry.startsWith('start'))).toBe(true);
  });

  it('reports a check that throws, instead of passing the file', async () => {
    const { dependencies } = probe(['tools/a.ts']);
    const checks = { ...dependencies.checks, lint: () => Promise.reject(new Error('boom')) };
    const result = await runHook(edit('tools/a.ts'), { ...dependencies, checks });
    expect(result.code).toBe(2);
    expect(result.report).toContain('lint failed to run: boom');
  });

  it('reports a check that outlasts the timeout', async () => {
    const { dependencies } = probe(['tools/a.ts']);
    const checks = { ...dependencies.checks, lint: () => new Promise<string>((done) => setTimeout(done, 300, '')) };
    const result = await runHook(edit('tools/a.ts'), { ...dependencies, checks, timeoutMs: 30 });
    expect(result.code).toBe(2);
    expect(result.report).toContain('lint did not finish');
  });
});
