---
title: 'Review rev4 — Verification lens'
lens: verification
date: '2026-09-13'
targets:
  - ARCHITECTURE-SPINE.md (revision 4)
  - WEIGHTS-FILE-SCHEMA.md (3.0.0)
---

# Verification review — revision 4

Facts only. Each claim is marked **CONFIRMED**, **WRONG** or **UNVERIFIABLE**, with a
file:line citation. Judgment calls are out of scope for this lens.

Source tier data used throughout (as supplied with the review task and as printed at
`WEIGHTS-FILE-SCHEMA.md:84-90`):

| Tier | ilvl | Value range (average of two rolls) |
| --- | --- | --- |
| T6 | 54 | 32.0 – 43.0 |
| T7 | 60 | 43.0 – 56.5 |
| T8 | 65 | 56.0 – 80.0 |
| T9 | 75 | 79.0 – 103.0 |
| T10 | 81 | 101.5 – 123.0 |

All ranges are **closed** intervals on a **half-integer** lattice (`WEIGHTS-FILE-SCHEMA.md:62`,
`ARCHITECTURE-SPINE.md:506`). Arithmetic below was computed exactly with `fractions.Fraction`
over the lattice, not by eye.

---

## 1. Arithmetic and worked examples

### V-1 — Scope correction: the cell list appears in ONE document, not two — CONFIRMED (premise adjusted)

The eight-cell list is stated only at `WEIGHTS-FILE-SCHEMA.md:92`. The spine's AD-28
(`ARCHITECTURE-SPINE.md:480-506`) states the *rule* that generates a partition
(`ARCHITECTURE-SPINE.md:492`: "cuts the value axis at **every** tier endpoint in the family")
and gives only the T7/T8 fragment of the data (`ARCHITECTURE-SPINE.md:486`), never the cell list.

This matters for the findings below: the spine's **rule** is correct; the contract's **worked
example** does not satisfy it. The defect is confined to the contract, and the fix does not
require amending AD-28.

### V-2 — The claimed partition tiles the covered range with no gaps and no overlaps — CONFIRMED

`WEIGHTS-FILE-SCHEMA.md:92`. Checked edge-by-edge on the 0.5 lattice:

```
[32,42.5] 42.5+0.5=43 -> [43,55.5] +0.5=56 -> [56,56.5] +0.5=57 -> [57,78.5]
+0.5=79 -> [79,80] +0.5=80.5 -> [80.5,101] +0.5=101.5 -> [101.5,103] +0.5=103.5 -> [103.5,123]
```

Every cell is non-empty, every edge is on the half-integer lattice, consecutive cells abut
exactly one lattice step apart, and the union is exactly `[32,123]` — the full covered range
(T6's floor through T10's ceiling). No gaps, no overlaps. **CONFIRMED.**

### V-3 — "Every tier endpoint is respected" / no tier's range is split incorrectly — **WRONG**

`WEIGHTS-FILE-SCHEMA.md:92`, against the rule at `ARCHITECTURE-SPINE.md:492` and
`WEIGHTS-FILE-SCHEMA.md:70`.

A cell must be **wholly inside or wholly outside** every tier's range, otherwise the axis was
not cut at every tier endpoint. Exactly one claimed cell fails:

> **`[43,55.5]` straddles T6.** T6 is closed at 43.0, so the lattice point `43` lies in **both**
> T6 (its maximum) and T7 (its minimum). The claimed cell merges that shared point with the
> T7-only run `[43.5,55.5]`.

T6's upper endpoint 43.0 is therefore *not* used as a cut. Every other tier endpoint
(32, 56, 56.5, 79, 80, 101.5, 103, 123) is respected.

**Corrected partition — nine cells, not eight:**

```
[32,42.5]  [43,43]  [43.5,55.5]  [56,56.5]  [57,78.5]  [79,80]  [80.5,101]  [101.5,103]  [103.5,123]
```

with tier membership:

