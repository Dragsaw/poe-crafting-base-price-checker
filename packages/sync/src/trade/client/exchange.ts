import type { HttpPort } from '@poe/contracts';

import type { TradeRequest, TradeResult, TradeYieldResult } from '../client.ts';
import { countInvalidRequest, invalidRequestsFor, isInvalidRequest, isThresholdReached } from '../invalid-requests.ts';
import { describe429 } from './describe-429.ts';
import { fold, paceLane, readingFor } from './governor-context.ts';
import type { GovernorContext, IssuedExchange } from './governor-context.ts';
import { remainingAllowance } from './remaining-allowance.ts';
import { laneOf } from './request-shape.ts';
import {
  expireSession,
  isDowngrade,
  outboundHeaders,
  probe,
  shouldCarryCookie,
  shouldProbe,
} from './session-cookie.ts';
import { penaltyOf, TOO_MANY_REQUESTS } from './yield-penalty.ts';
import type { YieldPenalty } from './yield-penalty.ts';

// Nothing is sent on a latched probe `429` or a reached threshold. The threshold is checked before
// the wait, because waiting does not clear it and passing it revokes access.
function refusalOf(context: GovernorContext, policy: string | undefined): YieldPenalty | undefined {
  if (context.latched !== undefined) {
    return context.latched;
  }
  return isThresholdReached(context.invalidRequests, policy, context.invalidRequestThreshold)
    ? { retryAfterMs: 0, reason: 'invalid-request-threshold' }
    : undefined;
}

function refusalYield(
  context: GovernorContext,
  lane: string,
  knownPolicy: string | undefined,
): TradeYieldResult | undefined {
  const refusal = refusalOf(context, knownPolicy);
  if (refusal === undefined) {
    return undefined;
  }
  return {
    kind: 'yield',
    lane,
    policy: knownPolicy,
    waitedMs: 0,
    skips: [],
    invalidRequests: invalidRequestsFor(context.invalidRequests, knownPolicy),
    retryAfterMs: refusal.retryAfterMs,
    reason: refusal.reason,
  };
}

/** Folds the answer into the ledger, then makes a downgrade yield, a `429` yield or a response. */
function settleAnswer(context: GovernorContext, issued: IssuedExchange): TradeResult {
  const { lane, knownPolicy, waitedMs, pacedOn, isWithCookie, response } = issued;
  const folded = fold(context, lane, knownPolicy, response);
  const { parsed, respondedAt, policy } = folded;
  if (isWithCookie && context.auth !== undefined && isDowngrade(context.auth.holder, response)) {
    return expireSession(context, context.auth, issued, folded);
  }
  if (isInvalidRequest(response.status)) {
    context.invalidRequests = countInvalidRequest(context.invalidRequests, policy);
  }
  const remaining = remainingAllowance(parsed);
  const common = {
    lane,
    policy,
    waitedMs,
    skips: parsed.skips,
    invalidRequests: invalidRequestsFor(context.invalidRequests, policy),
    ...(remaining !== undefined && { remaining }),
  };
  if (response.status !== TOO_MANY_REQUESTS) {
    return { kind: 'response', ...common, response };
  }
  context.log?.(describe429({ at: respondedAt, lane, policy, waitedMs }, response.headers, pacedOn));
  return { kind: 'yield', ...common, response, ...penaltyOf(context.pacing.ledger, response, parsed, policy) };
}

export async function runExchange(context: GovernorContext, http: HttpPort, request: TradeRequest): Promise<TradeResult> {
  const lane = laneOf(request);
  const knownPolicy = context.pacing.lanePolicies.get(lane);
  const refusal = refusalYield(context, lane, knownPolicy);
  if (refusal !== undefined) {
    return refusal;
  }

  const waitedMs = await paceLane(context, lane);
  const pacedOn = readingFor(context.pacing, knownPolicy);
  const isWithCookie = shouldCarryCookie(context, request);
  const response = await http.send({
    method: request.method,
    url: request.url,
    headers: outboundHeaders(context, request, isWithCookie),
    body: request.body,
  });

  const result = settleAnswer(context, { lane, knownPolicy, waitedMs, pacedOn, isWithCookie, response });
  if (result.kind === 'response' && shouldProbe(context.auth, request, response)) {
    await probe(context, context.auth, { request, lane, response });
  }
  return result;
}
