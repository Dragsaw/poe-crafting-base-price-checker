/**
 * Parsing of GGG's `X-Rate-Limit-*` response headers (AD-8,
 * `IMPLEMENTATION-NOTES.md` §5.3).
 *
 * The active rule names arrive in `X-Rate-Limit-Rules` **at runtime**. For each
 * name there are two headers — `X-Rate-Limit-<Name>` (the policy) and
 * `X-Rate-Limit-<Name>-State` (the consumption) — and both are comma-separated
 * `hits:seconds:penalty` triples that pair **positionally**.
 *
 * Nothing in this module names a rule, a policy, a rate, a hit count, a window
 * or a penalty. The measured 2026-09-12 buckets are an expected shape to assert
 * a fixture against, never a constant to compile in: an adapter that recognised
 * only the rule it was written against would silently stop pacing the day GGG
 * changed the rule set.
 *
 * A rule whose headers are absent or malformed is **skipped and recorded**,
 * never thrown and never parsed into `NaN`. Pacing then continues on the rules
 * that did arrive, which is strictly safer than inventing a bucket.
 */

/** One `hits:seconds:penalty` triple, read verbatim from a header. */
export interface RateLimitBucket {
  readonly hits: number;
  readonly seconds: number;
  readonly penalty: number;
}

/**
 * One named rule. `buckets` is the declared policy and `state` the consumption,
 * paired positionally — `state[i]` is the consumption of `buckets[i]`.
 */
export interface RateLimitRule {
  readonly name: string;
  readonly buckets: readonly RateLimitBucket[];
  readonly state: readonly RateLimitBucket[];
}

export type RateLimitSkipReason =
  | 'policy-header-absent'
  | 'state-header-absent'
  | 'policy-header-malformed'
  | 'state-header-malformed'
  | 'bucket-count-mismatch';

/** Why one named rule was left out of the parse. A record, never a throw. */
export interface RateLimitSkip {
  readonly rule: string;
  readonly reason: RateLimitSkipReason;
  readonly detail: string;
}

export interface RateLimitHeaders {
  /**
   * The value of `X-Rate-Limit-Policy` — the bucket these rules are spent
   * against. `undefined` when the response carried none, which is how a
   * non-governed response (or a cold start against a fake) is spelled.
   */
  readonly policy: string | undefined;
  readonly rules: readonly RateLimitRule[];
  readonly skips: readonly RateLimitSkip[];
}

const RULES_HEADER = 'x-rate-limit-rules';
const POLICY_HEADER = 'x-rate-limit-policy';
const RULE_HEADER_PREFIX = 'x-rate-limit-';
const STATE_HEADER_SUFFIX = '-state';

/** A triple of non-negative integers and nothing else. `banana` does not match. */
const TRIPLE = /^(\d+):(\d+):(\d+)$/;

/**
 * `HttpPort` documents header names as compared lower-case by every adapter and
 * fake, but a real `fetch` adapter is the only thing enforcing it. Normalising
 * here costs one pass and removes the whole class of "worked against the fake,
 * missed the live header" defect.
 */
function lowerCaseHeaders(headers: Readonly<Record<string, string>>): Map<string, string> {
  const normalised = new Map<string, string>();
  for (const [name, value] of Object.entries(headers)) {
    normalised.set(name.toLowerCase(), value);
  }
  return normalised;
}

function parseBuckets(raw: string): readonly RateLimitBucket[] | undefined {
  const segments = raw.split(',').map((segment) => segment.trim());
  if (segments.length === 0) {
    return undefined;
  }
  const buckets: RateLimitBucket[] = [];
  for (const segment of segments) {
    const matched = TRIPLE.exec(segment);
    if (matched === null) {
      return undefined;
    }
    const [, hits, seconds, penalty] = matched;
    // `noUncheckedIndexedAccess`: a successful match guarantees all three
    // groups, but the compiler types them `string | undefined` regardless.
    if (hits === undefined || seconds === undefined || penalty === undefined) {
      return undefined;
    }
    buckets.push({
      hits: Number(hits),
      seconds: Number(seconds),
      penalty: Number(penalty),
    });
  }
  return buckets;
}

