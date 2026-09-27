---
type: subsystem
title: The sync chunk runner
description: How one pnpm sync invocation runs one bounded, resumable, single-instance chunk — the shared composition, the on-disk lock and stale-lock breaking, the run-start cost order, the stop conditions and pinned cap, and the ordered writes of dataset.json, sync-progress.json and sync-report.json on success and on failure.
tags: [sync, chunk, lock, rotation, sync-report, dataset, resumable]
sources:
  - id: openwiki-source-dbf0a5200ba812db3f3b5319
    resource: repo://packages/sync/src/chunk/lock.ts
  - id: openwiki-source-23115aa06fc19f9b97790be1
    resource: repo://packages/sync/src/chunk/publish-dataset.ts
  - id: openwiki-source-674c962be00b9b26529f4d45
    resource: repo://packages/sync/src/chunk/run-chunk.ts
  - id: openwiki-source-8128ba1419ce8d780ba3511f
    resource: repo://packages/sync/src/chunk/sync-report.ts
  - id: openwiki-source-46c0c66948769af343dff03d
    resource: repo://packages/sync/src/compose-chunk.ts
  - id: openwiki-source-d3466bab403d17a265b0ed6c
    resource: repo://packages/sync/src/pinned-cap.ts
  - id: openwiki-source-4c0582c853fafa6e932bf71d
    resource: repo://packages/sync/src/sync.ts
generated: { by: "claude-code", at: "2026-09-27T13:11:02.100Z" }
verified:
  - by: openwiki/0.6.0
    at: 2026-09-27T13:11:02.100Z
---

# The sync chunk runner

`pnpm sync` does not price the whole tracked list in one process. Each invocation runs **one bounded chunk** and exits. The trade API's rate limits cap how much one chunk can do. The next invocation, run by the operator or by an external schedule, continues where the previous one stopped. The runner is `runChunk` in `packages/sync/src/chunk/run-chunk.ts`.

## Composition

`composeChunk` (`packages/sync/src/compose-chunk.ts`) is the one composition that both `pnpm sync` and `pnpm sync:dry` use. From the shell's ports it builds:

- one request counter and **one governor** of two sibling trade clients over one `HttpPort`. One client is counted as `league-validation` (the gate) and the other as `tracked-list` (the pricing step). See [Governed trade client and rate limits](trade-client-and-rate-limits.md).
- the runner's `load` hook. The runner calls it under the lock. It reads `data/config.json`, checks the load-time pinned cap, reads `data/currencies.json` and the committed item types, and returns the publication (league plus output rate set), the starvation-record builder, the league gate and the pricing step. The step is built on the dataset the runner loaded.
- the `catalogue` hook, which loads the committed catalogue id sets.

`ComposeChunkPorts` has one optional seam, `wrapStep(step, context)`. When it is given, the load hook passes the pricing step it built through it, with a `StepContext` of the load-time `league` and `itemTypes`, and the runner uses the wrapped step. When it is absent, the runner uses the step unchanged. Only the dry run passes `wrapStep`: it skips an entry whose search has no recorded fixture.

The live command passes the real filesystem, clock, `fetch` port and read-only git port. The dry run passes in-memory fakes, a fixture-backed HTTP port and `wrapStep`. See [Operator commands and curation workflow](../workflows/operator-commands.md).

## The lock

`packages/sync/src/chunk/lock.ts` keeps a single instance with an exclusive on-disk lock, `data/sync.lock`, which holds `{pid, startedAt}`. `*.lock` files are git-ignored.

- **Take**: one atomic `createExclusive`. A live lock gives the normal `busy` outcome: nothing is sent, nothing is written, and the exit code is 0.
- **Stale**: a lock is stale when `now − startedAt > STALE_LOCK_AFTER_MS` (6 hours). Staleness is judged by time only, never by pid, because the operating system reuses pids. A lock file that cannot be parsed counts as **held**, because the file can be empty for an instant just after its create. Its file modification time is then used for the staleness test.
- **Break**: breaking is serialised by a second exclusive file, `data/sync.break.lock`. The breaker re-reads the lock and deletes it only if its text is still the stale text it judged. Then it takes the lock with another exclusive create. So of several concurrent breakers exactly one wins, and the others are `busy`. A broken lock adds a `stale-lock-broken` record to the report.
- **Verify / release**: before it commits, the runner re-reads the lock (`holdsLock`). If another run has taken it over, the chunk is `dispossessed` and writes nothing. `releaseLockIfOwn` runs in a `finally` block and deletes the lock only while it is still this run's lock.

## The run-start sequence

Under the lock, the checks run in order from free to costly:

1. **`notBefore` check.** `data/sync-progress.json` is read first. If its `notBefore` is in the future (set by an earlier 429 or malformed-request abort), the run is `deferred`: it sends nothing and writes nothing. The one exception is that a broken stale lock is recorded in the report.
2. **Loads**, each through `parseEnvelope`. A refusal names the file:
   - the previous `data/sync-report.json`. It is read outside the failure path, so a report this build cannot read is refused **before** anything is written, and the player's records are never lost.
   - `data/tracked.json`. An absent file is an empty workload.
   - `data/dataset.json`. An absent file means no entry was ever attempted.
   - the shell's `load` hook: config, pinned cap, rates, item types.
   - the committed catalogue, then `data/weights.json`.
