import { it } from 'vitest';

import { fetchAndSwallow } from '../fetch-and-swallow';
import { ISSUER_TEST, LATE_URL } from './names';

/**
 * Run only by `test/guard-reuse.test.ts`, in a child Vitest with the real
 * `test/setup.ts` and a reused worker. The root `include` does not match this
 * file.
 *
 * The timer fires about 300 ms after the test, which is after this file's
 * `afterAll`, while `b-bystander.fixture.ts` is still importing. The rejection
 * is swallowed, so only the guard's record can report the request.
 */
it(ISSUER_TEST, () => {
  setTimeout(() => {
    void fetchAndSwallow(LATE_URL);
  }, 300);
});
