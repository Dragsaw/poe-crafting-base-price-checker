import { flattenStatCatalogue, type CraftedTrackedEntry, type ModifierRef, type StatCatalogue } from '@poe/contracts';

import { shortForm } from './short-forms';

/**
 * The one formatter for a Combination's text, shared by the chase cells and
 * the expansion's combination rows (EXPERIENCE.md, *A Combination is written
 * as tier plus short form, never as a value*; UX-DR39, UX-DR40).
 */

/**
 * One affix as printed. `verbatim` marks the fallback: text the page quoted
 * from the catalogue rather than wrote, set in the mono verbatim register
 * (EXPERIENCE.md memlog 138, 208).
 */
export interface AffixPart {
  readonly text: string;
  readonly verbatim: boolean;
}

/** `statId` → the Trade Catalogue's display text. */
export type StatTexts = ReadonlyMap<string, string>;

/** The middle dot that joins two affixes in one Combination: this affix AND that one. */
export const AFFIX_JOIN = ' · ';

/**
 * The catalogue's stat texts, flattened from its category groups. The first
 * group to name an id wins; a later duplicate changes nothing.
 */
export function statTexts(catalogue: StatCatalogue): StatTexts {
  const texts = new Map<string, string>();
  for (const entry of flattenStatCatalogue(catalogue)) {
    if (!texts.has(entry.id)) {
      texts.set(entry.id, entry.text);
    }
  }
  return texts;
}

/**
 * The fallback text: the catalogue stat text (or the raw `statId` when the
 * catalogue does not hold it) with the value band. Exactly one `#` takes
 * `min–max` in its place; otherwise the band is appended. The numbers print as
 * the file wrote them, with no rounding.
 */
export function bandedFallback(text: string, valueMin: number, valueMax: number): string {
  const band = `${String(valueMin)}–${String(valueMax)}`;
  return text.split('#').length === 2 ? text.replace('#', band) : `${text} ${band}`;
}

/**
 * One affix. A banded reference with both a short form and an Accepted Tier
 * prints `<acceptedTier> <form>`, the tier verbatim. A valueless reference
 * prints its form alone, with no tier. Anything else — no form (a product
 * gap) or a banded reference with no tier (a curation gap) — is the verbatim
 * fallback: the catalogue text, with the band on a banded reference.
 */
export function affixText(ref: ModifierRef, stats: StatTexts): AffixPart {
  const form = shortForm(ref.statId);
  const catalogued = stats.get(ref.statId) ?? ref.statId;
  if (ref.kind === 'valueless') {
    return form === undefined ? { text: catalogued, verbatim: true } : { text: form, verbatim: false };
  }
  if (form !== undefined && ref.acceptedTier !== undefined) {
    return { text: `${ref.acceptedTier} ${form}`, verbatim: false };
  }
  return { text: bandedFallback(catalogued, ref.valueMin, ref.valueMax), verbatim: true };
}

/** A crafted entry's Combination: the prefix, then the suffix, each present one an affix. */
export function combinationText(entry: CraftedTrackedEntry, stats: StatTexts): readonly AffixPart[] {
  return [entry.prefix, entry.suffix].flatMap((ref) => (ref === undefined ? [] : [affixText(ref, stats)]));
}

/** The parts as one plain string, joined by the middle dot. */
export function combinationString(parts: readonly AffixPart[]): string {
  return parts.map((part) => part.text).join(AFFIX_JOIN);
}
