---
lens: verification
target: ARCHITECTURE-SPINE.md (revision 6) + WEIGHTS-FILE-SCHEMA.md 4.0.0
date: 2026-09-13
verdict: issues
---

# Verification review — revision 6

**Verdict: ISSUES.** The stack is clean — 12 of 12 pins exact-current, both TypeScript-7 blockers re-confirmed unmoved against the live npm registry. Every internal count re-checks. The nine-cell worked partition is still internally consistent and revision 6 did not disturb it.

The problems are all in the new IEEE-754 material, and one of them is exactly the class this lens exists to catch: **a numeric literal quoted to an external producer that is false.** Three of the four arithmetic claims pass. The fourth — the worked `850` split — is wrong as written, though the general claim it is illustrating is right. Two further float findings sit behind it.

Method: every floating-point claim was executed rather than reasoned about, in CPython (IEEE-754 binary64, identical semantics to JSON/JS doubles). Scripts in the session scratchpad; measured values are quoted below.

---

## 1. The IEEE-754 arithmetic claims

### Claim A — a lattice of integers or half-integers is exactly representable → edges compare equal with no tolerance

**PASS.**

Sites: `ARCHITECTURE-SPINE.md:567` (AD-28), `:606` (Consistency Conventions), `:778` (Deferred); `WEIGHTS-FILE-SCHEMA.md:380`.

Measured:

- Half-integer lattice `0 … 200000` step `0.5`, 400,001 points: **0 exact-roundtrip failures**.
- The same lattice point constructed three independent ways (`i*0.5`, `i/2.0`, integer part plus `0.5`), 100,001 points: **0 disagreements**. This is the property the claim actually needs — not merely that the value is representable, but that two producers reaching it by different arithmetic land on the same double.
- Spot checks of the partition's own edges: `56.5` = `0x1.c400000000000p+5`, exact; `43.0`, `78.5`, `80.5`, `101.5` likewise.

The reasoning is sound in general, not just empirically: a half-integer is `k/2`, and any binary64 with a power-of-two denominator and a numerator under 2^53 is exact. The relevant bound is 2^53 ≈ 9.0e15, which the trade API's damage values miss by eleven orders of magnitude.

The load-bearing half of the claim — that an epsilon here would readmit the straddle — also holds. It is not a float fact but a design fact, and the spine states it correctly: an edge that misses by a hair is a mis-cut cell, not a rounding artefact, so softening the comparison hides the defect the partition exists to remove.

### Claim B — `850` split into `283.33 + 283.33 + 283.34` sums to `849.9999999999999`

**FAIL — the literal is wrong.** The general claim it illustrates is correct; only this worked number is false.

Site: `WEIGHTS-FILE-SCHEMA.md:394`.

Measured:

```
283.33 + 283.33 + 283.34  ->  850.0        (== 850.0 is True)
all three distinct orderings              ->  850.0
math.fsum / builtin sum                   ->  850.0
```

The double sum is **exactly `850.0`**, in every summation order. The contract says this file "is refused". It would load.

Why it lands on 850. The three doubles' infinite-precision sum is `849.9999999999999431565811391`. The ulp near 850 is `1.1368683772161603e-13`, so the neighbouring doubles are `850.0` and `849.99999999999988631…` — and the true sum sits just above their midpoint, so the final addition rounds **up** to `850.0`. The quoted literal `849.9999999999999` is that lower neighbour: a plausible value, reached by assuming the error accumulates downward, but not the one this arithmetic produces.

**The underlying claim is nonetheless true, and easy to demonstrate honestly.** Scanning all 84,999 two-decimal three-way splits of `850`:

- **13,120 of 84,999 fail exact equality** — about 15%.
- A verified replacement literal: `174.2 + 337.9 + 337.9` → **`849.9999999999999`**, the exact string the contract already wants to print.
- Its neighbour in the other direction, if a symmetric example is wanted: `174.3 + 337.85 + 337.85` → `850.0000000000001`.

**Recommended fix, minimal:** at `WEIGHTS-FILE-SCHEMA.md:394`, replace the three summands with `174.2`, `337.9`, `337.9`. Nothing else in the sentence changes and no decision moves — the producer obligation, both discharge routes, and the Deferred epsilon all rest on the general fact, which survives intact.

