---
title: 'Reconciliation — PRD revision 4 against PRD-EDIT-PROPOSALS C-22…C-52'
status: final
created: '2026-09-13'
targets:
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/addendum.md
sources:
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/PRD-EDIT-PROPOSALS.md (Revision 3, §9–§13; Revision 4, §16–§20)
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/extract-reviews-rev34.md
---

# Reconciliation — C-22…C-52

The PRD was updated to `revision: 4` (front matter `updated: 2026-09-13`) and the addendum
likewise. This reconciles that update against the Revision 3 (C-22…C-32) and Revision 4
(C-33…C-52) proposal sets.

**Result: 31 items — 29 LANDED, 1 PARTIAL (C-47), 0 MISSED, 1 SUPERSEDED (C-32, correctly).**

The five deliberate decisions named in the reconciliation brief were each verified against the
text rather than assumed; all five were carried out as intended. Details in §3.

---

## 1. Item-by-item

### Revision 3 — C-22…C-32

| Id | Status | Where found | Notes |
| --- | --- | --- | --- |
| **C-22** | LANDED | FR-17 (`prd.md:373-405`), §3 *`lastAttemptedAt`* | All four parts. **(a)** Both `[NOTE FOR PM]` callouts are gone — a full-file search finds `[NOTE FOR PM]` only at §0 (a new one, about spine bookkeeping), FR-18 and §7.2; none in FR-17. **(b)** The cap is a two-row table with a **Where / Owner / Rule** shape (`:396-399`), carrying the load-time inequality `count(pinned) + currencyStepSearches ≤ 0.5 × config.minChunkSearches`, the `currencyStepSearches`-is-not-a-row-count clause, the runtime truncate-and-reserve, the starvation record, and *"It is **not an error and does not change the exit code**."* AD-26's "why neither half alone" sentence is retained at `:401`. **(c)** Row 1 carries the sort key — *"**by oldest `lastAttemptedAt` first**"* — with AD-26's rationale about the pinned tail rotating rather than starving (`:382`). **(d)** The `unresolvable` bullet is rewritten to AD-26's account (`:387-390`): the two definitions, then the narrow residue. *"Paces re-checking"* is gone and replaced by *"the bound paces no re-validation and suppresses no reporting."* |
| **C-23** | LANDED | FR-29 (`prd.md:606-615`), §3 *Modifier Reference* (`:71`) | Edge-alignment adopted verbatim, both formulas, with the sentinel-`9999` and sentinel-floor argument, *"a **validation error against `data/tracked.json`** — not a wide band, and not a file error"*, and the cross-file/`core`-at-load ownership sentence (`:614`). §3 extends the `valueMax` sentence as proposed. Correctly scoped to `banded` per C-38 — see §3 below. FR-29 also adds the floor-dependence note (`:615`), beyond what the proposal asked. |
| **C-24** | LANDED | §3 *`lastAttemptedAt`* (`prd.md:84`) | *"when `sync` last **issued a request** … **Offline work never stamps it**"*, with the flattening argument and the FR-24 catalogue-check exception named. The rest of the entry (all four Price States, distinct from `observedAt`, `no-listings` has an age) is retained. FR-12's *"from its `observedAt` … and from its `lastAttemptedAt` otherwise"* bullet stands at `:298`. |
| **C-25** | LANDED | FR-19 (`prd.md:431-433`, `:436`) | The consequence is present and is stated bidirectionally (*"An implementation that lets it cap, pace or shorten a Chunk has violated **this FR**; one that reads it anywhere but tracked-list validation has violated **FR-17**"*). The **[post-review]** cadence paragraph landed in full at `:432` — `600:21600` as 100/hour sustained, `30:300` as burst, the ~18-minute interval, the **8-not-30** figure, `sustainedRate × interval`. FR-19's closing *"the syncer assumes nothing about what invokes it"* is retained and explicitly reconciled at `:436`. |
| **C-26** | LANDED | FR-25 (`prd.md:518-522`), §3 *Sync Report* (`:109`) | Fifth record added to both. The field set from rev-3 adversarial finding 10 is carried in full — `declaredMinChunkSearches`, `discoveredAllowance`, `pinnedCount`, `currencyCost`, `pinnedRefreshed`, `activeRefreshed`. Distinctness from *entries not reached* is stated with AD-26's "indistinguishable from a slow refresh" argument (`:520`), and the provenance difference is kept (*not reached* flagged as *"this PRD's own addition"* at `:522`). The **[post-review]** `web` render obligation landed at `:521`, beside FR-18's age and FR-24's unresolvable count. |
| **C-27** | LANDED | FR-4 (`prd.md:163-193`) | Both predicates inserted verbatim in a code block; denominator narrowed with the raw-only and `pruned`-only exclusions and the both-raw-and-crafted inclusion (`:179`); numerator's three conditions each argued, including the vacuous-truth and empty-pool gaps and the 100%-or-40% consequence (`:180`). The decidable-from-`tracked.json`-alone sentence landed at `:181` with the `unresolvable` warning — this was rev-3 adversarial finding 12, which the reconciler's version of C-27 did not carry. |
| **C-28** | LANDED | FR-33 (`prd.md:673-676`) | The non-fetched list is now **four**, with `data/currencies.json` and AD-21's reason. `:674` goes further than proposed by naming both rules that depend on the omission. The refusal rule is qualified at `:676` in the proposal's own words, FR-17's cap is named as such a check with `sync` as sole owner, and FR-29's edge-alignment and straddle errors are added to the same class. |
| **C-29** | LANDED | FR-31 (`prd.md:647`), §3 *Chunk* (`:107`) | Three fields, per the deliberate decision — see §3 below. Per-field readers are named, player-ownership and `web`'s validate-but-not-read position are stated, and *"a fourth field is an architecture amendment"* closes it. `minChunkSearches` was added to §3 under *Chunk* (one of the two homes the proposal permitted). FR-19 and FR-17 knock-ons present. |
| **C-30** | LANDED | FR-14 (`prd.md:333`, `:335`) | The foreclosing clause is in the fifth-source bullet. The **[post-review]** ceiling bullet landed at `:335` with the every-Chunk-vs-once-per-refresh contrast, cadence-scaling, the ~2,400/day share, and *"`pinned` is a scarce designation rather than a convenience."* FR-14's four-source table is unchanged, correctly. |
| **C-31** | LANDED | §10 (`prd.md:795-802`) | Retitled *"Raised against the spine by this revision — resolved by spine rev 3 and rev 4"*. All four analyses retained, each with a **Resolved:** clause naming the amended AD and the resolving text. **Owner: architecture** annotations are gone (a full-file search finds no occurrence). The two hazardous bodies are defused by tense: OQ-8 now reads *"AD-26 **capped** … but"* and closes with *"The 25% figure is gone from the spine entirely"*; OQ-10 reads *"The gate **divided** by every distinct `baseTypeId`"*. OQ-11 carries the syntactic-not-semantic caveat and points at FR-29. |
| **C-32** | SUPERSEDED | — | Correctly absent as a separate edit; only C-47's single combined §0 edit appears. See §3. |

