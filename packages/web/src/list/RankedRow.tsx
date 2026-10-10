import './list.css';

import { Tooltip } from '@mantine/core';
import { useState, type CSSProperties, type JSX } from 'react';

import { colors, markTooltipInset, rankedRowGrid, spacing, typeStyle } from '../theme/tokens';
import type { ChaseCellCount } from './ranked-list/chase-count';
import type { AffixPart } from './combination-text';
import { CHASE_CELLS, type ListRow } from './display-rows';
import { CombinationText, type CombinationTones } from './expansion/CombinationText';
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

const CHASE_CELL: CSSProperties = { ...ELLIPSIS, minWidth: 0, color: colors['rarity-magic-dim'] };

/** An open row's rule turns transparent so it joins its panel; the last row draws none (DESIGN.md *Density*). */
function rowStyle(isOpen: boolean, isLast: boolean): CSSProperties {
  return {
    ...rankedRowGrid,
    height: spacing['row-height'],
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
    borderBottom: `1px solid ${isOpen || isLast ? 'transparent' : colors.line}`,
    boxShadow: isOpen ? `inset ${spacing['open-row-bar']} 0 0 ${colors.accent}` : undefined,
  };
}

/** Hover and open tones live in `list.css`; the open bar is inset, so no column moves. */
export function RankedRow({
  row,
  open,
  onToggle,
  chaseCells = CHASE_CELLS,
  last = false,
}: {
  readonly row: ListRow;
  readonly open: boolean;
  readonly onToggle: (key: string) => void;
  /** One count for every crafted row of the page (`useChaseCellCount`). */
  readonly chaseCells?: ChaseCellCount;
  /** The list's last row, or the row above show-more: it draws no rule (DESIGN.md *Density*). */
  readonly last?: boolean;
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
      style={rowStyle(open, last)}
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
      {isRaw ? <SellAsIsCell itemLevel={row.itemLevel} /> : <ChaseCells chase={row.chase} count={chaseCells} />}
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

function ChaseCells({
  chase,
  count,
}: {
  readonly chase: Extract<ListRow, { unit: 'class' }>['chase'];
  readonly count: ChaseCellCount;
}): JSX.Element {
  return (
    <div
      data-cell="chase"
      style={{
        ...cellStyle('chase'),
        ...typeStyle('chase'),
        display: 'grid',
        gridTemplateColumns: `repeat(${String(count)}, minmax(0, 1fr))`,
        columnGap: spacing['chase-gap'],
      }}
    >
      {CHASE_SLOTS.slice(0, count).map((slot) => {
        const parts = chase[slot];
        return parts === undefined ? <div key={slot} data-chase-cell="" style={CHASE_CELL} /> : <ChaseCell key={slot} parts={parts} />;
      })}
    </div>
  );
}

/** Opens under the cell, its text on the cell's left edge (DESIGN.md `chase-cell.cutHover`). */
const CUT_TOOLTIP_OFFSET = { mainAxis: 4, crossAxis: -(markTooltipInset.padding + markTooltipInset.border) } as const;

/** The row's dim tones fail the contrast floor on the raised step (DESIGN.md `chase-cell.cutHover`). */
const CUT_TONES: CombinationTones = { tier: colors['text-secondary'], joiner: colors['text-secondary'] };

/** A filled cell; only a cell its width cut opens its full text on hover (EXPERIENCE.md Interaction 8). */
function ChaseCell({ parts }: { readonly parts: readonly AffixPart[] }): JSX.Element {
  const [isOpen, setOpen] = useState(false);
  return (
    <Tooltip
      opened={isOpen}
      position="bottom-start"
      offset={CUT_TOOLTIP_OFFSET}
      label={
        <span data-chase-tooltip="" style={{ ...typeStyle('chase'), color: colors['rarity-magic'] }}>
          <CombinationText parts={parts} tones={CUT_TONES} />
        </span>
      }
    >
      <div
        data-chase-cell=""
        style={CHASE_CELL}
        onPointerEnter={(event) => {
          // Read at hover, so a width change since the last hover needs no observer.
          setOpen(event.currentTarget.scrollWidth > event.currentTarget.clientWidth);
        }}
        onPointerLeave={() => {
          setOpen(false);
        }}
      >
        <CombinationText parts={parts} />
      </div>
    </Tooltip>
  );
}
