---
title: 'Weights File Contract'
status: final
schemaVersion: '4.1.0'
created: '2026-09-12'
updated: '2026-09-13'
governed_by: [AD-5, AD-6, AD-10, AD-11, AD-18, AD-27, AD-28, AD-29]
---

# Weights File Contract

The app **consumes** this file. The app never produces this file (AD-11). Any producer that satisfies this contract is acceptable. The app does not depend on which producer wrote the file.

**This file is a prerequisite.** The trade API cannot supply the data that this file carries. See *Why this file has to exist* below. The app therefore cannot rank any base type until a conforming file is present. The intended producer is a separate scraper project. This document is the contract that the scraper project must satisfy.

## 4.1.0 — what changed and why

**Not breaking.** A `4.0.0` file is a conforming `4.1.0` file. No producer work becomes invalid. `core` refuses only a major version that `core` does not implement.

| Change | Reason |
| --- | --- |
| New **optional** `statLineCount` per group | Before `4.1.0`, no field declared how many stat lines a source row publishes. A producer could drop one line of a multi-stat row, declare `complete`, and still pass every check. Where a second source modifier publishes the same `statId`, that defect is not a loud failure. That defect is a **silent reorder**. A lost co-occurrence marker can then push a base to the top of the ranked list. `statLineCount` is optional and follows the `cohortTotals` pattern. The field therefore closes the gap for any producer that adopts the field, and invalidates no file that a producer already built (AD-29). A required `statLineCount` is Deferred. |
| New hard error: a group spanning **more than one `itemLevelMin`** | AD-29 has always stated that a source row is one tier, and therefore one cohort. No check enforced that statement. `mass(g)` therefore had two conforming readings: whole-group, and per-cohort. The two readings give different denominators, and therefore a different ranking. A conforming file already satisfies the new rule, so the new rule refuses no valid file. The group-consistency error drops the "within one cohort" qualifier, which is now redundant. |
| Exactness stated properly | The three exact-equality rules fixed no decimal precision, no rounding rule and no summation order. See *Sums must be exact in double precision*. The comparison is over **parsed doubles in the file's own entry order**. That section also states how to emit numbers that satisfy the comparison. The set of files that validate does not change. The change is that the question now has an answer. |

## 4.0.0 — what changed and why

Breaking. `core` refuses a `3.x` file.

`3.0.0` modelled one entry per `statId`. `3.0.0` assumed that one entry is one game modifier. poe2db publishes some modifiers as **one row that carries several distinct trade stats** under a single spawn weight. The game rolls such a modifier as a unit, so the stats always arrive together. Measured on 2026-09-13: **560 of 8,437** in-scope rows carry several stats. 534 rows carry two stats, 18 rows carry three stats, and 8 rows pair a banded line with a flat line. The explosion of those rows takes 8,437 source rows to 9,015 stat-line units.

A multi-stat row is **not** the `3.0.0` case of one stat that rolls two numbers (*"Adds # to # Lightning Damage"*). The decomposition already handles that case. A multi-stat row is two stat ids that share one weight, and each stat id has its own value range.

| Change | Reason |
| --- | --- |
| Every entry carries a required **`sourceModifierId`** | A producer splits a multi-stat row into one entry per stat line. Each entry keeps the source row's **full** weight. Only that reading gives each `statId` the correct marginal probability. The marker lets `core` tell such duplicated weights apart from genuinely separate modifiers. The field is required on every entry, so a single-stat row is a group of one. A producer that omits the field on a hybrid row cannot emit a file that still validates (AD-29). |
| The pool **denominator** sums over source modifiers, not entries | An affix draw selects a *modifier*. A modifier that publishes three stat lines therefore contributes its weight one time. A sum over entries inflates the denominator by the surplus lines of each hybrid row. The inflated denominator understates every probability on the base. The amount of understatement is not equal across bases, so the ranked list reorders (AD-18). |
| New hard error: a group's per-`statId` sums must **agree** | The cells of each line conserve the same underlying mass. The sums can therefore disagree only if a producer dropped, duplicated or misattributed a cell. This check has the same shape as the `cohortTotals` check, and the same reason (AD-29). |
| An uncatalogued `statId` or `bases` key is **no longer a hard file error** | The app cannot run that check as a hard error. A hard error is a refusal by `core` at load time. `core` never holds `catalogue/items.json` (AD-24), so `core` cannot evaluate the base-type half of the check. The check belongs to `sync` and is **report-only** (AD-6). The file loads. |
| `status: draft` → `final` | The contract released breaking revisions against a live producer while the contract still carried the label `draft`. The contract tracks the spine, and the spine is `final`. |

## 3.0.0 — what changed and why

Breaking. `core` refuses a `2.x` file.

`2.0.0` assumed that a modifier's rolled value identifies that modifier's tier. That assumption is true of a modifier that rolls one number. That assumption is false of a modifier that rolls two numbers, for example *"Adds 13 to 20 Physical Damage"*. For such a modifier the trade filter compares a single derived value, and the game rolls a pair of numbers. Adjacent tiers therefore overlap in value space. **No** rule that collapses the pair removes the overlap. The candidate rules are average, first, second, sum and span. Measured across the real data, every rule leaves 170–1,250 overlapping tier pairs. Most of those pairs overlap strictly, rather than touch at an edge. 53 of 63 item classes carry such modifiers, and such modifiers reach up to 36% of a weapon class's pool.

A producer therefore could not satisfy `2.0.0`. A producer could conform only by omission of those modifiers. That omission made the pool `partial`, and made every weapon base unrankable.

