import { Tooltip } from '@mantine/core';
import type { JSX } from 'react';

import { DENOMINATION } from '../shared/product';
import {
  colors,
  COLUMN_HEADER_HEIGHT,
  floatingShadows,
  px,
  layout,
  rankedRowGrid,
  spacing,
  typeRoles,
  typeStyle,
} from '../theme/tokens';
import { cellStyle, ROW_COLUMNS, type RowColumn } from './row/grid';
import { ExpectedValueTooltipLabel, type ExpectedValueCost } from './row/ExpectedValueTooltip';

/** EXPERIENCE.md Copy Deck, *Column headers*. The second label names both ranked units (FR-3). */
export const COLUMN_LABELS: Readonly<Record<RowColumn, string>> = {
  rank: '#',
  name: 'Item class / base',
  ev: `EV (${DENOMINATION})`,
  chase: 'Best combinations',
};

/** What the EV tooltip states: the live threshold and the active recipe's Craft Cost. */
export interface ExpectedValueNote {
  readonly threshold: number;
  readonly cost: ExpectedValueCost;
}

/** DESIGN.md `ev-tooltip`: the mark-tooltip shell, wider, padded, deeper and in the tooltip role. */
const EV_TOOLTIP_STYLES = {
  tooltip: {
    ...typeRoles.tooltip,
    width: '330px',
    padding: '10px 12px',
    boxShadow: floatingShadows['ev-tooltip'],
    color: colors.text,
    whiteSpace: 'normal',
    letterSpacing: 'normal',
    textTransform: 'none',
  },
} as const;

/** DESIGN.md `column-header.evLabel`: dotted underline and help cursor, the look of a hover explanation. */
function ExpectedValueLabel({ note }: { readonly note: ExpectedValueNote | undefined }): JSX.Element {
  if (note === undefined) {
    return (
      <span data-ev-label="" style={{ color: colors['text-secondary'] }}>
        {COLUMN_LABELS.ev}
      </span>
    );
  }
  return (
    <Tooltip
      label={<ExpectedValueTooltipLabel threshold={note.threshold} cost={note.cost} />}
      position="bottom-end"
      multiline
      styles={EV_TOOLTIP_STYLES}
    >
      <span
        data-ev-label=""
        style={{
          color: colors['text-secondary'],
          borderBottom: `1px dotted ${colors['text-tertiary']}`,
          cursor: 'help',
        }}
      >
        {COLUMN_LABELS.ev}
      </span>
    </Tooltip>
  );
}

// No artifact feeds the labels, so the skeleton paints them; only the EV tooltip waits for the data.
export function ColumnHeader({ note }: { readonly note?: ExpectedValueNote }): JSX.Element {
  return (
    <div
      data-column-header=""
      style={{
        ...typeStyle('column-header'),
        ...rankedRowGrid,
        height: COLUMN_HEADER_HEIGHT,
        boxSizing: 'border-box',
        marginTop: px(layout.columnHeaderMarginTop),
        borderBottom: `1px solid ${colors['line-strong']}`,
        color: colors['text-tertiary'],
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {ROW_COLUMNS.map((column) => (
        <div
          key={column}
          data-header-cell={column}
          style={{ ...cellStyle(column), paddingRight: column === 'ev' ? spacing['mark-slot'] : undefined }}
        >
          {column === 'ev' ? <ExpectedValueLabel note={note} /> : COLUMN_LABELS[column]}
        </div>
      ))}
    </div>
  );
}
