---
type: subsystem
title: "Core: ranking and refresh rotation"
description: The pure @poe/core package — rank, which ranks tracked raw bases and crafted Item Class and recipe pairs into one ordering with below-threshold, unranked and Unrankable groups for the page, and chunkOrder/pinnedToKeep, which decide which entries a sync chunk visits and in what order.
tags: [core, ranking, rotation, pure-functions, ev, threshold, unrankable]
sources:
  - id: openwiki-source-cc63951f2dce2dd695686ff6
    resource: repo://packages/core/src/chunk-order.ts
  - id: openwiki-source-04c5c6716d7633c4e68e2d4e
    resource: repo://packages/core/src/rank.ts
generated: { by: "claude-code", at: "2026-10-03T11:56:06.252Z" }
verified:
  - by: openwiki/0.6.0
    at: 2026-10-03T11:56:06.252Z
---

# Core: ranking and refresh rotation

`@poe/core` holds the product's two decisions as pure functions. It depends only on `@poe/contracts`, and its purity is enforced by lint and dependency rules (see [Package graph, ports and purity boundaries](../architecture/package-graph-and-ports.md)). `packages/core/src/index.ts` exports:

- `rank`, `compareRankedRows`, `classKeyOf`, `craftCost`, `combinationProbability`, the provenance helpers and `crossFileChecks`, which the **web page** uses at read time. The sync gate also runs the cross-file checks.
- `chunkOrder`, `pinnedToKeep` and `UNRESOLVABLE_RETRY_MS`, which the **sync chunk runner** calls.

The same inputs always give the same outputs. There is no clock, no randomness and no I/O. For example, a dry run and a live run given the same files visit the same keys.

## rank: the ranking (both branches)

`rank({ tracked, dataset, activeLeague, threshold, weights, crossFileFailures?, recipes?, currencyRates? })` joins each tracked entry to its dataset entry by canonical key and returns a `Ranking` of groups: `ordering`, `belowThreshold`, `noListings`, `notYetSynced`, `unresolvable`, `unrankable`, plus `uncostableRecipes` and the boolean `pricedInLeague`. Every expected data condition becomes a group.

One caller error throws. Before anything is grouped, a `threshold` that is not a finite number ≥ 0 (for example `NaN`, `Infinity` or `-1`) raises a `RangeError`. `0` is valid. `rank` never clamps or coerces the threshold.

### Raw branch

For each non-pruned `raw` tracked entry:

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

A raw row (`RankedRow` with `kind: 'raw'`, defined in `packages/contracts/src/ranked-row.ts`) has `ev` equal to the observed `priceDivine` exactly, with no rounding, and `craftCost` equal to `0`. It carries the observation and, where present, `lastAttemptedAt`. Rows are never persisted. The page computes them whenever its inputs change.

### Unrankable Item Classes

`unrankable` lists crafted Item Classes, never Base Types. Each item is an `UnrankableClass` of `categoryId`, `className`, `reason`, and optionally `recipeId` or `provenance`. The `weights` input is the parsed weights file or `null`.

For each non-pruned crafted `(categoryId, className)` pair, `rank` looks the pair up **directly** in `weights.bases[categoryId][className]`, with own keys only (`Object.hasOwn`), never through the prototype and never through a sibling class name.

| Result | Unrankable reason |
| --- | --- |
| no weights file, or the pair is missing | `class absent from weights file` |
| a `prefix` or `suffix` pool declares `poolCoverage: "partial"` | `pool partial`, with `provenance: 'absent'` |
| the pair is named by a `crossFileFailures` item | `class disagrees with weights file` |
| a recipe cannot reach the class (empty eligible pool or exhausted augment) | `recipe cannot reach this class`, scoped to one `recipeId` |

The first two take precedence over the cross-file reason. The caller computes the cross-file failures once per load with `crossFileChecks`. Several crafted entries of one class give one row. A recipe-scoped row means the class may still rank under another recipe.

### Crafted branch

Every crafted class that makes no claim above is ranked once per recipe in `recipes` (file order). One `(Item Class, recipe)` pair is one `CraftedRankedRow` in the same `ordering` as the raw rows.

- A summand is a class entry priced in the active league whose gross price is at or above the threshold. Its contribution is `P × priceDivine`, where P is `combinationProbability` (see `probability.ts`). Entries are summed in canonical key order so the figure never depends on input order.
- `grossPayout` is the sum of contributions. `ev` is `grossPayout − craftCost`, subtracted once. A pair with no surviving summand ranks at `−craftCost` with `summands: []`.
- `craftCost` comes from `craftCost(recipe, currencyRates, activeLeague)`. A recipe with no active-league rate for one of its currencies is uncostable: its rows carry `craftCost: { kind: 'uncostable', currencyId }` and `ev: null`, and the recipe is listed in `uncostableRecipes`.
- The row folds provenance across the class's entries (`foldPair`, `weakest`) and carries `asOf`, the oldest of the contributing observation and rate timestamps.
- `pricedInLeague` is true when any non-pruned tracked entry has a `priced` observation in the active league. After a league reset it is false while crafted pairs still rank at minus their Craft Cost.

### Ordering and tie-breaks

- `ordering` puts the comparable rows (raw rows and crafted rows of a costable recipe) first, by EV descending. Rows of an uncostable recipe follow, by gross payout descending, and are never ordered against the comparable rows.
- `compareRankedRows` breaks every tie: raw before crafted (kind is compared explicitly), then the serialised key with `compareCanonicalKeys` (a raw row's canonical key, a crafted row's class key from `classKeyOf`), then `recipeId`.
- `belowThreshold`, `noListings`, `notYetSynced` and `unresolvable` are sorted by canonical key.
- `unrankable` is sorted by `className` in UTF-8 code-unit order, then `categoryId`, then the recipe-free row first, then `recipeId`.

The web page re-runs `rank` when the player changes the Payout Threshold (see [Web page: artifact load and ranked list](../web/page-load-and-ranked-list.md)).

## chunkOrder: the Refresh Rotation

`chunkOrder({ tracked, dataset, completed, now })` returns the order in which the next sync chunk visits entries. The runner recomputes it on every run, so a resumed chunk never replays an outdated plan. The optional `pinnedMaxAgeMs` is set only by the `pnpm sync` session (see [The pnpm sync session](../sync/sync-session.md)).

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

Pinned entries could otherwise use up every search in a chunk. After a pinned step reports `remaining` searches with `left` pinned entries still unvisited, `pinnedToKeep(left, remaining, rotationWaiting)` works as follows:

- When the rotation has no waiting work, or `remaining ≥ left + 1`, all `left` entries are visited.
- Otherwise only `max(remaining − 1, 0)` more are visited (capped at `left`), so one search is kept for the rotation.

The runner reports a shortfall as `pinnedStarvation`. The load-time half of the cap, which compares the pinned count with `config.minChunkSearches`, lives in `sync` (`packages/sync/src/pinned-cap.ts`).

## Tests

- `packages/core/src/rank.test.ts` and `chunk-order.test.ts` cover the grouping, the ordering, the threshold `RangeError`, the Unrankable lookup (absent, partial, complete, prototype keys) and the rotation rows, including the stale-pinned filter.
- `test/core-rank-purity.test.ts` checks that `rank.ts` names no `Date`, `Math.random`, `process` or `import.meta`.
