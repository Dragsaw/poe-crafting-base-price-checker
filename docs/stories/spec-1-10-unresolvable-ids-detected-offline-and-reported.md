---
title: 'Story 1.10: Unresolvable ids, detected offline and reported'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_revision: '3a61afb95eb1c3abda01073eb1e9e4a183997dd6'
route: 'dispatch'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `sync` never checks tracked ids against the committed catalogue. A patched-out `statId`, `baseTypeId` or `categoryId` gets searched, returns `no-listings`, and looks the same as a base nobody sells. A `jewel` derivation miss throws `UnknownClassBaseTypeError`, and that aborts the whole chunk. Nothing records an absent `weights.json` (FR-24, AD-9, AD-12, AD-25).

**Approach:** Under the lock, after the dataset load and before `chunkOrder`, a pure check tests every tracked id against catalogue id sets that the shell passes in. A miss sets the entry's state to `unresolvable` and adds an `unresolvable` record. The miss stamps nothing, and the entry is kept out of this chunk's order. An entry that was `unresolvable` and now resolves goes into `chunkOrder` as an ordinary entry (AD-7). The `jewel` miss becomes the same per-entry mark, made inside the step. An absent `weights.json` adds a `weights-absent` record, and the run goes on normally. A present `weights.json` has its `statId` and `categoryId` values checked against the catalogue. Each miss is reported only (AD-9 row 2).

**Decisions (2026-09-26, human):**
- **The weights-id check is in scope.** A narrow reader in `sync` reads the `schemaVersion` major, the outer `bases` keys (`categoryId`) and every line's `statId`. Each distinct miss adds an `uncatalogued-weights-id {identifier, identifierKind: 'statId' | 'categoryId'}` record. A `null` `statId` is skipped and never reported. The file is never rewritten, and a miss never refuses it.
- **A recovered entry the chunk does not reach stays `unresolvable`** in `dataset.json` until the step prices it. The recovery changes only the order's input, and the publish path does not change.
- **The spec is kept whole** at about 1,900 tokens.

**Decisions (2026-09-26, agent):**
- **Weights reader failures:** an unknown major version, or a file that does not parse, refuses loudly. It goes through the catch path as a `run-failure` record (NFR-8, the same rule as every other load). Anything else the reader does not need is left to 3.3's schema.
- **Both new record members** (`weights-absent`, `uncatalogued-weights-id`) land together in one contracts commit, first. The weights records are sorted by `identifierKind`, then by `identifier`.
- **The spine owns the `jewel` ruling.** AD-25 (mark it and continue) overrides `IMPLEMENTATION-NOTES.md` §10 ("load error"). The §10 fix is logged in `deferred-work.md`. It is not made here.
- **`weights-absent` record:** `{kind: 'weights-absent', uncheckableClassNames: string[]}`. The list holds the distinct `className` values of non-pruned `crafted` entries, sorted by code unit. This covers AD-25's rule to report `className` "as uncheckable rather than clean". 
- **A miss keeps metadata:** it keeps `lastAttemptedAt`, `lastSearchId` and `lastSearchLeague` as they were, and drops only the observation.
- **Every miss on an entry gets its own record,** in field order: `categoryId` or `baseTypeId`, then prefix `statId`, then suffix `statId`.

## Boundaries & Constraints

**Always:** The check runs before the first request, and a `busy` lock costs no catalogue work. `className` is never checked against the catalogue. Offline marks never stamp `lastAttemptedAt`. An empty search stays `no-listings`. Records dedup through `carryRecords`. The catalogue reaches the check through `fs` and a loader. Effects go through ports only.

