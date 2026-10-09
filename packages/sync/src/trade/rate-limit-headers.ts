// Parses GGG's `X-Rate-Limit-*` headers (AD-8).
// No rule, policy or rate is compiled in: they arrive at runtime, and the policy and state
// triples pair positionally. An absent or malformed rule is skipped and recorded, never thrown.

/** One `hits:seconds:penalty` triple, read verbatim from a header. */
export interface RateLimitBucket {
  readonly hits: number;
  readonly seconds: number;
  readonly penalty: number;
}

/** `buckets` is the declared policy, `state` the consumption; paired by index. */
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
  /** The `X-Rate-Limit-Policy` value; `undefined` for a non-governed response or a fake. */
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

// Only a real `fetch` adapter enforces lower-case names; the fakes would hide a missed live header.
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

/** Pure. Records a skip for every named rule that could not be read. */
export function parseRateLimitHeaders(
  headers: Readonly<Record<string, string>>,
): RateLimitHeaders {
  const normalised = lowerCaseHeaders(headers);

  const policyRaw = normalised.get(POLICY_HEADER)?.trim();
  const policy = policyRaw === undefined || policyRaw === '' ? undefined : policyRaw;

  const rules: RateLimitRule[] = [];
  const skips: RateLimitSkip[] = [];

  const ruleNames = ruleNamesOf(normalised.get(RULES_HEADER));
  for (const name of ruleNames) {
    const key = `${RULE_HEADER_PREFIX}${name.toLowerCase()}`;
    const policyRawValue = normalised.get(key);

    if (policyRawValue === undefined) {
      skips.push({
        rule: name,
        reason: 'policy-header-absent',
        detail: `${RULE_HEADER_PREFIX}${name} was named in the rules header but not sent`,
      });
      continue;
    }
    const stateRawValue = normalised.get(`${key}${STATE_HEADER_SUFFIX}`);
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

    // Pairing is positional, so a length mismatch is unknowable: truncating would pair a bucket
    // with another bucket's consumption.
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

/** `|names(X-Rate-Limit-Rules)|`; the probe compares only this. */
export function ruleNameCount(headers: Readonly<Record<string, string>>): number {
  return ruleNamesOf(lowerCaseHeaders(headers).get(RULES_HEADER)).length;
}

/** `policy(X-Rate-Limit-Policy)`, trimmed and case-folded. */
export function rateLimitPolicyOf(headers: Readonly<Record<string, string>>): string | undefined {
  const value = lowerCaseHeaders(headers).get(POLICY_HEADER)?.trim().toLowerCase();
  return value === undefined || value === '' ? undefined : value;
}
