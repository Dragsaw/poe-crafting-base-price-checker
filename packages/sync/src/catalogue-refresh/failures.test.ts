import { expect, it } from 'vitest';

import { catalogueFilePathOf } from '../catalogue-refresh.ts';
import {
  CAPTURED,
  capturedResponses,
  endpointFor,
  failureOf,
  harness,
} from './test-support.ts';

/** Room left in the bucket: nothing has to wait. */
const RATE_LIMIT_HEADERS = {
  'x-rate-limit-policy': 'trade-data-request-limit',
  'x-rate-limit-rules': 'Ip',
  'x-rate-limit-ip': '5:10:60',
  'x-rate-limit-ip-state': '1:10:0',
};

it('writes nothing at all when one endpoint answers a non-200 mid-run', async () => {
  const fixtures = capturedResponses(RATE_LIMIT_HEADERS);
  const failing = endpointFor('filters');
  fixtures[`GET ${failing.url}`] = {
    status: 503,
    headers: RATE_LIMIT_HEADERS,
    body: 'upstream is unwell',
  };
  const instance = harness(fixtures);

  const outcome = await instance.refresh();

  const failed = failureOf(outcome);
  expect(failed.failure).toContain(failing.artifact);
  expect(failed.failure).toContain('503');
  expect(failed.written).toEqual([]);
  expect(instance.writes).toEqual([]);
});

it('returns a failure naming the yield rather than throwing when rate limited', async () => {
  const fixtures = capturedResponses(RATE_LIMIT_HEADERS);
  const limited = endpointFor('items');
  fixtures[`GET ${limited.url}`] = {
    status: 429,
    headers: { ...RATE_LIMIT_HEADERS, 'retry-after': '43' },
    body: '{}',
  };
  const instance = harness(fixtures);

  const outcome = await instance.refresh();

  const failed = failureOf(outcome);
  expect(failed.failure).toContain('rate limited');
  expect(failed.failure).toContain('43000');
  expect(failed.failure).toContain('retry-after-header');
  expect(instance.writes).toEqual([]);
});

it('names the artifact when a 200 carries an HTML interstitial', async () => {
  const fixtures = capturedResponses(RATE_LIMIT_HEADERS);
  const html = endpointFor('stats');
  fixtures[`GET ${html.url}`] = {
    status: 200,
    headers: RATE_LIMIT_HEADERS,
    body: '<!doctype html><title>maintenance</title>',
  };
  const instance = harness(fixtures);

  const outcome = await instance.refresh();

  const failed = failureOf(outcome);
  expect(failed.failure).toContain(html.artifact);
  expect(failed.failure).toContain('not JSON');
  expect(instance.writes).toEqual([]);
});

it('names the artifact and the first issue path when a payload is schema-invalid', async () => {
  const stats = CAPTURED['stats'] as { result: { entries: unknown[] }[] };
  const firstGroup = stats.result[0];
  const invalid = {
    ...stats,
    result: [
      { ...firstGroup, entries: [{ text: '+#% to Fire Resistance', type: 'explicit' }] },
      ...stats.result.slice(1),
    ],
  };
  const instance = harness(capturedResponses(RATE_LIMIT_HEADERS, { stats: invalid }));

  const outcome = await instance.refresh();

  const failed = failureOf(outcome);
  expect(failed.failure).toContain('stats');
  expect(failed.failure).toContain('result.0.entries.0.id');
  expect(instance.writes).toEqual([]);
});

it('returns a failure naming the artifact when the request itself rejects', async () => {
  // A rejection, not a status: the real port rejects on abort, DNS failure and
  // socket reset. Without a catch the human gets a stack trace and no `written`.
  const fixtures = capturedResponses(RATE_LIMIT_HEADERS);
  const unreachable = endpointFor('stats');
  delete fixtures[`GET ${unreachable.url}`];
  const instance = harness(fixtures);

  const outcome = await instance.refresh();

  const failed = failureOf(outcome);
  expect(failed.failure).toContain(unreachable.artifact);
  expect(failed.failure).toContain('could not be reached');
  expect(failed.written).toEqual([]);
  expect(instance.writes).toEqual([]);
});

it('says how many artifacts landed when a write fails part way down', async () => {
  const refusedPath = catalogueFilePathOf(endpointFor('filters'));
  const instance = harness(capturedResponses(RATE_LIMIT_HEADERS), (path) => path === refusedPath);

  const outcome = await instance.refresh();

  const failed = failureOf(outcome);
  expect(failed.failure).toContain(refusedPath);
  // Two had already landed, so the tree is mixed and the message has to say so
  // — nothing here can roll a completed write back.
  expect(failed.failure).toContain('2 of 4');
  expect(failed.written).toEqual([
    catalogueFilePathOf(endpointFor('items')),
    catalogueFilePathOf(endpointFor('stats')),
  ]);
  expect(instance.writes).toHaveLength(2);
});
