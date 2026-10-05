import type { TrackedEntry } from '@poe/contracts';

import { itemTypesOf } from './search-body.ts';

export const itemTypes = itemTypesOf({
  result: [
    { id: 'accessory', label: 'Accessories', entries: [{ type: 'Gold Amulet' }] },
    {
      id: 'jewel',
      label: 'Jewels',
      entries: [{ type: 'Emerald' }, { type: 'Time-Lost Diamond' }],
    },
  ],
});

type Affixes = Pick<Extract<TrackedEntry, { kind: 'crafted' }>, 'prefix' | 'suffix'>;

const DEFAULT_AFFIXES: Affixes = {
  prefix: { kind: 'banded', statId: 'explicit.stat_1', valueMin: 47, valueMax: 50.5, acceptedTier: 'T5' },
  suffix: { kind: 'valueless', statId: 'explicit.stat_2', acceptedTier: 'T5' },
};

export function crafted(
  categoryId: string,
  className: string,
  affixes: Affixes = DEFAULT_AFFIXES,
): TrackedEntry {
  return { kind: 'crafted', categoryId, className, itemLevelMin: 75, ...affixes, status: 'active' };
}