**Never:** No inference from search results. The run never aborts on a per-entry miss. No cross-file gate (3.3). No league gate (1.11). No change to `core`'s `chunkOrder`. No write under `data/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior |
|---|---|---|
| Unknown stat | the prefix `statId` is not in `stats.json` | state `unresolvable`, record `statId`, no request for it, and the other entries are priced |
| Unknown base / category | a `raw` `baseTypeId` or a `crafted` `categoryId` is missing | the same, with `baseTypeId` / `categoryId` |
| Was priced | the previous state is `priced`, and the id is now missing | `unresolvable`, with the old `lastAttemptedAt` kept |
| Not reached | 3 eligible, 1 of them a miss, and the chunk is bounded after 1 | `notReachedCount: 1` |
| Pruned | a pruned entry with a missing id | not checked, not marked, no record |
| Recovery | previous `unresolvable`, and the ids now resolve | sits in row 2 of the order, not row 3 |
| Jewel miss | the derived base type is not in `items.json` | `unresolvable` plus a `baseTypeId` record, no search, and the chunk continues |
| Empty search | zero results | `no-listings` |
| Weights absent | no `data/weights.json` | a `weights-absent` record, and the run is otherwise unchanged |
| Weights present | the file exists | no `weights-absent` record |
| Weights miss | a line's `statId`, or an outer `categoryId`, is not in the catalogue | one `uncatalogued-weights-id` record for each distinct id, and the run continues |
| Weights null | a line with `statId: null` | skipped, no record |
| Weights bad major | `schemaVersion` has an unknown major | a `run-failure` record, and the error is rethrown |
| Repeat | the same miss two chunks running | one record |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/sync-run-report.ts` L93: `UnresolvableRecordSchema` exists. Add the `weights-absent` and `uncatalogued-weights-id` members to the union (L143), and update `index.ts` and its test.
- `docs/architecture/.../WEIGHTS-FILE-SCHEMA.md` L310–315 and `data/weights.json`: the shape is `bases[categoryId][className].{prefix,suffix}.entries[].statId`. It has 17 `null` lines. No weights schema exists in `contracts`, and none is added here.
- `packages/sync/src/load-data-file.ts`: `loadDataFile` checks the major version.
- `packages/contracts/src/trade-catalogue.ts` L146–170: the `flatten*Catalogue` functions and `filterOptionIds(c, 'category')`. `envelopes.ts` L95–98: the file schemas.
- `packages/sync/src/pricing/load-item-types.ts`: the loader pattern (`loadDataFile`, `CATALOGUE_ITEMS_PATH`). Copy it for the stats and filters files.
- `packages/sync/src/pricing/search-body.ts` L50/L164: `UnknownClassBaseTypeError`. `price-entry.ts` L252: `createPricingStep`. Catch the error there and return `completed` with an `unresolvable` entry and no stamp.
- `packages/sync/src/chunk/run-chunk.ts`:
  - `StepResult` L111: add optional `records`.
  - `ChunkPorts` L135: add `catalogue`.
  - Tracked load L401, dataset load L414, `chunkOrder` L417: filter out misses and strip recovered states before it.
  - `newRecords` L341.
  - Publish: offline marks join the step entries.
- `packages/core/src/chunk-order.ts` L80: read only. Do not change it.
- `packages/sync/src/dry-run.ts` L206 `readRepositorySnapshot`: add `stats.json` and `filters.json`, and `weights.json` presence.
- `packages/sync/src/chunk/run-chunk.test.ts`: `harness`, `scriptedStep` and `datasetText` (L727). Copy these.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/sync-run-report.ts` + `index.ts` + tests: the `weights-absent` and `uncatalogued-weights-id` records. Commit them alone, first.
- [x] `packages/sync/src/catalogue/catalogue-ids.ts` + test: `CatalogueIds {statIds, baseTypeIds, categoryIds}` and `loadCatalogueIds(fs)`.
- [x] `packages/sync/src/chunk/catalogue-check.ts` + test: a pure `checkCatalogue(tracked, dataset, ids)` that returns `{marked: DatasetEntry[], records, excludedKeys, orderDataset}`.
- [x] `packages/sync/src/catalogue/weights-ids.ts` + test: a narrow reader of `weights.json` that returns absent or `{statIds, categoryIds}`, with nulls skipped. Also a pure `checkWeightsIds(ids, catalogue)` that returns the sorted records.
- [x] `packages/sync/src/pricing/price-entry.ts` + test: the per-entry `jewel` mark.
- [x] `packages/sync/src/chunk/run-chunk.ts` + test: wire the tracked check, the step records, the weights-absence record and the weights-id records. Cover every matrix row.
- [x] `packages/sync/src/dry-run.ts` + test, and `index.ts`: the catalogue ids and weights presence. Output stays deterministic.
- [x] `docs/stories/deferred-work.md`: append the §10-versus-AD-25 note.

**Acceptance Criteria:**
- Given `pnpm check`, when it runs, then it passes.
- Given `pnpm test`, when it runs, then every suite passes, no request escapes, and nothing is written under `data/`.
- Given `pnpm sync:dry` on today's repository, when it runs twice, then stdout is byte-identical, every tracked id resolves, and any `uncatalogued-weights-id` records reflect the committed `weights.json`.

## Implementation Notes

