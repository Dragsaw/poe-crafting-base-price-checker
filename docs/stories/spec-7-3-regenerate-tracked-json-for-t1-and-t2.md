---
title: 'Story 7.3: Regenerate tracked.json for T1 and T2'
type: 'chore'
created: '2026-11-15'
status: 'done'
baseline_commit: '012679cdf3ab242fcb72d8445f7850908ecdde78'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-7-context.md'
  - '{project-root}/.claude/skills/tracked-json/SKILL.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 509 active crafted entries carry a band that spans T1 and T2. 586 references are T1-only where T1 first appears above 79, so at the league-start level their Combination never counts. 1,152 floors sit above what `needs` gives, a residue of the retired shared floor (FR-22, FR-38).

**Approach:** A committed script, `pnpm tracked:regenerate`, rewrites every active crafted entry of `data/tracked.json` from `core`'s `needs`, `ownInterval` and `contains` over the Weights File. Each contained tier becomes its own reference, banded on its own interval (AD-11). A T1-only reference whose T1 floor is above `min(CRAFTING_ITEM_LEVELS)` gains its T2 sibling. Entries are the prefix × suffix product of the variants, each with floor `max(needs(prefix), needs(suffix))`.

## Boundaries & Constraints

**Always:** Raw entries and the 14 pruned tombstones stay byte-identical. A generated entry whose class and references, ignoring floor and label, equal a tombstone's is dropped, so no pruned Combination is revived. The script is deterministic and idempotent: a second run gives a byte-identical file. A replaced span is deleted, never pruned, and the `data` commit message names that as an exception to the FR-15 prune tombstone, as Story 5.1 did. Weights load through `loadWeights`. The story AC, not the skill's lookup-only rule, is the authority for the script reading the Weights File. The script writes `JSON.stringify(file, null, 2) + '\n'`. Generated entries take the position of their source entry, T1 before T2, prefix-major, with the first occurrence of a canonical key kept. Field order is `kind, categoryId, className, itemLevelMin, prefix, suffix, status`.

**Never:** No change to app packages (`packages/*`), to any other `data/` file, or to an owner document. No pruning of rows on the script's own judgment. No `pnpm sync` against the live API.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Span | band contains T1 and T2 | two references, each one tier's `ownInterval`, labelled `T1` and `T2` |
| Overlapping tiers | Bows lightning span, T1 `interval` `[101.5, 123]`, T2 `[79, 103]` | T1 `[103.5, 123]`, T2 `[80.5, 103]`; both load |
| T1 above low level | only T1 contained, T1 `itemLevelMin` 82 | T1 and T2 references |
| Both affixes qualify | both slots as above | four entries |
| T1 at or below 79 | only T1 contained, T1 floor 75 | one reference, banded on its `ownInterval` |
| Hybrid | hybrid span | one reference per hybrid tier, each banded line on that tier's line `ownInterval` |
| Summed pair | one `statId` in both slots | entry byte-identical |
| Floor | prefix needs 75, suffix needs 81 | `itemLevelMin` 81 |
| Duplicate | two sources produce one canonical key | written once |
| Tombstone combination | generated refs equal a pruned entry's | not written |
| Unlabelled contained tier | `tierLabel` absent | script throws, names the entry, and writes nothing |

**Decisions (human, 2026-11-14):** The T2 sibling is the family tier labelled `T2`. A family with no `T2` tier gets no sibling (Crossbows "Loads # additional bolts", `explicit.stat_1967051901`, 6 entries), and the report names those entries.

**Decisions (human, 2026-11-15):** Story 7.5 resolves the former AD-17 blocker. Every reference with a contained tier, whether split, given a sibling or left single, is banded on that tier's `ownInterval` (SKILL.md step 4). A single-tier reference whose band already equals it stays byte-identical. Valueless references and summed pairs keep their bands.

</frozen-after-approval>

## Code Map