function ruleNamesOf(rulesHeader: string | undefined): readonly string[] {
  if (rulesHeader === undefined) {
    return [];
  }
  const seen = new Set<string>();
  const names: string[] = [];
  for (const candidate of rulesHeader.split(',')) {
    const name = candidate.trim();
    if (name === '' || seen.has(name.toLowerCase())) {
      continue;
    }
    seen.add(name.toLowerCase());
    names.push(name);
  }
  return names;
}

/**
 * Pure. Reads one response's headers into the rules and the policy they
 * describe, with a recorded skip for every named rule that could not be read.
 */
export function parseRateLimitHeaders(
  headers: Readonly<Record<string, string>>,
): RateLimitHeaders {
  const normalised = lowerCaseHeaders(headers);

  const policyRaw = normalised.get(POLICY_HEADER)?.trim();
  const policy = policyRaw === undefined || policyRaw === '' ? undefined : policyRaw;

  const rules: RateLimitRule[] = [];
  const skips: RateLimitSkip[] = [];

  for (const name of ruleNamesOf(normalised.get(RULES_HEADER))) {
    const key = `${RULE_HEADER_PREFIX}${name.toLowerCase()}`;
    const policyRawValue = normalised.get(key);
    const stateRawValue = normalised.get(`${key}${STATE_HEADER_SUFFIX}`);

    if (policyRawValue === undefined) {
      skips.push({
        rule: name,
        reason: 'policy-header-absent',
        detail: `${RULE_HEADER_PREFIX}${name} was named in the rules header but not sent`,
      });
      continue;
    }
    if (stateRawValue === undefined) {
      skips.push({
        rule: name,
        reason: 'state-header-absent',
        detail: `${RULE_HEADER_PREFIX}${name}${STATE_HEADER_SUFFIX} was named in the rules header but not sent`,
      });
      continue;
    }

    const buckets = parseBuckets(policyRawValue);
    if (buckets === undefined) {
      skips.push({
        rule: name,
        reason: 'policy-header-malformed',
        detail: `${RULE_HEADER_PREFIX}${name}: ${policyRawValue}`,
      });
      continue;
    }

    const state = parseBuckets(stateRawValue);
    if (state === undefined) {
      skips.push({
        rule: name,
        reason: 'state-header-malformed',
        detail: `${RULE_HEADER_PREFIX}${name}${STATE_HEADER_SUFFIX}: ${stateRawValue}`,
      });
      continue;
    }

    // Positional pairing is the whole contract between the two headers, so a
    // length disagreement means the pairing is unknowable. Truncating to the
    // shorter list would pair a policy bucket with another bucket's
    // consumption, which paces confidently against a number that is not the
    // one it thinks it is.
    if (buckets.length !== state.length) {
      skips.push({
        rule: name,
        reason: 'bucket-count-mismatch',
        detail: `${String(buckets.length)} policy bucket(s) against ${String(state.length)} state bucket(s)`,
      });
      continue;
    }

    rules.push({ name, buckets, state });
  }

  return { policy, rules, skips };
}

/**
 * `|names(X-Rate-Limit-Rules)|` of IMPLEMENTATION-NOTES.md §13.2: the number of
 * distinct rule names the response declared, each trimmed and case-folded, an
 * empty name dropped. The header name is matched case-insensitively. Pure.
 *
 * The session probe's liveness predicate compares **this count only**. It never
 * compares names, and no name or count is compiled in (AD-8).
 */
export function ruleNameCount(headers: Readonly<Record<string, string>>): number {
  return ruleNamesOf(lowerCaseHeaders(headers).get(RULES_HEADER)).length;
}
