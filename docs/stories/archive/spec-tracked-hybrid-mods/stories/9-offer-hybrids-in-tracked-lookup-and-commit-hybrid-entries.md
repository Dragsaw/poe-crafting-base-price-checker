---
title: 'Offer hybrids in tracked:lookup and the tracked-json skill, and commit hybrid entries'
type: 'feature'
created: '2026-10-04'
status: 'done'
baseline_commit: 'b1cafb075f06eedda305c9efe31f07cbaa2792fe'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/archive/spec-tracked-hybrid-mods/SPEC.md'
  - '{project-root}/.claude/skills/tracked-json/SKILL.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `tracked:lookup` builds families with its own `new Set(lines.map(statId))`, which keeps `null` and skips the null-line rule. `SKILL.md` still tracks one line of a hybrid and drops every row that has a `null` line. `data/tracked.json` holds no hybrid entry, and IMPLEMENTATION-NOTES §5.1d has no capture. SPEC CAP-5, *Success signal*. Deferred entries `deferred-work.md:305` and `:311` hand this story the lookup and skill fixes.

**Approach:** `core` gets `untrackableReason(entry, pool)` (`'not-in-game' | 'partial-pool-null-line' | undefined`), and `untrackable` delegates to it. `lookup` calls `core`'s `lineSet` and `untrackableReason` and keeps no copy. A `mods` row is (modGroup, line set), with `trackable` and the reason for each untrackable tier. A `tiers` row adds `lineSet` and `untrackable`. Rewrite `SKILL.md` for hybrid picks, the null-line rule, step 4b and the summed `statId`. Use the skill to add the Bows phys%+accuracy hybrid prefix to `data/tracked.json`.

