---
title: 'Story 1.5: One bounded, resumable, single-instance chunk'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_revision: '2618142b3a59703b6415641ca978eb1179a2ed29'
followup_review_recommended: false
deferred: []
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-1-context.md'
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing in `sync` runs a chunk. There is no lock, no progress file, no order function and no bound, and `pnpm sync:dry` is a stub that exits non-zero. Stories 1.6–1.11 all plug into a runner that does not exist yet.

**Approach:** Build a `runChunk(ports, step)` in `sync`. It takes an atomic, recoverable on-disk lock, gets its order from a minimal `core` function, and calls an injected per-entry `step` until one of three bounds runs out: search allowance, fetch allowance, or workload. It re-reads the lock before it commits `sync-progress.json`, and it releases the lock only while the lock is still its own. `pnpm sync:dry` drives the same runner in memory and prints the outcome to stdout.

**Decisions (2026-09-26):**
- **`contracts` first.** The progress and lock schemas and `FilesystemPort.createExclusive` (with an atomic fake) land as a separate first commit in this story. `sync` builds on that commit, and the change is reported.
- **No live `pnpm sync` script yet.** `runChunk` is exported and exercised by tests and `sync:dry`. Stories 1.7/1.8 wire the live command.
- **`sync:dry` reads `data/tracked.json` read-only.** The player's file is present. The dry run takes a snapshot of it into an in-memory fake filesystem. It runs the chunk with a fixed clock and a step that issues no request, then prints `{outcome, completed, progress, records}` as JSON to stdout. An absent file gives an empty-workload outcome, so the test passes on a clean checkout either way.

## Boundaries & Constraints

**Always:**
- One invocation runs one chunk and then returns. The chunk stops at whichever comes first:
  - the step reports search allowance `< 1`;
  - the step reports fetch allowance `< 1`;
  - the step yields (the entry is not completed);
  - the order is empty.
- Lock contents are exactly `{pid, startedAt}`, where `startedAt` is ISO-8601 UTC taken from `ClockPort`. The lock is taken by one atomic exclusive create.
- Staleness is decided by `now − startedAt > staleLockAfter`, and `staleLockAfter` is a 6 h `sync` constant (IMPLEMENTATION-NOTES §7). Staleness is never judged by pid alone.
- A busy live lock is a normal outcome, never an error. The runner logs one line to stderr and the command exits 0.
- A stale lock is broken and then retaken atomically. Breaking it produces a `stale-lock-broken` record (the existing `StaleLockBrokenRecordSchema`). Breaking a lock does not change the exit code.
- The runner re-reads the lock immediately before it writes progress. If the contents are no longer its own, it aborts, writes nothing, and releases nothing.
- Release runs on every exit path while the lock is still the runner's own. This includes a throw from the step or from the injected run-start `gate` hook, and it uses `try/finally`.
- `sync-progress.json` records the canonical keys of *completed* entries, never the planned ones. It carries `schemaVersion` and is serialised with `serialiseJsonArtifact`.
- The order is recomputed on every run by a pure `core` function over the tracked entries and the completed keys. Pruned entries are excluded, the rest are sorted by `compareTrackedEntries`, and completed entries are removed. When every non-pruned entry is complete, a new pass starts with an empty completed set. Story 1.6 replaces the body of this function.
- The clock and the filesystem enter only as ports. No code below the shell calls `Date.now()`.

