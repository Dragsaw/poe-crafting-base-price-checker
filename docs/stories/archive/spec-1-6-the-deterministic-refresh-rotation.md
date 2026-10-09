---
title: 'Story 1.6: The deterministic Refresh Rotation'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_revision: '0e46b7ca83a084ec5f336dcf00be06f19592fdb0'
route: 'dispatch'
review_loop_iteration: 0
followup_review_recommended: false
deferred:
  - summary: >-
      The fixed DRY_RUN_INSTANT (2026-01-01) makes every row-3 entry undue in sync:dry once a real dataset carries later lastAttemptedAt values.
    evidence: |-
      now - attemptedAt is negative against the fixed instant, so the 24 h retry check fails and the dry run previews a different row 3 than a live run. The instant predates Story 1.6. It matters once Story 1.8 writes data/dataset.json. One option is to take the instant from the snapshot's generatedAt.
    location: >-
      packages/sync/src/dry-run.ts
    severity: low
  - summary: >-
      Duplicate canonical keys in tracked.json are not rejected, so one key can be placed or visited twice.
    evidence: |-
      TrackedFileSchema is z.array(TrackedEntrySchema) with no uniqueness refine. This predates Story 1.6; the 1.5 order had the same exposure.
    location: >-
      packages/contracts/src/envelopes.ts
    severity: low
  - summary: >-
      A dataset.json from another league would drive the rotation order and the unresolvable exclusions.
    evidence: |-
      runChunk does not compare dataset.league with the active league, and chunk/ may not read config.json. To settle it, check whether a league switch regenerates or resets dataset.json (AD-19, Story 1.8).
    location: >-
      packages/sync/src/chunk/run-chunk.ts
    severity: medium (unverified)
context:
  - '{project-root}/docs/stories/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `core`'s `chunkOrder` is a placeholder. It sorts by canonical key and ignores curation status, `lastAttemptedAt`, price state and the clock. The pinned cap is enforced at neither end. So nobody can say how often a row gets re-priced.

**Approach:** Replace the body of `chunkOrder` with AD-7's rotation. It is a pure function of the tracked list, the dataset entries, the completed keys and a passed-in instant. The runner loads `data/dataset.json` (absent means every entry is never-attempted) and applies the runtime pinned truncation against the live search allowance. A new `sync` module outside `chunk/` holds the load-time inequality (IMPLEMENTATION-NOTES §6) and builds the five-field starvation record.

**Decisions (2026-09-26):**
- **Pinned + `unresolvable` goes to row 3 only**, the same as active. A pinned entry whose pricing keeps failing is retried at most once per 24 h, and the cap stops paying for it every chunk.
- **Spec length kept** at about 1,800 tokens. The user chose not to split.

## Boundaries & Constraints

**Always:**
- Rows, in order (AD-7). Row 1: `pinned`, not `unresolvable`. Row 2: `active`, not `unresolvable`, not in the pass's completed set. Row 3: every non-pruned entry whose dataset price state is `unresolvable`, due when `lastAttemptedAt` is absent or `now − lastAttemptedAt ≥ 24 h`, and not completed. `pruned` is never selected.
- Within each row: oldest `lastAttemptedAt` first (compare instants, not strings), absent before any present value, ties broken by `compareTrackedEntries`.
- The pass covers rows 2–3 only. Pinned entries are exempt from rotation, so their keys are never written to `sync-progress.json`. A new pass starts when every due row 2–3 entry is complete.
- Runtime truncation. After a pinned step reports `searchRemaining = R` and `P` pinned entries are left, and rows 2–3 are non-empty: if `R < P + 1`, visit only `max(R − 1, 0)` more pinned entries, then go on to row 2. The chunk records a starvation `{discoveredAllowance: first reported R + 1, pinnedCount, pinnedRefreshed, activeRefreshed}` on the outcome. The outcome kind and exit behaviour stay unchanged.
- The load-time check is `count(pinned) ≤ 0.5 × minChunkSearches`. It returns a typed error that names both numbers. It lives in `sync` only, outside `chunk/`, and the same module adds `declaredMinChunkSearches` to make the `PinnedStarvationRecord`.
- `sync:dry` also snapshots `data/dataset.json` read-only when it is present.

