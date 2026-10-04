import type { HttpPort } from '@poe/contracts';

import type { TradeGovernorAuth, TradeRequest, TradeResult } from '../client.ts';
import { runExchange } from './exchange.ts';
import type { GovernorContext } from './governor-context.ts';

// Requests go one at a time, chained onto the previous call, so the ledger is at most one request out of date.
export function createSerialSender(
  context: GovernorContext,
): (http: HttpPort, request: TradeRequest) => Promise<TradeResult> {
  let tail: Promise<unknown> = Promise.resolve();

  // Redacted in place, then rethrown: the class, the `name` and the identity
  // survive, so `isTransportFailure` still classifies the throw (§13.6).
  const redactedExchange = async (
    holderAuth: TradeGovernorAuth,
    http: HttpPort,
    request: TradeRequest,
  ): Promise<TradeResult> => {
    try {
      return await runExchange(context, http, request);
    } catch (error) {
      throw holderAuth.holder.redact(error);
    }
  };

  const redacted = (http: HttpPort, request: TradeRequest): Promise<TradeResult> =>
    context.auth === undefined ? runExchange(context, http, request) : redactedExchange(context.auth, http, request);

  // The queue must survive a rejected exchange, or one failure would wedge every later request behind it.
  const settle = async (promise: Promise<unknown>): Promise<void> => {
    try {
      await promise;
    } catch {
      // Swallowed on purpose: the caller of `send` gets the rejection.
    }
  };

  const issueAfter = async (
    previous: Promise<unknown>,
    http: HttpPort,
    request: TradeRequest,
  ): Promise<TradeResult> => {
    await previous;
    return redacted(http, request);
  };

  return (http, request) => {
    const issued = issueAfter(tail, http, request);
    tail = settle(issued);
    return issued;
  };
}
