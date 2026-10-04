/**
 * Helpers for this package's own suites. Not re-exported from the barrel: it is
 * test scaffolding, not part of the contract.
 */

/** A copy of `value` with one key removed, for asserting that a field is required. */
export function without<T extends object>(value: T, key: keyof T): Partial<T> {
  const copy: Partial<T> = { ...value };
  delete copy[key];
  return copy;
}

// eslint-disable-next-line unicorn/no-null -- boundary: the wire formats under test carry JSON `null` (`z.nullable()` fields, canonical key slots), which `undefined` cannot stand in for (§4.1).
export const JSON_NULL = null;

export const byCodeUnit = (a: string, b: string): number => Number(a > b) - Number(a < b);
