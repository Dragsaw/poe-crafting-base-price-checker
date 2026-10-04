import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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

  // This calls the guard's no-owner branch, the one the setup file's `afterAll`
  // runs. The real `afterEach` takes the owner branch, which the owner-path test
  // below and `test/guard-hooks.test.ts` cover. Calling it directly is what
  // proves this failing branch is reachable: delete its throw and this fails.
  expect(() => {
    assertNoEscapedRequests();
  }).toThrow(UNROUTABLE_URL);

  // It drained on the way out, so the real `afterEach` finds nothing.
  expect(drainEscapedRequests()).toEqual([]);
});

// A late request: test A starts it in a timer and does not await it, and MSW
// records it while test B runs. B must not be blamed; the file-level check must
// name A. The two tests run in file order and share this state.
const LATE_URL = 'https://unrouted.invalid/api/trade2/fetch/late';
const LATE_ISSUER = 'issues an unfixtured request from a timer it does not await';
let releaseLateRequest: () => void = () => {};
let lateRequestSettled: Promise<void> = Promise.resolve();

it(LATE_ISSUER, () => {
  const gate = new Promise<void>((resolve) => {
    releaseLateRequest = resolve;
  });
  let settle: () => void = () => {};
  lateRequestSettled = new Promise<void>((resolve) => {
    settle = resolve;
  });
  // The timer is scheduled here, so its callback carries this test's identity.
  // The request starts only when B opens the gate, after this test has ended.
  setTimeout(() => {
    void gate
      .then(() => fetch(LATE_URL))
      .finally(() => {
        settle();
      });
  }, 0);
});

it('does not charge a late request to the test running when it settles', async ({ task }) => {
  releaseLateRequest();
  await lateRequestSettled;

  // B's drain takes only B's requests. A's late request stays recorded, so a
  // draining test cannot swallow it.
  expect(drainEscapedRequests()).toEqual([]);

  // B's own guard finds nothing: the request is A's.
  expect(() => {
    assertNoEscapedRequests(task);
  }).not.toThrow();

  // The file-level check finds it, and names both the URL and A.
  let message = '';
  try {
    assertNoEscapedRequests();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  expect(message).toContain(`GET ${LATE_URL}`);
  expect(message).toContain(`issued by test "${LATE_ISSUER}"`);

  // It drained on the way out, so the real hooks find nothing.
  expect(drainEscapedRequests()).toEqual([]);
});

it("fails a test's own guard for a request it issued", async ({ task }) => {
  await fetch(UNROUTABLE_URL);

  // The path the real `afterEach` takes: an owner is given.
  expect(() => {
    assertNoEscapedRequests(task);
  }).toThrow(UNROUTABLE_URL);
  expect(drainEscapedRequests()).toEqual([]);
});

describe('a request recorded after the last afterEach of its test', () => {
  const AFTER_LAST_URL = 'https://unrouted.invalid/api/trade2/fetch/after-last';
  const AFTER_LAST_ISSUER = 'issues a request that settles after its afterEach';
  let release: () => void = () => {};
  let settled: Promise<void> = Promise.resolve();

  it(AFTER_LAST_ISSUER, () => {
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    settled = gate.then(async () => {
      await fetch(AFTER_LAST_URL);
    });
  });

  // Runs after the test's `afterEach`, which found nothing, and before the
  // setup file's `afterAll`, which would otherwise be the one to report it.
  afterAll(async () => {
    release();
    await settled;
    expect(() => {
      assertNoEscapedRequests();
    }).toThrow(`GET ${AFTER_LAST_URL} (issued by test "${AFTER_LAST_ISSUER}")`);
  });
});

describe('a request issued outside any test', () => {
  const OUTSIDE_URL = 'https://unrouted.invalid/api/trade2/fetch/outside';
  let message = '';

  // Earlier tests in this file have run, so this also shows that their
  // identity does not linger into a nested suite's `beforeAll`. It does not
  // show this for a file-level `afterAll` (see the spec's deferred list).
  beforeAll(async () => {
    await fetch(OUTSIDE_URL);
    try {
      assertNoEscapedRequests();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
  });

  it('is named as issued outside any test', () => {
    expect(message).toContain(`GET ${OUTSIDE_URL} (issued outside any test)`);
  });
});
