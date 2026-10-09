import { createFakeClockPort, createFakeHttpPort } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import {
  createPacingState,
  createTradeClient,
  createTradeClients,
  createTradeGovernor,
  laneDelayMs,
  resetPacingState,
} from '../client.ts';
import type { TradeClient } from '../client.ts';
import { MissingUserAgentError } from '../user-agent.ts';
import { CONTACT, DATA_URL, harness, NOW, recordingWait, response, SEARCH_URL } from './test-support.ts';

const SEARCH_POLICY = 'trade-search-request-limit';

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

// The governor and its shared pacing state (AD-8).
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

  const sendTwice = async (client: TradeClient): Promise<void> => {
    await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
    await client.send({ method: 'POST', url: SEARCH_URL, lane: 'search' });
  };
  await Promise.all([sendTwice(spreadGovernor.clients.only), sendTwice(batchClients.only)]);

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

describe('resetPacingState', () => {
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
