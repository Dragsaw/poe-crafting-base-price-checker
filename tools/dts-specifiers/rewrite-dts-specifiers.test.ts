import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';

import {
  rewriteDtsSpecifiers,
  rewriteDtsSpecifiersIn,
  TARGET_PACKAGES,
} from './rewrite-dts-specifiers';

const TOOL = fileURLToPath(new URL('rewrite-dts-specifiers.ts', import.meta.url));
const ROOT_PACKAGE_JSON = fileURLToPath(new URL('../../package.json', import.meta.url));
const PACKAGES_DIR = fileURLToPath(new URL('../../packages', import.meta.url));

/** A full `ts.createProgram` with lib loading can pass the 5 s default on a cold Windows run. */
const COMPILE_TIMEOUT = 30_000;

/** A relative specifier that still ends in a TypeScript extension. */
const RELATIVE_TS_SPECIFIER = /(['"])\.{1,2}\/[^'"]*\.(ts|tsx|mts|cts)\1/;

const scratch: string[] = [];

function makeScratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dts-specifiers-'));
  scratch.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratch.splice(0)) {rmSync(dir, { recursive: true, force: true });}
});

function messagesOf(diagnostics: readonly ts.Diagnostic[]): string[] {
  return diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
}

/**
 * Emits the declarations of a small `emitDeclarationOnly` +
 * `allowImportingTsExtensions` project under `dir`, and returns its `outDir`.
 */
function emitScratchProject(dir: string): string {
  const source = join(dir, 'src');
  const outDir = join(dir, 'dist');
  mkdirSync(join(source, 'nested'), { recursive: true });
  // ESM scope, so the NodeNext consumer reads `dist` as ES modules.
  writeFileSync(join(dir, 'package.json'), '{ "type": "module" }\n');
  writeFileSync(join(source, 'a.ts'), 'export const a = 1;\n');
  writeFileSync(
    join(source, 'nested', 'b.ts'),
    "import type { A } from '../index.ts';\nexport const b = (x: A): A => x;\n",
  );
  writeFileSync(
    join(source, 'index.ts'),
    [
      "export { a } from './a.ts';",
      "export { b } from './nested/b.ts';",
      "export type A = typeof import('./a.ts').a;",
      '',
    ].join('\n'),
  );

  const program = ts.createProgram({
    rootNames: ['a.ts', 'index.ts', join('nested', 'b.ts')].map((name) => join(source, name)),
    options: {
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
      declaration: true,
      emitDeclarationOnly: true,
      allowImportingTsExtensions: true,
      skipLibCheck: true,
      types: [],
      rootDir: source,
      outDir,
    },
  });
  const result = program.emit();
  expect(messagesOf([...ts.getPreEmitDiagnostics(program), ...result.diagnostics])).toEqual([]);
  return outDir;
}

describe('rewriteDtsSpecifiers', () => {
  it('rewrites a static re-export', () => {
    expect(rewriteDtsSpecifiers("export { a } from './a.ts';")).toBe(
      "export { a } from './a.js';",
    );
  });

  it('rewrites a multi-line re-export', () => {
    expect(rewriteDtsSpecifiers("export {\n  a,\n} from './a.ts';")).toBe(
      "export {\n  a,\n} from './a.js';",
    );
  });

  it('rewrites a double-quoted type import', () => {
    expect(rewriteDtsSpecifiers('import type { B } from "../b.ts";')).toBe(
      'import type { B } from "../b.js";',
    );
  });

  it('rewrites a side-effect import', () => {
    expect(rewriteDtsSpecifiers("import './x.ts';")).toBe("import './x.js';");
  });

  it('rewrites an inline type query', () => {
    expect(rewriteDtsSpecifiers("x: import('./c.ts').C;")).toBe("x: import('./c.js').C;");
  });

  it('maps each module extension', () => {
    expect(
      rewriteDtsSpecifiers(
        ["export * from './m.mts';", "export * from './c.cts';", "export * from './t.tsx';"].join(
          '\n',
        ),
      ),
    ).toBe(
      ["export * from './m.mjs';", "export * from './c.cjs';", "export * from './t.js';"].join(
        '\n',
      ),
    );
  });

  it.each([
    ['leaves bare and scoped package specifiers unchanged', "import { z } from 'zod';\nexport { x } from '@poe/x.ts';"],
    ['leaves a declaration-file specifier unchanged', "export type { T } from './types.d.ts';"],
    ['leaves an already rewritten specifier unchanged', "export { a } from './a.js';"],
  ])('%s', (_title, text) => {
    expect(rewriteDtsSpecifiers(text)).toBe(text);
  });
});

