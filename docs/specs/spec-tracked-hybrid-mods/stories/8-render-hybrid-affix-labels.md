---
title: 'Render hybrid affix labels'
type: 'feature'
created: '2026-10-04'
status: 'done'
baseline_commit: '9b30459832bd9c2a2c70de0d0f24ecfafdd842f5'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/specs/spec-tracked-hybrid-mods/SPEC.md'
  - '{project-root}/docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `affixText` in `packages/web/src/list/combination-text.ts` throws on a `hybrid` reference (story 3's interim), so a tracked hybrid entry would break the ranked list and the expansion. SPEC-tracked-hybrid-mods CAP-7; EXPERIENCE.md *A Hybrid Modifier affix is the tier label, then its lines*.

**Approach:** Replace the throw with the hybrid arm: one `AffixPart` per hybrid, `<acceptedTier> <form>, <form>, …` when the tier and every line's short form and band are present, otherwise every line in its catalogue text (band where it has one, `bandedFallback`), comma-joined, `verbatim: true`. **Decision (human, line order):** the lines sort by their printed text in code-unit order (`compareByCodeUnit`): by short form in the curated label, by the fallback string in the fallback. So `% ES` + `% Evasion` prints `T1 % ES, % Evasion` (CAP-7), and the label never reads `weights.json`. The chase cell's existing CSS ellipsis carries the overrun rule; the expansion never cuts.

## Boundaries & Constraints

**Always:** One formatter (`combinationText`) serves both surfaces. Short and catalogue forms never mix inside one affix. The tier prints verbatim, once, before the first line. Follow the AGENTS.md MCP tool rule.

