import type { JSX } from 'react';

import { colors, px, layout, typeStyle } from '../theme/tokens';
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
        ...typeStyle('note'),
        height: px(layout.listStatementHeight),
        lineHeight: px(layout.listStatementHeight),
        color: colors.text,
        margin: 0,
      }}
    >
      {statement.text}
    </p>
  );
}
