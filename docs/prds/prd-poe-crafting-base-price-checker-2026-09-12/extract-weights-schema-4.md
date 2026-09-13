# EXTRACT — Weights File Contract (schemaVersion 4.0.0)

Source: `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/WEIGHTS-FILE-SCHEMA.md`
Extracted: 2026-09-13. Normative text is quoted verbatim; anything outside a quote block is a
locator note by the extractor.

---

## 1. Frontmatter

Verbatim, lines 1–8:

```yaml
---
title: 'Weights File Contract'
status: final
schemaVersion: '4.0.0'
created: '2026-09-12'
updated: '2026-09-13'
governed_by: [AD-5, AD-6, AD-10, AD-11, AD-18, AD-27, AD-28, AD-29]
---
```

**Confirmed as asked:** `status: final`. The version key is spelled **`schemaVersion: '4.0.0'`**
— there is no separate `version:` field in the frontmatter. `updated: '2026-09-13'`.

### Revision note — `## 4.0.0 — what changed and why` (whole section, verbatim)

> Breaking. A `3.x` file will be refused.
>
> `3.0.0` modelled one entry per `statId` and assumed that was one game modifier. poe2db publishes some modifiers as **one row carrying several distinct trade stats** under a single spawn weight — the game rolls the modifier as a unit, and the stats always arrive together. Measured 2026-09-13: **560 of 8,437** in-scope rows, 534 with two stats, 18 with three, 8 pairing a banded line with a flat one. Exploding them takes 8,437 source rows to 9,015 stat-line units.
>
> This is **not** `3.0.0`'s case of one stat rolling two numbers (*"Adds # to # Lightning Damage"*), which the decomposition already handles. It is two stat ids, each with its own value range, sharing one weight.
>
> | Change | Reason |
> | --- | --- |
> | Every entry carries a required **`sourceModifierId`** | A multi-stat row is split into one entry per stat line, each keeping the source row's **full** weight — the only reading that gives each `statId` the right marginal probability. The marker is what lets `core` tell the duplication apart from genuinely separate modifiers. Required everywhere, so a single-stat row is a group of one and a producer that forgets it on a hybrid cannot emit a file that still validates (AD-29). |
> | The pool **denominator** sums over source modifiers, not entries | An affix draw selects a *modifier*, so one that publishes three stat lines contributes its weight once. Summing over entries inflates the denominator by each hybrid's surplus lines and understates every probability on the base — unevenly, so it reorders the ranked list (AD-18). |
> | New hard error: a group's per-`statId` sums must **agree** | Each line's cells conserve the same underlying mass, so they can only disagree if a cell was dropped, duplicated or misattributed. The same shape of check, and the same reason, as `cohortTotals` (AD-29). |
> | An uncatalogued `statId` or `bases` key is **no longer a hard file error** | It was one the app cannot run: a hard error is `core`'s refusal at load, and `core` never holds `catalogue/items.json` (AD-24), so the base-type half was unevaluable. The check is `sync`'s and **report-only** (AD-6), and the file loads. |
> | `status: draft` → `final` | The contract had been shipping breaking revisions against a live producer while still labelled a draft. It tracks the spine, which is `final`. |

---

## 2. Entry shapes — banded and valueless

### The identity statement (`## What the file is and is not`, verbatim)

> **It is** raw game modifier spawn weights, decomposed into value cells and item-level cohorts, per base type and affix slot, carrying AD-5's canonical modifier identity — `(statId, valueMin, valueMax)` for a banded entry, `(statId)` for a valueless one.

### The two shapes as they appear in `## Shape` (verbatim JSONC, banded entry)

```jsonc
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
```

Verbatim, valueless entry:

```jsonc
          {
            "kind": "valueless",      // rolls no number at all — no edges
            "sourceModifierId": "extra-bolt-t1",
            "statId": "explicit.stat_2954116742",
            "itemLevelMin": 45,
            "tierLabel": "T1",
            "weight": 300,
            "provenance": "measured"
          }
```

Hybrid pair (two stat lines of one row), verbatim — note both carry the **same**
`sourceModifierId` and the **same** full weight:

