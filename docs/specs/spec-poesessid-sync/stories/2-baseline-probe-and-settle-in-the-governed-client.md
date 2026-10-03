---
title: 'Baseline, probe and settle in the governed client'
type: 'feature'
created: '2026-10-03'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '5090eb0647a3aa9870cce76f235e68f8c9d50a7f'
context:
  - '{project-root}/docs/specs/spec-poesessid-sync/SPEC.md'
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 1 builds an unsettled holder for a valid `POESESSID`, but nothing tests the cookie or sends it. So a live cookie never raises the budget.

**Approach:** The governor treats the first 2xx pricing search of the process, sent without the cookie, as the baseline. Before that entry's fetch, it sends one probe with the cookie. The probe repeats the baseline's method, path and body, and its request counts under `session-probe`. The governor applies the §13.2 rule-count predicate and the §13.3 outcome rows to settle the holder. After an `authenticated` settle, it attaches `Cookie: POESESSID=<value>` to every later pricing search and fetch. It never attaches the cookie to the league request (AD-30, §13.2, §13.3, §13.5, §13.7).

## Boundaries & Constraints

**Always:**
- The holder owns the value and the state. Only the holder changes the state, and the state moves only from `unsettled`. The governor asks the holder to add the cookie header, so the value never leaves `session-auth.ts`.
- The pricing step marks its search and its fetch as cookie-eligible on the `TradeRequest`. The league gate does not mark its request. The governor attaches the cookie and probes only on marked requests.
- The baseline's answer is the step's result. The probe's search `id` never becomes `lastSearchId`. The probe's State reading goes into the ledger like any other reading. The probe goes through the same pacing wait and the same serial queue as every other request. The probe never adds to the invalid-request count.
- Probe rows: a `live` response settles `authenticated`. A 2xx that is not live settles `not-elevated`. A 4xx other than 429 (every 401 and 403 included) settles `probe-rejected`. A 5xx, a throw or a timeout settles `probe-failed`, the probe error is not passed on, and pricing continues. A 429 settles nothing: the governor latches its delay, and the next `send` of the chunk returns a 429 yield with that delay and sends nothing. The runner reads the latch before `publish`, makes the outcome `yielded`, and writes `notBefore` by §5.3's after-a-429 row, whatever bound ended the chunk. The next chunk's governor starts with no latch, so that chunk's first 2xx pricing search can probe again.
- Each settle prints exactly one §13.5 line through the shell's `stderr`, with the shell prefix, at the moment it settles. A process that ends while the holder is still `unsettled` settles `not-probed` and prints that line: the `pnpm sync` session does this before `stopped`, and `sync:batch` does it after its chunk, on success and on a throw.
- `session-probe` joins `RequestSourceSchema` and the chunk sources, so `sync-report.json` goes to `1.2.0`. The writer always writes the key. A reader accepts a `1.1.0` report that has no `session-probe` key and reads its count as 0. `web` does not render the count.
- Every error the governor passes on, the probe error included, is redacted through the holder (§13.6). The canary test covers the new paths.

**Never:**
- Story 3's work: no downgrade, no liveness test on responses after the probe, no hold-off read or write, no `held-off` reason, and no change to `sync-progress.json` or its schema version. The holder records no pending hold-off action in this story.
- A rule name, a rule count or a bucket in code. The predicate compares only the counts of the two headers (`test/no-hardcoded-rate-limits.test.ts`).
- An auth field in `SyncRunReport`. A change to the exit code because of the cookie.
- A cookie on a request from `catalogue:refresh`, `fixtures:record` or `sync:dry`. A change to committed fixtures.

## I/O & Edge-Case Matrix

| Scenario | Probe answer | State, line | Later pricing requests |
|----------|--------------|-------------|------------------------|
| Live | 2xx, more rule names than the baseline | `authenticated` | carry `Cookie` |
| Not elevated | 2xx, same or fewer rule names | `unauthenticated (not-elevated)` | no `Cookie` |
| Rejected | 401, 403 or 400 | `unauthenticated (probe-rejected)`, no invalid-request count, no malformed abort | no `Cookie`, pricing continues |
| Failed | 503, a throw, or a `TimeoutError` | `unauthenticated (probe-failed)` | no `Cookie`, entry continues to its fetch |
| Penalty | 429 with `Retry-After` | no line yet. The fetch yields 429 with no send. `notBefore` is persisted, also when the entry has no fetch (0 results). | the next chunk probes again |
| No 2xx search | the baseline gets a 429, a 5xx or a throw, or no entry is attempted | no probe; at process end, `unauthenticated (not-probed)` | — |
| Baseline 4xx | the baseline gets a non-429 4xx | no probe; the existing malformed abort | — |

</frozen-after-approval>

## Code Map

