import type { ModifierWeight, WeightsPool } from '@poe/contracts';

/** One slot at one check level: the scoped entries, and the unscoped pool that containment reads (AD-11). */
export interface SlotScope {
  readonly scoped: readonly ModifierWeight[];
  readonly pool: WeightsPool;
}