```jsonc
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
```

### Where `sourceModifierId` sits, and on which entries — verbatim

From `## A row that publishes several stats at once`:

> **Every entry then names the row it came from, in `sourceModifierId`.** Required on **every** entry, not only on exploded ones — a single-stat row is a group of one. Producer-assigned, opaque to the app, and stable within one `(baseTypeId, slot)`; it is never validated against the trade catalogue, because the trade API has no concept of the thing it names.
>
> **It names one source row — one *tier* of one modifier — never a modifier family.** The granularity is fixed by the contract rather than left to the producer, because both readings would otherwise conform and they disagree about which items satisfy two references at once. Weight and item level are published **per row**, so a row is exactly the thing the game draws with a weight. Two consequences: a family's tiers carry **different** ids, and **a group sits in exactly one `itemLevelMin` cohort** — which is what makes the denominator's per-group mass well-defined with nothing to reconcile across cohorts.

So: `sourceModifierId` is a **top-level field of every entry, of both kinds**, required
everywhere — **not** only on hybrids. Confirmed a second time by the Field-rules row
("**Required on every entry.**") and a third by the Validation hard error
("missing `sourceModifierId`").

> **A group's lines may span kinds.** Eight of the measured rows pair a banded line with a flat one, so a group may hold `banded` and `valueless` entries together. That is legal: AD-5's per-`statId` kind rule constrains one `statId` across the file, not one modifier across its lines.

---

## 3. `## Validation` — the whole section, verbatim, in order

> The schema is a Zod schema in `packages/contracts`, and it is the single source of truth — the shape above is documentation of it, not a parallel definition. Reading the file is an adapter's job in `web`; validating the already-loaded value is a pure function in `core` (AD-1). `core` refuses to rank from an invalid file rather than ranking partially.
>
> **Hard errors — refuse the file:**
>
> - unknown `schemaVersion` major
> - a missing or unrecognised `kind`; one `statId` appearing under both kinds
> - `valueMin`/`valueMax` present on a `valueless` entry, or missing, `null` or non-numeric on a `banded` one
> - duplicate `(sourceModifierId, statId, kind, valueMin, valueMax, itemLevelMin)` within a slot
> - **overlapping value bands for one `statId` *at the same `itemLevelMin` and under the same `sourceModifierId`*** within a slot — overlap across different `itemLevelMin` is legal (AD-28), and so is overlap between two distinct source modifiers (AD-29)
> - missing or negative `weight`; missing `itemLevelMin`; missing `sourceModifierId`; missing `poolCoverage`; `provenance: "absent"`
> - a missing or empty `gamePatch`
> - a missing `cohortTotals` row for a family carrying a `modelled-split` entry, or a cohort whose emitted cells do not sum to its declared total
> - the same cell interval carried by **more than two** cohorts within one `(base, slot, statId)` family — counted across **every** source modifier publishing that stat, deliberately not narrowed by `sourceModifierId` the way non-overlap is, since a source row has exactly one cohort and a per-row count could never exceed 1
> - a `sourceModifierId` group whose per-`statId` weight sums **disagree** within one `itemLevelMin` cohort (AD-29)
>
> **An uncatalogued `statId` or `bases` key is not a file error either.** Through `3.0.0` this contract listed it as one, and AD-6 has always assigned it to `sync`, report-only, on the ground that `sync` reads this file and never writes it. The two could not both hold, and AD-6 wins: a hard file error is `core`'s refusal at load, and `core` never holds `catalogue/items.json` — AD-24 deliberately keeps it out of `web`'s fetch set — so the base-type half of the check was unevaluable by the only component that could have refused the file. Making it a refusal would mean amending AD-24 to fetch a ninth artifact and then taking the whole product offline over a condition `sync` already reports. So: the file **loads**, and an id the catalogue does not know is surfaced in `sync-report.json` (AD-6). A producer should still treat it as a defect in its own output.
>
> **The straddle rule is not a file error.** A cell straddling a band edge in use by `data/tracked.json` is the invariant that matters — AD-18 aggregates whole cells only, and a straddling cell describes a population the trade filter does not match — but it is a **cross-file** condition: the same weights file straddles nothing against a differently-aligned tracked list. It is therefore reported against the **tracked entry** whose edge was straddled, in `core`, at load, and never as grounds for refusing this file (AD-18). Under a correct decomposition it holds by construction for any cell-aligned reference.
>
> Band edges are **numbers, not integers**, because the lattice the trade filter compares on may be finer than the integers. They are compared for exact equality, so emit values that are exact on the lattice rather than rounded approximations of one.
>
> **Degraded but loadable** — the base is excluded from the ranked ordering and returned in the unrankable group with its reason (AD-18), because an inflated denominator reorders the list and a provenance label does not change a sort: `poolCoverage: "partial"`, a base absent entirely, a slot with an empty pool.