### Revision 4 — C-33…C-52

| Id | Status | Where found | Notes |
| --- | --- | --- | --- |
| **C-33** | LANDED | §3 *Provenance* (`prd.md:96-105`) | Four-value total order as a ranked table, weakest first, with per-value meaning and *"arises from"* columns. `absent`-from-`partial`-only and `modelled-split`-from-AD-28-only are both stated. The adversarial A-6 addition landed too: explicit integer ranks, plus the warning that `WEIGHTS-FILE-SCHEMA.md` lists the values in the opposite order and `minBy(enumIndex)` would yield `measured` as weakest. |
| **C-34** | LANDED | §3 *Modifier Reference* (`prd.md:71`) | Two-kind union with `kind` as discriminant; `valueMax`-required scoped to `banded`; AD-5's *"not a degenerate band"* sentence with the `1/1` sentinel argument; valueless still carries `weight` and `itemLevelMin` and counts toward pool completeness. |
| **C-35** | LANDED | FR-27 (`prd.md:554`, `:557-571`) | Version re-pinned to **3.0.0** (breaking) in both places. Hard-error list replaced wholesale; the overlap error is scoped *"**at the same `itemLevelMin`**"* with the cross-cohort legality stated inline; the duplicate key includes `kind`; edge rules are split by kind. The closing note at `:571` retains the straddle-is-the-invariant / non-overlap-is-only-a-proxy reasoning and explains why the straddle is *not* in this list. |
| **C-36** | LANDED | §3 *Accepted Tier* (`prd.md:78`), FR-22 (`:474-479`) | Split by `#`-count in both places. FR-22 carries the worked Bows partition (`[56,56.5] [57,78.5] [79,80]` against T8's 56.0–80.0), the mid-cell failure at load, the boundary-tail-is-correct argument with *"the trade search cannot isolate that tier either"*, and the request-budget reassurance at `:479`. Landed together with C-51 as §20 directed. |
| **C-37** | LANDED | §3 *Modifier Weight* (`prd.md:90`) | Cell-within-a-cohort framing, both kind-specific tuples with `provenance`, `tierLabel` display-only with the `"T7–T8"` example and *"`core` must never branch on it."* A companion *Cohort* entry was added at `:91` defining cohort membership by `itemLevelMin` **equality, never `<=`** — the rev-4 adversarial A-3 fix, beyond what C-37 asked. |
| **C-38** | LANDED | FR-29 (`prd.md:594-601`) | AD-18's two-row containment table adopted. *"Whole cells only"* note present with the `contracts`-rejects-open-top clause. The empty-containment-set error stays kind-agnostic (`:604`). The edge-alignment consequence is scoped `banded` — see §3. |
| **C-39** | LANDED | FR-16 (`prd.md:351-363`) | Four-branch `slotOverlap` code block verbatim; the both-valueless branch is called out as the non-derivable one at `:362`. The three existing consequences are retained unchanged. The M-4 caveat was heeded rather than copied: `:363` assigns the in-file mixed-kind rejection to `contracts` and the **cross-file** kind agreement to `core` at load. |
| **C-40** | LANDED | FR-21 (`prd.md:455`, `:463-464`), §11 (`:815`) | Stat filter split by kind, with the operational-sentinel argument. The multi-`#` unit trap is a bullet at `:463` pointing at OQ-12. Non-integer edges (`56.5`, half-integer lattice) at `:464`, together with A-14's honesty about the valueless filter shape being **unverified** — tagged `[ASSUMPTION]` and indexed in §11 with its OQ-12 ownership. H-4's "what does `sync` do with a half-integer edge if the filter is integer-only" is carried in OQ-12 itself (`:808`). |
| **C-41** | LANDED | FR-10 (`prd.md:267-276`), FR-11 (`:285-290`) | FR-10 gives a three-row render table, none carried by colour alone, with AD-10's reason at `:275`. FR-11's banner predicate is restated as *"no probability in the loaded set carries `measured` or `modelled-split`"*, with the does-not-trigger consequence and the decomposed-scrape example. The unresolved cross-review question (A-6 half two / H-5) is **decided rather than left open**: `:276` states `modelled-split` propagates from the **numerator only**, with the mass-conservation justification and the explicit carve-out that every other Provenance still propagates from every input. §3's Provenance entry carries the same exception. |
| **C-42** | LANDED | FR-28 (`prd.md:583-584`), §7.3 (`:744`) | Both producer-side consequences added: the unnamed `TBD` row still counts and forces `partial`, and there is deliberately no anonymous-weight field (with the hide-behind-a-scalar reason and *"an architecture amendment, not a producer convenience"*). The recorded patch-cadence cost landed in §7.3 as its own bullet. |
| **C-43** | LANDED | FR-27 (`prd.md:553`) | *"must not pre-aggregate **cells**"*, with the clause that aggregating across tiers into a cell is mandatory and across cells is forbidden *"because `core` sums cells and only cells."* |
| **C-44** | LANDED | §3 *Eligible Pool* (`prd.md:95`) | Restated as value cells, each carrying its cohort's `itemLevelMin`, with *"The same value interval may legitimately appear more than once"* and scoping as what admits each at most once. |
| **C-45** | LANDED | §3 *Weights File* (`prd.md:92`), FR-27 (`:567`), FR-10 (`:277`) | Placed under *Weights File* per the deliberate decision — see §3. Carries operator-asserted-at-run-time, never derived, never defaulted, the producer-refuses-to-run rationale, *"`core` does not parse it and must not branch on it"*, missing-or-empty as a hard file error, and the `web` surfacing beside `producer.id` / `generatedAt`. |
| **C-46** | LANDED | §10 OQ-12 (`prd.md:804-808`), §7.3 (`:742`), FR-21 (`:463`) | Added as OQ-12 in its own §10 subsection per the deliberate decision — see §3. Carries the question, the 56.5-from-averaging evidence, the two unconfirmed facts plus the third that follows, the consequence across 53 of 63 classes, *"Blocking for correctness, not for building"*, and the owner. Cross-referenced from §7.3 as the second gate and from FR-21. |
| **C-47** | **PARTIAL** | §0 (`prd.md:20`), front matter | See §2. |
| **C-48** | LANDED (folded) | §10 OQ-11 (`prd.md:802`) | Folded into C-31's retirement as intended — see §3. *"**Resolved twice over:** revision 3 removed both spellings, and revision 4 rewrote both entries again — AD-11 now gives two kind-specific shapes and AD-18 now says there is no open-top form to handle because `contracts` rejects it at the schema."* The syntactic-closure caveat and the `9999` residue pointer to FR-29 are both present. |
| **C-49** | LANDED | `addendum.md:97` | *"**Narrowed by revision 4.**"* appended after the retained paragraph, with AD-28, the no-pair-of-edges-isolates-a-tier statement, the neighbouring-tail consequence, the reason it is a narrowing rather than a regression, and the pointer to cell isolation at FR-22. The paragraph itself is kept. |
| **C-50** | LANDED | §3 *`cohortTotals`* (`prd.md:93`), FR-27 (`:568`, `:569`, `:572`, `:573`) | The field is defined in the Glossary as the pre-split per-`(statId, itemLevelMin)` sum. Both new hard errors are in FR-27's list: the missing-row / cells-do-not-sum error, and *"**a cell carried by more than two cohorts**"*. `:572` carries the independent-path argument; `:573` carries `WEIGHTS-FILE-SCHEMA.md:157`'s honest limit and explains the at-most-two-cohorts error as the defence against the coarse-cell attack (A-2), naming it *"BQ-1 through a coarse cell instead of a sentinel value."* |
| **C-51** | LANDED | FR-22 (`prd.md:478`), FR-21 (`:465`) | *"**Curate to interior cells by default.**"* with the cheapest-10 mechanism, the truncate-to-zero-and-take-the-mass consequence, the BQ-1-through-a-heterogeneous-band framing, the `[57,78.5]` vs `[56,80]` remedy, the untracked-boundary-costs-nothing argument, and *"Span a boundary only where the two tiers' prices are known to be close."* AD-16's matching clause landed as FR-21's closing consequence. |
| **C-52** | LANDED | FR-4 (`prd.md:191-193`, `:182-188`), FR-25 (`:518`), §3 *Sync Report* (`:109`), §7.3 (`:741`, `:744`), §0 (`:28`) | Re-measurement stated as its own consequence — *"The measurement recurs; it is not a gate that is spent"* — with the 85%-to-60%-after-a-patch example and *"part of **accepting** a regenerated file."* The figure is published in `sync-report.json` and listed in §3's Sync Report. Rev-3 adversarial finding 14's two extra asks also landed: the bands are explicitly **disjoint** (`≥ 80` / `≥ 50 and < 80` / `< 50`) and a minimum-denominator assumption is stated at `:193` and indexed in §11. *(A-8 — that `covered()` is blind to `modelled-split` — remains unresolved, as the proposal itself recorded; it is not a miss against C-52 as filed.)* |

---

## 2. The one PARTIAL — C-47

**Status: PARTIAL.** Everything C-47 asked for landed except the accuracy of one of the two
amended-AD lists, and the §0 paragraph now contradicts itself about it.

What landed: §0 reads *"final at revision 4"*; the range is *"AD-1 through AD-28"*; AD-28 is added
to the list of decisions bearing on requirements; the stability clause is present and emphatic
(*"**AD ids are stable across every revision** … no citation in this document went stale"*); the
revision-4 list uses the corrected set the extract directed (*"AD-5, AD-10, AD-11, AD-16, AD-17,
AD-18 and AD-27 … added **AD-28**"*, i.e. `PRD-EDIT-PROPOSALS.md:497`'s list, not the review's
five-AD one); front matter is `revision: 4`, `updated: 2026-09-13`.

**What is absent.** The proposal (C-32's text, folded into C-47 at
`extract-reviews-rev34.md:646`) requires:

> *Proposed:* … State that revision 3 amended **AD-9, AD-11, AD-12, AD-18, AD-19, AD-21, AD-26 and
> AD-27** in place and added no AD

The PRD's current text (`prd.md:20`) states:

> Revision 3 amended AD-11, AD-18, AD-19, AD-26 and AD-27 in place and added no decision.

**AD-9, AD-12 and AD-21 are missing from that list.** All three are load-bearing in this very
revision: AD-9 is the governing decision for C-24 (`lastAttemptedAt`), AD-12 for C-30's ceiling
bullet, AD-21 for C-28's `currencies.json` omission — each cited as amended text elsewhere in the
PRD.

**And the same paragraph says so.** The new `[NOTE FOR PM]` two sentences later reads:

> `[NOTE FOR PM]` The spine's own revision notes are incomplete: the revision-4 note omits AD-17
> and AD-27 and the revision-3 note omits AD-9, AD-12 and AD-21, all five of which demonstrably
> carry amended text. **The lists above are the corrected ones**; the discrepancy is a spine
> bookkeeping matter, not a requirements one.

The revision-4 half of that claim is true — AD-17 and AD-27 *were* added back. The revision-3 half
is false: the list above it is the spine's uncorrected one. The note asserts a correction it did
not make, which is worse than the omission alone, because a reader who trusts the note will not
check.

**Fix:** add AD-9, AD-12 and AD-21 to the revision-3 sentence. One-line edit; the `[NOTE FOR PM]`
then becomes accurate as written.

---

## 3. The five deliberate decisions — verified

Each was checked against the text rather than accepted on assertion.

1. **C-32 superseded by C-47; only C-47 should appear. — Confirmed.** §0 carries exactly one
   combined revision statement, pinned to revision 4. There is no separate "final at revision 3"
   sentence anywhere in `prd.md`, and no duplicated amended-AD list. C-32's substance (the
   AD-ids-are-stable reassurance) survives inside C-47's paragraph, which is what the supersession
   intended.