| Change | Reason |
| --- | --- |
| Entries are **value cells**, not tiers, and a producer **decomposes** multi-number families | One value interval draws spawn weight from several tiers. A cell carries the summed mass that those tiers contribute to that cell. The weight that `core` sums is therefore the weight of the population that the trade filter returns. See *Decomposing a multi-number modifier*. |
| Non-overlap now scoped **per `itemLevelMin`** | Two cells that share a `statId` at different item levels are the contributions of distinct cohorts to one interval. `core` admits each cell at most one time after scoping (AD-18), so `core` counts no mass twice. The invariant that matters is the **straddle** rule. Non-overlap was only a proxy for the straddle rule. |
| New `provenance: "modelled-split"` | A cell's weight is a measured tier weight that a model then split. Such a weight is not `measured` and is not `uniform-prior`. The label `measured` would hide the model. The label `uniform-prior` would understate the measurement (AD-10). |
| Entries and references carry a **`kind`** discriminant | A modifier that rolls no number, for example *"Loads an additional bolt"*, has no band. `2.0.0` gave such a modifier no place to live except a sentinel value. A sentinel value has already caused one failure in this contract: the sentinel passed every check and broke the search. |
| `gamePatch` is **operator-asserted**, and a producer must refuse to run without it | `gamePatch` is not derivable from the scraped pages. `gamePatch` is not derivable from the trade API. The only purpose of `gamePatch` is to make a file that a patch has made stale visible to a human. A default value of `"unknown"` would pass silently past the one person who could detect the stale file. |

## 2.0.0 — what changed and why

| Change | Reason |
| --- | --- |
| `itemLevelMin` **required** on every band | Item level decides which modifiers can roll. `1.0.0` modelled one flat pool per `(base, slot)`. Every probability was therefore normalised over a population that the search does not return (PRD §10 BQ-2). `core` now scopes the pool to the tracked entry's item level floor before normalisation. `core` needs `itemLevelMin` to do that scoping. |
| Bands are the **unit of identity**, not floors | A modifier reference was previously a floor that spans tiers. The probability of such a reference covered T1 and T2 together. The price of such a reference, sorted ascending, was in effect T2's price. The jackpot figure did more than understate the value. The jackpot figure truncated to zero whenever the low-tier price fell below the payout threshold (PRD §10 BQ-1). Bands make outcomes disjoint. |
| Pool completeness is **item-level-independent** | A `complete` claim previously had a different meaning at every floor. A producer must enumerate every modifier that can roll in the slot at *any* item level. Each modifier carries its own `itemLevelMin`, and `core` does the scoping. |

## Why this file has to exist

Verified on 2026-09-12 against the live endpoints. The endpoint `https://www.pathofexile.com/api/trade2/data/stats` returns a **flat global list** of 3,108 explicit stat ids. Each stat id has the shape `{id, text, type}` and carries nothing else. The trade API has no per-base-type association, no tier concept, no `required_level` and no spawn weight.

The app can therefore learn *that* `explicit.stat_1509134228` exists, and can learn the text of that stat. The app does learn both, from the catalogue (AD-25). The app cannot learn **which modifiers can roll on a Guardian Bow prefix, at what item level, or how often**. To supply those three facts is the entire job of this file. No number of trade API requests can replace this file.

## What the file is and is not

**The file is** raw game modifier spawn weights. A producer decomposes those weights into value cells and item-level cohorts, per base type and affix slot. Each entry carries AD-5's canonical modifier identity. That identity is `(statId, valueMin, valueMax)` for a banded entry, and `(statId)` for a valueless entry.

An entry is **located** by more fields than the fields that **identify** the entry. `itemLevelMin` states which cohort's mass the entry carries. `sourceModifierId` states which game modifier the entry came from. Neither field is part of AD-5's identity. To treat either field as part of the identity would contradict the rules built on top of the identity. Two entries that share a `statId` at different `itemLevelMin` legitimately cover the same interval (AD-28). Several entries on *different* `statId`s legitimately share one `sourceModifierId` (AD-29).

**The file is not** probabilities. `core` normalises the weights into `P(modifier | base, slot, itemLevel)` under the exact aggregation rule in **AD-18**. A producer must not normalise. A producer must not pre-aggregate cells.

**The file is not** recipe-aware. Perfect and greater transmute and augment recipes change the tier distribution. `core` models that change (AD-11). A producer never needs to know that a recipe exists.

**The file is not** a tier table. `tierLabel` is for display only. The trade API has no tier concept (AD-5). After decomposition, a cell may not correspond to a single tier. A cell's identity is therefore the cell's value edges and the cell's item level, and never the cell's tier name.

## The unit of a band is measured, not chosen

A producer expresses a band's edges in **the single quantity that the trade stat filter compares against, and in no other quantity.** `sync` passes those edges directly into the filter (AD-16). `core` counts the population that the filter returns (AD-18). If the edges and the filter use different quantities, the file validates and the app prices the wrong population.

For a stat whose text carries one `#`, that quantity is the rolled number. For a stat whose text carries two `#` marks — *"Adds # to # Lightning Damage"* — that quantity is one derived value. **Which** derived value the filter uses is an empirical fact about the trade API, and not a modelling decision. The evidence points at the **average**, because a half-integer band edge can arise only from the average of two integers. A producer must confirm the derived value against a live `trade2` search. A producer must also confirm whether the filter accepts a non-integer `min` or `max`. This question is the spine's standing Open Question on this file, and the producer owns the question.

Under an averaged unit, the value lattice is half-integers rather than integers. Closed cells tile such a lattice with no gaps. Emit edges **on** the lattice.

## Decomposing a multi-number modifier

The central fact is this: **the value axis does not partition the tier axis.** One value interval draws spawn weight from several tiers. No collapsing rule separates those tiers. Do not try to separate them. Decompose the family instead.

Per `(baseTypeId, slot, statId)` family:

