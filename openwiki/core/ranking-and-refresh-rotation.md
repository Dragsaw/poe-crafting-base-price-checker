---
type: architecture
title: "Core: ranking and refresh rotation"
description: How @poe/core ranks raw and crafted entries at read time (EV, the combination probability with the recipe floor per modifier group and hybrid containment, craft cost, tie-breaks, the Unrankable appendix, the six cross-file checks) and how chunkOrder and pinnedToKeep pick which entries a sync chunk visits.
tags: [core, ranking, probability, cross-file-checks, refresh-rotation, chunk-order]
verified:
  - by: openwiki/0.6.0
    at: 2026-10-17T13:54:42.734Z
sources:
  - id: openwiki-source-cc63951f2dce2dd695686ff6
    resource: repo://packages/core/src/chunk-order.ts
  - id: openwiki-source-0f3add55721a7f58e3d061e8
    resource: repo://packages/core/src/craft-cost.ts
  - id: openwiki-source-e96a8a2b9ee01b9a28c2c102
    resource: repo://packages/core/src/cross-file.ts
  - id: openwiki-source-ffcbe620ea8cd829a4542712
    resource: repo://packages/core/src/price-trust.ts
  - id: openwiki-source-acb12e0576e5a5d8b09bdc25
    resource: repo://packages/core/src/probability.ts
  - id: openwiki-source-1366de320899d3bb9b455ea5
    resource: repo://packages/core/src/rank-crafted-row.ts
  - id: openwiki-source-89a276dd88bfa250f3887d76
    resource: repo://packages/core/src/rank-order.ts
  - id: openwiki-source-09245bbafedf737850e8e12f
    resource: repo://packages/core/src/rank-raw-groups.ts
  - id: openwiki-source-04c5c6716d7633c4e68e2d4e
    resource: repo://packages/core/src/rank.ts
  - id: openwiki-source-58d4a59d3976bcc01e21c261
    resource: repo://packages/sync/src/chunk/run-chunk/step-loop.ts
generated: { by: "claude-code", at: "2026-10-17T13:54:42.734Z" }
---

# Core: ranking and refresh rotation

`@poe/core` holds the product's two decisions as pure functions. It depends only on `@poe/contracts`, and its purity is enforced by lint and dependency rules (see [Package graph, ports and purity boundaries](../architecture/package-graph-and-ports.md)). `packages/core/src/index.ts` exports:

- `rank`, `compareRankedRows`, `classKeyOf`, `craftCost`, the probability functions, the provenance helpers, `poolCoverage` and `crossFileChecks`, which the **web page** uses at read time. The sync gate and `tracked:check` also run the cross-file checks and the probability helpers.
- `chunkOrder`, `pinnedToKeep` and `UNRESOLVABLE_RETRY_MS`, which the **sync chunk runner** calls.

The same inputs always give the same outputs. There is no clock, no randomness and no I/O: the current instant is an input. For example, a dry run and a live run given the same files visit the same keys.

## rank: the ranking (both branches)

`rank({ tracked, dataset, activeLeague, threshold, now, weights, crossFileFailures?, recipes?, currencyRates? })` (`rank.ts`) joins each tracked entry to its dataset entry by canonical key and returns a `Ranking`:

| Group | Contents |
| --- | --- |
| `ordering` | raw rows and priced crafted rows, the ranked list |
| `unpricedCrafted` | costable crafted rows whose verdict is `pending` or `broken` |
| `belowThreshold` | priced raw rows under the threshold |
| `noListings`, `notYetSynced`, `unresolvable` | raw entries without a usable price |
| `unrankable` | crafted Item Classes that cannot be ranked, with a reason |
| `recipeless` | rankable crafted classes, filled only when no recipe is published |
| `uncostableRecipes` | recipes with no active-league rate for one currency |
| `pricedInLeague` | whether any non-pruned entry is priced in the active league |

Every row and unranked entry carries a price-trust verdict; see [Core: the price-trust verdict](price-trust-verdict.md).

Two caller errors throw, before anything is grouped. A `threshold` that is not a finite number ≥ 0 (for example `NaN`, `Infinity` or `-1`) raises a `RangeError`; `0` is valid, and `rank` never clamps or coerces it. An unparseable `now` also raises a `RangeError`.

### Raw branch

`groupRawEntries` (`rank-raw-groups.ts`) places each non-pruned `raw` tracked entry by its resolved price:

| Dataset situation | Group |
| --- | --- |
| No dataset entry for the key | `notYetSynced`, reason `never-synced` |
| `priced`, observation league ≠ active league | `notYetSynced`, reason `league-mismatch`. The threshold is not applied. |
| `priced`, `priceDivine < threshold` | `belowThreshold` |
| `priced`, `priceDivine ≥ threshold` | `ordering` |
| `no-listings` | `noListings` |
| `unresolvable` | `unresolvable` |
| `not-yet-synced` | `notYetSynced`, with the published reason |

`pruned` entries appear in no group. Dataset entries that no tracked entry names are ignored. Only the observation's league is compared with the active league. `core` never reads `lastSearchId` or `lastSearchLeague`.