### Answers to the specific questions put to this section

- **(a) Duplicate-key tuple:** `(sourceModifierId, statId, kind, valueMin, valueMax, itemLevelMin)`, scoped "within a slot" — six fields, `sourceModifierId` first.
- **(b) Non-overlap scoping:** three fields — `statId` **and** `itemLevelMin` **and** `sourceModifierId`, within a `(base, slot)` / "within a slot". Overlap across differing `itemLevelMin` is legal (AD-28); overlap across differing `sourceModifierId` is legal (AD-29).
- **(c) Missing `sourceModifierId`:** present, in the combined bullet "missing or negative `weight`; missing `itemLevelMin`; missing `sourceModifierId`; missing `poolCoverage`; `provenance: "absent"`".
- **(d) Group-sum disagreement:** present, the last bullet — "a `sourceModifierId` group whose per-`statId` weight sums **disagree** within one `itemLevelMin` cohort (AD-29)".
- **(e) `cohortTotals` error:** "a missing `cohortTotals` row for a family carrying a `modelled-split` entry, or a cohort whose emitted cells do not sum to its declared total". Its key tuple is stated in Field rules as **per `(statId, itemLevelMin)`** — the `cohortTotals` example rows carry exactly `statId`, `itemLevelMin`, `weight`, and **no** `sourceModifierId`.
- **(f) Uncatalogued `statId` / `bases` key:** explicitly **not** a hard file error — report-only, owned by **`sync`**, surfaced in `sync-report.json` (AD-6); the file loads.

### The group-consistency rule as stated in its own section (verbatim)

> Within one `sourceModifierId` and one `itemLevelMin` cohort, the emitted weights **grouped by `statId` must sum to the same value**:
>
> ```
> group g:
>   Σ { e.weight : e ∈ g, e.statId == s }   is equal for every s in g
> ```
>
> No cohort qualifier is needed: a group is one source row and so sits in one cohort already.
>
> Each line's cells conserve the same underlying mass, so the sums can only disagree if a cell was dropped, duplicated or misattributed. That makes this a **hard file error** and the only mechanical check on the split — the same shape, and the same reasoning, as `cohortTotals`.

---

## 4. `## Field rules` — the whole table, verbatim

