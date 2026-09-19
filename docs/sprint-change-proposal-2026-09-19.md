---
title: 'Sprint Change Proposal — Weights File Contract 5.0.0'
date: '2026-09-19'
status: 'approved'
approved: '2026-09-19'
trigger: 'WEIGHTS-FILE-SCHEMA.md raised to 5.0.0, producer-driven'
scope_classification: 'Major'
affects:
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/WEIGHTS-FILE-SCHEMA.md
  - docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/DESIGN.md
  - docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md
  - docs/stories/spec-contracts-accepted-tier-and-search-id.md
---

# Sprint Change Proposal — Weights File Contract 5.0.0

## 1. Issue Summary

### What triggered this

`WEIGHTS-FILE-SCHEMA.md` was raised to **`5.0.0`** by the weights producer project
on 2026-09-18, and the player decided that the contract is **driven by the producer
application** rather than negotiated against consumer-side convenience. `5.0.0` is
breaking in both directions: a `4.x` file is not a conforming `5.0.0` file, and a
`5.0.0` file is not a conforming `4.x` file.

### What `5.0.0` changes

The producer's own decomposition machinery — value-cell partitioning, mass
conservation, group-consistency checking, largest-remainder rounding — was judged
not worth its complexity for the value it returned. `4.x` asked the producer to turn
poe2db's raw spawn weights into a derived, conserved, re-normalised layer so that the
consumer would not have to. `5.0.0` inverts that: **the producer reports poe2db's
numbers as published, plus trade-API identity, and nothing else.**

| Removed | Added |
| --- | --- |
| Value cells and the whole decomposition | `weightSource: "published" \| "absent"` per tier |
| `cohortTotals` and the conservation check | `lines[]` — a tier's stat lines nested in its entry |
| The per-`statId` group-consistency check | `ranges: [[min, max], …]` verbatim per line |
| `statLineCounts` | `statId: null` where the producer resolved none |
| `provenance` per entry | |
| `valueMin` / `valueMax` per entry | |
| The `kind` field | |
| Band non-overlap, at every scope | |
| The at-most-two-cohorts bound | |
| Six exactness rules (summation order, float comparison, producer discharge) | |

Entries are **tiers again, not cells** — one entry per poe2db row, never split by
value interval — and tier overlap is left in the raw data rather than resolved.

### Evidence

- `WEIGHTS-FILE-SCHEMA.md` at `schemaVersion: '5.0.0'`, `updated: '2026-09-18'`, with
  its own §*5.0.0 — what changed and why* stating each removal and its reason.
- The producer's measurement of 2026-09-13, carried in AD-28 and AD-29 and unchanged
  by this round: 53 of 63 item classes carry a multi-`#` modifier; 560 of 8,437
  in-scope rows publish several stats at once.
- The worked overlap case, also unchanged: Bows, *"Adds # to # Lightning Damage"*, by
  average — T7 (ilvl 60) runs 43.0–56.5 while T8 (ilvl 65) opens at 56.0.

### What the trigger did not settle, and what this proposal decides

`5.0.0` states that *"whatever weighting, averaging, or interval math the consumer's
ranking needs, the consumer now does directly against raw tier data"* — but it does
not say what that math is. That is a consumer-side architecture decision, and it
drives roughly fifteen FRs and nine ADs either way. **The player ruled on it during
this workflow**, and the ruling is §3 below.

---

## 2. Impact Analysis

### 2.1 Epic impact

**None. No epics exist.** There is no epics file and no `sprint-status.yaml` —
sprint planning has not run. Epic-level assessment (checklist §2) is therefore
**N/A** in full, and there is nothing to resequence, redefine or retire.

This is the most favourable possible timing for a breaking contract change, and it
is worth recording as such: the same change arriving after epic decomposition would
have invalidated every epic touching valuation.

### 2.2 Story impact

One story exists: `docs/stories/spec-contracts-accepted-tier-and-search-id.md`,
status `ready-for-dev`, covering the greenfield `packages/contracts` landing.

**It survives almost intact**, because its scope is deliberately the minimal slice —
`ModifierRef`, `TrackedEntry`, `PriceObservation`, the dataset entry and the
`schemaVersion` refusal. **`ModifierWeight` is not in its scope**, and `ModifierRef`'s
`banded | valueless` union, its optional `acceptedTier` on both arms, and the
attempt-scoped `lastSearchId` / `lastSearchLeague` are all unchanged by `5.0.0`.

Two edits are needed, and they differ in who may make them:

