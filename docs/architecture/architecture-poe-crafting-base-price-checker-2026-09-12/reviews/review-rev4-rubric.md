---
title: 'Rubric Walker — Revision 4'
lens: rubric-walker
target: ARCHITECTURE-SPINE.md (revision 4, 28 ADs) + WEIGHTS-FILE-SCHEMA.md 3.0.0 + AGENT-WORKFLOW.md
date: '2026-09-13'
verdict: revise
---

# Rubric Walker — Revision 4

**Verdict: revise.** One critical, five high, four medium, four low.

Revision 4's diagnosis is the strongest work in this document set. The memlog entry that separates the *invariant* (AD-18's straddle rule) from its *proxy* (non-overlap) is the reasoning the whole revision rests on, and the spine carries it correctly into AD-5, AD-11, AD-18 and AD-28. The decomposition itself is right, the `valueless` union closes a sentinel hole the spine had already been burned by once, and the fourth provenance value is decided for the right reason.

What is missing is enforcement. AD-28 names mass conservation as *the* invariant and then leaves it with no checker anywhere in the system — the one class of defect this spine has, in three prior revisions, consistently refused to tolerate ("fails CI, not review" — AD-2; "measured, not assumed" — AD-27). Two smaller problems follow from the same seam: AD-28's stated rationale for a global partition does not deliver what it claims about AD-18's edge-alignment rule, and the Deferred entry for a measured split promises a provenance value both AD-28 and the contract forbid.

---

## Critical

### C-1 — Mass conservation is declared the invariant and is unenforceable by any component

`ARCHITECTURE-SPINE.md:500`, `WEIGHTS-FILE-SCHEMA.md:94–104`, `WEIGHTS-FILE-SCHEMA.md:209–219`

AD-28 states: *"Mass conservation is the invariant; the split estimator is not. For every tier, `Σ over cells of its split == w(t)` exactly."* The contract repeats it as the property that "leaves the base's denominator and every tracked reference's total exact".

Nothing can check it. The file carries cells; it does not carry `w(t)`, the per-tier weight the sum is supposed to equal, nor any per-family total, nor the tier membership of a cell (`tierLabel` is explicitly display-only and `core` "must never branch on it" — `WEIGHTS-FILE-SCHEMA.md:201`). The hard-error list at `WEIGHTS-FILE-SCHEMA.md:209–219` contains no conservation check, and AD-18's three validations (containment, edge alignment, straddle) are all insensitive to it: a file whose splits sum to `0.7 × w(t)` for one family passes every one of them.

**Divergence permitted:** two producers both claiming conformance — one conserving, one dropping or duplicating mass through an off-by-one on a half-open cell boundary — hand `core` different denominators for the same base. Every probability on that base is scaled by a factor that varies per base, which is precisely the "reorders the ranked list rather than shifting it uniformly" failure AD-18:328 was written to prevent, and precisely the "confidently wrong ranking from a truncated denominator" failure the pool-completeness rule exists to prevent. Provenance does not reveal it: `modelled-split` is stamped on conserving and non-conserving splits alike, so the view renders both identically.

This is the same structural error AD-27 was created to fix for coverage — an invariant on which the product's correctness turns, stated as a producer's obligation with no consumer-side measurement. The fix does not require much: a per-`(baseTypeId, slot, statId)` family total (or a per-tier residual) emitted by the producer and re-summed by `core` at load makes the invariant checkable at the cost of one number per family. Absent that, AD-28's Rule is advice, not a rule, and the spine should say which it intends.

---

## High

### H-1 — AD-28's global-partition rationale does not deliver what it claims about AD-18's edge-alignment rule

`ARCHITECTURE-SPINE.md:492` vs `ARCHITECTURE-SPINE.md:303–310`; `WEIGHTS-FILE-SCHEMA.md:70`

AD-28 step 1 justifies cutting the value axis once over all tiers rather than per cohort: *"so that a reference that is cell-aligned at one floor is cell-aligned at every floor. A per-cohort partition would let AD-18's edge-alignment pass at one entry's floor and fail at another's."*

A global partition makes **straddling** floor-invariant. It does not make **edge alignment** floor-invariant, because AD-18 defines edge alignment over the containment set *under the scope*:

