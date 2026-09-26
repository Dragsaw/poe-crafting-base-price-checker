import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const HOOK_PATH = fileURLToPath(new URL('../.githooks/commit-msg', import.meta.url));

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'commit-msg-hook-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function runHook(subject: string) {
  const messagePath = join(workDir, 'MSG');
  writeFileSync(messagePath, `${subject}\n`);
  return spawnSync(process.execPath, [HOOK_PATH, messagePath], { encoding: 'utf8' });
}

describe('commit-msg hook', () => {
  it('accepts a story commit with a known package scope', () => {
    const result = runHook('feat(sync): story 1.9 structured Sync Report with requests per source');
    expect(result.status).toBe(0);
  });

  it('accepts a retro item commit with a known package scope', () => {
    const result = runHook('fix(sync): retro item 17, an answered search keeps its fields');
    expect(result.status).toBe(0);
  });

  it('accepts a docs commit with no scope and no id', () => {
    const result = runHook('docs: mark story 1.9 done in sprint status');
    expect(result.status).toBe(0);
  });

  it('accepts a chore commit with a scope outside the package list', () => {
    const result = runHook('chore(depcruise): enforce core import purity');
    expect(result.status).toBe(0);
  });

  it('accepts a plural "stories" id on a known package scope', () => {
    const result = runHook('feat(sync): stories 1.9 and 1.10 combined change');
    expect(result.status).toBe(0);
  });

  it('accepts the deferred-work-sweep resolve commit, period included', () => {
    const result = runHook('chore(deferred): resolve — Nothing forbids core from importing node builtins.');
    expect(result.status).toBe(0);
  });

  it('accepts the deferred-work-sweep mark-blocked commit, period included', () => {
    const result = runHook('chore(deferred): mark blocked — Nothing forbids core from importing node builtins.');
    expect(result.status).toBe(0);
  });

  it('accepts the deferred-work-sweep wip commit', () => {
    const result = runHook('wip(deferred): blocked run state — some-item-slug');
    expect(result.status).toBe(0);
  });

  it('accepts a merge commit unconditionally', () => {
    const result = runHook("Merge branch 'feature-x'");
    expect(result.status).toBe(0);
  });

  it('rejects a subject with no type prefix', () => {
    const result = runHook('structured Sync Report with requests per source');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('is not "type: description"');
  });

  it('rejects an unknown commit type', () => {
    const result = runHook('feature(sync): story 1.9 structured Sync Report');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('is not one of');
  });

  it('rejects a subject ending with a period', () => {
    const result = runHook('docs: mark story 1.9 done in sprint status.');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ends with a period');
  });

  it('rejects a feat/fix/test commit on a known package with no story or retro id', () => {
    const result = runHook('feat(sync): tidy up the trade client');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('names no story or retro item');
  });

  it('rejects a capitalized type with a message naming the case problem', () => {
    const result = runHook('Fix(sync): story 1.9 short description');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('is not lowercase');
  });

  it('rejects a chore commit outside the deferred scope that ends with a period', () => {
    const result = runHook('chore(depcruise): enforce core import purity.');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ends with a period');
  });
});
