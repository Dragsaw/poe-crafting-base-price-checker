---
title: 'Adversarial review — ARCHITECTURE-SPINE.md revision 10'
type: architecture-review
target: ARCHITECTURE-SPINE.md (revision 10)
also_read:
  - IMPLEMENTATION-NOTES.md
  - WEIGHTS-FILE-SCHEMA.md (5.0.0)
baseline: 'git HEAD — ARCHITECTURE-SPINE.md revision 9'
status: draft
created: '2026-09-19'
---

# Adversarial review — spine revision 10

**Method.** For each finding I construct two units one level below the spine — two
packages, or a package and the external weights producer — that each obey **every AD to
the letter** and still cannot be built together: they disagree on a data shape, on who
owns an entity, on which component mutates a state, or on a number derived from one rule
read two ways. A finding is only reported where both units are defensible readings of the
rev-10 text as written; where rev 9 bound the case and rev 10 does not, the defect is
attributed to the merge that dropped the clause.

**Verdict.** Revision 10 is a net improvement in readability and a net *regression* in
bindingness. Seven holes, four of them able to change a published number or an ordering
without any artifact failing validation. The dominant class is not a dropped sentence —
it is the new two-document structure, which moved four rules that reject a file or abort a
run into a companion that declares itself non-binding.

Severity scale: **S1** silently changes a ranked number or ordering; **S2** makes two
conforming builds incompatible at the artifact or ownership level; **S3** ambiguity with a
bounded, visible consequence.

---

## F-1 (S1) — Four load-bearing rules now live only in a document that says the spine wins

**Where.** Spine AD-11 ("`core` derives it the one way, in one place"), AD-16 (four traps),
AD-17 (the overlap predicate), AD-7 (the `pinned` cap inequality), Consistency
Conventions (the canonical key encoding) — each of which ends with *"…is in
`IMPLEMENTATION-NOTES.md`"*. `IMPLEMENTATION-NOTES.md` front matter: `governs: []`,
`governed_by: ARCHITECTURE-SPINE.md`, and in prose: *"where this file and the spine
disagree, the spine wins and this file is the defect."*

**The construction.** Two units, both letter-conforming:

