import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ESLint, type Linter } from 'eslint';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { createVitest } from 'vitest/node';

/**
 * `.claude/skills/tracked-json/scripts/*.ts` sits outside every package. Three
 * hand-written entries bring it under `pnpm check` and `pnpm test`: the
 * `tsconfig.tools.json` include, the root Vitest project include, and the
 * `.claude/` ignore-negation chain plus `files` glob in `eslint.config.mjs`. A
 * dropped entry fails neither command, so this file asks each tool whether it
 * still covers every script. Each checker also runs against an in-memory copy
 * of its config with the scripts entry removed, which proves it is not vacuous.
 */
const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SCRIPTS_REL = '.claude/skills/tracked-json/scripts';
const SCRIPTS_DIR = join(REPO_ROOT, ...SCRIPTS_REL.split('/'));

const TS_INCLUDE = `${SCRIPTS_REL}/*.ts`;
const ESLINT_NEGATION = `!${SCRIPTS_REL}/`;
const VITEST_INCLUDE = `${SCRIPTS_REL}/*.test.ts`;
const TOOLS_TSCONFIG = join(REPO_ROOT, 'tsconfig.tools.json');
const SOLUTION_TSCONFIG = join(REPO_ROOT, 'tsconfig.json');

/**
 * Loads a committed config's default export. The specifier is computed, so
 * `tsc` does not pull `eslint.config.mjs` into `tsconfig.tools.json`'s file
 * list (TS6307) or reject the `.ts` extension (TS5097).
 */
async function importDefault(file: string): Promise<unknown> {
  const module = (await import(pathToFileURL(join(REPO_ROOT, file)).href)) as { default: unknown };
  return module.default;
}

/** Absolute paths, read at run time so a new script is guarded with no edit. */
const scripts = readdirSync(SCRIPTS_DIR)
  .filter((name) => /\.[cm]?tsx?$/.test(name))
  .sort()
  .map((name) => join(SCRIPTS_DIR, name));
const testScripts = scripts.filter((path) => /\.test\.[cm]?tsx?$/.test(path));

/** Compares paths across tools: TypeScript and Vitest print `/`, `node:path` prints `\` on Windows. */
const key = (path: string): string => {
  const normalized = resolve(path).replaceAll('\\', '/');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
};

const relativeLabel = (path: string): string => key(path).slice(key(REPO_ROOT).length + 1);

function uncovered(expected: readonly string[], covered: Iterable<string>): string[] {
  const seen = new Set([...covered].map(key));
  return expected.filter((path) => !seen.has(key(path))).map(relativeLabel);
}

// --- TypeScript -------------------------------------------------------------

function readJsonConfig(path: string): Record<string, unknown> {
  const { config, error } = ts.readConfigFile(path, ts.sys.readFile);
  if (error !== undefined) {
    throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
  }
  return config as Record<string, unknown>;
}

/** Scripts that the parsed `tsconfig.tools.json` (or `json`, its stand-in) does not list as a root file. */
function tsUncovered(json: Record<string, unknown>): string[] {
  const parsed = ts.parseJsonConfigFileContent(json, ts.sys, REPO_ROOT, undefined, TOOLS_TSCONFIG);
  return uncovered(scripts, parsed.fileNames);
}

// --- ESLint -----------------------------------------------------------------

/** Scripts that the flat config ignores, or that match no config block. */
async function eslintUncovered(config: readonly Linter.Config[] | undefined): Promise<string[]> {
  const eslint =
    config === undefined
      ? new ESLint({ cwd: REPO_ROOT })
      : new ESLint({ cwd: REPO_ROOT, overrideConfigFile: true, overrideConfig: [...config] });
  const covered: string[] = [];
  for (const path of scripts) {
    const ignored = await eslint.isPathIgnored(path);
    const calculated: unknown = ignored ? undefined : await eslint.calculateConfigForFile(path);
    if (!ignored && calculated !== undefined) {
      covered.push(path);
    }
  }
  return uncovered(scripts, covered);
}

// --- Vitest -----------------------------------------------------------------

type VitestOptions = Parameters<typeof createVitest>[1];