- `.claude/skills/tracked-json/scripts/lookup-weights.ts` -- `loadWeights`, `ReadJson`, `SLOTS`. Reuse them.
- `.claude/skills/tracked-json/scripts/lookup.ts` -- entry pattern (`isInvokedDirectly` from `tools/entry-guard/`). Copy it.
- `packages/core/src/index.ts` -- `needs`, `interval`, `ownInterval`, `contains` (`isContaining(ref, entry, pool, summed?)`, now takes the pool), `lineSet`, `statIds`, `untrackable`, `poolOf`, `CRAFTING_ITEM_LEVELS`. Import these and reimplement none of them.
- `packages/contracts/src/canonical-key.ts` -- `canonicalKey` for dedupe.
- Wiring is in place: the skill scripts glob is in `knip.json`, `tsconfig.tools.json`, `eslint.config.mjs` and the vitest `root` project. Only `package.json` needs a `tracked:regenerate` script.
- Tier family: pool entries with `weight > 0`, `!untrackable`, and `lineSet` equal to `statIds(ref)`. A tier is one family entry, not one label: the Crossbows family has two `T1` entries.
- Summed pairs (one `statId` in both slots; Amulets and Rings, 2 entries): the script keeps them byte-identical. Their containment is per `statId` (`summed` argument), so splitting them is not defined.
- Dry run on HEAD `822da15` (scratch prototype `proto-7-3.ts`, session scratchpad, `uniform` mode, which matches the 2026-11-15 decisions): 542 span references split, 586 T1 references gain a T2 sibling, 6 have no T2, 193 single references move to their own interval, 0 duplicates, 0 tombstones revived, matched by band and by contained tier. Result: 3,362 active crafted rows plus 90 raw. `tracked:check` passes all five checks with 0 issues, 0 unreachable and 0 unvalidated. `pnpm test:data` passes. 594 active keys are kept, so most crafted rows read unpriced until the rotation refills them.
- NFR-6 measured on the dry-run file (`time-7-3.ts`, every active entry priced synthetically, `rank` ranks every recipe in one pass): fastest of 5 is 61.5 ms at 79 and 89.6 ms at 82. The committed list gives 16.9 and 57.0 ms. The 100 ms bound of `packages/core/src/rank/purity-and-budget.test.ts:102` holds, with a thin margin at 82.
- Budget references: search limit 100/h without the cookie, 200/h with it (`docs/research/technical-poesessid-vs-oauth-for-trade-api-rate-li-2026-10-02/digests/capture-trade2-headers.md:38`). One entry costs one search (AD-12).

## Tasks & Acceptance

**Execution:**
- [x] `.claude/skills/tracked-json/scripts/regenerate-entries.ts` -- pure `regenerateEntries(tracked, weights)` that returns the new file and a summary: split, sibling, rebanded-single, no-T2 (with entry paths), dropped-as-duplicate and dropped-as-tombstone counts.
- [x] `.claude/skills/tracked-json/scripts/regenerate.ts` -- entry: read `data/tracked.json` and the weights, write the file, and print the summary as JSON.
- [x] `.claude/skills/tracked-json/scripts/regenerate.test.ts` -- one test per matrix row on synthetic pools, including an overlapping-tier split that uses the own interval, plus idempotence, summed-pair and raw/pruned byte-identity. No network.
- [x] `package.json` -- `"tracked:regenerate": "node .claude/skills/tracked-json/scripts/regenerate.ts"`.
- [x] `.claude/skills/tracked-json/SKILL.md` -- fix "They only read" and name `tracked:regenerate` in one bullet.
- [x] Commit the script (`feat(tools): ...`). Then run it and commit `data/tracked.json` alone (`chore(data): ...`), with the FR-15 exception line and the counts in the body.
- [x] Measure NFR-6 on the committed result with a scratch script outside the repo, as in the Code Map: both levels, fastest of 5. Record it in Implementation Notes.

**Acceptance Criteria:**
- Given the regenerated file, when `pnpm tracked:check` runs, then it exits 0 with all five checks `passed`, `unreachable` empty and `unvalidated` empty.
- Given the regenerated file, when the script runs again, then `git diff` is empty.
- Given the change, when `pnpm check` and `pnpm test:data` run, then both pass.
- Given the report, then it names `data/tracked.json`, the change and the reason. It states the active crafted row count read from the file, the rotation time at 100/h and 200/h against UJ-6, and the NFR-6 timing.

## Design Notes

Rotation at the dry-run count: 3,452 searches is about 34.5 h without the cookie and about 17.3 h with it. That is within UJ-6's "about a day and a half" and "within a day". The re-key orphans most price history. That is accepted, because the league reset on 2026-12-11 wipes prices (epic context).

## Verification

**Commands:**
- `pnpm tracked:regenerate && pnpm tracked:check` -- expected: exit 0, as in the AC.
- `pnpm check` and `pnpm test:data` -- expected: pass.

