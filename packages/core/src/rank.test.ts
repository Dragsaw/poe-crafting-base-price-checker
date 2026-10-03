import {
  canonicalKey,
  DatasetFileSchema,
  parseEnvelope,
  RankedRowSchema,
  RecipesFileSchema,
  TrackedFileSchema,
  WEIGHTS_SCHEMA_VERSION,
  WeightsFileSchema,
} from '@poe/contracts';
import type {
  CraftedRankedRow,
  CraftRecipe,
  CurrencyRate,
  DatasetEntry,
  ModifierWeight,
  PriceObservation,
  PriceState,
  RankedRow,
  RawRankedRow,
  TrackedEntry,
  WeightsFile,
  WeightsPool,
} from '@poe/contracts';
import { describe, expect, it } from 'vitest';

import { poolCoverage } from './coverage.ts';
import { compareRankedRows, rank } from './rank.ts';
import type { RankInput, Ranking } from './rank.ts';

const LEAGUE = 'Forbidden Rites';
const OLD_LEAGUE = 'Standard Rites';
const THRESHOLD = 0.25;
const ATTEMPTED = '2026-09-26T11:00:00Z';

function raw(baseTypeId: string, status: TrackedEntry['status'] = 'active'): TrackedEntry {
  return status === 'pruned'
    ? { kind: 'raw', baseTypeId, itemLevelMin: 82, status, prunedReason: 'no market' }
    : { kind: 'raw', baseTypeId, itemLevelMin: 82, status };
}

type Coverage = WeightsPool['poolCoverage'];

const SLOT_FILLER: ModifierWeight = {
  sourceModifierId: 'slot-filler',
  modGroup: 'slot-filler',
  itemLevelMin: 1,
  weight: 1,
  weightSource: 'published',
  lines: [{ statId: 'explicit.stat_slot_filler', ranges: [[1, 10]] }],
};

function slotOf(coverage: Coverage): WeightsFile['bases'][string][string]['prefix'] {
  return { poolCoverage: coverage, entries: coverage === 'complete' ? [SLOT_FILLER] : [] };
}

/** A parsed weights file carrying exactly `classes`, each `[categoryId, className, prefix, suffix]` coverage. */
function weightsWith(...classes: readonly (readonly [string, string, Coverage?, Coverage?])[]): WeightsFile {
  const bases: Record<string, WeightsFile['bases'][string]> = {};
  for (const [categoryId, className, prefix = 'complete', suffix = 'complete'] of classes) {
    bases[categoryId] = {
      ...bases[categoryId],
      // A complete slot holds one weighted tier: an empty one is unreachable (IN §3).
      [className]: { prefix: slotOf(prefix), suffix: slotOf(suffix) },
    };
  }
  return {
    schemaVersion: '6.0.0',
    gamePatch: '0.5.5',
    producer: { id: 'test', generatedAt: '2026-09-26T00:00:00Z' },
    bases,
  };
}

/** Every crafted class these tests name by default, both slots `complete`. */
const WEIGHTS = weightsWith(['accessory.amulet', 'Amulets'], ['weapon.bow', 'Bows']);

const crafted: TrackedEntry = {
  kind: 'crafted',
  categoryId: 'accessory.amulet',
  className: 'Amulets',
  itemLevelMin: 54,
  prefix: { kind: 'valueless', statId: 'explicit.stat_1' },
  status: 'active',
};

function observation(priceDivine: number, league: string = LEAGUE): PriceObservation {
  return {
    league,
    observedAt: '2026-09-26T10:00:00Z',
    priceDivine,
    sampleSize: 10,
    exchangeObservation: {
      currencyId: 'exalted',
      rate: 0.0042,
      source: 'in-game exchange, by hand',
      league,
      asOf: '2026-09-25T08:00:00Z',
    },
  };
}

const priced = (priceDivine: number, league: string = LEAGUE): PriceState => ({
  state: 'priced',
  observation: observation(priceDivine, league),
});

function published(
  entry: TrackedEntry,
  price: PriceState,
  /** `null` publishes no `lastAttemptedAt`; `undefined` would take the default. */
  lastAttemptedAt: string | null = ATTEMPTED,
): DatasetEntry {
  return lastAttemptedAt === null
    ? { entryKey: canonicalKey(entry), price }
    : { entryKey: canonicalKey(entry), price, lastAttemptedAt };
}

function ranked(input: Partial<RankInput> & Pick<RankInput, 'tracked'>): Ranking {
  return rank({ dataset: [], activeLeague: LEAGUE, threshold: THRESHOLD, weights: WEIGHTS, ...input });
}

const keysOf = (items: readonly ({ entryKey: string } | { classKey: string })[]): string[] =>
  items.map((item) => ('entryKey' in item ? item.entryKey : item.classKey));

/** The raw rows of a ranking, narrowed. */
const rawRows = (rows: readonly RankedRow[]): RawRankedRow[] => rows.flatMap((row) => (row.kind === 'raw' ? [row] : []));

/** Every entry key the ranking mentions, in any group. */
const everyKey = (result: Ranking): string[] => [
  ...keysOf(result.ordering),
  ...keysOf(result.belowThreshold),
  ...keysOf(result.noListings),
  ...keysOf(result.notYetSynced),
  ...keysOf(result.unresolvable),
];