| Location | Change | Owner |
| --- | --- | --- |
| **Boundaries & Constraints**, *Never* list: *"No reissue of `WEIGHTS-FILE-SCHEMA.md`; it stays at 4.1.0"* | Now false. Becomes *"No `ModifierWeight` schema in this landing — the `5.0.0` shape arrives with the `core` landing that consumes it"* | **Human.** This bullet sits inside `<frozen-after-approval>`. Approval of this proposal is the renegotiation that unfreezes it. |
| **Code Map**, *Authority* line: *"`ARCHITECTURE-SPINE.md` rev 9 … → `prd.md` rev 9 … → the sprint change proposal"* | → *"rev 10 … rev 10 … the sprint change proposals of 2026-09-13 and 2026-09-19"* | Dev agent. Outside the frozen block. |

`docs/stories/deferred-work.md` is **unaffected** — the canonical-key encoder and its
key-exclusion test concern `acceptedTier`, `lastSearchId` and `lastSearchLeague`, none
of which `5.0.0` touches.

### 2.3 Artifact conflicts

| Artifact | Conflict | Extent |
| --- | --- | --- |
| **`prd.md`** rev 9 | §3 glossary carries three terms that no longer exist; FR-27, FR-28, FR-29 specify withdrawn machinery; FR-22's curation rule names a unit that is gone; FR-10/FR-11 render a retired Provenance value; FR-21's population-alignment argument no longer holds | **Heavy.** ~15 FRs and sections |
| **`ARCHITECTURE-SPINE.md`** rev 9 | AD-28 specifies the withdrawn decomposition; AD-18 carries a rule `5.0.0` makes unsatisfiable; AD-29's three audit checks lose their subject; AD-10 carries a value with no source; AD-5, AD-6, AD-11, AD-12, AD-17 carry stale citations; Consistency Conventions, Structural Seed and Deferred all reference cells or cohorts | **Heavy.** 9 ADs + 4 sections |
| **`WEIGHTS-FILE-SCHEMA.md`** 5.0.0 | Declares itself a non-authoritative producer-side draft *in the repo that owns it*; points at a producer-repo path; claims it is gitignored here; `status: draft` | **Moderate.** 4 defects + 2 additions |
| **`DESIGN.md`** / **`EXPERIENCE.md`** | Carry a colour token, a component, a glyph, a word and four table rows for the retired `modelled-split`; `EXPERIENCE.md`'s back-end vocabulary list names three retired terms | **Moderate.** 11 live passages |
| **`AGENT-WORKFLOW.md`** | No conflict found | None |
| **`CLAUDE.md`** | No conflict found — carries shell style, `uv`, Mantine v9; no frozen paths bearing on this change | None |

**The initial framing that UX is unaffected does not hold.** It held for the file's
*shape* — nothing in the view changes because entries became tiers. It fails on
**Provenance**, which collapses from four values to three, retiring a value the UX run
gave a full treatment. This was surfaced before any decision was taken, and the
ruling that forces it was taken with that consequence stated.

### 2.4 Technical impact

**No code exists**, so there is no implementation to migrate. The impact is entirely
on work not yet done:

- **`contracts`** — `ModifierWeight`'s Zod schema is unwritten and will be written to
  `5.0.0` directly, never to `4.x`. This is a saving, not a cost.
- **`core`** — gains one derivation it would not have had (a line's filter-comparable
  interval from its `ranges`) and loses ten checks it would have had to implement
  (conservation, group consistency, `statLineCounts`, one-cohort, two-cohort,
  non-overlap, kind, composite duplicate key, the `provenance: "absent"` prohibition,
  and six exactness rules). **Net substantially simpler.**
- **`core` ranking arithmetic** — the denominator collapses from a source-modifier
  grouping to a plain sum over entries. `mass(g)` and `sources(S)` disappear.
- **`sync`** — its run-start cross-file gate drops from five checks to four.
- **`web`** — two render treatments instead of three; one colour token and one
  component retire.
- **NFR-6's 100 ms budget** — unaffected. Whole-tier containment adds one interval
  derivation per line and no per-ranking-pass work beyond what `4.x` required.

---

## 3. Recommended Approach

### 3.1 Path selection

**Option 1 — Direct Adjustment. Viable and selected.** Effort **High**, risk **Low**.

- **Option 2 — Rollback:** *not viable and not applicable.* No work has been completed
  that could be reverted. No code exists.
- **Option 3 — MVP review:** *not required.* **§7.1 In Scope is unchanged.** No item
  changes what v1 does. The product ranks the same Base Types against the same trade
  API for the same player.

