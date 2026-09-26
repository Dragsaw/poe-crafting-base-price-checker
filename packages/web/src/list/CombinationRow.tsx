import type { CSSProperties, JSX } from 'react';

import { TradeGlyph } from '../frame/TradeGlyph';
import {
  colors,
  combinationLine1Columns,
  combinationLine2Columns,
  glyphs,
  px,
  spacing,
  typeStyle,
} from '../theme/tokens';
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
 * text or a resolved state: the row lays it out and decides nothing. Epic 3's
 * crafted entries fill the same shape with a tier + short-form `text`.
 */
export interface Combination {
  readonly key: string;
  /** The Combination: `no affixes` for a Raw Base. */
  readonly text: string;
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

const [combination, state, figure, sample, tradeLink] = combinationLine1Columns;
const [note, observed, attempted] = combinationLine2Columns;

function cell(column: { readonly width: number; readonly padRight: number }): CSSProperties {
  return {
    flex: '0 0 auto',
    width: px(column.width),
    paddingRight: column.padRight === 0 ? undefined : px(column.padRight),
    boxSizing: 'border-box',
  };
}

/** A no-break space: a Price State glyph never parts from its word (mockup `.ps-*::before`). */
const NBSP = '\u00a0';

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
        <div data-cell="combination" style={cell(combination)}>
          {row.pinned ? (
            <>
              <span data-curation-pinned="" style={{ fontWeight: 600, fontStyle: 'normal', color: colors['ink-tertiary'] }}>
                {`${glyphs.pinned} pinned`}
              </span>{' '}
            </>
          ) : null}
          {row.text}
        </div>
        <div data-cell="state" style={{ ...cell(state), ...typeStyle('detail-meta') }}>
          <span data-state-glyph="" aria-hidden="true" style={{ fontSize: '9px' }}>
            {PRICE_STATE_GLYPHS[row.state.state]}
            {NBSP}
          </span>
          <span data-state-word="">{stateWord(row.state)}</span>
        </div>
        <div data-cell="figure" style={{ ...cell(figure), textAlign: 'right' }}>
          {shown.kind === 'figure' ? (
            <span data-figure="" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {shown.text}
            </span>
          ) : (
            <span data-money-phrase="" style={{ ...typeStyle('money-phrase'), fontStyle: 'italic', color: colors.ink }}>
              {shown.text}
            </span>
          )}
        </div>
        <div data-cell="sample" style={{ ...cell(sample), ...typeStyle('detail-meta'), color: colors['ink-secondary'] }}>
          {sampleText(row.state)}
        </div>
        <div
          data-cell="trade-link"
          // The glyph alone is the click target; the cell only places it.
          style={{ ...cell(tradeLink), ...typeStyle('detail-meta'), textAlign: 'right' }}
        >
          {row.tradeHref === undefined ? null : <TradeGlyph href={row.tradeHref} label={row.tradeLabel} />}
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
        <div data-cell="note" style={{ ...cell(note), fontStyle: 'italic' }}>
          {row.note}
        </div>
        <div data-cell="observed" style={cell(observed)}>
          {row.ages.observed ?? null}
        </div>
        <div data-cell="attempted" style={cell(attempted)}>
          {row.ages.attempted ?? null}
        </div>
      </div>
    </div>
  );
}