**Agent browser checks:** The implementing agent runs these in a named session with `pnpm dev` in the background, and runs `pnpm dev:stop` at the end.
1. **Perfect list at 82:** the page renders crafted rows, unpriced rows read as pending, and there is no page error. Take a screenshot.
2. **A split class (Bows):** open the row. The expansion lists the T1 and T2 combinations with their labels. Take a screenshot.
3. **Filter modal:** generating the filter shows no error. Take a screenshot.

## Implementation Notes

- Commits: `0074798` (script), `7c33a28` (`data/tracked.json` alone). The output is byte-identical to the dry-run prototype's.
- Run summary: split 542, sibling 586, rebanded-single 188, no-T2 6 (Crossbows `explicit.stat_1967051901`, source entries 461, 466, 471, 476, 481, 486), 0 duplicates, 0 tombstones. Rebanded-single counts only references left single; the prototype's 193 also counted the T1 of a sibling pair.
- Active crafted rows 3,362 (was 2,096), raw 90, pruned 14 byte-identical. 594 active keys survive.
- Rotation at 3,452 searches: about 34.5 h at 100/h, about 17.3 h at 200/h (UJ-6).
- NFR-6 (fastest of 5, `rank` over every recipe, every active entry priced): 60.5 ms at 79, 88.7 ms at 82. Old list: 16.1 and 56.4 ms. Bound 100 ms holds, with an 11 ms margin at 82.
- `tracked:check`: five checks passed, `issues`, `unvalidated` and `unreachable` empty. A rerun gives an empty `git diff`. `pnpm check` (includes `test:data`) passed.
- The script validates the file with `TrackedFileSchema` but works on the unparsed entries, because parsing sorts hybrid lines and would change the bytes of entries it keeps.
- Browser (session `poe-79ae64f4395d`): the list renders at 82 under `perfect` with no page error, unpriced crafted rows read `pending · not checked yet`; Bows expands to T1 and T2 combinations with labels; the filter modal opens with no error.

### Agent browser checks (after review)

- Session `poe-79ae64f4395d`, run 2026-11-15 14:24–14:32 WEST, against HEAD `7c33a286ed71657e9dd5b34505a9cc1a831bbd1e`. The tree was dirty: the review patches to `regenerate*.ts`, `SKILL.md` and the docs were uncommitted. `data/tracked.json` was clean and equal to HEAD. `pnpm dev` ran on 5173, and `pnpm dev:stop` freed it.
1. Perfect list at 82: passed. With `perfect` selected, crafted rows render. The unpriced rows read `pending · not checked yet`. `errors` was empty. Screenshot: `C:/Users/ilyal/AppData/Local/Temp/claude/26e3858fb0c54881/f95c899c-b5e3-4baf-b196-9548d1a84229/scratchpad/after-review-1-perfect-82.png`
2. Bows split: passed. The expansion lists labelled combinations, for example `T2 Elem Atk Dmg · T1 Atk Spd` and `T2 Elem Atk Dmg · T2 Proj Skills`. Screenshot: `C:/Users/ilyal/AppData/Local/Temp/claude/26e3858fb0c54881/f95c899c-b5e3-4baf-b196-9548d1a84229/scratchpad/after-review-2-bows-expansion.png`
3. Filter modal: passed. The modal opens, and the download button enables after a file name is entered. Clicking it showed no page error. The headless browser cancelled the save, so no filter file was checked. Screenshot: `C:/Users/ilyal/AppData/Local/Temp/claude/26e3858fb0c54881/f95c899c-b5e3-4baf-b196-9548d1a84229/scratchpad/after-review-3-filter-modal.png`

## Spec Change Log

## Review Triage Log

