---
title: 'Epic 3 retro item 31: apply the owner rulings in code'
type: 'feature'
created: '2026-10-03'
status: 'done'
route: 'dispatch'
baseline_commit: 'b61fa9dafe0ce442d08d2ae9c3937468deea627e'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/spec-epic-3-retro-item-31-answer-the-open-owner-rulings.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The retro item 31 rulings are in their owner documents (AD-10, AD-17, IN §1, §2.3, §9, §9.1), but `core`, `contracts` and the committed data still follow the old rules. The ledger section `## Deferred from: epic 3 retro item 31 (2026-10-03)` has five open entries for this work.

**Approach:** Build the five entries in one branch: (a) the crafted `asOf` comes from the summands only and has the attempted fallback; (b) D5 makes an empty `contained ∩ eligible` set a reason; (c) a valueless tier reads as `[1, 1]`, and the six pruned Crossbows entries come back as banded `[1, 1]` references; (d) the `RECIPE_GRADES` comment cites IN §9.1; (e) the UX ruling on the not-run diagnosis group (Decisions below), written into EXPERIENCE.md and built. Remove the five entries, and the section header with them, in this branch.

**Decisions (player, 2026-10-03):**
1. **(e) Not-run diagnosis.** When no weights envelope is loaded, the cross-file diagnosis group prints one italic *unknown* line. This is the word the coverage group prints without weights (`UNKNOWN`, keyed on `weightsLoaded`). With weights loaded and no failure, no group renders, as before.
2. **(c) Tier label.** The six rewritten `[1, 1]` suffixes declare `acceptedTier: "T1"`, as the weights label the tier.
3. **Scope.** All five entries are in one spec, about 2000 tokens, and the player accepted the size.

## Boundaries & Constraints

**Always:** Cite owner docs by id. Do not restate their text. Make each behaviour change with its test flip in the same task. Edit `data/tracked.json` by hand per the `tracked-json` skill, and run `pnpm tracked:check` until it exits 0. Keep pruned entries other than the six.

**Never:** Build the crafted Age cell in `web`: that is the story 3.4 ledger entry, which stays open. Edit `prd.md`, the spine, IN or `.memlog.md`. Implement IN §2.7 line-set completeness (`meets`): no code has it. Call the live trade API.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Crafted age, summands | ≥1 summand; rates carry older `asOf` | `asOf` = oldest summand `observedAt`; rates ignored | N/A |
| Crafted age, no summand | non-pruned entries, some with `lastAttemptedAt` | no `asOf`; `lastAttemptedAt` = oldest among those that have one | N/A |
| Crafted age, never | no summand, no entry attempted | neither field set | N/A |
| D5 | floor leaves a slot's `contained ∩ eligible` empty | pair unrankable, `recipe cannot reach this class` | N/A |
| Valueless as `[1, 1]` | banded `[1, 1]` ref on a mixed-kind stat | contains the valueless tier; kind agreement passes | N/A |
| Valueless ref beside banded lines | valueless ref; the stat has a banded line | kind-agreement failure (unchanged) | N/A |
| Diagnosis, not run | no weights envelope loaded | one *unknown* line in the diagnosis group | N/A |
| Diagnosis, all pass | weights loaded, no failure | no group (unchanged) | N/A |

</frozen-after-approval>

## Code Map

