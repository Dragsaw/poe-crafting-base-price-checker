import './list.css';

import type { CSSProperties, JSX } from 'react';

import { colors, rankedRowGrid, spacing, typeStyle } from '../theme/tokens';
import { CHASE_CELLS, type ListRow } from './display-rows';
import { CombinationText } from './expansion/CombinationText';
import { itemLevelFloor, SELL_AS_IS } from './format';
import { ExpectedValueCell } from './row/ExpectedValueCell';
import { cellStyle } from './row/grid';
import { TRUST_JOINER } from './row/trust-words';

const TABULAR: CSSProperties = { fontVariantNumeric: 'tabular-nums' };

/** DESIGN.md `ranked-row`: ranks 1–5 are emphasised by weight and numeral colour, never by size. */
export const RANK_EMPHASIS = {
  emphasised: { rank: 600, name: 600, color: colors.text },
  plain: { rank: 400, name: 500, color: colors['text-tertiary'] },
} as const;

/** The name's rarity colour: magic for a crafted Item Class, normal for a Raw Base (DESIGN.md `ranked-row`). */
export const NAME_COLORS = { class: colors['rarity-magic'], raw: colors['rarity-normal'] } as const;

/** The chase slots. An unused slot stays an empty cell (state 21). */
const CHASE_SLOTS = Array.from({ length: CHASE_CELLS }, (_, slot) => slot);

const ELLIPSIS: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

/** Hover and open tones live in `list.css`; the open bar is inset, so no column moves. */
export function RankedRow({
  row,
  open,
  onToggle,
}: {
  readonly row: ListRow;
  readonly open: boolean;
  readonly onToggle: (key: string) => void;
}): JSX.Element {
  const isEmphasised = row.tier === 1;
  const emphasis = isEmphasised ? RANK_EMPHASIS.emphasised : RANK_EMPHASIS.plain;
  const isRaw = row.unit === 'raw';

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
        ...rankedRowGrid,
        height: spacing['row-height'],
        boxSizing: 'border-box',
        whiteSpace: 'nowrap',
        borderBottom: `1px solid ${open ? 'transparent' : colors.line}`,
        boxShadow: open ? `inset ${spacing['open-row-bar']} 0 0 ${colors.accent}` : undefined,
      }}
    >
      <div
        data-cell="rank"
        style={{ ...cellStyle('rank'), ...typeStyle('row-rank'), ...TABULAR, fontWeight: emphasis.rank, color: emphasis.color }}
      >
        {row.numeral}
      </div>
      <div data-cell="name" style={{ ...cellStyle('name'), ...typeStyle('row-name') }}>
        <span
          data-unit-name=""
          style={{ ...ELLIPSIS, display: 'block', fontWeight: emphasis.name, color: NAME_COLORS[row.unit] }}
        >
          {row.label}
        </span>
      </div>
      <ExpectedValueCell
        ev={row.ev}
        trust={row.trust}
        isEstimated={row.unit === 'class' && row.provenance === 'uniform-prior'}
        isEmphasised={isEmphasised}
      />
      {isRaw ? <SellAsIsCell itemLevel={row.itemLevel} /> : <ChaseCells chase={row.chase} />}
    </div>
  );
}

/** DESIGN.md `ranked-row.chaseRaw`: the line that tells a Raw Base from a crafted class without colour. */
function SellAsIsCell({ itemLevel }: { readonly itemLevel: number }): JSX.Element {
  return (
    <div data-cell="chase" style={{ ...cellStyle('chase'), ...typeStyle('chase'), ...ELLIPSIS, color: colors['text-secondary'] }}>
      <span data-sell-as-is="">
        <span style={{ fontWeight: 600, color: colors['rarity-normal'] }}>{SELL_AS_IS}</span>
        {TRUST_JOINER}
        {itemLevelFloor(itemLevel)}
      </span>
    </div>
  );
}

function ChaseCells({ chase }: { readonly chase: Extract<ListRow, { unit: 'class' }>['chase'] }): JSX.Element {
  return (
    <div
      data-cell="chase"
      style={{
        ...cellStyle('chase'),
        ...typeStyle('chase'),
        display: 'grid',
        gridTemplateColumns: `repeat(${String(CHASE_CELLS)}, minmax(0, 1fr))`,
        columnGap: spacing['chase-gap'],
      }}
    >
      {CHASE_SLOTS.map((slot) => {
        const parts = chase[slot];
        return (
          <div key={slot} data-chase-cell="" style={{ ...ELLIPSIS, minWidth: 0, color: colors['rarity-magic-dim'] }}>
            {parts === undefined ? undefined : <CombinationText parts={parts} />}
          </div>
        );
      })}
    </div>
  );
}
