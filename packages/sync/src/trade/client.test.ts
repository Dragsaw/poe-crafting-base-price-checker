import { createFakeClockPort, createFakeHttpPort } from '@poe/contracts';
import type { HttpPort, HttpRequest, HttpResponse } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import {
  createPacingState,
  createTradeClient,
  createTradeClients,
  createTradeGovernor,
  laneDelayMs,
  penaltyRetryAfterMs,
  resetPacingState,
} from './client.ts';
import { createSessionAuth, SESSION_COOKIE_ENV_VAR } from './session-auth.ts';
import { MissingUserAgentError, USER_AGENT_ENV_VAR } from './user-agent.ts';

/**
 * Every rule name, policy name and bucket figure in this file is a **fixture**,
 * asserted as the shape a live response carried on 2026-09-12. None of it is
 * compiled into the client, which learns all of it from these headers.
 */
const SEARCH_POLICY = 'trade-search-request-limit';
const FETCH_POLICY = 'trade-fetch-request-limit';

const SEARCH_URL = 'https://trade.test/api/trade2/search/poe2/Some%20League';
const FETCH_URL = 'https://trade.test/api/trade2/fetch/abc';
const DATA_URL = 'https://trade.test/api/trade2/data/leagues';

const NOW = '2026-09-20T12:00:00.000Z';
const CONTACT = 'poe-crafting-base-price-checker/0.0.0 (contact: someone@example.test)';

function response(
  status: number,
  headers: Readonly<Record<string, string>>,
  body = '{}',
): HttpResponse {
  return { status, headers, body };
}

/** Records what it was asked to wait and returns at once — no wall clock. */
function recordingWait(): { readonly waits: number[]; wait: (ms: number) => Promise<void> } {
  const waits: number[] = [];
  return {
    waits,
    wait: (ms: number) => {
      waits.push(ms);
      return Promise.resolve();
    },
  };
}

function harness(fixtures: Readonly<Record<string, HttpResponse>> = {}): {
  readonly http: ReturnType<typeof createFakeHttpPort>;
  readonly clock: ReturnType<typeof createFakeClockPort>;
  readonly waits: number[];
  readonly client: ReturnType<typeof createTradeClient>;
} {
  const http = createFakeHttpPort(fixtures);
  const clock = createFakeClockPort(NOW);
  const { waits, wait } = recordingWait();
  const client = createTradeClient({ http, clock, wait, userAgent: CONTACT });
  return { http, clock, waits, client };
}

const CLEAR_SEARCH_HEADERS = {
  'x-rate-limit-policy': SEARCH_POLICY,
  'x-rate-limit-rules': 'Ip',
  'x-rate-limit-ip': '5:10:60',
  'x-rate-limit-ip-state': '1:10:0',
};

const SATURATED_SEARCH_HEADERS = {
  'x-rate-limit-policy': SEARCH_POLICY,
  'x-rate-limit-rules': 'Ip,Client',
  'x-rate-limit-ip': '5:10:60',
  'x-rate-limit-ip-state': '5:10:0',
  'x-rate-limit-client': '30:300:1800',
  'x-rate-limit-client-state': '30:300:0',
};

// I/O matrix: cold start.
it('issues immediately on a cold start and seeds the ledger from the response', async () => {
  const { http, waits, client } = harness({
    [`GET ${DATA_URL}`]: response(200, CLEAR_SEARCH_HEADERS, '[]'),
  });

  const result = await client.send({ method: 'GET', url: DATA_URL });

  expect(waits).toEqual([]);
  expect(http.requests).toHaveLength(1);
  expect(result.kind).toBe('response');
  expect(result.policy).toBe(SEARCH_POLICY);
  expect(result.waitedMs).toBe(0);
  expect(result.skips).toEqual([]);
});

it('applies the standing headers to a GET and adds a JSON content type to a POST', async () => {
  const { http, client } = harness({
    [`GET ${DATA_URL}`]: response(200, CLEAR_SEARCH_HEADERS),
    [`POST ${SEARCH_URL}`]: response(200, CLEAR_SEARCH_HEADERS),
  });

  await client.send({ method: 'GET', url: DATA_URL });
  await client.send({ method: 'POST', url: SEARCH_URL, body: '{"query":{}}' });

  const [get, post] = http.requests;
  expect(get?.headers).toEqual({
    'user-agent': CONTACT,
    'x-requested-with': 'XMLHttpRequest',
  });
  expect(post?.headers).toEqual({
    'user-agent': CONTACT,
    'x-requested-with': 'XMLHttpRequest',
    'content-type': 'application/json',
  });
  expect(post?.body).toBe('{"query":{}}');
});

it('lets no caller header displace the contact address or the standing markers', async () => {
  const { http, client } = harness({
    [`GET ${DATA_URL}`]: response(200, CLEAR_SEARCH_HEADERS),
  });

  await client.send({
    method: 'GET',
    url: DATA_URL,
    headers: { 'User-Agent': 'something-anonymous', accept: 'application/json' },
  });

  expect(http.requests[0]?.headers['user-agent']).toBe(CONTACT);
  expect(http.requests[0]?.headers.accept).toBe('application/json');
});

// I/O matrix: contact overlay unset.
it('refuses at construction when the contact User-Agent is blank', () => {
  const http = createFakeHttpPort();
  const build = (userAgent: string): unknown =>
    createTradeClient({
      http,
      clock: createFakeClockPort(NOW),
      wait: recordingWait().wait,
      userAgent,
    });

  expect(() => build('')).toThrow(USER_AGENT_ENV_VAR);
  expect(() => build(' '.repeat(3))).toThrow(USER_AGENT_ENV_VAR);
  expect(http.requests).toEqual([]);
});

// I/O matrix: tightest bucket governs, and backoff under test.
it('waits out the tightest unsatisfied bucket before issuing, without spending the time', async () => {
  const { http, waits, client } = harness({
    [`POST ${SEARCH_URL}`]: response(200, SATURATED_SEARCH_HEADERS),
  });

  await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  expect(waits).toEqual([]);

  const second = await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });

  // Ip's window is 10s and Client's is 300s; the tightest is the one that
  // makes you wait longest.
  expect(waits).toEqual([300_000]);
  expect(second.waitedMs).toBe(300_000);
  expect(http.requests).toHaveLength(2);
});

// I/O matrix: policies do not cross.
it('paces a fetch against its own policy, never against the search policy it saturated', async () => {
  const { waits, client } = harness({
    [`POST ${SEARCH_URL}`]: response(200, SATURATED_SEARCH_HEADERS),
    [`GET ${FETCH_URL}`]: response(200, {
      'x-rate-limit-policy': FETCH_POLICY,
      'x-rate-limit-rules': 'Ip',
      'x-rate-limit-ip': '12:4:10',
      'x-rate-limit-ip-state': '1:4:0',
    }),
  });

  await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  const fetched = await client.send({ method: 'GET', url: FETCH_URL, lane: 'fetch' });

  expect(waits).toEqual([]);
  expect(fetched.policy).toBe(FETCH_POLICY);

  // ...and the search lane is still paced by its own saturated ledger.
  await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  expect(waits).toEqual([300_000]);
});

