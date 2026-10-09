---
title: 'Epic 1 retro item 10: a loopback-server test for createFetchHttpPort'
type: 'chore'
created: '2026-09-26'
status: 'done'
baseline_revision: 'e1084a38c466ba32f47c4a61384f7375da379143'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** No test runs the real `HttpPort` (`createFetchHttpPort`, `packages/sync/src/shell.ts:44–62`) or `isTransportFailure` (`packages/sync/src/trade/transport-failure.ts:16`). The yield-on-timeout contract (AD-8) rests on two untested literals: `error.name === 'TimeoutError'` and undici's `TypeError` message `'fetch failed'`. A Node upgrade that changes either one turns every network failure into an unrecoverable throw, and no test fails (epic-1-retro-item-10, L-V1).

**Approach:** Add one test file that starts a `node:http` server on `127.0.0.1` port 0. The file runs the real port against that server and puts each rejection through `isTransportFailure`. `test/setup.ts` already lets loopback through, so NFR-1 is unchanged. The port takes an optional timeout so the test does not wait 30 s. The "names the real fetch port in no test file" scan now exempts only this one file.

## Boundaries & Constraints

**Always:** Only `127.0.0.1` URLs from a server that the test itself started. Close every server and connection in `afterEach`. The production callers keep calling `createFetchHttpPort()` with no argument, and the default stays `REQUEST_TIMEOUT_MS`. The scan in `catalogue-refresh.test.ts` stays in force for every other test file. Its comment states the new property: the real port runs only against loopback, and only in the exempt file.

**Never:** No change to `test/setup.ts` or to its loopback exemption. No change to `isTransportFailure`'s predicate: this item tests it and does not redesign it. No non-loopback host. No fake timers standing in for `AbortSignal.timeout`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Round trip | POST with headers and body to a server that answers 201, a mixed-case header and a body | The server receives the method, the headers and the body. The port resolves `{status: 201, headers}` with the header names in lower case, and the body as text | No error expected |
| Timeout | The server accepts the request and never answers. The port has a short timeout (for example 100 ms) | `send` rejects. The rejection's `name` is `'TimeoutError'`, and `isTransportFailure` returns `true` | This rejection yields the chunk |
| Connection refused | A loopback port whose server is closed | `send` rejects with a `TypeError`. The message is `'fetch failed'`, and `isTransportFailure` returns `true` | This rejection yields the chunk |
| Socket reset | The server destroys the socket before it answers | Same as connection refused | This rejection yields the chunk |

</intent-contract>

## Code Map

- `packages/sync/src/shell.ts` -- `createFetchHttpPort` (:44), `REQUEST_TIMEOUT_MS` (:26). The module header (:11–17) and the JSDoc (:40–43) say "no test executes" the port. Both need rewording.
- `packages/sync/src/trade/transport-failure.ts` -- `isTransportFailure`. Read-only. Its callers are `league/league-gate.ts:126` and `pricing/price-entry.ts:202`.
- `packages/sync/src/catalogue-refresh.test.ts:275–303` -- the scan `names the real fetch port in no test file`. Today it exempts only itself.
- `packages/sync/src/shell.test.ts:16–28` -- its header says the port "must stay absent" from every test. Reword it to point at the new file.
- `packages/sync/src/{sync,catalogue-refresh,fixtures-record}.ts` -- the callers of `createFetchHttpPort()`, with no argument. They do not change.
- `test/setup.ts:46–50` -- `LOOPBACK_HOSTS` and `isNonRemote`. A loopback request passes through MSW. The test adds no MSW handlers.
- Runtime: Node v24.21.0, Vitest project `sync` (`packages/sync/vitest.config.ts`).

## Tasks & Acceptance

**Execution:**
- `packages/sync/src/shell.ts` -- Change the signature to `createFetchHttpPort(options: { timeoutMs?: number } = {})`, with `timeoutMs` defaulting to `REQUEST_TIMEOUT_MS`. Reword the header and the JSDoc: the port is tested only against a loopback server, in the one exempt file. -- The test needs the timeout seam, and the comments must not go stale.
- `packages/sync/src/shell-fetch.test.ts` -- New. Test the four rows of the I/O matrix against a `node:http` server that the test starts. -- This closes L-V1.
- `packages/sync/src/catalogue-refresh.test.ts` -- Exempt `shell-fetch.test.ts` in the scan as well, and rewrite its comment to state the narrowed property. -- Without this exemption the new test is illegal.
- `packages/sync/src/shell.test.ts` -- Reword the header so it matches the new rule. -- Otherwise the comment is stale.

