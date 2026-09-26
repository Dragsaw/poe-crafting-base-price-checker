import './frame.css';

import type { JSX, ReactNode } from 'react';

import { colors, px, spacing } from '../theme/tokens';

export type FrameState = 'pending' | 'ready' | 'refused' | 'failed';

/**
 * The fixed frame: a constant, not a breakpoint. Border-box at 1060 with 24px
 * side padding gives a content box of exactly 1012. The edge is a 1px
 * `outline`, which paints outside the box and consumes no width. `min-height`,
 * never `height`: the frame grows and the document scrolls. No
 * `overflow: hidden` — it clipped the third chase cell in the reference render.
 */
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
