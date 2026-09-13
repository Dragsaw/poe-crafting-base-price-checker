---
lens: verification
target: ARCHITECTURE-SPINE.md
revision: 5
companions: [WEIGHTS-FILE-SCHEMA.md 4.0.0, AGENT-WORKFLOW.md]
date: '2026-09-13'
verdict: issues
---

# Reviewer gate — revision 5, VERIFICATION lens

Scope: (1) stack currency re-checked against the live npm registry and nodejs.org;
(2) arithmetic and internal consistency of revision 5's new material — AD-29, AD-18's
revised ratio, AD-17's `coOccur` branch, the contract at 4.0.0, and the Consistency
Conventions' precision row; (3) assertions in new text that rest on no measurement,
no live check and no cited source.

**Verdict: issues.** One critical (a rev-5 key change silently disables AD-28's only
mechanical defence against a degenerate partition), one high on the precision row's
justification, one cross-document divergence on Mantine, and a set of medium/low
items. The arithmetic that was asked about — AD-29's explosion figures, the
nine-cell partition, the group-consistency example, and AD-18's reduction claim —
all **check out**.

---

## 1. Stack currency

All versions re-checked 2026-09-13 against `registry.npmjs.org` (`/latest` and
`/-/package/<pkg>/dist-tags`) and `nodejs.org/dist/index.json`.

| Pinned in Stack | Live today | Status |
| --- | --- | --- |
| Node.js 24.21.0 (Krypton LTS) | v24.21.0 is the newest v24 (2026-09-07); Krypton confirmed; newest overall v26.8.2, **not** LTS | exact-current |
| TypeScript 6.0.3 | `latest` = 7.0.2; **6.0.4 does not exist** (404) so 6.0.3 remains the top of the 6.x line; other tags: `beta` 6.0.0-beta, `rc` 7.0.1-rc, `next` 7.1.0-dev.20260913.1 | exact-current |
| pnpm 12.4.1 | 12.4.1 | exact-current |
| React 19.3.0 | 19.3.0 | exact-current |
| Vite 8.3.0 | 8.3.0 | exact-current |
| Mantine 9.6.1 | `@mantine/core` 9.6.1 | exact-current (but see V-2) |
| Zod 4.6.3 | **4.6.4** | **moved** |
| Vitest 5.0.0 | 5.0.0 | exact-current |
| MSW 2.15.0 | 2.15.0 | exact-current |
| ESLint 10.10.0 | 10.10.0 | exact-current |
| typescript-eslint 8.70.0 | `latest` 8.70.0, `canary` 8.70.1-alpha.0, `rc-v8` 8.0.0-alpha.62 | exact-current |
| dependency-cruiser 18.2.0 | 18.2.0 | exact-current |

**V-1 — low. Zod moved 4.6.3 → 4.6.4.** A patch bump; update the Stack row. Eleven
of twelve pins are exact-current, which is the same standing the rev-3 and rev-4
verification passes recorded.

### The two TypeScript 7 blockers — both re-confirmed, verbatim, unmoved

| Blocker | Live value (2026-09-13) | vs spine |
| --- | --- | --- |
| `typescript-eslint@8.70.0` peers | `"typescript": ">=4.8.4 <6.1.0"`, `"eslint": "^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0"` | matches; still caps at `<6.1.0`, still no published line accepts TS 7, canary included |
| `dependency-cruiser@18.2.0` | `supportedTranspilers.typescript: ">=2.0.0 <7.0.0"` | matches character-for-character |

The upgrade-trigger block is accurate as written. TS 7.0.2 is current; neither
blocker has cleared; the spine's instruction ("move only when both publish a range
including 7") stands.

### V-2 — high. `CLAUDE.md` says Mantine v8; the Stack pins 9.6.1.