- `packages/sync/src/trade/session-auth.ts` -- `SessionAuth` keeps `#state` as `readonly`. Make it mutable through a narrow API. `createSessionAuth(env)` gets an optional `onSettle(line)` listener. `authLine`/`describeState` produce the line. `redact` stays as it is. The story 1 header says "probe belongs to the next stories": update it.
- `packages/sync/src/trade/rate-limit-headers.ts` -- `RULES_HEADER` is defined here but not exported. Add the names-count helper here (trimmed, case-folded, non-empty, a set, case-insensitive header lookup).
- `packages/sync/src/trade/client.ts` -- `TradeRequest` (add the cookie-eligibility marker). `headersFor` is the attach point. `TradeGovernorOptions.auth?: SessionAuth` changes to a holder plus a probe `HttpPort`. Inside `createTradeGovernor`, `exchange` sends, folds the ledger, counts invalids and builds the 429 yield. The probe sits between the 2xx baseline and the return. `redacted` wraps `exchange`. `TradeGovernor` exposes the latch.
- `packages/sync/src/pricing/price-entry.ts` -- in `createPricingStep`, the search `client.send` (POST, `SEARCH_LANE`) and the fetch (GET, `FETCH_LANE`) get the marker. `sendLeg` already maps a 429 yield to `retryAfterMs`.
- `packages/sync/src/league/league-gate.ts` -- the league request. It stays unmarked. Do not change it.
- `packages/sync/src/compose-chunk.ts` -- `composeChunk` builds the governor with `requests.counted(http, …)`. Add `requests.counted(http, 'session-probe')` as the probe port. Pass the governor's latch into `ChunkPorts`.
- `packages/sync/src/chunk/run-chunk.ts` -- `ChunkPorts`. The step loop sets `ending`/`until` from a yielded step (`notBeforeAfter429`), then `publish(…, until)`. Apply the latch just before `publish`. The gate-yield path and the failure paths stay as they are.
- `packages/contracts/src/sync-run-report.ts` -- `RequestSourceSchema`, `ChunkRequestSourceSchema` (`z.record` over an enum requires every key), `dropLegacyRequestSource` (the preprocess to extend), `SYNC_REPORT_SCHEMA_VERSION`. `packages/sync/src/chunk/sync-report.ts` `chunkRequests` fills zeros from the enum.
- `packages/sync/src/sync.ts` `syncSessionCommand`, `packages/sync/src/sync-batch.ts` `syncCommand` -- story 1 builds the holder and prints its line. Wire `onSettle`, and settle `not-probed` at process end.
- Tests to extend: `trade/client.test.ts`, `trade/session-auth.test.ts`, `pricing/price-entry.test.ts`, `chunk/run-chunk.test.ts`, `sync.test.ts`, `sync-batch.test.ts`, `session-auth.canary.test.ts`, and the contracts report tests. `createFakeHttpPort` (`@poe/contracts`) records request headers. Exact `requestsBySource` assertions in `dry-run*.test.ts`, `sync*.test.ts` and `run-chunk.test.ts` gain `'session-probe': 0`.
- Do not change `test/fixtures/frozen-data/sync-report.json` or `data/sync-report.json`. They stay `1.1.0`, and the reader must accept them.

## Tasks & Acceptance

**Execution:**
- [x] `packages/sync/src/trade/rate-limit-headers.ts` -- export `ruleNameCount(headers)`, the size of `names(X-Rate-Limit-Rules)` (§13.2).
- [x] `packages/sync/src/trade/session-auth.ts` -- add `canProbe` (unsettled and a value is kept), `isAuthenticated`, `withCookie(headers)` (adds `cookie: POESESSID=<value>`), `settle(reason | 'authenticated')` (a no-op unless unsettled; it calls `onSettle(authLine)` once) and the optional `onSettle` on `createSessionAuth`.
- [x] `packages/sync/src/trade/client.ts` -- add the marker on `TradeRequest`. The `auth` option becomes `{ holder, probe: HttpPort }`. The probe follows the outcome rows. Attach after `authenticated`. Add the 429 latch and the next-send yield, and expose `latchedRetryAfterMs()`. Redact the probe error.
- [x] `packages/sync/src/pricing/price-entry.ts` -- mark the search and the fetch.
- [x] `packages/sync/src/compose-chunk.ts`, `packages/sync/src/chunk/run-chunk.ts` -- add the `session-probe` probe port and an optional `ChunkPorts.latchedRetryAfterMs`. The runner applies it before `publish`.
- [x] `packages/contracts/src/sync-run-report.ts` (+ tests) -- add the `session-probe` source and version `1.2.0`. A `1.1.0` body with no key parses, and its count reads as 0. Update the comment that says "three sources".
- [x] `packages/sync/src/sync.ts`, `packages/sync/src/sync-batch.ts` -- wire `onSettle` with the prefix, and settle `not-probed` at process end.
- [x] Tests: unit-test every matrix row on the governor. Test the CAP-1 request order (baseline without the cookie, probe with it, then fetch and later searches with it, and the league request without it) through both shells. Test that each CAP-2 probe case prints exactly one line, and that the exit code is unchanged. Test that the `session-probe` count is in the report. Test that a probe 429 on an entry with 0 results persists `notBefore`. Extend the canary: the probe and a later fetch throw errors that quote the request's `cookie` header (message, stack, cause). Test that the probe error does not reach the caller.

