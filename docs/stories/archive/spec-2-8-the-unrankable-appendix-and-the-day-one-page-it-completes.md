---
title: 'Story 2.8: The Unrankable appendix, and the day-one page it completes'
type: 'feature'
created: '2026-09-27'
status: 'done'
baseline_revision: 'c6b576c9f21a9937bbbfd1528afdd7b880785808'
route: 'dispatch'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The page has no `{components.unrankable-appendix}`. In the absent-weights world (AD-24, state 15), every crafted Item Class goes unmentioned, so the launch page shows a shorter list without saying what it leaves out. The committed page also lacks the empty appendix (state 37) between the list and the key block.

**Approach:** `core`'s `rank` returns the Unrankable Item Classes with their reason (spine: "`core` distinguishes the causes"). `web` renders them in a foot-pinned, four-cell appendix that leads `PageTail`, in every data state. Epic 2 produces one reason only: `class absent from weights file`, when `weights.json` is absent.

## Boundaries & Constraints

**Always:**
- One appendix row per distinct non-pruned crafted `(categoryId, className)`. The label is `className`, sorted by UTF-8 code unit, as the `weights-absent` record in `contracts/src/sync-run-report.ts` sorts. It is never a Base Type.
- The row is only produced when `weights` is `null`. When a weights envelope is loaded, the appendix holds no row, and the string never prints (FR-4, FR-9).
- The title is `Appendix: Unrankable — <N> Item Classes`. The count is rust when N > 0 and `ink` when N = 0. Singular: `1 Item Class`.
- Empty (state 37): the title alone. No lead, no rows, padding `16px 20px 16px`. It never says why it is empty.
- Non-empty: DESIGN.md `unrankable-appendix` exactly. Padding `16px 20px 10px`, `paper-inset`, hairline border. Rows are 29px, with cells 292/118/250/310 taken from `columnSums.appendix`. `unit-glyph-class` leads the first cell. The reason is verbatim, and the last row has no rule.
- Every row renders, untruncated. The document grows and scrolls. Nothing shrinks, drops a column or hides the key block (UX-DR53).
- Order below the list: appendix, key block, running foot. `margin-top: auto` sits on the tail group. There is one arrangement in every data state.
- Rows are not interactive. They have no hover, no expand, no `role=button`, no `title` and no cursor change (UX-DR44).

**Never:**
- Reading `weights.bases`, or producing `pool partial` / `class disagrees with weights file`. Those are Story 3.6's.
- Any layout switch on a row count or a measurement.
- Editing `packages/web/vite.config.ts`, or re-deferring the appendix design.
- Invented copy for the empty case.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Committed | weights present, recipes `[]` | title `— 0 Item Classes` in ink, no rows | N/A |
| Absent weights | weights `null`, 29 crafted classes | 29 rows, each `class absent from weights file`. The count is 29 in rust. The page scrolls, and the key block and foot sit below | N/A |
| Absent weights and absent recipes | both `null` | the same as absent weights (the claim is still true) | N/A |
| Duplicate class | two crafted entries on one `(categoryId, className)` | one row | N/A |
| Pruned only | a class whose entries are all pruned | no row | N/A |
| No crafted entries | weights `null`, raw only | the empty treatment | N/A |
| Loading | skeleton | no appendix (no count is known yet) | N/A |

## Decisions

- **No state-16 note in Epic 2** (human, 2026-09-27): "Base Type name is enough for the player, no need to show class name." A raw row already names its Base Type. The page does not relate a raw base to its Item Class, and the note cell stays empty. This amends the epics AC "the note names that fact". Append a deferred-work entry saying the AC edit is owed. No class-membership source is built.
- **Mark cell** (human, 2026-09-27): every `class absent from weights file` row carries `TrustMark kind="unknown"` with the word `unknown`, as the mockup shows. The key block's `absent: partial pool` gloss does not describe these rows. Append a `[NOTE FOR UX]` deferred-work entry for that gloss.
- **Lead** (human, 2026-09-27): the non-empty appendix prints `Tracked, but kept out of the ordering.` in `appendix-lead`, `ink-secondary`, with margins `5px 0 12px`. The empty appendix prints no lead.
- **Scope kept whole** at about 2,000 tokens (human, 2026-09-27).

</frozen-after-approval>

## Code Map