2. **C-48 folded into C-31's OQ-11 retirement. — Confirmed.** OQ-11 at `prd.md:802` carries a
   single **Resolved** clause citing the **rev-4** wording for both ADs, plus C-31's syntactic
   caveat. There is no separate C-48 edit and no second OQ-11 treatment.
3. **C-45's `gamePatch` went into §3 under *Weights File*. — Confirmed.** It is a clause inside the
   *Weights File* Glossary entry (`prd.md:92`), not a standalone term, and the FR-27 hard error
   (`:567`) and FR-10 render obligation (`:277`) both cite `§3` back to it. The ordering constraint
   C-45 carried (spine-first) is satisfied: the spine now carries the AD-11/AD-10 clauses the
   proposal was downstream of.
4. **C-23 scoped to `banded` references only, per C-38. — Confirmed, in both halves.** FR-29's
   edge-alignment consequence opens *"A **`banded`** reference's edges must be edge-aligned…"* and
   its rule sentence reads *"for every tracked **`banded`** reference — a `valueless` one has no
   edges to align"* (`prd.md:606`). §3's *Modifier Reference* likewise says *"a `banded` reference's
   edges must also align to edges the Weights File actually declares"* (`:71`). The failure mode
   C-38 warned of — every valueless reference becoming a validation error — is not present. The
   adjacent empty-containment-set error at `:604` correctly stays kind-agnostic.
