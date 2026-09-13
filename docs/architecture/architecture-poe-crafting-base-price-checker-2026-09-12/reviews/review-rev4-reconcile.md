---
title: 'Reviewer gate — revision 4 — INPUT RECONCILIATION lens'
lens: input-reconciliation
target: ARCHITECTURE-SPINE.md (rev 4) + WEIGHTS-FILE-SCHEMA.md (3.0.0)
against: docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md (rev 2) + addendum.md
created: '2026-09-13'
verdict: 'absorbed with one gap — 3 ABSORBED / 1 PARTIAL / 0 MISSING; 17 PRD contradictions, 14 substantive'
---

# Reviewer gate rev 4 — input reconciliation

**Verdict: absorbed with one gap.** Three of the four decisions landed in both the spine and the contract with their reasoning intact. The fourth landed only half — `gamePatch` is fully specified in `WEIGHTS-FILE-SCHEMA.md` and **appears nowhere in the spine**, so a required, un-defaultable field of a consumed file has no AD behind it and no owner for the render obligation the contract asserts.

Separately, two quiet requirements inside the raised questions did not survive the AD structure: **mass conservation is declared the invariant but nothing can check it**, and **`partial` pools are now a patch-cadence phenomenon while AD-27 still models coverage as a one-time pre-view measurement.**

The PRD is still at revision 2 and has not absorbed the revision-3 proposals (C-22 … C-32), which remain outstanding and unaffected by this pass. What follows continues the `C-` series from **C-32** — the highest existing id in `PRD-EDIT-PROPOSALS.md`.

---

## Part 1 — Absorption of the four decisions

| # | Decision | Verdict |
| --- | --- | --- |
| D1 | AD-28 new — decomposition over the value axis; mass conservation; non-overlap per `itemLevelMin` | **ABSORBED** (1 quiet requirement flagged) |
| D2 | AD-10 gains `modelled-split` | **ABSORBED** |
| D3 | AD-5 becomes a discriminated union `banded` \| `valueless`; sentinels rejected | **ABSORBED** |
| D4 | TBD rows keep the pool `partial` (`unidentifiedWeight` rejected); `gamePatch` operator-asserted, required, no default | **PARTIAL** — TBD half absorbed; `gamePatch` absent from the spine (1 quiet requirement flagged) |

### D1 — AD-28, decomposition over the value axis — **ABSORBED**

**Spine.**

- `ARCHITECTURE-SPINE.md:480-506` — AD-28 exists, titled and scoped to `contracts`, `core` and weights producers.
- `:484` — the load-bearing statement: *"The value axis therefore does not partition the tier axis."*
- `:486` — the producer's measurement carried verbatim: 53 of 63 item classes, up to 36% of a weapon class's pool, 170–1,250 overlapping tier pairs under every candidate rule, and the Bows T7/T8 worked case (43.0–56.5 against 56.0).
- `:490-498` — the three-step procedure: cut at every tier endpoint **once over all tiers, never per item level**, cohort by `itemLevelMin`, emit one entry per (cohort, cell) with `weight(ℓ,c) = Σ { w(t) × P(value ∈ c | t) }`. The "once, never per item level" clause carries its own reason (edge-alignment would pass at one floor and fail at another) — the right reason, and it is the one AD-18 depends on.
- `:500` — *"Mass conservation is the invariant; the split estimator is not."*
- `:502` — non-overlap restated per-`itemLevelMin`, with the proxy argument.
- `:504` — the honest consequence: a tier can no longer be isolated, and why that is correct.
- `:506` — the half-integer lattice.

**Ripples, all present.** AD-5 `:108` (*"A band is a value interval, not a tier"*); AD-11 `:181` (*"Bands are **value cells**, and for a multi-number modifier a cell's weight is a conserving split … the producer owns the split, `core` never performs one"*); AD-18 `:312` (*"The straddle rule is the invariant; non-overlap is only its proxy"*); AD-16 `:244` (multi-`#` trap retained and pointed at the open question); Consistency Conventions `:516`; entity note `:627` (*"A `ModifierWeight` is a value **cell** within an item-level cohort, not a tier"*); Deferred `:687` (a measured split would move entries to `measured` without touching the contract); Open Questions `:703` (the filter unit, owner named, marked *blocking for correctness, not for building*).

**Contract.** `WEIGHTS-FILE-SCHEMA.md:20-30` (the 3.0.0 rationale, including *"`2.0.0` was therefore unsatisfiable"*), `:64-92` (the procedure plus the worked Bows cell partition and the twice-emitted `[56,56.5]` cell), `:94-106` (conservation and the recommended estimator), `:108-114` (what it costs the curator), `:199` (non-overlap per `itemLevelMin`), `:215` (the matching hard error), `:229` (cell edges must align to the floors curators use).

**AGENT-WORKFLOW.md:88** carries it into the build order and names the union as the thing to land carefully.