**Acceptance Criteria:**
- Given a live cookie under `pnpm sync`, when the session runs three chunks, then exactly one probe is sent, exactly one `authenticated` line prints, and the report's `session-probe` count for the pass is 1.
- Given any `POESESSID`, when `pnpm test` runs, then `test/no-hardcoded-rate-limits.test.ts`, `test/contracts-isolation.test.ts` and `test/session-cookie-shells.test.ts` pass.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Finding (source) | Verdict | Evidence | Route |
|---|------------------|---------|----------|-------|
| 1 | A latched probe 429 is lost when the chunk ends on a throw (edge, verification) | medium | `run-chunk.ts` catch path publishes `rejected ? abort : undefined`. A 2xx baseline with a body `parseSearchAnswer` rejects, plus a probe 429, throws `UnexpectedTradeResponseError` after the latch, so `notBefore` is cleared and the next run sends into the penalty. | patch |
| 2 | `pnpm sync` settles `not-probed` only on a normal loop exit (edge, blind) | low | `pendingNotBefore`/`runWait` sit outside the per-chunk `try`; a throw there ends the process unsettled with no line, which the intent requires. `sync:batch` already uses `finally`. | patch |
| 3 | `authLine` is dead production code (edge, blind, verification) | low | Only `session-auth.test.ts` imports it; both shells now print through `onSettle`. | patch |
| 4 | `until` doc comment in `runChunk` says "set only by a step's 429" (blind) | low | The latch block now also sets it. | patch |
| 5 | The 2xx range check is written twice in `client.ts` (blind) | low | The probe trigger and the probe rows can drift apart; `isInvalidRequest` already exists for 4xx. | patch |
| 6 | Double blank line before `ruleNameCount` (blind) | low | Present in the diff. | patch |
| 7 | `searchRemaining` omits the probe's search (edge, verification, implementer) | low | Real: one search optimistic in the chunk that probes, once per process. Rejected: the intent makes the baseline's answer the step's result, and the fix adds a branch. | reject |
| 8 | An aborted probe settles `probe-failed` (edge) | false | The intent maps every probe throw to `probe-failed`. | reject |
| 9 | A probe 4xx is not counted toward the invalid-request threshold (edge) | false | The intent says the probe never adds to the invalid-request count. | reject |
| 10 | An `onSettle` throw in `sync-batch` `finally` replaces the exit code (edge) | false | `onSettle` is the shell's `stderr` writer; no reachable throw was shown. | reject |
| 11 | The probe could fire on a fetch (blind) | false | Each chunk sends a search before its fetch; a 2xx search either probes (settling the holder) or latches, and a latched fetch sends nothing. A fetch is never the first 2xx marked request while `canProbe`. | reject |
| 12 | `withCookie` has no state check (blind) | low | Only the governor holds the holder; `test/session-cookie-shells.test.ts` limits importers. Rejected: unlikely to be met, and the fix adds a guard. | reject |
| 13 | The reader fills `session-probe: 0` for any version (blind) | low | A 1.2.0 writer always writes the key (writer tests). Rejected: the fix adds version branching to a schema-level preprocess. | reject |
| 14 | A 3xx probe and a probe 429 without `Retry-After` are untested (blind) | low | `penaltyOf` is shared with the tested main 429 path; fetch follows redirects. Rejected: unlikely, and the fix adds tests for unreachable paths. | reject |
| 15 | No log line for a failed probe (blind) | low | The settle line names `probe-failed`; §13.5 sets one line per settle. Rejected: adds behaviour that the intent does not ask for. | reject |
| 16 | Weak `not-probed`-before-`stopped` and canary `pnpm sync` assertions (blind) | low | The verification layer confirmed the ordering is covered. Rejected: negligible. | reject |
| 17 | No test that `web` hides a non-zero count (blind) | low | `trust-facts.ts` reads the two old keys by name. Rejected: unlikely to regress silently, and the fix adds tests. | reject |
| 18 | Long lines may fail `pnpm lint` (blind) | false | `pnpm lint` passes with `--max-warnings=0`. | reject |
| 19 | Story notes sections are empty (blind) | — | The fix edits this build's spec. | reject |

## Design Notes

The probe is inside the governor, not the pricing step. That keeps AD-30's "only the governor attaches" literal, and the step's result is always the baseline. The governor reads the marker instead of guessing from the method or the lane, because lanes are opaque (AD-8). A per-chunk governor holds the latch, and the holder holds the state for the whole process. So a probe 429 makes the next chunk probe again, and a settled state never probes again.

## Verification

**Commands:**
- `pnpm test` -- expected: all pass, root guards included.
- `pnpm typecheck` -- expected: no errors.
- `pnpm lint` -- expected: no errors.
