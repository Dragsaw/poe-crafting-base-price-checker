import './expansion.css';

import type { PriceTrust } from '@poe/contracts';
import type { CSSProperties, JSX } from 'react';

import { TradeLinkMark, VerdictMark } from '../../marks/marks';
import { formatDivine } from '../../shared/money';
import { colors, expansionLineGrid, expansionLineWidths, typeStyle } from '../../theme/tokens';
import type { AffixPart } from '../combination-text';
import { BELOW_THRESHOLD_NOTE, CURATION_MARKS } from '../format';
import { MISSING_FIGURE } from '../row/ExpectedValueCell';
import { lineTrustParts } from '../row/trust-words';
import { TrustWords } from '../row/TrustWords';
import { CombinationText } from './CombinationText';

/** One expansion line as it prints; every fact on it comes from `core` or the dataset. */
export interface LineView {
  readonly key: string;
  /** The Combination; empty on a Raw Base, whose context line names it. */
  readonly text: readonly AffixPart[];
  readonly isPinned: boolean;
  /** The price in Divine, or `undefined` where `—` prints beside the mark. */
  readonly price: number | undefined;
  readonly trust: PriceTrust;
  readonly isBelowThreshold: boolean;
  /** The trade search, or `undefined` for an empty cell (Interaction 6). */
  readonly tradeHref: string | undefined;
  /** The link's accessible name. */
  readonly tradeLabel: string;
}

const TABULAR: CSSProperties = { fontVariantNumeric: 'tabular-nums' };

/** DESIGN.md `expansion-line.pinnedMark`: a lookup key at 600, never an attention colour. */
const CURATION_MARK: CSSProperties = { fontWeight: 600, color: colors['text-tertiary'] };

/** One line high, a hairline above, nothing cut and nothing that answers the pointer but ↗. */
const LINE: CSSProperties = {
  ...expansionLineGrid,
  borderTop: `1px solid ${colors.line}`,
  whiteSpace: 'nowrap',
};

function PriceCell({ price, isDimmed }: { readonly price: number | undefined; readonly isDimmed: boolean }): JSX.Element {
  const isMissing = price === undefined;
  return (
    <div
      data-cell="price"
      style={{
        ...typeStyle('line-text'),
        ...TABULAR,
        textAlign: 'right',
        fontWeight: isMissing || isDimmed ? 400 : 500,
        color: isMissing || isDimmed ? colors['text-tertiary'] : colors.text,
      }}
    >
      {isMissing ? MISSING_FIGURE : formatDivine(price)}
    </div>
  );
}

/** DESIGN.md `trust-mark.onLine`: the mark, 6px, the word in the mark colour, then ` · <reason>`. */
function TrustCell({ trust, isBelowThreshold }: { readonly trust: PriceTrust; readonly isBelowThreshold: boolean }): JSX.Element {
  const parts = lineTrustParts(trust);
  // Inline, not flex: a flex item drops the joiner's leading space before `·`.
  const style: CSSProperties = { ...typeStyle('trust'), color: colors['text-secondary'] };
  if (isBelowThreshold) {
    return (
      <div data-cell="trust" style={style}>
        <span data-below-threshold="">{BELOW_THRESHOLD_NOTE}</span>
      </div>
    );
  }
  return (
    <div data-cell="trust" style={style}>
      {parts === undefined ? undefined : (
        <>
          <span data-line-mark={parts.verdict} style={{ display: 'inline-flex', verticalAlign: '-0.125em', marginRight: '6px' }}>
            <VerdictMark verdict={parts.verdict} />
          </span>
          <TrustWords parts={parts} isTagged />
        </>
      )}
    </div>
  );
}

/** DESIGN.md `trade-link`: the drawn ↗ is the whole target; no link leaves the cell empty. */
function TradeLinkCell({ href, label }: { readonly href: string | undefined; readonly label: string }): JSX.Element {
  return (
    <div data-cell="trade-link" style={{ ...typeStyle('line-text'), display: 'flex', justifyContent: 'center' }}>
      {href === undefined ? undefined : (
        <a className="fg-trade-link" href={href} target="_blank" rel="noopener" aria-label={label}>
          <TradeLinkMark />
        </a>
      )}
    </div>
  );
}

/** `{components.expansion-line}`: states 1–9 and 20. */
export function ExpansionLine({ line }: { readonly line: LineView }): JSX.Element {
  const isDimmed = line.isBelowThreshold;
  return (
    <div
      data-expansion-line=""
      data-verdict={line.trust.verdict}
      data-below-threshold={isDimmed ? '' : undefined}
      style={LINE}
    >
      <div
        data-cell="combination"
        style={{ ...typeStyle('line-text'), color: isDimmed ? colors['text-tertiary'] : colors['rarity-magic'] }}
      >
        {line.isPinned ? (
          <span data-curation="pinned" style={CURATION_MARK}>
            {CURATION_MARKS.pinned}
          </span>
        ) : undefined}
        {line.isPinned && line.text.length > 0 ? ' ' : undefined}
        <CombinationText
          parts={line.text}
          tones={{ tier: isDimmed ? colors['text-tertiary'] : colors['text-secondary'], joiner: colors['text-tertiary'] }}
        />
      </div>
      <PriceCell price={line.price} isDimmed={isDimmed} />
      <TrustCell trust={line.trust} isBelowThreshold={isDimmed} />
      <TradeLinkCell href={line.tradeHref} label={line.tradeLabel} />
    </div>
  );
}

/** State 10: struck through, led by `† pruned`, `—`, no trust and no link, then the reason line. */
export function PrunedLine({ text, reason }: { readonly text: readonly AffixPart[]; readonly reason: string }): JSX.Element {
  return (
    <div data-pruned-line="" style={{ borderTop: `1px solid ${colors.line}` }}>
      <div style={{ ...LINE, borderTop: undefined }}>
        <div data-cell="combination" style={{ ...typeStyle('line-text'), color: colors['text-tertiary'] }}>
          <span data-curation="pruned" style={CURATION_MARK}>
            {CURATION_MARKS.pruned}
          </span>{' '}
          <span data-struck="" style={{ textDecoration: 'line-through' }}>
            <CombinationText parts={text} tones={{ tier: colors['text-tertiary'], joiner: colors['text-tertiary'] }} />
          </span>
        </div>
        <PriceCell price={undefined} isDimmed />
        <div data-cell="trust" />
        <div data-cell="trade-link" />
      </div>
      <div
        data-prune-reason=""
        style={{ ...typeStyle('note'), paddingRight: expansionLineWidths.paddingRight, color: colors['text-tertiary'] }}
      >
        {reason}
      </div>
    </div>
  );
}