> | Field | Rule |
> | --- | --- |
> | `schemaVersion` | Semver. `core` refuses a major version it does not implement rather than guessing. |
> | `gamePatch` | Free-form GGG patch string, **asserted by whoever ran the producer**. It is not derivable from the scraped pages or from the trade API, so a producer takes it as a required run-time input and **refuses to run without it** — never `"unknown"`, never inferred. `core` does not parse it; `web` surfaces it beside `producer.generatedAt` and `sourceUrl` so a file left behind by a patch is visible. |
> | `producer.id` | Stable across regenerations by the same producer. Shown in the view alongside any figure it influences. |
> | `bases` key | A trade API base type `type` string exactly as `data/items` spells it (e.g. `"Guardian Bow"`), validated against the committed catalogue by **`sync`**, report-only, on the same terms as `statId` above (AD-6, AD-25). A base absent from the file is **unrankable** (AD-18) — `core` has no other source of eligible pools and must not invent one. |
> | `slot` | Exactly `prefix` and `suffix`. Magic items carry at most one of each (brief scope). |
> | `poolCoverage` | See the pool-completeness rule. Required; no default. |
> | `cohortTotals` | Per `(statId, itemLevelMin)` — a key that stays unique under AD-29, because a cohort's total **aggregates every source row** contributing that stat at that item level, rather than being stated per row. The **pre-split** sum of those rows' weights. Required wherever that family carries a `modelled-split` entry, permitted everywhere. `core` validates that the cohort's emitted cells sum to it — see *Conservation is declared, so that it can be checked*. **It is never a denominator.** It is a conservation yardstick and nothing else; summing `cohortTotals` to normalise would count every hybrid's mass once per stat line, which is exactly the double-count AD-18's source-modifier denominator exists to remove. |
> | `sourceModifierId` | **Required on every entry.** A producer-assigned string naming the **source row** this entry was exploded from — one *tier* of one modifier, never a modifier family — stable within one `(baseTypeId, slot)`. A group therefore sits in exactly one `itemLevelMin` cohort. Several entries on *different* `statId`s share one where a source row published several stat lines (AD-29); a single-stat row is a group of one. Opaque to the app, never validated against the trade catalogue, and never part of a modifier's identity (AD-5) — `core` reads it for exactly two purposes: de-duplicating the pool denominator (AD-18) and detecting co-occurring stat lines in AD-17's overlap check. |
> | `kind` | `"banded"` or `"valueless"`. Required on every entry — the discriminant, not a hint. A `statId` either rolls a value or does not, so the same `statId` must never appear under both kinds within a file. |
> | `statId` | A trade API stat id, validated against the committed catalogue (AD-25) — by **`sync`**, which is the only component holding the full catalogue. An id the catalogue does not know is **reported in `sync-report.json`, never a file error and never a skip** (AD-6): `core` cannot run this check, so it cannot refuse the file over it. See *Validation*. |
> | `valueMin` + `valueMax` | **`banded` only; forbidden on `valueless`.** Inclusive edges over the value the trade filter compares, on that filter's own lattice. Both are **required**; there is no open-top form. With `statId` these are the canonical modifier identity (AD-5) — a **three**-tuple; `itemLevelMin` locates the entry's cohort and is not part of it. An unbounded top band would make a tracked reference covering it span tiers again — the exact defect 2.0.0 removes — and `core` cannot express containment against an absent edge. |
> | *non-overlap* | Entries sharing a `statId`, an `itemLevelMin` **and** a `sourceModifierId` within a `(base, slot)` **must not overlap**. Entries sharing a `statId` at **different** `itemLevelMin` **may** cover the same interval — that is how a decomposed family expresses two cohorts' mass in one cell (AD-28). So may entries sharing a `statId` and an `itemLevelMin` under **different** `sourceModifierId`s: two distinct game modifiers can publish the same stat over the same values, and `core` sums both into the numerator while counting each modifier once in the denominator (AD-29). |
> | `itemLevelMin` | **Required, both kinds.** The lowest item level at which this entry's mass can roll. `core` includes an entry in the pool for a tracked entry only where `itemLevelMin <= entry.itemLevelMin` (AD-18). |
> | `tierLabel` | Display only. `core` must never branch on it — tier is not a trade API concept, and after decomposition a cell may name a mixture (`"T7–T8"` is acceptable). |
> | `weight` | Non-negative number. `0` means **"this modifier cannot roll on this base"** and is meaningful; omitting the entry instead breaks `poolCoverage: complete`. A **cell** no tier in the cohort reaches is a different case and is simply not emitted — its absence carries no claim about pool membership. |
> | `provenance` | Per entry, because coverage is expected to be uneven. **Weakest to strongest: `"uniform-prior"` < `"modelled-split"` < `"measured"`** — the order AD-10 propagates on, written the same way round here so two builders cannot rank them differently. An entry whose mass was distributed by a *model* carries `"modelled-split"`; one whose cell mass was *measured* carries `"measured"` (AD-28). `"absent"` is a `core`-side value, weaker than all three, and must never appear in a file. `core` draws `modelled-split` from a reference's containment set only, never from the denominator, because AD-28 conserves mass and a conserving split leaves the denominator exactly as measured as it was (AD-10). |

