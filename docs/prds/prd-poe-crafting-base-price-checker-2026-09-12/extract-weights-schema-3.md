# Verbatim extract — WEIGHTS-FILE-SCHEMA.md @ schemaVersion 3.0.0

Source: `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/WEIGHTS-FILE-SCHEMA.md`
Extracted: 2026-09-13. All normative text below is reproduced **verbatim** from that file. Section headings prefixed with "EXTRACT TOPIC" are this extract's own scaffolding; everything under them is the source's own words.

Front matter of the source, verbatim:

```yaml
---
title: 'Weights File Contract'
status: draft
schemaVersion: '3.0.0'
created: '2026-09-12'
updated: '2026-09-13'
governed_by: [AD-5, AD-10, AD-11, AD-18, AD-27, AD-28]
---
```

Opening statement, verbatim:

> The app **consumes** this file and never produces it (AD-11). Any producer satisfying this contract is acceptable, and the app is indifferent to which one wrote it.
>
> **This file is a prerequisite.** The trade API cannot supply what it carries — see *Why this file has to exist* below — so the app cannot rank anything until a conforming file is present. The intended producer is a separate scraper project; this document is the contract that project must satisfy.

---

## EXTRACT TOPIC 1 — Schema version and what changed from 2.0.0

Verbatim, the whole section `## 3.0.0 — what changed and why`:

> ## 3.0.0 — what changed and why
>
> Breaking. A `2.x` file will be refused.
>
> `2.0.0` assumed that a modifier's rolled value identifies its tier. That is true of a modifier rolling one number and false of one rolling two — *"Adds 13 to 20 Physical Damage"* — where the trade filter compares a single derived value while the game rolls a pair. Adjacent tiers therefore overlap in value space, and **no** rule for collapsing the pair (average, first, second, sum, span) removes the overlap: measured across the real data, every rule leaves 170–1,250 overlapping tier pairs, most of them strict rather than edge-touching. 53 of 63 item classes carry such modifiers, up to 36% of a weapon class's pool.
>
> `2.0.0` was therefore unsatisfiable: a producer could conform only by omitting those modifiers, which made the pool `partial` and every weapon base unrankable.
>
> | Change | Reason |
> | --- | --- |
> | Entries are **value cells**, not tiers, and a producer **decomposes** multi-number families | One value interval genuinely draws spawn weight from several tiers. A cell carries the summed mass those tiers contribute to it, so the weight `core` sums is the weight of the population the trade filter returns. See *Decomposing a multi-number modifier*. |
> | Non-overlap now scoped **per `itemLevelMin`** | Two cells sharing a `statId` at different item levels are distinct cohorts' contributions to one interval; `core` admits each at most once after scoping (AD-18), so nothing is double-counted. The invariant that actually mattered was always the **straddle** rule, of which non-overlap was only a proxy. |
> | New `provenance: "modelled-split"` | A cell's weight is measured tier weight passed through a modelled split. It is neither `measured` nor `uniform-prior`, and calling it either would hide the model or insult the measurement (AD-10). |
> | Entries and references carry a **`kind`** discriminant | A modifier that rolls no number at all — *"Loads an additional bolt"* — has no band. `2.0.0` left it nowhere to live but a sentinel, and this contract has already been burned once by a sentinel that passed every check while breaking the search. |
> | `gamePatch` is **operator-asserted**, and a producer must refuse to run without it | It is not derivable — not from the scraped pages, not from the trade API. Its whole job is to make a file left behind by a patch visible to a human, and a defaulted `"unknown"` would propagate silently past the one person who could have caught it. |

For reference, the retained `## 2.0.0 — what changed and why` section, verbatim:

> ## 2.0.0 — what changed and why
>
> | Change | Reason |
> | --- | --- |
> | `itemLevelMin` **required** on every band | Which modifiers can roll depends on item level. `1.0.0` modelled one flat pool per `(base, slot)`, so every probability was normalised over a population the search does not return (PRD §10 BQ-2). `core` now scopes the pool to the tracked entry's item level floor before normalising, and needs this field to do it. |
> | Bands are the **unit of identity**, not floors | A modifier reference used to be a floor spanning tiers, so its probability covered T1+T2 while its price — sorted ascending — was effectively T2's. The jackpot did not merely understate; it truncated to zero whenever the low-tier price fell below the payout threshold (PRD §10 BQ-1). Bands make outcomes disjoint. |
> | Pool completeness is **item-level-independent** | A `complete` claim previously meant something different at every floor. Enumerate every modifier that can roll in the slot at *any* item level, each carrying its own `itemLevelMin`, and `core` does the scoping. |