**Never:**
- `chunk/` never names `minChunkSearches` or `config.json`. The 1.5 source-scan test stays.
- Never key on observation time or on the `not-yet-synced` state.
- No catalogue check (Story 1.10), no report write or not-reached count (1.9), no dataset write (1.8), no wiring into a live command.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior |
|---|---|---|
| Row order | pinned P, active A, unresolvable-due U, pruned X | P, A, U; X absent |
| Never attempted | active A1 attempted, A2 no `lastAttemptedAt` | A2 before A1 |
| Tie / cold start | no dataset | canonical-key order within each row |
| Retry bound | U attempted 23 h ago / 24 h ago | excluded / included |
| Active + unresolvable | active entry, dataset `unresolvable`, attempted 1 h ago | not selected in rows 2 or 3 |
| Pinned + unresolvable | pinned entry, dataset `unresolvable`, attempted 1 h ago / 25 h ago | not selected / row 3 |
| Recovered | same entry, dataset state no longer `unresolvable` | row 2, no wait |
| Pinned every chunk | pinned key in progress | still in row 1 |
| Starvation | 3 pinned, 2 active, first step reports R=2 | 1 more pinned, then active; record 3/2/…; outcome kind unchanged |
| No rotation waiting | 3 pinned, nothing in rows 2–3, R=1 | no truncation, no record |
| Load-time cap | 3 pinned, minChunkSearches 5 | typed error naming 3 and 2.5 |
| Determinism | same inputs twice, shuffled input order | identical order |

</frozen-after-approval>

## Code Map

