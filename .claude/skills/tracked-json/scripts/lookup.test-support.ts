import { type WeightsFile, WeightsFileSchema } from '@poe/contracts';

// eslint-disable-next-line unicorn/no-null -- boundary: the weights, filters and printed JSON carry `null` (a null `statId`, categoryText, untrackable), which `undefined` cannot stand in for.
export const JSON_NULL = null;

function tier(
  slot: string,
  moduleGroup: string,
  {
    itemLevelMin,
    tierLabel,
    text,
    lines,
  }: {
    readonly itemLevelMin: number;
    readonly tierLabel: string;
    readonly text: string;
    readonly lines: readonly { statId: string | null; ranges: number[][] }[];
  },
): Record<string, unknown> {
  return {
    sourceModifierId: `${slot}\0${moduleGroup}\0${String(itemLevelMin)}\0${text}`,
    modGroup: moduleGroup,
    itemLevelMin,
    tierLabel,
    weight: 500,
    weightSource: 'published',
    lines,
  };
}

export const SPIRIT = 'explicit.stat_spirit';
export const EVASION = 'explicit.stat_evasion';
export const LIFE = 'explicit.stat_life';
export const SPELL = 'explicit.stat_spell';
export const MELEE = 'explicit.stat_melee';

export const WEIGHTS = WeightsFileSchema.parse({
  schemaVersion: '6.0.0',
  gamePatch: '0.4.0',
  producer: { id: 'test', generatedAt: '2026-10-02T00:00:00Z' },
  bases: {
    'accessory.amulet': {
      Amulets: {
        prefix: {
          poolCoverage: 'complete',
          // Out of order on purpose: `tiers` sorts by itemLevelMin.
          entries: [
            tier('prefix', 'BaseSpirit', { itemLevelMin: 25, tierLabel: 'T2', text: '+# to Spirit', lines: [{ statId: SPIRIT, ranges: [[34, 37]] }] }),
            tier('prefix', 'BaseSpirit', { itemLevelMin: 16, tierLabel: 'T3', text: '+# to Spirit', lines: [{ statId: SPIRIT, ranges: [[30, 33]] }] }),
            tier('prefix', 'BaseSpirit', { itemLevelMin: 54, tierLabel: 'T1', text: '+# to Spirit', lines: [{ statId: SPIRIT, ranges: [[47, 50]] }] }),
            tier('prefix', 'IncreasedLife', { itemLevelMin: 1, tierLabel: 'T1', text: '+# to maximum Life', lines: [{ statId: LIFE, ranges: [[10, 19]] }] }),
          ],
        },
        suffix: {
          poolCoverage: 'complete',
          entries: [
            tier('suffix', 'SpiritSuffix', { itemLevelMin: 40, tierLabel: 'T1', text: '+# to Spirit', lines: [{ statId: SPIRIT, ranges: [[5, 6]] }] }),
            // One modGroup, two mod families: two rows, not one hybrid.
            tier('suffix', 'GemLevel', { itemLevelMin: 41, tierLabel: 'T1', text: '+# to Level of all Melee Skills', lines: [{ statId: MELEE, ranges: [[2, 2]] }] }),
            tier('suffix', 'GemLevel', { itemLevelMin: 5, tierLabel: 'T2', text: '+# to Level of all Spell Skills', lines: [{ statId: SPELL, ranges: [[1, 1]] }] }),
            tier('suffix', 'GemLevel', { itemLevelMin: 41, tierLabel: 'T1', text: '+# to Level of all Spell Skills', lines: [{ statId: SPELL, ranges: [[2, 2]] }] }),
          ],
        },
      },
    },
    'armour.chest': {
      Body_Armours_dex: {
        prefix: {
          poolCoverage: 'complete',
          entries: [
            tier('prefix', 'BaseLocalDefencesAndLife', { itemLevelMin: 33, tierLabel: 'T1', text: '#% increased Evasion Rating\n+# to maximum Life', lines: [
              { statId: EVASION, ranges: [[21, 26]] },
              { statId: LIFE, ranges: [[20, 23]] },
            ] }),
            tier('prefix', 'BaseLocalDefencesAndLife', { itemLevelMin: 16, tierLabel: 'T2', text: '#% increased Evasion Rating\n+# to maximum Life', lines: [
              { statId: EVASION, ranges: [[14, 20]] },
              { statId: LIFE, ranges: [[11, 19]] },
            ] }),
            tier('prefix', 'IncreasedLife', { itemLevelMin: 1, tierLabel: 'T1', text: '+# to maximum Life', lines: [{ statId: LIFE, ranges: [[10, 19]] }] }),
          ],
        },
        suffix: {
          poolCoverage: 'complete',
          entries: [tier('suffix', 'Thorns', { itemLevelMin: 1, tierLabel: 'T1', text: '# to # Thorns', lines: [{ statId: JSON_NULL, ranges: [] }] })],
        },
      },
    },
    // A second category with a class of the same name, for the ambiguity row.
    'armour.shield': { Body_Armours_dex: { prefix: { poolCoverage: 'complete', entries: [] }, suffix: { poolCoverage: 'complete', entries: [] } } },
  },
});

export const A = 'explicit.stat_a';
export const B = 'explicit.stat_b';

export function nullLineWeights(poolCoverage: 'complete' | 'partial'): WeightsFile {
  const notInGame = {
    ...tier('prefix', 'Dead', { itemLevelMin: 1, tierLabel: 'T1', text: 'dead', lines: [{ statId: JSON_NULL, ranges: [] }] }),
    weight: 0,
    weightSource: 'not-in-game',
  };
  return WeightsFileSchema.parse({
    schemaVersion: '6.0.0',
    gamePatch: '0.4.0',
    producer: { id: 'test', generatedAt: '2026-10-02T00:00:00Z' },
    bases: {
      'accessory.ring': {
        Rings: {
          prefix: {
            poolCoverage,
            entries: [
              // An internal engine line on a weight > 0 tier: one {A, B} family, not a second one.
              tier('prefix', 'Hybrid', { itemLevelMin: 10, tierLabel: 'T2', text: 'a b', lines: [
                { statId: A, ranges: [[1, 2]] },
                { statId: B, ranges: [[3, 4]] },
              ] }),
              tier('prefix', 'Hybrid', { itemLevelMin: 20, tierLabel: 'T1', text: 'a b', lines: [
                { statId: B, ranges: [[5, 6]] },
                { statId: A, ranges: [[3, 4]] },
                { statId: JSON_NULL, ranges: [] },
              ] }),
              notInGame,
              // A mixed family: only the {A, null} tier is untrackable, and only in a partial pool.
              tier('prefix', 'Mixed', { itemLevelMin: 10, tierLabel: 'T2', text: 'a', lines: [{ statId: A, ranges: [[1, 2]] }] }),
              tier('prefix', 'Mixed', { itemLevelMin: 20, tierLabel: 'T1', text: 'a', lines: [
                { statId: A, ranges: [[3, 4]] },
                { statId: JSON_NULL, ranges: [] },
              ] }),
            ],
          },
          suffix: { poolCoverage: 'complete', entries: [] },
        },
      },
    },
  });
}