- `packages/core/src/rank.ts` -- `craftedRow` (:469-514): `stamps` is seeded with `cost.asOf` (:479). Seed it empty. With no summand, take the oldest `lastAttemptedAt` over `keyed` through `byKey` (raw precedent: `unranked()` :292-300, :390). Use `oldestOf` (`provenance.ts:49`). `RECIPE_UNREACHABLE` (:201) already maps every `!probability.ok`. Update only its docs at :195-200 and :457-461.
- `packages/contracts/src/ranked-row.ts:109-111` -- `CraftedRankedRowSchema.asOf`: rewrite the doc to cite AD-10. Add an optional `lastAttemptedAt` (`IsoTimestampSchema`), following the raw row (:48-50). Both absent means *never attempted*.
- `packages/core/src/probability.ts` -- `ProbabilityReason` (:54-57): add `{kind:'empty-contained', slot}`. Return it from `combinationProbability` after :254 when a defined slot ref has `contained.length === 0`. `interval` (:75-84): empty `ranges` gives `{min:1,max:1}`. `contains` (:95-109): the valueless branch tests `line.ranges.length === 0`. Update the docs at :31-33, :71-73 and :86-94.
- `packages/core/src/cross-file.ts` -- `kindAgreement` (:137-163) fails only on a valueless ref with a line where `ranges.length > 0`, so the detail's other kind is always `banded`. `edgeAlignment` (:78-109) then takes `[1, 1]` without a change. Update the doc at :132-136.
- `packages/contracts/src/craft-recipe.ts:50-55` -- the comment cites IN §9.1.
- `data/tracked.json` -- the six pruned Crossbows entries (array indexes 36, 41, 46, 51, 56, 61; the suffix is on `explicit.stat_1967051901`). Each suffix becomes `{"kind":"banded","statId":…,"valueMin":1,"valueMax":1,"acceptedTier":"T1"}`. Set `status: "active"` and drop `prunedReason`. This is the only mixed-kind stat in `data/weights.json`.
- `.claude/skills/tracked-json/SKILL.md` step 4 -- says that `ranges: []` means `valueless`. Add that on a stat with banded lines the reference is banded `[1, 1]` (IN §2.3).
- `packages/web/src/frame/trust-facts.ts:163-170,180-230` -- `diagnosisGroups` / `panelColumns` (`weightsLoaded` is already a parameter; precedent: `coverageGroup` :232-234). Pass `weightsLoaded` into `diagnosisGroups`. When it is false, return one `UNKNOWN` group (Decision 1).
- `docs/ux-designs/.../EXPERIENCE.md:584` -- write Decision 1 into `{components.sync-report-panel}`. Bump `revision:`.
- Tests: `rank.test.ts:1014-1027` (the `rated` case flips), `:898-913` (Staves becomes unrankable); `probability.test.ts:71-76`, `:99`, `:176-262` (add empty-contained); `cross-file.test.ts:161-164` (flips to pass), `:277` (committed files stay clean); `trust-facts.test.ts:271-295`, `trust-strip.test.tsx:360-385`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/ranked-row.ts`, `craft-recipe.ts` -- the `lastAttemptedAt` field and the doc; the IN §9.1 comment -- (a), (d).
- [x] `packages/core/src/rank.ts` + `rank.test.ts` -- summand-only `asOf` and the attempted fallback, with tests for all three age rows; flip the Staves ordering test -- (a), (b).
- [x] `packages/core/src/probability.ts` + `probability.test.ts` -- the `empty-contained` reason; `[1, 1]` interval and containment -- (b), (c).
- [x] `packages/core/src/cross-file.ts` + `cross-file.test.ts` -- the narrowed kind agreement; flip :161-164; add a test that a valueless ref beside a banded line still fails -- (c).
- [x] `data/tracked.json`, `SKILL.md` -- rewrite the six entries; run `pnpm tracked:check` -- (c).
- [x] `EXPERIENCE.md`, `trust-facts.ts` + tests -- the not-run ruling -- (e).
- [x] `docs/stories/deferred-work.md` -- the five entries and their header were removed at planning, at the player's request (2026-10-03), and this branch lands the work. Append one entry under a new `## Deferred from: spec-epic-3-retro-item-31-apply-the-rulings-in-code (2026-10-03)` header. Player: check on the live trade API that `min: 1, max: 1` on `explicit.stat_1967051901` returns items with "Loads an additional bolt" (AD-16).

**Acceptance Criteria:**
- Given the committed data, when `pnpm tracked:check` runs, then it exits 0 and the six Crossbows entries are active.
- Given the ledger, when it is read, then the five entries are gone, the trade-API entry exists, and no other entry changed.

## Implementation Notes

