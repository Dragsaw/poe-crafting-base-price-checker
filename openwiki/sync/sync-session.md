---
type: subsystem
title: The pnpm sync session
description: How the long-running pnpm sync session prices one entry per locked chunk, shares one pacing state across chunks, pre-waits the even spread outside the lock, decides each wait with the pure nextWait/nextState matrix, polls local files instead of sending requests while idle, and stops on SIGINT or SIGTERM; and how it differs from pnpm sync:batch.
tags: [sync, session, pacing, rate-limits, backoff, lock, cli]
verified:
  - by: openwiki/0.6.0
    at: 2026-09-27T19:26:28.611Z
sources:
  - id: openwiki-source-869e9d6242b1ef866e244695
    resource: repo://packages/sync/src/shell.ts
  - id: openwiki-source-999659a0385fcbff008d129d
    resource: repo://packages/sync/src/sync-batch.ts
  - id: openwiki-source-4c0582c853fafa6e932bf71d
    resource: repo://packages/sync/src/sync.ts
generated: { by: "claude-code", at: "2026-09-27T19:26:28.611Z" }
---

# The pnpm sync session

`pnpm sync` (`packages/sync/src/sync.ts`) is a **long-running process**. It runs until it is stopped and prices **one entry per iteration**. Each iteration is the same chunk that `pnpm sync:batch` runs (see [The sync chunk runner](chunk-runner.md)), bounded to one entry. The chunk takes the lock, loads, prices, publishes and releases. The lock is taken per entry and never held across a wait, so the lock rules and their 6-hour stale threshold are unchanged.

`pnpm sync:batch` (`packages/sync/src/sync-batch.ts`) keeps the earlier behaviour: one batch chunk per invocation, for an external scheduler. Both commands compose the chunk with `composeChunk`. Only the session passes the `pacing`, `spread`, `requests` and `session` options.

| | `pnpm sync` | `pnpm sync:batch` |
| --- | --- | --- |
| Lifetime | Until SIGINT/SIGTERM | One chunk, then exit |
| Entries per chunk | 1 (`maxEntries: 1`) | Until a rate-limit bound, a yield or the end of the order |
| Pacing | Even spread, pacing memory shared across chunks | Batch pacer, a cold governor per run |
| League gate | Skipped while a confirmed league still holds | Every run |
| Pinned entries | Only stale ones (`--pinned-max-age`, default 4 h) | Every chunk |
| Exit code | 0 after a stop; 1 only for bad arguments or a missing User-Agent | 0 on any outcome; 1 on a refusal or a throw |

## Startup

`syncSessionCommand(deps)` parses the arguments first. The only option is `--pinned-max-age <hours>`, a positive number, default `DEFAULT_PINNED_MAX_AGE_HOURS` (4). A literal `--` is skipped, and any other argument is refused. It then resolves `POE_SYNC_USER_AGENT`. Either refusal prints to stderr and returns 1 before any request is sent.

The session then creates **one `PacingState`** (the rate-limit bucket ledger and the lane-to-policy memo) and one request counter for the whole process. There is no startup wait. The first request goes out cold, and its response seeds the ledger.

## One iteration

1. **Input signature.** `inputSignature` records the presence and `modifiedAt` of every hand-owned input file in `INPUT_PATHS`: `data/tracked.json`, `config.json`, `currencies.json`, `weights.json` and `catalogue/{items,stats,filters}.json`. It never throws: a transient filesystem fault on one path records an error marker for that path.
2. **Gate due?** `gateDue` is true when no league is confirmed, when the last chunk ended a pass, or when the signature differs from the one taken when the league was last confirmed.
3. **Pre-wait, outside the lock.** `preWaitMs` is the largest spread delay (`laneDelayMs(..., spread: true)`) over the lanes the next entry spends on: `SEARCH_LANE` and `FETCH_LANE`, plus `DATA_LANE` when the gate is due. The session sleeps that long before the chunk. The only waits inside a chunk are then the fetch lane's small gaps. See [Governed trade client and rate limits](trade-client-and-rate-limits.md).
4. **The chunk.** `composeChunk(...).run()` with the shared `pacing`, `spread: true`, the shared `requests`, and `session` = `{maxEntries: 1, pinnedMaxAgeMs, requestsSince?, confirmedLeague?}`. The outcome is printed as one line, for example `pnpm sync: bounded by entries, 1 completed: <key>`. A throw is caught and printed to stderr. **A throw never stops the session.**
5. **Context.** After the chunk the session reads the `notBefore` in `sync-progress.json` (only if it is still in the future). It records whether the chunk brought a fresh State reading (the ledger object changed) and the tightest even interval over the lanes (`sessionEvenIntervalMs`). A lane whose policy has not been read counts as `COLD_EVEN_INTERVAL_MS`, 36 s.
6. **Decide and wait.** The pure `nextWait` chooses the wait, `nextState` advances the state, and `runWait` spends the wait.

