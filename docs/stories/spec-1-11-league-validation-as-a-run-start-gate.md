---
title: 'Story 1.11: League validation as a run-start gate'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_revision: '4d23159a33b846fb047ea06648f7f629ff8ca71f'
route: 'dispatch'
review_loop_iteration: 1
followup_review_recommended: false
deferred:
  - summary: >-
      The live `pnpm sync` does not call `checkPinnedCap`, the load-time half of AD-7's pinned cap.
    evidence: |-
      `pinned-cap.ts` documents `count(pinned) > 0.5 × minChunkSearches` as "a `tracked.json` validation error". No shell calls `checkPinnedCap` (grep: only `index.ts` and `pinned-cap.test.ts`). `sync:dry` never did either, and the story's composition list does not name it. A tracked list over the cap therefore runs live and reports only `pinned-starvation` at runtime.
    location: >-
      packages/sync/src/sync.ts (live composition); packages/sync/src/pinned-cap.ts
    severity: medium
  - summary: >-
      A 429's `retryAfterMs` is not kept across processes, so the next scheduled `pnpm sync` may send inside the penalty window.
    evidence: |-
      The ledger is per process by AD-8's design, and the pricing step's yield drops the delay the same way. To settle it, compare the player's scheduler interval with the `Retry-After` windows the trade API actually returns.
    location: >-
      packages/sync/src/trade/client.ts (per-process ledger); packages/sync/src/league/league-gate.ts
    severity: medium (unverified)
context:
  - '{project-root}/docs/stories/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing checks that the league in `data/config.json` exists before a run spends budget. A mistyped league searches a league the API does not carry, and the failure surfaces nowhere the player looks. `ChunkPorts.gate` has waited for this since Story 1.5, and `requestsBySource['league-validation']` is always `0` (FR-32, AD-19, AD-12).

**Approach:** A league gate plugs into the existing `gate` hook. Under the lock and before any tracked load consequence, it sends one GET to the trade leagues endpoint through the governed client, counted as `league-validation`. The configured league must appear among the ids. A miss throws a typed error, and the existing catch path writes `sync-report.json` alone with a `league-mismatch` record, releases the lock and exits non-zero. `sync:dry` runs the same gate against the recorded `fixtures/trade-data-leagues.json`.

**Decisions (2026-09-26, human):**
- **Scope is the gate plus the live `pnpm sync` command on the fake git port.** The command composes the real filesystem at the repository root, the real clock, the fetch http port, the governed client, the pricing step, the catalogue loader and the league gate, and exits non-zero on a throw. The tracked-list date therefore comes from the `file-modified` clock, which AD-12 allows when git yields no date. The real git adapter is deferred: `no-git-write.test.ts` forbids every process spawn in `sync`, and the adapter needs one, so it gets its own design pass. Log it in `deferred-work.md`.
- **The spec is kept whole** at about 1,900 tokens.

**Decisions (2026-09-26, agent):**
- **A new record kind, not a `run-failure` reason.** `{kind: 'league-mismatch', configuredLeague, availableLeagues: string[]}`. A mismatch is routine configuration, and the player needs the list to correct it. `availableLeagues` holds the endpoint's ids in endpoint order.
- **The leagues payload gets a schema in `contracts`** beside the catalogue payload schemas: `{result: [{id, ...}]}`, loose on unknown keys. A body that fails it is `unrecoverable-error` (existing path).
- **A rejected leagues request** (non-429 4xx) is a `run-failure` with `trade-request-rejected`, `status` and no `entryKey`. A 429 follows the client's normal pacing.
- **The gate takes the league as an argument.** `chunk/` still never names `config.json`.
- **Contracts land first, alone**, in one commit.
- **Config shape and league stamping** (AC 4 and 5 of the epic) already hold. This story adds no code for them and cites the tests that prove them.

## Boundaries & Constraints

**Always:** Exactly one leagues request per run, sent after the lock is held and before any search. The gate is the first request source that runs. An abort writes only `sync-report.json`, by the existing `writeReport` path, with no `runFinishedAt`, and releases the lock in the existing `finally`. Effects go through ports. A test never reaches the network and never writes under `data/`.

