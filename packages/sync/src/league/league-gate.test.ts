import { createFakeClockPort, createFakeHttpPort } from '@poe/contracts';
import type { HttpPort, HttpResponse } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import type { GateResult } from '../chunk/run-chunk.ts';
import { createTradeClient } from '../trade/client.ts';
import { TRADE_LEAGUES_URL } from '../trade/endpoints.ts';
import {
  createLeagueGate,
  LeagueMismatchError,
  LeagueRequestRejectedError,
  UnexpectedLeaguesResponseError,
} from './league-gate.ts';
import { NamedError } from '../test-support/named-error.ts';

const CONTACT = 'poe-crafting-base-price-checker/0.0.0 (contact: someone@example.test)';

/** The shape of the recorded `fixtures/trade-data-leagues.json`. */
const LEAGUES = {
  result: [
    { id: 'Forbidden Rites', realm: 'poe2', text: 'Forbidden Rites' },
    { id: 'HC Forbidden Rites', realm: 'poe2', text: 'HC Forbidden Rites' },
    { id: 'Standard', realm: 'poe2', text: 'Standard' },
  ],
};

function gateOver(http: HttpPort, league: string, invalidRequestThreshold?: number) {
  const client = createTradeClient({
    http,
    clock: createFakeClockPort('2026-09-26T00:00:00.000Z'),
    wait: () => Promise.resolve(),
    userAgent: CONTACT,
    ...(invalidRequestThreshold !== undefined && { invalidRequestThreshold }),
  });
  return createLeagueGate({ client, league });
}

function gateAnswering(response: HttpResponse, league: string) {
  const http = createFakeHttpPort({ [`GET ${TRADE_LEAGUES_URL}`]: response });
  return { http, gate: gateOver(http, league) };
}

/** A port whose one request rejects with `error`, counting the attempts. */
function rejectingPort(error: Error): HttpPort & { readonly sent: () => number } {
  let sent = 0;
  return {
    sent: () => sent,
    send: () => {
      sent += 1;
      return Promise.reject(error);
    },
  };
}

/** What `AbortSignal.timeout` rejects with (`shell.ts`). */
function timeoutError(): Error {
  return new NamedError('TimeoutError', 'The operation was aborted due to timeout');
}

const ok = (body: unknown): HttpResponse => ({ status: 200, headers: {}, body: JSON.stringify(body) });

const PASS: GateResult = { kind: 'pass' };
const YIELD: GateResult = { kind: 'yield' };

async function mismatchOf(promise: Promise<GateResult>): Promise<LeagueMismatchError> {
  const error: unknown = await promise.then(
    () => {},
    (error_: unknown) => error_,
  );
  expect(error).toBeInstanceOf(LeagueMismatchError);
  return error as LeagueMismatchError;
}

describe('createLeagueGate', () => {
  it('passes when the configured league is one of the ids, after exactly one GET', async () => {
    const { http, gate } = gateAnswering(ok(LEAGUES), 'Forbidden Rites');

    await expect(gate({ entries: [] })).resolves.toEqual(PASS);

    expect(http.requests).toHaveLength(1);
    expect(http.requests[0]).toMatchObject({ method: 'GET', url: TRADE_LEAGUES_URL });
  });

  it('throws a mismatch carrying the configured league and every id in endpoint order', async () => {
    const { gate } = gateAnswering(ok(LEAGUES), 'Runes of Aldur');

    const error = await mismatchOf(gate({ entries: [] }));

    expect(error.configuredLeague).toBe('Runes of Aldur');
    expect(error.availableLeagues).toEqual(['Forbidden Rites', 'HC Forbidden Rites', 'Standard']);
    expect(error.message).toContain('"Runes of Aldur"');
  });

  it('compares ids byte for byte, so case and spacing are a mismatch', async () => {
    const leagues = ['forbidden rites', 'Forbidden  Rites', ' Forbidden Rites', 'Forbidden Rites '];
    await Promise.all(
      leagues.map(async (league) => {
        const { gate } = gateAnswering(ok(LEAGUES), league);
        const error = await mismatchOf(gate({ entries: [] }));
        expect(error.configuredLeague).toBe(league);
      }),
    );
  });

  it('treats an empty league list as a mismatch with no available leagues', async () => {
    const { gate } = gateAnswering(ok({ result: [] }), 'Standard');

    const error = await mismatchOf(gate({ entries: [] }));

    expect(error.availableLeagues).toEqual([]);
  });

  it('throws a rejection naming the status on a non-429 4xx or another non-2xx', async () => {
    await Promise.all(
      [404, 403, 302].map(async (status) => {
        const { gate } = gateAnswering({ status, headers: {}, body: '' }, 'Standard');

        const error: unknown = await gate({ entries: [] }).catch((error_: unknown) => error_);

        expect(error).toBeInstanceOf(LeagueRequestRejectedError);
        expect((error as LeagueRequestRejectedError).status).toBe(status);
      }),
    );
  });

  it('throws an unexpected-response error on a body that is not the payload shape', async () => {
    const bodies = ['not json', JSON.stringify({ leagues: [] }), JSON.stringify({ result: [{ text: 'x' }] })];
    await Promise.all(
      bodies.map(async (body) => {
        const { gate } = gateAnswering({ status: 200, headers: {}, body }, 'Standard');
        await expect(gate({ entries: [] })).rejects.toBeInstanceOf(UnexpectedLeaguesResponseError);
      }),
    );
  });

  it('yields on a 429, with the one request sent and nothing slept out', async () => {
    const { http, gate } = gateAnswering({ status: 429, headers: { 'retry-after': '60' }, body: '' }, 'Standard');

    // The yield carries the delay the chunk remembers as notBefore (§5.3).
    await expect(gate({ entries: [] })).resolves.toStrictEqual({ kind: 'yield', retryAfterMs: 60_000 });
    expect(http.requests).toHaveLength(1);
  });

  it('yields on a refusal at the invalid-request threshold, with nothing sent and no delay', async () => {
    const http = createFakeHttpPort({ [`GET ${TRADE_LEAGUES_URL}`]: ok(LEAGUES) });
    const gate = gateOver(http, 'Standard', 0);

    await expect(gate({ entries: [] })).resolves.toStrictEqual(YIELD);
    expect(http.requests).toHaveLength(0);
  });

  it('yields on a 5xx', async () => {
    await Promise.all(
      [500, 503].map(async (status) => {
        const { http, gate } = gateAnswering({ status, headers: {}, body: '' }, 'Standard');
        await expect(gate({ entries: [] })).resolves.toEqual(YIELD);
        expect(http.requests).toHaveLength(1);
      }),
    );
  });

  it('yields on a timeout and on a fetch network failure', async () => {
    await Promise.all(
      [timeoutError(), new TypeError('fetch failed')].map(async (error) => {
        const http = rejectingPort(error);
        await expect(gateOver(http, 'Standard')({ entries: [] })).resolves.toEqual(YIELD);
        expect(http.sent()).toBe(1);
      }),
    );
  });

  it('rethrows any other port rejection', async () => {
    const fault = new Error('[fake-http] no fixture');
    const http = rejectingPort(fault);

    await expect(gateOver(http, 'Standard')({ entries: [] })).rejects.toBe(fault);
  });
});
