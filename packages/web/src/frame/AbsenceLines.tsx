import type { JSX } from 'react';

import type { TolerableKey } from '../load/artifacts';
import { colors, px, layout } from '../theme/tokens';
import { ABSENCE_LEAD, ABSENCE_ORDER, absenceBody } from './trust-facts';

/** Plain, unmarked lines: absence is a declared state, not a break (state 38). */
export function AbsenceLines({ absent }: { readonly absent: readonly TolerableKey[] }): JSX.Element | undefined {
  const shown = ABSENCE_ORDER.filter((key) => absent.includes(key));
  if (shown.length === 0) {
    return undefined;
  }
  return (
    <div data-absence-lines="">
      {shown.map((key) => (
        <p
          key={key}
          data-absence-line={key}
          style={{
            height: px(layout.absenceLineHeight),
            lineHeight: px(layout.absenceLineHeight),
            color: colors['text-secondary'],
            margin: 0,
          }}
        >
          <span style={{ color: colors.text, fontWeight: 600 }}>{ABSENCE_LEAD}</span> {absenceBody(key)}
        </p>
      ))}
    </div>
  );
}