**Never:** No change to `runChunk`'s order of operations beyond the gate hook that exists. No cross-file gate (3.3). No league filter on the dataset (AD-19). No git write, no `child_process`. No hardcoded rate.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior |
|---|---|---|
| Match | config league is an id in `result[]` | the chunk runs, `requestsBySource['league-validation'] === 1`, no record |
| Mismatch | config league absent from `result[]` | `league-mismatch` record with `configuredLeague` and every id; no dataset, no progress write; lock released; step never called; `tracked-list` count `0` |
| Case or spacing | `forbidden rites` vs `Forbidden Rites` | mismatch. Ids compare byte for byte |
| Empty list | `result: []` | mismatch with `availableLeagues: []` |
| Rejected | leagues GET answers 404 | `run-failure`, `trade-request-rejected`, `status: 404`, no `entryKey` |
| Malformed | body is not the payload shape | `run-failure`, `unrecoverable-error` |
| Busy | the lock is held by a live process | no leagues request at all |
| Repeat | mismatch two runs running | one `league-mismatch` record (dedup by `carryRecords`) |
| Dry run | `pnpm sync:dry` | serves `trade-data-leagues.json` for the GET; `league-validation: 1` in the printed report |
| Live shell | `pnpm sync` composition with injected ports | the gate runs first, the pricing step is the chunk step, a throw sets exit code 1 and the report is the only write |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/sync-run-report.ts` L150–190: `RunFailureReasonSchema`, `RunFailureRecordSchema` (`entryKey` already optional), `SyncRunRecordSchema` L168 union. Add `LeagueMismatchRecordSchema` to the union. Update `index.ts` and the record tests.
- `packages/contracts/src/trade-catalogue.ts`: the catalogue payload schemas. Add `LeaguesPayloadSchema` (`result: array of {id: LeagueIdSchema}` with `.loose()`) beside them, or in a sibling file, and export it.
- `packages/sync/src/trade/endpoints.ts` L30: `TRADE_LEAGUES_URL`, `DATA_LANE`. Reuse both. Update the comment that says 1.11 owns the gate.
- `packages/sync/src/trade/client.ts` L88 `TradeRequest`, L164 `send`, `MalformedRequestError` (`invalid-requests.ts`): the governed client. The gate calls `send({method: 'GET', url: TRADE_LEAGUES_URL, lane: DATA_LANE})`. Check how `TradeResult` reports a non-429 4xx and mirror `price-entry.ts` L100–130's handling.
- `packages/sync/src/request-counter.ts` L21 `counted(http, source)`: wrap the http port as `'league-validation'` for the gate's client. One `HttpPort` can be wrapped twice with different sources, each wrapper feeding its own client, or one client per source. Pick the simpler of the two after reading `createTradeClient`'s ledger sharing (`trade/ledger.ts`): both clients must share one ledger so pacing stays global.
- `packages/sync/src/chunk/run-chunk.ts`: `GateContext` L137, `ChunkPorts.gate` L181, gate call L439–441, `failureRecord` L287–304 (add the `LeagueMismatchError` branch, first), `newRecords` L371, catch L551–581. Do not reorder.
- **A gate yield is a chunk yield (AD-8: "On a 429 the adapter … yields the chunk").** A 429 on the leagues GET is not a fault and must not become a `run-failure`. Widen `ChunkPorts.gate` to `(context: GateContext) => Promise<GateResult>` with `GateResult = {kind: 'pass'} | {kind: 'yield'}` (keep `gate` optional). On `{kind: 'yield'}` at the existing gate call, `runChunk` visits no entry, writes **no** dataset and **no** progress, runs the same `holdsLock` check as the normal commit, then writes `sync-report.json` through the existing `writeReport(newRecords(), clock.now())` (so `runFinishedAt` is set and `requestsBySource['league-validation']` is `1`), releases the lock in the existing `finally`, and returns `{kind: 'yielded', completed: [], entries: [], records}`. Nothing else in the order of operations moves. Existing test gates that return `undefined` are updated to return `{kind: 'pass'}`.
- **The gate's answer classes mirror `price-entry.ts` `sendLeg` L188–210 and `isTransportFailure` L179.** Yield (`{kind: 'yield'}`): a client `yield` (429 or invalid-request threshold), a 5xx, a timeout or a `fetch` network failure (reuse `isTransportFailure`; export it or move it to a shared module under `trade/`). Throw `LeagueRequestRejectedError(status)` → `run-failure`, `trade-request-rejected`, `status`, no `entryKey`: any other non-2xx. Throw `UnexpectedLeaguesResponseError` → `unrecoverable-error`: a 2xx that is not JSON or fails `LeaguesPayloadSchema`. Throw `LeagueMismatchError` → `league-mismatch`: a 2xx whose ids lack the league. Any other port rejection is rethrown.
- `packages/sync/src/chunk/run-chunk.test.ts`: `harness` L116, `shellPorts` L98, `scriptedStep` L141, `countedHttp` ~L1058, `reportOf`, `ZERO`. Mirror L1353 ("a gate throw writes the report…") and L723.
- `packages/sync/src/pricing/fixture-port.ts` L26 `readPricingFixtures`, L45 `createFixtureHttpPort`, `fixture-names.ts`: serve `trade-data-leagues.json` for `GET TRADE_LEAGUES_URL`. `fixtures/trade-data-leagues.json` is already recorded (`fixtures-record.ts` L92).
- `packages/sync/src/dry-run.ts` L136 `dryRun`, L167 client wiring, L233 fixtures: pass `gate`. `dry-run.test.ts` asserts the request map.
- `packages/sync/src/load-config.ts`: `loadActiveLeague`. `shell.ts`: `createFetchHttpPort`, `systemClock`, `createNodeFilesystemPort`. `fixtures-record.ts` L355–377 shows the load-then-refuse pattern for a live shell.
- Already satisfied, cite in Verification: `ConfigFileSchema` strictObject (`envelopes.ts` L45); `PriceObservation.league` stamped in `price-entry.ts` ~L245; `CurrencyRate.league` required (`currency-rate.ts` L38).

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/sync-run-report.ts`, `trade-catalogue.ts` (or sibling), `index.ts` + tests -- `LeagueMismatchRecordSchema` in the union, `LeaguesPayloadSchema`. Commit alone, first. (Landed as `4d23159`; kept through the loopback.)
- [x] `packages/sync/src/league/league-gate.ts` + test -- `LeagueMismatchError {configuredLeague, availableLeagues}` and `createLeagueGate({client, league})` returning `(ctx: GateContext) => Promise<GateResult>`. Cover match, mismatch, byte comparison, empty list, rejected, malformed, and each yield class: 429, invalid-request threshold, 5xx, timeout, network failure.
- [x] `packages/sync/src/chunk/run-chunk.ts` + test -- `failureRecord` maps `LeagueMismatchError` to the record and `LeagueRequestRejectedError` to the rejected run-failure. The gate-yield path of the Code Map. Cover every matrix row that names the runner, plus a gate 429: outcome `yielded`, no step, dataset and progress byte-unchanged, lock released, report with `runFinishedAt`, `league-validation: 1` and no `run-failure` record.
- [x] `packages/sync/src/pricing/fixture-port.ts` + `fixture-names.ts` + test -- serve the leagues fixture.
- [x] `packages/sync/src/dry-run.ts` + test -- wire the gate with a `league-validation`-counted client.
- [x] `packages/sync/src/index.ts` -- export the gate and the error.
- [x] `packages/sync/src/sync.ts` + root `package.json` script `sync` (`node --env-file-if-exists=.env …`, like the sibling commands) + test of the composition with injected ports -- the live shell: real fs at the repo root, real clock, fetch http port, fake git port, `process.exitCode = 1` on a throw. Never run it in a test. The command exits `0` on every resolved outcome (`completed`, `bounded`, `yielded`, `busy`, `dispossessed`) and `1` on a refusal or a throw. The composition tests also cover: a gate 429 exits `0` with no `run-failure` record; a live lock exits `0` with no request; a seeded published dataset with a priced entry whose search answers 429 keeps that entry's price in the written dataset; a malformed `data/dataset.json` exits `1` with no request and no write.
- [x] `docs/stories/deferred-work.md` -- append the real-git-adapter entry (the `git-author-date` clock of AD-12, blocked by `no-git-write.test.ts`).

