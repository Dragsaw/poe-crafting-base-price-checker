# EXTRACT — `reviews/review-rev5-reconcile.md`

**Source:** `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/reviews/review-rev5-reconcile.md` (219 lines, dated 2026-09-13).
**Lens:** INPUT RECONCILIATION. **Target:** `ARCHITECTURE-SPINE.md` rev 5 (final), with `WEIGHTS-FILE-SCHEMA.md` 4.0.0 and `AGENT-WORKFLOW.md`.
**Load-bearing input:** the PRD **final at revision 4**, plus its `addendum.md` and the architecture `.memlog.md` (*"authority for revision-banner reconstruction"*).

**Purpose of this extract:** carry the full reasoning and the exact target locations behind proposals **C-53 … C-74** of `PRD-EDIT-PROPOSALS.md`. Nothing here is a summary of conclusions; every proposed text is the review's own wording.

## Mapping key

The review numbers its Part 2 findings **S-1…S-6, H-1…H-7, M-1…M-6, L-1…L-3** (22 items). They map to `C-53…C-74` **in order, one-to-one**:

| Review id | C-item | Review id | C-item | Review id | C-item | Review id | C-item |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S-1 | C-53 | H-1 | C-59 | M-1 | C-66 | L-1 | C-72 |
| S-2 | C-54 | H-2 | C-60 | M-2 | C-67 | L-2 | C-73 |
| S-3 | C-55 | H-3 | C-61 | M-3 | C-68 | L-3 | C-74 |
| S-4 | C-56 | H-4 | C-62 | M-4 | C-69 | | |
| S-5 | C-57 | H-5 | C-63 | M-5 | C-70 | | |
| S-6 | C-58 | H-6 | C-64 | M-6 | C-71 | | |
| | | H-7 | C-65 | | | | |

The review's own header counts: *"Counts: **6 severe, 7 high, 6 medium, 3 low — 22 items.**"* (`PRD-EDIT-PROPOSALS.md` §25 renumbers the severity tally to "7 severe" because C-77 was added later; the review knows nothing of C-75/C-76/C-77.)

**Severity key, verbatim from the review (line 106):**
> *Severe* — a builder following the PRD implements something the spine forbids, or the PRD states a fact that is now false in a way that changes code. *High* — the PRD is stale in a way a reader will act on, but the error is visible. *Medium* — a required addition the PRD is silent about. *Low* — bookkeeping.

The review does not use a "Governing ADs:" field. Where an item cites ADs it does so inline; the "ADs cited" line under each item below records what the review itself names, and flags where `PRD-EDIT-PROPOSALS.md` attributes an AD the review does not.

---

# ⚠ THE TWO KNOWN-WRONG PASSAGES

Both are quoted in full here and again in place under S-2 / S-4.

## (a) `mass(g, L)` — the denominator mass function with an `L` subscript

**Location: review line 128**, inside **S-2** (→ C-54), in the *Needs:* paragraph. Surrounding passage, verbatim and complete:

> *Needs:* AD-18's amended ratio. The numerator sums over **entries** in the containment set; the denominator sums over distinct **`sourceModifierId`** — `Σ { mass(g, L) : g ∈ sources(scoped(base, slot, L)) }`, where `mass(g, L)` is the common per-`statId` sum of `g`'s scoped entries. With the reason: an affix draw selects a *modifier*, so a modifier publishing several stat lines contributes its weight once; summing the denominator over entries inflates it by each hybrid's surplus lines and understates every probability on the base, **unevenly**, so it reorders the ranked list rather than shifting it. Note that for a pool of single-stat modifiers the two readings coincide exactly — which is why a builder can implement FR-29 as written, pass every test built from a single-stat fixture, and be silently wrong on 560 of 8,437 real rows.

`mass(g, L)` occurs **twice, both on line 128, and nowhere else in the review.**

**Why it is wrong / what supersedes it** — `PRD-EDIT-PROPOSALS.md` C-54 (line 592), verbatim:
> **Correction to the reconcile review:** it gives this as `mass(g, L)`. After the gate pass **`mass(g)` carries no `L`** — a source row is one tier and so sits in exactly one cohort, so a group is admitted by the scope whole or not at all and there is nothing to reconcile across cohorts. `mass(g)` is the common value of `Σ { e.weight : e ∈ g, e.statId == s }` over each `statId s` the group publishes. Use the un-subscripted form.