describe('rank: the I/O matrix', () => {
  it('a priced entry that clears the threshold is a row, EV its price, craft cost 0', () => {
    const A = raw('A');
    const result = ranked({ tracked: [A], dataset: [published(A, priced(0.5))] });
    expect(result.ordering).toEqual([
      {
        kind: 'raw',
        entryKey: canonicalKey(A),
        baseTypeId: 'A',
        itemLevelMin: 82,
        status: 'active',
        ev: 0.5,
        craftCost: 0,
        observation: observation(0.5),
        lastAttemptedAt: ATTEMPTED,
      },
    ]);
    expect(result.belowThreshold).toEqual([]);
  });

  it('a priced row whose dataset entry has no lastAttemptedAt carries none', () => {
    const A = raw('A');
    const result = ranked({ tracked: [A], dataset: [published(A, priced(0.5), null)] });
    expect(keysOf(result.ordering)).toEqual([canonicalKey(A)]);
    expect(result.ordering[0]).not.toHaveProperty('lastAttemptedAt');
  });

  it('a price exactly at the threshold survives', () => {
    const A = raw('A');
    const result = ranked({ tracked: [A], dataset: [published(A, priced(0.25))] });
    expect(keysOf(result.ordering)).toEqual([canonicalKey(A)]);
    expect(result.belowThreshold).toEqual([]);
  });

  it('a price below the threshold is in belowThreshold only', () => {
    const A = raw('A');
    const result = ranked({ tracked: [A], dataset: [published(A, priced(0.1))] });
    expect(result.ordering).toEqual([]);
    expect(keysOf(result.belowThreshold)).toEqual([canonicalKey(A)]);
    expect(result.belowThreshold[0]?.ev).toBe(0.1);
    expect(everyKey(result)).toEqual([canonicalKey(A)]);
  });

  it('an observation from another league is not-yet-synced / league-mismatch, never below-threshold', () => {
    const A = raw('A');
    const B = raw('B');
    const result = ranked({
      tracked: [A, B],
      dataset: [published(A, priced(0.5, OLD_LEAGUE)), published(B, priced(0.1, OLD_LEAGUE))],
    });
    expect(result.ordering).toEqual([]);
    expect(result.belowThreshold).toEqual([]);
    expect(result.notYetSynced).toEqual([
      { entry: A, entryKey: canonicalKey(A), lastAttemptedAt: ATTEMPTED, reason: 'league-mismatch' },
      { entry: B, entryKey: canonicalKey(B), lastAttemptedAt: ATTEMPTED, reason: 'league-mismatch' },
    ]);
  });

  it('compares only observation.league against the active league', () => {
    const A = raw('A');
    // The exchange observation's league differs; only the observation's own league counts.
    const price: PriceState = {
      state: 'priced',
      observation: { ...observation(0.5), exchangeObservation: observation(1, OLD_LEAGUE).exchangeObservation },
    };
    const result = ranked({ tracked: [A], dataset: [published(A, price)] });
    expect(keysOf(result.ordering)).toEqual([canonicalKey(A)]);
  });

  it('a tracked entry with no dataset entry is not-yet-synced / never-synced, with no lastAttemptedAt', () => {
    const A = raw('A');
    const result = ranked({ tracked: [A] });
    expect(result.notYetSynced).toEqual([{ entry: A, entryKey: canonicalKey(A), reason: 'never-synced' }]);
    expect(result.notYetSynced[0]).not.toHaveProperty('lastAttemptedAt');
  });

  it('other states go to their own group, the published reason kept', () => {
    const N = raw('N');
    const U = raw('U');
    const X = raw('X');
    const result = ranked({
      tracked: [N, U, X],
      dataset: [
        published(N, { state: 'no-listings' }),
        published(U, { state: 'unresolvable' }, null),
        published(X, { state: 'not-yet-synced', reason: 'no-exchange-rate' }),
      ],
    });
    expect(result.noListings).toEqual([{ entry: N, entryKey: canonicalKey(N), lastAttemptedAt: ATTEMPTED }]);
    expect(result.unresolvable).toEqual([{ entry: U, entryKey: canonicalKey(U) }]);
    expect(result.notYetSynced).toEqual([
      { entry: X, entryKey: canonicalKey(X), lastAttemptedAt: ATTEMPTED, reason: 'no-exchange-rate' },
    ]);
    expect(result.ordering).toEqual([]);
    expect(result.belowThreshold).toEqual([]);
  });

  it('pruned and crafted entries are absent from every group', () => {
    const P = raw('P', 'pruned');
    const result = ranked({
      tracked: [P, crafted],
      dataset: [published(P, priced(0.5)), published(crafted, priced(0.5))],
    });
    expect(everyKey(result)).toEqual([]);
    expect(result.unrankable.map((item) => item.reason)).toEqual([NO_RECIPE]);
  });

  it('a dataset entry whose key is not tracked is ignored', () => {
    const A = raw('A');
    const result = ranked({ tracked: [], dataset: [published(A, priced(0.5))] });
    expect(everyKey(result)).toEqual([]);
  });

  it('equal EV breaks on the canonical key, stable across input order', () => {
    const A = raw('A');
    const B = raw('B');
    const dataset = [published(B, priced(0.5)), published(A, priced(0.5))];
    expect(keysOf(ranked({ tracked: [B, A], dataset }).ordering)).toEqual([A, B].map(canonicalKey));
    expect(keysOf(ranked({ tracked: [A, B], dataset }).ordering)).toEqual([A, B].map(canonicalKey));
  });

  it('breaks ties on the whole serialised key, not a bare base type id', () => {
    const low: TrackedEntry = { kind: 'raw', baseTypeId: 'A', itemLevelMin: 86, status: 'active' };
    const high: TrackedEntry = { kind: 'raw', baseTypeId: 'A', itemLevelMin: 100, status: 'active' };
    const result = ranked({
      tracked: [low, high],
      dataset: [published(low, priced(0.5)), published(high, priced(0.5))],
    });
    // '["raw","A",100]' < '["raw","A",86]' by code unit.
    expect(keysOf(result.ordering)).toEqual([canonicalKey(high), canonicalKey(low)]);
  });

  it('orders by EV descending before any tie-break', () => {
    const A = raw('A');
    const B = raw('B');
    const C = raw('C', 'pinned');
    const result = ranked({
      tracked: [A, B, C],
      dataset: [published(A, priced(0.3)), published(B, priced(2)), published(C, priced(0.9))],
    });
    expect(keysOf(result.ordering)).toEqual([B, C, A].map(canonicalKey));
    expect(rawRows(result.ordering)[1]?.status).toBe('pinned');
  });

  it('passes a 4dp value on exactly, never re-rounded', () => {
    const A = raw('A');
    const result = ranked({ tracked: [A], dataset: [published(A, priced(0.1235))], threshold: 0.1 });
    expect(result.ordering[0]?.ev).toBe(0.1235);
    expect(rawRows(result.ordering)[0]?.observation.priceDivine).toBe(0.1235);
  });

  it('nothing clears: the ordering is empty and every row is below the threshold', () => {
    const A = raw('A');
    const B = raw('B');
    const result = ranked({
      tracked: [B, A],
      dataset: [published(A, priced(0.2)), published(B, priced(0.01))],
    });
    expect(result.ordering).toEqual([]);
    expect(keysOf(result.belowThreshold)).toEqual([A, B].map(canonicalKey));
  });

  it('every non-ordering group is in canonical key order', () => {
    const entries = ['D', 'B', 'C', 'A'].map((id) => raw(id));
    const result = ranked({
      tracked: entries,
      dataset: entries.map((entry, index) => published(entry, index % 2 === 0 ? priced(0.1) : { state: 'no-listings' })),
    });
    expect(keysOf(result.belowThreshold)).toEqual([canonicalKey(raw('C')), canonicalKey(raw('D'))]);
    expect(keysOf(result.noListings)).toEqual([canonicalKey(raw('A')), canonicalKey(raw('B'))]);

    const mixed = ranked({
      tracked: [raw('Z'), raw('M'), raw('A')],
      dataset: [published(raw('M'), priced(0.5, OLD_LEAGUE))],
    });
    expect(mixed.notYetSynced.map((item) => [item.entry.baseTypeId, item.reason])).toEqual([
      ['A', 'never-synced'],
      ['M', 'league-mismatch'],
      ['Z', 'never-synced'],
    ]);
  });
});

