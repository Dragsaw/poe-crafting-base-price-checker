---
title: 'Epic 4 retro item 6: one trust vocabulary, trust-facts split, trust derivation in core'
type: 'refactor'
created: '2026-10-10'
status: 'done'
baseline_commit: '5973e6cab2ef5f4bb6a8e95deb4e89356a865981'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-4-retro-2026-10-10.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 4 retro (action item 6; findings A1–A5, R9) found duplicated price-trust vocabulary in `web`: three minute/hour/day age ladders plus a fourth spelling, ms constants in both core and web, the ` · ` joiner as three constants and three literals, a dead second phrase set for price states, the mark-and-word render twice with a redundant `current` test, a 338-line `frame/trust-facts.ts` doing six jobs, and web deriving "below threshold" from the verdict and reading the price back from the dataset while core exports trust helpers nothing else uses (AD-17 forbids web deriving trust).

**Approach:** Pure refactor, no visible change. One age ladder with three spellings; one joiner; one money phrase; one trust-word render; `trust-facts.ts` split by job; core puts the combination price on its output, and its trust helpers leave the public API.

**Decision (A3, phrase set):** The *Price trust* table and Copy Deck of `EXPERIENCE.md` rev 27 are canonical (`not checked yet`, `gone after a patch`). `MONEY_PHRASES` cites the retired *Money slots* section; only `no figure yet` still prints (Craft Cost uncostable, state 35). It becomes one constant; the other four phrases are deleted. No owner-doc edit.

## Boundaries & Constraints

**Always:** Every rendered string and DOM order stays byte-identical, except that a wrapper `span` may be added inside a tooltip. Existing tests keep their assertions; only imports and module paths change, plus new tests for new behavior. Dependency direction per AD-1 (web → core allowed). Comments follow the AGENTS.md three-line rule.

