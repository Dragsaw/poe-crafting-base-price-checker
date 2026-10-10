import type { JSX } from 'react';

import { EstimateMark, MARK_COLORS, SwatchMark, SWATCH_COLORS, VerdictMark, type MarkedVerdict } from '../marks/marks';
import { colors, footerLegend, layout, px, typeStyle } from '../theme/tokens';
import { CURATION_MARKS } from './format';
import { VERDICT_WORDS } from './row/trust-words';

export type LegendItem =
  | { readonly kind: 'swatch'; readonly unit: keyof typeof SWATCH_COLORS; readonly meaning: string }
  | { readonly kind: 'verdict'; readonly verdict: MarkedVerdict; readonly meaning: string }
  | { readonly kind: 'estimate'; readonly meaning: string }
  | { readonly kind: 'text'; readonly meaning: string };

/** EXPERIENCE.md Copy Deck, *Footer legend*: nine items, in deck order. */
export const FOOTER_LEGEND_ITEMS: readonly LegendItem[] = [
  { kind: 'swatch', unit: 'crafted', meaning: 'craft this class' },
  { kind: 'swatch', unit: 'raw', meaning: 'sell this base as is' },
  { kind: 'text', meaning: 'no mark = current price' },
  { kind: 'verdict', verdict: 'rough', meaning: 'unreliable price (a row: 70%+ of its EV)' },
  { kind: 'verdict', verdict: 'pending', meaning: 'no price yet' },
  { kind: 'verdict', verdict: 'broken', meaning: 'can no longer be priced' },
  { kind: 'text', meaning: `${CURATION_MARKS.pruned} · ${CURATION_MARKS.pinned}` },
  { kind: 'estimate', meaning: 'some roll odds estimated' },
  { kind: 'text', meaning: 'Prices are live asking prices, not sales. Read-only. Curation lives in data/tracked.json.' },
];

const MARK_GAP = '0.3em';

function LegendEntry({ item, last }: { readonly item: LegendItem; readonly last: boolean }): JSX.Element {
  return (
    <span
      data-legend-item={item.kind}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: MARK_GAP,
        whiteSpace: 'nowrap',
        marginLeft: last ? 'auto' : undefined,
      }}
    >
      {item.kind === 'swatch' ? <SwatchMark unit={item.unit} /> : undefined}
      {item.kind === 'estimate' ? <EstimateMark /> : undefined}
      {item.kind === 'verdict' ? (
        <>
          <VerdictMark verdict={item.verdict} />
          <span data-legend-word="" style={{ color: MARK_COLORS[item.verdict], fontWeight: 600 }}>
            {VERDICT_WORDS[item.verdict]}
          </span>
        </>
      ) : undefined}
      <span data-legend-meaning="">{item.meaning}</span>
    </span>
  );
}

/** `{components.footer-legend}`: after the content, never pinned; absent from the failure screens. */
export function FooterLegend(): JSX.Element {
  return (
    <footer
      data-footer-legend=""
      style={{
        ...typeStyle('note'),
        display: 'flex',
        flexWrap: 'wrap',
        gap: px(footerLegend.gap),
        marginTop: px(footerLegend.marginTop),
        paddingTop: px(footerLegend.paddingTop),
        paddingBottom: px(layout.s6),
        borderTop: `${px(layout.hairline)} solid ${colors.line}`,
        color: colors['text-secondary'],
      }}
    >
      {FOOTER_LEGEND_ITEMS.map((item, index) => (
        <LegendEntry key={item.meaning} item={item} last={index === FOOTER_LEGEND_ITEMS.length - 1} />
      ))}
    </footer>
  );
}
