import type { JSX } from 'react';

import { colors, columnSums, px, spacing, typeStyle } from '../theme/tokens';

/** The DESIGN mockup strings (`mockups/key-hero-resting.html`). */
export const MASTHEAD_TITLE = 'What is worth picking up';
export const MASTHEAD_DEK =
  'Item Classes ranked by expected payout per craft, beside the Base Types worth selling raw. Every figure is in Divine.';

export function eyebrowText(league: string): string {
  return `League ${league}`;
}

/** The right-hand control group's width: 216 recipe + 16 gap + 276 threshold. */
const CONTROL_SLOT_WIDTH = columnSums.mastheadControls.reduce((a, b) => a + b, 0);

/**
 * The 170px masthead: 34 pad + eyebrow 14 + 8 + title 44 + 8 + two-line dek 42
 * + 20 pad. The eyebrow reads the league alone. The right-hand control slot is
 * reserved and left empty; Stories 2.4 and 3.x fill it.
 */
export function Masthead({ league }: { readonly league: string | undefined }): JSX.Element {
  return (
    <header
      data-masthead=""
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingTop: px(spacing.gutter),
        paddingBottom: px(spacing.s5),
        boxSizing: 'border-box',
        height: px(170),
      }}
    >
      <div style={{ maxWidth: px(spacing.dekMaxWidth) }}>
        <div style={{ ...typeStyle('eyebrow'), color: colors.sepia, textTransform: 'uppercase' }}>
          {league === undefined ? ' ' : eyebrowText(league)}
        </div>
        <h1 style={{ ...typeStyle('masthead-title'), color: colors.ink, margin: `${px(spacing.s2)} 0 0` }}>
          {MASTHEAD_TITLE}
        </h1>
        <p style={{ ...typeStyle('dek'), color: colors['ink-secondary'], margin: `${px(spacing.s2)} 0 0` }}>
          {MASTHEAD_DEK}
        </p>
      </div>
      <div data-control-slot="" aria-hidden="true" style={{ width: px(CONTROL_SLOT_WIDTH), flex: '0 0 auto' }} />
    </header>
  );
}
