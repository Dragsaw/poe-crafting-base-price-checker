import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import { DELAY_ENV, ISSUER_TEST, LATE_URL } from './guard-after-last-file-fixture/names';

/**
 * Observes the guard after the **last** file of a worker. With the default
 * `isolate`, every file is the last file of its worker. A 0 ms timer that the
 * fixture test starts fires after the setup file's `afterAll` and before the
 * worker ends. No hook inside the worker can fail the run then, so the worker
 * writes the request to disk, and the `onClose` check of `test/global-setup.ts`
 * fails the run and names the URL. A 200 ms timer never fires: the main process
 * ends the worker first.
 *
 * The child needs no network: the fixture URL is under `.invalid`.
 */

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const VITEST_BIN = join(REPO_ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const CHILD_CONFIG = fileURLToPath(new URL('guard-after-last-file-fixture/vitest.config.ts', import.meta.url));

interface AssertionResult {
  readonly title: string;
  readonly status: string;
}

interface FileResult {
  readonly status: string;
  readonly assertionResults: readonly AssertionResult[];
}

interface JsonReport {
  readonly testResults: readonly FileResult[];
}

/**
 * Resolves with the child's exit code; a non-zero exit is expected, not an error.
 * The child's temp directory is `childTmp`, so the test can see what the
 * child's global setup leaves there.
 */
function runChild(
  outputFile: string,
  delayMs: number,
  childTemporary: string,
): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [VITEST_BIN, 'run', '--config', CHILD_CONFIG, '--reporter=json', `--outputFile=${outputFile}`],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          CI: '1',
          [DELAY_ENV]: String(delayMs),
          TMP: childTemporary,
          TEMP: childTemporary,
          TMPDIR: childTemporary,
        },
      },
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

interface ChildRun {
  readonly code: number;
  readonly output: string;
  readonly report: JsonReport;
  /** The entries of the child's temp directory that the global setup made. */
  readonly leftRecordDirs: readonly string[];
}

async function runWithDelay(delayMs: number): Promise<ChildRun> {
  const dir = await mkdtemp(join(tmpdir(), 'guard-after-last-file-'));
  try {
    const childTemporary = join(dir, 'tmp');
    await mkdir(childTemporary);
    const outputFile = join(dir, 'report.json');
    const { code, output } = await runChild(outputFile, delayMs, childTemporary);
    const report = JSON.parse(await readFile(outputFile, 'utf8')) as JsonReport;
    const leftRecordDirectories = (await readdir(childTemporary)).filter((name) => name.startsWith('no-network-'));
    return { code, output, report, leftRecordDirs: leftRecordDirectories };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function issuerStatus(report: JsonReport): string | undefined {
  return report.testResults[0]?.assertionResults.find((result) => result.title === ISSUER_TEST)?.status;
}

it('fails the run and names a request that fires after the last file of a worker closed', { timeout: 120_000 }, async () => {
  const { code, output, report, leftRecordDirs } = await runWithDelay(0);

  // The request fires after the file's hooks, so the test and its file pass.
  expect(report.testResults).toHaveLength(1);
  expect(report.testResults[0]?.status).toBe('passed');
  expect(issuerStatus(report)).toBe('passed');

  // The main-process check fails the run and names the URL.
  expect(code, output).not.toBe(0);
  expect(output).toContain('[no-network] 1 request(s) were blocked after the last test file of a worker closed:');
  expect(output).toContain(`GET ${LATE_URL}`);
  expect(output).toContain(`GET ${LATE_URL} (issued by test "${ISSUER_TEST}")`);

  // The check removes its record directory, even when it fails the run.
  expect(leftRecordDirs).toEqual([]);
});

it('passes when the timer is too late to fire before the worker ends', { timeout: 120_000 }, async () => {
  const { code, output, report, leftRecordDirs } = await runWithDelay(2000);

  expect(issuerStatus(report)).toBe('passed');
  expect(code, output).toBe(0);
  expect(output).not.toContain('[no-network]');
  expect(leftRecordDirs).toEqual([]);
});
