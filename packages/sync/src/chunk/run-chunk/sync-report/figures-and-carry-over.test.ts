import { createFakeGitPort, createFakeHttpPort, SYNC_REPORT_SCHEMA_VERSION } from '@poe/contracts';
import type { HttpPort, PinnedStarvationRecord } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { createRequestCounter } from '../../../request-counter.ts';
import { LOCK_PATH, serialiseLock } from '../../lock.ts';
import { DATASET_PATH, PROGRESS_PATH, REPORT_PATH, TRACKED_PATH } from '../../run-chunk.ts';
import {
  A,
  B,
  C,
  FIVE_HOURS_AGO,
  harness,
  NOW,
  reportOf,
  run,
  scriptedStep,
  SEVEN_HOURS_AGO,
  trackedText,
} from '../test-support.ts';
import { BROKEN, P1, P2, P3, reportText, starvingStep, ZERO } from './test-support.ts';

describe('runChunk: the Sync Report', () => {
  const STARVED: PinnedStarvationRecord = {
    kind: 'pinned-starvation',
    discoveredAllowance: 3,
    declaredMinChunkSearches: 10,
    pinnedCount: 3,
    pinnedRefreshed: 2,
    activeRefreshed: 2,
  };

  const SEARCH_URL = 'https://example.test/search';

  const FETCH_URL = 'https://example.test/fetch';

  function countedHttp(requests: ReturnType<typeof createRequestCounter>): HttpPort {
    return requests.counted(
      createFakeHttpPort({
        [`POST ${SEARCH_URL}`]: { status: 200, headers: {}, body: '{}' },
        [`GET ${FETCH_URL}`]: { status: 200, headers: {}, body: '{}' },
      }),
      'tracked-list',
    );
  }

  it('first run: 3 searches + 3 fetches count 6 against tracked-list, the others 0, no records, finished', async () => {
    const requests = createRequestCounter();
    const http = countedHttp(requests);
    const { fs, ports } = harness([A, B, C], {}, { requests });

    await run(ports, async () => {
      await http.send({ method: 'POST', url: SEARCH_URL, headers: {} });
      await http.send({ method: 'GET', url: FETCH_URL, headers: {} });
      return { kind: 'completed' };
    });

    expect(await reportOf(fs)).toEqual({
      runStartedAt: NOW,
      runFinishedAt: NOW,
      figures: { requestsBySource: { ...ZERO, 'tracked-list': 6 }, notReachedCount: 0 },
      records: [],
      schemaVersion: SYNC_REPORT_SCHEMA_VERSION,
    });
  });

  it('counts only the requests sent after the lock was taken', async () => {
    const requests = createRequestCounter();
    const http = countedHttp(requests);
    await http.send({ method: 'GET', url: FETCH_URL, headers: {} });
    const { fs, ports } = harness([A], {}, { requests });

    await run(ports, async () => {
      await http.send({ method: 'POST', url: SEARCH_URL, headers: {} });
      return { kind: 'completed' };
    });

    const report = await reportOf(fs);
    expect(report?.figures.requestsBySource).toEqual({ ...ZERO, 'tracked-list': 1 });
  });

  it('writes after progress, in the schema’s key order, LF and one trailing newline', async () => {
    const { fs, ports } = harness([A]);
    const writes: string[] = [];
    const recording = {
      ...fs,
      writeTextFile: (path: string, contents: string) => {
        writes.push(path);
        return fs.writeTextFile(path, contents);
      },
    };

    await run({ ...ports, fs: recording }, scriptedStep().step);

    expect(writes).toEqual([DATASET_PATH, PROGRESS_PATH, REPORT_PATH]);
    const text = (await fs.readTextFile(REPORT_PATH)) ?? '';
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).not.toContain('\r');
    expect(Object.keys(JSON.parse(text) as object)).toEqual([
      'runStartedAt',
      'runFinishedAt',
      'figures',
      'records',
      'schemaVersion',
    ]);
  });

  it('carry-over: a previous stale-lock-broken record survives the next chunk; figures are replaced', async () => {
    const { fs, ports } = harness([A], { [REPORT_PATH]: { contents: reportText([BROKEN]) } });

    await run(ports, scriptedStep().step);

    const report = await reportOf(fs);
    expect(report?.records).toEqual([BROKEN]);
    expect(report?.figures).toEqual({ requestsBySource: ZERO, notReachedCount: 0 });
  });

  it('player cleared: a previous report with no records keeps only this chunk’s new records', async () => {
    const { fs, ports } = harness([A], {
      [REPORT_PATH]: { contents: reportText([]) },
      [LOCK_PATH]: { contents: serialiseLock({ pid: 7, startedAt: SEVEN_HOURS_AGO }) },
    });

    await run(ports, scriptedStep().step);

    const finalReport = await reportOf(fs);
    expect(finalReport?.records).toEqual([BROKEN]);
  });

  it('dedup: the same starvation payload two chunks running is one record', async () => {
    const { fs, ports } = harness([P1, P2, P3, A, B], {}, {
      starvationRecord: (starvation) => ({
        kind: 'pinned-starvation',
        discoveredAllowance: starvation.discoveredAllowance,
        declaredMinChunkSearches: 10,
        pinnedCount: starvation.pinnedCount,
        pinnedRefreshed: starvation.pinnedRefreshed,
        activeRefreshed: starvation.activeRefreshed,
      }),
    });

    await run(ports, starvingStep());
    const finalReport = await reportOf(fs);
    expect(finalReport?.records).toEqual([STARVED]);
    await run(ports, starvingStep());
    const report = await reportOf(fs);
    expect(report?.records).toEqual([STARVED]);
  });

  it.each([
    ['committed', { [TRACKED_PATH]: SEVEN_HOURS_AGO }, FIVE_HOURS_AGO, { source: 'git-author-date', at: SEVEN_HOURS_AGO }],
    ['uncommitted-only', {}, FIVE_HOURS_AGO, { source: 'file-modified', at: FIVE_HOURS_AGO }],
    ['neither', {}, undefined, undefined],
  ] as const)('edit date: %s', async (_name, commits, modifiedAt, expected) => {
    const { fs, ports } = harness([A], {}, { git: createFakeGitPort(commits) });
    fs.setFile(TRACKED_PATH, {
      contents: trackedText([A]),
      ...(modifiedAt !== undefined && { modifiedAt }),
    });

    await run(ports, scriptedStep().step);

    const report = await reportOf(fs);
    const figures = report?.figures;
    expect(figures?.trackedListEditedAt).toEqual(expected);
    expect(figures !== undefined && 'trackedListEditedAt' in figures).toBe(expected !== undefined);
  });
});
