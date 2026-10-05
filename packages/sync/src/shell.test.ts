import { Buffer } from 'node:buffer';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  abortableSleep,
  createNodeFilesystemPort,
  REQUEST_TIMEOUT_MS,
  serialiseJsonArtifact,
  sleep,
  systemClock,
  writeTextFile,
} from './shell.ts';

// The real HTTP port is absent here: a scan in `catalogue-refresh.test.ts` fails any other test
// file that names it, so this comment does not either. It runs only in `shell-fetch.test.ts`.
// The `mkdir` in `writeTextFile` matters: `data/catalogue/` is absent on a fresh checkout.

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(nodePath.join(tmpdir(), 'poe-shell-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

it('creates a missing parent directory rather than failing on it', async () => {
  const root = await temporaryDirectory();
  // Two levels that do not exist, mirroring `data/catalogue/` on a fresh
  // checkout, where neither `data` nor `catalogue` is present.
  const path = nodePath.join(root, 'data', 'catalogue', 'items.json');

  await writeTextFile(path, '{}\n');

  expect(await readFile(path, 'utf8')).toBe('{}\n');
});

it('overwrites an existing file rather than appending to it', async () => {
  const root = await temporaryDirectory();
  const path = nodePath.join(root, 'stats.json');
  await writeFile(path, 'a much longer stale artifact\n', { encoding: 'utf8' });

  await writeTextFile(path, '{}\n');

  // A second refresh against unchanged data has to leave the file byte-identical
  // to a first one, which an append or a partial overwrite would not.
  expect(await readFile(path, 'utf8')).toBe('{}\n');
});

it('writes UTF-8 with no BOM and keeps LF as it was given', async () => {
  const root = await temporaryDirectory();
  const path = nodePath.join(root, 'static.json');
  const contents = serialiseJsonArtifact({ text: 'Gebänderter Amulett — ✦', nested: { a: 1 } });

  await writeTextFile(path, contents);

  const raw = await readFile(path);
  expect(raw.subarray(0, 3)).not.toEqual(Buffer.from([0xEF, 0xBB, 0xBF]));
  expect(raw.includes(Buffer.from('\r\n'))).toBe(false);
  expect(raw.toString('utf8')).toBe(contents);
});

it('serialises as two-space JSON with exactly one trailing newline', () => {
  const contents = serialiseJsonArtifact({ result: [{ id: 'a' }] });

  expect(contents).toBe('{\n  "result": [\n    {\n      "id": "a"\n    }\n  ]\n}\n');
  expect(contents.endsWith('\n\n')).toBe(false);
});

it('reports the clock as an ISO-8601 UTC instant', () => {
  const now = systemClock.now();

  expect(now).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  expect(new Date(now).toISOString()).toBe(now);
});

it('resolves sleep without waiting on a real window', async () => {
  // Zero only: no test in this project may depend on wall-clock timing, so this
  // pins that `sleep` resolves at all, not how long it takes.
  await expect(sleep(0)).resolves.toBeUndefined();
});

it('bounds a single request so a hung connection cannot block a terminal', () => {
  expect(REQUEST_TIMEOUT_MS).toBe(30_000);
});

describe('createNodeFilesystemPort', () => {
  it('reads, writes, checks and deletes relative to its root', async () => {
    const root = await temporaryDirectory();
    const filesystem = createNodeFilesystemPort(root);

    await expect(filesystem.readTextFile('data/x.json')).resolves.toBeUndefined();
    await expect(filesystem.exists('data/x.json')).resolves.toBe(false);
    await expect(filesystem.lastModifiedAt('data/x.json')).resolves.toBeUndefined();

    await filesystem.writeTextFile('data/x.json', '{}\n');
    expect(await readFile(nodePath.join(root, 'data', 'x.json'), 'utf8')).toBe('{}\n');
    await expect(filesystem.readTextFile('data/x.json')).resolves.toBe('{}\n');
    await expect(filesystem.exists('data/x.json')).resolves.toBe(true);
    await expect(filesystem.lastModifiedAt('data/x.json')).resolves.toMatch(/Z$/);

    await filesystem.deleteFile('data/x.json');
    await expect(filesystem.exists('data/x.json')).resolves.toBe(false);
    // Removing a path that does not exist is not an error.
    await expect(filesystem.deleteFile('data/x.json')).resolves.toBeUndefined();
  });

  it('creates exclusively: of concurrent takers exactly one wins, and the loser changes nothing', async () => {
    const root = await temporaryDirectory();
    const filesystem = createNodeFilesystemPort(root);

    const outcomes = await Promise.all(
      ['a', 'b', 'c', 'd'].map((who) => filesystem.createExclusive('data/sync.lock', who)),
    );

    expect(outcomes.filter(Boolean)).toHaveLength(1);
    const winner = ['a', 'b', 'c', 'd'][outcomes.indexOf(true)];
    expect(await readFile(nodePath.join(root, 'data', 'sync.lock'), 'utf8')).toBe(winner);
  });

  it('leaves an existing file untouched when an exclusive create loses', async () => {
    const root = await temporaryDirectory();
    const filesystem = createNodeFilesystemPort(root);
    await filesystem.writeTextFile('data/sync.lock', 'held');

    await expect(filesystem.createExclusive('data/sync.lock', 'mine')).resolves.toBe(false);
    expect(await readFile(nodePath.join(root, 'data', 'sync.lock'), 'utf8')).toBe('held');
  });
});

describe('abortableSleep', () => {
  it('ends at once on an abort, and resolves rather than rejects', async () => {
    const controller = new AbortController();
    const started = Date.now();
    const waiting = abortableSleep(60_000, controller.signal);
    controller.abort();

    await expect(waiting).resolves.toBeUndefined();
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('returns at once when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(abortableSleep(60_000, controller.signal)).resolves.toBeUndefined();
  });

  it('waits the whole delay when nothing aborts it', async () => {
    await expect(abortableSleep(1, new AbortController().signal)).resolves.toBeUndefined();
  });
});