Effort is High because the affected text is dense, inherited and heavily
cross-referenced — not because the change is architecturally hard. Risk is Low because
nothing is built and every change is to documents that have not yet been executed
against.

### 3.2 The consumer-side ruling

`5.0.0` hands the consumer overlapping raw tiers and does not say what to do with
them. Three replacements for the withdrawn machinery were put to the player:

| Option | Behaviour | Why it was not chosen |
| --- | --- | --- |
| Pro-rate | `core` computes `P(value ∈ band \| tier)` from raw `ranges` | Correct arithmetic, but it re-sites the producer's withdrawn model inside the browser, where nobody can diff it — and re-opens the Provenance distinction |
| Whole-tier inclusion | Every overlapping tier contributes full weight | Over-counts; inflates that base's `ΣP` |
| **Whole-tier containment** | **A tier only partly covered contributes nothing** | **Selected** |

**Whole-tier containment is the ruling.** A tracked band counts a tier's weight only
where the tier's derived interval lies wholly inside the band.

**What it costs, stated rather than implied.** The trade search returns the
neighbouring tier's tail — the filter cannot exclude it either — while `core` counts
none of that tier's weight. Every affected probability is an **understatement**, and
the error is uneven across Base Types, so it **reorders** rather than shifts.

**Two things bound the damage, and neither is accidental:**

1. FR-21 sorts ascending and takes the **cheapest ten**, while an excluded tail sits
   at the **top** of the band by construction. The population dropped from the
   numerator is largely the population the price estimate never sees. **The two errors
   do not compound.**
2. FR-29's edge-alignment check rejects the one band shape that would make the gap
   wide — a ceiling reaching into a tier the band does not contain.

**The residual is unmeasured**, and §7.2 carries the measurement with its revisit
condition. The player accepted the trade on the stated ground that it may be improved
later, not that it is free.

### 3.3 Consequences of the ruling

- **AD-18's straddle rule retires.** It is not rewritten — it becomes *unsatisfiable*.
  With cells gone, no band contains Bows T7 without clipping T8, because edges are
  closed at both ends. Retaining it would reject every crafted configuration on 53 of
  63 item classes.
- **Edge alignment survives and does more work**, retargeted from cell edges to tier
  intervals. It remains the sentinel defence and additionally catches the new mistake
  containment creates.
- **Provenance collapses four values → three.** `modelled-split` had exactly one
  source — the producer's decomposition — and becomes unreachable. This forces the UX
  change in §4.11.
- **The denominator collapses.** One entry is one source row, so `mass(g)` and
  `sources(S)` reduce to identities.

### 3.4 What this round costs, recorded honestly

Three things get worse, and the documents say so rather than reading as a
simplification:

1. **The trust surface widens.** `4.x` gave `core` two independent arithmetic audits
   of the producer's work. `5.0.0` gives it none. A dropped tier and a dropped stat
   line now rest entirely on the producer's `poolCoverage` assertion.
2. **A known hole widens.** `statLineCounts` partly covered a dropped line and
   retires. The silent case — a second tier publishing one `statId`, no error fired, a
   numerator quietly deflating — now has nothing behind it.
3. **Every affected probability is an understatement** (§3.2).

**What is bought is a contract the producer can actually satisfy**, against two
revisions of machinery it could not.

### 3.5 Timeline

No timeline impact. No work is in flight, no epic is scheduled, and the one
`ready-for-dev` story needs two line edits and stays `ready-for-dev`.

---

## 4. Detailed Change Proposals

All twelve were reviewed individually and approved. Dependency-ordered.

### 4.1 AD-28 — retire the decomposition

`ARCHITECTURE-SPINE.md`, AD-28. **Amended in place, never deleted** — AD ids are
stable and no AD has ever been removed.

**Retitled:** *"Multi-number modifiers decompose over the value axis, not the tier
axis"* → **"Multi-number modifiers overlap in value space, and containment resolves
the overlap"**.

**Retained:** the `Prevents` clause (extended), the 2026-09-13 measurement, the
band-unit clause, the "a tier cannot be isolated" fact.

**Deleted:** the three-step partition procedure; `weight(t, c) = w(t) × P(value ∈ c | t)`;
the cohort-total equality argument; mass conservation as the invariant; the
independent-uniform estimator; `cohortTotals`; the exact-comparison and
pinned-summation-order rules; the non-overlap restatement; the two unverifiable
producer obligations; the at-most-two-cohorts bound; the value-lattice paragraph; the
interior-cell curation rule.

