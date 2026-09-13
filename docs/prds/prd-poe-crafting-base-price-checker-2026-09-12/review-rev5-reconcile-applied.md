# Reconcile review — Revision 5 proposals (C-53…C-77) as applied

**Input:** `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/PRD-EDIT-PROPOSALS.md` §22–§31 (C-53 … C-77, twenty-five items).
**Targets:** `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md` (868 lines) and `.../addendum.md` (135 lines), as they stand on `master`, working tree.
**Date:** 2026-09-13.

## Verdict counts

| Verdict | Count |
| --- | --- |
| LANDED | 24 |
| PARTIAL | 1 (C-75) |
| MISSED | 0 |
| SUPERSEDED | 0 |

---

## 1. The six deliberate checks

### C-53 — branch order and the three carried clauses — **LANDED**

`prd.md:360–365` states the predicate with the co-occurrence branch **above** the inequality case:

```
slotOverlap(x, y) =  true              if x is absent or y is absent
                     true              if x.statId != y.statId ∧ coOccur(x, y)
                     false             if x.statId != y.statId
                     true              if both are valueless
                     bands intersect   otherwise
```

The order is correct and the PRD says so explicitly at `prd.md:367` ("Branch order is load-bearing… because it is precisely a pair of references on *different* `statId`s that it has to catch"), which is more than the proposal asked for and is the right addition — a builder reformatting the table cannot silently reorder it.

All three carried clauses are present and each in its own consequence:

