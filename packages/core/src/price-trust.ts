import type { DatasetEntry, PriceObservation, PriceState, PriceTrust, PriceTrustReason, TrackedEntry } from '@poe/contracts';

/** EXPERIENCE.md *Price trust*: a price this many hours old or older is old. */
export const OLD_AFTER_HOURS = 72;
/** EXPERIENCE.md *Price trust*: a price on fewer listings than this is thin. */
export const THIN_BELOW_LISTINGS = 3;
/** EXPERIENCE.md *Price trust*: a crafted row is rough when this share of its gross is unreliable. */
export const UNRELIABLE_SHARE_MIN = 0.7;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** A share built from `P × price` sums carries float error; a share at the bound must still match it. */
const SHARE_TOLERANCE = 1e-9;

const CURRENT: PriceTrust = { verdict: 'current', reasons: [] };

/** `rank` refuses an unparseable clock rather than read every age as `NaN`. */
export function assertClock(now: string): void {
  if (Number.isNaN(Date.parse(now))) {
    throw new RangeError(`rank: now must be an ISO-8601 instant, got ${now}`);
  }
}

/** The state `core` ranks on: a `priced` observation from another league is `league-mismatch` (AD-19). */
export function resolvedPrice(published: DatasetEntry | undefined, activeLeague: string): PriceState {
  if (published === undefined) {
    return { state: 'not-yet-synced', reason: 'never-synced' };
  }
  const { price } = published;
  return price.state === 'priced' && price.observation.league !== activeLeague
    ? { state: 'not-yet-synced', reason: 'league-mismatch' }
    : price;
}

function ageMs(at: string, now: number): number {
  return Math.max(0, now - Date.parse(at));
}

function pricedTrust(observation: PriceObservation, now: number): PriceTrust {
  const age = ageMs(observation.observedAt, now);
  const reasons: PriceTrustReason[] = [];
  if (age >= OLD_AFTER_HOURS * HOUR_MS) {
    reasons.push({ kind: 'old', days: Math.floor(age / DAY_MS) });
  }
  if (observation.sampleSize < THIN_BELOW_LISTINGS) {
    reasons.push({ kind: 'thin', listings: observation.sampleSize });
  }
  return reasons.length === 0 ? CURRENT : { verdict: 'rough', reasons };
}

/** One non-pruned entry's verdict (AD-17, *Price trust*); `now` is ISO-8601, as `chunkOrder` takes it. */
export function entryTrust(
  entry: TrackedEntry,
  datasetEntry: DatasetEntry | undefined,
  activeLeague: string,
  now: string,
): PriceTrust {
  if (entry.status === 'pruned') {
    throw new RangeError('entryTrust: a pruned entry has no verdict');
  }
  const price = resolvedPrice(datasetEntry, activeLeague);
  switch (price.state) {
    case 'priced': {
      return pricedTrust(price.observation, Date.parse(now));
    }
    case 'no-listings': {
      const attempted = datasetEntry?.lastAttemptedAt;
      return {
        verdict: 'pending',
        reasons: [
          attempted === undefined
            ? { kind: 'no-listings' }
            : { kind: 'no-listings', minutes: Math.floor(ageMs(attempted, Date.parse(now)) / MINUTE_MS) },
        ],
      };
    }
    case 'not-yet-synced': {
      return { verdict: 'pending', reasons: [{ kind: price.reason }] };
    }
    case 'unresolvable': {
      return { verdict: 'broken', reasons: [{ kind: 'unresolvable' }] };
    }
  }
}

/** One entry of a crafted pair: its verdict and, when priced in the active league, its gross `P × price`. */
export interface CraftedTrustEntry {
  readonly trust: PriceTrust;
  readonly gross?: number;
}

export interface CraftedTrustInput {
  readonly uncostable: boolean;
  /** Every non-pruned entry of the class, below-threshold ones included. */
  readonly entries: readonly CraftedTrustEntry[];
}

/** The first crafted rule of *Price trust*: with no recipe published, every crafted class reads it. */
export const NO_RECIPE_TRUST: PriceTrust = { verdict: 'pending', reasons: [{ kind: 'no-recipe' }] };

/** A crafted pair's verdict: the ordered rules of *Price trust* after the no-recipe rule (`NO_RECIPE_TRUST`), first match wins (AD-17). */
export function craftedTrust({ uncostable, entries }: CraftedTrustInput): PriceTrust {
  if (uncostable) {
    return { verdict: 'pending', reasons: [{ kind: 'uncostable' }] };
  }
  if (entries.length > 0 && entries.every(({ trust }) => trust.verdict === 'broken')) {
    return { verdict: 'broken', reasons: [{ kind: 'all-broken' }] };
  }
  let whole = 0;
  let unreliable = 0;
  let isAnyPriced = false;
  for (const { trust, gross } of entries) {
    if (gross === undefined) {
      continue;
    }
    isAnyPriced = true;
    whole += gross;
    if (trust.verdict === 'rough') {
      unreliable += gross;
    }
  }
  if (!isAnyPriced) {
    return { verdict: 'pending', reasons: [{ kind: 'no-prices' }] };
  }
  const share = unreliable / whole;
  return share >= UNRELIABLE_SHARE_MIN - SHARE_TOLERANCE
    ? { verdict: 'rough', reasons: [{ kind: 'unreliable-share', percent: Math.min(100, Math.floor((share + SHARE_TOLERANCE) * 100)) }] }
    : CURRENT;
}
