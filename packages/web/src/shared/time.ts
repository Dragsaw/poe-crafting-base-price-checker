import { DAY_MS, HOUR_MS, MINUTE_MS } from '@poe/core';

import { plural } from './text';

/** Age spellings; the price-trust verdict and its old bound are `core`'s (AD-10). */

type AgeUnit = 'minute' | 'hour' | 'day';

interface AgeStep {
  readonly count: number;
  readonly unit: AgeUnit;
}

/** The one age ladder, rounded down; `undefined` under a minute (EXPERIENCE.md, Voice and Tone, *Ages*). */
function ageStep(ageMs: number): AgeStep | undefined {
  if (ageMs < MINUTE_MS) {
    return undefined;
  }
  if (ageMs < HOUR_MS) {
    return { count: Math.floor(ageMs / MINUTE_MS), unit: 'minute' };
  }
  return ageMs < DAY_MS ? { count: Math.floor(ageMs / HOUR_MS), unit: 'hour' } : { count: Math.floor(ageMs / DAY_MS), unit: 'day' };
}

function unitAgo({ count, unit }: AgeStep): string {
  const units = `${unit}s`;
  return `${String(count)} ${plural(count, unit, units)} ago`;
}

/** A relative age: `< 1 minute ago`, then whole minutes under 1h, hours under 24h, then days. */
export function relativeAge(ageMs: number): string {
  const step = ageStep(ageMs);
  return step === undefined ? '< 1 minute ago' : unitAgo(step);
}

/** An age inside a reason (EXPERIENCE.md, Voice and Tone, *Ages*, In a reason). */
export function reasonAge(ageMs: number): string {
  const step = ageStep(ageMs) ?? { count: 0, unit: 'minute' };
  return step.unit === 'minute' ? `${String(step.count)} min ago` : unitAgo(step);
}

const COMPACT_UNITS: Readonly<Record<AgeUnit, string>> = { minute: 'm', hour: 'h', day: 'd' };

/** The sync button's compact age (EXPERIENCE.md, Voice and Tone, *Ages*). */
export function compactAge(ageMs: number): string {
  const step = ageStep(ageMs);
  return step === undefined ? 'just now' : `${String(step.count)}${COMPACT_UNITS[step.unit]} ago`;
}
