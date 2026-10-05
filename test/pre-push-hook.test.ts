import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HOOK_PATH = fileURLToPath(new URL('../.githooks/pre-push', import.meta.url));
const COMMAND_OVERRIDE_VARIABLE = 'PRE_PUSH_HOOK_COMMAND_FOR_TEST';
const SHA = '1111111111111111111111111111111111111111';
const ZERO_SHA = '0000000000000000000000000000000000000000';

// The override replaces `pnpm check`: it records the GIT_DIR it saw, then exits with `exitCode`.
function runHook(stdin: string, exitCode = 0, environment: Record<string, string> = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'pre-push-hook-'));
  try {
    const markerPath = path.join(directory, 'ran');
    const commandPath = path.join(directory, 'fake-check.mjs');
    writeFileSync(
      commandPath,
      `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(markerPath)}, process.env.GIT_DIR ?? '');\nprocess.exit(${exitCode});\n`,
    );
    const result = spawnSync(process.execPath, [HOOK_PATH, 'origin', 'https://example.invalid/repo.git'], {
      encoding: 'utf8',
      input: stdin,
      env: { ...process.env, ...environment, [COMMAND_OVERRIDE_VARIABLE]: commandPath },
    });
    const didGateRun = existsSync(markerPath);
    return { status: result.status, stderr: result.stderr, gateRan: didGateRun, gateGitDirectory: didGateRun ? readFileSync(markerPath, 'utf8') : undefined };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const pushLine = `refs/heads/feature ${SHA} refs/heads/feature ${ZERO_SHA}\n`;
const removalLine = `(delete) ${ZERO_SHA} refs/heads/old ${SHA}\n`;

describe('pre-push hook', () => {
  it('runs the gate for a normal push and passes when the gate passes', () => {
    const result = runHook(pushLine);
    expect(result.status).toBe(0);
    expect(result.gateRan).toBe(true);
  });

  it('blocks the push with the gate exit code and names the escape hatch when the gate fails', () => {
    const result = runHook(pushLine, 3);
    expect(result.status).toBe(3);
    expect(result.stderr).toContain('--no-verify');
  });

  it('skips the gate when the push only deletes refs', () => {
    const result = runHook(removalLine);
    expect(result.status).toBe(0);
    expect(result.gateRan).toBe(false);
  });

  it('skips the gate when stdin is empty', () => {
    const result = runHook('');
    expect(result.status).toBe(0);
    expect(result.gateRan).toBe(false);
  });

  it('runs the gate without the GIT_DIR that git exports to the hook', () => {
    const result = runHook(pushLine, 0, { GIT_DIR: path.join(tmpdir(), 'not-a-repository') });
    expect(result.gateRan).toBe(true);
    expect(result.gateGitDirectory).toBe('');
  });

  it('runs the gate when a delete is mixed with a real push', () => {
    const result = runHook(removalLine + pushLine);
    expect(result.status).toBe(0);
    expect(result.gateRan).toBe(true);
  });
});