3. **Offline checks**:
   - the weights records: an absent file gives a `weights-absent` record, and a present file has its ids checked against the catalogue, report-only.
   - the run-start catalogue check (`chunk/catalogue-check.ts`). For each non-pruned entry it checks the `categoryId` or `baseTypeId`, then the prefix and suffix `statId`s, against the catalogue. An entry with any miss is marked `unresolvable`, gets one `unresolvable` record per miss, and is left out of this chunk's order. An entry published as `unresolvable` whose ids all resolve again is recovered into the order as an ordinary entry. Nothing here stamps `lastAttemptedAt`.
4. **The order**: `chunkOrder` from `core` over the tracked list (without the excluded keys), the adjusted dataset, the completed keys and the clock. It is recomputed on every run (see [Core: ranking and refresh rotation](../core/ranking-and-refresh-rotation.md)).
5. **The league gate**: the only run-start check that sends a request (see [Pricing step and league gate](pricing-step-and-league-gate.md)). A gate `yield` ends the chunk as an ordinary `yielded` chunk with no entry attempted.
6. **The rotation**: the steps.

## The rotation loop and stop conditions

The loop visits the pinned row first, then the rotation rows, and calls the pricing step once per entry. The chunk stops at the first of these:

- the step reports a search allowance below 1, or a fetch allowance below 1, while more work remains. The outcome is `bounded`, with bound `search` or `fetch`. The allowances come from live response headers. The runner holds no rate of its own.
- the step yields (429, 5xx, timeout, or the client's invalid-request refusal). The outcome is `yielded`.
- the order runs out. The outcome is `completed`.

**Pinned cap, runtime half.** After each pinned step that reports a search allowance, `pinnedToKeep` may cut the rest of the pinned row so that at least one search is kept for the rotation. A cut, or a shortfall even with nothing left to cut, sets `pinnedStarvation` on the outcome. The shell's `starvationRecord` turns it into a `pinned-starvation` record with the declared `minChunkSearches` beside it.

**Pinned cap, load-time half** (`packages/sync/src/pinned-cap.ts`). When `count(pinned) > 0.5 × minChunkSearches`, the load throws `PinnedCapExceededError` before any request. The runner reports it as a `run-failure` whose message names `data/tracked.json`. This is the only place that reads `minChunkSearches`. It is a validation yardstick and never a chunk bound.

## What a chunk writes

On `completed`, `bounded` or `yielded`, the chunk writes three files, in this order, through `writeArtifact`:

1. **`data/dataset.json`** (`chunk/publish-dataset.ts`): exactly one entry per tracked entry, pruned entries included, sorted by canonical key. Each entry is this chunk's step entry, else the catalogue mark, else the previous entry unchanged, else `not-yet-synced`/`never-synced` with no timestamps. Previous entries whose key is no longer tracked are dropped. There is no league filter on entries. The top-level `league` is the configured league only once the gate has passed. Before that, the previously published label stays.
2. **`data/sync-progress.json`**: the rows 2–3 completed keys only (pinned entries are exempt), sorted. `notBefore` is set to `now + min(retryAfter, 6h)` after a 429 and to `now + 6h` after a malformed-request abort. Every other ending clears it.
3. **`data/sync-report.json`** (`chunk/sync-report.ts`): this chunk's **figures** replace the previous ones. They are requests per chunk source, the not-reached count (eligible entries not attempted) and the tracked-list edit date from git (`git-author-date`, with a `file-modified` fallback). **Records** are carried forward from the previous file in order. A new record that is `sameRecord` with an existing one replaces it at its index, and any other record is appended. Records stay until the player deletes them by hand. `runFinishedAt` is set.

The dataset is written before progress, so progress never records a completion that the dataset does not publish. `busy`, `deferred` and `dispossessed` write nothing, except the deferred stale-lock case described above.

### On a throw

The report is written with a failure record and without `runFinishedAt`, the error is rethrown, and the command exits 1. What else is written depends on where the throw came from:

- **Before the order exists** (load refusal, pinned-cap excess, catalogue or weights refusal): the report only.
- **League mismatch**: the report only, with the lock record and a `league-mismatch` record that lists the available leagues. The catalogue marks and check records are discarded.
- **Any other throw after the order exists**: the dataset and progress for the step entries so far plus the marks, then the report. The failing entry is also published for a `MalformedRequestError` (a non-429 4xx) and for an `UnexpectedTradeResponseError` that carries one. Only `MalformedRequestError` writes the abort `notBefore`.

Errors in writes on the failure path are logged. The original error is always the one rethrown, and a write already attempted is not attempted again.

## Tests

`packages/sync/src/chunk/run-chunk.test.ts` is the largest test file in the repository. It drives `runChunk` against the fake filesystem, clock and git ports. `lock.test.ts`, `catalogue-check.test.ts`, `publish-dataset.test.ts` and `sync-report.test.ts` cover the pure helpers. `packages/sync/src/sync.test.ts` drives `syncCommand` with injected ports. No test runs `main`.
