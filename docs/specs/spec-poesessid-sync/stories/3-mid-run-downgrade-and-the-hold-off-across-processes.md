---
title: 'Mid-run downgrade and the hold-off across processes'
type: 'feature'
created: '2026-10-03'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '7654dfe73bfa9a0d56b7811441a7787b8b84a28f'
context:
  - '{project-root}/docs/specs/spec-poesessid-sync/SPEC.md'
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** After story 2, an `authenticated` holder keeps the cookie on every request, even after the cookie stops working. Every run also sends a new probe, so a dead cookie costs a counted request on each scheduled run.

**Approach:** The governor tests each response to a request that carried the cookie. A 401, a 403 or a `tested` not-live 2xx is a downgrade (§13.2, §13.4). The governor drops the cookie, resets the process pacing state to cold in place, settles the holder `expired` and returns a `session-expired` yield with no response. The pricing step treats that yield as AD-9's request with no answer. The holder records a pending hold-off `write` or `clear` for each settle. The runner applies the action in the chunk's `sync-progress.json` write (`1.2.0`, `authHoldOffUntil`). After the lock and the `notBefore` check, the runner settles a valid value as `held-off` while the hold-off is due (AD-30, AD-7, AD-8, §13.1, §13.3, §13.4, §13.7).

## Boundaries & Constraints

**Always:**
- The state moves only from `unsettled`, and from `authenticated` to `expired`. No other transition exists. Each move prints exactly one §13.5 line through `onSettle`.
- The liveness test after the probe uses the baseline's rule count and policy. The holder keeps both for the whole process, because a governor lives for one chunk. The test applies only to a response under the baseline's policy (§13.2 `tested`), and it compares counts only.
- Downgrade order (§13.4): drop the cookie, reset the pacing state, record the hold-off `write`, return the yield. The yield has no `retryAfterMs` and no response. The downgrading 401 or 403 does not add to the invalid-request count. A 429 or a 5xx on a cookie request stays an ordinary 429 or 5xx.
- The pacing reset keeps the same `PacingState` object (the ledger and the lane memo). The `pnpm sync` session does not treat the reset as a fresh State reading. After a `session-expired` ending it waits `backoff(1)`.
- A downgraded search stamps `lastAttemptedAt` and keeps the entry's earlier search fields. A downgraded fetch keeps the search fields from that entry's search. The price state does not change. The chunk ends `yielded` with no `notBefore`. `sync:batch` exits 0.
- `authenticated` records `clear`. `not-elevated`, `probe-rejected` and `expired` record `write`. A `write` sets `authHoldOffUntil = now + 24h`, with `now` at the time of the progress write. A `clear` removes the field. Every other progress write carries the loaded value forward. The holder keeps a pending action until a progress write applies it. A deferred, busy or dispossessed ending applies none.
- `held-off`: after the lock and the `notBefore` check, when the holder can still probe and `now < authHoldOffUntil`, the runner settles `held-off`. That run sends no probe.
- `sync-progress.json` goes to `1.2.0`. The reader still accepts `1.1.0` files.
- Every new throw path is redacted through the holder, and the canary test covers it.

**Never:**
- A cookie on any request after a downgrade, in this chunk or a later chunk of the process.
- The cookie value, or any part of it, in `sync-progress.json` or the report. A report field or record for auth.
- A rule name, a rule count or a bucket in code (`test/no-hardcoded-rate-limits.test.ts`).
- The runner or the pricing step importing `session-auth.ts`. They see narrow structural ports wired in `compose-chunk.ts`.
- A body or `cf-mitigated` check. Every 401 and 403 is the same.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior |
|----------|--------------|---------------------------|
| Expired, 401 or 403 | authenticated; a cookie search or fetch gets a 401 or 403 | one `unauthenticated (expired)` line; cold pacing; entry stamped; `yielded`, no `notBefore`; hold-off written; no later `Cookie` |
| Expired, 2xx | authenticated; a `tested` cookie 2xx (§13.2) has no more rule names than the baseline | same as above, and the answer is discarded |
| Still live | authenticated; a `tested` cookie 2xx is live | no line; the answer is used |
| Not tested | authenticated; a cookie 2xx is not `tested`, for example a fetch under its own policy | no line; the answer is used (§13.4) |
| Cookie 429 or 5xx | authenticated | the existing 429 or no-answer yield; no downgrade |
| Held off | valid value; `now < authHoldOffUntil` | `unauthenticated (held-off)`; no probe; the field is unchanged |
| Hold-off past | valid value; `now >= authHoldOffUntil` | probes; `live` clears the field |
| Probe rejected or not elevated | story 2 rows | the hold-off is written by the chunk's progress write |
| Absent, malformed, probe-failed, probe 429, not-probed | — | the field is carried forward unchanged |
| Session after expiry | `pnpm sync` | waits `backoff(1)`, the next chunk sends no cookie and no probe |

</frozen-after-approval>

## Code Map