**Acceptance Criteria:**
- Given `pnpm check`, when it runs, then it passes.
- Given `pnpm test`, when it runs, then every suite passes, no request escapes, and nothing is written under `data/`.
- Given `pnpm sync:dry`, when it runs twice, then stdout is byte-identical and `requestsBySource` is `{tracked-list: n, league-validation: 1, catalogue-refresh: 0}`.
- Given a run whose gate aborts, when it exits, then `data/sync.lock` is gone, `dataset.json` and `sync-progress.json` are unchanged, and `sync-report.json` carries the `league-mismatch` record.

## Implementation Notes

- **One governor, two counted ports.** `createTradeClient` keeps its ledger per instance, so two clients would pace apart. `createTradeClients({http: {source: port, …}})` (`trade/client.ts`) builds sibling clients that share the ledger, the invalid-request counts, the lane memo and the serial queue; `createTradeClient` is the one-port case of it. `dry-run.ts` and `sync.ts` wrap one `HttpPort` twice, as `league-validation` and `tracked-list`. Covered by `client.test.ts` ("paces sibling clients against one ledger…").
- **Gate answers** (`league/league-gate.ts`): `{kind: 'pass'}` on a match. `{kind: 'yield'}` on a client yield (429, invalid-request threshold), a 5xx, or a timeout / `fetch` network failure. `isTransportFailure` moved from `price-entry.ts` to `trade/transport-failure.ts`, shared by both callers. Throws: `LeagueMismatchError` → `league-mismatch`; `LeagueRequestRejectedError` (any other non-2xx) → `run-failure`, `trade-request-rejected`, `status`, no `entryKey`; `UnexpectedLeaguesResponseError` (not JSON, or fails `LeaguesPayloadSchema`) → `unrecoverable-error`; any other port rejection is rethrown → `unrecoverable-error`. `LeagueGateUnansweredError` is gone.
- **Gate-yield path** (`chunk/run-chunk.ts`): `GateResult` is exported beside `GateContext`. On `yield`, `runChunk` runs the commit's `holdsLock` check (`dispossessed` with nothing written if lost), then `writeReport(newRecords(), clock.now())`, and returns `{kind: 'yielded', completed: [], entries: [], records}`. No dataset or progress write; the lock is released in the existing `finally`.
- **`LeaguesPayloadSchema`** lives in a sibling file, `contracts/src/trade-leagues.ts`, with `LeagueEntrySchema`; ids are `LeagueIdSchema`.
- **Fixture port:** `servedFixtureName` (`pricing/fixture-names.ts`) maps `GET TRADE_LEAGUES_URL` to `trade-data-leagues`; every other request keeps its digest name. `pricingFixtureName` is unchanged, so `fixtures:record` is unaffected. `readPricingFixtures` also reads `trade-data-leagues.json`.
- **Live shell** (`sync.ts`): `runSync(ports)` composes and runs one chunk; `syncCommand(deps)` returns the exit code (`1` on a blank `POE_SYNC_USER_AGENT`, a load refusal or any throw; `0` on every resolved outcome). Config, rates, item types and the published dataset load before the lock, as `dry-run.ts` does. No `invalidRequestThreshold` is passed: no value source exists (AD-19 limits `config.json` to the league and `minChunkSearches`), and with the option omitted the client refuses nothing, while the chunk still stops at its first 4xx, and `checkPinnedCap` is not called (deferred, see frontmatter).

