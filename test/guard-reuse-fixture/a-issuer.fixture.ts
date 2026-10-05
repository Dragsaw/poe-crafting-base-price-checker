import { expect, it } from 'vitest';

import { fetchAndSwallow } from '../fetch-and-swallow';
import { drainEscapedRequests } from '../setup';
import { ISSUER_TEST, LATE_URL } from './names';

// Run only by `test/guard-reuse.test.ts` in a child Vitest with a reused worker. The timer fires
// after this file's `afterAll`, while `b-bystander.fixture.ts` imports; the rejection is swallowed,
// so only the guard's record can report the request.
it(ISSUER_TEST, () => {
  setTimeout(() => {
    void fetchAndSwallow(LATE_URL);
  }, 300);
  expect(drainEscapedRequests()).toEqual([]);
});
