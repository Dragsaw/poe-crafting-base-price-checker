# Adversarial divergence review — ARCHITECTURE-SPINE.md revision 6

**Lens:** adversarial divergence. Method: for each rev-6 change, construct two units one level
down that each obey every AD *to the letter* and still build incompatibly. Every pair below is a
hole to close with a new or tightened AD; a pair that requires one unit to violate a stated rule is
not reported.

**Verdict: NOT CLOSED.** Three critical divergence pairs and one falsified acceptance claim, all of
them inside the four rev-6 changes. The exactness rule is stated in three places with three
different scopes and no fixed summation order, so two conforming builders return opposite verdicts
on the same file. The dropped-stat-line acceptance rests on a claim about the denominator that is
true and irrelevant: the *numerator* sums over entries, and a dropped line silently removes
numerator terms and silently falsifies `coOccur`, both of which reorder the ranking with nothing
loud anywhere.

Severity counts: **4 critical, 4 high, 3 medium, 2 low.**

---

## C-1 (critical) — `core`'s summation order is unfixed, so "exact equality" is not a predicate on a file

**Sites:** spine:555 (AD-28), spine:585 (AD-29), schema:392–397, AGENT-WORKFLOW:92.

All four sites say the same thing about *tolerance* and nothing at all about *association*.
AD-28: "`core` sums the parsed numbers and tests equality." The contract: "`core` does not round and
does not compare within an epsilon — it sums the parsed numbers and tests equality." Neither fixes
the order of summation, and the contract itself states the reason that matters: "floating-point
addition is **not associative**, so a producer that verifies its own total in its own order can
still disagree with `core`'s."

**Divergence pair.** Both units implement `cohortTotals` conservation for one `(statId,
itemLevelMin)` cohort:

- **Unit A (`core`, streaming reader)** walks the entry array in file order, accumulates into one
  `number` when the entry matches the cohort key, compares to the declared total.
- **Unit B (`core`, partition-shaped reader)** materialises the cohort's cells and sums them in
  **value-lattice order** (`band.valueMin` ascending). This is the natural implementation when the
  code that holds the cells is the code that verified they *tile* the axis — which AD-28 requires
  it to do anyway ("that the cells tile", schema:180).

Both conform to every word of all four sites. For a cohort of `850` split as `283.33 / 283.33 /
283.34` emitted in an order that is not value-ascending, A gets `849.9999999999999` and refuses, B
gets `850` and accepts — or the reverse. **Same file, two verdicts, both units conform.**

A third, equally conforming reading: **Unit C** sums per source modifier first (a natural grouping,
since AD-29 already requires per-group sums) and then sums those subtotals into the cohort total.
Sum-of-sums re-associates and gives a third result.

This is not hypothetical arithmetic pedantry: it is precisely the failure the contract names and
then declines to close. A rule whose verdict depends on an unspecified traversal order is not a
rule two independently built units can agree on.

**What closes it:** a new clause in AD-28 fixing the exact evaluation, e.g. *"`core` sums each
checked set by left-fold over the file's own entry array order, and any implementation that
materialises or regroups first must restore that order before summing."* Alternatively — and
better — fix the comparison rather than the order: require the sum to be performed in a
representation where association does not matter (see C-2).

---

## C-2 (critical) — "exact **as serialised**" licenses a decimal comparison that accepts the contract's own refused example

**Sites:** schema:390 (the heading *Sums must be exact as serialised*), schema:394.

The heading says *as serialised*. The body says the file's `283.33 / 283.33 / 283.34` case "sums to
`849.9999999999999` and is refused". These are not the same rule.

**Divergence pair.**

- **Unit A (`contracts`)** parses with `JSON.parse`, so every weight is an IEEE double, and tests
  `sum === declared`. Refuses the example, as the contract's prose says.
