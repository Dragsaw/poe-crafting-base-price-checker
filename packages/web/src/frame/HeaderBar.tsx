import type { JSX, ReactNode } from 'react';

import { colors, px, spacing, typeStyle } from '../theme/tokens';

/** EXPERIENCE.md, Copy Deck: *Header title*. */
export const HEADER_TITLE = "What's worth picking up";

/** `{components.header-bar}` layout: 22px between groups. */
export const HEADER_GROUP_GAP = 22;

export type HeaderSlot = 'recipe' | 'threshold' | 'sync';

/**
 * An empty slot's reserved width, measured in the browser at `{spacing.content-min}` against the
 * widest content: two recipes with a `10.00 div / craft` cost, `3.00 div`, and `✕ 999 problems`.
 */
export const HEADER_SLOT_WIDTHS: Readonly<Record<HeaderSlot, number>> = {
  recipe: 296,
  threshold: 242,
  sync: 134,
};

/** The title's width in Inter at `{typography.title}`, measured in the browser: the brand block's floor. */
export const HEADER_TITLE_WIDTH = 212;

export const HEADER_SLOTS: readonly HeaderSlot[] = ['recipe', 'threshold', 'sync'];

/** A long league or title is cut, so the slots never leave the bar. */
const CUT = { overflow: 'hidden', textOverflow: 'ellipsis' } as const;

/** `{components.header-bar}`: the one pinned region. An empty slot keeps its width (state 43). */
export function HeaderBar({
  league,
  controls = {},
}: {
  readonly league: string | undefined;
  readonly controls?: Partial<Record<HeaderSlot, ReactNode>>;
}): JSX.Element {
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
        gap: px(HEADER_GROUP_GAP),
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
      {HEADER_SLOTS.map((slot) => {
        const control = controls[slot];
        // A filled slot sizes to its control so the brand block takes the free space. The sync
        // slot holds its width, start-aligned: its face only exists once loaded, and the
        // threshold beside it must not move then (state 22).
        const isReserved = control === undefined || slot === 'sync';
        const size = isReserved
          ? { flex: `0 0 ${px(HEADER_SLOT_WIDTHS[slot])}`, width: px(HEADER_SLOT_WIDTHS[slot]) }
          : { flex: '0 0 auto' };
        return (
          <div
            key={slot}
            data-slot={slot}
            aria-hidden={control === undefined ? 'true' : undefined}
            style={{ ...size, display: 'flex', alignItems: 'center' }}
          >
            {control}
          </div>
        );
      })}
    </header>
  );
}