5. **C-29 states three fields, not two. — Confirmed.** `prd.md:647`: *"**`data/config.json` carries
   exactly three things: the active league, `minChunkSearches`, and `schemaVersion`.**"* The
   per-field reader assignments are correct (`core`+`sync`; `sync` only, at one site; NFR-8 for
   every artifact) and the closing rule is correspondingly *"a **fourth** field is an architecture
   amendment"*. This is rev-3 adversarial finding 16's correction, applied.
6. **C-46 added as OQ-12 in its own §10 subsection. — Confirmed.** §10 gains a fourth heading,
   *"Open, and owned outside this repository"* (`prd.md:804`), holding OQ-12 alone. It is
   deliberately not in the *Non-blocking* list, which the proposal named as a candidate home — the
   separate subsection is the stronger placement, since OQ-12 is blocking for correctness while
   OQ-5…OQ-7 are not, and §0 and §7.3 both point at it as the one live question.

---

## 4. Collateral damage

Five items. One is a real contradiction a builder could act on; the rest are stale ordinals and
wording left behind by otherwise-correct edits.

### CD-1 — §0's revision-3 list contradicts its own `[NOTE FOR PM]` *(moderate)*

Covered in full at §2 above. It is both the C-47 PARTIAL and the sharpest piece of collateral
damage in the set, because the note claims the correction was applied.

