# Review — Architecture Spine revision 5 — INPUT RECONCILIATION lens

**Target:** `ARCHITECTURE-SPINE.md` rev 5 (final), with `WEIGHTS-FILE-SCHEMA.md` 4.0.0 and `AGENT-WORKFLOW.md`.
**Load-bearing input:** `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md`, **final at revision 4**, plus its `addendum.md` and the architecture `.memlog.md` (authority for revision-banner reconstruction).
**Date:** 2026-09-13.

**Verdict: substantially absorbed — 7 of 8 landed cleanly, 1 partial.** The single partial is a residue inside the weights contract itself, not a spine defect: the contract removed the uncatalogued-id hard error in three of four places and left the fourth standing. Separately, the PRD is now materially behind the spine — AD-29 and contract 4.0.0 contradict or outrun **22** locations in it, six of them severe enough to make a builder implement the wrong denominator or the wrong partition check.

Out of scope by instruction and **not re-opened**: `AGENT-WORKFLOW.md`'s rotation ordering and coverage-gate numerator/re-measurement clause, and the contract's nine-cell worked example. All three were confirmed fixed in passing and are not discussed below.

---

## Part 1 — Absorption verdicts, the eight items PRD rev 4 raised

| # | Item | Verdict |
| --- | --- | --- |
| 1 | AD-9 `lastAttemptedAt` self-contradiction | **ABSORBED** |
| 2 | OQ-14 uncatalogued id: contract vs AD-6 | **PARTIAL** |
| 3 | OQ-13 persisted price precision 2 dp vs 4 dp | **ABSORBED** |
| 4 | AD-16 median on an even sample | **ABSORBED** |
| 5 | OQ-15 under-reported revision notes | **ABSORBED** |
| 6 | AD-17 cross-kind `statId` rejection | **ABSORBED (confirms the PRD)** |
| 7 | AD-28 `Binds` omitted `sync` | **ABSORBED** |
| 8 | `WEIGHTS-FILE-SCHEMA.md` status + identity tuple | **ABSORBED** |

### 1. AD-9's self-contradiction — ABSORBED, in the PRD's direction

AD-9 now reads *"declared on every entry in all four states, and **present** wherever a request has been issued"*, and carries a dedicated paragraph: *"The one entry with neither is a never-synced entry, and it must not be given a placeholder."* It states the schema/data distinction explicitly (*"Declared in all four states is a statement about the schema, not about the data"*), names both failure modes the PRD named — rendering as an age where there is none, and handing AD-26's rotation a key that sorts wrongly against row 2's *infinitely old* treatment — and fixes the render as *"never attempted"*. It closes with *"This is the only state with no age; a `no-listings` or `unresolvable` entry that has been attempted has one"*, which is exactly PRD §3's *lastAttemptedAt* entry and FR-12.

No alternative was stated and nothing was left for the reader to reconcile. `.memlog.md` records the same resolution ("PRD item 1 RESOLVED … absorbed in the PRD's direction").

### 2. PRD OQ-14 — PARTIAL: resolved in AD-6's direction, but one contract cell was missed

**Direction:** AD-6's. The check stays `sync`'s and report-only; the file loads. That is the reading that leaves every check with an owner able to run it, and the spine argues it rather than asserting it (AD-6: *"a hard file error is `core`'s refusal at load, and `core` cannot evaluate this check at all — the base-type half needs `catalogue/items.json`, which AD-24 withholds from `web`"*).

Consistency across the four places the item named:

| Location | State |
| --- | --- |
| Spine AD-6 | **Correct** — new paragraph, *"an uncatalogued id is therefore never a weights-file refusal, and the contract must not list it as one"* |
| Contract hard-error list (`## Validation`) | **Correct** — row gone, replaced by an explicit *"An uncatalogued `statId` or `bases` key is not a file error either"* paragraph naming AD-6 |
| Contract changelog (`## 4.0.0`) | **Correct** — a dedicated row records the removal and its reason |
| PRD FR-27 | **Correct** — already followed AD-6 and needed no edit (though its pointer at the contract is now stale; see Part 2, H-4) |