## Spec Change Log

### 2026-09-26 — Loopback 1 (review pass 1, bad_spec)

- **Trigger:** a 429 (or a 5xx, timeout, threshold refusal) on the leagues GET aborted the run as a `run-failure` / `unrecoverable-error` and `pnpm sync` exited `1`. AD-8 says a 429 *yields the chunk*, and the frozen intent says "A 429 follows the client's normal pacing". The gate hook could only pass or throw, so the spec gave the implementer no way to yield. Separately, the live-shell tests never seeded a published dataset and never pinned the `busy` exit code.
- **Amended:** Code Map (two new bullets: the gate-yield path in `runChunk`, and the gate's answer classes mirroring `sendLeg`), the league-gate and run-chunk tasks (yield-class and gate-429 coverage), and the `sync.ts` task (exit codes per outcome, four named composition tests). The contracts task is marked done.
- **Known-bad state avoided:** a transient throttle at run start shown to the player as an unrecoverable fault, with a failing exit code, contrary to AD-8.
- **KEEP (from attempt 1, saved as `C:/Users/ilyal/AppData/Local/Temp/claude/C--Users-ilyal-orca-workspaces-poe-crafting-base-price-checker-1-11/cee868b8-8cb0-40a9-8e3f-575e96f7871f/scratchpad/attempt-1.patch`, the diff `79f3a8a..7a17ec5` without the spec. Attempt 1 and its revert were later squashed out of the branch history; the kept parts survive in the final sync commit):**
  - The contracts commit `4d23159` stays as it is: first and alone.
  - `createTradeClients` in `trade/client.ts` (sibling clients sharing one ledger, invalid-request counts, lane memo and queue; `createTradeClient` as its one-port case) and its `client.test.ts` cases.
  - `servedFixtureName` + `LEAGUES_FIXTURE_NAME` in `fixture-names.ts`, the widened `readPricingFixtures` regex, and `fixture-port.test.ts`, with `pricingFixtureName` unchanged so `fixtures:record` is unaffected.
  - `dry-run.ts` wiring: one fixture port counted twice (`league-validation`, `tracked-list`) through `createTradeClients`; the three `dry-run.test.ts` gate cases.
  - `sync.ts` shape: `runSync(ports)` / `syncCommand(deps)` / guarded `main`, loads before the lock, `resolveUserAgent` refusal, the `sync.test.ts` recording-filesystem harness and the script-path test.
  - The `league-gate.ts` error classes and byte-for-byte `includes` check; the run-chunk matrix tests of `describe('runChunk: the league gate (Story 1.11)')`.
  - The `deferred-work.md` real-git-adapter entry text, and the Implementation Notes / Verification citations for epic AC 4 and 5.
  - Drop: `LeagueGateUnansweredError` (replaced by the yield path); the `expect(DATA_LANE).toBe(...)` self-check; the local named `fetch` in `fixture-port.test.ts` (it shadows the global).

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 28 findings — high 0, medium 7, low 8, false 11, maybe-false 2
- findings:
  - `[medium]` `[bad_spec]` Gate 429/threshold handling contradicts the frozen "A 429 follows the client's normal pacing" — confirmed at `league-gate.ts` L1095: a yield throws `LeagueGateUnansweredError` and the run aborts, while AD-8 says a 429 yields the chunk. Amended Code Map (gate-yield path) and tasks.
  - `[medium]` `[bad_spec]` A routine rate limit becomes a `run-failure` and exit 1 — same root cause as above; same amendment.
  - `[false]` `[reject]` Old `league-mismatch` record never cleared — FR-25 carries every unacknowledged record until the player acknowledges it, and this applies to every kind. That is the designed clearing path, not a defect of this change.
  - `[low]` `[reject]` Dedup covers only an identical list — real, because `carryRecords` dedups by deep equality. It takes a league-list change between two mismatched runs, and the fix is a custom dedup key (a new branch), not a direct correction.
  - `[low]` `[reject]` `sync.ts` reads the dataset before the lock — real only if another run releases the lock in the milliseconds between this run's pre-lock reads and its acquire. The fix restructures step construction.
  - `[medium]` `[defer]` Live shell omits `checkPinnedCap` (the load-time half of AD-7's cap, "a tracked.json validation error") — pre-existing: no shell has called it since it landed, and the intent's composition list does not name it. The `invalidRequestThreshold` half is low, not a defect needing a fix. It was first logged as false; that was wrong, because with the option omitted nothing is refused (`invalid-requests.ts` `thresholdReached`). The live chunk still stops at its first 4xx (a 429 yields, any other 4xx throws `MalformedRequestError`), so at most one invalid request goes out per process. The threshold also has no value source: AD-19 allows `config.json` to hold only the league and `minChunkSearches`.
  - `[low]` `[bad_spec]` Gate tests miss the threshold and timeout/network rows, and `DATA_LANE` is checked against itself — folded into the amended league-gate task and the KEEP drop list.
  - `[false]` `[reject]` The runner case/spacing test checks only case — the matrix row's input is exactly `forbidden rites` vs `Forbidden Rites`, and spacing is covered in `league-gate.test.ts`.
  - `[medium]` `[bad_spec]` `sync.test.ts` never seeds an existing dataset — confirmed: `inputs()` never writes `DATASET_PATH`. Amended the `sync.ts` task with named tests.
  - `[false]` `[reject]` Spec status in the diff lags the working tree — the diff was staged before the workflow's own `in-review` transition, so this is workflow state, not a defect.
  - `[low]` `[reject]` Fixture names say "pricing" but now serve leagues — the docstring already says `trade-data-leagues` is read. A rename would ripple into `fixtures-record.ts` and its tests.
  - `[low]` `[bad_spec]` Small slips — the missing `.ts` import extension is false (sibling contracts tests import without one, e.g. `base-type.test.ts`). The shadowing `fetch` local goes on the KEEP drop list. The over-long docstring line is re-derived with `index.ts`.
  - `[medium]` `[bad_spec]` Edge: a 429 aborts instead of pacing (a claim) — same root cause as the first row.
  - `[maybe-false]` `[defer]` Edge: `retryAfterMs` is dropped, and the next scheduled `pnpm sync` may hit the penalty window — the per-process ledger is AD-8's design and the pricing step behaves the same way. To settle it: compare the player's scheduler interval with the observed `Retry-After` windows.
  - `[maybe-false]` `[reject]` Edge: duplicate ids from the endpoint list twice — not shown to be reachable, because the recorded fixture has unique ids. If true, the harm is cosmetic (low).
  - `[low]` `[reject]` Edge: stale pre-lock dataset read — same claim as the pre-lock row above; rejected for the same reason.
  - `[low]` `[reject]` Edge: `exists`/`load` race on `dataset.json` — it needs the file deleted in a sub-millisecond window, the result is a loud refusal rather than corruption, and the fix adds a branch.
  - `[false]` `[reject]` Edge: `createTradeClients({http: {}})` returns `{}` — no caller can reach it: every call site passes a literal record with named sources, and the type ties each key to a client.
  - `[medium]` `[bad_spec]` Verification gap: the `runSync` published-dataset branch is untested — pre-verified. Amended the `sync.ts` task (seeded-dataset yield test, malformed-dataset refusal test).
  - `[low]` `[bad_spec]` Verification gap: `busy` exit 0 is not pinned — pre-verified. Amended the `sync.ts` task (live-lock test).
  - `[medium]` `[bad_spec]` Intent: a gate 429/5xx diverges from the intent, and it is tested only at the gate — same root cause as the first row. The amendment adds runner and command-level tests.
  - `[false]` `[reject]` Intent: the governed client's construction changed — the Code Map requires one shared ledger ("both clients must share one ledger"), and `createTradeClients` is how that is met.
  - `[false]` `[reject]` Intent: `main()` is untested — the intent says "Never run it in a test".
  - `[false]` `[reject]` Intent: "the report is the only write" excludes the lock ops — the same matrix row requires the lock to be released, so lock create and delete are expected.
  - `[false]` `[reject]` Intent: the dry-run mismatch rejects without printing — the intent specifies only the dry-run match row, and every other `dryRun` throw already rejects the same way.
  - `[false]` `[reject]` Intent: the timeout doc contradicts the client yielding — `TradeYieldReason` has no timeout, and a port rejection propagates through `send`, as the gate doc said. (Under the amendment, the gate yields on it.)
  - `[false]` `[reject]` Intent: the matrix rows are tested with separate clients — sharing affects pacing only, which `client.test.ts` covers. The gate outcome does not depend on it.
  - `[false]` `[reject]` Intent: unlisted additions (`busy` exit 0, pre-lock loads, `servedFixtureName`) — descriptive, with no bad outcome named. The exit code is now pinned by the amended task.

### 2026-09-26 — Review pass
- verdicts: 29 findings — high 0, medium 2, low 15, false 12, maybe-false 0
- findings:
  - `[low]` `[reject]` A gate yield or mismatch reports `notReachedCount: 0` — real: `writeReport` counts `eligible` as 0 while `order` is undefined. It is rare: a gate 429 needs the previous process to have spent the bucket moments before. The figure is overwritten by the next chunk, and the gate-throw case has been the same since Story 1.5. The count of due entries is known only after the loads that follow the gate, so the fix restructures the yield path. Recorded as a residual risk.
  - `[low]` `[patch]` A gate yield is silent — fixed: `runChunk` logs "the league check got no answer; the chunk yields with no entry visited", and the gate-429 test asserts it.
  - `[low]` `[patch]` The two frontmatter deferrals are missing from `deferred-work.md` — fixed: both appended under the story 1.11 heading.
  - `[low]` `[reject]` The Acceptance Criteria were not updated for the gate yield — the fix would edit this build's spec.
  - `[low]` `[reject]` The KEEP bullet cites a session-scoped scratchpad path — the fix would edit this build's spec. The reverted commit `7a17ec5` is also named there.
  - `[low]` `[patch]` The dispossessed gate-yield test is missing checks — fixed: it now asserts that the foreign lock is still on disk byte for byte and that no dataset or progress file was written.
  - `[low]` `[reject]` Exit codes for `bounded` and `dispossessed`, and gate 5xx/timeout at the command level, are not pinned — `syncCommand` has a single `return 0` for every resolved outcome, and the gate classes are covered at the gate unit.
  - `[low]` `[patch]` The blank-User-Agent sibling-clients test uses a bare `.toThrow()` — fixed: it now expects `MissingUserAgentError`.
  - `[low]` `[patch]` There is a double blank line in `price-entry.ts` — fixed.
  - `[false]` `[reject]` `severity: medium (unverified)` is non-standard — that is the workflow's own format for a deferred maybe-false entry.
  - `[low]` `[patch]` Doc lines are over-long in `index.ts`, `dry-run.ts` and `run-chunk.ts` — fixed: rewrapped.
  - `[medium]` `[patch]` Verification gap: no shell-level test proves that the gate and the step share one governor (pre-verified) — fixed: `sync.test.ts` "paces the tracked-list searches off the leagues GET". It was checked to fail when two independent clients are swapped in.
  - `[low]` `[reject]` Verification gap (other): `notReachedCount` on a gate yield — same claim as the first row, rejected for the same reason.
  - `[false]` `[reject]` Intent: the gate hook contract was widened — Loopback 1's amended Code Map calls for this (reading B2), and the order of operations is unchanged.
  - `[low]` `[reject]` Intent: 5xx, timeout and threshold are tested only at the gate — same reason as the exit-code row.
  - `[false]` `[reject]` Intent: a threshold yield sends zero leagues requests — this is reachable only with a threshold, and the live command passes none. It occurs only in a gate unit test.
  - `[medium]` `[patch]` Intent: no pacing is exercised through the shells — same root cause as the governor row, fixed by the same test.
  - `[false]` `[reject]` carried: Intent: governed client construction changed — the Code Map requires one shared ledger.
  - `[false]` `[reject]` carried: Intent: `main()` is untested — the intent says "Never run it in a test".
  - `[false]` `[reject]` carried: Intent: "the report is the only write" excludes lock operations — the same row requires the lock to be released.
  - `[false]` `[reject]` Intent: exit 0 on every outcome and the pre-lock loads are not in the matrix — this is descriptive; the amended task specifies both and tests pin `yielded` and `busy`.
  - `[false]` `[reject]` Intent: a yield writes `runFinishedAt` — AD-8 makes a yield a chunk yield, not an abort, and the "no `runFinishedAt`" rule covers aborts (reading C2).
  - `[false]` `[reject]` carried: Intent: a dry-run mismatch rejects without printing — every other `dryRun` throw does the same.
  - `[false]` `[reject]` Intent: spec size grew past ~1,900 tokens — the growth is workflow logs and notes; "kept whole" means not split (reading E1).
  - `[false]` `[reject]` Intent: the rejected class is wider than a non-429 4xx (a 3xx) — `fetch` follows redirects, so a 3xx does not reach the gate, and the pricing step classifies it the same way.
  - `[low]` `[reject]` Edge: `notReachedCount` 0 on a gate yield — same claim as the first row.
  - `[low]` `[reject]` Edge: `notReachedCount` 0 on the mismatch catch path — pre-existing for every throw before `order` is set; `runFinishedAt` is absent, so the report already reads as aborted.
  - `[false]` `[reject]` Edge: old-league published prices are carried into a new-league run — AD-19: `sync` does not filter the dataset on write, and `core` refuses to value any observation whose league differs from the active one.
  - `[low]` `[reject]` Edge: `gated()` ignores `extra` when `reuse` is passed — a test helper with no current caller that passes both; the fix adds a guard.

## Verification

**Commands:**
- `pnpm check` -- expected: pass
- `pnpm test` -- expected: all green
- `pnpm sync:dry` -- expected: exit 0, byte-identical stdout on two runs, `league-validation: 1`
- `git status -- data/` -- expected: clean

**Already satisfied (epic AC 4 and 5), no code added:**
- Config shape: `ConfigFileSchema` is a `strictObject` (`contracts/src/envelopes.ts`); `envelopes.test.ts` "carries the active league, minChunkSearches and schemaVersion — and nothing else".
- League stamping: `PriceObservation.league` is set from the step's league (`price-entry.ts`, `priceOf`); `price-entry.test.ts` "sends one search and one fetch of at most 10 ids, then takes the lower median" asserts `observation.league`. `CurrencyRate.league` is required; `currency-rate.test.ts` "requires the league and the asOf…".

**Results (2026-09-26, after loopback 1):** `pnpm check` pass. `pnpm test` 55 files, 575 tests pass. `pnpm sync:dry` twice: exit 0, byte-identical stdout, outcome `completed`, `requestsBySource` `{tracked-list: 10, league-validation: 1, catalogue-refresh: 0}`. `git status -- data/` clean.

## Auto Run Result

Status: done

**Summary.** Story 1.11 adds a run-start league gate and a live `pnpm sync` command.
- **Request:** the gate sends one `league-validation` GET to the trade leagues endpoint under the lock, before any search.
- **Answers:**

  | Answer | Result |
  | --- | --- |
  | Configured league missing from the list (byte comparison) | `league-mismatch` record; report-only abort; lock released; exit 1 |
  | Non-2xx that is not a 429 or a 5xx | `trade-request-rejected` run-failure |
  | Malformed body | `unrecoverable-error` |
  | 429, threshold refusal, 5xx, timeout or network failure | The chunk yields (AD-8): report only, with `runFinishedAt` and a log line; exit 0 |
- **Dry run:** `pnpm sync:dry` runs the same gate against the recorded fixture.
- **Live command:** `pnpm sync` composes the real filesystem, the clock, the fetch port and the fake git port. Sibling trade clients share one governor through `createTradeClients`.

**Commits:**
- `4d23159`: contracts, first and alone.
- The next commit: `feat(sync): story 1.11 league validation as a run-start gate`, with the sync code, this spec and `deferred-work.md`.
- During the run, the sync work went through several commits: attempt 1, its revert (loopback 1), the re-derivation and the review pass 2 patches. They were squashed into that one commit afterwards, so the commit hashes the logs above cite no longer exist on the branch. The review diffs were taken against the revert commit, whose tree matched the contracts commit at the time. The branch was then rebased onto `master` (only `deferred-work.md` conflicted, resolved by keeping both sides' appends), after which the contracts commit is `4d23159`, so `baseline_revision` now names it.

**Files changed:**
- `packages/contracts/src/sync-run-report.ts`, `trade-leagues.ts`, `index.ts` + tests: `LeagueMismatchRecordSchema`, `LeaguesPayloadSchema`.
- `packages/sync/src/league/league-gate.ts` + test: the gate and its error classes.
- `packages/sync/src/chunk/run-chunk.ts` + test: `GateResult`, the gate-yield path, and the `failureRecord` branches.
- `packages/sync/src/trade/client.ts` + test: `createTradeClients`, one governor for sibling clients.
- `packages/sync/src/trade/transport-failure.ts`: the shared `isTransportFailure`, moved out of `price-entry.ts`.
- `packages/sync/src/pricing/fixture-names.ts`, `fixture-port.ts` + test: serve `trade-data-leagues.json`.
- `packages/sync/src/dry-run.ts` + test: gate wiring.
- `packages/sync/src/sync.ts` + test, and the root `package.json` script `sync`: the live shell.
- `packages/sync/src/index.ts`, `trade/endpoints.ts`: exports and comments.
- `docs/stories/deferred-work.md`: the real git adapter, `checkPinnedCap` in the live shell, and `retryAfterMs` across processes.

**Review breakdown:**
- **Pass 1:** 28 findings. One root cause went to bad_spec (a gate 429 aborted instead of yielding) and triggered loopback 1. There were 2 deferrals; the rest were rejected with reasons in the triage log.
- **Pass 2:** 29 findings.
  - 7 patch entries applied: 1 medium (a shell-level shared-governor test) and 6 low (a gate-yield log line, the dispossessed-test assertions, `MissingUserAgentError`, a blank line, doc-comment rewraps, the `deferred-work.md` entries).
  - 0 deferred.
  - The rest were rejected with the reasons recorded above, among them `notReachedCount: 0` on a gate yield or throw.

**Follow-up review recommended:** false. Pass 2 was a loopback re-review, not a follow-up pass. It patched no high entry and one medium entry, so neither first-pass trigger (a high, or two or more mediums) applies. Patched counts: high 0, medium 1, low 6.

**Verification (final tree):**
- `pnpm check`: pass.
- `pnpm test`: 55 files and 576 tests, all passing; no skipped or `.only` tests.
- `pnpm sync:dry`, run twice: exit 0 both times, byte-identical stdout, `requestsBySource` `{tracked-list: 10, league-validation: 1, catalogue-refresh: 0}`.
- `git status -- data/`: clean.
- The matrix audit covered every row.
- `pnpm sync` was never run live.

**Residual risks:**
- A gate yield (or a gate throw) reports `notReachedCount: 0`.
- The live command runs on the fake git port, so the tracked-list edit date is always `file-modified`.
- No `invalidRequestThreshold` is passed live.
- `checkPinnedCap` is not called live (deferred).
- A 429's `Retry-After` is not kept across processes (deferred, unverified).
- The live composition is proven only with injected ports.