**Never:**
- The runner never reads `minChunkSearches` and never reads `config.json`.
- No pricing, search/fetch URLs, dataset write, `sync-report.json` write or league gate. Those are Stories 1.7, 1.8, 1.9 and 1.11; this story carries the report's records in the returned outcome only.
- No git write. No agent-authored file under `data/`.
- No hardcoded rate and no named rule. The allowance is read from live headers.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Workload bound | 3 entries, step always has allowance | 3 completed, progress written, lock released | — |
| Search bound | Step reports search remaining `0` after entry 2 | 2 completed; entry 3 not visited | — |
| Fetch bound | Step reports fetch remaining `0` after entry 1 | 1 completed | — |
| Yield | Step yields on entry 2 | Entry 1 completed, entry 2 not; lock released | Outcome `yielded`, never a throw |
| Resume | Progress holds entry 1 | Order starts at entry 2, recomputed from the tracked list | — |
| Pass complete | Progress holds every non-pruned key | New pass: completed set restarts empty | — |
| Busy lock | Live lock, age < 6 h | Nothing written, lock untouched, exit 0 | stderr line |
| Stale lock | Lock age > 6 h | Lock broken and retaken, chunk runs, `stale-lock-broken` record with old pid/startedAt | — |
| Race | Two runners break the same stale lock | Exactly one takes it; the other reports busy | — |
| Dispossessed | Lock replaced mid-chunk | No progress write, no release; successor's lock intact | Outcome `dispossessed` |
| Step or gate throws | Throw inside the chunk | Lock released, error rethrown | Non-zero exit |
| `minChunkSearches` | Any value | Chunk identical | — |
| `sync:dry` | Fixtures + read-only `data/` | Deterministic JSON on stdout, zero disk writes, exit 0 | — |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/ports/filesystem.ts:6` `FilesystemPort` (read/write/delete/exists/lastModifiedAt) and `ports/fakes/` `createFakeFilesystemPort`. There is no exclusive create yet; this story adds it.
- `data/tracked.json`: player-authored and uncommitted. It holds 5 entries, 1 of them pruned. `sync:dry` reads it and never writes it.
- `packages/contracts/src/envelopes.ts`: `ConfigFileSchema` (:44), `TrackedFileSchema` (:28), `parseEnvelope` (:133). A new `SyncProgressFileSchema` belongs here.
- `packages/contracts/src/sync-run-report.ts:66` `StaleLockBrokenRecordSchema {kind, pid, startedAt}`. Reuse it as-is.
- `packages/contracts/src/canonical-key.ts`: `canonicalKey` (:66), `compareTrackedEntries` (:107).
- `packages/core/src/index.ts`: only `CORE_PLACEHOLDER` today. The new order function goes here.
- `packages/sync/src/trade/client.ts`: the result base (:107) and the `response`/`yield` kinds (:123-151). Add `remaining?: number` (min `hits − state.hits` over the observed rule's buckets) using `trade/rate-limit-headers.ts:132` `parseRateLimitHeaders`. 1.7's step reports it.
- `packages/sync/src/shell.ts`: `serialiseJsonArtifact` (:35), `systemClock` (:63), `writeTextFile` (:77). Add the real `FilesystemPort` adapter here, with `createExclusive` via `fs.open(path, 'wx')`.
- `packages/sync/src/dry-run.ts` and `dry-run.test.ts:27`: the stub and the test that pins it. Both get replaced.
- `.gitignore`: `*.lock` is already ignored. The lock path is `data/sync.lock`.
- `test/contracts-isolation.test.ts` `ALLOWED_EDGES`: `sync → core` is already allowed, so nothing changes there.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/{sync-progress.ts,envelopes.ts,ports/filesystem.ts,ports/fakes/filesystem.ts,index.ts}`: add the progress and lock schemas and `createExclusive`. Make the fake atomic.
- [x] `packages/core/src/chunk-order.ts` + test: add the pure order function.
- [x] `packages/sync/src/trade/client.ts` + test: add `remaining` to each result.
- [x] `packages/sync/src/chunk/lock.ts`: take, break-if-stale, verify-own, release-if-own.
- [x] `packages/sync/src/chunk/run-chunk.ts`: add `runChunk({fs, clock, pid, gate?}, step)` returning a typed outcome (`completed|bounded|yielded|busy|dispossessed`, `completed` keys, `records`).
- [x] `packages/sync/src/chunk/*.test.ts`: cover every matrix row, including a `Promise.all` race on the fake, and a source scan proving no `minChunkSearches` or `config.json` reference in `chunk/`.
- [x] `packages/sync/src/shell.ts`: add the real `FilesystemPort` adapter.
- [x] `packages/sync/src/dry-run.ts` + `dry-run.test.ts`: implement the read-only in-memory dry run from the Decisions. Keep a pure `dryRun(trackedText)` that is unit-tested with a fake filesystem. The spawned test asserts exit 0, identical stdout across two runs, parseable JSON, and no write.

