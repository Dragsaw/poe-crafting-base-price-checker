import './list.css';

import type { CSSProperties, JSX } from 'react';

import { colors, px, rankedRowColumns, spacing, typeStyle } from '../theme/tokens';
import { fixedCell } from '../shared/cell';
import { cellStyle } from './ColumnHeader';
import { CombinationText } from './CombinationRow';
import { CHASE_CELLS, type ListRow } from './display-rows';
import { MONEY_PHRASES, rawNote } from './format';
import { TrustMark } from './TrustMark';
import { UnitGlyph } from './UnitGlyph';

/** The row mark's word for `uniform-prior`: never the enum value, never a `weightSource` word. */
export const PRIOR_ONLY = 'prior only';

const TABULAR: CSSProperties = { fontVariantNumeric: 'tabular-nums' };

/** Rank-numeral colour per tier; tier 1 also sets the numeral, name and EV at 700 (DESIGN.md `ranked-row-tier-*`). */
const RANK_COLOR = { 1: colors.sepia, 2: colors['ink-secondary'], 3: colors['ink-tertiary'] } as const;

const [rank, unit, event, provenance, age, chase] = rankedRowColumns;
const COLUMNS = { rank, unit, ev: event, provenance, age, chase } as const;

/** The three chase slots. An unused slot stays an empty cell (state 21). */
const CHASE_SLOTS = Array.from({ length: CHASE_CELLS }, (_, slot) => slot);

/**
 * One 28px ranked row in the six-cell contract. The whole row is one toggle
 * target: no per-row control, no tooltip. Hover and pointer-down tones live in
 * `list.css`, so the background is never inline. An open row takes the 3px
 * sepia `openMarker`, bled into the gutter on a negative left margin so no
 * column moves, and promotes its bottom rule to `rule-strong`.
 *
 * A Raw Base row carries three cues — the `paper-raw` tint, the italic name and
 * `▪` — and one full-width italic note in place of the chase cells. Its
 * Provenance cell is empty, as a healthy crafted row's is (state 12a). A
 * crafted row holds three fixed 164px chase cells, each ellipsising on one
 * line in `ink-secondary`, `ink-chase-emphasis` on tier 1.
 */
export function RankedRow({
  row,
  open,
  onToggle,
}: {
  readonly row: ListRow;
  readonly open: boolean;
  readonly onToggle: (key: string) => void;
}): JSX.Element {
  const strong = row.tier === 1 ? 700 : 400;
  const isRaw = row.unit === 'raw';
  const marker = open ? spacing.openRowMarker : 0;

  return (
    <div
      data-ranked-row=""
      data-tier={row.tier}
      data-raw={isRaw ? '' : undefined}
      data-open={open ? '' : undefined}
      className="fg-row"
      onClick={() => {
        onToggle(row.key);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: px(spacing.contentWidth + marker),
        marginLeft: marker === 0 ? undefined : px(-marker),
        height: px(spacing.rowHeight),
        boxSizing: 'border-box',
        borderLeft: marker === 0 ? undefined : `${px(marker)} solid ${colors.sepia}`,
        borderBottom: `${px(spacing.hairline)} solid ${open ? colors['rule-strong'] : colors['rule-hairline']}`,
        whiteSpace: 'nowrap',
      }}
    >
      <div
        data-cell="rank"
        style={{
          ...cellStyle(COLUMNS.rank),
          ...typeStyle('row-rank'),
          ...TABULAR,
          fontWeight: strong,
          color: RANK_COLOR[row.tier],
        }}
      >
        {row.numeral === undefined ? null : row.numeral}
      </div>
      <div
        data-cell="unit"
        style={{ ...cellStyle(COLUMNS.unit), ...typeStyle('row-unit-name'), display: 'flex', alignItems: 'baseline', color: colors.ink }}
      >
        <UnitGlyph unit={row.unit} />
        <span
          data-unit-name=""
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontWeight: strong,
            fontStyle: isRaw ? 'italic' : 'normal',
          }}
        >
          {row.label}
        </span>
      </div>
      <div data-cell="ev" style={{ ...cellStyle(COLUMNS.ev), overflow: 'hidden' }}>
        {row.ev.kind === 'figure' ? (
          <span data-ev-figure="" style={{ ...typeStyle('row-ev'), ...TABULAR, fontWeight: strong, color: colors.ink }}>
            {row.ev.text}
          </span>
        ) : (
          <span
            data-money-phrase=""
            style={{
              ...typeStyle('money-phrase'),
              fontStyle: 'italic',
              // The colour follows the phrase shown: an honest-empty `unresolvable` row reads *no figure yet* in ink.
              color: row.ev.text === MONEY_PHRASES.unresolvable ? colors.rust : colors.ink,
            }}
          >
            {row.ev.text}
          </span>
        )}
      </div>
      <div data-cell="provenance" style={{ ...cellStyle(COLUMNS.provenance), ...typeStyle('row-mark') }}>
        {row.unit === 'class' && row.provenance === 'uniform-prior' ? (
          <TrustMark kind="prior" word={PRIOR_ONLY} />
        ) : null}
      </div>
      <div data-cell="age" style={{ ...cellStyle(COLUMNS.age), ...typeStyle('row-mark') }}>
        {row.age === undefined ? null : <TrustMark kind={row.age.kind} word={row.age.word} />}
      </div>
      <div
        data-cell="chase"
        style={{
          ...cellStyle(COLUMNS.chase),
          ...typeStyle('row-chase'),
          overflow: 'hidden',
          // A crafted row's three cells carry `pad-chase-cell-right` each, so the column pads nothing more.
          ...(!isRaw && { display: 'flex', paddingRight: undefined }),
        }}
      >
        {isRaw ? (
          <span
            data-raw-note=""
            style={{
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontStyle: 'italic',
              color: colors['ink-tertiary'],
            }}
          >
            {rawNote(row.itemLevel)}
          </span>
        ) : (
          CHASE_SLOTS.map((slot) => {
            const parts = row.chase[slot];
            return (
              <div
                key={slot}
                data-chase-cell=""
                style={{
                  ...fixedCell({ width: spacing.chaseCell, padRight: spacing.padChaseCellRight }),
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: row.tier === 1 ? colors['ink-chase-emphasis'] : colors['ink-secondary'],
                }}
              >
                {parts === undefined ? null : <CombinationText parts={parts} />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