- D5 reaches the committed data: under both committed recipes, Amulets, Bows and Crossbows are unrankable (a tracked reference in each contains no tier at or above the floor). Only Emerald ranks. `App.test.tsx` now expects three appendix rows. A new ledger entry asks the player to decide.
- `craft-recipe.test.tsx` fixtures STAVES and RINGS modelled `P = 0` for a reference out of reach. Each got a small in-reach tier, so they stay rankable under perfect and the recipe-switch tests keep their intent.
- Five of the six Crossbows entries exceed the 27-character chase budget. `PRUNING_CANDIDATES` gained them, and a new ledger entry carries them; the Story 3.5 entry is not rewritten.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | verification-gap | `edgeAlignment` counting a valueless line as `[1, 1]` is untested | medium | Pre-verified: no test's verdict depends on it; a restored skip passes every test. | patch |
| 2 | verification-gap, blind | Crafted `lastAttemptedAt` fallback not shown to take the oldest; summand-case absence assertion may be vacuous | low | Pre-verified: the fallback test has one timestamp only. | patch |
| 3 | blind, edge-case | `craft-cost.ts:20` doc still calls the rate `asOf` an input of the oldest timestamp (AD-10) | low | Doc contradicts the AD-10 ruling that `rank.ts` now follows; direct correction. | patch |
| 4 | blind | Edited doc comments in `probability.ts` and `rank.ts` not reflowed | low | Over-long lines and a mid-sentence break; direct correction. | patch |
| 5 | blind | Reactivated Crossbows `[1, 1]` suffixes sit at ilvl 55, below the perfect floor 70, so Crossbows/perfect is unrankable by construction; the D5 ledger entry omits it | medium | `data/weights.json` valueless T1 at `itemLevelMin: 55`; `data/recipes.json` perfect floor 70. | patch (this branch's own entry) |
| 6 | blind, edge-case | The ruling-5 check "flag any other mixed-kind statId whose valueless tier is not the count 1" was dropped with the old entry; `interval()` reads every valueless line as `[1, 1]` | medium | The new ledger section does not carry it; only one mixed-kind stat exists today. | defer |
| 7 | blind | SKILL.md step 4 does not warn that the valueless tier may sit below a recipe floor (D5) | low | Agent-context file. | defer |
| 8 | blind | One unreachable entry makes the whole `(Item Class, recipe)` pair unrankable | false | IN §9: "When that holds for any reference of any non-pruned tracked entry of the pair, `core` returns the `(itemClass, recipe)` pair as unrankable". | reject |
| 9 | blind | `RECIPE_UNREACHABLE` doc claims code owns the string against AGENTS.md | false | IN §9 names `rank.ts` `RECIPE_UNREACHABLE` as the string's home; `prd.md` has no such string. | reject |
| 10 | blind, edge-case | Ledger task/AC say one entry; three were appended | low | Fix edits this build's spec. | reject |
| 11 | blind | `App.test.tsx` asserts the committed-data appendix under the default recipe only | low | D5 per slot is unit-tested in `probability.test.ts` and through `rank.test.ts`; fix adds a test for a case not met in everyday regressions. | reject |
| 12 | blind | No ledger link from the Story 3.5 Age-cell entry to the new crafted fields | low | The Story 3.5 entry still stands and the fields are documented in `ranked-row.ts`. | reject |
| 13 | blind | A wide banded ref on a mixed-kind stat silently contains the valueless tier | false | That is the IN §2.3 ruling; edge alignment still flags a band whose extremes differ. | reject |
| 14 | edge-case | Shared-modGroup refs can give `ok` with `P = 0` | false | `contained ∩ eligible` is non-empty, so IN §9 does not apply; IN §11 makes only a zero `W_X∖g` a reason. Pre-existing code path. | reject |
| 15 | edge-case | Schema accepts a crafted row with both `asOf` and `lastAttemptedAt` | low | `core` is the sole producer and never sets both; a refine adds a guard for an undemonstrated state. | reject |
| 16 | edge-case | `diagnosisGroups` drops failures when `weightsLoaded` is false | false | `crossFileChecks` returns `[]` when weights are `null` (`cross-file.ts:227`), so no failure reaches it. | reject |

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0.
- `pnpm test` -- expected: all pass.
- `pnpm tracked:check` -- expected: exit 0.
