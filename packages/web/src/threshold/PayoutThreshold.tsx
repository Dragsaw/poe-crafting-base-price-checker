import './threshold.css';

import { NumberInput, Slider } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { useId, useRef, useState, type JSX } from 'react';

import { GreaterEqualMark } from '../marks/marks';
import { formatThreshold } from '../shared/money';
import { DIV_UNIT } from '../shared/product';
import { colors, headerControls, px, rounded, typeStyle } from '../theme/tokens';
import {
  clampThreshold,
  THRESHOLD_DECIMALS,
  THRESHOLD_MAX,
  THRESHOLD_MIN,
  THRESHOLD_STEP,
} from './threshold-storage';

/** EXPERIENCE.md, Copy Deck: the threshold label's word; its ≥ is drawn. */
export const THRESHOLD_WORD = 'Worth';
/** A no-break space joins the figure and the unit. */
export const THRESHOLD_UNIT = `\u{A0}${DIV_UNIT}`;
/** About 150ms between a valid typed parse and the re-rank (Interaction 1). */
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

/** `{components.threshold-control}`: the slider and the typed figure, two ways onto one value (Interaction 1). */
export function PayoutThreshold({
  value,
  onChange,
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
}): JSX.Element {
  const id = useId();
  const unitId = useId();
  const { draft, current, onDraftChange, onBlur, onSlide } = useThresholdDraft(value, onChange);

  return (
    <div data-payout-threshold="" style={{ display: 'flex', alignItems: 'center', gap: px(headerControls.labelGap) }}>
      <label
        htmlFor={id}
        data-threshold-label=""
        style={{
          ...typeStyle('label'),
          color: colors['text-secondary'],
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25em',
        }}
      >
        {THRESHOLD_WORD}
        <GreaterEqualMark />
      </label>
      <ThresholdFigure id={id} unitId={unitId} draft={draft} onDraftChange={onDraftChange} onBlur={onBlur} />
      <Slider
        data-threshold-slider=""
        classNames={{ root: 'fg-threshold-slider', thumb: 'fg-threshold-thumb' }}
        styles={{ thumb: { boxShadow: `0 0 0 ${px(headerControls.thumbRing)} ${colors.ground}` } }}
        style={{ width: px(headerControls.sliderWidth), flex: '0 0 auto' }}
        size={headerControls.sliderHeight}
        radius={headerControls.sliderRadius}
        thumbSize={headerControls.thumbSize}
        color={colors.accent}
        label={null} // eslint-disable-line unicorn/no-null -- boundary: Mantine turns its floating value label off only on `null`.
        min={THRESHOLD_MIN}
        max={THRESHOLD_MAX}
        step={THRESHOLD_STEP}
        value={current}
        onChange={onSlide}
      />
    </div>
  );
}

// The typed figure commits debounced and the slider at each step; both share the last valid value.
function useThresholdDraft(value: number, onChange: (value: number) => void) {
  const [draft, setDraft] = useState<number | string>(value);
  const [current, setCurrent] = useState(value);
  const lastValid = useRef(value);
  const commit = useDebouncedCallback(
    (next: number) => {
      onChange(next);
    },
    { delay: COMMIT_DEBOUNCE_MS, flushOnUnmount: true },
  );
  const settle = (threshold: number): void => {
    lastValid.current = threshold;
    setCurrent(threshold);
  };
  const onDraftChange = (next: number | string): void => {
    setDraft(next);
    const parsed = parseDraft(next);
    if (parsed === undefined) {
      return;
    }
    const threshold = clampThreshold(parsed);
    settle(threshold);
    commit(threshold);
  };
  const onBlur = (): void => {
    commit.flush();
    setDraft(lastValid.current);
  };
  const onSlide = (next: number): void => {
    commit.cancel();
    const threshold = clampThreshold(next);
    settle(threshold);
    setDraft(threshold);
    onChange(threshold);
  };
  return { draft, current, onDraftChange, onBlur, onSlide };
}

interface ThresholdFigureProperties {
  readonly id: string;
  readonly unitId: string;
  readonly draft: number | string;
  readonly onDraftChange: (next: number | string) => void;
  readonly onBlur: () => void;
}

function ThresholdFigure({ id, unitId, draft, onDraftChange, onBlur }: ThresholdFigureProperties): JSX.Element {
  return (
    <div
      data-threshold-figure=""
      className="fg-threshold-figure"
      style={{
        ...typeStyle('control-figure'),
        color: colors.text,
        background: colors.surface,
        borderRadius: rounded.control,
        padding: `${px(headerControls.figurePadY)} ${px(headerControls.figurePadX)}`,
        minWidth: px(headerControls.figureMinWidth),
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'flex-end',
      }}
    >
      {/* The input sizes to its figure: a hidden twin sets the width, so the unit sits beside the figure. */}
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <span aria-hidden="true" style={{ display: 'inline-block', visibility: 'hidden', whiteSpace: 'pre', fontVariantNumeric: 'tabular-nums' }}>
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
