---
title: 'Weights File Contract'
status: final
schemaVersion: '5.0.0'
created: '2026-09-12'
updated: '2026-09-19'
governed_by: [AD-5, AD-9, AD-10, AD-11, AD-17, AD-27]
---

# Weights File Contract

> **This is the authoritative copy.** `5.0.0` was adopted on 2026-09-19 by the approved
> sprint change proposal at `docs/sprint-change-proposal-2026-09-19.md`, which carries the
> decision trail. This document is owned by `poe-crafting-base-price-checker` and lives in
> this repository. A working copy held in a producer repo is a **proposal with no effect**;
> only the text here is binding.
>
> **AD citations were renumbered by spine revision 10**, which merged nine decisions into
> their neighbours. AD-6 → AD-9, AD-18 → AD-17, AD-28 and AD-29 → AD-11. See the spine's
> *Retired AD map*.

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
specifies. **The full `2.0.0`–`4.1.0` text is recoverable from this repository's git
history**, with the `5.0.0` adoption commit of 2026-09-19 as the boundary.

## Why this file has to exist

Verified on 2026-09-12, re-checked 2026-09-13, against the live endpoints. The endpoint
`https://www.pathofexile.com/api/trade2/data/stats` returns **category groups** of the
form `{id, label, entries[]}`, with each stat nested inside a group as `{id, text, type}`
— 3,108 explicit stat ids in total, and a consumer flattens the groups before looking an
id up. A stat entry carries nothing beyond those three fields, and a group's `label` is a
trade-UI heading carrying no pool meaning. The trade API has no per-base-type association,
no tier concept, no `required_level` and no spawn weight.

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

**The file is not** deduplicated. Two tiers of one family that overlap in value range are
both reported, unmodified, exactly as poe2db lists them.

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
    "Guardian Bow": {                 // trade API base type `type` string (AD-5, AD-25)
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
```

## Field rules

| Field | Rule |
| --- | --- |
| `schemaVersion` | Semver. `core` refuses a major version that `core` does not implement. `core` does not guess. |
| `gamePatch` | A free-form GGG patch string, operator-asserted. Never `"unknown"`, never inferred. A producer refuses to run without it. |
| `producer.id` | Stable across regenerations by the same producer. |
| `bases` key | A trade API base type `type` string, spelled exactly as `data/items` spells it. Validated report-only by `sync` (AD-9, AD-25); a base absent from the file is unrankable. |
| `slot` | Exactly `prefix` and `suffix`. |
| `poolCoverage` | See *The pool-completeness rule*. Required, with no default. |
| `sourceModifierId` | **Required on every entry.** Names the poe2db tier this entry came from. One entry per tier — never split, never merged. Opaque to the app. |
| `itemLevelMin` | **Required.** The lowest item level at which this tier's mass can roll, taken verbatim from poe2db. |
| `tierLabel` | Display only. Never a matching key. |
| `weight` | Raw spawn weight as poe2db published it (`DropChance`), unnormalised, non-negative. `0` is meaningful ("cannot roll on this base") and must still be emitted. |
| `weightSource` | **Required.** `"published"` where poe2db supplied a real weight (a JSON string `DropChance`), `"absent"` where it supplied a filler (a JSON number). Never inferred from the value. |
| `lines` | **Required, at least one entry.** One item per stat line poe2db's template prints, split at the template's own line breaks — no value math, no partitioning. |
| `lines[].statId` | A trade API stat id matched by this producer's stat-text resolution, or `null` if unresolved. Never a matching key from `core`'s side — `core` treats it as opaque identity. Validated report-only against the trade catalogue by `sync`; a `null` is **skipped** by that validation, never failed by it, and `sync` must not report it as an uncatalogued id (AD-9, AD-25). |
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
- a **duplicate `statId` among one entry's `lines`** — malformed by construction, cheap to
  reject, and what makes `lines.length` mean what this contract says it means
- a missing or empty `gamePatch`
- a missing `poolCoverage`

**Not a file error:**

- an unresolved `statId` (`null`) — reported by the producer, never a refusal, and never a
  reason to declare a pool `partial`
- an uncatalogued `statId` or `bases` key — `sync`'s concern, report-only (AD-9), same as `4.x`
- overlapping `ranges` across tiers of one family — expected and left as-is. **The consumer
  does not derive disjoint intervals from them.** It applies whole-tier containment (AD-11,
  AD-17): a tier only partly covered by a tracked band contributes nothing to that band's
  numerator and still counts in the denominator. A producer therefore need not make tiers
  separable, and **must not merge or trim them to try**.

## Producer expectations

Regenerate the file on GGG patch boundaries, and on no faster cadence. Report, per class
and in totals, how many stat lines resolved to a `statId` versus did not — this replaces
`4.x`'s coverage-per-pool measurement, decoupled from cell math.

**Open question for the producer — line arity (spine OQ-19).** The consumer derives one
filter-comparable interval per line from that line's `ranges`. For a line with two `#` the
derivation divides by two, which is exact in binary and compares equal against a curator's
declared edge with no tolerance. **For a line with three or more `#` the derivation is not
exact**, and every tracked reference against such a line would fail the consumer's
edge-alignment check permanently, with nothing a curator could write to satisfy it. Whether
PoE2 publishes any such line is unknown — the `5.0.0` measurements count rows by *stat
count*, which is a different axis from `#`-per-line. **Please report the maximum number of
`#` on any single line in scope.** If the answer is three or more, the resolution is an
amendment to this contract, and never an epsilon in the consumer.

## Repository placement

**This repository, `poe-crafting-base-price-checker`, owns this document.** A working copy
held in a producer repo is a proposal with no effect until adopted here. Moving the schema
itself to a shared package remains **Deferred**: extract once the schema stops moving, and
`5.0.0` is the third breaking revision in seven days.
