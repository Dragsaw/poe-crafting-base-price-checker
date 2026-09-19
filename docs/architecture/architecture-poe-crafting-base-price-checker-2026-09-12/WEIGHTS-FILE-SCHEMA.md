---
title: 'Weights File Contract'
status: draft
schemaVersion: '5.0.0'
created: '2026-09-12'
updated: '2026-09-19'
---

# Weights File Contract

> **Producer-side draft.** This file is a working copy under `poe-mod-weights-producer`,
> not the authoritative contract. The authoritative copy lives in
> `poe-crafting-base-price-checker/docs/architecture/.../WEIGHTS-FILE-SCHEMA.md` and is
> owned by that repo. `5.0.0` below is this producer's proposal for what the contract
> should become, written here so consumer-side planning can start against it before the
> producer rebuild lands. It does not take effect until adopted in the consumer repo.
> See `_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-18.md` for the
> decision trail behind this revision.

The app **consumes** this file. The app never produces this file (AD-11). Any producer
that satisfies this contract is acceptable. The app does not depend on which producer
wrote the file.

**This file is a prerequisite.** The trade API cannot supply the data that this file
carries. See *Why this file has to exist* below. The app therefore cannot rank any base
type until a conforming file is present. The intended producer is a separate scraper
project. This document is the contract that the scraper project must satisfy.

## 5.0.0 — what changed and why

**Breaking.** This revision removes most of `4.0.0`/`4.1.0`'s hard errors and most of
the fields that existed to support them. A `4.x` file is not a conforming `5.0.0` file,
and a `5.0.0` file is not a conforming `4.x` file.

The producer's own decomposition machinery — value-cell partitioning, mass conservation,
group-consistency checking, largest-remainder rounding — was judged not worth its
complexity for the value it returned. `4.x` asked the producer to turn poe2db's raw,
verbatim spawn weights into a derived, conserved, re-normalised layer, entirely so the
consumer wouldn't have to. `5.0.0` inverts that: the producer reports poe2db's numbers
as published, plus trade-API identity, and nothing else. Whatever weighting, averaging,
or interval math the consumer's ranking needs, the consumer now does directly against
raw tier data.

