import { Tooltip } from '@mantine/core';
import type { PriceTrust } from '@poe/contracts';
import type { JSX } from 'react';

import { VerdictMark } from '../../marks/marks';
import { spacing, typeStyle } from '../../theme/tokens';
import { markTooltipParts } from './trust-words';
import { TrustWords } from './TrustWords';

/** Opens to the right of the mark, its top 6px above the mark's (DESIGN.md `mark-tooltip`). */
const MARK_TOOLTIP_OFFSET = { mainAxis: 6, crossAxis: -6 } as const;

/** Always reserved, so every figure ends at one x; a current price renders no element (DESIGN.md `trust-mark`). */
export function MarkSlot({ trust }: { readonly trust: PriceTrust }): JSX.Element {
  const parts = markTooltipParts(trust);
  return (
    <span
      data-mark-slot=""
      style={{
        ...typeStyle('mark'),
        flex: `0 0 ${spacing['mark-slot']}`,
        width: spacing['mark-slot'],
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {parts === undefined ? undefined : (
        <Tooltip
          label={
            <span data-mark-tooltip={parts.verdict}>
              <TrustWords parts={parts} fontWeight={600} />
            </span>
          }
          position="right-start"
          offset={MARK_TOOLTIP_OFFSET}
        >
          <span data-row-mark={parts.verdict} style={{ display: 'inline-flex', cursor: 'help' }}>
            <VerdictMark verdict={parts.verdict} />
          </span>
        </Tooltip>
      )}
    </span>
  );
}
