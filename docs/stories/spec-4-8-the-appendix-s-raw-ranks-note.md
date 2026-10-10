---
title: 'Story 4.8: The appendix''s raw-ranks note'
type: 'feature'
created: '2026-10-10'
status: 'done'
baseline_commit: '5e5e673974cb7d30132b8108fb5361dcaac22f22'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-4-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An Unrankable Item Class whose bases still rank as Raw Base rows never shows the state 16 note (EXPERIENCE.md state 16, FR-4). A raw Tracked Entry names only its Base Type, and no loaded artifact names its Item Class. The joined note (reason note · state 16 note) also overflows the nowrap appendix row at the target width.

**Approach:** Decision (human, 2026-10-10): a raw Tracked Entry carries a **required**, hand-curated `categoryId` and `className`, the same as the crafted arm. `core` carries the class onto the Raw Base ranked row. `web` builds the appendix's `rawRanks` set from the raw rows in the active ordering. Decision (human, 2026-10-10): an over-long appendix note **wraps** inside its note cell and hides nothing. The page never cuts appendix text and never adds a tooltip there (EXPERIENCE.md *What may be cut*).

## Boundaries & Constraints

**Always:** The class pair stays out of the canonical key and out of search construction (AD-5, AD-16). The tracked schema takes a major bump, because a 2.x raw entry no longer parses. Only the note cell wraps. The rank, class and reason cells stay on one line, and the row keeps `line-height-expansion` as its minimum height.

