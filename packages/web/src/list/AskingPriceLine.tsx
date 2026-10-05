import type { JSX } from 'react';

import { colors, px, spacing, typeStyle } from '../theme/tokens';

export const ASKING_PRICE_COPY =
  'Every price here is a current asking price from a live instant-buyout listing. Nothing on this page is an observed sale.';

/** FR-13's only mitigation for Risk R-1: always present, never dismissible, never shortened. */
export function AskingPriceLine(): JSX.Element {
  return (
    <p
      data-asking-price-line=""
      style={{
        ...typeStyle('asking-note'),
        fontStyle: 'italic',
        color: colors.sepia,
        margin: 0,
        padding: `${px(spacing.askingPadTop)} 0 ${px(spacing.askingPadBottom)}`,
      }}
    >
      {ASKING_PRICE_COPY}
    </p>
  );
}
