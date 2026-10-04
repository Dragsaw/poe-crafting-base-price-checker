import { execFile } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';

import { REPO_ROOT } from './catalogue-refresh/test-support.ts';
import { USER_AGENT_ENV_VAR } from './trade/user-agent.ts';

// The entry guard makes importing the refresher run nothing. It is asserted by
// behaviour below, with spawns, because a source scan passes on an inverted guard.

const SCRIPT = fileURLToPath(new URL('catalogue-refresh.ts', import.meta.url));

interface Run {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** The environment the refresher must refuse in: the overlay removed. */
function environmentWithoutContact(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  delete environment[USER_AGENT_ENV_VAR];
  return environment;
}

function run(arguments_: readonly string[]): Promise<Run> {
  return new Promise((settle) => {
    const child = execFile(
      process.execPath,
      [...arguments_],
      { encoding: 'utf8', env: environmentWithoutContact() },
      (_error, stdout, stderr) => {
        settle({ code: child.exitCode, stdout, stderr });
      },
    );
  });
}

// --- the entry guard, asserted by behaviour ---------------------------------

it('refuses and exits non-zero when spawned directly with no contact overlay', async () => {
  const result = await run([SCRIPT]);

  expect(result.code).not.toBe(0);
  expect(result.stderr).toContain(USER_AGENT_ENV_VAR);
  expect(result.stdout).toBe('');
});

it('runs nothing when the module is imported rather than invoked', async () => {
  const importer = `await import(${JSON.stringify(pathToFileURL(SCRIPT).href)});\nprocess.stdout.write('imported');`;
  const result = await run(['--input-type=module', '-e', importer]);

  // An inverted guard would run `main` here and refuse on stderr, as the direct spawn does.
  expect(result.stdout).toBe('imported');
  expect(result.stderr).toBe('');
  expect(result.code).toBe(0);
});

const read = (entryPoint: string): string | undefined => {
  try {
    return readFileSync(`${REPO_ROOT}${entryPoint}`, 'utf8');
  } catch {
    return undefined;
  }
};

it('is referenced by no vitest config and by no setup file', () => {
  // A missing required entry means a config moved; skipping it would pass silently.
  // `web` has no suite yet, so its paths are optional.
  const required = [
    'vitest.config.ts',
    'test/setup.ts',
    'packages/contracts/vitest.config.ts',
    'packages/core/vitest.config.ts',
    'packages/sync/vitest.config.ts',
  ];
  const optional = [
    'packages/web/vitest.config.ts',
    'packages/web/vite.config.ts',
    'packages/web/src/test-setup.ts',
  ];

  for (const entryPoint of required) {
    const source = read(entryPoint);
    expect(source, `${entryPoint} must exist for this scan to mean anything`).toBeDefined();
    expect(source, `${entryPoint} must not reach the refresher`).not.toContain('catalogue-refresh');
  }

  for (const entryPoint of optional) {
    const source = read(entryPoint);
    if (source === undefined) {
      continue;
    }
    expect(source, `${entryPoint} must not reach the refresher`).not.toContain('catalogue-refresh');
  }
});

// Node's type stripping resolves no extensions, so a `contracts/src` specifier
// without `.ts` kills the command at load; vitest accepts either, only a spawn catches it.
it('loads @poe/contracts under bare node, as the command itself must', async () => {
  const packageRoot = fileURLToPath(new URL('../', import.meta.url));
  const result = await new Promise<Run>((settle) => {
    const child = execFile(
      process.execPath,
      ['--input-type=module', '-e', "await import('@poe/contracts');"],
      { encoding: 'utf8', cwd: packageRoot, env: environmentWithoutContact() },
      (_error, stdout, stderr) => {
        settle({ code: child.exitCode, stdout, stderr });
      },
    );
  });

  expect(result.stderr).toBe('');
  expect(result.code).toBe(0);
});

it('names the real fetch port in no test file', () => {
  // The real port runs only against loopback, only in `shell-fetch.test.ts` (AD-8);
  // `test/setup.ts` fails remote requests. A bare identifier scan, because a
  // specifier regex misses `from './shell'`, dynamic imports and re-exports.
  const sourceDirectory = fileURLToPath(new URL('.', import.meta.url));
  const testFiles = readdirSync(sourceDirectory, { recursive: true, encoding: 'utf8' }).filter((name) =>
    name.endsWith('.test.ts'),
  );

  expect(testFiles.length).toBeGreaterThan(0);
  // The exemption below must not go dead silently: a rename or a deletion of the
  // loopback test would reopen L-V1 with no failure.
  expect(testFiles).toContain('shell-fetch.test.ts');
  expect(readFileSync(`${sourceDirectory}shell-fetch.test.ts`, 'utf8')).toContain('createFetchHttpPort');
  for (const name of testFiles) {
    if (name === 'catalogue-refresh.test.ts') {
      // This file names it in the comment above, and nowhere else.
      continue;
    }
    if (name === 'shell-fetch.test.ts') {
      // The one file that executes the port, against its own loopback server.
      continue;
    }
    const source = readFileSync(`${sourceDirectory}${name}`, 'utf8');
    expect(source, `${name} must not name the real fetch port`).not.toContain(
      'createFetchHttpPort',
    );
  }
});

it('is reachable at the script name the human is told to run', () => {
  // The string a human types lives in the root manifest; every other spawn here
  // uses a path this file computes, so only this test catches a typo in it.
  const manifest = JSON.parse(readFileSync(`${REPO_ROOT}package.json`, 'utf8')) as {
    scripts: Record<string, string>;
  };
  const script = manifest.scripts['catalogue:refresh'];

  expect(script).toBeDefined();
  const entry = (script ?? '').split(/\s+/).at(-1);
  expect(nodePath.resolve(REPO_ROOT, entry ?? '')).toBe(SCRIPT);
  // The recorder's precedent, and what lets `.env` supply the contact overlay.
  expect(script).toContain('--env-file-if-exists=.env');
});
