---
title: "Story 3.2: The probability term — a tier's interval, containment, and the entry's floor"
type: 'feature'
created: '2026-09-27'
status: 'done'
baseline_commit: 'ca9631dbec7522d287909135c1d7b3b189ff0749'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md'
  - '{project-root}/docs/stories/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `core` has no probability term yet. Nothing derives a tier's interval, tests containment, scopes a pool or computes `P(combination)`. Without one definition, two builders can produce two orderings from the same two files. Also, nothing makes the crafted entries of one Item Class share one `itemLevelMin` (FR-29, FR-22, AD-17, epics Story 3.2).

**Approach:** Add one pure `core` module that implements `IMPLEMENTATION-NOTES.md` §1 (interval, containment), §9 (eligible set, `P(ref | recipe)`) and §11 (the two-order Combination sum), and export it. A missing figure comes back as a typed reason and never as `0`. Add the shared-floor rule to `TrackedFileSchema`, so every shell that loads `tracked.json` enforces it.

## Boundaries & Constraints

**Always:**
- One exported `interval(line)` does the only division. Its doc names the two-`#` rule as the producer's inference, pending OQ-12, and names this function as the one place to change. `contains` calls it, and Story 3.3's edge alignment will call it.
- Edge comparisons use `>=` and `<=` with exact equality, and no epsilon (AD-5).
- The order is scope, then truncate, then exclude, then renormalise (§9, §11). The pool is the direct lookup `bases[categoryId][className][slot]`, own keys only, with no sibling fallback. An absent pool gives a typed reason.
- A contained entry adds its weight once. A partly covered tier or a `null`-`statId` line adds nothing, and its entry stays in the denominator. It is not an error.
- An empty eligible slot (`W = 0`) and an exhausted augment (`W_X∖g = 0` under a positive first-draw weight) each return a typed reason, and never `P = 0`.
- The shared-floor rule covers non-`pruned` crafted entries per `(categoryId, className)`. `raw` entries take no part, because of their shape. A breach is one issue per breaching entry, and it names the class, both floors and the first entry's index.
- The module doc records the trust surface: nothing mechanical catches a floor declared higher than §8 derives, and no component derives the floor (AD-5, §8).

**Never:**
- No code reads `acceptedTier`, `sourceModifierId` or `gamePatch`.
- No Provenance (Story 3.6), no cross-file checks (Story 3.3), and no wiring into `rank`, EV or recipes (Story 3.4). No `web` change, and no new player-facing reason string. The typed reasons are machine tags that Story 3.4 maps.
- No tolerance, no guard on the division, and no derived floor.

**Decisions (human, 2026-09-27):**
- `pruned` tombstones are exempt from the shared-floor rule. They are never summands, and AD-27 and §3 already exclude them. This keeps a re-derived floor from forcing edits to tombstones.
- Keep the full spec (about 1,900 tokens).

## I/O & Edge-Case Matrix