- **Unit B (`contracts`)** reads the heading literally: the obligation is that the sums be exact
  *as serialised*, so it compares the serialised decimals — parse the numeric literals as exact
  decimals (or as scaled integers over the common scale) and test equality. No tolerance, no
  epsilon, no rounding; it "sums the parsed numbers and tests equality" exactly as written, and
  association is irrelevant because decimal addition at fixed scale is exact. B **accepts** the
  contract's own worked counter-example.

Both units satisfy every stated constraint. B is also the strictly better engineering answer — it
makes the check order-independent and discharges the producer obligation for free — which means the
spine is at risk of getting the *worse* of two conforming readings by accident. The divergence is
that it does not say which.

**What closes it:** AD-28 must name the arithmetic, not only the tolerance. Two acceptable
closures, and the AD must pick one: (a) "the comparison is over IEEE doubles as produced by
`JSON.parse`, left-folded in file order" (keeps the producer obligation, closes C-1 too), or (b)
"the comparison is exact over the decimal literals as serialised; `core` compares at the common
scale and the producer obligation is discharged by decimal conservation alone" (deletes the
producer obligation, deletes C-1 and C-3, and makes the Deferred epsilon item moot).

---

## C-3 (critical) — route 2 of the producer obligation cannot be discharged, and a file that follows it to the letter is refused

**Sites:** schema:396–397 ("Either route discharges the obligation"), schema:399.

> - **Emit values that are exact in binary** …
> - **Verify against the consumer's arithmetic** — sum in double precision in the file's own entry
>   order, and let the last cell of each cohort and each stat line absorb the residue before
>   emitting.

Route 2 fails twice.

**(a) It presumes a consumer summation order that no AD binds.** "The file's own entry order" is the
consumer's order only if `core` sums in that order — which is exactly what C-1 shows is unfixed.
Against Unit B or C of C-1, a producer that follows route 2 perfectly emits a refused file. The
contract calls route 2 "verify against the consumer's arithmetic" while the consumer's arithmetic is
undefined.

**(b) The two residue targets overlap and can be mutually unsatisfiable.** A cell belongs to a
`cohortTotals` cohort *and* to a `sourceModifierId` group's per-`statId` sum. Take a hybrid group
`g` at one `itemLevelMin` publishing `statId` `a` and `statId` `b`, both decomposed, where `a` is
also published by a second modifier `h` (explicitly legal, AD-29, spine:589). Then:

- `cohortTotals(a, ℓ)` constrains `Σ` over *g's a-cells **and** h's a-cells*.
- `cohortTotals(b, ℓ)` constrains `Σ` over g's b-cells.
- AD-29 group consistency constrains `Σ g.a-cells == Σ g.b-cells` **exactly**.

Absorbing the cohort-`a` residue into the last `a` cell — which may be one of *h's* cells or one of
*g's*, the contract does not say — changes `Σ g.a-cells` and breaks the group equality; absorbing
the group residue back into a `g.a` cell breaks cohort `a`; absorbing it into `g.b` breaks cohort
`b`. In doubles, there is no guarantee a fixed point exists. The contract prescribes a procedure
with no stated resolution order between two constraints on intersecting sets and asserts it
discharges the obligation.

**Answering the brief's question directly: yes, there is a file that satisfies the stated obligation
and is still refused.** It is produced by following route 2 exactly, in either of the two ways
above. The Deferred item (spine:778) describes the residual risk as "a producer *taking neither
route*" emitting a refused file. That understates it: a producer taking route 2 can also emit a
refused file, and route 1 is in fact the only route that discharges anything.

**What closes it:** delete route 2, or demote it to "a heuristic that does not discharge the
obligation". Only "emit values exact in binary" (integers, or dyadic rationals) is order-independent
and therefore actually a discharge. The largest-remainder integer-grid split already named in route
1 is sufficient and should be stated as **the** requirement. This also lets the Deferred item's
revisit condition be stated honestly.

---

## C-4 (critical) — a dropped stat line DOES change probabilities and DOES falsify `coOccur`, silently; the rev-6 acceptance rests on a claim about the wrong half of the ratio