1. **Cut the value axis at every tier endpoint in the family.** The cuts give one partition into cells. Compute that partition **one time over all tiers, and never per item level**. A per-item-level partition makes a curator's reference cell-aligned at one item level floor and straddling a cell at another floor. AD-18's edge-alignment check then passes for one tracked entry and fails for the next tracked entry.
2. **Group the family's tiers into cohorts by `itemLevelMin`.**
3. **Emit one entry per (tier `t`, cell `c`) that carries weight:**

   ```
   valueMin, valueMax = c's edges
   itemLevelMin       = t's own item level
   sourceModifierId   = t's own source row id
   weight             = w(t) × P(value ∈ c | t)
   ```

   **Emit one entry per tier, and not one entry per cohort.** A tier *is* a source row, and an entry names exactly one source row (AD-29). Two tiers of one family can share a cohort. A per-cohort entry would then have to name two source rows, or discard one source row. The file cannot represent two source rows in one entry. To discard a source row destroys a co-occurrence marker.

   A cohort's total is `Σ { w(t) : t ∈ tiers(ℓ) }`. In that formula, **`tiers(ℓ)` is the set of tiers whose `itemLevelMin` *equals* `ℓ`, and never the set of tiers whose `itemLevelMin` is `≤ ℓ`.** Every tier belongs to exactly one cohort. Under the `≤` reading, the same tier counts into every cohort above that tier. That reading double-counts the family in a triangular pattern. That reading *also passes the conservation check below*, because the conservation check is per cohort.

   A producer does **not emit** a cell that a tier cannot reach. An unemitted cell is a different thing from `weight: 0`. `weight: 0` means *"this modifier cannot roll on this base"*, and a `complete` pool must carry that entry. A missing cell states nothing about pool membership, because the family is present in the cohorts that do reach that cell.

   **At most two cohorts may carry one cell, counted per `(base, slot, statId)`.** Only adjacent tiers overlap. A correct partition therefore gives cells that belong to one tier or to exactly two tiers. A third cohort on one cell is a hard file error. Count across **every** source modifier that publishes that stat. To narrow the count by `sourceModifierId`, the way the non-overlap rule narrows its scope, would make the count vacuous, because a source row has exactly one cohort. *Stated assumption:* no three tiers of one family overlap at one value. If real game data ever shows three overlapping tiers, escalate that case as a contract amendment. Do not work around that case.

Worked from the real Bows data for *"Adds # to # Lightning Damage"*, by average:

| Tier | ilvl | Value range |
| --- | --- | --- |
| T6 | 54 | 32.0 – 43.0 |
| T7 | 60 | 43.0 – 56.5 |
| T8 | 65 | 56.0 – 80.0 |
| T9 | 75 | 79.0 – 103.0 |
| T10 | 81 | 101.5 – 123.0 |

The endpoints cut the axis into **nine** cells:

```
[32,42.5]  [43,43]  [43.5,55.5]  [56,56.5]  [57,78.5]  [79,80]  [80.5,101]  [101.5,103]  [103.5,123]
```

Every adjacent-tier overlap becomes its own cell. A producer emits each of those cells **two times**, one time per contributing cohort:

| Shared cell | Tiers | Emitted at `itemLevelMin` |
| --- | --- | --- |
| `[43,43]` | T6, T7 | 54 and 60 |
| `[56,56.5]` | T7, T8 | 60 and 65 |
| `[79,80]` | T8, T9 | 65 and 75 |
| `[101.5,103]` | T9, T10 | 75 and 81 |

That is how the decomposition resolves the overlap. The same interval appears under two cohorts. `core` sums the two entries only after `core` scopes the pool to the tracked entry's floor.

**A single-point overlap is still an overlap.** T6 closes at 43.0 and T7 opens at 43.0. T6 and T7 therefore share exactly one lattice point, and `[43,43]` is a legitimate one-point cell. A merge of that cell into a neighbouring cell would leave a cell that straddles a tier endpoint. A straddling cell is the defect that the partition exists to remove. A merge would also treat a touching overlap differently from a wide overlap, and the rule gives no reason for that difference. Cut at **every** endpoint, in the same way each time.

### Mass conservation is the invariant; the split is not

For every tier, the split across the cells that the tier reaches must sum to that tier's weight **exactly**:

```
Σ { w(t) × P(value ∈ c | t) : c ∈ cells }  ==  w(t)
```

Any split that conserves mass keeps the base's denominator exact. Such a split also keeps the total of every tracked reference exact. Such a split can be wrong only in how the mass distributes *within* one family. For that reason the contract fixes conservation and leaves the estimator to the producer.

**Recommended estimator:** treat the two numbers as independent uniform integers over their per-tier ranges, then count lattice points. `P(value ∈ c | t)` is the fraction of `(A, B)` pairs in tier `t`'s ranges whose derived value falls in cell `c`. A producer that cannot defend that estimator for some family may use a different split. Conservation still holds, and the file still satisfies the contract.

An entry whose mass a **model** distributed carries `provenance: "modelled-split"`. An entry whose cell mass someone **measured** directly carries `"measured"`. The provenance names how the mass was distributed. The provenance does not record that a decomposition happened.

### Conservation is declared, so that it can be checked

Conservation protects the denominator of every affected base. `core` cannot recover the pre-split tier weights from the cells. A producer must therefore declare those weights. Each `(base, slot)` carries a `cohortTotals` list. `core` refuses the file if a cohort's emitted cells do not sum to that cohort's declared total:

```jsonc
"cohortTotals": [
  { "statId": "explicit.stat_1509134228", "itemLevelMin": 60, "weight": 850 }
]
```

The total is the plain sum of that cohort's **tier** weights. A producer computes the total before any split, by a path that is independent of the cells. That independence is the purpose of the field. An independent total catches a dropped, duplicated or misattributed cell, which is the arithmetic error that happens in practice. The total cannot catch a conditional distribution that is slightly wrong. `modelled-split` is the label for that remaining risk.

`cohortTotals` is required for every `(statId, itemLevelMin)` family that contains at least one `modelled-split` entry. `cohortTotals` is permitted, and encouraged, for every other family.

### What this costs the curator, and why it is correct

**A curator can no longer isolate a tier.** A tracked reference that spans a tier boundary always includes the neighbouring tier's tail. In the table above, a reference over `[56, 80]` includes T7 rolls that averaged 56.0–56.5.

That behaviour is not a defect. The trade search also cannot isolate that tier. A filter of `min 56, max 80` returns those same T7 items. The priced population and the weighted population therefore stay **the same population**. A contract that let a curator name a "pure tier" would describe a population that nobody can query on the market.

Matched populations are necessary, but not sufficient. AD-16 estimates a population's price from the *cheapest* members of that population. That estimate is safe only while the population is homogeneous. The rule below follows from that limit.