A raw row (`RawRankedRow`, defined in `packages/contracts/src/ranked-row.ts`) has `ev` equal to the observed `priceDivine` exactly, with no rounding, and `craftCost` equal to `0`. It carries the raw entry's item class (`categoryId`, `className`), the observation, `lastAttemptedAt` where present, and its trust. Rows are never persisted. The page computes them whenever its inputs change.

### Unrankable Item Classes

`unrankable` lists crafted Item Classes, never Base Types. Each item is an `UnrankableClass` of `categoryId`, `className`, `reason`, and optionally `recipeId`. The `weights` input is the parsed weights file or `undefined`.

For each non-pruned crafted `(categoryId, className)` pair, `rank` looks the pair up **directly** in `weights.bases[categoryId][className]`, with own keys only (`Object.hasOwn`), never through the prototype and never through a sibling class name.

| Result | Unrankable reason |
| --- | --- |
| no weights file, or the pair is missing | `class absent from weights file` |
| a `prefix` or `suffix` pool declares `poolCoverage: "partial"` | `pool partial` |
| a slot pool has total weight 0 | `recipe cannot reach this class`, under every recipe (no `recipeId`) |
| the pair is named by a `crossFileFailures` item | `class disagrees with weights file` |
| one recipe cannot reach the class | `recipe cannot reach this class`, scoped to that `recipeId` |

The lookup reasons take precedence over the cross-file reason. The caller computes the cross-file failures once per load with `crossFileChecks`. Several crafted entries of one class give one row. A recipe-scoped row means the class may still rank under another recipe.

### Crafted branch

Every rankable crafted class is ranked once per recipe in `recipes` (file order). One `(Item Class, recipe)` pair is one `CraftedRankedRow`, built by `craftedRow` in `rank-crafted-row.ts`. The class's entries are visited in canonical key order, so the summation order and the figure never depend on input order.

- For each entry, P is `combinationProbability(pools, entry, recipe.modifierLevelMin)`. If P is undefined for any entry, the recipe cannot reach the class and the pair goes to `unrankable` with the recipe's id.
- A **summand** is an entry priced in the active league at or above the threshold. Its contribution is `P × priceDivine`. Summands are ordered by contribution descending, then canonical key.
- Every entry is also listed in `combinations` with its own trust and, when priced, its price, including entries below the threshold. The expansion reads this list.
- `grossPayout` is the sum of contributions. `ev` is `grossPayout − craftCost`, subtracted once. A pair with no surviving summand ranks at `−craftCost` with `summands: []`.
- `craftCost` comes from `craftCost(recipe, currencyRates, activeLeague)` (`craft-cost.ts`): each currency line's `quantity × rate`, using only rates of the active league. A recipe with a missing rate is uncostable: its rows carry `craftCost: { kind: 'uncostable', currencyId }` and `ev: null`, and the recipe is listed in `uncostableRecipes`. It is never costed as 0.
- The row folds provenance across the class's entries (`foldPair`, `weakest`) and carries `asOf`, the oldest summand observation. With no summand it carries the oldest `lastAttemptedAt` instead.
- A costable row whose verdict is `pending` or `broken` (for example, no entry priced in the active league) goes to `unpricedCrafted`, not `ordering`.
- With no recipe at all, each rankable class is listed in `recipeless` with its combinations and the `no-recipe` verdict.

### The combination probability

`probability.ts` computes `P(prefix ∧ suffix | recipe)` for one entry:

1. **Recipe floor per modifier group** (`floored`): from the unscoped pool, keep each tier with `itemLevelMin ≥ recipe.modifierLevelMin`. A `modGroup` whose top positive-weight tier is below the floor keeps that top tier, so a strong recipe never empties a group that the game would still roll.
2. **Item-level scope** (`eligible`): keep the floored tiers with `itemLevelMin ≤` the entry's item level.
3. **Containment** (`containedIn`, `isContaining`): a tier is contained when it has positive weight and covers the reference. A banded line needs the tier's derived interval inside the band. A valueless line needs a line with no ranges. A **hybrid** reference needs the tier's set of stat ids to equal the reference's, and every line covered. For a summed stat id only the stat id is compared, because the search filters on the sum.
4. **Two draw orders**: for each order, every contained first draw removes its `modGroup` from the other slot, and the second slot is renormalised. The two orders are added and divided by the two slot totals.

The result is a value, never a throw. An empty eligible slot is `empty-eligible-pool`, an empty contained set is `empty-contained`, and a first draw that leaves the other slot nothing is `augment-exhausted`. `recipeReach` turns these into the slots to blame. `needs(ref, pool)` gives the lowest (valueless) or highest (banded) item level of a contained, trackable tier; `tracked:lookup` uses it.

### The six cross-file checks

`crossFileChecks(entries, weights)` (`cross-file.ts` and `cross-file/`) checks every crafted class of the tracked list against the weights file. It returns `failures` (each naming the `check`, the entry key, the class and a `detail`) and `unvalidated` marks:

