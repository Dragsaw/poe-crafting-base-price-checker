import type { JSX } from 'react';

import { colors, px, spacing, typeStyle } from '../theme/tokens';
import type { ListStatement as Statement } from './list-statement';

/**
 * The list's one plain declarative, under the asking-price line and above the
 * column header (EXPERIENCE.md states 23 and 25). No mark, no colour and no
 * instruction: it states the condition. It is neither the uniform-prior banner
 * nor a money-slot phrase. The two statements are exclusive, so one slot at
 * `frameReserveListStatement` serves both.
 */
export function ListStatement({ statement }: { readonly statement: Statement }): JSX.Element | null {
  if (statement.kind === 'none') {
    return null;
  }
  return (
    <p
      data-list-statement={statement.kind}
      // Nothing-clears comes and goes as the player types a threshold: announce it.
      role="status"
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