## The wait matrix (`nextWait`)

| Chunk result | Wait |
| --- | --- |
| `bounded` or `completed` with work | none: the next iteration starts at once, after its pre-wait |
| `completed` with nothing attempted and nothing completed | until an input file changes, at most `UNRESOLVABLE_RETRY_MS` (24 h) ("nothing due") |
| `busy` / `dispossessed` | until the lock file is absent or stale |
| `deferred` | until the outcome's `notBefore` ("a trade penalty") |
| `yielded` with a `notBefore` (a 429) | until that `notBefore` |
| `yielded` with a fresh State reading (a 5xx or timeout that still carried headers) | none: the spread paces the retry |
| `yielded` with no answer | backoff |
| throw, with a `notBefore` (malformed request or gate 4xx) | until `notBefore`; for a `MalformedRequestError` also ends on an input change, because an edit may fix the request |
| throw that is a refusal | until an input file changes |
| any other throw | until an input file changes, at most the backoff |

A **refusal** is a `DataFileError` for a watched input path, `PinnedCapExceededError`, `UnknownClassBaseTypeError` or `LeagueMismatchError`. A `DataFileError` on a sync-owned file (dataset, progress, report) is not a refusal: no edit to a watched input would end that wait, so it takes the backoff instead.

**Backoff.** `backoffMs(evenInterval, count)` is the even interval doubled for each consecutive backoff, capped at the 6-hour stale threshold (`STALE_LOCK_AFTER_MS`). The count resets to 1 after a fresh State reading and to 0 after any result that is not a backoff.

## Session state (`nextState`)

`SessionState` holds `confirmedLeague` and `confirmedSignature`, `passStart` (the request counter's snapshot at the start of the current pass), `passEnded` and `backoffCount`.

- Only a `LeagueMismatchError` clears the confirmed league. A transient fault keeps it, so the retry does not spend another gate request.
- An outcome without `newPass` (busy, deferred, an ending before the order) changes nothing about the pass.
- `passStart` resets to this iteration's snapshot when the chunk started a new pass. It is passed back as `requestsSince`, so `sync-report.json`'s `requestsBySource` covers the whole pass, not only the last one-entry chunk.
- `passEnded` is set after a `completed` chunk, which makes the gate due again for the next pass.
- The league stays confirmed only when the chunk returned `confirmedLeague`.

## Waiting without requests

`runWait` never sends a request. It uses the injected abortable `sleep` and local reads, polling every `LOCAL_POLL_MS` (5 s):

- `until`: sleeps to the instant. With `orInputChange` it wakes every 5 s and returns early when the input signature changes.
- `input-change`: polls the input signature, up to an optional `until`.
- `lock`: polls `lockIsFree`, which is true when the lock file is absent or stale by the chunk runner's own `isStaleState`. A read that throws counts as not free, so the poll continues.

The next iteration re-reads the signature. So an input edit during any wait makes the gate due again.

## Stopping

`main` installs `process.once` handlers for SIGINT and SIGTERM that abort one `AbortController`. The session's waits use `abortableSleep` from `shell.ts`, which resolves on abort. So the first signal cancels a wait at once, or lets the running entry finish. The command then prints `pnpm sync: stopped` and exits 0. A second signal gets Node's default handling and ends the process. The in-chunk waits use the ordinary `sleep`, so a chunk is never cut short.

## Tests

`packages/sync/src/sync.test.ts` covers `parseArgs`, the `nextWait` matrix, the gate-due pre-wait, `runWait` and the local polls, and the whole session with injected ports. No test runs `main`, and the entry guard means importing the module runs nothing. `sync-batch.test.ts` covers the batch command.
