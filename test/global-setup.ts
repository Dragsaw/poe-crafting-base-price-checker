import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  interface ProvidedContext {
    /** Where `test/setup.ts` records requests that arrive after its worker's last file closed. */
    noNetworkRecordDir?: string;
  }
}

// Main-process half of the no-network guard (NFR-1). `onClose`, not a returned teardown: that runs
// before the workers exit and can miss a late record. `provide`, not an env variable: a child
// Vitest that a test starts would inherit it and write into this run's record.
export default function setup(project: TestProject): void {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'no-network-'));
  project.provide('noNetworkRecordDir', directory);
  // Async, so a throw becomes a rejection: Vitest calls every project's
  // callback before it awaits them, and a synchronous throw would skip the rest.
  project.vitest.onClose(async () => {
    assertNoLateRequests(directory);
  });
}

function assertNoLateRequests(directory: string): void {
  let lines: string[];
  try {
    lines = readdirSync(directory)
      .filter((name) => name.endsWith('.log'))
      .flatMap((name) => readFileSync(nodePath.join(directory, name), 'utf8').split('\n'))
      .filter((line) => line !== '');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  if (lines.length > 0) {
    // Vitest prints only the message before the stack, so the message names each URL.
    throw new Error(
      `[no-network] ${String(lines.length)} request(s) were blocked after the last test file of a worker closed:\n  ${lines.join('\n  ')}`,
    );
  }
}
