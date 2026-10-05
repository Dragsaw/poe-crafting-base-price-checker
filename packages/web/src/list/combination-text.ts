import {
  compareByCodeUnit,
  flattenStatCatalogue,
  type CraftedTrackedEntry,
  type HybridModifierRef,
  type ModifierRef,
  type StatCatalogue,
} from '@poe/contracts';

import { shortForm } from './short-forms';

// The one formatter for a Combination's text (EXPERIENCE.md, *A Combination is written as tier plus
// short form, never as a value*; UX-DR39, UX-DR40).

/** `verbatim` marks the fallback, set in the mono register (EXPERIENCE.md memlog 138, 208). */
export interface AffixPart {
  readonly text: string;
  readonly verbatim: boolean;
}

/** `statId` → the Trade Catalogue's display text. */
export type StatTexts = ReadonlyMap<string, string>;

/** The middle dot that joins two affixes in one Combination: this affix AND that one. */
export const AFFIX_JOIN = ' · ';

/** The first category group to name an id wins; a later duplicate changes nothing. */
export function statTexts(catalogue: StatCatalogue): StatTexts {
  const texts = new Map<string, string>();
  for (const entry of flattenStatCatalogue(catalogue)) {
    if (!texts.has(entry.id)) {
      texts.set(entry.id, entry.text);
    }
  }
  return texts;
}

// Exactly one `#` takes `min–max` in its place; otherwise the band is appended. No rounding.
export function bandedFallback(text: string, valueMin: number, valueMax: number): string {
  const band = `${String(valueMin)}–${String(valueMax)}`;
  return text.split('#').length === 2 ? text.replace('#', () => band) : `${text} ${band}`;
}

// No form (a product gap) or a banded reference with no tier (a curation gap): verbatim fallback.
export function affixText(reference: ModifierRef, stats: StatTexts): AffixPart {
  if (reference.kind === 'hybrid') {
    return hybridText(reference, stats);
  }
  const form = shortForm(reference.statId);
  const catalogued = stats.get(reference.statId) ?? reference.statId;
  if (reference.kind === 'valueless') {
    return form === undefined ? { text: catalogued, verbatim: true } : { text: form, verbatim: false };
  }
  return form !== undefined && reference.acceptedTier !== undefined ? { text: `${reference.acceptedTier} ${form}`, verbatim: false } : { text: bandedFallback(catalogued, reference.valueMin, reference.valueMax), verbatim: true };
}

/** The comma that joins the lines of one hybrid affix: `T1 % Phys, Accuracy`. */
const LINE_JOIN = ', ';

// EXPERIENCE.md, *A Hybrid Modifier affix is the tier label, then its lines* (CAP-7).
// Short forms are all or none. Lines sort by printed text in code-unit order, not `statId`,
// so the label never reads `weights.json`.
function hybridText(reference: HybridModifierRef, stats: StatTexts): AffixPart {
  const forms: string[] = [];
  for (const line of reference.lines) {
    const form = 'valueMin' in line ? shortForm(line.statId) : undefined;
    if (form === undefined) {
      break;
    }
    forms.push(form);
  }
  if (reference.acceptedTier !== undefined && forms.length === reference.lines.length) {
    return { text: `${reference.acceptedTier} ${forms.toSorted(compareByCodeUnit).join(LINE_JOIN)}`, verbatim: false };
  }
  const lines = reference.lines.map((line) => {
    const catalogued = stats.get(line.statId) ?? line.statId;
    return 'valueMin' in line ? bandedFallback(catalogued, line.valueMin, line.valueMax) : catalogued;
  });
  return { text: lines.toSorted(compareByCodeUnit).join(LINE_JOIN), verbatim: true };
}

/** A crafted entry's Combination: the prefix, then the suffix. */
export function combinationText(entry: CraftedTrackedEntry, stats: StatTexts): readonly AffixPart[] {
  return [affixText(entry.prefix, stats), affixText(entry.suffix, stats)];
}

/** The parts as one plain string, joined by the middle dot. */
export function combinationString(parts: readonly AffixPart[]): string {
  return parts.map((part) => part.text).join(AFFIX_JOIN);
}