- `packages/sync/src/trade/session-auth.ts` -- `SessionAuth` (L124): `settle` no-ops after `unsettled` (L176-183). Add `expire()` (authenticated → `expired` only), a stored baseline rule count, the pending hold-off action and a way to take it, and a `held-off` settle. `SessionAuthReason` already has `held-off` and `expired`. Update the header comment at L22-23.
- `packages/sync/src/trade/client.ts` -- `outboundHeaders` (L517-522) attaches the cookie. `probe()` (L576-622) gives the baseline count at L611. `exchange()` (L630-724): the generic `kind:'response'` return is at L715, and the 4xx invalid count is at L684-686. Add the downgrade before both. Add `'session-expired'` to `TradeYieldReason` (L157). `penaltyRetryAfterMs` (L188) must return `undefined` for it. `PacingState` (L397) and `createPacingState` (L403) need an in-place reset. `fold()` (L540) replaces `pacing.ledger`. `redacted()` (L729).
- `packages/sync/src/pricing/price-entry.ts` -- `sendLeg` (L206-228) maps a client yield through `penaltyRetryAfterMs`. With no `retryAfterMs`, the search yield returns `stamped` (L310) and the fetch yield returns `searched` (L343). Check that this already holds. Change it only when it does not.
- `packages/sync/src/chunk/run-chunk.ts` -- `ChunkPorts` (L287 has `latchedRetryAfterMs?`). Run start loads `PROGRESS_PATH` and checks `notBefore` (L528-573). Put the held-off settle after that check. `publish` (L672-702) writes `{schemaVersion, completed, notBefore?}`. Add the carried or applied `authHoldOffUntil`. The step-yield path is at L835-840. Report to the session that the ending was `session-expired`.
- `packages/sync/src/compose-chunk.ts` -- L116-134 builds the governor. L169 wires the latch. Wire the holder into the new narrow ports here (a type import only).
- `packages/sync/src/sync.ts` -- `nextWait` (L244, the yielded case L275-283), `backoffCountFor` (L223), `freshReading` (L573/L604, a reference compare on `pacing.ledger`), `sessionEvenIntervalMs` (L369). After `session-expired`, wait `backoff(1)`.
- `packages/sync/src/sync-batch.ts` -- `syncCommand` (L68) already exits 0 on a yield. No change is expected.
- `packages/contracts/src/sync-progress.ts` -- `SyncProgressSchema`. Add `authHoldOffUntil?: IsoTimestamp`. `SYNC_PROGRESS_SCHEMA_VERSION` changes to `'1.2.0'`. The envelope is `envelopes.ts` L243. The version asserts are in `sync-progress.test.ts` L55 and `index.test.ts` L63.
- Tests: `trade/client.test.ts` `probeHarness` (L859-916), `trade/session-auth.test.ts`, `chunk/run-chunk.test.ts`, `pricing/price-entry.test.ts`, `sync.test.ts`, `sync-batch.test.ts`, `session-auth.canary.test.ts`. `createFakeHttpPort` from `@poe/contracts`.
- Do not change `test/session-cookie-shells.test.ts` allow-lists, `league-gate.ts` or committed fixtures.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/sync-progress.ts` (+ tests) -- add `authHoldOffUntil` and version `1.2.0`. A `1.1.0` body parses.
- [x] `packages/sync/src/trade/session-auth.ts` (+ tests) -- `expire()`, the baseline count, the pending action from each settle, `held-off`.
- [x] `packages/sync/src/trade/client.ts` (+ tests) -- the post-probe liveness test, the §13.4 downgrade, the `session-expired` yield, and the in-place pacing reset.
- [x] `packages/sync/src/chunk/run-chunk.ts`, `packages/sync/src/compose-chunk.ts` (+ tests) -- the held-off settle at run start, the write, clear or carry of the hold-off in `publish`, and the `session-expired` ending signal.
- [x] `packages/sync/src/sync.ts` (+ tests) -- `backoff(1)` after `session-expired`, with no fresh reading.
- [x] `packages/sync/src/pricing/price-entry.ts` (+ tests) -- the no-answer mapping of `session-expired` for a search and a fetch, with the search fields kept.
- [x] Shell tests -- CAP-3 and CAP-5 through both shells. Extend the canary test with a downgrade path.

**Acceptance Criteria:**
- Given a live cookie under `pnpm sync`, when the second chunk's fetch gets a 403, then exactly one `expired` line prints, `sync-progress.json` holds `authHoldOffUntil = now + 24h`, and no later request of the process carries `Cookie`.
- Given that hold-off, when `sync:batch` runs within 24h, then it prints `unauthenticated (held-off)`, sends no `session-probe` request, exits 0 and leaves the field unchanged.
- Given any `POESESSID`, when `pnpm test` runs, then the root guards pass.

## Implementation Notes

- The holder keeps the baseline rule count (`rememberBaseline`, set at the probe), the pending hold-off action (`pendingHoldOff` / `holdOffApplied`, cleared only after the progress write succeeds) and `expire()` / `settleHeldOffIfDue`. The governor keeps a per-chunk `cookieDropped` flag so the §13.4 order is literal: drop, `resetPacingState`, `holder.expire()`, yield.
- The `session-expired` yield carries `retryAfterMs: 0` (the field is required on `TradeYieldResult`, as for the threshold refusal); `penaltyRetryAfterMs` answers `undefined`, so no `notBefore` is written.
- The signal travels as `sessionExpired: true` on the pricing step's yield (`StepResult`) and then on the `yielded` `ChunkOutcome`. `sync.ts` reads it with `isSessionExpired`: no fresh reading, and the backoff count is 1.
- `run-chunk.ts` sees `ChunkAuth` (three narrow functions) wired in `compose-chunk.ts`; the hold-off length is `AUTH_HOLD_OFF_MS` in `run-chunk.ts`.

## Spec Change Log

- 2026-10-04, poesessid retro item 2 (finding R3), sanctioned by the operator: the Approach and the I/O matrix rows "Expired, 2xx" and "Still live" now limit the 2xx liveness test to a `tested` response, and a "Not tested" row is added. This reconciles them to spine rev 28 (0ce556e), which had already edited the Always line on the liveness test. The rows had described every cookie 2xx, so a fetch read as tested against the search baseline. KEEP: the "Expired, 401 or 403" row, which still holds for a search and a fetch. This also answers Review Triage Log row 2: a fetch 2xx is not `tested`.
- 2026-10-03, 0ce556e (spine rev 28), recorded 2026-10-04 by retro finding R4: the Always line on the liveness test was edited inside the frozen block to keep the baseline's policy and apply the test only to a `tested` response. The operator ruled the edit sanctioned (retro O2).

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | verification-gap | No test proves a pending hold-off survives a failed progress write | medium | Pre-verified: no hold-off test makes the `PROGRESS_PATH` write fail; moving `holdOffApplied` above the write passes every test. | patch |
| 2 | blind, edge-case | Fetch 2xx answers are tested against the search baseline's rule count | maybe-false | The code follows §13.2/§13.4 as written; whether a live fetch carries fewer rule names than a search needs a live recording. | defer (NOTE FOR ARCHITECT) |
| 3 | blind | The `session-expired` yield carries `retryAfterMs: 0` though the frozen spec says none | low | The field is required on `TradeYieldResult`; the threshold yield uses `0` the same way; `penaltyRetryAfterMs` returns `undefined`, and the only direct readers (`catalogue-refresh.ts`, `fixtures-record.ts`) never send a cookie. Fix would change a shared type. | reject |
| 4 | blind | Sync-report fixtures in `run-chunk.test.ts` bumped `1.1.0` → `1.2.0` | low | Confirmed: objects with `runStartedAt`/`figures` changed, so an older report is no longer read there. Direct revert. | patch |
| 5 | blind | `held-off` lasts the whole `pnpm sync` session | false | The frozen Boundaries allow moves only from `unsettled` and `authenticated → expired`; the run-start check is the only held-off entry point by design. | reject |
| 6 | blind, edge-case | `authHoldOffUntil` has no upper bound | low | A future value needs a hand edit or a clock moving back; §13.3 lets the operator remove the field. Fix adds a guard. | reject |
| 7 | blind | `sync.ts` handles `session-expired` in four places | low | Redundant on the live path, but keeps `nextWait`/`nextState` correct for any context; no caller diverges. | reject |
| 8 | blind | `expire()` result ignored; `cookieDropped` duplicates holder state | false | The pricing step awaits each leg and the runner steps entries in turn, so two cookie requests are never in flight together. | reject |
| 9 | blind | No shell-level test of a downgrade on the cookie search | low | Search and fetch take the same `exchange` path; the search case is covered in `client.test.ts` and `price-entry.test.ts`. Fix adds a test and no fault was shown. | reject |
| 10 | blind | Deferred-run hold-off assertion cannot fail | low | Confirmed: `toMatchObject` reads back the seed. Direct correction. | patch |
| 11 | blind | `pnpm sync` canary downgrade does not prove the progress write was scanned | low | Confirmed: the batch variant checks `authHoldOffUntil`, the session variant does not. Direct correction. | patch |
| 12 | blind | Held-off settle runs before the report read | low | A refused report read ends the run; the printed `held-off` line is still true. The spec's order (after the lock and `notBefore`) holds. | reject |
| 13 | blind | Broken line wrap in the `SYNC_PROGRESS_SCHEMA_VERSION` comment | low | Confirmed. Direct correction. | patch |
| 14 | blind | `AUTH_HOLD_OFF_MS` lives apart from `HoldOffAction` | false | One constant owns the length; no second copy exists to diverge. | reject |
| 15 | ledger | — | — | No carved-out item; no entry needed. | none |

## Design Notes

The holder owns everything that lives for the process: the state, the baseline count and the pending action. The governor lives for one chunk and keeps none of them. The runner sees two narrow ports, "settle held-off if due" and "take the pending action". So `run-chunk.ts` stays out of the import guard. `freshReading` compares `pacing.ledger` by reference, and the reset assigns a new empty ledger. So the session needs an explicit `session-expired` signal on the outcome. Do not infer the expiry from the ledger.

## Verification

**Commands:**
- `pnpm test` -- expected: all pass, root guards included.
- `pnpm typecheck` -- expected: no errors.
- `pnpm lint` -- expected: no errors.
