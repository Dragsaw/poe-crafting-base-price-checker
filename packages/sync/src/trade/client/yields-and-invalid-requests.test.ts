import { createFakeClockPort, createFakeHttpPort } from '@poe/contracts';
import { expect, it } from 'vitest';

import { createTradeClient } from '../client.ts';
import { CONTACT, DATA_URL, FETCH_URL, harness, NOW, recordingWait, response, SEARCH_URL } from './test-support.ts';

/** Every rule, policy and bucket figure is a fixture of a live response (2026-09-12). */

const SEARCH_POLICY = 'trade-search-request-limit';
const FETCH_POLICY = 'trade-fetch-request-limit';

const CLEAR_SEARCH_HEADERS = {
  'x-rate-limit-policy': SEARCH_POLICY,
  'x-rate-limit-rules': 'Ip',
  'x-rate-limit-ip': '5:10:60',
  'x-rate-limit-ip-state': '1:10:0',
};

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
    // eslint-disable-next-line no-await-in-loop -- sequential on purpose: each refusal must reach the governor before the next send
    await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  }

  expect(http.requests).toHaveLength(3);
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
  expect(parsedNothing.kind === 'yield' ? parsedNothing.retryAfterMs : undefined).toBeGreaterThan(0);

  // And a 429 carrying no governance headers at all still yields a real delay.
  const noHeaders = await client.send({ method: 'GET', url: DATA_URL, lane: 'data' });
  expect(noHeaders.kind).toBe('yield');
  expect(noHeaders.kind === 'yield' ? noHeaders.retryAfterMs : undefined).toBeGreaterThan(0);
});