Correct form to apply: `Σ { mass(g) : g ∈ sources(scoped(base, slot, L)) }` — the `L` survives only inside `scoped(...)`.

## (b) The cohort-carriage error scoped to `(base, slot, statId, sourceModifierId)`

**Location: review line 141**, the **closing sentence of S-4** (→ C-56), immediately after numbered correction 4. The whole passage — the four-item *Needs:* list it terminates, so the sentence is seen in its context — verbatim:

> *Needs:* four corrections against the contract's 4.0.0 `## Validation` section —
> 1. duplicate key becomes `(sourceModifierId, statId, kind, valueMin, valueMax, itemLevelMin)`;
> 2. non-overlap is scoped by `sourceModifierId` **as well as** `itemLevelMin` — two distinct game modifiers may legitimately publish the same stat over the same values, and refusing that file would force a producer to merge them, destroying the co-occurrence marker on both;
> 3. **new error:** a missing `sourceModifierId`;
> 4. **new error:** a `sourceModifierId` group whose per-`statId` weight sums disagree within one `itemLevelMin` cohort — the same shape and reason as `cohortTotals`, and the only mechanical check on the explosion.
>
> Also scope the cohort-carriage error to `(base, slot, statId, sourceModifierId)`.

That final sentence (line 141) is the wrong proposal. Note also that item 4's qualifier *"within one `itemLevelMin` cohort"* is dropped in C-56, for the same underlying reason (a group has exactly one cohort, so the qualifier is inert).

**Why it is wrong / what supersedes it** — `PRD-EDIT-PROPOSALS.md` C-56 (line 615), verbatim:
> **Correction to the reconcile review, and it matters:** the review closes by proposing that the cohort-carriage error be scoped to `(base, slot, statId, sourceModifierId)`. **Do not apply that.** The gate found it makes the check **vacuous** — a source row is one tier and therefore has exactly one cohort, so a per-row count can never exceed 1, and AD-28's only mechanical defence against a degenerate coarse partition would be silently disarmed. **The key stays `(base, slot, statId)`**, counted across every source modifier publishing that stat. The two keys differ deliberately, and FR-27 should say why: non-overlap is narrowed by `sourceModifierId` to keep two modifiers' mass separable; the carriage bound is not, because only a family-wide count can see a partition cut too coarsely.

---

# Part 2 findings — the C-53…C-74 analysis

## Severe

### S-1 → C-53 — FR-16 (§4.5): the overlap predicate is missing the `coOccur` branch, and states its negation

**Location:** FR-16, §4.5 (the `slotOverlap` predicate and its accompanying text).

**Current PRD text quoted:** FR-16's `slotOverlap` reads
> `false if x.statId != y.statId`

— *"unconditionally, with the accompanying text naming the both-valueless branch as "the one not derivable from a bands-intersect reading.""*

**Proposed replacement, verbatim:** *"AD-17's amended predicate, with the co-occurrence branch above the inequality case:"*

```
slotOverlap(x, y) =  true              if x is absent or y is absent
                     true              if x.statId != y.statId ∧ coOccur(x, y)
                     false             if x.statId != y.statId
                     true              if both are valueless
                     bands intersect   otherwise
```

> plus AD-29's definition — `coOccur(x, y)` holds when some `sourceModifierId` in the scoped pool emits an entry contained by `x` and an entry contained by `y` in the same item-level cohort — and the statement that it is a **cross-file** check owned by `core` at load, like FR-29's straddle and edge-alignment rules.

**Reasoning, verbatim (load-bearing):**
> This is the highest-consequence item in the list: a builder implementing FR-16 as written lets a base whose two tracked entries name two lines of one hybrid modifier reach `ΣP > 1` and take the top of the ranking, which is precisely the class of defect FR-16 exists to prevent and which its own prose boasts of having caught twice.

**ADs cited:** AD-17 (the amended predicate), AD-29 (the `coOccur` definition).

