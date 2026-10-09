---
title: 'Epic 1 retro items 4, 8, 9: record identity, AD-8 penalty memory, chunk-only request figure'
type: 'bugfix'
created: '2026-09-26'
status: 'done'
baseline_revision: '90b9eb94bc0cce650bfbb554faeb1f2f2a1e2e81'
route: 'dispatch'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Spine rev 21 ruled three epic 1 retro items that the code does not yet implement. (4) `carryRecords` dedups on deep equality, so a record that carries a live measurement grows the report by one record per tick (L-A2). (8) The client drops `Retry-After` when the process exits, and no shell passes `invalidRequestThreshold`, so a short-cadence invoker spends a request inside every penalty window (R-8, L-A7). (9) `requestsBySource['catalogue-refresh']` is always 0 in every chunk report (R-2).

**Approach:** Contracts first, then sync. (4) Implement IN §12: one `isSameRecord` function in contracts, and a `carryRecords` that replaces a matched record in place. (8) Implement IN §5.3: an optional `notBefore` in sync-progress.json, written by a chunk that ends on a 429 or a malformed abort and checked right after the lock. Carry `retryAfterMs` through the leg, step and gate results, and give every shell a sync-side threshold constant of 1. (9) Implement AD-12 rev 21: the report figure keys only the two chunk sources, its reader drops the legacy key, and the refresh command prints its request count.

**Decisions (from the user):** The three items ship together in one spec, committed on `master`. The spec stays whole even though it runs over the token guideline. sync:dry gets no `notBefore` handling here. Item 14 owns ignoring and printing it. `DryRunSnapshot` carries no progress file, so until item 14 ships a dry run never reads `notBefore` and never defers.

## Boundaries & Constraints

**Always:**
- Contracts changes land before the sync changes. Every schema stays strict.
- `isSameRecord` declares a subject list for every record kind. A new kind that declares no subject list fails type-checking.
- `notBefore` = now + min(retryAfterMs, STALE_LOCK_AFTER_MS) after a 429, and = now + STALE_LOCK_AFTER_MS after a malformed abort. Every other ending that writes progress clears the field.
- The `notBefore` check runs after the lock is taken, or a stale lock is broken, and before every other load. A deferred run releases the lock, sends nothing, writes nothing and exits 0. There is one exception: a run that broke a stale lock writes sync-report.json alone, carrying the `stale-lock-broken` record.
- `RequestSourceSchema` keeps its three declared sources (AD-12). Only the report figure narrows to `tracked-list` and `league-validation`.

