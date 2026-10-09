---
title: 'CraftRecipeSchema refuses an empty or repeated currency list'
type: 'bugfix'
created: '2026-10-02'
status: 'done'
baseline_revision: '0637f62c9e5564a1a8687d9f957a31e00ddac90e'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `CraftRecipeSchema` accepts `currencies: []` and a `currencyId` repeated inside one recipe. `craftCost` sums over the lines, so an empty recipe costs `0` and looks free, which AD-20 forbids and which inflates every crafted EV.

**Approach:** Add `.min(1)` to `currencies` and a per-recipe `currencyId` uniqueness refinement, each issue naming the repeated id and its first line, in the `recipes.json` file-rule style.

## Boundaries & Constraints

**Always:** Keep `CraftRecipeSchema` a `z.strictObject`. Keep `recipeWord` and `RecipesFileSchema` unchanged. The committed `data/recipes.json` must still parse.

**Never:** Edit a PRD, AD, `deferred-work.md` or `sprint-status.yaml`. Do not change `craftCost`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty list | `currencies: []` | Refused | Issue at `currencies` |
| Repeated id | two lines with one `currencyId` | Refused | Issue at the later line's index, naming the id and the first index |
| Valid | distinct ids, one or more lines | Parses | None |

</intent-contract>

## Code Map

- `packages/contracts/src/craft-recipe.ts` -- `CraftRecipeSchema.currencies` array to constrain.
- `packages/contracts/src/craft-recipe.test.ts` -- schema tests; add the two refusals.
- `packages/contracts/src/envelopes.ts` -- `RecipesFileSchema`, read-only; its id and word rules are the message style.
- `packages/core/src/craft-cost.ts` -- read-only; the empty-sum `0` is the defect's consequence.

## Tasks & Acceptance

**Execution:**
- `packages/contracts/src/craft-recipe.ts` -- `.min(1)` plus a `superRefine` on `currencies` for repeated `currencyId` -- makes the summary false.
- `packages/contracts/src/craft-recipe.test.ts` -- tests for the empty list, the repeated id and a valid multi-line recipe -- I/O matrix.

**Acceptance Criteria:**
- Given a recipe with `currencies: []`, when parsed, then `CraftRecipeSchema` refuses it.
- Given a recipe repeating one `currencyId`, when parsed, then it is refused with one issue naming the id.
- Given `data/recipes.json`, when parsed, then it still passes.

## Verification

**Commands:**
- `pnpm check` -- expected: passes
- `pnpm test` -- expected: passes

## Review Triage Log

### 2026-10-02 — Review pass
- verdicts: 17 findings — high 0, medium 0, low 5, false 12, maybe-false 0
- findings:
  - `[false]` `[reject]` Edge and blind: case or whitespace variants of a currency id pass uniqueness — currency ids are verbatim catalogue strings and `craftCost` matches them by exact string, so a case variant is a different, uncostable id, not a duplicate.
  - `[low]` `[reject]` Edge: three or more repeats give several issues — each later repeat gets its own issue, as in the `RecipesFileSchema` id rule; no harm.
  - `[false]` `[reject]` Edge, blind and spec-claim: no valid multi-line test — the existing 'parses a recipe with its currencies' test parses two distinct ids.
  - `[false]` `[reject]` Edge, blind and intent: no test parses `data/recipes.json` — committed-data suites parse it, and `pnpm test` passed 1602 of 1602; the file has distinct, non-empty lines.
  - `[low]` `[reject]` Blind: repeat edge cases untested — test-only, nobody meets it.
  - `[low]` `[reject]` Blind: message hardcodes `currencies.N` — the index is relative to the recipe, the same style as the file-level rules.
  - `[low]` `[reject]` Blind: empty-list test asserts only the path — cosmetic.
  - `[low]` `[reject]` Blind: new rules absent from `.describe` — cosmetic, no named harm.
  - `[false]` `[reject]` Blind: ledger conflicts with the spec — the sweep removes the entry in its last commit.
  - `[false]` `[reject]` Blind: spec metadata premature, consumers unchecked — the workflow sets status; the committed recipes are valid.
  - `[false]` `[reject]` Intent: readings B, C and D diverge from A — descriptive; A is the entry's own prescription and AD-20 forbids a free recipe.
  - `[false]` `[reject]` Verification gap and ledger audit — zero findings.

## Auto Run Result

Status: done

- Summary: `CraftRecipeSchema.currencies` now refuses an empty list and a `currencyId` repeated within one recipe.
- Files changed: `packages/contracts/src/craft-recipe.ts` (`.min(1)` and a uniqueness `superRefine`); `packages/contracts/src/craft-recipe.test.ts` (two refusal tests).
- Review: no patches applied, nothing deferred; every finding rejected, reasons in the triage log.
- Follow-up review recommended: false.
- Verification: `pnpm check` and `pnpm test` passed (1602 tests).
- Residual risks: none known; a recipe built in code that bypasses the schema still sums to 0 in `craftCost`.