### CD-2 — FR-28 cites *"the Glossary's third Provenance value"*, which is no longer `absent` *(moderate)*

`prd.md:586`:

> `core` assigns such probabilities Provenance `absent` and the Base Type is Unrankable (FR-4) —
> this is the only path by which `absent` arises, and without it **the Glossary's third Provenance
> value** would be unreachable.

That ordinal was written against the three-value enum, where `absent` was listed third. C-33
replaced §3's entry with a **four**-value ranked table in which `absent` is **rank 0 — the first
row and the weakest value** (`prd.md:100`). The bullet now cites a superseded quantity and points
at the wrong row: the Glossary's third value is now `modelled-split`, which has nothing to do with
`partial` pools and does not arise in `core` at all.

**Fix:** *"…without it the Glossary's `absent` Provenance would be unreachable."* Naming the value
rather than its position also makes the sentence immune to the next enum change.

### CD-3 — §3 *Curation Status* says `pinned` is refreshed *every* Chunk, unconditionally *(low–moderate)*

`prd.md:79`:

> **Curation Status** — exactly one of `active`, `pinned` (**refreshed every Chunk**, never waiting
> its turn in the oldest-first ordering, and **capped in number**), or `pruned` …

C-22(b) introduced the runtime half, under which `sync` **truncates the pinned set for that Chunk**
when the discovered allowance cannot cover it plus one `active` entry (`:399`). So "refreshed every
Chunk" is no longer unconditionally true, and "capped in number" describes only the load-time half
of a cap the PRD now insists is *"capped at both ends, because neither end is sufficient alone"*
(`:394`). The Glossary is binding by §3's own preamble, and a builder reading only this entry gets
the reading C-22's **[post-review]** note exists to foreclose — that `pinned` always wins the whole
allowance.