Breaking-change statement, isolated: **"Breaking. A `2.x` file will be refused."** Also, from the field-rules table: "`schemaVersion` | Semver. `core` refuses a major version it does not implement rather than guessing."

---

## EXTRACT TOPIC 2 — Complete field list of a band / cell record

### 2a. The `## Shape` block, verbatim and complete

```jsonc
{
  "schemaVersion": "3.0.0",           // semver; core refuses a major it does not know
  "gamePatch": "0.3.1",               // operator-asserted at run time; never defaulted
  "producer": {
    "id": "poe2-weights-scraper",     // stable producer identifier
    "version": "2.0.0",
    "generatedAt": "2026-09-13T00:00:00Z",   // ISO-8601 UTC
    "sourceUrl": "https://..."        // where the data came from, if anywhere
  },
  "bases": {
    "Guardian Bow": {                 // trade API base type `type` string (AD-5, AD-25)
      "prefix": {
        "poolCoverage": "complete",   // "complete" | "partial"
        "cohortTotals": [             // pre-split tier weight per (statId, itemLevelMin)
          { "statId": "explicit.stat_1509134228", "itemLevelMin": 60, "weight": 850 },
          { "statId": "explicit.stat_1509134228", "itemLevelMin": 65, "weight": 620 }
        ],
        "entries": [
          {
            "kind": "banded",
            "statId": "explicit.stat_1509134228",  // trade API stat id (AD-5, AD-25)
            "valueMin": 56,           // inclusive floor, in the filter's own unit
            "valueMax": 56.5,         // inclusive ceiling; REQUIRED, never null
            "itemLevelMin": 60,       // the cohort this mass belongs to
            "tierLabel": "T7",        // human-facing only; never used for matching
            "weight": 40,             // raw spawn weight, >= 0, unnormalised
            "provenance": "modelled-split"   // split across cells by a model
          },
          {
            "kind": "banded",
            "statId": "explicit.stat_1509134228",
            "valueMin": 56,           // SAME interval as above — a different cohort
            "valueMax": 56.5,
            "itemLevelMin": 65,
            "tierLabel": "T8",
            "weight": 110,
            "provenance": "modelled-split"
          },
          {
            "kind": "valueless",      // rolls no number at all — no edges
            "statId": "explicit.stat_2954116742",
            "itemLevelMin": 45,
            "tierLabel": "T1",
            "weight": 300,
            "provenance": "measured"
          }
        ]
      },
      "suffix": { "poolCoverage": "complete", "entries": [] }
    }
  }
}
```

### 2b. The `## Field rules` table, verbatim and complete