**Acceptance Criteria:**
- Given `pnpm check`, when it runs, then typecheck, lint and depcruise pass.
- Given `pnpm test`, when it runs, then all suites pass, no request escapes, and nothing is written under `data/`.
- Given Stories 1.8, 1.9 and 1.11, when they extend this runner, then they add to the outcome and the `gate` hook without rewriting the lock or release path.

## Implementation Notes

## Spec Change Log

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 45 findings — high 0, medium 0, low 30, false 12, maybe-false 3
- findings:
  - `[low]` `[patch]` (verification-gap) A bound on the last entry resolving to `completed` has no test — added a `harness([A, B])` test with `searchRemaining: 0` on B asserting `completed` and full progress.
  - `[low]` `[patch]` (verification-gap, other) A run losing the break-marker race reports the dead stale holder as the live holder — the loser now returns the break-marker holder; the lock test asserts pid 8.
  - `[low]` `[patch]` (blind) `breakAndTake` deletes the lock unconditionally after the re-read, so a fresh lock taken by a plain create in the gap can be deleted — delete now goes through `deleteIfText(LOCK_PATH, stale.text)`, returning busy on a mismatch.
  - `[low]` `[reject]` (blind) `releaseLockIfOwn` is check-then-delete — real but needs a compare-and-delete port operation (new public surface); the window requires a >6 h chunk plus a break within one await.
  - `[low]` `[reject]` (blind) Stale-marker clean-up via `deleteIfText` is read-then-delete — same class; closing it needs a new port primitive, and it requires a crashed breaker plus two concurrent clearers.
  - `[low]` `[reject]` (blind) A dispossessed run keeps visiting entries until the loop ends — only reachable after a chunk runs past 6 h; the spec places the check before the progress write, and a per-entry check adds a branch.
  - `[low]` `[reject]` (blind) Progress is lost when the step throws — costs one chunk of repeated searches; 429s and invalid-request refusals yield rather than throw, so throws are exceptional; persisting on the throw path adds a branch.
  - `[low]` `[reject]` (blind) Real `createExclusive` leaves an empty lock if the post-create write fails — ENOSPC/EIO on a tiny write is rare, and the mtime rule clears it after 6 h; the cleanup is an added guard.
  - `[low]` `[patch]` (blind) Node `lastModifiedAt` swallows every error, so EACCES makes an unreadable lock never stale — now returns undefined only on ENOENT and rethrows otherwise.
  - `[maybe-false]` `[reject]` (blind) `remainingAllowance` ignores the active-restriction field, and `?? 0` fails open — the parser refuses length mismatches (rate-limit-headers.ts:190), so `?? 0` is dead; whether a non-429 response ever carries an active restriction with hits under the limit would settle the rest; if true it is only low (a restricted request yields on 429).
  - `[false]` `[reject]` (blind) Nothing maps the client's `remaining` into `StepResult` — the Code Map assigns that to Story 1.7's step ("1.7's step reports it").
  - `[low]` `[patch]` (blind) Busy log names the wrong run during a break — same root cause and fix as the verification-gap other finding.
  - `[false]` `[reject]` (blind) A corrupt `sync-progress.json` wedges every run — it fails loudly and names the file, which is correct behaviour for an envelope refusal.
  - `[low]` `[reject]` (blind) `ChunkOutcome` does not expose `newPass` — no consumer yet; the AC has Story 1.9 add to the outcome.
  - `[false]` `[reject]` (blind) The dry run ignores real progress and lock state — the intent's Decisions require a snapshot of `data/tracked.json` only.
  - `[low]` `[patch]` (blind) The spawned `sync:dry` test never asserts empty stderr — added `expect(first.stderr).toBe('')`; the dependence on the real tracked file is by Decision.
  - `[low]` `[patch]` (blind) Missing runner and adapter tests — added allowance-exactly-1 and a Node `createExclusive` loses-against-existing-file test; the progress-refusal-after-gate case is covered by the unknown-major test, and new-pass-with-added-entry by the chunk-order recompute test.
  - `[low]` `[patch]` (blind) `shell.ts` header line not rewrapped; orphan module JSDoc in `sync-progress.ts` — rewrapped the header; moved the block above the imports.
  - `[false]` `[reject]` (intent) Busy/stale/throw exit behaviour is verified only in-process — the Decision "no live `pnpm sync` script yet" leaves `runChunk`'s returned outcome as the surface.
  - `[low]` `[reject]` (intent) The full acquire/break path never runs against the real adapter — the adapter's atomic `createExclusive` is tested directly, and the lock logic is port-generic.
  - `[false]` `[reject]` (intent) "Retaken atomically" is delete then create — the retake itself is one atomic exclusive create, and a race test shows exactly one winner.
  - `[low]` `[reject]` (intent) Breaking an unreadable lock by mtime produces no `stale-lock-broken` record — the record schema needs a pid and startedAt the file lacks; this only happens after a crash between create and write.
  - `[false]` `[reject]` (intent) No link from client `remaining` to the step allowances — same as the blind finding; deferred to Story 1.7 by the Code Map.
  - `[low]` `[patch]` (intent) The last-entry bound is untested — same root cause and fix as the first verification-gap finding.
  - `[false]` `[reject]` (intent) `sync:dry` depends on the player's real `data/tracked.json` — mandated by the Decisions.
  - `[false]` `[reject]` (intent) The dispossessed outcome lists unpersisted keys — the `dispossessed` kind states that nothing was written; the keys describe what the chunk did.
  - `[low]` `[reject]` (intent) Steps keep running after dispossession — same as the blind finding.
  - `[low]` `[reject]` (intent) A throw mid-chunk drops progress — same as the blind finding.
  - `[low]` `[reject]` (intent) The default `log` writes `process.stderr` below the shell — the constraint names the clock and the filesystem; the spec requires the stderr line, and `log` is injectable.
  - `[false]` `[reject]` (intent) `allowImportingTsExtensions` and `.ts` specifiers in core — required for `sync:dry` under bare `node` type stripping, and `pnpm check` passes.
  - `[low]` `[reject]` (edge) A future `startedAt` after clock skew is never stale — rare; treating future instants as stale would break live locks under skew, so the fix is a policy change.
  - `[low]` `[reject]` (edge) Successor breaks the lock between `holdsLock` and `deleteFile` in release — same as the blind finding.
  - `[low]` `[reject]` (edge) Takeover between `holdsLock` and the progress write — same check-then-act class; needs a >6 h chunk and a break within one await, and closing it needs a new port primitive.
  - `[low]` `[reject]` (edge) Marker replaced between the `deleteIfText` read and delete — same as the blind marker finding.
  - `[maybe-false]` `[reject]` (edge) Windows delete-pending EPERM on a create right after a delete — libuv uses POSIX delete semantics on current Windows, and no handle stays open; settle by reproducing a concurrent open during a delete on Windows 10+; if true it is only low (the run throws once, and the next invocation proceeds).
  - `[maybe-false]` `[reject]` (edge) `open(wx)` throws EPERM rather than resolving false on Windows — same as the previous finding.
  - `[low]` `[patch]` (edge) `lastModifiedAt` hides non-ENOENT errors — same root cause and fix as the blind finding.
  - `[false]` `[reject]` (edge) A clock value that `SyncLockSchema` rejects makes the run's own lock unreadable — the `ClockPort` contract and `systemClock` (`toISOString`) guarantee ISO-8601 UTC.
  - `[low]` `[reject]` (edge) Unreadable lock deleted between the read and `lastModifiedAt` reports busy — the next invocation proceeds; a retry adds a branch for a microsecond window.
  - `[low]` `[reject]` (edge) A release throw in `finally` masks the step error — needs a filesystem failure on delete right after a step failure; the fix adds a nested try.
  - `[false]` `[reject]` (edge) Skipped rules make `remaining` overstate the allowance — the proposed `undefined` would bound nothing, which is less safe than the readable-rule minimum.
  - `[low]` `[patch]` (edge) `sync:dry`'s entry guard fails under a junction, subst or symlink path, so it prints nothing and exits 0 — the guard now compares `realpathSync` of both paths, and a throw counts as not invoked directly.
  - `[false]` `[reject]` (edge) A `data/` file disappears between `readdirSync` and `statSync` in the test snapshot — nothing writes `data/` during the test run.
  - `[low]` `[reject]` (edge, claim) "Broken and then retaken atomically" oversells the marker's guarantees — the retake is one atomic create, and the remaining marker races are the rejected check-then-delete class.
  - `[low]` `[reject]` (edge, claim) "If the lock is not its own, it writes nothing" has a check-then-write gap — same as the edge takeover finding.

