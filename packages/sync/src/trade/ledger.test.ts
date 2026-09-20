import { expect, it } from 'vitest';

import {
  derivedYieldDelayMs,
  EMPTY_LEDGER,
  paceBeforeNext,
  recordObservation,
} from './ledger.ts';
import { parseRateLimitHeaders } from './rate-limit-headers.ts';

const SEARCH_POLICY = 'trade-search-request-limit';
const FETCH_POLICY = 'trade-fetch-request-limit';

const AT = '2026-09-20T12:00:00.000Z';

function ledgerFrom(
  headers: Readonly<Record<string, string>>,
  observedAt: string = AT,
): ReturnType<typeof recordObservation> {
  return recordObservation(EMPTY_LEDGER, parseRateLimitHeaders(headers), observedAt);
}

// I/O matrix: cold start.
it('asks for no delay when nothing has been observed for the policy', () => {
  expect(paceBeforeNext(EMPTY_LEDGER, SEARCH_POLICY, AT).delayMs).toBe(0);
  expect(paceBeforeNext(EMPTY_LEDGER, undefined, AT).delayMs).toBe(0);
});

it('leaves the ledger untouched when a response named no policy', () => {
  expect(recordObservation(EMPTY_LEDGER, parseRateLimitHeaders({}), AT)).toBe(EMPTY_LEDGER);
});

it('leaves the ledger untouched when every named rule was skipped', () => {
  const ledger = recordObservation(
    EMPTY_LEDGER,
    parseRateLimitHeaders({
      'x-rate-limit-policy': SEARCH_POLICY,
      'x-rate-limit-rules': 'Ip',
      'x-rate-limit-ip': 'banana',
      'x-rate-limit-ip-state': '1:10:0',
    }),
    AT,
  );

  expect(ledger).toBe(EMPTY_LEDGER);
});

it('asks for no delay while the allowance still has room', () => {
  const ledger = ledgerFrom({
    'x-rate-limit-policy': SEARCH_POLICY,
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': '5:10:60',
    'x-rate-limit-ip-state': '4:10:0',
  });

  expect(paceBeforeNext(ledger, SEARCH_POLICY, AT).delayMs).toBe(0);
});

// I/O matrix: tightest bucket governs.
it('waits out the tightest unsatisfied bucket across every rule in the policy', () => {
  const ledger = ledgerFrom({
    'x-rate-limit-policy': SEARCH_POLICY,
    'x-rate-limit-rules': 'Ip,Client',
    // Ip has room on its short bucket and is saturated on its long one.
    'x-rate-limit-ip': '5:10:60,15:60:300',
    'x-rate-limit-ip-state': '4:10:0,15:60:0',
    // Client is saturated on a window tighter still than 60s? No — it is
    // WIDER, at 300s, and therefore the one that governs. "Tightest" is the
    // bucket that makes you wait longest, not the one with the smallest window.
    'x-rate-limit-client': '30:300:1800',
    'x-rate-limit-client-state': '30:300:0',
  });

  const decision = paceBeforeNext(ledger, SEARCH_POLICY, AT);

  expect(decision.delayMs).toBe(300_000);
  expect(decision.rule).toBe('Client');
  expect(decision.cause).toBe('window');
  expect(decision.bucket).toEqual({ hits: 30, seconds: 300, penalty: 1800 });
});

it('counts the time already elapsed since the observation against the wait', () => {
  const ledger = ledgerFrom({
    'x-rate-limit-policy': SEARCH_POLICY,
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': '5:10:60',
    'x-rate-limit-ip-state': '5:10:0',
  });

  expect(paceBeforeNext(ledger, SEARCH_POLICY, '2026-09-20T12:00:04.000Z').delayMs).toBe(6000);
  // Past the window, the bucket is satisfied again with no new observation.
  expect(paceBeforeNext(ledger, SEARCH_POLICY, '2026-09-20T12:00:11.000Z').delayMs).toBe(0);
});

it('waits out a penalty the state reports, whatever the consumption says', () => {
  const ledger = ledgerFrom({
    'x-rate-limit-policy': SEARCH_POLICY,
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': '5:10:60',
    'x-rate-limit-ip-state': '1:10:45',
  });

  const decision = paceBeforeNext(ledger, SEARCH_POLICY, AT);

  expect(decision.delayMs).toBe(45_000);
  expect(decision.cause).toBe('penalty');
});

it('treats an unparseable instant as no elapsed time rather than as NaN', () => {
  const ledger = ledgerFrom(
    {
      'x-rate-limit-policy': SEARCH_POLICY,
      'x-rate-limit-rules': 'Ip',
      'x-rate-limit-ip': '5:10:60',
      'x-rate-limit-ip-state': '5:10:0',
    },
    'not-an-instant',
  );

  expect(paceBeforeNext(ledger, SEARCH_POLICY, AT).delayMs).toBe(10_000);
});

// I/O matrix: policies do not cross.
it('keeps a ledger per policy, so one bucket never paces the other', () => {
  let ledger = ledgerFrom({
    'x-rate-limit-policy': SEARCH_POLICY,
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': '5:10:60',
    'x-rate-limit-ip-state': '5:10:0',
  });
  ledger = recordObservation(
    ledger,
    parseRateLimitHeaders({
      'x-rate-limit-policy': FETCH_POLICY,
      'x-rate-limit-rules': 'Ip',
      'x-rate-limit-ip': '12:4:10',
      'x-rate-limit-ip-state': '1:4:0',
    }),
    AT,
  );

  expect(paceBeforeNext(ledger, SEARCH_POLICY, AT).delayMs).toBe(10_000);
  expect(paceBeforeNext(ledger, FETCH_POLICY, AT).delayMs).toBe(0);
});

it('derives a yield delay from the penalty of the bucket that was overspent', () => {
  const ledger = ledgerFrom({
    'x-rate-limit-policy': SEARCH_POLICY,
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': '5:10:60,15:60:300',
    'x-rate-limit-ip-state': '5:10:0,6:60:0',
  });

  expect(derivedYieldDelayMs(ledger, SEARCH_POLICY)).toBe(60_000);
});

it('falls back to the largest declared penalty when no bucket is visibly overspent', () => {
  const ledger = ledgerFrom({
    'x-rate-limit-policy': SEARCH_POLICY,
    'x-rate-limit-rules': 'Ip',
    'x-rate-limit-ip': '5:10:60,15:60:300',
    'x-rate-limit-ip-state': '1:10:0,1:60:0',
  });

  expect(derivedYieldDelayMs(ledger, SEARCH_POLICY)).toBe(300_000);
});

it('derives nothing for a policy it has never observed', () => {
  expect(derivedYieldDelayMs(EMPTY_LEDGER, SEARCH_POLICY)).toBe(0);
  expect(derivedYieldDelayMs(EMPTY_LEDGER, undefined)).toBe(0);
});