> | Field | Rule |
> | --- | --- |
> | `schemaVersion` | Semver. `core` refuses a major version it does not implement rather than guessing. |
> | `gamePatch` | Free-form GGG patch string, **asserted by whoever ran the producer**. It is not derivable from the scraped pages or from the trade API, so a producer takes it as a required run-time input and **refuses to run without it** — never `"unknown"`, never inferred. `core` does not parse it; `web` surfaces it beside `producer.generatedAt` and `sourceUrl` so a file left behind by a patch is visible. |
> | `producer.id` | Stable across regenerations by the same producer. Shown in the view alongside any figure it influences. |
> | `bases` key | A trade API base type `type` string exactly as `data/items` spells it (e.g. `"Guardian Bow"`), validated against the committed catalogue (AD-25). A base absent from the file is **unrankable** (AD-18) — `core` has no other source of eligible pools and must not invent one. |
> | `slot` | Exactly `prefix` and `suffix`. Magic items carry at most one of each (brief scope). |
> | `poolCoverage` | See the pool-completeness rule. Required; no default. |
> | `cohortTotals` | Per `(statId, itemLevelMin)`, the **pre-split** sum of that cohort's tier weights. Required wherever that family carries a `modelled-split` entry, permitted everywhere. `core` validates that the cohort's emitted cells sum to it — see *Conservation is declared, so that it can be checked*. |
> | `kind` | `"banded"` or `"valueless"`. Required on every entry — the discriminant, not a hint. A `statId` either rolls a value or does not, so the same `statId` must never appear under both kinds within a file. |
> | `statId` | A trade API stat id, validated against the committed catalogue (AD-25). An id absent from the catalogue is a hard file error, not a skip. |
> | `valueMin` + `valueMax` | **`banded` only; forbidden on `valueless`.** Inclusive edges over the value the trade filter compares, on that filter's own lattice. Both are **required**; there is no open-top form. With `statId` and `itemLevelMin` these are the canonical modifier identity (AD-5). An unbounded top band would make a tracked reference covering it span tiers again — the exact defect 2.0.0 removes — and `core` cannot express containment against an absent edge. |
> | *non-overlap* | Entries sharing a `statId` **and** an `itemLevelMin` within a `(base, slot)` **must not overlap**. Entries sharing a `statId` at **different** `itemLevelMin` **may** cover the same interval — that is how a decomposed family expresses two cohorts' mass in one cell (AD-28). |
> | `itemLevelMin` | **Required, both kinds.** The lowest item level at which this entry's mass can roll. `core` includes an entry in the pool for a tracked entry only where `itemLevelMin <= entry.itemLevelMin` (AD-18). |
> | `tierLabel` | Display only. `core` must never branch on it — tier is not a trade API concept, and after decomposition a cell may name a mixture (`"T7–T8"` is acceptable). |
> | `weight` | Non-negative number. `0` means **"this modifier cannot roll on this base"** and is meaningful; omitting the entry instead breaks `poolCoverage: complete`. A **cell** no tier in the cohort reaches is a different case and is simply not emitted — its absence carries no claim about pool membership. |
> | `provenance` | Per entry, because coverage is expected to be uneven. **Weakest to strongest: `"uniform-prior"` < `"modelled-split"` < `"measured"`** — the order AD-10 propagates on, written the same way round here so two builders cannot rank them differently. An entry whose mass was distributed by a *model* carries `"modelled-split"`; one whose cell mass was *measured* carries `"measured"` (AD-28). `"absent"` is a `core`-side value, weaker than all three, and must never appear in a file. `core` draws `modelled-split` from a reference's containment set only, never from the denominator, because AD-28 conserves mass and a conserving split leaves the denominator exactly as measured as it was (AD-10). |

### 2c. Required / nullable notes carried elsewhere in the document

- `valueMax`: the Shape comment reads `// inclusive ceiling; REQUIRED, never null`.
- Hard errors include: "`valueMin`/`valueMax` present on a `valueless` entry, or missing, `null` or non-numeric on a `banded` one"; "missing or negative `weight`; missing `itemLevelMin`; missing `poolCoverage`; `provenance: "absent"`".
- On numeric type of edges, verbatim: "Band edges are **numbers, not integers**, because the lattice the trade filter compares on may be finer than the integers. They are compared for exact equality, so emit values that are exact on the lattice rather than rounded approximations of one."
- What is new in 3.0.0 at field level: the `kind` discriminant (`"banded"` | `"valueless"`), the `cohortTotals` list per `(base, slot)`, the `provenance` value `"modelled-split"`, and the requirement that `gamePatch` be operator-asserted (hard error if missing or empty). Non-overlap is rescoped per `itemLevelMin`.

### 2d. "What the file is and is not", verbatim

> **It is** raw game modifier spawn weights, decomposed into value cells and item-level cohorts, per base type and affix slot, keyed by the canonical modifier identity of AD-5.
>
> **It is not** probabilities. Normalising weights into `P(modifier | base, slot, itemLevel)` happens in `core` under the exact aggregation rule in **AD-18**. Producers must not normalise, and must not pre-aggregate cells.
>
> **It is not** recipe-aware. Perfect vs greater transmute/augment change the tier distribution; that is modelled in `core` (AD-11). A producer never needs to know a recipe exists.
>
> **It is not** a tier table. `tierLabel` is display-only. The trade API has no tier concept (AD-5), and after decomposition a cell may not correspond to a single tier at all — so a cell's identity is its value edges and its item level, never its tier name.