**The residue — `WEIGHTS-FILE-SCHEMA.md`, `## Field rules`, the `statId` row:**

> `statId` | A trade API stat id, validated against the committed catalogue (AD-25). **An id absent from the catalogue is a hard file error, not a skip.**

That sentence is the 3.0.0 text, unamended, and it now contradicts the same document's changelog row, its validation section, and AD-6 — inside one file, roughly 25 lines apart. The failure mode is real rather than cosmetic: `## Field rules` is the table a `contracts` author builds the Zod schema from, and it is the more implementation-shaped of the two surfaces. A builder reading it would emit a `core`-side refusal for a check `core` demonstrably cannot run on the base-type half, reproducing exactly the defect OQ-14 raised.

Note also the `bases` key row immediately above it (*"validated against the committed catalogue (AD-25)"*) reads ambiguously in the same direction, though it stops short of naming a hard error. Both should point at AD-6 and say *report-only, in `sync`*.

This is the only place any of the eight items failed to land completely, and it is a one-line fix in a companion.

### 3. PRD OQ-13 — ABSORBED

The Consistency Conventions' *Numeric precision* row now reads *"Persisted divine prices are numbers rounded to **2 decimal places** at the point of normalisation"*, with FR-23's own justification carried across (0.01 divine is comfortably finer than the 0.25 early-endgame threshold, so no realistic price rounds to zero) and the explicit note that *"four decimals were more precision than an asking-price estimate has"*.

Better than asked for: the row also records the knock-on the PRD flagged as the reason to do this rather than leave it — *"Coarser rounding makes exact ties between listing prices commoner, which is part of why AD-16's even-sample median rule has to be stated rather than left to the implementer."* The two amendments (this row and AD-16) now cite each other, so neither can be reverted in isolation without the other reading oddly.

### 4. AD-16's even-sample median — ABSORBED, not overruled

AD-16 carries a new paragraph: *"On an even sample the median is the lower of the two middle values, never their mean."* All three of FR-21's reasons are carried verbatim in substance — every persisted price stays a price someone actually asked rather than a synthetic midpoint; it lands on the 2-decimal grid with no second rounding step; it leans conservative in the same direction as the ascending sort — together with the PRD's framing that ten results makes this the normal path rather than an edge case, and that it sits inside the one definition the brief calls *"the product; everything else is presentation."*

### 5. PRD OQ-15 — ABSORBED, and the corrected lists are right

Both banners now carry a parenthetical naming what they originally omitted and citing OQ-15. Cross-checked against `.memlog.md`, which is the authority:

**Revision 3.** Memlog closing entry: *"ADs amended in place: AD-9, AD-11, AD-12, AD-18, AD-19, AD-21, AD-24, AD-26, AD-27. No AD added."* Spine banner now: *"AD-9, AD-11, AD-12, AD-18, AD-19, AD-21, AD-24, AD-26 and AD-27 are amended in place and no AD is added."* **Exact match, nine ADs.**

The banner's body is internally consistent with its own list: it attributes AD-26, AD-27, AD-11 and AD-18 to the PRD items, then *"Four more were amended by the revision's own reviewer gate: **AD-9** … **AD-12** … **AD-21** … and **AD-24**"* — four plus AD-19 from the earlier sentence, totalling the nine. Nothing is named in the list that the body does not justify.

**Note, as flagged: the PRD's own revision-3 list was itself incomplete.** PRD §10 OQ-15 gives *"AD-9, AD-11, AD-12, AD-18, AD-19, AD-21, AD-26 and AD-27"* — eight, **omitting AD-24**. The spine did not copy the PRD's list; it went back to the memlog and recovered AD-24 (the rev-3 closing gate fix that names `data/currencies.json` among the files `web` does not fetch and closes the set at eight). The spine's list is right and the PRD's is wrong, which means the correction runs in the unusual direction — the PRD's own OQ-15 text needs amending, not just retiring. Carried as H-5 below.

