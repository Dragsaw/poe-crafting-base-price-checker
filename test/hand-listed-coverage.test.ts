import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ESLint, type Linter } from 'eslint';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { createVitest } from 'vitest/node';

/**
 * Some code sits outside every package: the `tools/` entries and
 * `.claude/skills/tracked-json/scripts/`. Hand-written entries bring it under
 * `pnpm check` and `pnpm test`: a `tsconfig.tools.json` include, a root Vitest
 * project include, and an `eslint.config.mjs` `files` glob (plus, for the
 * tracked-json scripts, the `.claude/` ignore-negation chain). A dropped entry
 * fails neither command, so this file asks each tool whether it still covers
 * every file of each target in `TARGETS`. Each checker also runs against an
 * in-memory copy of its config with one named entry removed, which proves it
 * is not vacuous.
 */
const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TOOLS_TSCONFIG = join(REPO_ROOT, 'tsconfig.tools.json');
const SOLUTION_TSCONFIG = join(REPO_ROOT, 'tsconfig.json');

/** JS too: a `.mjs` helper in a guarded directory is not covered by `<dir>/*.ts`, so it must be reported. */
const SOURCE = /\.[cm]?[jt]sx?$/;
const TEST = /\.test\.[cm]?[jt]sx?$/;

const abs = (rel: string): string => join(REPO_ROOT, ...rel.split('/'));

/**
 * Source files directly in `rel`, read at run time so a new file is guarded
 * with no edit. Subdirectories are skipped: `tools/boundary-check/fixture/` is
 * excluded from every tool on purpose.
 */
