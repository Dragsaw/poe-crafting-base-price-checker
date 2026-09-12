---
title: 'Weights File Contract'
status: draft
schemaVersion: '2.0.0'
created: '2026-09-12'
updated: '2026-09-12'
governed_by: [AD-5, AD-10, AD-11, AD-18, AD-27]
---

# Weights File Contract

The app **consumes** this file and never produces it (AD-11). Any producer satisfying this contract is acceptable, and the app is indifferent to which one wrote it.

**This file is a prerequisite.** The trade API cannot supply what it carries — see *Why this file has to exist* below — so the app cannot rank anything until a conforming file is present. The intended producer is a separate scraper project; this document is the contract that project must satisfy.

## 2.0.0 — what changed and why

Breaking. A `1.x` file will be refused.

| Change | Reason |
| --- | --- |
| `itemLevelMin` **required** on every band | Which modifiers can roll depends on item level. `1.0.0` modelled one flat pool per `(base, slot)`, so every probability was normalised over a population the search does not return (PRD §10 BQ-2). `core` now scopes the pool to the tracked entry's item level floor before normalising, and needs this field to do it. |
| Bands are the **unit of identity**, not floors | A modifier reference used to be a floor spanning tiers, so its probability covered T1+T2 while its price — sorted ascending — was effectively T2's. The jackpot did not merely understate; it truncated to zero whenever the low-tier price fell below the payout threshold (PRD §10 BQ-1). Bands make tiers disjoint. The file already modelled bands this way; `ModifierRef` has now caught up to it. |
| Pool completeness is **item-level-independent** | A `complete` claim previously meant something different at every floor. Enumerate every modifier that can roll in the slot at *any* item level, each carrying its own `itemLevelMin`, and `core` does the scoping. |

## Why this file has to exist

Verified 2026-09-12 against the live endpoints. `https://www.pathofexile.com/api/trade2/data/stats` returns a **flat global list** of 3,108 explicit stat ids, each of shape `{id, text, type}` and nothing else. There is no per-base-type association, no tier concept, no `required_level`, and no spawn weight anywhere in the trade API.

So the app can learn *that* `explicit.stat_1509134228` exists and what it reads as — and it does, from the catalogue (AD-25). It cannot learn **which modifiers can roll on a Guardian Bow prefix, at what item level, or how often**. That is this file's entire job, and no number of requests substitutes for it.

## What the file is and is not

**It is** raw game modifier spawn weights, banded by rolled value and by item level, per base type and affix slot, keyed by the canonical modifier identity of AD-5.

**It is not** probabilities. Normalising weights into `P(modifier | base, slot, itemLevel)` happens in `core` under the exact aggregation rule in **AD-18**. Producers must not normalise, and must not pre-aggregate bands.

**It is not** recipe-aware. Perfect vs greater transmute/augment change the tier distribution; that is modelled in `core` (AD-11). A producer never needs to know a recipe exists.

**It is not** a tier table. `tierLabel` is display-only. The trade API has no tier concept (AD-5), so a band's identity is its value edges and its item level, never its tier name.

## The pool-completeness rule

This is the contract's load-bearing clause and the easiest thing for a producer to get wrong.

Normalisation needs a denominator. If a producer lists only the interesting modifiers, every probability `core` computes is inflated, silently, and the entire ranking is wrong in a way that looks plausible. Therefore:

- A `(baseTypeId, slot)` entry declaring `poolCoverage: "complete"` **must enumerate every modifier that can roll in that slot on that base at any item level**, including worthless ones, with their true weights and their true `itemLevelMin`.
- A producer that cannot guarantee that declares `poolCoverage: "partial"`. `core` then treats every probability derived from that pool as provenance `absent` — it is a lower bound on the denominator, so the probabilities are upper bounds — and excludes the base from the ranked ordering (AD-18), returning it in the unrankable group where the view renders it as an unknown (AD-10) rather than a number to trust.

There is no third option. A producer that omits modifiers while claiming `complete` produces a confidently wrong ranking.

**Completeness does not depend on item level.** Enumerate the whole slot once. A band that only rolls at ilvl 82 belongs in a `complete` pool with `itemLevelMin: 82`; `core` scopes it out for an entry floored below that. Omitting it because "we only care about ilvl 75" breaks `complete`.

**Coverage is measured, not assumed.** AD-27 requires the fraction of the *tracked* base types resolving to `complete` in **both** slots to be measured before view work begins, because that fraction is how much of the product exists. One `partial` slot makes the whole base unrankable, so a producer that covers prefixes well and suffixes poorly scores zero on those bases.

## Shape

