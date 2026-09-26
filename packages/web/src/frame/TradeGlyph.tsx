import './frame.css';

import type { JSX } from 'react';

import { glyphs } from '../theme/tokens';

/**
 * The trade link's glyph, `↗`, PINNED at weight 400: U+2197 is resident in
 * Segoe UI Regular only, and falls out of the face at 600 or 700. It takes the
 * type size of the line it sits in. The glyph is the whole click target.
 * Story 2.5 decides when it renders (AD-24).
 */
export function TradeGlyph({ href, label }: { readonly href: string; readonly label: string }): JSX.Element {
  return (
    <a className="fg-trade-glyph" href={href} target="_blank" rel="noopener" aria-label={label} style={{ fontWeight: 400 }}>
      {glyphs.tradeLink}
    </a>
  );
}