### 2026-11-15 — Review pass
- verdicts: 32 findings — high 0, medium 2, low 24, false 6, maybe-false 0. Ledger audit: 0 findings. Impeccable layer skipped (no `packages/web/src/` change). The review diff left out `data/tracked.json` (generated, about 64k changed lines). `tracked:check` and the rerun cover it.
- Live-data check (a scratch script over the 2,096 active crafted entries at baseline, 4,192 references, and the regenerated file) found 0 pinned entries, 0 classes absent from the weights, 0 references with no contained tier, 0 undefined `needs`, 0 banded references with odd key order, 0 all-valueless hybrids, 0 banded references that contain a hybrid tier, 0 references that contain several T1 tiers and no T2, 0 multiple or cross-`modGroup` T2 siblings, and 0 active entries that share stat ids with a tombstone.
- findings:
  - `false` `reject` Blind 1: spec `in-review` and sprint-status `in-progress` disagree — the workflow sets the story key to `review` at presentation, not at review start.
  - `low` `reject` Blind 2 / Edge 7: a pruned span tombstone does not catch the per-tier pieces of a split — the Always rule defines a tombstone match as equal references, ignoring floor and label. The live-data check found 0 active entries that share stat ids with any tombstone. Containment matching adds a branch.
  - `low` `reject` Blind 3: a reference that contains several T1 tiers and no T2 gets no sibling and no `noT2` line — 0 in live data.
  - `low` `reject` Blind 4 / Edge 4 / Edge claim (floor): an uncontained reference keeps the source floor without a report — 0 uncontained references and 0 undefined `needs` in live data. `tracked:check` cross-file containment rejects such a reference.
  - `low` `reject` Blind 5: a rerun reports nonzero `sibling` and `droppedAsDuplicate` — the file bytes are the contract (AC), and the counts are only diagnostic. Skipping present siblings adds a branch.
  - `false` `reject` Blind 6 / OCR 1: a passed-through entry is not checked for duplicates — a raw entry differs by kind, a summed pair cannot equal a generated entry (a generated entry never has one stat id in both slots), an absent class differs by class, and a non-active combination is dropped as a tombstone before the duplicate check.
  - `low` `reject` Blind 7 / OCR 4: `rebandedSingle` and the bytes depend on key order — 0 banded references with non-schema key order in live data.
  - `medium` `patch` Blind 8 / VG 2: no test covers the pass-through of an absent class or of a reference with no contained tier — tests added.
  - `low` `patch` Blind 9: the SKILL.md bullet says regenerate is the one script that reads `data/weights.json`, and mixes a statement with an instruction — the bullet was reworded. The rest of Blind 9 (FR-15 note, Rules section) is rejected: the FR-15 exception is per commit, and it belongs in the commit message.
  - `low` `patch` Blind 10a: the `isRegenerable` JSDoc is ambiguous — reworded.
  - `low` `reject` Blind 10b: the split orders by `itemLevelMin`, not by label — a T1 and a T2 of one family with equal floors is not seen in the weights. The order is still deterministic.
  - `low` `patch` Blind 10c: `TRACKED_PATH` is exported and unused — the `export` was removed.
  - `false` `reject` Blind 11a: no screenshot paths — the after-review record names them before `done`, as the gate requires.
  - `low` `reject` Blind 11b: the thin NFR-6 margin at 82 is not ledgered — the measured bound holds (88.7 ms < 100 ms), and `purity-and-budget.test.ts` fails if a future list breaks it.
  - `false` `reject` Blind 11c: "byte-identical to the prototype" is said to hide a weaker tombstone match — both gave 0 revived on this file, and the claim is about this run.
  - `false` `reject` OCR 2: `isSameList` depends on order — `lineSet` and `statIds` both return code-unit-sorted lists (`packages/core/src/probability.ts`).
  - `low` `reject` OCR 3: `writeFileSync` is not atomic — the file is in git, and a temp-file rename adds code for a crash case not seen.
  - `low` `reject` Edge 1: a banded reference can contain a hybrid tier — 0 in live data. Containment is `core`'s `isContaining`, which the spec says to reuse.
  - `low` `reject` Edge 2 / Edge claim (sibling): a sibling can come from another family — the Code Map defines the family by the line set. 0 multiple or cross-`modGroup` siblings in live data.
  - `low` `reject` Edge 3: an all-valueless hybrid that contains several tiers — 0 in live data.
  - `low` `reject` Edge 5: a generated file that fails the schema is still written — `tracked:check` runs after (SKILL.md, Verification). A guard adds code for a case not seen.
  - `low` `reject` Edge 6: pinned entries are in the tombstone set — 0 pinned entries. A generated twin of a pinned combination is a duplicate either way.
  - `low` `reject` Edge claim (every active): summed pairs and absent classes are not rewritten — the spec keeps summed pairs as they are, and an absent class has no pool to rewrite from.
  - `medium` `patch` VG 1: the sibling cutoff at exactly 79 is untested — a T1-at-79 fixture and test were added.
  - `low` `defer` VG 3: no test spawns the `tracked:regenerate` entry script — ledgered, as filed.