| Change | Reason |
| --- | --- |
| Entries are **tiers again, not cells** — one entry per poe2db row, never split by value interval | The whole reason `3.0.0` introduced cells was to resolve tier overlap for two-number stats without collapsing it. `5.0.0` accepts that overlap exists and leaves it in the raw data; the producer no longer resolves it at all. A consumer that needs disjoint intervals now computes them itself from the tier list. |
| `cohortTotals`, the conservation check, and the group-consistency check are **removed** | These existed solely to audit the cell-decomposition math. With no decomposition, there is nothing to audit. Their removal is not a relaxation of a check the producer still needs to pass — the operation they audited no longer happens. |
| `provenance` is **removed** | `provenance` existed to distinguish `measured` (poe2db data) from `modelled-split` (the producer's own interval math) from `uniform-prior` (no data at all). With no modelling step, only the last distinction remains, and `weightSource` (see below) already states it. A separate `provenance` enum with one live value left is not worth keeping. |
| New field **`weightSource`**: `"published"` \| `"absent"` per tier | Carries forward, unchanged, the upstream producer's own signal for whether poe2db published a real `DropChance` for this tier (a JSON string) or supplied a filler (a JSON number). Replaces `provenance`'s weaker two-state distinction with the actual upstream fact it was standing in for. |
| A tier's stat lines are grouped under **`lines`**, each carrying its own `statId` and verbatim `ranges` | Replaces the `sourceModifierId`-grouped flat-entry model. A tier with two distinct stats (a hybrid modifier) is one entry with two `lines`, never two entries sharing an id. A tier with one stat that rolls two numbers is one entry with one line holding two ranges. See *Shape* below. |
| `valueMin`/`valueMax` are **removed**; replaced by verbatim `ranges: [[min, max], ...]` per line | The producer no longer derives a single filter-comparable value from a two-number stat (the old "average of two numbers" rule). It reports the numbers as poe2db prints them. Deriving whatever value the trade filter actually compares against is now the consumer's job. |
| `statLineCounts`, `poolCoverage`'s coupling to the cell math, `tierLabel` matching rules | `statLineCount` is superseded — a tier's line count is just `lines.length`, already on the entry, needing no separate field. `poolCoverage` is retained (see *Field rules*) but is no longer entangled with cohort/cell bookkeeping — it now states only whether the producer believes it enumerated every modifier in the pool. `tierLabel` is unchanged: display-only, never a matching key. |
| `bases` keying, `producer` block, `gamePatch` requirement | Unchanged from `4.x`. |

## 4.1.0, 4.0.0, 3.0.0, 2.0.0 — superseded history

These four revisions built and then were superseded by the decomposition approach
`5.0.0` removes above. Their measurements remain true of the underlying poe2db data —
560 of 8,437 in-scope rows publish several stats at once, 53 of 63 item classes carry a
two-number modifier, etc. — they just no longer drive this contract's shape. Their full
text is not reproduced below, to avoid describing machinery this contract no longer
specifies; this file is gitignored in this repo (never committed, so there is no commit
history to point to for the pre-`5.0.0` text) — the authoritative record of the full
`2.0.0`–`4.1.0` text is the consumer repo's own committed copy of this document.

## Why this file has to exist

Verified on 2026-09-12 against the live endpoints. The endpoint
`https://www.pathofexile.com/api/trade2/data/stats` returns a **flat global list** of
3,108 explicit stat ids. Each stat id has the shape `{id, text, type}` and carries
nothing else. The trade API has no per-base-type association, no tier concept, no
`required_level` and no spawn weight.

The app can therefore learn *that* `explicit.stat_1509134228` exists, and can learn the
text of that stat. The app does learn both, from the catalogue (AD-25). The app cannot
learn **which modifiers can roll on a Guardian Bow prefix, at what item level, or how
often**. To supply those three facts is the entire job of this file. No number of trade
API requests can replace this file.

## What the file is and is not

**The file is** raw game modifier spawn weights, reported per tier exactly as poe2db
publishes them, per base type and affix slot. Each entry names one poe2db tier
(`sourceModifierId`) and carries one or more stat lines under `lines`, each resolved to
a trade API `statId` where a match exists.

**The file is not** decomposed, cut, conserved, or rounded. `core` (or whatever
downstream ranking logic consumes this file) receives the same overlapping,
tier-shaped data poe2db published, and is responsible for whatever interval or
averaging math its own ranking needs.

**The file is not** probabilities. Normalising raw weights into `P(modifier | base,
slot, itemLevel)` is entirely a consumer concern.

**The file is not** recipe-aware. Perfect and greater transmute and augment recipes
change the tier distribution; that is a consumer concern.

**The file is not** deduplicated across cohorts. Two tiers of one family that overlap in
value range are both reported, unmodified, exactly as poe2db lists them.

## The pool-completeness rule

Unchanged in spirit from `4.x`, decoupled from the removed cell machinery.

- A `(baseTypeId, slot)` entry that declares `poolCoverage: "complete"` **must enumerate
  every modifier that can roll in that slot on that base at any item level.**
- A producer that cannot guarantee that enumeration declares `poolCoverage: "partial"`.
- **An unnamed placeholder row still counts as missing.** A source that publishes a
  blank placeholder (e.g. poe2db's `TBD` rows) and is dropped by the producer's
  placeholder policy makes that pool `partial`, not `complete`.

There is no third option. `poolCoverage` is an honest per-pool assertion, not something
the producer computes from cell coverage — there are no cells to compute it from.

## Shape

```jsonc
{
  "schemaVersion": "5.0.0",           // semver; core refuses a major it does not know
  "gamePatch": "0.5.5",               // operator-asserted at run time; never defaulted
  "producer": {
    "id": "poe2-weights-scraper",     // stable producer identifier
    "version": "3.0.0",
    "generatedAt": "2026-09-18T00:00:00Z",   // ISO-8601 UTC
    "sourceUrl": "https://..."        // where the data came from, if anywhere
  },
  "bases": {
    "weapon.bow": {                   // trade category filter id (AD-5, AD-25), collapses many classNames
      "Bows": {                       // poe2db className verbatim, never a derived display label
        "prefix": {
          "poolCoverage": "complete",   // "complete" | "partial"
          "entries": [
            {
              "sourceModifierId": "prefix\u0000BaseLightningDamage\u000060\u0000...",
              "itemLevelMin": 60,        // this tier's own item level
              "tierLabel": "T7",         // display only; never a matching key
              "weight": 40,              // raw spawn weight as published, unnormalised
              "weightSource": "published",  // "published" | "absent"
              "lines": [
                {
                  "statId": "explicit.stat_1509134228",
                  "ranges": [[43, 43], [56, 56.5]]   // verbatim, both numbers of one stat
                }
              ]
            },
            {
              "sourceModifierId": "prefix\u0000BaseEvasionHybrid\u00008\u0000...",
              "itemLevelMin": 8,
              "tierLabel": "T1",
              "weight": 1000,
              "weightSource": "published",
              "lines": [
                { "statId": "explicit.stat_evasion_flat", "ranges": [[4, 6]] },
                { "statId": "explicit.stat_evasion_pct", "ranges": [[6, 13]] }
              ]
            },
            {
              "sourceModifierId": "prefix\u0000ExtraBolt\u000045\u0000...",
              "itemLevelMin": 45,
              "tierLabel": "T1",
              "weight": 300,
              "weightSource": "absent",
              "lines": [
                { "statId": "explicit.stat_2954116742", "ranges": [] }   // rolls no number
              ]
            },
            {
              "sourceModifierId": "prefix\u0000UnmatchedMod\u000030\u0000...",
              "itemLevelMin": 30,
              "tierLabel": "T4",
              "weight": 500,
              "weightSource": "published",
              "lines": [
                { "statId": null, "ranges": [[10, 20]] }   // no trade statId matched
              ]
            }
          ]
        },
        "suffix": { "poolCoverage": "complete", "entries": [] }
      }
    }
  }
}
```

## Field rules

| Field | Rule |
| --- | --- |
| `schemaVersion` | Semver. `core` refuses a major version that `core` does not implement. `core` does not guess. |
| `gamePatch` | A free-form GGG patch string, operator-asserted. Never `"unknown"`, never inferred. A producer refuses to run without it. |
| `producer.id` | Stable across regenerations by the same producer. |
| `bases` key | Two levels. Outer key is a trade category filter id (`categoryId`), spelled exactly as the trade category filter list spells it. Inner key is the poe2db `className` verbatim (never a derived display label) that resolved to that `categoryId` -- `className -> categoryId` is many-to-one (e.g. six armour `className`s collapse to `armour.gloves`), so one `categoryId` can carry several distinct `className` sub-keys, each with its own `{prefix, suffix}` pools. There is no cross-class ownership guard: `(categoryId, className)` cannot collide because `className`s are already distinct. Validated report-only by `sync` (AD-6, AD-25); a base absent from the file is unrankable. |
| `slot` | Exactly `prefix` and `suffix`. |
| `poolCoverage` | See *The pool-completeness rule*. Required, with no default. |
| `sourceModifierId` | **Required on every entry.** Names the poe2db tier this entry came from. One entry per tier — never split, never merged. Opaque to the app. |
| `itemLevelMin` | **Required.** The lowest item level at which this tier's mass can roll, taken verbatim from poe2db. |
| `tierLabel` | Display only. Never a matching key. |
| `weight` | Raw spawn weight as poe2db published it (`DropChance`), unnormalised, non-negative. `0` is meaningful ("cannot roll on this base") and must still be emitted. |
| `weightSource` | **Required.** `"published"` where poe2db supplied a real weight (a JSON string `DropChance`), `"absent"` where it supplied a filler (a JSON number). Never inferred from the value. |
| `lines` | **Required, at least one entry.** One item per stat line poe2db's template prints, split at the template's own line breaks — no value math, no partitioning. |
| `lines[].statId` | A trade API stat id matched by this producer's stat-text resolution, or `null` if unresolved. Never a matching key from `core`'s side — `core` treats it as opaque identity. Validated report-only against the trade catalogue by `sync`, same as `4.x` (AD-6, AD-25). |
| `lines[].ranges` | Verbatim `[min, max]` pairs, one per `#` in that line's own template text, in the order poe2db prints them. A line with no `#` (a flat, valueless line) carries an empty array. **Not** cut, cast, or reduced to a single derived value — a two-number stat's two ranges are both reported as poe2db shows them. |

## Validation

The schema is a Zod schema in `packages/contracts`. That Zod schema is the single
source of truth; the shape above documents it and is not a parallel definition.

**Hard errors — refuse the file:**

- unknown `schemaVersion` major
- a missing `sourceModifierId`, `itemLevelMin`, `weight`, `weightSource`, or `lines`
- a negative `weight`
- `weightSource` not one of `"published"` / `"absent"`
- `lines` empty
- a `lines[]` entry whose `ranges` contains a pair where `min > max`
- a duplicate `sourceModifierId` within one slot
- a missing or empty `gamePatch`
- a missing `poolCoverage`

**Not a file error:**

- an unresolved `statId` (`null`) — reported by the producer, never a refusal
- an uncatalogued `statId` or `bases` key — `sync`'s concern, report-only (AD-6), same as `4.x`
- overlapping `ranges` across tiers of one family — expected and left as-is; the consumer resolves it if its ranking needs disjoint intervals

## Producer expectations

Regenerate the file on GGG patch boundaries, and on no faster cadence. Report, per class
and in totals, how many stat lines resolved to a `statId` versus did not — this replaces
`4.x`'s coverage-per-pool measurement, decoupled from cell math.

## Repository placement

This document is currently drafted and iterated in `poe-mod-weights-producer` as a
producer-side proposal. The authoritative copy, once `5.0.0` is agreed, lives in
`poe-crafting-base-price-checker`. Moving the schema itself to a shared package remains
Deferred, as in prior revisions.
