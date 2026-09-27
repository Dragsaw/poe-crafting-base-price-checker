import type { SetupServerApi } from 'msw/node';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  NEVER_FETCHED_PATH,
  sharedServer,
  serveArtifacts,
  TEST_LEAGUE,
  VALID_BODIES,
  type ArtifactAnswer,
} from '../test-support/artifact-server';
import { ARTIFACT_ORDER, ARTIFACTS, type ArtifactKey } from './artifacts';
import { loadArtifacts } from './load-artifacts';

let server: SetupServerApi;

beforeAll(async () => {
  server = await sharedServer();
});

describe('the seven artifacts', () => {
  it('lists AD-24’s seven paths in AD-24 order, four required and three tolerable', () => {
    expect(ARTIFACT_ORDER.map((key) => ARTIFACTS[key].path)).toEqual([
      'dataset.json',
      'sync-report.json',
      'weights.json',
      'recipes.json',
      'tracked.json',
      'config.json',
      'catalogue/stats.json',
    ]);
    const tolerable = ARTIFACT_ORDER.filter((key) => ARTIFACTS[key].class === 'tolerable');
    expect(tolerable.map((key) => ARTIFACTS[key].path)).toEqual([
      'sync-report.json',
      'weights.json',
      'recipes.json',
    ]);
  });

  it('expects weights major 6 and version 1 elsewhere', () => {
    expect(ARTIFACTS.weights.expected).toBe('6.0.0');
    expect(ARTIFACTS.dataset.expected).toBe('1.0.0');
  });
});