**Never:** Infer a class from a Base Type name or from the `items.json` group. Validate a raw entry's class against `weights.json`. A raw row stays exempt from pools (AD-17), so a raw class that is absent from the weights file is not an error. Ellipsis, `title` or tooltip in the appendix. An edit to DESIGN.md or EXPERIENCE.md (UX owns them).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Joined note | `pool partial` class, a Raw Base row of that class in the ordering | note = state 14 note ` · ` state 16 note. It wraps when wider than the column | N/A |
| No raw row | unrankable class, its raw entries pruned, below threshold or absent | reason note only | N/A |
| State 36 | `recipe unreachable` class with a raw row | empty note (state 36 takes none) | N/A |
| Raw of another class | Raw Base row of a ranked class | no appendix change | N/A |
| 2.x tracked file | `schemaVersion: "2.0.0"` | refused as unknown-major, with a message that names the raw class requirement | refusal value, never a throw |
| Raw entry without a class | v3 file, raw entry missing `className` | schema error | existing load error path |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/tracked-entry.ts:36-42` -- `RawTrackedEntrySchema` (strictObject). Add `categoryId: CategoryIdSchema` and `className: ClassNameSchema`, as in the crafted arm at :25-34.
- `packages/contracts/src/schema-version.ts:54-65` -- `TRACKED_SCHEMA_VERSION` → `3.0.0`. `trackedEarlierMajorMessage` is 1.x-only (`majorOf(found) === 1`); explain both earlier majors.
- `packages/contracts/src/ranked-row.ts:14-38` -- `RawRankedRowSchema` (strict). Add `categoryId` and `className`, with the same schemas as the crafted row at :73-78.
- `packages/core/src/rank-raw-groups.ts:59-76` -- `rawRankedRow(entry, …)` copies the pair from `entry`.
- `packages/web/src/App.tsx:224-240` -- `active = forRecipe(ranking, recipe)`. `active.ordering` rows with `kind === 'raw'` give `appendixClassKey(row)`. Pass the result as `rawRanks` (memoised with `active`).
- `packages/web/src/list/UnrankableAppendix.tsx:108-127` -- row style: `height` → `minHeight`. Move `whiteSpace: 'nowrap'` off the row onto the rank, class and reason cells. The note cell wraps.
- `packages/sync/src/chunk/catalogue-check.ts:38-58` -- `missesOf`: the raw branch returns after `baseTypeId`. Also check the raw `categoryId` against the catalogue (AD-9's table names every `categoryId` in tracked.json).
- `data/tracked.json`, `fixtures/tracked.json`, `test/fixtures/frozen-data/tracked.json` -- 4 raw entries each, and `schemaVersion`. Amulets → `accessory.amulet`/`Amulets`; belts → `accessory.belt`/`Belts` (`pnpm tracked:lookup class`).
- Raw entry factories that must gain the pair: `packages/web/src/test-support/list-fixtures.ts:17` (`rawEntry`), `packages/core/src/rank/test-support.ts:28`, and sync test-support files under `chunk/run-chunk`, `dry-run`, `sync`, `sync-batch`, `session-auth-canary` and `pricing/price-entry`. There are also about 30 inline literals across the three packages. Let `pnpm typecheck` and the test run list them. Keep the deliberately malformed literals malformed (`envelopes.test.ts:113`, `curation/check.test.ts:219`).
- Tracked `'2.0.0'` literals: `contracts/src/index.test.ts:60`, `schema-version.test.ts:84,101` (:84 uses `3.0.0` as "unknown"; move it to `4.0.0`), `envelopes.test.ts:72,107`, `web/src/load/load-artifacts.test.ts`, `web/src/App.test.tsx:141,147`, `web/src/test-support/artifact-server.ts:51`, and the pinned 1.x messages in `sync/.../curation/check.test.ts:272` and `chunk/run-chunk/lock.test.ts:259`.
- `packages/web/src/list/unrankable-appendix.test.tsx:142-143` -- the "no `[title]`" assertion stays and must keep passing.
- Do not change: `canonical-key.ts`, `search-body.ts`, `cross-file.ts`, `crafted-classes.ts` (the crafted-only filters stay).

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/{tracked-entry,ranked-row,schema-version}.ts` + tests -- add the pair to both raw schemas, bump to 3.0.0, generalise the earlier-major message -- the contract carries the join.
- [x] `packages/core/src/rank-raw-groups.ts` + `rank.test.ts` -- copy the pair onto the raw row -- the class rides with the row.
- [x] `packages/sync/src/chunk/catalogue-check.ts` + test -- raw `categoryId` miss → `unresolvable` record with `identifierKind: 'categoryId'` -- AD-9.
- [x] Fixtures, factories, inline literals and the three tracked JSON files -- backfill the pair and the version -- the suite stays green.
- [x] `packages/web/src/App.tsx` -- build `rawRanks` from `active.ordering` and pass it -- wires state 16.
- [x] `packages/web/src/list/UnrankableAppendix.tsx` -- wrap only the note cell, `minHeight` on the row -- the joined note never overflows.
- [x] `packages/web/src/list/unrankable-appendix.test.tsx`, `packages/web/src/App/unrankable-appendix.test.tsx` -- matrix rows 1-4 through the App, and the cell `white-space` split -- proves the wiring.
- [x] `docs/architecture/.../ARCHITECTURE-SPINE.md` AD-5 table row `raw` (:226) -- state that a raw entry also names its item class pair, outside the key and never sent (cite FR-4 state 16) -- the decision has one owner.
- [x] `.claude/skills/tracked-json/SKILL.md:28` -- a raw entry also takes its class from `tracked:lookup class` -- curation can author v3.
- [x] `docs/stories/deferred-work.md` -- add a `[NOTE FOR UX]`: DESIGN.md `components.unrankable-appendix.row` reads as a fixed height, and a wrapped note grows the row. Remove the two Story 4.8 entries in the branch's last commit.

