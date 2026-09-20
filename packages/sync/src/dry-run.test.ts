import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('./dry-run.ts', import.meta.url));

interface Run {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Spawns the stub the way `pnpm sync:dry` does, with both streams piped. */
function runStub(): Promise<Run> {
  return new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      [SCRIPT],
      { encoding: 'utf8' },
      (_error, stdout, stderr) => {
        resolve({ code: child.exitCode, stdout, stderr });
      },
    );
  });
}

it('exits non-zero with the notice on stderr and nothing on stdout', async () => {
  const run = await runStub();

  expect(run.code).not.toBe(0);
  expect(run.stderr).toContain('not implemented yet');

  // AGENT-WORKFLOW.md reserves stdout as the report channel for the real dry
  // run. The stub must leave it empty, so a later `console.log` here is caught.
  expect(run.stdout).toBe('');
});
