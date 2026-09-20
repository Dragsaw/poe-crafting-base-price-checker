import { expect, it } from 'vitest';

import { assertNoEscapedRequests, drainEscapedRequests } from './setup';

// `.invalid` is reserved and unroutable (RFC 2606): if the MSW setup ever fails
// to install, this test cannot reach anything, let alone the live trade API.
const UNROUTABLE_URL = 'https://unrouted.invalid/api/trade2/search/Standard';
const UNROUTABLE_JSON_URL = 'https://unrouted.invalid/api/trade2/data/items.json';

it('blocks an unfixtured request and records its URL', async () => {
  const response = await fetch(UNROUTABLE_URL, { method: 'POST' });

  // Drain before asserting, so the global guard does not also fail this test:
  // this test *is* the assertion on the guard.
  const escaped = drainEscapedRequests();

  // MSW turned the throw inside `onUnhandledRequest` into a synthetic response.
  // The request was answered inside the process and never left it.
  expect(response.ok).toBe(false);
  expect(escaped).toEqual([`POST ${UNROUTABLE_URL}`]);
});

it('blocks a remote request whose path ends .json', async () => {
  // The exemption is by origin, never by extension. This project's upstream
  // endpoints serve JSON, so an extension-keyed exemption would have waved
  // every one of them through to the live API.
  const response = await fetch(UNROUTABLE_JSON_URL);
  const escaped = drainEscapedRequests();

  expect(response.ok).toBe(false);
  expect(escaped).toEqual([`GET ${UNROUTABLE_JSON_URL}`]);
});

it('fails a test through the guard, naming every escaped URL', async () => {
  await fetch(UNROUTABLE_URL);

  // The guard `afterEach` runs. Calling it directly is what proves its failing
  // branch is reachable: delete the throw inside it and this assertion fails.
  expect(() => {
    assertNoEscapedRequests();
  }).toThrow(UNROUTABLE_URL);

  // It drained on the way out, so the real `afterEach` finds nothing.
  expect(drainEscapedRequests()).toEqual([]);
});
