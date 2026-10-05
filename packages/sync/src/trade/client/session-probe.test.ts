import { createFakeClockPort, createFakeHttpPort } from '@poe/contracts';
import type { HttpResponse } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { createSessionAuth, SESSION_COOKIE_ENV_VAR } from '../session-auth.ts';
import { createTradeGovernor } from '../client.ts';
import {
  BASELINE_BODY,
  BODY,
  CONTACT,
  createProbeHarness,
  DATA_URL,
  FETCH_URL,
  httpOf,
  NOW,
  PROBE_BODY,
  probesOf,
  recordingWait,
  response,
  SEARCH_URL,
} from './test-support.ts';
import type { ProbeOptions } from './test-support.ts';

const SEARCH_POLICY = 'trade-search-request-limit';

const CLEAR_SEARCH_HEADERS = {
  'x-rate-limit-policy': SEARCH_POLICY,
  'x-rate-limit-rules': 'Ip',
  'x-rate-limit-ip': '5:10:60',
  'x-rate-limit-ip-state': '1:10:0',
};
const SATURATED_SEARCH_HEADERS = {
  'x-rate-limit-policy': SEARCH_POLICY,
  'x-rate-limit-rules': 'Ip,Client',
  'x-rate-limit-ip': '5:10:60',
  'x-rate-limit-ip-state': '5:10:0',
  'x-rate-limit-client': '30:300:1800',
  'x-rate-limit-client-state': '30:300:0',
};