/** Test scripts that Vitest's own glob does not collect into the `root` project. */
async function vitestUncovered(options: VitestOptions): Promise<string[]> {
  const vitest = await createVitest('test', { watch: false, run: true, root: REPO_ROOT, ...options });
  try {
    const specifications = await vitest.globTestSpecifications();
    const collected = specifications
      .filter((specification) => specification.project.name === 'root')
      .map((specification) => specification.moduleId);
    return uncovered(testScripts, collected);
  } finally {
    await vitest.close();
  }
}

// --- Assertions -------------------------------------------------------------

describe('tracked-json scripts stay under type, lint and test coverage', () => {
  it('the scripts directory holds at least one .ts and one .test.ts file', () => {
    expect(scripts.length, `no .ts file in ${SCRIPTS_REL}`).toBeGreaterThan(0);
    expect(testScripts.length, `no .test.ts file in ${SCRIPTS_REL}`).toBeGreaterThan(0);
  });

  describe('TypeScript', () => {
    it('tsconfig.json references tsconfig.tools.json, so `tsc -b` builds it', () => {
      const parsed = ts.parseJsonConfigFileContent(
        readJsonConfig(SOLUTION_TSCONFIG),
        ts.sys,
        REPO_ROOT,
        undefined,
        SOLUTION_TSCONFIG,
      );
      const references = (parsed.projectReferences ?? []).map((reference) =>
        key(ts.resolveProjectReferencePath(reference)),
      );
      expect(references, 'tsconfig.json does not reference tsconfig.tools.json').toContain(key(TOOLS_TSCONFIG));
    });

    it('tsconfig.tools.json includes every script', () => {
      expect(tsUncovered(readJsonConfig(TOOLS_TSCONFIG)), 'tsconfig.tools.json does not include').toEqual([]);
    });

    it('the checker reports every script when the include line is dropped', () => {
      const json = readJsonConfig(TOOLS_TSCONFIG);
      const include = json['include'] as string[];
      expect(include, `TypeScript: tsconfig.tools.json has no include entry ${TS_INCLUDE}`).toContain(TS_INCLUDE);
      const dropped = { ...json, include: include.filter((entry) => entry !== TS_INCLUDE) };
      expect(
        tsUncovered(dropped),
        `TypeScript: with include ${TS_INCLUDE} dropped, the checker did not report every script`,
      ).toEqual(scripts.map(relativeLabel));
    });
  });

  describe('ESLint', () => {
    it('eslint.config.mjs lints every script', async () => {
      expect(await eslintUncovered(undefined), 'ESLint ignores or has no config for').toEqual([]);
    });

    it('the checker reports every script when the scripts negation is dropped', async () => {
      const config = (await importDefault('eslint.config.mjs')) as readonly Linter.Config[];
      expect(
        config.some((block) => block.ignores?.includes(ESLINT_NEGATION) === true),
        `ESLint: eslint.config.mjs has no ignores entry ${ESLINT_NEGATION}`,
      ).toBe(true);
      const dropped = config.map((block) =>
        block.ignores?.includes(ESLINT_NEGATION) === true
          ? { ...block, ignores: block.ignores.filter((entry) => entry !== ESLINT_NEGATION) }
          : block,
      );
      expect(
        await eslintUncovered(dropped),
        `ESLint: with negation ${ESLINT_NEGATION} dropped, the checker did not report every script`,
      ).toEqual(scripts.map(relativeLabel));
    });
  });

  describe('Vitest', () => {
    it('the root project collects every test script', async () => {
      expect(await vitestUncovered({}), 'Vitest `root` project does not collect').toEqual([]);
    });

    it('the checker reports every test script when the root include line is dropped', async () => {
      const shipped = (await importDefault('vitest.config.ts')) as { test: { projects: unknown[] } };
      const root = shipped.test.projects.find(
        (project): project is { test: { name: string; include: string[] } } =>
          typeof project === 'object' && (project as { test?: { name?: string } }).test?.name === 'root',
      );
      expect(
        root?.test.include,
        `Vitest: the root project in vitest.config.ts has no include entry ${VITEST_INCLUDE}`,
      ).toContain(VITEST_INCLUDE);
      const include = (root?.test.include ?? []).filter((entry) => entry !== VITEST_INCLUDE);
      const reported = await vitestUncovered({
        config: false,
        projects: [{ test: { ...root?.test, include } }],
      });
      expect(
        reported,
        `Vitest: with root include ${VITEST_INCLUDE} dropped, the checker did not report every test script`,
      ).toEqual(testScripts.map(relativeLabel));
    });
  });
});