**Revision 4.** Memlog: *"ADs amended in place: AD-5, AD-10, AD-11, AD-16, AD-17, AD-18, AD-27. AD-28 added."* Spine banner now: *"AD-5, AD-10, AD-11, AD-16, AD-17 and AD-18 and AD-27 are amended in place and AD-28 is added"* (rendered as *"AD-5, AD-10, AD-11, AD-16, AD-17, AD-18 and AD-27"*), with the parenthetical *"this note originally omitted AD-17 and AD-27, both of which carry amended text."* **Exact match.** This one agrees with the PRD's list as well.

Spot-checked that the five recovered ADs do carry amended text: AD-9 (rev-3 `lastAttemptedAt` stamping rule), AD-12 (`pinned` spends per chunk), AD-21 (`web` removed as a reader of `currencies.json`), AD-24 (`currencies.json` named, set closed at eight), AD-17 (rev-4 `valueless` branch in `slotOverlap`), AD-27 (rev-4 coverage re-measurement clause). All six present.

### 6. AD-17's cross-kind `statId` rejection — ABSORBED, confirming the PRD

AD-17 now splits the rejection explicitly: *"`contracts` owns the **within-file** case … **Kind agreement *between* files is `core`'s, at load**."* It gives the reason in the PRD's own terms — the weights schema has no view of the tracked list — and files the check with AD-18's straddle and edge-alignment rules and the new `coOccur` branch, *"for the same reason AD-6 gives: a check belongs to the component that holds both sides of it."*

This confirms PRD FR-16's assignment rather than correcting it. FR-16 needs no edit on this point.

### 7. AD-28's `Binds` omitted `sync` — ABSORBED

`Binds: contracts, core, sync, weights producers`. The band-unit clause now says so in its own text as well (*"This clause binds `sync`, not only the producer: `sync` is what puts a cell edge into a stat filter"*), so the `Binds` line and the rule body agree rather than the header carrying the fix alone.

### 8. `WEIGHTS-FILE-SCHEMA.md` — ABSORBED, both halves

**Status.** Front matter is `status: final`, and the 4.0.0 changelog records the change with its reason: *"The contract had been shipping breaking revisions against a live producer while still labelled a draft. It tracks the spine, which is `final`."*

**Identity tuple.** Both occurrences are corrected to AD-5's three-tuple:

- `## What the file is and is not`: *"carrying AD-5's canonical modifier identity — `(statId, valueMin, valueMax)` for a banded entry, `(statId)` for a valueless one"*, followed by a new paragraph drawing the distinction the PRD asked for — *"An entry is **located** by more than it is **identified** by"* — which handles `itemLevelMin` and the new `sourceModifierId` in one stroke.
- `## Field rules`, `valueMin` + `valueMax`: *"With `statId` these are the canonical modifier identity (AD-5) — a **three**-tuple; `itemLevelMin` locates the entry's cohort and is not part of it."*

The uniqueness key is now separately stated as a six-tuple in the hard-error list — `(sourceModifierId, statId, kind, valueMin, valueMax, itemLevelMin)` — and is correctly no longer called an identity. That is the right shape of fix: the PRD's complaint was the conflation of *uniqueness key* with *identity*, and the two are now named differently in different places.

---

## Part 2 — Where the PRD (rev 4, final) now contradicts the amended spine

Revision 5 adds **AD-29** and raises the contract to **4.0.0** (breaking). The PRD was written against rev 4 and contract 3.0.0 and has no knowledge of source modifiers. Below, each item carries its PRD location, what it currently says, what it needs to say, and a severity.

**Severity key.** *Severe* — a builder following the PRD implements something the spine forbids, or the PRD states a fact that is now false in a way that changes code. *High* — the PRD is stale in a way a reader will act on, but the error is visible. *Medium* — a required addition the PRD is silent about. *Low* — bookkeeping.

