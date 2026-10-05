import type { CSSProperties } from 'react';

import { px } from '../theme/tokens';

/** One fixed-width flex cell: it never grows, shrinks or widens to its content. */
export function fixedCell({ width, padRight }: { readonly width: number; readonly padRight?: number }): CSSProperties {
  return {
    flex: `0 0 ${px(width)}`,
    width: px(width),
    minWidth: 0,
    boxSizing: 'border-box',
    paddingRight: padRight === undefined || padRight === 0 ? undefined : px(padRight),
  };
}
