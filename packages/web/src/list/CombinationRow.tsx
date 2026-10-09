import { Fragment, type JSX } from 'react';

import { TradeGlyph } from '../frame/TradeGlyph';
import { fixedCell } from '../shared/cell';
import { NBSP } from '../shared/text';
import {
  colors,
  combinationLine1Columns,
  combinationLine2Columns,
  glyphs,
  px,
  layout,
  stacks,
  typeStyle,
} from '../theme/tokens';
import { AFFIX_JOIN, type AffixPart } from './combination-text';
import {
  combinationFigure,
  PRICE_STATE_GLYPHS,
  sampleText,
  stateWord,
  type CombinationAges,
  type CombinationState,
} from './format';

/** One Tracked Entry as its row prints it: text or a resolved state, so the row decides nothing. */
export interface Combination {
  readonly key: string;
  /** The Combination, one part per affix (`combinationText`): `no affixes` for a Raw Base. */
  readonly text: readonly AffixPart[];
  /** `{components.curation-status-pinned}` leads the combination cell. `active` is marked by nothing. */
  readonly pinned: boolean;
  readonly state: CombinationState;
  readonly note: string;
  readonly ages: CombinationAges;
  /** The trade search, or `undefined` for a blank cell. */
  readonly tradeHref: string | undefined;
  /** The link's accessible name. */
  readonly tradeLabel: string;
}

/** A fallback affix is set in the mono verbatim register only: no colour, mark or glyph. */
export function CombinationText({ parts }: { readonly parts: readonly AffixPart[] }): JSX.Element {
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index === 0 ? undefined : AFFIX_JOIN}
          {part.verbatim ? (
            <span data-verbatim="" style={{ fontFamily: stacks.mono }}>
              {part.text}
            </span>
          ) : (
            <span data-affix="">{part.text}</span>
          )}
        </Fragment>
      ))}
    </>
  );
}

const [combination, state, figure, sample, tradeLink] = combinationLine1Columns;
const [note, observed, attempted] = combinationLine2Columns;

/** `{components.combination-row}`: two 966px lines; line two wraps in 20px steps, no truncation. */
export function CombinationRow({
  combination: row,
  last,
}: {
  readonly combination: Combination;
  readonly last: boolean;
}): JSX.Element {
  return (
    <div
      data-combination-row=""
      data-price-state={row.state.state}
      style={{
        minHeight: px(layout.combinationRowHeight),
        boxSizing: 'border-box',
        borderBottom: last ? undefined : `${px(layout.hairline)} solid ${colors.line}`,
      }}
    >
      <FigureLine row={row} />
      <EvidenceLine row={row} />
    </div>
  );
}

function FigureLine({ row }: { readonly row: Combination }): JSX.Element {
  return (
    <div
      data-line="1"
      style={{
        ...typeStyle('line-text'),
        display: 'flex',
        alignItems: 'center',
        height: px(layout.detailRowHeight),
        whiteSpace: 'nowrap',
        color: colors.text,
      }}
    >
      <div data-cell="combination" style={fixedCell(combination)}>
        {row.pinned ? (
          <>
            <span data-curation-pinned="" style={{ fontWeight: 600, fontStyle: 'normal', color: colors['text-tertiary'] }}>
              {`${glyphs.pinned} pinned`}
            </span>{' '}
          </>
        ) : undefined}
        <CombinationText parts={row.text} />
      </div>
      <div data-cell="state" style={{ ...fixedCell(state), ...typeStyle('trust') }}>
        <span
          data-state-glyph=""
          aria-hidden="true"
          style={{ fontSize: '9px', color: row.state.state === 'unresolvable' ? colors['trust-broken'] : undefined }}
        >
          {PRICE_STATE_GLYPHS[row.state.state]}
          {NBSP}
        </span>
        <span data-state-word="">{stateWord(row.state)}</span>
      </div>
      <div data-cell="figure" style={{ ...fixedCell(figure), textAlign: 'right' }}>
        <FigureValue state={row.state} />
      </div>
      <div data-cell="sample" style={{ ...fixedCell(sample), ...typeStyle('trust'), color: colors['text-secondary'] }}>
        {sampleText(row.state)}
      </div>
      <div
        data-cell="trade-link"
        // The glyph alone is the click target; the cell only places it.
        style={{ ...fixedCell(tradeLink), ...typeStyle('trust'), textAlign: 'right' }}
      >
        {row.tradeHref === undefined ? undefined : <TradeGlyph href={row.tradeHref} label={row.tradeLabel} />}
      </div>
    </div>
  );
}

function FigureValue({ state: priceState }: { readonly state: CombinationState }): JSX.Element {
  const shown = combinationFigure(priceState);
  return shown.kind === 'figure' ? (
    <span data-figure="" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {shown.text}
    </span>
  ) : (
    <span
      data-money-phrase=""
      style={{
        ...typeStyle('trust'),
        fontStyle: 'italic',
        color: priceState.state === 'unresolvable' ? colors['trust-broken'] : colors.text,
      }}
    >
      {shown.text}
    </span>
  );
}

function EvidenceLine({ row }: { readonly row: Combination }): JSX.Element {
  return (
    <div
      data-line="2"
      style={{
        ...typeStyle('note'),
        lineHeight: px(layout.combinationRowLine2Height),
        display: 'flex',
        alignItems: 'flex-start',
        minHeight: px(layout.combinationRowLine2Height),
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
        color: colors['text-tertiary'],
      }}
    >
      <div data-cell="note" style={{ ...fixedCell(note), fontStyle: 'italic' }}>
        {row.note}
      </div>
      <div data-cell="observed" style={fixedCell(observed)}>
        {row.ages.observed}
      </div>
      <div data-cell="attempted" style={fixedCell(attempted)}>
        {row.ages.attempted}
      </div>
    </div>
  );
}