| Scenario | Input | Expected |
|---|---|---|
| Interval | `ranges: []` / `[[a,b]]` / `[[a1,b1],[a2,b2]]` | none (valueless) / `[a,b]` / `[(a1+a2)/2,(b1+b2)/2]` |
| Banded, exact edges | derived `[47,50]`, band `47–50` | contained |
| Clipped | derived `[45,50]`, band `47–50` | not contained. The tier stays in the denominator. |
| Run of whole tiers | two adjacent tiers, both inside the band | the numerator carries both weights |
| Valueless | a line with the same `statId` and `ranges: []` | contained. A line with non-empty `ranges` is not. |
| Hybrid | an entry with two matching lines | its weight counts once |
| Scope and recipe floor | `modifierLevelMin ≤ w.itemLevelMin ≤ entry.itemLevelMin` | only these tiers are eligible. `0` changes nothing. |
| Empty eligible slot | a recipe floor of 70 on an entry floor of 65 | reason `empty-eligible-pool` with its slot |
| No cross-slot group | every non-pruned crafted entry of the committed files, at `modifierLevelMin: 0` | `P(p ∧ s)` equals `P(p) × P(s)` to 1e-12 relative |
| Cross-slot group, built in the test | a `modGroup` in both slots | the hand-computed two-order sum of §11 |
| Exhausted augment | a first draw whose group empties the other slot | reason `augment-exhausted`, not `0` |
| Absent affix | prefix only | `C_s = E_s` (`P = 1` for the absent affix) |
| Label | the same ref with and without `acceptedTier` | the same `P` |
| Shared floor | two non-pruned crafted entries on one class at 82 and 75 | `tracked.json` refused, with the issue at the second entry |
| Shared floor, exempt | a pruned entry at 75, or a raw entry at 75, beside 82 | loads |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/weights-file.ts` -- the types `WeightsLine`, `ModifierWeight`, `WeightsPool`, `WeightsClassPools` and `WeightsFile`. The schema already refuses 3+ range pairs and `min > max`.
- `packages/contracts/src/modifier-ref.ts`, `tracked-entry.ts` -- `ModifierRef` (`banded` with `valueMin` and `valueMax`, or `valueless`) and `CraftedTrackedEntry`.
- `packages/contracts/src/envelopes.ts:38-58` -- the `superRefine` of `TrackedFileSchema`. Extend it here. `web` (`load/artifacts.ts`) and `sync` (`run-chunk.ts`, `curation/check.ts`, `fixtures-record.ts`) already parse through it.
- `packages/core/src/rank.ts:151-165` -- `unrankableReasonOf` does the same own-key direct lookup. Match its style. Do not change `rank`.
- `packages/core/src/index.ts` -- re-export with `.ts` specifiers.
- `packages/contracts/src/weights-file.test.ts:51-60` -- the pattern for loading a committed `data/*.json` in a test (dynamic import with `@vite-ignore`). `core` tests are exempt from the purity lint.
- Committed data: 201 crafted entries on 4 classes (floors 82, 1, 82 and 82). Every pool is `complete`, and no `modGroup` spans both slots.

## Tasks & Acceptance

**Execution:**
- [x] `packages/core/src/probability.ts` -- add `interval`, `contains`, `poolOf(weights, categoryId, className)`, `eligible(pool, itemLevelMin, modifierLevelMin)`, `affixProbability` (§9) and `combinationProbability` (§11). Each returns `{ ok: true, p } | { ok: false, reason }`, and the reason is a discriminated tag (`class-absent`, `empty-eligible-pool` with its slot, `augment-exhausted` with the first-draw slot and `modGroup`). Write the module doc with the OQ-12, exactness and trust-surface notes. -- This is the one definition.
- [x] `packages/core/src/probability.test.ts` -- cover every matrix row except the two Shared floor rows. The real-file product test runs over `data/tracked.json` and `data/weights.json`.
- [x] `packages/core/src/index.ts` -- export the functions and their result and reason types.
- [x] `packages/contracts/src/envelopes.ts` (+ `envelopes.test.ts`) -- add the shared-floor rule and cover the two Shared floor rows.
- [x] `docs/stories/deferred-work.md` -- append a `[NOTE FOR ARCHITECT]`. AD-10 maps only `published` and `absent`, so the Provenance of a `not-in-game` tier (weight 0, still in the pool) is unstated. This blocks Story 3.6.

**Acceptance Criteria:**
- Given the workspace, when searched, then only `probability.ts` divides a range pair, and no source file outside `contracts` reads `acceptedTier`.
- Given the committed `tracked.json`, when `web` and `sync` load it, then it loads unchanged.
- Given any matrix case that the table marks as a reason, when `core` computes it, then the result is a typed reason and never a numeric `0`.

## Design Notes

§11 with both affixes present, where `C` means contained ∩ eligible:
`P = [Σ_{e∈C_p} e.w · ΣC_s∖g(e) / W_S∖g(e) + Σ_{f∈C_s} f.w · ΣC_p∖g(f) / W_P∖g(f)] / (W_P + W_S)`.
Check `W_P` and `W_S` for `empty-eligible-pool` first. Then check each positive-weight term's denominator for `augment-exhausted`. An absent affix sets `C = E` in the same formula, so it needs no separate code path.

## Verification

**Commands:**
- `pnpm check` -- expected: types, lint and dependency rules all pass.
- `pnpm test` -- expected: all tests pass, with no network call.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|---|
| 1 | blind | The diff omits the spec and the `epic-3-context.md` edit | false | reject | The spec goes to the edge-case layer as the claims file by design. The `epic-3-context.md` edit is a planning change from before the baseline work, not story code. |
| 2 | blind | The NFR-2 comment on `tier()` contradicts the real-file test | false | reject | The comment describes `tier()` only, and it is accurate. The spec requires the real-file test. |
| 3 | blind, verif-gap, edge | The real-file test hard-codes 201 crafted entries | medium | patch | Any curation edit to `data/tracked.json` fails a pure `core` test. Parallel worktrees edit that file (AGENT-WORKFLOW *Parallel worktrees*). |
| 4 | blind | The real-file test does not assert its no-cross-slot-`modGroup` precondition | low | patch | Cross-slot data would fail as a wrong-probability bug. The fix is one direct assertion. |
| 5 | blind | The exactness doc omits the integer-endpoint condition | low | patch | `IMPLEMENTATION-NOTES.md` §1 bases exactness on averaging integers. The doc omits it. The fix is one clause. |
| 6 | blind, verif-gap | The weight-0 first-draw skip in `orderedTerm` is untested | medium | patch | Deleting the `continue` passes all 52 tests (verif-gap ran them). A `not-in-game` tier could then make a combination unrankable. |
| 7 | blind, verif-gap | The suffix-side `empty-eligible-pool` and suffix-first `augment-exhausted` are untested | medium | patch | Every existing reason case fails on the prefix side first. A wrong tag or slot would reach Story 3.4 and no test would catch it. |
| 8 | blind | An absent affix plus an exhausting first draw returns `augment-exhausted` | false | reject | The Design Notes say that an absent affix sets `C = E` in the same formula, so the exhausted-augment reason applies unchanged. |
| 9 | blind | The `class-absent` member of `ProbabilityReason` is dead | false | reject | The spec's Task lists `class-absent` among the reason tags. `PoolLookup`'s failure is assignable to `ProbabilityReason`, so Story 3.4 maps one union. |
| 10 | blind | The ACs (one division site, no `acceptedTier` read) have no automated check | low | reject | The ACs were verified by search. A new lint-style test adds surface the spec does not ask for. |
| 11 | blind | No test shows that a pruned entry never sets the class floor | low | patch | The code is correct (pruned entries are skipped before the floor is set). A one-case test proves it. |
| 12 | blind | The shared-floor tests do not use `pinned` or `retired` statuses | low | reject | The code tests only `pruned`, so other statuses take the same path as `active`. The fix would add helper complexity for no distinct branch. |
| 13 | blind | The code comments copy owner-document prose | low | reject | The spec requires the trust-surface note in the module doc. The AGENTS rule governs planning documents, not code comments. |
| 14 | blind | The sprint status is `in-progress` while every Task is ticked | false | reject | The workflow moves the status at presentation (step 5). |
| 15 | blind | The deferred-work evidence cites §9 and §11 without the document | low | patch | The companion `§n` needs its owner to be unambiguous. The fix is a direct text edit. |
| 16 | edge | A banded ref with `valueMin > valueMax` gives `ok` with `p = 0` | medium | defer | Verified: `BandedModifierRefSchema` has no order refine, and §2.5 checks only `statId` absence. The gap is in the pre-existing Epic 1 contract. |
| 17 | edge | A `partial` pool still returns a numeric P | false | reject | Spine AD-10 and AD-17: a probability from a `partial` pool carries Provenance `absent` and goes to the appendix (Story 3.6 and 3.4). The spec excludes Provenance. |
| 18 | edge | An outlier first entry puts the floor issues on the wrong entries | false | reject | The spec rule names the first entry's index and both floors, so a curator sees the conflict whichever entry is the outlier. |
| 19 | edge | Four of the six functions do not return the ok/reason shape | false | reject | `interval`, `contains` and `eligible` cannot fail. `poolOf` returns the ok shape. The fallible probability functions match the Task. |
