// The only child process in `sync`: read-only `git log -1`, no shell (AD-3, AD-12).
// `--no-show-signature` beats `log.showSignature`; `--no-optional-locks` keeps `.git` unwritten.
// No date (no commit, no repository, no `git`) is `undefined`: age falls back to `file-modified`.

import { execFile } from 'node:child_process';

import type { GitPort } from '@poe/contracts';

/** Parses `%at` output: empty is `undefined`, Unix seconds become ISO-8601 UTC, else it throws. */
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
        /* eslint-disable sonarjs/no-os-command-from-path -- boundary: git is resolved from PATH because its install location differs per platform and user, and this repo has no git resolver */
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
              fail(parseError);
            }
          },
        );
        /* eslint-enable sonarjs/no-os-command-from-path -- end of the git call above */
      });
    },
  };
}