**Severity: HIGH, not critical.** No architectural decision is wrong; the ruling is correct. But this is a contract quoted verbatim to an external producer team already building to `4.0.0`, and a producer that tests the stated example will find it passes and may reasonably conclude the obligation is theoretical. A worked example in a contract is load-bearing precisely because it is the part a reader executes.

*Aside on the sentence around it:* `283.33` and `283.34` are indeed each inexact in binary (`283.32999999999998408…`, `283.33999999999997498…`), so the clause "most decimal fractions are not exact in binary" is right. The error is in the composition, not the premise.

### Claim C — IEEE floating-point addition is not associative

**PASS.**

Sites: `WEIGHTS-FILE-SCHEMA.md:394`; `ARCHITECTURE-SPINE.md:778`.

Measured:

- Canonical: `(1e16 + -1e16) + 1.0 = 1.0`, `1e16 + (-1e16 + 1.0) = 0.0`. Not equal.
- In-range, no cancellation: `(0.1 + 0.2) + 0.3 = 0.6000000000000001`, `0.1 + (0.2 + 0.3) = 0.6`. Not equal.
- At the contract's own scale — 200,000 random six-cell lists of two-decimal weights in `[0, 1000]`, summed forward vs. reversed: **86,505 of 200,000 (43%) gave different totals.**

The last figure is the one that matters. This is not an exotic-magnitude phenomenon requiring catastrophic cancellation; it is the common case for exactly the data this contract carries. The spine's characterisation at `:394` — "a producer that verifies its own total in its own order can still disagree with `core`'s" — is measured-true, not merely defensible.

### Claim D(a) — emitting values exact in binary (integers, or power-of-two denominators) makes any summation order agree

**PASS at the contract's scale, with one caveat worth a clause.**

Site: `WEIGHTS-FILE-SCHEMA.md:398`.

Measured:

- 200,000 lists of 8 values drawn as `integer + {0, .125, .25, .5, .75}` with integer parts up to 1e6, each shuffled 5 ways: **0 order-dependent sums.**
- 100,000 lists of up to 500 integer weights ≤ 1e6 (realistic spawn-weight shape), forward vs. reversed: **0 order-dependent sums.**

**Caveat.** The property is not unconditional — it holds while every *partial sum* stays exactly representable, which fails once magnitudes span the 2^53 window. Stressed over `2^-4 … 2^60`: **5,663 of 300,000 lists were order-dependent.** For spawn weights this is unreachable by roughly eleven orders of magnitude, so the contract's advice is sound as given. If a sentence is ever added, it should say *exact in binary and bounded*, not *exact in binary*. **Severity: LOW** — noted so a later reader does not generalise the rule past its range.

### Claim D(b) — letting the last cell absorb the residue, summed in the file's own entry order, yields a total that compares equal

**PASS as stated — and the qualifier "in the file's own entry order" is doing all the work.**

Site: `WEIGHTS-FILE-SCHEMA.md:399`.

Measured, 200,000 trials (2–12 cells, totals `1 … 100000`, per-cell rounding at 2/4/6 dp, residue `total − acc` assigned to the last cell):

- Summed back **in the same entry order: 0 failures out of 200,000.**
- The identical lists summed in **reverse order: 6,359 failures out of 20,000 (32%).**

The success is provable, not lucky. Once the accumulated sum `acc` is within a factor of two of `total`, Sterbenz's lemma makes `fl(total − acc)` exact, so the residue is the true remainder and `fl(acc + r) = total` exactly. Confirmed: 500,000 trials with `acc` within ±30% of `total` gave **0 failures**; widening `acc` to `0.01×…100×` gave **186,659 of 200,000 failures**, which is the lemma's precondition failing, not the route failing.

**But this exposes a real gap — see finding 2 below.** The route is only sound if `core` sums in the same order the producer did, and nothing in the spine or the contract binds `core` to any order.

---

## 2. Findings beyond the four claims

### V-1 (HIGH) — the worked `850` literal is false

Covered under Claim B. `WEIGHTS-FILE-SCHEMA.md:394`. Fix: `174.2 + 337.9 + 337.9`.

### V-2 (HIGH) — discharge route (b) depends on a summation order nothing commits `core` to