The repo-root `CLAUDE.md` now carries a **UI** section reading *"The UI is built with
Mantine v8"*, with `https://mantine.dev/llms.txt` as the agent-facing framework
documentation. The spine's Stack pins `@mantine/core` / `@mantine/hooks` **9.6.1**,
and the memlog records the reason for that choice explicitly — *"Mantine
(batteries-included, strong dense/expandable table story, **v9 ships agent skills +
MCP server for Claude Code**)"*. 9.6.1 is confirmed current on the registry today.

This is a genuine divergence, not a wording slip, and it is the more dangerous
direction: `CLAUDE.md` is the file an agent reads *before* touching `web`, while the
Stack table is one row inside a 774-line document. An agent starting view work today
will scaffold against v8 while `AGENT-WORKFLOW.md` and AD-24 assume the pinned stack.

**Recommendation (no edit made to either file):**

1. Decide which is the decision. Nothing in the memlog records a later move to v8, so
   the probable cause is `CLAUDE.md` being written from memory rather than from the
   Stack table.
2. If 9.6.1 stands: correct `CLAUDE.md` to v9 and confirm the `llms.txt` link resolves
   to v9 documentation — a v8 doc link is the same defect one layer down, since it is
   what an agent will actually read.
3. If v8 was a real decision: it belongs in the spine's Stack table with its reason,
   and the memlog's v9-specific rationale (agent skills, MCP server) has to be
   retracted in the same edit, because that rationale is the only recorded basis for
   the framework choice.
4. Either way, one of the two documents must cite the other, so the next divergence is
   a diff rather than a discovery.

---

## 2. Arithmetic and internal consistency of the new material

### A-1 — PASS. AD-29's producer figures reconcile exactly.

Bucket count: `534 + 18 + 8 = 560` ✓ — matches "560 of 8,437 in-scope rows".

Explosion: each row yields one stat-line unit plus one surplus per extra stat line.

```
surplus = 534 × (2−1)  +  18 × (3−1)  +  8 × (2−1)
        = 534          +  36          +  8         =  578
total   = 8,437 + 578  =  9,015  ✓
```

Stated in both the spine (AD-29) and the contract (4.0.0 banner), identically. The
arithmetic works.

**A-1a — low, descriptive.** The sum only closes if the three buckets are **disjoint**,
which means "534 with two stats" has to be read as *534 with two **banded** stats* —
the 8 "pairing a banded line with a flat one" carry two stats as well. As written the
buckets mix two axes (stat count, and kind of line), and a reader who takes the 8 as a
subset of the 534 gets `534 + 18 = 552 ≠ 560` and concludes the figures are wrong. One
word ("534 with two banded stats") removes the ambiguity in both documents.

### A-2 — PASS with a caveat. The Body Armours group-consistency example.

The worked table is correct: `ev-hybrid-t1` publishes `…evasion_flat` over 4–6 and
`…evasion_pct` over 6–13, both at `itemLevelMin: 8`, both at weight 1000. Each
`statId`'s sum within the cohort is 1000, the sums agree, so the group is consistent;
and under AD-18 the pair contributes `mass(g, L) = 1000` to the denominator rather
than 2000. Both claims hold, and both agree with the Shape block's two `ev-hybrid-t1`
entries.

**Caveat — medium: the example does not demonstrate the rule it is placed under.** The
contract introduces it as the worked case for *the group-consistency rule*, which it
calls "the only mechanical check on the split", and then works it "assuming no
decomposition is needed (each line is one cell)". With one cell per line the two sums
are each a single number copied from the same source row, so they **cannot** disagree —
the check is vacuous on this instance. The failure the rule exists to catch (a dropped,
duplicated or misattributed cell) only becomes visible once at least one line is
decomposed into several cells. A second worked row where one line splits `400 + 600 =
1000` against the other's single `1000` would exercise it; as it stands a producer can
read the example, satisfy it exactly, and still have no idea what the check does.

It *does* correctly demonstrate the denominator de-duplication (1000, not 2000), which
is the other thing the section claims. So: arithmetically right, half of what it
advertises.