**New body, in order:** the value-axis/tier-axis statement and the measurement
(unchanged) → **"The overlap is reported, and it is not resolved"** (records the
withdrawal as a removed *operation*, not a lowered bar) → **the band-unit clause**
(verbatim, plus a note that `core` deriving intervals raises its stakes) → **"A tier's
value interval is derived, and `core` derives it the one way"** → **the exact-
representability constraint and its three-or-more-`#` hazard** (see §4.5g) →
**"Containment is whole-tier, and a partially-overlapped tier contributes nothing"**
(with both rejected alternatives and why) → **"What whole-tier containment costs"**
(direction, unevenness, the two bounds, the stated assumption) → **"A tier cannot be
isolated, and a band spanning two tiers is legitimate"**.

### 4.2 AD-18 — containment, alignment, straddle retirement, denominator

`ARCHITECTURE-SPINE.md`, AD-18. Six passages change; the `Prevents` clause, the
no-open-top rule, the floor-dependence argument, both stated assumptions, the
independent-draws rule, the partial-pool/unrankable rule and the recipe rule are
unchanged.

**a. Containment table** → matches on an entry's **lines**:

| Reference kind | Contains an entry when one of the entry's `lines` … |
| --- | --- |
| `banded` | carries `ref.statId`, has a **non-empty** `ranges`, and has a derived interval lying **wholly inside** the reference |
| `valueless` | carries `ref.statId` and has an **empty** `ranges` |

Plus: a contained entry contributes its **whole weight, once**; a merely-overlapping
tier contributes nothing and is not an error; **a line whose `statId` is `null` can
never be contained** but still enters the denominator.

**b. Edge alignment**, retargeted:

```
ref.valueMin == min { interval(line).min : line ∈ contained(ref) }
ref.valueMax == max { interval(line).max : line ∈ contained(ref) }
```

with the worked table of accepted and rejected bands.

**c. The straddle rule is withdrawn**, and the withdrawal is stated as *forced*.
Non-overlap is withdrawn with it.

**d. Check count five → four.** AD-18 carries two (edge alignment, empty containment
set); AD-17 carries two (`coOccur`, kind agreement). Kind agreement is **retargeted,
not reduced** — `5.0.0` has no `kind` field, so a line's kind is read from its
`ranges`.

**e. The denominator collapses:**

```
scoped(base, slot, L) = { entry ∈ pool(base, slot) : entry.itemLevelMin <= L }

                         Σ { e.weight : e ∈ scoped(base, slot, L) ∧ contains(ref, e) }
P(ref | base, slot, L) = ────────────────────────────────────────────────────────────
                                 Σ { e.weight : e ∈ scoped(base, slot, L) }
```

The invariant is unchanged and now **structural**: the double-counting reading is no
longer reachable, because no shape in the file admits it.

**f. The empty containment set** keeps both its causes, and records that nothing
mechanical now stands behind the second.

### 4.3 AD-29 — one entry per tier

`ARCHITECTURE-SPINE.md`, AD-29. **Title unchanged** — *"One game modifier may publish
several stat lines, and the draw is over modifiers"* is more literally true under
`5.0.0`, not less.

- **`Prevents`** narrows to the co-occurrence loss and the several-draws misreading.
- **Emission model:** one entry per source row, lines nested. The Body Armours case is
  **one** entry at weight 1000 with **two** lines. *"Revision 10 replaces an explosion
  with a nesting"* is the framing.
- **Three checks retire** — one-cohort, group-consistency, `statLineCounts` — each
  because its subject is gone.
- **Co-occurrence becomes a direct read** of one entry's `lines`; the cohort clause and
  its explanatory paragraph retire with no condition lost.
- **New:** a line may carry `statId: null`; it is data, never a file error, and never a
  reason to declare a pool `partial`.
- **New closing passage:** what `core` can still check, and what it cannot — stating
  the widened trust surface in one place.

### 4.4 AD-10 — Provenance four → three

`ARCHITECTURE-SPINE.md`, AD-10. The revision-9 freshness cut-off content is untouched.

| Rank | Provenance | Means | Arises from |
| --- | --- | --- | --- |
| 0 | `absent` | not an estimate — an upper bound | a `partial` pool, and nowhere else |
| 1 | `uniform-prior` | the weight was invented | `weightSource: "absent"`, or a bootstrap file |
| 2 | `measured` | measured by someone | `weightSource: "published"` |

- The `weightSource` mapping is **stated explicitly and in one place**, because
  `"absent"` → `uniform-prior` is correct and `"absent"` → provenance `absent` is the
  reading the shared word invites and is wrong.
- **Two render treatments, not three.**
- **The numerator-only propagation exception retires with the value it governed.**
  Every provenance again propagates from every input.
