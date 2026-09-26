import { createFakeClockPort, createFakeHttpPort } from '@poe/contracts';
import type { HttpResponse } from '@poe/contracts';
import { expect, it } from 'vitest';

import { createTradeClient } from './client.ts';
import { USER_AGENT_ENV_VAR } from './user-agent.ts';

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
  expect(() => build('   ')).toThrow(USER_AGENT_ENV_VAR);
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