## Auto Run Result

**Summary:** Story 1.5 adds the chunk runner. `runChunk({fs, clock, pid, gate?, log?}, step)` takes an atomic, recoverable lock at `data/sync.lock` and gets its order from `core`'s `chunkOrder`. It stops on a search or fetch allowance below 1, on a yield, or when the workload runs out. It re-reads the lock before it writes `data/sync-progress.json`, and it releases only its own lock, in a `finally`. `pnpm sync:dry` runs the same runner in memory over a read-only snapshot of `data/tracked.json` and prints `{outcome, completed, progress, records}`. The contracts change landed first as a separate commit, `571e55d`.

**Files changed:**
- `packages/contracts/src/sync-progress.ts` (+test): the `SyncLockSchema` and `SyncProgressSchema`.
- `packages/contracts/src/envelopes.ts`, `index.ts` (+tests): `SyncProgressFileSchema` and the barrel exports.
- `packages/contracts/src/ports/filesystem.ts`, `ports/fakes/filesystem.ts` (+test): `createExclusive`, with an atomic fake.
- `packages/core/src/chunk-order.ts` (+test), `index.ts`, `tsconfig.json`: the pure order function, its export, and `.ts` specifiers for bare `node`.
- `packages/sync/src/trade/client.ts` (+test): `remaining` on each result.
- `packages/sync/src/chunk/lock.ts` (+test): take, break-if-stale under a break marker, verify-own, and release-if-own.
- `packages/sync/src/chunk/run-chunk.ts` (+test): the runner and its typed outcome. The tests cover every matrix row.
- `packages/sync/src/shell.ts` (+test): `createNodeFilesystemPort`, with `createExclusive` via `open(path, 'wx')`.
- `packages/sync/src/dry-run.ts` (+test): a pure `dryRun(trackedText)` and the read-only script.
- `packages/sync/src/index.ts`: the runner exports.