// I/O matrix: a named rule's headers absent, and a malformed policy header.
it('surfaces a skipped rule and keeps pacing on the rules that did arrive', async () => {
  const { waits, client } = harness({
    [`POST ${SEARCH_URL}`]: response(200, {
      'x-rate-limit-policy': SEARCH_POLICY,
      'x-rate-limit-rules': 'Ip,Client',
      'x-rate-limit-ip': '5:10:60',
      'x-rate-limit-ip-state': '5:10:0',
      // Client is named but malformed; it is skipped, not thrown.
      'x-rate-limit-client': 'banana',
      'x-rate-limit-client-state': '1:10:0',
    }),
  });

  const first = await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  expect(first.skips.map((skip) => skip.reason)).toEqual(['policy-header-malformed']);

  await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  expect(waits).toEqual([10_000]);
});

// I/O matrix: 429 with Retry-After.
it('yields on a 429 carrying Retry-After, and issues nothing further', async () => {
  const { http, waits, client } = harness({
    [`POST ${SEARCH_URL}`]: response(429, {
      'x-rate-limit-policy': SEARCH_POLICY,
      'x-rate-limit-rules': 'Ip',
      'x-rate-limit-ip': '5:10:60',
      'x-rate-limit-ip-state': '5:10:43',
      'retry-after': '43',
    }),
  });

  const result = await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });

  expect(result.kind).toBe('yield');
  if (result.kind !== 'yield') {
    return;
  }
  expect(result.retryAfterMs).toBe(43_000);
  expect(result.reason).toBe('retry-after-header');
  expect(result.policy).toBe(SEARCH_POLICY);
  // Never a retry, and never slept out.
  expect(http.requests).toHaveLength(1);
  expect(waits).toEqual([]);
});

// I/O matrix: 429 without Retry-After.
it('yields on a 429 with no Retry-After, naming the derived source', async () => {
  const { client } = harness({
    [`POST ${SEARCH_URL}`]: response(429, {
      'x-rate-limit-policy': SEARCH_POLICY,
      'x-rate-limit-rules': 'Ip',
      'x-rate-limit-ip': '5:10:60',
      'x-rate-limit-ip-state': '5:10:0',
    }),
  });

  const result = await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });

  expect(result.kind).toBe('yield');
  if (result.kind !== 'yield') {
    return;
  }
  expect(result.retryAfterMs).toBe(60_000);
  expect(result.reason).toBe('derived-penalty');
});

it('derives the yield delay when Retry-After is an HTTP-date rather than seconds', async () => {
  const { client } = harness({
    [`POST ${SEARCH_URL}`]: response(429, {
      'x-rate-limit-policy': SEARCH_POLICY,
      'x-rate-limit-rules': 'Ip',
      'x-rate-limit-ip': '5:10:60',
      'x-rate-limit-ip-state': '5:10:0',
      'retry-after': 'Sun, 20 Sep 2026 12:01:00 GMT',
    }),
  });

  const result = await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });

  expect(result.kind).toBe('yield');
  if (result.kind !== 'yield') {
    return;
  }
  expect(result.reason).toBe('derived-penalty');
  expect(Number.isNaN(result.retryAfterMs)).toBe(false);
});

// I/O matrix: non-429 failure.
it('returns a 503 to the caller unchanged and decides nothing on its behalf', async () => {
  const { client } = harness({
    [`GET ${DATA_URL}`]: response(503, { 'content-type': 'text/html' }, 'upstream is unwell'),
  });

  const result = await client.send({ method: 'GET', url: DATA_URL });

  expect(result.kind).toBe('response');
  if (result.kind !== 'response') {
    return;
  }
  expect(result.response.status).toBe(503);
  expect(result.response.body).toBe('upstream is unwell');
  expect(result.policy).toBeUndefined();
  // A 5xx is not an invalid request and spends none of the threshold.
  expect(result.invalidRequests).toBe(0);
});

// I/O matrix: an invalid request is counted.
it('counts a 403 against its policy and carries the running count on every result', async () => {
  const { client } = harness({
    [`POST ${SEARCH_URL}`]: response(403, CLEAR_SEARCH_HEADERS, 'forbidden'),
    [`GET ${DATA_URL}`]: response(200, CLEAR_SEARCH_HEADERS),
  });

  const forbidden = await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });

  // Returned as an ordinary response — the caller decides — but counted.
  expect(forbidden.kind).toBe('response');
  expect(forbidden.invalidRequests).toBe(1);

  // The count rides on a 200 too, so the threshold can be seen approaching.
  const ok = await client.send({ method: 'GET', url: DATA_URL, lane: 'data' });
  expect(ok.kind).toBe('response');
  expect(ok.invalidRequests).toBe(1);

  const again = await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  expect(again.invalidRequests).toBe(2);
});

// I/O matrix: invalid-request threshold reached.
it('refuses to issue once the threshold passed into the factory is reached', async () => {
  const http = createFakeHttpPort({
    [`POST ${SEARCH_URL}`]: response(403, CLEAR_SEARCH_HEADERS, 'forbidden'),
  });
  const { waits, wait } = recordingWait();
  const client = createTradeClient({
    http,
    clock: createFakeClockPort(NOW),
    wait,
    userAgent: CONTACT,
    // A value, never a compiled-in number — exactly as no rate is.
    invalidRequestThreshold: 2,
  });

  await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  expect(http.requests).toHaveLength(2);

  const refused = await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });

  expect(refused.kind).toBe('yield');
  if (refused.kind !== 'yield') {
    return;
  }
  expect(refused.reason).toBe('invalid-request-threshold');
  expect(refused.invalidRequests).toBe(2);
  // Not recoverable by waiting, so no delay is offered and none is spent.
  expect(refused.retryAfterMs).toBe(0);
  expect(refused.response).toBeUndefined();
  expect(waits).toEqual([]);
  // Nothing went through the port: the refusal is the whole point.
  expect(http.requests).toHaveLength(2);
});