`WEIGHTS-FILE-SCHEMA.md:399` instructs the producer to "sum in double precision in the **file's own entry order**, and let the last cell … absorb the residue". That makes a file's validity contingent on `core` iterating the entries in serialised array order.

Nothing states that it must. Grepping the spine and the contract for a summation-order commitment returns only this producer-side line. `ARCHITECTURE-SPINE.md:555` says `core` "sums the parsed numbers and tests equality" — silent on order. A `core` author is free to group by `statId`, sort by `itemLevelMin`, reduce over a `Map`'s iteration order, or parallelise — every one of which is a defensible implementation and, per the 32% reverse-order failure rate above, any of which breaks route (b) for roughly a third of conforming files.

This is the same shape as the defects earlier gates caught on this project: two components each holding a reading that is locally reasonable, with no document naming which one governs. It is cheap to close — one sentence in AD-28 or the Consistency Conventions binding `core` to sum cohort and group totals **in the artifact's entry order, left to right, with no reassociation and no compensated summation**. Worth noting that `math.fsum`-style compensated summation, normally the *right* answer, is here the *wrong* one: it would compute the correctly-rounded total and reject files that route (b) deliberately tuned to the naive one.

The residual-risk paragraph at `:399` anticipates a producer taking "neither route" and being refused. It does not anticipate a producer taking route (b) correctly and being refused anyway because `core` iterated differently. The memlog's own recorded concern (rev-6 entry on Candidate 1) names non-associativity as the residual risk but stops one step short of this consequence.

### V-3 (MEDIUM) — the contract assigns `core` a check `core` cannot perform, and the count of exact rules disagrees across documents

`WEIGHTS-FILE-SCHEMA.md:392`: *"**Three** rules in this contract are exact comparisons, and `core` applies them with no tolerance"* — then lists (i) cells sum to `cohortTotals`, (ii) a group's per-`statId` sums agree, (iii) **a tier's split across the cells it reaches must sum to that tier's weight**.

`core` cannot evaluate (iii). The rev-4 gate fix (memlog, `A-2`) introduced `cohortTotals` precisely *because* `core` never sees tier weights — that is the stated reason the field exists. Tier weight `w(t)` is producer-side data that does not appear in the file. Rule (iii) is a genuine obligation, but it is the producer's, and `:392` attributes it to `core` alongside two checks `core` really does run.

The knock-on is a count that does not agree with itself:

| Location | Says | Counting |
| --- | --- | --- |
| `WEIGHTS-FILE-SCHEMA.md:392` | "Three rules … `core` applies them" | three sums, one of them not `core`'s |
| `WEIGHTS-FILE-SCHEMA.md:399` | "these **two** sum checks" | the two `core` actually runs |
| `ARCHITECTURE-SPINE.md:27` | "its **three** exact comparisons" | edges + two sums |
| `ARCHITECTURE-SPINE.md:555` | "here and in AD-29's group-consistency check" | the two `core` runs |
| `ARCHITECTURE-SPINE.md:778` | "the **two** weights-file sum rules" | the two `core` runs |

Two different threes and a two, across two documents, one paragraph apart in places. The substance is consistent everywhere else and no decision turns on it — but `:392` is the paragraph a `contracts` author reads to decide what to implement, and it currently says `core` must verify a quantity the file does not carry. Recommend: at `:392`, state two rules as `core`'s and carry the tier-split conservation separately as the producer obligation it is (the contract already states it correctly at `:141–146`, under *Mass conservation is the invariant*).

### V-4 (LOW) — "exact in binary" should read "exact in binary and bounded"

Covered under Claim D(a). `WEIGHTS-FILE-SCHEMA.md:398`.

---

## 3. Arithmetic and internal figures

**All PASS.** Re-computed rather than re-read.

| Figure | Sites | Check | Result |
| --- | --- | --- | --- |
| 560 in-scope multi-stat rows | spine `:575`, schema `:22` | 534 + 18 + 8 | **560** ✓ |
| 8,437 → 9,015 stat-line units | spine `:575`, schema `:22` | 8,437 + 578 | **9,015** ✓ |
| the 578 itself | implied, stated nowhere | 534 two-stat rows contribute +1 line each (534); 18 three-stat rows +2 each (36); 8 mixed rows +1 each (8) → 534 + 36 + 8 | **578** ✓ |

