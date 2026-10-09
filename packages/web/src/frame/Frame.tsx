import './frame.css';

import type { JSX, ReactNode } from 'react';

import { colors, spacing } from '../theme/tokens';

export type FrameState = 'pending' | 'ready' | 'refused' | 'failed';

/** DESIGN.md, Layout & Spacing, *The frame*: one centred column with no fixed height. */
export function Frame({ state, children }: { readonly state: FrameState; readonly children: ReactNode }): JSX.Element {
  return (
    <div
      data-frame=""
      data-state={state}
      aria-busy={state === 'pending' ? true : undefined}
      style={{
        minWidth: spacing['content-min'],
        maxWidth: spacing['content-max'],
        boxSizing: 'border-box',
        padding: `0 ${spacing.gutter}`,
        margin: '0 auto',
        background: colors.ground,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </div>
  );
}
