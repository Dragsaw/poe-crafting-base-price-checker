---
title: 'Story 1.5: One bounded, resumable, single-instance chunk'
type: 'feature'
created: '2026-09-26'
status: 'ready-for-dev'
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
- [ ] `packages/contracts/src/{sync-progress.ts,envelopes.ts,ports/filesystem.ts,ports/fakes/filesystem.ts,index.ts}`: add the progress and lock schemas and `createExclusive`. Make the fake atomic.
- [ ] `packages/core/src/chunk-order.ts` + test: add the pure order function.
- [ ] `packages/sync/src/trade/client.ts` + test: add `remaining` to each result.
- [ ] `packages/sync/src/chunk/lock.ts`: take, break-if-stale, verify-own, release-if-own.
- [ ] `packages/sync/src/chunk/run-chunk.ts`: add `runChunk({fs, clock, pid, gate?}, step)` returning a typed outcome (`completed|bounded|yielded|busy|dispossessed`, `completed` keys, `records`).
- [ ] `packages/sync/src/chunk/*.test.ts`: cover every matrix row, including a `Promise.all` race on the fake, and a source scan proving no `minChunkSearches` or `config.json` reference in `chunk/`.
- [ ] `packages/sync/src/shell.ts`: add the real `FilesystemPort` adapter.
- [ ] `packages/sync/src/dry-run.ts` + `dry-run.test.ts`: implement the read-only in-memory dry run from the Decisions. Keep a pure `dryRun(trackedText)` that is unit-tested with a fake filesystem. The spawned test asserts exit 0, identical stdout across two runs, parseable JSON, and no write.

**Acceptance Criteria:**
- Given `pnpm check`, when it runs, then typecheck, lint and depcruise pass.
- Given `pnpm test`, when it runs, then all suites pass, no request escapes, and nothing is written under `data/`.
- Given Stories 1.8, 1.9 and 1.11, when they extend this runner, then they add to the outcome and the `gate` hook without rewriting the lock or release path.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `pnpm check`: expected zero violations.
- `pnpm test`: expected all green.
- `pnpm sync:dry`: expected exit 0 and JSON on stdout.
- `git status`: expected nothing under `data/`.