**Review:** 45 findings. Of these, 11 low findings were patched, covering 8 distinct fixes. Nothing was deferred. 19 low, 12 false and 3 maybe-false findings were rejected, each with its reason in the triage log above.

**Follow-up review recommended:** `false`. By verdict, 0 high, 0 medium and 11 low findings were patched.

**Verification:** after the patches:
- `pnpm check` passes: typecheck, lint, and depcruise (no violations).
- `pnpm test`: 37 files, 295 tests, all passed, none skipped.
- `pnpm sync:dry` exits 0 and prints JSON on stdout.
- `git status -- data/` is clean.
- Matrix audit: every row has a passing test.

**Residual risks:**
- **Check-then-delete gaps:** release-if-own, the progress-write ownership check, and the break-marker clean-up are each a read followed by an act. `FilesystemPort` has no compare-and-delete or rename that would close the gap.
- **Unreadable lock break:** a lock broken by file time produces no `stale-lock-broken` record.
- **Throw loses progress:** a throw from the step loses that chunk's progress.
- **Stale `AGENTS.md`:** it still says `pnpm sync:dry` exits non-zero on purpose and must not be changed. That text needs a manual refresh; this workflow does not edit agent-context files.

## Verification

**Commands:**
- `pnpm check`: expected zero violations.
- `pnpm test`: expected all green.
- `pnpm sync:dry`: expected exit 0 and JSON on stdout.
- `git status`: expected nothing under `data/`.