**Never:** Edit an owner document or `data/`. Add short forms to `SHORT_FORMS` (story 9 adds those its hybrid entries need). Add a glyph, bracket or tooltip to tell a hybrid from two affixes. Truncate in the expansion. Touch `lookup.ts` or `SKILL.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Curated | `T1`, banded `% ES` + `% Evasion` lines | `T1 % ES, % Evasion`, `verbatim: false` | N/A |
| Order | `% Phys` + `Mana` lines, either file order | `T1 % Phys, Mana` (printed-text order, not `statId` order) | N/A |
| Three lines | `T1-T2`, three banded lines with forms | `T1-T2 <a>, <b>, <c>` | N/A |
| No tier | banded lines with forms, no `acceptedTier` | every line catalogue text + band, `verbatim: true` | N/A |
| One form missing | one line has no short form | every line in catalogue form, none short | N/A |
| Valueless line | one valueless line | every line in catalogue form; the valueless line has no band | N/A |
| Uncatalogued line | a line's `statId` not in the catalogue | that line prints its raw `statId` (+ band), as today | N/A |
| Combination | hybrid prefix + single suffix | `<hybrid> · <suffix>` | N/A |
| Overrun | longest label the table can build (`T1-T2` + its three longest forms) | chase cell holds the full text with `textOverflow: ellipsis`; its expansion row holds it with no ellipsis | N/A |

</frozen-after-approval>

## Code Map

- `packages/web/src/list/combination-text.ts` -- `affixText` (the hybrid throw at the top); new private `hybridText(ref, stats)`; reuse `bandedFallback`, `shortForm`, `StatTexts`. `AFFIX_JOIN` stays `' · '`; the line join `', '` is a private constant.
- `packages/web/src/list/display-rows.ts:151-180` -- `craftedDetail` calls `combinationText` for chase cells and panel rows. No change.
- `packages/web/src/list/RankedRow.tsx:155-171` -- chase cell already `nowrap` + `ellipsis`; no change.
- `packages/web/src/list/CombinationRow.tsx` `CombinationText` -- renders an `AffixPart` (verbatim → mono); no change.
- `packages/web/src/list/tracked.data.test.ts`, `short-forms.test.ts` -- already hybrid-aware for live data (story 9 exercises them); no change.
- Tests: `combination-text.test.ts` (replace the interim `describe` at `:111-118`; build hybrids through `HybridModifierRefSchema.parse` so they arrive sorted as in production); `recipe/craft-recipe.test.tsx` *the chase cells* (`:589`) -- add a Rings-style world with a hybrid pool tier (`tier` helper at `:93` builds one-line tiers; add a multi-line variant) for the overrun row.

## Tasks & Acceptance

**Execution:**
- [x] `packages/web/src/list/combination-text.ts` -- hybrid arm and doc comment.
- [x] `packages/web/src/list/combination-text.test.ts` -- the matrix rows except Overrun.
- [x] `packages/web/src/recipe/craft-recipe.test.tsx` -- the Overrun row, end to end through the App.

**Acceptance Criteria:**
- Given the repo, when running `pnpm typecheck`, `pnpm lint` and `pnpm test`, then all pass.
- Given `packages/web/src`, when searching for `not supported yet`, then nothing matches.

## Implementation Notes

- Stopped the oneshot route: CAP-7's success string `T1 % ES, % Evasion` contradicts the parsed `statId` order (the line-order decision in Intent). The hybrid arm is drafted in `combination-text.ts` with parsed order, pending the answer. Answer: printed-text order.

## Verification

**Commands:**
- `pnpm typecheck`, `pnpm lint`, `pnpm test` -- expected: all pass.

## Review Triage Log

| Layer | Finding | Verdict | Route | Evidence |
|-------|---------|---------|-------|----------|
| blind | Tier-less test never reaches the no-tier branch (`FIRE` has no short form) | false | reject | `short-forms.ts:28` gives `FIRE` the form `Flat Fire`, so only the tier check sends the case to the fallback. |
| blind | Hybrid suffix and both-slot hybrids untested | low | reject | `combinationText` calls `affixText` for each slot alike. The verification-gap layer mutated the code and found no uncaught case. |
| blind | `affixText` doc comment omits the valueless rule | false | reject | `hybridText`'s comment states it and `affixText`'s comment points to `hybridText`. |
| blind | `hybridText` loop and double `'valueMin' in line` read as convoluted | low | reject | Style only. It names no caller that will diverge. |
| blind | Overrun test asserts inline styles, not layout | false | reject | The spec's Overrun row asks for `textOverflow: ellipsis` on the chase cell and none in the expansion. Every chase-cell test in the file asserts the same way. |
| blind | Overrun fixture built outside the schema, default `.sort()` | low | reject | Default `.sort()` is code-unit order, the same as `compareByCodeUnit`. The result is identical. |
| blind | "Widest label" derived from `SHORT_FORMS`, not pinned | low | reject | The spec defines it as the longest the table can build, so deriving it tracks the table by design. |
| blind | Fallback order depends on the band digits | false | reject | The human decision in the spec's Intent sorts by printed text, band included. |
| blind | Test helpers typed `object` | low | reject | A malformed line fails loudly in `HybridModifierRefSchema.parse`. Test code only. |
| blind | Garbled test title ("…, none short") | low | patch | Retitled in `combination-text.test.ts`. |
| blind | Tracking files absent from the diff | false | reject | `deferred-work.md` holds no entry for the interim throw (`source_spec` hits are stories 2, 4, 5). The story is not in `sprint-status.yaml`. |
| blind | No rendered test of a verbatim hybrid | low | reject | `CombinationRow` already renders any verbatim `AffixPart` the same way. The change adds no new render path. |
| edge, gap | Two lines sharing a short form print it twice (`Atk Spd` twins) | low | reject | One modifier carries no local and global attack-speed pair, and the live data has none. The fix would add a branch. |
| edge | Empty or blank `acceptedTier` prints a leading space | low | reject | The single-line arm treats `acceptedTier` the same way. A schema rule would own it. |
| edge | A catalogue text containing `, ` blurs the line boundary | low | reject | The spec fixes the separator as a comma. No catalogue text in the table contains one. |
| edge | A valueless fallback line keeps its `#` | false | reject | The single-line fallback prints catalogue text the same way. |
| edge | Four or more lines, or a verbatim hybrid, not in the Overrun test | low | reject | The spec defines the row as the table's three longest forms under `T1-T2`. A fix would edit the frozen row. |
| edge | A hand-built ref with `valueMin` and no `valueMax` | false | reject | The contract types forbid it, and the parse helper builds production-shaped refs. |
| edge | The spec's "longest label" claim is loose | low | reject | Fix edits the spec. |
| ledger | No carved-out item without a ledger entry | none | none | The audit reported zero findings. |
