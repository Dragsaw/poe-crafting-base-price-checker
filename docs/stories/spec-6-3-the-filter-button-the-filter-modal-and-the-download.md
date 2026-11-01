---
title: 'Story 6.3: The filter button, the filter modal and the download'
type: 'feature'
created: '2026-11-01'
status: 'done'
baseline_commit: 'c52d1cb98f3f0eb25339eb9414b94376d01ec093'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-6-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Stories 6.1 and 6.2 decide each base's purpose and write the filter text, but the player has no way to get the file. Nothing on the page opens the filter, takes the Base Filter's name or downloads `crafting-bases.filter`.

**Approach:** Add `{components.filter-button}` to the header bar and `{components.filter-modal}` behind it. The download runs `pickUpPurposes` and `filterText` on the ranking on screen and hands the text to the browser as a `Blob`. Epic 6 Story 6.3 in `docs/epics.md` holds the acceptance criteria. This spec does not restate them.

## Boundaries & Constraints

**Always:**
- The owner documents decide: FR-35, AD-15, AD-24, AD-31, `EXPERIENCE.md` (Interaction 9, states 44–47, *What survives a reload*, Copy Deck *Pick-up Filter*), `DESIGN.md` (`header-bar`, `filter-button`, `filter-modal`, the header's width budget) and `mockups/key-filter-modal.html`. Where this spec and those documents differ, the documents win.
- Every string comes from the Copy Deck. The lead and the state 46 line name the threshold with `formatThreshold` and `DIV_UNIT`, and the recipe with its `recipeWord`, as the list statement does.
- The download passes the `Ranking` that `App` already built and the active recipe's id (`undefined` under state 43). It never passes a second threshold and never re-ranks.
- State 35 holds when `ranking.uncostableRecipes` names the active recipe. State 43 holds when no recipe is active. State 47 holds when `pickUpPurposes` returns no entry.
- Decision (agent): a name is checked after `trim()`. A trimmed empty name is state 44. `.filter` is present when the trimmed name ends in `.filter`, ignoring case. The import target is the trimmed name, with `.filter` added when missing.
- Decision (agent): the state 45 error is computed on blur. An edit hides it, and the next blur computes it again. The download's disabled state follows the current text at each keystroke.
- Decision (agent): the filter slot keeps a reserved width in every state, as the sync slot does. While pending, the slot is empty.
- The file name persists under its own storage key, read once at mount and written on each edit that leaves a usable name. Each access is guarded, as in `recipe-storage.ts`.

**Never:**
- No request, no File System Access API, no write other than the `Blob` download, the clipboard write and the storage key.
- No confirmation, toast or out-of-date mark after a download or a dial change.
- No transition on the modal or its overlay. No ARIA role, live region, keyboard path or focus styling beyond what Mantine's `Modal` gives (Accessibility Floor).
- No change to `core`, to `filterText`, or to an owner document. A conflict with an owner document goes to `docs/stories/deferred-work.md`.
- No rule for one base tracked at two floors. Story 6.4 owns it.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No extension | `My.filter` vs `My` | both import `My.filter` | N/A |
| Upper case | `My.FILTER` | imports `My.FILTER`, no second extension | N/A |
| Own name | `Crafting-Bases` | state 45, own-name error after blur | download disabled |
| Quote or folder | `a"b`, `a/b`, `a\b` | state 45, quote-or-folder error after blur | download disabled |
| Blank | `''`, `'   '` | state 44, no error | download disabled |
| State 43 | no recipe | lead without `with … orbs`; state 43 line | download enabled |
| States 35 and 47 | uncostable recipe, no entry | only the state 47 line | download enabled |
| Storage throws | `getItem` and `setItem` throw | empty field, page works | swallowed |

</frozen-after-approval>

## Code Map

- `packages/web/src/frame/HeaderBar.tsx` -- `HeaderSlot`, `HEADER_SLOTS`, `HEADER_SLOT_WIDTHS`. Add `filter` between `threshold` and `sync`. Its width is measured in the browser (DESIGN.md gives 64.4px for the button).
- `packages/web/src/App/header-bar.test.tsx:66-71` -- asserts the title's full width fits at content-min. DESIGN.md's width budget says the title cuts at content-min (952px inside the gutters), so the assertion becomes: the slots and gaps fit, and the title takes the rest.
- `packages/web/src/frame/header-controls.tsx` -- `readyControls` fills the slots. Add the filter slot. `ReadyControlsInput` already has `set`, `ranking`, `threshold` and the active `recipe`.
- `packages/web/src/frame/SyncButton.tsx` and `frame.css` `.fg-sync-button` -- the look the filter button reuses, with `OpenSignMark` from `marks/marks.tsx`.
- `packages/web/src/recipe/recipe-storage.ts` -- the guarded read and write pattern. `threshold-storage.ts:1-2` says the threshold is the only stored value, which is no longer true. Correct that comment.
- `packages/web/src/list/list-statement.ts` (`uncostableCopy`) and `shared/money.ts` (`formatThreshold`) -- the formatting the lead reuses.
- `packages/web/src/shared/ShowMore.tsx` -- accent-text action look for copy and download.
- `packages/web/src/threshold/threshold.css` `.fg-threshold-figure` -- the figure box the field reuses.
- `@mantine/core` 9.6.1 `Modal` (`transitionProps`, `overlayProps`, `size`, `centered`) and `@mantine/hooks` `useClipboard({ timeout })`.
- `pickUpPurposes` (`@poe/core`) and `filterText` (`packages/web/src/pick-up-filter/filter-text.ts`). Do not change them.
- `packages/web/src/App/test-support.tsx` -- renders the full `App` against the artifact server. Use it for the integration tests.

## Tasks & Acceptance

**Execution:**
- [x] `packages/web/src/pick-up-filter/filter-name.ts` -- name checks (states 44, 45), `.filter` completion, guarded storage read and write -- one owner of the field's rules
- [x] `packages/web/src/pick-up-filter/filter-copy.ts` -- the Copy Deck strings and the lead and state-line builders -- one owner of the modal's text
- [x] `packages/web/src/pick-up-filter/PickUpFilter.tsx` -- the button, the modal, the field, the copy action and the download (`Blob`, `URL.createObjectURL`, an `<a download="crafting-bases.filter">`, then `revokeObjectURL`) -- the one UI of the epic
- [x] `packages/web/src/frame/HeaderBar.tsx`, `frame/header-controls.tsx`, `frame/frame.css` -- the filter slot and the button look
- [x] `packages/web/src/threshold/threshold-storage.ts` -- correct the header comment
- [x] `packages/web/src/pick-up-filter/filter-name.test.ts`, `filter-copy.test.ts` -- each matrix row
- [x] `packages/web/src/App/pick-up-filter.test.tsx` -- each Story 6.3 AC that a test can observe, named in the test; the downloaded `Blob` text equals `filterText(pickUpPurposes(…))` for the ranking on screen, before and after a threshold change; the ranked rows are unchanged while the modal is open
- [x] `packages/web/src/App/header-bar.test.tsx` -- four slots, the width-budget assertion

**Acceptance Criteria:**
- Given the Story 6.3 ACs in `docs/epics.md`, when the tests run, then each AC that a test can observe has at least one test that names it.
- Given the change, when `pnpm check` runs, then it passes, and no test makes a network call.

## Design Notes

**Why the lead is computed at render.** The modal covers the page, so no dial moves while it is open. The text it shows and the file it downloads therefore come from the same ranking, and the next open reads the new dial.

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0

**Agent browser checks:** The implementing agent runs these steps itself, with the agent-browser skill in a named session (`agent-browser session id --scope worktree --prefix poe`, then `--session <id>` on every call). Start `pnpm dev` in the background and stop it with `pnpm dev:stop` at the end. A failed check is a defect to fix.
- **Header:** at 1063px and at 1000px wide, take a screenshot. Expected: `Filter ▾` before the sync button, one line, the title cut with an ellipsis only at 1000px. Measure the filter slot.
- **Modal:** click `Filter ▾` and take a screenshot. Expected: it matches `mockups/key-filter-modal.html` (480px, overlay, title, lead, four steps). Esc, the overlay and × each close it with no transition.
- **Field states:** type `"x`, then blur. Expected: the state 45 error and a disabled download. Clear the field. Expected: no error and a disabled download.
- **Copy:** click `Copy`. Expected: the clipboard holds `%UserProfile%\Documents\My Games\Path of Exile 2`, and the label reads `Copied`, then `Copy` after about 2 s.
- **Download:** enter a name and click the download. Expected: the browser receives `crafting-bases.filter`, its last line imports the name with `.filter`, the modal closes, and the network log shows no new request.
- **Reload:** reload the page. Expected: the modal is closed, and the field holds the saved name.

**Human acceptance (UJ-7, UX-DR60):** the player loads the downloaded file beside a real NeverSink export in the game. The agent cannot run this step.

## Implementation Notes

- The filter slot reserves 65px: the button measures 64.40625px in the browser.
- `HEADER_TITLE` now holds the Copy Deck title `Worth picking up`; it measures 148.28px in the browser, so `HEADER_TITLE_WIDTH` is 149. At 1063px it prints in full (193.5px of room); at 1000px it cuts. The header-bar test asserts both against the reserved slot widths.
- `App.test.tsx`'s copy scan exempts the lead's opening (`LEAD_OPENING`), which the Copy Deck owns.

### Agent browser checks (after review)

Session `poe-79ae64f4395d`, run 2026-11-01 18:46–18:48 WEST against HEAD `c52d1cb98f3f0eb25339eb9414b94376d01ec093`, tree dirty (the work is not committed). `pnpm dev` on port 5173, stopped with `pnpm dev:stop`. Screenshots in `C:/Users/ilyal/AppData/Local/Temp/claude/E--Program-Files-Jetbrains-Projects-poe-crafting-base-price-checker/75afb152-9621-4a53-a372-31f6a72e85ee/scratchpad/after-review/`.

- **Header:** pass. One line (64px) at both widths, `Filter ▾` (64.41px, in a 65px slot) before the sync button; `Worth picking up` (148.28px) in full at 1063px (193.5px of room), cut with an ellipsis at 1000px (130.5px). `header-1063.png`, `header-1000.png`.
- **Modal:** pass. 480px, overlay `rgba(26, 26, 29, 0.7)`, title, lead with `0.25 div` and `greater`, four steps, as `mockups/key-filter-modal.html`; transition durations 0s; Esc, the overlay and × each close it. `modal-1063.png`.
- **Field states:** pass. `"x` shows no error and a disabled download while typing; after blur the quote-or-folder error and a disabled download. Cleared by keystrokes and blurred: no error, download disabled. `field-state-45.png`, `field-cleared.png`.
- **Copy:** pass. Ctrl+V into the field pasted `%UserProfile%\Documents\My Games\Path of Exile 2` from the clipboard; the label read `Copied` at 6 ms and `Copy` at 2009 ms. `copy-copied.png`.
- **Download:** pass. Events in order: create, click `crafting-bases.filter`, revoke (deferred). The browser saved `crafting-bases.filter` (15863 bytes) byte-identical to the in-page Blob text; its last line is `Import "NeverSink's filter 2 - 3-STRICT.filter"`; the modal closed; the network log showed no request. The downloaded copy was deleted. `download-before.png`, `download-after.png`.
- **Reload:** pass. After reload the modal is closed and the field holds `NeverSink's filter 2 - 3-STRICT`, with the download enabled. `reload-closed.png`, `reload-field.png`.

## Spec Change Log

## Review Triage Log

Iteration 0. Layers: Blind Hunter (BH), Edge Case Hunter (ECH), Verification Gap (VG), Deferred Ledger Audit (no findings), Impeccable Design Review (IDR, no findings), OCR Delegate (OCR).

| # | Finding (layer) | Verdict | Evidence | Route |
|---|---|---|---|---|
| 1 | `saveFilter` revokes the object URL in the same tick as `anchor.click()` (OCR, ECH, BH) | medium | Real at `PickUpFilter.tsx` `saveFilter`: some engines start a `Blob` download asynchronously, and an early revoke leaves no file while the modal closes as if it worked. A deferred revoke is a direct correction | patch |
| 2 | The download test passes even when the revoke runs before the click (VG) | medium | Pre-verified gap: the fake `revokeObjectURL` in `captureDownloads` keeps the blob, so a swapped order still captures the full text | patch |
| 3 | No test downloads again after a recipe switch, though the AC names "threshold or the recipe" (VG, ECH) | medium | Pre-verified gap: only a threshold change is downloaded twice; a stale `recipeId` in the file would pass the suite | patch |
| 4 | The copy test restores `navigator.clipboard` only on its last line (OCR, ECH, BH) | low | Real: a failed assertion leaks the stub into later tests. `onTestFinished` is a direct correction | patch |
| 5 | `LEAD_OPENING` is exempted from the "worth" scan in every source (BH) | low | Real at `App.test.tsx`: the exemption is global, unlike `THRESHOLD_WORD`, which is scoped to its file. Scoping it is a direct correction | patch |
| 6 | The width test's name says "widest controls" but sums reserved slot widths (BH) | low | Real: the recipe slot was reserved against `10.00 div / craft`, not the widest form. Renaming the test is a direct correction | patch |
| 7 | The `ranking` JSDoc says the threshold reaches the filter only through it, beside a `threshold` prop (BH) | low | Real: the prop feeds the lead's text only, and the JSDoc does not say that. Rewording is a direct correction | patch |
| 8 | The `blur` and `download` `useCallback`s depend on a `check` object rebuilt on each render (BH) | low | Real: `checkFilterName(text)` returns a new object on every render, so neither callback is ever memoized. Memoizing `check` on `text` is a direct correction | patch |
| 9 | The modal radius is set twice, by `radius` and by `styles.content.borderRadius` (BH) | low | Real duplication; deleting the prop is a direct correction | patch |
| 10 | The modal-look test does not assert 480px, centring or the overlay (BH) | low | Real gap, but IDR and the browser check verified all three against DESIGN.md; jsdom does not compute Mantine's size variable. Unlikely to regress unseen, and the fix adds assertions on library internals | rejected |
| 11 | A missing or rejecting clipboard leaves `Copy` silent (ECH, BH) | low | `useClipboard` sets `error` when `navigator.clipboard` is absent; the page runs on https or localhost, where it exists. The Copy Deck has no failure string. Unlikely, and the fix adds UI and copy | rejected |
| 12 | `checkFilterName` accepts `<>:|?*`, control characters and `C:My.filter` (ECH, BH) | low | The player types the name of an export that exists on disk, and Windows forbids those characters in it. State 45 names only `"`, `/` and `\`, and the code matches. Unlikely, and the fix adds rules the owner did not set | rejected |
| 13 | A trimmed name of exactly `.filter` imports `.filter` (ECH) | low | Real, but no player's export is named `.filter`. Unlikely, and the fix adds a branch | rejected |
| 14 | A `text/plain` Blob may get `.txt` appended in Safari (BH) | maybe-false | The folder is `%UserProfile%\…` (Windows only) and Safari does not run on Windows; settling it needs a Safari download check. If true, it would be low | rejected |
| 15 | `expectedFilterText` rebuilds the rank input apart from `App` (BH) | low | A divergence fails the download tests loudly; it cannot pass a wrong file. Sharing a builder adds surface | rejected |
| 16 | "Does not re-rank" is proved by `outerHTML` equality only (BH) | false | The AC's observable claim is that the page under the modal stays as it was; the ranking is memoized in `useRanking`, and an invisible re-run with identical output harms nothing | rejected |
| 17 | The field keeps an unusable name and a stale error across close and reopen; Esc on a focused field skips the blur (BH) | low | Real in rare sequences, and still consistent with the spec decision (error computed on blur, disabled state follows the text). Unlikely, and the fix adds state handling | rejected |
| 18 | DESIGN.md keeps its title `[ASSUMPTION]` and its 2.1px sync-slot `[OPEN]` with no ledger entry (BH) | false | No conflict: the build confirms the assumption (Implementation Notes), and the sync slot is pre-existing and already tracked as `[OPEN]` at `DESIGN.md:651` by its owner | rejected |
