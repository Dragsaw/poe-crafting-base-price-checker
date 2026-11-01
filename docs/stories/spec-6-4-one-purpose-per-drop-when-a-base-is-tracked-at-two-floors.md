---
title: 'Story 6.4: One purpose per drop when a base is tracked at two floors'
type: 'feature'
created: '2026-11-01'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-6-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Two non-pruned Raw Bases of one `baseTypeId` at different Item Level Floors each emit entries. A drop at or above both floors matches two Show blocks, and the game applies the first one. So a high-item-level drop can show the purpose of the cheaper tier, which breaks FR-36 (PRD revision 36: a drop belongs to the Raw Base with the highest floor it reaches).

**Approach:** `pickUpPurposes` (`core`) groups the non-pruned Raw Bases of each `baseTypeId` by floor. Each tier except the highest gets an upper bound `itemLevelMax` = next floor − 1, and each entry is clipped to its tier's range. An entry whose range is empty after clipping is dropped. `filterText` (`web`) writes `ItemLevel <= n` when `itemLevelMax` is present. With one Raw Base per `baseTypeId`, as `data/tracked.json` holds today, no entry has `itemLevelMax` and the text is byte-identical to the Story 6.2 golden text. The Story 6.4 ACs are in `docs/epics.md`.

</frozen-after-approval>

## Implementation Notes

**Files.**
- `packages/core/src/pick-up/pick-up.ts`: add optional `itemLevelMax` to `PickUpEntry`. `rawBaseEntries` takes the tier's upper bound and drops an entry whose `itemLevelMin` (after the class-floor raise) exceeds it. `pickUpPurposes` computes each Raw Base's upper bound from the sorted distinct floors of the non-pruned Raw Bases that share its `baseTypeId`. Pruned bases are skipped before grouping, so a pruned higher tier leaves the lower tier unbounded (AC 4). FR-36 stays only in this file (AD-31).
- `packages/web/src/pick-up-filter/filter-text.ts`: `showBlock` writes `ItemLevel <= n` right after `ItemLevel >= n` when `itemLevelMax` is defined. The field holds no rule of its own.
- `packages/core/src/pick-up/pick-up.test.ts`: a `describe` for Story 6.4 with one test for each epic AC that `core` can observe. Cover these four cases. (1) Both tiers sell raw: the ranges are disjoint and each tier has its own purpose. (2) The higher tier gives no purpose: that tier has no entry, and the lower tier stops at the higher floor − 1. (3) The lower tier is craft with a class floor ≥ the higher floor: the lower craft entry is dropped, and the higher tier's purpose covers its drops. (4) The higher tier is pruned: the lower tier is unbounded. Also check three tiers and the magic rarity. The AC 9 field-allow-list test adds `itemLevelMax`.
- `packages/web/src/pick-up-filter/filter-text.test.ts`: replace the "open FR-36 case" pinning test with a test that writes `ItemLevel <= n` for a bounded entry and none for an unbounded one. Leave the Story 6.2 golden test unchanged (AC 5). Add a test that feeds the output of `pickUpPurposes` for a two-floor pair to `filterText`, so that the two layers are checked together (AC 1).
- `docs/stories/deferred-work.md`: in the last commit, remove the spec-6-1 FR-36 entry and the first spec-6-2 entry (the shadowing entry). Remove the `## Deferred from: spec-6-1 review` heading as well, because it is then empty. Keep the impeccable-script entry.

**Decisions.** The bound is inclusive (`<=`), so each block states its own range. Two Raw Bases of one `baseTypeId` cannot share a floor, because the raw canonical key is `baseTypeId` + `itemLevelMin` and `checkUniqueKeys` rejects a duplicate. The distinct floors therefore always give a non-empty range to each tier's own floor. Order stays by canonical key, then rarity. The ranges are disjoint, so order no longer selects the purpose.

**As built.** `pick-up.ts` adds `itemLevelMaxByKey`, and `rawBaseEntries` takes the bound. The new tests went over `max-lines` (300) in both test files. So the shared fixtures moved, unchanged, to `packages/core/src/pick-up/test-support.ts` and `packages/web/src/pick-up-filter/filter-text-support.ts`. The Story 6.4 tests are in `pick-up-floors.test.ts` (core) and `filter-text-floors.test.ts` (web, the cross-layer check). The Story 6.2 golden test is unchanged and passes, which covers AC 5.

