import { canonicalKey, parseEnvelope, TrackedFileSchema, WEIGHTS_SCHEMA_VERSION, WeightsFileSchema } from '@poe/contracts';
import type {
  CraftedTrackedEntry,
  ModifierRef,
  ModifierWeight,
  TrackedEntry,
  WeightsClassPools,
  WeightsFile,
  WeightsLine,
  WeightsPool,
} from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { classDiscriminability, crossFileChecks, edgeAlignment, emptyContainment } from './cross-file.ts';

const STAT = 'explicit.stat_1';
const OTHER = 'explicit.stat_2';
const SUFFIX_STAT = 'explicit.stat_9';

let serial = 0;

/** One weights tier, built in the test (NFR-2). */
function tier(lines: readonly WeightsLine[], { itemLevelMin = 1, weight = 100 } = {}): ModifierWeight {
  serial += 1;
  return {
    sourceModifierId: `m${String(serial)}`,
    modGroup: `g${String(serial)}`,
    itemLevelMin,
    weight,
    weightSource: 'published',
    lines: [...lines],
  };
}

const line = (statId: string | null, ...ranges: (readonly [number, number])[]): WeightsLine => ({
  statId,
  ranges: ranges.map(([min, max]) => [min, max] as [number, number]),
});

const band = (valueMin: number, valueMax: number, statId = STAT): ModifierRef => ({
  kind: 'banded',
  statId,
  valueMin,
  valueMax,
});
const valueless = (statId = STAT): ModifierRef => ({ kind: 'valueless', statId });

/** T7 derives to `[43, 56.5]` (a two-`#` line), T8 to `[56, 80]`. */
const T7 = (itemLevelMin = 60) => tier([line(STAT, [40, 53], [46, 60])], { itemLevelMin });
const T8 = (itemLevelMin = 75) => tier([line(STAT, [56, 80])], { itemLevelMin });
/** A suffix pool one reference aligns on. */
const SUFFIX_TIER = tier([line(SUFFIX_STAT, [1, 2])]);

function pools(
  prefix: readonly ModifierWeight[],
  suffix: readonly ModifierWeight[] = [SUFFIX_TIER],
  coverage: { prefix?: WeightsPool['poolCoverage']; suffix?: WeightsPool['poolCoverage'] } = {},
): WeightsClassPools {
  return {
    prefix: { poolCoverage: coverage.prefix ?? 'complete', entries: [...prefix] },
    suffix: { poolCoverage: coverage.suffix ?? 'complete', entries: [...suffix] },
  };
}

function weightsOf(classes: Record<string, Record<string, WeightsClassPools>>): WeightsFile {
  return {
    schemaVersion: WEIGHTS_SCHEMA_VERSION,
    gamePatch: '0.5.5',
    producer: { id: 'test', generatedAt: '2026-09-27T00:00:00Z' },
    bases: classes,
  };
}

const bows = (classPools: WeightsClassPools) => weightsOf({ 'weapon.bow': { Bows: classPools } });

function entry(
  affixes: { prefix?: ModifierRef; suffix?: ModifierRef },
  { itemLevelMin = 82, categoryId = 'weapon.bow', className = 'Bows' } = {},
): CraftedTrackedEntry {
  return { kind: 'crafted', categoryId, className, itemLevelMin, ...affixes, status: 'active' };
}

const checksOf = (entries: readonly TrackedEntry[], weights: WeightsFile | null) =>
  crossFileChecks(entries, weights).map((failure) => [failure.check, failure.entryKey]);

describe('edge alignment (§2.4)', () => {
  const scoped = [T7(), T8()];

  it.each([
    ['43.0–56.5', 43, 56.5],
    ['56.0–80.0', 56, 80],
    ['43.0–80.0', 43, 80],
  ])('accepts %s over T7 and T8', (_label, min, max) => {
    expect(edgeAlignment('prefix', band(min, max), scoped, 82)).toBeUndefined();
    expect(crossFileChecks([entry({ prefix: band(min, max) })], bows(pools(scoped)))).toEqual([]);
  });

  it.each([
    ['43.0–60.0, clipped', 43, 60],
    ['0–9999, sentinel', 0, 9999],
  ])('rejects %s', (_label, min, max) => {
    const tracked = entry({ prefix: band(min, max) });
    const [failure, ...rest] = crossFileChecks([tracked], bows(pools(scoped)));
    expect(rest).toEqual([]);
    expect(failure?.check).toBe('edge-alignment');
    expect(failure?.entryKey).toBe(canonicalKey(tracked));
    expect(failure?.detail).toContain('prefix');
    expect(failure?.detail).toContain(STAT);
    expect(failure?.detail).toContain('floor 82');
  });

  it('ignores a contained hybrid entry’s foreign statId line', () => {
    const hybrid = tier([line(STAT, [43, 56.5]), line(OTHER, [1, 500])]);
    expect(edgeAlignment('prefix', band(43, 56.5), [hybrid], 82)).toBeUndefined();
  });

  it('fails at the floor when a band aligns only above it', () => {
    const tracked = entry({ prefix: band(43, 80) }, { itemLevelMin: 70 });
    // At 70, T8 (75) leaves the scope, so the band's ceiling is past T7's.
    expect(checksOf([tracked], bows(pools(scoped)))).toEqual([['edge-alignment', canonicalKey(tracked)]]);
    expect(checksOf([{ ...tracked, itemLevelMin: 82 }], bows(pools(scoped)))).toEqual([]);
  });

  it('skips a valueless reference', () => {
    expect(edgeAlignment('prefix', valueless(), [tier([line(STAT)])], 82)).toBeUndefined();
  });
});

