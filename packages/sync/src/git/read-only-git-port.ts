/**
 * The real `GitPort` — **read-only, one operation** (AD-3, AD-12).
 *
 * This module is the one place in `sync` that starts a child process.
 * `no-git-write.test.ts` refuses the child-process module in every other
 * source file and lifts that one rule for this path alone; its other rules
 * still apply here, and a further test pins this file to the literal
 * invocation below.
 * Keeping the call in its own module, and not in `shell.ts`, is what keeps the
 * exemption one file wide.
 *
 * What makes it read-only:
 * - the only program run is `git`, with the fixed argument list
 *   `--no-optional-locks log --no-show-signature -1 --format=%at -- <path>`.
 *   `log` reads history and nothing else;
 * - `--no-show-signature` overrides a `log.showSignature` config, which would
 *   otherwise print signature lines ahead of the timestamp;
 * - `--no-optional-locks` stops even the opportunistic index refresh, so the
 *   call writes nothing under `.git`;
 * - `execFile` runs the binary directly, with no shell, so `path` is one
 *   argument and never a command line.
 *
 * `%at` (Unix seconds) makes the UTC conversion exact, with no offset to parse.
 * Where the repository yields no date — no commit touches the path, the root
 * is not a repository, or no `git` binary is found — the answer is `undefined`,
 * and `resolveTrackedListAge` falls back to the `file-modified` clock (AD-12).
 */

import { execFile } from 'node:child_process';

import type { GitPort } from '@poe/contracts';

/**
 * Parses the output of the `log -1 --format=%at` call for `path`: empty output
 * is `undefined` (no history), an integer is Unix seconds, returned as an
 * ISO-8601 UTC string in the form `systemClock` uses. Anything else is a bug
 * and throws, naming the path and the output.
 */
export function parseAuthorDate(path: string, stdout: string): string | undefined {
  const text = stdout.trim();
  if (text === '') {
    return undefined;
  }
  if (!/^\d+$/.test(text)) {
    throw new Error(`git log for ${path} printed ${JSON.stringify(stdout)}, not a Unix timestamp`);
  }
  return new Date(Number(text) * 1000).toISOString();
}

/** A failure that means "no date here", not a bug: no binary (`ENOENT`), or a non-zero exit. */
function isNoDate(error: Error): boolean {
  const { code } = error as Error & { code?: unknown };
  return code === 'ENOENT' || typeof code === 'number';
}

/** The real `GitPort`, reading the repository at `root`. `path` is relative to `root`. */
export function createReadOnlyGitPort(root: string): GitPort {
  return {
    lastCommitAuthorDate(path) {
      return new Promise<string | undefined>((settle, fail) => {
        execFile(
          'git',
          ['--no-optional-locks', 'log', '--no-show-signature', '-1', '--format=%at', '--', path],
          { cwd: root, encoding: 'utf8', windowsHide: true },
          (error, stdout) => {
            if (error !== null) {
              if (isNoDate(error)) {
                settle(undefined);
              } else {
                fail(error);
              }
              return;
            }
            try {
              settle(parseAuthorDate(path, stdout));
            } catch (parseError) {
              fail(parseError as Error);
            }
          },
        );
      });
    },
  };
}
