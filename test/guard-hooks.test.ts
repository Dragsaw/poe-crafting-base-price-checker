import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import {
  INNOCENT_TEST,
  LATE_ISSUER,
  LATE_URL,
  OWN_TEST,
  OWN_URL,
} from './guard-hooks-fixture/names';

/**
 * Observes the **real** hooks of `test/setup.ts`, not the exported helper.
 * `test/no-network.test.ts` calls the helper directly, so deleting the setup
 * file's `afterAll` check, or the owner its `afterEach` passes, left that file
 * green. Here a child Vitest runs a fixture with the real setup file, and this
 * test reads the outcome Vitest reported for each test and for the file.
 *
 * The child needs no network: every fixture URL is under `.invalid`, and the
 * setup file blocks each one before it leaves the process.
 */

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const VITEST_BIN = join(REPO_ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const CHILD_CONFIG = fileURLToPath(new URL('guard-hooks-fixture/vitest.config.ts', import.meta.url));

interface AssertionResult {
  readonly title: string;
  readonly status: string;
  readonly failureMessages: readonly string[];
}

interface FileResult {
  readonly status: string;
  readonly message: string;
  readonly assertionResults: readonly AssertionResult[];
}

interface JsonReport {
  readonly success: boolean;
  readonly testResults: readonly FileResult[];
}

/** Resolves with the child's exit code; a non-zero exit is expected, not an error. */
function runChild(outputFile: string): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [VITEST_BIN, 'run', '--config', CHILD_CONFIG, '--reporter=json', `--outputFile=${outputFile}`],
      { cwd: REPO_ROOT, env: { ...process.env, CI: '1' } },
      (error, stdout, stderr) => {
        let code = 0;
        if (error !== null) {
          code = typeof error.code === 'number' ? error.code : -1;
        }
        resolve({ code, output: `${stdout}\n${stderr}` });
      },
    );
  });
}

it('fails the issuer through the real hooks, and never the innocent test', { timeout: 120_000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'guard-hooks-'));
  try {
    const outputFile = join(dir, 'report.json');
    const { code, output } = await runChild(outputFile);
    const report = JSON.parse(await readFile(outputFile, 'utf8')) as JsonReport;

    // The file-level check makes the run fail.
    expect(code, output).not.toBe(0);
    expect(report.success).toBe(false);
    expect(report.testResults).toHaveLength(1);

    const [file] = report.testResults;
    const byTitle = new Map(file?.assertionResults.map((result) => [result.title, result]));

    // (i) The real `afterEach` fails a test for its own request.
    const own = byTitle.get(OWN_TEST);
    expect(own?.status).toBe('failed');
    expect(own?.failureMessages.join('\n')).toContain('[no-network]');
    expect(own?.failureMessages.join('\n')).toContain(OWN_URL);

    // (ii) and (iii) The late request is charged to neither test's `afterEach`.
    expect(byTitle.get(LATE_ISSUER)?.status).toBe('passed');
    expect(byTitle.get(INNOCENT_TEST)?.status).toBe('passed');
    expect(byTitle.get(INNOCENT_TEST)?.failureMessages.join('\n')).not.toContain(LATE_URL);

    // The real `afterAll` fails the file and names the URL and its issuer.
    expect(file?.status).toBe('failed');
    expect(file?.message).toContain("No test's afterEach reported these requests:");
    expect(file?.message).toContain(`GET ${LATE_URL} (issued by test "${LATE_ISSUER}")`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
