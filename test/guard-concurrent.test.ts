import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import { CONCURRENT_CASES } from './guard-concurrent-fixture/names';

// `beforeEach` sets the store with `enterWith`, and the hooks of concurrent tests interleave. A
// barrier makes both tests of a pair run `beforeEach` before either requests; each `afterEach`
// must still name only its own URL. A sequential run times out, so green proves concurrency.

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const VITEST_BIN = nodePath.join(REPO_ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const CHILD_CONFIG = fileURLToPath(new URL('guard-concurrent-fixture/vitest.config.ts', import.meta.url));

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

it('charges each request of two concurrent tests to the test that issued it', { timeout: 120_000 }, async () => {
  const directory = await mkdtemp(nodePath.join(tmpdir(), 'guard-concurrent-'));
  try {
    const outputFile = nodePath.join(directory, 'report.json');
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
      const others = CONCURRENT_CASES.filter((candidate) => candidate !== testCase);
      for (const other of others) {
        expect(messages, testCase.title).not.toContain(other.url);
      }
    }

    // Every request was charged in its issuer's own `afterEach`, so the
    // file-level check found nothing left.
    expect(file?.message ?? '').toBe('');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