Counts: **6 severe, 7 high, 6 medium, 3 low — 22 items.**

### Severe

**S-1 — FR-16 (§4.5): the overlap predicate is missing the `coOccur` branch, and states its negation.**
*Currently:* FR-16's `slotOverlap` reads `false if x.statId != y.statId`, unconditionally, with the accompanying text naming the both-valueless branch as *"the one not derivable from a bands-intersect reading."*
*Needs:* AD-17's amended predicate, with the co-occurrence branch above the inequality case:

```
slotOverlap(x, y) =  true              if x is absent or y is absent
                     true              if x.statId != y.statId ∧ coOccur(x, y)
                     false             if x.statId != y.statId
                     true              if both are valueless
                     bands intersect   otherwise
```

plus AD-29's definition — `coOccur(x, y)` holds when some `sourceModifierId` in the scoped pool emits an entry contained by `x` and an entry contained by `y` in the same item-level cohort — and the statement that it is a **cross-file** check owned by `core` at load, like FR-29's straddle and edge-alignment rules. This is the highest-consequence item in the list: a builder implementing FR-16 as written lets a base whose two tracked entries name two lines of one hybrid modifier reach `ΣP > 1` and take the top of the ranking, which is precisely the class of defect FR-16 exists to prevent and which its own prose boasts of having caught twice.

**S-2 — FR-29 (§4.8): the denominator sums over entries, not over source modifiers.**
*Currently:* *"Both numerator and denominator are drawn from the same item-level-scoped pool, scoped to the entry's Item Level Floor `L`: `{ band ∈ pool(base, slot) : band.itemLevelMin <= L }`"*, with no distinction between the two halves beyond scope.
*Needs:* AD-18's amended ratio. The numerator sums over **entries** in the containment set; the denominator sums over distinct **`sourceModifierId`** — `Σ { mass(g, L) : g ∈ sources(scoped(base, slot, L)) }`, where `mass(g, L)` is the common per-`statId` sum of `g`'s scoped entries. With the reason: an affix draw selects a *modifier*, so a modifier publishing several stat lines contributes its weight once; summing the denominator over entries inflates it by each hybrid's surplus lines and understates every probability on the base, **unevenly**, so it reorders the ranked list rather than shifting it. Note that for a pool of single-stat modifiers the two readings coincide exactly — which is why a builder can implement FR-29 as written, pass every test built from a single-stat fixture, and be silently wrong on 560 of 8,437 real rows.

**S-3 — §3 *Modifier Weight* and FR-27: the entry shapes omit the required `sourceModifierId`.**
*Currently:* both give *"`(statId, kind, valueMin, valueMax, itemLevelMin, weight, provenance)` banded, `(statId, kind, itemLevelMin, weight, provenance)` valueless."*
*Needs:* `sourceModifierId` added to **both** shapes, as **required on every entry** — not hybrid-only. The contract's reason should come with it: required everywhere so `core` has one identity notion rather than two code paths, and so a producer forgetting it on a hybrid cannot emit a file that still validates. A producer building to the PRD's tuple emits a file `core` refuses at load.

**S-4 — FR-27 (§4.8): the hard-error list is stale in four ways.**
*Currently:* the list carries *"a duplicate `(statId, kind, valueMin, valueMax, itemLevelMin)` within a slot"*, *"overlapping value bands for one `statId` at the same `itemLevelMin`"*, and *"a cell carried by more than two cohorts"*, and has no group-consistency entry.
*Needs:* four corrections against the contract's 4.0.0 `## Validation` section —
1. duplicate key becomes `(sourceModifierId, statId, kind, valueMin, valueMax, itemLevelMin)`;
2. non-overlap is scoped by `sourceModifierId` **as well as** `itemLevelMin` — two distinct game modifiers may legitimately publish the same stat over the same values, and refusing that file would force a producer to merge them, destroying the co-occurrence marker on both;
3. **new error:** a missing `sourceModifierId`;
4. **new error:** a `sourceModifierId` group whose per-`statId` weight sums disagree within one `itemLevelMin` cohort — the same shape and reason as `cohortTotals`, and the only mechanical check on the explosion.
Also scope the cohort-carriage error to `(base, slot, statId, sourceModifierId)`.