- `packages/core/src/rank.ts` -- `RankInput` (L38), `Ranking` (L60), `rank` (L111). Add `areWeightsLoaded: boolean` to the input, and `unrankable: readonly UnrankableClass[]` (`categoryId`, `className`, `reason`) to the output. `rank` skips crafted entries today (L119). Keep the raw branch unchanged. Export the new type from `core/src/index.ts`.
- `packages/web/src/App.tsx` -- `ReadyList` (L107) calls `rank`. `PageTail` (L144) owns `marginTop: 'auto'`. The appendix leads it in `ready` and is absent in `pending`. Pass the ranking's `unrankable` up from `ReadyList`, or compute the ranking once in the `ready` branch.
- `packages/web/src/theme/tokens.ts` -- `spacing.appendixRowHeight` 29, `columnSums.appendix` (L185), and `typeRoles['appendix-title'|'appendix-lead'|'appendix-row']` (L260). `committedChrome` already charges the appendix 306px, so the budget needs no change.
- `packages/web/src/list/UnitGlyph.tsx` (`unit="class"`), `TrustMark.tsx` (`unknown`) and `KeyBlock.tsx` -- reuse as they are.
- `packages/web/src/load/artifacts.ts` -- `ArtifactSet.weights` is `null` when absent (L83).
- `packages/web/src/test-support/artifact-server.ts` -- `serveArtifacts`, `VALID_BODIES`, and 404 for an absent artifact. `list-fixtures.ts` -- `bodiesWith`.
- `mockups/key-hero-resting.html` L300-326 and L480-495 -- the CSS and markup of the appendix.

## Tasks & Acceptance

**Execution:**
- [x] `packages/core/src/rank.ts` (+ `rank.test.ts`) -- the `unrankable` output. It covers the matrix rows for dedupe, pruned-only, raw-only and weights-loaded.
- [x] `packages/web/src/list/UnrankableAppendix.tsx` (+ `unrankable-appendix.test.tsx`) -- the empty and non-empty treatments, the singular count, and the non-interactive rows.
- [x] `packages/web/src/App.tsx` -- render the appendix in `PageTail` for `ready`.
- [x] `docs/stories/deferred-work.md` -- append the two entries from Decisions: the owed state-16 AC edit, and the `[NOTE FOR UX]` on the key-block gloss.
- [x] `packages/web/src/App.test.tsx` -- end to end: the committed empty appendix; an absent-weights fixture with 29 classes, all rows present, in DOM order appendix → key → foot; the string never shown while weights load; the interaction guard extended to the appendix rows.

**Acceptance Criteria:**
- Given any ready state, when the page renders, then the appendix count is readable with nothing expanded.
- Given `pnpm check` and `pnpm test`, when they run, then both pass with no escaped request.
- Given the absent-weights fixture served with `pnpm dev`, when agent-browser (named `--session`) takes a full-page screenshot, then all 29 rows show, the page scrolls, and the key block and foot sit below the appendix.

## Implementation Notes

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 27 findings — high 0, medium 4, low 16, false 7, maybe-false 0
- findings:
  - `low` `reject` Edge: a long className overflows its 292px cell (`nowrap`, no clip) — the longest Item Class names (e.g. `Thrusting One Hand Swords`) fit 292px at serif 13px; the fix adds a guard for a case the data does not reach.
  - `low` `patch` Edge: the "both failure screens" test covers only `refused` — added a separate `failed` (network-error) test asserting no appendix.
  - `false` `reject` Edge: the appendix is absent from the skeleton, against "every data state" — the matrix Loading row rules no appendix while pending ("no count is known yet").
  - `false` `reject` Intent: geometry, scroll and physical order are exercised only in jsdom — the agent-browser full-page screenshot of the absent-weights world shows 29 rows with the key block and foot below.
  - `medium` `patch` Intent: the reason and note cells hard-code mockup type (sans 11.5/10.5px) against DESIGN.md "Appendix rows set in `{typography.appendix-row}`" — removed the overrides; both cells inherit `appendix-row`.
  - `false` `reject` Intent: hover and cursor are checked only inline, not computed — the rows are plain classless `div`s and no stylesheet targets them.
  - `false` `reject` Intent: the empty appendix keeps its panel chrome — DESIGN.md `emptyState` says "the panel keeps its place" and the padding is specified.
  - `false` `reject` Intent: the committed-row result comes from `areWeightsLoaded`, not from empty recipes — the matrix expectation holds, and Epic 2 does not read recipes by design.
  - `false` `reject` Intent: the `categoryId` tiebreak extends the stated sort — it only fixes the order of ties that `className` alone leaves undefined; no outcome differs from the cited sort.
  - `low` `patch` Intent: `sprint-status.yaml` reads `ready-for-dev` — set to `done` at finalize.
  - `low` `patch` Blind: `epic-2-context.md` keeps the revoked state-16 note rule — replaced it with the decision and a pointer to the owed edits.
  - `medium` `patch` Blind: DESIGN.md *Where a class's Base Types still rank* still prescribes the note, and no ledger entry names it — extended the story 2.8 deferred entry with a `[NOTE FOR UX]` naming that DESIGN.md passage.
  - `low` `patch` Blind: `epic-2-context.md` says `recipes.json` is absent and the empty appendix relies on an absence line — corrected to "holding no recipe" and dropped the false reason.
  - `low` `patch` Blind: `epic-2-context.md` sums the six reservations as 200px — corrected to 179px (74 + 5 × 21).
  - `low` `patch` Blind: the status fields disagree — grouped with the sprint-status row; set to `done` at finalize.
  - `low` `reject` Blind: the execution checkboxes and verification record are empty — the fix edits this build's spec.
  - `low` `reject` Blind: the AC names `pnpm dev` while the manual check names `vite preview` — the fix edits this build's spec.
  - `low` `reject` Blind: two classes sharing a className on different categoryIds show as two identical rows — the spec rules one row per `(categoryId, className)`, and no tracked data shares a className across categories.
  - `medium` `patch` Blind: the reason and note cells hard-code type values — grouped with the Intent typography row; same fix.
  - `low` `reject` Blind: the "truncates nothing" test checks only inline overflow — grouped with the Edge overflow row; same reason.
  - `low` `patch` Blind: only one failure screen is tested — grouped with the Edge failure-screen row; same fix.
  - `low` `patch` Blind: the pending test opens its gates without awaiting the settle — the test now awaits `settleTo('ready')`.
  - `low` `patch` Blind: the 29-class fixture is already sorted — served in a stride-7 order, and the test asserts the served order is unsorted and the page order is sorted.
  - `false` `reject` Blind: the 306px appendix budget line is not checked against rendered heights — it is DESIGN.md's committed budget line, which this story does not change, and the frame is `min-height`, so a taller appendix grows the document.
  - `low` `patch` Blind: `ReadyList` is misnamed now that it renders the tail — renamed to `ReadyBody` (Serena `rename_symbol`), docstring updated.
  - `medium` `patch` Verification gap: no test asserts the appendix in the honest-empty and nothing-clears ready states — `expectChromeAround()` now checks `data-unrankable-appendix`.
  - `low` `patch` Verification gap: the tail's position as a direct flex child of the frame is untested — the committed and pending tests assert `[data-page-tail]`'s parent is the frame.

