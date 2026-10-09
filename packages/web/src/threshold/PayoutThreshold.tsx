import './threshold.css';

import { NumberInput } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { useId, useRef, useState, type JSX } from 'react';

import { formatThreshold } from '../shared/money';
import { DENOMINATION } from '../shared/product';
import { colors, px, layout, typeStyle } from '../theme/tokens';
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

/** Mantine hands a string for `""`, `"."` and trailing zeros (`0.10`): parse it, do not discard. */
function parseDraft(draft: number | string): number | undefined {
  if (typeof draft === 'number') {
    return Number.isFinite(draft) ? draft : undefined;
  }
  return PARSEABLE.test(draft) ? Number(draft) : undefined;
}

/** The hidden sizing ghost's text: the number formatted, an empty draft as `0`, otherwise the typed text. */
function ghostText(draft: number | string): string {
  if (typeof draft === 'number') {
    return formatThreshold(draft);
  }
  return draft === '' ? '0' : draft;
}

/** `{components.payout-threshold}`: `Divine` sits outside the input; a readout (UX-DR18). */
export function PayoutThreshold({
  value,
  onChange,
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
}): JSX.Element {
  const id = useId();
  const unitId = useId();
  const { draft, onDraftChange, onBlur } = useThresholdDraft(value, onChange);

  return (
    <div
      data-payout-threshold=""
      style={{
        width: px(layout.thresholdPanelWidth),
        boxSizing: 'border-box',
        background: colors.surface,
        border: `${px(layout.hairline)} solid ${colors.line}`,
        padding: `${px(layout.controlPanelPadY)} ${px(layout.controlPanelPadX)}`,
      }}
    >
      <label
        htmlFor={id}
        data-threshold-label=""
        style={{ ...typeStyle('label'), display: 'block', color: colors['text-tertiary'], textTransform: 'uppercase' }}
      >
        {THRESHOLD_LABEL}
      </label>
      <ThresholdFigure id={id} unitId={unitId} draft={draft} onDraftChange={onDraftChange} onBlur={onBlur} />
      <ThresholdTrack share={`${String((value / THRESHOLD_MAX) * 100)}%`} />
      <ThresholdRange />
    </div>
  );
}

function useThresholdDraft(value: number, onChange: (value: number) => void) {
  const [draft, setDraft] = useState<number | string>(value);
  const lastValid = useRef(value);
  const commit = useDebouncedCallback(
    (next: number) => {
      onChange(next);
    },
    { delay: COMMIT_DEBOUNCE_MS, flushOnUnmount: true },
  );
  const onDraftChange = (next: number | string): void => {
    setDraft(next);
    const parsed = parseDraft(next);
    if (parsed === undefined) {
      return;
    }
    const threshold = clampThreshold(parsed);
    lastValid.current = threshold;
    commit(threshold);
  };
  const onBlur = (): void => {
    commit.flush();
    setDraft(lastValid.current);
  };
  return { draft, onDraftChange, onBlur };
}

function ThresholdFigure({ id, unitId, draft, onDraftChange, onBlur }: ThresholdFigureProperties): JSX.Element {
  return (
    <div
      data-threshold-value=""
      style={{
        ...typeStyle('control-figure'),
        color: colors.text,
        marginTop: px(layout.thresholdValueGap),
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
            borderBottom: `${px(layout.hairline)} solid transparent`,
          }}
        >
          {ghostText(draft)}
        </span>
        <ThresholdInput id={id} unitId={unitId} draft={draft} onDraftChange={onDraftChange} onBlur={onBlur} />
      </span>
      <span id={unitId} data-threshold-unit="" style={{ ...typeStyle('label'), color: colors['text-secondary'] }}>
        {THRESHOLD_UNIT}
      </span>
    </div>
  );
}

interface ThresholdFigureProperties {
  readonly id: string;
  readonly unitId: string;
  readonly draft: number | string;
  readonly onDraftChange: (next: number | string) => void;
  readonly onBlur: () => void;
}

function ThresholdInput({ id, unitId, draft, onDraftChange, onBlur }: ThresholdFigureProperties): JSX.Element {
  return (
    <NumberInput
      id={id}
      // Mantine's Input writes its own `aria-describedby` over a plain prop; the Styles API
      // attributes land last.
      attributes={{ input: { 'aria-describedby': unitId } }}
      unstyled
      hideControls
      className="fg-threshold"
      style={{ position: 'absolute', inset: 0 }}
      styles={{
        wrapper: { display: 'block', height: '100%' },
        input: {
          ...typeStyle('control-figure'),
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
      // Blur restores the last valid value (`useThresholdDraft`); Mantine's own trim would turn
      // `.00` into a parse of 0.
      trimLeadingZeroesOnBlur={false}
      allowNegative={false}
      value={draft}
      onChange={onDraftChange}
      onBlur={onBlur}
    />
  );
}

function ThresholdTrack({ share }: { readonly share: string }): JSX.Element {
  return (
    <div
      data-threshold-track=""
      aria-hidden="true"
      style={{
        position: 'relative',
        marginTop: px(layout.thresholdTrackGap),
        height: px(layout.thresholdTrackHeight),
        background: colors.line,
        pointerEvents: 'none',
      }}
    >
      <i
        data-threshold-fill=""
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: px(layout.thresholdTrackHeight),
          width: share,
          background: colors.accent,
          pointerEvents: 'none',
        }}
      />
      <b
        data-threshold-marker=""
        style={{
          position: 'absolute',
          left: share,
          top: px(-layout.thresholdMarkerRise),
          marginLeft: px(-layout.thresholdMarkerWidth / 2),
          width: px(layout.thresholdMarkerWidth),
          height: px(layout.thresholdMarkerHeight),
          background: colors.text,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

function ThresholdRange(): JSX.Element {
  return (
    <div
      data-threshold-range=""
      style={{
        ...typeStyle('label'),
        color: colors['text-tertiary'],
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: px(layout.thresholdRangeGap),
      }}
    >
      <span>{RANGE_LOW}</span>
      <span>{RANGE_HIGH}</span>
    </div>
  );
}
