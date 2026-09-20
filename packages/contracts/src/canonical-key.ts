import type { ModifierRef } from './modifier-ref';
import type { TrackedEntry } from './tracked-entry';

/**
 * The canonical `TrackedEntry` key, per `IMPLEMENTATION-NOTES.md` §4.1
 * (binding under AD-0):
 *
 * ```
 * crafted:  ["crafted", categoryId, className, itemLevelMin, prefixBand, suffixBand]
 * raw:      ["raw",     baseTypeId, itemLevelMin]
 * ```
 *
 * It lives in `contracts` rather than `core` because **every tie-break in the
 * system resolves on this one serialisation** — AD-7's rotation, AD-17's
 * summands, and every cross-file failure payload that names an entry. It has to
 * exist before the first consumer, or two consumers spell it differently and
 * both look right.
 */

/**
 * An affix is **always exactly three elements or the literal `null`** — three
 * distinguishable forms, so an absent affix and a `valueless` affix can never
 * collide. `acceptedTier` is a display-only sibling of the band and never a
 * fourth element.
 */
export type CanonicalAffix = readonly [string, number | null, number | null] | null;

export type CanonicalKeyElements =
  | readonly ['crafted', string, string, number, CanonicalAffix, CanonicalAffix]
  | readonly ['raw', string, number];

export function encodeAffix(ref: ModifierRef | undefined): CanonicalAffix {
  if (ref === undefined) {
    return null;
  }
  switch (ref.kind) {
    case 'banded':
      return [ref.statId, ref.valueMin, ref.valueMax];
    case 'valueless':
      return [ref.statId, null, null];
  }
}

/**
 * The elements in declared order, kind first. The leading kind tag is not
 * decoration: it is what makes the byte-wise ordering **total across a mixed
 * list**, so every `crafted` key sorts before every `raw` key.
 */
export function canonicalKeyElements(entry: TrackedEntry): CanonicalKeyElements {
  switch (entry.kind) {
    case 'crafted':
      return [
        'crafted',
        entry.categoryId,
        entry.className,
        entry.itemLevelMin,
        encodeAffix(entry.prefix),
        encodeAffix(entry.suffix),
      ];
    case 'raw':
      return ['raw', entry.baseTypeId, entry.itemLevelMin];
  }
}

/** The serialised key. One encoding, used by every artifact that keys entries. */
export function canonicalKey(entry: TrackedEntry): string {
  return JSON.stringify(canonicalKeyElements(entry));
}

/**
 * **Keys compare by UTF-8 code unit, never by locale collation** (Consistency
 * Conventions, *Entity keys*). UTF-8 byte order is exactly Unicode **code
 * point** order, so this compares code points — JavaScript's own `<` compares
 * UTF-16 code units, which disagrees for every character above the BMP, and
 * `localeCompare` disagrees on case and accents at every code point.
 *
 * At cold start, when every entry is equally stale, this is the *only*
 * ordering, so a locale-sensitive comparison would have two builders sync
 * different entries in the first chunk.
 */
export function compareByCodeUnit(a: string, b: string): number {
  const left = a[Symbol.iterator]();
  const right = b[Symbol.iterator]();
  for (;;) {
    const x = left.next();
    const y = right.next();
    if (x.done === true) {
      return y.done === true ? 0 : -1;
    }
    if (y.done === true) {
      return 1;
    }
    const xc = x.value.codePointAt(0) ?? 0;
    const yc = y.value.codePointAt(0) ?? 0;
    if (xc !== yc) {
      return xc < yc ? -1 : 1;
    }
  }
}

/** The comparator every tie-break in the system resolves on. */
export function compareCanonicalKeys(a: string, b: string): number {
  return compareByCodeUnit(a, b);
}

/** Convenience: compare two entries by their canonical keys. */
export function compareTrackedEntries(a: TrackedEntry, b: TrackedEntry): number {
  return compareCanonicalKeys(canonicalKey(a), canonicalKey(b));
}