describe('rank: the threshold domain', () => {
  it('threshold 0 is valid: a priced entry is in the ordering', () => {
    const A = raw('A');
    const result = ranked({ tracked: [A], dataset: [published(A, priced(0.01))], threshold: 0 });
    expect(keysOf(result.ordering)).toEqual([canonicalKey(A)]);
    expect(result.belowThreshold).toEqual([]);
  });

  it('a NaN threshold throws a RangeError that names the threshold and the value', () => {
    const A = raw('A');
    const call = (): Ranking => ranked({ tracked: [A], dataset: [published(A, priced(0.5))], threshold: Number.NaN });
    expect(call).toThrow(RangeError);
    expect(call).toThrow(/threshold.*NaN/);
  });

  it.each([-0.01, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'threshold %s throws a RangeError and returns no Ranking',
    (threshold) => {
      const A = raw('A');
      let result: Ranking | undefined;
      expect(() => {
        result = ranked({ tracked: [A], dataset: [published(A, priced(0.5))], threshold });
      }).toThrow(RangeError);
      expect(result).toBeUndefined();
    },
  );

  it('throws even when there is nothing to group', () => {
    expect(() => ranked({ tracked: [], threshold: -1 })).toThrow(RangeError);
  });
});

/** A mixed input covering every matrix row. */
function matrixInput(): RankInput {
  const entries = {
    clears: raw('Clears'),
    atThreshold: raw('AtThreshold', 'pinned'),
    below: raw('Below'),
    oldLeague: raw('OldLeague'),
    neverSynced: raw('NeverSynced'),
    noListings: raw('NoListings'),
    unresolvable: raw('Unresolvable'),
    noRate: raw('NoRate'),
    pruned: raw('Pruned', 'pruned'),
    tieA: raw('TieA'),
    tieB: raw('TieB'),
    fourDp: raw('FourDp'),
  };
  return {
    tracked: [...Object.values(entries), crafted],
    dataset: [
      published(entries.clears, priced(0.5)),
      published(entries.atThreshold, priced(0.25)),
      published(entries.below, priced(0.1)),
      published(entries.oldLeague, priced(0.5, OLD_LEAGUE)),
      published(entries.noListings, { state: 'no-listings' }),
      published(entries.unresolvable, { state: 'unresolvable' }, null),
      published(entries.noRate, { state: 'not-yet-synced', reason: 'no-exchange-rate' }),
      published(entries.pruned, priced(0.5)),
      published(entries.tieA, priced(0.5)),
      published(entries.tieB, priced(0.5)),
      published(entries.fourDp, priced(0.1235)),
      published(crafted, priced(1)),
      published(raw('Untracked'), priced(9)),
    ],
    activeLeague: LEAGUE,
    threshold: THRESHOLD,
    weights: WEIGHTS,
  };
}

function craftedOf(
  categoryId: string,
  className: string,
  status: TrackedEntry['status'] = 'active',
  itemLevelMin = 54,
): TrackedEntry {
  const base = {
    kind: 'crafted' as const,
    categoryId,
    className,
    itemLevelMin,
    prefix: { kind: 'valueless' as const, statId: 'explicit.stat_1' },
  };
  return status === 'pruned' ? { ...base, status, prunedReason: 'no market' } : { ...base, status };
}

const ABSENT = 'class absent from weights file';
const PARTIAL = 'pool partial';
/** What a rankable class gets when `ranked` is given no recipe (retro item 29). */
const NO_RECIPE = 'recipe cannot reach this class';

describe('rank: the Unrankable Item Classes (AD-24, FR-4)', () => {
  it('names every crafted class, reason verbatim, when no weights envelope is loaded', () => {
    const result = ranked({
      tracked: [craftedOf('weapon.bow', 'Bows'), craftedOf('accessory.amulet', 'Amulets'), raw('A')],
      weights: null,
    });
    expect(result.unrankable).toEqual([
      { categoryId: 'accessory.amulet', className: 'Amulets', reason: ABSENT },
      { categoryId: 'weapon.bow', className: 'Bows', reason: ABSENT },
    ]);
  });

  it('names a class absent from the file, and never falls back to a sibling className', () => {
    const result = ranked({
      tracked: [craftedOf('jewel', 'Sapphire'), craftedOf('weapon.crossbow', 'Crossbows')],
      weights: weightsWith(['jewel', 'Emerald'], ['weapon.bow', 'Crossbows']),
    });
    expect(result.unrankable).toEqual([
      { categoryId: 'weapon.crossbow', className: 'Crossbows', reason: ABSENT },
      { categoryId: 'jewel', className: 'Sapphire', reason: ABSENT },
    ]);
  });

  it('never resolves a pair through the object prototype', () => {
    const result = ranked({ tracked: [craftedOf('toString', 'constructor')], weights: WEIGHTS });
    expect(result.unrankable).toEqual([{ categoryId: 'toString', className: 'constructor', reason: ABSENT }]);
  });

  it.each([
    ['the prefix', 'partial', 'complete'],
    ['the suffix', 'complete', 'partial'],
    ['both slots', 'partial', 'partial'],
  ] as const)('names a class whose %s declares partial as pool partial, once', (_label, prefix, suffix) => {
    const result = ranked({
      tracked: [craftedOf('jewel', 'Emerald'), craftedOf('jewel', 'Emerald', 'pinned', 82), craftedOf('weapon.bow', 'Bows')],
      weights: weightsWith(['jewel', 'Emerald', prefix, suffix], ['weapon.bow', 'Bows']),
    });
    expect(result.unrankable).toEqual([
      { categoryId: 'weapon.bow', className: 'Bows', reason: NO_RECIPE },
      { categoryId: 'jewel', className: 'Emerald', reason: PARTIAL, provenance: 'absent' },
    ]);
    expect(result.ordering).toEqual([]);
  });

  it('makes no weights claim for a complete class: no ranked row, only the no-recipe reason', () => {
    const result = ranked({ tracked: [craftedOf('weapon.bow', 'Bows')], weights: WEIGHTS });
    expect(result.unrankable).toEqual([{ categoryId: 'weapon.bow', className: 'Bows', reason: NO_RECIPE }]);
    expect(result.ordering).toEqual([]);
    expect(result.belowThreshold).toEqual([]);
  });

  it('holds no weights-file reason, and never the string, while a weights envelope is loaded', () => {
    const result = ranked({ tracked: [craftedOf('weapon.bow', 'Bows')], weights: WEIGHTS });
    expect(result.unrankable.map((item) => item.reason)).toEqual([NO_RECIPE]);
    expect(JSON.stringify(result)).not.toContain(ABSENT);
  });

  it('makes one class of two crafted entries on one (categoryId, className)', () => {
    const result = ranked({
      tracked: [craftedOf('weapon.bow', 'Bows', 'active', 54), craftedOf('weapon.bow', 'Bows', 'pinned', 82)],
      weights: null,
    });
    expect(result.unrankable).toEqual([{ categoryId: 'weapon.bow', className: 'Bows', reason: ABSENT }]);
  });

  it('keeps two classes that share a className but not a categoryId, breaking on categoryId', () => {
    const result = ranked({
      tracked: [craftedOf('armour.chest', 'Body Armours'), craftedOf('armour.chest.alt', 'Body Armours')],
      weights: null,
    });
    expect(result.unrankable.map((item) => item.categoryId)).toEqual(['armour.chest', 'armour.chest.alt']);
  });

  it('makes no class of one whose entries are all pruned, and keeps one with a live entry', () => {
    const result = ranked({
      tracked: [
        craftedOf('weapon.bow', 'Bows', 'pruned'),
        craftedOf('weapon.staff', 'Staves', 'pruned'),
        craftedOf('weapon.staff', 'Staves', 'active'),
      ],
      weights: null,
    });
    expect(result.unrankable.map((item) => item.className)).toEqual(['Staves']);
  });

  it('holds no class for a raw-only Tracked List, and leaves the raw branch unchanged', () => {
    const A = raw('A');
    const input = { tracked: [A], dataset: [published(A, priced(0.5))] };
    const absent = ranked({ ...input, weights: null });
    expect(absent.unrankable).toEqual([]);
    expect(absent).toEqual(ranked({ ...input, weights: WEIGHTS }));
  });

  it('sorts by className in UTF-8 code-unit order, not locale order', () => {
    const result = ranked({
      tracked: [craftedOf('c.b', 'bows'), craftedOf('c.a', 'Wands'), craftedOf('c.c', 'Amulets')],
      weights: null,
    });
    expect(result.unrankable.map((item) => item.className)).toEqual(['Amulets', 'Wands', 'bows']);
  });

  it('names a class a cross-file failure names as class disagrees with weights file, and no other', () => {
    const result = ranked({
      tracked: [craftedOf('weapon.bow', 'Bows'), craftedOf('accessory.amulet', 'Amulets')],
      weights: WEIGHTS,
      crossFileFailures: [{ categoryId: 'weapon.bow', className: 'Bows' }, { categoryId: 'weapon.bow', className: 'Bows' }],
    });
    expect(result.unrankable).toEqual([
      { categoryId: 'accessory.amulet', className: 'Amulets', reason: NO_RECIPE },
      { categoryId: 'weapon.bow', className: 'Bows', reason: 'class disagrees with weights file' },
    ]);
  });

  it('lets the lookup reasons take precedence over a cross-file failure', () => {
    const result = ranked({
      tracked: [craftedOf('jewel', 'Emerald'), craftedOf('jewel', 'Sapphire')],
      weights: weightsWith(['jewel', 'Emerald', 'partial']),
      crossFileFailures: [
        { categoryId: 'jewel', className: 'Emerald' },
        { categoryId: 'jewel', className: 'Sapphire' },
      ],
    });
    expect(result.unrankable).toEqual([
      { categoryId: 'jewel', className: 'Emerald', reason: PARTIAL, provenance: 'absent' },
      { categoryId: 'jewel', className: 'Sapphire', reason: ABSENT },
    ]);
  });

  it('is identical under a shuffled Tracked List', () => {
    const tracked = [
      craftedOf('weapon.bow', 'Bows'),
      craftedOf('weapon.bow', 'Bows', 'active', 82),
      craftedOf('accessory.amulet', 'Amulets'),
      craftedOf('weapon.staff', 'Staves', 'pruned'),
      raw('A'),
    ];
    const expected = ranked({ tracked, weights: null });
    for (const seed of [1, 7, 42]) {
      expect(ranked({ tracked: permute(tracked, seed), weights: null })).toEqual(expected);
    }
  });
});

/** A deterministic permutation, so the test itself uses no randomness. */
function permute<T>(items: readonly T[], seed: number): T[] {
  const copy = [...items];
  let state = seed;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    const swap = state % (index + 1);
    const held = copy[index] as T;
    copy[index] = copy[swap] as T;
    copy[swap] = held;
  }
  return copy;
}