- **Definition** — `prd.md:369`: `coOccur(x, y)` holds when some `sourceModifierId` in the scoped Eligible Pool emits an entry contained by `x` **and** one contained by `y`, in the same item-level cohort. The cross-file ownership (`core` at load, like FR-29's straddle and edge-alignment rules) is at `prd.md:371`, with the reporting target named (against the tracked entry, not either file).
- **Scope `L`** — `prd.md:370`: "Its scope `L` is the Base Type's own crafted Item Level Floor — the same `L` that scopes every probability on the base, and FR-16 and FR-22 give a Base Type exactly one."
- **Pool cannot answer** — `prd.md:372`: all three unanswerable cases enumerated (absent from the Weights File, `partial` pool, uniform-prior bootstrap), `coOccur` is `false`, **the Tracked List still loads**, with FR-28/FR-4's Unrankable argument for why the partition is never summed, and the explicit "one builder short-circuits and renders while another rejects `data/tracked.json` site-wide" rationale the proposal asked be stated.

Knock-on C-70 landed with it: `prd.md:374` now reads "Four consequences follow" and `prd.md:378` carries the fourth — two entries in *one* slot naming two stat lines of one Source Modifier.

### C-54 — `mass(g)` with no `L` subscript — **LANDED, and correctly**

`prd.md:625` gives the denominator as:

```
Σ { mass(g) : g ∈ sources(scoped(base, slot, L)) }
```

`prd.md:628` defines `sources(S)` and `mass(g)`, and states in bold: "**`mass(g)` carries no `L`.**" with the reason (a source row is one tier, sits in exactly one cohort, so a group is admitted whole or not at all).

**No occurrence of `mass(g, L)` exists anywhere in `prd.md` as a specification.** The single occurrence of the string is at `prd.md:818`, inside the new **OQ-16**, where it is quoted as the *spine's* stale spelling being raised back against architecture. That is a legitimate use, not a defect: the PRD names AD-18's un-subscripted form as the one it follows and explicitly says "FR-29 is the copy to build to". No defect to flag.

`mass(g)` does not appear in `addendum.md` at all.

### C-56 — cohort-carriage key — **LANDED, with the narrowing correctly refused**

`prd.md:586` states the carriage error as "**a cell carried by more than two cohorts**, counted per **`(base, slot, statId)`** across **every** Source Modifier publishing that stat." The reconcile review's proposed narrowing to `(base, slot, statId, sourceModifierId)` was **not** applied.

The PRD states **why** the two keys differ, at `prd.md:587`, as its own consequence bullet: non-overlap is narrowed by `sourceModifierId` so two modifiers' mass stays separable; the carriage bound is not, because a source row is one tier and so has exactly one Cohort, so a per-row count could never exceed 1 and the check would be **vacuous** — "silently disarming AD-28's only mechanical defence against a partition cut too coarsely."

The other three corrections in C-56 also landed: the duplicate key at `prd.md:576` is `(sourceModifierId, statId, kind, valueMin, valueMax, itemLevelMin)`; non-overlap at `prd.md:577` is scoped by `sourceModifierId` as well as `itemLevelMin`, with the merge-would-destroy-the-marker reason; the missing-`sourceModifierId` error is at `prd.md:580`; the group-consistency error is at `prd.md:585`.

### C-57 — surviving 3.0.0 current-version citations — **LANDED, none survive**

Every current-version claim reads **4.0.0**: `prd.md:20` (§0), `prd.md:93` (§3 *Weights File*), `prd.md:569` and `prd.md:572` (FR-27, both), `prd.md:770` (§7.3). FR-27's refusal clause at `prd.md:569` is widened correctly: "A producer building to a 1.x, 2.x or 3.x shape emits a file that `core` refuses (schema **4.0.0**, breaking)."

Every surviving mention of 2.0.0 or 3.0.0 is historical and reads as such:

| Line | Text | Legitimate? |
| --- | --- | --- |
| `prd.md:24` | "BQ-2 by … Weights File schema 2.0.0" | yes — §10 rev-2 record |
| `prd.md:567` | "A producer building to the 3.0.0 tuple emits a file `core` refuses at load" | yes — that is the point of the breaking change |
| `prd.md:588` | "through 3.0.0 it listed the row as a hard file error, and 4.0.0 removes it" | yes — the OQ-14 record |
| `prd.md:589` | "The unscoped non-overlap rule of schema 2.0.0 would refuse a conforming 4.0.0 file" | yes |
| `prd.md:770` | "The contract moved 3.0.0 → **4.0.0**, so a 3.0.0 file in flight is refused at load" | yes — C-69's own text |
| `prd.md:823` | OQ-14: "Through 3.0.0 the contract listed…" | yes — §10 record |
| `prd.md:844` | BQ-2: "Weights File schema 2.0.0 — 4.0.0 at the current revision" | yes — the "current revision" half was updated |
| `addendum.md:45,49,117` | "schema 2.0.0" / "as of 2.0.0" | yes — records of what landed at spine rev 2 |

No stale current-version claim anywhere.

### C-63 — the revision-3 list — **LANDED, nine ADs including AD-24**

`prd.md:826`: "**Revision 3** amended **AD-9, AD-11, AD-12, AD-18, AD-19, AD-21, AD-24, AD-26 and AD-27** in place — **nine** — and added no decision." AD-24 is present and the count is stated explicitly, which is the cheap defence against the same omission recurring.

The rev-4 list (`prd.md:827`) is unchanged and still correct; the rev-5 list (`prd.md:828`) matches §22's table exactly. `prd.md:830` carries the "correction, not simply a retirement" framing and the reason it surfaced (the spine went back to `.memlog.md` rather than copying the PRD). OQ-15 is moved to the resolved band.

Arithmetic check on C-60's recomputation, at `prd.md:20`: "Across revisions 3, 4 and 5 together, fifteen decisions have been amended in place." The union of the three lists is AD-5, 6, 9, 10, 11, 12, 16, 17, 18, 19, 21, 24, 26, 27, 28 — **fifteen distinct**. Correct.

### C-77 / C-64 — FR-23's precision and the `[NOTE FOR PM]` — **both LANDED**

`prd.md:512`: "Persisted Divine prices are rounded to **4 decimal places**, once, and `core` never re-rounds." `prd.md:513` carries the reversal's reason with the number, in the proposal's own terms — precision pinned by the cheapest persisted value, the cheap-orb-rounds-to-`0.00` chain through FR-26's Craft Cost to FR-1's subtraction becoming a silent no-op, and the "a future coarsening would have to exempt `CurrencyRate` deliberately" clause.

**The `[NOTE FOR PM]` claiming to supersede the spine is gone.** The two surviving `[NOTE FOR PM]` callouts in the document are at `prd.md:429` (FR-18, Risk R-2) and `prd.md:756` (§7.2 coarser fallback pricing); neither is FR-23's and neither claims to supersede anything. `prd.md:22`'s description of the callout convention is untouched and still accurate.

C-77's knock-on also landed: FR-21's median consequence at `prd.md:471` now reads "each listing is normalised and rounded once on the way in (FR-23), so choosing one of them cannot leave the grid, where a mean could — **an argument that holds at any precision, which is why it is stated without reference to the number**." The "FR-23's 2-decimal grid" reference is gone and the argument is decoupled from the figure, exactly as §29 asked.

C-61 landed with it at `prd.md:822`: OQ-13 is in the *resolved by spine rev 5* band, marked "RESOLVED, against this PRD", names it as the one item of the eight where the PRD changes and the spine does not, and **retains OQ-13's own argument** ("four decimals genuinely do exceed what an asking-price estimate carries. It simply does not set the precision") as C-61 required.

---

## 2. Item-by-item verdicts

### §25 Severe

| Id | Verdict | Where | Note |
| --- | --- | --- | --- |
| **C-53** | LANDED | `prd.md:360–372` | see above; branch order correct, all three clauses present |
| **C-54** | LANDED | `prd.md:622–629` | `mass(g)` un-subscripted; numerator over entries / denominator over source modifiers split into its own bolded consequence; the "invisible to any single-stat test" reason carried in full at `prd.md:629` with the 560-of-8,437 figure |
| **C-55** | LANDED | `prd.md:90` (§3 *Modifier Weight*), `prd.md:566–567` (FR-27) | both shapes carry `sourceModifierId`; **required on every entry of both kinds** stated in both places with the one-identity-notion reason |
| **C-56** | LANDED | `prd.md:576, 577, 580, 585, 586, 587` | all four corrections; the review's narrowing correctly refused; the why-the-keys-differ paragraph present |
| **C-57** | LANDED | `prd.md:20, 93, 569, 572, 770` | no surviving current-version 3.0.0 claim |
| **C-58** | LANDED | `prd.md:96` | §3 *Eligible Pool*: "The scoped pool is the **domain the denominator is computed over** — not the denominator itself: the denominator is the sum of the **Source Modifier masses** within that domain, counting each modifier once, never the sum of its cells" |

### §26 High

| Id | Verdict | Where | Note |
| --- | --- | --- | --- |
| **C-59** | LANDED | `prd.md:91` | new §3 **Source Modifier** entry. Carries every clause C-59 listed: one row, one spawn weight, several trade stats rolled as a unit; one entry per stat line at **full** weight; required on every entry (a single-stat row is "a group of one"); **one source row — one *tier* of one modifier, never a family**; exactly one Cohort; producer-assigned, opaque, stable within one `(Base Type, slot)`, never validated against the Trade Catalogue; **never part of a Modifier Reference, a Tracked Entry, or its canonical key**; and the two purposes `core` reads it for. Sequenced first, as §30 required — every downstream FR uses the term verbatim |
| **C-60** | LANDED | `prd.md:20` | revision 5, AD-1…AD-29, contract 4.0.0, AD-29 named with its one-line content, the nine amended ADs listed, arithmetic recomputed to fifteen (verified above), **AD-id stability claim retained verbatim** |
| **C-61** | LANDED | `prd.md:822` | see above |
| **C-62** | LANDED | `prd.md:823` (OQ-14 resolved), `prd.md:588` (FR-27) | FR-27's "disagrees" clause **inverted**, not merely deleted: "**`WEIGHTS-FILE-SCHEMA.md` agrees**: through 3.0.0 it listed the row as a hard file error, and 4.0.0 removes it… The disagreement this consequence used to record is closed (§10 OQ-14)." The rejected alternative (file-refusal needing AD-24 amended for a ninth artifact) is recorded at `prd.md:823` |
| **C-63** | LANDED | `prd.md:824–830` | see above |
| **C-64** | LANDED | FR-23, `prd.md:503–513` | note deleted; no residue |
| **C-65** | LANDED | `prd.md:600` | FR-28: "**Completeness counts stat lines, not rows.**" with the 560-rows argument and — beyond what C-65 asked — the observation that this shrinks numerators without touching the denominator and is "the one direction the source-modifier denominator does **not** protect against". A correct and useful addition |

### §27 Medium

| Id | Verdict | Where | Note |
| --- | --- | --- | --- |
| **C-66** | LANDED | `prd.md:71` | §3 *Modifier Reference*: "**It names a stat line, not a game modifier.**" with the curator-can-only-filter-on-what-trade-exposes reason and the explicit "this is why `sourceModifierId` is never part of a Modifier Reference, a Tracked Entry, or a Tracked Entry's canonical key" |
| **C-67** | LANDED | `prd.md:132` | FR-1: "**The partition this sum rests on breaks in two non-obvious ways, not one.**" — band intersection and co-occurring stat lines, with the reason it belongs at FR-1 (this is where `ΣP ≤ 1` is asserted) |
| **C-68** | LANDED | `prd.md:755` | §7.2 Deferred: *Pricing a deliberate conjunction of co-occurring stats*, with the "why FR-16 rejects a configuration a curator will plausibly try" framing |
| **C-69** | LANDED | `prd.md:770` | §7.3: second breaking revision named, both costs to the producer named (`sourceModifierId` on every entry, group consistency), and the "this PRD is the document that project's owner reads for the version number" justification |
| **C-70** | LANDED | `prd.md:374, 378` | three consequences → four; fourth case stated as "the same failure as the case above, reached from the other direction" and attributed to the `coOccur` branch |
| **C-71** | LANDED | `prd.md:501` | FR-22: two references naming two stat lines of one Source Modifier cannot both be tracked in one slot; explicitly "a **load-time rejection, not a budget question**"; routes to the §7.2 deferral |

### §28 Low

| Id | Verdict | Where | Note |
| --- | --- | --- | --- |
| **C-72** | LANDED | `prd.md:26` | "**Three further rounds have since closed**" with a revision-5 sentence mirroring the rev-3 and rev-4 ones, carrying the 560-of-8,437 measurement and AD-29's answer |
| **C-73** | LANDED (adapted) | `prd.md:808` | narrowed, but to **two** items rather than one: "**Two items are open: OQ-12 and OQ-16.** OQ-12 is the only one owned outside this repository; OQ-16 is a one-line spelling conflict inside the spine, raised by this revision." The adaptation is forced by the applier's own new OQ-16 (see §4 below) and is handled correctly — the sentence still distinguishes the externally-owned item, which is what C-73 was protecting |
| **C-74** | LANDED | `prd.md:70` | §3 *Base Type*: the flat-ids rule now says "**The rule governs ids the trade API exposes**", and names the `sourceModifierId` carve-out with the reason (it names a thing the trade API has no concept of, so it re-encodes nothing) |

### §29 New requirements

| Id | Verdict | Where | Note |
| --- | --- | --- | --- |
| **C-75** | **PARTIAL** | `prd.md:92` landed; `prd.md:568` contradicts it | see below |
| **C-76** | LANDED | `prd.md:403` (FR-17), `prd.md:84` (§3 `lastAttemptedAt`) | FR-17: "The ordering key is the **absent timestamp**, never the `not-yet-synced` Price State: FR-12 and AD-9 have decoupled the two, and FR-23 writes `not-yet-synced` with reason `no-exchange-rate` for an entry that *was* attempted and carries a perfectly fresh `lastAttemptedAt`", with the monopolise-the-rotation starvation argument. §3's `lastAttemptedAt` entry keys the same way ("It is **absent on an entry no request has ever been issued for** — the `never-synced` case — which is the one row with no age at all and the reason FR-17 treats such an entry as infinitely old"). FR-12 at `prd.md:302` agrees and adds the no-placeholder rule. Both surfaces C-76 named were fixed |
| **C-77** | LANDED | `prd.md:512–513`, knock-on at `prd.md:471` | see above |

#### C-75 — PARTIAL

**What landed.** `prd.md:92` (§3 *Cohort*) is edited exactly as proposed: emission is per **`(tier, cell)`**; "**The emission is per tier, not per cohort**" is stated with C-75's own argument (a tier *is* a source row, an entry names exactly one, so a per-cohort entry would have to name two source rows or discard one and destroy a co-occurrence marker); the weight is "`w(t) × P(value ∈ c | t)` for **its own tier**, never a sum across the cohort"; cohorts survive as `itemLevelMin`-**equality** groupings, with `cohortTotals` named as the reason.

**What is absent.** The FR that a producer actually builds to still states the superseded rule. `prd.md:568`, FR-27:

> **Producers must not normalise, and must not pre-aggregate *cells*.** The word *cells* matters, because AD-28 requires something that looks like pre-aggregation and is not: a cell's weight is the **conserving sum of the mass its cohort's tiers contribute to it**, and performing that summation is the producer's job. Aggregating **across tiers into a cell** is mandatory; aggregating **across cells** is forbidden, because `core` sums cells and only cells.

This is the per-cohort emission C-75 removes, stated as a producer obligation and stated as **mandatory**. A producer reading FR-27 — the requirement written for it, and the one §7.3 points its owner at — emits one entry per `(cohort, cell)` with the cohort's tiers summed into it, which is precisely the shape C-75 says is unrepresentable where two tiers share a cohort. §3 *Cohort* and FR-27 cannot both be built to.

The fix is a rewrite of that bullet in FR-27's terms: aggregating **across cells** remains forbidden; what is mandatory is distributing one tier's weight across the cells it reaches (`w(t) × P(value ∈ c | t)`), not summing a cohort's tiers into a cell. The trailing "`core` sums cells and only cells" also needs restating — `core` sums *entries*, and after C-75 a cell may carry several.

Two lower-severity residues of the same root, both wording rather than instruction:

- `prd.md:94` (§3 `cohortTotals`) — "`core` validates that a cohort's emitted **cells** sum to it". Under per-tier emission a cohort with two tiers emits two entries per cell; the check is over emitted **entries**. The arithmetic is unchanged, so this reads correctly to someone who already knows; it misleads someone who does not.
- `prd.md:90` (§3 *Modifier Weight*) — "a **cell** may hold mass from more than one tier and may not correspond to a single tier at all." Defensible if *cell* is read as the value interval (which several tiers may reach), but the sentence sits immediately above the entry tuple, where the natural reading is *entry* — and an entry now holds exactly one tier's mass. Worth a clause separating the interval from the entry.

---

## 3. Contradictions introduced by these edits

**One substantive contradiction, and it is C-75's.** §3 *Cohort* (`prd.md:92`) and FR-27 (`prd.md:568`) state opposite producer obligations. §0 declares §3 normative for every FR using its terms, so on that rule §3 wins — but FR-27 is what §7.3 sends the external producer to read, and it states the losing rule as mandatory. Detailed above under C-75.

The two wording residues at `prd.md:90` and `prd.md:94` are the same root at lower severity and are listed there rather than repeated here.

**No other contradiction found.** Specifically checked and clean:

- **FR-16's `coOccur` vs §3 *Source Modifier*.** FR-16 qualifies co-occurrence with "in the same item-level cohort", while §3 says a group sits in exactly one Cohort. The qualifier is therefore automatically satisfied rather than contradicted — redundant, not wrong, and it is the proposal's own wording. No action.
- **FR-29's `mass(g)` vs OQ-16.** OQ-16 quotes AD-29's `mass(g, L)` as a *spine* defect and states that the PRD follows AD-18, naming FR-29 as the copy to build to. That is a raised item, not a competing specification.
- **§0's "Nothing in §4 is gated on a pending amendment"** (`prd.md:24`) vs the newly-open OQ-16. OQ-16 states in its own body that nothing is ambiguous to build. Consistent.
- **§0's "One question on that dependency is open by design"** (`prd.md:28`) vs "Two items are open" (`prd.md:808`). §0's sentence is scoped to the *data dependency*, where OQ-12 is indeed the only open item. Consistent.
- **FR-27's "at most two cohorts" check** (`prd.md:586`, `prd.md:591`) vs C-56's key. Both say `(base, slot, statId)` across every Source Modifier. Consistent.
- **FR-29's numerator over entries** vs per-tier emission. With two tiers emitting into one cell, a containing reference sums both entries — which is the mass it should carry. Consistent.
- **FR-23's 4 dp** vs every other precision mention. No 2-decimal claim survives outside the OQ-13 record, where it is explicitly the reverted call.

---

## 4. Edits present that correspond to no C-item

Listed so they can be checked rather than assumed. All are in the rev-5 pass; none is a defect on its face, but none was proposed.

1. **§10 OQ-16 is new** (`prd.md:818`, plus the §10 preamble at `prd.md:808` and the new heading *"Open — raised against the spine by this revision"* at `prd.md:816`). The PRD raises back against the spine that **AD-18 writes `mass(g)` while AD-29 still writes `mass(g, L)`**, declares that it follows AD-18, names FR-29 as the copy to build to, assigns the owner as architecture, and likens it to the retired OQ-11. This is the PRD doing what §23 records it did last round, and it is the direct consequence of C-54's correction — the proposal told the PRD to use the un-subscripted form but did not say what to do about the spine decision that still carries the other. Raising it is the right call. **Worth confirming with architecture** that AD-29's spelling is in fact still `mass(g, L)`; if the gate pass already fixed it, OQ-16 should close immediately and §10's "Two items are open" reverts to C-73's literal "only OQ-12".
2. **`addendum.md` is revised throughout, and no C-item targets it at all.** Front matter moves revision 2 → 5, updated 2026-09-13. Substantive additions: a "Moved again by spine revision 5" note closing BQ-2 (`addendum.md:121`), which states the scoped-pool-as-domain / denominator-as-source-modifier-masses split and correctly says item-level scoping is undisturbed; a "Narrowed by spine revision 4" note on BQ-1 (`addendum.md:104`); and a "One factual claim above has since gone stale" note on BQ-1 (`addendum.md:106`) retracting the analysis's claim that the Weights File models bands "non-overlapping, straddling forbidden" — non-overlap is now doubly scoped (`itemLevelMin`, `sourceModifierId`) and straddling is a cross-file condition, not a file error. Both are accurate against the current PRD. The ToC gains a fourth bullet and the landing-note convention is restated to cover second notes. The rest is copyediting (Realizes → Realises, "commoner" → "more common", "they" → "he", "tracked list" → "Tracked List"). **All substantively consistent with the PRD; flagged only because nothing proposed them.**
3. **§0's arithmetic sentence was rewritten rather than adjusted** — "further thirteen decisions" became "Across revisions 3, 4 and 5 together, fifteen decisions have been amended in place" (`prd.md:20`). C-60 asked for the arithmetic to be recomputed and did not fix the phrasing; the count is correct (verified above), and the new phrasing names the three rounds it aggregates, which the old one did not.
4. **Capitalisation and terminology sweep across `prd.md`** — "tracked list" → "Tracked List", "base type" → "Base Type", "ilvl" → "item level", "Realizes" → "Realises" in FR headings and bodies (`prd.md:122, 136, 168` and others). Glossary discipline under §0, but unproposed.
5. **§10's section title** moved from "Resolved Defects and Open Questions" to "**Open Questions and Resolved Defects**" (`prd.md:806`), with the live-items-first preamble. Consistent with C-73's intent; not itself proposed.

Note that items 3–5, and parts of 2, may have landed in the revision-3 or revision-4 passes rather than this one — `HEAD` is the PRD at revision 2, so the working-tree diff spans all three rounds and cannot separate them. They are listed here because they are visible in the current text and traceable to no C-item in C-53…C-77.

---

## 5. Recommended action

One edit closes the only PARTIAL and the only contradiction: rewrite `prd.md:568` so FR-27's producer obligation matches §3 *Cohort* — an entry distributes **one tier's** weight across the cells it reaches (`w(t) × P(value ∈ c | t)`); aggregating **across cells** stays forbidden; `core` sums **entries**, and a cell may carry more than one. Touch `prd.md:94` and `prd.md:90` in the same pass so "cells" and "entries" stop being used interchangeably now that they have come apart.

Everything else in C-53…C-77 is landed and internally consistent.
