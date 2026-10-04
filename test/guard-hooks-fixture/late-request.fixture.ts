import { it } from 'vitest';

import { INNOCENT_TEST, LATE_ISSUER, LATE_URL, OWN_TEST, OWN_URL } from './names';

/**
 * Run only by `test/guard-hooks.test.ts`, in a child Vitest with the real
 * `test/setup.ts`. The root `include` does not match this file, so the suite
 * never runs it directly: two of its outcomes are deliberate failures.
 */

let releaseLateRequest: () => void = () => {};
let lateRequestSettled: Promise<void> = Promise.resolve();

it(OWN_TEST, async () => {
  await fetch(OWN_URL);
});

it(LATE_ISSUER, () => {
  const gate = new Promise<void>((resolve) => {
    releaseLateRequest = resolve;
  });
  let settle: () => void = () => {};
  lateRequestSettled = new Promise<void>((resolve) => {
    settle = resolve;
  });
  setTimeout(() => {
    void gate
      .then(() => fetch(LATE_URL))
      .finally(() => {
        settle();
      });
  }, 0);
});

it(INNOCENT_TEST, async () => {
  releaseLateRequest();
  await lateRequestSettled;
});
