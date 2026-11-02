# Review: Epic 6 diff (`d708a46^..2d04176 -- packages/`)

Run from the Epic 6 retrospective (`docs/stories/epic-6-retro-2026-11-01.md`). The review used three lenses: adversarial, edge-case-hunter and verification-gap. The lenses saw the work of all four stories together, and they gave the story boundaries extra weight. A finding that more than one lens raised is marked *overlap*.

## Verification gap

**VG-1: the App-level download tests cannot detect a wrong purpose.** *Overlaps ADV-8 and ADV-7.*
- **Location:** `packages/web/src/App/pick-up-filter-support.tsx` `expectedFilterText`, and `pick-up-filter-download.test.tsx`.
- **Trigger:** `expectedFilterText` builds the expected text with the same `rank`, `pickUpPurposes` and `filterText` calls that the page makes. The download tests then assert only `toContain('BaseType == "Recurve Bow"')`, or that two texts differ.
- **Uncovered paths:**
  - No test downloads a file under state 35 or state 43.
  - No App-level test covers a base at two floors.
  - The fixture comments about the Recurve Bow craft entry and the greater-to-perfect purpose switch make claims that no assertion checks.
- **Guard:**
  - Assert the treatment of a named block, for example that Recurve Bow Normal is craft.
  - Download under state 35 and assert that there are no craft or check-rolls blocks.
  - Add a two-floor App-level world and assert that `ItemLevel <=` is in the file.
- **Consequence:** A purpose regression at the App boundary passes the suite.

**VG-2: no test proves the download uses no File System Access API.**
- **Location:** `PickUpFilter.tsx` `saveFilter`.
- **Trigger:** jsdom defines no `showSaveFilePicker`. A feature-detected save-picker branch would never run in a test.
- **Guard:** Stub `showSaveFilePicker` as a spy, then assert that it is not called.
- **Consequence:** A later change could break AD-15 and AD-24 without a test failure. No code uses the API today: a grep finds nothing.

## Edge-Case Hunter

**ECH-1: a raw entry in the `jewel` category is unguarded.** *Overlaps ADV-9.*
- **Location:** `packages/core/src/pick-up/pick-up.ts` `pickUpPurposes` and `rawBaseEntries`. Nothing rejects the entry in `packages/contracts/src/tracked-entry.ts` `RawTrackedEntrySchema` or in `tracked:check`.
- **Trigger:** A non-pruned raw entry with `categoryId: 'jewel'`, in a class with EV > 0.
- **Result:** The file gets three blocks:
  - A white block that cannot match, because jewels never drop white.
  - A magic block with an `UnidentifiedItemTier` condition that jewels never have.
  - A duplicate magic block for the jewel kind.
- **Guard:** Skip raw entries in a jewel category in `pickUpPurposes`, or reject them in `tracked:check`.
- **Scope today:** `data/tracked.json` holds 0 raw jewel entries.

**ECH-2: the jewel-kind entry can share a `baseTypeId` with a raw entry.**
- **Location:** `pick-up.ts` `jewelKindEntry`.
- **Trigger:** The jewel-kind entry has a `["crafted",…]` key and sorts first. It also has no `itemLevelMax`.
- **Consequence:** It overrides the raw entry's magic block and the Story 6.4 bound.
- **Fix:** The same fix as ECH-1.

Leads that the lens checked and found correct:
- The class-floor raise combined with the 6.4 bound.
- A pruned higher floor.
- A higher floor that has no purpose.
- The 6.3 inputs: `ranking` and `threshold` come from the same state in `App.tsx`.

## Adversarial

**ADV-1: a Raw Base the trade catalogue does not know still gets craft blocks.**
- **Location:** `pick-up.ts` `pickUpPurposes`. The AC 7 test at `pick-up.test.ts:174` asserts this behavior.
- **Detail:** The jewel-kind path gives no entry to an unresolvable jewel kind. The raw path writes a block for an unknown base under `BaseType ==`.
- **Consequence:** The game may reject the filter or keep a dead block. Only the game's parser can settle this.
- **Scope today:** 0 unresolvable entries in `data/dataset.json`.

**ADV-2: the object URL is revoked in `setTimeout(…, 0)`.**
- **Location:** `PickUpFilter.tsx` `saveFilter`.
- **Trigger:** Copy step 3 says that the browser asks where to save each download.
- **Consequence:** If the browser reads the blob only after the player confirms the save dialog, the download can fail. The headless browser check had no save dialog.

**ADV-3: the Blob type is `text/plain`.**
- **Location:** `PickUpFilter.tsx` `saveFilter`.
- **Consequence:** A save dialog can append `.txt`. The game would then not list the file.
- **Prior triage:** The 6.3 triage (#14) rejected this risk as Safari-only. The Chrome or Edge save dialog on Windows is not verified.

**ADV-4: `checkFilterName` accepts `<>:|?*` and other names that are not valid Windows file names.**
- **Location:** `filter-name.ts`.
- **Prior triage:** The 6.3 triage rejected this as #12. State 45 owns the rule.

**ADV-5: `filterText` writes the name with no escaping.**
- **Location:** `filter-text.ts`.
- **Detail:** Only a JSDoc note binds the caller to state 45.

**ADV-6: the lead's `threshold` and `ranking` arrive as two props.**
- **Location:** `header-controls.tsx` `readyControls`.
- **Detail:** Only a JSDoc note ties the two together. Today they come from the same state, as ECH confirmed.

**ADV-7: the Unrankable and no-priced-Combination fixtures differ only in fields that `pickUpPurposes` ignores.**
- **Location:** `pick-up.test.ts` `NO_EV_CAUSES`.

**ADV-8: the download oracle reuses the code under test.** This is the same finding as VG-1.

**ADV-9: a raw jewel entry is unguarded.** This is the same finding as ECH-1.

**ADV-10: a clipboard failure leaves `Copy` silent.**
- **Location:** `PickUpFilter.tsx` `FolderPath`.
- **Prior triage:** The 6.3 triage rejected this as #11.

**ADV-11: the filter slot has 0.6px of headroom.**
- **Location:** `HeaderBar.tsx:20`.
- **Detail:** The slot reserves 65px for a button that measures 64.4px.

**ADV-12: the entry order compares keys as JSON text.**
- **Location:** `pick-up.ts` `compareKeyed`.
- **Detail:** All jewel kinds come before every raw base, and a floor of 9 sorts after a floor of 70. The order is deterministic, so NFR-3 holds.

**ADV-13: the active-recipe narrowing is written in two places.**
- **Location:** `pick-up.ts` `classValuesOf` and `list/active-ranking.ts` `forRecipe`.
- **Detail:** The two places can drift apart. That would be a second judgement, which FR-35 forbids.
