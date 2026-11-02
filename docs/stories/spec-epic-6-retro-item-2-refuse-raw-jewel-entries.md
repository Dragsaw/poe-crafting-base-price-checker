---
title: 'Refuse a raw tracked entry in the jewel category'
type: 'bugfix'
created: '2026-11-02'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing refuses a raw tracked entry with `categoryId: 'jewel'` (epic 6 retro action item 2; review ECH-1, ECH-2, ADV-9). Such an entry would give the Pick-up Filter a white block that cannot match, a magic block with an `UnidentifiedItemTier` condition that jewels never have, and a duplicate magic block beside the jewel-kind block, which sorts first and ignores the 6.4 `itemLevelMax` bound. A Raw Base is an uncrafted white base (PRD glossary), jewels never drop white (FR-36), and the raw search asks for `rarity: normal`, so the entry could never get a price either.

**Approach:** Refuse the entry in `TrackedEntrySchema` (contracts), with the issue at `categoryId`. Web, sync and `pnpm tracked:check` (its `schema` check) all parse through this schema, so each one refuses the entry the same way, and `pickUpPurposes` never receives one. Add tests at the schema and at `tracked:check`.

</frozen-after-approval>

## Implementation Notes

- **Layer (my choice; the retro names dev as owner and gives the options).** I use the schema and not a `tracked:check`-only rule or a skip in `pickUpPurposes`. A check-only rule leaves the app path unguarded when nobody runs the check. A silent skip in pick-up still spends sync searches on an entry that is never priced, and it hides a curation error. The rule needs only one entry, so it is a single-file rule and belongs in `contracts`, not in the `core` cross-file checks (AGENT-WORKFLOW cross-file rule).
- **Code:** `packages/contracts/src/tracked-entry.ts`: in the `superRefine` of `TrackedEntrySchema`, add an issue at `['categoryId']` when `entry.kind === 'raw' && entry.categoryId === 'jewel'`. The message cites FR-36. `contracts` cannot import `core`'s `isJewelCategory` (dependency direction), so the literal `'jewel'` is used here.
- **No schema version change.** `data/tracked.json` and `test/fixtures/frozen-data/tracked.json` hold 0 raw jewel entries (checked), so no file in use changes from accepted to refused.
- **Tests:**
  - `packages/contracts/src/tracked-entry.test.ts`: refuses `{ ...rawEntry, baseTypeId: 'Emerald', categoryId: 'jewel', className: 'Emerald' }` at `categoryId`, both active and pruned. A crafted jewel entry still parses (a separate test).
  - `packages/sync/src/curation/check.test.ts`: a tracked text with a raw jewel entry at index N gives a `schema` issue at path `entries.N.categoryId`, `ok: false`, and the entry-dependent checks `skipped`. Follow the existing "reports a schema issue at its path" test.
- **As built:** the `tracked:check` test is in a new sibling, `packages/sync/src/curation/check.raw-jewel.test.ts`, because one more test put `check.test.ts` over `max-lines` (306 > 300). The sibling builds its own minimal inputs (weights and recipes absent), because the schema check needs no other file.
- **Verified:** `pnpm check` exits 0, and all 8 gates pass.
- **Agent browser checks: exempt.** The change touches `packages/contracts/`, but the live `data/tracked.json` and the frozen fixture hold no raw jewel entry. Every file that the dev server loads parses the same as before, so the page cannot change (`_bmad/custom/prompts/agent-browser-checks.md` rule 1).

## Review Triage Log

- OCR-1 / BH-5 (the new check test rebuilds the inputs by hand): low, rejected. `check.test.ts` is at `max-lines`, and its `inputsOf` carries weights and recipes that this case leaves absent on purpose. Sharing it means moving the fixtures into `check.test-support.ts`, which is more than a simple fix.
- OCR-2 / BH-3 (only `checks[0]` is asserted): low, patched. The test now asserts the full `checks` list.
- OCR-3 / BH-2 (`'jewel'` is spelled in both `contracts` and `core`): low, rejected. `categoryId` is the trade API's own id (spine *Ids*), and the contracts test pins the literal. Sharing one constant adds a new public export in `contracts`.
- BH-1 (the `TrackedEntrySchema` JSDoc says "prune-reason rule only"): low, patched.
- BH-4 (the spec and the code disagree on the test file and the fixture): low, patched in Implementation Notes.
- BH-6 (the action item is still open in `sprint-status.yaml`): low, patched. Item 2 is set to `done`.
- BH-7 (the `tracked-json` skill does not warn about the rule): low, rejected. `tracked:check` fails with a message that names the fix, and the skill already runs that check after each edit.
- BH-8 (it is not stated whether a pruned raw jewel entry is refused): low, patched. It is refused (a pruned entry is still never a Raw Base), and a test now covers it.
- BH-9 (the message is checked only loosely): low, rejected. The message is free text, and the path and `FR-36` pin the rule.
- BH-10 (one test covers two behaviours): low, patched. It is now two tests.
- Ledger audit: no findings.