### A-3 — PASS. The nine-cell partition is still correct after revision 5.

Re-verified cell by cell on the half-integer lattice.

Tier endpoints, deduplicated and sorted: `32, 43, 56, 56.5, 79, 80, 101.5, 103, 123`.

Tiling (each cell's top + 0.5 == the next cell's floor):

```
[32,42.5] → [43,43] → [43.5,55.5] → [56,56.5] → [57,78.5] → [79,80] → [80.5,101] → [101.5,103] → [103.5,123]
   42.5+.5=43 ✓   43+.5=43.5 ✓   55.5+.5=56 ✓   56.5+.5=57 ✓   78.5+.5=79 ✓   80+.5=80.5 ✓   101+.5=101.5 ✓   103+.5=103.5 ✓
```

No gaps, no overlaps, nine cells. Each tier is an exact union of cells:

| Tier | Range | Cells |
| --- | --- | --- |
| T6 (54) | 32.0–43.0 | `[32,42.5] ∪ [43,43]` ✓ |
| T7 (60) | 43.0–56.5 | `[43,43] ∪ [43.5,55.5] ∪ [56,56.5]` ✓ |
| T8 (65) | 56.0–80.0 | `[56,56.5] ∪ [57,78.5] ∪ [79,80]` ✓ |
| T9 (75) | 79.0–103.0 | `[79,80] ∪ [80.5,101] ∪ [101.5,103]` ✓ |
| T10 (81) | 101.5–123.0 | `[101.5,103] ∪ [103.5,123]` ✓ |

Exactly four cells are carried by exactly two cohorts — `[43,43]` (54, 60),
`[56,56.5]` (60, 65), `[79,80]` (65, 75), `[101.5,103]` (75, 81) — matching the shared-cell
table. No cell is carried by three. AD-28's quoted interior cell `[57,78.5]` is the T8
interior, as claimed. The rev-4 corrections held; revision 5 did not disturb the
partition itself.

### A-4 — CRITICAL. Revision 5 scoped the cohort-carriage bound by `sourceModifierId`, which makes it unfireable.

The contract's hard-error list now reads:

> the same cell interval carried by **more than two** cohorts within one
> `(base, slot, statId, sourceModifierId)` family