```
ref.valueMin == min { band.valueMin : band ∈ contained }
ref.valueMax == max { band.valueMax : band ∈ contained }
```

and `contained` is scoped by `band.itemLevelMin <= entry.itemLevelMin`. Worked against the contract's own Bows table (`WEIGHTS-FILE-SCHEMA.md:82–92`): a reference `[56, 80]` at floor 65 contains cohort-60 and cohort-65 cells and aligns (min 56, max 80). The identical reference at floor 60 contains only the cohort-60 cell `[56, 56.5]`, so `max = 56.5 ≠ 80` and it is a validation error. Cell-aligned at both floors; edge-aligned at only one.

**Divergence permitted:** two builders read AD-28's promise and AD-18's formula as the same rule and implement different validators — one checking "every edge falls on a global cell boundary" (floor-invariant, accepts `[56,80]` at floor 60), one checking the scoped min/max (rejects it). The first reintroduces a reference whose priced population (an `ilvl>=60` search for `min 56 max 80`) is strictly wider than the population `core` sums weight for, which is BQ-1's shape re-entering through the cohort axis. AD-17's uniform-floor-per-base rule limits but does not remove the exposure, since the same reference is legal on one base and not on another.

Either amend AD-28's rationale to claim only what a global partition buys (straddle-invariance), or amend AD-18 to state which of the two alignment readings is normative.

### H-2 — Deferred promises a provenance transition that AD-28 and the contract both forbid

`ARCHITECTURE-SPINE.md:687` vs `ARCHITECTURE-SPINE.md:500`, `WEIGHTS-FILE-SCHEMA.md:106`, `WEIGHTS-FILE-SCHEMA.md:203`

Deferred, *A measured split for value cells*: *"the affected entries would move from `modelled-split` to `measured`."*

AD-28's Rule ends: *"Either way the affected entries carry `provenance: "modelled-split"`."* The contract is stronger still — *"Every entry produced by a split carries `provenance: "modelled-split"`, never `"measured"`"* (:106) and *"Any entry whose weight came out of a split carries `modelled-split`"* (:203). An entry produced from a measured joint distribution is still an entry produced by a split.

**Divergence permitted:** a producer acting on the Deferred note emits `measured` for decomposed cells. No validator rejects it (nothing in the file distinguishes a split cell from a single-tier one), so `core` propagates `measured` and `web` renders a modelled figure as fully trustworthy — the exact outcome the memlog records as the reason `modelled-split` was created over stamping these `measured` ("the modelling assumption becomes invisible, which is exactly what AD-10 exists to prevent"). This is an amendment weakening AD-10's own reasoning without saying so, in the one section of the spine that is meant to record what has *not* been decided.

### H-3 — A straddle has two different blast radii in the spine and in the contract

`ARCHITECTURE-SPINE.md:310` vs `WEIGHTS-FILE-SCHEMA.md:219`, `WEIGHTS-FILE-SCHEMA.md:223`

AD-18: *"A weights-file band that straddles a tracked band edge is a validation error… Combined with the empty-containment-set rule below, this is a validation error against `data/tracked.json`, checked in `core` at load."*

The contract lists the same condition under **"Hard errors — refuse the file"**: *"an entry whose value edges straddle a band edge in use by `data/tracked.json`"*, and its "Degraded but loadable" list (:223) does not mention it.

These are different products. Under the spine, a straddle caused by one bad curated reference invalidates that tracked entry; under the contract it refuses the entire weights file, which by AD-18:334 makes *every* base unrankable and blanks the ranking. The agent follows the companion.

**Divergence permitted:** `web` either shows a ranking with one entry flagged, or shows nothing at all, from identical inputs. Rev 4 raises the stakes on this because the straddle rule is now promoted from "one of several checks" to *the* invariant non-overlap was a proxy for (`ARCHITECTURE-SPINE.md:312`, `WEIGHTS-FILE-SCHEMA.md:27`), and because a straddle is now far more reachable: cell edges are finer than tier edges, so a curator carrying forward a rev-3 tier-shaped reference straddles by construction. Neither document says whose error it is — the producer's (wrong cells) or the curator's (wrong reference) — and the two answers imply the two different radii.

### H-4 — The band edge's numeric domain is unresolved while `contracts` is ordered to land first

