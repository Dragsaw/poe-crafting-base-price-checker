import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fetchAndSwallow } from '../fetch-and-swallow';
import { drainEscapedRequests } from '../setup';
import { HOOK_URLS, SUITE_ONE_TEST, SUITE_TWO_TEST } from './names';

/**
 * Run only by `test/guard-linger.test.ts`, in a child Vitest with the real
 * `test/setup.ts`. The root `include` does not match this file, so the suite
 * never runs it directly: the file fails on purpose.
 *
 * The setup `beforeEach` sets the current test with `enterWith`. Each hook
 * below belongs to no test and runs after a test has run, so a store that
 * lingered from that test would charge the hook's request to it. The guard
 * must report each request as issued outside any test.
 */
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