**The curator should track the interior cell, and not the span. The boundary cells exist for that purpose.** `sync` prices a reference from the **cheapest 10** listings that the reference matches (AD-16). A reference that spans a boundary cell therefore takes its price from the neighbouring tier's cheap tail, and carries the probability mass of the whole span. Below the payout threshold, that summand truncates to zero, and the truncation removes the good tier's mass as well. That result is the BQ-1 failure mode, reached again through a heterogeneous band. The partition supplies the remedy. The reference `[57,78.5]` has a population of one tier, and a price that is that tier's price. The boundary mass is then untracked. Untracked boundary mass costs nothing, because the ranking sums over a partition of *tracked* outcomes, and the ranking has never required the tracked set to be exhaustive.

The band count roughly doubles for affected families. The higher band count has no effect on the request budget. One tracked reference is still one entry and one search (AD-12).

### Two obligations this file cannot prove it met

`core` holds no tier data. `core` can therefore check three things: that the cells tile, that each cohort sums to its declared total, and that no more than two cohorts carry one cell. `core` **cannot** check that the producer cut the partition at the real tier endpoints. `core` **cannot** check that a split's conditional distribution is correct.

A producer that emits one coarse cell per cohort would pass every mechanical check. Such a file would force every curator into a full-span reference, which is the BQ-1 failure reached through a coarse cell instead of a sentinel value. The cohort-carriage bound refuses the fully degenerate form. The failure is also loud at curation time, because edge-alignment rejects the band that the curator wanted and leaves only the full span. The remaining protection is trust. That trust is the same kind of trust, and no more trust, than the trust already placed in every weight in this file. This document names the two obligations so that a producer cannot claim surprise, and so that a reviewer knows where to look.

## A row that publishes several stats at once

The source does a second thing that the one-entry-per-`statId` model did not anticipate. One poe2db row may carry **several distinct trade stats** that share one spawn weight, because the game rolls that modifier as a unit. The example below comes from the capture, for Body Armours, and shows one row with one weight:

```
+# to Evasion Rating          ranges 4–6      ilvl 8, DropChance 1000, T1
#% increased Evasion Rating   ranges 6–13
```

The row carries two trade stats that always arrive together. Each stat has its own `statId` and its own value range. This row is **not** the *"Adds # to # Lightning Damage"* case above. That case is one stat that rolls two numbers, and the decomposition handles that case.

**Split the row at the line breaks. Emit each line as its own entry. Each entry carries the source row's full weight.** The weight `1000` above appears under *"+# to Evasion Rating"*, and appears again under *"#% increased Evasion Rating"*. That repetition is correct and deliberate. The chance that an item carries a given stat line is the chance of a draw of a modifier that publishes that stat line. That chance is the whole weight, and not a share of the weight. To attribute the mass to one line would set the other line's marginal probability to zero. To divide the mass between the lines would make both lines wrong.

**Every entry then names the row that the entry came from, in `sourceModifierId`.** The field is required on **every** entry, and not only on exploded entries, because a single-stat row is a group of one. The producer assigns the value. The app treats the value as opaque. The value is stable within one `(baseTypeId, slot)`. The app never validates the value against the trade catalogue, because the trade API has no concept of the thing that the value names.

**`sourceModifierId` names one source row, which is one *tier* of one modifier. `sourceModifierId` never names a modifier family.** The contract fixes that granularity, rather than leaves the granularity to the producer. Both readings would otherwise conform, and the two readings disagree about which items satisfy two references at one time. The source publishes weight and item level **per row**, so a row is exactly the thing that the game draws with a weight. There are two consequences. First, the tiers of one family carry **different** ids. Second, **a group sits in exactly one `itemLevelMin` cohort**. The second consequence makes the per-group mass in the denominator well defined, with nothing to reconcile across cohorts.

### What the marker is for

The marker has two purposes. A consumer cannot reconstruct either purpose after a producer splits the row.

**The denominator must not double-count.** `core` sums the pool denominator over distinct `sourceModifierId`, and counts each modifier's mass one time. `core` sums the numerator over entries (AD-18). Without the marker, the pool total inflates by the surplus lines of every hybrid row. Every probability in the class then comes out understated. The understatement is not equal across bases, because a class that carries more hybrid rows is distorted more. The ranked list therefore **reorders**, rather than shifts by a constant.

**Co-occurrence must survive the split.** Two stats that share a `sourceModifierId` always roll together. A consumer that prices *"I want both"* from two independent entries would multiply two probabilities. That product is far too small, because the correct answer is the one weight. `core` needs the marker today for a narrower reason. Two tracked entries in one slot that name two lines of one modifier are **both satisfied by a single item**. Without the marker, the ranking sum counts that item two times (AD-17, AD-29).

### The group-consistency rule

Within one `sourceModifierId` and one `itemLevelMin` cohort, the emitted weights **grouped by `statId` must sum to the same value**:

```
group g:
  Σ { e.weight : e ∈ g, e.statId == s }   is equal for every s in g
```

No separate cohort qualifier is needed. A group is one source row, so the group already sits in one cohort.

The cells of each line conserve the same underlying mass. The sums can therefore disagree only if a producer dropped, duplicated or misattributed a cell. A disagreement is therefore a **hard file error**, and this rule is the only mechanical check on the split. This rule has the same shape as `cohortTotals`, and the same reasoning.

The table below works the rule on the row above. The example assumes that the row needs no decomposition, so each line is one cell:

| `sourceModifierId` | `statId` | band | `itemLevelMin` | `weight` |
| --- | --- | --- | --- | --- |
| `ev-hybrid-t1` | `…evasion_flat` | 4 – 6 | 8 | 1000 |
| `ev-hybrid-t1` | `…evasion_pct` | 6 – 13 | 8 | 1000 |

Both `statId` sums are 1000, so the group is consistent. The pair contributes **1000** to the denominator, and not 2000.

**The lines of one group may use different kinds.** Eight of the measured rows pair a banded line with a flat line, so a group may hold `banded` and `valueless` entries together. That combination is legal. AD-5's per-`statId` kind rule constrains one `statId` across the file. That rule does not constrain one modifier across the lines of that modifier.

