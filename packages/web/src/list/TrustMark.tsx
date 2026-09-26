import type { JSX } from 'react';

import { colors, glyphs } from '../theme/tokens';

export type TrustMarkKind = 'prior' | 'unknown' | 'stale' | 'never' | 'unresolvable';

/** The hair space between a mark's glyph and its word (DESIGN.md, Trust mark). */
export const HAIR_SPACE = ' ';

const MARKS: Readonly<
  Record<TrustMarkKind, { readonly glyph: string; readonly color: string; readonly weight: 600 | 700 }>
> = {
  prior: { glyph: glyphs.prior, color: colors.ochre, weight: 600 },
  unknown: { glyph: glyphs.unknown, color: colors.ochre, weight: 600 },
  stale: { glyph: glyphs.stale, color: colors.rust, weight: 700 },
  never: { glyph: glyphs.stale, color: colors.rust, weight: 700 },
  unresolvable: { glyph: glyphs.unresolvable, color: colors.rust, weight: 700 },
};

/**
 * A trust mark: glyph, hair space, word, in a semantic ink at its weight. Inline
 * text with no background, border or capsule, taking the type size of its line.
 * *never attempted* sets its word in italic, so it reads apart from a merely
 * old row with colour removed (NFR-10). A healthy cell renders no mark at all.
 */
export function TrustMark({ kind, word }: { readonly kind: TrustMarkKind; readonly word: string }): JSX.Element {
  const mark = MARKS[kind];
  return (
    <span data-trust-mark={kind} style={{ color: mark.color, fontWeight: mark.weight }}>
      <span aria-hidden="true">{mark.glyph}</span>
      {HAIR_SPACE}
      <span style={kind === 'never' ? { fontStyle: 'italic' } : undefined}>{word}</span>
    </span>
  );
}
