import { expect, it } from 'vitest';

import { fetchAndSwallow } from '../fetch-and-swallow';
import { drainEscapedRequests } from '../setup';
import { DELAY_ENV, ISSUER_TEST, LATE_URL } from './names';

// Run only by `test/guard-after-last-file.test.ts` in a child Vitest (the root `include` skips it).
// The only file of its worker: a 0 ms timer fires after the setup `afterAll`, and the rejection is
// swallowed, so only the guard's record can report the request.
const delay = Number(process.env[DELAY_ENV] ?? '0');

it(ISSUER_TEST, () => {
  setTimeout(() => {
    void fetchAndSwallow(LATE_URL);
  }, delay);
  expect(drainEscapedRequests()).toEqual([]);
});
