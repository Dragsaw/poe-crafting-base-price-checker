import { createFakeClockPort, createFakeFilesystemPort } from '@poe/contracts';
import type { FakeClockPort, FakeFilesystemPort, HttpPort } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { LOCK_PATH, serialiseLock, STALE_LOCK_AFTER_MS } from '../chunk/lock.ts';
import { abortableSleep } from '../shell.ts';
import {
  COLD_EVEN_INTERVAL_MS,
  INITIAL_SESSION_STATE,
  inputSignature,
  isGateDue,
  isLockFree,
  LOCAL_POLL_MS,
  preWaitMs,
  runWait,
  sessionEvenIntervalMs,
  syncSessionCommand,
} from '../sync.ts';
import type { SessionState } from '../sync.ts';
import { createPacingState } from '../trade/client.ts';
import { DATA_LANE, FETCH_LANE, SEARCH_LANE, TRADE_LEAGUES_URL, tradeFetchUrl } from '../trade/endpoints.ts';
import { recordObservation } from '../trade/ledger.ts';
import { parseRateLimitHeaders } from '../trade/rate-limit-headers.ts';
import { announced, ENTRY, inputs, LEAGUE, LEAGUES_BODY, NOW, SECOND, sessionFor } from './test-support.ts';

function headers(policy: string, rule: string, state: string): Record<string, string> {
  return {
    'x-rate-limit-policy': policy,
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': rule,
    'x-rate-limit-ip-state': state,
  };
}

const networkDown = (): HttpPort => ({
  send: () => Promise.reject(new TypeError('fetch failed')),
});

describe('the gate-due pre-wait', () => {
  const DATA_POLICY = 'data-policy';

  it('is due with no confirmed league, after a completed pass, and after an input change', () => {
    const confirmed: SessionState = { ...INITIAL_SESSION_STATE, confirmedLeague: LEAGUE, confirmedSignature: 's' };
    expect(isGateDue(INITIAL_SESSION_STATE, 's')).toBe(true);
    expect(isGateDue(confirmed, 's')).toBe(false);
    expect(isGateDue({ ...confirmed, passEnded: true }, 's')).toBe(true);
    expect(isGateDue(confirmed, 't')).toBe(true);
  });

  it('includes DATA_LANE only when the gate is due', () => {
    const pacing = createPacingState();
    pacing.ledger = recordObservation(
      pacing.ledger,
      parseRateLimitHeaders(headers(DATA_POLICY, '10:100:60', '5:100:0')),
      NOW,
    );
    pacing.lanePolicies.set(DATA_LANE, DATA_POLICY);

    expect(preWaitMs(pacing, NOW, true)).toBe(20_000);
    expect(preWaitMs(pacing, NOW, false)).toBe(0);
    // A cold lane counts as the measured 36 s for the backoff.
    expect(sessionEvenIntervalMs(pacing, false)).toBe(COLD_EVEN_INTERVAL_MS);
    pacing.lanePolicies.set(SEARCH_LANE, DATA_POLICY);
    pacing.lanePolicies.set(FETCH_LANE, DATA_POLICY);
    expect(sessionEvenIntervalMs(pacing, false)).toBe(10_000);
  });
});

function waitPorts(fs: FakeFilesystemPort, clock: FakeClockPort, step = LOCAL_POLL_MS) {
  const controller = new AbortController();
  const sleeps: number[] = [];
  return {
    controller,
    sleeps,
    ports: {
      fs,
      clock,
      signal: controller.signal,
      sleep: (ms: number) => {
        sleeps.push(ms);
        clock.set(new Date(Date.parse(clock.now()) + Math.min(ms, step)).toISOString());
        return Promise.resolve();
      },
    },
  };
}

