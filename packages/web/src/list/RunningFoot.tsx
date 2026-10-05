import type { JSX } from 'react';

import { colors, px, spacing, typeStyle } from '../theme/tokens';

// DESIGN.md `running-foot`; copy from `mockups/key-hero-resting.html`.
export function RunningFoot(): JSX.Element {
  return (
    <footer
      data-running-foot=""
      style={{
        ...typeStyle('running-foot'),
        marginTop: px(spacing.footMarginTop),
        marginBottom: px(spacing.footMarginBottom),
        paddingTop: px(spacing.footPadTop),
        borderTop: `${px(spacing.hairline)} solid ${colors['rule-hairline']}`,
        color: colors['ink-tertiary'],
      }}
    >
      Read-only while you play. Every row’s exact age and every tracked Combination sit one click down, in the
      expansion. Pruning and pinning happen in{' '}
      <span style={{ color: colors['ink-secondary'], fontWeight: 600 }}>data/tracked.json</span>, then a commit; the
      next sync run reflects the edit.
    </footer>
  );
}
