---
title: 'Citation Audit — PRD revision 5 (applied citations)'
date: '2026-09-13'
targets:
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/addendum.md
sources_of_truth:
  - ARCHITECTURE-SPINE.md (final, revision 5, AD-1…AD-29)
  - WEIGHTS-FILE-SCHEMA.md (schemaVersion 4.0.0, final)
  - AGENT-WORKFLOW.md
---

# Citation Audit — PRD rev 5

Every `(AD-n)` citation and every companion-document citation in `prd.md` and `addendum.md`
was checked literally against the cited source text.

## Counts

| Class | Count |
| --- | --- |
| Citation instances examined | 418 (361 `AD-n` in `prd.md`, 43 in `addendum.md`, 14 companion-document references) |
| **CORRECT** | 411 |
| **WRONG** | 3 |
| **MISATTRIBUTED** | 2 |
| **UNLABELLED EXTENSION** | 2 |

Correct citations are not listed individually.

## Targeted verifications requested

- **Every clause attributed to AD-29** — checked one by one (§3 *Base Type*, §3 *Modifier
  Reference*, §3 *Modifier Weight*, §3 *Source Modifier*, §3 *Cohort*, §3 *Eligible Pool*,
  FR-1, FR-16, FR-22, FR-27 ×4, FR-28, FR-29, §7.3). All are in AD-29 **except** FR-28's
  *"Completeness counts stat lines, not rows"*, which is the contract's clause (defect D-4).
- **FR-16's `slotOverlap` vs AD-17** — identical, branch for branch, in order (absent →
  `statId` differ ∧ `coOccur` → `statId` differ → both valueless → bands intersect).
  `coOccur`'s definition, its `L` scope, and its cross-file ownership all match AD-17.
  **CORRECT.** (The bullet *after* the predicate is defective — D-2.)
- **FR-29's denominator vs AD-18** — `Σ { mass(g) : g ∈ sources(scoped(base, slot, L)) }`
  matches AD-18 verbatim; `sources(S)` and `mass(g)` are worded as AD-18 words them, and
  FR-29 correctly states that **`mass(g)` carries no `L`**, following AD-18 rather than
  AD-29's `mass(g, L)`. §10 OQ-16 accurately records that divergence in the spine.
  **CORRECT.**
- **FR-27's hard-error list vs the contract's `## Validation`** — item-for-item match, in
  the same order, with no additions and no omissions: unknown `schemaVersion` major;
  missing/unrecognised `kind` or one `statId` under both kinds; edges present on a
  `valueless` / missing, `null` or non-numeric on a `banded`; duplicate
  `(sourceModifierId, statId, kind, valueMin, valueMax, itemLevelMin)`; overlap at same
  `itemLevelMin` **and** same `sourceModifierId`; missing/negative `weight`; missing
  `itemLevelMin`; missing `sourceModifierId`; missing `poolCoverage`;
  `provenance: "absent"`; missing/empty `gamePatch`; missing `cohortTotals` row or a
  cohort whose cells do not sum; per-`statId` sums disagreeing within a group; a cell
  carried by more than two cohorts. The contract's two non-errors (uncatalogued id,
  straddle) are correctly stated as non-errors. **CORRECT.**
- **§3 *Source Modifier* vs the contract's `sourceModifierId` field rule and AD-29** —
  required on every entry; one source row = one tier, never a family; stable within one
  `(baseTypeId, slot)`; a group sits in exactly one cohort; producer-assigned and opaque;
  never catalogue-validated; never part of a reference, entry or canonical key; read by
  `core` for exactly two purposes (denominator de-duplication, co-occurrence detection).
  **CORRECT.**

## Defects

### D-1 — WRONG — `prd.md` §0 *Document Purpose*, third blockquote paragraph

> "Revision 5 answered the **eight items this PRD's revision 4 raised back against the
> spine** — seven of them in the PRD's own direction …"

ARCHITECTURE-SPINE.md's revision-5 banner says: *"Absorbs the **five items PRD revision 4
raised back against this spine**, **three smaller drifts alongside them**, and a second
defect the weights-file producer raised against the contract."* The spine attributes only
five of the eight to the PRD; the other three are the spine's own drifts. The PRD's
count of PRD-raised items contradicts the cited banner. (§10 OQ-13's "the one item of the
eight" inherits the same miscount.)

### D-2 — WRONG — `prd.md` FR-16, bullet *"Where the pool cannot answer, `coOccur` is `false`…"*

> "A Base Type absent from the Weights File, one whose pool is `partial`, **and the
> uniform-prior bootstrap** all leave the branch with no reading … (AD-17, AD-18)"

AD-17 names exactly two cases: *"A base absent from `weights.json`, or one whose pool is
`partial`, has no reading of this branch."* The uniform-prior bootstrap is a third case
the PRD adds under an AD-17 citation, and it is substantively wrong: under contract 4.0.0
a uniform-prior file is a conforming file that still carries genuine pool membership,
cell edges, `itemLevelMin` **and a required `sourceModifierId` on every entry**
(*The uniform-prior bootstrap*; `sourceModifierId` field rule; FR-30). `coOccur` is
therefore fully evaluable against such a file, and such a base may declare
`poolCoverage: "complete"` and rank — so the bullet's own safety argument ("FR-28 and
FR-4 have already made such a Base Type Unrankable") does not hold for it. A builder
following this bullet would short-circuit `coOccur` to `false` on precisely the file the
product develops against, admitting the double-count FR-16 exists to reject.

### D-3 — WRONG — `addendum.md`, *The Three Blocking Defects* → BQ-1 → *"Why a band fixes it"*

> "The Weights File already models bands exactly this way (`valueMin` / `valueMax`,
> **non-overlapping, straddling forbidden**) …"

