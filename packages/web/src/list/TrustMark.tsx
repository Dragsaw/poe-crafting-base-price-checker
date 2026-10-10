import type { JSX } from 'react';

import { colors, glyphs } from '../theme/tokens';

export type TrustMarkKind = 'prior' | 'unknown' | 'stale' | 'never' | 'unresolvable';

/** The hair space between a mark's glyph and its word (DESIGN.md, Trust mark). */
export const HAIR_SPACE = '\u{200A}';

const MARKS: Readonly<
  Record<TrustMarkKind, { readonly glyph: string; readonly color: string; readonly weight: 600 | 700 }>
> = {
  prior: { glyph: glyphs.prior, color: colors['trust-rough'], weight: 600 },
  unknown: { glyph: glyphs.unknown, color: colors['trust-rough'], weight: 600 },
  stale: { glyph: glyphs.stale, color: colors['trust-broken'], weight: 700 },
  never: { glyph: glyphs.stale, color: colors['trust-broken'], weight: 700 },
  unresolvable: { glyph: glyphs.unresolvable, color: colors['trust-broken'], weight: 700 },
};

export function TrustMark({ kind, word }: { readonly kind: TrustMarkKind; readonly word: string }): JSX.Element {
  const mark = MARKS[kind];
  return (
    <span data-trust-mark={kind} style={{ color: mark.color, fontWeight: mark.weight }}>
      <span aria-hidden="true">{mark.glyph}</span>
      {HAIR_SPACE}
      <span>{word}</span>
    </span>
  );
}
