import './threshold.css';

import { NumberInput } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { useId, useRef, useState, type JSX } from 'react';

import { formatThreshold } from '../shared/money';
import { DENOMINATION } from '../shared/product';
import { colors, px, spacing, typeStyle } from '../theme/tokens';
import {
  clampThreshold,
  THRESHOLD_DECIMALS,
  THRESHOLD_MAX,
  THRESHOLD_MIN,
  THRESHOLD_STEP,
} from './threshold-storage';

export const THRESHOLD_LABEL = 'Payout Threshold';
/** A no-break space joins the figure and the unit. */
export const THRESHOLD_UNIT = `\u{A0}${DENOMINATION}`;
export const RANGE_LOW = `${String(THRESHOLD_MIN)} ${DENOMINATION}`;
export const RANGE_HIGH = `${String(THRESHOLD_MAX)} ${DENOMINATION}`;
/** About 150ms between a valid parse and the re-rank (UX-DR18). */
export const COMMIT_DEBOUNCE_MS = 150;

/** A leading digit is required: `fixedDecimalScale` pads a lone `.` to `.00`, which is not a parse. */
const PARSEABLE = /^\d+(\.\d*)?$/;

/**
 * The draft as a threshold, or `undefined` when it does not parse. Mantine
 * hands a string for `""`, `"."` and for figures with trailing zeros (`0.10`),
 * so a string is parsed here rather than discarded.
 */
function parseDraft(draft: number | string): number | undefined {
  if (typeof draft === 'number') {
    return Number.isFinite(draft) ? draft : undefined;
  }
  return PARSEABLE.test(draft) ? Number(draft) : undefined;
}

/**
 * `{components.payout-threshold}`. The figure IS the input: a borderless
 * Mantine `NumberInput` with no stepper, and `Divine` outside it so it can
 * never be typed over. Each valid parse re-ranks after ~150ms; an empty or
 * unparseable draft does not, and blur restores the last valid value at 2dp.
 * The track and the marker are a readout of the ranking threshold, never a
 * slider: no pointer events, no handlers (UX-DR18, UX-DR35, UX-DR44).
 */
export function PayoutThreshold({
  value,
  onChange,
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
}): JSX.Element {
  const id = useId();
  const unitId = useId();
  const [draft, setDraft] = useState<number | string>(value);
  const lastValid = useRef(value);
  const commit = useDebouncedCallback((next: number) => {
    onChange(next);
  }, { delay: COMMIT_DEBOUNCE_MS, flushOnUnmount: true });

  const share = `${String((value / THRESHOLD_MAX) * 100)}%`;

  return (
    <div
      data-payout-threshold=""
      style={{
        width: px(spacing.thresholdPanelWidth),
        boxSizing: 'border-box',
        background: colors['paper-inset'],
        border: `${px(spacing.hairline)} solid ${colors['rule-hairline']}`,
        padding: `${px(spacing.controlPanelPadY)} ${px(spacing.controlPanelPadX)}`,
      }}
    >
      <label
        htmlFor={id}
        data-threshold-label=""
        style={{ ...typeStyle('threshold-label'), display: 'block', color: colors['ink-tertiary'], textTransform: 'uppercase' }}
      >
        {THRESHOLD_LABEL}
      </label>
      <div
        data-threshold-value=""
        style={{
          ...typeStyle('threshold-value'),
          color: colors.ink,
          marginTop: px(spacing.thresholdValueGap),
          display: 'flex',
          alignItems: 'baseline',
        }}
      >
        {/* The input sizes to its figure: a hidden twin sets the width, so the rule sits under the figure only. */}
        <span style={{ position: 'relative', display: 'inline-block' }}>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              visibility: 'hidden',
              whiteSpace: 'pre',
              fontVariantNumeric: 'tabular-nums',
              borderBottom: `${px(spacing.hairline)} solid transparent`,
            }}
          >
            {typeof draft === 'number' ? formatThreshold(draft) : draft === '' ? '0' : draft}
          </span>
          <NumberInput
            id={id}
            // Mantine's Input writes its own `aria-describedby` over a plain prop; the Styles API attributes land last.
            attributes={{ input: { 'aria-describedby': unitId } }}
            unstyled
            hideControls
            className="fg-threshold"
            style={{ position: 'absolute', inset: 0 }}
            styles={{
              wrapper: { display: 'block', height: '100%' },
              input: {
                ...typeStyle('threshold-value'),
                fontVariantNumeric: 'tabular-nums',
                width: '100%',
                height: '100%',
                minWidth: 0,
              },
            }}
            min={THRESHOLD_MIN}
            max={THRESHOLD_MAX}
            step={THRESHOLD_STEP}
            decimalScale={THRESHOLD_DECIMALS}
            fixedDecimalScale
            clampBehavior="blur"
            // Blur restores the last valid value below; Mantine's own trim would turn `.00` into a parse of 0.
            trimLeadingZeroesOnBlur={false}
            allowNegative={false}
            value={draft}
            onChange={(next) => {
              setDraft(next);
              const parsed = parseDraft(next);
              if (parsed !== undefined) {
                const threshold = clampThreshold(parsed);
                lastValid.current = threshold;
                commit(threshold);
              }
            }}
            onBlur={() => {
              commit.flush();
              setDraft(lastValid.current);
            }}
          />
        </span>
        <span id={unitId} data-threshold-unit="" style={{ ...typeStyle('threshold-value-unit'), color: colors['ink-secondary'] }}>
          {THRESHOLD_UNIT}
        </span>
      </div>
      <div
        data-threshold-track=""
        aria-hidden="true"
        style={{
          position: 'relative',
          marginTop: px(spacing.thresholdTrackGap),
          height: px(spacing.thresholdTrackHeight),
          background: colors['rule-hairline'],
          pointerEvents: 'none',
        }}
      >
        <i
          data-threshold-fill=""
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: px(spacing.thresholdTrackHeight),
            width: share,
            background: colors.sepia,
            pointerEvents: 'none',
          }}
        />
        <b
          data-threshold-marker=""
          style={{
            position: 'absolute',
            left: share,
            top: px(-spacing.thresholdMarkerRise),
            marginLeft: px(-spacing.thresholdMarkerWidth / 2),
            width: px(spacing.thresholdMarkerWidth),
            height: px(spacing.thresholdMarkerHeight),
            background: colors.ink,
            pointerEvents: 'none',
          }}
        />
      </div>
      <div
        data-threshold-range=""
        style={{
          ...typeStyle('threshold-range'),
          color: colors['ink-tertiary'],
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: px(spacing.thresholdRangeGap),
        }}
      >
        <span>{RANGE_LOW}</span>
        <span>{RANGE_HIGH}</span>
      </div>
    </div>
  );
}