**S-5 — Contract version: the PRD says 3.0.0 in four places, and 4.0.0 is breaking.**
*Currently:* §3 *Weights File* (*"at contract version **3.0.0**"*), FR-27 (*"schema **3.0.0**, breaking"* and *"Hard file errors reject the file outright (schema **3.0.0**)"*), FR-27's *"A producer building to a 1.x or 2.x shape emits a file that `core` refuses"*, and §10 BQ-2 (*"Weights File schema 2.0.0 — 3.0.0 at the current revision"*).
*Needs:* 4.0.0 throughout, and the refusal clause widened to **1.x, 2.x or 3.x**. This is severe rather than bookkeeping because §7.3 names the Weights File a release dependency from a near-complete external project: a 3.0.0 file that was in flight when rev 5 landed is now refused at load, and the PRD is the document that project's owner reads for the version number.

**S-6 — §3 *Eligible Pool*: the denominator is characterised as the scoped set of cells.**
*Currently:* *"The pool is **scoped** to a Tracked Entry's Item Level Floor before it normalises anything, and **the scoped pool is the denominator** of every probability for that entry (AD-18, FR-29)."*
*Needs:* the scoped pool is the *domain* the denominator is computed over, but the denominator is the sum of **source-modifier masses** within it, not the sum of its cells. As written, the glossary — which this PRD declares normative for every FR that uses the term — states the defect AD-29 exists to remove, and it states it in the one place a reader goes to settle a disagreement.

### High

**H-1 — §3 Glossary: there is no entry for the source modifier.**
*Currently:* silent. The glossary defines Modifier Reference, Modifier Weight, Cohort, Eligible Pool and `cohortTotals`, but AD-29's central concept has no term.
*Needs:* a **Source Modifier** entry (and/or **`sourceModifierId`**, matching the `lastAttemptedAt` and `cohortTotals` precedent of naming the field). It must carry: one game modifier may publish several distinct trade stats under one spawn weight, rolled as a unit; the producer emits one entry per stat line each carrying the row's **full** weight; `sourceModifierId` is producer-assigned, opaque, stable within one `(Base Type, slot)`, never validated against the Trade Catalogue, and **never part of a Modifier Reference, a Tracked Entry or its canonical key**. This is High rather than Medium because §0 commits the document to being glossary-anchored and to FRs using glossary terms verbatim — S-1 through S-4 cannot be written without this term existing.

**H-2 — §0 Document Purpose: the inherited spine is described as revision 4, AD-1 through AD-28.**
*Currently:* *"`ARCHITECTURE-SPINE.md` is final at revision 4, and its decisions AD-1 through AD-28 are **inherited, not re-decided**"*; *"Revision 4 added **AD-28** … and raised the Weights File contract to **3.0.0**, breaking; revisions 3 and 4 amended a further thirteen decisions in place, listed at §10 OQ-15"*.
*Needs:* revision 5, AD-1 through AD-29, contract 4.0.0; a sentence for what revision 5 added (AD-29) and amended (AD-5, AD-6, AD-9, AD-11, AD-16, AD-17, AD-18, AD-28); and the *"thirteen decisions"* arithmetic recomputed. The AD-id stability claim still holds and should be retained as-is.

**H-3 — §10 OQ-13 is listed as open; it is resolved in the PRD's favour.**
*Currently:* under *"Open — raised against the spine by this revision"*, with *"the spine's Consistency Conventions still say 'rounded to 4 decimal places'."*
*Needs:* move to a resolved section. The conventions row now says 2 dp, adopting FR-23, and additionally records the tie-frequency knock-on OQ-13 flagged. The retained record should note that the resolution went the PRD's way on a player product decision.

