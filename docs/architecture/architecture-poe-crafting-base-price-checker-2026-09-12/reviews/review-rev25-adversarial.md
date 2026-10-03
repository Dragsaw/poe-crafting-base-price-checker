# Adversarial review — spine revision 25 (hybrid references, both affixes, summed `statId`s)

- **Subject:** the uncommitted diff of `ARCHITECTURE-SPINE.md` revision 23 to 25 (AD-5, AD-12,
  AD-16, AD-17, Conventions, Deferred, OQ-27) and of `IMPLEMENTATION-NOTES.md` (§1 line sets and
  containment, §2.1 to §2.5, new §2.7, §4.1, §5.1d, §8, §11, §12.1). `AGENT-WORKFLOW.md` step 1
  also changed.
- **Lens:** build two units one level down. Each unit obeys every AD and every binding
  IMPLEMENTATION-NOTES section to the letter, and the two still build incompatibly.
- **Read:** the full diff. AD-5, AD-16 and AD-17 in their revised form. `IMPLEMENTATION-NOTES.md`
  §1, §2.1 to §2.7, §4.1, §8, §11 and §12.1. `WEIGHTS-FILE-SCHEMA.md` `6.1.0`, *pool-completeness*,
  *Shape* and *Field rules*. `docs/specs/spec-tracked-hybrid-mods/SPEC.md` and
  `owner-change-briefs.md`.
- **Measured against the committed `data/weights.json`** (`6.1.0`, every pool `complete`):
  - 552 hybrid tiers (two or more non-null lines) with `weight > 0`.
  - 8 tiers with `weight > 0` that carry an internal `null` line. 8 `not-in-game` tiers at
    weight 0, each with a single `null` line.
  - 0 pairs of tiers in one hybrid family whose intervals intersect on every line.
  - 8 pure + pure summed pairs at T1, all % increased Rarity (Amulets, Rings, six Helmet
    classes): prefix `[16,19]` + suffix `[15,18]`.
  - 0 cases where a pure band that §2.7 passes per slot reaches a hybrid tier through a sum.
  - Bows `LightRadiusAndAccuracy` publishes its lines as `[stat_803737631, stat_1263695895]`.
    That order is **not** the byte-wise order.

## Verdict: **not closed**

Most of the revision holds. The hybrid containment set, the null-line rule, per-line kind
agreement, the hybrid key form and the summed filter are each specified well enough that two
builders agree. The holes are at the joins. The worst one is the `coOccur` row of AD-17's table.
It now reads as a **per-slot** failure. Taken at its letter, it rejects every pair of entries that
share a hybrid affix, and that is the normal way to curate a hybrid. The second hole is the
overlap predicate. It now needs the weights file whenever a hybrid is involved, but AD-17 still
puts its sum branch on the within-file side. `contracts` and `core` can therefore give opposite
verdicts with different consequences. One change closes both: replace `coOccur` in
`slotOverlap` with line-set equality, which `coOccur` already reduces to on any file that loads
(H1). §2.7's "safety net" is also not one where a sum is involved, because its premise ("AD-16
filters each line by its band") is false for a summed `statId`.

## Findings

### H1 — high — The `coOccur` row of AD-17 is a per-slot failure, and §2.1 is a two-slot conjunction

**Location:** `ARCHITECTURE-SPINE.md` AD-17, the six-check table, row **`coOccur`**. Also
`IMPLEMENTATION-NOTES.md` §2.1 and §2.2, and `AGENT-WORKFLOW.md` step 1, which lists `coOccur` as
a separate `core` check.

**Unit A (the `core` checks author, building the "`coOccur` check" that AGENT-WORKFLOW names).**
The table's *Fails when* column is the only failure condition stated for this check. It reads:
*"a hybrid reference and another reference in one slot share a `statId`, their bands intersect on
every shared line, and one tier is contained by both."* No other slot is mentioned and no sum.
§2.2 defines the predicate `coOccur(x, y)`, but it gives no failure condition. Unit A implements
the row as written: for each pair of crafted entries on one class, for each slot, fail when the
row's three conditions hold.