**Acceptance Criteria:**
- Given the full suite, when `pnpm test` runs, then `shell-fetch.test.ts` passes and the no-network guard records no escaped request.
- Given a test file other than `shell-fetch.test.ts` that names `createFetchHttpPort`, when the scan runs, then the scan fails.
- Given a mutated `isTransportFailure` (either literal changed), when `shell-fetch.test.ts` runs, then at least one test fails.

## Spec Change Log

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 19 findings — high 0, medium 3, low 11, false 5, maybe-false 0
- findings:
  - `[low]` `[reject]` (edge) `timeoutMs` accepts a negative value, NaN or Infinity, and `AbortSignal.timeout` then throws a RangeError that is not a transport failure. — Only the test passes `timeoutMs`, and every production caller passes nothing. A bad value fails loudly at request time. A guard would add a branch for a state no caller reaches.
  - `[low]` `[reject]` (edge) The connection-refused case can race another process for the freed ephemeral port. — The OS hands out ephemeral ports in rotation, so an immediate rebind by another process is improbable. A reserved-port scheme would make the test more complex than the risk warrants.
  - `[low]` `[patch]` (edge) The round-trip handler's `readBody(...).then` has no rejection handler, so a stream error hangs the test. — Fixed: the rejection handler now destroys the response.
  - `[low]` `[patch]` (edge) The lower-case header assertion cannot fail on the port's own `.toLowerCase()`, because undici already lower-cases names. — Fixed: the test name and a comment now say the assertion pins the output contract, not the port's call.
  - `[false]` `[reject]` (blind) No test checks that `isTransportFailure` returns false. — Refuted: `price-entry.test.ts:352` and `league-gate.test.ts:161` rethrow a non-transport rejection. A predicate mutated to `return true` fails both.
  - `[medium]` `[patch]` (blind) The timeout of the body-read phase (`response.text()` under the same signal) is untested. — Fixed: a new case sends headers and a partial body and then stalls. The runtime rejects with `TimeoutError`, and `isTransportFailure` returns true.
  - `[low]` `[reject]` (blind) The refused case races for the port, and its handler's `throw` is not a clean failure. — The race is the same finding as the edge row above, rejected for the same reason. Vitest reports an uncaught exception in a handler as a run error, so the `throw` still surfaces.
  - `[low]` `[patch]` (blind) The lower-casing claim proves nothing, and multi-value headers and a request with no body are not covered. — Patched together with the edge lower-case row. A GET with no body is already covered by the three rejection cases. Multi-value headers are rejected: they are not on the port's contract surface.
  - `[low]` `[reject]` (blind) The non-timeout cases run with the 30 s default, so a hang shows as a vague Vitest timeout. — The result is still a failing test, and only the message is less precise. The default is kept on purpose so that the default path runs, and the new spy test now pins it.
  - `[low]` `[patch]` (blind) The scan exemption goes dead with no failure if `shell-fetch.test.ts` is renamed or deleted. — Fixed: the scan now asserts that the file is present and names the port.
  - `[false]` `[reject]` (blind) "Only against loopback" is claimed but not enforced. — Refuted: the MSW `onUnhandledRequest` callback in `test/setup.ts` throws for every non-loopback host. `localhost` and `::1` are loopback too, so the wording is accurate.
  - `[low]` `[reject]` (blind) The `timeoutMs` seam widens the API and has no validation. — This is the same claim as the edge `timeoutMs` row, rejected for the same reason. The seam is in the spec, and `dist/` is gitignored.
  - `[low]` `[reject]` (blind) The spec's line citations are stale after the diff. — The fix would edit this build's spec.
  - `[low]` `[patch]` (blind) `sprint-status.yaml` still says `open`, and one comment line in `shell.ts` is unwrapped. — Fixed: item 10 is now `done` and its `ref` points at this spec. The comment line was rewrapped before review, at step-03 verify.
  - `[medium]` `[patch]` (verification-gap) No test pins that `createFetchHttpPort()` with no options uses `REQUEST_TIMEOUT_MS`. — Fixed: a new case spies on `AbortSignal.timeout` without replacing it and asserts the call with `REQUEST_TIMEOUT_MS`.
  - `[false]` `[reject]` (intent) The yield is observed only through the predicate, not at the caller or runner. — Refuted as a gap: `trade/client.ts` passes port rejections through unchanged, and the callers' yield-on-true is covered by `league-gate.test.ts:154` and by the transport tests in `price-entry.test.ts`. The retro row names the port and the predicate as the surface.
  - `[false]` `[reject]` (intent) The production signature changed, and no test runs the default timeout. — The spec sanctions the seam. The default is now pinned by the spy test (the verification-gap row).
  - `[medium]` `[patch]` (intent) The timeout is pinned only for the stall before headers. — This is the same root cause as the blind body-read row, and that fix covers it.
  - `[false]` `[reject]` (intent) The scan enforces who may name the port, not which host it reaches. — By design: the MSW guard enforces the host for every file, and the scan enforces the naming. The Design Notes record this split.