it('holds the threshold per policy, so invalid searches do not close the fetch lane', async () => {
  const http = createFakeHttpPort({
    [`POST ${SEARCH_URL}`]: response(403, CLEAR_SEARCH_HEADERS, 'forbidden'),
    [`GET ${FETCH_URL}`]: response(200, {
      'x-rate-limit-policy': FETCH_POLICY,
      'x-rate-limit-rules': 'Ip',
      'x-rate-limit-ip': '12:4:10',
      'x-rate-limit-ip-state': '1:4:0',
    }),
  });
  const client = createTradeClient({
    http,
    clock: createFakeClockPort(NOW),
    wait: recordingWait().wait,
    userAgent: CONTACT,
    invalidRequestThreshold: 1,
  });

  await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  const refused = await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  expect(refused.kind).toBe('yield');

  // The fetch policy has spent nothing and is still open.
  const fetched = await client.send({ method: 'GET', url: FETCH_URL, lane: 'fetch' });
  expect(fetched.kind).toBe('response');
  expect(fetched.invalidRequests).toBe(0);
});

it('counts but never refuses when no threshold was declared', async () => {
  const { http, client } = harness({
    [`POST ${SEARCH_URL}`]: response(403, CLEAR_SEARCH_HEADERS, 'forbidden'),
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  }

  expect(http.requests).toHaveLength(3);
});

// GGG treats one policy as one limit even where several endpoints share it, so
// the separation above is only half the story.
it('paces two different lanes off one another when they report the same policy', async () => {
  const { waits, client } = harness({
    [`POST ${SEARCH_URL}`]: response(200, SATURATED_SEARCH_HEADERS),
    // A different endpoint and a different lane, but the SAME policy value.
    [`GET ${DATA_URL}`]: response(200, CLEAR_SEARCH_HEADERS),
  });

  await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  expect(waits).toEqual([]);

  // Cold lane, so this one issues — and learns it spends the saturated policy.
  await client.send({ method: 'GET', url: DATA_URL, lane: 'data' });
  expect(waits).toEqual([]);

  // Now the second lane paces off the consumption the first lane recorded,
  // because the ledger keys on the policy value and not on the lane. The
  // `Client` rule survives from the first response even though the second
  // response named only `Ip`.
  await client.send({ method: 'GET', url: DATA_URL, lane: 'data' });
  expect(waits).toEqual([300_000]);
});

it('keeps a rule an earlier response declared when a later one cannot read it', async () => {
  const { waits, client } = harness({
    [`POST ${SEARCH_URL}`]: response(200, SATURATED_SEARCH_HEADERS),
    [`GET ${DATA_URL}`]: response(200, {
      'x-rate-limit-policy': SEARCH_POLICY,
      'x-rate-limit-rules': 'Ip,Client',
      'x-rate-limit-ip': '5:10:60',
      'x-rate-limit-ip-state': '1:10:0',
      // Client is named but unreadable; its saturated bucket must survive.
      'x-rate-limit-client': 'banana',
      'x-rate-limit-client-state': '30:300:0',
    }),
  });

  await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  await client.send({ method: 'GET', url: DATA_URL, lane: 'data' });

  await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  expect(waits).toEqual([300_000]);
});

it('groups a fetch by its endpoint, so a second id paces against the first', async () => {
  const saturatedFetchHeaders = {
    'x-rate-limit-policy': FETCH_POLICY,
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': '12:4:10',
    'x-rate-limit-ip-state': '12:4:0',
  };
  const { waits, client } = harness({
    'GET https://trade.test/api/trade2/fetch/first': response(200, saturatedFetchHeaders),
    'GET https://trade.test/api/trade2/fetch/second': response(200, saturatedFetchHeaders),
  });

  // No lane named: the ids differ, so only a default lane that drops the final
  // segment can pace the second request at all.
  await client.send({ method: 'GET', url: 'https://trade.test/api/trade2/fetch/first' });
  expect(waits).toEqual([]);

  await client.send({ method: 'GET', url: 'https://trade.test/api/trade2/fetch/second' });
  expect(waits).toEqual([4000]);
});

it('issues serially, so two concurrent sends do not both read a stale ledger', async () => {
  const { http, waits, client } = harness({
    [`POST ${SEARCH_URL}`]: response(200, SATURATED_SEARCH_HEADERS),
  });

  await Promise.all([
    client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' }),
    client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' }),
  ]);

  // The second call waited on the first call's response rather than racing it.
  expect(waits).toEqual([300_000]);
  expect(http.requests).toHaveLength(2);
});

it('does not wedge the queue when one exchange rejects', async () => {
  const { client } = harness({
    [`GET ${DATA_URL}`]: response(200, CLEAR_SEARCH_HEADERS),
  });

  await expect(
    client.send({ method: 'GET', url: 'https://trade.test/api/trade2/data/unfixtured' }),
  ).rejects.toThrow();

  const after = await client.send({ method: 'GET', url: DATA_URL });
  expect(after.kind).toBe('response');
});

it('treats Retry-After: 0 as absent rather than as an instant re-entry', async () => {
  const { client } = harness({
    [`POST ${SEARCH_URL}`]: response(429, {
      'x-rate-limit-policy': SEARCH_POLICY,
      'x-rate-limit-rules': 'Ip',
      'x-rate-limit-ip': '5:10:60',
      'x-rate-limit-ip-state': '5:10:0',
      'retry-after': '0',
    }),
  });

  const result = await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });

  expect(result.kind).toBe('yield');
  if (result.kind !== 'yield') {
    return;
  }
  expect(result.reason).toBe('derived-penalty');
  expect(result.retryAfterMs).toBe(60_000);
});

it('never yields zero, even when the ledger holds nothing for the policy', async () => {
  const { client } = harness({
    // A 429 whose only named rule is unreadable: nothing reaches the ledger,
    // so the yield floor has to come from the response itself.
    [`POST ${SEARCH_URL}`]: response(429, {
      'x-rate-limit-policy': SEARCH_POLICY,
      'x-rate-limit-rules': 'Ip',
      'x-rate-limit-ip': 'banana',
      'x-rate-limit-ip-state': 'banana',
    }),
    [`GET ${DATA_URL}`]: response(429, { 'content-type': 'text/html' }),
  });

  const parsedNothing = await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  expect(parsedNothing.kind).toBe('yield');
  if (parsedNothing.kind === 'yield') {
    expect(parsedNothing.retryAfterMs).toBeGreaterThan(0);
  }

  // And a 429 carrying no governance headers at all still yields a real delay.
  const noHeaders = await client.send({ method: 'GET', url: DATA_URL, lane: 'data' });
  expect(noHeaders.kind).toBe('yield');
  if (noHeaders.kind === 'yield') {
    expect(noHeaders.retryAfterMs).toBeGreaterThan(0);
  }
});