`sourceModifierId` was added to that key in this revision (the memlog records it as a
composition fix: *"Duplicate-key and cohort-carriage errors regain sourceModifierId
accordingly"*). Follow the consequences:

- A **cohort** is defined by `itemLevelMin` (AD-28 step 2: "groups the family's tiers
  into cohorts by `itemLevelMin`").
- A **source modifier** is one poe2db row, and a row is one tier — the Shape block says
  so outright, with `"sourceModifierId": "lightning-dmg-t7"` and
  `"lightning-dmg-t8"` annotated *"a different modifier"*.
- A row therefore carries **exactly one** `itemLevelMin`.

So within one `(base, slot, statId, sourceModifierId)` family there is exactly **one**
cohort. "More than two cohorts" can never occur, and the hard error is dead code.

The worked example above is the proof: all four shared cells are shared across *different*
source modifiers (T6 vs T7, T7 vs T8, …), so under the rev-5 key **none of them is carried
by more than one cohort at all**. A check that the canonical worked example is supposed
to exercise four times now fires zero times.

What that costs is named by AD-28 itself: the bound is *"what makes the coarse-partition
case detectable"* — the one mechanical refusal of a producer emitting one wide cell per
cohort, which otherwise "satisfies every mechanical check while forcing every curator
into a full-span reference — BQ-1 through a coarse cell instead of a sentinel value".
Revision 5 removed that defence as a side effect of a change aimed at non-overlap, and
nothing in the revision banner or the contract's 4.0.0 table records it as a loss.

There is also a straightforward **internal divergence** created by the same edit: both
prose statements of the bound still scope it per `(baseTypeId, slot, statId)` —

- AD-28: *"**A cell may be carried by at most two cohorts.** Only adjacent tiers
  overlap…"* (no `sourceModifierId`);
- the contract's *Decomposing a multi-number modifier*, under the heading *"Per
  `(baseTypeId, slot, statId)` family"*: *"**A cell may be carried by at most two
  cohorts.**"*

Only the hard-error list carries the four-key. A builder implementing from the prose and
a builder implementing from the error list write two different validators.

**Recommendation.** Revert the cohort-carriage key to `(base, slot, statId)`. AD-29
already supplies the argument for doing so, in the very clause that resolved the
`statId`-published-by-two-modifiers collision: *"the **partition** stays cut per
`(base, slot, statId)` across every tier of every modifier publishing it, because
edge-alignment is a property of what the trade filter can ask for, not of the modifier
behind it."* Cohort carriage is a property of that same partition, so it takes that same
key. `sourceModifierId` genuinely belongs in the **duplicate-key** error and in
**non-overlap** (two modifiers may legitimately publish one stat over one cell) — those
two are correct as amended; the third was carried along by symmetry and should not have
been.

### A-5 — PASS. AD-18's revised ratio is well-defined, and the reduction claim is exact.

```
                 Σ { band.weight : band ∈ scoped(base, slot, L) ∧ band ⊆ ref }
P(ref | …) = ───────────────────────────────────────────────────────────────────
                 Σ { mass(g, L) : g ∈ sources(scoped(base, slot, L)) }
```

**Is `mass(g, L)` well-defined?** Yes, on two independent grounds, and both are needed.

1. *Agreement across stat lines.* `mass(g, L)` is defined as "the common per-`statId`
   sum of `g`'s scoped entries" — well-defined only if those per-`statId` sums are equal.
   AD-29's hard error enforces equality **per `itemLevelMin` cohort**; the scoped set may
   span several cohorts (`itemLevelMin ≤ L`). The scope-wide sums are then sums of
   per-cohort values that are each equal across stats, so they too are equal. The step is
   sound but is not written down — worth one clause, since a builder checking agreement
   only at the cohort level and then summing has to make the same inference.
2. *Scoping is all-or-nothing per modifier.* Since a source row has exactly one
   `itemLevelMin` (A-4), every entry of `g` enters or leaves the scope together, so
   `mass(g, L)` is `w(g)` or 0 — never a partial slice of a modifier's mass. That is what
   keeps the denominator equal to the total weight of the draw at level `L`.

**Is the scope of distinctness sound?** Yes. The contract scopes `sourceModifierId`
stability to one `(baseTypeId, slot)`, and the denominator is computed within one
`(base, slot, L)`. The two agree; `sources(·)` never has to compare ids across bases.

**Does it reduce to the old denominator for a pool of single-stat modifiers?** Yes,
exactly, as the spine claims. If every `g` publishes one `statId`, then `mass(g, L)` is
the plain sum of `g`'s scoped entry weights, and

```
Σ_{g ∈ sources(S)} mass(g, L)  =  Σ_{g} Σ_{e ∈ g ∩ S} e.weight  =  Σ_{e ∈ S} e.weight
```

because the groups partition `S`. That is the 3.0.0 denominator verbatim. The spine's
gloss — *"For a pool of single-stat modifiers the two readings coincide exactly, which is
why the defect survived until a producer met a hybrid row"* — is correct.

**Direction of the error is also stated correctly.** Summing the denominator over
entries inflates it by each hybrid's surplus lines, which *understates* every probability
on that base, and unevenly (proportional to the base's hybrid share), hence a reorder
rather than a shift. Both documents say this; it follows from the algebra.

**The numerator's treatment of two modifiers publishing one stat is right.** Two distinct
`g`s publishing `s` over the same cell both enter the numerator while each counts once in
the denominator — correct, since drawing *either* modifier yields the stat line, so the
marginal is the sum of the two modifiers' shares.

### A-6 — medium. The denominator has no zero guard, and rev 5 rewrote it without adding one.

`weight: 0` is explicitly legal and meaningful in the contract ("this modifier cannot roll
on this base", and it **must** be emitted for a `complete` pool). A `(base, slot)` whose
entire scoped pool is zero-weight therefore yields a denominator of 0. AD-18 handles the
*empty* pool (the contract's degraded-but-loadable list covers "a slot with an empty
pool") and handles the empty **containment set** (validation error), but not the
all-zero-denominator case, which is neither. Pre-existing since revision 2 — but the
denominator is new text in revision 5 and this is the moment to close it, with a line
saying such a base is unrankable for the same reason an empty pool is.

### A-7 — medium. A third unverifiable producer obligation now guards the denominator, and the contract still says "Two".

The contract's section **"Two obligations this file cannot prove it met"** enumerates
AD-28's pair: that the partition was cut at real tier endpoints, and that a split's
conditional distribution is right. Revision 5 adds a third of exactly the same kind, and
does not name it there:

- `sourceModifierId` is *"producer-assigned, opaque to the app, never validated against
  the trade catalogue"*, and `core` reads it for the denominator.
- **Merging** two genuinely distinct modifiers under one id shrinks the denominator and
  inflates every probability on that base.
- **Splitting** one hybrid row across two ids restores the exact double-count AD-29 was
  written to remove — and it passes every check, because the group-consistency rule is
  trivially satisfied by a group of one.

Neither failure is mechanically detectable, and the second is *more* likely than the
first, since it is what a producer gets by simply forgetting to correlate the lines of a
row. The section should become "Three obligations…" with this one stated, in the same
spirit the other two are: *"named so that a producer cannot claim surprise and a reviewer
knows where to look."* It costs nothing and it is the honest accounting.

### A-8 — high. The 2-decimal precision claim is mis-cited and under-scoped.

> "Two decimals resolve to 0.01 divine, comfortably finer than the payout threshold's
> early-endgame setting of 0.25 (AD-17), so no realistic price rounds to zero…"

The arithmetic is fine — 0.01 is 25× finer than 0.25, and the worst-case rounding error
(0.005) is 2% of the threshold. Two problems sit on either side of it.

**(a) The citation does not hold.** `0.25` occurs **nowhere** in AD-17, and nowhere else in
the spine — this Conventions row is the only occurrence of the number in the whole
document. AD-17 defines the threshold's semantics and unit and deliberately leaves its
*value* to the player. The 0.25 figure is the PRD's (FR-7); the memlog records the
resolution as such. A reader following the `(AD-17)` pointer to check the claim finds
nothing to check. Either cite the PRD, or state the figure as an assumed early-endgame
setting with its origin.

**(b) The justification covers one class of price; the rule governs all of them.** The
row says *"Persisted divine prices are numbers rounded to **2 decimal places** at the
point of normalisation"* — unqualified. But the system persists at least two other kinds
of divine-denominated number, and the threshold argument says nothing about either:

- **Craft cost inputs.** AD-20 syncs exchange rates for `data/currencies.json` and AD-22
  computes craft cost in `core` from them. Crafting currencies are worth a small fraction
  of a divine — that is the normal case, not an edge one. Any such price below 0.005
  divine persists as **0.00**, and a recipe built from them acquires a craft cost of
  zero. AD-17 subtracts that cost from every `EV`, so the error lands directly on the
  ranking, and it is invisible: a zero craft cost looks like a cheap recipe.
- **The exchange observation itself.** AD-20 requires every normalised price to record
  *"the exchange observation used (rate, source, timestamp)"*. The row does not say
  whether a persisted **rate** is subject to the same rounding. If it is, a rate of 0.005
  becomes 0.01 — a 100% normalisation error on every price converted through it. If it is
  not, that exemption has to be written down, because a contracts author reading this row
  today will apply it to every divine-denominated field they see.

**Recommendation.** Scope the rule: 2 decimal places for persisted **item** prices (where
FR-23's product argument and the threshold comparison both apply), and a separate,
explicitly finer or unrounded precision for `CurrencyRate` and for craft cost. The
"no realistic price rounds to zero" sentence is true of the first and false of the second.

### A-9 — medium. AD-16's grid claim is not true of the quantity the median is taken over.

> "it lands on the 2-decimal grid with no second rounding step, since listing prices
> already sit on it"

AD-16 states two paragraphs later that *"when a result set spans currencies the median is
taken over **normalised** values"*, and AD-20 puts normalisation at the adapter boundary
before anything is persisted. A normalised value is `listing amount × exchange rate`,
which does not sit on a 2-decimal grid for any rate that is not itself a 2-decimal number.
The claim is true only of a result set already priced in divine. It is stated
unconditionally and rests on no measurement (nothing in the memlog records the lattice of
trade listing prices, in any currency).

The median rule itself — *lower of the two middle values* — is sound and well-argued on
its other two grounds (every persisted price is a price someone actually asked; it leans
conservative with the ascending sort). Only the third ground needs qualifying, or
dropping.

### A-10 — low. The precision row's knock-on rationale is inverted.

> "Coarser rounding makes exact ties between listing prices commoner, which is part of why
> AD-16's even-sample median rule has to be stated rather than left to the implementer."

When the two middle values **tie**, the mean and the lower value are the same number, so
the two candidate implementations agree and the rule is moot. Ties make the rule *less*
load-bearing, not more. The rule is necessary precisely when the middles **differ** —
which coarser rounding makes marginally *rarer*. The rule is right and belongs in AD-16;
the reason offered for it here does not survive a second reading, and a reason that does
not hold is worse than none, because the next reviewer has to re-derive it to find out.

---

## 3. Unverified assertions in revision 5's new text

**U-1 — low/medium. AD-29's scale figures are the producer's, and "in-scope" is undefined.**
`560 of 8,437`, the 534/18/8 split, and `9,015` are recorded in the memlog as *MEASURED BY
PRODUCER 2026-09-13* — the same standing as AD-28's rev-4 figures, which this lens accepted
then and accepts now. They are internally consistent (A-1). What is missing is the
*definition of the denominator*: neither document says what made a row "in-scope" (which
item classes, which slots, which patch of poe2db). A second measurer cannot reproduce
8,437. That is the same defect the rev-3 gate fixed in AD-27, where an undefined
denominator let the same inputs score 100% or 40% — the stakes here are much lower (these
figures justify a decision rather than bind a gate), but one clause naming the scope makes
the number checkable instead of quoted.

**U-2 — low. The banded+valueless hybrid is asserted at a count and never exhibited.** Both
documents state that "eight of the measured rows pair a banded line with a flat one", and
both build a rule on it (*"a group's lines may span kinds… AD-5's per-`statId` kind rule
constrains one `statId` across the file, not one modifier across its lines"*). The only
captured row anywhere in the documents — Body Armours evasion — is two **banded** lines,
and the Shape block's `valueless` entry (`extra-bolt-t1`) is a group of one. So the one
configuration that motivates the cross-kind clause has no worked instance, in a contract
that has otherwise been careful to work its cases. If the producer's capture has one, it
is worth two lines in the contract; it is the shape a producer is most likely to emit
wrongly.

**U-3 — low. The deferred-conjunction note makes an unchecked claim about the trade API.**
AD-29's Deferred entry asserts that a conjunction's *"price is one search on both stat
filters"*. AD-16's search shape was verified against the live `/data/filters` payload, and
the rev-2 gate found **two** of AD-16's then-claims wrong against that payload — so
unchecked assertions about search construction have a poor record in this document. Stakes
are low (the item is Deferred and nothing builds on it), but it is stated as a fact in new
text with no verification behind it, and it will be read as settled when the item is picked
up.

**U-4 — low. Revision 5's own banner under-reports the Consistency Conventions, which is
the defect it was written to fix.** PRD OQ-15 was resolved by correcting the rev-3 and
rev-4 banners for exactly this. The rev-5 banner names the precision change but not the two
other Conventions rows this revision edited: **Ids** (the new `sourceModifierId` exception,
a substantive carve-out from "internal ids are forbidden") and **Bands** (non-overlap now
scoped by `sourceModifierId` as well as `itemLevelMin`). Both are things a downstream
reader would want to re-read. The AD list itself is accurate — AD-5, AD-6, AD-9, AD-11,
AD-16, AD-17, AD-18, AD-28 all carry amended text and AD-29 is new, as claimed.

**U-5 — low, pre-existing. The Shape block is a file the contract would refuse.** The
example declares `cohortTotals` of 850 (ilvl 60) and 620 (ilvl 65) for
`explicit.stat_1509134228`, while emitting exactly one cell in each of those cohorts, at
weight 40 and 110. Under the hard error *"a cohort whose emitted cells do not sum to its
declared total"*, the canonical example is an invalid file; likewise `poolCoverage:
"complete"` over five entries. It is obviously abridged — but the abridgement is not
declared, and this is the block a producer will copy. One comment (`// abridged: further
cells elided`) fixes it. Carried from 3.0.0, unchanged by revision 5.

### Checked and found sound (recorded so they are not re-litigated)

- AD-17's `coOccur` branch is ordered correctly in the `slotOverlap` cascade — the
  co-occurrence case is tested **before** the `statId != statId → false` short-circuit it
  exists to defeat. Written the other way round it would be unreachable.
- `coOccur`'s spelling in the spine ("some `sourceModifierId` in the scoped pool emits an
  entry contained by `x` **and** an entry contained by `y` in the same item-level cohort")
  is a tighter and better definition than the memlog's "the bands are jointly satisfiable",
  and reuses AD-18's containment rather than inventing a second notion.
- Assigning `coOccur` to `core` at load, as a cross-file check, is consistent with the
  straddle rule, edge-alignment, and AD-6's owner-holds-both-sides pattern.
- `AGENT-WORKFLOW.md` has absorbed revision 5: the build-order note names `4.0.0`, the
  required `sourceModifierId`, the denominator-over-modifiers rule and the `slotOverlap`
  co-occurrence branch, and places both in `core` rather than `contracts`. No stale
  rev-4 statement found.
- AD-29's `(baseTypeId, slot)` stability scope for `sourceModifierId` matches the scope
  AD-18 computes the denominator over. No cross-base id comparison is ever required.

---

## Summary of required action

| # | Severity | Item |
| --- | --- | --- |
| A-4 | **critical** | Cohort-carriage bound keyed by `sourceModifierId` can never fire; AD-28's only defence against a coarse partition is gone, and prose/error-list now disagree. Revert the key to `(base, slot, statId)`. |
| A-8 | high | 2dp precision: `(AD-17)` cites a figure AD-17 does not carry, and the rule as written zeroes craft costs and possibly exchange rates. Scope it to item prices. |
| V-2 | high | `CLAUDE.md` says Mantine v8, Stack pins 9.6.1, memlog's rationale is v9-specific. Reconcile; `CLAUDE.md` is what agents read first. |
| A-2 | medium | Group-consistency worked example is vacuous on the check it illustrates; add a decomposed line. |
| A-6 | medium | No zero-denominator guard for an all-`weight: 0` scoped pool. |
| A-7 | medium | `sourceModifierId` correctness is a third unverifiable producer obligation guarding the denominator; the contract still says "Two". |
| A-9 | medium | AD-16's "listing prices already sit on the 2-decimal grid" is untrue of normalised values. |
| V-1, A-1a, A-10, U-1…U-5 | low | Zod 4.6.4; bucket-axis wording; inverted tie rationale; undefined "in-scope"; unexhibited cross-kind group; unchecked conjunction-search claim; banner omits two Conventions rows; Shape block is an invalid file. |