**Sites:** spine:369 (AD-18), spine:777 (Deferred), schema:376–378, `.memlog.md` rev-6 CANDIDATE 2.

The acceptance argument, stated identically in all four places:

> because AD-18's denominator sums `mass(g)` over distinct SOURCE MODIFIERS rather than over
> entries, a dropped line leaves its group present with its mass intact — so unlike a dropped ROW, a
> dropped LINE does NOT shrink the denominator and does NOT inflate any probability on the base …
> a defect that cannot reorder the ranking.

The claim about the denominator is true. It is also irrelevant, because **the numerator sums over
entries** (AD-18, spine:363, emphasised in the spine's own words). A dropped line is a dropped set of
entries. The argument never addresses the numerator, and the loud-symptom fallback (empty
containment set) only fires when the *whole* `statId` vanishes from the scoped pool.

The construction that breaks it uses only facts the spine states as legal. **One `statId` may be
published by more than one source modifier** (AD-29, spine:589; schema:365 makes the overlap a
non-error).

### C-4a — a silently understated probability, no loud symptom

Base `B`, prefix slot, at floor `L`. Pool as the game has it:

| source | statId | band | ilvl | weight |
| --- | --- | --- | --- | --- |
| `g` (hybrid) | `a` | 4–6 | 8 | 1000 |
| `g` (hybrid) | `c` | 6–13 | 8 | 1000 |
| `h` | `c` | 6–13 | 8 | 500 |

Producer drops `g`'s `c` line (a scrape gap on the second line of a hybrid row) and still declares
`complete`. The emitted file passes: `g` still publishes `a`, so group consistency compares one
`statId`'s sums against nothing (vacuously consistent); `c` is still in the pool via `h`, so the
pool is non-empty; `sources()` still holds both `g` and `h`, so the denominator is
`mass(g) + mass(h) = 1500`, unchanged.

A tracked reference `y` names `c` over 6–13. Its containment set is **non-empty** — `h`'s cell is
there — so **no empty-containment error fires, no loud symptom of any kind**. But its numerator is
`500` instead of `1500`. `P(y) = 500/1500 = 0.333` where the truth is `1.0`. Base `B`'s `EV` is
understated by a factor of three and **the ranked list reorders**, with nothing reported anywhere.

This is not "the harm is bounded to the dropped line itself: that stat becomes untrackable". The
stat remains trackable, is tracked, produces a number, and the number is wrong.

### C-4b — `coOccur` silently false, `ΣP > 1`, base takes the top of the ranking

Same pool, same drop. Now the curator tracks two entries on `B`, prefix `x` naming `a` (4–6) and
suffix… no — keep both in one slot as AD-17's `slotOverlap` requires: `x` naming `a`, `y` naming `c`.

Truth: `g` publishes both `a` and `c`, so a single item satisfies both references. `coOccur(x, y)`
should be **true**, `slotOverlap` should be true, and AD-17 should reject `tracked.json` as an
overlap — "two tracked entries in one slot naming two lines of one modifier are **both satisfied by
a single item**, so without it that base's `ΣP` exceeds 1 and it takes the top of the ranking"
(spine:587).

With `g`'s `c` line dropped, **no `sourceModifierId` in the pool emits an entry contained by `x` and
one contained by `y`** — `g` has only `a`, `h` has only `c`. `coOccur(x, y)` evaluates **false**.
`slotOverlap` is false, the entries are accepted as disjoint, both become summands, the item
carrying `g` is counted twice, `ΣP` for `B` exceeds 1, and `B` **takes the top of the ranked list**.

No error. No empty containment set. No partial pool. This is the exact failure AD-17 and AD-29 both
name as the reason `sourceModifierId` exists, reached through the defect rev 6 accepted on the
ground that it "cannot reorder the ranking". **The acceptance claim is false, and the whole of
CANDIDATE 2's resolution rests on it.**

Note also the asymmetric direction: dropping a line can only ever turn `coOccur` from true to
false — i.e. it can only ever *fail to reject* an overlapping tracked list. Every instance of this
defect is therefore a `ΣP > 1` risk, never a false rejection. The defect has exactly one direction
and it is the unsafe one.

### C-4c — AD-27 coverage cannot see it

Answering the brief's last question directly: **yes, a base can be simultaneously `complete`,
`covered` under AD-27, and missing a line something depends on.** `covered(base)` (spine:500–503)
tests three things — present in `weights.json`, both slots declare `complete`, neither pool empty —
and all three are declarations or cardinalities, not content. The pool in C-4a is present, declares
`complete`, and is non-empty. It counts as covered, the coverage fraction reads 100%, and the gate
that binds a layout decision is blind to the defect. AD-27 measures what the producer *claims*, and
the dropped-line defect is precisely a false claim; the two do not intersect at all.

### C-4d — `cohortTotals` sometimes *does* catch it, which makes the acceptance inconsistent

schema:376: "nothing in this file declares how many lines a source row publishes — so a producer
that drops one line of a multi-stat row and still declares `complete` passes every check here."
That is false where `cohortTotals` is declared for the affected family. The total is "computed
before any splitting, by a path independent of the cells themselves" (schema:162). A producer
holding the pre-split tier table for the `c` family computes `cohortTotals(c, 8) = 1500` from the
tier rows, then emits only `h`'s cells summing to `500`, and `core` **refuses the file** — the
defect declared undetectable is detected.

Which yields another clean divergence pair (see H-3): `cohortTotals` is "Required for every
`(statId, itemLevelMin)` family containing at least one `modelled-split` entry; permitted, **and
encouraged**, for any other" (schema:164). A producer that takes the encouragement is refused; a
producer that does not is accepted; the underlying data is identically defective. Both conform.

**What closes C-4 (all parts):** the Deferred "declared stat-line count per source modifier" is not
a diagnosis nicety — it is the only mechanical defence against a `ΣP > 1` ranking inversion, and the
cost analysis that deferred it was computed against a false premise. Minimum closure, in order of
preference:

1. Promote the declared line count per `sourceModifierId` (`statLineCount`, the `cohortTotals`
   pattern) to required. It is breaking against a 4.0.0 producer, but it is bought for
   **correctness**, not diagnosis, and the Deferred entry must be rewritten to say so.
2. Failing that, make `cohortTotals` **required for every family**, not only decomposed ones. This
   is non-breaking in shape (the field exists), catches every dropped line in a family whose
   `statId` is published by more than one source modifier — which is exactly the silent case — and
   removes the H-3 divergence at the same time.
3. At absolute minimum, AD-18 and the contract must **delete** the "cannot reorder the ranking"
   claim and replace it with the true statement: a dropped line understates the numerator of any
   reference whose `statId` survives via another modifier, and silently falsifies `coOccur` between
   two lines of one modifier when one of the lines' `statId`s survives via another modifier. An
   accepted risk stated wrongly is worse than an unstated one, because it stops the next reviewer
   looking.

---

## H-1 (high) — the rev-6 `mass(g, L)` → `mass(g)` respelling rests on an invariant no validation rule enforces, and two conforming units compute different denominators

**Sites:** spine:363 (AD-18), spine:579, 583 (AD-29), schema:364, schema:370.

AD-29 justifies dropping `L` thus: "A source row is one tier and therefore sits in exactly one
item-level cohort … so a group is admitted by the scope whole or not at all, and the sums have
nothing to disagree across." That is a claim about the file's content. **Nothing refuses a file that
violates it.** The hard-error list (schema:359–370) has no entry for *a `sourceModifierId` whose
entries carry differing `itemLevelMin`*. Worse, the duplicate-key rule (schema:364) keys on
`(sourceModifierId, statId, kind, valueMin, valueMax, itemLevelMin)` — it explicitly treats the same
group at two item levels as two distinct legal rows — and the group-consistency hard error
(schema:370) is worded "within one `itemLevelMin` cohort", which only makes sense if a group *can*
span cohorts.

**Divergence pair.** File has group `g` with entries at `itemLevelMin` 60 and 65. Entry floor
`L = 62`.

- **Unit A (`core`)** takes AD-29 at its word: `mass(g)` carries no `L`; `g` appears in
  `sources(scoped(...))` because at least one of its bands is in scope; `mass(g)` is the common
  per-`statId` sum over **all** of `g`. Denominator includes `g`'s full mass, including the ilvl-65
  tier that cannot roll at 62.
- **Unit B (`core`)** takes the contract's wording at its word: the group-consistency check is
  applied "within one `itemLevelMin` cohort", so a group's mass is per-cohort; only the ilvl-60 part
  is in scope at `L = 62`; `mass` is that part.

Both conform. The denominators differ, every probability on the base differs, **and the ranked list
reorders** — which is the precise failure AD-18's *Prevents* line exists to stop. The rev-5 spelling
`mass(g, L)` made this a non-question; rev 6 removed the parameter and replaced it with an
unenforced assumption.

**What closes it:** add to the contract's hard errors — *"entries sharing a `sourceModifierId`
within a `(base, slot)` must all carry the same `itemLevelMin`"* — and cite it in AD-29 as what makes
`mass(g)` well-defined. It is a new *check*, not a new *field*, so it is non-breaking against a
conforming 4.0.0 producer. Until that check exists, the `L` should not have been dropped.

---

## H-2 (high) — the exactness rule is stated with three different scopes; one of its three rules is uncheckable by the component told to check it

**Sites:** spine:555 (two checks), AGENT-WORKFLOW:92 (two checks), schema:392 (**three** checks).

- AD-28: "`core` sums the parsed numbers and tests equality, **here and in AD-29's
  group-consistency check**" — two.
- AGENT-WORKFLOW: "the two sum checks — `cohortTotals` conservation (AD-28) and a group's
  per-`statId` agreement (AD-29)" — two.
- Contract: "**Three** rules in this contract are exact comparisons, and `core` applies them with no
  tolerance: a cohort's emitted cells must sum to its declared `cohortTotals` weight, a group's
  per-`statId` weights must sum to the same value, **and a tier's split across the cells it reaches
  must sum to that tier's weight**."

The third is not a check `core` can perform. The contract itself says so twenty lines earlier:
"`core` cannot recover the pre-split tier weights from the cells. So declare them" (schema:154), and
"`core` holds no tier data" (schema:180). `w(t)` is nowhere in the file.

**Divergence pair.** A `contracts` builder implementing "the three rules `core` applies":

- **Unit A** implements two checks and treats the tier-split rule as a producer-side statement with
  no consumer counterpart.
- **Unit B** implements three. Having no `w(t)`, it derives the tier's weight the only way the file
  permits — a `sourceModifierId` **is** one tier (AD-29, spine:579), so its per-`statId` sum *is*
  `w(t)` — and checks `Σ over sourceModifierIds in the cohort of (that group's per-statId sum) ==
  cohortTotals.weight`. This is a **sum of sums**: a different association from Unit A's flat sum
  over cells, and therefore a different double, and therefore a different verdict on a file that is
  decimal-correct but not binary-exact.

Both units conform. Unit B's check is also *not obviously wrong* — it is a defensible reading of a
rule the contract says `core` applies. The divergence is manufactured entirely by the count
mismatch.

**What closes it:** correct the contract to **two** consumer-side exact checks, and state the
tier-split rule separately as a producer obligation with no consumer counterpart — which is what it
is. Then state, per C-1, the association `core` uses.

---

## H-3 (high) — optional `cohortTotals` makes detection of an identical defect producer-dependent

Derived in C-4d above; recorded separately because its closure is separable.

**Divergence pair.** Two producers, same source data, same dropped hybrid line, same `complete`
declaration:

- **Producer A** takes the contract's encouragement (schema:164) and emits `cohortTotals` for
  non-decomposed families too. Its file is **refused** — the cohort's emitted cells fall short of
  the independently-computed declared total.
- **Producer B** emits `cohortTotals` only where required. Its file **loads** and ranks wrongly.

Both conform to the letter. The conscientious producer is punished and the lax one is not, and the
spine's own analysis of what is and is not detectable (schema:376, spine:777) is written as though
only Producer B exists.

**What closes it:** make `cohortTotals` required for every `(statId, itemLevelMin)` family. It
removes the divergence, converts a large share of C-4 from silent to loud, and costs a producer that
already computes the pre-split tier table nothing.

---

## H-4 (high) — the same within-file check can live in `contracts` and in `core`, and the two can disagree

**Sites:** schema:357 ("The schema is a Zod schema in `packages/contracts`, and it is the single
source of truth … validating the already-loaded value is a pure function in `core`"),
Consistency Conventions "Validation" row ("Validate at every trust boundary"), AGENT-WORKFLOW:90.

The conservation and group-consistency checks are *within-file* — unlike straddle, edge-alignment
and `coOccur`, which AD-6's rule assigns to `core` because they are cross-file. A `contracts` builder
therefore has every warrant to put them in a `superRefine` on the Zod schema (the schema is "the
single source of truth", and a within-file invariant is exactly what a schema expresses); a `core`
builder has every warrant to implement them in `core` (AD-28 says "`core` sums … and tests
equality", schema:357 says validating the loaded value is a `core` function).

**Divergence pair.** Unit A puts them in `contracts`, summing in Zod's traversal order over the
parsed array. Unit B puts them in `core`, summing over its own grouped `Map`. On a decimal-correct,
binary-inexact file the two verdicts differ — and because `web` loads through the `contracts` schema
while `core`'s unit tests feed literals directly, **the same file is refused in the browser and
accepted in the test suite**, which is the worst possible place for this divergence to surface.
Both units conform.

Even with C-1 closed (a fixed order), the *duplication* remains a divergence surface: two
implementations of one exact check is exactly the shape AD-6 exists to prevent.

**What closes it:** AD-28 should say which component owns the two sum checks, as AD-6 and AD-18 do
for every other check, and say that the other must not re-implement them. Given `core` is the only
component that can hold the whole file for a base and the one AD-28 already names, `core` is the
right owner and `contracts` should carry shape only.

---

## M-1 (medium) — `cohortTotals` has no `sourceModifierId` key, so two modifiers publishing one `statId` in one cohort have an undefined declaration

`cohortTotals` rows are keyed `(statId, itemLevelMin)` (schema:157). AD-28's family spans
modifiers — "cut once per `(base, slot, statId)` across every tier of every modifier publishing it"
(spine:557), and the carriage bound is counted the same way (spine:565). So one cohort row must
cover both modifiers' tiers.

**Divergence pair.** Modifiers `g` and `h` both publish `statId` `c` at `itemLevelMin` 8.

- **Producer A** emits one row, `weight = w(g) + w(h)`; `core` sums all cells of both → agrees.
- **Producer B** emits one row per modifier — two rows with the same `(statId, itemLevelMin)`. There
  is **no hard error for a duplicate `cohortTotals` key** (schema:359–370 lists none), so the file
  validates. `core` Unit A takes the first match and refuses (cells exceed it); `core` Unit B sums
  matching rows and accepts; `core` Unit C treats the duplicate as a file error. Three verdicts, all
  conforming.

**What closes it:** state in AD-28 that a `cohortTotals` row is per `(statId, itemLevelMin)` across
**every** source modifier publishing that stat — the same key the carriage bound already uses — and
add a duplicate-`cohortTotals`-key hard error.

---

## M-2 (medium) — "the cohort's emitted cells" does not say whether entries of *other* source modifiers count

The same ambiguity as M-1 from the consumer side, and it is worth stating separately because a
`core` builder meets it without ever seeing a duplicate row. Given one `cohortTotals` row for
`(c, 8)`, does `core` sum the cells of every modifier publishing `c` at 8, or only those of some
distinguished one? AD-28's family definition implies the former; nothing says it. Unit A sums across
modifiers and accepts; Unit B sums per modifier and refuses the same file. Closed by the same
sentence as M-1.

---

## M-3 (medium) — the two causes of an empty containment set are reported without the one discriminator the file already carries

AD-18 (spine:369) now reports both causes and "leaves which document is at fault to the reader".
`core` in fact holds one cheap discriminator it does not use: whether the `statId` appears **at all**
in the unscoped pool for that `(base, slot)`.

- If the `statId` is absent from the unscoped pool entirely, the weights file has no line for it —
  cause 2 is likely and cause 1 is impossible in its stated form ("every band it covers requires a
  higher item level" presupposes bands exist).
- If the `statId` is present unscoped but every band requires a higher `itemLevelMin`, cause 1 is
  established outright and cause 2 is excluded.

So the ambiguity AD-18 accepts is not actually total — it is total only in the narrow overlap, and
the error could name which of the two it is in most cases. As written, two builders diverge on how
much the error says (one prints both causes flatly, one prints the discriminated diagnosis), which
is a divergence in observable behaviour even if not in verdict.

**What closes it:** state the discriminator in AD-18 and require the error to carry it. It costs
nothing, needs no contract change, and materially weakens the case for the Deferred line count *as a
diagnosis purchase* — though not, per C-4, as a correctness purchase.

---

## L-1 (low) — "no pre-rounding" is stated for `core` and not for the producer

AD-28 and AGENT-WORKFLOW both forbid `core` from pre-rounding. Nothing forbids the producer from
emitting weights it rounded — indeed the Consistency Conventions' 4-decimal rounding rule covers
divine values and explicitly exempts weights ("weights are non-negative numbers used only in
ratios"), so a producer may reasonably think 4 decimals is house style and round weights to it.
Rounded weights are precisely what fails the exact sums. Worth one clause in the contract: weights
are never rounded for presentation; a producer emits the exact split values.

## L-2 (low) — `provenance: "modelled-split"` gates a required field, so a provenance edit changes a validation regime

`cohortTotals` is required for a family "containing at least one `modelled-split` entry". Provenance
is a producer-chosen label. A producer that measures its cell masses and stamps `measured`
(spine:551) drops the requirement for `cohortTotals` and with it the only check on that family's
conservation — on the very families where the split was most likely to be numerically awkward.
Merging into M-1's closure (require `cohortTotals` everywhere) removes this too.

---

## Summary of proposed closures

| Finding | Closure |
| --- | --- |
| C-1, C-2 | AD-28 names the arithmetic **and** the association: either doubles left-folded in file entry order, or exact decimal at common scale. Pick one explicitly. |
| C-3 | Delete route 2 from the producer obligation, or demote it below a discharge. Route 1 (binary-exact values, largest-remainder integer grid) is the only real discharge. |
| C-4 | Promote the declared stat-line count per `sourceModifierId` to required, **or** require `cohortTotals` for every family; at minimum, delete the false "cannot reorder the ranking" claim from AD-18, the contract, and the Deferred entry. |
| H-1 | New hard error: entries sharing a `sourceModifierId` within a `(base, slot)` carry one `itemLevelMin`. Cite it in AD-29 as what makes `mass(g)` well-defined. |
| H-2 | Contract says **two** consumer-side exact checks; the tier-split rule is producer-side only. |
| H-3, L-2 | `cohortTotals` required for every `(statId, itemLevelMin)` family. |
| H-4 | AD-28 assigns the two sum checks to one component and forbids the other re-implementing them. |
| M-1, M-2 | `cohortTotals` keyed per `(statId, itemLevelMin)` across every publishing modifier; duplicate key is a hard error. |
| M-3 | AD-18's empty-containment error carries the unscoped-presence discriminator. |
| L-1 | Contract forbids producer-side rounding of weights. |
