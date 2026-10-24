/**
 * The condition filters a category's every search carries (AD-16): a hand-kept table keyed by `categoryId`.
 */

/** A `{min}` / `{max}` edge as the trade site's filters spell it. */
export interface FilterEdge {
  readonly min?: number;
  readonly max?: number;
}

export interface StatFilter {
  readonly id: string;
  /** A banded stat carries both edges; a valueless stat carries `{}` (OQ-12). */
  readonly value: FilterEdge;
  readonly disabled: false;
}

/** A condition is not a modifier reference, so AD-5's closed band does not bind it; 10 is the game maximum. */
export const CONDITION_FILTERS: ReadonlyMap<string, readonly StatFilter[]> = new Map([
  ['map.tablet', [{ id: 'pseudo.pseudo_number_of_uses_remaining', value: { min: 10 }, disabled: false }]],
]);

export function conditionFiltersOf(categoryId: string): readonly StatFilter[] {
  return CONDITION_FILTERS.get(categoryId) ?? [];
}
