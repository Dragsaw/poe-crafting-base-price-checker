---
title: 'pnpm sync is a long-running session paced request by request; the one-chunk command moves to pnpm sync:batch'
type: 'feature'
created: '2026-09-27'
status: 'done'
baseline_commit: '4818ae6e6f96662e6ecff1757ec1382314a149bf'
route: 'dispatch'
review_loop_iteration: 1
context:
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md'
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `pnpm sync` runs one allowance-bounded chunk and exits. So syncing needs an external scheduler, and requests go out in bursts that fill a bucket. The operator wants one long-running command that sends requests one at a time, follows GGG's rate-limit headers (developer docs, *Rate Limits*), and never needs a startup wait.

**Approach:** Move today's command unchanged to `pnpm sync:batch`. Make `pnpm sync` a session that prices **one entry per iteration**. Each iteration is `runChunk` bounded to one entry: it takes the lock, loads, prices, publishes and releases. One pacing state (ledger and lane memo) lives for the whole process. Before every request, the governor spreads the remaining capacity of each bucket evenly over that bucket's period, so no bucket fills in normal use.

**Decisions (human, 2026-09-27):**
1. Structure: one long-running session (review option C). The lock is taken per entry, not held for the whole session, so §7 and the 6 h stale rule do not change.
2. A throw does not stop the session. It logs the error and waits (matrix). An idle wait that sends nothing waits for local state to change. It is never a guessed cadence. No startup wait: the first request goes out cold, and its response seeds the ledger.
3. A pinned entry is selected only when it is **stale**: its `lastAttemptedAt` is absent or older than `--pinned-max-age <hours>` (default 4). The stale pinned entries go first, oldest first, and then the rotation. `sync:batch` keeps today's pinned-first rule.
4. Amend the planning documents in this change (Tasks).
5. (2026-09-27, review iteration 1) A **no-answer yield** is a `yielded` result that wrote no `notBefore` and brought no fresh State reading, for example because the network is down or DNS fails. After it, the session waits a **backoff**. The first backoff is the tightest known bucket's even interval, the largest `seconds × 1000 / hits` of the lane's policy, measured from the yield. On a cold lane it uses the measured §5.3 buckets (36 s for search at `600:21600`). Each consecutive no-answer yield doubles the backoff, up to the 6 h stale threshold. A State reading resets the backoff.
6. (2026-09-27, review iteration 1) A throw that is not a refusal, a league mismatch or a `MalformedRequestError`, and wrote no `notBefore`, waits until an input file changes or, if that is sooner, until the same backoff as decision 5 ends. Examples are `UnexpectedTradeResponseError` and a transient fs `EBUSY`. A refusal and a league mismatch keep their wait for an input change, which has no time bound.

## Boundaries & Constraints