**Pool completeness counts stat lines, and not rows.** A `complete` pool enumerates every stat line that every rollable modifier publishes. To emit one line of a hybrid row and drop the other line is the same defect as the loss of a whole modifier.

## The pool-completeness rule

This rule carries more weight than any other clause in the contract. This rule is also the easiest rule for a producer to get wrong.

Normalisation needs a denominator. If a producer lists only the interesting modifiers, every probability that `core` computes is inflated. The inflation is silent, and the whole ranking is then wrong in a way that still looks plausible. Therefore:

- A `(baseTypeId, slot)` entry that declares `poolCoverage: "complete"` **must enumerate every modifier that can roll in that slot on that base at any item level**. The enumeration includes worthless modifiers. Every enumerated modifier carries its true weight and its true `itemLevelMin`.
- A producer that cannot guarantee that enumeration declares `poolCoverage: "partial"`. `core` then gives every probability derived from that pool the provenance `absent`. A partial pool is a lower bound on the denominator, so those probabilities are upper bounds. `core` also excludes the base from the ranked ordering (AD-18), and returns the base in the unrankable group. The view then renders the base as an unknown value (AD-10), and not as a number to trust.

There is no third option. A producer that omits modifiers and still claims `complete` produces a ranking that is wrong and that shows no doubt.

**Completeness does not depend on item level.** Enumerate the whole slot one time. A cell that rolls only at ilvl 82 belongs in a `complete` pool with `itemLevelMin: 82`. `core` removes that cell from the scope for a tracked entry with a lower floor.

**An unnamed modifier still counts.** A source sometimes publishes a row as a blank placeholder, marked `TBD`. That modifier exists in the game and carries real spawn weight. To drop that row shrinks the denominator and inflates every other probability on that base. **A pool with dropped placeholder rows is therefore `partial`, and not `complete`.** The contract deliberately has no field for anonymous weight. Such a field would let a producer hide an arbitrary share of the pool behind a scalar that nobody can check. Placeholder rows follow the patch cadence, so expect a freshly scraped class to be `partial` until the source names the rows. Emit the rest of the pool, declare `partial`, and the base returns to the ranking when the source resolves the rows.

**Someone must measure coverage. Nobody may assume coverage.** AD-27 requires a measurement before view work begins. The measured figure is the fraction of the tracked base types **that need a pool at all** that resolve to `complete` in **both** slots. A base type needs a pool if that base type carries at least one crafted tracked entry that is not `pruned`. AD-27 requires that measurement because that fraction states how much of the product exists. Both halves of the fraction exclude base types tracked only as raw bases. Such base types rank with no probability term and can never be `complete`, so their inclusion would understate coverage. One `partial` slot makes the whole base unrankable. A producer that covers prefixes well and suffixes poorly therefore scores zero on those bases.

## Shape

