import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import { BYSTANDER_TEST, ISSUER_TEST, LATE_URL } from './guard-reuse-fixture/names';

// Reused worker (`isolate: false`): a timer from the first file fires while the second imports. If
// `afterAll` closed the server the real `fetch` would be back and the second file would pass; the
// guard stays installed, so the request is blocked and the second file's `afterAll` reports it.

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const VITEST_BIN = nodePath.join(REPO_ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const CHILD_CONFIG = fileURLToPath(new URL('guard-reuse-fixture/vitest.config.ts', import.meta.url));

interface AssertionResult {
  readonly title: string;
  readonly status: string;
}

interface FileResult {
  readonly name: string;
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

function fileEndingWith(report: JsonReport, suffix: string): FileResult | undefined {
  return report.testResults.find((file) => file.name.replaceAll('\\', '/').endsWith(suffix));
}

it('blocks a request that fires between files of a reused worker, and names its issuer', { timeout: 120_000 }, async () => {
  const directory = await mkdtemp(nodePath.join(tmpdir(), 'guard-reuse-'));
  try {
    const outputFile = nodePath.join(directory, 'report.json');
    const { code, output } = await runChild(outputFile);
    const report = JSON.parse(await readFile(outputFile, 'utf8')) as JsonReport;

    expect(code, output).not.toBe(0);
    expect(report.success).toBe(false);
    expect(report.testResults).toHaveLength(2);

    const issuer = fileEndingWith(report, '/a-issuer.fixture.ts');
    const bystander = fileEndingWith(report, '/b-bystander.fixture.ts');

    // The request is recorded after the issuer's file ends, not in its own hooks.
    expect(issuer?.status).toBe('passed');

    // Neither test is at fault in its own `afterEach`.
    expect(issuer?.assertionResults.find((result) => result.title === ISSUER_TEST)?.status).toBe('passed');
    expect(bystander?.assertionResults.find((result) => result.title === BYSTANDER_TEST)?.status).toBe('passed');

    // The request was blocked and recorded after the issuer's file ended, so
    // the next file's `afterAll` fails that file and names the issuing test.
    expect(bystander?.status).toBe('failed');
    expect(bystander?.message).toContain(`GET ${LATE_URL} (issued by test "${ISSUER_TEST}")`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
