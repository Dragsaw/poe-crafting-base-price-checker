/** The Crafting Item Levels on offer (FR-38): `rank`, its callers, `tracked:check` and `tracked:lookup tiers` read it. */
export const CRAFTING_ITEM_LEVELS = [79, 82] as const;

/** One offered Crafting Item Level (FR-38), the `L` that scopes every crafted EV (AD-17). */
export type CraftingItemLevel = (typeof CRAFTING_ITEM_LEVELS)[number];

/** The highest offered level: the pool only grows with the level, so a verdict there holds at every level (AD-17). */
export const HIGHEST_CRAFTING_ITEM_LEVEL: CraftingItemLevel = Math.max(...CRAFTING_ITEM_LEVELS) as CraftingItemLevel;
