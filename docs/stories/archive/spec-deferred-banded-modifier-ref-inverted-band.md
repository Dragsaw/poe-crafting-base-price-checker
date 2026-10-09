---
title: 'BandedModifierRefSchema refuses valueMin > valueMax'
type: 'bugfix'
created: '2026-10-02'
status: 'done'
baseline_revision: 'c29842ac1b439a2d9b7b7ab46dae8ac11ef158ab'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `BandedModifierRefSchema` accepts `valueMin > valueMax`. An inverted band contains no tier, so `affixProbability` and `combinationProbability` return `ok` with `p = 0` and no reason, and a curator typo in `tracked.json` ranks an entry at P = 0 without a signal (deferred entry from Story 3.2 review, triage row 16).

**Approach:** Add a `valueMin <= valueMax` refine to the banded arm in `packages/contracts/src/modifier-ref.ts`, with the issue on `valueMax`.

## Boundaries & Constraints

**Always:** Edges stay inclusive `number`s; `valueMin === valueMax` stays valid (a point band). `ModifierRefSchema` stays a `discriminatedUnion` on `kind`. The refusal is a schema issue, so every consumer of `ModifierRefSchema` (tracked file, canonical key) inherits it.

**Never:** No change to `core`, `sync`, the weights contract, any `data/` file, or any owner document. No new check module.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Ordered band | `valueMin: 43, valueMax: 56.5` | parses | none |
| Point band | `valueMin: 5, valueMax: 5` | parses | none |
| Inverted band | `valueMin: 56.5, valueMax: 43` | refused | issue path `valueMax` |

</intent-contract>

## Code Map

- `packages/contracts/src/modifier-ref.ts` -- `BandedModifierRefSchema` (strictObject + `.describe`); add the refine here.
- `packages/contracts/src/modifier-ref.test.ts` -- has `issuePaths` helper; add the three matrix cases.
- `packages/contracts/src/overlap.ts:68` -- reads the edges as ordered; read-only.

## Tasks & Acceptance

**Execution:**
- `packages/contracts/src/modifier-ref.ts` -- refine `valueMin <= valueMax` on the banded arm, issue path `['valueMax']` -- closes the P = 0 silent path at the contract.
- `packages/contracts/src/modifier-ref.test.ts` -- test ordered, point and inverted bands -- covers the matrix.

**Acceptance Criteria:**
- Given a banded ref with `valueMin > valueMax`, when parsed with `ModifierRefSchema`, then it is refused with an issue on `valueMax`.
- Given the committed `data/`, when `pnpm check` and `pnpm test` run, then both pass.

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0
- `pnpm test` -- expected: exit 0

## Review Triage Log

### 2026-10-02 — Review pass
- verdicts: 10 findings — high 0, medium 0, low 3, false 7, maybe-false 0
- findings:
  - `[false]` `[reject]` Blind: the ledger entry is not removed — the caller removes it in the last commit of the branch (intent forbids editing deferred-work.md here).
  - `[low]` `[patch]` Blind/Edge/Verification-gap: inheritance by `TrackedEntrySchema` is untested — added a test in `tracked-entry.test.ts` that an inverted `prefix` is refused with the issue on `prefix.valueMax`.
  - `[low]` `[reject]` Blind: missing-`valueMax`, `acceptedTier` and message-text cases are unpinned — standard Zod behaviour; extra tests add no protection.
  - `[false]` `[reject]` Blind: generated JSON Schema may drift — `grep toJSONSchema` over `packages` and `tools` finds no emitter.
  - `[false]` `[reject]` Edge: an inverted band built without parsing still gives P = 0 — the contract is a runtime schema, and the entry asks for a refine in `contracts`.
  - `[false]` `[reject]` Edge: NaN/Infinity reliance on Zod — Zod 4 `z.number()` refuses both; a refused value is the correct outcome either way.
  - `[false]` `[reject]` Edge: claim that every consumer inherits is undemonstrated — `TrackedEntrySchema` uses `ModifierRefSchema`; now pinned by the patch above; `pnpm test` passes on committed `data/`.
  - `[false]` `[reject]` Intent: readings B, C, D diverge from the diff — descriptive only; the entry names the contracts refine first, and no reading needs a human decision.
  - `[false]` `[reject]` Blind: no `tracked:check` run shown — `pnpm test` covers committed data.
  - `[low]` `[reject]` Blind: refine inside `discriminatedUnion` is unproven — the new tests parse through `ModifierRefSchema`, and Zod 4.6.5 is pinned.

## Auto Run Result

Status: done

- Summary: `BandedModifierRefSchema` now refuses `valueMin > valueMax`, issue on `valueMax`.
- Files: `packages/contracts/src/modifier-ref.ts` (refine), `modifier-ref.test.ts` (ordered, point, inverted), `tracked-entry.test.ts` (inheritance by the tracked entry).
- Review: 1 patch applied (low), 0 deferred, rejections recorded above.
- Follow-up review recommended: false.
- Verification: `pnpm check` and `pnpm test` passed (1604 tests before the extra test; rerun below).
- Residual risk: none found.
