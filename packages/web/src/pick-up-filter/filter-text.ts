import type { PickUpEntry, PickUpPurpose } from '@poe/core';

/**
 * One quiet treatment per purpose (FR-37). Colours from NeverSink's PoE2 filter 0.10.4a: craft `group1t2`/`group2t2`,
 * sell raw `commonexoticbaseshigh`, check the rolls `ut->magic` text.
 */
export const TREATMENTS: Readonly<Record<PickUpPurpose, readonly string[]>> = {
  craft: ['SetFontSize 40', 'SetBorderColor 255 127 127 255', 'SetBackgroundColor 20 20 0 255', 'MinimapIcon 2 Yellow Diamond'],
  'sell-raw': [
    'SetFontSize 40',
    'SetTextColor 0 70 255 255',
    'SetBorderColor 0 70 255 255',
    'SetBackgroundColor 30 0 70 255',
    'MinimapIcon 2 Blue Diamond',
  ],
  'check-rolls': ['SetFontSize 40', 'SetTextColor 0 240 190 255', 'MinimapIcon 2 Cyan Diamond'],
};

const RARITY: Readonly<Record<PickUpEntry['rarity'], string>> = { normal: 'Normal', magic: 'Magic' };

function showBlock(entry: PickUpEntry): string {
  const lines = [
    `BaseType == "${entry.baseTypeId}"`,
    `Rarity ${RARITY[entry.rarity]}`,
    `ItemLevel >= ${String(entry.itemLevelMin)}`,
    ...(entry.itemLevelMax === undefined ? [] : [`ItemLevel <= ${String(entry.itemLevelMax)}`]),
    ...(entry.unidentifiedTierMin === undefined ? [] : [`UnidentifiedItemTier >= ${String(entry.unidentifiedTierMin)}`]),
    ...TREATMENTS[entry.purpose],
  ];
  return ['Show', ...lines.map((line) => '\t' + line), '', ''].join('\n');
}

/**
 * The pick-up filter (AD-31). `baseFilterName` is written verbatim, so the caller must pass a name that already
 * passes `EXPERIENCE.md` state 45 (Story 6.3).
 */
export function filterText(entries: readonly PickUpEntry[], baseFilterName: string): string {
  return `${entries.map((entry) => showBlock(entry)).join('')}Import "${baseFilterName}"\n`;
}
