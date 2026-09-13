---
title: 'Adversarial Divergence Review — Revision 4'
lens: adversarial-divergence
revision: 4
date: '2026-09-13'
verdict: not closed
targets:
  - ARCHITECTURE-SPINE.md (revision 4, 28 ADs)
  - WEIGHTS-FILE-SCHEMA.md (3.0.0)
findings: 18
critical: 3
high: 5
medium: 7
low: 3
---

# Adversarial Divergence — Revision 4

**Verdict: NOT CLOSED.** AD-28's arithmetic is sound where its validation passes — I could not break the numerator or the denominator against AD-16's returned population, and mass conservation does hold at every entry `itemLevelMin` I tested. What breaks is everything around the arithmetic: the *estimator* AD-16 applies to the now-deliberately-heterogeneous population reintroduces BQ-1's jackpot-deletion consequence through a different door (A-1); the cell partition is an *expectation* rather than a validated property, so edge-alignment is defined relative to whatever granularity the producer chose and a coarse-celled file reopens BQ-1 verbatim while remaining schema-valid and undetectable by the app (A-2); and the decomposition formula's index set `tiers(ℓ)` is never defined, with the wrong reading producing a triangular double-count that a per-cohort conservation check passes (A-3).

Method note on severity: a finding is **critical** only where two independently-built units, each holding a schema-valid artifact, produce *different numbers or a different ordering* with no component failing. **High** is a divergence that fails loudly but asymmetrically (one build refuses what the other accepts), or a rule whose stated justification does not establish what the dependent rule needs.

---

## Answers to the five commissioned attacks, up front

| # | Attack | Result |
| --- | --- | --- |
| 1 | Does the decomposition preserve AD-18's mass identity? | **Yes, arithmetically.** Numerator and denominator both check out at multiple floors (worked below). But the identity AD-18 needs is between the weighted population and the *priced* population, and AD-16's price estimator is a lower-tail statistic over a population AD-28 now guarantees is mixed — see **A-1**. |
| 2 | Does per-`itemLevelMin` non-overlap reopen BQ-1 or the sentinel loophole? | **Not through non-overlap — through cell granularity.** I construct a schema-valid file in **A-2** that makes edge-alignment vacuous and prices a full-span band at its floor. That is BQ-1 verbatim. |
| 3 | Can a reference be edge-aligned at one floor and not another? | **Yes.** AD-28's once-per-family claim proves *cell*-alignment is floor-invariant; AD-18's rule is not cell-alignment, it is containment-set-extremum alignment, which is floor-dependent by construction. Counterexample in **A-5**; what makes it bite is **A-4**. |
| 4 | Is the `valueless` case decided everywhere a `ModifierRef` is consumed? | **Almost.** Every named consumer decides it. The gap is the *cross-file* kind agreement (**A-13**) and an unverified filter shape (**A-14**). |
| 5 | Is the four-value provenance order stated and propagation unambiguous? | **Order stated; propagation not.** The two governing documents list the values in opposite orders with no ranks, and no rule says whether the *denominator's* entries contribute provenance — see **A-6**. |

---

## The mass identity, verified before it is attacked

Using the spine's own Bows family (SPINE:486, SCHEMA:82-92). Cells
`C1=[32,42.5] C2=[43,55.5] C3=[56,56.5] C4=[57,78.5] C5=[79,80] C6=[80.5,101] C7=[101.5,103] C8=[103.5,123]`;
cohorts 54(T6) 60(T7) 65(T8) 75(T9) 81(T10).

Emitted entries (cells each cohort reaches): 54→C1,C2; 60→C2,C3; 65→C3,C4,C5; 75→C5,C6,C7; 81→C7,C8.

**Numerator.** For `ref=[79,103]` at `L=81`, contained-under-scope = `{C5@65, C5@75, C6@75, C7@75, C7@81}`, summing to
`w(T8)·P(val∈[79,80]|T8) + w(T9)·P(val∈[79,103]|T9) + w(T10)·P(val∈[101.5,103]|T10)`
— which is exactly `Σ{t: ilvl(t)≤81} w(t)·P(val∈ref|t)`, the weight mass of the population a `min 79 / max 103 / ilvl≥81` search returns. Correct.

**Denominator.** `Σ` over all scoped entries `= Σ_stat Σ{t: ilvl(t)≤L} w(t) · Σ_c P(val∈c|t)`. The inner sum is 1 **because** cells are cut at every tier endpoint, so every tier's support is tiled. Correct — and note this is where AD-28's "cut at *every* tier endpoint" is load-bearing for the denominator, not merely for the curator's convenience. That matters for A-2.

**At a second floor,** `L=65`: denominator drops T9 and T10; numerator for `ref=[56,80]` = `{C3@60, C3@65, C4@65, C5@65}` = `w(T7)·P(val∈[56,56.5]|T7) + w(T8)·P(val∈[56,80]|T8)`, again exactly the filtered population. Correct.

