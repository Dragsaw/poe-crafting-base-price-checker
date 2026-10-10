import { Tooltip } from '@mantine/core';
import type { PriceTrust } from '@poe/contracts';
import type { JSX } from 'react';

import { MARK_COLORS, VerdictMark, type MarkedVerdict } from '../../marks/marks';
import { spacing, typeStyle } from '../../theme/tokens';
import { markTooltipParts, TRUST_JOINER } from './trust-words';

/** Opens to the right of the mark, its top 6px above the mark's (DESIGN.md `mark-tooltip`). */
const MARK_TOOLTIP_OFFSET = { mainAxis: 6, crossAxis: -6 } as const;

/** `{components.mark-tooltip}`: the word in the mark colour at 600, then the reason. */
function MarkTooltipLabel({ verdict, word, reason }: { readonly verdict: MarkedVerdict; readonly word: string; readonly reason: string }): JSX.Element {
  return (
    <span data-mark-tooltip={verdict}>
      <span style={{ fontWeight: 600, color: MARK_COLORS[verdict] }}>{word}</span>
      {TRUST_JOINER}
      {reason}
    </span>
  );
}

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
      {parts === undefined || trust.verdict === 'current' ? undefined : (
        <Tooltip
          label={<MarkTooltipLabel verdict={trust.verdict} word={parts.word} reason={parts.reason} />}
          position="right-start"
          offset={MARK_TOOLTIP_OFFSET}
        >
          <span data-row-mark={trust.verdict} style={{ display: 'inline-flex', cursor: 'help' }}>
            <VerdictMark verdict={trust.verdict} />
          </span>
        </Tooltip>
      )}
    </span>
  );
}