---

## EXTRACT TOPIC 3 — Hard errors and degraded-but-loadable

### 3a. Hard errors, verbatim and complete

> **Hard errors — refuse the file:**
>
> - unknown `schemaVersion` major
> - a missing or unrecognised `kind`; one `statId` appearing under both kinds
> - `valueMin`/`valueMax` present on a `valueless` entry, or missing, `null` or non-numeric on a `banded` one
> - duplicate `(statId, kind, valueMin, valueMax, itemLevelMin)` within a slot
> - **overlapping value bands for one `statId` *at the same `itemLevelMin`*** within a slot — overlap across different `itemLevelMin` is legal (AD-28)
> - missing or negative `weight`; missing `itemLevelMin`; missing `poolCoverage`; `provenance: "absent"`
> - a missing or empty `gamePatch`
> - a `statId` or `bases` key absent from the committed catalogue (AD-25)
> - a missing `cohortTotals` row for a family carrying a `modelled-split` entry, or a cohort whose emitted cells do not sum to its declared total
> - the same cell interval carried by **more than two** cohorts within one `(base, slot, statId)` family

Also under Validation, verbatim, the explicit non-error:

> **The straddle rule is not a file error.** A cell straddling a band edge in use by `data/tracked.json` is the invariant that matters — AD-18 aggregates whole cells only, and a straddling cell describes a population the trade filter does not match — but it is a **cross-file** condition: the same weights file straddles nothing against a differently-aligned tracked list. It is therefore reported against the **tracked entry** whose edge was straddled, in `core`, at load, and never as grounds for refusing this file (AD-18). Under a correct decomposition it holds by construction for any cell-aligned reference.

And the decomposition section's own hard-error statement, verbatim: "**A cell may be carried by at most two cohorts.** Only adjacent tiers overlap, so a correct partition yields cells belonging to one tier or to exactly two — a third is a hard file error."

### 3b. Degraded but loadable, verbatim and complete

> **Degraded but loadable** — the base is excluded from the ranked ordering and returned in the unrankable group with its reason (AD-18), because an inflated denominator reorders the list and a provenance label does not change a sort: `poolCoverage: "partial"`, a base absent entirely, a slot with an empty pool.

### 3c. Validation framing, verbatim

> The schema is a Zod schema in `packages/contracts`, and it is the single source of truth — the shape above is documentation of it, not a parallel definition. Reading the file is an adapter's job in `web`; validating the already-loaded value is a pure function in `core` (AD-1). `core` refuses to rank from an invalid file rather than ranking partially.

---

## EXTRACT TOPIC 4 — Decomposition into cells and cohorts, mass conservation, `cohortTotals`, worked example

### 4a. `## Decomposing a multi-number modifier`, verbatim and complete

> The core fact: **the value axis does not partition the tier axis.** One value interval draws spawn weight from several tiers, and no collapsing rule separates them. So do not try — decompose instead.
>
> Per `(baseTypeId, slot, statId)` family:
>
> 1. **Cut the value axis at every tier endpoint in the family.** This gives one partition into cells. Compute it **once over all tiers, never per item level** — otherwise a curator's reference is cell-aligned at one item level floor and straddles a cell at another, and AD-18's edge-alignment check passes for one tracked entry and fails for the next.
> 2. **Group the family's tiers into cohorts by `itemLevelMin`.**
> 3. **Emit one entry per (cohort `ℓ`, cell `c`) that carries weight:**
>
>    ```
>    valueMin, valueMax = c's edges
>    itemLevelMin       = ℓ
>    weight             = Σ { w(t) × P(value ∈ c | t) : t ∈ tiers(ℓ) }
>    ```
>
>    **`tiers(ℓ)` is the tiers whose `itemLevelMin` *equals* `ℓ`, never `≤ ℓ`.** Every tier belongs to exactly one cohort. Read as `≤`, the same tier is redistributed into every cohort above it — which triangular-double-counts the family *and still passes the conservation check below*, since that check is per cohort.
>
>    Cells a cohort cannot reach are **not emitted**. That is a different thing from `weight: 0`, which means *"this modifier cannot roll on this base"* and must be emitted for a `complete` pool. A missing cell says nothing about pool membership, because the family is present in the cohorts that do reach it.
>
>    **A cell may be carried by at most two cohorts.** Only adjacent tiers overlap, so a correct partition yields cells belonging to one tier or to exactly two — a third is a hard file error. *Stated assumption:* no three tiers of one family overlap at a value; if real game data ever does, escalate it as a contract amendment rather than working around it.