describe('rank: purity and determinism', () => {
  it('two calls over the same inputs are deep-equal', () => {
    expect(rank(matrixInput())).toEqual(rank(matrixInput()));
  });

  it('shuffled input gives an identical Ranking', () => {
    const input = matrixInput();
    const expected = rank(input);
    for (const seed of [1, 7, 42, 1234, 99991]) {
      const shuffled: RankInput = {
        ...input,
        tracked: permute(input.tracked, seed),
        dataset: permute(input.dataset, seed + 1),
      };
      expect(rank(shuffled)).toEqual(expected);
    }
  });

  it('does not throw on any matrix input, and every row parses with RankedRowSchema', () => {
    const input = matrixInput();
    let result: Ranking | undefined;
    expect(() => {
      result = rank(input);
    }).not.toThrow();
    const rows: RankedRow[] = [...(result?.ordering ?? []), ...(result?.belowThreshold ?? [])];
    expect(rows.length).toBe(6);
    for (const row of rows) {
      expect(RankedRowSchema.parse(row)).toEqual(row);
    }
    expect(keysOf(result?.ordering ?? [])).toEqual(
      ['Clears', 'TieA', 'TieB', 'AtThreshold'].map((id) => canonicalKey(raw(id))),
    );
  });
});

describe('compareRankedRows', () => {
  it('compares the canonical key within the raw kind and ignores EV', () => {
    const [a, b] = rank({
      tracked: [raw('A'), raw('B')],
      dataset: [published(raw('A'), priced(0.3)), published(raw('B'), priced(3))],
      activeLeague: LEAGUE,
      threshold: THRESHOLD,
      weights: WEIGHTS,
    }).ordering.toSorted(compareRankedRows).flatMap((row) => (row.kind === 'raw' ? [row] : []));
    expect(a?.baseTypeId).toBe('A');
    expect(b?.baseTypeId).toBe('B');
  });
});

