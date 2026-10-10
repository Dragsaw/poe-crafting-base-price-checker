import type { CSSProperties } from 'react';

/** The four columns of DESIGN.md `ranked-row`, in order. */
export const ROW_COLUMNS = ['rank', 'name', 'ev', 'chase'] as const;

export type RowColumn = (typeof ROW_COLUMNS)[number];

/** One grid cell, shared by the column header, the rows and the skeleton. Rank and EV sit right. */
export function cellStyle(column: RowColumn): CSSProperties {
  return {
    minWidth: 0,
    textAlign: column === 'rank' || column === 'ev' ? 'right' : undefined,
  };
}
