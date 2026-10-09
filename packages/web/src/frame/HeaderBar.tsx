import type { JSX } from 'react';

import { colors, px, spacing, typeStyle } from '../theme/tokens';

/** EXPERIENCE.md, Copy Deck: *Header title*. */
export const HEADER_TITLE = "What's worth picking up";

/** `{components.header-bar}` layout: 22px between groups. */
const GROUP_GAP = 22;

export type HeaderSlot = 'recipe' | 'threshold' | 'sync';

/**
 * Each slot's reserved width, from the mockup at `{spacing.content-min}` and DESIGN.md's
 * header width budget, so a filled or empty slot never moves the bar. Story 4.5 re-measures.
 */
export const HEADER_SLOT_WIDTHS: Readonly<Record<HeaderSlot, number>> = {
  recipe: 294,
  threshold: 238,
  sync: 128,
};

const SLOTS: readonly HeaderSlot[] = ['recipe', 'threshold', 'sync'];

/** A long league or title is cut, so the slots never leave the bar. */
const CUT = { overflow: 'hidden', textOverflow: 'ellipsis' } as const;

/** `{components.header-bar}`: the one pinned region. Its slots stay empty until Story 4.5. */
export function HeaderBar({ league }: { readonly league: string | undefined }): JSX.Element {
  return (
    <header
      data-header-bar=""
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        display: 'flex',
        flexWrap: 'nowrap',
        alignItems: 'center',
        gap: px(GROUP_GAP),
        height: spacing['header-height'],
        boxSizing: 'border-box',
        background: colors.ground,
        borderBottom: `1px solid ${colors['line-strong']}`,
        whiteSpace: 'nowrap',
      }}
    >
      <div data-brand="" style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minWidth: 0 }}>
        <span
          data-eyebrow=""
          style={{
            ...typeStyle('eyebrow'),
            ...CUT,
            display: 'block',
            color: colors['text-secondary'],
            textTransform: 'uppercase',
          }}
        >
          {league === undefined ? '\u{A0}' : league}
        </span>
        <h1 style={{ ...typeStyle('title'), ...CUT, color: colors.text, margin: 0 }}>{HEADER_TITLE}</h1>
      </div>
      {SLOTS.map((slot) => (
        <div
          key={slot}
          data-slot={slot}
          aria-hidden="true"
          style={{ flex: `0 0 ${px(HEADER_SLOT_WIDTHS[slot])}`, width: px(HEADER_SLOT_WIDTHS[slot]) }}
        />
      ))}
    </header>
  );
}