**Never:** No change to ranking, verdicts or thresholds. No new wording, and no ruling on R14 (`tried 0 min ago`) or the unruled `Last synced` spelling. No edit to `EXPERIENCE.md`, `DESIGN.md`, the PRD or the spine. Do not touch `packages/web/vite.config.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Below-threshold combination | crafted row, entry priced in active league at < threshold | core sets `priceDivine`; web line shows price and `below threshold` | N/A |
| Unpriced combination | pending or broken entry | no `priceDivine`; web line `—` beside mark and word | N/A |
| Other-league price | `priced` observation from another league | no `priceDivine` (core uses `resolvedPrice`) | N/A |
| Recipeless class | priced entry | `priceDivine` set; web shows price, `isBelowThreshold` false | N/A |
| Ages | each boundary in `shared/time.test.ts` | identical output | N/A |

</frozen-after-approval>

## Code Map

- `packages/web/src/shared/time.ts` -- `relativeAge`, `reasonAge` (from minutes), `compactAge`: three copies of the < 1 min / < 1 h / < 1 day ladder; exports `MINUTE_MS`/`HOUR_MS`/`DAY_MS` (used by tests in `App/sync-report.test.tsx`, `frame/trust-facts.test.ts`).
- `packages/core/src/price-trust.ts:4-12` -- thresholds (public) and private ms constants; `entryTrust` :53, `craftedTrust` :103.
- `packages/core/src/index.ts:25-32` -- exports `craftedTrust`, `entryTrust`, `OLD_AFTER_HOURS`, `THIN_BELOW_LISTINGS`, `UNRELIABLE_SHARE_MIN`, `CraftedTrustEntry`, `CraftedTrustInput`; no importer outside core.
- `packages/core/src/rank-crafted-row.ts:55-84` `scanSummands` -- knows `priceDivine` for below-threshold combinations (:76-79) but drops it. `rank.ts:229-232` -- recipeless combinations from `entryTrust`.
- `packages/contracts/src/ranked-row.ts:64-69` -- `CraftedCombinationSchema` `{entryKey, trust}`.
- `packages/web/src/list/display-rows.ts` -- `storedPrice` :151 and `isPriced` :155, used in `craftedDetail` :170-171 and `recipelessRows` :235. `hasNoFigure` :30 stays (prints `—` from the verdict).
- `packages/web/src/list/row/trust-words.ts` -- `TRUST_JOINER` :7, `'old'` spelling `priced N days ago` :31, `trustParts` :52.
- Joiner constants: `list/combination-text.ts:25` `AFFIX_JOIN`, `list/UnrankableAppendix.tsx:23` `NOTE_JOINER`; literals: `list/format.ts` `sellAsIsLine`, `frame/trust-facts.ts` `diagnosisLine`, `list/FooterLegend.tsx:22`. `TRUST_JOINER` importers: `ExpansionLine.tsx`, `ExpansionPanel.tsx`, `RankedRow.tsx`, `row/ExpectedValueTooltip.tsx`, `row/MarkSlot.tsx`.
- `packages/web/src/list/format.ts:7` `MONEY_PHRASES` -- users: `recipe/recipe-view.ts:28`, tests `format.test.ts`, `recipe/recipe-view.test.ts`, `recipe/craft-recipe/crafted-states.test.tsx`.
- `list/row/MarkSlot.tsx` `MarkTooltipLabel` + :37 and `list/expansion/ExpansionLine.tsx` `TrustCell` :75-90 -- the two mark-and-word renders, each re-testing `verdict === 'current'`.
- `packages/web/src/frame/trust-facts.ts` -- jobs: copy deck (:14-51), UTC dates and header facts (:56-99), segment model incl. `ProblemMark` (:112-146), problem rule (:100, :153-208), sync-button face (:209-226), panel layout (:227-338). Importers: `header-controls.tsx`, `SyncButton.tsx`, `SyncReportPanel.tsx`, tests `trust-facts.test.ts`, `trust-facts-pruned.test.ts`, `sync-report-panel.test.tsx`, `App.test.tsx`, `App/list-statement.test.tsx`, `App/sync-report.test.tsx`, `App/unresolvable-hand-off.test.tsx`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/core/src/clock.ts` (new), `price-trust.ts`, `index.ts` -- define `MINUTE_MS`/`HOUR_MS`/`DAY_MS` once in core and export them; drop the trust helpers and thresholds from `index.ts` (core-internal imports stay) -- A1, R9.
- [x] `packages/contracts/src/ranked-row.ts` -- add optional `priceDivine` to `CraftedCombinationSchema`: the active-league price, set only when the entry is priced -- R9.
- [x] `packages/core/src/rank-crafted-row.ts`, `rank.ts` -- set `priceDivine` on priced combinations (below-threshold and recipeless); core tests cover all four matrix rows -- R9.
- [x] `packages/web/src/list/display-rows.ts` -- read `combination.priceDivine`; `isBelowThreshold` = present on a crafted row; delete `storedPrice` and `isPriced` -- R9.
- [x] `packages/web/src/shared/time.ts` -- one ladder function (count + unit, or under-a-minute) taking ms; the three spellings render from it; ms constants come from core; callers pass ms (`reason.minutes * MINUTE_MS`, `reason.days * DAY_MS`) -- A1.
- [x] `packages/web/src/shared/text.ts` -- one exported `JOINER`; replace the three constants and three literals listed in the Code Map -- A2.
- [x] `packages/web/src/list/row/trust-words.ts` -- `'old'` spells through the ladder; `TrustParts` carries the marked verdict so callers need no `current` test -- A1, A4.
- [x] `packages/web/src/list/row/TrustWords.tsx` (new), `MarkSlot.tsx`, `expansion/ExpansionLine.tsx` -- one word + joiner + reason render, keeping each caller's data attributes and weight -- A4.
- [x] `packages/web/src/list/format.ts`, `recipe/recipe-view.ts`, `row/trust-words.ts` -- replace `MONEY_PHRASES` with `NO_FIGURE_YET`; the uncostable reason composes it -- A3.
- [x] `packages/web/src/frame/` -- split `trust-facts.ts` into `trust-copy.ts`, `header-facts.ts`, `segments.ts`, `problem-summary.ts`, `sync-button-face.ts`, `panel-columns.ts`; split its tests the same way; update importers; delete `trust-facts.ts` -- A5.
- [x] `docs/stories/sprint-status.yaml`, `docs/stories/epic-4-retro-2026-10-10.md` -- item 6 `done`, with a status line like item 2's.

