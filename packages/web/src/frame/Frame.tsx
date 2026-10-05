import './frame.css';

import type { JSX, ReactNode } from 'react';

import { colors, px, spacing } from '../theme/tokens';

export type FrameState = 'pending' | 'ready' | 'refused' | 'failed';

// `outline` and `min-height`, not border and height; no `overflow: hidden`
// (DESIGN.md, Layout & Spacing).
export function Frame({ state, children }: { readonly state: FrameState; readonly children: ReactNode }): JSX.Element {
  return (
    <div
      data-frame=""
      data-state={state}
      aria-busy={state === 'pending' ? true : undefined}
      style={{
        width: px(spacing.frameWidth),
        minHeight: px(spacing.frameHeight),
        boxSizing: 'border-box',
        padding: `0 ${px(spacing.framePaddingX)}`,
        margin: '0 auto',
        background: colors.paper,
        outline: `${px(spacing.hairline)} solid ${colors.edge}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </div>
  );
}