- **Revisit condition:** if consumer-side pro-rating is ever adopted, this value must
  return *in the same change*, or the product carries an unlabelled model inside every
  ranked number.

### 4.5 Citation repairs and one new finding

`ARCHITECTURE-SPINE.md`, across seven locations.

- **a. AD-11** — the file's shape rewritten to the `5.0.0` entry and line structure;
  *"the producer performs no value math"*. The uniform-prior bootstrap gains
  `weightSource: "absent"`.
- **b. AD-12** — *"all five checks"* → *"all four"*. **The budget clause reverses:**
  `4.x`'s finer-than-tier partition could cost a curator *more* entries; `5.0.0`'s unit
  is the tier, so the count is the tier count.
- **c. AD-17** — `coOccur` reads an entry's `lines`; the cohort clause retires. Kind
  agreement retargeted to `ranges`. *"three cross-file checks"* → *"two"*.
- **d. AD-6** — a `null` `statId` is **skipped** by catalogue validation, not failed by
  it; `sync` must not report it as an uncatalogued id, because the two have different
  causes and different owners.
- **e. Consistency Conventions** — the *Bands* row records that tiers overlap freely
  and non-overlap is withdrawn at every scope; *Item level* reads "entry" for "band".
- **f. Structural Seed** — `ModifierWeight` is one tier holding its lines, not a cell in
  a cohort.
- **g. NEW FINDING — the derived interval must be exactly representable.** AD-18
  compares a curator's declared edge against a derived edge for **exact equality** with
  no tolerance, and under `5.0.0` **`core` computes one side by dividing**. Two `#`
  divide by two — exact in binary, lattice on half-integers. **Three or more `#` divide
  by three or more, which is not exact, and every reference against such a line would
  fail edge alignment permanently, with nothing a curator could write to satisfy it.**
  Whether PoE2 publishes such a line is unknown; the producer's measurement counts rows
  by stat *count*, a different axis. Raised as **OQ-19**. **The answer is a contract
  amendment, never an epsilon in `core`** — the same stance revision 6 took on the now-
  withdrawn sum rules.
- **h. Deferred** — three retire (*measured split for value cells*, *`statLineCounts`
  required*, *numeric tolerance on the sum rules*); one is amended (*pricing a
  deliberate conjunction*); **three are added**: consumer-side pro-rating, measuring the
  understatement, and a mechanical guard on a dropped tier or line.
- **Open Questions** — the filter-unit question is amended to record that the unit now
  binds **two parties independently**, and that a disagreement fails loudly as
  edge-alignment errors rather than silently as a wrong population.

### 4.6 PRD §3 — glossary

**Three terms retire outright, with no synonym:** *Value Cell*, *Cohort*,
*`cohortTotals`*.

**Five rewritten:**

- **Modifier Weight** — one tier of one modifier; weight carried once; `lines` with
  per-line `statId | null` and verbatim `ranges`; an entry and a source row are the
  same thing; tiers overlap.
- **Source Modifier** — shortened by roughly two-thirds. *"Under contract 5.0.0 a
  Source Modifier **is** a Modifier Weight entry."* In valuation `core` never reads the
  id at all; it reads it at load, for the duplicate check.
- **Eligible Pool** — two entries may cover one interval, expected rather than
  tolerated; denominator is a plain sum; a partly-covered entry is in the denominator
  and not the numerator.
- **Provenance** — the three-value table.
- **Weights File** — `4.1.0` → `5.0.0`; *"cell edges"* → *"tier value ranges"*.

**Small edits:** *Accepted Tier* (the curator tracks a tier or a run of adjacent
tiers; the `tierLabel` prohibition **retained with a rewritten reason**, because
`5.0.0` makes the join *possible* in the single-tier case and it stays forbidden);
*Stat Line* (completeness has two halves).

**One added:** **`weightSource`** — read for exactly one purpose, and the view never
prints the enum's own words, because `weightSource: "absent"` and Provenance `absent`
would collide on screen.

### 4.7 PRD FR-27, FR-28, FR-29

**FR-27** loses roughly two-thirds of its consequences — both kind-specific shapes,
the producer-must-not-aggregate argument, the `4.1.0` minor-version paragraph, the
entire hard-error list, the two-cohort bound, the two-keys paragraph, the
unscoped-non-overlap paragraph, `statLineCounts`, `cohortTotals`, **all six Exactness
bullets**, and the two-unverifiable-obligations paragraph.

