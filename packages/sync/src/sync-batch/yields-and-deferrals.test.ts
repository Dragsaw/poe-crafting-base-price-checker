import { canonicalKey, SUPPORTED_SCHEMA_VERSION, SYNC_PROGRESS_SCHEMA_VERSION } from '@poe/contracts';
import type { DatasetEntry, TrackedEntry } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { LOCK_PATH, serialiseLock } from '../chunk/lock.ts';
import { DATASET_PATH, PROGRESS_PATH, REPORT_PATH } from '../chunk/run-chunk.ts';
import { syncCommand } from '../sync-batch.ts';
import { TRADE_LEAGUES_URL } from '../trade/endpoints.ts';
import { dependenciesFor, ENTRY, LEAGUE, LEAGUES_BODY, NOW, reportOf, THROTTLED } from './test-support.ts';

describe('pnpm sync:batch: the live composition with injected ports', () => {
  it('a gate 429 yields the chunk: exit 0, no search, dataset, progress and the report, no run-failure', async () => {
    const { deps, fs, writes, http, out } = dependenciesFor(LEAGUE, { answers: { leagues: THROTTLED } });

    expect(await syncCommand(deps)).toBe(0);

    expect(http.requests.map((request) => request.url)).toEqual([TRADE_LEAGUES_URL]);
    // A gate yield publishes like a yielded chunk; progress holds the penalty as notBefore.
    expect(writes).toEqual([DATASET_PATH, PROGRESS_PATH, REPORT_PATH]);
    expect(JSON.parse((await fs.readTextFile(PROGRESS_PATH)) ?? '')).toEqual({
      completed: [],
      notBefore: '2026-09-26T12:01:00.000Z',
      schemaVersion: SYNC_PROGRESS_SCHEMA_VERSION,
    });
    const report = await reportOf(fs);
    expect(report?.records).toEqual([]);
    expect(report?.runFinishedAt).toBe(NOW);
    expect(report?.figures.requestsBySource).toEqual({
      'tracked-list': 0,
      'league-validation': 1,
      'session-probe': 0,
    });
    expect(out).toEqual(['pnpm sync:batch: yielded, 0 completed']);
    expect(report?.figures.notReachedCount).toBe(1);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it("a 429's diagnostic line reaches the chunk's operator log", async () => {
    const { deps } = dependenciesFor(LEAGUE, { answers: { leagues: THROTTLED } });
    const lines: string[] = [];

    expect(await syncCommand({ ...deps, log: (line) => { lines.push(line); } })).toBe(0);

    expect(lines.filter((line) => line.includes('answered 429'))).toEqual([
      expect.stringContaining('response headers {"retry-after":"60"}; paced on no reading'),
    ]);
  });

  it('a gate 429 publishes the catalogue marks, and the not-reached count is every eligible entry', async () => {
    const ghost: TrackedEntry = { kind: 'raw', baseTypeId: 'Ghost Amulet', itemLevelMin: 82, status: 'active' };
    const others: TrackedEntry[] = [ENTRY, { ...ENTRY, itemLevelMin: 83 }, { ...ENTRY, itemLevelMin: 84 }];
    const { deps, fs, http } = dependenciesFor(LEAGUE, {
      tracked: [ghost, ...others],
      answers: { leagues: THROTTLED },
    });

    expect(await syncCommand(deps)).toBe(0);

    expect(http.requests.map((request) => request.url)).toEqual([TRADE_LEAGUES_URL]);
    const dataset = JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? '{}') as {
      entries: DatasetEntry[];
    };
    expect(dataset.entries.find((entry) => entry.entryKey === canonicalKey(ghost))?.price).toEqual(
      expect.objectContaining({ state: 'unresolvable' }),
    );
    const report = await reportOf(fs);
    expect(report?.figures.notReachedCount).toBe(3);
    expect(report?.records).toEqual([
      expect.objectContaining({ kind: 'unresolvable', entryKey: canonicalKey(ghost) }),
    ]);
    expect(JSON.parse((await fs.readTextFile(PROGRESS_PATH)) ?? '')).toHaveProperty('notBefore');
  });

  it('paces the tracked-list searches off the leagues GET: one governor for both sources', async () => {
    const policy = 'trade-search-request-limit';
    // The leagues answer saturates the Client rule; the searches report only the Ip rule.
    const saturated = {
      'x-rate-limit-policy': policy,
      'x-rate-limit-rules': 'Ip,Client',
      'x-rate-limit-ip': '5:10:60',
      'x-rate-limit-ip-state': '5:10:0',
      'x-rate-limit-client': '30:300:1800',
      'x-rate-limit-client-state': '30:300:0',
    };
    const clear = {
      'x-rate-limit-policy': policy,
      'x-rate-limit-rules': 'Ip',
      'x-rate-limit-ip': '5:10:60',
      'x-rate-limit-ip-state': '1:10:0',
    };
    const waits: number[] = [];
    const second: TrackedEntry = { ...ENTRY, itemLevelMin: 83 };
    const { deps, http } = dependenciesFor(LEAGUE, {
      tracked: [ENTRY, second],
      wait: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
      answers: {
        leagues: { status: 200, headers: saturated, body: LEAGUES_BODY },
        search: {
          status: 200,
          headers: clear,
          body: JSON.stringify({ id: 'S0', complexity: 1, result: [], total: 0 }),
        },
      },
    });

    expect(await syncCommand(deps)).toBe(0);

    expect(http.requests.map((request) => request.method)).toEqual(['GET', 'POST', 'POST']);
    // The first search, on a cold lane, learns the shared policy; the second
    // waits out the Client window the leagues GET recorded. Two independent
    // clients would record no wait.
    expect(waits).toEqual([300_000]);
  });

  it('a penalty still running defers: exit 0, no request, no write, the pause printed', async () => {
    const progress = JSON.stringify({
      schemaVersion: '1.1.0',
      completed: [],
      notBefore: '2026-09-26T12:30:00.000Z',
    });
    const { deps, fs, writes, http, out } = dependenciesFor(LEAGUE, {
      seeded: { [PROGRESS_PATH]: { contents: progress } },
    });

    expect(await syncCommand(deps)).toBe(0);

    expect(http.requests).toEqual([]);
    expect(writes).toEqual([]);
    expect(out).toEqual(['pnpm sync:batch: deferred until 2026-09-26T12:30:00.000Z, 0 completed']);
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });

  it('a live lock is busy: exit 0, no request, no write', async () => {
    const lock = serialiseLock({ pid: 99, startedAt: NOW });
    const { deps, fs, writes, http, out } = dependenciesFor(LEAGUE, { seeded: { [LOCK_PATH]: { contents: lock } } });

    expect(await syncCommand(deps)).toBe(0);

    expect(http.requests).toEqual([]);
    expect(writes).toEqual([]);
    expect(out).toEqual(['pnpm sync:batch: busy, 0 completed']);
    expect(await fs.readTextFile(LOCK_PATH)).toBe(lock);
  });

  it('a priced entry whose search answers 429 keeps its price in the written dataset', async () => {
    const priced: DatasetEntry = {
      entryKey: canonicalKey(ENTRY),
      price: {
        state: 'priced',
        observation: {
          league: LEAGUE,
          observedAt: '2026-09-25T12:00:00.000Z',
          priceDivine: 0.5,
          sampleSize: 10,
          exchangeObservation: {
            currencyId: 'divine',
            rate: 1,
            source: 'measured',
            league: LEAGUE,
            asOf: '2026-01-01T00:00:00Z',
          },
        },
      },
      lastAttemptedAt: '2026-09-25T12:00:00.000Z',
    };
    const published = `${JSON.stringify(
      {
        schemaVersion: SUPPORTED_SCHEMA_VERSION,
        league: LEAGUE,
        generatedAt: '2026-09-25T12:00:00.000Z',
        entries: [priced],
        currencyRates: [],
      },
      undefined,
      2,
    )}\n`;
    const { deps, fs, out } = dependenciesFor(LEAGUE, {
      seeded: { [DATASET_PATH]: { contents: published } },
      answers: { search: THROTTLED },
    });

    expect(await syncCommand(deps)).toBe(0);

    expect(out).toEqual(['pnpm sync:batch: yielded, 0 completed']);
    const dataset = JSON.parse((await fs.readTextFile(DATASET_PATH)) ?? '{}') as {
      entries: DatasetEntry[];
    };
    expect(dataset.entries).toHaveLength(1);
    expect(dataset.entries[0]?.price).toEqual(priced.price);
    const report = await reportOf(fs);
    expect(report?.records).toEqual([]);
  });

  it('a malformed published dataset: exit 1, no request, a run-failure naming it, the dataset untouched', async () => {
    const { deps, fs, writes, http, err } = dependenciesFor(LEAGUE, {
      seeded: { [DATASET_PATH]: { contents: '{ not json' } },
    });

    expect(await syncCommand(deps)).toBe(1);

    expect(http.requests).toEqual([]);
    expect(writes).toEqual([REPORT_PATH]);
    expect(err[0]).toContain(DATASET_PATH);
    expect(await fs.readTextFile(DATASET_PATH)).toBe('{ not json');
    const report = await reportOf(fs);
    const records = report?.records ?? [];
    expect(records).toEqual([expect.objectContaining({ kind: 'run-failure' })]);
    expect(records[0]).toHaveProperty('message', expect.stringContaining(DATASET_PATH));
    expect(await fs.exists(LOCK_PATH)).toBe(false);
  });
});