function directoryFiles(rel: string): string[] {
  return readdirSync(abs(rel), { withFileTypes: true })
    .filter((entry) => entry.isFile() && SOURCE.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .map((name) => join(abs(rel), name));
}

interface Target {
  /** Repo-relative directory or file. */
  readonly path: string;
  /** Absolute paths of the files the target holds. */
  readonly files: readonly string[];
  /** `tsconfig.tools.json` `include` entry. */
  readonly tsInclude: string;
  /** Root Vitest project `include` entry, if the target holds tests. */
  readonly vitestInclude?: string;
  /** `eslint.config.mjs` `files` glob, and the `ignores` negation that un-ignores the target. */
  readonly eslint?: { readonly files: string; readonly negation?: string };
}

const DEFAULT_ESLINT: Target['eslint'] = { files: 'tools/**/*.ts' };

const directoryTarget = (
  dir: string,
  eslint: Target['eslint'] = DEFAULT_ESLINT,
): Target => ({
  path: dir,
  files: directoryFiles(dir),
  tsInclude: `${dir}/*.ts`,
  vitestInclude: `${dir}/*.test.ts`,
  eslint,
});

const TRACKED_JSON_SCRIPTS = '.claude/skills/tracked-json/scripts';

const TARGETS: readonly Target[] = [
  directoryTarget(TRACKED_JSON_SCRIPTS, {
    files: `${TRACKED_JSON_SCRIPTS}/*.ts`,
    negation: `!${TRACKED_JSON_SCRIPTS}/`,
  }),
  directoryTarget('tools/boundary-check'),
  directoryTarget('tools/check'),
  directoryTarget('tools/deferred-issues'),
  directoryTarget('tools/dev-stop'),
  directoryTarget('tools/dts-specifiers'),
  directoryTarget('tools/lint-on-edit'),
  // Only `tsconfig.tools.json` lists it: its test lives in `test/`, and no
  // ESLint `files` glob names `.mjs` under `tools/`.
  { path: 'tools/prune-pages.mjs', files: [abs('tools/prune-pages.mjs')], tsInclude: 'tools/prune-pages.mjs' },
];

const testFiles = (target: Target): string[] => target.files.filter((path) => TEST.test(path));

/**
 * Loads a committed config's default export. The specifier is computed, so
 * `tsc` does not pull `eslint.config.mjs` into `tsconfig.tools.json`'s file
 * list (TS6307) or reject the `.ts` extension (TS5097).
 */
async function importDefault(file: string): Promise<unknown> {
  const module = (await import(pathToFileURL(join(REPO_ROOT, file)).href)) as { default: unknown };
  return module.default;
}

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

/** Files that the parsed `tsconfig.tools.json` (or `json`, its stand-in) does not list as a root file. */
function tsUncovered(files: readonly string[], json: Record<string, unknown>): string[] {
  const parsed = ts.parseJsonConfigFileContent(json, ts.sys, REPO_ROOT, undefined, TOOLS_TSCONFIG);
  return uncovered(files, parsed.fileNames);
}

// --- ESLint -----------------------------------------------------------------

/**
 * A rule that only the main lint block sets, which `files` lists by glob. Later
 * blocks scope rule overrides to `tools/**`, test globs and `*.config.*`, so a
 * file can match some block and still miss the main block. Such a file is not
 * linted by the repo's rules, so it counts as uncovered.
 */
const MAIN_BLOCK_RULE = 'max-lines';

/** Files that the flat config ignores, or that the main lint block does not reach. */
async function eslintUncovered(
  files: readonly string[],
  config: readonly Linter.Config[] | undefined,
): Promise<string[]> {
  const eslint =
    new ESLint(config === undefined ? { cwd: REPO_ROOT } : { cwd: REPO_ROOT, overrideConfigFile: true, overrideConfig: [...config] });
  const covered: string[] = [];
  for (const path of files) {
    const ignored = await eslint.isPathIgnored(path);
    const calculated: unknown = ignored ? undefined : await eslint.calculateConfigForFile(path);
    const rules = (calculated as { rules?: Record<string, unknown> } | undefined)?.rules;
    if (!ignored && rules?.[MAIN_BLOCK_RULE] !== undefined) {
      covered.push(path);
    }
  }
  return uncovered(files, covered);
}

const loadEslintConfig = async (): Promise<readonly Linter.Config[]> =>
  (await importDefault('eslint.config.mjs')) as readonly Linter.Config[];

// --- Vitest -----------------------------------------------------------------

type VitestOptions = Parameters<typeof createVitest>[1];

/** Module ids that Vitest's own glob collects into the `root` project. */
async function vitestCollected(options: VitestOptions): Promise<string[]> {
  const vitest = await createVitest('test', { watch: false, run: true, root: REPO_ROOT, ...options });
  try {
    const specifications = await vitest.globTestSpecifications();
    return specifications
      .filter((specification) => specification.project.name === 'root')
      .map((specification) => specification.moduleId);
  } finally {
    await vitest.close();
  }
}

/** The committed config's collection, shared by every positive case. */
let committedCollection: Promise<string[]> | undefined;
const committedVitestCollected = (): Promise<string[]> => (committedCollection ??= vitestCollected({}));

interface RootProject {
  test: { name: string; include: string[] };
}

async function loadRootProject(): Promise<RootProject | undefined> {
  const shipped = (await importDefault('vitest.config.ts')) as { test: { projects: unknown[] } };
  return shipped.test.projects.find(
    (project): project is RootProject =>
      typeof project === 'object' && (project as { test?: { name?: string } }).test?.name === 'root',
  );
}

// --- Assertions -------------------------------------------------------------

describe('tsconfig.json references tsconfig.tools.json', () => {
  it('so `tsc -b` builds it', () => {
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
});

describe('TARGETS lists every hand-listed tools/ and .claude/ entry', () => {
  const handListed = (entries: readonly string[]): string[] =>
    entries.filter((entry) => entry.startsWith('tools/') || entry.startsWith('.claude/'));

  it('each tsconfig.tools.json include entry under tools/ or .claude/ is some target tsInclude', () => {
    const include = readJsonConfig(TOOLS_TSCONFIG)['include'] as string[];
    const known = new Set(TARGETS.map((target) => target.tsInclude));
    expect(
      handListed(include).filter((entry) => !known.has(entry)),
      'TypeScript: tsconfig.tools.json include entries with no TARGETS row',
    ).toEqual([]);
  });

  it('each Vitest root project include entry under tools/ or .claude/ is some target vitestInclude', async () => {
    const root = await loadRootProject();
    expect(root, 'Vitest: vitest.config.ts has no root project').toBeDefined();
    const known = new Set(TARGETS.map((target) => target.vitestInclude));
    expect(
      handListed(root?.test.include ?? []).filter((entry) => !known.has(entry)),
      'Vitest: vitest.config.ts root project include entries with no TARGETS row',
    ).toEqual([]);
  });
});

describe.each(TARGETS.map((target) => [target.path, target] as const))(
  '%s stays under type, lint and test coverage',
  (_path, target) => {
    const all = target.files.map(relativeLabel);

    it('holds at least one source file, and a test file when Vitest lists it', () => {
      expect(target.files.length, `no source file in ${target.path}`).toBeGreaterThan(0);
      if (target.vitestInclude !== undefined) {
        expect(testFiles(target).length, `no .test.ts file in ${target.path}`).toBeGreaterThan(0);
      }
    });

    describe('TypeScript', () => {
      it(`tsconfig.tools.json include ${target.tsInclude} covers every file`, () => {
        expect(
          tsUncovered(target.files, readJsonConfig(TOOLS_TSCONFIG)),
          `TypeScript: tsconfig.tools.json (include ${target.tsInclude}) does not include`,
        ).toEqual([]);
      });

      it(`the checker reports every file when include ${target.tsInclude} is dropped`, () => {
        const json = readJsonConfig(TOOLS_TSCONFIG);
        const include = json['include'] as string[];
        expect(include, `TypeScript: tsconfig.tools.json has no include entry ${target.tsInclude}`).toContain(
          target.tsInclude,
        );
        const dropped = { ...json, include: include.filter((entry) => entry !== target.tsInclude) };
        expect(
          tsUncovered(target.files, dropped),
          `TypeScript: with tsconfig.tools.json include ${target.tsInclude} dropped, the checker did not report every file`,
        ).toEqual(all);
      });
    });

    const { eslint } = target;
    if (eslint !== undefined) {
      describe('ESLint', () => {
        const ignoresClause = eslint.negation === undefined ? '' : `, ignores ${eslint.negation}`;
        it('eslint.config.mjs lints every file', async () => {
          expect(
            await eslintUncovered(target.files, undefined),
            `ESLint: eslint.config.mjs (files ${eslint.files}${ignoresClause}) ignores or has no config for`,
          ).toEqual([]);
        });

        it(`the checker reports every file when files glob ${eslint.files} is dropped`, async () => {
          const config = await loadEslintConfig();
          expect(
            config.some((block) => block.files?.includes(eslint.files) === true),
            `ESLint: eslint.config.mjs has no files entry ${eslint.files}`,
          ).toBe(true);
          const dropped = config.map((block) =>
            block.files?.includes(eslint.files) === true
              ? { ...block, files: block.files.filter((entry) => entry !== eslint.files) }
              : block,
          );
          expect(
            await eslintUncovered(target.files, dropped),
            `ESLint: with eslint.config.mjs files glob ${eslint.files} dropped, the checker did not report every file`,
          ).toEqual(all);
        });

        const { negation } = eslint;
        if (negation !== undefined) {
          it(`the checker reports every file when ignores negation ${negation} is dropped`, async () => {
            const config = await loadEslintConfig();
            expect(
              config.some((block) => block.ignores?.includes(negation) === true),
              `ESLint: eslint.config.mjs has no ignores entry ${negation}`,
            ).toBe(true);
            const dropped = config.map((block) =>
              block.ignores?.includes(negation) === true
                ? { ...block, ignores: block.ignores.filter((entry) => entry !== negation) }
                : block,
            );
            expect(
              await eslintUncovered(target.files, dropped),
              `ESLint: with eslint.config.mjs ignores negation ${negation} dropped, the checker did not report every file`,
            ).toEqual(all);
          });
        }
      });
    }

    const { vitestInclude } = target;
    if (vitestInclude !== undefined) {
      describe('Vitest', () => {
        const tests = testFiles(target);

        it(`the root project include ${vitestInclude} collects every test file`, async () => {
          expect(
            uncovered(tests, await committedVitestCollected()),
            `Vitest: the root project (include ${vitestInclude}) does not collect`,
          ).toEqual([]);
        });

        it(`the checker reports every test file when root include ${vitestInclude} is dropped`, async () => {
          const root = await loadRootProject();
          expect(
            root?.test.include,
            `Vitest: the root project in vitest.config.ts has no include entry ${vitestInclude}`,
          ).toContain(vitestInclude);
          const include = (root?.test.include ?? []).filter((entry) => entry !== vitestInclude);
          const collected = await vitestCollected({
            config: false,
            projects: [{ test: { ...root?.test, include } }],
          });
          expect(
            uncovered(tests, collected),
            `Vitest: with root include ${vitestInclude} dropped, the checker did not report every test file`,
          ).toEqual(tests.map(relativeLabel));
        });
      });
    }
  },
);
