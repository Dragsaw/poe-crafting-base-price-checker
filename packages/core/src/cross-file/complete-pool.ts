import type { WeightsPool } from '@poe/contracts';

/** A pool check runs on a `complete` pool only (§2.8): `untrackable` is `not-in-game` (§1). */
export const COMPLETE: Pick<WeightsPool, 'poolCoverage'> = { poolCoverage: 'complete' };
