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
  spacing,
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

/**
 * One Tracked Entry as its combination row prints it. Everything is already
 * text or a resolved state: the row lays it out and decides nothing. A crafted
 * entry fills the same shape with its tier + short-form parts.
 */
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

/**
 * A Combination's text, on either surface: its affixes joined by the middle
 * dot. A fallback affix is set in the mono verbatim register and nothing
 * else — it keeps the line's own size and weight, and takes no ink, mark or
 * glyph (DESIGN.md, Typography; EXPERIENCE.md memlog 138, 208).
 */
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

/**
 * `{components.combination-row}`: two lines under one hairline, each summing
 * to 966px. Line one — the figure — is the Combination, the Price State glyph
 * and word, the price or money phrase, the sample and the trade link. Line two
 * — the evidence — is the note and both labelled ages, each in its own cell,
 * and it is always present. Nothing here truncates, ellipsises or tooltips:
 * line two wraps in whole 20px steps, so 48px is a minimum.
 */
export function CombinationRow({
  combination: row,
  last,
}: {
  readonly combination: Combination;
  readonly last: boolean;
}): JSX.Element {
  const shown = combinationFigure(row.state);
  return (
    <div
      data-combination-row=""
      data-price-state={row.state.state}
      style={{
        minHeight: px(spacing.combinationRowHeight),
        boxSizing: 'border-box',
        borderBottom: last ? undefined : `${px(spacing.hairline)} solid ${colors['rule-hairline']}`,
      }}
    >
      <div
        data-line="1"
        style={{
          ...typeStyle('detail-row'),
          display: 'flex',
          alignItems: 'center',
          height: px(spacing.detailRowHeight),
          whiteSpace: 'nowrap',
          color: colors.ink,
        }}
      >
        <div data-cell="combination" style={fixedCell(combination)}>
          {row.pinned ? (
            <>
              <span data-curation-pinned="" style={{ fontWeight: 600, fontStyle: 'normal', color: colors['ink-tertiary'] }}>
                {`${glyphs.pinned} pinned`}
              </span>{' '}
            </>
          ) : undefined}
          <CombinationText parts={row.text} />
        </div>
        <div data-cell="state" style={{ ...fixedCell(state), ...typeStyle('detail-meta') }}>
          <span
            data-state-glyph=""
            aria-hidden="true"
            style={{ fontSize: '9px', color: row.state.state === 'unresolvable' ? colors.rust : undefined }}
          >
            {PRICE_STATE_GLYPHS[row.state.state]}
            {NBSP}
          </span>
          <span data-state-word="">{stateWord(row.state)}</span>
        </div>
        <div data-cell="figure" style={{ ...fixedCell(figure), textAlign: 'right' }}>
          {shown.kind === 'figure' ? (
            <span data-figure="" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {shown.text}
            </span>
          ) : (
            <span
              data-money-phrase=""
              style={{
                ...typeStyle('money-phrase'),
                fontStyle: 'italic',
                color: row.state.state === 'unresolvable' ? colors.rust : colors.ink,
              }}
            >
              {shown.text}
            </span>
          )}
        </div>
        <div data-cell="sample" style={{ ...fixedCell(sample), ...typeStyle('detail-meta'), color: colors['ink-secondary'] }}>
          {sampleText(row.state)}
        </div>
        <div
          data-cell="trade-link"
          // The glyph alone is the click target; the cell only places it.
          style={{ ...fixedCell(tradeLink), ...typeStyle('detail-meta'), textAlign: 'right' }}
        >
          {row.tradeHref === undefined ? undefined : <TradeGlyph href={row.tradeHref} label={row.tradeLabel} />}
        </div>
      </div>
      <div
        data-line="2"
        style={{
          ...typeStyle('combination-line-2'),
          display: 'flex',
          alignItems: 'flex-start',
          minHeight: px(spacing.combinationRowLine2Height),
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
          color: colors['ink-tertiary'],
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
    </div>
  );
}