describe('empty containment set (§2.5)', () => {
  it('fails when no scoped entry contains the reference, naming the ref, the floor and the absence, and no file', () => {
    const tracked = entry({ prefix: band(12, 15) });
    const [failure, ...rest] = crossFileChecks([tracked], bows(pools([tier([line(STAT, [5, 15])])])));
    expect(rest).toEqual([]);
    expect(failure?.check).toBe('empty-containment-set');
    expect(failure?.detail).toContain(`prefix ${STAT} band [12, 15]`);
    expect(failure?.detail).toContain('floor 82');
    expect(failure?.detail).toContain('no scoped entry contains it');
    expect(failure?.detail).not.toMatch(/\.json|weights file|tracked list/i);
  });

  it('fails when only weight-0 tiers match, never P = 0', () => {
    const scoped = [tier([line(STAT, [43, 56.5])], { weight: 0 })];
    expect(emptyContainment('prefix', band(43, 56.5), scoped, 82)).toContain('no scoped entry contains it');
  });

  it('fails a tier that sits above the floor', () => {
    const scoped = [tier([line(STAT, [43, 56.5])], { itemLevelMin: 83 })];
    expect(checksOf([entry({ prefix: band(43, 56.5) })], bows(pools(scoped)))[0]?.[0]).toBe('empty-containment-set');
  });
});

describe('kind agreement (§2.3), universal', () => {
  it('fails a valueless reference when any scoped line on its statId is banded', () => {
    const scoped = [tier([line(STAT)], { itemLevelMin: 55 }), tier([line(STAT, [2, 2])], { itemLevelMin: 82 })];
    const tracked = entry({ prefix: valueless() });
    const failures = crossFileChecks([tracked], bows(pools(scoped)));
    expect(failures.map((failure) => failure.check)).toEqual(['kind-agreement']);
    expect(failures[0]?.detail).toContain('1 scoped line on that statId is banded');
  });

  it('fails a banded reference when any scoped line is valueless', () => {
    const scoped = [tier([line(STAT, [43, 56.5])]), tier([line(STAT)])];
    expect(checksOf([entry({ prefix: band(43, 56.5) })], bows(pools(scoped)))[0]?.[0]).toBe('kind-agreement');
  });

  it('ignores a disagreeing line above the floor or at weight 0', () => {
    const scoped = [
      tier([line(STAT)]),
      tier([line(STAT, [2, 2])], { itemLevelMin: 90 }),
      tier([line(STAT, [3, 3])], { weight: 0 }),
    ];
    expect(checksOf([entry({ prefix: valueless() })], bows(pools(scoped)))).toEqual([]);
  });
});

describe('coOccur (§2.1, §2.2)', () => {
  const hybrid = tier([line(STAT, [10, 20]), line(OTHER, [5, 6])]);
  const first = entry({ prefix: band(10, 20) });
  const second = entry({ prefix: band(5, 6, OTHER) });

  it('fails both entries when two refs in one slot name two lines of one scoped entry', () => {
    const failures = crossFileChecks([first, second], bows(pools([hybrid])));
    expect(failures.map((failure) => failure.check)).toEqual(['co-occur', 'co-occur']);
    expect(new Set(failures.map((failure) => failure.entryKey))).toEqual(
      new Set([canonicalKey(first), canonicalKey(second)]),
    );
    for (const failure of failures) {
      expect(failure.detail).toContain(canonicalKey(first) === failure.entryKey ? canonicalKey(second) : canonicalKey(first));
      expect(failure.detail).toContain('prefix (the two statIds co-occur on one scoped entry)');
      expect(failure.detail).toContain('suffix (absent on one entry)');
    }
  });

  it('passes when no scoped entry carries both', () => {
    const apart = [tier([line(STAT, [10, 20])]), tier([line(OTHER, [5, 6])])];
    expect(checksOf([first, second], bows(pools(apart)))).toEqual([]);
  });

  it('passes when the other slot keeps the pair apart', () => {
    const suffixA = tier([line(SUFFIX_STAT, [1, 2])]);
    const suffixB = tier([line('explicit.stat_8', [1, 2])]);
    const a = entry({ prefix: band(10, 20), suffix: band(1, 2, SUFFIX_STAT) });
    const b = entry({ prefix: band(5, 6, OTHER), suffix: band(1, 2, 'explicit.stat_8') });
    expect(checksOf([a, b], bows(pools([hybrid], [suffixA, suffixB])))).toEqual([]);
  });
});

