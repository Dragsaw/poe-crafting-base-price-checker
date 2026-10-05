import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import {
  INNOCENT_TEST,
  LATE_ISSUER,
  LATE_URL,
  OWN_TEST,
  OWN_URL,
} from './guard-hooks-fixture/names';

// Observes the real hooks of `test/setup.ts`, not the exported helper: `test/no-network.test.ts`
// calls that directly, so deleting the `afterAll` check or the `afterEach` owner left it green.

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const VITEST_BIN = nodePath.join(REPO_ROOT, 'node_modules', 'vitest', 'vitest.mjs');
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
  const directory = await mkdtemp(nodePath.join(tmpdir(), 'guard-hooks-'));
  try {
    const outputFile = nodePath.join(directory, 'report.json');
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
    await rm(directory, { recursive: true, force: true });
  }
});
