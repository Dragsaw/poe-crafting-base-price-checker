import { describe, it } from 'vitest';

import { DESCRIBE_FIRST, DESCRIBE_SECOND, IT_FIRST, IT_SECOND } from './names';

/**
 * Run only by `test/guard-concurrent.test.ts`, in a child Vitest with the real
 * `test/setup.ts`. The root `include` does not match this file, so the suite
 * never runs it directly: each of its tests fails on purpose.
 *
 * The `describe.concurrent` suite and the top-level `it.concurrent` pair may run
 * at the same time. Each test still meets only its own partner at its barrier,
 * and neither test of a pair sends its request before both have arrived. So
 * both `beforeEach` hooks of the pair have run, and the last `enterWith` need
 * not belong to the issuing test, when each request is recorded.
 *
 * After the barrier, each test starts its fetch from a `setTimeout` callback and
 * does not await the fetch itself. It awaits a promise that settles when the
 * fetch settles. This is the un-awaited path that `AsyncLocalStorage` exists
 * for: the request must still be charged to the test that started the timer.
 */

/** Returns a function that resolves for each caller once `parties` callers have arrived. */
function barrier(parties: number): () => Promise<void> {
  let arrived = 0;
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return () => {
    arrived += 1;
    if (arrived === parties) {
      open();
    }
    return opened;
  };
}

async function meetThenFetchFromTimer(meet: () => Promise<void>, url: string): Promise<void> {
  await meet();
  await new Promise<void>((settle) => {
    setTimeout(() => {
      // The rejection is swallowed: only the guard's `afterEach` may fail the test.
      void fetch(url)
        .catch(() => undefined)
        .finally(() => {
          settle();
        });
    }, 0);
  });
}

describe.concurrent('pair', () => {
  const meet = barrier(2);
  it(DESCRIBE_FIRST.title, () => meetThenFetchFromTimer(meet, DESCRIBE_FIRST.url));
  it(DESCRIBE_SECOND.title, () => meetThenFetchFromTimer(meet, DESCRIBE_SECOND.url));
});

const meet = barrier(2);
it.concurrent(IT_FIRST.title, () => meetThenFetchFromTimer(meet, IT_FIRST.url));
it.concurrent(IT_SECOND.title, () => meetThenFetchFromTimer(meet, IT_SECOND.url));