```jsonc
{
  "schemaVersion": "4.1.0",           // semver; core refuses a major it does not know
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
        "statLineCounts": [           // optional; how many lines each source row publishes
          { "sourceModifierId": "ev-hybrid-t1", "statLineCount": 2 }
        ],
        "entries": [
          {
            "kind": "banded",
            "sourceModifierId": "lightning-dmg-t7",  // the game modifier (AD-29)
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
            "sourceModifierId": "lightning-dmg-t8",  // a different modifier
            "statId": "explicit.stat_1509134228",
            "valueMin": 56,           // SAME interval as above — a different cohort
            "valueMax": 56.5,
            "itemLevelMin": 65,
            "tierLabel": "T8",
            "weight": 110,
            "provenance": "modelled-split"
          },
          {
            "kind": "banded",
            "sourceModifierId": "ev-hybrid-t1",      // one row, two stat lines...
            "statId": "explicit.stat_evasion_flat",
            "valueMin": 4,
            "valueMax": 6,
            "itemLevelMin": 8,
            "tierLabel": "T1",
            "weight": 1000,           // the SOURCE ROW's full weight
            "provenance": "measured"
          },
          {
            "kind": "banded",
            "sourceModifierId": "ev-hybrid-t1",      // ...same row, so same weight
            "statId": "explicit.stat_evasion_pct",
            "valueMin": 6,
            "valueMax": 13,
            "itemLevelMin": 8,
            "tierLabel": "T1",
            "weight": 1000,           // counted ONCE in the denominator (AD-18)
            "provenance": "measured"
          },
          {
            "kind": "valueless",      // rolls no number at all — no edges
            "sourceModifierId": "extra-bolt-t1",
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

## Field rules

| Field | Rule |
| --- | --- |
| `schemaVersion` | Semver. `core` refuses a major version that `core` does not implement. `core` does not guess. |
| `gamePatch` | A free-form GGG patch string. **The person who ran the producer asserts this value.** The value is not derivable from the scraped pages or from the trade API. A producer therefore takes the value as a required run-time input, and **refuses to run without the value**. The value is never `"unknown"`, and the producer never infers the value. `core` does not parse the value. `web` shows the value beside `producer.generatedAt` and `sourceUrl`, so that a human can see a file that a patch has made stale. |
| `producer.id` | Stable across regenerations by the same producer. The view shows this value beside any figure that this producer influenced. |
| `bases` key | A trade API base type `type` string, spelled exactly as `data/items` spells it, for example `"Guardian Bow"`. **`sync`** validates the key against the committed catalogue, report-only, on the same terms as `statId` above (AD-6, AD-25). A base absent from the file is **unrankable** (AD-18). `core` has no other source of eligible pools, and `core` must not invent one. |
| `slot` | Exactly `prefix` and `suffix`. A magic item carries at most one of each (brief scope). |
| `poolCoverage` | See the pool-completeness rule. Required, with no default. |
| `cohortTotals` | Stated per `(statId, itemLevelMin)`. That key stays unique under AD-29, because a cohort's total **aggregates every source row** that contributes that stat at that item level, rather than states a value per row. The value is the **pre-split** sum of those rows' weights. The list is required wherever that family carries a `modelled-split` entry, and permitted everywhere. `core` validates that the cohort's emitted cells sum to the declared total. See *Conservation is declared, so that it can be checked*. **`cohortTotals` is never a denominator.** `cohortTotals` is a conservation yardstick and nothing else. To sum `cohortTotals` for normalisation would count every hybrid row's mass one time per stat line, which is exactly the double-count that AD-18's source-modifier denominator removes. |
| `sourceModifierId` | **Required on every entry.** A producer-assigned string that names the **source row** that this entry was exploded from. A source row is one *tier* of one modifier, and never a modifier family. The string is stable within one `(baseTypeId, slot)`. A group therefore sits in exactly one `itemLevelMin` cohort. Several entries on *different* `statId`s share one value where a source row published several stat lines (AD-29). A single-stat row is a group of one. The value is opaque to the app, and the app never validates the value against the trade catalogue. The value is never part of a modifier's identity (AD-5). `core` reads the value for exactly two purposes: to de-duplicate the pool denominator (AD-18), and to detect co-occurring stat lines in AD-17's overlap check. |
| `statLineCounts` | **Optional.** A per-`(base, slot)` list of `{ sourceModifierId, statLineCount }`. The list sits beside `cohortTotals` and holds to the same terms: permitted everywhere, checked wherever present, and absent for any group that a producer cannot vouch for. `statLineCount` is the number of **distinct stat lines that the source row publishes**, taken from the row as scraped, *before* the producer explodes the row into entries. Where the list names a group, `core` refuses the file if that group's distinct `statId` count disagrees with the declared number. A `sourceModifierId` in the list that matches no entry is also a disagreement, because the entries cannot then meet the count. The whole value of the field rests on a derivation by a path that is **independent of the entries themselves**: the count comes from the source row, and the entries come from the explosion, so the check catches a bug in the explosion rather than repeats that bug. `statLineCount` is not a denominator and is not part of any identity. A producer that cannot source the count honestly should omit the field, rather than compute the count from the entries that the producer just emitted, which would make the check vacuous. |
| `kind` | `"banded"` or `"valueless"`. Required on every entry. The field is the discriminant, and not a hint. A `statId` either rolls a value or does not roll a value, so the same `statId` must never appear under both kinds within one file. |
| `statId` | A trade API stat id, validated against the committed catalogue (AD-25) by **`sync`**. `sync` is the only component that holds the full catalogue. An id that the catalogue does not know is **reported in `sync-report.json`, is never a file error, and is never a skip** (AD-6). `core` cannot run this check, so `core` cannot refuse the file over this condition. See *Validation*. |
| `valueMin` + `valueMax` | **Permitted on a `banded` entry only. Forbidden on a `valueless` entry.** The two fields are inclusive edges over the value that the trade filter compares, on that filter's own lattice. Both fields are **required**. There is no open-top form. With `statId`, the two fields form the canonical modifier identity (AD-5), which is a **three**-tuple. `itemLevelMin` locates the entry's cohort and is not part of that identity. An unbounded top band would make a tracked reference that covers that band span tiers again, which is the exact defect that 2.0.0 removes. `core` also cannot express containment against an absent edge. |
| *non-overlap* | Entries that share a `statId`, an `itemLevelMin` **and** a `sourceModifierId` within one `(base, slot)` **must not overlap**. Entries that share a `statId` at **different** `itemLevelMin` **may** cover the same interval. That overlap is how a decomposed family expresses the mass of two cohorts in one cell (AD-28). Entries that share a `statId` and an `itemLevelMin` under **different** `sourceModifierId`s may also cover the same interval. Two distinct game modifiers can publish the same stat over the same values. `core` sums both entries into the numerator, and counts each modifier one time in the denominator (AD-29). |
| `itemLevelMin` | **Required on both kinds.** The lowest item level at which this entry's mass can roll. `core` includes an entry in the pool for a tracked entry only where `itemLevelMin <= entry.itemLevelMin` (AD-18). |
| `tierLabel` | For display only. `core` must never branch on this value. Tier is not a trade API concept, and after decomposition a cell may name a mixture of tiers. The value `"T7–T8"` is acceptable. |
| `weight` | A non-negative number. `0` means **"this modifier cannot roll on this base"**, and `0` is meaningful. To omit the entry instead breaks `poolCoverage: complete`. A **cell** that no tier in the cohort reaches is a different case, and a producer simply does not emit that cell. The absence of a cell carries no claim about pool membership. |
| `provenance` | Stated per entry, because coverage is expected to be uneven. **From weakest to strongest: `"uniform-prior"` < `"modelled-split"` < `"measured"`.** That is the order that AD-10 propagates on, written here in the same direction, so that two builders cannot rank the values differently. An entry whose mass a *model* distributed carries `"modelled-split"`. An entry whose cell mass someone *measured* carries `"measured"` (AD-28). `"absent"` is a `core`-side value, weaker than all three, and must never appear in a file. `core` draws `modelled-split` from a reference's containment set only, and never from the denominator, because AD-28 conserves mass, and a conserving split leaves the denominator exactly as measured as the denominator was before the split (AD-10). |

## Validation

The schema is a Zod schema in `packages/contracts`. That Zod schema is the single source of truth. The shape above documents the Zod schema, and is not a parallel definition. An adapter in `web` reads the file. A pure function in `core` validates the already-loaded value (AD-1). `core` refuses to rank from an invalid file. `core` does not rank partially.

**Hard errors — refuse the file:**

- unknown `schemaVersion` major
- a missing or unrecognised `kind`
- one `statId` that appears under both kinds
- `valueMin` or `valueMax` present on a `valueless` entry
- `valueMin` or `valueMax` missing, `null` or non-numeric on a `banded` entry
- a duplicate `(sourceModifierId, statId, kind, valueMin, valueMax, itemLevelMin)` within a slot
- **overlapping value bands for one `statId` *at the same `itemLevelMin` and under the same `sourceModifierId`*** within a slot. Overlap across different `itemLevelMin` is legal (AD-28). Overlap between two distinct source modifiers is also legal (AD-29)
- a missing `weight`
- a negative `weight`
- a missing `itemLevelMin`
- a missing `sourceModifierId`
- a missing `poolCoverage`
- `provenance: "absent"` on any entry
- a missing or empty `gamePatch`
- a missing `cohortTotals` row for a family that carries a `modelled-split` entry
- a cohort whose emitted cells do not sum to that cohort's declared total
- the same cell interval carried by **more than two** cohorts within one `(base, slot, statId)` family. Count across **every** source modifier that publishes that stat. The count is deliberately not narrowed by `sourceModifierId` the way non-overlap is narrowed, because a source row has exactly one cohort and a per-row count could never exceed 1
- a `sourceModifierId` group whose entries carry **more than one distinct `itemLevelMin`** (AD-29). A source row is one tier and therefore one cohort, so such a group is malformed. An unchecked group left `mass(g)` with two conforming readings: whole-group, and per-cohort
- a `sourceModifierId` group whose per-`statId` weight sums **disagree** (AD-29). The group is one cohort by the rule above, so this check is a single unqualified comparison
- a group listed in `statLineCounts` whose distinct `statId` count **disagrees** with that group's declared `statLineCount`, or a listed `sourceModifierId` that matches no entry (AD-29). `core` checks only the groups that the list names, because the list is optional

**An uncatalogued `statId` or `bases` key is also not a file error.** Up to `3.0.0` this contract listed that condition as a file error. AD-6 has always assigned that check to `sync`, report-only, on the ground that `sync` reads this file and never writes this file. The two statements could not both hold, and AD-6 wins. A hard file error is a refusal by `core` at load time. `core` never holds `catalogue/items.json`, because AD-24 deliberately keeps that artifact out of `web`'s fetch set. The only component that could refuse the file therefore could not evaluate the base-type half of the check. To make the condition a refusal would mean an amendment to AD-24 to fetch a ninth artifact, and would then take the whole product offline over a condition that `sync` already reports. Therefore the file **loads**, and `sync-report.json` surfaces an id that the catalogue does not know (AD-6). A producer should still treat such an id as a defect in the producer's own output.

**The straddle rule is not a file error.** A cell that straddles a band edge in use by `data/tracked.json` breaks the invariant that matters. AD-18 aggregates whole cells only, and a straddling cell describes a population that the trade filter does not match. A straddle is nonetheless a **cross-file** condition: the same weights file straddles nothing against a differently-aligned tracked list. `core` therefore reports a straddle against the **tracked entry** whose edge the cell straddled, at load time. A straddle is never grounds to refuse this file (AD-18). Under a correct decomposition the rule holds by construction for any cell-aligned reference.

**A check catches a dropped stat line only where a group declares `statLineCount`.** Pool completeness counts **stat lines**, and a group that omits the field declares no total to check against. A producer can therefore drop one line of a multi-stat row, still declare `complete`, and pass every other check here. The group-consistency rule cannot catch that defect. The group-consistency rule compares sums across the lines that a group *does* publish, and a line dropped entirely leaves the remaining sums in agreement. **That gap is the reason to emit `statLineCount`.** A producer that handles multi-stat rows should treat the field as mandatory in practice.

The consequences depend on whether another source modifier publishes the dropped stat. The milder case is **not** the case to plan around:

- **Single publisher.** The stat disappears from the pool. A tracked reference that names that stat surfaces as an **empty containment set** under the scope. That result is loud, but ambiguous. `core` cannot tell a file that dropped a line apart from a curator who wrote a reference that the pool never held, so `core` reports both causes (AD-18). The denominator is unharmed, because AD-18 sums `mass(g)` over distinct **source modifiers**, and the group is still present with its mass intact.
- **Two source modifiers publish that `statId`**, which AD-29 expressly permits. Nothing is loud. The other modifier still supplies cells, so no empty containment set fires. The reference's **numerator** now collects only that other modifier's share, so the reference's probability **deflates silently on that base alone, which is a reorder**. If the dropped line shared its source row with a line that the curator also tracks, the co-occurrence marker disappears with the dropped line. `coOccur` then reads `false`. `core` then sums two references that a single item satisfies as disjoint outcomes. By AD-29's own argument, that base's `ΣP` then exceeds 1, and that base takes the **top** of the ranking. The base meanwhile still reads `complete` and still counts as covered under AD-27, because both of those are declarations rather than content.

A **required** field would close this gap for every file, rather than only for the producers that adopt the field. The required form is **Deferred**, and not adopted, for two reasons. A required field would be a breaking revision against a producer that already builds to `4.x`. The optional form already gives the check to any producer that wants the check.

**No check detects a dropped source *row*, and that gap is the larger of the two.** `statLineCounts` guards the lines within a row. Nothing guards the set of rows. `cohortTotals` catches a row missing from a family that `cohortTotals` already covers, but `cohortTotals` is only *required* where a family carries a `modelled-split` entry, and most rows are single-stat and undecomposed. A row dropped from a pool that still declares `complete` shrinks the denominator and **inflates every probability on that base**, which reorders the list. That outcome is strictly worse than a dropped line, and no check stands behind it. What stands between the file and that outcome is the `complete` declaration itself. `poolCoverage` is the producer's assertion that the producer enumerated every rollable modifier, and a producer that cannot vouch for that assertion must declare `partial` instead. That assertion is the same trust already extended to every weight in the file. To emit `cohortTotals` for every family, which is permitted and encouraged, narrows that trust considerably.

Band edges are **numbers, and not integers**, because the lattice that the trade filter compares on may be finer than the integers. `core` compares band edges for exact equality. Emit values that are exact on the lattice, rather than rounded approximations of a lattice value. **Exactness is safe here and must not be relaxed.** A lattice of integers or half-integers is exactly representable in binary floating point, so a correct edge compares equal with no tolerance. An edge that misses by a tiny amount is not a rounding artefact. Such an edge is a cell that straddles, which is the defect that the partition exists to remove. The two **sum** rules are the rules that ask something of a producer. See *Sums must be exact in double precision* under *Producer expectations*.

**Degraded but loadable** — `core` excludes the base from the ranked ordering and returns the base in the unrankable group with its reason (AD-18), because an inflated denominator reorders the list and a provenance label does not change a sort. Three conditions degrade a base in this way: `poolCoverage: "partial"`, a base absent entirely, and a slot with an empty pool.

## Producer expectations

Regenerate the file on GGG patch boundaries, and on no faster cadence. That difference in cadence is the entire justification for the decoupling. Prices move hourly. Weights move when the game changes.

**Cell edges must align to the floors that curators use.** `core` aggregates whole cells and rejects a straddle. A producer must therefore emit the full tier-endpoint partition, and not a coarser partition, to make the file usable. Tier endpoints are the natural cut points. Ad-hoc edges are not natural cut points.

### Sums must be exact in double precision

**Two** rules in this contract are exact comparisons that `core` applies at load, with **no tolerance**. First, a cohort's emitted cells must sum to that cohort's declared `cohortTotals` weight. Second, a group's per-`statId` weights must sum to the same value.

**`core` compares parsed IEEE doubles, summed in the file's own entry order.** Both halves of that statement are binding, and neither half is a matter of taste. *Parsed doubles*: `core` reads the file with a standard JSON parse and compares the resulting numbers. `core` does not compare the serialised decimal literals at a common scale, which is a different test, and which would accept files that this test refuses. *Entry order*: float addition is not associative. A left fold in array order, a fold in value-lattice order, and a sum of per-group subtotals can all reach different totals. Without a pinned order, "exact equality" is not even well defined, and two `core` builders would disagree about whether the same file loads (AD-28). `core` does not round, and `core` does not compare within an epsilon. `core` sums the parsed numbers in order and tests equality. That choice is deliberate. The faults that these two checks exist to catch are the size of a whole cell, so an epsilon would give no protection against those faults, and would let a genuinely unconserved file load.

A third exactness rule states that a tier's split across the cells that the tier reaches must sum to that tier's weight. `core` **cannot** apply that third rule, because `core` never holds tier weights (AD-28). That third rule is a producer obligation with no check behind it, which is exactly why nobody may soften the two rules that `core` *does* check. Those two rules are the only mechanical hold on conservation that exists.

This obligation is real, and not a formality, because **JSON numbers are IEEE doubles, and most decimal fractions are not exact in binary.** Take a cohort total of `1000` split into `240.05`, `240.05`, `240.05` and `279.85`. That split is an exact decimal partition, because the four literals sum to `1000` to the last cent. Summed as doubles, the four literals give `1000.0000000000001`, and `core` refuses the file. Floating-point addition is also **not associative**, so a producer that checks its own total in its own order can still disagree with `core`'s sum.

**The failure is intermittent, and that intermittence is the trap.** Measured over random two-decimal splits of round cohort totals: a two-cell split never failed, a three-cell split failed about 9% of the time, a four-cell split failed about 16% of the time, and an eight-cell split failed about 33% of the time. A producer that spot-checks a few narrow families sees nothing wrong, and still ships a file that `core` refuses on a wide family. Either route below removes the problem completely, rather than reduces the odds of the problem:

- **Preferred route: emit values that are exact in binary.** Use integers, or fractions whose denominator is a power of two. Keep the magnitudes well inside `2^53`, and spawn weights are nowhere near that magnitude. Every summation order then gives the same result, so the question disappears rather than needs management. The file also stays correct if anyone rewrites `core`'s fold. A largest-remainder split onto an integer grid conserves mass exactly, and is the simplest way to reach that state. **Use this route unless there is a reason not to.**
- **Fallback route: let one cell absorb the residue and close each sum.** Sum in double precision in the file's own entry order, and let the last cell absorb the difference. This route is sound only where **one** of the two sums constrains a cell. Take a cell that carries a stat line whose `statId` another source modifier also publishes. **Both** the cohort total and the group's per-`statId` agreement constrain that cell, and the two adjustments then conflict. A correction to one sum can break the other sum, and no assignment may satisfy both sums. Where that case arises, the first route is not merely preferable. The first route is necessary.

**Accepted residual risk, recorded so that nobody rediscovers it.** This contract states the requirement as a producer obligation, rather than enforces a tolerance in `core`. A producer that takes neither route therefore emits a file that is arithmetically correct and that `core` still refuses at load. The team accepted that outcome because the failure is loud and immediate, and because the file fails **closed** rather than ranks from mass that does not conserve. **The refusal must report the observed sum, the expected total, and the signed difference between the two.** The refusal must report more than the fact of a disagreement. A difference of `1e-13` is a serialisation artefact. A difference the size of a cell is a dropped cell. Without the number, nobody can tell the two cases apart, least of all the external producer, who sees only that `core` rejected the file. That number is also the evidence that the revisit below depends on. **Revisit this decision if** a conforming producer reports spurious refusals in practice. The fix is then a relative epsilon on these two sum checks only. The fix never applies to band edges, which stay exact for the separate reason given under *Validation*.

**Source honesty.** Any value obtained from a listing-derived source carries the same listing bias that the price estimator already has. Trade listings skew toward desirable and higher-tier modifiers. This file inherits that bias and does not correct it. That bias is one reason why `provenance: "measured"` means *measured by someone*, and not *ground truth*.

**Use RePoE as a last resort only.** RePoE carries modifier metadata, and RePoE does not carry spawn weights. RePoE was therefore never the authority for the field that matters. A producer uses RePoE only to fill `itemLevelMin` and pool membership when nothing better exists, and the affected entries carry `provenance: "uniform-prior"` rather than `"measured"`.

## The uniform-prior bootstrap

A file in which every entry carries `weight: 1` and `provenance: "uniform-prior"`, with `producer.id: "uniform-prior"`, is a valid file. The team develops the app against such a file before real weights arrive.

A uniform-prior file is not a stub. Such a file satisfies the real contract, so the app exercises the probability code path from day one, and the ranking formula never changes shape when measured weights arrive. Such a file still needs genuine **pool membership, cell edges and `itemLevelMin`** per entry, which is exactly the part that the trade API cannot supply. A uniform-prior file is therefore a shortcut on weighting, and never a shortcut on sourcing. AD-27's coverage gate applies to a uniform-prior file like any other file.

## Repository placement

The schema and this contract stay in this repository until the schema stops changing. The move to a separate package or repository is then mechanical, and the spine lists that move under Deferred.