| Cell | Tiers reaching it | Cohorts (`itemLevelMin`) |
| --- | --- | --- |
| `[32,42.5]` | T6 | 54 |
| `[43,43]` | T6, T7 | 54, 60 |
| `[43.5,55.5]` | T7 | 60 |
| `[56,56.5]` | T7, T8 | 60, 65 |
| `[57,78.5]` | T8 | 65 |
| `[79,80]` | T8, T9 | 65, 75 |
| `[80.5,101]` | T9 | 75 |
| `[101.5,103]` | T9, T10 | 75, 81 |
| `[103.5,123]` | T10 | 81 |

Note the inconsistency this exposes inside the document itself: the same situation at the
T8/T9 boundary (overlap `79–80`, three lattice points) and at the T9/T10 boundary (overlap
`101.5–103`, four lattice points) **was** cut out as its own cell. Only the T6/T7 boundary —
where the overlap is a single lattice point — was merged away. The treatment is not uniform,
which is what makes this an error rather than a stated convention.

**Corrected text for `WEIGHTS-FILE-SCHEMA.md:92`, first sentence:**

> The endpoints cut the axis into cells `[32,42.5] [43,43] [43.5,55.5] [56,56.5] [57,78.5]
> [79,80] [80.5,101] [101.5,103] [103.5,123]`.

### V-4 — "Cell `[56,56.5]` is the one emitted twice" — **WRONG**

`WEIGHTS-FILE-SCHEMA.md:92`. Three other cells are also emitted under more than one
`itemLevelMin`, because every tier here occupies its own cohort (54/60/65/75/81 are all
distinct) and four pairs of adjacent tiers overlap in value space:

| Cell | Emitted at `itemLevelMin` | Carrying |
| --- | --- | --- |
| `[43,43]` | 60 **and** 54 | T7's mass and T6's |
| `[56,56.5]` | 60 **and** 65 | T7's mass and T8's — the cell the document names |
| `[79,80]` | 65 **and** 75 | T8's mass and T9's |
| `[101.5,103]` | 75 **and** 81 | T9's mass and T10's |

So **four** cells are emitted twice under the corrected partition. The claim is wrong even on
the document's own eight-cell list: there, `[43,55.5]` draws mass from T6 (cohort 54) *and* T7
(cohort 60), so that list yields four doubly-emitted cells as well — `[43,55.5]`, `[56,56.5]`,
`[79,80]`, `[101.5,103]`.

