import { parseEnvelope, WEIGHTS_SCHEMA_VERSION, WeightsFileSchema } from '@poe/contracts';
import type { ModifierReference, WeightsClassPools } from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { edgeAlignment, emptyContainment, scopedPools } from '../cross-file.ts';
import { containedIn, needs, ownInterval, poolOf } from '../probability.ts';

const LIGHTNING = 'explicit.stat_3336890334';
const band = (valueMin: number, valueMax: number): ModifierReference => ({ kind: 'banded', statId: LIGHTNING, valueMin, valueMax });

/** The committed Bows slot pools (pnpm test:data). */
async function bowsPools(): Promise<WeightsClassPools> {
  // A non-literal specifier: the file sits outside this package's `rootDir`.
  const here = (import.meta as { readonly dirname: string }).dirname;
  const raw = ((await import(/* @vite-ignore */ `${here}/../../../../data/weights.json`)) as { default: unknown }).default;
  const weights = parseEnvelope(WeightsFileSchema, raw, WEIGHTS_SCHEMA_VERSION);
  if (!weights.ok) {
    throw new Error('the committed weights file was refused');
  }
  const lookup = poolOf(weights.value, 'weapon.bow', 'Bows');
  if (!lookup.ok) {
    throw new Error('Bows is absent from the committed weights file');
  }
  return lookup.pools;
}

describe('the committed Bows "Adds # to # Lightning Damage" tiers (AD-11)', () => {
  it('give T3, T2 and T1 their own intervals', async () => {
    const { prefix: pool } = await bowsPools();
    const ownAt = (itemLevelMin: number) => {
      const tier = pool.entries.find((entry) => entry.itemLevelMin === itemLevelMin && entry.lines.some((line) => line.statId === LIGHTNING));
      const line = tier?.lines.find((candidate) => candidate.statId === LIGHTNING);
      if (tier === undefined || line === undefined) {
        throw new Error(`no lightning tier at ${String(itemLevelMin)}`);
      }
      return ownInterval(line, tier, pool);
    };
    expect(ownAt(65)).toEqual({ min: 57, max: 80 });
    expect(ownAt(75)).toEqual({ min: 80.5, max: 103 });
    expect(ownAt(81)).toEqual({ min: 103.5, max: 123 });
  });

  it('split into T1 and T2 entries: each contains one tier, needs its floor and passes the floor checks', async () => {
    const classPools = await bowsPools();
    const pool = classPools.prefix;
    for (const [reference, floor] of [[band(103.5, 123), 81], [band(80.5, 103), 75]] as const) {
      const scope = { scoped: scopedPools(classPools, floor).prefix, pool };
      expect(containedIn(reference, pool.entries, pool).map((entry) => entry.itemLevelMin)).toEqual([floor]);
      expect(needs(reference, pool)).toBe(floor);
      expect(emptyContainment('prefix', reference, scope, floor)).toBeUndefined();
      expect(edgeAlignment('prefix', reference, scope, floor)).toBeUndefined();
    }
  });

  it('rejects a band that contains T1 and clips T2', async () => {
    const { prefix: pool } = await bowsPools();
    expect(containedIn(band(90, 123), pool.entries, pool).map((entry) => entry.itemLevelMin)).toEqual([81]);
    expect(edgeAlignment('prefix', band(90, 123), { scoped: pool.entries, pool }, 82)).toContain('extremes [101.5, 123] (own minimum 103.5)');
  });
});