describe('rank: the read-time budget (NFR-6)', () => {
  it('ranks 5,000 raw entries in under 100 ms', () => {
    const tracked = Array.from({ length: 5000 }, (_, index) => raw(`Base ${String(index).padStart(4, '0')}`));
    const dataset = tracked.map((entry, index) => published(entry, priced(((index * 37) % 500) / 100 + 0.01)));
    const input: RankInput = { tracked, dataset, activeLeague: LEAGUE, threshold: THRESHOLD, weights: WEIGHTS };
    const result = rank(input); // warm up
    const samples: number[] = [];
    for (let run = 0; run < 5; run += 1) {
      const started = Date.now();
      rank(input);
      samples.push(Date.now() - started);
    }
    expect(result.ordering.length + result.belowThreshold.length).toBe(5000);
    // The fastest of five runs, so one noisy sample on a loaded runner does not fail the budget.
    expect(Math.min(...samples)).toBeLessThan(100);
  });
});

// --- the crafted branch (Story 3.4) -------------------------------------------

const TARGET = 'explicit.stat_target';
const FILLER = 'explicit.stat_filler';
const SUFFIX_STAT = 'explicit.stat_suffix';

let tierSerial = 0;

/** One weights tier, built in the test, never read from a fixture file (NFR-2). */
function tierOf(statId: string, weight: number, itemLevelMin = 1, modGroup?: string): ModifierWeight {
  tierSerial += 1;
  return {
    sourceModifierId: `t${String(tierSerial)}`,
    modGroup: modGroup ?? `g${String(tierSerial)}`,
    itemLevelMin,
    weight,
    weightSource: 'published',
    lines: [{ statId, ranges: [[1, 10]] }],
  };
}

type Pools = readonly [readonly ModifierWeight[], readonly ModifierWeight[]];

/** A weights file whose classes carry real pools: `[categoryId, className, [prefix tiers, suffix tiers]]`. */
function poolsFile(...classes: readonly (readonly [string, string, Pools])[]): WeightsFile {
  const file = weightsWith(...classes.map(([categoryId, className]) => [categoryId, className] as const));
  for (const [categoryId, className, [prefix, suffix]] of classes) {
    const byClass = file.bases[categoryId];
    if (byClass !== undefined) {
      byClass[className] = {
        prefix: { poolCoverage: 'complete', entries: [...prefix] },
        suffix: { poolCoverage: 'complete', entries: [...suffix] },
      };
    }
  }
  return file;
}

/** A prefix-only crafted entry on `statId`, banded `[1, 10]`: P is the contained share of the prefix pool. */
function chase(
  className: string,
  statId = TARGET,
  status: TrackedEntry['status'] = 'active',
  categoryId = 'weapon.bow',
): TrackedEntry {
  const base = {
    kind: 'crafted' as const,
    categoryId,
    className,
    itemLevelMin: 82,
    prefix: { kind: 'banded' as const, statId, valueMin: 1, valueMax: 10 },
  };
  return status === 'pruned' ? { ...base, status, prunedReason: 'no market' } : { ...base, status };
}

function recipeOf(id: string, modifierLevelMin: number, ...currencyIds: string[]): CraftRecipe {
  return { id, currencies: currencyIds.map((currencyId) => ({ currencyId, quantity: 1 })), modifierLevelMin };
}

function rateOf(currencyId: string, rate: number, league: string = LEAGUE): CurrencyRate {
  return { currencyId, rate, source: 'measured', league, asOf: '2026-09-26T00:00:00Z' };
}

const GREATER = recipeOf('greater', 0, 'greater-orb-of-transmutation', 'greater-orb-of-augmentation');
const PERFECT = recipeOf('perfect', 70, 'perfect-orb-of-transmutation', 'perfect-orb-of-augmentation');
const RATES = [
  rateOf('greater-orb-of-transmutation', 0.01),
  rateOf('greater-orb-of-augmentation', 0.02),
  rateOf('perfect-orb-of-transmutation', 0.1),
  rateOf('perfect-orb-of-augmentation', 0.2),
];
const GREATER_COST = 0 + 0.01 + 0.02;
const PERFECT_COST = 0 + 0.1 + 0.2;

/** Bows: the target is 1 in 10 of the prefix pool at floor 0, and 1 in 2 at floor 70. */
const BOWS_POOLS: Pools = [
  [tierOf(TARGET, 10, 75), tierOf(FILLER, 10, 75), tierOf('explicit.stat_low', 80, 1)],
  [tierOf(SUFFIX_STAT, 10, 80)],
];

const craftedRows = (rows: readonly RankedRow[]): CraftedRankedRow[] =>
  rows.flatMap((row) => (row.kind === 'crafted' ? [row] : []));

function rankCrafted(input: Partial<RankInput> & Pick<RankInput, 'tracked'>): Ranking {
  return rank({
    dataset: [],
    activeLeague: LEAGUE,
    threshold: THRESHOLD,
    weights: poolsFile(['weapon.bow', 'Bows', BOWS_POOLS]),
    recipes: [GREATER, PERFECT],
    currencyRates: RATES,
    ...input,
  });
}

