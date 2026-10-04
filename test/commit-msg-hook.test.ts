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
  it.each([
    ['accepts a story commit with a known package scope', 'feat(sync): story 1.9 structured Sync Report with requests per source'],
    ['accepts a retro item commit with a known package scope', 'fix(sync): retro item 17, an answered search keeps its fields'],
    ['accepts a docs commit with no scope and no id', 'docs: mark story 1.9 done in sprint status'],
    ['accepts a chore commit with a scope outside the package list', 'chore(depcruise): enforce core import purity'],
    ['accepts a plural "stories" id on a known package scope', 'feat(sync): stories 1.9 and 1.10 combined change'],
    [
      'accepts the deferred-work-sweep resolve commit, period included',
      'chore(deferred): resolve — Nothing forbids core from importing node builtins.',
    ],
    [
      'accepts the deferred-work-sweep mark-blocked commit, period included',
      'chore(deferred): mark blocked — Nothing forbids core from importing node builtins.',
    ],
    ['accepts the deferred-work-sweep wip commit', 'wip(deferred): blocked run state — some-item-slug'],
    ['accepts a merge commit unconditionally', "Merge branch 'feature-x'"],
  ])('%s', (_title, subject) => {
    const result = runHook(subject);
    expect(result.status).toBe(0);
  });

  it.each([
    [
      'rejects a subject with no type prefix',
      'structured Sync Report with requests per source',
      'is not "type: description"',
    ],
    ['rejects an unknown commit type', 'feature(sync): story 1.9 structured Sync Report', 'is not one of'],
    ['rejects a subject ending with a period', 'docs: mark story 1.9 done in sprint status.', 'ends with a period'],
    [
      'rejects a feat/fix/test commit on a known package with no story or retro id',
      'feat(sync): tidy up the trade client',
      'names no story or retro item',
    ],
    [
      'rejects a capitalized type with a message naming the case problem',
      'Fix(sync): story 1.9 short description',
      'is not lowercase',
    ],
    [
      'rejects a chore commit outside the deferred scope that ends with a period',
      'chore(depcruise): enforce core import purity.',
      'ends with a period',
    ],
  ])('%s', (_title, subject, message) => {
    const result = runHook(subject);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
  });
});