## Spec Change Log

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 27 findings — high 0, medium 4, low 15, false 8, maybe-false 0
- findings:
  - `[false]` `[reject]` Blind: a misspelt `jewel` class is not caught by the offline check — the intent places the `jewel` mark inside the step and says `className` is never checked against the catalogue.
  - `[medium]` `[patch]` Blind: a `jewel`-miss entry comes back every chunk — verified. The offline check treated it as recovered, so it skipped row 3's retry interval. An active one returned once per pass, and a pinned one took a row-1 visit every chunk. Fixed: `checkCatalogue` never recovers a crafted `jewel` entry, so `chunkOrder` keeps it in row 3. Tests were added in `catalogue-check.test.ts` and `run-chunk.test.ts`.
  - `[low]` `[reject]` Blind: row 3 can no longer receive a catalogue miss — this is what the intent requires: a miss is kept out of the order, and a recovered entry is ordinary. After the `jewel` patch, row 3 is still fed by step-marked `jewel` entries.
  - `[low]` `[reject]` Blind: repeats are tested only for `unresolvable` records — `carryRecords` dedups every record kind by deep equality (`sync-report.ts:46`). The mechanism is generic, and a test per kind would add nothing.
  - `[low]` `[patch]` Blind: no test shows the offline marks survive an early-ended chunk — grouped with the verification-gap finding below. The 4xx-abort test was added.
  - `[low]` `[reject]` Blind: no test for a pinned entry with a missing id — no defect shown. The entry is removed from `tracked` before `chunkOrder`, so it counts in no row and no cap.
  - `[false]` `[reject]` Blind: `deferred-work.md` is rewritten and inconsistent — the header rewrite and the "Resolved" section are another session's edits (commit 8fcf365 and an uncommitted header change). This story's hunk is only the appended 1.10 section.
  - `[low]` `[reject]` Blind: the weights version is hard-coded in `sync` — a drift fails loudly as `unknown-major`, and the weights schema belongs to Story 3.3 (Code Map).
  - `[false]` `[reject]` Blind: refusal reasons from `checkSchemaVersion` are collapsed — `checkSchemaVersion` has exactly two reasons (`unknown-major`, `malformed`), and both map one-to-one.
  - `[low]` `[reject]` Blind: `WeightsAbsentRecordSchema` does not enforce distinct and sorted — the only producer guarantees it, and a refinement adds complexity for input no producer emits.
  - `[low]` `[reject]` Blind: step-raised `jewel` records sit after the weights records — cosmetic ordering, and the report is not consumed by order.
  - `[false]` `[reject]` Blind: the run-chunk test catalogue treats the three id sets as one — `catalogue-check.test.ts` tests which set each id is checked against.
  - `[low]` `[patch]` Blind: bookkeeping is missing (`sprint-status.yaml`, untracked spec, barrel test) — the finalize commit marks 1.10 `done` in `sprint-status.yaml` and commits the spec. The barrel-export test is rejected: `pnpm check` catches a broken export.
  - `[low]` `[reject]` Blind: `items.json` is parsed twice per run — a negligible cost on an offline read. Sharing the parse would change the port shape.
  - `[low]` `[reject]` Edge: an empty-string `bases` key or `statId` gives a record that fails `min(1)` — unlikely in a generated file, and the fix adds guards.
  - `[low]` `[patch]` Edge: `readWeightsIds` throws after the check has filled the records — fixed: the weights file is now read before `checkCatalogue`, so a refusal leaves no unpublished marks in the failure report.
  - `[false]` `[reject]` Edge: `ChunkOutcome` leaves out the marks and the check records — `ChunkOutcome.entries` and `.records` are documented as the step entries and the lock records (`run-chunk.ts:194–204`). The dataset and the report carry the rest.
  - `[low]` `[reject]` Edge: two `weights-absent` records with different class lists when the tracked classes change mid-run — rare, and the fix needs replace-not-append logic in the carry path.
  - `[medium]` `[patch]` Edge: a `jewel` entry is recovered and re-marked every pass — the same root cause as the Blind `jewel`-miss finding. Patched as above.
  - `[false]` `[reject]` Edge: `deferred-work.md` header rewrite (claim) — another session's edit, not this story's.
  - `[low]` `[patch]` Verification gap: no 4xx-abort test with a run-start miss — added "4xx abort after an offline miss: the mark is published and its record precedes the run-failure".
  - `[false]` `[reject]` Verification gap (other): `deferred-work.md` header rewrite — another session's edit.
  - `[medium]` `[patch]` Verification gap (other): a `jewel`-marked entry is recovered every chunk — the same root cause. Patched as above.
  - `[medium]` `[patch]` Intent: the next-run behaviour of a `jewel`-marked entry is unset (C2), so row 3 is bypassed — the same root cause. Patched as above. Row 3 now holds such an entry.
  - `[low]` `[reject]` Intent: any `statId` that is not a string is skipped, not only `null` — `null` is skipped as required. Other shapes are Story 3.3's schema concern, per the intent.
  - `[false]` `[reject]` Intent: `deferred-work.md` header rewrite — another session's edit.
  - `[low]` `[reject]` Intent: the matrix is tested at `runChunk` with a synthetic catalogue — the real loader is tested in `catalogue-ids.test.ts`, and the dry-run tests compose the real loader, the real step and `runChunk` on committed files.

