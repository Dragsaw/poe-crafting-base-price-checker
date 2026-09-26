import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import { CONCURRENT_CASES } from './guard-concurrent-fixture/names';

/**
 * Observes how the **real** hooks of `test/setup.ts` charge requests under
 * `describe.concurrent` and `it.concurrent`. Each `beforeEach` sets the store
 * with `enterWith`, and the `beforeEach` hooks of two concurrent tests
 * interleave. The fixture makes both tests of a pair meet at a barrier before
 * either sends its request, so both `beforeEach` hooks have run by then. Each
 * test then starts its fetch from a `setTimeout` callback and does not await
 * the fetch itself, so the request is charged through the store that the timer
 * carries. Each test's `afterEach` must still name its own URL and no other.
 *
 * A sequential run would time out at the barrier, and the failure would then
 * not name the test's URL. So a green run also proves that the pairs ran
 * concurrently.
 *
 * The child needs no network: every fixture URL is under `.invalid`.
 */

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const VITEST_BIN = join(REPO_ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const CHILD_CONFIG = fileURLToPath(new URL('./guard-concurrent-fixture/vitest.config.ts', import.meta.url));

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
        const code = error === null ? 0 : typeof error.code === 'number' ? error.code : -1;
        resolve({ code, output: `${stdout}\n${stderr}` });
      },
    );
  });
}

it('charges each request of two concurrent tests to the test that issued it', { timeout: 120_000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'guard-concurrent-'));
  try {
    const outputFile = join(dir, 'report.json');
    const { code, output } = await runChild(outputFile);
    const report = JSON.parse(await readFile(outputFile, 'utf8')) as JsonReport;

    expect(code, output).not.toBe(0);
    expect(report.success).toBe(false);
    expect(report.testResults).toHaveLength(1);

    const [file] = report.testResults;
    const byTitle = new Map(file?.assertionResults.map((result) => [result.title, result]));
    expect(byTitle.size).toBe(CONCURRENT_CASES.length);

    for (const testCase of CONCURRENT_CASES) {
      const result = byTitle.get(testCase.title);
      const messages = result?.failureMessages.join('\n') ?? '';
      expect(result?.status, testCase.title).toBe('failed');
      expect(messages, testCase.title).toContain('[no-network] 1 request(s) had no fixture and were blocked');
      expect(messages, testCase.title).toContain(testCase.url);
      for (const other of CONCURRENT_CASES) {
        if (other !== testCase) {
          expect(messages, testCase.title).not.toContain(other.url);
        }
      }
    }

    // Every request was charged in its issuer's own `afterEach`, so the
    // file-level check found nothing left.
    expect(file?.message ?? '').toBe('');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
