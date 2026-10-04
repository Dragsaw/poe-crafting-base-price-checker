import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';

import { USER_AGENT_ENV_VAR } from './trade/user-agent.ts';

// The entry guard makes importing the recorder run nothing. It is asserted by
// behaviour below, with spawns, because a source scan passes on an inverted guard.

const SCRIPT = fileURLToPath(new URL('fixtures-record.ts', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface Run {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** The environment the recorder must refuse in: the overlay removed. */
function environmentWithoutContact(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  delete environment[USER_AGENT_ENV_VAR];
  return environment;
}

function run(arguments_: readonly string[]): Promise<Run> {
  return new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      [...arguments_],
      { encoding: 'utf8', env: environmentWithoutContact() },
      (_error, stdout, stderr) => {
        resolve({ code: child.exitCode, stdout, stderr });
      },
    );
  });
}

it('refuses and exits non-zero when spawned directly with no contact overlay', async () => {
  const result = await run([SCRIPT]);

  expect(result.code).not.toBe(0);
  expect(result.stderr).toContain(USER_AGENT_ENV_VAR);
  expect(result.stdout).toBe('');
});

it('runs nothing when the module is imported rather than invoked', async () => {
  const importer = `await import(${JSON.stringify(pathToFileURL(SCRIPT).href)});\nprocess.stdout.write('imported');`;
  const result = await run(['--input-type=module', '-e', importer]);

  // Had the guard been inverted, `main` would have run here and written the
  // refusal to stderr with a non-zero exit — exactly the direct spawn above.
  expect(result.stdout).toBe('imported');
  expect(result.stderr).toBe('');
  expect(result.code).toBe(0);
});

it('is referenced by no vitest config and by no setup file', () => {
  const entryPoints = [
    'vitest.config.ts',
    'test/setup.ts',
    'packages/contracts/vitest.config.ts',
    'packages/core/vitest.config.ts',
    'packages/sync/vitest.config.ts',
    'packages/web/vitest.config.ts',
    'packages/web/vite.config.ts',
    'packages/web/src/test-setup.ts',
  ];

  for (const relative of entryPoints) {
    let source: string;
    try {
      source = readFileSync(`${REPO_ROOT}${relative}`, 'utf8');
    } catch {
      continue;
    }
    expect(source, `${relative} must not reach the recorder`).not.toContain('fixtures-record');
  }
});