> **Quiet requirement dropped: mass conservation has no verifier and no owner.**
>
> AD-28 `:500` and the contract `:96-102` both make conservation *the* invariant — the property that leaves the denominator and every reference total exact and that justifies leaving the estimator free. But `core` never sees a tier weight. It sees cells. There is no arithmetic available to it that distinguishes a conserving split from a non-conserving one, and the contract's hard-error list (`:209-221`) contains no conservation check — correctly, because none is expressible there.
>
> Every other load-bearing clause in this contract names an enforcement point: the straddle rule is checked directly in `core` at load (`:221`), edge alignment is a `tracked.json` validation error (AD-18 `:303-310`), pool completeness is a declared field the producer asserts and AD-27 measures. Conservation alone is asserted and then left. A producer with an off-by-one in its lattice count emits a file that passes every check in `contracts` and every check in `core`, and is wrong by a per-family factor that reweights bases against each other — the same failure class AD-18's scoping rule exists to prevent, arriving through the one invariant nobody can test.
>
> This is not necessarily fixable inside the app (it probably is not — the input the check needs stays on the producer's side). But it should be **stated as a producer-side obligation with a named self-check** rather than left reading like a rule the consumer enforces. The contract's *"Producer expectations"* section (`:225-233`) is the natural home: a producer asserts conservation per family and is the only party able to.

> **Minor: AD-16 was not amended for a non-integer lattice.** AD-28 `:506` and the contract `:62` establish that under an averaged unit the value lattice is half-integers. AD-16's search table (`:235`) still reads *"both `min` and `max` from the band"* and its fourth trap (`:244`) discusses which derived value the filter compares but not that the edges it passes may be non-integer — which is the second half of the open question at `:703` (*"nor has the filter's acceptance of **non-integer** `min`/`max`"*). The adapter is the component that will discover this, and the trap list is where an implementer will look. One clause.

### D2 — AD-10 gains `modelled-split` — **ABSORBED**

- `ARCHITECTURE-SPINE.md:166` — *"Provenance is a **four-value total order**, weakest first"*.
- `:172` — the row: *"the weight was **measured**, but a **model** distributed it across value cells | AD-28's decomposition, and nowhere else"*. The "and nowhere else" clause matches the discipline `absent` already had at `:170`, and it is what stops the value being reached for as a general hedge.
- `:175` — the render obligation, and the reason both halves matter: *"`web` must render … `modelled-split` distinctly from `uniform-prior` — collapsing the two would either overstate an invented weight or understate a measured one."*
- Revision banner `:25` describes it as *"a fourth provenance … for weight that is measured but distributed by a model"*.
- Contract `:28` (the 3.0.0 rationale, with the argument the memlog records — *"calling it either would hide the model or insult the measurement"*), `:106` (*"Every entry produced by a split carries `provenance: "modelled-split"`, never `"measured"`"*), `:158`/`:168` (the example rows), `:203` (the field rule, with `"absent"` restated as a core-side-only value).
- AGENT-WORKFLOW.md:88 sequences the widened enum into the `contracts`-first landing.

No gap. The ordering (`absent` < `uniform-prior` < `modelled-split` < `measured`) is consistent everywhere it appears, and the weakest-input propagation rule at `:175` is unchanged, so a decomposed weapon base correctly renders as modelled rather than as measured without becoming unrankable.

### D3 — AD-5 becomes a discriminated union — **ABSORBED**

This is the most thoroughly rippled of the four; the reference sites that a discriminated union normally breaks were all visited.

- `ARCHITECTURE-SPINE.md:99-106` — the two-kind table, and the sentinel rejection argued from this spine's own precedent: *"A sentinel pair such as `1/1` would pass every containment, straddle and edge-alignment check while making AD-16 emit a min/max filter for a stat that has no value — the same class of defect as the sentinel ceiling this AD's `valueMax` rule exists to close."* That is the right rejection and it cites the right prior finding.
- `:106` — a valueless reference still carries `weight` and `itemLevelMin` and still counts toward pool completeness.
- AD-16 `:235` — *"a `valueless` reference carries the stat id and **no edges at all**"*.
- AD-17 `:266-274` — `slotOverlap` gains the `both are valueless` branch and the `statId` mismatch branch, plus `:274`, which forecloses the one unreachable pairing (*"a `statId` either rolls a value or does not"*) in `contracts` rather than leaving `core` to pick a reading.
- AD-18 `:294-301` — containment as a two-row table keyed on kind; `:303` restricts edge alignment to `banded` references explicitly (*"a `valueless` one has no edges to align"*).
- AD-11 `:181` — both shapes spelled out, *"every field of the chosen kind required and none nullable"*.
- Conventions `:516`, `:517` — and `:517` is the catch that matters: the canonical entry key encodes **three distinguishable forms** (`null` absent, `[statId, valueMin, valueMax]` banded, `[statId, null, null]` valueless), *"so an absent affix and a valueless one can never collide."* Without this the union would have silently reintroduced key collisions across every artifact.
- Contract `:29`, `:151`/`:170` (example rows of both kinds), `:196` (`kind` as *"the discriminant, not a hint"*), `:198` (`valueMin`/`valueMax` **forbidden** on `valueless`), `:213` (hard errors: missing/unrecognised `kind`; one `statId` under both kinds; edges present on a valueless entry).

No gap found. Every place a `ModifierRef` is read — identity, search construction, overlap, containment, alignment, key encoding, pool completeness — has an explicit branch or an explicit statement that one kind is out of scope.

### D4 — TBD placeholders and `gamePatch` — **PARTIAL**

**TBD placeholder rows: ABSORBED.**

- Contract `:129` — the rule and its reasoning: *"a pool with dropped placeholder rows is `partial`, not `complete`"*, *"There is deliberately no field for anonymous weight: it would be a way for a producer to hide an arbitrary share of the pool behind a scalar nobody can check"*, and the accepted cost recorded (*"Placeholder rows are a patch-cadence phenomenon, so expect freshly scraped classes to be `partial` until the source names them"*).
- Spine Deferred `:688` — *"**Unidentified pool weight.** Considered and rejected for this revision … Rejected because it is a new way for a producer to hide weight, against a present cost of 7 rows in one item class. **Revisit if** unnamed rows recur at scale"*. The rejection is recorded with its scale and its revisit trigger, which is the correct treatment for a considered-and-declined option.

Placing the positive rule in the contract and the rejection in the spine's Deferred list is right: AD-11 delegates the file's rules to the contract, so a new AD would have duplicated it.

**`gamePatch`: MISSING FROM THE SPINE.**

A full-text search of `ARCHITECTURE-SPINE.md` for `gamePatch`, `game patch`, `generatedAt` and `sourceUrl` returns **nothing**. The only hits in the architecture directory are in `WEIGHTS-FILE-SCHEMA.md` (`:30`, `:129`, `:138`, `:191`, `:217`) and in `.memlog.md:124`.

The contract states it completely and well — `:191` gives it the required/never-inferred/refuse-to-run rule, says `core` does not parse it, and assigns `web` the render obligation; `:217` makes a missing or empty value a hard file error. What is absent is any AD that supports those two assignments:

| Contract clause | Which AD should carry it | Status |
| --- | --- | --- |
| *"`core` does not parse it"* | AD-11 (what the app consumes and what it does with it) | not stated |
| *"`web` surfaces it beside `producer.generatedAt` and `sourceUrl`"* | AD-10 (what `web` must render) or AD-24 (`web`'s obligations over the eight artifacts) | **not stated — an unowned render obligation** |
| *a missing or empty value is a hard file error* | AD-11 / the contract's own validation section | contract only |
| *`gamePatch` is a required element of the weights file header* | AD-22 (every shared concept has one schema in `contracts`) | the entity list `:373` names `ModifierWeight` but no weights-file header entity |

This matters more than an ordinary spine/contract split, for two reasons. First, the whole *point* of the field is a render: a `gamePatch` nobody displays is a string in a file, and AD-10 `:175` is the AD that turns provenance data into a rendering requirement — it enumerates what `web` must show and does not mention this. Second, the spine's own AD-3/AD-24 discipline is that `web`'s obligations are enumerated and a new one requires an amendment; the contract is asserting one from outside that enumeration. The rev-3 gate found and fixed exactly this shape twice (AD-26's `web` surfacing of the starvation record, AD-21/AD-24's currencies.json contradiction), so the precedent is established.

Note also that PRD FR-10 (`prd.md:233`) *already* requires *"The Weights File's declared producer and game patch are visible alongside any figure they influenced"* — so the requirement exists downstream of a spine that never states it. That is the wrong direction of inheritance for a document that describes itself as *"inherited, not re-decided"*.

**Proposed:** one sentence in AD-11 (the file carries an operator-asserted `gamePatch`; `core` never parses it; a missing or empty value is a hard file error) and one clause in AD-10 (`web` surfaces `gamePatch`, `producer.id` and `producer.generatedAt` beside any figure the file influenced), with the detail left in the contract.

> **Quiet requirement dropped: `partial` is now a recurring, patch-cadence state, and AD-27 still models coverage as a one-time measurement.**
>
> The TBD decision's accepted cost is explicit in the contract `:129`: *"Placeholder rows are a patch-cadence phenomenon, so expect freshly scraped classes to be `partial` until the source names them."* AD-28 compounds it — the decomposition is recomputed per patch, and a patch that adds a tier re-cuts the value axis for the whole family.
>
> AD-27 (`:446-478`) is written entirely in the perfective: *"Pool coverage is measured **before the view is built**"*, *"**Before any view work**, measure"*, and its `< 50%` row says *"The ranking premise fails. Escalate rather than ship"*. AGENT-WORKFLOW.md:89 sequences it as a one-time build-order step. Nothing says what happens when coverage — measured once at 85% and used to justify a footer layout — falls to 60% three months later because a patch un-named seven rows in a weapon class and the producer correctly declared those pools `partial`.
>
> The decision to decline `unidentifiedWeight` is the decision that makes this a live behaviour rather than a theoretical one: it is precisely the mechanism that would have kept such pools `complete`. Declining it was right, and the rejection records the scale — but the consequence lands on AD-27's gate, and AD-27 was not amended. Two readings are then available to a builder, and they differ in what the product does after a patch: re-measure and re-lay-out (a layout that changes under the player), or treat the gate as spent (a footer that is now hiding 40% of the tracked list — the exact misrepresentation the 50–80% band exists to prevent).
>
> **Proposed:** a clause in AD-27 saying coverage is **re-measured at weights-file regeneration**, that the bands bind on every measurement and not only the first, and which of the two readings applies to the layout. This is a small amendment and it is the one place a rev-4 decision genuinely changed the meaning of an AD that was not touched.

---

## Part 2 — PRD contradictions created by revision 4

The PRD is at **revision 2** (`prd.md` front matter `:4`) and has not yet absorbed proposals C-22 … C-32. Those remain outstanding and nothing below supersedes them. The items here are **new**, created by revision 4, and continue the series from C-32.

Ordered by how badly the current text would mislead a builder or a producer reading only the PRD. **17 items: 4 severe, 6 high, 4 medium, 3 low — 14 substantive, 3 bookkeeping.**

### Severe — the PRD as written breaks a conforming file

#### C-33 — §3 *Provenance* fixes a three-value enum; AD-10 now has four

> *Current (`prd.md:92`):* "**Provenance** — what a derived figure rests on: `measured`, `uniform-prior`, or `absent`."

This is the Glossary entry a builder of `contracts` reads to write the Zod enum, and the PRD's own §3 preamble makes Glossary terms binding (*"Introducing a synonym anywhere is a discipline violation"*). AD-10 `:166-175` now defines a **four-value total order**, and the contract `:203` makes `"modelled-split"` a legal per-entry value in the file.

The consequence is not stylistic. Every decomposed multi-number family carries `provenance: "modelled-split"` (AD-28 `:500`, contract `:106`), and 53 of 63 item classes carry such modifiers. A `provenance` enum built to this Glossary entry rejects the file at load, and `core` *"refuses to rank from an invalid file rather than ranking partially"* (contract `:207`) — so the PRD as written turns a correct weights file into a total product outage.

> *Proposed:* replace with AD-10's four-value order, weakest first — `absent`, `uniform-prior`, `modelled-split`, `measured` — with the one-line meaning of each and the note that `absent` arises only from a `partial` pool and `modelled-split` only from AD-28's decomposition. Keep the weakest-input propagation sentence unchanged. Governing AD: **AD-10**.

*Severity: severe. Content change.*

#### C-34 — §3 *Modifier Reference* admits only the banded kind, and its "always" makes the valueless case unrepresentable

> *Current (`prd.md:69`):* "the canonical identity of a modifier: a trade API `statId` paired with an inclusive, closed **value band** `(valueMin, valueMax)` … **`valueMax` is required, always** — an omitted ceiling is a floor by another name."

AD-5 `:99-106` now defines `ModifierRef` as a discriminated union of `banded` and `valueless`, and the `valueless` kind carries **no edges at all**. The current wording leaves a modifier that rolls no number — *"Loads an additional bolt"* — with nowhere to live but the sentinel form AD-5 `:106` explicitly rejects, and rejects on the ground that it *"would pass every containment, straddle and edge-alignment check while making AD-16 emit a min/max filter for a stat that has no value."* A builder obeying this Glossary entry writes the defect the spine spent a paragraph foreclosing.

> *Proposed:* restate as the two-kind union with `kind` as the discriminant, preserving the `valueMax`-required rule **scoped to the banded kind** (where its BQ-1 argument still holds in full) and adding AD-5's sentence that a valueless reference is not a degenerate band. Note that a valueless reference still carries `weight` and `itemLevelMin` and still counts toward pool completeness. Governing AD: **AD-5**.

*Severity: severe. Content change.*

#### C-35 — FR-27's hard-error list refuses a conforming 3.0.0 file, and pins the wrong schema version

> *Current (`prd.md:472`):* "Hard file errors reject the file outright (schema 2.0.0): … a duplicate `(statId, valueMin, valueMax, itemLevelMin)` within a slot; **a missing or `null` `valueMax` on any band**; a missing `itemLevelMin`; **overlapping value bands for one `statId` within a slot**; …"
>
> *Current (`prd.md:469`):* "A producer building to a 1.x shape emits a file that `core` refuses (schema **2.0.0**, breaking)."

Three separate defects, one of them fatal:

- **The unscoped non-overlap error is the single line that makes a correct file illegal.** AD-28 `:502` and contract `:199` now require that entries sharing a `statId` at **different** `itemLevelMin` **may** cover the same interval — that is precisely how a decomposed family expresses two cohorts' mass in one cell, and the contract's worked example `:92` emits `[56, 56.5]` twice by construction. As written, FR-27 rejects the Bows example in the contract.
- `valueMax` required "on any band" is now wrong for a `valueless` entry, where both edges are **forbidden** (contract `:198`).
- The duplicate key omits `kind`; the contract `:214` uses `(statId, kind, valueMin, valueMax, itemLevelMin)`.

> *Proposed:* replace the list wholesale with the contract's `:209-221` hard errors, and re-pin the version to **3.0.0**: unknown `schemaVersion` major; missing or unrecognised `kind`, or one `statId` under both kinds; edges present on a `valueless` entry, or missing/`null`/non-numeric on a `banded` one; duplicate `(statId, kind, valueMin, valueMax, itemLevelMin)` within a slot; **overlapping value bands for one `statId` *at the same `itemLevelMin`*, overlap across different `itemLevelMin` being legal**; missing or negative `weight`; missing `itemLevelMin`; missing `poolCoverage`; `provenance: "absent"` in a file; **a missing or empty `gamePatch`**; a `statId` or base key absent from the committed Trade Catalogue; an entry straddling a band edge in use by `data/tracked.json`. Retain the contract's closing note that the straddle check is the one that matters and is checked directly rather than inferred from disjointness. Governing ADs: **AD-28, AD-5, AD-11**.

*Severity: severe. Content change.*

#### C-36 — FR-22 and §3 *Accepted Tier* specify a tier-to-band mapping AD-28 says does not exist

> *Current (`prd.md:76`):* "**Accepted Tier** … Expressed mechanically as the Modifier Reference's **band** — both edges, not a floor."
>
> *Current (`prd.md:398`):* "The Accepted Tier decision and the Modifier Reference's **band** are **one act** — since the trade API has no tier concept (AD-5), '**accept tier 2**' means setting the reference's `valueMin` and `valueMax` to the tier 2 band's edges."

This is the tier-to-band mapping AD-28 exists to deny. For a modifier whose text carries more than one `#` — 53 of 63 item classes — *"the value axis does not partition the tier axis"* (AD-28 `:484`), a tier has **no** pair of value edges that isolates it, and a reference near a tier boundary *"necessarily includes the neighbouring tier's tail"* (AD-28 `:504`, contract `:110`).

A curator following FR-22 literally takes the tier's own value range and writes it as the reference's edges. For a multi-`#` family those edges land mid-cell — the contract's Bows T8 runs 56.0–80.0 while the cells are `[56,56.5] [57,78.5] [79,80]` — and the entry then fails **AD-18's edge-alignment rule** (`:303-310`) at load. So the PRD instructs the curator to author an entry that `core` rejects, and it does so in the one FR whose whole job is to tell the curator how to author entries.

> *Proposed:* split the Accepted Tier rule by kind. For a single-`#` modifier the current text stands unchanged — tier and band coincide. For a multi-`#` modifier, state AD-28's consequence plainly: the reference's edges must align to **cell** edges the Weights File declares, a reference spanning a tier boundary necessarily includes the neighbouring tier's tail, and this is correct rather than a defect *because the trade search cannot isolate that tier either* — so the priced population and the weighted population remain the same population, which is the only property FR-21 and FR-29 jointly require. Add the contract's reassurance (`:114`) that band count roughly doubles for affected families but the **request budget is unchanged**, since one tracked reference is still one entry and one search — otherwise a curator reading this will assume FR-14's ceiling just moved. Governing ADs: **AD-28, AD-5, AD-18**.

*Severity: severe. Content change, and it changes a curation instruction the player acts on by hand.*

### High — silent divergence a builder cannot resolve from the PRD

#### C-37 — §3 *Modifier Weight* describes a tier row, not a cell in a cohort

> *Current (`prd.md:88`):* "**Modifier Weight** — a raw game spawn weight for one band within a Base Type and affix slot, banded by rolled value **and by item level** — `(statId, valueMin, valueMax, itemLevelMin, weight)`."

No `kind`, no per-entry `provenance`, and — the substantive part — no statement that an entry is a **value cell within an item-level cohort** rather than a tier. The spine's own entity note (`:627`) now reads *"A `ModifierWeight` is a value **cell** within an item-level cohort, not a tier"*, and the contract `:54` adds *"after decomposition a cell may not correspond to a single tier at all."*

> *Proposed:* restate as a value **cell** carrying mass from one item-level cohort; give both shapes (`(statId, kind, valueMin, valueMax, itemLevelMin, weight, provenance)` banded, `(statId, kind, itemLevelMin, weight, provenance)` valueless); add that `tierLabel` is display-only and may legitimately name a mixture (`"T7–T8"`), and that `core` must never branch on it. Governing ADs: **AD-11, AD-28, AD-5**.

*Severity: high. Content change.*

#### C-38 — FR-29's containment rule has no `valueless` branch

> *Current (`prd.md:491`):* "A Modifier Reference is a **bounded band**: its weight is the sum of every Weights File band … carrying that `statId` and lying **wholly inside** the reference — `band.valueMin >=` the reference's `valueMin` **and** `band.valueMax <=` its `valueMax`."

AD-18 `:294-301` now states containment as a table keyed on the reference's kind: a `banded` reference contains a `banded` entry lying wholly inside it; a `valueless` reference contains a `valueless` entry sharing the `statId`. A builder implementing FR-29 as written has no rule at all for a valueless reference and will either invent one or crash on absent edges.

Two adjacent clauses need the same qualifier:

- The **edge-alignment rule** proposed in C-23 (still unapplied) must be scoped **`banded` only** — AD-18 `:303` says so explicitly, *"a `valueless` one has no edges to align"*. Applying C-23 without this qualifier would make every valueless reference a validation error.
- The **empty-containment-set** error (`prd.md:494`) is kind-agnostic in AD-18 and should stay so.

> *Proposed:* adopt AD-18's two-row table verbatim, scope the edge-alignment consequence to `banded`, and add AD-18's *"Whole bands only"* note that `contracts` rejects an open-top reference at the schema so `core` never encounters one. Governing ADs: **AD-18, AD-5**.

*Severity: high. Content change.*

#### C-39 — FR-16's overlap predicate is missing two of `slotOverlap`'s four branches

> *Current (`prd.md:305`):* "Two entries on one Base Type overlap when, **for both slots**, either the slot is absent in one of them or their bands intersect."

AD-17 `:266-274` now has four branches, two of them new:

```
slotOverlap(x, y) =  true              if x is absent or y is absent
                     false             if x.statId != y.statId
                     true              if both are valueless
                     bands intersect   otherwise
```

The `statId` mismatch branch was always implicit in "their bands intersect" and is harmless to state; the **both-valueless** branch is not implicit and is not derivable from the current text, because two valueless references have no bands to intersect — so a builder implementing FR-16 as written concludes two identical valueless entries on one base **do not overlap**, and lets a tracked list through that double-counts on a partition AD-17 exists to protect.

AD-17 `:274` also forecloses the one unreachable pairing (one banded and one valueless reference sharing a `statId`) in `contracts` rather than in `core`; FR-16 should name that ownership, because it is the kind of case a `core` implementer will otherwise handle defensively and inconsistently.

> *Proposed:* replace the prose predicate with AD-17's four-branch form, retain the three consequences already in FR-16 unchanged (they are all still correct), and add the `contracts`-side rejection of the mixed-kind `statId` pairing. Governing AD: **AD-17**.

*Severity: high. Content change.*

#### C-40 — FR-21's stat filter has no valueless form, and assumes integer edges

> *Current (`prd.md:382`):* "the entry's Modifier References as stat filters carrying **both `min` and `max`** from the band".

AD-16 `:235` now reads: *"a `banded` reference carries **both `min` and `max`** from the band; a `valueless` reference carries the stat id and **no edges at all**"*. Emitting `min`/`max` for a stat that rolls no value is the operational half of the sentinel defect AD-5 `:106` rejects — it does not error, it silently returns nothing or the wrong population.

Second, smaller: FR-21 gives no hint that band edges may be **non-integer**. Under an averaged unit the lattice is half-integers (AD-28 `:506`, contract `:62`), and whether the filter accepts a non-integer `min`/`max` is unconfirmed (spine Open Questions `:703`). FR-21 is the requirement whose fourth bullet already catalogues the traps a `sync` implementer must not discover in code; this belongs with them.

> *Proposed:* split the stat-filter bullet by reference kind, and add a trap bullet: band edges are expressed in the single quantity the trade stat filter compares and may be non-integer; whether the filter accepts non-integer `min`/`max` is an open question owned by the weights scraper project (C-49), and getting the unit wrong produces a file that validates and prices the wrong population. Governing ADs: **AD-16, AD-5, AD-28**.

*Severity: high. Content change.*

#### C-41 — FR-10 and FR-11 collapse `modelled-split` into the placeholder bucket

> *Current (`prd.md:232`):* "A figure resting on `uniform-prior` or `absent` renders visibly differently from one resting on `measured`."
>
> *Current (`prd.md:242`):* "When **every** probability in the loaded set carries `uniform-prior` or `absent`, the view shows a **persistent, dismissible-per-session banner** stating that the entire ranking rests on a uniform prior."

AD-10 `:175` requires something the first sentence does not express: *"`web` must render a figure resting on anything below `measured` visibly differently from one resting on `measured`, **and `modelled-split` distinctly from `uniform-prior`** — collapsing the two would either overstate an invented weight or understate a measured one."* Two render states are not enough; three are required.

FR-11 is the sharper problem. Its banner condition is a predicate over the whole loaded set, and a realistic first file — a decomposed scrape of real weights — carries `modelled-split` across most weapon classes and `measured` elsewhere. Under the current wording the banner is correctly silent, but the *reason* stated in FR-11's first consequence (*"a probability's Provenance may legitimately be `measured`"*) no longer enumerates the live cases. More importantly, a builder who reads FR-11's binary framing and then implements FR-10's badge from the same mental model produces two visual states and drags whole weapon classes into the degraded rendering — the outcome the memlog records as the explicit reason `modelled-split` was created rather than folded into `uniform-prior`.

> *Proposed:* FR-10 — state three distinguishable render treatments (`measured`; `modelled-split`; `uniform-prior`/`absent`), each not carried by colour alone per NFR-10, with AD-10's one-line reason. FR-11 — restate the banner condition as *no probability in the loaded set carries `measured` or `modelled-split`*, and add a consequence saying a `modelled-split` figure is a **measured weight distributed by a model**, so it is neither a placeholder that triggers the banner nor a figure rendered as plainly as `measured`. Governing AD: **AD-10**.

*Severity: high. Content change.*

#### C-42 — FR-28 is silent on TBD placeholder rows, so a producer reading the PRD drops them and still claims `complete`

> *Current (`prd.md:480`):* "a `(Base Type, slot)` declaring `poolCoverage: "complete"` must enumerate **every** modifier that can roll there **at any item level**, including worthless ones, with true weights and true `itemLevelMin`."

FR-28's own framing (`prd.md:482`) is that *"this document plus `WEIGHTS-FILE-SCHEMA.md` are its entire contract"* for an external project. The rev-4 decision adds a rule that FR-28 does not carry and that a producer will otherwise get wrong in the obvious direction: where a source publishes a row as an unnamed `TBD`, **the modifier exists and carries real spawn weight**, so dropping it shrinks the denominator and inflates every other probability on that base — and the pool is therefore `partial`, not `complete` (contract `:129`).

The second half is equally load-bearing and equally absent: the `unidentifiedWeight` escape hatch — a per-`(base, slot)` scalar entering the denominator but never a numerator — was **considered and rejected** (spine Deferred `:688`), so a producer must not invent one. A requirements document that states the completeness obligation but not the two ways a producer will try to satisfy it cheaply is not the whole contract it claims to be.

> *Proposed:* add two consequences to FR-28's producer side. (1) An unnamed placeholder row still counts: emit the rest of the pool, declare `partial`, and the Base Type returns to the ranking when the source names the rows. (2) There is deliberately **no field for anonymous weight** — it would let a producer hide an arbitrary share of the pool behind a scalar nobody can check — and adding one is an architecture amendment, not a producer convenience. Add the recorded cost to §7.3 or FR-4: placeholder rows are a **patch-cadence phenomenon**, so freshly scraped classes may go Unrankable immediately after a patch until the source catches up. Governing ADs: **AD-18, AD-27**, spine Deferred.

*Severity: high. Content change, and see the AD-27 re-measurement gap in Part 1 — the layout consequence of this bullet is the one the spine has not settled.*

### Medium — definitions and obligations the PRD does not yet carry

#### C-43 — FR-27's "must not pre-aggregate bands" now reads against AD-28

> *Current (`prd.md:468`):* "Producers must not normalise and must not pre-aggregate bands (AD-11, `WEIGHTS-FILE-SCHEMA.md`)."

AD-28 requires the producer to do something that looks exactly like pre-aggregation: sum several tiers' mass into one cell (`:494-498`). The distinction the contract draws (`:50`) is *"must not pre-aggregate **cells**"* — aggregation **across tiers into a cell** is mandatory, aggregation **across cells** is forbidden, because `core` sums cells and only cells.

As written, a conscientious producer reading FR-27 has a direct conflict between two of its own obligations and no text resolving it.

> *Proposed:* replace "bands" with "cells" and add one clause: a cell's weight is the conserving sum of the mass its cohort's tiers contribute to it (AD-28), and that summation is the producer's job; summing two cells together is not. Governing ADs: **AD-11, AD-28**.

*Severity: medium. Wording, but it resolves a live ambiguity in a producer-facing obligation.*

#### C-44 — §3 *Eligible Pool* describes one band per interval

> *Current (`prd.md:91`):* "the complete set of modifiers that can roll in one `(Base Type, slot)` at **any** item level, each band carrying the item level at which it becomes available."

"Each band carrying the item level at which it becomes available" implies one entry per interval. Under AD-28 the same interval legitimately appears **more than once**, once per item-level cohort that can reach it, and `core`'s scoping is what admits each at most once. The definition is not wrong so much as unable to describe the file it names, and the Glossary is where a `core` implementer looks for the shape before writing the scoping code.

> *Proposed:* restate as the set of value **cells** per `(Base Type, slot)`, each carrying the `itemLevelMin` of the cohort whose mass it holds; note that the same value interval may appear under more than one `itemLevelMin` and that scoping to the entry's Item Level Floor is what admits each at most once (AD-18, AD-28). Governing ADs: **AD-18, AD-28**.

*Severity: medium.*

#### C-45 — `gamePatch` has a render requirement in FR-10 but no definition anywhere

FR-10 (`prd.md:233`) already requires *"The Weights File's declared producer and game patch are visible alongside any figure they influenced"* — so the PRD is ahead of the spine here (see Part 1, D4). What it lacks is any statement of what the field **is**: operator-asserted at run time, required, never defaulted and never inferred, with a producer obliged to refuse to run without it, and a missing or empty value a hard file error. `core` does not parse it.

Note this proposal is contingent on the spine gap being closed first — the PRD is downstream of the spine by its own §0, so the AD-11/AD-10 clauses proposed in Part 1 should land before this edit.

> *Proposed:* add `gamePatch` to §3 under *Weights File*, and add the hard-error entry to FR-27 (already folded into C-35). Governing ADs: **AD-11, AD-10** (once amended).

*Severity: medium.*

#### C-46 — §10 has no open question for the filter unit, which is blocking for correctness

The spine carries it (`:703`) as an Open Question owned by the weights scraper project and marks it *"Blocking for correctness, not for building"*: which single quantity the `trade2` stat filter compares for a multi-`#` stat, and whether it accepts non-integer `min`/`max`. Getting it wrong produces a file that validates and prices the wrong population — a silent corruption of every price on 53 of 63 item classes.

§10's *Non-blocking* list is where the PRD carries exactly this class of item (OQ-5, OQ-6), and §7.3 already names the scraper project as a release dependency with a measurement gate. This one is a second gate on the same dependency and belongs beside it.

> *Proposed:* add an OQ to §10 stating the question, the evidence (a 56.5 band edge can only arise from averaging two integers), the two unconfirmed facts, the owner (the weights scraper project, by live verification against `trade2` search plus `/data/stats`), and the consequence. Cross-reference from §7.3 as the second gate on the Weights File dependency, and from FR-21 (C-40). Governing ADs: **AD-28, AD-16**.

*Severity: medium. This is a new requirement rather than a contradiction, but it gates the same delivery §7.3 already gates.*

### Low — bookkeeping, but visible

#### C-47 — §0 and the front matter are pinned to "final at revision 2"

> *Current (`prd.md:20`):* "`ARCHITECTURE-SPINE.md` is final at revision **2**, and its decisions AD-1 through AD-**27** are **inherited, not re-decided**. AD-25 …, AD-26 … and AD-27 … are **new in revision 2**."

The spine is at revision **4** with **28** ADs. C-32 already proposed the rev-3 update and is unapplied; this supersedes it rather than adding to it.

> *Proposed:* fold C-32 into one edit. State that revision 3 amended AD-9, AD-11, AD-12, AD-18, AD-19, AD-21, AD-26 and AD-27 in place and added no AD; that revision 4 amended **AD-5, AD-10, AD-11, AD-16 and AD-18** in place and added **AD-28**; and that AD ids are stable throughout, so every existing `(AD-n)` citation in the PRD remains valid and only the amended ADs' contents moved. Add AD-28 to §0's list of decisions that bear on requirements below. Bump the PRD's own `revision` and `updated` front matter. Governing: **spine front matter, revision banner `:25`**.

*Severity: low.*

#### C-48 — §10 OQ-11's retained body is now doubly wrong about the spine

> *Current (`prd.md:675`):* "**OQ-11 — The spine still writes `valueMax?` in two places.** … AD-11 and AD-18 still spell the band `(statId, valueMin, valueMax?, …)` and AD-18 still says 'an omitted `ref.valueMax` is unbounded above'."

Revision 3 removed both spellings; revision 4 rewrote both entries again (AD-11 `:181` now gives two kind-specific shapes, AD-18 `:301` now says *"There is no open-top form to handle … `contracts` rejects it at the schema"*). C-31 already proposed retiring OQ-8 … OQ-11 with **Resolved:** clauses; this adds that OQ-11's Resolved clause must now cite the **rev-4** wording, and must repeat C-31's caveat that the closure was syntactic — C-23's edge-alignment residue is still unapplied in the PRD.

*Severity: low.*

#### C-49 — The addendum's "adjacent disjoint tiers may both be tracked, which is now the point" is true of only one modifier class

> *Current (`addendum.md:95`):* "with bands, adjacent disjoint tiers may both be tracked, which is now the point rather than the error."

Still true for single-`#` modifiers, and the sentence is doing real work as the record of what BQ-1's amendment bought. For multi-`#` modifiers — 53 of 63 item classes — AD-28 `:504` says the opposite: a tier cannot be isolated at all, and a reference near a boundary necessarily includes the neighbour's tail.

Like C-19's treatment of the same passage, the **reasoning survives and the mechanism sentence does not**.

> *Proposed:* append one sentence recording that spine revision 4 narrowed this to single-number modifiers, with a pointer at AD-28 and at the reason it is correct rather than a regression (the trade search cannot isolate the tier either). Keep the paragraph. Governing AD: **AD-28**.

*Severity: low.*

---

## Part 3 — Two drifts outside this file's scope

Neither is a PRD edit; both are companion sweeps for the next spine touch.

- **`AGENT-WORKFLOW.md:89` still states AD-27's numerator with only the middle condition** — *"have `poolCoverage: "complete"` in **both** slots"*. AD-27 `:458-466` requires three (present in `weights.json`; both slots `complete`; neither pool empty) and argues at length that stating only the middle one lets the same inputs score 100% or 40%. The workflow document is what an agent executing the build actually reads, and the coverage measurement is build task 2 there. This is the rev-3 residue that §14 of `PRD-EDIT-PROPOSALS.md` already flagged for the denominator; the numerator half arrived in the rev-3 gate fixes and did not reach the workflow.
- **`AGENT-WORKFLOW.md:89` likewise says nothing about re-measurement**, which is the AD-27 gap described in Part 1 under D4. If AD-27 gains a re-measurement clause, the build-order step needs the same sentence — otherwise the only instruction an agent has continues to read as one-time.