**Not in the review — carried only by C-53:** the two gate-pass additions — that `coOccur`'s scope `L` is *the base's own crafted Item Level Floor*, and that where the pool cannot answer (base absent from the Weights File, `partial` pool, uniform-prior bootstrap) `coOccur` is **`false` and the Tracked List still loads**. The review says nothing about either.

### S-2 → C-54 — FR-29 (§4.8): the denominator sums over entries, not over source modifiers

**Location:** FR-29, §4.8.

**Current PRD text quoted:**
> *"Both numerator and denominator are drawn from the same item-level-scoped pool, scoped to the entry's Item Level Floor `L`: `{ band ∈ pool(base, slot) : band.itemLevelMin <= L }`"*

— *"with no distinction between the two halves beyond scope."*

**Proposed replacement:** see **(a)** above — the review's formula is `Σ { mass(g, L) : g ∈ sources(scoped(base, slot, L)) }` and is **wrong**; apply `Σ { mass(g) : g ∈ sources(scoped(base, slot, L)) }`.

**Reasoning, verbatim (load-bearing — this is the invisible-to-a-test argument):**
> an affix draw selects a *modifier*, so a modifier publishing several stat lines contributes its weight once; summing the denominator over entries inflates it by each hybrid's surplus lines and understates every probability on the base, **unevenly**, so it reorders the ranked list rather than shifting it. Note that for a pool of single-stat modifiers the two readings coincide exactly — which is why a builder can implement FR-29 as written, pass every test built from a single-stat fixture, and be silently wrong on 560 of 8,437 real rows.

**ADs cited:** AD-18 (*"AD-18's amended ratio"*). C-54 adds AD-29 as co-governing; the review names only AD-18 here.

### S-3 → C-55 — §3 *Modifier Weight* and FR-27: the entry shapes omit the required `sourceModifierId`

**Locations:** §3 glossary entry *Modifier Weight*, **and** FR-27 — both.

**Current PRD text quoted (identical in both):**
> *"`(statId, kind, valueMin, valueMax, itemLevelMin, weight, provenance)` banded, `(statId, kind, itemLevelMin, weight, provenance)` valueless."*

**Proposed replacement, verbatim:**
> `sourceModifierId` added to **both** shapes, as **required on every entry** — not hybrid-only. The contract's reason should come with it: required everywhere so `core` has one identity notion rather than two code paths, and so a producer forgetting it on a hybrid cannot emit a file that still validates. A producer building to the PRD's tuple emits a file `core` refuses at load.

**ADs cited:** none named inline in the review (the source is *"the contract"*, i.e. `WEIGHTS-FILE-SCHEMA.md` 4.0.0). C-55 attributes **AD-29**.

### S-4 → C-56 — FR-27 (§4.8): the hard-error list is stale in four ways

**Location:** FR-27, §4.8 — the hard-error list.

**Current PRD text quoted:** the list carries
> *"a duplicate `(statId, kind, valueMin, valueMax, itemLevelMin)` within a slot"*, *"overlapping value bands for one `statId` at the same `itemLevelMin`"*, and *"a cell carried by more than two cohorts"*

— *"and has no group-consistency entry."*

**Proposed replacement, verbatim:** quoted in full under **(b)** above — the four numbered corrections, plus the wrong closing sentence.

**Reasoning:** the load-bearing argument is inside correction 2 — *"two distinct game modifiers may legitimately publish the same stat over the same values, and refusing that file would force a producer to merge them, destroying the co-occurrence marker on both"* — and inside correction 4 — *"the same shape and reason as `cohortTotals`, and the only mechanical check on the explosion."*

**ADs cited:** none inline; the authority named is *"the contract's 4.0.0 `## Validation` section"*. C-56 attributes **AD-28, AD-29** (AD-28 is what the closing sentence would have disarmed).

### S-5 → C-57 — Contract version: the PRD says 3.0.0 in four places, and 4.0.0 is breaking

**Locations — all four, verbatim:**
1. §3 *Weights File* — *"at contract version **3.0.0**"*
2. FR-27 — *"schema **3.0.0**, breaking"* and *"Hard file errors reject the file outright (schema **3.0.0**)"*
3. FR-27 — *"A producer building to a 1.x or 2.x shape emits a file that `core` refuses"*
4. §10 BQ-2 — *"Weights File schema 2.0.0 — 3.0.0 at the current revision"*

