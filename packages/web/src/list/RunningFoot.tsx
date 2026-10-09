import type { JSX } from 'react';

import { colors, px, layout, typeStyle } from '../theme/tokens';

// DESIGN.md `running-foot`; copy from `mockups/key-hero-resting.html`.
export function RunningFoot(): JSX.Element {
  return (
    <footer
      data-running-foot=""
      style={{
        ...typeStyle('note'),
        marginTop: px(layout.footMarginTop),
        marginBottom: px(layout.footMarginBottom),
        paddingTop: px(layout.footPadTop),
        borderTop: `${px(layout.hairline)} solid ${colors.line}`,
        color: colors['text-tertiary'],
      }}
    >
      Read-only while you play. Every row’s exact age and every tracked Combination sit one click down, in the
      expansion. Pruning and pinning happen in{' '}
      <span style={{ color: colors['text-secondary'], fontWeight: 600 }}>data/tracked.json</span>, then a commit; the
      next sync run reflects the edit.
    </footer>
  );
}