Under WEIGHTS-FILE-SCHEMA.md 4.0.0 neither half holds as stated: non-overlap is scoped to
entries sharing a `statId`, an `itemLevelMin` **and** a `sourceModifierId` (AD-28, AD-29),
and a **straddle is explicitly not a file error** — it is a cross-file condition reported
against the tracked entry, in `core` (contract *## Validation*, AD-18). The addendum's own
convention ("where a later spine revision moved an analysis again, a second bold note
follows and names that revision") is not honoured here: BQ-1's *Narrowed by spine revision
4* note addresses the tier/value axis only and leaves this sentence uncorrected, and no
revision-5 note follows. `prd.md` FR-27 states the current position correctly, so the two
documents disagree.

### D-4 — MISATTRIBUTED — `prd.md` FR-28, bullet *"Completeness counts stat lines, not rows"*

Cited `(AD-11, AD-29)`. The claim is true, but it is stated only in
WEIGHTS-FILE-SCHEMA.md (*A row that publishes several stats at once* → "**Pool
completeness counts stat lines, not rows.** … Emitting one line of a hybrid and dropping
the other is the same defect as dropping a modifier outright"). AD-29 governs the
explosion and the denominator but says nothing about pool completeness; AD-11 says nothing
about it either. The contract should be cited alongside (FR-27 cites it by name for
comparable material).

### D-5 — MISATTRIBUTED — `prd.md` FR-29, bullet *"Both numerator and denominator are drawn from the same item-level-scoped pool…"*

> "The conditional is written `P(modifier | base, slot, itemLevel)` (AD-18)."

AD-18 writes the conditional as **`P(ref | base, slot, L)`**. The
`P(modifier | base, slot, itemLevel)` spelling is WEIGHTS-FILE-SCHEMA.md's (*What the file
is and is not* → "It is not probabilities"). Beyond the wrong source, the spelling is the
one AD-5 and AD-29 exist to separate: a reference names a **stat line**, not a modifier,
and a denominator sums over modifiers while a numerator sums over stat-line entries. FR-29
elsewhere makes that distinction correctly, so this sentence reads against its own FR.

### D-6 — UNLABELLED EXTENSION — `prd.md` §3 Glossary, *Sync Report*

> "…requests consumed per declared source (FR-14), unresolvable entries, **entries not
> reached in this Chunk**, pinned-starvation records, the measured pool-coverage fraction
> (FR-4), and the date of the last tracked-list edit (AD-12, AD-23, AD-26, AD-27)."

No AD requires *entries not reached in this Chunk*; FR-25 correctly labels it ("This field
is **this PRD's own addition** — no architecture decision requires it"). The glossary
entry lists it inside a set attributed wholesale to four ADs, with no label — the same
omission FR-25 takes care to avoid.

### D-7 — UNLABELLED EXTENSION — `prd.md` §3 Glossary *Price State* / FR-9, the `not-yet-synced` reason enum

AD-9 defines four price states and no reason field anywhere; nothing in the spine or the
contract carries `never-synced` / `league-mismatch` / `no-exchange-rate`. The reason enum
is the PRD's own addition and is load-bearing downstream (FR-12, FR-17, FR-23, FR-31), but
it carries no "this PRD's own addition" label in either place — unlike the comparable
additions at FR-25 (starvation-record fields), FR-25 (entries not reached) and NFR-10
(colour-alone extension), which are all labelled. Lower severity than D-6 because the
bullet cites no AD, but the document's own labelling convention is not met.

## Notes (checked, not defects)

- §3 *Base Type* and *Modifier Reference* attribute the `sourceModifierId` flat-ids
  carve-out and the "never on a `TrackedEntry` or its canonical key" rule to AD-5/AD-29;
  the literal text is in the spine's **Consistency Conventions** *Ids* row, which itself
  cites AD-29. Accepted as correct.
- FR-31's "`data/config.json` carries exactly three things" extends AD-19's "the active
  league … and `minChunkSearches` and nothing else" with `schemaVersion`; the extension is
  labelled in-line ("required of every artifact by NFR-8"). Accepted as correct.
- §10 OQ-15's three revision lists match the spine's corrected banners exactly
  (rev 3: nine, rev 4: seven + AD-28, rev 5: nine + AD-29), and §0's "fifteen decisions
  amended in place across revisions 3–5" is the correct union.
- §10 OQ-16 is accurate: AD-29 does still write `mass(g, L)` while AD-18 writes `mass(g)`
  and states it carries no `L`.