it('defaults the lane to the request method and path when the caller names none', async () => {
  const { waits, client } = harness({
    [`POST ${SEARCH_URL}`]: response(200, SATURATED_SEARCH_HEADERS),
    [`GET ${DATA_URL}`]: response(200, {
      'x-rate-limit-policy': FETCH_POLICY,
      'x-rate-limit-rules': 'Ip',
      'x-rate-limit-ip': '12:4:10',
      'x-rate-limit-ip-state': '1:4:0',
    }),
  });

  await client.send({ method: 'POST', url: SEARCH_URL });
  // A different method and path, so a different lane: no wait is inherited.
  await client.send({ method: 'GET', url: DATA_URL });
  expect(waits).toEqual([]);

  await client.send({ method: 'POST', url: SEARCH_URL });
  expect(waits).toEqual([300_000]);
});

// Story 1.5: the chunk runner's allowance comes from the live headers.
it('reports the smallest remaining allowance over every bucket of every rule', async () => {
  const { client } = harness({
    [`POST ${SEARCH_URL}`]: response(200, {
      'x-rate-limit-policy': SEARCH_POLICY,
      'x-rate-limit-rules': 'Ip,Client',
      'x-rate-limit-ip': '5:10:60,15:60:300',
      'x-rate-limit-ip-state': '1:10:0,12:60:0',
      'x-rate-limit-client': '30:300:1800',
      'x-rate-limit-client-state': '20:300:0',
    }),
  });

  const result = await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });

  // 5-1=4, 15-12=3, 30-20=10: the tightest bucket governs.
  expect(result.remaining).toBe(3);
});

it('reports zero, never a negative, when a bucket is spent past its limit', async () => {
  const { client } = harness({
    [`POST ${SEARCH_URL}`]: response(429, {
      'x-rate-limit-policy': SEARCH_POLICY,
      'x-rate-limit-rules': 'Ip',
      'x-rate-limit-ip': '5:10:60',
      'x-rate-limit-ip-state': '7:10:60',
      'retry-after': '60',
    }),
  });

  const result = await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });

  expect(result.kind).toBe('yield');
  expect(result.remaining).toBe(0);
});

it('omits the remaining allowance where the response declared no readable rule', async () => {
  const { client } = harness({
    [`GET ${DATA_URL}`]: response(200, {}, '[]'),
  });

  const result = await client.send({ method: 'GET', url: DATA_URL });

  expect(result.remaining).toBeUndefined();
  expect('remaining' in result).toBe(false);
});

it('omits the remaining allowance on a threshold refusal, because nothing was issued', async () => {
  const http = createFakeHttpPort({
    [`POST ${SEARCH_URL}`]: response(403, CLEAR_SEARCH_HEADERS, 'forbidden'),
  });
  const client = createTradeClient({
    http,
    clock: createFakeClockPort(NOW),
    wait: () => Promise.resolve(),
    userAgent: CONTACT,
    invalidRequestThreshold: 1,
  });

  const first = await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  expect(first.remaining).toBe(4);

  const refused = await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  expect(refused.kind).toBe('yield');
  expect(refused.remaining).toBeUndefined();
});

it('paces sibling clients against one ledger while each sends through its own port', async () => {
  const fixtures = {
    [`GET ${DATA_URL}`]: response(200, SATURATED_SEARCH_HEADERS),
    [`POST ${SEARCH_URL}`]: response(200, CLEAR_SEARCH_HEADERS),
  };
  const gateHttp = createFakeHttpPort(fixtures);
  const stepHttp = createFakeHttpPort(fixtures);
  const { waits, wait } = recordingWait();
  const clients = createTradeClients({
    http: { gate: gateHttp, step: stepHttp },
    clock: createFakeClockPort(NOW),
    wait,
    userAgent: CONTACT,
  });

  await clients.gate.send({ method: 'GET', url: DATA_URL, lane: 'data' });
  // A cold lane on the sibling issues, and learns it spends the same policy.
  await clients.step.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  // The sibling now paces off what the first client recorded.
  await clients.step.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });

  expect(waits).toEqual([300_000]);
  expect(gateHttp.requests.map((request) => request.url)).toEqual([DATA_URL]);
  expect(stepHttp.requests.map((request) => request.url)).toEqual([SEARCH_URL, SEARCH_URL]);
});

it('refuses sibling clients at construction when the contact User-Agent is blank', () => {
  expect(() =>
    createTradeClients({
      http: { only: createFakeHttpPort({}) },
      clock: createFakeClockPort(NOW),
      wait: () => Promise.resolve(),
      userAgent: '  ',
    }),
  ).toThrow(MissingUserAgentError);
});

// The governor and its shared pacing state (AD-8, IMPLEMENTATION-NOTES.md §5.3).
const MEASURED_SEARCH_HEADERS = {
  'x-rate-limit-policy': SEARCH_POLICY,
  'x-rate-limit-rules': 'Ip',
  'x-rate-limit-ip': '5:10:60,30:300:1800,600:21600:3600',
  'x-rate-limit-ip-state': '1:10:0,20:300:0,100:21600:0',
};

it('spreads the next search evenly when asked to, and never without', async () => {
  const fixtures = { [`POST ${SEARCH_URL}`]: response(200, MEASURED_SEARCH_HEADERS) };
  const spread = recordingWait();
  const spreadGovernor = createTradeGovernor({
    http: { only: createFakeHttpPort(fixtures) },
    clock: createFakeClockPort(NOW),
    wait: spread.wait,
    userAgent: CONTACT,
    spread: true,
  });
  const batch = recordingWait();
  const batchClients = createTradeClients({
    http: { only: createFakeHttpPort(fixtures) },
    clock: createFakeClockPort(NOW),
    wait: batch.wait,
    userAgent: CONTACT,
  });

  for (let sent = 0; sent < 2; sent += 1) {
    await spreadGovernor.clients.only.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
    await batchClients.only.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  }

  // Cold first, then max(300 000 / 10, 21 600 000 / 500).
  expect(spread.waits).toEqual([43_200]);
  expect(batch.waits).toEqual([]);
});

it('shares one pacing state across governors, so a fresh governor starts warm', async () => {
  const fixtures = { [`POST ${SEARCH_URL}`]: response(200, MEASURED_SEARCH_HEADERS) };
  const pacing = createPacingState();
  const clock = createFakeClockPort(NOW);
  const first = createTradeGovernor({
    http: { only: createFakeHttpPort(fixtures) },
    clock,
    wait: () => Promise.resolve(),
    userAgent: CONTACT,
    pacing,
    spread: true,
  });
  await first.clients.only.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });

  const { waits, wait } = recordingWait();
  const second = createTradeGovernor({
    http: { only: createFakeHttpPort(fixtures) },
    clock,
    wait,
    userAgent: CONTACT,
    pacing,
    spread: true,
  });
  expect(second.pacing).toBe(pacing);
  expect(second.delayBeforeMs('search')).toBe(43_200);
  expect(laneDelayMs(pacing, 'search', NOW, true)).toBe(43_200);
  // The batch pacer on the same reading sees every bucket satisfied.
  expect(laneDelayMs(pacing, 'search', NOW, false)).toBe(0);
  // A lane with no known policy goes out cold.
  expect(second.delayBeforeMs('fetch')).toBe(0);

  clock.set('2026-09-20T12:00:10.000Z');
  await second.clients.only.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  expect(waits).toEqual([33_200]);
});

