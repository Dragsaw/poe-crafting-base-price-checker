import { describe, expect, it } from 'vitest';

import { createFakeClockPort } from './clock';
import { createFakeFilesystemPort } from './filesystem';
import { createFakeGitPort } from './git';
import { createFakeHttpPort } from './http';
import type { ClockPort } from '../clock';
import type { FilesystemPort } from '../filesystem';
import type { GitPort } from '../git';
import type { HttpPort } from '../http';

describe('the in-memory fakes', () => {
  it('satisfies each port interface, so a consumer can be written against the port', () => {
    const http: HttpPort = createFakeHttpPort();
    const filesystem: FilesystemPort = createFakeFilesystemPort();
    const git: GitPort = createFakeGitPort();
    const clock: ClockPort = createFakeClockPort('2026-09-20T09:00:00Z');

    expect(typeof http.send).toBe('function');
    expect(typeof filesystem.writeTextFile).toBe('function');
    expect(typeof git.lastCommitAuthorDate).toBe('function');
    expect(clock.now()).toBe('2026-09-20T09:00:00Z');
  });
});

describe('createFakeHttpPort', () => {
  it('answers a fixtured request and records what was sent', async () => {
    const http = createFakeHttpPort({
      'GET https://example.test/a': {
        status: 200,
        headers: { 'x-rate-limit-rules': 'Ip' },
        body: '{}',
      },
    });

    const response = await http.send({ method: 'GET', url: 'https://example.test/a', headers: {} });
    expect(response.status).toBe(200);
    expect(response.headers['x-rate-limit-rules']).toBe('Ip');
    expect(http.requests).toHaveLength(1);
  });

  it('returns a non-2xx status as a value rather than throwing', async () => {
    const http = createFakeHttpPort();
    http.respondTo('POST', 'https://example.test/b', {
      status: 429,
      headers: { 'retry-after': '60' },
      body: '',
    });

    await expect(
      http.send({ method: 'POST', url: 'https://example.test/b', headers: {} }),
    ).resolves.toMatchObject({ status: 429 });
  });

  it('fails loudly on an unfixtured request rather than inventing an answer', async () => {
    const http = createFakeHttpPort();
    await expect(
      http.send({ method: 'GET', url: 'https://example.test/missing', headers: {} }),
    ).rejects.toThrow(/no fixture/);
  });
});

describe('createFakeFilesystemPort', () => {
  it('holds its state in the closure, with no node: import anywhere', async () => {
    const filesystem = createFakeFilesystemPort({
      'data/config.json': { contents: '{"league":"x"}', modifiedAt: '2026-09-19T00:00:00Z' },
    });

    await expect(filesystem.readTextFile('data/config.json')).resolves.toBe('{"league":"x"}');
    await expect(filesystem.exists('data/config.json')).resolves.toBe(true);
    await expect(filesystem.lastModifiedAt('data/config.json')).resolves.toBe(
      '2026-09-19T00:00:00Z',
    );

    await filesystem.writeTextFile('data/dataset.json', '{}\n');
    expect(filesystem.paths()).toEqual(['data/config.json', 'data/dataset.json']);

    await filesystem.deleteFile('data/dataset.json');
    await expect(filesystem.exists('data/dataset.json')).resolves.toBe(false);
  });

  it('answers undefined for a path it does not hold', async () => {
    const filesystem = createFakeFilesystemPort();
    await expect(filesystem.readTextFile('nowhere')).resolves.toBeUndefined();
    await expect(filesystem.lastModifiedAt('nowhere')).resolves.toBeUndefined();
    await expect(filesystem.deleteFile('nowhere')).resolves.toBeUndefined();
  });
});

describe('createFakeGitPort', () => {
  it('carries exactly one read-only operation', () => {
    const git = createFakeGitPort();
    const operations = Object.keys(git).filter((key) => key !== 'setAuthorDate' && key !== 'clearHistory');
    expect(operations).toEqual(['lastCommitAuthorDate']);
  });

  it('answers the last commit author date, and undefined where there is no history', async () => {
    const git = createFakeGitPort({ 'data/tracked.json': '2026-09-18T11:00:00Z' });
    await expect(git.lastCommitAuthorDate('data/tracked.json')).resolves.toBe(
      '2026-09-18T11:00:00Z',
    );

    git.clearHistory('data/tracked.json');
    await expect(git.lastCommitAuthorDate('data/tracked.json')).resolves.toBeUndefined();
  });
});

describe('createFakeClockPort', () => {
  it('returns only what it was told, so a run is deterministic', () => {
    const clock = createFakeClockPort('2026-09-20T09:00:00Z');
    expect(clock.now()).toBe('2026-09-20T09:00:00Z');
    clock.set('2026-09-20T09:05:00Z');
    expect(clock.now()).toBe('2026-09-20T09:05:00Z');
  });
});