## Design Notes

The retro names the upstream fault. The rule "never name the real port in a test" was written to contain the refresh command, and it was later generalised into "never test the real port". The property worth keeping is that `fetch` never reaches a remote host from a test. The MSW guard already enforces that property for every file, this one included. A single named exemption keeps the scan's intent and makes the gap closable.

## Verification

**Commands:**
- `pnpm exec vitest run --project sync packages/sync/src/shell-fetch.test.ts packages/sync/src/catalogue-refresh.test.ts` -- expected: all pass.
- `pnpm check` -- expected: pass.
- `pnpm test` -- expected: pass.

## Auto Run Result

Status: done

**Summary:** The real `createFetchHttpPort` now runs in one test file, against a `node:http` server on `127.0.0.1` that the test starts. The file pins the runtime rejections that the AD-8 yield depends on. `TimeoutError` is pinned both before the headers and during the body read. `TypeError('fetch failed')` is pinned on a refused connection and on a socket reset. Each rejection is checked through `isTransportFailure`. The port gained an optional `timeoutMs`, which defaults to `REQUEST_TIMEOUT_MS`. A spy test pins that default. The rule that no test may name the port now exempts exactly one file, and the scan fails if that file disappears.

**Files changed:**
- `packages/sync/src/shell.ts`: the optional `timeoutMs` seam, plus reworded module and JSDoc comments.
- `packages/sync/src/shell-fetch.test.ts`: new. Six loopback cases: round trip, default timeout, hang, stalled body, refused and reset.
- `packages/sync/src/catalogue-refresh.test.ts`: the scan exempts `shell-fetch.test.ts` and asserts that the file exists and names the port.
- `packages/sync/src/shell.test.ts`: header comment reworded.
- `docs/stories/sprint-status.yaml`: item 10 is `done`, with its `ref` pointing at this spec.

**Review:** 19 findings. 7 rows were patched; they form 6 root-cause entries (medium 2, low 4). Nothing was deferred. 12 rows were rejected (low 7, false 5), each with its reason in the Review Triage Log above.

**Follow-up review recommended:** false. Two medium entries were patched, the body-read timeout and the default timeout pin. Both are test additions that ran green in the full suite, and they themselves close the gaps. No unverified risk remains for a further review to target. Patched counts: high 0, medium 2, low 4.

**Verification:** `pnpm check` passed (typecheck, eslint with zero warnings, depcruise). `pnpm test` passed: 59 files, 694 tests, no escaped request. The implementer ran a mutation check: changing `'TimeoutError'` failed 1 test, and changing `'fetch failed'` failed 2 tests. A probe test file that named the port failed the scan.

**Residual risks:** The suite was verified only on Windows with Node v24.21.0. The `'fetch failed'` message is undici's own string. A future Node or undici release that changes it now fails this suite, and that failure is the intended signal. It is not a flake. The existing `deferred-work.md` entry from the spec 1.4 review names two gaps. This item closes the "real `createFetchHttpPort` exercised by nothing" part only. The two-run idempotence check stays open, and only `deferred-work-sweep` may change that entry.