**Proposed replacement, verbatim:**
> *Needs:* 4.0.0 throughout, and the refusal clause widened to **1.x, 2.x or 3.x**.

**Reasoning, verbatim (why this is severe and not bookkeeping):**
> This is severe rather than bookkeeping because §7.3 names the Weights File a release dependency from a near-complete external project: a 3.0.0 file that was in flight when rev 5 landed is now refused at load, and the PRD is the document that project's owner reads for the version number.

**ADs cited:** none inline. C-57 attributes **AD-11**.

### S-6 → C-58 — §3 *Eligible Pool*: the denominator is characterised as the scoped set of cells

**Location:** §3 glossary, *Eligible Pool*.

**Current PRD text quoted:**
> *"The pool is **scoped** to a Tracked Entry's Item Level Floor before it normalises anything, and **the scoped pool is the denominator** of every probability for that entry (AD-18, FR-29)."*

**Proposed replacement, verbatim:**
> *Needs:* the scoped pool is the *domain* the denominator is computed over, but the denominator is the sum of **source-modifier masses** within it, not the sum of its cells.

**Reasoning, verbatim (why this reading cannot stand):**
> As written, the glossary — which this PRD declares normative for every FR that uses the term — states the defect AD-29 exists to remove, and it states it in the one place a reader goes to settle a disagreement.

**ADs cited:** AD-18 and FR-29 appear inside the quoted current text; AD-29 is named in the reasoning. C-58 attributes **AD-18, AD-29**.

## High

### H-1 → C-59 — §3 Glossary: there is no entry for the source modifier

**Location:** §3 Glossary — an **addition**, no current text.

**Current state quoted:**
> *Currently:* silent. The glossary defines Modifier Reference, Modifier Weight, Cohort, Eligible Pool and `cohortTotals`, but AD-29's central concept has no term.

**Proposed replacement, verbatim:**
> *Needs:* a **Source Modifier** entry (and/or **`sourceModifierId`**, matching the `lastAttemptedAt` and `cohortTotals` precedent of naming the field). It must carry: one game modifier may publish several distinct trade stats under one spawn weight, rolled as a unit; the producer emits one entry per stat line each carrying the row's **full** weight; `sourceModifierId` is producer-assigned, opaque, stable within one `(Base Type, slot)`, never validated against the Trade Catalogue, and **never part of a Modifier Reference, a Tracked Entry or its canonical key**.

**Reasoning, verbatim (why High, not Medium — and the sequencing claim):**
> This is High rather than Medium because §0 commits the document to being glossary-anchored and to FRs using glossary terms verbatim — S-1 through S-4 cannot be written without this term existing.

**ADs cited:** AD-29.

**Divergence:** C-59 adds a clause the review does not have — *"the id names **one source row — one tier of one modifier, never a family**, so a group sits in exactly one Cohort"*. That clause is the gate-pass granularity ruling that also invalidates (a) and (b).

### H-2 → C-60 — §0 Document Purpose: the inherited spine is described as revision 4, AD-1 through AD-28

**Location:** §0 Document Purpose.

**Current PRD text quoted:**
> *"`ARCHITECTURE-SPINE.md` is final at revision 4, and its decisions AD-1 through AD-28 are **inherited, not re-decided**"*; *"Revision 4 added **AD-28** … and raised the Weights File contract to **3.0.0**, breaking; revisions 3 and 4 amended a further thirteen decisions in place, listed at §10 OQ-15"*.

**Proposed replacement, verbatim:**
> *Needs:* revision 5, AD-1 through AD-29, contract 4.0.0; a sentence for what revision 5 added (AD-29) and amended (AD-5, AD-6, AD-9, AD-11, AD-16, AD-17, AD-18, AD-28); and the *"thirteen decisions"* arithmetic recomputed. The AD-id stability claim still holds and should be retained as-is.

**Divergence to watch:** the review's rev-5 amended list is **eight** ADs and omits **AD-26**. C-60 gives **nine** — *"AD-5, AD-6, AD-9, AD-11, AD-16, AD-17, AD-18, AD-26, AD-28"* — as does the `/bmad-prd` invocation text at §31 of the proposals file. Use the nine-AD list.

**ADs cited:** AD-29 (added), the eight amended above.

