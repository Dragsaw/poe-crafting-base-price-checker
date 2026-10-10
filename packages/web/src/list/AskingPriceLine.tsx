import type { JSX } from 'react';

import { colors, px, layout, typeStyle } from '../theme/tokens';

export const ASKING_PRICE_COPY =
  'Every price here is a current asking price from a live instant-buyout listing. Nothing on this page is an observed sale.';

/** FR-13's only mitigation for Risk R-1: always present, never dismissible, never shortened. */
export function AskingPriceLine(): JSX.Element {
  return (
    <p
      data-asking-price-line=""
      style={{
        ...typeStyle('note'),
        color: colors['text-secondary'],
        margin: 0,
        padding: `${px(layout.askingPadTop)} 0 ${px(layout.askingPadBottom)}`,
      }}
    >
      {ASKING_PRICE_COPY}
    </p>
  );
}