FR-15 (`:342`) is better but not clean: *"refreshed in every Chunk … subject to the cap of FR-17"*
still reads as the load-time cap alone. This is rev-3 adversarial finding 3's *"amend AD-23's
one-line definition to match"*, which was never filed as a C-item and so was never applied.

**Fix:** *"refreshed every Chunk the allowance can afford (FR-17), never waiting its turn in the
oldest-first ordering, and capped at both ends."*

### CD-4 — §10 BQ-3's retained body states the coverage fraction in the exact form C-27 exists to correct *(low)*

`prd.md:786`:

> If **≥80%** of tracked Base Types resolve to `complete` pools in **both** slots, proceed as
> specified.

That is the un-narrowed denominator (*"tracked Base Types"*, not `rankable`) and the
middle-condition-only numerator — precisely the two readings FR-4 now spends `:179-181` refuting.
It is guarded: the same item says *"**FR-4** states it normatively and is the copy to build to"*,
and its **Resolved** clause names AD-27's narrowing. As retained historical analysis it is
defensible, and C-31's principle (keep the argument, it exists nowhere else) argues for leaving it.

But BQ-3 is the one retained analysis a builder is actively pointed at — §7.3 cites it twice as
carrying the argument, and FR-4 cites it beside the band table. A one-clause hedge would cost
nothing.

