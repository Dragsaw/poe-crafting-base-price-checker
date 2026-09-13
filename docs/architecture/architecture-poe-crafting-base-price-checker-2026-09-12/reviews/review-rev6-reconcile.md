---
title: 'Reviewer gate — input reconciliation lens, spine revision 6'
lens: input-reconciliation
target: ARCHITECTURE-SPINE.md (revision 6) + WEIGHTS-FILE-SCHEMA.md 4.0.0 + AGENT-WORKFLOW.md + PRD-EDIT-PROPOSALS.md
inputs:
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md §10
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/.memlog.md entries 61–73
date: '2026-09-13'
verdict: 'absorbed with one partial'
---

# Input reconciliation — spine revision 6

**Verdict: 3 of 4 items fully absorbed, 1 PARTIAL, 0 missing.** The partial is Candidate 1: the ruling itself landed everywhere it had to, but the contract's statement of it assigns `core` a third exact-equality check that no AD supports and that `core` cannot evaluate — the project's recurring failure shape, reached this time through a count ("three rules") rather than through a missing owner.

Scope is as given: PRD revision 5 is final and has absorbed spine revision 5 in full; `PRD-EDIT-PROPOSALS.md` §22–§31 (C-53…C-77) is fully applied and was not re-checked for outstanding items. Only the four revision-6 items, plus PRD §10's own agreement with the amended spine, are in scope here.

---

## 1. OQ-16 — AD-29's `mass(g, L)` corrected to `mass(g)` — **ABSORBED**

Checked against the amended text rather than the memlog's claim about it.

| Site | State |
| --- | --- |
| `ARCHITECTURE-SPINE.md:583` (AD-29) | `mass(g)` … *"**It carries no `L`.** A group is one tier and therefore one cohort, so the scope admits it whole or not at all"* — and *"AD-18 states the ratio; this is the same function, spelled the same way."* |
| `ARCHITECTURE-SPINE.md:360, 363` (AD-18, governing) | unchanged: `mass(g)`, *"**`mass(g)` carries no `L`**"* |
| Revision-6 banner (`:25`) | names the correction and its reason |
| `WEIGHTS-FILE-SCHEMA.md:378` | `mass(g)`, un-subscripted |
| `prd.md:629, 632` (FR-29) | `mass(g)`, un-subscripted, with the same one-tier-one-cohort reason |

A repository-wide sweep for `mass(g` finds **no surviving `mass(g, L)` outside historical records** — the spine `.memlog.md` rev-5 entry, PRD §10 OQ-16's own body, and the rev-5 reviews, all of which are records of the pre-correction state and are correctly left alone. AD-29 now also states the "same function, spelled the same way" cross-reference, which is what stops the two spellings diverging again.

**Both halves of the memlog's ruling landed**, including the easily-dropped one: the word *scoped* went with the `L`. AD-29's gloss is now *"the weight of that one source row"*, not *"the per-`statId` sum of the group's scoped entry weights"*. Had `scoped` survived, the correction would have been cosmetic — the stale idea, not just the stale notation, was the problem.

No companion carried the `(g, L)` spelling, so there is no companion ripple to check. `AGENT-WORKFLOW.md` never spelled the function.

## 2. Candidate 1 — numeric tolerance — **PARTIAL**

### What landed correctly

The ruling — *no check changes, no version bump, stated as a producer obligation, band-edge exactness kept and justified separately* — reached every place it had to:

- **AD-28 (`:555`)** states the exactness normatively (*"No tolerance, no epsilon, no rounding before the test — `core` sums the parsed numbers and tests equality, here and in AD-29's group-consistency check"*), names the producer obligation, and points at the contract for how to discharge it. It also keeps band edges separate, and `:567` gives the independent reason (a half-integer lattice is exact in binary; an epsilon on edges would readmit the straddle).
- **`WEIGHTS-FILE-SCHEMA.md`** gains *Producer expectations → Sums must be exact as serialised* (`:390–399`), with the worked `850 → 283.33×2 + 283.34` failure, the non-associativity point, **both** discharge routes, and the accepted-residual-risk paragraph with its revisit condition.
- **The 4.0.0 banner (`:20`)** correctly advertises this as clarification with no schema change and no producer work invalidated, and points a producer at the two new passages. That is the right treatment for a contract whose consumer is an external project already building to it.
- **`Validation` (`:380`)** keeps the band-edge rule exact and explicitly routes the reader to the sums section — so the two exactness rules are not read as one.
- **Deferred (`spine:778`)** carries the rejected fix — *"A numeric tolerance on the two weights-file sum rules"* — with the revisit condition and the never-on-edges carve-out.
- **`AGENT-WORKFLOW.md:92`** carries it as a `core`-side trap: *"Do not add a tolerance to the **two** sum checks."* This is the ripple most often dropped in this project and it is present.

