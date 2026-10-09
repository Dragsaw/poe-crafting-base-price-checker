---
title: 'Story 1.9: The structured Sync Report, with requests accounted per source'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_revision: '9470a092378ed007ef76715de8470c4f6c6e094d'
route: 'dispatch'
review_loop_iteration: 0
followup_review_recommended: false
deferred:
  - summary: >-
      No dryRun test covers the shell's starvationRecord wiring (pinnedStarvationRecord with the snapshot config).
    evidence: |-
      createFixtureHttpPort (packages/sync/src/pricing/fixture-port.ts) always answers with empty headers, so the pricing step never reports searchRemaining and a dryRun cannot starve the pinned set. Assert the pinned-starvation record, with declaredMinChunkSearches from config, at the live pnpm sync shell in 1.11, or once fixtures carry headers.
    location: >-
      packages/sync/src/dry-run.ts
    severity: low
  - summary: >-
      epic-1-context.md carries progress narrative that duplicates sprint-status.yaml.
    evidence: |-
      Lines such as "Stories 1.1 to 1.8 are done. Stories 1.9, 1.10 and 1.11 remain" go stale with each story. AGENTS.md places revision history in git or .memlog.md. These edits predate this run.
    location: >-
      docs/stories/epic-1-context.md
    severity: low
context:
  - '{project-root}/docs/stories/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A chunk collects `records` and `pinnedStarvation` on its outcome, but nothing writes `data/sync-report.json`. No code counts requests per source. A throw loses every record, so a failed unattended run leaves only an exit code (FR-25, FR-19).

**Approach:** Under the lock, beside the dataset and progress writes, `runChunk` builds a `SyncReportFile` and writes it through `writeArtifact`. The figures come from this chunk: requests per source from a counting HTTP wrapper, `notReachedCount` from the chunk order, and `trackedListEditedAt` from `resolveTrackedListAge`. The records are the unacknowledged records carried from the previous report plus this chunk's new records. On a throw, the chunk writes the report with a failure record and rethrows (AD-12, AD-7, Consistency Conventions *Logging*).

