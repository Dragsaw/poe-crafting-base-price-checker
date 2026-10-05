import { createFakeClockPort, createFakeHttpPort } from '@poe/contracts';
import { expect, it } from 'vitest';

import { createTradeClient } from '../client.ts';
import { CONTACT, NOW, recordingWait, response, SEARCH_URL } from './test-support.ts';

const SEARCH_POLICY = 'trade-search-request-limit';

const CLEAR_SEARCH_HEADERS = {
  'x-rate-limit-policy': SEARCH_POLICY,
  'x-rate-limit-rules': 'Ip',
  'x-rate-limit-ip': '5:10:60',
  'x-rate-limit-ip-state': '1:10:0',
};

// The 429 operator line: the response's governance headers beside the reading the wait used.
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