`ARCHITECTURE-SPINE.md:506`, `ARCHITECTURE-SPINE.md:703`, `WEIGHTS-FILE-SCHEMA.md:60–62`, `AGENT-WORKFLOW.md:88`

The spine states the lattice may be half-integer (*"Under an averaged unit it is half-integers… producers emit edges on it; a curator's reference does the same"*), and the Open Question records that **neither** the unit **nor** whether the trade filter accepts non-integer `min`/`max` is confirmed. AGENT-WORKFLOW build order item 1 nevertheless instructs the agent to land the `ModifierRef` union and the 3.0.0 schema in `contracts` **first, alone**, as the change everything rebases onto.

**Divergence permitted:** the one package whose changes are serialised is specified against an unknown. A builder typing `valueMin`/`valueMax` as integers (the pre-rev-4 assumption everywhere else — Consistency Conventions:520 calls band edges "raw game numbers") produces a schema that refuses conforming 3.0.0 files; one typing them as reals produces a schema `sync` can serialise into a filter the API may reject. Nothing decides what `sync` does with a half-integer edge if the filter turns out to be integer-only: round (silently repricing a different population), reject at load, or refuse the file. AD-16's trap 4 (:244) names the unit question and hands it to the producer, but the *consumer-side* consequence — the numeric domain of two fields in `contracts`, and the adapter's behaviour on a non-representable edge — is a dimension this altitude owns and is neither decided, deferred, nor listed as an open question. Either the contract change waits on the producer's live verification, or the spine decides the fallback now.

### H-5 — `modelled-split` becomes the effective ceiling for most of the product, and no decision addresses the presentation consequence

`ARCHITECTURE-SPINE.md:166–175`, `ARCHITECTURE-SPINE.md:317–322`, `ARCHITECTURE-SPINE.md:450–476`, `ARCHITECTURE-SPINE.md:385`

AD-10 requires `core` to propagate the **weakest** provenance of every input. AD-18's denominator is the whole item-level-scoped pool for a `(base, slot)`. AD-28 records that 53 of 63 item classes carry multi-number modifiers, up to 36% of a weapon class's pool.

It follows that a single decomposed cell anywhere in a base's pool drags **every** probability on that base to `modelled-split` — including probabilities for single-number modifiers whose own weights were measured exactly. Across weapons that is essentially the whole catalogue, so AD-10's requirement that `web` "render a figure resting on anything below `measured` visibly differently" makes the degraded rendering the default state of the product rather than the exception it was designed as.

