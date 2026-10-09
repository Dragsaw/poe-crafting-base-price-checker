---
title: 'Story 3.6: Provenance, the uniform-prior banner, and the appendix''s remaining reasons'
type: 'feature'
created: '2026-10-02'
status: 'done'
baseline_commit: 'd7af6c64cc3d5b3a6234e0a1db3f87e7ee439836'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-3-context.md'
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `core` derives no Provenance, so a crafted row resting on an invented weight looks like a measured one. The Provenance cell is empty, the uniform-prior banner does not exist, and the appendix's note cell is always empty.

**Approach:** `core` folds the weakest Provenance and the oldest timestamp onto each ranked crafted pair (AD-10) and puts `absent` on a `partial` class. `web` prints the per-row mark, raises the banner from the loaded data, and fills the appendix note for the disagreement reason. `sync` coverage (AD-27) is out: it is split to `docs/stories/spec-3-6a-sync-measures-pool-coverage.md`.

## Boundaries & Constraints

**Always:**
- Provenance order is `absent` < `uniform-prior` < `measured`. Mapping: `published` and `not-in-game` → `measured`, `weightSource: "absent"` → `uniform-prior`. A weight-0 tier in the eligible set is an input and maps like any other.
- The inputs of a pair are the recipe's eligible set over both slots (`eligible(prefix) ∪ eligible(suffix)`, floor of the recipe applied). A tier below the floor is not an input. The label belongs to the `(Item Class, recipe)` pair.
- The oldest timestamp is the minimum over the `observedAt` of each summand's observation and the `asOf` of each rate the Craft Cost used. A pair with none leaves it unset.
- `absent` is set only on an `UnrankableClass` with reason `pool partial`. A ranked row is `measured` or `uniform-prior`.
- `web` never prints `weightSource` words or the enum value in a row. `uniform-prior` reads *prior only* (`TrustMark kind="prior"`). The enum value stays in the key block and expansion, which exist already. Colour never carries a distinction alone.
- The banner is raised while the active recipe has at least one ranked crafted row and none is `measured`. It is not raised with no crafted row (EXPERIENCE.md, *It needs a ranking to speak about*). It is dismissible for the session only, in memory, and re-reads on a recipe switch. Its text says something in the pool was invented and points at per-row freshness. It never says the pool is invented throughout.
- The mark is never repeated inside an expansion. A recipe switch swaps it silently.
- The appendix note for `class disagrees with weights file` says the pool is published and complete and the disagreement is in the player's Tracked List. It names no check, entry or key.
- Core stays pure and offline. Every new shape is a Zod schema in `contracts`.

**Never:**
- No `sync` coverage work. No change to the appendix's columns, widths or layout. No Age cell. No new fetched artifact. No edit to a planning document that another role owns.
- No Provenance on a raw row (its price is a verbatim observation). No `0` for a missing figure.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| All published | Eligible sets hold only `published` and `not-in-game` tiers | Row `measured`, no mark, no banner | N/A |
| One invented tier | One `absent`-source tier in either eligible set | Every row of that pair `uniform-prior`, mark *prior only* | N/A |
| Tier below floor | The only invented tier lies under the recipe floor | Pair `measured` | N/A |
| Recipe switch | Greater pair `measured`, perfect pair `uniform-prior` | Mark and banner follow the active recipe in one pass | N/A |
| All prior | Every ranked crafted row of the recipe `uniform-prior` | Banner up above the list; rows keep marks | Dismiss hides it until reload |
| No crafted row | `weights.json` or recipes absent, or none ranked | No banner | N/A |
| Partial pool | `poolCoverage: partial` | Unrankable `pool partial`, provenance `absent`, appendix `unknown` mark | N/A |
| Disagreement | Class excluded by a cross-file check | Appendix reason `class disagrees with weights file` and the quiet note | N/A |
| Complete pool, no entries | `complete` pool with `entries: []` | Reported as `recipe cannot reach this class`, never `pool partial` | N/A |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/ranked-row.ts` -- `CraftedRankedRowSchema`: add `provenance` (`uniform-prior | measured`) and optional `asOf`; export a `ProvenanceSchema` of the three values.
- `packages/core/src/probability.ts` -- `eligible()`, `poolOf()`: reuse to collect the inputs. Do not change the probability formula.
- `packages/core/src/craft-cost.ts` -- `craftCost()` drops the matched rate. Return the used rates' `asOf` on the ok arm.
- `packages/core/src/rank.ts` -- `craftedRow()` (L458) adds the fold. `rank()` (L326) sets `provenance: 'absent'` on a `pool partial` `UnrankableClass` (L121).
- `packages/core/src/provenance.ts` (new) -- pure `weakest`, `provenanceOfTier`, `foldPair`; unit tests beside it.
- `packages/web/src/list/active-ranking.ts` -- `forRecipe` filters to the active recipe, so the banner condition reads its crafted rows.
- `packages/web/src/list/display-rows.ts`, `RankedRow.tsx` L123 -- empty `data-cell="provenance"`: render `TrustMark kind="prior"` word `prior only` for `uniform-prior`.
- `packages/web/src/list/UnrankableAppendix.tsx` -- `AppendixRow` note cell (`data-cell="note"`): the disagreement note. `TrustMark.tsx` reused as is.
- `packages/web/src/list/ListStatement.tsx`, `App.tsx` L214 -- mount the banner above the list. Tokens: `uniform-prior-banner` in DESIGN.md (ochre left marker, `frame-reserve-banner`).
- `packages/web/src/list/KeyBlock.tsx` -- Provenance gloss; check the wording rule, no pool-wide claim.
- Fixtures: `packages/web/src/test-support/list-fixtures.ts`; tests `core/src/rank.test.ts`, `contracts/src/ranked-row.test.ts`, `web/src/list/ranked-list.test.tsx`, `unrankable-appendix.test.tsx`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/ranked-row.ts` -- add `ProvenanceSchema`, the crafted row fields, and the `UnrankableClass` provenance schema if one exists -- one Zod shape at the boundary
- [x] `packages/core/src/provenance.ts` + test -- fold per AD-10 mapping and scope, incl. weight-0 and below-floor cases
- [x] `packages/core/src/craft-cost.ts`, `rank.ts` + tests -- thread the oldest timestamp, set `provenance` and `asOf`, `absent` on `pool partial`; test each matrix row
- [x] `packages/web/src/list/*` -- mark cell, banner component with session dismissal, appendix note; tests with the offline setup
- [x] `docs/stories/deferred-work.md` -- add `[NOTE FOR UX]` for the note wording of `pool partial` and `absent` rows, and a note that the Age cell still waits on the architect ruling

