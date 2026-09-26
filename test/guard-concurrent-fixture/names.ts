/**
 * Shared by the fixture and by `test/guard-concurrent.test.ts`. A separate
 * module, because importing the fixture itself would register its tests in the
 * parent.
 *
 * Every URL is under `.invalid` (RFC 2606), so nothing can reach a host.
 */
export const DESCRIBE_FIRST = {
  title: 'describe.concurrent: first test',
  url: 'https://unrouted.invalid/api/trade2/fetch/describe-first',
} as const;
export const DESCRIBE_SECOND = {
  title: 'describe.concurrent: second test',
  url: 'https://unrouted.invalid/api/trade2/fetch/describe-second',
} as const;
export const IT_FIRST = {
  title: 'it.concurrent: first test',
  url: 'https://unrouted.invalid/api/trade2/fetch/it-first',
} as const;
export const IT_SECOND = {
  title: 'it.concurrent: second test',
  url: 'https://unrouted.invalid/api/trade2/fetch/it-second',
} as const;

export const CONCURRENT_CASES = [DESCRIBE_FIRST, DESCRIBE_SECOND, IT_FIRST, IT_SECOND] as const;
