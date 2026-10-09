/**
 * The AD-16 search body, pure and built before any request.
 */

import { canonicalKey, defenceLettersOf, linesOf, summedInterval, summedStatIds } from '@poe/contracts';
import type { CraftedTrackedEntry, DefenceLetter, ItemCatalogue, NamedLine, TrackedEntry } from '@poe/contracts';

/** The `items.json` groups as the builder reads them: group id to base type names. */
export type ItemTypes = ReadonlyMap<string, ReadonlySet<string>>;

export function itemTypesOf(catalogue: ItemCatalogue): ItemTypes {
  const types = new Map<string, Set<string>>();
  for (const group of catalogue.result) {
    const names = types.get(group.id) ?? new Set<string>();
    for (const entry of group.entries) {
      names.add(entry.type);
    }
    types.set(group.id, names);
  }
  return types;
}

/** The `jewel`-arm refusal: the derived base type is not in `items.json` (AD-25). */
export class UnknownClassBaseTypeError extends Error {
  readonly entryKey: string;
  readonly categoryId: string;
  readonly className: string;
  readonly baseTypeId: string;

  constructor(entry: CraftedTrackedEntry, baseTypeId: string) {
    super(
      `class ${entry.className} (category ${entry.categoryId}) derives base type "${baseTypeId}", which catalogue/items.json does not carry; no request was issued`,
    );
    this.name = 'UnknownClassBaseTypeError';
    this.entryKey = canonicalKey(entry);
    this.categoryId = entry.categoryId;
    this.className = entry.className;
    this.baseTypeId = baseTypeId;
  }
}

/** A `{min}` / `{max}` edge as the trade site's filters spell it. */
interface FilterEdge {
  readonly min?: number;
  readonly max?: number;
}

interface StatFilter {
  readonly id: string;
  /** A banded stat carries both edges; a valueless stat carries `{}` (OQ-12). */
  readonly value: FilterEdge;
  readonly disabled: false;
}

export interface SearchBody {
  readonly query: {
    readonly status: { readonly option: 'securable' };
    /** A raw entry's `baseTypeId`, or the `jewel` arm's derived base type. */
    readonly type?: string;
    readonly stats: readonly [{ readonly type: 'and'; readonly filters: readonly StatFilter[] }];
    readonly filters: {
      readonly type_filters: {
        readonly filters: {
          readonly category?: { readonly option: string };
          readonly ilvl: { readonly min: number };
          readonly rarity: { readonly option: 'magic' | 'normal' };
        };
      };
      readonly equipment_filters?: {
        readonly filters: {
          readonly ar: FilterEdge;
          readonly ev: FilterEdge;
          readonly es: FilterEdge;
        };
      };
      readonly trade_filters: {
        readonly filters: { readonly price: { readonly option: 'exalted_divine' } };
      };
    };
  };
  readonly sort: { readonly price: 'asc' };
}

type Discriminator =
  | { readonly arm: 'defence'; readonly letters: ReadonlySet<DefenceLetter> }
  | { readonly arm: 'type'; readonly baseTypeId: string }
  | { readonly arm: 'none' };

/** Arms tried in order; arm 2 reads the category's composition from `items.json` (AD-5). */
function discriminatorOf(entry: CraftedTrackedEntry, itemTypes: ItemTypes): Discriminator {
  const letters = defenceLettersOf(entry.className);
  if (letters !== undefined) {
    return { arm: 'defence', letters };
  }
  const group = itemTypes.get(entry.categoryId);
  if (group !== undefined) {
    const baseTypeId = entry.className.replaceAll('_', ' ');
    if (!group.has(baseTypeId)) {
      throw new UnknownClassBaseTypeError(entry, baseTypeId);
    }
    return { arm: 'type', baseTypeId };
  }
  return { arm: 'none' };
}

/** One stat filter per reference line; a banded edge goes out as declared (AD-16). */
function statFilterOfLine(line: NamedLine): StatFilter {
  return {
    id: line.statId,
    value: 'valueMin' in line ? { min: line.valueMin, max: line.valueMax } : {},
    disabled: false,
  };
}

/** Prefix lines then suffix lines in one `and` group; a summed `statId` is one filter. */
function statFiltersOf(entry: TrackedEntry): StatFilter[] {
  if (entry.kind === 'raw') {
    return [];
  }
  const summed = summedStatIds(entry);
  const prefix = linesOf(entry.prefix).map((line) => {
    if (!summed.has(line.statId)) {
      return statFilterOfLine(line);
    }
    const sum = summedInterval(entry, line.statId);
    if (sum === undefined) {
      throw new Error(
        `entry ${canonicalKey(entry)} sums statId ${line.statId} with a valueless operand, which the tracked schema refuses; no request was issued`,
      );
    }
    return statFilterOfLine({ statId: line.statId, valueMin: sum.min, valueMax: sum.max });
  });
  const suffix = linesOf(entry.suffix)
    .filter((line) => !summed.has(line.statId))
    .map((line) => statFilterOfLine(line));
  return [...prefix, ...suffix];
}

function edgeFor(letters: ReadonlySet<DefenceLetter>, letter: DefenceLetter): FilterEdge {
  return letters.has(letter) ? { min: 1 } : { max: 0 };
}

function equipmentFiltersOf(letters: ReadonlySet<DefenceLetter>) {
  return {
    filters: {
      ar: edgeFor(letters, 'str'),
      ev: edgeFor(letters, 'dex'),
      es: edgeFor(letters, 'int'),
    },
  };
}

// One fixed key order: the body goes through JSON.stringify and fixtures key on its bytes.
const STATUS = { option: 'securable' } as const;
const TRADE_FILTERS = { filters: { price: { option: 'exalted_divine' } } } as const;
const SORT = { price: 'asc' } as const;

/** The AD-16 body for one entry; `acceptedTier` is never read. @throws UnknownClassBaseTypeError */
export function buildSearchBody(entry: TrackedEntry, itemTypes: ItemTypes): SearchBody {
  const stats = [{ type: 'and', filters: statFiltersOf(entry) }] as const;
  const ilvl = { min: entry.itemLevelMin };

  if (entry.kind === 'raw') {
    return {
      query: {
        status: STATUS,
        type: entry.baseTypeId,
        stats,
        filters: {
          type_filters: { filters: { ilvl, rarity: { option: 'normal' } } },
          trade_filters: TRADE_FILTERS,
        },
      },
      sort: SORT,
    };
  }

  const discriminator = discriminatorOf(entry, itemTypes);
  const typeFilters = {
    filters: { category: { option: entry.categoryId }, ilvl, rarity: { option: 'magic' } },
  } as const;

  switch (discriminator.arm) {
    case 'defence': {
      const { letters } = discriminator;
      return {
        query: {
          status: STATUS,
          stats,
          filters: {
            type_filters: typeFilters,
            equipment_filters: equipmentFiltersOf(letters),
            trade_filters: TRADE_FILTERS,
          },
        },
        sort: SORT,
      };
    }
    case 'type': {
      return {
        query: {
          status: STATUS,
          type: discriminator.baseTypeId,
          stats,
          filters: { type_filters: typeFilters, trade_filters: TRADE_FILTERS },
        },
        sort: SORT,
      };
    }
    case 'none': {
      return {
        query: {
          status: STATUS,
          stats,
          filters: { type_filters: typeFilters, trade_filters: TRADE_FILTERS },
        },
        sort: SORT,
      };
    }
  }
}