### 4b. The worked example, verbatim and complete

> Worked from the real Bows data for *"Adds # to # Lightning Damage"*, by average:
>
> | Tier | ilvl | Value range |
> | --- | --- | --- |
> | T6 | 54 | 32.0 – 43.0 |
> | T7 | 60 | 43.0 – 56.5 |
> | T8 | 65 | 56.0 – 80.0 |
> | T9 | 75 | 79.0 – 103.0 |
> | T10 | 81 | 101.5 – 123.0 |
>
> The endpoints cut the axis into **nine** cells:
>
> ```
> [32,42.5]  [43,43]  [43.5,55.5]  [56,56.5]  [57,78.5]  [79,80]  [80.5,101]  [101.5,103]  [103.5,123]
> ```
>
> Every adjacent-tier overlap becomes its own cell, and each of those cells is emitted **twice** — once per contributing cohort:
>
> | Shared cell | Tiers | Emitted at `itemLevelMin` |
> | --- | --- | --- |
> | `[43,43]` | T6, T7 | 54 and 60 |
> | `[56,56.5]` | T7, T8 | 60 and 65 |
> | `[79,80]` | T8, T9 | 65 and 75 |
> | `[101.5,103]` | T9, T10 | 75 and 81 |
>
> That is the overlap, resolved: the same interval, two cohorts, summed only after `core` scopes to the tracked entry's floor.
>
> **A single-point overlap is still an overlap.** T6 closes at 43.0 and T7 opens at 43.0, so they share exactly one lattice point and `[43,43]` is a legitimate one-point cell. Merging it into its neighbour would leave a cell straddling a tier endpoint, which is the defect the partition exists to remove — and it would treat a touching overlap differently from a wide one for no reason the rule states. Cut at **every** endpoint, uniformly.

### 4c. `### Mass conservation is the invariant; the split is not`, verbatim and complete

> For every tier, the split across the cells it reaches must sum to that tier's weight **exactly**:
>
> ```
> Σ { w(t) × P(value ∈ c | t) : c ∈ cells }  ==  w(t)
> ```
>
> Any conserving split leaves the base's denominator and every tracked reference's total exact, and errs only in how mass distributes *within* one family. That is why the contract fixes conservation and leaves the estimator to the producer.
>
> **Recommended estimator:** treat the two numbers as independent uniform integers over their per-tier ranges and count lattice points — `P(value ∈ c | t)` is the fraction of `(A, B)` pairs in tier `t`'s ranges whose derived value falls in `c`. A producer unable to defend that for some family may split otherwise; conservation still holds and the contract is still satisfied.
>
> An entry whose mass was distributed by a **model** carries `provenance: "modelled-split"`. An entry whose cell mass was **measured** directly carries `"measured"` — the provenance names how the mass was distributed, not that a decomposition happened.

### 4d. `### Conservation is declared, so that it can be checked`, verbatim and complete

> Conservation guards the denominator of every affected base, and `core` cannot recover the pre-split tier weights from the cells. So declare them. Each `(base, slot)` carries a `cohortTotals` list, and `core` refuses the file if a cohort's emitted cells do not sum to its declared total:
>
> ```jsonc
> "cohortTotals": [
>   { "statId": "explicit.stat_1509134228", "itemLevelMin": 60, "weight": 850 }
> ]
> ```
>
> The total is the plain sum of that cohort's **tier** weights — computed before any splitting, by a path independent of the cells themselves. That independence is the point: it catches a dropped, duplicated or misattributed cell, which is the arithmetic slip that actually happens. It cannot catch a subtly wrong conditional distribution, and `modelled-split` is precisely the label for that residue.
>
> Required for every `(statId, itemLevelMin)` family containing at least one `modelled-split` entry; permitted, and encouraged, for any other.

