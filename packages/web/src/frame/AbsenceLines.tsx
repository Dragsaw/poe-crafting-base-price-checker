import type { JSX } from 'react';

import { ARTIFACTS, type TolerableKey } from '../load/artifacts';
import { colors, px, spacing, typeStyle } from '../theme/tokens';

/** What each absence costs the page (Story 2.1 decision 2026-09-26; final copy is UX's). */
const CONSEQUENCE: Readonly<Record<TolerableKey, string>> = {
  syncReport: 'the sync report is unavailable.',
  weights: 'every crafted class is unrankable.',
  recipes: 'no crafted rows can be ranked.',
};

export function absenceLine(key: TolerableKey): string {
  return `Not published: ${ARTIFACTS[key].path} — ${CONSEQUENCE[key]}`;
}

/**
 * One plain sans line per absent tolerable artifact, under the masthead, in
 * `ink-secondary`. Each is budgeted at the health line's 21px. A degraded
 * render always names what is missing (AD-24).
 */
export function AbsenceLines({ absent }: { readonly absent: readonly TolerableKey[] }): JSX.Element | null {
  if (absent.length === 0) {
    return null;
  }
  return (
    <div data-absence-lines="">
      {absent.map((key) => (
        <p
          key={key}
          style={{
            ...typeStyle('trust-strip'),
            lineHeight: px(spacing.frameReserveHealthLine),
            color: colors['ink-secondary'],
            margin: 0,
          }}
        >
          {absenceLine(key)}
        </p>
      ))}
    </div>
  );
}