**Divergence permitted:** two builders reading AD-10 and AD-24:385 make opposite calls on the view — one marks nearly every row as degraded (the literal reading, which trains the user to ignore the marker, defeating AD-10's purpose), one decides denominator provenance "doesn't count" and marks only rows whose *numerator* is split (an invention `core` has no rule for). AD-27 exists precisely because "how much of the product actually exists" is a measurement that must precede layout; rev 4 changes that answer materially and AD-27 was not revisited. At minimum the spine should say whether provenance propagates through the denominator, and whether the AD-27 gate now needs a provenance dimension alongside coverage.

---

## Medium

### M-1 — The revision-4 changelog omits AD-17, which was amended

`ARCHITECTURE-SPINE.md:25` vs `ARCHITECTURE-SPINE.md:266–274`

The header states *"AD-5, AD-10, AD-11, AD-16 and AD-18 are amended in place and AD-28 is added"* (and earlier in the same paragraph names only AD-11, AD-16 and AD-18). AD-17 demonstrably changed: `slotOverlap` gained *"true if both are valueless"*, and the whole paragraph at :274 on the unreachable banded/valueless pairing is new — neither could have existed before rev 4 introduced the union. The Consistency Conventions rows for Bands (:516) and Entity keys (:517) and the core-entities note (:627) also changed and are unlisted.

**Divergence permitted:** an agent rebasing onto rev 4 uses the changelog to decide what to re-read — AGENT-WORKFLOW's build order explicitly sequences work this way — and skips the one AD carrying the new overlap semantics for valueless references. Three prior revisions state their amended-AD lists exactly; this one does not, and the memlog (`:122`) records the AD-5 union change without recording the AD-17 ripple.

### M-2 — AD-5's own rationale still asserts bands make tiers disjoint

`ARCHITECTURE-SPINE.md:112` vs `ARCHITECTURE-SPINE.md:108`

Four lines after *"A band is a value interval, not a tier… one interval draws weight from several tiers"*, the *Why a band, not a floor* paragraph closes with *"Bands make tiers disjoint, so each carries its own price and AD-17's partition holds with both tracked."* That sentence is now false for exactly the 53-of-63 classes AD-28 exists for, and it is written in the present tense as a standing property rather than as rev-2 history.

**Divergence permitted:** a builder or curator reading AD-5 top to bottom takes "one band, one tier, its own price" as the model and authors tier-shaped references, which under AD-28 straddle cells (see H-3). The equivalent sentence survives in the contract's 2.0.0 changelog (`WEIGHTS-FILE-SCHEMA.md:37`), where it is at least clearly historical.

### M-3 — AD-12 still describes tier isolation as the curator's lever

`ARCHITECTURE-SPINE.md:202`

*"Isolating a jackpot tier means tracking two entries where one stood, and that second band spends from the same ceiling."* AD-28 (`:504`) and the contract (`:110–112`) state the opposite for multi-number families: **a tier can no longer be isolated at all**, at any price in searches.

**Divergence permitted:** the budget AD whose whole purpose is to make the curation trade-off visible at the moment it is made now describes a trade-off that, for the majority of item classes, is not available. A curator sizing a tracked list against AD-12 plans entries that AD-18's edge-alignment rule will reject, and discovers it at load rather than at authoring time. AD-12 also does not say what the new lever costs — under decomposition the finest reference a curator can write is a *cell*, and cells are finer than tiers, so the number of searches needed to cover one tier's value range can now exceed one.

### M-4 — AD-17 assigns the cross-kind rejection to `contracts`, which cannot perform it

`ARCHITECTURE-SPINE.md:274`, `WEIGHTS-FILE-SCHEMA.md:196`

AD-17: *"`contracts` rejects that pairing at load rather than letting `core` pick a reading."* The contract scopes the equivalent rule to *within a file* (*"the same `statId` must never appear under both kinds within a file"*), which a Zod schema can express. The pairing AD-17 is actually worried about is **cross-file** — a `valueless` reference in `tracked.json` against `banded` entries in `weights.json` — and no per-file schema can see both. The spine has already been through this exact ownership failure once: the rev-2 gate fix that reassigned weights↔catalogue validation because "no owner was able to perform it" (memlog :87), and AD-6 carries an owner column for the same reason.

**Divergence permitted:** the check lands nowhere. The condition is caught incidentally by AD-18's empty-containment-set rule, but with the wrong diagnosis ("you are tracking a tier that cannot roll at this item level") and, per H-3's ambiguity, possibly the wrong blast radius. Name the owner — `core` at load, like every other cross-file rule — or drop the claim.

---

## Low

### L-1 — AD-28's Binds omits `sync`

`ARCHITECTURE-SPINE.md:482` vs `ARCHITECTURE-SPINE.md:235`, `:244`

AD-28 binds `contracts`, `core` and weights producers. But its load-bearing clause — *"the band's unit is measured, never chosen… because AD-16 passes its edges into that filter"* — constrains `sync`, which is the component that builds the filter and the one that must handle a lattice finer than the integers. An agent scoped to `sync` filtering ADs by Binds does not read AD-28.

### L-2 — AGENT-WORKFLOW does not mention the valueless case in the `sync` row

`AGENT-WORKFLOW.md:81` vs `ARCHITECTURE-SPINE.md:235`

The per-package table names "the rule most likely to be broken" for `sync` and lists three, none of them the new one: a `valueless` reference must emit a stat filter with **no** `min` and no `max`. Given that the emitted-`null` trap (`sale_type`) is already the spine's canonical example of a silently-dropped filter field corrupting every estimate, the omission is worth closing. Build order item 1 (:88) does flag the union for `contracts`, so the information exists in the file — just not where the `sync` agent looks.

### L-3 — The contract is still `status: draft` while the spine it governs is `status: final`

`WEIGHTS-FILE-SCHEMA.md:3` vs `ARCHITECTURE-SPINE.md:8`

Pre-existing, carried through three revisions. The file is now a hard release dependency on an external project (AD-11, memlog :75); "draft" understates what a producer is being asked to build against.

### L-4 — No revision-4 section in PRD-EDIT-PROPOSALS.md

Rev 4 changes provenance from three values to four, reissues the weights contract at 3.0.0 (breaking), and makes tier isolation impossible — all of which the PRD states in its own words, and none of which is recorded as a proposed PRD edit. Revisions 2 and 3 both closed by writing that section. Strictly the reconciler's lens, noted here only because the rubric asks whether the amendment reached everywhere it needed to.

---

## Checklist walk — what passed

Recorded so a later revision does not re-litigate settled ground.

| Rubric item | Result |
| --- | --- |
| Every AD has Binds / Prevents / Rule | Pass, all 28, AD-28 included. |
| Every Rule is enforceable | **Fail on AD-28** (C-1); AD-5, AD-16, AD-17, AD-18 all name a validator, a file and an owner. |
| AD-28 fixes a real divergence point | Pass. The producer's measurement (170–1,250 overlapping pairs under every collapsing rule) makes the 2.0.0 contract genuinely unsatisfiable, and the diagnosis — the value axis does not partition the tier axis — is correct and is stated as the reason rather than asserted. |
| AD-28 misses no adjacent divergence | **Partial.** Conservation (C-1), edge-alignment invariance (H-1) and the numeric domain (H-4) are adjacent and open. The non-overlap restatement, the cohort double-count question, the tier-isolation cost and the `tierLabel` mixture case are all correctly anticipated and closed. |
| Nothing under Deferred lets two units diverge | **Fail on one item** (H-2). The other ten are genuinely inert: each names a revisit trigger and none is reachable by a builder making a local choice. |
| No amendment weakens another AD silently | **Fail** (H-2, H-3, M-2, M-3). AD-5's and AD-11's amendments are clean and say what they change. |
| Every dimension the altitude owns is decided, deferred or open | **Fail on two** — the band-edge numeric domain (H-4) and the presentation consequence of near-universal `modelled-split` (H-5). |
| Companions agree with the spine | **Two disagreements** (H-2's `measured` promise, H-3's file-refusal radius). Otherwise the contract tracks rev 4 closely and in some places better than the spine: the worked Bows decomposition, the explicit "cell emitted twice" walk-through, and the per-`itemLevelMin` non-overlap scoping are all precise. AGENT-WORKFLOW's build order item 1 correctly identifies the union as the change to land carefully. |
| Amendment reach — "a band is a tier" | Two survivals (M-2, M-3). Conventions:516, core-entities:627, AD-11:181 and AD-18:312 all updated correctly. |
| Amendment reach — "bands never overlap" | Clean. Restated per-`itemLevelMin` in AD-28:502, Conventions:516, contract :27, :199 and :215 consistently. |
| Amendment reach — "provenance has three values" | Clean. No three-value enumeration survives in the spine or either companion. AD-10:166, contract :203 and AGENT-WORKFLOW:88 all carry four. |
| Amendment reach — "a ModifierRef always has edges" | Clean in the normative text. AD-5:99, AD-16:235, AD-17:266, AD-18:294 and the canonical key at Conventions:517 all discriminate; the three-form key encoding (`null` / `[id,min,max]` / `[id,null,null]`) is a good catch and correctly justified. The ER diagram's `"prefix band"` / `"suffix band"` edge labels (:613–614) are now imprecise but the prose below them corrects it. |
| AD ids stable, no renumbering | Pass — 28 ADs, AD-28 appended. |

---

## What to fix, in order

1. **C-1** — give mass conservation a checker, or downgrade it from "the invariant" to a producer-side obligation the app cannot verify and say so out loud.
2. **H-3** — decide whose error a straddle is and what it invalidates; make the spine and the contract say the same thing.
3. **H-1** — state which edge-alignment reading is normative and correct AD-28 step 1's rationale to claim only straddle-invariance.
4. **H-4** — decide the numeric domain of `valueMin`/`valueMax` and the adapter's fallback, or block the `contracts` landing on the producer's live verification.
5. **H-2, H-5** — repair the Deferred entry; decide whether provenance propagates through the denominator.
6. **M-1 to M-4, L-1 to L-4** — changelog, stale tier language, AD-12's lever, and the cross-kind owner.
