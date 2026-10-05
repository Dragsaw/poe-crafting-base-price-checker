import type { JSX } from 'react';

import { colors, px, spacing, typeStyle } from '../theme/tokens';
import type { ListStatement as Statement } from './list-statement';

// EXPERIENCE.md states 23 and 25. The two statements are exclusive, so one slot at
// `frameReserveListStatement` serves both.
export function ListStatement({ statement }: { readonly statement: Statement }): JSX.Element | undefined {
  if (statement.kind === 'none') {
    return undefined;
  }
  return (
    <p
      data-list-statement={statement.kind}
      style={{
        ...typeStyle('trust-strip'),
        height: px(spacing.frameReserveListStatement),
        lineHeight: px(spacing.frameReserveListStatement),
        color: colors.ink,
        margin: 0,
      }}
    >
      {statement.text}
    </p>
  );
}
