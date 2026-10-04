import { createFakeClockPort, createFakeHttpPort } from '@poe/contracts';
import { expect, it } from 'vitest';

import { createTradeClient } from './client.ts';
import { CONTACT, DATA_URL, FETCH_URL, harness, NOW, recordingWait, response, SEARCH_URL } from './client/test-support.ts';
import { USER_AGENT_ENV_VAR } from './user-agent.ts';

/** Every rule name, policy name and bucket figure here is a fixture of a live response (2026-09-12), never compiled in. */

const SEARCH_POLICY = 'trade-search-request-limit';
const FETCH_POLICY = 'trade-fetch-request-limit';

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

  // The ledger keys on the policy value, not the lane, so this lane paces off the first one's
  // consumption; the `Client` rule survives although this response named only `Ip`.
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
