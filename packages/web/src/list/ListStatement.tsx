import type { JSX } from 'react';

import { colors, layout, px, typeStyle } from '../theme/tokens';
import type { ListStatement as Statement } from './list-statement';

/** `{components.list-statement}`: one quiet line above the column header (states 23, 25, 35). */
export function ListStatement({ statement }: { readonly statement: Statement }): JSX.Element | undefined {
  if (statement.kind === 'none') {
    return undefined;
  }
  return (
    <p
      data-list-statement={statement.kind}
      style={{
        ...typeStyle('label'),
        whiteSpace: 'nowrap',
        color: colors['text-secondary'],
        margin: 0,
        padding: `${px(layout.s3)} 0 ${px(layout.s2)}`,
      }}
    >
      {statement.text}
    </p>
  );
}