- Without a weights file, every crafted entry is marked `weights-absent`.
- `class-discriminability` always runs when weights exist.
- A class with a `partial` pool, or missing from the file, is marked `partial-pool`; the pool checks do not run.
- Otherwise the per-reference checks run on both slots, scoped to the entry's floor: `edge-alignment`, `empty-containment-set`, `kind-agreement` and `line-set-completeness`.
- `co-occur` runs on pairs of entries at the same floor where at least one names a hybrid. It is the half of the overlap rule that the tracked schema cannot check without pools.

Failures sort by entry key, then check. The page passes them to `rank`, and the sync gate writes them as `cross-file-gate-failure` records.

### Pool coverage

`poolCoverage(entries, weights)` (`coverage.ts`) is the share of tracked crafted classes whose two pools are present, `complete` and not empty, with the class count as its denominator. It is `undefined` when no crafted class is tracked. The sync report carries it.

### Ordering and tie-breaks

`rank-order.ts` holds the one ordering:

- `compareOrdering` puts rows with a figure first, by EV descending. Rows of an uncostable recipe (`ev: null`) follow, by gross payout descending, and are never ordered against the rows with a figure.
- `compareRankedRows` breaks every tie: raw before crafted (kind is compared explicitly, because the key's tag would sort `crafted` first), then the serialised key with `compareCanonicalKeys` (a raw row's canonical key, a crafted row's class key from `classKeyOf`), then `recipeId`.
- `unpricedCrafted` is sorted by `compareRankedRows`. `belowThreshold`, `noListings`, `notYetSynced` and `unresolvable` are sorted by canonical key. `recipeless` is sorted by class key.
- `unrankable` is sorted by `className` in code-point order, then `categoryId`, then `recipeId` (the recipe-free row first).

The web page re-runs `rank` when the player changes the Payout Threshold or the recipe (see [Web page: artifact load and ranked list](../web/page-load-and-ranked-list.md)).

## chunkOrder: the Refresh Rotation

`chunkOrder({ tracked, dataset, completed, now })` (`chunk-order.ts`) returns the order in which the next sync chunk visits entries. The runner recomputes it on every run, so a resumed chunk never replays an outdated plan. The optional `pinnedMaxAgeMs` is set only by the `pnpm sync` session (see [The pnpm sync session](../sync/sync-session.md)).

Every non-pruned entry is placed in one of three rows:

1. **Row 1, pinned**: `pinned` entries whose dataset state is not `unresolvable`. They are exempt from the pass. Without `pinnedMaxAgeMs` every such entry is refreshed every chunk. With it, row 1 keeps only the stale ones: no `lastAttemptedAt`, or one more than `pinnedMaxAgeMs` before `now`. A fresh pinned entry is left out of every row.
2. **Row 2, active**: `active` entries whose state is not `unresolvable`, minus the pass's completed keys.
3. **Row 3, unresolvable and due**: any non-pruned entry whose state is `unresolvable` and that has no `lastAttemptedAt`, or whose last attempt was at least 24 hours ago (`UNRESOLVABLE_RETRY_MS`), minus the completed keys. A pinned entry that is unresolvable moves here.

Within a row the order is oldest `lastAttemptedAt` first, compared as instants. A missing timestamp sorts before any present one. Ties are broken by `compareTrackedEntries`, the canonical key order. The sort uses the absence of the timestamp, not the `not-yet-synced` state.

The result has `pinned` (row 1), `rotation` (rows 2 then 3), `completed` and `newPass`:

- `completed` keeps only the input keys that still name a row 2–3 entry.
- When every due row 2–3 entry is already complete, `newPass` is `true`. The completed set then resets to empty, and every due entry is open again.

The runner records completed keys in `data/sync-progress.json` only for rows 2–3 (see [The sync chunk runner](../sync/chunk-runner.md)).

## pinnedToKeep: the runtime pinned cap

Pinned entries could otherwise use up every search in a chunk. `pinnedToKeep(left, remaining)` returns how many of the `left` unvisited pinned entries to visit when `remaining` searches are left:

- When `remaining ≥ left + 1`, all `left` entries are visited.
- Otherwise only `max(remaining − 1, 0)` more are visited (capped at `left`), so one search is kept for the rotation.

The caller decides whether the rotation is waiting at all: the step loop (`packages/sync/src/chunk/run-chunk/step-loop.ts`) applies the cap only when rotation work is waiting, and records the shortfall as `pinned-starvation`. The load-time half of the cap, which compares the pinned count with `config.minChunkSearches`, lives in `sync`.

## Tests

- `packages/core/src/rank.test.ts` (with `rank/test-support.ts`), `probability.test.ts`, `price-trust.test.ts` and `chunk-order.test.ts` cover the grouping, the ordering, the threshold and clock `RangeError`s, the Unrankable lookup (absent, partial, empty, prototype keys), the recipe floor, hybrid containment and the rotation rows, including the stale-pinned filter.
- `cross-file/hybrid-references.test.ts` and `cross-file/scope-and-marks.test.ts` cover the cross-file checks.
- `test/core-rank-purity.test.ts` checks that `rank.ts` names no `Date`, `Math.random`, `process` or `import.meta`.