describe('runWait and the local polls', () => {
  it('an other-throw wait ends at the backoff', async () => {
    const fs = createFakeFilesystemPort(inputs([ENTRY]));
    const clock = createFakeClockPort(NOW);
    const { ports } = waitPorts(fs, clock);
    const until = new Date(Date.parse(NOW) + 36_000).toISOString();

    await runWait({ kind: 'input-change', reason: 'r', until }, ports, await inputSignature(fs));

    expect(clock.now()).toBe(until);
  });

  it('an other-throw wait ends at an input change, if that is sooner', async () => {
    const fs = createFakeFilesystemPort(inputs([ENTRY]));
    const clock = createFakeClockPort(NOW);
    const { ports, sleeps } = waitPorts(fs, clock);
    const signature = await inputSignature(fs);
    const edit = ports.sleep;
    const until = new Date(Date.parse(NOW) + 36_000).toISOString();

    await runWait(
      { kind: 'input-change', reason: 'r', until },
      {
        ...ports,
        sleep: async (ms) => {
          await edit(ms);
          fs.setFile('data/config.json', { contents: '{}', modifiedAt: clock.now() });
        },
      },
      signature,
    );

    expect(sleeps).toHaveLength(1);
    expect(clock.now()).toBe(new Date(Date.parse(NOW) + LOCAL_POLL_MS).toISOString());
  });

  it('a held lock that ages past 6 h ends the wait', async () => {
    const fs = createFakeFilesystemPort({ [LOCK_PATH]: { contents: serialiseLock({ pid: 99, startedAt: NOW }) } });
    const clock = createFakeClockPort(NOW);
    const { ports } = waitPorts(fs, clock, 3_600_000);

    expect(await isLockFree(fs, clock)).toBe(false);
    await runWait({ kind: 'lock', reason: 'r' }, ports, '');

    expect(Date.parse(clock.now()) - Date.parse(NOW)).toBeGreaterThan(STALE_LOCK_AFTER_MS);
    expect(await isLockFree(fs, clock)).toBe(true);
  });

  it('an unreadable lock is free only once its file time is stale', async () => {
    const clock = createFakeClockPort(NOW);
    const recent = createFakeFilesystemPort({ [LOCK_PATH]: { contents: '', modifiedAt: NOW } });
    const old = createFakeFilesystemPort({ [LOCK_PATH]: { contents: '', modifiedAt: '2026-09-26T05:00:00.000Z' } });
    const untimed = createFakeFilesystemPort({ [LOCK_PATH]: { contents: '' } });

    expect(await isLockFree(recent, clock)).toBe(false);
    expect(await isLockFree(old, clock)).toBe(true);
    expect(await isLockFree(untimed, clock)).toBe(false);
    expect(await isLockFree(createFakeFilesystemPort(), clock)).toBe(true);
  });

  it('a lock read that throws is not free, and an input read that throws still signs', async () => {
    const fs = createFakeFilesystemPort(inputs([ENTRY]));
    const broken: FakeFilesystemPort = {
      ...fs,
      readTextFile: () => Promise.reject(new Error('EPERM')),
      lastModifiedAt: () => Promise.reject(new Error('EBUSY')),
    };

    expect(await isLockFree(broken, createFakeClockPort(NOW))).toBe(false);
    await expect(inputSignature(broken)).resolves.toContain('error');
  });

  it('a wait cancels at once on an abort', async () => {
    const fs = createFakeFilesystemPort(inputs([ENTRY]));
    const clock = createFakeClockPort(NOW);
    const controller = new AbortController();
    const started = Date.now();
    const waiting = runWait(
      { kind: 'until', until: new Date(Date.parse(NOW) + 3_600_000).toISOString(), reason: 'r', orInputChange: false },
      { fs, clock, signal: controller.signal, sleep: abortableSleep },
      '',
    );
    setTimeout(() => {
      controller.abort();
    }, 10);

    await waiting;

    expect(Date.now() - started).toBeLessThan(5000);
  });
});

describe('pnpm sync: the session with injected ports', () => {
  it('spreads the fetch inside the lock once the pre-wait has cleared the entry lanes', async () => {
    const policy = 'shared-policy';
    const state = (used: number): Record<string, string> => headers(policy, '5:10:60', `${String(used)}:10:0`);
    let searches = 0;
    const listing = JSON.stringify({
      result: [{ id: 'a', listing: { price: { type: '~price', amount: 1, currency: 'divine' } } }],
    });
    const { deps, sleeps, waits } = sessionFor({
      tracked: [ENTRY, SECOND],
      stopAfter: 2,
      http: (fake) => ({
        send: async (request) => {
          if (request.method === 'POST') {
            searches += 1;
            await fake.send(request);
            return {
              status: 200,
              headers: state(searches * 2 - 1),
              body: JSON.stringify({ id: 'S0', complexity: 1, result: ['a'], total: 1 }),
            };
          }
          if (request.url === tradeFetchUrl(['a'], 'S0')) {
            await fake.send({ ...request, url: TRADE_LEAGUES_URL });
            return { status: 200, headers: state(searches * 2), body: listing };
          }
          return fake.send(request);
        },
      }),
    });

    expect(await syncSessionCommand(deps)).toBe(0);

    // Iteration 2's pre-wait spreads the 3 left over 10 s (rounded up to a millisecond);
    // its search leaves 2, so the fetch inside the lock waits 10 000 / 2.
    expect(sleeps).toEqual([3334]);
    expect(waits).toEqual([10_000 / 2]);
  });

  it('a new pass pre-waits DATA_LANE before the gate runs again', async () => {
    const { deps, sleeps, http } = sessionFor({
      stopAfter: 2,
      fixtures: {
        [`GET ${TRADE_LEAGUES_URL}`]: {
          status: 200,
          headers: headers('data-policy', '10:100:60', '5:100:0'),
          body: LEAGUES_BODY,
        },
      },
    });

    expect(await syncSessionCommand(deps)).toBe(0);

    expect(http.requests.map((request) => request.method)).toEqual(['GET', 'POST', 'GET', 'POST']);
    expect(sleeps).toEqual([20_000]);
  });

  it('no answer on a cold lane waits 36 s, then 72 s, and resets after a reading', async () => {
    let calls = 0;
    const { deps, out } = sessionFor({
      stopAfter: 5,
      http: () => ({
        send: () => {
          calls += 1;
          if (calls === 3) {
            // A 503 that carried headers: a State reading.
            return Promise.resolve({
              status: 503,
              headers: headers('data-policy', '600:21600:60', '0:21600:0'),
              body: '',
            });
          }
          return networkDown().send({ method: 'GET', url: TRADE_LEAGUES_URL, headers: {} });
        },
      }),
    });

    expect(await syncSessionCommand(deps)).toBe(0);

    expect(announced(out, 'no answer')).toEqual([36_000, 72_000, 36_000]);
  });
});