**Acceptance Criteria:**
- Given a pair with one invented tier in its eligible set, when ranked, then its row is `uniform-prior` and the cell reads *prior only* with a glyph
- Given the active recipe has no `measured` ranked row, when the page renders, then the banner is up above the list with an ochre marker, and it lowers when a `measured` row appears
- Given the banner is dismissed, when the recipe switches, then it stays down for the session
- Given a `partial` pool, when ranked, then the class is Unrankable with `absent`, never on a ranked row
- Given `pnpm check` and `pnpm test`, then both pass with no network call

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Route | Evidence |
|---|---|---|---|
| Provenance folded from the first keyed entry only (edge-case, blind) | medium | patch | `eligible()` depends on each entry's `itemLevelMin`; fixed to fold over every keyed entry with `weakest`. |
| Banner body says "age" but the Age cell is empty (blind) | low | patch | Copy now says "freshness". |
| JSDoc of `provenance.ts` attaches to the wrong declaration (blind) | low | patch | Blank line added. |
| Accessibility: role, aria-label, focus style (blind) | false | rejected | Accessibility Floor ruling (AGENT-WORKFLOW Review brief). |
| Empty eligible set folds to `measured`; NaN stamp; uncostable `asOf`; dismissal hides later states; threshold/uncostable rows in banner (edge-case) | false | rejected | Empty set yields no row (`empty-eligible-pool`); stamps are `IsoTimestampSchema`-validated; spec says session-only dismissal and "used" rates. |
| Appendix note lacks exhaustive switch; `UnrankableClass` not Zod; `provenance: 'absent'` unread; spec/tracker/deferred-anchor remarks (blind) | low | rejected | Cosmetic or spec-edit fixes; no named harm. |
| Spec "re-reads" vs AC dismissal; `KeyBlock` untouched (verification-gap) | false | rejected | Condition re-reads; dismissal persists per AC. KeyBlock gloss already makes no pool-wide claim. |

## Design Notes

The banner reads `row.provenance` of the active recipe's crafted rows before the top-20 bound, so it describes the whole ranking. The Age cell stays empty: the architect ruling on AD-10's oldest-timestamp reading (`deferred-work.md`, the Story 3.5/3.6 entry) is open, so `core` publishes `asOf` and `web` does not yet print it.

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0
- `pnpm test` -- expected: all pass, no escaped URL

**Manual checks (if no CLI):**
- With agent-browser (`--session` from `agent-browser session id --scope worktree --prefix poe`), open `pnpm dev`: switch recipes with a fixture of mixed provenance and see the marks and banner change. Stop with `pnpm dev:stop`.
