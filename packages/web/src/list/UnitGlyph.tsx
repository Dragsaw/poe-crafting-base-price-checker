import type { JSX } from 'react';

import { colors, glyphs, px, layout, typeStyle } from '../theme/tokens';

export type Unit = 'class' | 'raw';

// FR-3. A fixed `flex: 0 0 auto` box keeps every name at the same x; a long name yields first.
export function UnitGlyph({ unit }: { readonly unit: Unit }): JSX.Element {
  return (
    <span
      data-unit-glyph={unit}
      aria-hidden="true"
      style={{
        ...typeStyle('mark'),
        flex: '0 0 auto',
        width: px(layout.unitGlyphBox),
        marginRight: px(layout.s1),
        textAlign: 'center',
        fontStyle: 'normal',
        color: colors['text-tertiary'],
      }}
    >
      {unit === 'class' ? glyphs.unitClass : glyphs.unitRaw}
    </span>
  );
}
