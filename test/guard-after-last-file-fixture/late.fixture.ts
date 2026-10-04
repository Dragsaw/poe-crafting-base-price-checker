import { it } from 'vitest';

import { fetchAndSwallow } from '../fetch-and-swallow';
import { DELAY_ENV, ISSUER_TEST, LATE_URL } from './names';

/**
 * Run only by `test/guard-after-last-file.test.ts`, in a child Vitest with the
 * real `test/setup.ts` and `test/global-setup.ts`. The root `include` does not
 * match this file.
 *
 * This is the only file of its worker. A 0 ms timer fires after the setup
 * file's `afterAll` and before the worker ends. The rejection is swallowed, so
 * only the guard's record can report the request.
 */
const delay = Number(process.env[DELAY_ENV] ?? '0');

it(ISSUER_TEST, () => {
  setTimeout(() => {
    void fetchAndSwallow(LATE_URL);
  }, delay);
});
