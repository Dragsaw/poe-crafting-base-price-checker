---
title: 'Architecture Spine — Adversarial Divergence Review, revision 5'
lens: adversarial-divergence
target: ARCHITECTURE-SPINE.md (revision 5)
companions: [WEIGHTS-FILE-SCHEMA.md (4.0.0), AGENT-WORKFLOW.md]
date: '2026-09-13'
verdict: not-closed
---

# Adversarial Divergence — revision 5

**Method.** For each finding: two implementations that obey every AD to the letter, the concrete data on which they produce incompatible results, and the AD that should close the gap. "Incompatible" means the two would not interoperate across a package or file boundary — a file one accepts and the other refuses, a number two readers compute differently, a validation verdict that flips.

**Verdict: not-closed.** 13 findings — 3 critical, 4 high, 4 medium, 2 low. The three critical findings all sit at the AD-28 × AD-29 intersection the amendment created, and all three are cheap to close with wording, not with redesign.

**Counts**

| Severity | Count | Ids |
| --- | --- | --- |
| Critical | 3 | F1, F2, F3 |
| High | 4 | F4, F5, F6, F7 |
| Medium | 4 | F8, F9, F10, F11 |
| Low | 2 | F12, F13 |

---

## F1 — Critical: AD-28's emission algorithm cannot produce AD-29's required field

AD-28 step 3 and the contract's *Decomposing a multi-number modifier* both specify emission **per `(baseTypeId, slot, statId)` family**:

```
weight(ℓ, c) = Σ { w(t) × P(value ∈ c | t) : t ∈ tiers(ℓ) }
```

`tiers(ℓ)` is *every* tier in the family whose `itemLevelMin` equals `ℓ`. AD-29 then explicitly permits **more than one source modifier to publish one `statId`** ("One `statId` may be published by more than one source modifier, and AD-28's family is unchanged by it"), and the cell partition is deliberately cut across *every* modifier publishing the stat. So `tiers(ℓ)` can hold tiers belonging to **two different source modifiers**. Step 3 emits **one** entry for that `(ℓ, c)`. AD-29 requires that entry to carry exactly one `sourceModifierId`.

There is no conforming answer, and the two obvious ones diverge:

- **Producer A (literal AD-28).** Emits the single merged entry and assigns it one of the two ids (or a synthetic one). This is exactly what AD-29's own last paragraph forbids — "merging the two modifiers into one entry to satisfy it would destroy the co-occurrence marker on both" — yet AD-28's normative algorithm is what produced it. The denominator then counts the merged mass under one group, and `coOccur` can never see the other modifier's lines.
- **Producer B (literal AD-29).** Emits one entry per `(sourceModifierId, ℓ, c)`, splitting `tiers(ℓ)` by modifier first. The two entries now share `statId`, `itemLevelMin` and interval under different `sourceModifierId`s — legal by the non-overlap rule — but see F2: they collide in `cohortTotals` and in the cohort-carriage bound.

**Concrete data.** Guardian Bow, prefix, `explicit.stat_1509134228` published by two modifiers, both with a tier at `itemLevelMin: 60`: `lightning-dmg-t7` (weight 300) and `lightning-hybrid-t2` (weight 500), both reaching cell `[56, 56.5]`. Producer A emits one entry, `weight: 800`, `sourceModifierId: "lightning-dmg-t7"`. Producer B emits two entries, `weight: 300` and `weight: 500`. `core`'s numerator agrees (800 either way). `core`'s **denominator** does not: A contributes `mass = 800` from one group; B contributes `mass(t7) + mass(hybrid)` from two. If either modifier is a hybrid publishing a second stat line, A's merge also silently deletes that line's `coOccur` evidence, so an AD-17 overlap that should be rejected is accepted and the base's `ΣP` exceeds 1 — the failure AD-29 was added to prevent, re-entered through AD-28's own algorithm.

