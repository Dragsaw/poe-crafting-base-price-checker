import './frame.css';

import type { JSX } from 'react';

import { glyphs } from '../theme/tokens';

// `↗` is pinned at weight 400: U+2197 falls out of Segoe UI at 600 or 700
// (DESIGN.md `{components.trade-link}`). Story 2.5 decides when it renders (AD-24).
export function TradeGlyph({ href, label }: { readonly href: string; readonly label: string }): JSX.Element {
  return (
    <a className="fg-trade-glyph" href={href} target="_blank" rel="noopener" aria-label={label} style={{ fontWeight: 400 }}>
      {glyphs.tradeLink}
    </a>
  );
}