The third row is the one worth stating explicitly: `578` is never written down, only the endpoints `8,437` and `9,015`. It reconciles exactly under the stated composition (the 8 "one number plus a flat line" rows being two-line rows), which is a genuine independent confirmation of the producer's measurement rather than a restatement of it. Unchanged from revision 5's finding; revision 6 touched none of these figures.

### The nine-cell worked partition (AD-28, `WEIGHTS-FILE-SCHEMA.md:110–146`)

**Still internally consistent. Revision 6 did not disturb it** — `git diff` shows no change in that region, and every property re-verifies cell by cell:

- **Cell count: 9.** ✓
- **Contiguity:** every cell opens exactly one half-integer lattice step (`0.5`) above its predecessor's close — **no gaps, no overlaps.** ✓
- **Span:** `32.0 → 123.0`, exactly the union of the five tier ranges. ✓
- **Cut points:** the distinct tier endpoints are `{32.0, 43.0, 56.0, 56.5, 79.0, 80.0, 101.5, 103.0, 123.0}` — nine endpoints, and the partition cuts at every one. ✓
- **Carriage:** five cells carried by one tier, four by exactly two. None by three, so the "at most two cohorts" hard-error rule is satisfied and the stated assumption (no three tiers overlap) holds on this data. ✓

| Cell | Tiers | Cohorts (`itemLevelMin`) |
| --- | --- | --- |
| `[32, 42.5]` | T6 | 54 |
| `[43, 43]` | T6, T7 | 54, 60 |
| `[43.5, 55.5]` | T7 | 60 |
| `[56, 56.5]` | T7, T8 | 60, 65 |
| `[57, 78.5]` | T8 | 65 |
| `[79, 80]` | T8, T9 | 65, 75 |
| `[80.5, 101]` | T9 | 75 |
| `[101.5, 103]` | T9, T10 | 75, 81 |
| `[103.5, 123]` | T10 | 81 |

The four shared cells and their cohort pairs match the contract's table at `:128–134` character for character. The one-point cell `[43, 43]` is correct and correctly justified: T6 closes at `43.0` and T7 opens at `43.0`, and both edges are exact doubles (Claim A), so the single-point overlap is real and detectable rather than a rounding artefact — which is the fact the rev-4 gate fix turned on and it still holds.

---

## 4. Stack pins

**12 of 12 exact-current. Nothing moved since the revision-5 review.** All figures re-fetched from the live npm registry and `nodejs.org/dist/index.json` on 2026-09-13; none carried over.

| Pin | Spine | Registry `latest` | |
| --- | --- | --- | --- |
| Node.js | 24.21.0 (Krypton LTS) | 24.21.0, codename **Krypton**, `lts: true` | ✓ |
| TypeScript | 6.0.3 | 6.0.3 is the newest published 6.0.x (`6.0.4` → HTTP 404); `latest` = 7.0.2, held back deliberately — see blockers | ✓ |
| pnpm | 12.4.1 | 12.4.1 | ✓ |
| React | 19.3.0 | 19.3.0 | ✓ |
| Vite | 8.3.0 | 8.3.0 | ✓ |
| `@mantine/core` / `@mantine/hooks` | 9.6.1 | 9.6.1 / 9.6.1 | ✓ |
| Zod | 4.6.4 | 4.6.4 | ✓ |
| Vitest | 5.0.0 | 5.0.0 | ✓ |
| MSW | 2.15.0 | 2.15.0 | ✓ |
| ESLint | 10.10.0 | 10.10.0 | ✓ |
| typescript-eslint | 8.70.0 | 8.70.0 | ✓ |
| dependency-cruiser | 18.2.0 | 18.2.0 | ✓ |

Zod, which moved on each of the three preceding revisions (4.6.2 → 4.6.3 → 4.6.4), is **stable at 4.6.4** this run. Revision 5's review reported "11 of 12 exact-current" because it counted the TypeScript pin as off-`latest`; on the reading that matters — is the pin the newest release of the line the spine deliberately holds — it is 12 of 12, and `6.0.4` returning 404 is what establishes that.

### TypeScript-7 blockers — both re-confirmed, both unmoved

