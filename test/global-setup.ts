import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  interface ProvidedContext {
    /**
     * The directory where `test/setup.ts` records a request that arrived while
     * no test file of its worker was open. `undefined` in a project whose
     * config does not load this global setup.
     */
    noNetworkRecordDir?: string;
  }
}

/**
 * The main-process half of the no-network guard (NFR-1).
 *
 * A test can start a request it does not await. When that request fires after
 * the setup file's `afterAll` in the last file of a worker, the guard blocks
 * it, but no hook inside the worker can still fail the run. So the worker
 * appends the request to `<dir>/<pid>.log`, and the check below reads the
 * record after every worker has exited.
 *
 * `onClose`, not the teardown this function could return: the teardown runs
 * before Vitest waits for the workers to exit, so it can miss a record written
 * in the last milliseconds of a worker. `provide`, not an environment
 * variable: a child Vitest that a test starts would inherit the variable and
 * write into this run's record.
 */
export default function setup(project: TestProject): void {
  const dir = mkdtempSync(join(tmpdir(), 'no-network-'));
  project.provide('noNetworkRecordDir', dir);
  // Async, so a throw becomes a rejection: Vitest calls every project's
  // callback before it awaits them, and a synchronous throw would skip the rest.
  project.vitest.onClose(async () => {
    assertNoLateRequests(dir);
  });
}

function assertNoLateRequests(dir: string): void {
  let lines: string[];
  try {
    lines = readdirSync(dir)
      .filter((name) => name.endsWith('.log'))
      .flatMap((name) => readFileSync(join(dir, name), 'utf8').split('\n'))
      .filter((line) => line !== '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  if (lines.length > 0) {
    // Vitest prints only the message before the stack, so the message names each URL.
    throw new Error(
      `[no-network] ${String(lines.length)} request(s) were blocked after the last test file of a worker closed:\n  ${lines.join('\n  ')}`,
    );
  }
}
