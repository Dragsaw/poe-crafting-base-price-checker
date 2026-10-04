import type { ModifierRef as ModifierReference } from './modifier-ref.ts';
import type { TrackedEntry } from './tracked-entry.ts';

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
 * A single-line affix is **always exactly three elements**: `[statId, min,
 * max]` for a `banded` reference and `[statId, null, null]` for a `valueless`
 * one. A hybrid line encodes the same way.
 */
export type CanonicalLine = readonly [string, number | null, number | null];

/**
 * An affix is a `CanonicalLine`, or `["hybrid", [line, …]]` for a `hybrid`
 * reference (§4.1). The two forms never collide: the hybrid form's second
 * element is an array. Both affixes are always present, so there is no absent
 * form. `acceptedTier` is a display-only sibling and never an element.
 */
export type CanonicalAffix = CanonicalLine | readonly ['hybrid', readonly CanonicalLine[]];

export type CanonicalKeyElements =
  | readonly ['crafted', string, string, number, CanonicalAffix, CanonicalAffix]
  | readonly ['raw', string, number];

/* eslint-disable unicorn/no-null -- boundary: §4.1 spells a valueless line `[statId, null, null]`, a serialised key that `undefined` would change. */
/** The lines are already sorted by `statId`: the schema sorts them on parse (§4.1). */
export function encodeAffix(reference: ModifierReference): CanonicalAffix {
  switch (reference.kind) {
    case 'banded': {
      return [reference.statId, reference.valueMin, reference.valueMax];
    }
    case 'valueless': {
      return [reference.statId, null, null];
    }
    case 'hybrid': {
      return [
        'hybrid',
        reference.lines.map((line): CanonicalLine =>
          'valueMin' in line ? [line.statId, line.valueMin, line.valueMax] : [line.statId, null, null],
        ),
      ];
    }
  }
}
/* eslint-enable unicorn/no-null -- end of the §4.1 boundary above. */

/**
 * The elements in declared order, kind first. The leading kind tag is not
 * decoration: it is what makes the byte-wise ordering **total across a mixed
 * list**, so every `crafted` key sorts before every `raw` key.
 */
export function canonicalKeyElements(entry: TrackedEntry): CanonicalKeyElements {
  switch (entry.kind) {
    case 'crafted': {
      return [
        'crafted',
        entry.categoryId,
        entry.className,
        entry.itemLevelMin,
        encodeAffix(entry.prefix),
        encodeAffix(entry.suffix),
      ];
    }
    case 'raw': {
      return ['raw', entry.baseTypeId, entry.itemLevelMin];
    }
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