**Decisions:** The Time-Lost Diamond case in CAP-5 reads against the committed data, where every pool is `complete`. `IncisionChance` (only a `null` line, `not-in-game`) is the untrackable case with a reason. `JewelRadiusLargerRadius` (`…stat_3891355829|1` + an internal `null` line) is offered as a one-line valueless family, and the `null` line is not in the draft. A synthetic `partial` pool proves the second reason. New entries: the hybrid prefix (lines `stat_1509134228` [65,79] and `stat_691932474` [150,200], `T1-T2`, because T1 first appears at ilvl 81 per FR-22) × each of the 6 suffixes already tracked on Bows, which gives 6 entries. The Bows floor stays at 82. The existing Amulets rarity prefix+suffix entry is the summed-`statId` entry. The short form is `'explicit.stat_691932474': '+Accuracy'`, because `% increased Accuracy Rating` exists (coinage rules). **Decision (human, §5.1d):** add an Amulets rarity T1 prefix + T1 suffix entry to `fixtures/tracked.json` (summed filter [31, 37], above either mod's max of 19). The agent may run `pnpm fixtures:record` **once**, within this spec. Quote the recorded request body in §5.1d in §5.1's form, and say whether the result proves the sum. Fix any fixture-backed test that the re-record breaks.

## Boundaries & Constraints

**Always:** One null-line verdict, which `core` owns. `lookup` still derives no interval or floor. Follow the AGENTS.md MCP tool rule and the `tracked-json` skill for every `data/tracked.json` edit. Report each data edit per AGENT-WORKFLOW. Cite owner documents and do not restate them.

**Never:** Edit any `data/` file except `tracked.json`. Change the weights contract, the tracked schema or `check.ts` behaviour. Run `pnpm fixtures:record` more than once. Make any other live trade call. Edit owner documents beyond the §5.1d capture text.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Hybrid family | Bows prefix `mods` | one row, `statIds` [1509134228, 691932474] sorted, `trackable: true` | N/A |
| Internal line | weight > 0 `{A, B, null}` tier, `complete` pool | one `{A, B}` row, trackable | N/A |
| not-in-game | Time-Lost_Diamond `IncisionChance` | row `statIds: []`, `trackable: false`, tier reason `not-in-game` | N/A |
| Partial pool | `{A, null}` tier in a `partial` pool | `trackable: false`, reason `partial-pool-null-line` | N/A |
| Mixed family | one family, one tier untrackable | `trackable: false`, only that tier listed | N/A |
| `tiers` | hybrid statId | each row has verbatim `lines`, `lineSet`, `untrackable` | N/A |

</frozen-after-approval>

## Code Map

- `packages/core/src/probability.ts:98-106` -- `untrackable`. Add `untrackableReason` beside it, export it from `packages/core/src/index.ts:~69`, and test it in `probability.test.ts`.
- `.claude/skills/tracked-json/scripts/lookup.ts` -- `lookupMods` (`:257`, the `new Set` key), `ModifierRow`, `lookupTiers`, `TierRow`. The pool is `resolved.pools[slot]` (it has `poolCoverage`). The header comment describes what the lookup derives.
- `package.json` devDependencies -- add `"@poe/core": "workspace:*"` and run `pnpm install`. `tsconfig.tools.json` and eslint already cover the script.
- `.claude/skills/tracked-json/scripts/lookup.test.ts` -- `:328` pins `[null]`, so rewrite it. The synthetic weights builders are at the top, and *the committed data/* is at `:443`.
- `.claude/skills/tracked-json/SKILL.md` -- `:11` (six checks + `unvalidated`, deferred `:311`), loop step 4 (hybrid reference: all lines, banded or valueless per line, FR-22 per hybrid tier), 4b (a hybrid-shared `statId` is never offered as a single-line band that meets a hybrid tier, so offer the hybrid; a statId in both slots is a summed pair per AD-16 / IN §2.1, and a valueless line or a missing bound is invalid), step 5 (`needs(hybrid)` is §8), interactive steps 2 and 5.
- `data/tracked.json` -- copy the 6 Bows suffix refs from existing Bows entries. Hybrid shape: `HybridModifierRefSchema` (`packages/contracts/src/modifier-ref.ts`).
- `packages/web/src/list/short-forms.ts` -- add the accuracy form. `tracked.data.test.ts` checks coverage and the 448px fit.
- `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md:806` §5.1d, `fixtures/tracked.json`, `fixtures/README.md` (*What is recorded today*) -- the capture. The recorder needs `POE_SYNC_USER_AGENT` (`.env.example`). Fixture-backed tests: `packages/sync/src/pricing/price-entry.fixtures.test.ts`, `dry-run.test.ts`, `fixtures-record.test.ts`.
- `docs/stories/deferred-work.md:305-307`, `:311-313` -- remove both in the last commit.

## Tasks & Acceptance

**Execution:**
- [x] `packages/core/src/probability.ts` (+ index, test) -- `untrackableReason`.
- [x] `package.json`, `pnpm-lock.yaml` -- the `@poe/core` dev dependency.
- [x] `lookup.ts`, `lookup.test.ts` -- the matrix rows, plus committed-data tests for Time-Lost_Diamond and the Bows hybrid.
- [x] `SKILL.md` -- the CAP-5 rewrites and deferred `:311`.
- [x] `short-forms.ts`, `data/tracked.json` -- through the skill loop, then `pnpm tracked:check`.
- [x] `fixtures/tracked.json`, one `pnpm fixtures:record`, §5.1d -- the capture.
- [x] `deferred-work.md` -- drop the two entries.

**Acceptance Criteria:**
- Given the new `data/tracked.json`, when `pnpm tracked:check` runs, then `ok: true`, `cross-file` passes, and `unvalidated` has no Bows entry.
- Given the repo, when `pnpm check`, `pnpm test` and `pnpm test:data` run, then all pass.
- Given `SKILL.md`, when it is read, then no step tracks one line of a hybrid or drops a row for a `null` line, and every drafted crafted entry names both slots.

## Implementation Notes

- Bows holds 5 distinct suffix references, not the 6 the Decisions text counts, so the hybrid prefix is crossed with 5 suffixes and 5 entries were added. Every suffix already tracked on Bows is covered.
- `ModifierRow.untrackable` rows also carry `sourceModifierId`, to name the tier.
- The re-record of `fixtures/trade-*` moved market data: the median expectation for the existing entries changed (0.1107 to 0.3119) beside the new summed entry. The review diff left the recorded `trade-*` files out.
- The `+` in the `+Accuracy` short form is the Decisions text's wording.

## Spec Change Log

## Review Triage Log

Layers: blind-hunter (12), edge-case-hunter (5), verification-gap (1 + 1 aside), deferred-ledger-audit (0).

| # | Finding | Verdict | Route | Evidence |
|---|---------|---------|-------|----------|
| 1 | Spec counts 6 Bows suffixes, data has 5 (blind, edge, gap) | false | rejected | Bows has exactly 5 distinct suffix references, so "each suffix already tracked" gives 5. No entry is missing. The count sits in the frozen block, which review does not edit. Noted under Implementation Notes. |
| 2 | `check.data.test.ts` does not pin `unvalidated` (gap) | medium | patch | The AC says `unvalidated` has no Bows entry, and only a manual run checked it. Added a Bows assertion to `check.data.test.ts`. |
| 3 | `trackable: true` beside `statIds: []` (blind) | low | rejected | The matrix and the null-line rule set it, and `SKILL.md` offers only rows with a non-empty `statIds`. The fix adds a field, and no row of the committed data has it. |
| 4 | `SKILL.md` contradicts itself on a mixed family (blind, edge) | false | rejected | Step 3 refuses the untrackable tier, and the offer rule refuses the whole family. Both match the matrix row `trackable: false`. The stricter reading is the documented one. |
| 5 | `tiers` leaves family filtering to the agent; lineSet does not identify a family; which statId to pass (blind, edge) | false | rejected | The spec's `tiers` row is `lineSet` and `untrackable`, and SPEC defines a family as (slot, line set), not by modGroup. Rows carry `slot` and `modGroup`. |
| 6 | Weak `tierLabel` type, long inline type, undocumented `sourceModifierId` (blind) | low | rejected | Cosmetic. It names no harm, and the output is JSON for the agent. |
| 7 | Test builds `statIds` with `toSorted()` (blind) | false | rejected | The input order there is already sorted, but the matrix row `Hybrid` (T1 lines B, A) and the core `lineSet` test pin the sort. |
| 8 | `nullLineWeights` hard-codes `schemaVersion` (blind) | false | rejected | The file's other builder (`:110`) does the same. It is the local convention. |
| 9 | §5.1d carries revision narrative and undefined `P1`/`S1` labels (blind) | low | patch | The opening read as history, and the tier tags were not defined. Reworded in place and defined the tags from the fetch fixture. |
| 10 | Sum proof is prose, ten cheapest items, upper edge not shown (blind) | low | rejected | §5.1d claims the lower bound only, and the spec asks whether the result proves the sum. A decoding test adds infrastructure for no named harm. |
| 11 | Re-record changed other fixtures without explanation (blind) | low | rejected | The spec allows the re-record and requires fixing the tests it breaks. `fixtures/README.md` and the test comment record the change. |
| 12 | Empty bookkeeping sections; the `+` in `+Accuracy` (blind) | false | patch | The notes are now filled in. The short form is the Decisions text's own. |
| 13 | Hybrid band overlaps pure families on shared statIds (edge) | false | rejected | CAP-4's overlap check and `tracked:check` cross-file pass, and no pure T1/T2 tier meets the hybrid intervals. The price population is SPEC's accepted risk. |

## Verification

**Commands:**
- `pnpm tracked:lookup mods --class Bows --slot prefix` / `--class Time-Lost_Diamond` -- expected: matrix rows.
- `pnpm tracked:check`, `pnpm check`, `pnpm test`, `pnpm test:data` -- expected: pass.