describe('the session probe (AD-30, IMPLEMENTATION-NOTES.md §13.2, §13.3)', () => {
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

  it('live: the baseline goes without the cookie, the probe repeats it with the cookie, later pricing requests carry it, the league request never does', async () => {
    const h = probeHarness();

    await h.leagues();
    const baseline = await h.search();
    await h.fetch();
    await h.search();
    await h.leagues();

    expect(h.sent.map(({ port, method, url, cookie }) => ({ port, method, url, cookie }))).toEqual([
      { port: 'http', method: 'GET', url: DATA_URL, cookie: undefined },
      { port: 'http', method: 'POST', url: SEARCH_URL, cookie: undefined },
      { port: 'probe', method: 'POST', url: SEARCH_URL, cookie: COOKIE },
      { port: 'http', method: 'GET', url: FETCH_URL, cookie: COOKIE },
      { port: 'http', method: 'POST', url: SEARCH_URL, cookie: COOKIE },
      { port: 'http', method: 'GET', url: DATA_URL, cookie: undefined },
    ]);
    // The probe repeats the baseline's method, path and body.
    expect(probesOf(h.sent)[0]?.body).toBe(BODY);
    expect(h.lines).toEqual(['authenticated']);
    expect(h.holder.state).toEqual({ kind: 'authenticated' });
    // The baseline's answer is the result, never the probe's.
    expect(baseline.kind === 'response' && baseline.response.body).toBe(BASELINE_BODY);
    expect(h.governor.latchedRetryAfterMs()).toBeUndefined();
  });

  it('the probe goes through the pacing wait, and its State reading folds into the ledger', async () => {
    const h = probeHarness({
      baseline: response(200, SATURATED_SEARCH_HEADERS, BASELINE_BODY),
      probe: response(200, { ...CLEAR_SEARCH_HEADERS, 'x-rate-limit-ip-state': '2:10:0' }, PROBE_BODY),
    });

    await h.search();

    // The saturated baseline reading made the probe wait before it was sent.
    expect(h.waits).toHaveLength(1);
    expect(h.waits[0]).toBeGreaterThan(0);
    const ip = h.governor.pacing.ledger[SEARCH_POLICY]?.rules.find((rule) => rule.name === 'Ip');
    expect(ip?.state[0]?.hits).toBe(2);
    // Fewer rule names than the baseline: not live.
    expect(h.lines).toEqual(['unauthenticated (not-elevated)']);
  });

  it.each([
    ['the same rule count', CLEAR_SEARCH_HEADERS],
    ['no rules header at all', {}],
  ])('not elevated (%s): one line, and no later request carries the cookie', async (_label, headers) => {
    const h = probeHarness({ probe: response(200, headers, PROBE_BODY) });

    await h.search();
    await h.fetch();
    await h.search();

    expect(h.lines).toEqual(['unauthenticated (not-elevated)']);
    expect(probesOf(h.sent)).toHaveLength(1);
    expect(httpOf(h.sent).map((entry) => entry.cookie)).toEqual([undefined, undefined, undefined]);
  });

  it.each([400, 401, 403, 404])(
    'rejected (%i): probe-rejected, no invalid-request count, and pricing continues without the cookie',
    async (status) => {
      const h = probeHarness({ probe: response(status, CLEAR_SEARCH_HEADERS, 'nope') });

      const baseline = await h.search();
      const fetched = await h.fetch();
      const again = await h.search();

      expect(h.lines).toEqual(['unauthenticated (probe-rejected)']);
      expect(baseline.invalidRequests).toBe(0);
      // Threshold 1 is not reached: the requests after the probe still go out.
      expect(fetched.kind).toBe('response');
      expect(again.kind).toBe('response');
      expect(again.invalidRequests).toBe(0);
      expect(httpOf(h.sent).every((entry) => entry.cookie === undefined)).toBe(true);
    },
  );

  it.each([
    ['a 503', (): Promise<HttpResponse> => Promise.resolve(response(503, {}, 'busy'))],
    ['a throw', (): Promise<HttpResponse> => Promise.reject(new TypeError('fetch failed'))],
    ['a timeout', (): Promise<HttpResponse> => Promise.reject(new DOMException('timed out', 'TimeoutError'))],
  ])('failed (%s): probe-failed, the error is not passed on, and the entry continues to its fetch', async (_label, probe) => {
    const h = probeHarness({ probe });

    const baseline = await h.search();
    const fetched = await h.fetch();

    expect(baseline.kind === 'response' && baseline.response.body).toBe(BASELINE_BODY);
    expect(fetched.kind).toBe('response');
    expect(h.lines).toEqual(['unauthenticated (probe-failed)']);
    expect(h.sent.at(-1)).toMatchObject({ port: 'http', method: 'GET', cookie: undefined });
    expect(h.governor.latchedRetryAfterMs()).toBeUndefined();
  });

  it('penalty (429): settles nothing, latches the delay, and the next send yields it with nothing sent', async () => {
    const h = probeHarness({ probe: response(429, { ...CLEAR_SEARCH_HEADERS, 'retry-after': '120' }) });

    const baseline = await h.search();
    expect(baseline.kind).toBe('response');
    expect(baseline.invalidRequests).toBe(0);
    expect(h.lines).toEqual([]);
    expect(h.holder.state).toEqual({ kind: 'unsettled' });
    expect(h.governor.latchedRetryAfterMs()).toBe(120_000);
    // The 429 is an ordinary 429: it gets the operator line.
    expect(h.logs).toHaveLength(1);

    const sentBefore = h.sent.length;
    const fetched = await h.fetch();
    expect(fetched).toMatchObject({ kind: 'yield', retryAfterMs: 120_000, reason: 'retry-after-header' });
    expect(fetched.kind === 'yield' && fetched.response).toBeUndefined();
    expect(h.sent).toHaveLength(sentBefore);
  });

  it('penalty (429): a new governor over the same holder starts with no latch and probes again', async () => {
    const first = probeHarness({ probe: response(429, { 'retry-after': '5' }) });
    await first.search();
    expect(first.governor.latchedRetryAfterMs()).toBe(5000);

    const probe = createFakeHttpPort({ [`POST ${SEARCH_URL}`]: response(200, LIVE_SEARCH_HEADERS, PROBE_BODY) });
    const http = createFakeHttpPort({ [`POST ${SEARCH_URL}`]: response(200, CLEAR_SEARCH_HEADERS, BASELINE_BODY) });
    const next = createTradeGovernor({
      http: { pricing: http },
      clock: createFakeClockPort(NOW),
      wait: recordingWait().wait,
      userAgent: CONTACT,
      auth: { holder: first.holder, probe },
    });
    expect(next.latchedRetryAfterMs()).toBeUndefined();
    await next.clients.pricing.send({ method: 'POST', url: SEARCH_URL, body: BODY, cookieEligible: true });

    expect(probe.requests).toHaveLength(1);
    expect(first.lines).toEqual(['authenticated']);
  });

  it.each([
    ['a 429', response(429, { 'retry-after': '60' })],
    ['a 503', response(503, {})],
  ])('no 2xx search (%s): no probe, and the holder stays unsettled', async (_label, baseline) => {
    const h = probeHarness({ baseline });

    await h.search();

    expect(probesOf(h.sent)).toEqual([]);
    expect(h.holder.state).toEqual({ kind: 'unsettled' });
    expect(h.lines).toEqual([]);
  });

  it('no 2xx search (a throw): no probe, and the holder stays unsettled', async () => {
    const h = probeHarness();
    const throwing = createTradeGovernor({
      http: {
        pricing: { send: () => Promise.reject(new TypeError('fetch failed')) },
      },
      clock: createFakeClockPort(NOW),
      wait: recordingWait().wait,
      userAgent: CONTACT,
      auth: { holder: h.holder, probe: { send: () => Promise.reject(new Error('the probe must not be sent')) } },
    });

    await expect(
      throwing.clients.pricing.send({ method: 'POST', url: SEARCH_URL, body: BODY, cookieEligible: true }),
    ).rejects.toThrow('fetch failed');
    expect(h.holder.state).toEqual({ kind: 'unsettled' });
  });

  it('baseline 4xx: no probe, and the 4xx is returned for the caller to abort on', async () => {
    const h = probeHarness({ baseline: response(400, CLEAR_SEARCH_HEADERS, 'bad') });

    const baseline = await h.search();

    expect(baseline.kind === 'response' && baseline.response.status).toBe(400);
    expect(baseline.invalidRequests).toBe(1);
    expect(probesOf(h.sent)).toEqual([]);
    expect(h.holder.state).toEqual({ kind: 'unsettled' });
  });

  it('an unmarked 2xx request is never a baseline', async () => {
    const h = probeHarness();

    await h.leagues();
    await h.governor.clients.pricing.send({ method: 'POST', url: SEARCH_URL, body: BODY });

    expect(probesOf(h.sent)).toEqual([]);
    expect(h.holder.state).toEqual({ kind: 'unsettled' });
  });

  it('a settled holder never probes again', async () => {
    const h = probeHarness();

    await h.search();
    await h.search();
    await h.search();

    expect(probesOf(h.sent)).toHaveLength(1);
    expect(h.lines).toEqual(['authenticated']);
  });

  it.each([
    ['absent', ''],
    ['malformed', 'a b'],
  ])('an %s holder never probes and never attaches', async (_label, value) => {
    const h = probeHarness({ value });

    await h.search();
    await h.fetch();

    expect(probesOf(h.sent)).toEqual([]);
    expect(h.sent.every((entry) => entry.cookie === undefined)).toBe(true);
  });

  it('a live probe records the clear action and keeps the baseline rule count and policy', async () => {
    const h = probeHarness();

    await h.search();

    expect(h.holder.baselineRuleCount).toBe(1);
    expect(h.holder.baselinePolicy).toBe(SEARCH_POLICY);
    expect(h.holder.pendingHoldOff()).toBe('clear');
  });
});