**Close with:** amend **AD-28** step 2/3 (and the contract's *Decomposing* section) so the **partition** is cut per `(base, slot, statId)` — unchanged, and for the stated reason — while **cohorts and emission** are per `(base, slot, statId, sourceModifierId)`. State it as the rule it is: one emitted entry belongs to exactly one source modifier, always, and the partition is the only thing shared across modifiers.

---

## F2 — Critical: `cohortTotals`' key is not unique under AD-29, and three readings of the conservation check disagree

`cohortTotals` is keyed `(statId, itemLevelMin)` — in the shape block, in the field-rules row, and in AD-28's text. AD-29 makes that pair **non-unique**: two source modifiers may publish one `statId` at one `itemLevelMin`, and a hybrid's lines each carry the full row weight. The hard-error list, meanwhile, already keys the sibling carriage bound by `(base, slot, statId, sourceModifierId)` — so the two checks in the same section are keyed differently.

Three conforming readers, three verdicts on one file:

- **Reader A (sum the cells against a single declared row).** Requires one `cohortTotals` row per `(statId, ℓ)` whose weight equals the sum of *all* that pair's emitted cells, across modifiers.
- **Reader B (per-modifier rows).** Accepts several rows sharing the key, one per source modifier, and matches each against its own modifier's cells.
- **Reader C (uniqueness).** Treats a repeated `(statId, ℓ)` key as malformed and refuses the file.

**Concrete data.** The F1 example, Producer B's output: cells for `(stat_1509134228, 60)` summing to 800 across two modifiers. Producer declares, honestly and per AD-28's "plain sum of that cohort's tier weights", two rows: `{stat, 60, 300}` and `{stat, 60, 500}`. Reader A sums cells (800) against a row it reads as 300 → **hard file error, product does not load**. Reader B → accepts. Reader C → **hard file error**, different reason. If the producer instead declares one row of 800, Reader B refuses it. There is no file that satisfies all three.

**Second edge on the same finding.** `cohortTotals` reads as an authoritative pre-split pool total, and an implementer will reach for it as a cheap denominator — it is declared, independent of the cells, and named "total". It is **not** a denominator: for a hybrid it counts the source row's weight once per stat line, which is precisely AD-18's forbidden entry-wise sum, and it is only *required* where a `modelled-split` entry exists, so it is never complete. Two builders — one computing the denominator from `sources()`, one from `cohortTotals` — produce probabilities that differ exactly on hybrid-carrying bases, i.e. they **reorder** the list rather than shifting it.

**Close with:** amend **AD-28** (and the contract) to key `cohortTotals` by `(statId, itemLevelMin, sourceModifierId)`, state that the key is unique, and add one sentence to **AD-18** forbidding `cohortTotals` as a denominator source — the denominator is `Σ mass(g, L)` and nothing else.

---

## F3 — Critical: `sourceModifierId` granularity is unspecified, and it flips AD-17's load-time verdict

The spine and the contract describe `sourceModifierId` three ways: "the game modifier this entry was exploded from" (AD-29, contract field rules), "the row it came from" / "a single-stat row is a group of one" (contract §*A row that publishes several stats*), and by example — `lightning-dmg-t7` and `lightning-dmg-t8` are *different* ids for what a player calls one modifier at two tiers. The only binding constraint is "stable within one `(baseTypeId, slot)`", which a family-wide id satisfies as well as a per-row one.

- **Producer P1 (per source row = per tier).** `lightning-dmg-t7`, `lightning-dmg-t8`, … — matching the shape block.
- **Producer P2 (per game modifier family).** One id for all tiers of *"Adds # to # Lightning Damage"* — matching AD-29's prose ("the game modifier"), and arguably more faithful to what the game draws.

Both satisfy every stated rule. The **denominator** happens to survive: under P1, `Σ mass(g,L)` over per-tier groups equals the family total; under P2 the single group's per-`statId` scoped sum is the same number. `coOccur` does not survive.

**Concrete data.** A hybrid family on Body Armours publishing `stat_evasion_flat` and `stat_evasion_pct` at five tiers, T1 (ilvl 8) through T5 (ilvl 60). A curator tracks two entries on one base: prefix = `stat_evasion_flat` over T1's cell `[4,6]`, and prefix = `stat_evasion_pct` over T5's cell `[60,75]`.

- Under **P1**, the T1 group emits an entry contained by the first reference; the T5 group emits one contained by the second; no single group emits both, and the cohorts differ (8 vs 60). `coOccur` = false → `slotOverlap` = false → **tracked.json validates**, and it should: no one item is both T1-flat and T5-pct.
- Under **P2**, one group emits both, and "same cohort" is the only remaining guard — which the shared boundary cells of a decomposed family routinely defeat, since a cell is emitted once per contributing cohort. `coOccur` = true → `slotOverlap` = true → **tracked.json is rejected at load and the entire product refuses to render.**

Same tracked list, same underlying game data, two conforming weights files, opposite product behaviour. A curator changing weights producers discovers this as a total outage with a message pointing at their tracked list.

**Close with:** amend **AD-29** to fix the granularity normatively: **one `sourceModifierId` per source row**, i.e. per tier of a modifier family — an id never spans two tiers or two `itemLevelMin` cohorts. Say why (co-occurrence is a fact about one roll, not about a family), and say that `coOccur`'s "same cohort" guard is a belt to that brace, not a substitute for it.

---

## F4 — High: `mass(g, L)` is undefined whenever a group's per-`statId` sums are not common under the scope

AD-18 defines `mass(g, L)` as "the common per-`statId` sum of `g`'s scoped entries, which AD-29 requires to agree". AD-29's invariant is explicitly **per cohort**: "Within one `sourceModifierId` and one item-level cohort, the emitted weights grouped by `statId` must sum to the same value." `scoped(base, slot, L)` is a **union over cohorts** (`itemLevelMin <= L`). The union of per-cohort-equal sums is equal only if every `statId` of `g` appears in every admitted cohort of `g`. Nothing requires that.

Two further ambiguities compound it:

1. **The quantifier.** "is equal for every `s` in `g`" — does `s` range over the stats `g` publishes **anywhere in the file**, or over those **present in that cohort**? Reader A (group-global) refuses any cohort where one line emitted nothing, on the ground that its sum is 0. Reader B (cohort-local) accepts. Both are literal readings of the sentence.
2. **Reader B's `mass` has no value.** Under B, a multi-cohort group whose lines are not co-present in every cohort has *different* per-`statId` scoped sums, and `mass(g, L)` — the "common" sum — does not exist. Implementations then pick: the max, the min, the mean, the first `statId` in file order, or the sum of per-cohort maxima. Each yields a different denominator on that base only, so each **reorders** the ranked list.

**Concrete data.** Group `g` under a family-wide id (F3's P2, or any producer whose modifier genuinely gains a line at a higher tier). Cohort ℓ=8 emits `evasion_flat` cells summing 1000 and `evasion_pct` cells summing 1000. Cohort ℓ=60 emits `evasion_flat` cells summing 400 and no `evasion_pct` cell. At `L = 60`: scoped per-`statId` sums are 1400 and 1000. Reader A refused the file at load. Reader B ranks the base with a denominator that differs by 400 depending on which rule it picked. No AD says which.

**Close with:** amend **AD-18** to define `mass(g, L)` as `Σ over admitted cohorts ℓ ≤ L of massInCohort(g, ℓ)`, where `massInCohort` is the per-cohort common value AD-29 actually guarantees; and amend **AD-29** to fix the quantifier — every `statId` the group publishes in a cohort must be present in that cohort, and a cohort emitting a proper subset of `g`'s lines is a hard file error. (Under F3's per-row granularity this collapses to the trivial case, which is the point.)

---

## F5 — High: 2-decimal divine rounding sets every crafting-currency rate to zero, and with it every craft cost

The Consistency Conventions now read: "Persisted divine prices are numbers rounded to **2 decimal places** at the point of normalisation… Rounding happens once, in `sync`; `core` never re-rounds." The justification tests the grid against exactly one quantity: AD-17's payout threshold at 0.25 divine.

It was not tested against the other side of the system. AD-20 normalises **all** prices to divine, AD-12 declares `data/currencies.json` as a priced workload, and AD-17 subtracts `craftCost(recipe)` computed in `core` from those rates. The currencies a *crafting* recipe consumes — transmutation and augmentation orbs — trade at small fractions of a divine, well below 0.01. On a 2-decimal grid they persist as **`0.00`**.

- **Implementation A (literal).** A `CurrencyRate` is a divine price, persisted by `sync`, therefore rounded to 2dp. Every transmute/augment rate is `0.00`; `craftCost` is `0.00` for every recipe; AD-17's subtraction is a no-op. The product silently reports gross expected payout as net EV.
- **Implementation B (purposive).** Reads "persisted divine **prices**" as item prices only and keeps rates at full precision. `craftCost` is a real number.

Both read one convention row. They differ on **every ranked row's EV**, and not uniformly: the gap is the recipe's cost, so the two orderings differ wherever recipes differ — which is the axis AD-17 ranks on. `core` "never re-rounds", so it cannot detect or repair the flattening; and AD-10's provenance carries the rate observation forward as if it were informative.

A second edge of the same grid: a cheap tracked item — a white ilvl-82 base, which the brief explicitly asks for — can itself normalise below 0.005 and persist as `0.00`. AD-9 forbids representing *absence* as `0`, so a reader distinguishing states by `price > 0` now misclassifies a genuinely-priced row as absent.

**Close with:** amend the **Numeric precision** convention (and **AD-20**) to separate the two quantities: a `PriceObservation` in divine rounds to 2dp; a `CurrencyRate` is a ratio, not a persisted price, and carries the precision needed to express the cheapest currency in `data/currencies.json` (or is stored as its reciprocal / in its own unit). State that a persisted price of `0.00` is a valid price and never a state signal (**AD-9**).

---

## F6 — High: `coOccur` has no defined value when the pool it reads does not exist

`coOccur(x, y)` holds when "some `sourceModifierId` in the scoped pool (AD-18) emits an entry contained by `x` and an entry contained by `y`, in the same cohort". AD-17 makes overlap "a **validation error on `data/tracked.json`**, rejected at load". AD-18 makes a base absent from `weights.json`, and a base with a `partial` or empty pool, **unrankable but loadable** — the contract's *Degraded but loadable* list says so explicitly.

So `core` must evaluate a load-time **refusal** of one file using a pool that may legitimately be missing from the other.

- **Implementation A (empty pool ⇒ false).** The base has no pool, so no modifier co-occurs, so the entries are disjoint, so `tracked.json` loads and the base lands in the unrankable group.
- **Implementation B (unevaluable ⇒ error).** The partition check cannot be performed, and AD-17 says overlap is rejected at load rather than reconciled, so it refuses `tracked.json` — taking the whole product down, since `tracked.json` is one of AD-24's eight artifacts and AD-3 says `web` "refuses to render an invalid artifact rather than degrading".

Both are defensible readings; one is a working product and one is a blank page, on the same two files.

**Worse: the verdict is not stable over time even within one implementation.** `poolCoverage` moves with every regeneration (AD-27 says so at length). A `partial` pool that omits the hybrid row makes `coOccur` false; the same producer naming that row next patch makes it true. A `tracked.json` that has validated for months becomes a **load-time refusal on a weights-file update the curator did not make**, with the error reported against their tracked entry. That is AD-27's "coverage moves" problem arriving through a hard failure path instead of through a measured fraction.

**Close with:** amend **AD-17** to state (a) the value of `coOccur` over an absent, empty or `partial` pool — the defensible answer is `false`, with the base already excluded from the ordering by AD-18, so nothing is ranked on the strength of it; and (b) that a `coOccur`-only overlap is reported as a **tracked-entry defect surfaced in the unrankable group**, not as a refusal of `tracked.json`, precisely because its truth value is a function of a file the curator does not own. Keep band-intersection and absent-affix overlap as hard refusals; they are properties of `tracked.json` alone.

---

## F7 — High: the weights contract still contradicts itself on the uncatalogued-id check AD-6 just settled

Revision 5 moved the uncatalogued-id check to `sync`, report-only. The contract's changelog row and its *Validation* section both say so. Its **field-rules table still says the opposite**, in two rows:

- `bases` key — "validated against the committed catalogue (AD-25)"
- `statId` — "validated against the committed catalogue (AD-25). **An id absent from the catalogue is a hard file error, not a skip.**"

The contract is the document a producer and a `contracts` implementer read; the field-rules table is the part they read most closely, because it is the per-field normative list. Two implementers, one document:

- **Implementer A** reads the Validation section → the Zod/`core` path loads the file and `sync` reports the id.
- **Implementer B** reads the field-rules table → `core` refuses the file at load.

**Concrete data.** A weights file naming `explicit.stat_1509134229` (one digit off) after a patch. Under A the product ranks, minus that modifier's contribution, with a line in `sync-report.json`. Under B the product does not load at all — and, per AD-6's own argument, it does so over a condition the component that refused it cannot even evaluate for the `bases` half.

**Close with:** delete the hard-error clause from the `statId` field-rules row and soften both rows to "checked against the committed catalogue by `sync`, report-only (AD-6)". This is a companion-document correction, not an AD change — but it is load-bearing, because `contracts` is built from the field-rules table.

---

## F8 — Medium: AD-26 row 3's retry bound has no rule for the `lastAttemptedAt` AD-9 now guarantees is absent

Revision 5 made this reachable. AD-9 now states that a never-requested entry carries **no** `lastAttemptedAt` and "must not be given a placeholder". AD-6 marks an entry `unresolvable` from the **offline** catalogue check, before any request; AD-9 and AD-26 both state that offline work never stamps `lastAttemptedAt`. So a newly curated entry with a typo'd `statId` is `unresolvable` with the field genuinely absent.

AD-26 row 2 handles absence explicitly ("`not-yet-synced` treated as infinitely old"). Row 1 inherits by reference ("the same key row 2 uses"). **Row 3 does not**: "at most one attempt per entry per 24h, **measured from that entry's `lastAttemptedAt`**."

- **Implementation A (absent ⇒ infinitely old, mirroring row 2).** The entry is eligible in every chunk. Because its id is uncatalogued, `sync` issues no request, so nothing ever stamps the field, so it is eligible again next chunk — **forever**, occupying a row-3 slot ahead of nothing but consuming rotation work each run. Row 3's guarantee that it "terminates rather than re-selecting a permanently failing entry every chunk" is exactly inverted.
- **Implementation B (absent ⇒ not yet due / never eligible).** The entry is never selected at row 3 at all. Harmless — AD-26 already says a re-resolving id rejoins row 2 "at that moment" via the free offline check — but it is a different rotation, and AD-26 exists because two rotations are two products.

**Concrete data.** A tracked list with 40 freshly curated entries, 3 of which carry a typo, invoked every 5 minutes against the ~8-search chunk AD-26's own worked example predicts. A and B produce different chunk contents on every run, and only A's `sync-progress.json` shows the rotation making no forward progress on them.

**Close with:** amend **AD-26** row 3 to state the absent case explicitly — an entry with no `lastAttemptedAt` is **not** eligible for row 3 (there is no failed pricing attempt to pace), and an `unresolvable` entry whose id has never resolved is reported by AD-6 rather than retried. Name it, because row 2's rule is stated and the reader will assume symmetry.

---

## F9 — Medium: `sourceModifierId`'s scope is stated as `(baseTypeId, slot)` but every consumer of it is written unqualified

The contract says the id is "stable within one `(baseTypeId, slot)`" — i.e. it carries **no** meaning across bases or across slots. Every rule that reads it is written as if the string alone identified something: "sums over distinct `sourceModifierId`" (AD-18), "some `sourceModifierId` in the scoped pool" (AD-17), "within one `sourceModifierId` and one cohort" (AD-29).

- **Implementation A** keys its index `(baseTypeId, slot, sourceModifierId)`.
- **Implementation B** keys it by the string, building one co-occurrence / mass map for the file.

Both read the ADs literally; only A reads the contract's scoping clause as binding on them.

**Concrete data.** A producer emitting short, human-readable ids — `t1`, `t2`, `hybrid-1` — which is fully conforming. Under B, `t1` on Body Armours prefix and `t1` on Guardian Bow suffix are one group: the denominator collapses two unrelated modifiers into one `mass`, and `coOccur` reports co-occurrence between stats that never appear on the same item class. Under A, nothing happens. The divergence is invisible in any file a producer using globally-unique ids emits, so it survives every test until a producer shortens its ids.

**Close with:** state in **AD-29** (and echo in the Consistency Conventions' `Ids` row, which already carves out `sourceModifierId`) that the identity is the triple `(baseTypeId, slot, sourceModifierId)` everywhere it is read, and that no component may key on the string alone.

---

## F10 — Medium: AD-17 defines no tie-break, and revision 5's coarser grid makes ties common

AD-17 gives `EV` and calls the result "the ranked list". It never states the order of equal `EV`s. AD-4 puts the ranking in `core` and forbids `web` from computing any term — but not from choosing a sort. Revision 5 made this materially worse and half-noticed it: the Numeric precision row observes that "coarser rounding makes exact ties between listing prices commoner, which is part of why AD-16's even-sample median rule has to be stated" — and then does not apply the same reasoning one level up, to the ranked list those prices feed.

- **Implementation A.** `core` returns rows in tracked-list file order within a tie; `web` renders as returned.
- **Implementation B.** `core` returns rows sorted by `EV` with a stable sort over a differently-ordered input (a `Map` iteration, a grouped-by-base intermediate); ties come out in a different order.

**Concrete data.** Twelve white ilvl-82 bases whose observed prices all round to `0.05` divine on the 2-decimal grid (F5's low end makes this routine, not contrived). A and B present twelve rows in two different orders; a threshold nudge re-renders and the order changes again within one implementation. The product's single screen is a ranking, so "same data, different top five" is a user-visible divergence.

**Close with:** amend **AD-17** to make the ordering a total order: descending `EV`, ties broken on the `TrackedEntry` canonical key already defined in the Consistency Conventions (AD-26 uses exactly this device for the same reason). One sentence.

---

## F11 — Medium: the payout threshold has no declared grid, and it gates a truncation that deletes whole probability mass

AD-17 compares `price(combo) ≥ threshold`, with prices now quantised to 0.01 divine and the threshold supplied by `web` "as a value" with no stated precision, grid or source lattice. The comparison is `≥`, so an equality is load-bearing at every grid point.

- **Implementation A.** A Mantine slider stepping in 0.01 → threshold lands on the price grid; `price == threshold` includes the summand.
- **Implementation B.** A numeric input or a percentage-derived dial producing `0.250000000000000044` (or a slider over a log scale) → `price == 0.25` now **excludes** the summand.

This is not a rounding nicety. AD-5, AD-16 and AD-28 all explain at length that a truncated summand does not merely understate — it **deletes** its probability mass and the jackpot with it (BQ-1's failure mode). So the two implementations differ by a whole outcome on any base whose chase combination prices exactly at the dial's value, which is the most likely place for a user to park the dial.

**Concrete data.** Threshold dialled to `0.25`; a combination priced at exactly `0.25` after 2dp rounding (now a common value, per F10). A ranks the base with that summand; B ranks it without.

**Close with:** amend **AD-17** to state that the threshold is denominated in divine **on the same 2-decimal grid as persisted prices**, is quantised to that grid by `web` before it crosses into `core`, and that the comparison is inclusive at the grid point. One sentence in the AD, one in the Numeric precision convention.

---

## F12 — Low: AD-16's claim that the median needs no rounding step is false for a cross-currency sample

AD-16 justifies lower-of-two-middle partly on this: "it lands on the 2-decimal grid (Consistency Conventions) with no second rounding step, since listing prices already sit on it." Listing prices sit on *their own* currency's grid. AD-16 takes the median "over **normalised** values" (AD-20), and AD-16 itself notes the sample may span currencies. A listing at 7 exalted under a rate of 0.0591 normalises to `0.4137` — not on the grid, and a rounding step is required.

That leaves the order unstated: round-then-select, or select-then-round. The persisted number happens to coincide under a monotone rounding, so this is a documentation defect rather than a numeric one — but the sentence as written tells an implementer no rounding is needed, which is how a `toFixed` gets omitted and a 4-decimal value reaches `dataset.json` in violation of the convention `core` is told never to re-apply.

**Close with:** correct the clause in **AD-16** — the grid claim holds only for a single-currency sample; state that normalisation rounds to the grid and that the median is selected **after** normalisation and rounding.

---

## F13 — Low: AD-27's coverage fraction has no precision rule at its own thresholds

`coverage` is a ratio compared against `≥ 80%` and `< 50%`, and the AD insists at length that it must be "reproducible by two people who have never spoken". It does not say at what precision. 39/49 = 0.7959 — reported as "80%" by one measurer (rounding to whole percent, as a human writing a report will) and as 79.6% by another. The first proceeds as specified; the second makes the unrankable group a first-class surface, which is a layout decision the AD says is bound by this number.

**Close with:** amend **AD-27** to state the comparison is on the exact ratio, unrounded, and that `sync-report.json` carries the ratio rather than a formatted percentage.

---

## What is *not* a finding

Recorded so the next reviewer does not re-derive them:

- **AD-18's denominator is granularity-robust.** Whether groups are per-tier or per-family, `Σ mass(g, L)` yields the same total for a single-stat family and for a hybrid whose lines each carry the full row weight. The granularity hole (F3) bites `coOccur`, not the ratio.
- **AD-28's shared boundary cells do not double-count.** Conservation is per cohort and `tiers(ℓ)` is an equality, so summing every admitted cohort's cells yields each tier's weight exactly once. The `≤`-vs-`=` trap is already called out in both documents.
- **`coOccur`'s "same cohort" guard is sound under per-row `sourceModifierId`s.** An item is drawn from one tier, and a tier is one cohort. It is only unsound under F3's family-wide reading, which is why F3 closes it at the source rather than by strengthening the guard.
- **AD-9's absent `lastAttemptedAt` composes correctly with AD-26 rows 1 and 2.** Row 2 states the infinitely-old rule and row 1 inherits it by name. Only row 3 is unhandled (F8).
- **A `valueless` line inside a hybrid group is legal and needs no `cohortTotals` row** — no split happened, so no `modelled-split` entry exists to require one. The eight measured mixed-kind rows are handled.