**Unit B (the `core` overlap author, following §2.1).** `overlap(a, b)` is
`slotOverlap(prefix) ∧ slotOverlap(suffix) ∧ sums`, and `coOccur` is only one conjunct inside
one slot's verdict.

**Failing input (real Bows data, valid under every rule):**

```
a: prefix hybrid LocalIncreasedPhysicalDamagePercentAndAccuracyRating T1
     { stat_1509134228 [75,79], stat_803737631 [175,200] }
   suffix  <attack-speed T1>
b: prefix  the same hybrid T1
   suffix  <critical-chance T1>       -- shares no statId with a's suffix
```

Unit A: the prefixes share both `statId`s, the bands intersect, and T1 is contained by both, so
the check **fails**. `sync` aborts and `tracked:check` exits non-zero. Unit B: the suffix slot
returns `false` (no shared `statId`), so there is no overlap and the file loads. With one shared
LR suffix and different prefixes, Unit A fails on the **suffix** slot too. This is the shape the
success signal asks for: one hybrid affix tracked with several partners. Under Unit A the success
signal cannot be met.

Before revision 25 the same row had the same per-slot wording. It fired only for *unequal*
`statId`s (two lines of one hybrid tier), which the other slot rarely also satisfied, so nobody
was hurt. Revision 25 points it at shared `statId`s, which is the everyday case.

**Smallest tightening:** in the table, make the row a pointer and not a predicate. *"Fails when
`overlap(a, b)` (§2.1) holds for two crafted entries and the verdict reads `coOccur` in at least
one slot."* Better, apply H2's fix. It retires `coOccur` from overlap, and the row goes with it.

### H2 — high — Overlap straddles within-file and cross-file, and the revision moved the sum to the wrong side

**Location:** AD-17 *"The overlap predicate straddles the two kinds of check"* (the within-file
branches are listed as *bands intersect, both valueless, summed intervals intersect*), and
`IMPLEMENTATION-NOTES.md` §2.1 `slotOverlap`, fourth branch.

**Unit A (`contracts`, per-file schema).** AD-17 assigns *summed intervals intersect* to
`contracts` and says it refuses the artifact under AD-3. `contracts` cannot evaluate
`coOccur`. On a pair where a slot reaches the hybrid branch, `linesIntersect ∧ coOccur`, it has
two readings, and both follow the letter. It can treat the hybrid branch as *bands intersect*
(the listed within-file branch) and reject. Or it can skip the pair. Nothing says which.

**Unit B (`core`).** It evaluates the whole conjunction with `coOccur`. `coOccur` is `false` for a
class absent from `weights.json` or for a `partial` pool (§2.2), so the pair does not overlap.

**Failing input (real Bows tiers, day one with `weights.json` absent, which is AD-24's day-one
state):**

```
a: prefix hybrid phys%+acc T1–T2 run { stat_1509134228 [65,79], stat_803737631 [150,200] }
   suffix hybrid LightRadiusAndAccuracy T1 { stat_1263695895 [15,15], stat_803737631 [41,60] }
b: prefix hybrid phys%+acc T2        { stat_1509134228 [65,74], stat_803737631 [150,174] }
   suffix the same LR T1
```

`S = {stat_803737631}`. The prefix slot reaches `linesIntersect({phys}) ∧ coOccur`, and so does
the suffix slot (on the LR line). Sums: a `[191,260]`, b `[191,234]`, which intersect. Unit A
(first reading) refuses the whole `tracked.json`, so `web` renders no class. Unit B loads it.
Once the weights arrive, Unit B rejects it per class. This is a real double count: T2 + LR T1 is
in both containment sets. Even with weights present, the consequence is not settled. AD-17 says
the consequence "follows the branch that fired", and here three branches fired, of both kinds.

**Why the fix is cheap:** on any file that loads, `coOccur` inside `slotOverlap` collapses to a
within-file fact.

- **Hybrid vs single-line:** `coOccur` needs `contains(single, hybridTier)`, and covering implies
  meeting, so §2.7 `incomplete` has already rejected the file. `coOccur` is therefore always
  `false` on a loading file, and consequence 2's first sentence is dead text.
