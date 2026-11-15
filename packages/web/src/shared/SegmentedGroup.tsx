import './segmented.css';

import type { JSX } from 'react';

import { colors, headerControls, px, rounded, typeStyle } from '../theme/tokens';

/** `{components.recipe-toggle}.segment` and `{components.level-toggle}.segment`: padding and radius. */
const SEGMENT_BOX = {
  padding: `${px(headerControls.segmentPadY)} ${px(headerControls.segmentPadX)}`,
  borderRadius: rounded.segment,
} as const;

/** One segment: the value it sets and the word it prints. */
export interface Segment {
  readonly id: string;
  readonly word: string;
}

/**
 * A segmented control with no animated indicator (EXPERIENCE.md, no `SegmentedControl`). The active segment is a
 * `<span aria-current>` at weight 600, so it is no target and its state is not carried by colour alone (NFR-10).
 */
export function SegmentedGroup({
  name,
  label,
  segments,
  activeId,
  onChange,
}: {
  /** Names the data attributes: `data-<name>-options` on the frame, `data-<name>-option` on each segment. */
  readonly name: string;
  readonly label: string;
  readonly segments: readonly Segment[];
  readonly activeId: string;
  readonly onChange: (id: string) => void;
}): JSX.Element {
  return (
    <div
      {...{ [`data-${name}-options`]: '' }}
      role="group"
      aria-label={label}
      style={{
        ...typeStyle('control'),
        display: 'inline-flex',
        background: colors.surface,
        border: `1px solid ${colors['line-strong']}`,
        borderRadius: rounded.control,
        padding: px(headerControls.framePadding),
      }}
    >
      {segments.map((segment) => {
        const data = { [`data-${name}-option`]: segment.id };
        return segment.id === activeId ? (
          <span key={segment.id} {...data} data-active="" aria-current="true" className="fg-segment" style={{ ...SEGMENT_BOX, fontWeight: 600 }}>
            {segment.word}
          </span>
        ) : (
          <button
            key={segment.id}
            type="button"
            {...data}
            data-inactive=""
            className="fg-segment"
            style={SEGMENT_BOX}
            onClick={() => {
              onChange(segment.id);
            }}
          >
            {segment.word}
          </button>
        );
      })}
    </div>
  );
}