**Acceptance Criteria:**
- Given an unrankable class and a Raw Base row of that class in the active ordering, when the appendix renders, then that row's note ends with ` · ` and the state 16 note (epics.md Story 4.8).
- Given a recipe switch that changes which raw rows are in the ordering, when the appendix re-renders, then the state 16 notes follow the new ordering, with no network request.
- Given a 1080px-wide frame and the 15a + 16 joined note, when the page renders, then the note sits inside its column on two lines and no row content passes the frame's right edge (agent-browser screenshot).
- Given the change is done, when `pnpm check` and `pnpm tracked:check` run, then both pass.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | design | A wrapped note has no vertical inset: two 12px/1.4 lines (33.6px) fill a 32px-min row edge to edge | low | `UnrankableAppendix.tsx` note cell has no padding; the row only sets `minHeight`. A joined 14/15a + 16 note wraps at 1080px, so this is common | patch |
| 2 | blind | Raw ranked row uses bare `z.string()` for the pair | false | The row is built in `core` from an entry that already passed `CategoryIdSchema`/`ClassNameSchema`, and it matches the crafted row (`ranked-row.ts:73-78`) as the Code Map asked | reject |
| 3 | blind | The `ranked-row.ts` description cites AD-5 for why the pair rides the row; `className` has no description | low | The reason is FR-4 state 16; AD-5 owns the key. Direct text fix | patch |
| 4 | blind | SKILL.md says "never infer the class from the base type's name" yet gives no source for a base's class; the sentence precedes finding the base | medium | `lookup base` prints only `{type, group}` (`lookup.ts:86-108`), so the curator must choose the class; the "never infer" rule binds the page (epics 4.8 AC 2), not curation | patch |
| 5 | blind | `lookup class` lists only weights classes, so a raw class absent from weights has no lookup source | low | `lookup.ts:150-163` reads `weights.bases`. Covered by the same SKILL.md rewording (copy the pair from that class's crafted entries) | patch (with 4) |
| 6 | blind, edge | No check that a raw pair is consistent (className vs categoryId, or vs the class's crafted entries); a typo silently drops the note | low | Real, but the skill authors the pair from `lookup class`, and the fix is a new cross-entry check. Low-likelihood plus added complexity | reject |
| 7 | blind, vgap | Contracts fixtures file `Advanced Dualstring Bow` under `accessory.amulet`/`Amulets` | low | `canonical-key.test.ts:25`, `tracked-entry.test.ts:17`, `envelopes.test.ts:23,157`. Direct correction to `weapon.bow`/`Bows` | patch |
| 8 | blind | The 2.x message is never tested through sync | false | `explainTrackedVersion` (`load-data-file.ts:50`) aliases `trackedEarlierMajorMessage`; its wiring is pinned at `curation/check.test.ts:272` and `lock.test.ts:259`; the 2.x text is unit-tested | reject |
| 9 | blind | Spec/sprint status mismatch, an unchecked task, empty notes | false | The sprint status moves at step 5; the task is checked; the fix edits this spec | reject |
| 10 | blind | Spec names `App/unrankable-appendix.test.tsx`, but the test landed in `App/raw-ranks-note.test.tsx` | false | The fix edits this spec. The split was forced by the 300-line lint limit | reject |
| 11 | blind | "14 + 16" vs "15a + 16" contradict | false | Two different valid cases: the matrix uses the common one, and the layout AC uses the longest | reject |
| 12 | blind | No layout evidence; `alignItems: center` floats one-line cells on a two-line row | low | The implementer's agent-browser run measured a 33.6px row, note right edge 1056px < 1080px, scroll width 1080. Centring is the existing grid's alignment; no named harm | reject |
| 13 | blind | Epic-context bullet still says a human must choose the join and settle the layout | low | `epic-4-context.md` Cross-Story Dependencies. Direct text fix in a cache file | patch (orchestrator) |
| 14 | blind | `rawRanks` may claim "still ranks" for a pending/broken or below-threshold raw row with no visible row | false | `ordering` is `raw.surviving` (`rank.ts:294`), the priced rows at or above the threshold; below-threshold rows are never in it (`rank.ts:87`); `display-rows.ts:242` renders exactly `ordering` | reject |
| 15 | blind | An unbroken long token could overflow the note column | false | Notes are fixed Copy Deck strings with spaces (`APPENDIX_NOTES`, `RAW_RANKS_NOTE`) | reject |
| 16 | blind, edge | A raw categoryId missing from filters.json now excludes the raw base from pricing although the pair is never sent | low | Intended: AD-9's table checks every `categoryId` in tracked.json, and the spec tasks it. The entry surfaces as `unresolvable` (a broken mark), not silently | reject |
| 17 | edge | The 15a note already contains ` · `, so the joined note reads as three segments | low | The code follows EXPERIENCE.md state 16's joiner and the 15a Copy Deck. Each segment is a true standalone fact, so nothing is misread | reject |

## Verification

**Commands:**
- `pnpm check` -- expected: green.
- `pnpm tracked:check` -- expected: exit 0 against the v3 `data/tracked.json`.

**Manual checks:**
- agent-browser (named session, `pnpm dev`): give an Amulets entry a partial pool in the fixture data, or use a test fixture that already has one. Screenshot the appendix and confirm the joined note wraps with no ellipsis. Run `pnpm dev:stop` afterwards.