The **recorded concern** from the memlog (the obligation is not fully satisfiable by intent alone; float addition is not associative) also survived into the contract rather than being lost with the decision — `:394` states it and `:399` records it as an accepted residual risk that fails closed. That is the "quiet consequence" this lens most often finds missing, and here it is present.

### The partial — a document assigning `core` a check no AD supports

`WEIGHTS-FILE-SCHEMA.md:392` opens:

> **Three** rules in this contract are exact comparisons, and **`core` applies them with no tolerance**: a cohort's emitted cells must sum to its declared `cohortTotals` weight, a group's per-`statId` weights must sum to the same value, **and a tier's split across the cells it reaches must sum to that tier's weight**.

The third is not a `core` check and cannot be one. `core` never sees `w(t)`: the file declares `cohortTotals` per `(statId, itemLevelMin)` — an **aggregate over a cohort's tiers** — and never a per-tier weight. AD-28 says so in as many words at `spine:553` and `:563`: *"`core` holds no tier data, so it cannot check that the partition was cut at the *real* tier endpoints, nor that a split's conditional distribution is right"*, and the per-tier conservation `Σ over cells of its split == w(t)` is stated there as **the invariant**, whose *checkable* proxy is `cohortTotals` and nothing else.

Three witnesses inside the amended documents agree that the count is **two**, not three:

| Witness | Says |
| --- | --- |
| `spine:555` (AD-28) | the exact comparison applies *"here and in AD-29's group-consistency check"* — two |
| `spine:778` (Deferred) | *"a numeric tolerance on the **two** weights-file sum rules"* — AD-28's conservation check and AD-29's group check |
| `AGENT-WORKFLOW.md:92` | *"the **two** sum checks"* |
| `WEIGHTS-FILE-SCHEMA.md:380` | *"The **two** sum rules are the ones that ask something of a producer"* |
| `WEIGHTS-FILE-SCHEMA.md:399` (same section, 7 lines later) | *"the fix is then a relative epsilon on **these two** sum checks only"* |

So the contract contradicts itself inside one section, and the half that is wrong is the **opening sentence a `contracts` author builds the Zod schema and `core` validator from**. This is the same shape as the rev-5 gate fix at the `statId` field-rules row: a residue in the table a builder actually reads, contradicting the prose about twenty lines away.

**Consequence if unfixed, stated plainly.** A `core` author implementing the section literally must invent a per-tier weight to compare against. The only quantities available are `cohortTotals` (an aggregate) and the emitted cell weights themselves; a check derived from the cells is vacuous, and one derived from `cohortTotals` duplicates the first rule. The likely outcomes are a vacuous check that looks like a defence and is not — exactly the failure the rev-5 gate found in the cohort-carriage key — or a new required per-tier field invented in `core`'s head, which is a contract change nobody decided. Both are cheap to prevent and expensive to discover.

**Fix (spine-side, no contract version change):** in `WEIGHTS-FILE-SCHEMA.md:392`, state that **two** rules are `core`-applied exact comparisons and that the per-tier split conservation is the **producer obligation those two check by proxy** — which is what AD-28 already says and what the same section's closing paragraph assumes. Nothing else in the section needs to move; the two discharge routes cover a per-tier split unchanged.

**Note on severity.** The *ruling* is absorbed — no check was added, no version bumped, the obligation is stated, edges stay exact. What is partial is the obligation's **ownership**, and this project's record is that ownership slips are the ones that reach code.

## 3. Candidate 2 — a dropped stat line has no mechanical check — **ABSORBED**

