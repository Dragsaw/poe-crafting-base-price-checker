# Extract — full analysis behind PRD proposals C-22…C-52

**Source reviews** (all under `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/reviews/`):
`review-rev4-reconcile.md`, `review-rev4-adversarial.md`, `review-rev4-rubric.md`,
`review-rev4-verification.md`, `review-rev3-reconcile.md`, `review-rev3-adversarial.md`.

**How to read this.** Part 1 is C-33…C-49, extracted from `review-rev4-reconcile.md` Part 2 —
the one place their full analysis exists. Part 2 covers C-50…C-52, whose proposed text is **not**
in any review (stated explicitly, with where the source text actually lives). Part 3 collects what
the rev-3 reviews add to or correct in C-22…C-32. Part 4 lists non-PRD drifts.

**Important caveat about "verbatim".** `review-rev4-reconcile.md` quotes **current** PRD text
verbatim inside blockquotes, but its `> *Proposed:*` paragraphs are *instructions for the edit*,
not drop-in replacement prose. Where the review does give literal replacement material — the
`slotOverlap` code block (C-39), the hard-error enumeration (C-35), the four provenance values
(C-33), the two-row containment table (C-38) — it is reproduced exactly below and marked
**[literal]**. Everything else is marked **[instructional]** and will need to be written out
against the governing AD text in `ARCHITECTURE-SPINE.md` / `WEIGHTS-FILE-SCHEMA.md`.

---

# Part 1 — C-33…C-49 (from `review-rev4-reconcile.md`)

Severity tallies given by the review: **17 items — 4 severe, 6 high, 4 medium, 3 low; 14
substantive, 3 bookkeeping.** Ordered by how badly the current text would mislead a builder or a
producer reading only the PRD.

---

## C-33 — §3 *Provenance* fixes a three-value enum; AD-10 now has four

- **Target:** §3 Glossary, *Provenance* — `prd.md:92`
- **Severity:** severe. Content change.
- **Governing AD:** **AD-10**

**Current text (verbatim, `prd.md:92`):**

> **Provenance** — what a derived figure rests on: `measured`, `uniform-prior`, or `absent`.

**Reasoning (from the review):**