The substantive point the sentence is making ("the same interval, two cohorts, summed only
after `core` scopes to the tracked entry's floor") is sound and is unaffected. Only the
uniqueness — "**the** one emitted twice" — is false, and it understates by three how routine
the double emission is. The corresponding non-overlap carve-out
(`WEIGHTS-FILE-SCHEMA.md:199`, `WEIGHTS-FILE-SCHEMA.md:215`, `ARCHITECTURE-SPINE.md:312`,
`ARCHITECTURE-SPINE.md:502`) is therefore load-bearing at every tier boundary in a family,
not at one.

**Corrected text for `WEIGHTS-FILE-SCHEMA.md:92`, second sentence:**

> Cell `[56,56.5]` is emitted twice — once at `itemLevelMin: 60` carrying T7's mass there, once
> at `itemLevelMin: 65` carrying T8's. So are `[43,43]` (ilvl 54 and 60), `[79,80]` (65 and 75)
> and `[101.5,103]` (75 and 81) — one shared cell per adjacent-tier overlap.

### V-5 — Cell edges lie on the half-integer lattice — CONFIRMED

`WEIGHTS-FILE-SCHEMA.md:62`, `ARCHITECTURE-SPINE.md:506`. All eight claimed edges pairs
(and all nine corrected ones) are integer multiples of 0.5. The stated inference at
`WEIGHTS-FILE-SCHEMA.md:60` — that a half-integer edge such as 56.5 can only arise from
averaging two integers — is arithmetically sound as an *inference about averaging*; whether the
trade filter in fact compares the average remains an Open Question with a named owner
(`ARCHITECTURE-SPINE.md:703`) and is **UNVERIFIABLE** here.

### V-6 — "A reference over `[56, 80]` includes T7 rolls that averaged 56.0–56.5" — CONFIRMED

`WEIGHTS-FILE-SCHEMA.md:110`. Under either partition, `[56,80]` contains exactly the cells
`[56,56.5] [57,78.5] [79,80]`; its containment set's minimum edge is 56 and maximum edge is 80,
so it is edge-aligned per AD-18 (`ARCHITECTURE-SPINE.md:305-308`), and `[56,56.5]` carries T7
mass at cohort 60. The example holds.

Worth recording as a consequence of V-3 that the correction does **not** break: a reference
intended to cover T7, `[43,56.5]`, is still cell-aligned under the nine-cell partition
(`[43,43] + [43.5,55.5] + [56,56.5]`, min edge 43, max edge 56.5). Splitting `[43,55.5]`
adds an available cut point; it removes none.

### V-7 — "T7 (ilvl 60) runs 43.0–56.5 while T8 (ilvl 65) opens at 56.0" — CONFIRMED

`ARCHITECTURE-SPINE.md:486`, matching `WEIGHTS-FILE-SCHEMA.md:87-88`. Consistent, and it is a
genuine strict overlap (`56.0`, `56.5` are reachable by both tiers).

### V-8 — "53 of 63 item classes", "up to 36% of a weapon class's pool", "170–1,250 overlapping tier pairs" — UNVERIFIABLE

`ARCHITECTURE-SPINE.md:25`, `ARCHITECTURE-SPINE.md:486`, `WEIGHTS-FILE-SCHEMA.md:20`. These are
the producer's own measurements against data not present in this repository. They are
internally consistent between the two documents (same figures, same wording) and consistent
with the one worked family shown, but nothing here can independently confirm them.

---

## 2. Mass conservation and the split estimator

### V-9 — `Σ { w(t) × P(value ∈ c | t) : c ∈ cells } == w(t)` is self-consistent — CONFIRMED

`WEIGHTS-FILE-SCHEMA.md:96-100`, `ARCHITECTURE-SPINE.md:497`. The identity reduces to
`Σ_c P(value ∈ c | t) == 1`, which holds exactly when the cells are pairwise disjoint and
their union covers the whole support of tier `t`. V-2 establishes both for the claimed
partition, and the corrected nine-cell partition of V-3 is a strict refinement of it — refining
a partition preserves disjointness and coverage, so conservation holds under **both**. The V-3
error does not disturb this claim.

### V-10 — Summing the emitted entries reproduces the original tier weights — CONFIRMED

`ARCHITECTURE-SPINE.md:494-498`, `WEIGHTS-FILE-SCHEMA.md:72-78`. Step 2 groups the family's
tiers into cohorts by `itemLevelMin`, so the cohorts **partition** the tier set — each tier
belongs to exactly one `tiers(ℓ)`. Therefore

```
Σ_ℓ Σ_c weight(ℓ, c)  =  Σ_ℓ Σ_c Σ_{t ∈ tiers(ℓ)} w(t) × P(value ∈ c | t)
                      =  Σ_t w(t) × Σ_c P(value ∈ c | t)
                      =  Σ_t w(t)                                    [by V-9]
```

The total emitted weight equals the total original tier weight exactly, and per-tier
conservation holds term by term. The interchange of summation is valid — all terms are
non-negative and the sums are finite.

In this family the cohorts are singletons (one tier each), so `weight(ℓ, c)` reduces to
`w(t) × P(value ∈ c | t)` for the single tier `t` at level `ℓ`. The general formula is still
needed: two tiers of one family sharing an `itemLevelMin` is not excluded by anything in
either document.

### V-11 — "Cells a cohort cannot reach are simply not emitted" is consistent with conservation — CONFIRMED

`WEIGHTS-FILE-SCHEMA.md:80`, `WEIGHTS-FILE-SCHEMA.md:202`, `ARCHITECTURE-SPINE.md:494`. An
unreached cell contributes `P = 0`, so omitting it removes a zero term and leaves every sum in
V-9 and V-10 unchanged. The distinction drawn against an explicit `weight: 0` entry is a
semantic one, not an arithmetic one, and the arithmetic is indifferent to it.

### V-12 — The recommended estimator is a probability distribution over the cells — CONFIRMED, with one recorded gap

`WEIGHTS-FILE-SCHEMA.md:104`, `ARCHITECTURE-SPINE.md:500`. Counting the `(A, B)` integer pairs
of tier `t` whose derived value falls in `c`, divided by the total pair count, is by
construction a normalised distribution over any partition covering all attainable derived
values — so it conserves mass exactly, as claimed, for any conserving partition including both
the eight- and nine-cell ones.

**UNVERIFIABLE as a numeric check:** the underlying per-tier integer ranges for `A` and `B` are
not published in either document — only the averaged ranges are (`WEIGHTS-FILE-SCHEMA.md:84-90`),
and `(a₁+b₁)/2 = 32`, `(a₂+b₂)/2 = 43` does not determine `a`, `b`. No worked numeric split is
asserted anywhere, so there is no number to check; the `weight: 40` / `weight: 110` figures in
the shape example (`WEIGHTS-FILE-SCHEMA.md:157`, `WEIGHTS-FILE-SCHEMA.md:167`) are illustrative
and carry no arithmetic claim. The estimator's *structure* is confirmed; its *outputs* cannot be
checked from this repository.

One coverage caveat, recorded rather than raised as an error: the estimator presumes every
attainable derived value falls inside some cell. That is guaranteed only because the cut points
are the tier endpoints themselves, which by definition bound each tier's attainable values.
Both documents state the cut that way (`ARCHITECTURE-SPINE.md:492`,
`WEIGHTS-FILE-SCHEMA.md:70`), so the premise holds.

---

## 3. Stack versions, re-checked 2026-09-13

Method: npm registry `dist-tags` and `/latest` documents, and the `nodejs.org/dist` directory
listing, fetched today. Spine table at `ARCHITECTURE-SPINE.md:532-546`.

| Name | Spine says | Registry today (2026-09-13) | Status |
| --- | --- | --- | --- |
| Node.js | 24.21.0 (Krypton LTS) | `nodejs.org/dist/latest-v24.x/` → v24.21.0 | CONFIRMED (`:534`) |
| TypeScript | 6.0.3 | 6.0.3 exists; 6.0.4 is **404** — 6.0.3 is the top of the 6.x line | CONFIRMED (`:535`) |
| pnpm | 12.4.1 | `latest` 12.4.1 | CONFIRMED (`:536`) |
| React | 19.3.0 | `latest` 19.3.0 | CONFIRMED (`:537`) |
| Vite | 8.3.0 | `latest` 8.3.0 | CONFIRMED (`:538`) |
| Mantine core / hooks | 9.6.1 | both `latest` 9.6.1 | CONFIRMED (`:539`) |
| Zod | 4.6.2 | `latest` **4.6.3** | **MOVED** (`:540`) |
| Vitest | 5.0.0 | `latest` 5.0.0 | CONFIRMED (`:541`) |
| MSW | 2.15.0 | `latest` 2.15.0 | CONFIRMED (`:542`) |
| ESLint | 10.10.0 | `latest` 10.10.0 | CONFIRMED (`:543`) |
| typescript-eslint | 8.70.0 | `latest` 8.70.0 | CONFIRMED (`:543`) |
| dependency-cruiser | 18.2.0 | `latest` 18.2.0 | CONFIRMED (`:544`) |

### V-13 — Zod 4.6.2 is no longer the current release — MOVED (not an error)

`ARCHITECTURE-SPINE.md:540`. `zod@4.6.3` is now `latest`; its npm staging timestamp
(`1789251828006` ≈ 2026-09-12) puts publication on or immediately after the day the table was
verified. This is a patch bump inside the pinned major, so nothing in the spine's reasoning
depends on it. Recorded so the table is not later read as having been verified today at 4.6.2.

Everything else in the table is unchanged from the 2026-09-12 verification.

### V-14 — TS 7.0.2 is current — CONFIRMED

`ARCHITECTURE-SPINE.md:548`. `typescript` dist-tags today: `latest` **7.0.2**, `rc` 7.0.1-rc,
`next` 7.1.0-dev.20260912.1, `beta` 6.0.0-beta.

### V-15 — Blocker 1: `typescript-eslint` peer-caps TypeScript at `<6.1.0` — CONFIRMED, unchanged

`ARCHITECTURE-SPINE.md:552`. `typescript-eslint@8.70.0` (still `latest`) declares
`peerDependencies.typescript: ">=4.8.4 <6.1.0"`. The canary tag is still `8.70.1-alpha.0`, exactly
as recorded yesterday, and the `rc-v8` tag is `8.0.0-alpha.62` — an older line, not a TS 7 track.
**No published line of `typescript-eslint` admits TypeScript 7.**

### V-16 — Blocker 2: `dependency-cruiser` declares `>=2.0.0 <7.0.0` — CONFIRMED, unchanged

`ARCHITECTURE-SPINE.md:553`. `dependency-cruiser@18.2.0` (still `latest`; `beta` is
18.2.0-beta-2, an older prerelease of the same version) declares
`supportedTranspilers.typescript: ">=2.0.0 <7.0.0"`. Its own devDependency on TypeScript is
`^6.0.3`, with an `upem` note stating the project intends to stay on 6 — corroborating that a
TS 7 range is not imminent.

### V-17 — "Move to TS 7 only when both publish a range including 7" — CONFIRMED as still unmet

`ARCHITECTURE-SPINE.md:555`. Neither package has published a range including TypeScript 7 as of
2026-09-13. The upgrade trigger has not fired and the table's TypeScript 6.0.3 pin remains the
correct one.

---

## Summary

| Claim | Verdict |
| --- | --- |
| V-1 cell list appears in the contract only, not the spine | CONFIRMED (task premise adjusted) |
| V-2 claimed cells tile the covered range, no gaps/overlaps, on-lattice | CONFIRMED |
| V-3 every tier endpoint respected / no tier split incorrectly | **WRONG** — `[43,55.5]` straddles T6; partition is nine cells |
| V-4 `[56,56.5]` is the one cell emitted twice | **WRONG** — four cells are emitted twice |
| V-5 edges on the half-integer lattice | CONFIRMED (filter unit itself UNVERIFIABLE) |
| V-6 `[56,80]` includes T7's 56.0–56.5 tail | CONFIRMED |
| V-7 T7 43.0–56.5 vs T8 opening at 56.0 | CONFIRMED |
| V-8 producer's 53/63, 36%, 170–1,250 figures | UNVERIFIABLE |
| V-9 mass-conservation identity self-consistent | CONFIRMED |
| V-10 emitted entries sum to the original tier weights | CONFIRMED |
| V-11 unreached cells omitted, consistent with conservation | CONFIRMED |
| V-12 recommended estimator conserves mass | CONFIRMED structurally; outputs UNVERIFIABLE |
| V-13 Zod 4.6.2 | MOVED — 4.6.3 is now latest |
| V-14 TS 7.0.2 current | CONFIRMED |
| V-15 typescript-eslint `<6.1.0` cap | CONFIRMED, unchanged |
| V-16 dependency-cruiser `<7.0.0` | CONFIRMED, unchanged |
| V-17 TS 7 upgrade trigger unmet | CONFIRMED |

Both WRONG findings are in one sentence of one document (`WEIGHTS-FILE-SCHEMA.md:92`) and
neither touches an AD's rule, the mass-conservation invariant, or the schema. The spine's
AD-28 algorithm, applied literally, already produces the corrected nine-cell partition.
