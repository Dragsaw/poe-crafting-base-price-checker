import type { CSSProperties, JSX, ReactNode } from 'react';

import { colors, px, layout, typeStyle } from '../theme/tokens';
import { NEVER_ATTEMPTED } from './format';
import { TrustMark } from './TrustMark';

export const KEY_TITLES = ['Silence means healthy', 'Provenance marks', 'Age marks'] as const;

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
  const [silence, provenance, age] = KEY_TITLES;
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
      <Column title={silence} last={false}>
        An empty Provenance cell and an empty Age cell mean the same thing every time: nothing here is degraded. A Raw
        Base’s Provenance cell is always empty — it rests on no modifier pool at all.
      </Column>
      <Column title={provenance} last={false}>
        <TrustMark kind="prior" word="prior only" /> — <span style={TERM}>uniform-prior</span>: someone invented this
        weight
        <br />
        <TrustMark kind="unknown" word="unknown" /> — <span style={TERM}>absent</span>: partial pool, upper bound only
      </Column>
      <Column title={age} last>
        <TrustMark kind="stale" word="priced 5d ago" /> — the observation is old
        <br />
        <TrustMark kind="stale" word="tried 9d ago" /> — nothing has been found here since
        <br />
        <TrustMark kind="never" word={NEVER_ATTEMPTED} /> — no request was ever issued
      </Column>
    </div>
  );
}