> This is the Glossary entry a builder of `contracts` reads to write the Zod enum, and the PRD's
> own §3 preamble makes Glossary terms binding (*"Introducing a synonym anywhere is a discipline
> violation"*). AD-10 `:166-175` now defines a **four-value total order**, and the contract `:203`
> makes `"modelled-split"` a legal per-entry value in the file.
>
> The consequence is not stylistic. Every decomposed multi-number family carries
> `provenance: "modelled-split"` (AD-28 `:500`, contract `:106`), and 53 of 63 item classes carry
> such modifiers. A `provenance` enum built to this Glossary entry rejects the file at load, and
> `core` *"refuses to rank from an invalid file rather than ranking partially"* (contract `:207`)
> — so the PRD as written turns a correct weights file into a total product outage.

**Proposed (verbatim from the review) [literal enum, instructional prose]:**

> *Proposed:* replace with AD-10's four-value order, weakest first — `absent`, `uniform-prior`,
> `modelled-split`, `measured` — with the one-line meaning of each and the note that `absent`
> arises only from a `partial` pool and `modelled-split` only from AD-28's decomposition. Keep the
> weakest-input propagation sentence unchanged. Governing AD: **AD-10**.

**Supporting spine text for writing the four meanings** (quoted inside the review's Part 1, D2):

- `ARCHITECTURE-SPINE.md:166` — *"Provenance is a **four-value total order**, weakest first"*.
- `:172` — the `modelled-split` row: *"the weight was **measured**, but a **model** distributed it
  across value cells | AD-28's decomposition, and nowhere else"*.
- `:175` — *"`web` must render … `modelled-split` distinctly from `uniform-prior` — collapsing the
  two would either overstate an invented weight or understate a measured one."*

**Cross-review addition (`review-rev4-adversarial.md` A-6, HIGH):** the order is stated in AD-10
but **no ranks are assigned**, and `WEIGHTS-FILE-SCHEMA.md:203` lists the values in the *opposite*
order (`"measured" | "modelled-split" | "uniform-prior"`). A builder authoring the Zod enum from
the schema row and implementing "weakest" as `minBy(enumIndex)` gets `measured` as weakest.
A-6's fix: *"assign explicit integer ranks in `contracts` and state them in AD-10, and make
SCHEMA:203 cite the rank order rather than an arbitrary one."* Worth carrying into the PRD edit as
an explicit weakest-first rank list rather than a bare set.

---

## C-34 — §3 *Modifier Reference* admits only the banded kind, and its "always" makes the valueless case unrepresentable

- **Target:** §3 Glossary, *Modifier Reference* — `prd.md:69`
- **Severity:** severe. Content change.
- **Governing AD:** **AD-5**

**Current text (verbatim, `prd.md:69`):**

> the canonical identity of a modifier: a trade API `statId` paired with an inclusive, closed
> **value band** `(valueMin, valueMax)` … **`valueMax` is required, always** — an omitted ceiling
> is a floor by another name.

**Reasoning (from the review):**

> AD-5 `:99-106` now defines `ModifierRef` as a discriminated union of `banded` and `valueless`,
> and the `valueless` kind carries **no edges at all**. The current wording leaves a modifier that
> rolls no number — *"Loads an additional bolt"* — with nowhere to live but the sentinel form
> AD-5 `:106` explicitly rejects, and rejects on the ground that it *"would pass every
> containment, straddle and edge-alignment check while making AD-16 emit a min/max filter for a
> stat that has no value."* A builder obeying this Glossary entry writes the defect the spine
> spent a paragraph foreclosing.

**Proposed (verbatim from the review) [instructional]:**

> *Proposed:* restate as the two-kind union with `kind` as the discriminant, preserving the
> `valueMax`-required rule **scoped to the banded kind** (where its BQ-1 argument still holds in
> full) and adding AD-5's sentence that a valueless reference is not a degenerate band. Note that
> a valueless reference still carries `weight` and `itemLevelMin` and still counts toward pool
> completeness. Governing AD: **AD-5**.

**Supporting spine text quoted in the review's D3 section:**

- `ARCHITECTURE-SPINE.md:99-106` — the two-kind table, plus the sentinel rejection: *"A sentinel
  pair such as `1/1` would pass every containment, straddle and edge-alignment check while making
  AD-16 emit a min/max filter for a stat that has no value — the same class of defect as the
  sentinel ceiling this AD's `valueMax` rule exists to close."*
- `:106` — a valueless reference still carries `weight` and `itemLevelMin` and still counts toward
  pool completeness.
- Contract `:196` — `kind` is *"the discriminant, not a hint"*; `:198` — `valueMin`/`valueMax` are
  **forbidden** on `valueless`.

---

## C-35 — FR-27's hard-error list refuses a conforming 3.0.0 file, and pins the wrong schema version

- **Target:** FR-27 — `prd.md:472` (hard-error list) and `prd.md:469` (version pin)
- **Severity:** severe. Content change.
- **Governing ADs:** **AD-28, AD-5, AD-11**

**Current text (verbatim, `prd.md:472`):**

> Hard file errors reject the file outright (schema 2.0.0): … a duplicate
> `(statId, valueMin, valueMax, itemLevelMin)` within a slot; **a missing or `null` `valueMax` on
> any band**; a missing `itemLevelMin`; **overlapping value bands for one `statId` within a
> slot**; …

**Current text (verbatim, `prd.md:469`):**

> A producer building to a 1.x shape emits a file that `core` refuses (schema **2.0.0**,
> breaking).

**Reasoning (three defects, one fatal — verbatim from the review):**

> - **The unscoped non-overlap error is the single line that makes a correct file illegal.**
>   AD-28 `:502` and contract `:199` now require that entries sharing a `statId` at **different**
>   `itemLevelMin` **may** cover the same interval — that is precisely how a decomposed family
>   expresses two cohorts' mass in one cell, and the contract's worked example `:92` emits
>   `[56, 56.5]` twice by construction. As written, FR-27 rejects the Bows example in the contract.
> - `valueMax` required "on any band" is now wrong for a `valueless` entry, where both edges are
>   **forbidden** (contract `:198`).
> - The duplicate key omits `kind`; the contract `:214` uses
>   `(statId, kind, valueMin, valueMax, itemLevelMin)`.

**Proposed (verbatim from the review) [literal enumeration]:**

> *Proposed:* replace the list wholesale with the contract's `:209-221` hard errors, and re-pin
> the version to **3.0.0**: unknown `schemaVersion` major; missing or unrecognised `kind`, or one
> `statId` under both kinds; edges present on a `valueless` entry, or missing/`null`/non-numeric
> on a `banded` one; duplicate `(statId, kind, valueMin, valueMax, itemLevelMin)` within a slot;
> **overlapping value bands for one `statId` *at the same `itemLevelMin`*, overlap across
> different `itemLevelMin` being legal**; missing or negative `weight`; missing `itemLevelMin`;
> missing `poolCoverage`; `provenance: "absent"` in a file; **a missing or empty `gamePatch`**; a
> `statId` or base key absent from the committed Trade Catalogue; an entry straddling a band edge
> in use by `data/tracked.json`. Retain the contract's closing note that the straddle check is the
> one that matters and is checked directly rather than inferred from disjointness. Governing ADs:
> **AD-28, AD-5, AD-11**.

**Two later additions to this same list (see Part 2):** C-50 adds a `cohortTotals` conservation
error and a *"a cell carried by more than two cohorts"* error to this same FR-27 enumeration.
Those two error rows post-date the review and must be taken from `WEIGHTS-FILE-SCHEMA.md:269` and
`ARCHITECTURE-SPINE.md:528`.

---

## C-36 — FR-22 and §3 *Accepted Tier* specify a tier-to-band mapping AD-28 says does not exist

- **Target:** §3 Glossary *Accepted Tier* (`prd.md:76`) and FR-22 (`prd.md:398`)
- **Severity:** severe. Content change, **and it changes a curation instruction the player acts on
  by hand.**
- **Governing ADs:** **AD-28, AD-5, AD-18**

**Current text (verbatim, `prd.md:76`):**

> **Accepted Tier** … Expressed mechanically as the Modifier Reference's **band** — both edges,
> not a floor.

**Current text (verbatim, `prd.md:398`):**

> The Accepted Tier decision and the Modifier Reference's **band** are **one act** — since the
> trade API has no tier concept (AD-5), '**accept tier 2**' means setting the reference's
> `valueMin` and `valueMax` to the tier 2 band's edges.

**Reasoning (from the review):**

> This is the tier-to-band mapping AD-28 exists to deny. For a modifier whose text carries more
> than one `#` — 53 of 63 item classes — *"the value axis does not partition the tier axis"*
> (AD-28 `:484`), a tier has **no** pair of value edges that isolates it, and a reference near a
> tier boundary *"necessarily includes the neighbouring tier's tail"* (AD-28 `:504`, contract
> `:110`).
>
> A curator following FR-22 literally takes the tier's own value range and writes it as the
> reference's edges. For a multi-`#` family those edges land mid-cell — the contract's Bows T8
> runs 56.0–80.0 while the cells are `[56,56.5] [57,78.5] [79,80]` — and the entry then fails
> **AD-18's edge-alignment rule** (`:303-310`) at load. So the PRD instructs the curator to author
> an entry that `core` rejects, and it does so in the one FR whose whole job is to tell the curator
> how to author entries.

**Proposed (verbatim from the review) [instructional]:**

> *Proposed:* split the Accepted Tier rule by kind. For a single-`#` modifier the current text
> stands unchanged — tier and band coincide. For a multi-`#` modifier, state AD-28's consequence
> plainly: the reference's edges must align to **cell** edges the Weights File declares, a
> reference spanning a tier boundary necessarily includes the neighbouring tier's tail, and this
> is correct rather than a defect *because the trade search cannot isolate that tier either* — so
> the priced population and the weighted population remain the same population, which is the only
> property FR-21 and FR-29 jointly require. Add the contract's reassurance (`:114`) that band
> count roughly doubles for affected families but the **request budget is unchanged**, since one
> tracked reference is still one entry and one search — otherwise a curator reading this will
> assume FR-14's ceiling just moved. Governing ADs: **AD-28, AD-5, AD-18**.

**Land together with C-51** (per `PRD-EDIT-PROPOSALS.md` §20) — C-51 adds the interior-cell
curation rule to the same FR-22 guidance.

---

## C-37 — §3 *Modifier Weight* describes a tier row, not a cell in a cohort

- **Target:** §3 Glossary, *Modifier Weight* — `prd.md:88`
- **Severity:** high. Content change.
- **Governing ADs:** **AD-11, AD-28, AD-5**

**Current text (verbatim, `prd.md:88`):**

> **Modifier Weight** — a raw game spawn weight for one band within a Base Type and affix slot,
> banded by rolled value **and by item level** — `(statId, valueMin, valueMax, itemLevelMin,
> weight)`.

**Reasoning (from the review):**

> No `kind`, no per-entry `provenance`, and — the substantive part — no statement that an entry is
> a **value cell within an item-level cohort** rather than a tier. The spine's own entity note
> (`:627`) now reads *"A `ModifierWeight` is a value **cell** within an item-level cohort, not a
> tier"*, and the contract `:54` adds *"after decomposition a cell may not correspond to a single
> tier at all."*

**Proposed (verbatim from the review) [literal tuples]:**

> *Proposed:* restate as a value **cell** carrying mass from one item-level cohort; give both
> shapes (`(statId, kind, valueMin, valueMax, itemLevelMin, weight, provenance)` banded,
> `(statId, kind, itemLevelMin, weight, provenance)` valueless); add that `tierLabel` is
> display-only and may legitimately name a mixture (`"T7–T8"`), and that `core` must never branch
> on it. Governing ADs: **AD-11, AD-28, AD-5**.

---

## C-38 — FR-29's containment rule has no `valueless` branch

- **Target:** FR-29 — `prd.md:491` (containment), with knock-ons at the C-23 edge-alignment clause
  and `prd.md:494` (empty-containment error)
- **Severity:** high. Content change.
- **Governing ADs:** **AD-18, AD-5**

**Current text (verbatim, `prd.md:491`):**

> A Modifier Reference is a **bounded band**: its weight is the sum of every Weights File band …
> carrying that `statId` and lying **wholly inside** the reference — `band.valueMin >=` the
> reference's `valueMin` **and** `band.valueMax <=` its `valueMax`.

**Reasoning (from the review):**

> AD-18 `:294-301` now states containment as a table keyed on the reference's kind: a `banded`
> reference contains a `banded` entry lying wholly inside it; a `valueless` reference contains a
> `valueless` entry sharing the `statId`. A builder implementing FR-29 as written has no rule at
> all for a valueless reference and will either invent one or crash on absent edges.
>
> Two adjacent clauses need the same qualifier:
>
> - The **edge-alignment rule** proposed in C-23 (still unapplied) must be scoped **`banded`
>   only** — AD-18 `:303` says so explicitly, *"a `valueless` one has no edges to align"*.
>   Applying C-23 without this qualifier would make every valueless reference a validation error.
> - The **empty-containment-set** error (`prd.md:494`) is kind-agnostic in AD-18 and should stay
>   so.

**Proposed (verbatim from the review) [instructional; the table itself is to be taken verbatim from AD-18 `:294-301`]:**

> *Proposed:* adopt AD-18's two-row table verbatim, scope the edge-alignment consequence to
> `banded`, and add AD-18's *"Whole bands only"* note that `contracts` rejects an open-top
> reference at the schema so `core` never encounters one. Governing ADs: **AD-18, AD-5**.

**This is also a correction to C-23** — see Part 3.

---

## C-39 — FR-16's overlap predicate is missing two of `slotOverlap`'s four branches

- **Target:** FR-16 — `prd.md:305`
- **Severity:** high. Content change.
- **Governing AD:** **AD-17**

**Current text (verbatim, `prd.md:305`):**

> Two entries on one Base Type overlap when, **for both slots**, either the slot is absent in one
> of them or their bands intersect.

**The replacement predicate (verbatim code block from the review, AD-17 `:266-274`) [literal]:**

```
slotOverlap(x, y) =  true              if x is absent or y is absent
                     false             if x.statId != y.statId
                     true              if both are valueless
                     bands intersect   otherwise
```

**Reasoning (from the review):**

> The `statId` mismatch branch was always implicit in "their bands intersect" and is harmless to
> state; the **both-valueless** branch is not implicit and is not derivable from the current text,
> because two valueless references have no bands to intersect — so a builder implementing FR-16 as
> written concludes two identical valueless entries on one base **do not overlap**, and lets a
> tracked list through that double-counts on a partition AD-17 exists to protect.
>
> AD-17 `:274` also forecloses the one unreachable pairing (one banded and one valueless reference
> sharing a `statId`) in `contracts` rather than in `core`; FR-16 should name that ownership,
> because it is the kind of case a `core` implementer will otherwise handle defensively and
> inconsistently.

**Proposed (verbatim from the review):**

> *Proposed:* replace the prose predicate with AD-17's four-branch form, retain the three
> consequences already in FR-16 unchanged (they are all still correct), and add the `contracts`-
> side rejection of the mixed-kind `statId` pairing. Governing AD: **AD-17**.

**Cross-review caveat (`review-rev4-rubric.md` M-4, MEDIUM; `review-rev4-adversarial.md` A-13):**
AD-17 assigns the cross-kind rejection to `contracts`, **which cannot perform it** — the contract's
equivalent rule is scoped *within a file*, and the pairing AD-17 worries about is *cross-file*
(a `valueless` reference in `tracked.json` against `banded` entries in `weights.json`), which no
per-file Zod schema can see. If the PRD names `contracts` as the owner it will inherit a check
that lands nowhere. M-4's fix: *"Name the owner — `core` at load, like every other cross-file rule
— or drop the claim."*

---

## C-40 — FR-21's stat filter has no valueless form, and assumes integer edges

- **Target:** FR-21 — `prd.md:382` (stat-filter bullet) plus FR-21's trap list
- **Severity:** high. Content change.
- **Governing ADs:** **AD-16, AD-5, AD-28**

**Current text (verbatim, `prd.md:382`):**

> the entry's Modifier References as stat filters carrying **both `min` and `max`** from the band.

**Reasoning (from the review):**

> AD-16 `:235` now reads: *"a `banded` reference carries **both `min` and `max`** from the band; a
> `valueless` reference carries the stat id and **no edges at all**"*. Emitting `min`/`max` for a
> stat that rolls no value is the operational half of the sentinel defect AD-5 `:106` rejects — it
> does not error, it silently returns nothing or the wrong population.
>
> Second, smaller: FR-21 gives no hint that band edges may be **non-integer**. Under an averaged
> unit the lattice is half-integers (AD-28 `:506`, contract `:62`), and whether the filter accepts
> a non-integer `min`/`max` is unconfirmed (spine Open Questions `:703`). FR-21 is the requirement
> whose fourth bullet already catalogues the traps a `sync` implementer must not discover in code;
> this belongs with them.

**Proposed (verbatim from the review) [instructional]:**

> *Proposed:* split the stat-filter bullet by reference kind, and add a trap bullet: band edges are
> expressed in the single quantity the trade stat filter compares and may be non-integer; whether
> the filter accepts non-integer `min`/`max` is an open question owned by the weights scraper
> project (C-49), and getting the unit wrong produces a file that validates and prices the wrong
> population. Governing ADs: **AD-16, AD-5, AD-28**.

> **Note on the review's own cross-reference:** it says the open question is "(C-49)". The open
> question item is **C-46**; C-49 is the addendum sentence. Treat the pointer as C-46.

**Cross-review additions:**

- `review-rev4-adversarial.md` **A-14 (MEDIUM)** — the `valueless` filter shape is **asserted where
  its three siblings are measured**. Whether the `trade2` stat-filter object accepts a stat id with
  `value` omitted entirely, versus requiring `{ "value": {} }`, versus rejecting it, is an
  unverified live-payload fact of the class that *"has already been wrong twice on this AD"*.
  *"Mark it as unverified with an owner, or verify it."* Worth carrying into the FR-21 trap list.
- `review-rev4-rubric.md` **H-4 (HIGH)** — the consumer-side half is undecided: nothing says what
  `sync` does with a half-integer edge if the filter turns out to be integer-only — *"round
  (silently repricing a different population), reject at load, or refuse the file."*
- `review-rev4-adversarial.md` **A-12 (MEDIUM)** — a non-integer lattice was introduced but no
  numeric comparison rule: *"State the rule: edges are exact decimal values on a declared lattice,
  compared exactly, and the lattice step is part of the contract."*

---

## C-41 — FR-10 and FR-11 collapse `modelled-split` into the placeholder bucket

- **Target:** FR-10 (`prd.md:232`) and FR-11 (`prd.md:242`)
- **Severity:** high. Content change.
- **Governing AD:** **AD-10**

**Current text (verbatim, `prd.md:232`):**

> A figure resting on `uniform-prior` or `absent` renders visibly differently from one resting on
> `measured`.

**Current text (verbatim, `prd.md:242`):**

> When **every** probability in the loaded set carries `uniform-prior` or `absent`, the view shows
> a **persistent, dismissible-per-session banner** stating that the entire ranking rests on a
> uniform prior.

**Reasoning (from the review):**

> AD-10 `:175` requires something the first sentence does not express: *"`web` must render a figure
> resting on anything below `measured` visibly differently from one resting on `measured`, **and
> `modelled-split` distinctly from `uniform-prior`** — collapsing the two would either overstate an
> invented weight or understate a measured one."* Two render states are not enough; three are
> required.
>
> FR-11 is the sharper problem. Its banner condition is a predicate over the whole loaded set, and
> a realistic first file — a decomposed scrape of real weights — carries `modelled-split` across
> most weapon classes and `measured` elsewhere. Under the current wording the banner is correctly
> silent, but the *reason* stated in FR-11's first consequence (*"a probability's Provenance may
> legitimately be `measured`"*) no longer enumerates the live cases. More importantly, a builder
> who reads FR-11's binary framing and then implements FR-10's badge from the same mental model
> produces two visual states and drags whole weapon classes into the degraded rendering — the
> outcome the memlog records as the explicit reason `modelled-split` was created rather than folded
> into `uniform-prior`.

**Proposed (verbatim from the review) [literal render states / literal banner predicate]:**

> *Proposed:* FR-10 — state three distinguishable render treatments (`measured`; `modelled-split`;
> `uniform-prior`/`absent`), each not carried by colour alone per NFR-10, with AD-10's one-line
> reason. FR-11 — restate the banner condition as *no probability in the loaded set carries
> `measured` or `modelled-split`*, and add a consequence saying a `modelled-split` figure is a
> **measured weight distributed by a model**, so it is neither a placeholder that triggers the
> banner nor a figure rendered as plainly as `measured`. Governing AD: **AD-10**.

**Cross-review addition — the unresolved question underneath (`review-rev4-adversarial.md` A-6
half two, HIGH; `review-rev4-rubric.md` H-5, HIGH):** *no rule says whether the **denominator's**
entries contribute provenance to a probability.*

- **Numerator-only reading:** a base with `measured` chase mods and `uniform-prior`/`modelled-split`
  filler elsewhere in the pool renders its chase rows as `measured`.
- **Whole-ratio reading:** one `modelled-split` cell anywhere in the pool drags **every**
  probability on that base to `modelled-split` — which across weapons is essentially the whole
  catalogue, making the degraded rendering the product's default state (H-5).

AD-10 must decide it. If the PRD lands C-41 without noting which reading applies, FR-10's three
render states are still ambiguous in exactly the place that decides what the user sees.

---

## C-42 — FR-28 is silent on TBD placeholder rows, so a producer reading the PRD drops them and still claims `complete`

- **Target:** FR-28 (`prd.md:480`), with a recorded-cost addition to §7.3 or FR-4
- **Severity:** high. Content change. *(The review adds: "and see the AD-27 re-measurement gap in
  Part 1 — the layout consequence of this bullet is the one the spine has not settled." That gap is
  now C-52.)*
- **Governing ADs:** **AD-18, AD-27**, spine Deferred

**Current text (verbatim, `prd.md:480`):**

> a `(Base Type, slot)` declaring `poolCoverage: "complete"` must enumerate **every** modifier that
> can roll there **at any item level**, including worthless ones, with true weights and true
> `itemLevelMin`.

**Reasoning (from the review):**

> FR-28's own framing (`prd.md:482`) is that *"this document plus `WEIGHTS-FILE-SCHEMA.md` are its
> entire contract"* for an external project. The rev-4 decision adds a rule that FR-28 does not
> carry and that a producer will otherwise get wrong in the obvious direction: where a source
> publishes a row as an unnamed `TBD`, **the modifier exists and carries real spawn weight**, so
> dropping it shrinks the denominator and inflates every other probability on that base — and the
> pool is therefore `partial`, not `complete` (contract `:129`).
>
> The second half is equally load-bearing and equally absent: the `unidentifiedWeight` escape hatch
> — a per-`(base, slot)` scalar entering the denominator but never a numerator — was **considered
> and rejected** (spine Deferred `:688`), so a producer must not invent one. A requirements
> document that states the completeness obligation but not the two ways a producer will try to
> satisfy it cheaply is not the whole contract it claims to be.

**Proposed (verbatim from the review) [instructional]:**

> *Proposed:* add two consequences to FR-28's producer side. (1) An unnamed placeholder row still
> counts: emit the rest of the pool, declare `partial`, and the Base Type returns to the ranking
> when the source names the rows. (2) There is deliberately **no field for anonymous weight** — it
> would let a producer hide an arbitrary share of the pool behind a scalar nobody can check — and
> adding one is an architecture amendment, not a producer convenience. Add the recorded cost to
> §7.3 or FR-4: placeholder rows are a **patch-cadence phenomenon**, so freshly scraped classes may
> go Unrankable immediately after a patch until the source catches up. Governing ADs: **AD-18,
> AD-27**, spine Deferred.

**Supporting source text quoted in the review's Part 1, D4:**

- Contract `:129` — *"a pool with dropped placeholder rows is `partial`, not `complete`"*; *"There
  is deliberately no field for anonymous weight: it would be a way for a producer to hide an
  arbitrary share of the pool behind a scalar nobody can check"*; *"Placeholder rows are a
  patch-cadence phenomenon, so expect freshly scraped classes to be `partial` until the source
  names them."*
- Spine Deferred `:688` — *"**Unidentified pool weight.** Considered and rejected for this revision
  … Rejected because it is a new way for a producer to hide weight, against a present cost of 7
  rows in one item class. **Revisit if** unnamed rows recur at scale"*.

---

## C-43 — FR-27's "must not pre-aggregate bands" now reads against AD-28

- **Target:** FR-27 — `prd.md:468`
- **Severity:** medium. *"Wording, but it resolves a live ambiguity in a producer-facing
  obligation."*
- **Governing ADs:** **AD-11, AD-28**

**Current text (verbatim, `prd.md:468`):**

> Producers must not normalise and must not pre-aggregate bands (AD-11, `WEIGHTS-FILE-SCHEMA.md`).

**Reasoning (from the review):**

> AD-28 requires the producer to do something that looks exactly like pre-aggregation: sum several
> tiers' mass into one cell (`:494-498`). The distinction the contract draws (`:50`) is *"must not
> pre-aggregate **cells**"* — aggregation **across tiers into a cell** is mandatory, aggregation
> **across cells** is forbidden, because `core` sums cells and only cells.
>
> As written, a conscientious producer reading FR-27 has a direct conflict between two of its own
> obligations and no text resolving it.

**Proposed (verbatim from the review) [literal word swap + instructional clause]:**

> *Proposed:* replace "bands" with "cells" and add one clause: a cell's weight is the conserving
> sum of the mass its cohort's tiers contribute to it (AD-28), and that summation is the producer's
> job; summing two cells together is not. Governing ADs: **AD-11, AD-28**.

---

## C-44 — §3 *Eligible Pool* describes one band per interval

- **Target:** §3 Glossary, *Eligible Pool* — `prd.md:91`
- **Severity:** medium.
- **Governing ADs:** **AD-18, AD-28**

**Current text (verbatim, `prd.md:91`):**

> the complete set of modifiers that can roll in one `(Base Type, slot)` at **any** item level,
> each band carrying the item level at which it becomes available.

**Reasoning (from the review):**

> "Each band carrying the item level at which it becomes available" implies one entry per interval.
> Under AD-28 the same interval legitimately appears **more than once**, once per item-level cohort
> that can reach it, and `core`'s scoping is what admits each at most once. The definition is not
> wrong so much as unable to describe the file it names, and the Glossary is where a `core`
> implementer looks for the shape before writing the scoping code.

**Proposed (verbatim from the review) [instructional]:**

> *Proposed:* restate as the set of value **cells** per `(Base Type, slot)`, each carrying the
> `itemLevelMin` of the cohort whose mass it holds; note that the same value interval may appear
> under more than one `itemLevelMin` and that scoping to the entry's Item Level Floor is what
> admits each at most once (AD-18, AD-28). Governing ADs: **AD-18, AD-28**.

---

## C-45 — `gamePatch` has a render requirement in FR-10 but no definition anywhere

- **Target:** §3 Glossary under *Weights File*; the FR-27 hard-error half is already folded into
  C-35
- **Severity:** medium.
- **Governing ADs:** **AD-11, AD-10** (once amended)
- **Ordering constraint (stated in the review):** *"this proposal is contingent on the spine gap
  being closed first — the PRD is downstream of the spine by its own §0, so the AD-11/AD-10 clauses
  proposed in Part 1 should land before this edit."*

**Current state (from the review):** FR-10 (`prd.md:233`) already requires *"The Weights File's
declared producer and game patch are visible alongside any figure they influenced"* — so the PRD is
ahead of the spine.

**What is missing (verbatim from the review):**

> What it lacks is any statement of what the field **is**: operator-asserted at run time, required,
> never defaulted and never inferred, with a producer obliged to refuse to run without it, and a
> missing or empty value a hard file error. `core` does not parse it.

**Proposed (verbatim from the review) [instructional]:**

> *Proposed:* add `gamePatch` to §3 under *Weights File*, and add the hard-error entry to FR-27
> (already folded into C-35). Governing ADs: **AD-11, AD-10** (once amended).

**Spine-gap context (review Part 1, D4 — the "MISSING FROM THE SPINE" finding).** A full-text
search of `ARCHITECTURE-SPINE.md` for `gamePatch`, `game patch`, `generatedAt` and `sourceUrl`
returns **nothing**; the only architecture-directory hits are in `WEIGHTS-FILE-SCHEMA.md`
(`:30`, `:129`, `:138`, `:191`, `:217`) and `.memlog.md:124`. The review's proposed spine fix,
which C-45 is downstream of:

> **Proposed:** one sentence in AD-11 (the file carries an operator-asserted `gamePatch`; `core`
> never parses it; a missing or empty value is a hard file error) and one clause in AD-10 (`web`
> surfaces `gamePatch`, `producer.id` and `producer.generatedAt` beside any figure the file
> influenced), with the detail left in the contract.

---

## C-46 — §10 has no open question for the filter unit, which is blocking for correctness

- **Target:** §10 *Non-blocking* open-question list (alongside OQ-5, OQ-6); cross-references from
  §7.3 and FR-21
- **Severity:** medium. *"This is a new requirement rather than a contradiction, but it gates the
  same delivery §7.3 already gates."*
- **Governing ADs:** **AD-28, AD-16**

**Reasoning (from the review):**

> The spine carries it (`:703`) as an Open Question owned by the weights scraper project and marks
> it *"Blocking for correctness, not for building"*: which single quantity the `trade2` stat filter
> compares for a multi-`#` stat, and whether it accepts non-integer `min`/`max`. Getting it wrong
> produces a file that validates and prices the wrong population — a silent corruption of every
> price on 53 of 63 item classes.
>
> §10's *Non-blocking* list is where the PRD carries exactly this class of item (OQ-5, OQ-6), and
> §7.3 already names the scraper project as a release dependency with a measurement gate. This one
> is a second gate on the same dependency and belongs beside it.

**Proposed (verbatim from the review) [instructional]:**

> *Proposed:* add an OQ to §10 stating the question, the evidence (a 56.5 band edge can only arise
> from averaging two integers), the two unconfirmed facts, the owner (the weights scraper project,
> by live verification against `trade2` search plus `/data/stats`), and the consequence.
> Cross-reference from §7.3 as the second gate on the Weights File dependency, and from FR-21
> (C-40). Governing ADs: **AD-28, AD-16**.

**Supporting fact (`review-rev4-verification.md` V-5):** the 56.5-from-averaging inference is
*"arithmetically sound as an inference about averaging"*; whether the trade filter in fact compares
the average is **UNVERIFIABLE** from this repository and remains owned at `ARCHITECTURE-SPINE.md:703`.

---

## C-47 — §0 and the front matter are pinned to "final at revision 2"

- **Target:** §0 (`prd.md:20`) and the PRD front matter
- **Severity:** low.
- **Governing:** **spine front matter, revision banner `:25`**
- **Supersedes C-32** (explicitly: *"C-32 already proposed the rev-3 update and is unapplied; this
  supersedes it rather than adding to it."*)

**Current text (verbatim, `prd.md:20`):**

> `ARCHITECTURE-SPINE.md` is final at revision **2**, and its decisions AD-1 through AD-**27** are
> **inherited, not re-decided**. AD-25 …, AD-26 … and AD-27 … are **new in revision 2**.

**Proposed (verbatim from the review) [literal AD lists]:**

> *Proposed:* fold C-32 into one edit. State that revision 3 amended AD-9, AD-11, AD-12, AD-18,
> AD-19, AD-21, AD-26 and AD-27 in place and added no AD; that revision 4 amended **AD-5, AD-10,
> AD-11, AD-16 and AD-18** in place and added **AD-28**; and that AD ids are stable throughout, so
> every existing `(AD-n)` citation in the PRD remains valid and only the amended ADs' contents
> moved. Add AD-28 to §0's list of decisions that bear on requirements below. Bump the PRD's own
> `revision` and `updated` front matter. Governing: **spine front matter, revision banner `:25`**.

> **Correction to the rev-4 amended-AD list.** `review-rev4-rubric.md` **M-1 (MEDIUM)** finds the
> spine's own revision-4 changelog **omits AD-17**, which demonstrably changed (`slotOverlap` gained
> *"true if both are valueless"*, and the whole `:274` paragraph on the unreachable banded/valueless
> pairing is new). The Consistency Conventions rows for Bands (`:516`), Entity keys (`:517`) and the
> core-entities note (`:627`) also changed and are unlisted. **AD-27 was also amended** (the
> coverage re-measurement clause now at `ARCHITECTURE-SPINE.md:488`).
> `PRD-EDIT-PROPOSALS.md:497` already states the corrected list: revision 4 amended **AD-5, AD-10,
> AD-11, AD-16, AD-17, AD-18 and AD-27** and added **AD-28**. Use that list, not the review's.

---

## C-48 — §10 OQ-11's retained body is now doubly wrong about the spine

- **Target:** §10, OQ-11 — `prd.md:675`
- **Severity:** low.
- **Governing ADs:** AD-11, AD-18 (rev-4 wording)

**Current text (verbatim, `prd.md:675`):**

> **OQ-11 — The spine still writes `valueMax?` in two places.** … AD-11 and AD-18 still spell the
> band `(statId, valueMin, valueMax?, …)` and AD-18 still says 'an omitted `ref.valueMax` is
> unbounded above'.

**Reasoning and proposal (verbatim from the review):**

> Revision 3 removed both spellings; revision 4 rewrote both entries again (AD-11 `:181` now gives
> two kind-specific shapes, AD-18 `:301` now says *"There is no open-top form to handle …
> `contracts` rejects it at the schema"*). C-31 already proposed retiring OQ-8 … OQ-11 with
> **Resolved:** clauses; this adds that OQ-11's Resolved clause must now cite the **rev-4** wording,
> and must repeat C-31's caveat that the closure was syntactic — C-23's edge-alignment residue is
> still unapplied in the PRD.

*(No separate "Proposed:" block; the paragraph above is the whole proposal. This is an addition to
C-31, not a replacement — see Part 3.)*

---

## C-49 — The addendum's "adjacent disjoint tiers may both be tracked, which is now the point" is true of only one modifier class

- **Target:** `addendum.md:95`
- **Severity:** low.
- **Governing AD:** **AD-28**

**Current text (verbatim, `addendum.md:95`):**

> with bands, adjacent disjoint tiers may both be tracked, which is now the point rather than the
> error.

**Reasoning (from the review):**

> Still true for single-`#` modifiers, and the sentence is doing real work as the record of what
> BQ-1's amendment bought. For multi-`#` modifiers — 53 of 63 item classes — AD-28 `:504` says the
> opposite: a tier cannot be isolated at all, and a reference near a boundary necessarily includes
> the neighbour's tail.
>
> Like C-19's treatment of the same passage, the **reasoning survives and the mechanism sentence
> does not**.

**Proposed (verbatim from the review) [instructional]:**

> *Proposed:* append one sentence recording that spine revision 4 narrowed this to single-number
> modifiers, with a pointer at AD-28 and at the reason it is correct rather than a regression (the
> trade search cannot isolate the tier either). Keep the paragraph. Governing AD: **AD-28**.

---

# Part 2 — C-50, C-51, C-52

## NOT IN THE REVIEWS — stated explicitly

**None of the four rev-4 reviews, nor either rev-3 review, contains a proposed PRD edit for C-50,
C-51 or C-52.** `PRD-EDIT-PROPOSALS.md:439` says so directly: *"The full analysis for C-33…C-49 is
in `reviews/review-rev4-reconcile.md`; **C-50…C-52 arise from the reviewer-gate fixes applied after
it ran**."* `.memlog.md:132` records the same: *"Revision 4 gate fixes created three further PRD
proposals beyond reconcile's C-33..C-49: the new cohortTotals field, AD-28's interior-cell curation
rule, and AD-27's coverage re-measurement carried in sync-report.json. Filed as C-50..C-52."*

What the reviews contain is the **finding** each one answers, plus the one-line requirement row in
`PRD-EDIT-PROPOSALS.md` §19. The **proposed replacement text** must be taken from the
post-gate-fix spine and contract, whose relevant passages are quoted below so the PRD edit does not
have to be invented.

---

## C-50 — `cohortTotals`, the mass-conservation check

- **Target:** FR-27's hard-error list (the same list C-35 rewrites), plus §3 *Weights File* /
  *Modifier Weight* if the field is to be defined
- **Requirement row (verbatim, `PRD-EDIT-PROPOSALS.md:477`):**

> The weights file carries **`cohortTotals`** — the pre-split sum of a cohort's tier weights — and
> `core` refuses a file whose emitted cells do not sum to it. This is the only mechanical check on
> mass conservation and belongs in FR-27's hard-error list, alongside the new *"a cell carried by
> more than two cohorts"* error.

**The finding it answers, in the reviews:**

- `review-rev4-rubric.md` **C-1 (CRITICAL)** — *"Mass conservation is declared the invariant and is
  unenforceable by any component."* *"The file carries cells; it does not carry `w(t)` … The
  hard-error list at `WEIGHTS-FILE-SCHEMA.md:209–219` contains no conservation check … a file whose
  splits sum to `0.7 × w(t)` for one family passes every one of them."* Its stated fix is exactly
  C-50: *"a per-`(baseTypeId, slot, statId)` family total (or a per-tier residual) emitted by the
  producer and re-summed by `core` at load makes the invariant checkable at the cost of one number
  per family."*
- `review-rev4-reconcile.md` Part 1, D1 quiet requirement — *"mass conservation has no verifier and
  no owner"* — but its proposal was the weaker one (*state it as a producer-side obligation with a
  named self-check*), which the gate fix overrode.
- `review-rev4-adversarial.md` **A-3 (CRITICAL)** — `tiers(ℓ)` undefined; the `≤` reading
  triangular-double-counts and *"passes a per-cohort conservation check"*. Its fix: define
  `tiers(ℓ) = { t ∈ family : t.itemLevelMin == ℓ }` inline **and** restate conservation globally.
- `review-rev4-adversarial.md` **A-2 (CRITICAL)** — the coarse-cell attack that the *"at most two
  cohorts"* error exists to refuse: a producer emitting one cell per cohort passes every stated
  check and forces the curator into a full-span reference — *"BQ-1 verbatim."*

**Source text for the edit (post-gate-fix, current in the repo):**

`WEIGHTS-FILE-SCHEMA.md:129-141`:

> ### Conservation is declared, so that it can be checked
>
> Conservation guards the denominator of every affected base, and `core` cannot recover the
> pre-split tier weights from the cells. So declare them. Each `(base, slot)` carries a
> `cohortTotals` list, and `core` refuses the file if a cohort's emitted cells do not sum to its
> declared total:
>
> ```jsonc
> "cohortTotals": [
>   { "statId": "explicit.stat_1509134228", "itemLevelMin": 60, "weight": 850 }
> ]
> ```
>
> The total is the plain sum of that cohort's **tier** weights — computed before any splitting, by
> a path independent of the cells themselves. That independence is the point: it catches a dropped,
> duplicated or misattributed cell, which is the arithmetic slip that actually happens. It cannot
> catch a subtly wrong conditional distribution, and `modelled-split` is precisely the label for
> that residue.
>
> Required for every `(statId, itemLevelMin)` family containing at least one `modelled-split`
> entry; permitted, and encouraged, for any other.

`WEIGHTS-FILE-SCHEMA.md:245` (field-rules row):

> | `cohortTotals` | Per `(statId, itemLevelMin)`, the **pre-split** sum of that cohort's tier
> weights. Required wherever that family carries a `modelled-split` entry, permitted everywhere.
> `core` validates that the cohort's emitted cells sum to it — see *Conservation is declared, so
> that it can be checked*. |

`WEIGHTS-FILE-SCHEMA.md:269` (the hard-error row to add to FR-27):

> - a missing `cohortTotals` row for a family carrying a `modelled-split` entry, or a cohort whose
>   emitted cells do not sum to its declared total

`ARCHITECTURE-SPINE.md:528` (the second new hard error):

> **A cell may be carried by at most two cohorts.** Only adjacent tiers overlap, so a correct
> partition yields cells belonging to one tier or to exactly two. A third is a hard file error.
> This is what makes the coarse-partition case detectable: a producer emitting one wide cell per
> cohort has that interval carried by every cohort in the family. *Stated assumption:* no three
> tiers of one family overlap at a value. If real game data ever does, that is an amendment to this
> AD, not a workaround in a producer.

`WEIGHTS-FILE-SCHEMA.md:157` (the honest limit, worth carrying into FR-27/FR-28 prose):

> `core` holds no tier data. It can therefore check that the cells tile, that the cohorts sum to
> their declared totals, and that no cell is carried by more than two cohorts — but **not** that
> the partition was cut at the real tier endpoints, nor that a split's conditional distribution is
> right.

---

## C-51 — Curation targets interior cells

- **Target:** FR-22 curation guidance (land together with C-36)
- **Requirement row (verbatim, `PRD-EDIT-PROPOSALS.md:478`):**

> **Curation targets interior cells.** AD-16 prices a reference from its cheapest 10 listings, so a
> reference spanning a boundary cell is priced at the neighbouring tier's tail while carrying the
> whole span's mass — and below the threshold it truncates to zero. FR-22's curation guidance must
> say so; this is the BQ-1 failure mode re-entering through a heterogeneous band.

**The finding it answers:** `review-rev4-adversarial.md` **A-1 (CRITICAL)** — *"AD-28 guarantees a
mixed population; AD-16 prices it with a lower-tail statistic. BQ-1's consequence returns intact."*
Worked there on Bows, `ref = [56, 80]` at `L = 65`: 88% of the mass is T8, but a `min 56 / max 80`
search returns T7 boundary rolls which are *"the cheapest listings on the page by a wide margin"*,
so the `PriceObservation` becomes the T7-tail price and, below AD-17's threshold, the summand is
dropped and **88% of the mass deleted**. A-1 offered three closures; the gate fix took a fourth
(a curation rule).

**Source text for the edit (post-gate-fix), `ARCHITECTURE-SPINE.md:524`:**

> **But a curator should track the interior cell, not the span — and this is what the boundary cells
> are for.** AD-16 prices a reference from the **cheapest 10** listings it matches, so a reference
> spanning a boundary cell is priced at the cheap tail of the neighbouring tier while carrying the
> whole span's probability mass. Below AD-17's threshold that summand does not merely understate, it
> **truncates to zero and takes the good tier's mass with it** — BQ-1's failure mode, re-entered
> through a heterogeneous band rather than a floor. The partition already supplies the remedy: the
> interior cell (`[57,78.5]` rather than `[56,80]`, in the worked example) is a reference whose
> population is one tier and whose price is that tier's. The boundary mass is then untracked, which
> costs nothing — AD-17 sums over a partition of tracked outcomes and has never required the tracked
> set to be exhaustive. Curate to interiors by default; span a boundary only where the two tiers'
> prices are known to be close.

`ARCHITECTURE-SPINE.md:252` (AD-16's matching clause):

> **The estimator prices the cheap end of whatever band it is given, so the band must be
> homogeneous.** That is harmless for a band whose population is one tier and dangerous for one
> spanning a tier boundary, where the cheapest listings are the neighbouring tier's tail while AD-18
> carries the whole span's probability. AD-28 names the curation rule that keeps the two aligned —
> track interior cells — and the reason it is a rule rather than a preference.

`WEIGHTS-FILE-SCHEMA.md:149-151` carries the same rule in the producer-facing voice, including the
sentence *"Matching populations is necessary but not sufficient: AD-16 estimates that population's
price from its cheapest members, which is only safe while the population is homogeneous."*

---

## C-52 — Coverage is re-measured on every weights-file regeneration

- **Target:** FR-4 (the coverage measurement and its layout bands), plus FR-25 / §3 *Sync Report*
  (the figure lands in `sync-report.json`)
- **Requirement row (verbatim, `PRD-EDIT-PROPOSALS.md:479`):**

> **Coverage is re-measured on every weights-file regeneration**, not once before view work
> (AD-27), and `sync-report.json` carries the figure. Declining the `unidentifiedWeight` escape
> hatch makes `partial` a recurring patch-cadence state, so a product measuring 85% at launch can
> sit at 60% the week after a patch with nothing reporting it.

**The finding it answers — `review-rev4-reconcile.md` Part 1, D4 quiet requirement (verbatim):**

> **Quiet requirement dropped: `partial` is now a recurring, patch-cadence state, and AD-27 still
> models coverage as a one-time measurement.**
>
> … AD-27 (`:446-478`) is written entirely in the perfective: *"Pool coverage is measured **before
> the view is built**"*, *"**Before any view work**, measure"*, and its `< 50%` row says *"The
> ranking premise fails. Escalate rather than ship"*. AGENT-WORKFLOW.md:89 sequences it as a
> one-time build-order step. Nothing says what happens when coverage — measured once at 85% and
> used to justify a footer layout — falls to 60% three months later because a patch un-named seven
> rows in a weapon class and the producer correctly declared those pools `partial`.
>
> The decision to decline `unidentifiedWeight` is the decision that makes this a live behaviour
> rather than a theoretical one … Two readings are then available to a builder, and they differ in
> what the product does after a patch: re-measure and re-lay-out (a layout that changes under the
> player), or treat the gate as spent (a footer that is now hiding 40% of the tracked list — the
> exact misrepresentation the 50–80% band exists to prevent).
>
> **Proposed:** a clause in AD-27 saying coverage is **re-measured at weights-file regeneration**,
> that the bands bind on every measurement and not only the first, and which of the two readings
> applies to the layout.

**Related earlier finding (`review-rev3-adversarial.md` finding 14, MEDIUM)** — *"coverage is an
unowned one-off, and 80% falls in two bands."* Two extra asks that never became C-items and are
worth folding into the FR-4 edit: make the bands disjoint (`≥ 80`, `≥ 50 and < 80`, `< 50`) — as
written, exactly 80% matches two rows — and state a minimum denominator below which the gate is
not meaningful (*"three of four tracked bases complete is 75% and lands in the 'first-class
surface' band on a sample of four"*).

**Related unresolved question (`review-rev4-adversarial.md` A-8, HIGH):** AD-27's `covered()` is
blind to `modelled-split` — *"a weapons base whose prefix pool is 36% `modelled-split` scores as
fully covered"* — so two people measuring the same file report 92% and 58%, *"opposite sides of the
80% threshold."* A-8 asks for either an explicit statement that `provenance` does not enter
coverage, or a second reported measured-coverage figure. **Not resolved by C-52** as filed.

**Source text for the edit (post-gate-fix), `ARCHITECTURE-SPINE.md:488`:**

> **Coverage is re-measured on every weights-file regeneration, not once before the view.** It was
> written as a pre-view gate, but the fraction moves: a patch introduces modifiers the source
> publishes unnamed, a producer must drop those rows, and the affected pools fall back to `partial`
> (the weights contract's placeholder-row rule) — so a product that measured 85% before launch can
> be at 60% the week after a patch with nothing reporting it. The measurement is therefore part of
> accepting a regenerated file, and `sync-report.json` carries the figure it computed so a drop
> across a patch boundary is visible where the rest of the run's health already is. The thresholds
> below bind a layout decision, and a layout decision made against a stale number is the failure
> this AD exists to prevent.

---

# Part 3 — What the rev-3 reviews add to or correct in C-22…C-32

**Status.** `review-rev4-reconcile.md:16` and `:126` both state that the PRD is **still at revision
2** and has **not absorbed C-22 … C-32**; they *"remain outstanding and nothing [in the rev-4 list]
supersedes them"* — with two explicit exceptions noted below.

## 3.1 Mapping — which rev-3 review section is the source of which C-item

`review-rev3-reconcile.md` Part B / Part C (8 edits):

| rev-3 edit | PRD target | C-item |
| --- | --- | --- |
| 1 (Severe) | FR-17 — stale `[NOTE FOR PM]`s + missing runtime half | **C-22** |
| 2 (High) | FR-19 — "no number is compiled in" vs `minChunkSearches` | **C-25** |
| 3 (High) | FR-25 + §3 *Sync Report* — pinned-starvation line | **C-26** |
| 4 (Medium) | FR-31 + §3 — `config.json`'s second field | **C-29** |
| 5 (Medium) | FR-4 — narrow the coverage denominator to `rankable` | **C-27** |
| 6 (Low) | §10 OQ-8…OQ-11 retirement | **C-31** |
| 7 (Low) | §0 / front matter → revision 3 | **C-32** (now superseded by C-47) |
| 8 (Low, optional) | FR-14 — `minChunkSearches` is not a fifth source | **C-30** |

The four items marked **[post-review]** in `PRD-EDIT-PROPOSALS.md` — **C-23, C-24, C-28, C-30** —
come from `review-rev3-adversarial.md`, not from the reconciler.

## 3.2 Corrections to C-22…C-32 from the rev-4 pass

1. **C-23 must be scoped `banded` only.** (`review-rev4-reconcile.md`, C-38.) *"The **edge-alignment
   rule** proposed in C-23 (still unapplied) must be scoped **`banded` only** — AD-18 `:303` says
   so explicitly, 'a `valueless` one has no edges to align'. Applying C-23 without this qualifier
   would make every valueless reference a validation error."* Apply C-38 and C-23 together, or apply
   C-23 already scoped.
2. **C-31's OQ-11 Resolved clause must cite rev-4 wording.** (C-48.) Revision 3 removed the
   `valueMax?` spellings; revision 4 rewrote both entries again (AD-11 `:181` two kind-specific
   shapes; AD-18 `:301` *"There is no open-top form to handle … `contracts` rejects it at the
   schema"*). The Resolved clause must also repeat C-31's caveat that the closure was **syntactic**,
   with C-23's edge-alignment residue still unapplied.
3. **C-32 is superseded by C-47**, not supplemented: *"C-32 already proposed the rev-3 update and is
   unapplied; this supersedes it rather than adding to it."* Do not apply both.
4. **The §0 amended-AD list in C-47 is itself incomplete** — see the correction box under C-47
   (AD-17 and AD-27 were also amended in rev 4).

## 3.3 Substantive additions from `review-rev3-adversarial.md` (16 findings)

These were the source of the post-review C-items and carry detail the one-line proposal rows do
not. Findings that map onto an existing C-item:

- **Finding 1 (CRITICAL) → C-23.** A required `valueMax` closes the *syntax* of an open top, not its
  *semantics*: a curator writes `valueMax: 9999` and every validator passes (straddle can't fire,
  containment is satisfied, the containment set is maximal, AD-17's partition sees no intersection,
  the hard-error list only rejects missing/`null`). Result: *"Two tiers' probability at one tier's
  price. That is **BQ-1 verbatim**."* Its tightening has **two halves, both required**:
  > **AD-5 amendment.** A tracked reference's edges must **align to band edges declared in the
  > weights file**: there must exist a band of that `statId` in the base's slot with
  > `band.valueMin == ref.valueMin`, and a band with `band.valueMax == ref.valueMax`. A ceiling
  > above every declared band is an open top by another name and is a **validation error on
  > `data/tracked.json`**, not a wide band. Alignment is a property of the two files read together,
  > re-checked whenever either changes.
  >
  > **AD-6 / AD-12 amendment.** Give that check an owner that can run it *before a request is
  > issued*: make the tracked↔weights cross-validation a single pure function in `core`, invoked by
  > `sync` in its pre-request pass and by `web` on load, and add `data/weights.json` to `sync`'s
  > read set (it costs no requests and is already committed). One function, two callers, one
  > verdict.
  The ownership half matters: *"`sync` prices `min..9999` on Monday and `core` refuses the
  configuration in the browser on Tuesday — after the observation is written, committed, and
  ranked."*
- **Finding 7 (HIGH) → C-23, and it is the half most likely to be dropped.** *"The open **bottom**
  is wholly unconstrained."* `(stat_X, 0, 89)` is arithmetically fine and strategically meaningless;
  `core` sums three bands while `sync`'s ascending sort prices junk. *"The alignment check proposed
  in finding 1 must therefore cover **both** edges … Stating it for one edge only would close half
  of a symmetric hole — which is how this one arrived."*
- **Finding 2 (CRITICAL) → C-24.** `lastAttemptedAt` on a zero-request offline retry. Stamping and
  not-stamping each defeat one of the bound's two stated purposes; a third divergence hides
  underneath (does the selector classify on the **stored** price state or on **this run's** offline
  check verdict?). Three amendments proposed, verbatim:
  > **AD-9 amendment.** `lastAttemptedAt` advances **whenever `sync` evaluates the entry**, including
  > an offline catalogue check that issues no request.
  >
  > **AD-26 amendment.** Row 3 orders and bounds on `lastAttemptedAt` as stamped above. A
  > **recovering** entry … re-enters row 2 with its `lastAttemptedAt` intact (it is neither reset nor
  > privileged), so it rejoins at its true position rather than at either end.
  >
  > **AD-26 amendment.** Row assignment is computed from the **price state this run would write** —
  > the offline check runs first and its verdict, not the stored state, drives selection.
- **Finding 5 (HIGH) → C-28.** The load-time pinned cap has **no unit that can evaluate it**:
  AD-24's fetch set is exactly eight artifacts and *"`currencies.json` is not among them"*, while the
  cap is declared a `tracked.json` validation error. The blank-site branch is the serious one — *"it
  converts a curation mistake into a total outage."* Its third tightening is the one C-28's summary
  row compresses into "refusal semantics now need a limit":
  > **AD-3 / AD-24 amendment.** *"refuses to render" applies to a **schema-invalid** artifact. A
  > schema-valid artifact failing a cross-file policy check is reported, never a file-level refusal.*
- **Finding 12 (MEDIUM) → C-27.** `rankable` excludes `pruned` but not `unresolvable` on a reason
  that covers both — but folding `unresolvable` in **breaks decidability**, because price state lives
  in `dataset.json`. The fix is to *state* the property, not widen the predicate:
  > **AD-27 amendment.** `rankable` is decidable from `data/tracked.json` alone, by design: the gate
  > runs before any sync exists, so price state — including `unresolvable` — is deliberately **not**
  > a term.
  Worth adding to C-27's FR-4 edit; the reconciler's version of C-27 does not carry it.
- **Finding 4 (CRITICAL) → C-27's other half.** AD-27's **numerator** is vacuously true for a base
  absent from the weights file — *"a weights file covering 40 of 100 tracked crafted bases yields
  100% under A and 40% under A′."* Plus the `complete`-but-empty case. Proposed numerator:
  > `coverage = |{ b ∈ rankable : core ranks b }| / |{ b ∈ rankable }|`
  > where "core ranks b" is the actual predicate AD-18 applies — present in the weights file, both
  > slots `poolCoverage: "complete"`, neither slot's scoped pool empty at the base's crafted
  > `itemLevelMin`.
  `review-rev4-reconcile.md` Part 3 records that **`AGENT-WORKFLOW.md:89` still states only the
  middle condition**, so this numerator fix reached the spine but not the workflow.
- **Finding 14 (MEDIUM) → C-27 / C-52.** Coverage has no owner, no artifact and no re-measure
  trigger; 80% falls in two bands; no minimum denominator. See C-52 above.
- **Finding 3 (CRITICAL) → C-22's runtime half.** The runtime pinned check *"says what to **record**,
  not what to **do**."* Two legal readings produce opposite staleness distributions. Proposed
  selection rule, verbatim:
  > **AD-26 amendment — starved-chunk selection.** When the discovered allowance cannot fund the
  > pinned set plus one `active` entry, the chunk selects, in order: step 0 (currencies), then
  > `pinned` entries **by oldest `lastAttemptedAt` first** until one search of allowance remains,
  > then one `active` entry. … `pinned` then means *"first in every chunk, and refreshed every chunk
  > whenever the chunk can afford it"* — amend AD-23's one-line definition to match.
  >
  > **AD-26 amendment — intra-pinned order.** State the row-1 sort key explicitly (oldest
  > `lastAttemptedAt`, ties on canonical key).
- **Finding 6 (HIGH) → C-22's cap formula.** `count(currencies.json)` counts **currencies** while
  AD-12 prices the source as *"small, fixed"*. With 25 currencies and `minChunkSearches: 30` the cap
  allows **zero** pinned entries. And the runtime predicate omits currencies and the AD-19 leagues
  request entirely. Proposed: denominate both halves in **searches consumed by step 0**, and use
  `allowance ≥ cost(step 0) + cost(leagues) + count(pinned) + 1`.
- **Finding 8 (HIGH) → C-22 / C-26.** `pinned` **and** `unresolvable` is unaddressed. Proposed:
  state precedence as a total function of `(status, priceState)`; *"an entry whose price state is
  `unresolvable` is selected at row 3 regardless of status, except that `pruned` is never selected
  at all (row 4 dominates every row)"*; and say whether a row-3 entry counts toward `count(pinned)`
  (*"it should not, since it spends no search"*).
- **Finding 10 (HIGH) → C-26's schema half.** The starvation line has **no schema and no consumer
  obligation**; *"the shortfall"* is at least four different numbers. Proposed field set, verbatim:
  > `declaredMinChunkSearches`, `discoveredAllowance`, `pinnedCount`, `currencyCost`,
  > `pinnedRefreshed`, `activeRefreshed`
  plus *"Require `web` to surface pinned starvation as a first-class condition alongside AD-6's
  unresolvable set and AD-23's tracked-list age."* C-26 as filed covers the record's existence and
  its distinctness from *entries not reached*; the **field set** and the **`web` obligation** are
  the additions.
- **Finding 9 (HIGH) → C-25 / C-29.** `minChunkSearches` is player-declared, unvalidated,
  search-only, and about the wrong bucket — *"Setting it to `10000` makes the cap vacuous"*;
  there is no `minChunkFetches` though AD-12 costs each entry one search **and** one fetch; and on a
  cold start there are no headers to discover an allowance from. Proposed: define it as *"the
  smallest search allowance a chunk is expected to discover, declared by the player"* and require
  `sync` to **report the actual discovered allowance** per chunk next to the declared value.
- **Finding 16 (LOW) → C-29.** *"`minChunkSearches` and nothing else"* collides with the
  `schemaVersion` convention. Proposed wording: *"…carries the active league, `minChunkSearches`,
  and `schemaVersion`, and nothing else. A new field is an amendment to this AD, not a config
  addition."* C-29 as filed says `config.json` carries **exactly two fields**; this correction makes
  it three.

Findings with **no PRD C-item** (spine-only, recorded for completeness): 11 (`sync-progress.json`
has no defined reset point), 13 (`pruned` + `unresolvable`), 15 (two definitions of "progress";
undefined exit code for a starved chunk).

## 3.4 The rev-3 cross-cutting observation, which rev 4 repeats

`review-rev3-adversarial.md` closing section:

> **a rule that names its own runtime half in prose has not specified it.** The test is whether a
> builder holding only that AD can write the `if` statement.

and:

> **a rule whose owner cannot read the file it must check.** Revision 2 had weights↔catalogue with no
> owner able to read `items.json`; revision 3 adds tracked↔currencies with no owner in `web` able to
> read `currencies.json`, and tracked↔weights edge alignment with no owner in `sync` able to read
> `weights.json`. All three are the same fix — one pure cross-validation function in `core` invoked
> by both shells.

Rev 4 reproduces the second shape twice: `review-rev4-rubric.md` M-4 (cross-kind check assigned to
`contracts`, which cannot see two files) and `review-rev4-adversarial.md` A-13 (cross-file `kind`
agreement is caught only incidentally, by a rule naming the wrong cause).

---

# Part 4 — Non-PRD items recorded by the reviews

These are **not** PRD edits, but they touch documents the PRD inherits and will be read by the same
builders.

- **`AGENT-WORKFLOW.md:89` still states AD-27's numerator with only the middle condition** —
  *"have `poolCoverage: "complete"` in **both** slots"* — while AD-27 requires three conditions.
  (`review-rev4-reconcile.md` Part 3.)
- **`AGENT-WORKFLOW.md:89` says nothing about re-measurement** — the C-52 clause needs the same
  sentence in the build-order step. (Same.)
- **`AGENT-WORKFLOW.md:81`'s `sync` row omits the valueless filter rule.**
  (`review-rev4-rubric.md` L-2.)
- **AD-28's *Binds* omits `sync`**, though its load-bearing unit clause constrains `sync`.
  (`review-rev4-rubric.md` L-1.)
- **Contract `status: draft` while the spine is `status: final`.** (`review-rev4-rubric.md` L-3;
  `review-rev4-adversarial.md` A-18.)
- **The ER diagram still binds `ModifierWeight }o--|| ModifierRef`** — the conflation AD-28 removes.
  (`review-rev4-adversarial.md` A-10.)
- **`WEIGHTS-FILE-SCHEMA.md:198` calls the weights entry's uniqueness key "the canonical modifier
  identity"**, a four-tuple, attributing it to AD-5 which defines a three-tuple.
  (`review-rev4-adversarial.md` A-11.)
- **Verification corrections to the contract's worked example** (`review-rev4-verification.md`):
  - **V-3 WRONG** — the eight-cell Bows partition is wrong; `[43,55.5]` straddles T6, whose ceiling
    43.0 is also T7's floor. The correct partition is **nine** cells:
    `[32,42.5] [43,43] [43.5,55.5] [56,56.5] [57,78.5] [79,80] [80.5,101] [101.5,103] [103.5,123]`.
  - **V-4 WRONG** — *"`[56,56.5]` is the one cell emitted twice"* is false; **four** cells are
    emitted twice (`[43,43]`, `[56,56.5]`, `[79,80]`, `[101.5,103]`) — one per adjacent-tier
    overlap. *(The spine's AD-28 rule, applied literally, already yields the nine-cell partition;
    `ARCHITECTURE-SPINE.md:504` now carries the "one-point cell" clause explicitly.)*
  - **V-13 MOVED** — Zod `4.6.2` in the stack table is no longer `latest`; `4.6.3` is. Patch bump
    inside the pinned major, nothing depends on it.
  - Everything else in the stack table and both TS-7 blockers re-confirmed unchanged.