**No hole is possible in the middle of an aligned reference.** Containment is "wholly inside", so every cell inside `ref` is in the set by definition; alignment pins both extremes to cell edges, so `ref` is a union of whole cells and the sum telescopes. I could not construct an interior gap. This part of AD-28 is right and should be kept.

---

## CRITICAL

### A-1 — AD-28 guarantees a mixed population; AD-16 prices it with a lower-tail statistic. BQ-1's consequence returns intact.

**Cited:** SPINE:246 (AD-16 median-of-cheapest-10, ascending sort), SPINE:504 ("A tier can no longer be isolated, and that is correct"), SCHEMA:110-112 (the same defence).

**Reading 1 (the spine's).** "The priced population and the weighted population therefore remain **the same population**, which is the only property AD-16 and AD-18 jointly require" (SCHEMA:112). True of the *set*.

**Reading 2.** AD-16 does not take a statistic *of* that population. It takes "the **median** of those listings' prices" where "those listings" are "the **cheapest 10 result ids**" under a **price-ascending** sort (SPINE:228, SPINE:246). That is deliberately a lower-tail estimator — SPINE:246 says so: "Ascending sort is what keeps stale overpriced listings out of the estimate."

**The divergence, made concrete.** Bows, `ref = [56, 80]` at `L = 65`. The weighted population is `C3@60` (T7's boundary tail, avg 56.0–56.5 — a *junk* roll that happens to land at the tier's ceiling) plus `C3@65+C4@65+C5@65` (all of T8). Say `w(T7)`-in-cell `= 40` and T8's total `= 300`: **88% of the probability mass is T8.** But a `min 56 / max 80` trade search returns T7 boundary rolls too, and those are the cheapest listings on the page by a wide margin. The cheapest 10 are plausibly *all* T7 tail. The `PriceObservation` becomes the T7-tail price.

`EV` then computes `P(T7-tail ∪ T8) × price(T7-tail)`. Compare BQ-1 as the spine itself states it (SPINE:112): "a probability covering two tiers being multiplied by one tier's price." Identical. And the fatal half is identical too — SPINE:112: "if the T2 price fell below the payout threshold, the whole entry truncated to zero and took its T1 probability mass with it." With the threshold above the T7-tail price, AD-17's `price(combo) ≥ threshold` guard drops the summand and **deletes 88% of the mass**, which is the jackpot.

**Why revision 4 owns this.** Under 2.0.0 a band *was* a tier, so the population was homogeneous and the ascending-sort estimator was a defensible within-tier statistic. AD-28 makes heterogeneity mandatory for 53 of 63 item classes (SPINE:486) and then argues the heterogeneity is harmless by an argument about set identity that the estimator does not satisfy. No AD was amended to reflect that AD-16's statistic now sits on a mixture.

**Observable consequence:** two builders who read SCHEMA:112 as settling the matter, and one who reads AD-16's ascending sort, produce identical artifacts and different top-five lists. The one that follows the documents produces the wrong one.

**What would close it:** either (a) AD-16 stops sorting ascending for multi-`#` references and states a different, mixture-robust estimator, or (b) AD-17's truncation is redefined so a partly-above-threshold summand is not zeroed, or (c) the spine records this explicitly as a *stated, accepted* distortion with its direction and magnitude named, the way it does for the `ilvl >=` superset at SPINE:330. Silently inheriting AD-16 is the one option that is not available, because the whole product is the ranking.

---

### A-2 — Edge-alignment is defined relative to the file's own cells, and nothing validates the cells. A coarse-celled file is schema-valid and reopens BQ-1 verbatim.

**Cited:** SPINE:303-310 (edge-alignment over "its containment set under the scope"), SPINE:490-492 (the producer "cuts the value axis at **every** tier endpoint"), SCHEMA:209-221 (hard-error list), SCHEMA:229 ("a producer emitting the full tier-endpoint partition (not a coarser one) is what makes the file usable").

**Reading 1.** Cutting at every tier endpoint is normative, so a curator's reference can always be pinned tightly and edge-alignment is meaningful.

**Reading 2.** SCHEMA:229 sits under **"Producer expectations"**, not under **"Hard errors — refuse the file"** (SCHEMA:209-221). The hard-error list contains no cell-granularity check. And it *cannot* contain one: the app has no tier data at all — SPINE:402/SCHEMA:42 establish that the trade API carries "no tier concept, no item-level availability and no spawn weight." **`core` has no way to know what the true tier endpoints were.**

**The schema-valid file.** For Bows / `explicit.stat_1509134228` / prefix, emit per cohort a single cell spanning the family:

```jsonc
{ "kind":"banded", "statId":"explicit.stat_1509134228",
  "valueMin":32, "valueMax":123, "itemLevelMin":54, "weight": 90,
  "provenance":"modelled-split" },
{ "kind":"banded", ..., "itemLevelMin":60, "valueMin":32,"valueMax":123, "weight":150, ... },
{ "kind":"banded", ..., "itemLevelMin":65, ... },
{ "kind":"banded", ..., "itemLevelMin":75, ... },
{ "kind":"banded", ..., "itemLevelMin":81, ... }
```

Check it against every hard error at SCHEMA:209-221: `kind` present; no `statId` under both kinds; edges present and numeric; no duplicate `(statId, kind, valueMin, valueMax, itemLevelMin)`; **no overlap at the same `itemLevelMin`** (one cell per cohort); weights non-negative; `itemLevelMin` present; `poolCoverage` present; `gamePatch` present; ids in the catalogue; **no straddle**, because the only reference in `tracked.json` is `[32,123]` and nothing straddles its edges. Mass conservation holds trivially — each tier's whole mass lands in the single cell it reaches. **The file is valid on every stated check.**

**The consequence.** The curator's *only* edge-alignable reference for this stat is `[32, 123]` — anything narrower fails SPINE:303-310 because `min valueMin = 32` and `max valueMax = 123` over the containment set. So:

- AD-16 emits `min 32, max 123` — operationally an unfiltered stat filter (SPINE:303's own words: "operationally min-only").
- AD-18 sums T6 through T10's entire weight into the numerator.
- The ascending sort prices T6 junk.

SPINE:303 names exactly this outcome: "`core` sums two tiers' weight while `sync` prices the cheaper one. That is BQ-1 verbatim, re-entered through a sentinel." Revision 3 closed the *sentinel-value* form by requiring alignment to the pool. Revision 4 reopens it as a **sentinel-cell** form, because alignment is now relative to a partition the producer chooses and no one validates. A sentinel `valueMax: 9999` was catchable; a sentinel *cell* is not, for precisely the reason AD-5 gave at SPINE:110 — "the defect would be *unvalidatable*" because the edges live in `weights.json`.

**Observable consequence:** two conforming producers, same game data. One emits the tier-endpoint partition; a curator authors six tight references and the base ranks correctly. The other emits one cell per cohort; the same curator is *forced by the validator* into one full-span reference, and the base ranks on T6's price with T10's probability. Neither file violates a stated rule. The ranking differs by orders of magnitude.

**What would close it:** the cell partition has to become checkable without tier data. The only handle the contract has is the reference edges themselves — e.g. a required declaration of the family's cut points, or a hard error on a cell whose span exceeds some declared fraction of the family range, or moving SCHEMA:229 into the hard-error list with a producer-asserted `tierEndpoints` array per family that `core` can verify the cells against. As written, "producer expectations" is where an invariant went to stop being enforced.

---

### A-3 — `tiers(ℓ)` is never defined. The wrong reading triangular-double-counts and passes a per-cohort conservation check.

**Cited:** SPINE:494-498 (`weight(ℓ, c) = Σ { w(t) × P(value ∈ c | t) : t ∈ tiers(ℓ) }`), SCHEMA:71-78 (same formula), SPINE:500 / SCHEMA:96-100 (conservation).

**Reading 1.** `tiers(ℓ) = { t : t.itemLevelMin == ℓ }` — the cohort. This is what SPINE:493 / SCHEMA:71 ("groups the family's tiers into **cohorts by** `itemLevelMin`") implies.

**Reading 2.** `tiers(ℓ) = { t : t.itemLevelMin <= ℓ }` — "the tiers available at level ℓ." This reading is directly invited by the surrounding machinery: **AD-18's `scoped()` is defined with exactly this `<=` predicate** (SPINE:317), the schema's `itemLevelMin` field rule is stated as `itemLevelMin <= entry.itemLevelMin` (SCHEMA:200), and the field is described as "the lowest item level at which this entry's mass can roll" — which for a `<=`-reader means the entry should carry *all* mass rollable from there down.

**The consequence of reading 2.** Cohort 81 would carry T6+T7+T8+T9+T10; cohort 75 would carry T6..T9; and `core`, which sums over **all** cohorts `≤ L`, produces at `L=81`:
`5·w(T6) + 4·w(T7) + 3·w(T8) + 2·w(T9) + 1·w(T10)`
in both numerator and denominator. Every probability on every multi-`#` base is wrong by a tier-dependent factor — which **reorders the ranked list**, the exact failure mode AD-18 exists to prevent (SPINE:293, SPINE:328).

**Why conservation does not catch it.** SPINE:500 / SCHEMA:96 state conservation as "**For every tier**, the split across the cells it reaches must sum to that tier's weight exactly," with the formula written over `c ∈ cells` only — no cohort index. Under reading 2, **within any single cohort** tier `t`'s split still sums to `w(t)` exactly, so a producer checking conservation the way the formula is written passes. Only a *global* check — total emitted mass across all cohorts equals `Σ_t w(t)` — catches it, and the contract never states one.

**Observable consequence:** the producer and `core` are built by different projects (SPINE:674: the weights file is "external scraper project — **not this repo**"). A `<=`-reading producer emits a file that is schema-valid, passes its own conservation check, loads without error, and silently multiplies every low-tier probability. Nothing anywhere reports it.

**What would close it:** define `tiers(ℓ)` inline as `{ t ∈ family : t.itemLevelMin == ℓ }` at both SPINE:497 and SCHEMA:77 — one clause — and restate conservation globally: `Σ over all (ℓ, c) of weight(ℓ,c) == Σ over all t of w(t)`, which is checkable by the producer and is the form that discriminates the two readings.

---

## HIGH

### A-4 — `weight: 0` versus "cells a cohort cannot reach are simply not emitted": the contract says both, and which one a producer picks decides whether `tracked.json` loads.

**Cited:** SCHEMA:202 (`weight` field rule: "`0` means 'cannot roll here' and is meaningful; **omitting the entry instead breaks `poolCoverage: complete`**. A cell a cohort cannot reach at all is simply not emitted."), SCHEMA:80 ("Cells a cohort cannot reach are simply **not** emitted. (This differs from a `weight: 0` entry, which means *'this modifier cannot roll here'*...)"), SPINE:494 ("emits, for each (cohort `ℓ`, cell `c`) **carrying weight**, one entry").

SCHEMA:202 contains the contradiction inside a single table cell: it says omitting a cannot-roll entry breaks `complete`, then says a cannot-reach cell is simply not emitted. For a cell a cohort cannot reach, "cannot roll here" and "cannot reach" are the *same fact*, so the two sentences give opposite instructions about the same entry. SCHEMA:80 tries to distinguish them but only restates the assertion; no criterion separates "cannot roll here" (emit `0`) from "cannot reach" (omit).

**Why it is not cosmetic.** Whether the zero cells are emitted changes the **containment set**, and the containment set is what AD-18's edge-alignment reads (SPINE:303-308). Worked, at `L = 65`, `ref = [79, 103]`:

| Producer reading | Containment set under scope | `min valueMin` | `max valueMax` | AD-18 alignment |
| --- | --- | --- | --- | --- |
| omit unreachable cells | `{C5@65}` | 79 ✓ | **80 ≠ 103** | **validation error** |
| emit them at `weight: 0` | `{C5@65, C6@65(0), C7@65(0)}` | 79 ✓ | 103 ✓ | **passes** |

Both files carry identical probability mass — the zero cells contribute nothing to either half of the ratio. So the *arithmetic* is producer-invariant and the *validation outcome* is not.

**Observable consequence:** the same `data/tracked.json`, the same game data, two conforming producers. Against one file the base ranks; against the other `core` "refuses to rank from an invalid file" (SCHEMA:207) or raises a `tracked.json` error and the base disappears. A curator swapping producers sees their curation break with an error message naming a value edge, and no document tells them why. This is the concrete mechanism behind A-5.

---

### A-5 — AD-28's floor-independence claim proves cell-alignment; AD-18 requires containment-extremum alignment. They are not the same property, and the second is floor-dependent.

**Cited:** SPINE:492 ("computed **once over all tiers, never per item level**, so a reference that is cell-aligned at one floor is cell-aligned at every floor. A per-cohort partition would let AD-18's edge-alignment pass at one entry's floor and fail at another's"), SCHEMA:70 (same claim), SPINE:303-310 (the rule it is meant to discharge).

**Reading 1 (AD-28's).** One partition ⇒ a reference's edges either lie on cell boundaries or they do not, independent of `L`. **True, and I verified it.**

**Reading 2 (AD-18's actual rule).** `ref.valueMin == min { band.valueMin : band ∈ contained }` where `contained` is taken "over its containment set **under the scope**" — i.e. over the *emitted entries with `itemLevelMin <= L`*. The partition is floor-invariant; the **emitted subset of it is not**, because emission is per cohort (SPINE:494) and cohorts are filtered by `L` (SPINE:317). The extrema of a floor-varying set vary with the floor.

**Counterexample** (normative reading of A-4, i.e. unreachable cells omitted): `ref = [43, 78.5]`.

| Entry floor `L` | Containment set | `max valueMax` | AD-18 |
| --- | --- | --- | --- |
| 65 | `C2@54, C2@60, C3@60, C3@65, C4@65` | 78.5 | passes |
| 60 | `C2@54, C2@60, C3@60` | **56.5** | **fails** |

Same reference, same partition, same file; aligned at one floor, rejected at another. AD-28's claim does not hold for the property AD-18 actually checks.

In the cases I constructed the *direction* of failure is conservative — a reference is rejected when it reaches above what can roll at the floor, which is arguably a useful warning — so I am not rating this critical. But the claim as written is load-bearing: it is the sentence a `contracts` author will cite when deciding *not* to write a floor-aware alignment test, and it is the sentence that makes A-4's producer-dependence invisible. AD-28 should state what it actually establishes (cell-alignment) and AD-18 should state explicitly that its extremum rule is evaluated per entry floor and is expected to reject references reaching above the floor's rollable range, with that as the intended error.

---

### A-6 — Provenance: the order is stated in one document and reversed in the other, and no rule says which entries' provenance enters a probability.

**Cited:** SPINE:166-175 (AD-10's table, "four-value total order, weakest first": `absent`, `uniform-prior`, `modelled-split`, `measured`), SCHEMA:203 (`"measured" | "modelled-split" | "uniform-prior"`), SPINE:175 ("propagates the **weakest provenance** ... of every input"), SPINE:334 (`absent` arises from a `partial` pool).

**Half one — the order.** AD-10 does state a total order and does caption it "weakest first," so a builder reading AD-10 gets it right. But no **ranks are assigned** — no `0..3`, no comparator — and the only other normative statement of the value set, SCHEMA:203, lists them in the **opposite** order. `contracts` will hold a single Zod enum (AD-22, SPINE:373); a builder authoring that enum from the schema's field-rule row and then implementing "weakest" as `minBy(enumIndex)` gets `measured` as weakest. Every figure then renders as fully measured. Given that AD-10's entire stated purpose is "a uniform-prior placeholder being quietly trusted months later with nothing on screen to reveal it" (SPINE:165), the failure mode is the one the AD exists to prevent, and the artifact stays schema-valid. Fix: assign explicit integer ranks in `contracts` and state them in AD-10, and make SCHEMA:203 cite the rank order rather than an arbitrary one.

**Half two — the input set, which is genuinely undecided.** AD-18 computes `P` as a ratio whose **denominator** ranges over the entire scoped pool (SPINE:321). AD-10 says propagate the weakest of "every input." Two readings:

- **Numerator-only:** "the provenance of *this modifier's* probability is the provenance of the cells that were summed for it." A base with `measured` chase mods and `uniform-prior` filler in the rest of the pool renders its chase rows as `measured`.
- **Whole-ratio:** the denominator's entries are inputs to the ratio, so one `uniform-prior` filler cell anywhere in the pool drags **every** probability on that base to `uniform-prior`.

AD-18 shows that denominator properties *do* propagate — it wires `partial` pool coverage (a denominator fact) to provenance `absent` (SPINE:334) — but never generalises the principle to per-entry provenance, and SCHEMA:203's note ("Per entry, because coverage is expected to be uneven. ... Propagates per AD-10") does not resolve it either.

**Observable consequence, and it is exactly what revision 4 created.** AD-28 makes `modelled-split` common — up to 36% of a weapon class's pool (SPINE:486). Under numerator-only, a chase modifier that is itself a single-`#` `measured` mod on a weapon base renders `measured` while 36% of its own denominator is modelled. Under whole-ratio, it renders `modelled-split`. AD-10:175 mandates these render **visibly differently**. Two builders, one artifact set, different user-visible truth claims about the same number. This is a divergence, not a preference, and AD-10 is the AD that must decide it.

---

### A-7 — The straddle rule has two blast radii, and revision 4 makes it fire far more often.

**Cited:** SPINE:310 ("A weights-file band that straddles a tracked band edge is a **validation error**" — stated immediately after "this is a validation error against **`data/tracked.json`**"), SCHEMA:219 (straddle listed under "**Hard errors — refuse the file**"), SCHEMA:207 ("`core` refuses to rank from an invalid file rather than ranking partially").

**Reading 1 (schema).** A straddle is a *file* hard error: the weights file is refused, `core` ranks nothing, **the entire product goes dark**.

**Reading 2 (spine).** AD-18 introduces edge-alignment, the empty-containment rule and the straddle rule in one block whose sentence-before-last says "this is a validation error against `data/tracked.json`, checked in `core` at load." A builder reading AD-18 scopes the failure to the offending tracked entry: that base becomes unrankable, everything else ranks.

A straddle is by nature a *relation between two files*, so both attributions are defensible from the text. The behaviours are not close: one mis-authored tracked reference either kills one base or takes down every base in the product.

**Why revision 4 owns it.** Under 2.0.0 a band was a tier, tier edges were stable, and a straddle was an unusual authoring slip. Under AD-28 the tracked reference must align to a *cell partition the curator does not author and cannot see*, cells are finer and more numerous ("Band count roughly doubles for affected families", SCHEMA:114), and the partition changes whenever the producer re-scrapes after a patch — SCHEMA:227 mandates regeneration on patch boundaries. A patch that shifts one tier endpoint re-cuts the family and can straddle several existing tracked references at once. The contract simultaneously promoted straddle to "the invariant" (SPINE:312, SCHEMA:221: "The straddle check is the one that matters") and left its consequence ambiguous. Name the owner and the blast radius in both documents; the per-base reading is the only one compatible with AD-18's own treatment of the neighbouring empty-containment and edge-alignment errors.

---

### A-8 — AD-27's coverage gate is blind to `modelled-split`, so the number that binds a layout decision no longer measures what it used to.

**Cited:** SPINE:458-460 (`covered(base)` = present ∧ both slots `complete` ∧ neither pool empty), SPINE:474-476 (the 80% / 50% thresholds), SPINE:486 ("up to 36% of a weapon class's pool"), SCHEMA:131.

`covered()` is a three-condition predicate over `poolCoverage` and emptiness. `provenance` appears nowhere in it. So a weapons base whose prefix pool is 36% `modelled-split` scores as fully covered, counts in AD-27's numerator, is not excluded by AD-18 (which excludes only on `partial`, SPINE:334), and ranks in the ordering alongside a fully `measured` base.

That is arguably correct as a *ranking* decision — AD-10's rationale for adding the fourth value was specifically that `uniform-prior` "would drag whole weapon classes into the degraded rendering" (memlog:121). But AD-27's fraction is not a ranking decision; SPINE:470 says it "**binds a layout decision**," and SPINE:466 says "A measurement that binds a layout decision must be reproducible by two people who have never spoken." Revision 3 spent a critical finding making that fraction unambiguous. Revision 4 then introduced a third quality tier underneath it and did not revisit the gate.

**The divergence.** Two people measuring coverage on the same file: one computes AD-27 verbatim and reports 92%; one reasons that a gate designed to answer "how much of the product exists" cannot count a pool that is one-third modelled as equivalent to a measured one, and reports the measured-only fraction — say 58%. Those land on **opposite sides of the 80% threshold**, producing different layouts for the unrankable group. AD-27's own stated failure mode ("the same tracked list and the same weights file score 100% or 40% depending on who runs the measurement", SPINE:466) has been reintroduced by the same amendment that fixed it, one axis over.

Either AD-27 explicitly states that `provenance` does not enter coverage and says why, or it gains a second reported figure (measured-coverage alongside pool-coverage). Silence is the one option that leaves the number irreproducible.

---

## MEDIUM

### A-9 — The cut-point-to-closed-cell conversion is never stated, so two conforming producers emit different partitions from identical data — and `tracked.json` is coupled to whichever one ran.

**Cited:** SPINE:490-492 ("cuts the value axis at **every** tier endpoint in the family, giving one partition into cells"), SCHEMA:82-92 (the worked cells), SPINE:506 / SCHEMA:62 (the lattice).

The instruction gives cut *points*; the artifact needs closed inclusive cells on a half-integer lattice. The conversion is shown by example and never stated. Applying the obvious rule — a cell begins at each tier start `s` and at each tier end + one lattice step `e+0.5` — to the Bows endpoints (starts 32, 43, 56, 79, 101.5; ends 43, 56.5, 80, 103, 123) yields begins `32, 43, 43.5, 56, 57, 79, 80.5, 101.5, 103.5` and therefore **nine** cells, with `[43,43]` and `[43.5,55.5]` distinct — because 43.0 is simultaneously T6's ceiling and T7's floor. The document's worked example merges them into `[43,55.5]` (eight cells) without saying so. Both are "cut at every tier endpoint."

This is not a mass problem — both partitions conserve. It is an **interface** problem: AD-18 requires the curator's reference edges to coincide with cell edges, so `data/tracked.json` is authored against a specific partition. A producer swap, or the same producer changing its boundary convention, invalidates curated references with a validation error. That directly contradicts the two load-bearing source-agnosticism claims: SCHEMA:12 ("Any producer satisfying this contract is acceptable") and SPINE:478 ("The rule is **source-agnostic**"). State the conversion rule normatively, and state that the partition is part of the contract surface `tracked.json` depends on.

### A-10 — The entity diagram still binds a `ModifierWeight` to a `ModifierRef`, which is the conflation AD-28 removes.

**Cited:** SPINE:617 (`ModifierWeight }o--|| ModifierRef : "weighs, at itemLevelMin"`), SPINE:627 (prose: "A `ModifierWeight` is a value **cell** within an item-level cohort, not a tier (AD-28)").

The prose was amended; the diagram was not. The ER edge asserts a *mandatory, exactly-one* `ModifierRef` per `ModifierWeight`. Under AD-28 a weights entry is a cell, and a `ModifierRef` is a curator-authored **union of cells** — the relationship is many-cells-to-one-ref and only for cells a curator happens to have referenced; most cells have no ref at all. A `contracts` author building from the diagram (AD-22, SPINE:373, makes `contracts` the single definition site) gives `ModifierWeight` a `ModifierRef` field, which re-imports band-equals-tier identity into the schema and forces a kind pairing at exactly the place AD-5's discriminated union was meant to remove it. Amend the edge.

### A-11 — Two definitions of "the canonical modifier identity", one per document.

**Cited:** SPINE:95 and SPINE:110 (AD-5: identity is `(statId, valueMin, valueMax)`; `ModifierRef` carries no item level — restated at SPINE:324), SCHEMA:198 ("With `statId` and `itemLevelMin` these are the canonical modifier identity (AD-5)").

The schema's `valueMin`/`valueMax` row defines the canonical modifier identity as a **four**-tuple including `itemLevelMin` and attributes that to AD-5, which defines it as a three-tuple and explicitly denies the fourth field. The entity-key convention (SPINE:517) encodes an affix as `[statId, valueMin, valueMax]` — three. A builder following SCHEMA:198 writes a four-element affix encoding into the canonical key, and two components then spell the same `TrackedEntry` differently — the precise failure SPINE:517 exists to prevent ("the key is the identity and two components must not spell it differently"). The schema is describing the *weights entry's* uniqueness key, which is a different thing and should not borrow the name.

### A-12 — A non-integer lattice was introduced; no numeric comparison rule was.

**Cited:** SPINE:506 / SCHEMA:62 (half-integer lattice), SPINE:520-521 (Conventions: "Band edges and item levels are raw game numbers"; the precision row covers divine prices and says weights are "used only in ratios"), SPINE:298 / SPINE:306 (containment and alignment use `>=`, `<=`, `==`), SCHEMA:214 (duplicate detection keys on `valueMin`/`valueMax`).

Revision 4 moved band edges off the integers and onto a lattice "finer than the integers," then left the conventions table saying "raw game numbers" with no precision, tolerance or comparison rule — while three separate validations do **exact equality or ordering on those values**. Half-integers happen to be exactly representable in binary64, so today's lattice is safe by accident. It is safe by accident in two further ways that are not written down: the JSON producer must not emit `56.50000000000001`, and the open question at SPINE:703 explicitly leaves the derived quantity *unconfirmed* — if the filter turns out to compare something that is not a two-integer average, the lattice may not be binary-representable at all and every `==` in AD-18 becomes a coin flip. State the rule: edges are exact decimal values on a declared lattice, compared exactly, and the lattice step is part of the contract.

### A-13 — Cross-file `kind` agreement is nowhere required; it is caught only incidentally, by a rule that names the wrong cause.

**Cited:** SPINE:99-106 (AD-5's union), SPINE:274 (AD-17: `contracts` rejects a banded/valueless pairing — *between two tracked references*), SCHEMA:196 ("the same `statId` must never appear under both kinds **within a file**"), SPINE:296-299 (AD-18 containment table), SPINE:326 (empty containment set is a validation error).

Both stated kind-consistency rules are intra-artifact: one within `tracked.json`, one within `weights.json`. **No rule says a tracked reference's `kind` must match the weights file's `kind` for that `statId`.** A curator writing `{kind: "valueless", statId: X}` for a stat the weights file bands produces a containment set that is empty by construction — AD-18's table only matches like-to-like — and is therefore caught, but by the empty-containment rule, whose stated meaning is entirely different: "It means the curator is tracking a tier that cannot roll on the item they are crafting" (SPINE:326). The diagnostic points the curator at their `itemLevelMin`, which is fine, and the actual cause is a kind mismatch, which they will not find. Since AD-5's whole reason for the union is that a sentinel "would pass every containment, straddle and edge-alignment check" (SPINE:106), the union deserves an explicit cross-file agreement rule with its own error, not accidental capture.

### A-14 — AD-16's `valueless` filter shape is asserted where its three siblings are measured.

**Cited:** SPINE:235 ("a `valueless` reference carries the stat id and **no edges at all** (AD-5)"), SPINE:239 ("Four traps, **the first three** verified against the live payloads on 2026-09-12"), SPINE:106 ("AD-16 emits its filter with no edges"), memlog:122 ("which is how trade treats such stats anyway").

The spine is scrupulous elsewhere about labelling what is measured versus assumed — AD-16 marks the fourth trap as an Open Question precisely because it is unverified, and AD-25/AD-15 carry verification dates. The `valueless` filter shape got neither treatment: it is stated as fact in AD-5 and AD-16 and defended in the memlog with "anyway." Whether the `trade2` stat-filter object accepts a stat id with `value` omitted entirely — versus requiring `{ "value": {} }`, versus rejecting it — is a live-payload fact of exactly the class that has already been wrong twice on this AD (memlog:83 records both `type_filters.category` and `priced_with_info` as verified-wrong assumptions). Mark it as unverified with an owner, or verify it.

### A-15 — AD-12's curation/budget narrative was not amended for a world where a tier cannot be isolated.

**Cited:** SPINE:202 ("Isolating a jackpot tier means tracking two entries where one stood, and that second band spends from the same ceiling"), SPINE:504 ("A tier can no longer be isolated"), SCHEMA:114 ("Band count roughly doubles for affected families. It has **no effect on the request budget**: one tracked reference is still one entry and one search").

SCHEMA:114 is true for a *fixed* tracked list and false for the curation act AD-12 is describing. AD-12's sentence is the spine's stated mechanism for keeping the band/budget trade-off "visible at the moment a curator makes it," and it assumes the jackpot-isolation unit is one extra band. Under AD-28 a curator chasing a T10 jackpot on a multi-`#` weapon mod cannot isolate it at all; the closest they can do is reference the cells above the last shared boundary, which for the Bows family means the union `[101.5, 123]` — reachable only at `L = 81` — or, at a lower floor, accept contamination. Where a family's cells are fine, approximating a tier costs several references and several searches. AD-12's headroom arithmetic (~1,500 searches, pinned entries spending per chunk) was reasoned against the two-entries figure. Restate it.

---

## LOW

### A-16 — The worked example understates its own duplication.
SCHEMA:92 says "Cell `[56,56.5]` is emitted twice — once at `itemLevelMin: 60` carrying T7's mass there, once at `itemLevelMin: 65` carrying T8's." With T6 ending at 43.0 and T7 opening at 43.0, cell `[43,55.5]` is *also* emitted twice (cohort 54 for T6's mass at exactly 43.0, cohort 60 for T7's). Presenting one duplicated cell as the example of "the overlap, resolved" invites a producer to treat shared *endpoints* as a different case from overlapping *ranges* and drop the boundary mass, which breaks conservation for T6 by exactly `P(val = 43.0 | T6)·w(T6)`.

### A-17 — `producer.version: "2.0.0"` in the 3.0.0 example.
SCHEMA:141-142 shows `"schemaVersion": "3.0.0"` and `"producer": { "version": "2.0.0" }`. Both are semver strings, neither is labelled in the sample beyond its key, and the field rules table (SCHEMA:190-192) documents `schemaVersion` and `producer.id` but not `producer.version`. Given that SCHEMA:19 makes "a `2.x` file will be refused" the headline of the section, a nearby literal `"2.0.0"` is an avoidable misread. Bump the sample or document the field.

### A-18 — Contract `status: draft` while the spine calls it a prerequisite at `status: final`.
SCHEMA:4 carries `status: draft`; SPINE:8-9 carries `status: final, revision: 4`; SPINE:183 and SCHEMA:14 both make the file a hard prerequisite that an external project must build against *now*. A producer reading the front matter has grounds to treat the document as provisional. Align the status, or state explicitly what `draft` means for a contract another project is already implementing.

---

## What I could not break

Recorded so the next pass does not re-litigate it:

- **The numerator/denominator identity itself.** Verified at `L = 65`, `L = 75` and `L = 81` on the spine's own Bows family. Cohort decomposition summed over `ℓ <= L` recovers `Σ{t: ilvl(t) <= L} w(t)·P(val ∈ ref | t)` exactly, and the denominator recovers total scoped tier weight exactly — *provided* cells tile every tier's support, which "cut at every tier endpoint" guarantees. This is the right design.
- **Interior gaps in an aligned reference.** Impossible: containment is "wholly inside," so alignment pinning both extrema to cell edges makes the reference a union of whole cells, and the sum telescopes.
- **Double-counting across cohorts.** Under the cohort (`==`) reading, none. Each tier's mass is emitted once, in one cohort, and `scoped()` admits each emitted entry at most once. The relaxation of non-overlap to per-`itemLevelMin` is sound on its own terms; A-3 is a definitional gap, not a flaw in the scheme.
- **The sentinel *value* loophole.** Edge-alignment genuinely closes it for banded references at any fixed cell partition: `ref.valueMax` can only equal the max `valueMax` of a scoped contained cell, so `9999` never aligns. A-2 defeats it by attacking the partition, not the edge.
- **AD-17's partition under AD-28.** Cell-aligned references on one `statId` remain disjoint in value space, the trade filter partitions on the same axis, so an item matches at most one summand and `ΣP <= 1` holds. The `slotOverlap` predicate decides both kinds and the unreachable pairing.
- **The canonical entry key.** SPINE:517's three-form encoding (`null` / `[statId, min, max]` / `[statId, null, null]`) is genuinely unambiguous and an absent affix cannot collide with a valueless one.

---

## Ordered close list

| # | Severity | One-line ask |
| --- | --- | --- |
| A-1 | critical | Decide what AD-16's estimator does on a population AD-28 guarantees is mixed, or record the distortion explicitly the way SPINE:330 records the `ilvl >=` superset. |
| A-2 | critical | Make cell granularity checkable by `core` without tier data, or move SCHEMA:229 out of "expectations" and into "hard errors" with a verifiable form. |
| A-3 | critical | Define `tiers(ℓ)` inline in both documents and restate mass conservation globally rather than per tier. |
| A-4 | high | Resolve SCHEMA:202's internal contradiction; state whether unreachable cells are emitted at `weight: 0`, and note that alignment depends on the answer. |
| A-5 | high | Correct SPINE:492 to claim cell-alignment only; state in AD-18 that extremum alignment is floor-dependent by design. |
| A-6 | high | Assign integer ranks to the provenance order, and state whether the denominator's entries contribute provenance to a probability. |
| A-7 | high | Name the straddle rule's owner and blast radius identically in both documents. |
| A-8 | high | State whether `provenance` enters AD-27's `covered()`, or add a second measured-coverage figure. |
| A-9 | medium | State the cut-point-to-closed-cell conversion normatively; acknowledge the partition as contract surface `tracked.json` depends on. |
| A-10 | medium | Amend `ModifierWeight }o--|| ModifierRef` in the ER diagram. |
| A-11 | medium | Stop calling the weights entry's uniqueness key "the canonical modifier identity". |
| A-12 | medium | State the lattice, and that edges are compared exactly. |
| A-13 | medium | Require a tracked reference's `kind` to match the weights file's `kind` for that `statId`, with its own error. |
| A-14 | medium | Verify or flag the `valueless` stat-filter shape. |
| A-15 | medium | Restate AD-12's jackpot-isolation cost for families where a tier cannot be isolated. |
| A-16 | low | Fix the worked example's duplication count. |
| A-17 | low | Bump or document `producer.version` in the 3.0.0 sample. |
| A-18 | low | Align the contract's `status` with its role. |