## Verification

**Commands:**
- `pnpm check` -- expected: pass
- `pnpm test` -- expected: all green
- `pnpm sync:dry` -- expected: exit 0, and byte-identical stdout on two runs
- `git status -- data/` -- expected: clean

## Auto Run Result

Status: done

**Summary:** `sync` now tests every tracked id against the committed catalogue. The check runs under the lock, after the dataset load and before `chunkOrder`. A miss is marked `unresolvable` without a stamp, reported once per miss, and kept out of the order. An entry that recovers joins the order as an ordinary entry. A `jewel` derivation miss is now marked per entry inside the step, and the chunk continues. An absent `weights.json` adds a `weights-absent` record. A present file has its `statId` and `categoryId` values checked, report-only.

**Files changed:**
- `packages/contracts/src/sync-run-report.ts`, `index.ts` and tests: the `weights-absent` and `uncatalogued-weights-id` record members (commit 9ec999a).
- `packages/sync/src/catalogue/catalogue-ids.ts` and test: `loadCatalogueIds(fs)` returns the stat, base-type and category id sets.
- `packages/sync/src/catalogue/weights-ids.ts` and test: the narrow `weights.json` reader, `checkWeightsIds` and `weightsAbsentRecord`.
- `packages/sync/src/chunk/catalogue-check.ts` and test: the pure `checkCatalogue` and `markUnresolvable`.
- `packages/sync/src/chunk/run-chunk.ts` and test: the new `catalogue` port, the wiring of the check and the weights read, the offline marks published with the step entries, the step records, and every matrix row covered.
- `packages/sync/src/pricing/price-entry.ts` and test: the `jewel` miss becomes a `completed` step with a mark and a `baseTypeId` record.
- `packages/sync/src/pricing/search-body.ts`: a doc-comment update.
- `packages/sync/src/dry-run.ts` and test: the snapshot now includes `stats.json`, `filters.json` and `weights.json`, and the catalogue port is wired.
- `packages/sync/src/index.ts`: the new exports.
- `docs/stories/deferred-work.md`: the §10.2-versus-AD-25 note is appended.
- `docs/stories/sprint-status.yaml`: 1.10 is marked `done`.

**Review findings:** 27 findings (medium 4, low 15, false 8), grouped into 4 patched entries:
- the `jewel` recovery loop (medium): `checkCatalogue` never recovers a `jewel` entry;
- the weights read moved before the check (low);
- a 4xx-abort test with an offline miss (low);
- sprint-status bookkeeping (low).

Nothing is deferred. Every rejected finding and its reason is in the Review Triage Log.

**Follow-up review recommended:** false. The patched entries were 1 medium and 3 low, with no high.

**Verification:** after the patches, `pnpm check` passes (typecheck, lint and depcruise), and `pnpm test` passes 51 files and 527 tests. `pnpm sync:dry` exits 0 on two runs with byte-identical stdout, and `git status -- data/` is clean. The matrix audit found a covering test for all 14 rows, and each one ran and passed.

**Residual risks:**
- The `jewel` recovery exclusion keys on the literal `categoryId === 'jewel'`. `search-body.ts` picks the jewel search arm from the category's make-up in `items.json`, so another base-type category in that arm would not be protected. Today `jewel` is the only such category.
- A `jewel` entry marked for a catalogue-id miss that later resolves waits in row 3 (up to 24 h), not in row 2.
- `WEIGHTS_SCHEMA_VERSION = '6.0.0'` is a second copy of the weights contract version until Story 3.3 adds a schema in `contracts`.
- Another session had uncommitted edits in the working tree during this run (`AGENTS.md`, `.claude/settings.json`, `.claude/skills/deferred-work-sweep/`, `docs/reviews/`, `docs/stories/epic-1-context.md`, and the header line of `docs/stories/deferred-work.md`). They were left out of this story's commits and remain uncommitted.
