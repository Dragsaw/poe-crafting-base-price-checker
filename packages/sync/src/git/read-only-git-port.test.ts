import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveTrackedListAge } from '@poe/contracts';

import { createNodeFilesystemPort } from '../shell.ts';
import { createReadOnlyGitPort, parseAuthorDate } from './read-only-git-port.ts';

/**
 * The real port against a throwaway repository. Git reads no user or system
 * config (`GIT_CONFIG_GLOBAL` points at an empty file, `GIT_CONFIG_NOSYSTEM`),
 * never walks above the temporary directory (`GIT_CEILING_DIRECTORIES`), and
 * every commit carries a fixed author date. The variables are stubbed on
 * `process.env`, so the port under test inherits the same isolation.
 */

const run = promisify(execFile);

let base: string;
let repo: string;
let plain: string;

function isolate(): void {
  vi.stubEnv('GIT_CONFIG_GLOBAL', join(base, 'empty.gitconfig'));
  vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1');
  vi.stubEnv('GIT_CEILING_DIRECTORIES', base);
}

async function git(args: string[], env: Record<string, string> = {}): Promise<void> {
  await run('git', args, { cwd: repo, env: { ...process.env, ...env }, windowsHide: true });
}

async function commitFile(name: string, content: string, authorDate: string): Promise<void> {
  await writeFile(join(repo, name), content);
  await git(['add', '--', name]);
  await git(['commit', '-q', '-m', `edit ${name}`], { GIT_AUTHOR_DATE: authorDate, GIT_COMMITTER_DATE: authorDate });
}

beforeAll(async () => {
  base = await realpath(await mkdtemp(join(tmpdir(), 'poe-git-port-')));
  repo = join(base, 'repo');
  plain = join(base, 'plain');
  await writeFile(join(base, 'empty.gitconfig'), '');
  isolate();
  await run('git', ['init', '-q', repo], { env: process.env, windowsHide: true });
  await mkdir(plain);
  await git(['config', 'commit.gpgsign', 'false']);
  await git(['config', 'user.name', 'Test']);
  await git(['config', 'user.email', 'test@example.invalid']);
  await commitFile('tracked.json', '{"v":1}\n', '2026-09-20T14:00:00+02:00');
  await commitFile('other.json', '{"v":1}\n', '2026-09-22T09:30:00+00:00');
  await mkdir(join(repo, 'data'));
  await commitFile('data/tracked.json', '{"v":1}\n', '2026-09-24T08:15:00-05:00');
  vi.unstubAllEnvs();
});

beforeEach(() => {
  // The suite's `afterEach` may unstub; each test re-applies the isolation.
  isolate();
  return () => {
    vi.unstubAllEnvs();
  };
});

afterAll(async () => {
  await rm(base, { recursive: true, force: true });
});

describe('createReadOnlyGitPort', () => {
  it('returns the author date of the last commit touching the path, in UTC', async () => {
    await expect(createReadOnlyGitPort(repo).lastCommitAuthorDate('tracked.json')).resolves.toBe(
      '2026-09-20T12:00:00.000Z',
    );
  });

  it('ignores a later commit that does not touch the path', async () => {
    const port = createReadOnlyGitPort(repo);
    await expect(port.lastCommitAuthorDate('other.json')).resolves.toBe('2026-09-22T09:30:00.000Z');
    await expect(port.lastCommitAuthorDate('tracked.json')).resolves.toBe('2026-09-20T12:00:00.000Z');
  });

  it('keeps the commit date when the working tree has an uncommitted edit (AD-12)', async () => {
    await writeFile(join(repo, 'tracked.json'), '{"v":2}\n');
    try {
      await expect(createReadOnlyGitPort(repo).lastCommitAuthorDate('tracked.json')).resolves.toBe(
        '2026-09-20T12:00:00.000Z',
      );
    } finally {
      await git(['checkout', '--', 'tracked.json']);
    }
  });

  it('returns undefined for an untracked file', async () => {
    await writeFile(join(repo, 'untracked.json'), '{}\n');
    try {
      await expect(createReadOnlyGitPort(repo).lastCommitAuthorDate('untracked.json')).resolves.toBeUndefined();
    } finally {
      await rm(join(repo, 'untracked.json'));
    }
  });

  it('returns undefined when the root is not a repository', async () => {
    await writeFile(join(plain, 'tracked.json'), '{}\n');
    expect(dirname(plain)).toBe(base);
    await expect(createReadOnlyGitPort(plain).lastCommitAuthorDate('tracked.json')).resolves.toBeUndefined();
  });

  it('still reads the date when the repository sets log.showSignature', async () => {
    await git(['config', 'log.showSignature', 'true']);
    try {
      await expect(createReadOnlyGitPort(repo).lastCommitAuthorDate('tracked.json')).resolves.toBe(
        '2026-09-20T12:00:00.000Z',
      );
    } finally {
      await git(['config', '--unset', 'log.showSignature']);
    }
  });

  it('dates a nested repo-relative path through resolveTrackedListAge as git-author-date', async () => {
    await expect(
      resolveTrackedListAge({
        git: createReadOnlyGitPort(repo),
        filesystem: createNodeFilesystemPort(repo),
        path: 'data/tracked.json',
      }),
    ).resolves.toEqual({ source: 'git-author-date', at: '2026-09-24T13:15:00.000Z' });
  });

  it('returns undefined when no git binary is found', async () => {
    vi.stubEnv('PATH', join(base, 'no-such-bin'));
    await expect(createReadOnlyGitPort(repo).lastCommitAuthorDate('tracked.json')).resolves.toBeUndefined();
  });
});

describe('parseAuthorDate', () => {
  it('converts Unix seconds to an ISO-8601 UTC string', () => {
    expect(parseAuthorDate('data/tracked.json', '1790344800\n')).toBe('2026-09-25T14:00:00.000Z');
  });

  it('reads empty output as no history', () => {
    expect(parseAuthorDate('data/tracked.json', '')).toBeUndefined();
    expect(parseAuthorDate('data/tracked.json', '\n')).toBeUndefined();
  });

  it('throws on output that is not an integer, naming the path and the output', () => {
    expect(() => parseAuthorDate('data/tracked.json', 'fatal: nonsense\n')).toThrow(
      /data\/tracked\.json.*fatal: nonsense/,
    );
  });
});