- `packages/core/src/chunk-order.ts`: `chunkOrder(tracked, completedKeys)` → `{entries, completed, newPass}`. The runner is its only caller (`run-chunk.ts:175`). Widen the input to `{tracked, dataset, completed, now}` and return the rows separately (`pinned`, `rotation`) so the runner can truncate. Rewrite `chunk-order.test.ts`.
- `packages/contracts/src/dataset.ts`: `DatasetEntry {entryKey, price.state, lastAttemptedAt?}`, keyed by `canonicalKey`. `envelopes.ts:57`: `DatasetFileSchema`. `canonical-key.ts`: `compareTrackedEntries`, `compareCanonicalKeys`. No contracts change is expected.
- `packages/contracts/src/sync-run-report.ts:78`: `PinnedStarvationRecordSchema` (five fields). `envelopes.ts:45`: `ConfigFileSchema.minChunkSearches`.
- `packages/sync/src/chunk/run-chunk.ts`: `runChunk`. Reuse `loadEnvelope` for `DATASET_PATH = 'data/dataset.json'`. Pass `clock.now()`. Iterate pinned then rotation with the truncation. Write progress from rotation completions only. Add `pinnedStarvation?` to `ChunkOutcomeBase`. Keep the lock and release path as it is.
- `packages/sync/src/chunk/run-chunk.test.ts:427-462`: the yardstick tests stay green.
- `packages/sync/src/dry-run.ts`: `dryRun(trackedText)` → add `datasetText`. Print `pinnedStarvation` when present.
- `data/tracked.json`: 4 active and 1 pruned. There is no `config.json` and no `dataset.json`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/core/src/chunk-order.ts` + test: the rotation, plus a pure `pinnedToKeep(left, remaining, rotationWaiting)`. Cover the core matrix rows.
- [x] `packages/sync/src/chunk/run-chunk.ts` + test: load the dataset, apply the truncation, write progress, add the starvation outcome. Cover Starvation, No rotation waiting, Pinned every chunk.
- [x] `packages/sync/src/pinned-cap.ts` + test: `checkPinnedCap(entries, config)` and `pinnedStarvationRecord(starvation, config)`. The record passes `PinnedStarvationRecordSchema`.
- [x] `packages/sync/src/dry-run.ts` + test: the dataset snapshot. Two runs print identical stdout.
- [x] `packages/sync/src/index.ts`: export the pinned-cap functions.

**Acceptance Criteria:**
- Given `pnpm check`, when it runs, then it passes.
- Given `pnpm test`, when it runs, then every suite passes, no request escapes, and nothing is written under `data/`.
- Given a fake filesystem holding tracked and dataset files, when `dryRun` and `runChunk` each run on it with the same clock, then they visit the same keys in the same order.

## Implementation Notes

- `chunkOrder(input)` returns `{pinned, rotation, completed, newPass}`. Row 1 is `pinned` and rows 2 and 3 are `rotation`, in that order. A completed key stays in force while it names any rows 2–3 entry, including an `unresolvable` entry that is not due. So a retried entry is not retried again in the same pass. `newPass` needs at least one due rows 2–3 entry. An entry that is not due does not hold the pass open.
- The truncation runs after every pinned step that reports `searchRemaining`. It only shrinks the pinned limit. The starvation record is set whenever `R < P + 1` and rows 2–3 are non-empty, even when no pinned entry is left to cut. `discoveredAllowance` is the first reported R plus the steps completed up to that report. This is R + 1 when the first pinned step reports, as in the matrix.
- `pinnedCount` counts every tracked entry with status `pinned`, including one that is `unresolvable`, the same count `checkPinnedCap` uses (§6). `activeRefreshed` counts rows 2–3 completions. Row 1 is exempt from the pass; a pinned `unresolvable` entry in row 3 is written to progress like any row 3 entry.
- `dryRun(trackedText, datasetText?)`: `pinnedStarvation` appears in the printed JSON only when present. The offline step reports no allowance, so today it never appears.

## Spec Change Log

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 28 findings — high 0, medium 1, low 21, false 2, maybe-false 4
- findings:
  - `[low]` `[reject]` (verification-gap) `pnpm sync:dry`'s `main()` dataset read is never exercised with a real `dataset.json` — the gap is real, but no dataset exists until Story 1.8 and closing it needs injectable paths or new exports (added surface) to guard against a hypothetical regression.
  - `[low]` `[patch]` (verification-gap) `discoveredAllowance` is only tested with a first-step report — added a runner test where the first pinned step reports nothing and the second reports R=1; the test asserts the full record `{3,3,2,2}`.
  - `[low]` `[reject]` (verification-gap, other) the `dispossessed` return's `...starvation` is untested — nothing consumes it until Story 1.9, and the spread is trivially correct.
  - `[low]` `[defer]` (blind) the fixed `DRY_RUN_INSTANT` (2026-01-01) will make row 3 undue in `sync:dry` once a real dataset carries later timestamps — the instant predates this story (1.5). The fix is a design choice (for example the snapshot's `generatedAt`), and it matters only once Story 1.8 writes `dataset.json`.
  - `[low]` `[reject]` (blind) nothing calls `checkPinnedCap` or `pinnedStarvationRecord` — the intent excludes the wiring ("no wiring into a live command").
  - `[low]` `[patch]` (blind) `pinnedCount` is row-1 size, which disagrees with `checkPinnedCap` and with §6 "the pinned set at load" — the count now includes every tracked `pinned` entry.
  - `[low]` `[reject]` (blind) `activeRefreshed` counts row-3 retries, including a pinned+`unresolvable` one — this happens only when a pinned+`unresolvable` retry and starvation fall in one chunk. Counting rotation work is defensible for the diagnosis, and narrowing it adds a status branch.
  - `[low]` `[patch]` (blind) comments claim pinned keys never enter the pass, but a pinned+`unresolvable` row-3 key is written (correct per the Decision "same as active") — the comments now say "row 1 is exempt", and a runner test covers the row-3 pinned key written to progress.
  - `[maybe-false]` `[reject]` (blind) malformed or future timestamps — the `NaN` part is false: `IsoTimestampSchema` (`z.iso.datetime()`) validates `lastAttemptedAt`, and the clock port emits ISO. Future-dated values need clock skew between the Story 1.8 writer and the reader. If real, the harm is low (at most a delayed retry).
  - `[low]` `[reject]` (blind) duplicate `entryKey` in the dataset makes the order depend on input order — real (the schema has no uniqueness refine), but the dataset is machine-written by Story 1.8 and the fix adds a guard.
  - `[low]` `[patch]` (blind) truncation paths only partly tested — added tests for the late first report, a rotation step reporting R=0 (no truncation or record), and a yield in row 1 after a cut.
  - `[false]` `[reject]` (blind) `discoveredAllowance ?? 0` hides a broken invariant — `truncated` is set only inside the branch that first assigns `discoveredAllowance`, so the fallback cannot produce a wrong value.
  - `[low]` `[patch]` (blind) `ChunkOutcomeBase.completed` doc was ambiguous against progress — the doc now says it includes row-1 keys and that progress holds only the rows 2–3 subset.
  - `[low]` `[patch]` (blind) stale `dry-run.ts` doc comments — the `dryRun` JSDoc and the module header are corrected.
  - `[false]` `[reject]` (blind) the diff omits the spec and sprint status — the spec was left out of the review diff on purpose (the claims file goes to the edge-case layer only), and it is committed with this change. Sprint-status bookkeeping is the dispatcher's job, not a code defect.
  - `[low]` `[patch]` (blind) the new deferred-work entry copied §6 wording — resolved by removing the entry, because the medium finding below fixes the gap it described.
  - `[low]` `[reject]` (blind) `checkPinnedCap` edge tests and a weak substring assertion — the schema has `minChunkSearches` `min(1)`, and every field of the error is asserted exactly.
  - `[low]` `[patch]` (intent) R-A: where a pinned+`unresolvable` key goes in the pass — grouped with the comment finding above. The Decision "the same as active" and row 3's "not completed" settle it as a pass key. The comments and a test now pin this down.
  - `[low]` `[patch]` (intent) R-B: `pinnedCount` row 1 vs status count — grouped with the `pinnedCount` patch above.
  - `[maybe-false]` `[patch]` (intent) R-C: `discoveredAllowance` is R + steps taken, not literally R + 1 — the two are identical whenever the first pinned step reports. Which one is right when it does not depends on whether a live step can spend a search without reporting (Story 1.7). This is grouped with the late-first-report test patch, which pins the current reading.
  - `[low]` `[reject]` (intent) R-D: `pinnedRefreshed` is the completed pinned entries, not the ones "kept", and the two differ only on a yield after a cut — this happens only when a yield follows a cut in the same chunk, and the §6 wording allows either reading.
  - `[low]` `[reject]` (intent) R-D: `activeRefreshed` broad reading — grouped with the blind `activeRefreshed` row above.
  - `[low]` `[reject]` (intent) the dataset snapshot is tested at the function level, not the command level — grouped with the verification-gap `main()` row above.
  - `[low]` `[defer]` (edge) duplicate canonical keys in `tracked.json` can place one key twice — this predates the story: `TrackedFileSchema` has no uniqueness refine, and the 1.5 order had the same exposure.
  - `[low]` `[reject]` (edge) duplicate dataset `entryKey` — grouped with the blind duplicate-`entryKey` row above.
  - `[maybe-false]` `[reject]` (edge) a future `lastAttemptedAt` holds an entry back longer than 24 h — grouped with the blind timestamp row above.
  - `[maybe-false]` `[defer]` (edge) a dataset from another league drives the rotation order — whether a league switch regenerates or resets `dataset.json` (AD-19, Story 1.8) would settle it. If real: medium.
  - `[medium]` `[patch]` (edge) the last pinned step reporting R=0 while rotation waits recorded no starvation — the runner now sets the record whenever `R < P + 1` with rows 2–3 waiting, even with nothing left to cut. A runner test covers it, and the deferred-work entry was removed.

## Verification

**Commands:**
- `pnpm check`: expected to pass.
- `pnpm test`: expected all green.
- `pnpm sync:dry`: expected exit 0 and JSON on stdout.
- `git status -- data/`: expected clean.

## Auto Run Result

Status: done

**Summary.** `chunkOrder` now implements AD-7's Refresh Rotation.
- It is a pure function of the tracked list, the dataset entries, the completed keys and an instant.
- It returns row 1 (`pinned`) and rows 2–3 (`rotation`).
- It orders each row oldest `lastAttemptedAt` first, with the 24 h bound on `unresolvable` retries.

`runChunk` loads `data/dataset.json` and applies the runtime pinned truncation. It writes only rows 2–3 completions to progress. It reports `pinnedStarvation` on the outcome without changing the kind. A new `sync/pinned-cap.ts` holds the load-time cap and builds the five-field record. `sync:dry` snapshots the dataset read-only.

**Files changed**
- `packages/core/src/chunk-order.ts`: the rotation, `pinnedToKeep` and `UNRESOLVABLE_RETRY_MS`.
- `packages/core/src/chunk-order.test.ts`: every core matrix row, plus `pinnedToKeep`.
- `packages/core/src/index.ts`: the new exports.
- `packages/sync/src/chunk/run-chunk.ts`: dataset load, truncation, rows 2–3 progress, and the `pinnedStarvation` outcome.
- `packages/sync/src/chunk/run-chunk.test.ts`: tests for the rotation, starvation (including nothing left to cut, a late first report, and a yield after a cut), no rotation waiting, pinned every chunk, and a pinned+`unresolvable` entry in row 3.
- `packages/sync/src/pinned-cap.ts`: `checkPinnedCap` and `pinnedStarvationRecord` (new).
- `packages/sync/src/pinned-cap.test.ts`: the cap error naming 3 and 2.5, the boundary, and the record against `PinnedStarvationRecordSchema` (new).
- `packages/sync/src/dry-run.ts`: the dataset snapshot and the optional `pinnedStarvation` in the output.
- `packages/sync/src/dry-run.test.ts`: dataset order, parity with `runChunk` on the same fake and clock, and determinism.
- `packages/sync/src/index.ts`: the new exports.

**Review findings** (28 in total; the full rows are in the Review Triage Log)
- **Patches applied:** 1 medium and 9 low, with 1 maybe-false grouped into a patch. The medium was the starvation record missing when nothing was left to cut. The lows: the `pinnedCount` definition, the row-1-exempt comments with a row-3 pinned progress test, the `completed` doc, the `dry-run` docs, three truncation tests, and removing the obsolete deferred-work entry. The two intent rows R-A and R-B are grouped into those patches.
- **Deferred (3, in frontmatter):**
  - the fixed dry-run instant against a real dataset (low)
  - duplicate tracked keys (low, predates this story)
  - a dataset league mismatch (medium, unverified)
- **Rejected (14):**
  - `main()` dataset read untested: low, and the fix adds surface.
  - `dispossessed` starvation untested: low, nothing consumes it yet.
  - pinned-cap functions not wired in: excluded by the intent.
  - `activeRefreshed` breadth (2 rows): low, the reading is defensible, and a filter adds a branch.
  - malformed or future timestamps (2 rows): `NaN` is false because the schema validates. Future-dated values need clock skew, and the harm is low if they occur.
  - duplicate dataset `entryKey` (2 rows): low, the file is machine-written, and the fix adds a guard.
  - `?? 0` fallback: false, the fallback cannot produce a wrong value.
  - diff omits spec and sprint status: false, the spec is committed and sprint status is the dispatcher's job.
  - pinned-cap edge tests: low, the schema has `min(1)` and every field is asserted exactly.
  - `pinnedRefreshed` "kept" against "completed": low, it differs only on a yield after a cut.
  - command-level snapshot test: grouped with the `main()` finding.

**Follow-up review recommendation:** `false`. This first pass patched 0 high, 1 medium and 9 low entries.

**Verification**, after the patches:
- `pnpm check`: exit 0 (tsc, eslint with 0 warnings, depcruise with no violations).
- `pnpm test`: 38 files, 330 tests, all passed.
- `pnpm sync:dry`: exit 0.
- `git status -- data/`: clean.
- Matrix audit: all 12 rows are covered by passing tests.

**Residual risks**
- `discoveredAllowance` uses R + steps taken. That equals the matrix's R + 1 whenever the first pinned step reports. Whether it is right otherwise depends on Story 1.7's live step reporting headers on every search.
- `checkPinnedCap` is not yet called by any command.
- `sync:dry` cannot show `pinnedStarvation` yet, because the offline step reports no allowance.
