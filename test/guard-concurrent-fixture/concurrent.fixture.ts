import { describe, expect, it } from 'vitest';

import { DESCRIBE_FIRST, DESCRIBE_SECOND, IT_FIRST, IT_SECOND } from './names';

// Run only by `test/guard-concurrent.test.ts` in a child Vitest (the root `include` skips it);
// each test fails on purpose. A pair meets at a barrier before either sends, so both `beforeEach`
// hooks have run. Each fetch starts un-awaited from a timer: the path `AsyncLocalStorage` is for.

const PARTIES = 2;

/** Returns a function that resolves for each caller once both parties have arrived. */
function barrier(): () => Promise<void> {
  let arrived = 0;
  const { promise: opened, resolve: open } = Promise.withResolvers<void>();
  return () => {
    arrived += 1;
    if (arrived === PARTIES) {
      open();
    }
    return opened;
  };
}

/** Resolves with whether the blocked request was answered `ok`. */
async function didFetchSucceedAfterMeeting(meet: () => Promise<void>, url: string): Promise<boolean> {
  await meet();
  return new Promise<boolean>((settle) => {
    setTimeout(() => {
      // The rejection is swallowed: only the guard's `afterEach` may fail the test.
      void fetch(url)
        .then((response) => response.ok)
        .catch(() => false)
        .then(settle);
    }, 0);
  });
}

async function expectBlocked(meet: () => Promise<void>, url: string): Promise<void> {
  expect(await didFetchSucceedAfterMeeting(meet, url)).toBe(false);
}

describe.concurrent('pair', () => {
  const meet = barrier();
  it(DESCRIBE_FIRST.title, () => expectBlocked(meet, DESCRIBE_FIRST.url));
  it(DESCRIBE_SECOND.title, () => expectBlocked(meet, DESCRIBE_SECOND.url));
});

const meet = barrier();
it.concurrent(IT_FIRST.title, () => expectBlocked(meet, IT_FIRST.url));
it.concurrent(IT_SECOND.title, () => expectBlocked(meet, IT_SECOND.url));
