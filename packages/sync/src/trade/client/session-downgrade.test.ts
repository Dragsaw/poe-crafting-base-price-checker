import { createFakeClockPort, createFakeHttpPort } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { createSessionAuth, SESSION_COOKIE_ENV_VAR } from '../session-auth.ts';
import { createTradeGovernor, penaltyRetryAfterMs } from '../client.ts';
import {
  BASELINE_BODY,
  BODY,
  CONTACT,
  createProbeHarness,
  FETCH_URL,
  httpOf,
  NOW,
  probesOf,
  recordingWait,
  response,
  SEARCH_URL,
} from './test-support.ts';
import type { ProbeOptions } from './test-support.ts';

const SEARCH_POLICY = 'trade-search-request-limit';
const FETCH_POLICY = 'trade-fetch-request-limit';

const CLEAR_SEARCH_HEADERS = {
  'x-rate-limit-policy': SEARCH_POLICY,
  'x-rate-limit-rules': 'Ip',
  'x-rate-limit-ip': '5:10:60',
  'x-rate-limit-ip-state': '1:10:0',
};

describe('the session probe (AD-30)', () => {
  /** One rule more than `CLEAR_SEARCH_HEADERS`, nothing saturated. */
  const LIVE_SEARCH_HEADERS = {
    ...CLEAR_SEARCH_HEADERS,
    'x-rate-limit-rules': 'Ip,Account',
    'x-rate-limit-account': '10:10:60',
    'x-rate-limit-account-state': '1:10:0',
  };

  const COOKIE_VALUE = 'probe-value-Q7vXk2pLm9RtYw4Nz8HbJc3FgD6sAe1U';
  const COOKIE = `POESESSID=${COOKIE_VALUE}`;
  const probeHarness = (options: ProbeOptions = {}) =>
    createProbeHarness(
      {
        clear: CLEAR_SEARCH_HEADERS,
        live: LIVE_SEARCH_HEADERS,
        holderFor: (onSettle, value) =>
          createSessionAuth({ [SESSION_COOKIE_ENV_VAR]: value ?? COOKIE_VALUE }, { onSettle }),
      },
      options,
    );

  describe('the downgrade', () => {
    const NOT_LIVE_HEADERS = CLEAR_SEARCH_HEADERS;

    it.each([
      ['a 401', response(401, CLEAR_SEARCH_HEADERS, 'nope')],
      ['a 403', response(403, { 'content-type': 'text/html', 'cf-mitigated': 'challenge' }, 'blocked')],
      ['a 2xx under the baseline policy that is not live', response(200, NOT_LIVE_HEADERS, '{"result":[]}')],
      [
        'a not-live 2xx whose policy differs only in case and spaces',
        response(
          200,
          { ...NOT_LIVE_HEADERS, 'x-rate-limit-policy': ` ${SEARCH_POLICY.toUpperCase()} ` },
          '{"result":[]}',
        ),
      ],
    ])(
      '%s on a cookie fetch: one expired line, cold pacing in place, a session-expired yield with no response, no invalid count, no later cookie',
      async (_label, downgrading) => {
        const h = probeHarness({
          cookieAnswer: (request) =>
            request.method === 'GET'
              ? downgrading
              : response(200, LIVE_SEARCH_HEADERS, BASELINE_BODY),
        });
        const pacing = h.governor.pacing;
        const lanePolicies = pacing.lanePolicies;

        await h.search();
        expect(h.lines).toEqual(['authenticated']);
        expect(Object.keys(pacing.ledger)).not.toHaveLength(0);

        const fetched = await h.fetch();

        expect(fetched).toMatchObject({ kind: 'yield', reason: 'session-expired', retryAfterMs: 0 });
        expect(fetched.kind === 'yield' && fetched.response).toBeUndefined();
        expect(fetched.kind === 'yield' && penaltyRetryAfterMs(fetched)).toBeUndefined();
        expect(fetched.invalidRequests).toBe(0);
        expect(h.lines).toEqual(['authenticated', 'unauthenticated (expired)']);
        expect(h.holder.state).toEqual({ kind: 'unauthenticated', reason: 'expired' });
        expect(h.holder.pendingHoldOff()).toBe('write');
        // Cold, in place: the same object and the same lane memo.
        expect(h.governor.pacing).toBe(pacing);
        expect(pacing.lanePolicies).toBe(lanePolicies);
        expect(pacing.ledger).toEqual({});
        expect(lanePolicies.size).toBe(0);
        // The 403 or 401 was not counted: threshold 1 is not reached.
        const again = await h.search();
        expect(again.kind).toBe('response');
        expect(again.invalidRequests).toBe(0);
        await h.fetch();

        const cookies = httpOf(h.sent).map((entry) => entry.cookie);
        expect(cookies).toEqual([undefined, COOKIE, undefined, undefined]);
        expect(probesOf(h.sent)).toHaveLength(1);
        expect(h.lines).toHaveLength(2);
      },
    );

    it('a downgrade on a cookie search: the same yield, and the search answer is discarded', async () => {
      const h = probeHarness({ cookieAnswer: () => response(403, {}, 'blocked') });

      await h.search();
      const searched = await h.search();

      expect(searched).toMatchObject({ kind: 'yield', reason: 'session-expired' });
      expect(searched.kind === 'yield' && searched.response).toBeUndefined();
      expect(h.lines).toEqual(['authenticated', 'unauthenticated (expired)']);
    });

    it('still live: no line, and the answer is used', async () => {
      const h = probeHarness();

      await h.search();
      const fetched = await h.fetch();

      expect(fetched.kind === 'response' && fetched.response.status).toBe(200);
      expect(h.lines).toEqual(['authenticated']);
      expect(h.holder.state).toEqual({ kind: 'authenticated' });
    });

    it.each([
      ['fewer rule names than the baseline', { 'x-rate-limit-policy': FETCH_POLICY }],
      ['as many rule names as the baseline', { ...CLEAR_SEARCH_HEADERS, 'x-rate-limit-policy': FETCH_POLICY }],
      ['no policy header', {}],
    ])(
      'a cookie fetch 2xx under another policy, %s: not tested, no downgrade, and the answer is used',
      async (_label, headers) => {
        const h = probeHarness({
          cookieAnswer: (request) =>
            request.method === 'GET'
              ? response(200, headers, '{"result":[]}')
              : response(200, LIVE_SEARCH_HEADERS, BASELINE_BODY),
        });

        await h.search();
        const fetched = await h.fetch();

        expect(fetched.kind === 'response' && fetched.response.status).toBe(200);
        expect(h.lines).toEqual(['authenticated']);
        expect(h.holder.state).toEqual({ kind: 'authenticated' });
        expect(h.holder.pendingHoldOff()).toBe('clear');
      },
    );

    it('a not-live cookie search after a fetch under another policy: the search downgrades', async () => {
      let searches = 0;
      const h = probeHarness({
        cookieAnswer: (request) => {
          if (request.method === 'GET') {
            return response(200, { 'x-rate-limit-policy': FETCH_POLICY }, '{"result":[]}');
          }
          searches += 1;
          return response(200, searches === 1 ? LIVE_SEARCH_HEADERS : NOT_LIVE_HEADERS, BASELINE_BODY);
        },
      });

      await h.search();
      await h.fetch();
      await h.search();
      const searched = await h.search();

      expect(searched).toMatchObject({ kind: 'yield', reason: 'session-expired' });
      expect(h.lines).toEqual(['authenticated', 'unauthenticated (expired)']);
    });

    it.each([
      ['a 429', response(429, { ...LIVE_SEARCH_HEADERS, 'retry-after': '30' }), 'yield'],
      ['a 503', response(503, {}, 'busy'), 'response'],
      ['a 404', response(404, LIVE_SEARCH_HEADERS, 'gone'), 'response'],
    ])('%s on a cookie request stays ordinary: no downgrade', async (_label, answer, kind) => {
      const h = probeHarness({
        cookieAnswer: (request) =>
          request.method === 'GET' ? answer : response(200, LIVE_SEARCH_HEADERS, BASELINE_BODY),
      });

      await h.search();
      const fetched = await h.fetch();

      expect(fetched.kind).toBe(kind);
      expect(fetched.kind === 'yield' ? fetched.reason : undefined).not.toBe('session-expired');
      expect(h.lines).toEqual(['authenticated']);
      expect(h.holder.state).toEqual({ kind: 'authenticated' });
    });

    it('a later governor over the expired holder sends no cookie and no probe', async () => {
      const h = probeHarness({
        cookieAnswer: (request) =>
          request.method === 'GET' ? response(401, {}) : response(200, LIVE_SEARCH_HEADERS, BASELINE_BODY),
      });
      await h.search();
      await h.fetch();

      const probe = createFakeHttpPort({});
      const http = createFakeHttpPort({
        [`POST ${SEARCH_URL}`]: response(200, CLEAR_SEARCH_HEADERS, BASELINE_BODY),
        [`GET ${FETCH_URL}`]: response(200, {}, '{"result":[]}'),
      });
      const next = createTradeGovernor({
        http: { pricing: http },
        clock: createFakeClockPort(NOW),
        wait: recordingWait().wait,
        userAgent: CONTACT,
        auth: { holder: h.holder, probe },
      });
      await next.clients.pricing.send({ method: 'POST', url: SEARCH_URL, body: BODY, cookieEligible: true });
      await next.clients.pricing.send({ method: 'GET', url: FETCH_URL, cookieEligible: true });

      expect(probe.requests).toEqual([]);
      expect(http.requests.every((request) => request.headers['cookie'] === undefined)).toBe(true);
      expect(h.lines).toEqual(['authenticated', 'unauthenticated (expired)']);
    });
  });
});
