import type { JSX } from 'react';

import { colors, glyphs, px, spacing, typeStyle } from '../theme/tokens';

export type Unit = 'class' | 'raw';

// FR-3. A fixed `flex: 0 0 auto` box keeps every name at the same x; a long name yields first.
export function UnitGlyph({ unit }: { readonly unit: Unit }): JSX.Element {
  return (
    <span
      data-unit-glyph={unit}
      aria-hidden="true"
      style={{
        ...typeStyle('row-unit-glyph'),
        flex: '0 0 auto',
        width: px(spacing.unitGlyphBox),
        marginRight: px(spacing.s1),
        textAlign: 'center',
        fontStyle: 'normal',
        color: colors.sepia,
      }}
    >
      {unit === 'class' ? glyphs.unitClass : glyphs.unitRaw}
    </span>
  );
}