it('keeps invalid-request counts per governor, so one 4xx does not close a policy for the next', async () => {
  const pacing = createPacingState();
  const first = createTradeGovernor({
    http: { only: createFakeHttpPort({ [`POST ${SEARCH_URL}`]: response(400, CLEAR_SEARCH_HEADERS) }) },
    clock: createFakeClockPort(NOW),
    wait: () => Promise.resolve(),
    userAgent: CONTACT,
    invalidRequestThreshold: 1,
    pacing,
  });
  await first.clients.only.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  const refused = await first.clients.only.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  expect(refused.kind).toBe('yield');

  const second = createTradeGovernor({
    http: { only: createFakeHttpPort({ [`POST ${SEARCH_URL}`]: response(200, CLEAR_SEARCH_HEADERS) }) },
    clock: createFakeClockPort(NOW),
    wait: () => Promise.resolve(),
    userAgent: CONTACT,
    invalidRequestThreshold: 1,
    pacing,
  });
  const answered = await second.clients.only.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  expect(answered.kind).toBe('response');
});

// The 429 operator line: the response's governance headers beside the reading the wait was paced on.
it('logs one line on a 429, naming the response headers and the reading it was paced on', async () => {
  const OTHER_SEARCH_URL = 'https://trade.test/api/trade2/search/poe2/Other';
  const http = createFakeHttpPort({
    [`POST ${SEARCH_URL}`]: response(200, CLEAR_SEARCH_HEADERS),
    [`POST ${OTHER_SEARCH_URL}`]: response(429, {
      'x-rate-limit-policy': SEARCH_POLICY,
      'x-rate-limit-rules': 'Ip',
      'X-Rate-Limit-Ip': '5:10:60',
      'x-rate-limit-ip-state': '6:10:600',
      'retry-after': '600',
      'content-type': 'application/json',
    }),
  });
  const lines: string[] = [];
  const { wait } = recordingWait();
  const clock = createFakeClockPort(NOW);
  const client = createTradeClient({
    http,
    clock,
    wait,
    userAgent: CONTACT,
    invalidRequestThreshold: 1,
    log: (line) => {
      lines.push(line);
    },
  });

  const outcome = await client.send({ method: 'POST', url: SEARCH_URL });
  expect(outcome.kind).toBe('response');
  expect(lines).toEqual([]);

  // A later instant, so the line tells the reading's age from the 429's.
  const LATER = '2026-09-20T12:00:30.000Z';
  clock.set(LATER);
  const refused = await client.send({ method: 'POST', url: OTHER_SEARCH_URL });
  expect(refused.kind).toBe('yield');
  expect(lines).toEqual([
    `sync: the trade API answered 429 at ${LATER} on lane POST /api/trade2/search/poe2 (policy ${SEARCH_POLICY}) ` +
      'after waiting 0 ms; response headers ' +
      JSON.stringify({
        'retry-after': '600',
        'x-rate-limit-ip': '5:10:60',
        'x-rate-limit-ip-state': '6:10:600',
        'x-rate-limit-policy': SEARCH_POLICY,
        'x-rate-limit-rules': 'Ip',
      }) +
      `; paced on policy ${SEARCH_POLICY} ` +
      JSON.stringify([{ rule: 'Ip', observedAt: NOW, policy: '5:10:60', state: '1:10:0' }]),
  ]);

  // The threshold refusal that follows sends nothing, so it has nothing to log.
  const threshold = await client.send({ method: 'POST', url: SEARCH_URL });
  expect(threshold.kind === 'yield' && threshold.reason).toBe('invalid-request-threshold');
  expect(lines).toHaveLength(1);
});

it('logs a cold 429 as paced on no reading', async () => {
  const http = createFakeHttpPort({
    [`POST ${SEARCH_URL}`]: response(429, { 'content-type': 'text/html' }),
  });
  const lines: string[] = [];
  const { wait } = recordingWait();
  const client = createTradeClient({
    http,
    clock: createFakeClockPort(NOW),
    wait,
    userAgent: CONTACT,
    log: (line) => {
      lines.push(line);
    },
  });

  await client.send({ method: 'POST', url: SEARCH_URL });

  expect(lines).toEqual([
    `sync: the trade API answered 429 at ${NOW} on lane POST /api/trade2/search/poe2 (policy unknown) ` +
      'after waiting 0 ms; response headers {}; paced on no reading',
  ]);
});

