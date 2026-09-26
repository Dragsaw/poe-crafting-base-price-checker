import type { JSX } from 'react';

import { colors, px, rankedRowColumns, spacing } from '../theme/tokens';

export const ROW_SLOT_COUNT = 20;

/** The height of each skeleton bar inside its 28px row. */
const BAR_HEIGHT = 10;

/**
 * The load state: twenty 28px slots in the final six-column layout. Each cell
 * is a flat `paper-inset` bar at its column width less its right padding —
 * DESIGN.md's documented fallback, with no shimmer and no animation. The fill
 * is an open `[NOTE FOR UX]` (state 22).
 */
export function RowSlots(): JSX.Element {
  return (
    <div data-row-slots="" aria-hidden="true">
      {Array.from({ length: ROW_SLOT_COUNT }, (_, row) => (
        <div
          key={row}
          data-row-slot=""
          style={{
            display: 'flex',
            alignItems: 'center',
            width: px(spacing.contentWidth),
            height: px(spacing.rowHeight),
            boxSizing: 'border-box',
            borderBottom: `${px(spacing.hairline)} solid ${colors['rule-hairline']}`,
          }}
        >
          {rankedRowColumns.map((column) => (
            <div
              key={column.name}
              data-cell={column.name}
              style={{
                flex: `0 0 ${px(column.width)}`,
                width: px(column.width),
                boxSizing: 'border-box',
                paddingRight: px(column.padRight),
              }}
            >
              <div style={{ height: px(BAR_HEIGHT), background: colors['paper-inset'] }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