### H-3 → C-61 — §10 OQ-13 is listed as open; it is resolved in the PRD's favour

**Location:** §10, OQ-13, under *"Open — raised against the spine by this revision"*.

**Current PRD text quoted:** OQ-13 sits under *"Open — raised against the spine by this revision"*, with
> *"the spine's Consistency Conventions still say 'rounded to 4 decimal places'."*

**Proposed replacement, verbatim:**
> *Needs:* move to a resolved section. The conventions row now says 2 dp, adopting FR-23, and additionally records the tie-frequency knock-on OQ-13 flagged. The retained record should note that the resolution went the PRD's way on a player product decision.

**⚠ This item's direction is REVERSED downstream.** The review says the resolution *"went the PRD's way"*; C-61's heading says *"it is resolved **against** the PRD"*, and C-77 records that *"the player has reversed the 2-decimal call"* — the spine keeps **4 dp** and FR-23 returns to 4 dp. C-61's own body supplies the replacement reasoning (one precision governs every persisted Divine value, FR-26's Craft Cost among them; 0.01 is not fine enough for a currency worth a fraction of a Divine). The review's sentence *"The conventions row now says 2 dp"* is stale in the same way. This is not one of the two passages flagged for you, but it fails identically — treat H-3's direction as superseded.

**ADs cited:** none inline.

### H-4 → C-62 — §10 OQ-14 is listed as open, and FR-27 asserts a disagreement that no longer exists

**Locations:** §10 OQ-14; and FR-27.

**Current PRD text quoted:** OQ-14 open; and FR-27 states
> *"**`WEIGHTS-FILE-SCHEMA.md` disagrees** and states it as a hard file error — see §10 OQ-14."*

