import { expect, it } from 'vitest';

import {
  countInvalidRequest,
  invalidRequestsFor,
  isInvalidRequest,
  NO_INVALID_REQUESTS,
  isThresholdReached,
  UNGOVERNED_POLICY_KEY,
} from './invalid-requests.ts';

const SEARCH_POLICY = 'trade-search-request-limit';
const FETCH_POLICY = 'trade-fetch-request-limit';

it('counts every 4xx, not only the three the documentation names', () => {
  for (const status of [400, 401, 403, 404, 418, 429, 499]) {
    expect(isInvalidRequest(status), String(status)).toBe(true);
  }
  for (const status of [200, 204, 301, 399, 500, 503]) {
    expect(isInvalidRequest(status), String(status)).toBe(false);
  }
});

it('counts per policy, so one policy never spends another’s allowance', () => {
  let counts = countInvalidRequest(NO_INVALID_REQUESTS, SEARCH_POLICY);
  counts = countInvalidRequest(counts, SEARCH_POLICY);
  counts = countInvalidRequest(counts, FETCH_POLICY);

  expect(invalidRequestsFor(counts, SEARCH_POLICY)).toBe(2);
  expect(invalidRequestsFor(counts, FETCH_POLICY)).toBe(1);
  expect(invalidRequestsFor(NO_INVALID_REQUESTS, SEARCH_POLICY)).toBe(0);
});

it('still counts a response that named no policy', () => {
  const counts = countInvalidRequest(NO_INVALID_REQUESTS, undefined);

  expect(invalidRequestsFor(counts, undefined)).toBe(1);
  expect(counts[UNGOVERNED_POLICY_KEY]).toBe(1);
  // ...and it is not credited against a real policy.
  expect(invalidRequestsFor(counts, SEARCH_POLICY)).toBe(0);
});

it('reaches the threshold at the declared count, not one past it', () => {
  const one = countInvalidRequest(NO_INVALID_REQUESTS, SEARCH_POLICY);
  const two = countInvalidRequest(one, SEARCH_POLICY);

  expect(isThresholdReached(one, SEARCH_POLICY, 2)).toBe(false);
  expect(isThresholdReached(two, SEARCH_POLICY, 2)).toBe(true);
});

it('never refuses when no threshold was declared', () => {
  let counts = NO_INVALID_REQUESTS;
  for (let seen = 0; seen < 50; seen += 1) {
    counts = countInvalidRequest(counts, SEARCH_POLICY);
  }

  expect(isThresholdReached(counts, SEARCH_POLICY, undefined)).toBe(false);
  expect(invalidRequestsFor(counts, SEARCH_POLICY)).toBe(50);
});
