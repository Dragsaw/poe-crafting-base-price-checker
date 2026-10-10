import type { PriceTrust } from '@poe/contracts';
import type { CSSProperties, JSX } from 'react';

import { EstimateMark } from '../../marks/marks';
import { colors, typeStyle } from '../../theme/tokens';
import type { ExpectedValueCell as Cell } from '../display-rows';
import { cellStyle } from './grid';
import { MarkSlot } from './MarkSlot';

/** The missing figure, printed only beside a mark (EXPERIENCE.md *Missing figures*). */
export const MISSING_FIGURE = '—';

/** DESIGN.md `ranked-row.figure` weights: 650 on ranks 1–5, else 400. */
export const FIGURE_WEIGHT = { emphasised: 650, plain: 400 } as const;

const TABULAR: CSSProperties = { fontVariantNumeric: 'tabular-nums' };

/** ≈ when the odds are estimated, the figure right-aligned, then the reserved mark slot. */
export function ExpectedValueCell({
  ev: cell,
  trust,
  isEstimated,
  isEmphasised,
}: {
  readonly ev: Cell;
  readonly trust: PriceTrust;
  readonly isEstimated: boolean;
  readonly isEmphasised: boolean;
}): JSX.Element {
  return (
    <div data-cell="ev" style={{ ...cellStyle('ev'), display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
      {isEstimated ? (
        <span data-estimate="" style={{ ...typeStyle('mark'), display: 'inline-flex', marginRight: '2px' }}>
          <EstimateMark />
        </span>
      ) : undefined}
      {cell.kind === 'figure' ? (
        <span
          data-ev-figure=""
          data-negative={cell.negative ? '' : undefined}
          style={{
            ...typeStyle('row-figure'),
            ...TABULAR,
            fontWeight: isEmphasised ? FIGURE_WEIGHT.emphasised : FIGURE_WEIGHT.plain,
            color: cell.negative ? colors['text-tertiary'] : colors.text,
          }}
        >
          {cell.text}
        </span>
      ) : (
        <span
          data-ev-missing=""
          style={{ ...typeStyle('row-figure'), fontWeight: FIGURE_WEIGHT.plain, color: colors['text-tertiary'] }}
        >
          {MISSING_FIGURE}
        </span>
      )}
      <MarkSlot trust={trust} />
    </div>
  );
}