**Proposed replacement, verbatim:**
> *Needs:* OQ-14 moves to resolved, recording the direction (AD-6's — the check is `sync`'s and report-only, the file loads, because a hard file error is `core`'s refusal and `core` never holds `catalogue/items.json`) and the rejected alternative (file-refusal, which would need AD-24 amended to fetch a ninth artifact). FR-27's *"disagrees"* clause must go or invert — the contract now agrees, and a reader acting on the stale sentence would go looking for a contradiction that has been fixed.

**The review's caveat, verbatim — now itself stale:**
> *(Caveat: the contract's `## Field rules` `statId` row is the one place still carrying the old text — Part 1 item 2. Whoever applies this edit should confirm that row was fixed first, or the PRD sentence becomes accidentally true again.)*

C-62 records that this residue **was fixed during the gate pass**: *"the `## Field rules` `statId` and `bases` key rows now both name `sync` and report-only. No residue remains."*

**ADs cited:** AD-6 (governing direction), AD-24 (what the rejected alternative would have required).

### H-5 → C-63 — §10 OQ-15 is listed as open, and its own revision-3 list is wrong

**Location:** §10, OQ-15.

**Current PRD text quoted:** OQ-15 open, giving revision 3 as
> *"AD-9, AD-11, AD-12, AD-18, AD-19, AD-21, AD-26 and AD-27"*

— *"eight ADs, **omitting AD-24**."*

**Proposed replacement, verbatim:**
> *Needs:* move to resolved, **and correct the list on the way**: the memlog's rev-3 closing entry names nine, including AD-24 (the gate fix that names `data/currencies.json` among the files `web` does not fetch and closes the set at eight). The spine's corrected banner is right and the PRD's list is not. The revision-4 list is correct and needs no change. Worth recording that the spine went back to the memlog rather than copying the PRD — that is why the discrepancy surfaced.

**Reasoning (why a correction and not a retirement), verbatim from the review's closing notes:**
> **H-5 is a correction, not a retirement.** Unlike OQ-13 and OQ-14, the PRD's OQ-15 text carries a factual error of its own, and closing it without fixing the list would preserve the error in the record.

**Corroborating evidence the review supplies (Part 1 item 5):** the authoritative rev-3 memlog closing entry is *"ADs amended in place: AD-9, AD-11, AD-12, AD-18, AD-19, AD-21, AD-24, AD-26, AD-27. No AD added."* The rev-4 memlog entry is *"ADs amended in place: AD-5, AD-10, AD-11, AD-16, AD-17, AD-18, AD-27. AD-28 added."*

**ADs cited:** AD-24.

### H-6 → C-64 — FR-23's `[NOTE FOR PM]` claims to supersede the spine

**Location:** FR-23, the `[NOTE FOR PM]`.

**Current PRD text quoted:**
> *"This **supersedes the spine's Consistency Conventions**, which specify 4 decimal places. The decision is the player's and is recorded here, but the convention is the spine's to change — see §10 OQ-13."*

**Proposed replacement, verbatim:**
> *Needs:* delete or rewrite. The spine now specifies 2 dp and cites the same reasoning. A `contracts` author reading this note would still expect a conflict and might resolve it the wrong way, or waste the review cycle it was written to trigger.

**⚠ Stale premise:** the reason clause *"The spine now specifies 2 dp"* is false after the gate/player reversal (see H-3 above). C-64's disposition — **delete it** — is unchanged, but for the opposite reason: *"the spine keeps 4 dp, FR-23 adopts it (C-77), and there is no conflict left to escalate."*

**ADs cited:** none inline.

### H-7 → C-65 — FR-28 (§4.8): pool completeness is stated over modifiers, not stat lines

**Location:** FR-28, §4.8.

**Current PRD text quoted:**
> *"a `(Base Type, slot)` declaring `poolCoverage: 'complete'` must enumerate **every modifier** that can roll there **at any item level**."*

**Proposed replacement, verbatim (the contract's 4.0.0 clarification):**
> *"Pool completeness counts stat lines, not rows. A `complete` pool enumerates every stat line every rollable modifier publishes. Emitting one line of a hybrid and dropping the other is the same defect as dropping a modifier outright."*

**Reasoning, verbatim (load-bearing):**
> Without it, a producer reading FR-28 alone can drop the second line of each of the 560 hybrid rows and still believe it declared `complete` honestly, which shrinks numerators without touching the denominator — the mirror of the defect FR-28's own text argues against.

**ADs cited:** none inline (authority is the contract 4.0.0). C-65 attributes **AD-11, AD-29**.

## Medium

### M-1 → C-66 — §3 *Modifier Reference*: silent on AD-5's new clause

**Location:** §3 glossary, *Modifier Reference*. No current text quoted — the entry is silent.

**Proposed replacement, verbatim:**
> *Needs:* AD-5's addition — *"a reference names a **stat line**, not a game modifier"* — with its consequence: a `statId` identifies what the trade filter can ask for, which is the only thing the identity has to do; the thing the game draws is the source modifier, which lives on the Weights File and never on a reference, because a curator can only filter on what trade exposes. This is the sentence that keeps a reader from concluding that `sourceModifierId` belongs on a Tracked Entry.

**ADs cited:** AD-5.

### M-2 → C-67 — FR-1 (§4.1): the partition consequence names only band overlap

**Location:** FR-1, §4.1 — the consequences list.

**Current PRD text quoted:** *"the consequences establish that summands must be mutually exclusive and point at FR-16."*

**Proposed replacement, verbatim:**
> *Needs:* a note that co-occurring stat lines are a second, non-obvious way for the partition to break — two references on distinct `statId`s, no bands intersecting, both satisfied by one item. It belongs here as well as in FR-16 because FR-1 is where the `ΣP ≤ 1` premise is asserted.

**ADs cited:** none inline.

### M-3 → C-68 — §7.2 / Deferred: the new deferred item is absent

**Location:** §7.2 / Deferred. Addition; no current text.

**Proposed replacement, verbatim:**
> *Needs:* the spine's *"Pricing a deliberate conjunction of co-occurring stats"* — a `TrackedEntry` still carries at most one `ModifierRef` per slot, so a curator cannot express *"I want both lines of this modifier"*; the two-entry spelling is correctly rejected as an overlap; the data to support it exists from day one (the probability is the one source modifier's weight, not a product); deferred because it widens `ModifierRef` from a field to a set and touches AD-5, AD-16, AD-17 and AD-18 at once. Recording it matters because the deferral is *why* FR-16 rejects a configuration a curator will plausibly try.

**ADs cited:** AD-5, AD-16, AD-17, AD-18 (as the decisions a future un-deferral would touch).

### M-4 → C-69 — §7.3 Release Dependencies: silent on the 4.0.0 break against a near-complete producer

**Location:** §7.3 Release Dependencies.

**Current PRD text quoted:**
> *"The project is near completion, and the dependency is **accepted rather than worked around**."*

**Proposed replacement, verbatim:**
> *Needs:* a note that the contract has taken a second breaking revision since (3.0.0 → 4.0.0) and that a file emitted to 3.0.0 is refused at load — the producer must add `sourceModifierId` to every entry and satisfy the group-consistency rule. This is the PRD's own release-gating section; a break in a stated release dependency belongs in it.

**ADs cited:** none inline.

### M-5 → C-70 — FR-16 (§4.5): the "three consequences" list should become four

**Location:** FR-16, §4.5 — the consequences enumeration.

**Current PRD text quoted:** three consequences, *"the third of which the earlier enumeration missed"* (the prefix-only/suffix-only case).

**Proposed replacement, verbatim:**
> *Needs:* a fourth — two entries in **one** slot naming two lines of one source modifier, which no bands-intersect or slot-conjunction reading catches, and which the predicate now catches only via `coOccur`. Worth stating in the same rhetorical register the FR already uses: it is the same failure as the third case, reached from the other direction.

**ADs cited:** none inline (implicitly AD-17/AD-29 via `coOccur`).

### M-6 → C-71 — FR-22 (§4.6): the curation rules do not mention co-occurrence

**Location:** FR-22, §4.6.

**Proposed replacement, verbatim:**
> *Needs:* a consequence telling the curator that two Modifier References naming two stat lines of one source modifier cannot both be tracked in one slot — it is a load-time rejection under FR-16, not a budget question — and that isolating such a conjunction is deferred (M-3). FR-22 is where a curator learns what they may author; this is a new thing they may not.

**Cross-reference:** *(M-3)* in the review = **C-68**.

**ADs cited:** none inline.

## Low

### L-1 → C-72 — §0 revision-round count

**Location:** §0. **Current:** *"Two further rounds have since closed."*
**Proposed, verbatim:** *"Three have. Update the count and add a sentence for revision 5, mirroring the existing rev-3 and rev-4 sentences."*

### L-2 → C-73 — §10 preamble open-OQ range

**Location:** §10 preamble. **Current:** *"OQ-12 through OQ-14 are open and each has a named owner outside this document."*
**Proposed, verbatim:**
> After H-3/H-4/H-5 only **OQ-12** is open, and it alone is owned outside the repository; OQ-13/14/15 were architecture-owned and are now closed. The preamble's own framing (*"Live items first, then the record"*) needs the sentence narrowed to OQ-12.

*(H-3/H-4/H-5 = C-61/C-62/C-63.)*

### L-3 → C-74 — §3 *Base Type* / the ids convention: no reflection of the `sourceModifierId` exception

**Location:** §3 *Base Type*.
**Current PRD text quoted:** the flat rule — *"Never re-encoded into an internal id (AD-5)"* — with no exception noted.
**Proposed, verbatim:**
> The spine's Consistency Conventions now carry an explicit carve-out — `sourceModifierId` is the one id that is *not* a trade API identifier, is producer-owned and opaque, is never validated against the catalogue, and *"never appears on a `ModifierRef`, a `TrackedEntry` or its canonical key."* … Low because the PRD does not restate the conventions table, but a reader could reasonably read the flat rule as forbidding the new field.

**ADs cited:** AD-5 (inside the quoted current text).

---

# Part 2 application notes (review lines 214–219, verbatim)

> - **Apply S-1, S-2, S-3 and S-4 as one pass.** They are four faces of AD-29 and the contract's 4.0.0, and applying any one alone leaves the PRD internally inconsistent (e.g. FR-29's denominator de-duplicating on a field FR-27's entry shape does not require).
> - **H-1 sequences ahead of the severes.** The glossary term has to exist before FR text can use it verbatim, which §0 requires.
> - **H-5 is a correction, not a retirement.** Unlike OQ-13 and OQ-14, the PRD's OQ-15 text carries a factual error of its own, and closing it without fixing the list would preserve the error in the record.
> - **Nothing in Part 2 is a request for an architecture decision.** Every item is the PRD catching up to a settled amendment; none requires the spine to rule on anything. The one live architecture action is the Part 1 item 2 residue in `WEIGHTS-FILE-SCHEMA.md`'s `## Field rules`.

These reproduce as `PRD-EDIT-PROPOSALS.md` §30 items 1 and 2 and the C-63 note.

---

# Everything in the review that does NOT map to C-53…C-74

All of the following is Part 1 (absorption verdicts on the eight items PRD rev 4 raised against the spine), plus scope and verdict framing. **None of it is a PRD edit** — Part 1 items are verdicts on the *spine and contract*, and its one live action is a companion-file fix, not a C-item.

**Overall verdict (line 7), verbatim:**
> **Verdict: substantially absorbed — 7 of 8 landed cleanly, 1 partial.** The single partial is a residue inside the weights contract itself, not a spine defect: the contract removed the uncatalogued-id hard error in three of four places and left the fourth standing. Separately, the PRD is now materially behind the spine — AD-29 and contract 4.0.0 contradict or outrun **22** locations in it, six of them severe enough to make a builder implement the wrong denominator or the wrong partition check.

**Declared out of scope (line 9), verbatim:**
> Out of scope by instruction and **not re-opened**: `AGENT-WORKFLOW.md`'s rotation ordering and coverage-gate numerator/re-measurement clause, and the contract's nine-cell worked example. All three were confirmed fixed in passing and are not discussed below.

**Part 1 verdict table:** 1. AD-9 `lastAttemptedAt` self-contradiction — ABSORBED. 2. OQ-14 uncatalogued id: contract vs AD-6 — **PARTIAL**. 3. OQ-13 persisted price precision 2 dp vs 4 dp — ABSORBED. 4. AD-16 median on an even sample — ABSORBED. 5. OQ-15 under-reported revision notes — ABSORBED. 6. AD-17 cross-kind `statId` rejection — ABSORBED (confirms the PRD). 7. AD-28 `Binds` omitted `sync` — ABSORBED. 8. `WEIGHTS-FILE-SCHEMA.md` status + identity tuple — ABSORBED.

Items of Part 1 with content a PRD applier may still need:

- **Part 1 item 2 — the only live architecture action.** Target: `WEIGHTS-FILE-SCHEMA.md`, `## Field rules`, the `statId` row. Offending text, verbatim: *"`statId` | A trade API stat id, validated against the committed catalogue (AD-25). **An id absent from the catalogue is a hard file error, not a skip.**"* The review's argument: *"`## Field rules` is the table a `contracts` author builds the Zod schema from, and it is the more implementation-shaped of the two surfaces. A builder reading it would emit a `core`-side refusal for a check `core` demonstrably cannot run on the base-type half, reproducing exactly the defect OQ-14 raised."* It also flags the `bases` key row immediately above as ambiguous in the same direction; *"Both should point at AD-6 and say *report-only, in `sync`*."* **Per C-62 this was fixed in the gate pass — no residue remains.** It gates H-4/C-62 only in the review's original telling.
- **Part 1 item 6 — AD-17 confirms FR-16.** *"This confirms PRD FR-16's assignment rather than correcting it. FR-16 needs no edit on this point."* i.e. an explicit **no-edit** finding, distinct from C-53's edit to the same FR.
- **Part 1 item 3 — the 2-dp absorption.** Records the tie-frequency knock-on: *"Coarser rounding makes exact ties between listing prices commoner, which is part of why AD-16's even-sample median rule has to be stated rather than left to the implementer."* Superseded by the player's reversal to 4 dp (C-77), which also forces the FR-21 knock-on noted in proposals §29.
- **Part 1 item 8 — identity vs uniqueness.** The uniqueness key is *"a six-tuple in the hard-error list — `(sourceModifierId, statId, kind, valueMin, valueMax, itemLevelMin)`"*, deliberately **not** called an identity; AD-5's canonical identity is the three-tuple `(statId, valueMin, valueMax)` banded / `(statId)` valueless, with *"An entry is **located** by more than it is **identified** by."* Useful background when applying C-55/C-56/C-59/C-66.

**Also absent from the review entirely** (so no analysis exists here for them): **C-75, C-76, C-77**, and the FR-21 median-grid knock-on that rides with C-77.
