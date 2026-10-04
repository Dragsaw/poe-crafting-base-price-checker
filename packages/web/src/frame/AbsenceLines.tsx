import type { JSX } from 'react';

import { ARTIFACTS, type TolerableKey } from '../load/artifacts';
import { colors, px, spacing } from '../theme/tokens';

/** What each absence costs the page (Story 2.1 decision 2026-09-26; final copy is UX's). */
const CONSEQUENCE: Readonly<Record<TolerableKey, string>> = {
  syncReport: 'the sync report is unavailable.',
  weights: 'every crafted class is unrankable.',
  recipes: 'no crafted rows can be ranked.',
};

/** DESIGN.md `trust-strip.absenceLineCopy`: the lines appear in this order, and only for absent files. */
const ABSENCE_ORDER = ['weights', 'recipes', 'syncReport'] as const satisfies readonly TolerableKey[];

const ABSENCE_LEAD = 'Not published:';

function absenceBody(key: TolerableKey): string {
  return `${ARTIFACTS[key].path} — ${CONSEQUENCE[key]}`;
}

export function absenceLine(key: TolerableKey): string {
  return `${ABSENCE_LEAD} ${absenceBody(key)}`;
}

/**
 * One plain line per absent tolerable artifact, inside the trust strip after
 * line two and before the health line (DESIGN.md memlog 213). The lead takes
 * the strip's label style (ink, 600), the file and its consequence the value
 * style (ink-secondary). No mark and no colour: absence is a declared state,
 * not a break. Each line is budgeted at `frameReserveAbsenceLine`.
 */
export function AbsenceLines({ absent }: { readonly absent: readonly TolerableKey[] }): JSX.Element | null {
  const shown = ABSENCE_ORDER.filter((key) => absent.includes(key));
  if (shown.length === 0) {
    return null;
  }
  return (
    <div data-absence-lines="">
      {shown.map((key) => (
        <p
          key={key}
          data-absence-line={key}
          style={{
            height: px(spacing.frameReserveAbsenceLine),
            lineHeight: px(spacing.frameReserveAbsenceLine),
            color: colors['ink-secondary'],
            margin: 0,
          }}
        >
          <span style={{ color: colors.ink, fontWeight: 600 }}>{ABSENCE_LEAD}</span> {absenceBody(key)}
        </p>
      ))}
    </div>
  );
}
