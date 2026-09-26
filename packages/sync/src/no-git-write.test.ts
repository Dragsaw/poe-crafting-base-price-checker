import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

/**
 * `sync` has no git write path (AD-3): it writes its own files by explicit
 * path, and the player commits and pushes. This scan keeps it that way. It
 * reads every non-test source under `packages/sync/src` and refuses any
 * process spawn and any git subcommand that would change a repository.
 * Test files are exempt: a test may spawn `node` to run a script.
 */

const ROOT = fileURLToPath(new URL('.', import.meta.url));

function sources(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return sources(path);
    }
    return /\.[cm]?[jt]sx?$/.test(name) && !name.includes('.test.') ? [path] : [];
  });
}

const FORBIDDEN: readonly [string, RegExp][] = [
  ['a process spawn', /child_process/],
  ['a git library', /['"](?:simple-git|isomorphic-git|nodegit|execa)['"]/],
  [
    'a git subcommand',
    /\bgit\b[\s'"`,[\]]*(?:add|commit|push|pull|fetch|merge|rebase|reset|checkout|switch|tag|stash|rm|mv|clone|init|restore|apply|am|cherry-pick|revert|branch|update-ref|config|worktree|notes|commit-tree|write-tree|update-index|gc)\b/,
  ],
];

it('no source under packages/sync/src spawns a process or names a git subcommand', () => {
  const files = sources(ROOT);
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const [what, pattern] of FORBIDDEN) {
      expect(text, `${relative(ROOT, file)} contains ${what}`).not.toMatch(pattern);
    }
  }
});

it('the patterns catch what they are meant to catch', () => {
  const [spawn, library, subcommand] = FORBIDDEN.map(([, pattern]) => pattern) as [RegExp, RegExp, RegExp];
  expect("import { execFile } from 'node:child_process';").toMatch(spawn);
  expect("import simpleGit from 'simple-git';").toMatch(library);
  expect('git commit -m "data"').toMatch(subcommand);
  expect("spawn('git', ['push'])").toMatch(subcommand);
  expect('git update-ref refs/heads/main HEAD').toMatch(subcommand);
  expect("execFile('git', ['worktree', 'add'])").toMatch(subcommand);
  expect('a git-tracked working tree').not.toMatch(subcommand);
  expect('no git write of any kind').not.toMatch(subcommand);
});