- **Hybrid vs hybrid:** both containments require `lineSet == statIds`, so `coOccur` needs
  `statIds(x) == statIds(y)`. With equal line sets, the only extra thing `coOccur` asks is a
  common contained tier. That differs from "every line's bands intersect" only for adjacent tiers
  that intersect on every line. There are 0 such pairs in the committed data, and H8 shows that
  accepting them is the inconsistent reading anyway.

**Smallest tightening:** in §2.1, replace the fourth branch with
`linesIntersect(x, y, S) ∧ statIds(x) == statIds(y)`. Overlap then needs only `tracked.json` and is
wholly `contracts`'. Delete the `coOccur` row from AD-17's table (five cross-file checks plus
line-set completeness), retire §2.2 or keep it as documentation for §2.7, and drop the "straddles"
paragraph. If `coOccur` must stay, add one sentence instead: *"Any overlap verdict that reads
`coOccur` in any slot is cross-file in its entirety. `contracts` evaluates only pairs whose
verdict reads no `coOccur`."*

### H3 — medium — §2.7's premise is false for a summed `statId`, so the completeness net has a hole

**Location:** `IMPLEMENTATION-NOTES.md` §2.7, first paragraph (*"AD-16 filters each line by its
band"*) and `meets`. AD-16 *Accepted effect*.

For a summed `s`, AD-16 does **not** filter either slot's line by its band. It filters the sum by
`[min_p + min_s, max_p + max_s]`. The per-slot value the search admits is wider than the band by
the other slot's spread, and it starts at 0 when the other slot's reference is a pure line on `s`,
because nothing in the search requires the other slot to carry `s` at all.

**Unit A (the `core` §2.7 author)** tests `meets` against the slot band, as written. **Unit B (the
`sync` builder)** emits the summed filter, as written. Both obey the letter, and the search
reaches tiers that §2.7 certified it does not reach.

**Failing input (synthetic; 0 instances in today's data):**

- Prefix pure `s` tiers: P1 `[30,40]`, P2 `[20,29]`. Prefix hybrid H `{s [20,29], t [5,9]}`.
- Suffix pure `s` tier: Q `[10,20]`.
- Entry `(prefix banded s [30,40], suffix banded s [10,20])`.

§2.7 passes: H's `s` line `[20,29]` does not intersect `[30,40]`. The summed filter is `[40,60]`.
An item with H as prefix (`s = 29`) and Q as suffix (`s = 15`) totals 44 and matches. So does an
item with P1 alone (`s = 40`) and any non-`s` suffix. The price for the pure chase includes hybrid
items and single-mod items. AD-16's accepted effect covers *"a low prefix with a high suffix from
different tiers"*. It does not cover a different modifier in the slot, and it does not cover a
missing operand.

The same widening breaks hybrid isolation. A hybrid's line on a summed `s` is no longer filtered
by its own band. Only the hybrid's non-summed lines separate it from a pure tier plus an `s` roll
on the other slot.

On today's data the risk is small but real. The T1 rarity sum `[31,37]` is above every
single-slot maximum (19 and 18), and no Bows pure accuracy band that passes §2.7 reaches a hybrid
through the LR sum. Lower tiers are allowed: the T1/T2 scope rule is a product rule and nothing
enforces it.

**Smallest tightening:** in §2.7, for a line `rl` on a summed `s`, test `meets` against the
effective band `[sum.min − maxOther(s), sum.max − minOther(s)]`. Here `maxOther` and `minOther`
range over the other slot's scoped entries that the other reference's **non-summed** lines admit.
`minOther` is `0` when the other reference is single-line, because nothing in the search requires
that slot to carry `s`. Then extend AD-16's accepted effect to name the single-operand item
explicitly, or reject it with that test.

### H4 — medium — The null-line rule turns a `partial` pool into a run-wide `sync` abort for single-line references

**Location:** `IMPLEMENTATION-NOTES.md` §1 `contains` (the `¬untrackable` conjunct now covers
**every** kind). AD-17's null-line paragraph and its `coOccur`-partial ruling. AD-12.

Up to revision 23, a single-line band contained a tier `{s, null}` in a `partial` pool by the
existential test. Revision 25 makes that tier untrackable for single-line references too.

**Failing input:** a pool turns `partial` because one tier's second line is unresolved, for
example T1 `{s [100,120], null}`. The committed entry `banded s [100,120]` previously contained
T1. Now its containment set is empty, so §2.5 fails. AD-12 makes a cross-file failure abort the
**whole** `sync` run, and `tracked:check` exits non-zero. This happens for a class that AD-17
already excludes from the ordering because its pool is `partial`. That is the site-wide refusal
AD-17's own `coOccur` ruling rejected: *"refusing would take the whole site down over a class this
AD has already excluded."*

**Two readings:** the `sync` gate author aborts, because AD-12 says every cross-file failure
aborts. The `web` author renders and reports per class. That much is by design. But a third
reader, the author of the `weights-absent` path, will reasonably extend the *unvalidated* mark to
`partial` classes, and nothing says not to.

**Smallest tightening:** in AD-17, state that §2.4, §2.5 and §2.7 verdicts on a `partial` pool
are **unvalidated with reason `partial-pool`**, treated like `weights-absent`. They are not
failures. This matches the existing `coOccur`-`partial` ruling.

### H5 — medium — "Sorted by `statId`" is a shape rule in AD-5 and a parse-time normalisation in §4.1

**Location:** AD-5's kind table (*"no `statId` repeated, sorted by `statId`"*) and the Bands
convention, against `IMPLEMENTATION-NOTES.md` §4.1 (*"The schema sorts them on parse; no consumer
re-sorts"*). Sortedness is missing from §4.1's own list of shape rules.

**Unit A (`contracts`, reading AD-5's table as the shape)** refuses unsorted lines. **Unit B
(`tracked:lookup`, reading §4.1)** drafts lines in weights order, because the schema sorts them.
Real input: Bows `LightRadiusAndAccuracy` publishes `[stat_803737631, stat_1263695895]`, and the
byte-wise order is `stat_1263695895` first. The skill's draft fails `tracked:check` under Unit A.
A numeric-minded builder would also sort `803737631` before `1263695895`. The byte-wise rule is
stated only in §4.1 and the Conventions table, not in AD-5.

**Smallest tightening:** in AD-5, change *"sorted by `statId`"* to *"in any order. `contracts`
sorts them byte-wise on parse (§4.1)"*. Add to §4.1's shape-rule list: *"order is not validated."*

### H6 — medium-low — §2.1 consequence 2 contradicts the predicate when `S` is non-empty

**Location:** `IMPLEMENTATION-NOTES.md` §2.1, consequence 2 (*"A hybrid and a single-line
reference in one slot overlap only when … `coOccur` holds"*), against the first branch of
`slotOverlap` (*"true if x or y names no statId outside S"*).

**Failing input (real Bows tiers):**

```
a: prefix banded IncreasedAccuracy stat_803737631 [x, y]    -- any pure accuracy band §2.7 passes
   suffix LR T1 { stat_1263695895 [15,15], stat_803737631 [41,60] }
b: prefix hybrid phys%+acc T1 { stat_1509134228 [75,79], stat_803737631 [175,200] }
   suffix the same LR T1
```

`S = {acc}`. In the prefix slot, a's reference names nothing outside `S`, so the slot verdict is
`true` with no `coOccur`. The suffix verdict is `true`. Whenever the sums intersect, the predicate
says overlap. A test author who writes cases from consequence 2 (a hybrid against a single line
needs `coOccur`, and `coOccur` is `false`) expects no overlap. The predicate is the stronger text,
but builders write fixtures from the consequences.

**Smallest tightening:** change consequence 2 to *"… on `statId`s outside `S`. A slot whose
reference names only summed `statId`s defers wholly to the sum comparison (consequence 4)."*

### H7 — low — `tier(ref)` reads two different predicates in §8, and an undefined `needs` has no defined effect on the floor

**Location:** `IMPLEMENTATION-NOTES.md` §8.

- The `hybrid` arm of `tier(ref)` uses `contains`, which excludes `weight == 0` and untrackable
  tiers. The `banded` and `valueless` arms still read *"entries whose interval lies within the
  band"* and *"every entry publishing that statId"*, with no weight condition. Example: a
  valueless `s` with a weight-0 tier at `itemLevelMin` 1 and a live tier at 45. The literal
  `needs` gives 1. A floor of 1 scopes out the live tier, and §2.5 fails the draft that
  `tracked:lookup` produced. On today's data every weight-0 tier has a `null` `statId`, so the
  problem is latent.
- *"`needs` … undefined"* says *"no floor can be derived for its entry"*. It does not say whether
  `floor(cat)` is then undefined or whether it skips the entry. Two `tracked:lookup` authors
  differ.

**Smallest tightening:** define every arm of `tier(ref)` as `{ w ∈ unscoped pool : contains(ref, w) }`.
Then add: *"An undefined `candidate` makes `floor(cat)` undefined, and `tracked:lookup` reports the
class without a floor."*

### H8 — low — Hybrid pairs and single-line pairs get different overlap verdicts for the same search conflation

**Location:** §2.1 consequence 1 against the fourth branch of `slotOverlap`.

Two single-line bands on adjacent tiers whose intervals intersect, such as `T7 [43,56.5]` and
`T8 [56,80]`, are rejected (consequence 1), although their containment sets are disjoint. Two
hybrid references on adjacent tiers that intersect on **every** line are accepted, because
`coOccur` needs a common contained tier and there is none. The searches conflate the boundary
items in both cases. There are 0 such hybrid pairs in today's data. H2's fix closes this
automatically.

### H9 — low — `mixedGroup` guards a value nothing consumes

**Location:** §2.7 `mixedGroup`, and §11 *"`g(e)` … the family's `modGroup`"*.

§11's formula reads `g(e) = e.modGroup` **per tier**. It is correct when a containment set spans
groups, and single-line references with mixed groups pass today with no check. `mixedGroup`
therefore rejects, with the blame on the producer, a state that the arithmetic already handles,
and it does so for hybrids only. One builder reads §11's "family's `modGroup`" as one value per
reference and caches it. Another reads `e.modGroup` per tier. The two agree only because
`mixedGroup` forbids the case where they would differ.

**Smallest tightening:** in §11, say *"`g(e)` is `e.modGroup`"* and nothing more. Then either
delete `mixedGroup`, or keep it as a producer-data warning that does not fail the gate.

## Checked and holding

- **The containment set of a hybrid reference** (line-set equality plus per-line cover) and the
  existential test for single lines. Covering implies meeting, so the §1 claim *"on a file that
  loads, a single-line reference contains pure tiers only"* is true.
- **`incomplete` uses proper superset (⊋) and that is exhaustive.** A reached tier always has
  `lineSet ⊇ statIds(ref)`, because every line of the reference must be met, so ⊋ and `=` are the
  only cases. The larger-than-any-tier case goes to §2.5 as stated.
- **The null-line rule on a `complete` pool.** An internal line leaves `lineSet`, and the 8 such
  tiers stay trackable. A `not-in-game` tier is excluded twice over (weight 0 and untrackable).
  Both are harmless.
- **The hybrid key form.** A two-element `["hybrid", [...]]` cannot collide with a
  three-element single-line affix, even when a `statId` is spelled `"hybrid"`. The ordering stays
  total under byte-wise comparison.
- **The two-operand claim for a sum.** It follows from no repeated `statId` within a reference
  and one reference per slot.
- **Edge alignment on a hybrid** computed over the containment set, and the worked T1–T2 case.
- **`acceptedTier`.** SPEC CAP-4's validation bullet is overridden by the 2026-10-03 ruling in
  `owner-change-briefs.md`, and revision 25 rightly keeps AD-5's four prohibitions. SPEC.md
  still carries the bullet. Amend it before a story cites CAP-4.
