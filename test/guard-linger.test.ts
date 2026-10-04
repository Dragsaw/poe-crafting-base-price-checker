import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import { HOOK_URLS, TEST_TITLES } from './guard-linger-fixture/names';

/**
 * Observes whether the store that the **real** setup `beforeEach` sets with
 * `enterWith` lingers into hooks that belong to no test: a suite `afterAll`
 * after its test, a later suite's `beforeAll`, and the file-level `afterAll`.
 * Each of those hooks issues an unfixtured request. The file-level check must
 * report each one as issued outside any test, and must never name a test.
 *
 * The child needs no network: every fixture URL is under `.invalid`.
 */

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const VITEST_BIN = nodePath.join(REPO_ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const CHILD_CONFIG = fileURLToPath(new URL('guard-linger-fixture/vitest.config.ts', import.meta.url));

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

it('reports a request from a hook that belongs to no test as issued outside any test', { timeout: 120_000 }, async () => {
  const dir = await mkdtemp(nodePath.join(tmpdir(), 'guard-linger-'));
  try {
    const outputFile = nodePath.join(dir, 'report.json');
    const { code, output } = await runChild(outputFile);
    const report = JSON.parse(await readFile(outputFile, 'utf8')) as JsonReport;

    expect(code, output).not.toBe(0);
    expect(report.success).toBe(false);
    expect(report.testResults).toHaveLength(1);

    const [file] = report.testResults;
    const byTitle = new Map(file?.assertionResults.map((result) => [result.title, result]));
    expect(byTitle.size).toBe(TEST_TITLES.length);
    for (const title of TEST_TITLES) {
      expect(byTitle.get(title)?.status, title).toBe('passed');
    }

    const message = file?.message ?? '';
    expect(message).toContain(
      `[no-network] ${String(Object.keys(HOOK_URLS).length)} request(s) had no fixture and were blocked`,
    );
    for (const [hook, url] of Object.entries(HOOK_URLS)) {
      expect(message, hook).toContain(`GET ${url} (issued outside any test)`);
    }
    expect(message).not.toContain('issued by test');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