**Fix (optional):** append to the decision-rule sentence: *"— stated here on the pre-AD-27
denominator; FR-4 carries the narrowed predicates and is the normative form."*

### CD-5 — "band" still names a Weights File row in several places the Glossary now calls a cell *(low)*

C-37 and C-44 redefined the file's unit as a **cell**, and FR-27/FR-29 largely follow. Residue:

- `prd.md:616` — *"Every Weights File **band** carries `itemLevelMin`; a **band** without one is a
  hard file error"* — inside FR-29, three bullets after the same FR has switched to *"lowest
  contained **cell**"*.
- `prd.md:628`, `:630` — FR-30's *"pool membership, **band edges**, `itemLevelMin` and weights"* and
  *"every **band** `weight: 1`"*.
- `prd.md:740` — §7.3 repeats *"band edges"*.
- FR-29's own title, *"Aggregate weights by **band** within an item-level-scoped pool"*.

None of these is *false* — "band" remains a live Glossary term for a `banded` Modifier Reference's
value interval — but using one word for both the reference's interval and the file's row is the
conflation AD-28 removed, and the ER-diagram version of it (`ModifierWeight }o--|| ModifierRef`) is
already on the reviews' non-PRD defect list. A terminology sweep of the four sites above would close
it. The FR-29 title is the one worth changing: *"by reference within an item-level-scoped pool"*.

**Also noted, not damage:** `addendum.md:44` and `:48` still say *"Weights File schema 2.0.0"*.
These are revision-2 *"What landed"* notes, which the addendum's own preamble (`:19`) frames as
historical with later movement noted separately — and `prd.md:785` models the alternative by writing
*"schema 2.0.0 — 3.0.0 at the current revision —"*. Adding the same parenthetical to the addendum
would be tidier; leaving it is defensible.

---

## 5. What the update did beyond the proposals

Recorded because it is unusual for a reconciliation to find surplus rather than shortfall, and
because each of these closes a review finding that was never filed as a C-item:

- **The `modelled-split` propagation question (A-6 half two / H-5) is decided**, not deferred —
  numerator-only, with the mass-conservation justification (`prd.md:276`). C-41 explicitly warned
  that landing it without a decision would leave FR-10's three render states ambiguous.
- **A *Cohort* Glossary entry** with membership by `itemLevelMin` **equality** (`:91`) — A-3's
  `tiers(ℓ)` fix.
- **FR-27's "two producer obligations are unverifiable"** paragraph (`:573`), carrying
  `WEIGHTS-FILE-SCHEMA.md:157`'s honest limit into the requirements document.
- **FR-29's floor-dependence note** (`:615`) — that edge alignment is evaluated under the scope and
  can fail at a lower floor, and that this is the rule working rather than an inconsistency, with
  the contrast against straddle's floor-invariance at `:620`.
- **The `[NOTE FOR PM]` at §0** flagging the spine's own incomplete revision notes — correct in
  intent, though it is the site of CD-1.

---

## 6. Recommended edits, in order

1. **CD-1 / C-47** — add AD-9, AD-12, AD-21 to §0's revision-3 amended list (`prd.md:20`). This is
   the only change needed to move C-47 to LANDED.
2. **CD-2** — replace *"the Glossary's third Provenance value"* with *"`absent`"* (`prd.md:586`).
3. **CD-3** — qualify `pinned` in §3 *Curation Status* against FR-17's runtime truncation
   (`prd.md:79`), and optionally FR-15 (`:342`).
4. **CD-5** — band→cell sweep at `prd.md:616`, `:628`, `:630`, `:740`, and FR-29's title.
5. **CD-4** — optional one-clause hedge on §10 BQ-3's decision rule (`prd.md:786`).

None is blocking. Items 1–3 are worth doing before the PRD is handed to epics-and-stories; 4 and 5
are hygiene.