### 4e. `### What this costs the curator, and why it is correct`, verbatim and complete

> **A tier can no longer be isolated.** A tracked reference spanning a tier boundary necessarily includes the neighbouring tier's tail — a reference over `[56, 80]` above includes T7 rolls that averaged 56.0–56.5.
>
> This is not a defect. The trade search cannot isolate that tier either: a filter of `min 56, max 80` returns exactly those T7 items too. The priced population and the weighted population therefore remain **the same population**, and a contract that let a curator name a "pure tier" would be describing something the market cannot be queried for.
>
> Matching populations is necessary but not sufficient: AD-16 estimates that population's price from its *cheapest* members, which is only safe while the population is homogeneous. Hence the rule below.
>
> **The curator should track the interior cell, not the span — and that is what the boundary cells are for.** `sync` prices a reference from the **cheapest 10** listings it matches (AD-16), so a reference spanning a boundary cell is priced at the neighbouring tier's cheap tail while carrying the whole span's probability mass. Below the payout threshold that summand truncates to zero and takes the good tier's mass with it — the BQ-1 failure mode, re-entered through a heterogeneous band. The partition supplies the remedy: `[57,78.5]` is a reference whose population is one tier and whose price is that tier's. The boundary mass is then untracked, which costs nothing, since the ranking sums over a partition of *tracked* outcomes and has never required the tracked set to be exhaustive.
>
> Band count roughly doubles for affected families. It has no effect on the request budget: one tracked reference is still one entry and one search (AD-12).

### 4f. `### Two obligations this file cannot prove it met`, verbatim and complete

> `core` holds no tier data. It can therefore check that the cells tile, that the cohorts sum to their declared totals, and that no cell is carried by more than two cohorts — but **not** that the partition was cut at the real tier endpoints, nor that a split's conditional distribution is right.
>
> A producer emitting one coarse cell per cohort would pass every mechanical check while forcing every curator into a full-span reference, which is BQ-1 through a coarse cell instead of a sentinel value. The cohort-carriage bound refuses the fully degenerate form, and the failure is loud at curation time — edge-alignment rejects the band the curator wanted and leaves only the full span. What remains is trust, of the same kind and no more than the trust already placed in every weight here. It is named so that a producer cannot claim surprise and a reviewer knows where to look.

### 4g. Producer expectation bearing on cell edges, verbatim

> **Cell edges must align to the floors curators actually use.** `core` aggregates whole cells and rejects a straddle, so a producer emitting the full tier-endpoint partition (not a coarser one) is what makes the file usable. Tier endpoints are the natural cut points; ad-hoc edges are not.

---

## EXTRACT TOPIC 5 — `valueless`, TBD placeholder rows, `unidentifiedWeight`, filter unit / integer-vs-decimal edges

### 5a. `valueless` — every statement in the document, verbatim

From the 3.0.0 change table:

> | Entries and references carry a **`kind`** discriminant | A modifier that rolls no number at all — *"Loads an additional bolt"* — has no band. `2.0.0` left it nowhere to live but a sentinel, and this contract has already been burned once by a sentinel that passed every check while breaking the search. |

From the Shape block:

```jsonc
{
  "kind": "valueless",      // rolls no number at all — no edges
  "statId": "explicit.stat_2954116742",
  "itemLevelMin": 45,
  "tierLabel": "T1",
  "weight": 300,
  "provenance": "measured"
}
```

From Field rules:

> | `kind` | `"banded"` or `"valueless"`. Required on every entry — the discriminant, not a hint. A `statId` either rolls a value or does not, so the same `statId` must never appear under both kinds within a file. |
>
> | `valueMin` + `valueMax` | **`banded` only; forbidden on `valueless`.** … |
>
> | `itemLevelMin` | **Required, both kinds.** … |

From Hard errors:

> - a missing or unrecognised `kind`; one `statId` appearing under both kinds
> - `valueMin`/`valueMax` present on a `valueless` entry, or missing, `null` or non-numeric on a `banded` one
> - duplicate `(statId, kind, valueMin, valueMax, itemLevelMin)` within a slot