| Where the ruling had to land | State |
| --- | --- |
| **AD-18 (`spine:369`)** | Names **both** causes of an empty containment set — a reference naming a tier that cannot roll at the floor (`tracked.json`'s defect), or a weights file that dropped a stat line while declaring `complete` — states *why* nothing catches the second (group-consistency compares sums only across published lines; completeness counts stat lines against no declared total), specifies the error's content (**the reference, its floor, and the absence of any cell for that `statId` in the scoped pool**), and explicitly **deletes the unconditional blame**: *"Blaming the tracked list unconditionally would send a curator hunting a defect in a file that is correct."* |
| **Contract `Validation` (`:376–378`)** | States the limitation under its own heading, and — the part that matters — states *why it is survivable*: AD-18's denominator sums `mass(g)` over **source modifiers**, so a dropped *line* shrinks no denominator and inflates no probability, unlike a dropped *row*. This is the exact argument that decided the call, carried to the producer who most needs it. |
| **Deferred (`spine:777`)** | Carries the rejected fix (a declared stat-line count on the `cohortTotals` pattern), the reason for rejecting it (a new required field is breaking against an external producer on `4.0.0`, bought for **diagnosis** not correctness), and a concrete revisit condition. |
| **`AGENT-WORKFLOW.md:92`** | *"An empty containment set has two possible causes and the error must name both … `core` cannot tell them apart, so it reports the reference, its floor and the missing `statId`, and does not blame either document."* |
| **4.0.0 banner (`:20`)** | Points the producer at the Validation note. |

No new field, no check, no version bump — as ruled. The limitation is stated as a limitation (named, bounded, with its non-consequence for ordering spelled out) rather than left as an unremarked gap, which is the whole of what "accepted as a named limitation" requires.

**One residue, editorial and PRD-side**, recorded under §5 below: PRD FR-29's lead bullet (`prd.md:635`) still glosses an empty containment set as *"it means the curator is tracking a tier that cannot roll"* before the **next** bullet names both causes. The PRD is not wrong — the two-cause rule is stated in full immediately after — but the lead sentence is the pre-rev-6 single-cause reading and now sits one line above its own correction.

## 4. Correction to `PRD-EDIT-PROPOSALS.md` §25, C-53 — **ABSORBED**

`PRD-EDIT-PROPOSALS.md:580` now carries the correction in place, inside C-53's third bullet, as a call-out: *"**Correction, applied in spine revision 6 — do not re-introduce the third case.**"* It states that the PRD's deviation was right, that AD-17 names only two cases, the two reasons (`4.0.0` requires `sourceModifierId` on every entry regardless of provenance; the bootstrap is a weighting shortcut that still carries genuine pool membership, cell edges and `itemLevelMin`), and — the load-bearing part — **why the third case was unsafe rather than merely redundant**: C-53's own safety argument is that such a base is already unrankable and never summed, and that argument does not hold for a uniform-prior file that *does* rank, so returning `false` there would suppress a real co-occurrence and let `ΣP` exceed 1.

The bullet's own text was also corrected, not merely annotated — it reads *"a Base Type absent from the Weights File, or one whose pool is `partial`: **two cases, not three**"* — so a future run copying the bullet without the call-out still gets the right answer. Verified against the source: `spine:307` (AD-17) names exactly those two, and `WEIGHTS-FILE-SCHEMA.md:405–409` confirms the bootstrap carries real pool membership and is subject to AD-27 like any other file. Nothing elsewhere in `PRD-EDIT-PROPOSALS.md` re-introduces a third case.

*Noted, not a finding:* `reviews/review-rev5-reconcile.md` still carries the original three-case text. That is a historical record of a completed gate and is correctly left alone; C-53 is the document a later `bmad-prd` run reads, and it is fixed. The §22 preamble (`:556`) already warns that two of its items carry corrections applied after that review ran; the C-53 correction is a third such, and the preamble's "two" is now one short — filed as an editorial spine-side nit, below.

---

## 5. Does PRD §10 still agree with the amended spine?

### OQ-16's body — now stale, as expected

`prd.md:833` states *"**AD-29 still writes `mass(g, L)`**"*. As of revision 6 that is false. This is the normal, expected outcome of a raised item being answered, not a defect in the PRD — but it is a factual claim about another document that no longer holds, and §10's convention (OQ-13/14/15) is to **retire** such an item in place with its direction and its argument retained. That is a required PRD edit, listed below.

The §10 preamble (`prd.md:823`) likewise says *"**Two items are open: OQ-12 and OQ-16**"*. After revision 6, one is.

### FR-29 vs AD-18 on the two-cause empty containment set — **they agree**

Compared clause by clause:

| | AD-18 (`spine:369`) | PRD FR-29 (`prd.md:637`) |
| --- | --- | --- |
| Cause A | reference names a tier that cannot roll at the entry's floor — a defect in `tracked.json` | *"the curator's: a reference on a tier that cannot roll at this floor"* |
| Cause B | weights file dropped the stat line while declaring `complete` | *"the **producer's** — a file declaring `complete` that dropped a Stat Line"* |
| Why B is uncaught | group-consistency compares sums only across published lines; completeness counts lines against no declared total | *"the group-consistency check compares sums across the Stat Lines a group does publish, so a line dropped entirely leaves the remaining sums agreeing"* |
| What the error reports | the reference, its floor, the absence of any cell for that `statId` in the scoped pool | *"the reference, its floor, and the fact that the scoped pool contains no cell for that `statId`"* |
| Who is blamed | nobody — *"leaves which document is at fault to the reader"* | *"leaves which document is wrong to the reader"* |

Same substance, same reported fields, same refusal to assign blame. The PRD reached this independently at its own reviewer gate (PRD memlog 73, rubric H-4) before the spine ruled, and the two texts converged rather than one copying the other — which is the strongest form of agreement available here. **No PRD edit is required for the ruling itself**; only the lead-bullet residue at `:635` (editorial).

### PRD FR-27 vs the contract's new producer obligation — **a gap the PRD does not yet carry**

This is the one place where revision 6 creates real PRD work rather than bookkeeping. PRD §7.3 makes FR-27 the copy the **external producer** is sent to (PRD memlog 75 records this explicitly: *"FR-27 is the copy SS7.3 sends the external producer to"*, and memlog 74 added AD-28's stated assumption to FR-27 on exactly that ground). FR-27 currently states the two sum rules as **hard errors** (`prd.md:587–588`) and states the unverifiable producer obligations (`:595`) — but it says nothing about the sums having to be **exact as serialised**, nothing about the two discharge routes, and nothing about the accepted residual risk that an arithmetically correct file can still be refused. A producer reading only the PRD would meet the refusal without the instruction for avoiding it.

Related and equally absent: nothing in the PRD tells a `core` builder **not** to add a tolerance. FR-27's hard-error list reads as a set of comparisons with no stated precision policy, and "sum to" is exactly the phrase an implementer softens with an epsilon by reflex.

### Anything raised by §10 or memlog 61–73 that revision 6 has neither addressed nor consciously deferred

Swept all of §10 and PRD memlog entries 61–73. **Nothing unaddressed of substance.** Specifically:

- **OQ-12** (the multi-`#` filter unit) stays open and owned by the scraper project; `spine:793` carries it identically, with the same two unconfirmed facts and the same owner. Correctly not in revision 6's scope.
- **OQ-13, OQ-14, OQ-15** are closed and their spine-side counterparts are stable; the OQ-13 reversal is reflected at `spine:606–608` (4dp, binding `CurrencyRate`, with the reason it is only safe at that precision).
- **OQ-4…OQ-11, BQ-1…BQ-3** are historical records; none makes a live claim contradicted by the rev-6 text.
- **memlog 72** (the C-53 deviation) → item 4 above, absorbed.
- **memlog 73** (FR-29's two causes) → item 3 above, absorbed.
- **memlog 75**'s PARTIAL C-75 (FR-27 still carrying revision 4's aggregate-across-tiers rule) was fixed in the PRD and matches `spine:545`'s per-tier emission. No residue.
- **One low-severity item worth naming rather than leaving to be rediscovered:** PRD §11's assumptions index (`prd.md:879`) records that *"the `valueless` stat filter is emitted with the stat id and no value object"* was **not verified against a live payload**, and folds it into OQ-12's ownership. The spine's AD-16 (`:259`) states the same shape normatively — *"a `valueless` reference carries the stat id and **no edges at all**"* — and the spine's Open Question on OQ-12 (`:793`) names only the **unit** and the **non-integer acceptance**, not the valueless filter's shape. So an assumption the PRD flags as unverified is stated in the spine as fact, with no marker. It is genuinely low-stakes (the shape is what the trade UI does for valueless stats) and it is owned by the same external party and the same live verification, so it is not a new question — but the spine's open-question body should name it as the third unconfirmed fact rather than leaving the PRD as the only document that knows it is an assumption. Filed as a spine nit, not a PRD edit.

---

## 6. PRD edits now required by revision 6

These become proposals for a later `bmad-prd` run. The PRD is **not** edited here.

**Substantive — 4**

1. **FR-27 gains the *sums must be exact as serialised* producer obligation.** The two rules FR-27 already lists as hard errors are exact comparisons applied with **no tolerance, no rounding, no epsilon**; JSON numbers are IEEE doubles, most decimal fractions are not exact in binary, and float addition is not associative, so a producer verifying its own total in its own order can still disagree with `core`'s. Carry **both** discharge routes (emit values exact in binary — integers or power-of-two denominators, a largest-remainder split onto an integer grid being the simplest; **or** verify against the consumer's arithmetic, summing in the file's own entry order and letting the last cell of each cohort and each stat line absorb the residue) and the **accepted residual risk** (a producer taking neither route emits an arithmetically correct file that is still refused; accepted because it fails **closed** and loudly, naming the cohort or group whose sum missed). Governing: **AD-28**, `WEIGHTS-FILE-SCHEMA.md` *Producer expectations*. *Why substantive: §7.3 makes FR-27 the copy the external producer reads, and this is a new obligation on that producer.*
2. **FR-27 / FR-29 state the no-tolerance policy on the `core` side, and why band edges are exact for a different reason.** A builder reading *"cells must sum to"* will add an epsilon by reflex; the faults these checks catch are the size of a whole cell, so an epsilon buys nothing against them while admitting an unconserved file. Band edges are exact because a half-integer lattice is exactly representable in binary and a near-miss edge is a **straddle**, not a rounding artefact — so the two rules must not be relaxed together. Governing: **AD-28** (`:555`, `:567`), `AGENT-WORKFLOW.md:92`. *Substantive: it constrains `core`'s implementation and FR-29 is the copy `core` is built to.*
3. **§10 OQ-16 retired, and the §10 preamble's open count corrected from two to one.** Move OQ-16 into a *resolved by spine rev 6* subsection on the OQ-13/14/15 pattern: resolved **in this PRD's direction** (AD-18 governed and AD-29's spelling was corrected to match, with *scoped* removed alongside the `L`), retaining OQ-16's own argument — a superseded notation surviving in a second decision, harmless in substance and misleading in practice. The preamble at `:823` then reads **one** open item, OQ-12, which is also the only one owned outside the repository — restoring the simpler sentence C-73 originally asked for. *Substantive: §10's preamble is a live claim about what is open, and §0 and §7.3 both lean on OQ-12 being the single blocking gate.*
4. **§7.2 records the two new Deferred items.** *A declared stat-line count per Source Modifier* (rejected for this revision: a new required field, breaking against a producer already on `4.0.0`, bought for diagnosis rather than correctness; revisit if a curator meets the ambiguous empty-containment error in practice and the file turns out to be the wrong document) and *a numeric tolerance on the two weights-file sum rules* (carried as a producer obligation instead; revisit if a conforming producer reports spurious refusals, and then only as a relative epsilon on the two sums, **never** on band edges). Precedent: C-68 put the deferred co-occurrence conjunction in §7.2. *Substantive: these are scope decisions with revisit conditions, and §7.2 is where the PRD holds them.*

**Editorial — 3**

5. **FR-29 `prd.md:635` — drop the single-cause lead.** The bullet still opens *"it means the curator is tracking a tier that cannot roll on the item being crafted"*, one line above the bullet that names both causes and forbids blaming either document. Restate it neutrally (an empty containment set is a validation error rather than a `P = 0`, because contributing zero would hide it) and let `:637` carry the causes.
6. **§0 preamble — the absorbed-rounds narrative stops at revision 5.** `prd.md:26` reads *"Three further rounds have since closed"* and ends with revision 5. Add revision 6 in the same register: one confirmed item raised back (OQ-16) resolved in this PRD's direction, plus two candidate architecture questions the PRD could not rule on itself, both resolved **without changing the Weights File contract**, which stays at `4.0.0`.
7. **FR-28 / FR-27 — cross-reference the named limitation.** FR-28 states that completeness counts Stat Lines and FR-29 carries the ambiguous-error consequence, but neither says in one place that a dropped Stat Line is **undetectable by design and accepted**, which is how the contract now states it (`WEIGHTS-FILE-SCHEMA.md:376–378`). One sentence at FR-28 pointing at FR-29 closes it; no ruling changes.

---

## 7. Spine-side nits (not PRD edits, not blocking)

- **The partial at `WEIGHTS-FILE-SCHEMA.md:392` — "Three rules … `core` applies them with no tolerance."** Fix as described in §2: two `core`-applied checks, with the per-tier split conservation named as the producer obligation those two check by proxy. This is the one item this lens would hold the gate on.
- **`PRD-EDIT-PROPOSALS.md:556`** says two of the §22 items carry corrections applied after `review-rev5-reconcile.md` ran (C-54, C-56). With revision 6's C-53 correction there are **three**. One-word fix; the preamble is what tells a later run to trust the proposals file over the review.
- **`spine:793`, the OQ-12 open question**, names two unconfirmed facts. PRD §11 tracks a third against the same owner and the same verification — the `valueless` stat filter's emitted shape (stat id, no value object), which AD-16 states as fact. Naming it in the open question would put the spine's assumption where the PRD's already is.