New: the `5.0.0` entry shape; `sourceModifierId` required **and unique within a
slot**; `ranges` verbatim with `core` deriving; the producer must not normalise,
aggregate, split or derive; `statId` may be `null`; `5.0.0` is breaking; the short new
hard-error list; and **"Ten checks retire with `4.x`, and each retires because its
subject is gone rather than because the bar dropped."**

**FR-28** keeps both consumer-side consequences and every producer obligation. New:
completeness has **two halves** (every rollable tier, and every tier's lines); **an
unresolved Stat Line does not make a pool `partial`** and a producer must not treat it
as though it did; and a plain statement that **neither dropped-thing now has a
mechanical check**, which is wider than `4.x`'s gap rather than narrower.

**FR-29** retitled *"…by cell"* → **"…by tier"**. Deleted: the cell framing, `mass(g)`
and `sources(S)`, the affix-draw rationale, the `statLineCounts` asymmetry, **the
entire straddle rule** including its predicate block and floor-invariance paragraph.
New: the lines-based containment table; the collapsed ratio; the partly-covered-tier
rule with its cost, its two bounds and a stated assumption; retargeted edge alignment
with the new mistake it catches; the withdrawal of the straddle rule; two cross-file
checks not three; and the unguarded quiet half of the dropped-line story.

### 4.8 PRD FR-22, FR-16, FR-21, FR-4

**FR-22 — the instruction reverses.** `4.x` forbade writing a tier's own value range
as the band; `5.0.0` **requires** it. Worked example: a curator chasing T8 writes
`56.0 – 80.0`; chasing T7, `43.0 – 56.5`. Each band admits the neighbour's tail into
the priced sample and counts none of its weight, and **neither the search nor the
curator can exclude it**. What the curator must not write is a band that contains one
tier and clips another, e.g. `43.0 – 60.0`. *"Curate to interior cells"* → **"Curate
to a whole tier, or to a run of adjacent tiers."** **Request-budget pressure is
relieved, not added to.** The reversal is written *as* a reversal, because a curator
working from memory would otherwise author exactly the bands the old rule warned
against and be right by accident.

**FR-16** — `coOccur` reads an entry's `lines`; the cohort clause and its explanatory
paragraph retire with no condition lost. Contract reference `4.1.0` → `5.0.0`. Kind
agreement retargeted to `ranges`. The overlap predicate, branch order, both-valueless
branch, `L`-scope clause, four enumerated consequences, shared-floor rule and Raw Base
exemption are **all unchanged**.

**FR-21** — the search shape, four verified traps, even-sample median, sample size and
search-identifier rules are **unchanged**. Two arguments change: the filter unit now
binds **two parties**; and **the homogeneity argument is conceded** — the priced
population is deliberately wider than the weighted one, and what keeps the mismatch
cheap is this FR's own ascending sort plus FR-29's edge alignment. Tagged as an
assumption rather than asserted.

**FR-4** — the coverage fraction, both predicates, the three bands, the recurrence rule
and the published-figure rule are **unchanged**; `poolCoverage` survives `5.0.0`
intact. One clause added: an unresolved Stat Line does not affect coverage.

### 4.9 PRD FR-10, FR-11

**FR-10** — `core` derives Provenance from `weightSource` and nothing else in the file.
**Two render treatments, not three.** The view must not print `weightSource`'s own
words. The propagation rule loses its one exception. A stated assumption records what
the product gives up.

**FR-11** — the banner condition drops to *"no probability carries `measured`"*. **The
badge now discriminates from day one**, which is a change of expectation and a genuine
improvement: `weightSource` varies **per tier**, so a realistic pool carries `measured`
and `uniform-prior` mixed together, where `4.x` expected one label across whole weapon
classes — which is the entire reason FR-11 exists. The old warning retires with the
label it was about; a smaller replacement warning arrives: **do not infer a pool's
Provenance from one tier's**, because the weakest input governs.

### 4.10 PRD frontmatter, §0, §7.2, §7.3, §10, §11

- **Frontmatter:** `revision: 10`, `updated: 2026-09-19`, `sources` gains this document.
- **§0 banner:** three new paragraphs — what changed and why; **what it costs**, stated
  so a shorter document does not read as a better one; and the OQ-19 finding.
  **33 FRs remain; no FR added, removed or renumbered. FR-29 is retitled. §7.1 In Scope
  is unchanged.** Spine to revision 10, amending nine ADs, **29 remains the total**.
- **§7.2:** two retire; one amended; **three added** — consumer-side pro-rating,
  measuring the understatement, a mechanical guard on a dropped tier or line. The three
  are deliberately sequenced: the measurement is cheap and gates the other two.
- **§7.3:** *"A third breaking contract revision has landed, and this one **reduces**
  what the producer must build."* The second gate has widened and a third has appeared.
- **§10:** *"Two items are open: OQ-12 and OQ-19."* OQ-12 amended; **OQ-19 added**.
- **§11:** four assumptions added, one amended.

### 4.11 UX spines

**11 live passages.** `.memlog.md`, `review-*.md` and `.working/` are left untouched —
they record what was decided on 2026-09-13 and were true when written.

**Mechanical (10 edits):** delete `{colors.slate}` and its token; delete the
`trust-mark-split` component; delete the slate row from the semantic-ink table; *"slate,
ochre"* → *"ochre"* in the mark ramp; drop `trust-mark-split` from both mark
enumerations; *"Six marks exist. A seventh needs a decision."* → **five / sixth**; drop
`modelled-split` from the enum list and the gloss list; delete row 12 of the state table
and renumber; *"which slot's pool has no cell"* → *"no entry for that stat"*; and update
the back-end-only vocabulary list — remove `Value Cell`, `Cohort`, `cohortTotals`,
`statLineCounts`; add `weightSource`, `lines`, `ranges`.

**Carrying an argument (4 passages):** the Provenance table becomes three values with a
paragraph recording that a fourth existed and **was removed rather than merged**,
because merging it into `prior only` would have understated a measured weight; the
propagation sentence loses its exception; the banner condition drops to `measured`
alone, with a note that the banner is now expected to be **rare** and the per-row mark
to earn its place immediately.

**Routed to the UX designer — not decided here.** Eight passages state **"three
semantic inks"** as a design principle, not an enumeration, and memlog 41 records it as
a decision. Mechanically it becomes two. **Recommendation: two inks, stated as two** —
`DESIGN.md` 694 reading *"Two semantic inks. There are two, and a third is not
available,"* with a sentence recording that a third existed for `modelled-split` and
retired with it, so the count reads as a consequence rather than a drift. The
alternative — reserving the freed slot, perhaps for the live `[NOTE FOR UX]` that
`pinned` has no visual treatment — is a design judgement this proposal does not make.
PRD revision 9 set the precedent for routing exactly this kind of item to the designer.

### 4.12 `WEIGHTS-FILE-SCHEMA.md`

- **Frontmatter:** `status: draft` → **`final`** (precedent: revision 5 raised `4.0.0`
  *"and to `status: final`"* in the round that adopted it). `updated: '2026-09-19'`.
  `governed_by` gains **AD-17**, which owns `coOccur` and kind agreement and was already
  missing.
- **The producer-side-draft callout is replaced by an authoritative-copy callout**
  recording adoption on 2026-09-19 and pointing at this document.
- **The gitignore claim is corrected** — the file is committed here, and the full
  `2.0.0`–`4.1.0` text is recoverable from this repository's git history, with the
  adoption commit as the boundary.
- **The *Repository placement* section** now states that this repo owns the document and
  that a producer's working copy is a proposal with no effect. The shared-package split
  stays **Deferred**: extract once the schema stops moving, and `5.0.0` is the third
  breaking revision in seven days.
- **One hard error added:** a duplicate `statId` among one entry's `lines`. Malformed by
  construction; consumer harm is small; cheap to reject; makes `lines.length` mean what
  the contract says.
- **One *Not a file error* bullet amended** to state that the consumer **does not**
  derive disjoint intervals — a producer need not make tiers separable and must not
  merge or trim them to try.
- **A producer-facing note on line arity** puts **OQ-19** in front of the party that can
  answer it, since the contract is what the producer's owner actually reads.

---

## 5. Implementation Handoff

### 5.1 Scope classification: **Major**

Not because the change is large to execute, but because it amends nine architecture
decisions, re-gates an external release dependency, and reverses a curation
instruction. Under the checklist's own definition that is Product Manager / Solution
Architect territory, not a direct developer hand-off.

### 5.2 Routing

| Recipient | Deliverable | Responsibility |
| --- | --- | --- |
| **Solution Architect** | `ARCHITECTURE-SPINE.md` → revision 10 | §4.1–4.5. Nine ADs amended in place, no AD added or renumbered — **29 remains the total**. Plus Consistency Conventions, Structural Seed, Deferred, Open Questions. **AD ids stay stable.** |
| **Product Manager** | `prd.md` → revision 10 | §4.6–4.10. **33 FRs remain**; FR-29 retitled; **§7.1 unchanged**. The §0 banner must carry the cost paragraph, not only the change paragraph. |
| **Solution Architect** | `WEIGHTS-FILE-SCHEMA.md` | §4.12. Contract stays at `5.0.0`; only placement, status and the two additions change. |
| **UX Designer** | `DESIGN.md`, `EXPERIENCE.md` | §4.11. The 10 mechanical edits and the 4 argued passages are approved. **The "three semantic inks" question is the designer's own call**, with a recommendation attached. |
| **Human (player)** | `spec-contracts-accepted-tier-and-search-id.md` | §2.2. The `<frozen-after-approval>` bullet naming `4.1.0` needs renegotiation; approval of this proposal is that renegotiation. |
| **Developer** | Same spec, Code Map | §2.2. The *Authority* line → rev 10 / rev 10. Outside the frozen block. |

### 5.3 Sequencing

1. **Spine first.** The PRD inherits it and every FR edit cites an AD.
2. **PRD second.**
3. **Contract and UX spines in parallel**, after the spine — both cite ADs.
4. **Story spec last**, once both revision numbers exist to cite.

### 5.4 Success criteria

- No occurrence of *Value Cell*, *Cohort*, *`cohortTotals`*, *`statLineCounts`*,
  *`modelled-split`*, *straddle* or *`provenance` field* survives in `prd.md`,
  `ARCHITECTURE-SPINE.md`, `DESIGN.md` or `EXPERIENCE.md` except where explicitly
  retained as a record of a retirement.
- Every `(AD-n)` citation in `prd.md` still resolves. **AD ids are stable**, so no
  citation should go stale; a broken one means an AD was renumbered in error.
- `prd.md` still contains exactly **33 FRs**, numbered FR-1 … FR-33.
- `ARCHITECTURE-SPINE.md` still contains exactly **29 ADs**, numbered AD-1 … AD-29.
- `prd.md` §7.1 is byte-identical to revision 9.
- `sync`'s cross-file gate is described as **four** checks in AD-12, AD-17, AD-18,
  FR-14, FR-16 and FR-29 — with no surviving "five".
- **OQ-19** appears in `prd.md` §10, `ARCHITECTURE-SPINE.md` Open Questions, and
  `WEIGHTS-FILE-SCHEMA.md` *Producer expectations*.

### 5.5 Open items this proposal does not close

| Item | Owner | Blocking? |
| --- | --- | --- |
| **OQ-12** — which quantity the trade filter compares for a multi-`#` stat | Weights scraper project | Correctness, not building |
| **OQ-19** — does any single stat line carry three or more `#`? | Weights scraper project | Correctness, for affected bases only |
| **The understatement's size** | §7.2, revisit when the first conforming file lands | No |
| **"Three semantic inks"** | UX Designer | No |
| **`acceptedTier`'s continued necessity** now that tiers are visible in the file | Deliberately **not** raised this round — a new decision, not a consequence of `5.0.0` | No |

---

## 6. Checklist Record

| § | Item | Status |
| --- | --- | --- |
| 1.1 | Triggering story | **N/A** — no stories in flight; trigger is an external contract revision |
| 1.2 | Core problem defined | **Done** — technical limitation raised by the producer, plus a player decision on ownership |
| 1.3 | Evidence gathered | **Done** — §1 |
| 2.1–2.5 | Epic impact | **N/A** — no epics exist; no `sprint-status.yaml` |
| 3.1 | PRD conflicts | **Done** — heavy; §2.3, §4.6–4.10 |
| 3.2 | Architecture conflicts | **Done** — heavy; §2.3, §4.1–4.5 |
| 3.3 | UI/UX conflicts | **Done** — moderate; the "no UX impact" premise was tested and **failed** on Provenance |
| 3.4 | Other artifacts | **Done** — contract file (4 defects), one story spec (2 edits), `CLAUDE.md` and `AGENT-WORKFLOW.md` clean |
| 4.1 | Option 1, Direct Adjustment | **Viable — selected.** Effort High, risk Low |
| 4.2 | Option 2, Rollback | **Not viable** — nothing built to roll back |
| 4.3 | Option 3, MVP review | **Not required** — §7.1 unchanged |
| 4.4 | Path selected | **Done** — §3 |
| 5.1–5.5 | Proposal components | **Done** — §1–§5 |
| 6.1 | Checklist reviewed | **Done** |
| 6.2 | Proposal verified | **Done** |
| 6.3 | User approval | **Done** — all 12 proposals approved individually, and the compiled document approved 2026-09-19 |
| 6.4 | `sprint-status.yaml` updated | **N/A** — file does not exist; sprint planning has not run |
| 6.5 | Handoff confirmed | **Done** — routed per §5.2, sequenced per §5.3 |