| Blocker | Re-verified 2026-09-13 | Status |
| --- | --- | --- |
| `typescript-eslint` | `latest` 8.70.0 and canary 8.70.1-alpha.0 both declare `peerDependencies.typescript: ">=4.8.4 <6.1.0"`. `dist-tags` are `{rc-v8, canary, latest}` — **there is no 9.x, `next`, or RC line**, so no published artifact accepts TS 7. | **unmoved** |
| `dependency-cruiser` 18.2.0 | still declares `supportedTranspilers.typescript: ">=2.0.0 <7.0.0"`; 18.2.0 *is* the current `latest` (only `18.2.0-beta-2` beyond it). | **unmoved** |

One note on a memlog claim rather than a spine claim. The rev-1 entry records the user's report that TS 7 support is in a typescript-eslint RC (issue #10940). The registry shows `rc-v8` pointing at `8.0.0-alpha.62` — an old v8 release candidate, not a TS-7 line — and no tag carrying a widened peer range. The spine's Stack section does not repeat the RC claim, stating only the measured peer caps, so nothing needs correcting; recorded so the upgrade trigger is not read as closer than it is.

### Named technologies — all still exist and still fit

Node 24 LTS, React 19, Vite 8, Vitest 5, MSW 2, Zod 4, Mantine 9, pnpm workspaces, dependency-cruiser and GitHub Pages via an Actions build workflow are all live, maintained projects at the pinned versions, and each is used for what it is for. No abandoned or renamed dependency in the set. The one architectural dependency that remains **unsupported surface rather than out-of-date** is GGG's `trade2`, and AD-8 already records that at length with the right framing — this lens has nothing to add to it.

---

## 5. What was checked and found sound

Recorded so a later run does not re-litigate it:

- Revision 6 amends AD-18, AD-28 and AD-29 in place and adds no AD — confirmed against the memlog's rev-6 entries and against `git diff`. The banner at `:31` reports this correctly, which is the failure OQ-15 existed to close.
- AD-29's `mass(g, L)` → `mass(g)` correction is applied at the spine's AD-29, and AD-18 at `:360–363` already wrote `mass(g)` with the "carries no `L`" reasoning. The two now agree, and the reasoning is right: a source row is one tier, therefore one cohort, therefore admitted by the scope whole or not at all.
- The C-53 correction checks out against the amended text rather than against inference: AD-17 (`:307`) names exactly two cases where `coOccur` cannot be answered — a base absent from `weights.json`, and a `partial` pool. The uniform-prior bootstrap is not a third: contract `4.0.0` requires `sourceModifierId` on every entry regardless of provenance, and the bootstrap section requires genuine pool membership, cell edges and `itemLevelMin`. A bootstrap file answers `coOccur` normally and its bases rank.
- The weights contract is unchanged at `4.0.0` and gains only clarifying prose — verified by diff; no field added, removed or retyped. The revision-6 claim not to have broken an external producer already building to `4.0.0` holds. (V-1 and V-3 are corrections *within* that prose and break nothing.)

---

## 6. Recommended actions

| # | Severity | Action | Location |
| --- | --- | --- | --- |
| V-1 | HIGH | Replace the false worked split with the verified one: `174.2 + 337.9 + 337.9` → `849.9999999999999`. The surrounding sentence stands. | `WEIGHTS-FILE-SCHEMA.md:394` |
| V-2 | HIGH | Bind `core` to sum cohort and group totals in the artifact's entry order, left to right, no reassociation, no compensated summation — otherwise route (b) is unsound and ~32% of files tuned to it are refused. | AD-28 or Consistency Conventions |
| V-3 | MEDIUM | State **two** exact rules as `core`'s at `:392`; move the tier-split conservation to the producer obligation it already is elsewhere in the file. Reconcile the three/two counts across both documents. | `WEIGHTS-FILE-SCHEMA.md:392`, `:399` |
| V-4 | LOW | "exact in binary" → "exact in binary and bounded well inside 2^53". | `WEIGHTS-FILE-SCHEMA.md:398` |

None of the four changes any decision. V-1 and V-2 are both worth applying before the producer builds further against `4.0.0`: the first because it is a number an external team will execute, the second because it determines whether correctly-produced files load.