- **`core`-A** derives a two-`#` line's filter-comparable interval as `[(a1+a2)/2,
  (b1+b2)/2]` (notes §1) and rejects `tracked.json` when the overlap predicate of notes
  §2.1 fires.
- **`core`-B** derives the interval as the **span** `[a1, b2]` — a defensible reading of
  *"whatever quantity the trade stat filter compares"* while OQ-12 is open — and rejects
  overlap by the enumeration AD-17 describes in prose (bands intersect; absent affix
  subsumes) **without** the fourth consequence, the prefix-only/suffix-only pair, which
  appears nowhere in the spine.

Both satisfy every AD. `core`-B ranks a base whose `ΣP` exceeds 1 and prices a different
population than `core`-A from the same two files. Nothing in the spine adjudicates,
because the spine states only *that* a derivation and a predicate exist.

The same shape recurs three more times: the `pinned` cap's `0.5 ×` factor (a
`tracked.json` **validation error** — a load rejection — whose only statement is notes §6);
`sync`'s prohibition on rounding a half-integer edge to reach an integer filter (notes
§5.2, a rule that was in the rev-9 spine as AD-28's `sync`-binding clause and decides
which listings get priced); and the three-form affix encoding (notes §4.1), which is the
key **every artifact that keys entries** uses, i.e. a shared data shape across `sync` and
`web`.

**Why the merge caused it.** Rev 9 carried all four in normative ADs. The rev-10 opener
states the intent — *"it no longer carries formulas a builder executes"* — but the
companion was not given binding force, so a builder who reads only the spine (which the
spine invites: *"This document states what must not diverge"*) is unguided on four
divergences.

**Close it.** A new AD — *"Named sections of `IMPLEMENTATION-NOTES.md` are binding by
reference"* — listing the sections that are normative, and amending the companion's front
matter to `governs:` those ADs. Precedence for a genuine conflict stays with the spine;
silence in the spine must not mean the companion is optional. Alternatively, return the
four to their ADs; they are four short paragraphs.

---

## F-2 (S1) — Edge alignment does not bound whole-tier containment's damage, but two ADs claim it does

**Where.** AD-11: *"Two things bound the damage and neither is accidental: AD-16 sorts
ascending … and **AD-17's edge alignment rejects the one band shape that would make the
gap wide**."* AD-17's check table: edge alignment *"additionally catches a band that
reaches into a tier it does not contain."* Notes §2.4 row 4 is the worked example.

**The construction.** The producer and `core` both conform; the rule simply does not fire.
`5.0.0` withdraws band non-overlap **at every scope**, so nothing forbids two tiers of one
`statId` sharing an edge. Take a `(base, prefix, statId)` family with

```
T7:  itemLevelMin 60, weight 900, interval [43.0, 56.5]
T8:  itemLevelMin 60, weight 100, interval [50.0, 56.5]
```

A curator tracks `valueMin 50.0, valueMax 56.5`. Containment set = {T8} (T7 is only
partly covered). Edge alignment: `min{50.0} == 50.0`, `max{56.5} == 56.5` — **passes**.
The band nevertheless reaches deep into T7, which it does not contain: T7's 900 weight
contributes nothing to the numerator while sitting in the denominator, and AD-16's search
(`min 50, max 56.5`) returns **T7 items** — which, being the low tier, are the cheap ones
the ascending sort takes first. Both stated bounds fail on the same configuration: the
probability is understated by ~10x and the price is the *other* tier's price.

The check as written compares the band's edges against the **extremes of its own
containment set**. It therefore catches an intrusion only when the intruded tier's edge is
*not flush* with a contained tier's edge (notes §2.4's `43.0 – 60.0`). Flush overlap, and
any three-interval configuration where the outermost contained tier's max coincides with a
partly-overlapped tier's interior, pass silently. Under `5.0.0` the producer is explicitly
told it *"must not merge or trim"* tiers to make them separable, so this configuration is
not merely legal — it is the configuration the contract asks for.

**Why the merge caused it.** Rev 9's AD-28 made this unreachable by construction: the
value axis was cut at **every** tier endpoint, so a reference on cell boundaries straddled
nothing. Withdrawing the decomposition removed the machinery; the compensating claim was
asserted rather than re-derived.

**Close it.** Tighten AD-17's edge-alignment check to a **no-partial-intrusion** rule:
reject a `banded` reference if any entry in the scoped pool that shares the reference's
`statId` **intersects** the band without being contained by it. That is checkable from the
file `core` already holds, it subsumes the current rule, and it restores the bound AD-11
claims. Record the residual as an accepted cost (it rejects bands whose only defect is a
flush neighbour), or add a companion note on the curation escape.

---

## F-3 (S2) — `CraftRecipe` lost its ownership clause, and no artifact carries `CurrencyRate` to `web`

**Where.** Rev 9 AD-22 read: *"`CraftRecipe` covers currency composition and the recipe's
distribution effect, and is a `contracts` schema populated from `data/recipes.json`.
**`core` computes a recipe's cost from synced rates, and `sync` never computes a craft
cost.**"* The AD-22 → AD-3 merge kept the entity list and dropped both sentences. Rev-10
AD-3 lists `CurrencyRate` among the concepts that cross a boundary and gives it **no row
in the writer table** — the table names `recipes.json` (player → `web`) and the sync-owned
outputs, and nothing declares which artifact carries a rate.

**The construction.**

- **`sync`-A** reads `recipes.json` and `currencies.json`, computes `craftCost` per recipe
  in divine, and writes it into `dataset.json`. This is permitted verbatim: AD-4 says
  *"published artifacts carry observations — prices, weights, **costs**"*, AD-20 gives
  `sync` the normalisation, and AD-3's table does not forbid `sync` reading
  `recipes.json`. `web` then renders a cost it did not derive.
- **`web`/`core`-B** follows the Design Paradigm table (*"All valuation is pure functions
  … craft cost"*) and the source tree (*"core/ # … EV, provenance, **craft cost**"*) and
  computes `craftCost` in the browser — and then cannot, because the rates it needs are
  not in AD-24's **closed eight**, `currencies.json` is `sync`-only by AD-3, and the only
  `CurrencyRate` values reachable are those riding on `PriceObservation`s for currencies
  that happened to appear in a listing. A crafting orb that was never a listing currency
  has no rate in `web` at all.

Unit B is forced either to invent a ninth artifact (AD-24 amendment) or to silently drop
the `craftCost` term — which Consistency Conventions' 4-decimal rule names as the exact
failure that *"inflates every `EV` in the product"*. Unit A is forced to write a derived
figure `web` cannot re-derive. Two owners for one entity, and a channel with no file.

**Close it.** Restore the ownership sentence to AD-3 or AD-17 (*"`core` computes craft
cost from rates; `sync` never does"*), and give `CurrencyRate` an explicit home: either a
named block inside `dataset.json` covering **every** currency in `currencies.json` (a
schema clause on `dataset.json`, not a ninth artifact), or an explicit AD-24 amendment.
Also correct AD-3's `recipes.json` read column, which omits `core`.

---

## F-4 (S2) — "`sync` reads `weights.json` (ids only)" contradicts three other ADs

**Where.** AD-3 writer table: `data/weights.json` — *"Read by: `sync` (ids only, AD-9),
`core` via `web`."* Against that:

- AD-12 makes `sync` run *"`core`'s cross-file validation of `data/tracked.json` against
  the weights file — **all four checks** (AD-17) — as one gate"*. Edge alignment and
  containment need every entry's `lines[].ranges`, `weight` and `itemLevelMin`.
- AD-27 requires *"`sync-report.json` carries the figure `sync` computed"* — coverage
  needs `poolCoverage` per slot **and** pool emptiness per slot.
- AD-9's second catalogue check is over ids, which is the only clause the parenthetical
  actually describes.

**The construction.** **`sync`-A** implements a narrow weights reader — a streaming id
extractor that never materialises `ModifierWeight` — conforming to AD-3's table; its
AD-12 gate then cannot run AD-17's four checks, so `sync`-A skips the gate and spends a
full refresh's budget on a `tracked.json` that `web` refuses at load (the precise waste
AD-12's gate exists to prevent). **`sync`-B** loads and validates the whole file through
`core`. Both cite the spine. Worse, `sync`-A and `web` now disagree on whether a given
`weights.json` is loadable at all, because `core`'s shape/pool validation only ever runs in
one of them.

**Close it.** Change the cell to *"`sync` (full file, via `core`: id validation AD-9,
cross-file gate AD-12/AD-17, coverage AD-27), `core` via `web`"*. The "ids only" shorthand
was accurate in rev 9, where the gate and the coverage figure sat in ADs the merge did not
touch; it is false in rev 10.

---

## F-5 (S2) — Nothing says when an entry stops being `unresolvable`

**Where.** Rev 9 AD-26 carried two definitions that made row 3 coherent, and the second
was: ***"An id that resolves again stops being `unresolvable` at that moment**, and
rejoins row 2 as an ordinary `active` entry. Such an entry does not wait for a retry
slot."* The AD-26 → AD-7 merge kept the first definition (offline work never stamps
`lastAttemptedAt`) and dropped the second. Rev-10 AD-9 states only the transition **into**
`unresolvable`; no AD states the transition out.

**The construction.** A tracked entry was marked `unresolvable` after a patch; the next
catalogue refresh restores the `statId`.

- **`sync`-A** treats the run-start catalogue check as the authority and clears the state
  at that moment; the entry re-enters row 2 by `lastAttemptedAt`, is priced this chunk, and
  `core` ranks it.
- **`sync`-B** treats the persisted price state as sticky until a successful pricing
  attempt overwrites it; the entry stays in row 3, which is *"at most one attempt per entry
  per 24h"*, so it is refreshed up to an order of magnitude less often, and — since AD-9
  makes `core` exclude `unresolvable` from valuation and AD-7 row 3 selects on price state
  — it can sit out of the ranking for a day after it became rankable.

Both obey every sentence in rev 10. The two produce different `dataset.json` contents and
different rankings from identical inputs, with every artifact schema-valid. This is a
conflicting state-mutation path in the strict sense: two units disagree on which component
owns a state transition and when it fires.

**Close it.** Restore the clause to AD-9 (it is a price-state rule, so AD-9 is now its
right home): *"An id that resolves again leaves the `unresolvable` state at the run-start
catalogue check, before selection, and re-enters AD-7 row 2."*

---

## F-6 (S3, edging S1) — "weakest provenance of every input, **with no exception**" has two readings, and one of them is useless

**Where.** AD-10: *"`core` propagates the weakest provenance and the oldest timestamp of
every input into each derived figure, **with no exception** — the numerator-only exception
retired with `modelled-split`."* Rev 9's carve-out was numerator-only *for
`modelled-split`*, but the paragraph that carried it also carried the argument the rev-10
sentence discards: a provenance drawn across the **whole pool** *"would stamp … nearly
every weapon base, and a label that universal distinguishes nothing."*

**The construction.** A pool of 40 tiers; 39 carry `weightSource: "published"`, one filler
tier carries `"absent"`.

- **`core`-A** reads *"every input"* as the scoped pool, i.e. the denominator: the filler
  tier is an input to every probability on the base, so **every** figure on the base is
  `uniform-prior` and `web` renders the whole base as untrustworthy.
- **`core`-B** reads *"every input"* as the inputs to the figure — the reference's
  containment set for the numerator, the pool only where a `partial` pool weakens it in
  fact (which AD-10 still singles out as the sole source of `absent`) — so the base is
  `measured` unless the tracked tier itself is filler.

`RankedBase` carries a different provenance per unit for identical files. Given how few
filler rows it takes to poison a pool under reading A, and that `5.0.0` makes
`weightSource: "absent"` a routine per-tier fact rather than a whole-file property, the two
render treatments diverge on most bases.

**Close it.** State the rule positively in AD-10: provenance for a probability is the
weakest over **the reference's containment set**, plus `absent` where the pool is
`partial`. That is one sentence, it preserves the rev-9 intent, and it removes the
"every input" ambiguity the deletion left behind.

---

## F-7 (S3) — `5.0.0` withdrew the per-`statId` kind rule; kind agreement has nothing to stand on

**Where.** AD-17's fourth check: *"a reference's kind disagrees with the kind its matching
lines imply — read from a line's `ranges`, since `5.0.0` has no `kind` field."* Rev 9
AD-29 closed the loop with *"AD-5's per-`statId` kind rule, which constrains one `statId`
across a file"*; rev-10 AD-5 no longer states it, and `WEIGHTS-FILE-SCHEMA.md`'s hard-error
list has no cross-entry kind consistency check (its only duplicate rule is `statId` within
**one entry's** `lines`).

**The construction.** A conforming `5.0.0` file publishes `statId X` twice in one slot:
entry A with `ranges: []` (valueless) and entry B with `ranges: [[1,3]]`. The producer is
not violating anything — resolving two poe2db lines to one trade stat is exactly what
`lines[].statId` invites, and no check forbids it.

- **`core`-A** reads *"the kind its matching lines imply"* universally: the lines imply
  both kinds, so any tracked reference on `X` fails kind agreement and `tracked.json` is
  rejected — under AD-12 that **aborts the sync run non-zero**, and under AD-3 `web`
  refuses to render.
- **`core`-B** reads it existentially: a `banded` reference matches entry B, a `valueless`
  reference matches entry A, both pass, and containment (notes §1) quietly picks the arm
  that matches the kind.

One unit takes the product down; the other ranks. The numbers also differ, because under
B a `valueless` reference's numerator omits entry B's weight while the denominator keeps it.

**Close it.** Add a hard error to `WEIGHTS-FILE-SCHEMA.md`: *"within one `(baseTypeId,
slot)`, one `statId` must not appear both with an empty `ranges` and with a non-empty
`ranges`"* — checkable within the file, cheap, and it makes AD-17's fourth check
single-valued. Cite it from AD-17.

---

## Lesser observations (not constructed as pairs)

- **AD-3's read column for `recipes.json` names `web` only**, while `core` is what consumes
  a `CraftRecipe` (AD-17). Cosmetic given F-3, but fix in the same pass.
- **AD-7's `pinned` cap paragraph says `web` "surfaces that record's presence"** while
  AD-12 gives `web` the tracked-list age; rev 9 tied the two together in one surface. No
  divergence, but the pairing is now implicit.
- **The Retired AD map is accurate** against rev 9 for all ten ids; `WEIGHTS-FILE-SCHEMA.md`
  renumbered correctly. PRD staleness is already declared in the rev-10 opener and is out
  of scope here.
- **OQ-19's "never an epsilon in `core`"** survives in the spine, which is the one piece of
  the rev-9 exactness machinery that did not fall into the companion. The summation-order
  pin did fall out with the conservation checks, correctly — there is no longer a sum to
  order.

---

## Recommended amendments, in priority order

1. **New AD (or AD-1 clause)** — binding-by-reference for named `IMPLEMENTATION-NOTES.md`
   sections; companion front matter updated to `governs:`. Closes F-1.
2. **AD-17 edge alignment** — replace with the no-partial-intrusion rule. Closes F-2 and
   restores AD-11's stated bound.
3. **AD-3** — restore the craft-cost ownership sentence; give `CurrencyRate` a declared
   carrier; correct the `weights.json` and `recipes.json` read columns. Closes F-3 and F-4.
4. **AD-9** — state the exit from `unresolvable`. Closes F-5.
5. **AD-10** — state provenance positively, over the containment set. Closes F-6.
6. **`WEIGHTS-FILE-SCHEMA.md` 5.0.1** — per-`(base, slot)` `statId` kind consistency as a
   hard error. Closes F-7.
