import { CRAFTING_ITEM_LEVELS, type CraftingItemLevel } from '@poe/core';
import type { JSX } from 'react';

import { SegmentedGroup } from '../shared/SegmentedGroup';
import { colors, headerControls, px, typeStyle } from '../theme/tokens';

/** EXPERIENCE.md, Copy Deck: *Item level*. */
export const LEVEL_LABEL = 'ilvl';

const SEGMENTS = CRAFTING_ITEM_LEVELS.map((level) => ({ id: String(level), word: String(level) }));

/** `{components.level-toggle}` (FR-38): the third ranking dial, both levels always offered (Interaction 1b). */
export function LevelToggle({
  level,
  onChange,
}: {
  readonly level: CraftingItemLevel;
  readonly onChange: (level: CraftingItemLevel) => void;
}): JSX.Element {
  return (
    <div data-level-toggle="" style={{ display: 'flex', alignItems: 'center', gap: px(headerControls.labelGap) }}>
      <span data-level-label="" style={{ ...typeStyle('label'), color: colors['text-secondary'] }}>
        {LEVEL_LABEL}
      </span>
      <SegmentedGroup
        name="level"
        label={LEVEL_LABEL}
        segments={SEGMENTS}
        activeId={String(level)}
        onChange={(id) => {
          const chosen = CRAFTING_ITEM_LEVELS.find((offered) => String(offered) === id);
          if (chosen !== undefined) {
            onChange(chosen);
          }
        }}
      />
    </div>
  );
}
