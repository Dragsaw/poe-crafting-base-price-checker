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
