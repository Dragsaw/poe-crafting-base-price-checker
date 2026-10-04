/**
 * The AD-16 search body, built from the tracked entry alone
 * (`IMPLEMENTATION-NOTES.md` §5.1, §5.2, §5.5, §10.2).
 *
 * Pure: an entry and the committed item catalogue in, a body out. It issues no
 * request and reads no file. The one refusal it can raise on a schema-valid
 * entry — a `jewel`-arm base type the catalogue does not carry — is thrown
 * **before** any request exists, so a wrong class name never becomes a search
 * issued in hope. The pricing step catches it and marks that one entry
 * `unresolvable` (AD-25). A summed `statId` with a valueless operand also
 * throws, but the tracked schema refuses such an entry first (§2.3).
 *
 * The object literals below are written in one fixed key order. The body is
 * serialised with `JSON.stringify`, and a stable order is what makes one entry
 * produce one byte string — which is what the recorded fixtures are keyed on.
 */

import { canonicalKey, defenceLettersOf, linesOf, summedInterval, summedStatIds } from '@poe/contracts';
import type { CraftedTrackedEntry, DefenceLetter, ItemCatalogue, NamedLine, TrackedEntry } from '@poe/contracts';

/**
 * The committed item catalogue as the search builder reads it: every
 * `items.json` group id mapped to the base type names that group carries.
 *
 * A group id is read in exactly one place, `discriminatorOf` below, to decide
 * whether a plain class takes the type arm. Base types are never mapped to a
 * category or the other way round.
 */
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

/**
 * The `jewel`-arm refusal (`IMPLEMENTATION-NOTES.md` §10.2, AD-25): the base
 * type derived from a plain `className` is not in `catalogue/items.json`. It
 * names the class, and it is raised before any request.
 */
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
export interface FilterEdge {
  readonly min?: number;
  readonly max?: number;
}

export interface StatFilter {
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

/**
 * `IMPLEMENTATION-NOTES.md` §10.2, arms tried **in order**.
 *
 * Arm 2's condition is the category's composition, never the literal string
 * `"jewel"`. `sync` builds a search without the weights file (AD-5), so the
 * composition is read from the one committed artifact that has it: a
 * `categoryId` that names a whole `items.json` group is a category whose
 * members the catalogue enumerates as base types, and a plain class under it is
 * one of those base types with spaces written as underscores. Every other plain
 * class takes arm 3: its category carries one class, and the category filter is
 * already exact.
 */
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

/**
 * The stat filter of one line a reference names: one for a single-line
 * reference, one per line for a hybrid (AD-16, SPEC-tracked-hybrid-mods
 * CAP-2). A banded edge goes out **exactly** as declared — never rounded to
 * reach an integer — and `disabled: false` is written on every filter (§5.1).
 * A valueless line carries `{}`.
 */
function statFilterOfLine(line: NamedLine): StatFilter {
  return {
    id: line.statId,
    value: 'valueMin' in line ? { min: line.valueMin, max: line.valueMax } : {},
    disabled: false,
  };
}

/**
 * The entry's stat filters, prefix lines then suffix lines, in one `and`
 * group. The schema already sorted a hybrid's lines by `statId`.
 *
 * A summed `statId` (`summedStatIds`, IMPLEMENTATION-NOTES.md §2.1) goes out
 * as **one** filter, §5.5's sum: it takes its prefix line's place, and the
 * suffix line on it is dropped, so no id repeats. The sum is plain addition
 * and never rounded (AD-16). A valueless operand has no edge to add; the
 * schema refuses one (§2.3), so meeting one here throws.
 */
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
        `entry ${canonicalKey(entry)} sums statId ${line.statId} with a valueless operand, which the tracked schema refuses (IMPLEMENTATION-NOTES.md §2.3); no request was issued`,
      );
    }
    return statFilterOfLine({ statId: line.statId, valueMin: sum.min, valueMax: sum.max });
  });
  const suffix = linesOf(entry.suffix)
    .filter((line) => !summed.has(line.statId))
    .map(statFilterOfLine);
  return [...prefix, ...suffix];
}

function edgeFor(letters: ReadonlySet<DefenceLetter>, letter: DefenceLetter): FilterEdge {
  return letters.has(letter) ? { min: 1 } : { max: 0 };
}

const STATUS = { option: 'securable' } as const;
const TRADE_FILTERS = { filters: { price: { option: 'exalted_divine' } } } as const;
const SORT = { price: 'asc' } as const;

/**
 * The search body for one tracked entry (AD-16).
 *
 * - A **raw** entry sends `query.type` = its `baseTypeId`, no category, rarity
 *   `normal`.
 * - A **crafted** entry sends `type_filters.category`, rarity `magic`, and its
 *   class discriminator: all three defence keys (arm 1), `query.type` beside
 *   the category (arm 2), or nothing more (arm 3).
 *
 * `acceptedTier` is never read. No `trade_filters.sale_type` is emitted.
 *
 * @throws UnknownClassBaseTypeError where arm 2 derives a base type the
 *   catalogue does not carry.
 */
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
            equipment_filters: {
              filters: {
                ar: edgeFor(letters, 'str'),
                ev: edgeFor(letters, 'dex'),
                es: edgeFor(letters, 'int'),
              },
            },
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
