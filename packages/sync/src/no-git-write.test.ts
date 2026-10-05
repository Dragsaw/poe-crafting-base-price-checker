import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

// `sync` has no git write path (AD-3): this scan refuses any process spawn and any git subcommand
// that changes a repository, in non-test sources. Only `git/read-only-git-port.ts` (AD-12) spawns,
// for the author date; another test pins it to one `execFile` of `git --no-optional-locks log`.

const ROOT = fileURLToPath(new URL('.', import.meta.url));

const READ_ONLY_GIT_PORT = 'git/read-only-git-port.ts';

/** Path relative to `ROOT`, with `/` separators → the rules lifted for that one file. */
const EXEMPTIONS: Readonly<Record<string, readonly string[]>> = {
  [READ_ONLY_GIT_PORT]: ['a process spawn'],
};

function sources(directory: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(directory)) {
    const path = nodePath.join(directory, name);
    if (statSync(path).isDirectory()) {
      found.push(...sources(path));
    } else if (/\.[cm]?[jt]sx?$/.test(name) && !name.includes('.test.')) {
      found.push(path);
    }
  }
  return found;
}

/** The exemption key for `file`: relative to `ROOT`, `/`-separated on every platform. */
function exemptionKey(file: string): string {
  return nodePath.relative(ROOT, file).split(nodePath.sep).join('/');
}

const GIT_SUBCOMMANDS = [
  'add', 'commit', 'push', 'pull', 'fetch', 'merge', 'rebase', 'reset', 'checkout', 'switch', 'tag', 'stash',
  'rm', 'mv', 'clone', 'init', 'restore', 'apply', 'am', 'cherry-pick', 'revert', 'branch', 'update-ref',
  'config', 'worktree', 'notes', 'commit-tree', 'write-tree', 'update-index', 'gc',
].join('|');

const FORBIDDEN: readonly [string, RegExp][] = [
  ['a process spawn', /child_process/],
  ['a git library', /['"](?:simple-git|isomorphic-git|nodegit|execa)['"]/],
  [
    'a git subcommand',
    new RegExp(String.raw`\bgit\b(?:[\s'"\`,[\]]|-[-\w=%]*(?![-\w=%]))*(?:${GIT_SUBCOMMANDS})\b`),
  ],
];

it('no source under packages/sync/src spawns a process or names a git subcommand', () => {
  const files = sources(ROOT);
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const lifted = EXEMPTIONS[exemptionKey(file)] ?? [];
    for (const [what, pattern] of FORBIDDEN) {
      if (lifted.includes(what)) {
        continue;
      }
      expect(text, `${exemptionKey(file)} contains ${what}`).not.toMatch(pattern);
    }
  }
});

it('the one exemption names an existing file and lifts only the spawn rule', () => {
  expect(Object.entries(EXEMPTIONS)).toEqual([[READ_ONLY_GIT_PORT, ['a process spawn']]]);
  expect(existsSync(nodePath.join(ROOT, READ_ONLY_GIT_PORT))).toBe(true);
});

it('the exempted file makes only the read-only git log call', () => {
  const text = readFileSync(nodePath.join(ROOT, READ_ONLY_GIT_PORT), 'utf8');
  const childProcessImports = [...text.matchAll(/^import\b[^;]*?from\s+['"]([^'"]+)['"]/gm)]
    .filter(([, from]) => from?.includes('child_process'))
    .map(([statement]) => statement);
  expect(childProcessImports).toEqual(["import { execFile } from 'node:child_process'"]);
  // A dynamic `import()` or a `createRequire` call would name it a second time.
  expect(text.match(/child_process/g)).toHaveLength(1);
  expect(text).not.toMatch(/\bexec\s*\(/);
  expect(text).not.toMatch(/spawn/);
  expect(text).not.toMatch(/fork/);
  expect(text).not.toMatch(/shell\s*:/);
  // The whole argument array and the whole options literal: an added argument such as
  // `--output=<file>`, or an added option such as `env`, `cwd` or a shorthand `shell`, fails here.
  expect(text).toMatch(
    /execFile\(\s*'git',\s*\[\s*'--no-optional-locks',\s*'log',\s*'--no-show-signature',\s*'-1',\s*'--format=%at',\s*'--',\s*path\s*\],\s*\{\s*cwd:\s*root,\s*encoding:\s*'utf8',\s*windowsHide:\s*true\s*\},/,
  );
  expect(text.match(/execFile\(/g)).toHaveLength(1);
});

it('the patterns catch what they are meant to catch', () => {
  const [spawn, library, subcommand] = FORBIDDEN.map(([, pattern]) => pattern) as [RegExp, RegExp, RegExp];
  expect("import { execFile } from 'node:child_process';").toMatch(spawn);
  expect("import simpleGit from 'simple-git';").toMatch(library);
  expect('git commit -m "data"').toMatch(subcommand);
  expect("spawn('git', ['push'])").toMatch(subcommand);
  expect('git update-ref refs/heads/main HEAD').toMatch(subcommand);
  expect("execFile('git', ['worktree', 'add'])").toMatch(subcommand);
  expect("execFile('git', ['--no-optional-locks', 'push'])").toMatch(subcommand);
  expect('git --no-pager commit -m x').toMatch(subcommand);
  expect("execFile('git', ['--no-optional-locks', 'log', '-1'])").not.toMatch(subcommand);
  expect('git --no-optional-locks log --no-show-signature -1 --format=%at').not.toMatch(subcommand);
  expect('a git-tracked working tree').not.toMatch(subcommand);
  expect('no git write of any kind').not.toMatch(subcommand);
});