**Never:**
- Do not write `notBefore` for a league-gate 4xx rejection, a transport failure, a 5xx or a threshold yield. §5.3 says two endings write it and nothing else does.
- Do not put the threshold in `data/config.json`. AD-19 keeps that file at three keys.
- Do not hand-edit the committed `data/*.json` files. The tolerant reader handles the legacy report.
- Do not do items 1, 2, 3 or 14: the run-start reorder, the gate yield publishing marks, publish on every throw, and the dry-run clock.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Growth | Two chunks, each starving, with discoveredAllowance 3, then 1 | One `pinned-starvation` record at its first position, carrying allowance 1 |
| New subject | The second chunk has a changed `pinnedCount` | Two records |
| Step 429 | A step yields, retry-after 60s | progress `notBefore` = NOW+60s |
| Gate 429 | The leagues GET 429s, retry-after 7200s | progress keeps `completed` and gets `notBefore` = NOW + 2h (the retry-after 7200s, below the 6h cap). Dataset unchanged |
| Huge Retry-After | retry-after 86400s | `notBefore` capped at NOW+6h |
| Malformed abort | A step throws MalformedRequestError | `notBefore` = NOW+6h. Rethrown |
| Clearing | Completed or bounded, with `notBefore` in the past | Field absent |
| Deferred | now < notBefore | Outcome `deferred`, lock released, zero requests, no file written |
| Deferred + stale | A stale lock is broken and now < notBefore | Only sync-report.json is written, and it carries `stale-lock-broken` |
| Legacy report | A previous report has `catalogue-refresh: 0` | Parses. The key is absent after the parse and in the next report written |
| Refresh | Four endpoints succeed | Outcome `requests: 4`, and stdout prints the count |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/sync-run-report.ts` -- The record union `SyncRunRecordSchema` (~196). The field names match the IN §12 table exactly. Only `run-failure.entryKey` and `run-failure.status` are optional. Every subject field is a scalar, so `===` compares it. `RequestSourceSchema` (22-26), `RequestsBySourceSchema` (30-32) is an exhaustive enum record, `SyncRunFiguresSchema` (34).
- `packages/contracts/src/sync-progress.ts:29` -- `SyncProgressSchema` is strict with `{completed}`. The envelope is `envelopes.ts:78`, and the report envelope is `envelopes.ts:70`.
- `packages/contracts/src/schema-version.ts` -- There is one global `SUPPORTED_SCHEMA_VERSION` '1.0.0', and the check compares the major only. The precedent for a per-file version is `sync/src/catalogue/weights-ids.ts:35`.
- `packages/contracts/src/index.ts` -- The barrel: values end at ~152, types at 153-168. `index.test.ts` checks names one by one.
- `packages/sync/src/chunk/sync-report.ts:40-51` -- `carryRecords` uses `isDeepStrictEqual`. The header comment at 1-14 describes it. The figure is zero-filled at 24-25 and 65.
- `packages/sync/src/request-counter.ts` -- `zeroRequests` and `requestsBetween` loop over all three sources. Keep them.
- `packages/sync/src/trade/client.ts` -- `TradeYieldResult.retryAfterMs` (149) and its `reason` (136). A 429 yield is at 389-403. `invalidRequestThreshold?` is at 85. `trade/invalid-requests.ts` holds the threshold logic.
- `packages/sync/src/pricing/price-entry.ts` -- `Leg` (169-172) and `sendLeg` (180) collapse every yield into `{kind:'yield'}`. The step yields at 282 and 315. `MalformedRequestError` is at 54.
- `packages/sync/src/league/league-gate.ts` -- The shared constant `YIELD` (111) is returned at 129.
- `packages/sync/src/chunk/run-chunk.ts` -- `StepResult` (132), `GateResult` (156), `ChunkOutcome` (245). Inside `runChunk`: the lock at 346-359, the previous report at 365, tracked at 469, the gate at 474, progress at 486. `publish()` is at 418 and builds progress at 433. The malformed catch is at ~613.
- `packages/sync/src/chunk/lock.ts:40` -- `STALE_LOCK_AFTER_MS`.
- `packages/sync/src/{sync,dry-run,catalogue-refresh,fixtures-record}.ts` -- The trade-client builds are at 91, 175, 164 and 276. None of them passes a threshold.
- `packages/sync/src/catalogue-refresh.ts` -- `refreshCatalogue` (161), `CatalogueRefreshOutcome` (138), `main` (276). Copy the counter pattern from `sync.ts:90-94`. No test may name `createFetchHttpPort` (`catalogue-refresh.test.ts:257`).
- Tests: `run-chunk.test.ts` -- `harness` (124), `NOW` (47), the Sync Report describe (1022), the dedup test (1159), stale lock (624), the malformed cases (714, 1239), the gate 429 (1958). The gate 429 currently asserts that progress is byte-unchanged, and that changes. `sync-report.test.ts:130-139`. `'catalogue-refresh'` key fixtures: `contracts/src/{sync-run-report,envelopes}.test.ts`, `sync/src/{request-counter,sync,dry-run}.test.ts`, `chunk/{sync-report,run-chunk}.test.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/sync-run-report.ts` -- Add `RECORD_SUBJECTS`, a map from each kind to its subject keys, typed exhaustively over `SyncRunRecord['kind']`, and `isSameRecord(a,b)`. Add `ChunkRequestSourceSchema` (the two chunk sources). Key `RequestsBySourceSchema` on it, and use a `z.preprocess` that deletes only the legacy `catalogue-refresh` key. Add `SYNC_REPORT_SCHEMA_VERSION = '1.1.0'`.
- [x] `packages/contracts/src/sync-progress.ts` -- Add optional `notBefore` (the ISO instant primitive) and `SYNC_PROGRESS_SCHEMA_VERSION = '1.1.0'`. Export the new symbols from `index.ts`.
- [x] contracts tests -- `isSameRecord` per kind: an observation-only change, a subject change, an absent optional subject on both sides. The legacy key is dropped and any other unknown key is refused. `notBefore` is accepted when present and optional.
- [x] `packages/sync/src/chunk/sync-report.ts` -- `carryRecords`: when a record is `isSameRecord` with an earlier one, replace the first match at its index, else append. Remove `isDeepStrictEqual`. Project the figure onto the chunk sources. Stamp `SYNC_REPORT_SCHEMA_VERSION`.
- [x] `packages/sync/src/trade/invalid-requests.ts` -- Export `INVALID_REQUEST_THRESHOLD = 1`. Pass it in all four shells.
- [x] `price-entry.ts`, `league-gate.ts`, `run-chunk.ts` -- Yield results carry `retryAfterMs?`, set only when the client yield reason is `retry-after-header` or `derived-penalty`. `runChunk`: read progress right after the lock and defer when now < `notBefore`, using the new `deferred` outcome kind. Write or clear `notBefore` in `publish()`. On a gate 429, write progress with `completed` unchanged plus `notBefore`. Stamp `SYNC_PROGRESS_SCHEMA_VERSION`. The shells print the deferred outcome and exit 0.
- [x] `packages/sync/src/catalogue-refresh.ts` -- Count through `createRequestCounter` and return `requests` on both outcome arms. `main` prints `requests: N`.
- [x] sync tests -- Cover every matrix row, including a two-chunk growth test in `run-chunk.test.ts`. A test parses the committed `data/sync-report.json` through `SyncReportFileSchema` without the legacy key. Update the `'catalogue-refresh'` key fixtures and the version strings.
- [x] `docs/stories/sprint-status.yaml` -- Set items 4, 8 and 9 to `done`.

**Acceptance Criteria:**
- Given the full suite, when `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm depcruise` run, then all pass.
- Given the four shells, when a test inspects their trade-client options, then each passes `invalidRequestThreshold: 1`.

## Implementation Notes

## Spec Change Log

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 30 findings — high 0, medium 1, low 22, false 7, maybe-false 0
- findings:
  - `[low]` `[reject]` (edge) `notBefore` is capped only on write, so a far-future value from a hand edit or a rewound clock defers every run — §5.3 defines only the write-side cap and a strict `now < notBefore` check; the trigger needs a hand edit or a clock step, and the fix adds a read-side branch.
  - `[false]` `[reject]` (edge) A gate non-429 4xx writes no `notBefore` — the intent's Never list forbids exactly this ("a league-gate 4xx rejection").
  - `[low]` `[reject]` (edge) A deferred run that broke a stale lock and then loses the lock reports `deferred`, not `dispossessed`, and drops the record — this needs another process to take the lock within milliseconds of the break; the fix adds a branch.
  - `[low]` `[reject]` (edge) The deferred-after-stale-lock report writes zeroed figures with no `trackedListEditedAt` — the path needs a crash plus a live penalty, and the next real chunk replaces the figures; the right figures are unsettled, so this is not a direct correction.
  - `[false]` `[reject]` (edge) A 429 yield with `retryAfterMs` 0 gives no deferral — `declaredYieldFloorMs` returns at least `MINIMUM_YIELD_MS` (`trade/client.ts:281`), and 0 can come only from a server `Retry-After: 0`, which asks for no pause.
  - `[low]` `[patch]` (edge) The `SYNC_REPORT_SCHEMA_VERSION` comment does not say an older build refuses a 1.1.0 report — patched: the comment now states it and why that is acceptable.
  - `[low]` `[patch]` (edge) The `notBefore` describe() says "every other ending clears it" — patched to "every other ending that writes progress clears it".
  - `[low]` `[patch]` (intent) No test chains a 429 run into a second run over the same files — patched: round-trip tests for a step 429 and a malformed abort, each followed by a `deferred` second chunk.
  - `[low]` `[reject]` (intent) The shell-level step-429 test in `sync.test.ts` does not assert `notBefore` — covered in parts by `price-entry.test.ts` (client to step) and `run-chunk.test.ts` (step to `notBefore`); a shell duplicate adds no signal.
  - `[false]` `[reject]` (intent) "Fails type-checking" is tested only at runtime — the mapped type on `RECORD_SUBJECTS` enforces it, and `pnpm typecheck` runs it.
  - `[false]` `[reject]` (intent) The refresh count is tested through `printRefreshOutcome`, not `main` — `main` only forwards to `printRefreshOutcome` with process streams.
  - `[false]` `[reject]` (intent) "Committed on master" and "contracts first" are not visible in the diff — finalization commits contracts and then sync on `master`.
  - `[false]` `[reject]` (intent) The legacy-key tolerance sits in contracts — the spec's Design Notes choose this on purpose, so web inherits it.
  - `[low]` `[reject]` (intent) The dry run's deferral is not tested — see the Blind Hunter row on `DryRunSnapshot`; fixing it means editing this spec's frozen intent.
  - `[low]` `[reject]` (intent) If the malformed-abort publish throws, `notBefore` is lost — this is the existing secondary-failure path, where the dataset is lost too; the fix adds a separate write and a branch.
  - `[medium]` `[patch]` (verification-gap) The gate-429 `progressFault` rethrow that stops an unreadable progress file from being overwritten has no test — patched: a gate 429 over a 2.0.0 progress file rejects, leaves progress unchanged byte for byte, and reports a `run-failure`.
  - `[low]` `[patch]` (verification-gap) The unknown-major progress test does not assert the `run-failure` report — patched: it now asserts a `run-failure` record with `runFinishedAt` absent.
  - `[low]` `[reject]` (blind) Deferred report figures are zeroed — duplicate of the edge row above; same reason.
  - `[low]` `[reject]` (blind) No read-time cap on `notBefore` — duplicate of the edge row above; same reason.
  - `[low]` `[patch]` (blind) The deferred log line blames the trade API after a malformed abort — patched to a cause-neutral line ("a previous chunk set a pause … (a 429 or a rejected request)").
  - `[low]` `[patch]` (blind) The `notBefore` description is inaccurate — grouped with the edge row; same patch.
  - `[low]` `[reject]` (blind) The legacy-key drop ignores the file version — the inner schema cannot see the envelope version, the fix adds cross-field complexity, and no writer emits the key at 1.1.0.
  - `[low]` `[reject]` (blind) `buildSyncReport` silently drops a `catalogue-refresh` count — no chunk port is ever counted as `catalogue-refresh`; retyping the input would ripple through the three-source counter the spec keeps.
  - `[low]` `[patch]` (blind) Contracts `RequestsBySource` collides by name with sync's type of the same name — patched: the unused type was removed from the contracts barrel.
  - `[low]` `[reject]` (blind) `RECORD_SUBJECTS` does not restrict keys to scalar fields — no current kind lists a non-scalar subject, and the fix adds type-level complexity.
  - `[low]` `[patch]` (blind) The `isSameRecord` subject-change cases do not vary each subject key — patched: one generated case per key in `RECORD_SUBJECTS`, plus a separate kind-mismatch test.
  - `[low]` `[patch]` (blind) The new fault paths are untested — grouped with the verification-gap and intent rows; same patches (the unreadable-report deferral is the existing loud failure of NFR-8).
  - `[low]` `[patch]` (blind) The report version comment overstates compatibility — grouped with the edge row; same patch.
  - `[false]` `[reject]` (blind) `sprint-status.yaml` says `done` before the spec closes — the spec and the code are committed together at finalization, with `status: done`.
  - `[low]` `[reject]` (blind) The spec's claim that a dry run over a live `notBefore` defers is false, because `DryRunSnapshot` has no progress field — true, but the fix edits this build's spec (frozen intent), so it is rejected; noted under Residual risks for item 14.

## Design Notes

A matched record is replaced by the whole new record. `same` already fixes kind and subject, so the only fields that differ are the observation fields. The record keeps the earlier record's index, which keeps its position.

The legacy key is dropped in contracts rather than in sync, so that web, the future reader, inherits the drop. A major bump refuses the committed 1.0.0 report. A minor 1.1.0 with a tolerant reader accepts both shapes.

## Verification

**Commands:**
- `pnpm test` -- expected: all green, and no escaped-URL failures
- `pnpm typecheck && pnpm lint && pnpm depcruise` -- expected: clean
- `pnpm sync:dry` -- expected: exit 0, and the requestsBySource figure has two keys

## Auto Run Result

Status: done

**Summary.** The run implemented epic 1 retro items 4, 8 and 9.
- Item 4: record identity by subject fields. `isSameRecord` and `RECORD_SUBJECTS` are in contracts. `carryRecords` replaces a matched record at its index.
- Item 8: AD-8 penalty memory. `notBefore` in progress is written after a 429 or a malformed abort and checked right after the lock. A `deferred` outcome exists. `retryAfterMs` is carried through the leg, step and gate results. `INVALID_REQUEST_THRESHOLD = 1` is passed in all four shells.
- Item 9: the report figure is keyed on the two chunk sources. The legacy `catalogue-refresh` key is dropped by the contracts reader. `catalogue:refresh` counts its requests and prints them.
- Both report and progress are stamped 1.1.0.

**Files changed.**
- `packages/contracts/src/sync-run-report.ts`: adds `ChunkRequestSourceSchema`, the tolerant `RequestsBySourceSchema`, `RECORD_SUBJECTS`, `isSameRecord` and `SYNC_REPORT_SCHEMA_VERSION`.
- `packages/contracts/src/sync-progress.ts`: adds the optional `notBefore` and `SYNC_PROGRESS_SCHEMA_VERSION`.
- `packages/contracts/src/index.ts`: exports the new symbols.
- `packages/contracts/src/{sync-run-report,sync-progress,envelopes,index}.test.ts`: cover `isSameRecord` per subject key, the legacy drop, `notBefore` and the barrel.
- `packages/sync/src/chunk/sync-report.ts`: `carryRecords` replaces in place, and the figure is projected onto the chunk sources.
- `packages/sync/src/chunk/run-chunk.ts`: reads progress right after the lock, adds the `deferred` outcome, writes or clears `notBefore`, and writes progress on a gate 429.
- `packages/sync/src/trade/client.ts`: adds `penaltyRetryAfterMs`.
- `packages/sync/src/trade/invalid-requests.ts`: adds `INVALID_REQUEST_THRESHOLD`.
- `packages/sync/src/pricing/price-entry.ts` and `packages/sync/src/league/league-gate.ts`: yields carry `retryAfterMs` on a 429 only.
- `packages/sync/src/{sync,dry-run,catalogue-refresh,fixtures-record}.ts`: pass the threshold. `sync` prints the deferred outcome. The refresh counts its requests and prints them through `printRefreshOutcome`.
- The matching `*.test.ts` files cover every matrix row, the shell threshold options (pass-through `vi.mock`), round trips and fault paths.
- `docs/stories/sprint-status.yaml`: items 4, 8 and 9 are set to `done`.

**Review findings.** 30 findings: 12 patched (medium 1, low 11), 0 deferred, 18 rejected (7 false, 11 low). Each finding and its reason is in the Review Triage Log. There was no intent_gap and no bad_spec.

**Follow-up review recommended:** false. The pass patched 0 high entries and 1 medium entry.

**Verification.**
- `pnpm test`: 56 files and 644 tests passed, with no escaped-URL failures.
- `pnpm typecheck`, `pnpm lint` and `pnpm depcruise` are clean.
- `pnpm sync:dry` exits 0, `requestsBySource` has only `tracked-list` and `league-validation`, and `data/` is unchanged.
- The matrix audit found every row covered by a test that passed.

**Residual risks.**
- `DryRunSnapshot` has no progress field, so `sync:dry` never reads `notBefore` and never defers. Item 14 should take this into account. (The intent's Decisions note first said the opposite. The user corrected it after the run.)
- A deferred run that breaks a stale lock writes zeroed figures.
- `notBefore` is capped only when it is written.
- A build older than this one refuses a 1.1.0 report or progress file.