describe('loadArtifacts', () => {
  it('sends exactly seven requests, one per path, each no-cache with no query string', async () => {
    const requests = serveArtifacts(server);
    await loadArtifacts({ baseUrl: '/' });
    expect(requests).toHaveLength(7);
    // The server publishes `catalogue/static.json` as a trap; the page never fetches it.
    expect(requests.map((request) => request.url.pathname)).not.toContain(`/${NEVER_FETCHED_PATH}`);
    expect(requests.map((request) => request.url.pathname).sort()).toEqual(
      ARTIFACT_ORDER.map((key) => `/${ARTIFACTS[key].path}`).sort(),
    );
    for (const request of requests) {
      expect(request.cache).toBe('no-cache');
      expect(request.url.search).toBe('');
    }
  });

  // Matrix: all seven valid.
  it('resolves a whole valid set as ready, with no absence', async () => {
    serveArtifacts(server);
    const outcome = await loadArtifacts({ baseUrl: '/' });
    expect(outcome.kind).toBe('ready');
    if (outcome.kind !== 'ready') return;
    expect(outcome.absent).toEqual([]);
    expect(outcome.set.config.league).toBe(TEST_LEAGUE);
    expect(outcome.set.weights).toEqual(VALID_BODIES.weights);
  });

  // Matrix: invalid shape.
  it('refuses a body that fails its schema, naming the path and both versions', async () => {
    serveArtifacts(server, { tracked: { kind: 'json', body: { schemaVersion: '1.0.0', entries: 'nope' } } });
    expect(await loadArtifacts({ baseUrl: '/' })).toEqual({
      kind: 'refused',
      path: 'tracked.json',
      cause: 'content',
      declared: '1.0.0',
      expected: '1.0.0',
    });
  });

  it('refuses a dataset whose entries repeat an entryKey', async () => {
    const twin = {
      entryKey: '["raw","Advanced Dualstring Bow",82]',
      price: { state: 'not-yet-synced', reason: 'never-synced' },
    };
    serveArtifacts(server, {
      dataset: { kind: 'json', body: { ...(VALID_BODIES.dataset as object), entries: [twin, twin] } },
    });
    expect(await loadArtifacts({ baseUrl: '/' })).toEqual({
      kind: 'refused',
      path: 'dataset.json',
      cause: 'content',
      declared: '1.0.0',
      expected: '1.0.0',
    });
  });

  // Matrix: unknown major.
  it('refuses an unknown major with the declared version', async () => {
    serveArtifacts(server, { dataset: { kind: 'json', body: { ...(VALID_BODIES.dataset as object), schemaVersion: '2.0.0' } } });
    expect(await loadArtifacts({ baseUrl: '/' })).toEqual({
      kind: 'refused',
      path: 'dataset.json',
      cause: 'version',
      declared: '2.0.0',
      expected: '1.0.0',
    });
  });

  // Matrix: missing version.
  it('declares null when the file carries no schemaVersion, or a non-string one', async () => {
    serveArtifacts(server, { config: { kind: 'json', body: { league: TEST_LEAGUE, minChunkSearches: 1 } } });
    expect(await loadArtifacts({ baseUrl: '/' })).toMatchObject({
      kind: 'refused',
      path: 'config.json',
      cause: 'version',
      declared: null,
    });

    serveArtifacts(server, { config: { kind: 'json', body: { schemaVersion: 1 } } });
    expect(await loadArtifacts({ baseUrl: '/' })).toMatchObject({
      kind: 'refused',
      path: 'config.json',
      cause: 'version',
      declared: null,
    });
  });

  // Matrix: malformed version string.
  it('refuses a malformed version string as a version fault', async () => {
    serveArtifacts(server, { dataset: { kind: 'json', body: { ...(VALID_BODIES.dataset as object), schemaVersion: 'abc' } } });
    expect(await loadArtifacts({ baseUrl: '/' })).toEqual({
      kind: 'refused',
      path: 'dataset.json',
      cause: 'version',
      declared: 'abc',
      expected: '1.0.0',
    });
  });

  // Regression: the word "none" is a declared string, not the absence of one.
  it('keeps a declared "none" as a declared malformed version', async () => {
    serveArtifacts(server, { dataset: { kind: 'json', body: { ...(VALID_BODIES.dataset as object), schemaVersion: 'none' } } });
    expect(await loadArtifacts({ baseUrl: '/' })).toEqual({
      kind: 'refused',
      path: 'dataset.json',
      cause: 'version',
      declared: 'none',
      expected: '1.0.0',
    });
  });

  it('refuses a weights file of another major', async () => {
    serveArtifacts(server, { weights: { kind: 'json', body: { schemaVersion: '5.1.0' } } });
    expect(await loadArtifacts({ baseUrl: '/' })).toEqual({
      kind: 'refused',
      path: 'weights.json',
      cause: 'version',
      declared: '5.1.0',
      expected: '6.0.0',
    });
  });

  // Matrix: network error / 5xx.
  it('fails on a rejected fetch, naming the artifact', async () => {
    serveArtifacts(server, { catalogueStats: { kind: 'network-error' } });
    expect(await loadArtifacts({ baseUrl: '/' })).toEqual({ kind: 'failed', path: 'catalogue/stats.json' });
  });

  it('fails on any non-OK status other than 404', async () => {
    serveArtifacts(server, { catalogueStats: { kind: 'status', status: 503 } });
    expect(await loadArtifacts({ baseUrl: '/' })).toEqual({ kind: 'failed', path: 'catalogue/stats.json' });
  });

  // Matrix: required absent.
  it('refuses a required artifact that is absent, declaring null', async () => {
    serveArtifacts(server, { tracked: { kind: 'status', status: 404 } });
    expect(await loadArtifacts({ baseUrl: '/' })).toEqual({
      kind: 'refused',
      path: 'tracked.json',
      cause: 'missing',
      declared: null,
      expected: '1.0.0',
    });
  });

  // Matrix: mixed failure.
  it('lets a fetch failure win over an invalid artifact', async () => {
    serveArtifacts(server, {
      dataset: { kind: 'json', body: { schemaVersion: '9.0.0' } },
      catalogueStats: { kind: 'status', status: 500 },
    });
    expect(await loadArtifacts({ baseUrl: '/' })).toEqual({ kind: 'failed', path: 'catalogue/stats.json' });
  });

  it('names the first failing artifact in AD-24 order when several fail alike', async () => {
    serveArtifacts(server, {
      config: { kind: 'status', status: 404 },
      tracked: { kind: 'json', body: {} },
    });
    expect(await loadArtifacts({ baseUrl: '/' })).toMatchObject({ kind: 'refused', path: 'tracked.json', cause: 'version' });
  });

  // Matrix: tolerable absent.
  it('renders with a tolerable artifact absent, and names each absence in AD-24 order', async () => {
    serveArtifacts(server, {
      recipes: { kind: 'status', status: 404 },
      syncReport: { kind: 'status', status: 404 },
    });
    const outcome = await loadArtifacts({ baseUrl: '/' });
    expect(outcome.kind).toBe('ready');
    if (outcome.kind !== 'ready') return;
    expect(outcome.absent).toEqual(['syncReport', 'recipes']);
    expect(outcome.set.recipes).toBeNull();
    expect(outcome.set.syncReport).toBeNull();
  });

  // Matrix: non-JSON body.
  it('refuses a 200 that is not JSON, declaring null', async () => {
    serveArtifacts(server, { weights: { kind: 'text', body: '<!doctype html><html></html>' } });
    expect(await loadArtifacts({ baseUrl: '/' })).toEqual({
      kind: 'refused',
      path: 'weights.json',
      cause: 'content',
      declared: null,
      expected: '6.0.0',
    });
  });

  it('never rejects, even when fetch itself throws synchronously', async () => {
    const outcome = await loadArtifacts({
      baseUrl: '/',
      fetch: () => {
        throw new TypeError('boom');
      },
    });
    expect(outcome).toEqual({ kind: 'failed', path: 'dataset.json' });
  });
});

describe('the committed data/ set', () => {
  it('loads as ready through the page’s own descriptors, naming only the missing tolerable files', async () => {
    // Vite's glob, not node:fs: the web project carries no Node types. A test
    // file never enters the bundle, so this is not a source import of data/**.
    const committed = import.meta.glob<unknown>('../../../../data/**/*.json', { eager: true, import: 'default' });
    const missing: ArtifactKey[] = [];
    const answers = Object.fromEntries(
      ARTIFACT_ORDER.map((key): [ArtifactKey, ArtifactAnswer] => {
        const file = `../../../../data/${ARTIFACTS[key].path}`;
        if (!(file in committed)) {
          missing.push(key);
          return [key, { kind: 'status', status: 404 }];
        }
        return [key, { kind: 'json', body: committed[file] }];
      }),
    );
    serveArtifacts(server, answers);
    const outcome = await loadArtifacts({ baseUrl: '/' });
    expect(outcome.kind).toBe('ready');
    if (outcome.kind !== 'ready') return;
    expect(missing.every((key) => ARTIFACTS[key].class === 'tolerable')).toBe(true);
    expect(outcome.absent).toEqual(missing);
    expect(outcome.absent).toEqual([]);
  });
});