### 5b. TBD placeholder rows, verbatim and complete

> **An unnamed modifier still counts.** Where a source publishes a row as a blank placeholder — a `TBD` — the modifier exists in the game and carries real spawn weight. Dropping it shrinks the denominator and inflates every other probability on that base, so **a pool with dropped placeholder rows is `partial`, not `complete`.** There is deliberately no field for anonymous weight: it would be a way for a producer to hide an arbitrary share of the pool behind a scalar nobody can check. Placeholder rows are a patch-cadence phenomenon, so expect freshly scraped classes to be `partial` until the source names them. Emit the rest of the pool, declare `partial`, and the base returns to the ranking when the rows resolve.

### 5c. `unidentifiedWeight`

**Not present.** The string `unidentifiedWeight` does not appear anywhere in WEIGHTS-FILE-SCHEMA.md at 3.0.0. The nearest normative statement is the sentence above: "There is deliberately no field for anonymous weight: it would be a way for a producer to hide an arbitrary share of the pool behind a scalar nobody can check."

### 5d. Filter unit / integer-vs-decimal edges — `## The unit of a band is measured, not chosen`, verbatim and complete

> A band's edges are expressed in **whatever single quantity the trade stat filter compares against, and in no other.** `sync` passes those edges straight into the filter (AD-16) and `core` counts the population that comes back (AD-18); if the two are denominated differently, the file validates and prices the wrong population.
>
> For a stat whose text carries one `#`, that quantity is the rolled number. For a stat carrying two — *"Adds # to # Lightning Damage"* — it is one derived value, and **which** one is an empirical fact about the trade API, not a modelling decision. The evidence points at the **average** (a half-integer band edge can only arise from averaging two integers), but a producer must confirm it against a live `trade2` search, along with whether the filter accepts non-integer `min`/`max`. This is the spine's standing Open Question on this file, and it is owned by the producer.
>
> Under an averaged unit the value lattice is half-integers rather than integers. Closed cells tile such a lattice without gaps; emit edges **on** the lattice.

And from Validation, verbatim:

> Band edges are **numbers, not integers**, because the lattice the trade filter compares on may be finer than the integers. They are compared for exact equality, so emit values that are exact on the lattice rather than rounded approximations of one.

---

## EXTRACT TOPIC 6 — `poolCoverage: "complete"` obligations on the producer

`## The pool-completeness rule`, verbatim and complete:

> This is the contract's load-bearing clause and the easiest thing for a producer to get wrong.
>
> Normalisation needs a denominator. If a producer lists only the interesting modifiers, every probability `core` computes is inflated, silently, and the entire ranking is wrong in a way that looks plausible. Therefore:
>
> - A `(baseTypeId, slot)` entry declaring `poolCoverage: "complete"` **must enumerate every modifier that can roll in that slot on that base at any item level**, including worthless ones, with their true weights and their true `itemLevelMin`.
> - A producer that cannot guarantee that declares `poolCoverage: "partial"`. `core` then treats every probability derived from that pool as provenance `absent` — it is a lower bound on the denominator, so the probabilities are upper bounds — and excludes the base from the ranked ordering (AD-18), returning it in the unrankable group where the view renders it as an unknown (AD-10) rather than a number to trust.
>
> There is no third option. A producer that omits modifiers while claiming `complete` produces a confidently wrong ranking.
>
> **Completeness does not depend on item level.** Enumerate the whole slot once. A cell that only rolls at ilvl 82 belongs in a `complete` pool with `itemLevelMin: 82`; `core` scopes it out for an entry floored below that.

Related obligations elsewhere, verbatim:

- Field rules: "`poolCoverage` | See the pool-completeness rule. Required; no default."
- Field rules, `weight`: "`0` means **"this modifier cannot roll on this base"** and is meaningful; omitting the entry instead breaks `poolCoverage: complete`. A **cell** no tier in the cohort reaches is a different case and is simply not emitted — its absence carries no claim about pool membership."
- Decomposition step 3: "Cells a cohort cannot reach are **not emitted**. That is a different thing from `weight: 0`, which means *"this modifier cannot roll on this base"* and must be emitted for a `complete` pool. A missing cell says nothing about pool membership, because the family is present in the cohorts that do reach it."
- Placeholder rows: "**a pool with dropped placeholder rows is `partial`, not `complete`.**"
- Degraded but loadable: `poolCoverage: "partial"` excludes the base from the ranked ordering.