### Supporting normative text on cohorts and tiers (quoted from elsewhere, since the Field-rules table defers to it)

`cohortTotals` example, verbatim from *Conservation is declared, so that it can be checked*:

```jsonc
"cohortTotals": [
  { "statId": "explicit.stat_1509134228", "itemLevelMin": 60, "weight": 850 }
]
```

> The total is the plain sum of that cohort's **tier** weights — computed before any splitting, by a path independent of the cells themselves. That independence is the point: it catches a dropped, duplicated or misattributed cell, which is the arithmetic slip that actually happens. It cannot catch a subtly wrong conditional distribution, and `modelled-split` is precisely the label for that residue.
>
> Required for every `(statId, itemLevelMin)` family containing at least one `modelled-split` entry; permitted, and encouraged, for any other.

Cohort definition, verbatim from *Decomposing a multi-number modifier*:

> A cohort's total is `Σ { w(t) : t ∈ tiers(ℓ) }`, where **`tiers(ℓ)` is the tiers whose `itemLevelMin` *equals* `ℓ`, never `≤ ℓ`.** Every tier belongs to exactly one cohort. Read as `≤`, the same tier is counted into every cohort above it — which triangular-double-counts the family *and still passes the conservation check below*, since that check is per cohort.
>
> **A cell may be carried by at most two cohorts, counted per `(base, slot, statId)`.** Only adjacent tiers overlap, so a correct partition yields cells belonging to one tier or to exactly two — a third is a hard file error. Count across **every** source modifier publishing that stat; narrowing the count by `sourceModifierId` the way non-overlap is narrowed would make it vacuous, since a source row has exactly one cohort. *Stated assumption:* no three tiers of one family overlap at a value; if real game data ever does, escalate it as a contract amendment rather than working around it.

Tier/`tierLabel` reinforcement, verbatim from *What the file is and is not*:

> **It is not** a tier table. `tierLabel` is display-only. The trade API has no tier concept (AD-5), and after decomposition a cell may not correspond to a single tier at all — so a cell's identity is its value edges and its item level, never its tier name.

---

## 5. Pool completeness — does it count stat lines or rows?

**It counts stat lines.** Verbatim, the clause that says so (end of *A row that publishes several
stats at once*):

> **Pool completeness counts stat lines, not rows.** A `complete` pool enumerates every stat line every rollable modifier publishes. Emitting one line of a hybrid and dropping the other is the same defect as dropping a modifier outright.

Note the deliberate asymmetry the contract states: completeness counts **stat lines**, while the
**denominator** sums over **source modifiers** (§4.0.0 change table, and *What the marker is for*):

> **The denominator must not double-count.** `core` sums the pool denominator over distinct `sourceModifierId`, counting each modifier's mass once, while the numerator sums over entries (AD-18). Without the marker the pool total inflates by every hybrid's surplus lines, and every probability in the class comes out understated — unevenly, since a class carrying more hybrids is distorted more, so the ranked list **reorders** rather than shifting.

### `## The pool-completeness rule` — whole section, verbatim

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
>
> **An unnamed modifier still counts.** Where a source publishes a row as a blank placeholder — a `TBD` — the modifier exists in the game and carries real spawn weight. Dropping it shrinks the denominator and inflates every other probability on that base, so **a pool with dropped placeholder rows is `partial`, not `complete`.** There is deliberately no field for anonymous weight: it would be a way for a producer to hide an arbitrary share of the pool behind a scalar nobody can check. Placeholder rows are a patch-cadence phenomenon, so expect freshly scraped classes to be `partial` until the source names them. Emit the rest of the pool, declare `partial`, and the base returns to the ranking when the rows resolve.
>
> **Coverage is measured, not assumed.** AD-27 requires the fraction of the tracked base types **that need a pool at all** — those carrying at least one crafted, non-`pruned` tracked entry — resolving to `complete` in **both** slots to be measured before view work begins, because that fraction is how much of the product exists. Base types tracked only as raw bases are excluded from both halves of the fraction: they rank with no probability term and can never be `complete`, so counting them would understate coverage. One `partial` slot makes the whole base unrankable, so a producer that covers prefixes well and suffixes poorly scores zero on those bases.