```jsonc
{
  "schemaVersion": "2.0.0",           // semver; core refuses a major it does not know
  "gamePatch": "0.3.1",               // the PoE2 patch these weights describe
  "producer": {
    "id": "poe2-weights-scraper",     // stable producer identifier
    "version": "1.0.0",
    "generatedAt": "2026-09-12T00:00:00Z",   // ISO-8601 UTC
    "sourceUrl": "https://..."        // where the data came from, if anywhere
  },
  "bases": {
    "Guardian Bow": {                 // trade API base type `type` string (AD-5, AD-25)
      "prefix": {
        "poolCoverage": "complete",   // "complete" | "partial"
        "entries": [
          {
            "statId": "explicit.stat_1509134228",  // trade API stat id (AD-5, AD-25)
            "valueMin": 80,           // inclusive floor of the rolled value band
            "valueMax": 89,           // inclusive ceiling; REQUIRED, never null
            "itemLevelMin": 82,       // lowest item level at which this band can roll
            "tierLabel": "T1",        // human-facing only; never used for matching
            "weight": 1200,           // raw spawn weight, >= 0, unnormalised
            "provenance": "measured"  // "measured" | "uniform-prior"
          },
          {
            "statId": "explicit.stat_1509134228",
            "valueMin": 70,
            "valueMax": 79,
            "itemLevelMin": 75,
            "tierLabel": "T2",
            "weight": 1800,
            "provenance": "measured"
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
| `schemaVersion` | Semver. `core` refuses a major version it does not implement rather than guessing. |
| `gamePatch` | Free-form GGG patch string. `core` does not parse it, but surfaces it so a weights file left behind by a patch is visible. |
| `producer.id` | Stable across regenerations by the same producer. Shown in the view alongside any figure it influences. |
| `bases` key | A trade API base type `type` string exactly as `data/items` spells it (e.g. `"Guardian Bow"`), validated against the committed catalogue (AD-25). A base absent from the file is **unrankable** (AD-18) — `core` has no other source of eligible pools and must not invent one. |
| `slot` | Exactly `prefix` and `suffix`. Magic items carry at most one of each (brief scope). |
| `poolCoverage` | See the pool-completeness rule. Required; no default. |
| `statId` | A trade API stat id, validated against the committed catalogue (AD-25). An id absent from the catalogue is a hard file error, not a skip. |
| `valueMin` + `valueMax` | Inclusive band edges over the **rolled value**. Both are **required**; there is no open-top form. With `statId` and `itemLevelMin` these are the canonical modifier identity (AD-5). Bands sharing a `statId` within a `(base, slot)` **must not overlap**. An unbounded top band would make a tracked reference covering it span tiers again — the exact defect 2.0.0 removes — and `core` cannot express containment against an absent edge. Every game modifier has a maximum roll, so emit it. |
| `itemLevelMin` | **Required.** The lowest item level at which this band can roll. `core` includes a band in the pool for a tracked entry only where `itemLevelMin <= entry.itemLevelMin` (AD-18). |
| `tierLabel` | Display only. `core` must never branch on it — tier is not a trade API concept. |
| `weight` | Non-negative number. `0` means "cannot roll here" and is meaningful; omitting the entry instead breaks `poolCoverage: complete`. |
| `provenance` | Per entry, because coverage is expected to be uneven. Propagates per AD-10. |

## Validation

The schema is a Zod schema in `packages/contracts`, and it is the single source of truth — the shape above is documentation of it, not a parallel definition. Reading the file is an adapter's job in `web`; validating the already-loaded value is a pure function in `core` (AD-1). `core` refuses to rank from an invalid file rather than ranking partially.

**Hard errors — refuse the file:**

- unknown `schemaVersion` major
- duplicate `(statId, valueMin, valueMax, itemLevelMin)` within a slot
- overlapping value bands for one `statId` within a slot
- a missing or `null` `valueMax` on any band
- missing or negative `weight`; missing `itemLevelMin`; missing `poolCoverage`
- a `statId` or `bases` key absent from the committed catalogue (AD-25)
- **a band whose value edges straddle a band edge in use by `data/tracked.json`** — AD-18 aggregates whole bands only, and a straddling band describes a population the trade filter does not match

**Degraded but loadable** — the base is excluded from the ranked ordering and returned in the unrankable group with its reason (AD-18), because an inflated denominator reorders the list and a provenance label does not change a sort: `poolCoverage: "partial"`, a base absent entirely, a slot with an empty pool.

## Producer expectations

Regenerate on GGG patch boundaries, not on any faster cadence — that cadence difference is the entire justification for the decoupling. Prices move hourly; weights move when the game changes.

**Band edges must align to the floors curators actually use.** `core` aggregates whole bands and rejects a straddle, so a producer emitting bands at the game's real tier boundaries is what makes the file usable. Tier boundaries are the natural alignment; ad-hoc bands are not.

**Source honesty.** Anything obtained from listing-derived sources carries the same listing bias the price estimator already has: trade listings skew toward desirable and higher-tier modifiers. That is inherited, not fixed here, and is one reason `provenance: "measured"` means *measured by someone*, not *ground truth*.

**RePoE is a last resort only.** It carries modifier metadata but not spawn weights, so it was never the authority for the field that matters. Where it is used at all, it is to fill `itemLevelMin` and pool membership in the absence of anything better, and the affected entries carry `provenance: "uniform-prior"` rather than `"measured"`.

## The uniform-prior bootstrap

A file where every band carries `weight: 1` and `provenance: "uniform-prior"`, with `producer.id: "uniform-prior"`, is a valid file and is how the app is developed before real weights land.

It is not a stub — it satisfies the real contract, so the probability code path is exercised from day one and the ranking formula never changes shape when measured weights arrive. But it still needs genuine **pool membership and `itemLevelMin`** per band, which is exactly the part the trade API cannot supply. A uniform-prior file is therefore a weighting shortcut, never a sourcing one, and it is subject to AD-27's coverage gate like any other file.

## Repository placement

The schema and this contract stay in this repository until the schema stops moving. Extraction to a separate package or repo is then mechanical and is listed under Deferred in the spine.
