import { TRACKED_SCHEMA_VERSION } from '@poe/contracts';

export const PREFIX_STAT = 'explicit.stat_3981240776';
export const SUFFIX_STAT = 'explicit.stat_124131830';

export const crafted = {
  kind: 'crafted',
  categoryId: 'accessory.amulet',
  className: 'Amulets',
  itemLevelMin: 75,
  prefix: { kind: 'banded', statId: PREFIX_STAT, valueMin: 47, valueMax: 50, acceptedTier: 'T1' },
  suffix: { kind: 'banded', statId: SUFFIX_STAT, valueMin: 3, valueMax: 3, acceptedTier: 'T1' },
  status: 'active',
};

export function trackedText(entries: readonly unknown[], schemaVersion = TRACKED_SCHEMA_VERSION): string {
  return JSON.stringify({ schemaVersion, entries });
}