**H-4 — §10 OQ-14 is listed as open, and FR-27 asserts a disagreement that no longer exists.**
*Currently:* OQ-14 open; and FR-27 states *"**`WEIGHTS-FILE-SCHEMA.md` disagrees** and states it as a hard file error — see §10 OQ-14."*
*Needs:* OQ-14 moves to resolved, recording the direction (AD-6's — the check is `sync`'s and report-only, the file loads, because a hard file error is `core`'s refusal and `core` never holds `catalogue/items.json`) and the rejected alternative (file-refusal, which would need AD-24 amended to fetch a ninth artifact). FR-27's *"disagrees"* clause must go or invert — the contract now agrees, and a reader acting on the stale sentence would go looking for a contradiction that has been fixed. *(Caveat: the contract's `## Field rules` `statId` row is the one place still carrying the old text — Part 1 item 2. Whoever applies this edit should confirm that row was fixed first, or the PRD sentence becomes accidentally true again.)*

**H-5 — §10 OQ-15 is listed as open, and its own revision-3 list is wrong.**
*Currently:* OQ-15 open, giving revision 3 as *"AD-9, AD-11, AD-12, AD-18, AD-19, AD-21, AD-26 and AD-27"* — eight ADs, **omitting AD-24**.
*Needs:* move to resolved, **and correct the list on the way**: the memlog's rev-3 closing entry names nine, including AD-24 (the gate fix that names `data/currencies.json` among the files `web` does not fetch and closes the set at eight). The spine's corrected banner is right and the PRD's list is not. The revision-4 list is correct and needs no change. Worth recording that the spine went back to the memlog rather than copying the PRD — that is why the discrepancy surfaced.

**H-6 — FR-23's `[NOTE FOR PM]` claims to supersede the spine.**
*Currently:* *"This **supersedes the spine's Consistency Conventions**, which specify 4 decimal places. The decision is the player's and is recorded here, but the convention is the spine's to change — see §10 OQ-13."*
*Needs:* delete or rewrite. The spine now specifies 2 dp and cites the same reasoning. A `contracts` author reading this note would still expect a conflict and might resolve it the wrong way, or waste the review cycle it was written to trigger.

**H-7 — FR-28 (§4.8): pool completeness is stated over modifiers, not stat lines.**
*Currently:* *"a `(Base Type, slot)` declaring `poolCoverage: 'complete'` must enumerate **every modifier** that can roll there **at any item level**."*
*Needs:* the contract's 4.0.0 clarification — *"Pool completeness counts stat lines, not rows. A `complete` pool enumerates every stat line every rollable modifier publishes. Emitting one line of a hybrid and dropping the other is the same defect as dropping a modifier outright."* Without it, a producer reading FR-28 alone can drop the second line of each of the 560 hybrid rows and still believe it declared `complete` honestly, which shrinks numerators without touching the denominator — the mirror of the defect FR-28's own text argues against.

### Medium

**M-1 — §3 *Modifier Reference*: silent on AD-5's new clause.**
*Needs:* AD-5's addition — *"a reference names a **stat line**, not a game modifier"* — with its consequence: a `statId` identifies what the trade filter can ask for, which is the only thing the identity has to do; the thing the game draws is the source modifier, which lives on the Weights File and never on a reference, because a curator can only filter on what trade exposes. This is the sentence that keeps a reader from concluding that `sourceModifierId` belongs on a Tracked Entry.

**M-2 — FR-1 (§4.1): the partition consequence names only band overlap.**
*Currently:* the consequences establish that summands must be mutually exclusive and point at FR-16.
*Needs:* a note that co-occurring stat lines are a second, non-obvious way for the partition to break — two references on distinct `statId`s, no bands intersecting, both satisfied by one item. It belongs here as well as in FR-16 because FR-1 is where the `ΣP ≤ 1` premise is asserted.

**M-3 — §7.2 / Deferred: the new deferred item is absent.**
*Needs:* the spine's *"Pricing a deliberate conjunction of co-occurring stats"* — a `TrackedEntry` still carries at most one `ModifierRef` per slot, so a curator cannot express *"I want both lines of this modifier"*; the two-entry spelling is correctly rejected as an overlap; the data to support it exists from day one (the probability is the one source modifier's weight, not a product); deferred because it widens `ModifierRef` from a field to a set and touches AD-5, AD-16, AD-17 and AD-18 at once. Recording it matters because the deferral is *why* FR-16 rejects a configuration a curator will plausibly try.

**M-4 — §7.3 Release Dependencies: silent on the 4.0.0 break against a near-complete producer.**
*Currently:* *"The project is near completion, and the dependency is **accepted rather than worked around**."*
*Needs:* a note that the contract has taken a second breaking revision since (3.0.0 → 4.0.0) and that a file emitted to 3.0.0 is refused at load — the producer must add `sourceModifierId` to every entry and satisfy the group-consistency rule. This is the PRD's own release-gating section; a break in a stated release dependency belongs in it.

**M-5 — FR-16 (§4.5): the "three consequences" list should become four.**
*Currently:* three consequences, *"the third of which the earlier enumeration missed"* (the prefix-only/suffix-only case).
*Needs:* a fourth — two entries in **one** slot naming two lines of one source modifier, which no bands-intersect or slot-conjunction reading catches, and which the predicate now catches only via `coOccur`. Worth stating in the same rhetorical register the FR already uses: it is the same failure as the third case, reached from the other direction.

**M-6 — FR-22 (§4.6): the curation rules do not mention co-occurrence.**
*Needs:* a consequence telling the curator that two Modifier References naming two stat lines of one source modifier cannot both be tracked in one slot — it is a load-time rejection under FR-16, not a budget question — and that isolating such a conjunction is deferred (M-3). FR-22 is where a curator learns what they may author; this is a new thing they may not.

### Low

**L-1 — §0: "Two further rounds have since closed."** Three have. Update the count and add a sentence for revision 5, mirroring the existing rev-3 and rev-4 sentences.

**L-2 — §10 preamble: "OQ-12 through OQ-14 are open and each has a named owner outside this document."** After H-3/H-4/H-5 only **OQ-12** is open, and it alone is owned outside the repository; OQ-13/14/15 were architecture-owned and are now closed. The preamble's own framing (*"Live items first, then the record"*) needs the sentence narrowed to OQ-12.

**L-3 — §3 *Base Type* / the ids convention: no reflection of the `sourceModifierId` exception.** The spine's Consistency Conventions now carry an explicit carve-out — `sourceModifierId` is the one id that is *not* a trade API identifier, is producer-owned and opaque, is never validated against the catalogue, and *"never appears on a `ModifierRef`, a `TrackedEntry` or its canonical key."* The PRD's §3 *Base Type* entry still states the flat rule (*"Never re-encoded into an internal id (AD-5)"*) with no exception noted. Low because the PRD does not restate the conventions table, but a reader could reasonably read the flat rule as forbidding the new field.

---

## Notes for whoever applies Part 2

- **Apply S-1, S-2, S-3 and S-4 as one pass.** They are four faces of AD-29 and the contract's 4.0.0, and applying any one alone leaves the PRD internally inconsistent (e.g. FR-29's denominator de-duplicating on a field FR-27's entry shape does not require).
- **H-1 sequences ahead of the severes.** The glossary term has to exist before FR text can use it verbatim, which §0 requires.
- **H-5 is a correction, not a retirement.** Unlike OQ-13 and OQ-14, the PRD's OQ-15 text carries a factual error of its own, and closing it without fixing the list would preserve the error in the record.
- **Nothing in Part 2 is a request for an architecture decision.** Every item is the PRD catching up to a settled amendment; none requires the spine to rule on anything. The one live architecture action is the Part 1 item 2 residue in `WEIGHTS-FILE-SCHEMA.md`'s `## Field rules`.