**Agent browser checks:** These checks cover only the no-regression path. No shipped data has a two-floor pair, so the page cannot produce an `ItemLevel <=` line. The bounded path is covered by `filter-text-floors.test.ts` (from `pickUpPurposes` to `filterText`), and in the game by the 6.3 human acceptance step.
1. Start `pnpm dev` and open the app in a named session. Open the `Filter ▾` modal, enter a name, then download. Expected: the download succeeds, no console error occurs, and the file holds no `ItemLevel <=` line (`data/tracked.json` has one Raw Base per `baseTypeId`).
2. Close the modal, change the threshold, then download again. Expected: a valid file with the same shape as before, and no `ItemLevel <=` line.

**Verification:** `pnpm check` passes.
### Agent browser checks (after review)

Session `poe-79ae64f4395d`, run 2026-11-01 20:24–20:25 WEST against HEAD `0a7f0c3780a69733d240bf73a8ee8731f88f1358`, tree clean. `pnpm dev` ran on port 5173 and was stopped with `pnpm dev:stop`. The Blob text came from a hook on `URL.createObjectURL`, because the agent-browser `download` command reported the Blob download as canceled. A first run ended when the agent-browser daemon dropped (the page went to `about:blank`), so the whole list was re-run from a fresh page.

1. **Download:** pass. Name `NeverSink strict`, then download. The modal closed. 90 `Show` blocks, no `ItemLevel <=` line, last line `Import "NeverSink strict.filter"`, no page error. Screenshot: `C:/Users/ilyal/AppData/Local/Temp/claude/E--Program-Files-Jetbrains-Projects-poe-crafting-base-price-checker/0e427b17-1e4d-4bdd-a13c-d0546db0954a/scratchpad/6-4-check1-modal.png`.
2. **After a threshold change:** pass. With the threshold at 1.00 div, the lead names `1.00 div` with greater orbs. The download has 82 `Show` blocks, no `ItemLevel <=` line, the same `Import` line last, and no page error. Screenshot: `C:/Users/ilyal/AppData/Local/Temp/claude/E--Program-Files-Jetbrains-Projects-poe-crafting-base-price-checker/0e427b17-1e4d-4bdd-a13c-d0546db0954a/scratchpad/6-4-check2-modal.png`.

## Review Triage Log

Four layers ran: Blind Hunter, Deferred Ledger Auditor, Impeccable Design Reviewer and OCR Delegate.

- Ledger auditor: zero findings.
- Impeccable: zero findings. The script path that is missing from the prompt is already in the ledger as the spec-6-2 impeccable entry.
- OCR: two consecutive blank lines in `filter-text.test.ts`. low, patched. A duplicated `ITEM_LEVELS` constant across two test files. low, rejected: one line in each of two independent test files.
- Blind Hunter "the deferred-work removal is missing": false. Implementation Notes put the removal in the last commit of the branch, as AC 6 requires.
- Blind Hunter "the GitHub issues for the two entries are not handled": false. `gh issue list` shows no open issue for either entry, because both are `never — needs a human`.
- Blind Hunter "the web cross-layer test checks only the normal rarity, and does not check AC 3": medium, patched. `filter-text-floors.test.ts` now covers magic and a class row, and has an AC 3 case.
- Blind Hunter "`ALL` has no bounded entry": low, patched. `boundedCheck` was added, so the syntax-guard test and the AC 2 condition test see `ItemLevel <=`.
- Blind Hunter "the bounded line order is untested, and `?? ''` hides an empty treatment": low, patched. The test now asserts the whole bounded magic block.
- Blind Hunter "no test for an unpriced higher tier": low, patched. A `noListings` higher tier still bounds the lower one.
- Blind Hunter "magic clipping is untested when the higher tier has no purpose while the class is worth crafting": false. With EV(C) > 0, a white Raw Base is always craft or sell raw, so the case cannot happen. The three-floor case was patched to drop the lowest tier's magic entry and clip the middle one.
- Blind Hunter "`itemLevelMaxByKey` is quadratic and unsorted": low, rejected. The minimum of the higher floors equals the next sorted floor, and the list has about 90 entries.
- Blind Hunter "the browser checks cannot reach the bounded path": low, patched. The limit is stated under Agent browser checks.
- Blind Hunter "`filter-text-support.ts` sits beside production code": low, rejected. `core/src/rank/test-support.ts` sets the sibling convention, knip and the build pass, and Vite bundles only from the entry.
- Blind Hunter "spec-6-2 now contradicts the code": low, rejected. A done story spec is a record. Story 6.4 in `epics.md` and this frozen Intent own the new line.