## Verification

**Commands:**
- `pnpm check` -- expected: clean.
- `pnpm test` -- expected: green, with no escaped request.

**Manual checks:**
- Run `pnpm dev` in the background. With agent-browser, take screenshots of the committed page (the empty appendix) and of the absent-weights world (for example, a fixture `weights.json` renamed away in a scratch copy, served through `pnpm exec vite preview` over a built `dist` with `weights.json` removed). Then stop the servers.

## Auto Run Result

Status: done
Accepted by the human on 2026-09-27.

**Summary.** `core`'s `rank` takes `areWeightsLoaded` and returns `unrankable`: one `class absent from weights file` entry per distinct non-pruned crafted `(categoryId, className)` when no weights envelope is loaded, and none otherwise. `web` renders `UnrankableAppendix` at the head of `PageTail` in every ready state, in both the empty (state 37) and non-empty treatments. The appendix, key block and foot stay under one `margin-top: auto`.

**Files changed.**
- `packages/core/src/rank.ts`, `index.ts`: the `areWeightsLoaded` input, the `UnrankableClass` / `UnrankableReason` types and the `unrankable` output.
- `packages/core/src/rank.test.ts`: dedupe, pruned-only, raw-only, weights loaded, a shared className, code-unit sort and shuffle stability.
- `packages/web/src/list/UnrankableAppendix.tsx` (new) and `unrankable-appendix.test.tsx` (new): the component and its unit tests.
- `packages/web/src/App.tsx`: `ReadyBody` ranks once and renders the tail with the appendix.
- `packages/web/src/App.test.tsx`: end-to-end coverage of every matrix row, the failure screens, the list-statement states and the tail's parent.
- `packages/web/src/theme/tokens.ts`, `tokens.test.ts`: the appendix padding and lead tokens, and a width-sum check.
- `packages/web/src/test-support/list-fixtures.ts`: `craftedEntry`; `bodiesWith` accepts any `TrackedEntry`.
- `packages/web/src/list/{display-rows,expansion,list-statement,ranked-list}.test.*`: pass `areWeightsLoaded: true`.
- `docs/stories/deferred-work.md`: the two story 2.8 entries (the second now names DESIGN.md as well) and a "Resolved by story 2.8" line.
- `docs/stories/epic-2-context.md`: the recompiled epic context, with review corrections.
- `docs/stories/sprint-status.yaml`: 2.8 → `done`.

**Review.** 27 findings: 14 routed to patch (4 medium, 10 low, including the grouped rows), 0 deferred, 13 rejected (7 false, 6 low). Each reason is in the Review Triage Log.

**Follow-up review recommended: false.** Three medium entries were patched on this first pass: the appendix-row typography, the DESIGN.md ledger note and the list-statement appendix assertion. The one named risk was that the typography patch was not re-screenshotted; the human checked the font on 2026-09-27 and found no issue. The other two patches are a ledger line and a test that ran green, so no unverified risk remains.

**Verification.** `pnpm check` is clean: tsc, eslint and depcruise. `pnpm test` passes 87 files and 1134 tests, with no escaped request. Before the review patches, agent-browser (a named session) took full-page screenshots. On the committed page, the title alone reads `— 0 Item Classes`. In the absent-weights world (a scratch build, `weights.json` removed, 29 crafted classes), all 29 rows show, and the key block and foot sit below them.

**Residual risks.** `areWeightsLoaded` is required, so every future `rank` caller must set it. A className wider than 292px would spill into the mark cell, and today's class names do not reach that width.