**Acceptance Criteria:**
- Given the change, when `pnpm check` runs, then it passes (knip finds no unused export, depcruise no violation).
- Given the change, when grepping `packages/web/src` for `' · '`, then only `shared/text.ts` defines it.
- Given the change, when grepping for `MINUTE_MS =`, then only `core/src/clock.ts` defines it.
- Given `@poe/core`'s public API, when listing its exports, then no trust helper or threshold is among them.
- Given the dev server on committed data, when the agent browser opens the page, then the header, a row mark tooltip, an expansion panel and the sync report panel read as before.

## Implementation Notes

- `RecipelessClass.combinations` reuses `CraftedCombination`; a recipeless line carries `priceDivine` when priced, and web never marks it below threshold.
- The frame split adds `test-support/sync-report-fixtures.ts` for the fixtures its four test files share.
- Test edits beyond imports, each forced by a spec signature change: `reasonAge` inputs in ms, `verdict` in two `TrustParts` expectations, the `MONEY_PHRASES` test replaced by a `NO_FIGURE_YET` test, `priceDivine` in hand-built `Ranking` fixtures.
- Verification after the last review fix: `pnpm check` 8/8; agent browser on committed data (sync button, sync report panel, ◐ tooltip at 600, `Sell as is · item level 82+`, Wands expansion with 13 `below threshold` lines priced from core, `pending · tried N … · no listings`), no console errors.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence / route |
|---|---|---|---|---|
| 1 | blind | Item 6 set `done` in tracking while the spec is in review | low | Real, but the commit lands only after human acceptance in step 5; the fix would reorder spec tasks. Rejected |
| 2 | blind | Spec records no verification | low | Fix edits this build's spec. Rejected; step 5 records it |
| 3 | blind, verification-gap | `' · '` AC fails: `chase-count.ts:7` `CHASE_BUDGET_TEXT`, `UnrankableAppendix.tsx:17` appendix note | low | Confirmed; both are joined copy. patch: compose from `JOINER` |
| 4 | blind | Core `chunk-order.ts:7` hand-rolls a day; sync hand-rolls hour/day spans | low | Core half real (same package as `clock.ts`): patch. Sync is outside A1 (core and web): rejected |
| 5 | blind, edge-case | `'old'` reason prints differently for `days` < 3 | low | Core emits `old` only from 72 h (`price-trust.ts:43`), so unreachable; the old text read `1 days ago`. Rejected |
| 6 | blind | `priceDivine` means below-threshold on crafted rows, priced on recipeless | low | Web reads no verdict to split; the container decides, and a recipeless class has no threshold. No named harm. Rejected |
| 7 | blind | Schema does not refine `priceDivine` against the verdict | low | Adds a refinement for a state core never produces. Rejected |
| 8 | blind | Recipeless path calls `resolvedPrice` twice | low | Same pure function, same inputs; cannot drift. Rejected |
| 9 | blind | Two tests keep local fixtures the new support file exports | low | Test-only duplication; the fix adds churn. Rejected |
| 10 | blind | Module JSDoc in `trust-copy.ts` attaches to `UNKNOWN` | low | Confirmed; direct correction. patch (the `time.ts` block keeps its pre-existing form). The label exports are needed across the split modules |
| 11 | blind | Import order; `import { type AffixPart }` in `CombinationText.tsx` | low | Order passes lint: rejected. Inline type import confirmed: patch to `import type` |
| 12 | blind | Retro status line covers only the phrase decision | low | Confirmed; direct doc edit. patch (orchestrator) |
| 13 | edge-case | Spec says tests keep their assertions, but some changed | low | Each change is forced by the spec's own signature changes (ms `reasonAge`, `TrustParts.verdict`, `MONEY_PHRASES` removal). Fix edits the spec. Rejected |
| 14 | edge-case | `price-trust.test.ts:9` defines its own `HOUR_MS` | low | Confirmed; direct correction. patch: import from `./clock.ts` |
| 15 | verification-gap | Expansion-line trust word colour and weight unasserted after the move to `TrustWords` | medium | Pre-verified gap. patch: assert colour and empty weight in `raw-base-combination-row.test.tsx` |

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0.

**Manual checks (if no CLI):**
- Agent browser (named session, `pnpm dev --port <n>`, then `pnpm dev:stop --port <n>`): sync button text, sync report panel, a ◐ mark tooltip, an expansion line with `below threshold` and a price, the Raw Base `Sell as is · item level N+` line.