---

## 6. Identity tuple vs. locators (AD-5's three)

Verbatim, from *What the file is and is not*:

> carrying AD-5's canonical modifier identity — `(statId, valueMin, valueMax)` for a banded entry, `(statId)` for a valueless one.
>
> An entry is **located** by more than it is **identified** by. `itemLevelMin` says which cohort's mass this entry carries and `sourceModifierId` says which game modifier it came from; neither is part of AD-5's identity, and treating either as such would contradict the rules built on top of it — two entries sharing a `statId` at different `itemLevelMin` legitimately cover the same interval (AD-28), and several entries on *different* `statId`s legitimately share one `sourceModifierId` (AD-29).

Verbatim, from the `valueMin` + `valueMax` Field-rules row:

> With `statId` these are the canonical modifier identity (AD-5) — a **three**-tuple; `itemLevelMin` locates the entry's cohort and is not part of it.

Verbatim, from the `sourceModifierId` Field-rules row:

> never part of a modifier's identity (AD-5)

**Identity (banded):** `(statId, valueMin, valueMax)` — three. **Identity (valueless):** `(statId)`.
**Named as locators, not identity:** `itemLevelMin` and `sourceModifierId`.

---

## 7. Precision / decimal places

The contract makes **no** statement anywhere about decimal places, rounding to N digits, or a
float tolerance for the sum checks. What it does say about numeric precision, verbatim and in
full — all three passages:

From `## Validation`:

> Band edges are **numbers, not integers**, because the lattice the trade filter compares on may be finer than the integers. They are compared for exact equality, so emit values that are exact on the lattice rather than rounded approximations of one.

From `## The unit of a band is measured, not chosen`:

> The evidence points at the **average** (a half-integer band edge can only arise from averaging two integers), but a producer must confirm it against a live `trade2` search, along with whether the filter accepts non-integer `min`/`max`. This is the spine's standing Open Question on this file, and it is owned by the producer.
>
> Under an averaged unit the value lattice is half-integers rather than integers. Closed cells tile such a lattice without gaps; emit edges **on** the lattice.

From *Mass conservation is the invariant; the split is not* — the conservation equality is stated
as exact, with no stated tolerance:

> For every tier, the split across the cells it reaches must sum to that tier's weight **exactly**:
>
> ```
> Σ { w(t) × P(value ∈ c | t) : c ∈ cells }  ==  w(t)
> ```

**Gap flagged:** "exact equality" and "sum … exactly" are asserted for band edges, `cohortTotals`
and the group-consistency check, but the contract never fixes a decimal precision, a rounding
rule, or an epsilon for implementing those comparisons on floats.

---

## 8. Every mention of `coOccur` / co-occurrence

**There is no field, key, or identifier named `coOccur` anywhere in the contract** — not in the
`## Shape` JSONC, not in `## Field rules`, not in `## Validation`. The concept appears only as
prose, in exactly three places, quoted here in document order and in full:

1. From *Decomposing a multi-number modifier*, step 3:

   > **Emit per tier, not per cohort.** A tier *is* a source row, and an entry names exactly one (AD-29). Two tiers of one family can share a cohort, and a per-cohort entry would then have to name two source rows or throw one away — the first is unrepresentable and the second destroys a co-occurrence marker.

2. From *What the marker is for* — the second of the marker's two jobs, in full:

   > **Co-occurrence must survive the split.** Two stats sharing a `sourceModifierId` always roll together. A consumer pricing *"I want both"* from two independent entries would multiply two probabilities and get a number far too small, when the answer is the one weight. `core` needs this today for a narrower reason: two tracked entries in one slot naming two lines of one modifier are **both satisfied by a single item**, and without the marker the ranking sum counts that item twice (AD-17, AD-29).

3. From the `sourceModifierId` Field-rules row:

   > `core` reads it for exactly two purposes: de-duplicating the pool denominator (AD-18) and detecting co-occurring stat lines in AD-17's overlap check.

Co-occurrence is therefore carried **entirely by `sourceModifierId`** — there is no separate
co-occurrence field, list, or group object in the file format.