describe('the session probe (AD-30, IMPLEMENTATION-NOTES.md §13.2, §13.3)', () => {
  const VALUE = 'probe-value-Q7vXk2pLm9RtYw4Nz8HbJc3FgD6sAe1U';
  const COOKIE = `POESESSID=${VALUE}`;
  const BODY = '{"query":{"status":{"option":"securable"}}}';
  const BASELINE_BODY = JSON.stringify({ id: 'BASELINE', result: ['r1'] });
  const PROBE_BODY = JSON.stringify({ id: 'PROBE', result: ['r1'] });

  /** One rule more than `CLEAR_SEARCH_HEADERS`, nothing saturated. */
  const LIVE_SEARCH_HEADERS = {
    ...CLEAR_SEARCH_HEADERS,
    'x-rate-limit-rules': 'Ip,Account',
    'x-rate-limit-account': '10:10:60',
    'x-rate-limit-account-state': '1:10:0',
  };

  interface Sent {
    readonly port: 'http' | 'probe';
    readonly method: string;
    readonly url: string;
    readonly body: string | undefined;
    readonly cookie: string | undefined;
  }

  type ProbeAnswer = HttpResponse | ((request: HttpRequest) => Promise<HttpResponse>);

  function probeHarness(
    options: {
      readonly baseline?: HttpResponse;
      readonly probe?: ProbeAnswer;
      readonly value?: string;
      /** The answer to a request that carries the cookie. Defaults to a live 2xx. */
      readonly cookieAnswer?: (request: HttpRequest) => HttpResponse;
    } = {},
  ) {
    const sent: Sent[] = [];
    const record = (port: Sent['port'], request: HttpRequest): void => {
      sent.push({
        port,
        method: request.method,
        url: request.url,
        body: request.body,
        cookie: request.headers['cookie'],
      });
    };
    const fake = createFakeHttpPort({
      [`POST ${SEARCH_URL}`]: options.baseline ?? response(200, CLEAR_SEARCH_HEADERS, BASELINE_BODY),
      [`GET ${FETCH_URL}`]: response(200, {}, '{"result":[]}'),
      [`GET ${DATA_URL}`]: response(200, {}, '[]'),
    });
    const cookieAnswer =
      options.cookieAnswer ??
      ((request: HttpRequest) =>
        response(200, LIVE_SEARCH_HEADERS, request.method === 'POST' ? BASELINE_BODY : '{"result":[]}'));
    const http: HttpPort = {
      send(request) {
        record('http', request);
        return request.headers['cookie'] === undefined
          ? fake.send(request)
          : Promise.resolve(cookieAnswer(request));
      },
    };
    const answer: ProbeAnswer = options.probe ?? response(200, LIVE_SEARCH_HEADERS, PROBE_BODY);
    const probe: HttpPort = {
      send(request) {
        record('probe', request);
        return typeof answer === 'function' ? answer(request) : Promise.resolve(answer);
      },
    };
    const lines: string[] = [];
    const logs: string[] = [];
    const holder = createSessionAuth(
      { [SESSION_COOKIE_ENV_VAR]: options.value ?? VALUE },
      { onSettle: (line) => { lines.push(line); } },
    );
    const { waits, wait } = recordingWait();
    const governor = createTradeGovernor({
      http: { pricing: http, league: http },
      clock: createFakeClockPort(NOW),
      wait,
      userAgent: CONTACT,
      invalidRequestThreshold: 1,
      log: (line) => {
        logs.push(line);
      },
      auth: { holder, probe },
    });
    const { pricing, league } = governor.clients;
    const search = () =>
      pricing.send({ method: 'POST', url: SEARCH_URL, body: BODY, lane: 'search', cookieEligible: true });
    const fetch = () => pricing.send({ method: 'GET', url: FETCH_URL, lane: 'fetch', cookieEligible: true });
    const leagues = () => league.send({ method: 'GET', url: DATA_URL, lane: 'data' });
    return { sent, lines, logs, holder, waits, governor, probe, search, fetch, leagues };
  }

  const probesOf = (sent: readonly Sent[]) => sent.filter((entry) => entry.port === 'probe');
  const httpOf = (sent: readonly Sent[]) => sent.filter((entry) => entry.port === 'http');

  it('live: the baseline goes without the cookie, the probe repeats it with the cookie, later pricing requests carry it, the league request never does', async () => {
    const h = probeHarness();

    await h.leagues();
    const baseline = await h.search();
    await h.fetch();
    await h.search();
    await h.leagues();

    expect(h.sent.map(({ port, method, url, cookie }) => ({ port, method, url, cookie }))).toEqual([
      { port: 'http', method: 'GET', url: DATA_URL, cookie: undefined },
      { port: 'http', method: 'POST', url: SEARCH_URL, cookie: undefined },
      { port: 'probe', method: 'POST', url: SEARCH_URL, cookie: COOKIE },
      { port: 'http', method: 'GET', url: FETCH_URL, cookie: COOKIE },
      { port: 'http', method: 'POST', url: SEARCH_URL, cookie: COOKIE },
      { port: 'http', method: 'GET', url: DATA_URL, cookie: undefined },
    ]);
    // The probe repeats the baseline's method, path and body.
    expect(probesOf(h.sent)[0]?.body).toBe(BODY);
    expect(h.lines).toEqual(['authenticated']);
    expect(h.holder.state).toEqual({ kind: 'authenticated' });
    // The baseline's answer is the result, never the probe's.
    expect(baseline.kind === 'response' && baseline.response.body).toBe(BASELINE_BODY);
    expect(h.governor.latchedRetryAfterMs()).toBeUndefined();
  });

  it('the probe goes through the pacing wait, and its State reading folds into the ledger', async () => {
    const h = probeHarness({
      baseline: response(200, SATURATED_SEARCH_HEADERS, BASELINE_BODY),
      probe: response(200, { ...CLEAR_SEARCH_HEADERS, 'x-rate-limit-ip-state': '2:10:0' }, PROBE_BODY),
    });

    await h.search();

    // The saturated baseline reading made the probe wait before it was sent.
    expect(h.waits).toHaveLength(1);
    expect(h.waits[0]).toBeGreaterThan(0);
    const ip = h.governor.pacing.ledger[SEARCH_POLICY]?.rules.find((rule) => rule.name === 'Ip');
    expect(ip?.state[0]?.hits).toBe(2);
    // Fewer rule names than the baseline: not live.
    expect(h.lines).toEqual(['unauthenticated (not-elevated)']);
  });

  it.each([
    ['the same rule count', CLEAR_SEARCH_HEADERS],
    ['no rules header at all', {}],
  ])('not elevated (%s): one line, and no later request carries the cookie', async (_label, headers) => {
    const h = probeHarness({ probe: response(200, headers, PROBE_BODY) });

    await h.search();
    await h.fetch();
    await h.search();

    expect(h.lines).toEqual(['unauthenticated (not-elevated)']);
    expect(probesOf(h.sent)).toHaveLength(1);
    expect(httpOf(h.sent).map((entry) => entry.cookie)).toEqual([undefined, undefined, undefined]);
  });

  it.each([400, 401, 403, 404])(
    'rejected (%i): probe-rejected, no invalid-request count, and pricing continues without the cookie',
    async (status) => {
      const h = probeHarness({ probe: response(status, CLEAR_SEARCH_HEADERS, 'nope') });

      const baseline = await h.search();
      const fetched = await h.fetch();
      const again = await h.search();

      expect(h.lines).toEqual(['unauthenticated (probe-rejected)']);
      expect(baseline.invalidRequests).toBe(0);
      // Threshold 1 is not reached: the requests after the probe still go out.
      expect(fetched.kind).toBe('response');
      expect(again.kind).toBe('response');
      expect(again.invalidRequests).toBe(0);
      expect(httpOf(h.sent).every((entry) => entry.cookie === undefined)).toBe(true);
    },
  );

  it.each([
    ['a 503', (): Promise<HttpResponse> => Promise.resolve(response(503, {}, 'busy'))],
    ['a throw', (): Promise<HttpResponse> => Promise.reject(new TypeError('fetch failed'))],
    ['a timeout', (): Promise<HttpResponse> => Promise.reject(new DOMException('timed out', 'TimeoutError'))],
  ])('failed (%s): probe-failed, the error is not passed on, and the entry continues to its fetch', async (_label, probe) => {
    const h = probeHarness({ probe });

    const baseline = await h.search();
    const fetched = await h.fetch();

    expect(baseline.kind === 'response' && baseline.response.body).toBe(BASELINE_BODY);
    expect(fetched.kind).toBe('response');
    expect(h.lines).toEqual(['unauthenticated (probe-failed)']);
    expect(h.sent.at(-1)).toMatchObject({ port: 'http', method: 'GET', cookie: undefined });
    expect(h.governor.latchedRetryAfterMs()).toBeUndefined();
  });

  it('penalty (429): settles nothing, latches the delay, and the next send yields it with nothing sent', async () => {
    const h = probeHarness({ probe: response(429, { ...CLEAR_SEARCH_HEADERS, 'retry-after': '120' }) });

    const baseline = await h.search();
    expect(baseline.kind).toBe('response');
    expect(baseline.invalidRequests).toBe(0);
    expect(h.lines).toEqual([]);
    expect(h.holder.state).toEqual({ kind: 'unsettled' });
    expect(h.governor.latchedRetryAfterMs()).toBe(120_000);
    // The 429 is an ordinary 429: it gets the operator line.
    expect(h.logs).toHaveLength(1);

    const sentBefore = h.sent.length;
    const fetched = await h.fetch();
    expect(fetched).toMatchObject({ kind: 'yield', retryAfterMs: 120_000, reason: 'retry-after-header' });
    expect(fetched.kind === 'yield' && fetched.response).toBeUndefined();
    expect(h.sent).toHaveLength(sentBefore);
  });

  it('penalty (429): a new governor over the same holder starts with no latch and probes again', async () => {
    const first = probeHarness({ probe: response(429, { 'retry-after': '5' }) });
    await first.search();
    expect(first.governor.latchedRetryAfterMs()).toBe(5000);

    const probe = createFakeHttpPort({ [`POST ${SEARCH_URL}`]: response(200, LIVE_SEARCH_HEADERS, PROBE_BODY) });
    const http = createFakeHttpPort({ [`POST ${SEARCH_URL}`]: response(200, CLEAR_SEARCH_HEADERS, BASELINE_BODY) });
    const next = createTradeGovernor({
      http: { pricing: http },
      clock: createFakeClockPort(NOW),
      wait: recordingWait().wait,
      userAgent: CONTACT,
      auth: { holder: first.holder, probe },
    });
    expect(next.latchedRetryAfterMs()).toBeUndefined();
    await next.clients.pricing.send({ method: 'POST', url: SEARCH_URL, body: BODY, cookieEligible: true });

    expect(probe.requests).toHaveLength(1);
    expect(first.lines).toEqual(['authenticated']);
  });

  it.each([
    ['a 429', response(429, { 'retry-after': '60' })],
    ['a 503', response(503, {})],
  ])('no 2xx search (%s): no probe, and the holder stays unsettled', async (_label, baseline) => {
    const h = probeHarness({ baseline });

    await h.search();

    expect(probesOf(h.sent)).toEqual([]);
    expect(h.holder.state).toEqual({ kind: 'unsettled' });
    expect(h.lines).toEqual([]);
  });

  it('no 2xx search (a throw): no probe, and the holder stays unsettled', async () => {
    const h = probeHarness();
    const throwing = createTradeGovernor({
      http: {
        pricing: { send: () => Promise.reject(new TypeError('fetch failed')) },
      },
      clock: createFakeClockPort(NOW),
      wait: recordingWait().wait,
      userAgent: CONTACT,
      auth: { holder: h.holder, probe: { send: () => Promise.reject(new Error('the probe must not be sent')) } },
    });

    await expect(
      throwing.clients.pricing.send({ method: 'POST', url: SEARCH_URL, body: BODY, cookieEligible: true }),
    ).rejects.toThrow('fetch failed');
    expect(h.holder.state).toEqual({ kind: 'unsettled' });
  });

  it('baseline 4xx: no probe, and the 4xx is returned for the caller to abort on', async () => {
    const h = probeHarness({ baseline: response(400, CLEAR_SEARCH_HEADERS, 'bad') });

    const baseline = await h.search();

    expect(baseline.kind === 'response' && baseline.response.status).toBe(400);
    expect(baseline.invalidRequests).toBe(1);
    expect(probesOf(h.sent)).toEqual([]);
    expect(h.holder.state).toEqual({ kind: 'unsettled' });
  });

  it('an unmarked 2xx request is never a baseline', async () => {
    const h = probeHarness();

    await h.leagues();
    await h.governor.clients.pricing.send({ method: 'POST', url: SEARCH_URL, body: BODY });

    expect(probesOf(h.sent)).toEqual([]);
    expect(h.holder.state).toEqual({ kind: 'unsettled' });
  });

  it('a settled holder never probes again', async () => {
    const h = probeHarness();

    await h.search();
    await h.search();
    await h.search();

    expect(probesOf(h.sent)).toHaveLength(1);
    expect(h.lines).toEqual(['authenticated']);
  });

  it.each([
    ['absent', ''],
    ['malformed', 'a b'],
  ])('an %s holder never probes and never attaches', async (_label, value) => {
    const h = probeHarness({ value });

    await h.search();
    await h.fetch();

    expect(probesOf(h.sent)).toEqual([]);
    expect(h.sent.every((entry) => entry.cookie === undefined)).toBe(true);
  });

  it('a live probe records the clear action and keeps the baseline rule count and policy', async () => {
    const h = probeHarness();

    await h.search();

    expect(h.holder.baselineRuleCount).toBe(1);
    expect(h.holder.baselinePolicy).toBe(SEARCH_POLICY);
    expect(h.holder.pendingHoldOff()).toBe('clear');
  });

  describe('the downgrade (§13.4)', () => {
    const NOT_LIVE_HEADERS = CLEAR_SEARCH_HEADERS;

    it.each([
      ['a 401', response(401, CLEAR_SEARCH_HEADERS, 'nope')],
      ['a 403', response(403, { 'content-type': 'text/html', 'cf-mitigated': 'challenge' }, 'blocked')],
      ['a 2xx under the baseline policy that is not live', response(200, NOT_LIVE_HEADERS, '{"result":[]}')],
      [
        'a not-live 2xx whose policy differs only in case and spaces',
        response(
          200,
          { ...NOT_LIVE_HEADERS, 'x-rate-limit-policy': ` ${SEARCH_POLICY.toUpperCase()} ` },
          '{"result":[]}',
        ),
      ],
    ])(
      '%s on a cookie fetch: one expired line, cold pacing in place, a session-expired yield with no response, no invalid count, no later cookie',
      async (_label, downgrading) => {
        const h = probeHarness({
          cookieAnswer: (request) =>
            request.method === 'GET'
              ? downgrading
              : response(200, LIVE_SEARCH_HEADERS, BASELINE_BODY),
        });
        const pacing = h.governor.pacing;
        const lanePolicies = pacing.lanePolicies;

        await h.search();
        expect(h.lines).toEqual(['authenticated']);
        expect(Object.keys(pacing.ledger)).not.toHaveLength(0);

        const fetched = await h.fetch();

        expect(fetched).toMatchObject({ kind: 'yield', reason: 'session-expired', retryAfterMs: 0 });
        expect(fetched.kind === 'yield' && fetched.response).toBeUndefined();
        expect(fetched.kind === 'yield' && penaltyRetryAfterMs(fetched)).toBeUndefined();
        expect(fetched.invalidRequests).toBe(0);
        expect(h.lines).toEqual(['authenticated', 'unauthenticated (expired)']);
        expect(h.holder.state).toEqual({ kind: 'unauthenticated', reason: 'expired' });
        expect(h.holder.pendingHoldOff()).toBe('write');
        // Cold, in place: the same object and the same lane memo.
        expect(h.governor.pacing).toBe(pacing);
        expect(pacing.lanePolicies).toBe(lanePolicies);
        expect(pacing.ledger).toEqual({});
        expect(lanePolicies.size).toBe(0);
        // The 403 or 401 was not counted: threshold 1 is not reached.
        const again = await h.search();
        expect(again.kind).toBe('response');
        expect(again.invalidRequests).toBe(0);
        await h.fetch();

        const cookies = httpOf(h.sent).map((entry) => entry.cookie);
        expect(cookies).toEqual([undefined, COOKIE, undefined, undefined]);
        expect(probesOf(h.sent)).toHaveLength(1);
        expect(h.lines).toHaveLength(2);
      },
    );

    it('a downgrade on a cookie search: the same yield, and the search answer is discarded', async () => {
      const h = probeHarness({ cookieAnswer: () => response(403, {}, 'blocked') });

      await h.search();
      const searched = await h.search();

      expect(searched).toMatchObject({ kind: 'yield', reason: 'session-expired' });
      expect(searched.kind === 'yield' && searched.response).toBeUndefined();
      expect(h.lines).toEqual(['authenticated', 'unauthenticated (expired)']);
    });

    it('still live: no line, and the answer is used', async () => {
      const h = probeHarness();

      await h.search();
      const fetched = await h.fetch();

      expect(fetched.kind === 'response' && fetched.response.status).toBe(200);
      expect(h.lines).toEqual(['authenticated']);
      expect(h.holder.state).toEqual({ kind: 'authenticated' });
    });

    it.each([
      ['fewer rule names than the baseline', { 'x-rate-limit-policy': FETCH_POLICY }],
      ['as many rule names as the baseline', { ...CLEAR_SEARCH_HEADERS, 'x-rate-limit-policy': FETCH_POLICY }],
      ['no policy header', {}],
    ])(
      'a cookie fetch 2xx under another policy, %s: not tested, no downgrade, and the answer is used',
      async (_label, headers) => {
        const h = probeHarness({
          cookieAnswer: (request) =>
            request.method === 'GET'
              ? response(200, headers, '{"result":[]}')
              : response(200, LIVE_SEARCH_HEADERS, BASELINE_BODY),
        });

        await h.search();
        const fetched = await h.fetch();

        expect(fetched.kind === 'response' && fetched.response.status).toBe(200);
        expect(h.lines).toEqual(['authenticated']);
        expect(h.holder.state).toEqual({ kind: 'authenticated' });
        expect(h.holder.pendingHoldOff()).toBe('clear');
      },
    );

    it('a not-live cookie search after a fetch under another policy: the search downgrades', async () => {
      let searches = 0;
      const h = probeHarness({
        cookieAnswer: (request) => {
          if (request.method === 'GET') {
            return response(200, { 'x-rate-limit-policy': FETCH_POLICY }, '{"result":[]}');
          }
          searches += 1;
          return response(200, searches === 1 ? LIVE_SEARCH_HEADERS : NOT_LIVE_HEADERS, BASELINE_BODY);
        },
      });

      await h.search();
      await h.fetch();
      await h.search();
      const searched = await h.search();

      expect(searched).toMatchObject({ kind: 'yield', reason: 'session-expired' });
      expect(h.lines).toEqual(['authenticated', 'unauthenticated (expired)']);
    });

    it.each([
      ['a 429', response(429, { ...LIVE_SEARCH_HEADERS, 'retry-after': '30' }), 'yield'],
      ['a 503', response(503, {}, 'busy'), 'response'],
      ['a 404', response(404, LIVE_SEARCH_HEADERS, 'gone'), 'response'],
    ])('%s on a cookie request stays ordinary: no downgrade', async (_label, answer, kind) => {
      const h = probeHarness({
        cookieAnswer: (request) =>
          request.method === 'GET' ? answer : response(200, LIVE_SEARCH_HEADERS, BASELINE_BODY),
      });

      await h.search();
      const fetched = await h.fetch();

      expect(fetched.kind).toBe(kind);
      expect(fetched.kind === 'yield' ? fetched.reason : undefined).not.toBe('session-expired');
      expect(h.lines).toEqual(['authenticated']);
      expect(h.holder.state).toEqual({ kind: 'authenticated' });
    });

    it('a later governor over the expired holder sends no cookie and no probe', async () => {
      const h = probeHarness({
        cookieAnswer: (request) =>
          request.method === 'GET' ? response(401, {}) : response(200, LIVE_SEARCH_HEADERS, BASELINE_BODY),
      });
      await h.search();
      await h.fetch();

      const probe = createFakeHttpPort({});
      const http = createFakeHttpPort({
        [`POST ${SEARCH_URL}`]: response(200, CLEAR_SEARCH_HEADERS, BASELINE_BODY),
        [`GET ${FETCH_URL}`]: response(200, {}, '{"result":[]}'),
      });
      const next = createTradeGovernor({
        http: { pricing: http },
        clock: createFakeClockPort(NOW),
        wait: recordingWait().wait,
        userAgent: CONTACT,
        auth: { holder: h.holder, probe },
      });
      await next.clients.pricing.send({ method: 'POST', url: SEARCH_URL, body: BODY, cookieEligible: true });
      await next.clients.pricing.send({ method: 'GET', url: FETCH_URL, cookieEligible: true });

      expect(probe.requests).toEqual([]);
      expect(http.requests.every((request) => request.headers['cookie'] === undefined)).toBe(true);
      expect(h.lines).toEqual(['authenticated', 'unauthenticated (expired)']);
    });
  });
});

describe('resetPacingState (§13.4)', () => {
  it('empties the ledger and the lane memo of the same object', () => {
    const pacing = createPacingState();
    pacing.ledger = { [SEARCH_POLICY]: { policy: SEARCH_POLICY, observedAt: NOW, rules: [] } };
    pacing.lanePolicies.set('search', SEARCH_POLICY);
    const memo = pacing.lanePolicies;

    resetPacingState(pacing);

    expect(pacing.ledger).toEqual({});
    expect(pacing.lanePolicies).toBe(memo);
    expect(memo.size).toBe(0);
  });
});
