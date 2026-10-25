import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OPS_PI, readText, REPO_ROOT, type RunResult, Sandbox, writeExecutable, writeLine } from './pi-tick-sandbox.ts';

const TICK = path.join(OPS_PI, 'tick.sh');
const SUBJECT = 'chore(data): sync dataset';
const OWNED = ['data/dataset.json', 'data/sync-progress.json', 'data/sync-report.json'];
const INSTALL = 'install --prod --frozen-lockfile --config.confirm-modules-purge=false';
const ZERO_SHA = /^0+$/;

describe.skipIf(process.platform === 'win32')('ops/pi/tick.sh', { timeout: 60_000 }, () => {
  let sandbox: Sandbox;
  let remote = '';
  let pc = '';
  let pi = '';

  const git = (cwd: string, ...arguments_: string[]): string => sandbox.git(cwd, ...arguments_);
  const head = (cwd: string): string => git(cwd, 'rev-parse', 'HEAD');
  const remoteHead = (): string => git(remote, 'rev-parse', 'master');
  const isAncestor = (older: string, newer: string): boolean =>
    sandbox.run('git', ['merge-base', '--is-ancestor', older, newer], { cwd: remote }).status === 0;
  const tick = (environment: NodeJS.ProcessEnv = {}): RunResult => sandbox.run('bash', [TICK, pi], { env: environment });
  const isRebasing = (): boolean => existsSync(path.join(pi, '.git/rebase-merge')) || existsSync(path.join(pi, '.git/rebase-apply'));

  function pcPush(file: string, content: string): void {
    git(pc, 'pull', '-q', '--rebase', 'origin', 'master');
    writeLine(pc, file, content);
    git(pc, 'commit', '-q', '-am', `chore: pc edit ${file}`);
    git(pc, 'push', '-q', 'origin', 'master');
  }

  // The PC clone has no hooks, so only the Pi's push could run the pre-push hook's `pnpm check`.
  function seedPc(): void {
    git(sandbox.work, 'clone', '-q', remote, pc);
    git(pc, 'config', 'user.name', 'pc');
    git(pc, 'config', 'user.email', 'pc@example.invalid');
    mkdirSync(path.join(pc, 'data'));
    mkdirSync(path.join(pc, '.githooks'));
    for (const file of [...OWNED, 'data/tracked.json']) {
      writeLine(pc, file, `{"v":"${path.basename(file)}-0"}`);
    }
    writeLine(pc, 'pnpm-lock.yaml', 'lock: 1');
    writeLine(pc, '.gitignore', '*.lock\n.env\n.env.*');
    for (const hook of ['commit-msg', 'pre-push']) {
      copyFileSync(path.join(REPO_ROOT, '.githooks', hook), path.join(pc, '.githooks', hook));
      chmodSync(path.join(pc, '.githooks', hook), 0o755);
    }
    git(pc, 'add', '-A');
    git(pc, 'commit', '-q', '-m', 'chore: seed');
    writeLine(pc, 'data/tracked.json', '{"v":"tracked-1"}');
    git(pc, 'commit', '-q', '-am', 'chore: seed tracked');
    git(pc, 'push', '-q', 'origin', 'master');
  }

  beforeEach(() => {
    sandbox = new Sandbox();
    remote = path.join(sandbox.work, 'remote.git');
    pc = path.join(sandbox.work, 'pc');
    pi = path.join(sandbox.work, 'pi');
    git(sandbox.work, 'init', '-q', '--bare', '-b', 'master', remote);
    git(remote, 'config', 'core.logAllRefUpdates', 'always');
    // A bare repository runs its hooks in its own directory.
    writeExecutable(path.join(remote, 'hooks', 'pre-receive'), '[[ ! -e reject-push ]]');
    seedPc();
    git(sandbox.work, 'clone', '-q', remote, pi);
    git(pi, 'config', 'user.name', 'pi');
    git(pi, 'config', 'user.email', 'pi@example.invalid');
    git(pi, 'config', 'core.hooksPath', '.githooks');
  });

  afterEach(() => {
    try {
      const reflog = readText(remote, 'logs/refs/heads/master').split('\n').filter(Boolean);
      for (const line of reflog) {
        const [previous = '', next = ''] = line.split(' ', 2);
        expect(ZERO_SHA.test(previous) || isAncestor(previous, next), `forced update on the remote: ${line}`).toBe(true);
      }
    } finally {
      sandbox.dispose();
    }
  });

  it('commits the fresh owned files, rebases and pushes one commit', () => {
    writeLine(pi, 'data/dataset.json', '{"v":"fresh-1"}');
    writeLine(pi, 'data/sync-progress.json', '{"v":"progress-1"}');
    const before = remoteHead();
    const result = tick();
    expect(result.status, result.output).toBe(0);
    expect(git(remote, 'rev-list', '--count', `${before}..master`)).toBe('1');
    expect(git(remote, 'log', '-1', '--format=%s', 'master')).toBe(SUBJECT);
    expect(head(pi)).toBe(remoteHead());
    expect(sandbox.fakeLog()).toEqual([]);
  });

  it('makes no commit on a clean tree and still pulls', () => {
    pcPush('data/tracked.json', '{"v":"curated-on-pc"}');
    const result = tick();
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain('no change');
    expect(head(pi)).toBe(head(pc));
    expect(head(pi)).toBe(remoteHead());
  });

  it('pushes a local commit that an earlier failed tick left', () => {
    writeLine(pi, 'data/sync-report.json', '{"v":"report-2"}');
    git(pi, 'commit', '-q', '-am', SUBJECT);
    const result = tick();
    expect(result.status, result.output).toBe(0);
    expect(remoteHead()).toBe(head(pi));
  });

  it('aborts before a commit when a tracked file outside the owned list is modified', () => {
    writeLine(pi, 'data/tracked.json', '{"v":"curated-on-pi"}');
    writeLine(pi, 'data/dataset.json', '{"v":"fresh-3"}');
    const [local, before] = [head(pi), remoteHead()];
    const result = tick();
    expect(result.status).toBe(3);
    expect(result.output).toContain('outside the sync-owned list: data/tracked.json');
    expect(head(pi)).toBe(local);
    expect(remoteHead()).toBe(before);
  });

  it('aborts before a commit on a stray untracked file', () => {
    mkdirSync(path.join(pi, 'sub'));
    writeLine(pi, 'sub/stray file.txt', '');
    const local = head(pi);
    const result = tick();
    expect(result.status).toBe(3);
    expect(result.output).toContain('outside the sync-owned list: sub/stray file.txt');
    expect(head(pi)).toBe(local);
  });

  it('does not count git-ignored files as drift', () => {
    writeLine(pi, 'data/sync.lock', '');
    writeLine(pi, '.env', 'POE_SYNC_USER_AGENT=test');
    const result = tick();
    expect(result.status, result.output).toBe(0);
  });

  it('rebases onto a remote that is ahead and pushes a fast-forward', () => {
    pcPush('data/tracked.json', '{"v":"curated-on-pc"}');
    writeLine(pi, 'data/dataset.json', '{"v":"fresh-4"}');
    const result = tick();
    expect(result.status, result.output).toBe(0);
    expect(head(pi)).toBe(remoteHead());
    expect(isAncestor(head(pc), 'master')).toBe(true);
    expect(git(remote, 'rev-list', '--merges', '--count', 'master')).toBe('0');
    expect(readText(pi, 'data/tracked.json')).toContain('curated-on-pc');
  });

  it('aborts a conflicting rebase, keeps the local commit, and the runbook recovery publishes', () => {
    pcPush('data/dataset.json', '{"v":"pc-dataset"}');
    writeLine(pi, 'data/dataset.json', '{"v":"pi-dataset"}');
    const [local, before] = [head(pi), remoteHead()];
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = tick();
      expect(result.status, result.output).toBe(4);
      expect(isRebasing()).toBe(false);
      expect(remoteHead()).toBe(before);
    }
    expect(git(pi, 'rev-list', '--count', `${local}..HEAD`)).toBe('1');
    expect(git(pi, 'log', '-1', '--format=%s')).toBe(SUBJECT);
    expect(git(pi, 'status', '--porcelain')).toBe('');

    const keep = mkdtempSync(path.join(sandbox.work, 'keep-'));
    for (const file of OWNED) {
      copyFileSync(path.join(pi, file), path.join(keep, path.basename(file)));
    }
    git(pi, 'fetch', '-q', 'origin');
    git(pi, 'reset', '-q', '--hard', 'origin/master');
    for (const file of OWNED) {
      copyFileSync(path.join(keep, path.basename(file)), path.join(pi, file));
    }
    const recovered = tick();
    expect(recovered.status, recovered.output).toBe(0);
    expect(head(pi)).toBe(remoteHead());
    expect(git(remote, 'show', 'master:data/dataset.json')).toContain('pi-dataset');
  });

  it('removes a stale index.lock, then ticks normally', () => {
    writeLine(pi, '.git/index.lock', '');
    writeLine(pi, 'data/dataset.json', '{"v":"fresh-6"}');
    const result = tick();
    expect(result.status, result.output).toBe(0);
    expect(existsSync(path.join(pi, '.git/index.lock'))).toBe(false);
    expect(head(pi)).toBe(remoteHead());
  });

  it('keeps an index.lock while a git process runs', () => {
    writeLine(pi, '.git/index.lock', '');
    expect(tick({ FAKE_PGREP_EXIT: '0' }).status).toBe(2);
    expect(existsSync(path.join(pi, '.git/index.lock'))).toBe(true);
  });

  it('aborts a half-done rebase, then ticks normally', () => {
    sandbox.run('git', ['rebase', '-x', 'false', 'HEAD~1'], { cwd: pi });
    expect(isRebasing()).toBe(true);
    writeLine(pi, 'data/dataset.json', '{"v":"fresh-7"}');
    const result = tick();
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain('aborting a half-done rebase');
    expect(git(pi, 'symbolic-ref', '--short', 'HEAD')).toBe('master');
    expect(head(pi)).toBe(remoteHead());
  });

  it('installs once when the pull changes pnpm-lock.yaml', () => {
    pcPush('pnpm-lock.yaml', 'lock: 2');
    expect(tick().status).toBe(0);
    expect(sandbox.fakeLog()).toEqual([INSTALL]);
    sandbox.clearFakeLog();
    expect(tick().status).toBe(0);
    expect(sandbox.fakeLog()).toEqual([]);
  });

  it('retries a failed install on the next tick', () => {
    pcPush('pnpm-lock.yaml', 'lock: 3');
    expect(tick({ FAKE_PNPM_EXIT: '1' }).status).toBe(6);
    sandbox.clearFakeLog();
    const result = tick();
    expect(result.status, result.output).toBe(0);
    expect(sandbox.fakeLog()).toEqual([INSTALL]);
  });

  it('has installed the new lockfile when the push after it fails', () => {
    pcPush('pnpm-lock.yaml', 'lock: 4');
    writeLine(pi, 'data/dataset.json', '{"v":"fresh-8"}');
    writeLine(remote, 'reject-push', '');
    const result = tick();
    expect(result.status, result.output).toBe(5);
    expect(sandbox.fakeLog()).toEqual([INSTALL]);
    expect(readText(pi, '.git/poe-tick-installed-lockfile').trim()).toBe(git(pi, 'rev-parse', 'HEAD:pnpm-lock.yaml'));
    rmSync(path.join(remote, 'reject-push'));
    sandbox.clearFakeLog();
    expect(tick().status).toBe(0);
    expect(sandbox.fakeLog()).toEqual([]);
    expect(remoteHead()).toBe(head(pi));
  });

  // The PC pushes while the tick installs, so only a forced push could publish the Pi's commit.
  it('never overwrites a commit that reaches the remote during the tick', () => {
    pcPush('pnpm-lock.yaml', 'lock: 5');
    writeLine(pi, 'data/dataset.json', '{"v":"fresh-10"}');
    const race = 'git -C "$FAKE_PC" commit -q --allow-empty -m "chore: pc race" && git -C "$FAKE_PC" push -q origin master';
    const result = tick({ FAKE_PC: pc, FAKE_PNPM_RUN: race });
    expect(result.status, result.output).toBe(5);
    expect(git(pc, 'log', '-1', '--format=%s')).toBe('chore: pc race');
    expect(isAncestor(head(pc), 'master')).toBe(true);
  });

  it('exits 2 on a branch other than master and makes no commit', () => {
    git(pi, 'checkout', '-q', '-b', 'side');
    writeLine(pi, 'data/dataset.json', '{"v":"fresh-11"}');
    const local = head(pi);
    const result = tick();
    expect(result.status).toBe(2);
    expect(result.output).toContain('on branch side, expected master');
    expect(head(pi)).toBe(local);
  });

  it('exits 2 when the repository dir does not exist', () => {
    const result = sandbox.run('bash', [TICK, path.join(sandbox.work, 'missing')]);
    expect(result.status).toBe(2);
    expect(result.output).toContain('is not a directory');
  });

  it('exits 2 on a detached HEAD', () => {
    git(pi, 'checkout', '-q', '--detach');
    const result = tick();
    expect(result.status).toBe(2);
    expect(result.output).toContain('HEAD is detached');
  });

  it('exits 2 without a repository dir and reads POE_REPO_DIR', () => {
    expect(sandbox.run('bash', [TICK]).status).toBe(2);
    expect(sandbox.run('bash', [TICK], { env: { POE_REPO_DIR: pi } }).status).toBe(0);
  });

  it('logs an unexpected failure through the ERR trap', () => {
    git(pi, 'config', 'user.useConfigOnly', 'true');
    git(pi, 'config', '--unset', 'user.name');
    git(pi, 'config', '--unset', 'user.email');
    writeLine(pi, 'data/dataset.json', '{"v":"fresh-9"}');
    const result = tick();
    expect(result.status).not.toBe(0);
    expect(result.output).toMatch(/tick: ERROR: line \d+ exited [1-9]\d*: git commit/);
  });
});