**Decisions (2026-09-26, human):**
- **Clearing a record:** the player hand-deletes it from `sync-report.json`. `sync` carries forward whatever records the previous file still holds.
- **Failure path:** add a `run-failure` record `{reason: 'trade-request-rejected' | 'unrecoverable-error', entryKey?, status?, message}` to contracts, landing first as its own commit. On a non-429 4xx (`MalformedRequestError`), publish the dataset and progress for the entries completed so far plus `lastAttemptedAt` stamped on the failing entry (AD-9), then write the report and rethrow. Any other throw writes the report only (1.8's rule for dataset and progress).
- **Live `pnpm sync`: deferred to 1.11**, together with the real git adapter. `sync:dry` prints the report using the fake git port.
- **Spec length kept** at about 1,900 tokens.

**Decisions (2026-09-26, agent):**
- **Edit date:** the tagged `TrackedListAge` that Story 1.2 decided (`git-author-date`, else `file-modified`, else absent) supersedes the epic AC's "no history yields no date". The spine edit is still owed. It is not made here.
- **`requestsBySource`:** all three keys are always present, and absent sources are zero-filled. `sync` sends only `tracked-list` requests today. `league-validation` stays `0` until 1.11. `catalogue-refresh` is always `0` in `sync`, because the refresh command reports on its own stdout (spec 1.4).
- **Not reached** = |row 1 + row 2 + row 3| − attempted. Pinned entries cut by the cap count as not reached. Pruned entries and unresolvable entries inside their retry interval are never in a row, so they never count.
- **Record identity:** a new record that deep-equals a carried record is not appended again. Records carry no timestamp.
- **Weights-absence and uncatalogued-weights records:** left to 1.10, which has the payload.

## Boundaries & Constraints

**Always:**
- `completed`, `bounded`, `yielded` and the failure path write the report under the lock. `busy` and `dispossessed` write nothing.
- Only a normal finish stamps `runFinishedAt`. The failure path leaves it absent (schema).
- A previous report that fails `SyncReportFileSchema` refuses loudly. This is the same rule as the dataset load (NFR-8).
- Effects go through ports only. The no-git-write scan stays green.

**Never:** No league gate (1.11). No catalogue check (1.10). No cross-file gate (3.3). No git write. No write under `data/` from a test or from `sync:dry`. No free-text console output as the outcome channel.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior |
|---|---|---|
| First run | no report, 3 searches + 3 fetches | `tracked-list: 6`, the other two sources `0`, `records: []`, `runFinishedAt` set |
| Carry-over | the previous report has a `stale-lock-broken` record | the record is still present after the next chunk |
| Dedup | the same starvation payload two chunks running | one record |
| Player cleared | the previous report has no records | only this chunk's new records |
| Not reached | 5 eligible, bounded after 2 | `notReachedCount: 3` |
| Excluded | pruned + in-interval unresolvable | not counted |
| Edit date | committed / uncommitted-only / neither | `git-author-date` / `file-modified` / key absent |
| 4xx abort | `MalformedRequestError` on the 3rd of 5 | entries 1–2 are published, entry 3 is stamped, a `run-failure` record `trade-request-rejected` is added, `runFinishedAt` is absent, the lock is released, the error is rethrown |
| Other throw | a step throws a plain `Error` | a `run-failure` `unrecoverable-error` record is added, and there is no dataset or progress write |
| Busy | lock held by another pid | no report write |
| Invalid previous | an unknown major version | refuse loudly, nothing written |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/sync-run-report.ts`: `SyncRunReportSchema` (L134), `SyncRunFiguresSchema` (L34) and the record union (L121). Add the `run-failure` member here, and in `index.ts` / `index.test.ts`.
- `packages/contracts/src/envelopes.ts` L70: `SyncReportFileSchema` (`schemaVersion` last).
- `packages/contracts/src/tracked-list-age.ts` L51: `resolveTrackedListAge`. `ports/git.ts`, `ports/fakes/git.ts`: `createFakeGitPort`.
- `packages/sync/src/chunk/run-chunk.ts`:
  - `ChunkPorts` (L108): add `git` and a request counter, or a counted `http`.
  - `ChunkOutcomeBase.records` (L137).
  - Starvation (L292–327).
  - Writes (L345, L353). Add the report write after the progress write.
  - `try/finally` (L356): add the catch path.
  - Add a `REPORT_PATH` beside `DATASET_PATH` (L70).
- `packages/core/src/chunk-order.ts` `chunkOrder` (L80): rows via `pinned` and `rotation`. Do not change core.
- `packages/sync/src/pinned-cap.ts` L55: `pinnedStarvationRecord` builds the record from the outcome's starvation.
- `packages/sync/src/lock.ts` L167: the `stale-lock-broken` source.
- `packages/sync/src/trade/client.ts` L276: the client takes an `HttpPort`. Wrap the port to count requests. Do not tag lanes.
- `packages/sync/src/pricing/price-entry.ts` L51: `MalformedRequestError`.
- `packages/sync/src/write-artifact.ts` L47: `writeArtifact`.
- `packages/sync/src/dry-run.ts` L63: `DryRunReport` gains `report`, from the fake git port. This discharges 1.5's run-report assertion.
- `packages/sync/src/no-git-write.test.ts` L27–34: leave it unchanged.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/sync-run-report.ts` + `index.ts` + tests: the `run-failure` record. Commit it alone, first.
- [x] `packages/sync/src/request-counter.ts` + test: an `HttpPort` wrapper that counts requests into `RequestsBySource` for a given source.
- [x] `packages/sync/src/chunk/sync-report.ts` + test: a pure `buildSyncReport({previous, newRecords, figures, runStartedAt, runFinishedAt?})`. It carries the previous records, dedups and zero-fills, and covers the matrix rows.
- [x] `packages/sync/src/chunk/run-chunk.ts` + test: the `git` port and the counter on `ChunkPorts`, the not-reached count, the report write, the catch path, and no write on busy or dispossessed.
- [x] `packages/sync/src/dry-run.ts` + test: `report` in the output. Two runs produce identical stdout.
- [x] `packages/sync/src/index.ts`: exports, `REPORT_PATH`, and the doc.

**Acceptance Criteria:**
- Given `pnpm check`, when it runs, then it passes.
- Given `pnpm test`, when it runs, then every suite passes, no request escapes, and nothing is written under `data/`.
- Given `pnpm sync:dry`, when it runs, then stdout carries a `report` that `SyncReportFileSchema` accepts, with all three sources present.

## Implementation Notes

## Spec Change Log

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 25 findings — high 0, medium 3, low 19, false 3, maybe-false 0
- findings:
  - `[low]` `[defer]` (verification-gap) No `dryRun` test covers the shell's `starvationRecord: pinnedStarvationRecord(starvation, config)` wiring — a patch was attempted but not applied: `createFixtureHttpPort` always answers with empty headers, so no `dryRun` can starve the pinned set. Deferred to 1.11, to be asserted at the live shell.
  - `[false]` `[reject]` (intent) The request count is tested only through a scripted step, not the real client — the `dryRun` tests drive `createPricingStep` → `createTradeClient` → a counted fixture port and assert `tracked-list: 2` exactly.
  - `[low]` `[defer]` (intent) The dedup test uses a hand-written starvation mapper, not the real one — same root cause and route as the verification-gap row above.
  - `[low]` `[reject]` (intent) Repeated identical `run-failure` records collapse to one — this is the intent's own Record identity decision ("a new record that deep-equals a carried record is not appended again").
  - `[low]` `[reject]` (intent) The 4xx abort test builds its own `MalformedRequestError` — it uses the real error class; the pricing step's throw of that class is covered by 1.8's tests. Not worth an end-to-end fixture.
  - `[false]` `[reject]` (intent) The edit date is tested only on the fake git port — this matches the intent; the real git adapter is deferred to 1.11 by the human decision.
  - `[low]` `[reject]` (intent) Scope: `epic-1-context.md` rewrite, `loadConfig`, and the `sprint-status.yaml` mismatch — the `epic-1-context.md` and `sprint-status.yaml` edits were in the working tree before this run; `loadConfig` is the minimal way to hand the yardstick to the shell.
  - `[medium]` `[patch]` (blind) The failure-path writes can replace the original error — each failure-path write now has its own guard; the original error is always the one rethrown, secondary faults are logged, and the report is still attempted after a failed publish. New tests cover a failing progress write and a failing report write.
  - `[low]` `[patch]` (blind) `writingReport` was set before `resolveTrackedListAge`, so a git fault after publish left no report — the flag now covers only the report's `writeArtifact`. A new test covers a fault while resolving the edit date.
  - `[low]` `[reject]` (blind) A gate abort reports `notReachedCount: 0` — with no chunk order, no row exists, which matches the intent's formula; the report also carries a `run-failure` record and no `runFinishedAt`. Fixing it would restructure the load order before the gate.
  - `[low]` `[reject]` (blind) Dedup merges repeated identical failures — this is the intent's Record identity decision.
  - `[low]` `[reject]` (blind) The raw `error.message` lands in a tracked file — the intent specifies `message`, and no live shell writes to disk until 1.11. The player reviews the file before pushing. Sanitising would add policy the intent does not set. Noted under residual risks.
  - `[low]` `[patch]` (blind) `starvationRecord` is optional, so the report can silently lose the starvation record — made required, and the test harness supplies `pinnedStarvationRecord`.
  - `[low]` `[reject]` (blind) Nothing ties the counter to the HTTP port — this is the Code Map's chosen wrapper design; a binding factory would add public surface.
  - `[low]` `[reject]` (blind) The `run-failure` schema does not tie `status` or `entryKey` to `reason` — the intent fixes the shape with both fields optional; this would be a contracts refinement beyond it.
  - `[low]` `[patch]` (blind) Test gaps on the failure and report-write paths — closed by the tests added with the failure-path guard patch. The remaining gaps (non-zero counts on failure, dedup of `run-failure`) are rejected: the logic is shared with the covered paths.
  - `[low]` `[patch]` (blind) The owed spine edit is missing from `deferred-work.md` — appended under `## Deferred from: story 1.9`.
  - `[low]` `[reject]` (blind) The spec status fields and checkboxes disagree — the fix edits this build's spec; finalization sets them anyway.
  - `[low]` `[defer]` (blind) `epic-1-context.md` carries revision narrative ("Stories 1.1 to 1.8 are done…") — these edits predate this run, and the file is agent context owned elsewhere.
  - `[low]` `[reject]` (blind) The Code Map cites stale line numbers — the fix edits this build's spec.
  - `[false]` `[reject]` (blind) The dry run's hidden dependency on `data/sync-report.json` — the `dry-run.ts` doc states that a snapshot of `data/sync-report.json`, when present, supplies the carried records; carry-over requires it.
  - `[medium]` `[patch]` (edge) A secondary throw in the catch replaces the original error — grouped with the failure-path guard patch above.
  - `[medium]` `[patch]` (edge) A published dataset with a failing progress or report write leaves no failure record — grouped with the failure-path guard patch; the report is now attempted after a failed publish.
  - `[low]` `[patch]` (edge) A git fault after publish leaves stale figures — grouped with the `writingReport` patch.
  - `[low]` `[reject]` (edge) Records grow without bound — this is intended by the human decision that the player clears records by hand; starvation dedups; the growth is linear in unacknowledged incidents.

## Verification

**Commands:**
- `pnpm check` -- expected: pass
- `pnpm test` -- expected: all green
- `pnpm sync:dry` -- expected: exit 0, and byte-identical stdout on two runs
- `git status -- data/` -- expected: clean

## Auto Run Result

Status: done

**Summary:** Under the lock, `runChunk` writes `data/sync-report.json` after the dataset and progress writes. The figures are requests per source from a counting `HttpPort` wrapper, `notReachedCount`, and the tagged `trackedListEditedAt`. The records are the carried records plus this chunk's new, deduplicated records. A throw writes the report with a `run-failure` record and rethrows. A `MalformedRequestError` first publishes the completed entries plus the stamped failing entry. `pnpm sync:dry` prints the report.

**Files changed:**
- `packages/contracts/src/sync-run-report.ts`, `index.ts` and tests: the `run-failure` record (commit `6393d03`, landed first).
- `packages/sync/src/request-counter.ts` and test: the per-source counting wrapper, `requestsBetween`, `zeroRequests`.
- `packages/sync/src/chunk/sync-report.ts` and test: pure `buildSyncReport` and `carryRecords`.
- `packages/sync/src/chunk/run-chunk.ts` and test: `REPORT_PATH`; the `git`, `requests` and required `starvationRecord` ports; the report write; the guarded failure path.
- `packages/sync/src/dry-run.ts` and test: `report` in the output, the counted fixture port, the fake git port, the carry-over snapshot.
- `packages/sync/src/load-config.ts`: `loadConfig`, so the shell can pass the yardstick.
- `packages/sync/src/index.ts`: exports and doc.
- `docs/stories/deferred-work.md`: the owed spine edit for `TrackedListAge`.

**Review findings breakdown:** 25 findings (medium 3, low 19, false 3).
- Patched: 5 entries. One medium: the failure path keeps the original error. Four low: the `writingReport` scope, the required `starvationRecord`, the failure-path tests, and the deferred-work ledger entry.
- Deferred: 2, both low. One is the dryRun starvation-wiring test, which the fixtures cannot express. The other is the progress narrative in `epic-1-context.md`, which predates this run.
- Rejected: 14 low findings and 3 false ones. The Review Triage Log gives the reason for each.

**Follow-up review recommendation:** false. Patched at entry verdict: high 0, medium 1, low 4.

**Verification:**
- `pnpm check`: pass (tsc, eslint, depcruise with 0 violations).
- `pnpm test`: 48 files, 475 tests, all pass.
- `pnpm sync:dry`: exit 0, byte-identical stdout on two runs. `report.figures.requestsBySource` is `{tracked-list: 10, league-validation: 0, catalogue-refresh: 0}`.
- `git status -- data/`: clean.
- Every row of the I/O matrix has a passing test in `run-chunk.test.ts`.

**Residual risks:**
- `run-failure.message` copies `error.message` verbatim into a file that is git-tracked and deployed. An adapter error in 1.11 could carry local paths.
- A gate abort reports `notReachedCount: 0`, because no chunk order exists.
- The shell must wrap the client's `HttpPort` with the counter it passes. No type enforces this.
- The starvation-record wiring through `dryRun` is untested (deferred).
