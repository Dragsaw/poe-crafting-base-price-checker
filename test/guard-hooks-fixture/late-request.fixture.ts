import { it } from 'vitest';

import { INNOCENT_TEST, LATE_ISSUER, LATE_URL, OWN_TEST, OWN_URL } from './names';

/**
 * Run only by `test/guard-hooks.test.ts`, in a child Vitest with the real
 * `test/setup.ts`. The root `include` does not match this file, so the suite
 * never runs it directly: two of its outcomes are deliberate failures.
 */

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
  await fetch(OWN_URL);
});

it(LATE_ISSUER, () => {
  setTimeout(() => {
    void gate.promise
      .then(() => fetch(LATE_URL))
      .finally(() => {
        settled.resolve();
      });
  }, 0);
});

it(INNOCENT_TEST, async () => {
  gate.resolve();
  await settled.promise;
});
