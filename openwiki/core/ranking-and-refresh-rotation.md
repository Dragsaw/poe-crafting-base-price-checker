---
type: subsystem
title: "Core: ranking and refresh rotation"
description: The pure @poe/core package — rank, which groups tracked raw bases into ordering, below-threshold and unranked groups and lists crafted Item Classes as Unrankable for the page, and chunkOrder/pinnedToKeep, which decide which entries a sync chunk visits and in what order.
tags: [core, ranking, rotation, pure-functions, ev, threshold, unrankable]
sources:
  - id: openwiki-source-004d71a620eb2ebfe8d87ae5
    resource: repo://packages/contracts/src/ranked-row.ts
  - id: openwiki-source-cc63951f2dce2dd695686ff6
    resource: repo://packages/core/src/chunk-order.ts
  - id: openwiki-source-04c5c6716d7633c4e68e2d4e
    resource: repo://packages/core/src/rank.ts
generated: { by: "claude-code", at: "2026-09-27T13:11:02.100Z" }
verified:
  - by: openwiki/0.6.0
    at: 2026-09-27T16:49:38.941Z
---

# Core: ranking and refresh rotation

`@poe/core` holds the product's two decisions as pure functions. It depends only on `@poe/contracts`, and its purity is enforced by lint and dependency rules (see [Package graph, ports and purity boundaries](../architecture/package-graph-and-ports.md)). `packages/core/src/index.ts` exports:

- `rank` and `compareRankedRows`, which the **web page** calls at read time.
- `chunkOrder`, `pinnedToKeep` and `UNRESOLVABLE_RETRY_MS`, which the **sync chunk runner** calls.

The same inputs always give the same outputs. There is no clock, no randomness and no I/O. For example, a dry run and a live run given the same files visit the same keys.

## rank: the ranking (raw branch)

`rank({ tracked, dataset, activeLeague, threshold, weightsLoaded })` joins each tracked entry to its dataset entry by canonical key and returns a `Ranking` of six groups. Every expected data condition becomes a group.

One caller error throws. Before anything is grouped, a `threshold` that is not a finite number ≥ 0 (for example `NaN`, `Infinity` or `-1`) raises a `RangeError`. `0` is valid. `rank` never clamps or coerces the threshold.

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

`pruned` entries appear in no group. `crafted` entries never rank here: the crafted branch is planned for Epic 3. Dataset entries that no tracked entry names are ignored. Only the observation's league is compared with the active league. `core` never reads `lastSearchId` or `lastSearchLeague`.

A raw row (`RankedRow`, defined in `packages/contracts/src/ranked-row.ts`) has `ev` equal to the observed `priceDivine` exactly, with no rounding, and `craftCost` equal to `0`. It carries the observation and, where present, `lastAttemptedAt` for the view's freshness display. Rows are never persisted. The page computes them whenever its inputs change.

### Unrankable Item Classes

The sixth group, `unrankable`, lists crafted Item Classes, never Base Types. Each item is an `UnrankableClass` of `categoryId`, `className` and `reason`.

- When `weightsLoaded` is `false`, each distinct non-pruned crafted `(categoryId, className)` pair appears once, with reason `class absent from weights file`. Several crafted entries of one class give one row.
- When `weightsLoaded` is `true`, the group is empty. Epic 2 does not read the weights file's `bases`, so it makes no claim about a loaded file.

`UnrankableReason` has only this one value for now. The other reasons of FR-4 (`pool partial`, `class disagrees with weights file`) are planned for Story 3.6. The web page passes `weightsLoaded: set.weights !== null` and renders the group as the Unrankable appendix.

### Ordering and tie-breaks

- `ordering` is sorted by EV descending. At equal EV, `compareRankedRows` puts raw before crafted (kind is compared explicitly), then compares the canonical key with `compareCanonicalKeys`. The crafted arm will add a recipe id as the last term.
- `belowThreshold`, `noListings`, `notYetSynced` and `unresolvable` are sorted by canonical key.
- `unrankable` is sorted by `className` in UTF-8 code-unit order, then by `categoryId`.

The web page re-runs `rank` when the player changes the Payout Threshold. The threshold only moves rows between `ordering` and `belowThreshold` (see [Web page: artifact load and ranked list](../web/page-load-and-ranked-list.md)).

## chunkOrder: the Refresh Rotation

`chunkOrder({ tracked, dataset, completed, now })` returns the order in which the next sync chunk visits entries. The runner recomputes it on every run, so a resumed chunk never replays an outdated plan.

Every non-pruned entry is placed in one of three rows:

1. **Row 1, pinned**: `pinned` entries whose dataset state is not `unresolvable`. They are refreshed every chunk and are exempt from the pass.
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

- `packages/core/src/rank.test.ts` and `chunk-order.test.ts` cover the grouping, the ordering, the threshold `RangeError`, the Unrankable group and the rotation rows.
- `test/core-rank-purity.test.ts` checks that `rank.ts` names no `Date`, `Math.random`, `process` or `import.meta`.
