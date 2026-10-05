import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fetchAndSwallow } from '../fetch-and-swallow';
import { drainEscapedRequests } from '../setup';
import { HOOK_URLS, SUITE_ONE_TEST, SUITE_TWO_TEST } from './names';

// Run only by `test/guard-linger.test.ts` in a child Vitest (the root `include` skips it); the file
// fails on purpose. Each hook below belongs to no test, so a store lingering from the last test
// would wrongly charge the hook's request to it: the guard must report it as outside any test.
describe('suite one', () => {
  it(SUITE_ONE_TEST, () => {
    expect(drainEscapedRequests()).toEqual([]);
  });
  afterAll(() => fetchAndSwallow(HOOK_URLS.suiteOneAfterAll));
});

describe('suite two', () => {
  beforeAll(() => fetchAndSwallow(HOOK_URLS.suiteTwoBeforeAll));
  it(SUITE_TWO_TEST, () => {
    expect(drainEscapedRequests()).toEqual([]);
  });
});

// Registered after the setup file's `afterAll`. The child config sets
// `sequence.hooks: 'stack'`, so it runs first and the setup check sees its request.
afterAll(() => fetchAndSwallow(HOOK_URLS.fileAfterAll));
