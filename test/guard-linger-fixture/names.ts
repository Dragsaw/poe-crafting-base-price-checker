// Shared by the fixture and `test/guard-linger.test.ts`; separate because importing the fixture
// would register its tests in the parent. Every URL is under `.invalid` (RFC 2606).
export const SUITE_ONE_TEST = 'suite one: test';
export const SUITE_TWO_TEST = 'suite two: test';

export const TEST_TITLES = [SUITE_ONE_TEST, SUITE_TWO_TEST] as const;

/** One URL for each hook that belongs to no test, keyed by that hook. */
export const HOOK_URLS = {
  suiteOneAfterAll: 'https://unrouted.invalid/api/trade2/fetch/suite-one-after-all',
  suiteTwoBeforeAll: 'https://unrouted.invalid/api/trade2/fetch/suite-two-before-all',
  fileAfterAll: 'https://unrouted.invalid/api/trade2/fetch/file-after-all',
} as const;
