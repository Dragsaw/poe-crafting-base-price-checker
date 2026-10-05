import { expect, it } from 'vitest';

import { drainEscapedRequests } from '../setup';
import { INNOCENT_TEST, LATE_ISSUER, LATE_URL, OWN_TEST, OWN_URL } from './names';

// Run only by `test/guard-hooks.test.ts` in a child Vitest (the root `include` skips it): two of
// its outcomes are deliberate failures.

const noop = (): void => {};

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = noop;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

const gate = deferred();
const settled = deferred();

it(OWN_TEST, async () => {
  const response = await fetch(OWN_URL);
  expect(response.ok).toBe(false);
});

it(LATE_ISSUER, () => {
  setTimeout(() => {
    void gate.promise
      .then(() => fetch(LATE_URL))
      .finally(() => {
        settled.resolve();
      });
  }, 0);
  expect(drainEscapedRequests()).toEqual([]);
});

it(INNOCENT_TEST, async () => {
  gate.resolve();
  await expect(settled.promise).resolves.toBeUndefined();
});