---

## EXTRACT TOPIC 7 — AD-27's coverage measurement and its denominator

Verbatim, in full:

> **Coverage is measured, not assumed.** AD-27 requires the fraction of the tracked base types **that need a pool at all** — those carrying at least one crafted, non-`pruned` tracked entry — resolving to `complete` in **both** slots to be measured before view work begins, because that fraction is how much of the product exists. Base types tracked only as raw bases are excluded from both halves of the fraction: they rank with no probability term and can never be `complete`, so counting them would understate coverage. One `partial` slot makes the whole base unrankable, so a producer that covers prefixes well and suffixes poorly scores zero on those bases.

And from `## The uniform-prior bootstrap`, verbatim: "A uniform-prior file is therefore a weighting shortcut, never a sourcing one, and it is subject to AD-27's coverage gate like any other file."

---

## Supporting sections reproduced verbatim for completeness

### `## Why this file has to exist`

> Verified 2026-09-12 against the live endpoints. `https://www.pathofexile.com/api/trade2/data/stats` returns a **flat global list** of 3,108 explicit stat ids, each of shape `{id, text, type}` and nothing else. There is no per-base-type association, no tier concept, no `required_level`, and no spawn weight anywhere in the trade API.
>
> So the app can learn *that* `explicit.stat_1509134228` exists and what it reads as — and it does, from the catalogue (AD-25). It cannot learn **which modifiers can roll on a Guardian Bow prefix, at what item level, or how often**. That is this file's entire job, and no number of requests substitutes for it.

### `## Producer expectations`

> Regenerate on GGG patch boundaries, not on any faster cadence — that cadence difference is the entire justification for the decoupling. Prices move hourly; weights move when the game changes.
>
> **Cell edges must align to the floors curators actually use.** `core` aggregates whole cells and rejects a straddle, so a producer emitting the full tier-endpoint partition (not a coarser one) is what makes the file usable. Tier endpoints are the natural cut points; ad-hoc edges are not.
>
> **Source honesty.** Anything obtained from listing-derived sources carries the same listing bias the price estimator already has: trade listings skew toward desirable and higher-tier modifiers. That is inherited, not fixed here, and is one reason `provenance: "measured"` means *measured by someone*, not *ground truth*.
>
> **RePoE is a last resort only.** It carries modifier metadata but not spawn weights, so it was never the authority for the field that matters. Where it is used at all, it is to fill `itemLevelMin` and pool membership in the absence of anything better, and the affected entries carry `provenance: "uniform-prior"` rather than `"measured"`.

### `## The uniform-prior bootstrap`

> A file where every entry carries `weight: 1` and `provenance: "uniform-prior"`, with `producer.id: "uniform-prior"`, is a valid file and is how the app is developed before real weights land.
>
> It is not a stub — it satisfies the real contract, so the probability code path is exercised from day one and the ranking formula never changes shape when measured weights arrive. But it still needs genuine **pool membership, cell edges and `itemLevelMin`** per entry, which is exactly the part the trade API cannot supply. A uniform-prior file is therefore a weighting shortcut, never a sourcing one, and it is subject to AD-27's coverage gate like any other file.

### `## Repository placement`

> The schema and this contract stay in this repository until the schema stops moving. Extraction to a separate package or repo is then mechanical and is listed under Deferred in the spine.

---

## Gaps — asked for but not present in the source

- **`unidentifiedWeight`**: no such field, and no field of any name for anonymous/unidentified weight. The document explicitly forbids one.
- **A Glossary section**: the document has none; terms (`cell`, `cohort`, `family`, `band`, `straddle`) are defined inline in the sections quoted above, not in a dedicated glossary.
- **`provenance` per-value definitions beyond the ordering line**: `"uniform-prior"` is defined only through the bootstrap section and the RePoE note; there is no separate enumeration table.
- **Filter unit / integer-vs-decimal**: stated as an unresolved Open Question owned by the producer, not settled.