describe('rewriteDtsSpecifiersIn', () => {
  it('does not rewrite a file whose content is already rewritten', () => {
    const dir = makeScratch();
    const file = join(dir, 'index.d.ts');
    writeFileSync(file, "export { a } from './a.js';\n");
    const before = statSync(file).mtimeMs;

    expect(rewriteDtsSpecifiersIn(dir)).toEqual([]);
    expect(statSync(file).mtimeMs).toBe(before);
  });

  it('walks .d.mts output', () => {
    const dir = makeScratch();
    const file = join(dir, 'index.d.mts');
    writeFileSync(file, "export { a } from './a.mts';\n");

    expect(rewriteDtsSpecifiersIn(dir)).toEqual([file]);
    expect(readFileSync(file, 'utf8')).toBe("export { a } from './a.mjs';\n");
  });

  it(
    'rewrites the tsc declaration output of an emitDeclarationOnly project',
    () => {
      const outDir = emitScratchProject(makeScratch());
      const emitted = ['index.d.ts', 'a.d.ts', join('nested', 'b.d.ts')].map((name) =>
        join(outDir, name),
      );
      // The premise: tsc keeps the `.ts` specifiers in declaration output.
      expect(readFileSync(join(outDir, 'index.d.ts'), 'utf8')).toMatch(RELATIVE_TS_SPECIFIER);

      rewriteDtsSpecifiersIn(outDir);

      for (const file of emitted) {
        expect(readFileSync(file, 'utf8')).not.toMatch(RELATIVE_TS_SPECIFIER);
      }
      expect(readFileSync(join(outDir, 'index.d.ts'), 'utf8')).toContain("from './a.js'");
    },
    COMPILE_TIMEOUT,
  );

  it.each([
    ['Bundler', ts.ModuleKind.ESNext, ts.ModuleResolutionKind.Bundler],
    ['NodeNext', ts.ModuleKind.NodeNext, ts.ModuleResolutionKind.NodeNext],
  ] as const)(
    'leaves output that a consumer resolves under %s',
    (_name, module, moduleResolution) => {
      const dir = makeScratch();
      rewriteDtsSpecifiersIn(emitScratchProject(dir));
      const consumer = join(dir, 'consumer.ts');
      writeFileSync(
        consumer,
        "import { a, b, type A } from './dist/index.js';\nexport const x: A = b(a);\n",
      );

      const program = ts.createProgram({
        rootNames: [consumer],
        options: {
          target: ts.ScriptTarget.ES2023,
          lib: ['lib.es2023.d.ts'],
          module,
          moduleResolution,
          strict: true,
          noEmit: true,
          // Off, so an unresolved specifier inside `dist/*.d.ts` is reported.
          skipLibCheck: false,
          types: [],
        },
      });
      expect(messagesOf(ts.getPreEmitDiagnostics(program))).toEqual([]);
    },
    COMPILE_TIMEOUT,
  );

  it('throws and names the directory when it is missing', () => {
    const missing = join(makeScratch(), 'dist');
    expect(() => rewriteDtsSpecifiersIn(missing)).toThrow(missing);
  });
});

/**
 * Resolves `<dir>/tsconfig.json` with the TypeScript config API, so JSONC
 * comments and `extends` are honoured, and returns its compiler options.
 */
function resolveCompilerOptions(dir: string): ts.CompilerOptions {
  const configPath = join(dir, 'tsconfig.json');
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error !== undefined) {throw new Error(messagesOf([read.error]).join('\n'));}
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dir, undefined, configPath);
  if (parsed.errors.length > 0) {throw new Error(messagesOf(parsed.errors).join('\n'));}
  return parsed.options;
}

describe('TARGET_PACKAGES', () => {
  it('lists every emitDeclarationOnly package', () => {
    const emitDeclarationOnly = readdirSync(PACKAGES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((package_) => existsSync(join(PACKAGES_DIR, package_, 'tsconfig.json')))
      .filter((package_) => resolveCompilerOptions(join(PACKAGES_DIR, package_)).emitDeclarationOnly === true)
      .toSorted((a, b) => Number(a > b) - Number(a < b));

    expect([...TARGET_PACKAGES].toSorted((a, b) => Number(a > b) - Number(a < b))).toEqual(emitDeclarationOnly);
  });
});

/**
 * A copy of the tool at `<scratch>/tools/dts-specifiers/`: its target is
 * relative to `import.meta.url`, so it then rewrites
 * `<scratch>/packages/{contracts,core,sync}/dist`.
 */
function copyToolIntoScratch(): { root: string; script: string } {
  const root = makeScratch();
  writeFileSync(join(root, 'package.json'), '{ "type": "module" }\n');
  const toolDir = join(root, 'tools', 'dts-specifiers');
  mkdirSync(toolDir, { recursive: true });
  const script = join(toolDir, 'rewrite-dts-specifiers.ts');
  copyFileSync(TOOL, script);
  return { root, script };
}

/** Creates `<root>/packages/<pkg>/dist/index.d.ts` holding a `./a.ts` re-export. */
function seedDistribution(root: string, package_: string): string {
  const distribution = join(root, 'packages', package_, 'dist');
  mkdirSync(distribution, { recursive: true });
  const file = join(distribution, 'index.d.ts');
  writeFileSync(file, "export { a } from './a.ts';\n");
  return file;
}

describe('the post-emit step', () => {
  it('runs after tsc -b in the root typecheck script', () => {
    const package_ = JSON.parse(readFileSync(ROOT_PACKAGE_JSON, 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(package_.scripts.typecheck).toBe('tsc -b && node tools/dts-specifiers/rewrite-dts-specifiers.ts');
  });

  it('rewrites the contracts, core and sync dists when run by bare node', () => {
    const { root, script } = copyToolIntoScratch();
    const files = ['contracts', 'core', 'sync'].map((package_) => seedDistribution(root, package_));

    const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });

    expect(run.status).toBe(0);
    for (const file of files) {
      expect(readFileSync(file, 'utf8')).toBe("export { a } from './a.js';\n");
    }
  });

  it('exits non-zero and names the directory when the contracts dist is missing', () => {
    const { root, script } = copyToolIntoScratch();

    const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });

    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain(join(root, 'packages', 'contracts', 'dist'));
  });

  it('exits non-zero and names the directory when the core dist is missing', () => {
    const { root, script } = copyToolIntoScratch();
    seedDistribution(root, 'contracts');
    seedDistribution(root, 'sync');

    const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });

    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain(join(root, 'packages', 'core', 'dist'));
  });
});