**Always:** Spread pacing: before a request on a policy, wait the larger of (a) `paceBeforeNext` (a restriction, or a full bucket's remaining window) and (b) the largest `seconds × 1000 / (hits − used) − elapsed` over the policy's buckets. The next entry's lanes are pre-waited **outside** the lock, so the waits inside a chunk are only the fetch lane's small gaps. Every State reading, other IP traffic included, replaces the ledger values. Each chunk gets a fresh governor seeded with the shared pacing state. Invalid-request counts stay per chunk (a shared count would wedge a policy after one 429: client.ts `thresholdReached`). The league gate runs on the first iteration, on every new pass, and whenever the configured league changes. The report's `requestsBySource` covers the current pass. `notReachedCount` stays per chunk and is then "entries left in this pass". One output line per entry and one per wait (reason and end instant). The first SIGINT or SIGTERM cancels a wait at once, or lets the running entry finish, and exits 0. After a `MalformedRequestError`, `sync:batch` behaves as it does today.

**Never:** Do not change the lock file, §7, `paceBeforeNext`, the pricing step or `pnpm sync:dry`. Do not add a `data/config.json` field, and no web or contracts schema change. Do not run the live command in a worktree. Do not add a dependency.

## I/O & Edge-Case Matrix

| Scenario | State | Session behaviour |
|---|---|---|
| Cold start | empty ledger | Send the gate request now. Pacing starts from its headers |
| Next entry | a policy is known | Pre-wait the spread delay of `DATA_LANE` (if the gate is due), `SEARCH_LANE` and `FETCH_LANE`, then run |
| 5xx / timeout, with a State reading | `yielded`, no `notBefore` | Continue. Spread pacing spaces the retry |
| No answer (network, DNS, no headers) | `yielded`, no `notBefore`, no fresh reading | Wait the backoff (decision 5), then continue |
| Other throw | throw, no `notBefore`, not a refusal or mismatch | Wait until an input file changes, or at most the backoff (decision 6) |
| 429 | `yielded`, the chunk wrote `notBefore` | Wait until `notBefore`, then continue |
| Penalty | `deferred` | Wait until `notBefore` |
| Gate 4xx | `LeagueRequestRejectedError` | Now writes the 6 h abort `notBefore` (both commands). Wait until then |
| Malformed request | throw, 6 h `notBefore` | Wait until `notBefore`, or until an input file changes if that is sooner |
| Refusal / league mismatch | throw, no `notBefore` | Wait until an input file under `data/` changes (`modifiedAt`, polled locally) |
| Nothing due | `completed`, 0 attempted | Wait until an input file changes, or at most `UNRESOLVABLE_RETRY_MS` |
| Lock held | `busy` / `dispossessed` | Poll the lock file locally until it is free |
| No contact | blank `POE_SYNC_USER_AGENT` | Exit 1 before any request |

</frozen-after-approval>

## Code Map

- `packages/sync/src/trade/ledger.ts` -- add a pure `spreadBeforeNext(ledger, policy, now)`. `paceBeforeNext` stays unchanged.
- `packages/sync/src/trade/client.ts` -- `createTradeClients` holds `ledger` and `lanePolicies` in a closure (around line 520). Add `createTradeGovernor({ ..., pacing?: PacingState, spread?: boolean })`. It shares a mutable `PacingState { ledger; lanePolicies }` and exposes `delayBeforeMs(lane)`. `createTradeClients` delegates to it with defaults, so batch and catalogue behaviour do not change.
- `packages/sync/src/chunk/run-chunk.ts` -- `runChunk` (line ~425). Add an optional `ChunkPorts.session`: `maxEntries` (bound `'entries'`), `requestsSince` (the pass-start snapshot for the figures), and `confirmedLeague` (skip the gate unless `plan.newPass` or the league differs). Add `newPass` and `confirmedLeague` to the outcome. In the failure path (around line 787), give `LeagueRequestRejectedError` the abort `notBefore`.
- `packages/core/src/chunk-order.ts` -- `ChunkOrderInput` gains an optional `pinnedMaxAgeMs`. It filters row 1 to stale entries. Absent means today's behaviour.
- `packages/sync/src/compose-chunk.ts` -- pass the session options and the shared pacing state or counter through.
- `packages/sync/src/sync.ts` → `sync-batch.ts` (+ test, via git mv). Change the messages to `pnpm sync:batch:`. The tests mock `createTradeClients`, so update the mocks if composeChunk now calls the governor. Do the same in `dry-run.test.ts`.
- `packages/sync/src/shell.ts` -- `sleep`, `systemClock`. The abortable wait (`node:timers/promises`) goes here.
- `packages/sync/src/league/league-gate.ts:71` -- `LeagueRequestRejectedError`.
- `packages/sync/src/sync.ts` `nextWait` / `syncSessionCommand` -- decisions 5 and 6. The session tells a no-answer yield from a 5xx that carried headers by comparing the pacing state's `ledger` before and after the chunk: an unchanged `ledger` means no fresh reading. It keeps a consecutive-no-answer count and resets it on a reading. The 36 s cold floor is a named constant, owned by §5.3. Put `STALE_LOCK_AFTER_MS` (`chunk/lock.ts:40`) on the cap.
- `sync.ts` `preWaitMs` -- the gate is due when no league is confirmed, **or** the last outcome was `completed` (so the next chunk starts a new pass), **or** the input-file signature changed since the chunk that confirmed the league.
- `sync.ts` `isLockFree` -- do not copy the stale rule. Export `isStaleState` from `chunk/lock.ts:96` and call it.
- `sync.ts` `parseArgs` -- skip a literal `--`.
- `prd.md` FR-19, first consequence -- a batch run exits quietly while another run holds the lock, and the session waits for the lock (AD-7). No mechanism.
- `docs/stories/deferred-work.md` -- append one entry that names this spec as `source_spec`. It says that open entries written before 2026-09-27 which name `pnpm sync` or `packages/sync/src/sync.ts` for the one-chunk command now mean `pnpm sync:batch` and `sync-batch.ts`. Do not edit the existing entries.

## Tasks & Acceptance

**Execution:**
- [x] `ledger.ts`, `client.ts` (+ tests) -- the spread pacer and the governor. Tests use the measured buckets (`5:10`, `30:300`, `600:21600`): cold state gives 0 ms, a used bucket gives an even spread, a full or restricted bucket falls back to `paceBeforeNext`, and a later State reading overrides the ledger.
- [x] `chunk-order.ts` (+ test) -- `pinnedMaxAgeMs`.
- [x] `run-chunk.ts`, `compose-chunk.ts` (+ tests) -- the session options, the new outcome fields, and the gate 4xx `notBefore`.
- [x] `sync-batch.ts` -- the rename.
- [x] `sync.ts` (+ test) -- `syncSessionCommand(deps)`, `parseArgs` (`--pinned-max-age`), and a pure `nextWait(outcome | error, state)` that follows the matrix. `main` wires signals. Test every matrix row with fakes. Test that a wait cancels on abort. Test that an abort during a chunk releases the lock.
- [x] `package.json` (`sync` and `sync:batch`, both with `--env-file-if-exists=.env`), `index.ts` exports and comments, `tools/dts-specifiers/rewrite-dts-specifiers.ts:92`, `.claude/skills/deferred-work-sweep/SKILL.md:86`.
- [x] Planning docs. Spine: AD-7 (the chunk stays the unit, with two invokers and the session's stale-pinned rule), AD-8 (spread pacing), the Stack *Sync invoker* row and Deployment. `IMPLEMENTATION-NOTES.md` §5.3 (the spread formula, which §5.3 owns). `AGENT-WORKFLOW.md:28,67,85`. `epics.md:108`. `prd.md:346,352`: a sentence that names the session and cites AD-7, and no mechanism. FR-level pinned behaviour: the PRD says a pinned entry "is refreshed first whenever a Chunk can afford it". Retarget that sentence to cite AD-7. Also FR-19's first consequence, and the backoff (decisions 5 and 6) in AD-7 and §5.3.
- [x] `sync.ts` (+ test) -- the backoff (decisions 5 and 6), the gate-due pre-wait, `isLockFree` through the exported `isStaleState`, and `--`. Tests for the new matrix rows: a no-answer yield on a cold lane waits 36 s, then 72 s on the next one, and resets after a reading. An other-throw ends at the backoff or at an input change. A new pass pre-waits `DATA_LANE`. A held lock that ages past 6 h ends the wait.
- [x] `sync.test.ts`, `sync-batch.test.ts`, `dry-run.test.ts` -- regression tests. A session entry whose search has results, so that fetches with State headers follow, asserts the spread wait inside the lock. A fresh pinned entry plus an active entry, where the first session search prices the active one. After two session iterations, `figures.requestsBySource` is `{ 'league-validation': 1, 'tracked-list': 2 }`. The batch and dry-run compositions pass no `spread` and no `pacing`.
- [x] `docs/stories/deferred-work.md` -- the one appended note (Code Map).

**Acceptance Criteria:**
- Given `pnpm sync:batch`, when it runs, then it behaves like the old `pnpm sync`, apart from the message prefix and the gate-4xx `notBefore`.
- Given a session whose search policy was last observed at `used 20 of 30:300` and `used 100 of 600:21600`, when the next search is due, then the pre-wait is `max(300000/10, 21600000/500) = 43200 ms` minus the time elapsed.
- Given `pnpm check` and `pnpm test`, when they run, then both pass and neither makes a network call.

## Design Notes

The even spread is safe under both rolling and fixed windows, because it never spends more than the capacity the last State reading left in any bucket's period. It self-corrects: each response replaces the reading. The steady state is the sustained rate of the tightest bucket (about 36 s per search at `600:21600`).

## Implementation Notes

## Spec Change Log

- **Iteration 1 → 2 (2026-09-27), intent_gap.** Triggers: triage rows 1 and 2. A no-answer yield spun the session with no pause. An unclassified throw waited with no end. Amended: frozen decisions 5 and 6, the matrix rows *5xx / timeout, with a State reading*, *No answer* and *Other throw* (the human answered both), and the Code Map and Tasks for patch rows 3–11. Known-bad states avoided: a tight loop that takes the lock, stamps `lastAttemptedAt` and publishes on every pass during a network outage, and a session that silently stops after a transient fault. **KEEP:** everything in the iteration-1 patch that triage did not route. That covers `spreadBeforeNext` and its tests, `PacingState`/`createTradeGovernor`/`laneDelayMs`, `chunkOrder`'s `pinnedMaxAgeMs`, `ChunkSession` and the `run-chunk.ts` session fields and gate-4xx `notBefore`, the `composeChunk` pass-through, `abortableSleep`, the `sync:batch` rename and its message prefix, `nextWait`/`nextState`/`runWait`/`inputSignature` and the existing session tests, `main`'s `process.once` signals, and every planning-doc edit, including the spine's list-indent fix at AD-8.
- **Iteration 2 planning (2026-09-27), human.** The spec is self-contained. The iteration-1 patch is not an input, and no step reads a temp file. Build every KEEP item above from the Code Map and Tasks.

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0
- `pnpm test` -- expected: all pass, no escaped URL

## Review Triage Log

Iteration 1 (baseline `4818ae6e6f96662e6ecff1757ec1382314a149bf`). Layers: blind-hunter (BH), edge-case-hunter (EC), verification-gap (VG), deferred-ledger-audit (DL, zero findings).

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | BH3, EC1 | A yield with no `notBefore` returns no wait. A network failure brings no headers, so a cold lane asks 0 ms and a stale reading decays to 0 ms. The session spins: lock, one failed request, publish (stamping `lastAttemptedAt`) and a line, with no pause | high | `league-gate.ts:22` and `price-entry.ts:16` map a network failure to a yield. `spreadBeforeNext` subtracts the elapsed time from the last reading, and `nextWait` `yielded` gives `NO_WAIT`. The frozen row "Spread pacing spaces the retry" is false when no State reading comes back | intent_gap |
| 2 | BH2, EC2 | A throw with no `notBefore` that is not a refusal or a league mismatch (`UnexpectedTradeResponseError`, a transient fs `EBUSY`) waits with no end, for an input change | medium | `nextWait` error branch: every throw without `notBefore` waits `untilInputsChange` with no `until`. The matrix names only refusal and league mismatch, and decision 2 forbids a guessed cadence, so there is more than one reading | intent_gap |
| 3 | BH7, EC5, VG-other | The pre-wait counts the gate as due only while no league is confirmed. On a new pass or a league change, the gate's spread wait runs inside the lock | medium | `sync.ts` `preWaitMs(..., state.confirmedLeague === undefined)` against `run-chunk.ts` `alreadyConfirmed`, which also checks `newPass` and the configured league. The matrix says "DATA_LANE (if the gate is due)" | patch |
| 4 | VG1 | No test fails if `spread: true` is dropped from the session's `composeChunk` call | medium | Session tests use `NO_RESULTS` (no fetch), and the in-lock wait after the pre-wait is 0 either way | patch |
| 5 | VG2 | `--pinned-max-age` never reaches a `syncSessionCommand` test | medium | No session test has a pinned entry | patch |
| 6 | VG3 | The pass-level `requestsBySource` is not checked across session iterations | low | No session test reads `sync-report.json`. The fix is a direct assertion | patch |
| 7 | VG4, VG-other | `isLockFree`'s stale branches are untested, and it copies the private `isStaleState` of `lock.ts` | medium | The only test deletes the lock (`absent`). A copy can drift from §7 | patch |
| 8 | VG-other | The batch and dry-run "unchanged" checks use `objectContaining` and would not see `spread` or `pacing` passed | low | `sync-batch.test.ts:391`, `dry-run.test.ts:172`. The fix is a direct assertion | patch |
| 9 | BH5 | PRD FR-19 still says a second invocation "exits quietly". A session's chunk is busy and the session waits | low | `prd.md` FR-19 consequence 1, the one this build amends. A direct sentence correction | patch |
| 10 | BH14, EC8 | `parseArgs` rejects a literal `--` separator | low | `pnpm sync -- --pinned-max-age 2` exits 1 with `unknown argument "--"`. The fix skips `--` | patch |
| 11 | BH11 | Open ledger entries say "`pnpm sync`" for the one-chunk command, and one names `sync.ts` as its location | low | `deferred-work.md` spec-1-11 entries. The fix appends one note entry | patch |
| 12 | BH1, EC3 | The "nothing due" wait can overshoot the next due instant | low | Only reachable when no `active` entry is due, which is rare. The fix needs a next-due instant from `core` | reject |
| 13 | BH4, EC7 | A second signal during a chunk leaves the lock for 6 h. An in-lock wait is not cut by the first signal | low | The time-only stale rule is §7, which the intent forbids changing. "Lets the running entry finish" is the frozen behaviour. The batch command had the same kill-in-chunk exposure | reject |
| 14 | BH6 | An existing scheduler job that runs `pnpm sync` now starts a process that never exits | low | No README or operator doc in the repo schedules `pnpm sync`. It is raised to the human at presentation, not changed in code | reject |
| 15 | BH8 | `requestsBySource` now covers a pass, but the Logging convention says a figure describes the latest chunk | false | The web label already reads "requests this pass" (`trust-facts.ts:170`). The figure is still overwritten by each chunk | reject |
| 16 | BH9 | The pinned cap and starvation rule is undefined under `maxEntries: 1` | false | The truncation is allowance-based and unchanged. Stale pinned entries going first for K iterations is decision 3 | reject |
| 17 | BH10 | The 4 h default is a product-owned number and must be in the PRD | false | It is an operational threshold of the same kind as §7's 6 h stale lock, which the architecture owns. The Tasks direct the citation of AD-7 | reject |
| 18 | BH12, EC6 | The gate-4xx and deferred waits do not end on an input change | false | The matrix rows say "Wait until then" and "Wait until `notBefore`" | reject |
| 19 | BH13 | The verification leaves out a live run of the session | low | The fix edits this build's spec, and the intent forbids a live run in a worktree. It is raised to the human at presentation | reject |
| 20 | BH15 | The spec rationale names a 429 where the threshold counts a 4xx | low | The fix edits this build's spec | reject |
| 21 | EC4 | A throw on a new pass keeps the old pass start in `requestsBySource` | low | Rare (a gate throw exactly at a pass boundary). The fix adds a field to the error result | reject |
| 22 | EC9 | `maxEntries` 0 or NaN is not validated | false | The only caller passes `1` | reject |
| 23 | EC10 | No gate means `confirmedLeague` is never set | false | The session always composes with the live gate | reject |
| 24 | EC11 | The invalid-request count does not accumulate across entries | false | The frozen text says "Invalid-request counts stay per chunk" | reject |

Iteration 2 (baseline `4818ae6e6f96662e6ecff1757ec1382314a149bf`). Layers: blind-hunter (BH), edge-case-hunter (EC), verification-gap (VG), deferred-ledger-audit (DL).

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 25 | VG1 | The `Error` → `DataFileError` switch in `loadEnvelope` is asserted only by message, so a revert passes every test while the session's refusal classification breaks | medium | Pre-verified: `run-chunk.test.ts:815,884` match message regexes only | patch |
| 26 | VG2 | `nextState`'s pass-start reset on `newPass` is not observed by any test | medium | Pre-verified: no session test runs a second chunk inside a new pass and reads the report | patch |
| 27 | VG3 | The session's `--pinned-max-age` test passes the default `4`, so ignoring the parsed value passes | medium | Pre-verified: `sync.test.ts:543` uses `'4'` = `DEFAULT_PINNED_MAX_AGE_HOURS` | patch |
| 28 | VG-other, BH1 | A refused sync-owned file (`dataset.json`, `sync-progress.json`, `sync-report.json`) is a `DataFileError`, so `isRefusal` waits for an input change with no bound, and `INPUT_PATHS` does not list those files, so fixing the file never ends the wait | medium | `run-chunk.ts` `loadEnvelope` now throws `DataFileError` for every envelope; `sync.ts:189` treats any `DataFileError` as a refusal; `INPUT_PATHS` holds only the hand-owned inputs | patch |
| 29 | EC1, EC2, EC10 | `inputSignature` (loop head and polls) and `isLockFree` run outside the chunk's `try`; a transient fs error (`EBUSY`, `EPERM`) escapes `syncSessionCommand` and ends the session with exit 1, against decision 2 | medium | `shell.ts` `exists`/`lastModifiedAt` rethrow every code but `ENOENT`; `sync.ts` loop head and `runWait` call them unguarded | patch |
| 30 | BH10 | Every throw drops the confirmed league, so a transient fault spends an extra `league-validation` request on the next chunk, outside the Boundaries' three gate triggers | low | `nextState` error branch calls `withoutLeague` for every error; a refusal already makes the gate due through the signature | patch |
| 31 | EC7 | A `MalformedRequestError` with no `notBefore` (the failure-path publish failed) waits a backoff at count+1 while `nextState` resets the count to 0, so repeats never double | low | `isBackoff` excludes `MalformedRequestError`; `nextWait` gives it the other-throw backoff. The fix deletes the exclusion | patch |
| 32 | BH13 | The `run-chunk.ts` header says a session chunk has "three differences" and lists four | low | Header comment above `runChunk`; direct correction | patch |
| 33 | BH6, BH13 | `IMPLEMENTATION-NOTES.md` §5.3 says "Two chunk endings write a `notBefore` … and nothing else does", and spine AD-8 names only the 429 and the malformed request; the gate 4xx now writes the abort `notBefore`. Spine AD-7 says the lock "is never held across a wait", but the in-chunk spread waits hold it | low | §5.3 *Penalty memory across processes*; spine lines ~633-635 and AD-7. The Review brief forbids a triager to edit an owner document, so it is a note for the architect | defer |
| 34 | BH3, EC3 | Nothing-due waits up to 24 h and can overshoot the 4 h pinned cadence | low | carried: row 12, same location and claim; only reachable with no due `active` entry | reject |
| 35 | BH4, DL4 | A scheduler job that runs `pnpm sync` now starts a process that never exits; a second session is not detected | low | carried: row 14. Raised to the human at presentation | reject |
| 36 | DL1 | No live run of the session was done | low | carried: row 19. Raised to the human at presentation | reject |
| 37 | DL2 | Row 12 has no ledger entry | low | carried: row 12 is a reject, not a carve-out; a rejected finding owes no work | reject |
| 38 | DL3, EC6 | A throw on a new pass keeps the old pass start | low | carried: row 21 | reject |
| 39 | BH5 | The Logging convention says a figure describes the latest chunk | false | carried: row 15 | reject |
| 40 | BH2 | A league mismatch waits for an input change with no bound, though GGG may list the league later | false | Frozen decision 6: "A refusal and a league mismatch keep their wait for an input change, which has no time bound" | reject |
| 41 | BH7 | Rationale and rejected alternatives are not in the PRD `addendum.md` | low | The spec and git hold the rationale; the rejected review options are not in the repository, so the fix needs content no one has here | reject |
| 42 | BH8 | `freshReading` is chunk-wide, so a search reading masks a fetch that got no answer | low | The next iteration's search is still spread-paced (about 36 s or more), so the session does not spin; the matrix row "with a State reading: continue" applies | reject |
| 43 | BH9 | `busy`, `dispossessed` and `deferred` reset the backoff count | low | Needs a second invoker during an outage; "consecutive" in decision 5 supports either reading | reject |
| 44 | BH11 | Missing session tests for other-throw, a dispossessed outcome and a 1 ms `abortableSleep` | low | Other-throw and lock waits are covered at `runWait` and `nextWait`; row 28's patch adds a sync-owned refusal test | reject |
| 45 | BH12, EC8 | A huge `--pinned-max-age` overflows to `Infinity`; `--pinned-max-age=4` is refused | low | An operator does not type `1e305`; the `=` form fails loudly with exit 1 | reject |
| 46 | BH13 | The `sync-batch.ts` header's "`pnpm sync` and `pnpm sync:dry` share" is stale | false | The sentence is in `sync:batch`'s own file and names the two other users of `composeChunk`, which is correct | reject |
| 47 | BH14 | The ledger note has no end condition | low | The Code Map directs this exact note; the fix edits this build's spec | reject |
| 48 | EC4, EC11 | An input change makes the session pre-wait `DATA_LANE`, but `runChunk` skips the gate when league and pass are unchanged | low | The skipped gate is the Boundaries' rule; the only cost is a short pre-wait | reject |
| 49 | EC5 | Another invoker completing the pass makes `newPass` true while `withGate` is false | low | Needs two invokers; the gate still runs, paced by the in-chunk spread | reject |
| 50 | EC9 | An unparseable `lastAttemptedAt` gives `NaN` and is never stale | false | `DatasetEntry.lastAttemptedAt` is `IsoTimestampSchema`, validated at load | reject |
| 51 | EC12 | The backoff takes the maximum over the entry's lanes, not the failing lane's policy | low | The session cannot tell which lane got no answer; a longer backoff is the safe side, and §5.3 states the rule | reject |