describe('class discriminability (§2.6)', () => {
  const plain = pools([T7()]);

  it('fails a plain class in a mixed category, naming class, category, sibling count and the reason', () => {
    const weights = weightsOf({
      'armour.chest': { Body_Armours: plain, Body_Armours_dex: plain, Body_Armours_str: plain },
    });
    const tracked = entry({ prefix: band(43, 56.5) }, { categoryId: 'armour.chest', className: 'Body_Armours' });
    const failures = crossFileChecks([tracked], weights);
    expect(failures.map((failure) => failure.check)).toEqual(['class-discriminability']);
    const detail = failures[0]?.detail ?? '';
    for (const part of ['Body_Armours', 'armour.chest', '2 sibling classes', 'class not discriminable']) {
      expect(detail).toContain(part);
    }
  });

  it('passes arm 1, arm 2 and arm 3', () => {
    const mixed = weightsOf({ 'armour.chest': { Body_Armours_dex: plain, Body_Armours_str: plain } });
    const jewels = weightsOf({ jewel: { Emerald: plain, Ruby: plain } });
    const single = weightsOf({ 'weapon.bow': { Bows: plain } });
    expect(classDiscriminability({ categoryId: 'armour.chest', className: 'Body_Armours_dex' }, mixed)).toBeUndefined();
    expect(classDiscriminability({ categoryId: 'jewel', className: 'Emerald' }, jewels)).toBeUndefined();
    expect(classDiscriminability({ categoryId: 'weapon.bow', className: 'Bows' }, single)).toBeUndefined();
  });
});

describe('crossFileChecks scope', () => {
  it('runs no check without a weights file', () => {
    expect(crossFileChecks([entry({ prefix: band(0, 9999) })], null)).toEqual([]);
  });

  it('runs no pool check on an absent class or a partial slot', () => {
    const tracked = entry({ prefix: band(0, 9999) });
    expect(crossFileChecks([tracked], weightsOf({}))).toEqual([]);
    expect(crossFileChecks([tracked], bows(pools([T7()], [SUFFIX_TIER], { suffix: 'partial' })))).toEqual([]);
  });

  it('still runs class discriminability on a class whose own pool is partial', () => {
    const complete = pools([T7()]);
    const weights = weightsOf({
      'armour.chest': {
        Body_Armours: pools([T7()], [SUFFIX_TIER], { prefix: 'partial' }),
        Body_Armours_dex: complete,
        Body_Armours_str: complete,
      },
    });
    const tracked = entry({ prefix: band(0, 9999) }, { categoryId: 'armour.chest', className: 'Body_Armours' });
    expect(checksOf([tracked], weights)).toEqual([['class-discriminability', canonicalKey(tracked)]]);
  });

  it('sees neither pruned nor raw entries', () => {
    const pruned: TrackedEntry = { ...entry({ prefix: band(0, 9999) }), status: 'pruned', prunedReason: 'gone' };
    const raw: TrackedEntry = { kind: 'raw', baseTypeId: 'Gold Amulet', itemLevelMin: 82, status: 'active' };
    expect(crossFileChecks([pruned, raw], bows(pools([T7()])))).toEqual([]);
  });

  it('reports one failure per (check, entry), every slot in its detail, sorted by key then check', () => {
    const tracked = entry({ prefix: band(0, 9999), suffix: band(0, 9999, SUFFIX_STAT) });
    const alsoEmpty = entry({ prefix: band(1000, 2000), suffix: band(1, 2, SUFFIX_STAT) });
    const failures = crossFileChecks([tracked, alsoEmpty], bows(pools([T7(), T8()])));
    const edge = failures.find((failure) => failure.check === 'edge-alignment');
    expect(edge?.detail).toContain('prefix');
    expect(edge?.detail).toContain('suffix');
    expect(failures.filter((failure) => failure.check === 'edge-alignment')).toHaveLength(1);
    const keys = failures.map((failure) => `${failure.entryKey}|${failure.check}`);
    expect(keys).toEqual(keys.toSorted());
    expect(failures[0]).toMatchObject({ categoryId: 'weapon.bow', className: 'Bows' });
  });

  it('finds no failure on the committed files', async () => {
    const here = (import.meta as ImportMeta & { readonly dirname: string }).dirname;
    const load = async (name: string): Promise<unknown> =>
      ((await import(/* @vite-ignore */ `${here}/../../../data/${name}`)) as { default: unknown }).default;
    const tracked = parseEnvelope(TrackedFileSchema, await load('tracked.json'));
    const weights = parseEnvelope(WeightsFileSchema, await load('weights.json'), WEIGHTS_SCHEMA_VERSION);
    if (!tracked.ok || !weights.ok) {
      throw new Error('a committed data file was refused');
    }
    expect(crossFileChecks(tracked.value.entries, weights.value)).toEqual([]);
  });
});
