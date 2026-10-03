import { describe, expect, it } from 'vitest';

import { parseRateLimitHeaders, ruleNameCount } from './rate-limit-headers.ts';

/**
 * The rule names below appear **only here**. They are what a live response
 * happened to carry on 2026-09-12, asserted as an expected shape; no
 * non-test module in this repository names a rule, a policy or a rate.
 */
const SEARCH_POLICY = 'trade-search-request-limit';

it('learns every rule named in the rules header, by name, at runtime', () => {
  const parsed = parseRateLimitHeaders({
    'x-rate-limit-policy': SEARCH_POLICY,
    'x-rate-limit-rules': 'Ip,Client',
    'x-rate-limit-ip': '5:10:60,15:60:300',
    'x-rate-limit-ip-state': '4:10:0,9:60:0',
    'x-rate-limit-client': '8:10:60',
    'x-rate-limit-client-state': '1:10:0',
  });

  expect(parsed.policy).toBe(SEARCH_POLICY);
  expect(parsed.skips).toEqual([]);
  expect(parsed.rules.map((rule) => rule.name)).toEqual(['Ip', 'Client']);

  // Positional pairing: state[i] is the consumption of buckets[i].
  const [ip] = parsed.rules;
  expect(ip?.buckets).toEqual([
    { hits: 5, seconds: 10, penalty: 60 },
    { hits: 15, seconds: 60, penalty: 300 },
  ]);
  expect(ip?.state).toEqual([
    { hits: 4, seconds: 10, penalty: 0 },
    { hits: 9, seconds: 60, penalty: 0 },
  ]);
});

it('reads header names case-insensitively, as every adapter compares them', () => {
  const parsed = parseRateLimitHeaders({
    'X-Rate-Limit-Policy': SEARCH_POLICY,
    'X-Rate-Limit-Rules': 'Ip',
    'X-Rate-Limit-Ip': '5:10:60',
    'X-Rate-Limit-Ip-State': '1:10:0',
  });

  expect(parsed.policy).toBe(SEARCH_POLICY);
  expect(parsed.rules).toHaveLength(1);
  expect(parsed.skips).toEqual([]);
});

// I/O matrix: a named rule's headers absent.
it('skips a named rule whose policy header never arrived, and keeps the others', () => {
  const parsed = parseRateLimitHeaders({
    'x-rate-limit-policy': SEARCH_POLICY,
    'x-rate-limit-rules': 'Ip,Client',
    'x-rate-limit-ip': '5:10:60',
    'x-rate-limit-ip-state': '1:10:0',
  });

  expect(parsed.rules.map((rule) => rule.name)).toEqual(['Ip']);
  expect(parsed.skips).toEqual([
    { rule: 'Client', reason: 'policy-header-absent', detail: expect.any(String) as string },
  ]);
});

it('skips a named rule whose state header never arrived', () => {
  const parsed = parseRateLimitHeaders({
    'x-rate-limit-rules': 'Client',
    'x-rate-limit-client': '5:10:60',
  });

  expect(parsed.rules).toEqual([]);
  expect(parsed.skips[0]?.reason).toBe('state-header-absent');
});

// I/O matrix: malformed policy header.
it('skips a malformed policy header rather than parsing it into NaN', () => {
  const parsed = parseRateLimitHeaders({
    'x-rate-limit-policy': SEARCH_POLICY,
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': 'banana',
    'x-rate-limit-ip-state': '1:10:0',
  });

  expect(parsed.rules).toEqual([]);
  expect(parsed.skips[0]?.reason).toBe('policy-header-malformed');
  expect(parsed.skips[0]?.detail).toContain('banana');
});

it('skips a malformed state header too', () => {
  const parsed = parseRateLimitHeaders({
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': '5:10:60',
    'x-rate-limit-ip-state': '4:10',
  });

  expect(parsed.rules).toEqual([]);
  expect(parsed.skips[0]?.reason).toBe('state-header-malformed');
});

it('skips a rule whose two headers disagree on how many buckets there are', () => {
  const parsed = parseRateLimitHeaders({
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': '5:10:60,15:60:300',
    'x-rate-limit-ip-state': '4:10:0',
  });

  expect(parsed.rules).toEqual([]);
  expect(parsed.skips[0]?.reason).toBe('bucket-count-mismatch');
});

it('reports no policy and no rule when the response carried no governance headers', () => {
  expect(parseRateLimitHeaders({ 'content-type': 'application/json' })).toEqual({
    policy: undefined,
    rules: [],
    skips: [],
  });
});

it('ignores blank and repeated names in the rules header', () => {
  const parsed = parseRateLimitHeaders({
    'x-rate-limit-rules': ' Ip , , ip ',
    'x-rate-limit-ip': '5:10:60',
    'x-rate-limit-ip-state': '1:10:0',
  });

  expect(parsed.rules.map((rule) => rule.name)).toEqual(['Ip']);
  expect(parsed.skips).toEqual([]);
});

it('matches the measured 2026-09-12 shape without compiling any of it in', () => {
  // IMPLEMENTATION-NOTES.md §5.3 records these buckets as the expected shape.
  // The assertion lives in a test precisely so the numbers are never a
  // constant the client could pace from.
  const parsed = parseRateLimitHeaders({
    'x-rate-limit-policy': SEARCH_POLICY,
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': '5:10:60,15:60:300,30:300:1800,600:21600:3600',
    'x-rate-limit-ip-state': '1:10:0,1:60:0,1:300:0,1:21600:0',
  });

  expect(parsed.rules[0]?.buckets).toHaveLength(4);
  expect(parsed.rules[0]?.buckets.at(-1)).toEqual({ hits: 600, seconds: 21600, penalty: 3600 });
});

describe('ruleNameCount (IMPLEMENTATION-NOTES.md §13.2)', () => {
  it.each([
    [{}, 0],
    [{ 'x-rate-limit-rules': '' }, 0],
    [{ 'x-rate-limit-rules': 'Ip' }, 1],
    [{ 'X-Rate-Limit-Rules': 'Ip,Account' }, 2],
    [{ 'x-rate-limit-rules': ' Ip , ip ,, IP,Account ' }, 2],
    [{ 'x-rate-limit-rules': ' , ,' }, 0],
  ])('%j names %i distinct rule(s)', (headers, count) => {
    expect(ruleNameCount(headers)).toBe(count);
  });
});
