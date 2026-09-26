---
title: 'Story 1.11: League validation as a run-start gate'
type: 'feature'
created: '2026-09-26'
status: 'ready-for-dev'
baseline_revision: '9d336df330f8a5d28ebbb77f88a693b3491c39aa'
route: 'dispatch'
review_loop_iteration: 0
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
- `packages/sync/src/chunk/run-chunk.test.ts`: `harness` L116, `shellPorts` L98, `scriptedStep` L141, `countedHttp` ~L1058, `reportOf`, `ZERO`. Mirror L1353 ("a gate throw writes the report…") and L723.
- `packages/sync/src/pricing/fixture-port.ts` L26 `readPricingFixtures`, L45 `createFixtureHttpPort`, `fixture-names.ts`: serve `trade-data-leagues.json` for `GET TRADE_LEAGUES_URL`. `fixtures/trade-data-leagues.json` is already recorded (`fixtures-record.ts` L92).
- `packages/sync/src/dry-run.ts` L136 `dryRun`, L167 client wiring, L233 fixtures: pass `gate`. `dry-run.test.ts` asserts the request map.
- `packages/sync/src/load-config.ts`: `loadActiveLeague`. `shell.ts`: `createFetchHttpPort`, `systemClock`, `createNodeFilesystemPort`. `fixtures-record.ts` L355–377 shows the load-then-refuse pattern for a live shell.
- Already satisfied, cite in Verification: `ConfigFileSchema` strictObject (`envelopes.ts` L45); `PriceObservation.league` stamped in `price-entry.ts` ~L245; `CurrencyRate.league` required (`currency-rate.ts` L38).

## Tasks & Acceptance

**Execution:**
- [ ] `packages/contracts/src/sync-run-report.ts`, `trade-catalogue.ts` (or sibling), `index.ts` + tests -- `LeagueMismatchRecordSchema` in the union, `LeaguesPayloadSchema`. Commit alone, first.
- [ ] `packages/sync/src/league/league-gate.ts` + test -- `LeagueMismatchError {configuredLeague, availableLeagues}` and `createLeagueGate({client, league})` returning `(ctx: GateContext) => Promise<void>`. Cover match, mismatch, byte comparison, empty list, rejected, malformed.
- [ ] `packages/sync/src/chunk/run-chunk.ts` + test -- `failureRecord` maps `LeagueMismatchError` to the record. Cover every matrix row that names the runner.
- [ ] `packages/sync/src/pricing/fixture-port.ts` + `fixture-names.ts` + test -- serve the leagues fixture.
- [ ] `packages/sync/src/dry-run.ts` + test -- wire the gate with a `league-validation`-counted client.
- [ ] `packages/sync/src/index.ts` -- export the gate and the error.
- [ ] `packages/sync/src/sync.ts` + root `package.json` script `sync` (`node --env-file-if-exists=.env …`, like the sibling commands) + test of the composition with injected ports -- the live shell: real fs at the repo root, real clock, fetch http port, fake git port, `process.exitCode = 1` on a throw. Never run it in a test.
- [ ] `docs/stories/deferred-work.md` -- append the real-git-adapter entry (the `git-author-date` clock of AD-12, blocked by `no-git-write.test.ts`).

**Acceptance Criteria:**
- Given `pnpm check`, when it runs, then it passes.
- Given `pnpm test`, when it runs, then every suite passes, no request escapes, and nothing is written under `data/`.
- Given `pnpm sync:dry`, when it runs twice, then stdout is byte-identical and `requestsBySource` is `{tracked-list: n, league-validation: 1, catalogue-refresh: 0}`.
- Given a run whose gate aborts, when it exits, then `data/sync.lock` is gone, `dataset.json` and `sync-progress.json` are unchanged, and `sync-report.json` carries the `league-mismatch` record.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `pnpm check` -- expected: pass
- `pnpm test` -- expected: all green
- `pnpm sync:dry` -- expected: exit 0, byte-identical stdout on two runs, `league-validation: 1`
- `git status -- data/` -- expected: clean
