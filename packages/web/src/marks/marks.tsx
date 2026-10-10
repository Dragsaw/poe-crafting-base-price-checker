import type { JSX, ReactNode } from 'react';

import { colors } from '../theme/tokens';

/** The three drawn price-trust marks; `current` has none (DESIGN.md `trust-mark`). */
export type MarkedVerdict = 'rough' | 'pending' | 'broken';

/** Each mark's token: `{components.trust-mark}` and `{components.estimate-mark}`. */
export const MARK_COLORS = {
  rough: colors['trust-rough'],
  pending: colors['trust-pending'],
  broken: colors['trust-broken'],
  estimate: colors['trust-rough'],
} as const;

/** 1.5 of 16 units is about a weight-400 stem at 13px; ≈ takes a weight-500 stem. */
const STROKE = 1.5;
const ESTIMATE_STROKE = 1.7;
const RING = { cx: 8, cy: 8, r: 6 } as const;

function MarkBox({ name, color, children }: { readonly name: string; readonly color: string; readonly children: ReactNode }): JSX.Element {
  return (
    <svg
      data-mark={name}
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      style={{ display: 'block', flex: '0 0 auto', color }}
    >
      {children}
    </svg>
  );
}

const DRAWINGS: Readonly<Record<MarkedVerdict, ReactNode>> = {
  rough: (
    <>
      <circle {...RING} />
      <path d="M8 2 A6 6 0 0 0 8 14 Z" fill="currentColor" stroke="none" />
    </>
  ),
  pending: <circle {...RING} />,
  broken: <path d="M2.5 2.5 L13.5 13.5 M13.5 2.5 L2.5 13.5" />,
};

/** ◐ ○ ✕ as inline SVG in a 1em `currentColor` box (DESIGN.md, Typography: marks are drawn). */
export function VerdictMark({ verdict }: { readonly verdict: MarkedVerdict }): JSX.Element {
  return (
    <MarkBox name={verdict} color={MARK_COLORS[verdict]}>
      {DRAWINGS[verdict]}
    </MarkBox>
  );
}

/** ≈: two short wavy strokes, one above the other (DESIGN.md `estimate-mark`). */
export function EstimateMark(): JSX.Element {
  return (
    <MarkBox name="estimate" color={MARK_COLORS.estimate}>
      <path d="M2.5 6.2 C4.3 4.4 6.2 4.4 8 6.2 S11.7 8 13.5 6.2 M2.5 10.8 C4.3 9 6.2 9 8 10.8 S11.7 12.6 13.5 10.8" strokeWidth={ESTIMATE_STROKE} />
    </MarkBox>
  );
}

/** ↗: a straight shaft rising to the upper right with an open arrowhead (DESIGN.md `trade-link`). */
export function TradeLinkMark(): JSX.Element {
  return (
    <MarkBox name="trade-link" color="currentColor">
      <path d="M3.5 12.5 L12.5 3.5 M6 3.5 H12.5 V10" strokeLinejoin="round" />
    </MarkBox>
  );
}