describe('rank: the crafted branch (AD-17, AD-20)', () => {
  it('happy path: EV = Σ P·price − cost, two summands ordered by contribution', () => {
    const target = chase('Bows');
    const filler = chase('Bows', FILLER);
    const result = rankCrafted({
      tracked: [target, filler],
      dataset: [published(target, priced(2)), published(filler, priced(4))],
      recipes: [GREATER],
    });
    const [row] = craftedRows(result.ordering);
    expect(row).toMatchObject({
      kind: 'crafted',
      classKey: '["crafted","weapon.bow","Bows"]',
      categoryId: 'weapon.bow',
      className: 'Bows',
      itemLevelMin: 82,
      recipeId: 'greater',
      craftCost: GREATER_COST,
    });
    expect(row?.summands.map((summand) => summand.entryKey)).toEqual([canonicalKey(filler), canonicalKey(target)]);
    expect(row?.summands.map((summand) => summand.probability)).toEqual([0.1, 0.1]);
    expect(row?.summands.map((summand) => summand.contribution)).toEqual([0.1 * 4, 0.1 * 2]);
    expect(row?.grossPayout).toBe(0 + 0.1 * 4 + 0.1 * 2);
    expect(row?.ev).toBe(0 + 0.1 * 4 + 0.1 * 2 - GREATER_COST);
    expect(RankedRowSchema.parse(row)).toEqual(row);
  });

  it('tests the threshold against the gross price, not the price less the cost', () => {
    const target = chase('Bows');
    // price ≥ T > price − cost: 0.26 ≥ 0.25 > 0.26 − 0.03.
    const result = rankCrafted({ tracked: [target], dataset: [published(target, priced(0.26))], recipes: [GREATER] });
    expect(craftedRows(result.ordering)[0]?.summands).toHaveLength(1);
  });

  it('sums nothing for an unpriced, league-mismatched, below-threshold or pruned entry', () => {
    const target = chase('Bows');
    const filler = chase('Bows', FILLER);
    const low = chase('Bows', 'explicit.stat_low');
    const pruned = chase('Bows', SUFFIX_STAT, 'pruned');
    const result = rankCrafted({
      tracked: [target, filler, low, pruned],
      dataset: [
        published(target, { state: 'no-listings' }),
        published(filler, priced(5, OLD_LEAGUE)),
        published(low, priced(0.1)),
        published(pruned, priced(9)),
      ],
      recipes: [GREATER],
    });
    const [row] = craftedRows(result.ordering);
    expect(row?.summands).toEqual([]);
    expect(row?.ev).toBe(-GREATER_COST);
    // Crafted entries never enter the raw groups.
    expect(everyKey(result)).toEqual([row?.classKey]);
  });

  it('nothing clears: every pair still ranks, at −craftCost, with summands: []', () => {
    const target = chase('Bows');
    const result = rankCrafted({ tracked: [target], dataset: [published(target, priced(0.1))] });
    expect(craftedRows(result.ordering).map((row) => [row.recipeId, row.ev, row.summands])).toEqual([
      ['greater', -GREATER_COST, []],
      ['perfect', -PERFECT_COST, []],
    ]);
  });

  it('a recipe floor that empties the pool makes that pair unrankable, and the other recipe ranks (state 36)', () => {
    const target = chase('Bows');
    const lowOnly = poolsFile(['weapon.bow', 'Bows', [[tierOf(TARGET, 10, 1)], [tierOf(SUFFIX_STAT, 10, 1)]]]);
    const result = rankCrafted({ tracked: [target], dataset: [published(target, priced(1))], weights: lowOnly });
    expect(craftedRows(result.ordering).map((row) => row.recipeId)).toEqual(['greater']);
    expect(result.unrankable).toEqual([
      { categoryId: 'weapon.bow', className: 'Bows', reason: 'recipe cannot reach this class', recipeId: 'perfect' },
    ]);
  });

  it('an exhausted augment makes the pair unrankable, never P = 0', () => {
    // The suffix pool holds only the prefix's own modGroup, so the augment has nothing after it.
    const shared = poolsFile([
      'weapon.bow',
      'Bows',
      [[tierOf(TARGET, 10, 1, 'shared')], [tierOf(SUFFIX_STAT, 10, 1, 'shared')]],
    ]);
    const result = rankCrafted({ tracked: [chase('Bows')], weights: shared, recipes: [GREATER] });
    expect(craftedRows(result.ordering)).toEqual([]);
    expect(result.unrankable.map((item) => [item.reason, item.recipeId])).toEqual([
      ['recipe cannot reach this class', 'greater'],
    ]);
  });

  it('a class-level reason holds under every recipe, with no recipe id and no crafted row', () => {
    const result = rankCrafted({ tracked: [chase('Bows')], weights: null });
    expect(craftedRows(result.ordering)).toEqual([]);
    expect(result.unrankable).toEqual([{ categoryId: 'weapon.bow', className: 'Bows', reason: ABSENT }]);
  });

  it('pricedInLeague: false after a league reset, though every crafted pair still ranks, costable or not', () => {
    const target = chase('Bows');
    const A = raw('A');
    const reset = rankCrafted({
      tracked: [target, A],
      dataset: [published(target, priced(1, OLD_LEAGUE)), published(A, priced(0.5, OLD_LEAGUE))],
      currencyRates: RATES.slice(0, 2),
    });
    expect(reset.pricedInLeague).toBe(false);
    expect(craftedRows(reset.ordering).map((row) => [row.recipeId, row.ev])).toEqual([
      ['greater', -GREATER_COST],
      ['perfect', null],
    ]);
    expect(reset.uncostableRecipes.map((item) => item.recipeId)).toEqual(['perfect']);
  });

  it('pricedInLeague: true for any non-pruned active-league price, raw or crafted, above or below the threshold', () => {
    const target = chase('Bows');
    const prunedTarget = chase('Bows', FILLER, 'pruned');
    const A = raw('A');
    const pricedIn = (dataset: readonly DatasetEntry[]): boolean =>
      rankCrafted({ tracked: [target, prunedTarget, A], dataset }).pricedInLeague;
    expect(pricedIn([published(target, priced(0.01))])).toBe(true);
    expect(pricedIn([published(A, priced(0.01))])).toBe(true);
    expect(pricedIn([published(prunedTarget, priced(5))])).toBe(false);
    expect(pricedIn([published(target, { state: 'no-listings' })])).toBe(false);
  });

  it.each([[[]], [undefined]])(
    'a rankable class with no recipe (%j) ranks no row and is Unrankable with no recipe id',
    (recipes) => {
      const result = rankCrafted({ tracked: [chase('Bows'), chase('Bows')], recipes });
      expect(result.ordering).toEqual([]);
      expect(result.unrankable).toEqual([
        { categoryId: 'weapon.bow', className: 'Bows', reason: 'recipe cannot reach this class' },
      ]);
      expect(result.uncostableRecipes).toEqual([]);
    },
  );

  it('a currency without a rate, or with another league’s rate, makes the recipe uncostable, never 0', () => {
    const target = chase('Bows');
    const rates = [...RATES.slice(0, 2), rateOf('perfect-orb-of-transmutation', 0.1, OLD_LEAGUE)];
    const A = raw('A');
    const result = rankCrafted({
      tracked: [target, A],
      dataset: [published(target, priced(1)), published(A, priced(0.3))],
      currencyRates: rates,
    });
    expect(result.uncostableRecipes).toEqual([{ recipeId: 'perfect', currencyId: 'perfect-orb-of-transmutation' }]);
    const perfect = craftedRows(result.ordering).find((row) => row.recipeId === 'perfect');
    expect(perfect?.craftCost).toEqual({ kind: 'uncostable', currencyId: 'perfect-orb-of-transmutation' });
    expect(perfect?.ev).toBeNull();
    expect(perfect?.grossPayout).toBe(0.5);
    expect(RankedRowSchema.parse(perfect)).toEqual(perfect);
    // The uncostable pair is still ranked, after every comparable row.
    expect(result.ordering.at(-1)).toBe(perfect);
    expect(result.ordering.map((row) => row.kind)).toEqual(['raw', 'crafted', 'crafted']);
  });

  it('orders an uncostable recipe’s pairs among themselves by gross payout', () => {
    const bows = chase('Bows');
    const staves = chase('Staves', TARGET, 'active', 'weapon.staff');
    const result = rankCrafted({
      tracked: [bows, staves],
      dataset: [published(bows, priced(1)), published(staves, priced(3))],
      weights: poolsFile(['weapon.bow', 'Bows', BOWS_POOLS], ['weapon.staff', 'Staves', BOWS_POOLS]),
      recipes: [GREATER],
      currencyRates: [],
    });
    expect(craftedRows(result.ordering).map((row) => [row.className, row.grossPayout, row.ev])).toEqual([
      ['Staves', 0 + 0.1 * 3, null],
      ['Bows', 0 + 0.1 * 1, null],
    ]);
  });

  it('ties break raw first, then the serialised key, then the recipe id', () => {
    const recipe = (id: string): CraftRecipe => recipeOf(id, 0, 'divine');
    const bows = chase('Bows');
    const amulets = chase('Amulets', TARGET, 'active', 'accessory.amulet');
    const A = raw('A');
    const result = rank({
      tracked: [bows, amulets, A],
      // 0.1 × 10 − 0.5 = 0.5, the raw row's EV, under both recipes.
      dataset: [published(A, priced(0.5)), published(bows, priced(10)), published(amulets, priced(10))],
      activeLeague: LEAGUE,
      threshold: THRESHOLD,
      weights: poolsFile(['weapon.bow', 'Bows', BOWS_POOLS], ['accessory.amulet', 'Amulets', BOWS_POOLS]),
      recipes: [recipe('zeta'), recipe('alpha')],
      currencyRates: [rateOf('divine', 0.5)],
    });
    expect(result.ordering.map((row) => row.ev)).toEqual([0.5, 0.5, 0.5, 0.5, 0.5]);
    expect(result.ordering.map((row) => (row.kind === 'raw' ? row.baseTypeId : `${row.className}/${row.recipeId}`))).toEqual(
      ['A', 'Amulets/alpha', 'Amulets/zeta', 'Bows/alpha', 'Bows/zeta'],
    );
  });

  it('two recipes over one Tracked List give orderings that differ by more than a constant offset', () => {
    // Bows: P = 0.1 at floor 0 and 0.5 at floor 70. Staves: P = 0.5 at floor 0 and 0 at floor 70.
    const staves: Pools = [[tierOf(TARGET, 50, 1), tierOf(FILLER, 50, 75)], [tierOf(SUFFIX_STAT, 10, 80)]];
    const bows = chase('Bows');
    const stavesEntry = chase('Staves', TARGET, 'active', 'weapon.staff');
    const result = rankCrafted({
      tracked: [bows, stavesEntry],
      dataset: [published(bows, priced(1)), published(stavesEntry, priced(1))],
      weights: poolsFile(['weapon.bow', 'Bows', BOWS_POOLS], ['weapon.staff', 'Staves', staves]),
    });
    const orderOf = (recipeId: string): string[] =>
      craftedRows(result.ordering)
        .filter((row) => row.recipeId === recipeId)
        .map((row) => row.className);
    expect(orderOf('greater')).toEqual(['Staves', 'Bows']);
    expect(orderOf('perfect')).toEqual(['Bows', 'Staves']);
  });

  it('is identical under a shuffled Tracked List, dataset and rate set', () => {
    const target = chase('Bows');
    const filler = chase('Bows', FILLER);
    const input: RankInput = {
      tracked: [target, filler, raw('A'), chase('Bows', 'explicit.stat_low')],
      dataset: [published(target, priced(2)), published(filler, priced(4)), published(raw('A'), priced(1))],
      activeLeague: LEAGUE,
      threshold: THRESHOLD,
      weights: poolsFile(['weapon.bow', 'Bows', BOWS_POOLS]),
      recipes: [GREATER, PERFECT],
      currencyRates: RATES,
    };
    const expected = rank(input);
    for (const seed of [1, 7, 42]) {
      expect(
        rank({
          ...input,
          tracked: permute(input.tracked, seed),
          dataset: permute(input.dataset, seed + 1),
          currencyRates: permute(RATES, seed + 2),
        }),
      ).toEqual(expected);
    }
  });

  it('a threshold change re-ranks the committed cross product in under 100 ms (NFR-6)', async () => {
    // A non-literal specifier: the files sit outside this package's `rootDir`.
    const here = (import.meta as ImportMeta & { readonly dirname: string }).dirname;
    const load = async (name: string): Promise<unknown> =>
      ((await import(/* @vite-ignore */ `${here}/../../../test/fixtures/frozen-data/${name}`)) as { default: unknown }).default;
    const tracked = parseEnvelope(TrackedFileSchema, await load('tracked.json'));
    const weights = parseEnvelope(WeightsFileSchema, await load('weights.json'), WEIGHTS_SCHEMA_VERSION);
    const dataset = parseEnvelope(DatasetFileSchema, await load('dataset.json'));
    const recipes = parseEnvelope(RecipesFileSchema, await load('recipes.json'));
    if (!tracked.ok || !weights.ok || !dataset.ok || !recipes.ok) {
      throw new Error('a committed data file was refused');
    }
    const input: RankInput = {
      tracked: tracked.value.entries,
      dataset: dataset.value.entries,
      activeLeague: dataset.value.league,
      threshold: THRESHOLD,
      weights: weights.value,
      recipes: recipes.value.recipes,
      currencyRates: dataset.value.currencyRates,
    };
    expect(recipes.value.recipes).toHaveLength(2);
    expect(craftedRows(rank(input).ordering).length).toBeGreaterThan(0); // and warm up
    const samples: number[] = [];
    for (let run = 0; run < 5; run += 1) {
      const started = Date.now();
      rank({ ...input, threshold: 0.05 * run });
      samples.push(Date.now() - started);
    }
    // The fastest of five runs, so one noisy sample on a loaded runner does not fail the budget.
    expect(Math.min(...samples)).toBeLessThan(100);
  });
});

