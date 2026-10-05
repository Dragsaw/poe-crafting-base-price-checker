import type { HttpResponse } from '@poe/contracts';

import type { TradeGovernorAuth, TradeRequest, TradeYieldResult } from '../client.ts';
import { invalidRequestsFor, isInvalidRequest, isSuccess } from '../invalid-requests.ts';
import { rateLimitPolicyOf, ruleNameCount } from '../rate-limit-headers.ts';
import { describe429 } from './describe-429.ts';
import { fold, paceLane, readingFor } from './governor-context.ts';
import type { FoldedResponse, GovernorContext, IssuedExchange } from './governor-context.ts';
import { resetPacingState } from './pacing-state.ts';
import { headersFor } from './request-shape.ts';
import { penaltyOf, TOO_MANY_REQUESTS } from './yield-penalty.ts';

type AuthHolder = TradeGovernorAuth['holder'];

const UNAUTHORIZED = 401;
const FORBIDDEN = 403;

/** The baseline a probe repeats: its request, its lane and the answer it got. */
interface ProbeBaseline {
  readonly request: TradeRequest;
  readonly lane: string;
  readonly response: HttpResponse;
}

// A downgrade (§13.4): a cookie request answered 401 or 403 (a Cloudflare 403 too), or a 2xx under
// the baseline's policy whose rule-name count is not above the baseline's. 429, 5xx, other 4xx: no.
export function isDowngrade(holder: AuthHolder, response: HttpResponse): boolean {
  if (response.status === UNAUTHORIZED || response.status === FORBIDDEN) {
    return true;
  }
  const baseline = holder.baselineRuleCount;
  return (
    isSuccess(response.status) &&
    baseline !== undefined &&
    rateLimitPolicyOf(response.headers) === holder.baselinePolicy &&
    ruleNameCount(response.headers) <= baseline
  );
}

/** The standing headers, plus the cookie on a marked request once `authenticated` (AD-30). */
export function outboundHeaders(
  context: GovernorContext,
  request: TradeRequest,
  hasCookie: boolean,
): Record<string, string> {
  const headers = headersFor(request, context.userAgent);
  return hasCookie && context.auth !== undefined ? context.auth.holder.withCookie(headers) : headers;
}

export function shouldCarryCookie(context: GovernorContext, request: TradeRequest): boolean {
  return (
    !context.isCookieDropped && request.cookieEligible === true && context.auth?.holder.isAuthenticated === true
  );
}

/** The first `2xx` marked request, sent without the cookie, is the baseline: probe once (§13.2). */
export function shouldProbe(
  auth: TradeGovernorAuth | undefined,
  request: TradeRequest,
  response: HttpResponse,
): auth is TradeGovernorAuth {
  return auth !== undefined && request.cookieEligible === true && auth.holder.canProbe && isSuccess(response.status);
}

// Drop the cookie, reset pacing to cold in place, settle the holder `expired`, yield (§13.4).
// The downgrading answer is neither counted nor returned.
export function expireSession(
  context: GovernorContext,
  auth: TradeGovernorAuth,
  issued: IssuedExchange,
  { parsed, policy }: FoldedResponse,
): TradeYieldResult {
  context.isCookieDropped = true;
  resetPacingState(context.pacing);
  auth.holder.expire();
  return {
    kind: 'yield',
    lane: issued.lane,
    policy,
    waitedMs: issued.waitedMs,
    skips: parsed.skips,
    invalidRequests: invalidRequestsFor(context.invalidRequests, policy),
    retryAfterMs: 0,
    reason: 'session-expired',
  };
}

/** The holder's verdict on the probe's answer, once it is neither a throw nor a `429`. */
function settleProbeStatus(holder: AuthHolder, baseline: HttpResponse, response: HttpResponse): void {
  const { status } = response;
  if (isSuccess(status)) {
    // Kept by the holder: every later cookie answer under the baseline's policy is tested against
    // it (§13.4).
    const baselineCount = ruleNameCount(baseline.headers);
    holder.rememberBaseline(baselineCount, rateLimitPolicyOf(baseline.headers));
    holder.settle(ruleNameCount(response.headers) > baselineCount ? 'authenticated' : 'not-elevated');
  } else if (isInvalidRequest(status)) {
    // Every 401 and 403 included, a Cloudflare 403 too (AD-30).
    holder.settle('probe-rejected');
  } else {
    // A 5xx, or any other answer that is neither 2xx nor 4xx.
    holder.settle('probe-failed');
  }
}

// The one session probe (IN §13.2, §13.3): the baseline's request, once, with the cookie. It never
// counts toward the invalid-request count, and its answer and error are never returned.
export async function probe(context: GovernorContext, auth: TradeGovernorAuth, baseline: ProbeBaseline): Promise<void> {
  const { request, lane } = baseline;
  const knownPolicy = context.pacing.lanePolicies.get(lane);
  const waitedMs = await paceLane(context, lane);
  const pacedOn = readingFor(context.pacing, knownPolicy);

  let response: HttpResponse;
  try {
    response = await auth.probe.send({
      method: request.method,
      url: request.url,
      headers: auth.holder.withCookie(headersFor(request, context.userAgent)),
      body: request.body,
    });
  } catch {
    // The error may quote the request, so it goes nowhere. Pricing goes on unauthenticated (§13.3).
    auth.holder.settle('probe-failed');
    return;
  }

  const { parsed, respondedAt, policy } = fold(context, lane, knownPolicy, response);
  if (response.status === TOO_MANY_REQUESTS) {
    // Settles nothing. The next `send` yields with this penalty (§13.3).
    context.log?.(describe429({ at: respondedAt, lane, policy, waitedMs }, response.headers, pacedOn));
    context.latched = penaltyOf(context.pacing.ledger, response, parsed, policy);
    return;
  }
  settleProbeStatus(auth.holder, baseline.response, response);
}
