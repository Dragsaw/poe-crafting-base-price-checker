import type { PolicyObservation } from '../ledger.ts';
import type { RateLimitBucket } from '../rate-limit-headers.ts';
import { RETRY_AFTER_HEADER } from './yield-penalty.ts';

const RATE_LIMIT_HEADER_PREFIX = 'x-rate-limit-';

function tripletsOf(buckets: readonly RateLimitBucket[]): string {
  return buckets
    .map(({ hits, seconds, penalty }) => `${String(hits)}:${String(seconds)}:${String(penalty)}`)
    .join(',');
}

/** Orders two strings by code unit, as the relational operators do. */
function compareCodeUnits(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

// `pacedOn` is the reading the wait was paced on: a 429 means it was wrong, and each rule's `observedAt`
// against `at` gives its age. Both halves are JSON, because header values carry commas.
export function describe429(
  exchange: {
    readonly at: string;
    readonly lane: string;
    readonly policy: string | undefined;
    readonly waitedMs: number;
  },
  headers: Readonly<Record<string, string>>,
  pacedOn: PolicyObservation | undefined,
): string {
  const rateHeaders = Object.entries(headers)
    .map(([name, value]): [string, string] => [name.toLowerCase(), value])
    .filter(([name]) => name === RETRY_AFTER_HEADER || name.startsWith(RATE_LIMIT_HEADER_PREFIX))
    .toSorted(([left], [right]) => compareCodeUnits(left, right));
  const reading =
    pacedOn === undefined
      ? 'no reading'
      : `policy ${pacedOn.policy} ${JSON.stringify(
          pacedOn.rules.map((rule) => ({
            rule: rule.name,
            observedAt: rule.observedAt,
            policy: tripletsOf(rule.buckets),
            state: tripletsOf(rule.state),
          })),
        )}`;
  return (
    `sync: the trade API answered 429 at ${exchange.at} on lane ${exchange.lane} ` +
    `(policy ${exchange.policy ?? 'unknown'}) after waiting ${String(exchange.waitedMs)} ms; ` +
    `response headers ${JSON.stringify(Object.fromEntries(rateHeaders))}; paced on ${reading}`
  );
}
