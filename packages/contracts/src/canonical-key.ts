import type { ModifierRef as ModifierReference } from './modifier-ref.ts';
import type { TrackedEntry } from './tracked-entry.ts';

/** The canonical `TrackedEntry` key (IMPLEMENTATION-NOTES.md §4.1), in `contracts` so every tie-break (AD-7, AD-17) resolves on one serialisation. */

/** Always three elements: `[statId, min, max]`, with `null` edges for a `valueless` line (§4.1). */
export type CanonicalLine = readonly [string, number | null, number | null];

/** A `CanonicalLine`, or `["hybrid", [line, …]]`; the forms cannot collide (§4.1). */
export type CanonicalAffix = CanonicalLine | readonly ['hybrid', readonly CanonicalLine[]];

export type CanonicalKeyElements =
  | readonly ['crafted', string, string, number, CanonicalAffix, CanonicalAffix]
  | readonly ['raw', string, number];

// eslint-disable-next-line unicorn/no-null -- boundary: §4.1 spells a valueless line `[statId, null, null]`, a serialised key that `undefined` would change.
const VALUELESS_SLOT = null;

/** The lines are already sorted by `statId`: the schema sorts them on parse (§4.1). */
export function encodeAffix(reference: ModifierReference): CanonicalAffix {
  switch (reference.kind) {
    case 'banded': {
      return [reference.statId, reference.valueMin, reference.valueMax];
    }
    case 'valueless': {
      return [reference.statId, VALUELESS_SLOT, VALUELESS_SLOT];
    }
    case 'hybrid': {
      return [
        'hybrid',
        reference.lines.map((line): CanonicalLine =>
          'valueMin' in line ? [line.statId, line.valueMin, line.valueMax] : [line.statId, VALUELESS_SLOT, VALUELESS_SLOT],
        ),
      ];
    }
  }
}

/** The leading kind tag makes the byte-wise ordering total across a mixed list (§4.1). */
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

/** Compares code points (UTF-8 byte order), never locale collation or UTF-16 units, which disagree above the BMP (Consistency Conventions, *Entity keys*). */
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
