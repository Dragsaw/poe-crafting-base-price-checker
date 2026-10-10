import type { CSSProperties, JSX, ReactNode } from 'react';

import { colors, px, layout, typeStyle } from '../theme/tokens';
import { TrustMark } from './TrustMark';

export const KEY_TITLES = ['Provenance marks'] as const;

const TERM: CSSProperties = { fontWeight: 700 };

function Column({ title, last, children }: { readonly title: string; readonly last: boolean; readonly children: ReactNode }): JSX.Element {
  return (
    <div data-key-column="" style={{ flex: '1 1 0', minWidth: 0, paddingRight: last ? 0 : px(layout.keyColumnGap) }}>
      <span
        style={{
          ...typeStyle('column-header'),
          display: 'block',
          marginBottom: px(layout.keyHeadingGap),
          textTransform: 'uppercase',
          color: colors['text-tertiary'],
        }}
      >
        {title}
      </span>
      {children}
    </div>
  );
}

// DESIGN.md `key-block`; copy from `mockups/key-hero-resting.html`.
// `† pruned` and `* pinned` are not listed: an open `[NOTE FOR UX]`.
export function KeyBlock(): JSX.Element {
  const [provenance] = KEY_TITLES;
  return (
    <div
      data-key-block=""
      style={{
        ...typeStyle('note'),
        display: 'flex',
        marginTop: px(layout.keyMarginTop),
        paddingTop: px(layout.keyPadTop),
        borderTop: `${px(layout.hairline)} solid ${colors['line-strong']}`,
        color: colors['text-secondary'],
      }}
    >
      <Column title={provenance} last>
        <TrustMark kind="unknown" word="unknown" /> — <span style={TERM}>absent</span>: partial pool, upper bound only
      </Column>
    </div>
  );
}