// --- Provenance (Story 3.6, AD-10) ---------------------------------------------

const invented = (tier: ModifierWeight): ModifierWeight => ({ ...tier, weightSource: 'absent' });

describe('rank: Provenance and the oldest timestamp (AD-10)', () => {
  const target = chase('Bows');
  const priced1 = [published(target, priced(2))];

  it('labels a pair measured when its eligible sets hold only published or not-in-game tiers', () => {
    const notInGame: ModifierWeight = { ...tierOf('explicit.stat_none', 0, 75), weightSource: 'not-in-game' };
    const weights = poolsFile(['weapon.bow', 'Bows', [[tierOf(TARGET, 10, 75), notInGame], [tierOf(SUFFIX_STAT, 10, 80)]]]);
    const rows = craftedRows(rankCrafted({ tracked: [target], dataset: priced1, weights }).ordering);
    expect(rows.map((row) => row.provenance)).toEqual(['measured', 'measured']);
  });

  it('labels every row of a pair uniform-prior when one tier in either eligible set is invented', () => {
    for (const pools of [
      [[invented(tierOf(TARGET, 10, 75))], [tierOf(SUFFIX_STAT, 10, 80)]],
      [[tierOf(TARGET, 10, 75)], [invented(tierOf(SUFFIX_STAT, 10, 80))]],
    ] as const) {
      const weights = poolsFile(['weapon.bow', 'Bows', pools]);
      const rows = craftedRows(rankCrafted({ tracked: [target], dataset: priced1, weights }).ordering);
      expect(rows.map((row) => row.provenance)).toEqual(['uniform-prior', 'uniform-prior']);
    }
  });

  it('does not count an invented tier below the recipe floor, and follows the recipe', () => {
    const weights = poolsFile([
      'weapon.bow',
      'Bows',
      [[tierOf(TARGET, 10, 75), invented(tierOf(FILLER, 10, 1))], [tierOf(SUFFIX_STAT, 10, 80)]],
    ]);
    const rows = craftedRows(rankCrafted({ tracked: [target], dataset: priced1, weights }).ordering);
    expect(rows.map((row) => [row.recipeId, row.provenance]).toSorted()).toEqual([
      ['greater', 'uniform-prior'],
      ['perfect', 'measured'],
    ]);
  });

  it('folds the oldest of each summand observedAt and each used rate asOf, and leaves it unset with none', () => {
    const old = { ...priced(2), observation: { ...observation(2), observedAt: '2026-09-01T00:00:00Z' } } as PriceState;
    const rates = RATES.map((rate) => ({ ...rate, asOf: '2026-09-10T00:00:00Z' }));
    const [row] = craftedRows(
      rankCrafted({ tracked: [target], dataset: [published(target, old)], recipes: [GREATER], currencyRates: rates }).ordering,
    );
    expect(row?.asOf).toBe('2026-09-01T00:00:00Z');
    const [rated] = craftedRows(
      rankCrafted({ tracked: [target], dataset: [], recipes: [GREATER], currencyRates: rates }).ordering,
    );
    expect(rated?.asOf).toBe('2026-09-10T00:00:00Z');
    const [bare] = craftedRows(rankCrafted({ tracked: [target], dataset: [], recipes: [GREATER], currencyRates: [] }).ordering);
    expect(bare?.asOf).toBeUndefined();
    expect(bare !== undefined && RankedRowSchema.parse(bare)).toEqual(bare);
  });

  it('puts absent only on a partial pool class, never on a ranked row', () => {
    const result = rankCrafted({
      tracked: [target],
      dataset: priced1,
      weights: weightsWith(['weapon.bow', 'Bows', 'partial', 'complete']),
    });
    expect(result.ordering).toEqual([]);
    expect(result.unrankable).toEqual([
      { categoryId: 'weapon.bow', className: 'Bows', reason: PARTIAL, provenance: 'absent' },
    ]);
  });

  it('reports a complete pool with no entries as one recipe-free unreachable row, never pool partial', () => {
    const weights = poolsFile(['weapon.bow', 'Bows', [[], []]]);
    const result = rankCrafted({ tracked: [target], dataset: priced1, weights, recipes: [GREATER, PERFECT] });
    expect(result.ordering).toEqual([]);
    expect(result.unrankable).toEqual([
      { categoryId: 'weapon.bow', className: 'Bows', reason: 'recipe cannot reach this class' },
    ]);
  });

  it('reports a complete pool of only weight-0 tiers as one recipe-free unreachable row', () => {
    const weights = poolsFile([
      'weapon.bow',
      'Bows',
      [[tierOf(TARGET, 0)], [tierOf(SUFFIX_STAT, 80)]],
    ]);
    const result = rankCrafted({ tracked: [target], dataset: priced1, weights, recipes: [GREATER, PERFECT] });
    expect(result.ordering).toEqual([]);
    expect(result.unrankable).toEqual([
      { categoryId: 'weapon.bow', className: 'Bows', reason: 'recipe cannot reach this class' },
    ]);
  });

  it.each([
    ['empty suffix beside a populated prefix', [[tierOf(TARGET, 5)], []]],
    ['weight-0 suffix beside a populated prefix', [[tierOf(TARGET, 5)], [tierOf(SUFFIX_STAT, 0)]]],
    ['both slots empty', [[], []]],
  ] as const)('reports %s as one recipe-free unreachable row, and poolCoverage agrees', (_label, pools) => {
    const weights = poolsFile(['weapon.bow', 'Bows', pools]);
    const result = rankCrafted({ tracked: [target], dataset: priced1, weights, recipes: [GREATER] });
    expect(result.unrankable).toEqual([
      { categoryId: 'weapon.bow', className: 'Bows', reason: 'recipe cannot reach this class' },
    ]);
    expect(poolCoverage([target], weights)?.coverage).toBe(0);
  });

  it('keeps pool partial when a partial slot sits beside an empty one', () => {
    const weights = poolsFile(['weapon.bow', 'Bows', [[], [tierOf(SUFFIX_STAT, 5)]]]);
    const bow = weights.bases['weapon.bow']?.['Bows'];
    if (bow !== undefined) {
      bow.prefix = { poolCoverage: 'partial', entries: [] };
    }
    const result = rankCrafted({ tracked: [target], dataset: priced1, weights });
    expect(result.unrankable.map((row) => row.reason)).toEqual([PARTIAL]);
  });
});
