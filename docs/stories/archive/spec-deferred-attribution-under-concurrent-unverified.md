---
title: 'deferred-attribution-under-concurrent-unverified: prove the no-network guard charges concurrent tests correctly'
type: 'chore'
created: '2026-09-26'
status: 'done'
baseline_revision: '80c6a6b183079cf1ed89ecbeacecf5ae7c375e1a'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The no-network guard in `test/setup.ts` charges each escaped request to the test in its `AsyncLocalStorage` store, which each `beforeEach` sets with `enterWith`. Under `it.concurrent` / `describe.concurrent` the `beforeEach` hooks of two tests interleave, and nothing proves that each request is still charged to the test that issued it (deferred from `spec-deferred-late-request-escapes-no-network-guard.md`).

**Approach:** Add the settling probe that the ledger entry names as a committed hook-level test: a child Vitest with the real setup file runs concurrent pairs in which each test issues its own unfixtured request after both tests of the pair have started. The parent asserts that each test's `afterEach` failure names only its own URL.

## Boundaries & Constraints

**Always:**
- Observe the real hooks of `test/setup.ts` through a child Vitest, the same way `test/guard-hooks.test.ts` does. The fixture uses only `.invalid` URLs (RFC 2606).
- Cover both `describe.concurrent` and `it.concurrent`.
- Force the interleaving: the two tests of a pair meet at a barrier before either sends its request, so both `beforeEach` hooks have run when each request is recorded. A sequential run would time out at the barrier, so a green run also proves the tests ran concurrently.

**Never:**
- Do not change `test/setup.ts`. The probe on 2026-09-26 found the attribution correct; a change to the guard is out of scope unless the test proves it wrong (then HALT blocked).
- Do not change any `vitest.config.ts` outside the new fixture directory, any planning doc, `docs/stories/deferred-work.md` or `docs/stories/sprint-status.yaml`.
- Do not add a dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| `describe.concurrent` pair | Both tests start, meet, then each awaits a fetch of its own URL | Each test fails with a `[no-network]` message naming its own URL and not the other's | Existing message |
| `it.concurrent` pair | Same, at file top level | Same | Same |
| No late request | Every request is charged in its own `afterEach` | The file-level `afterAll` reports nothing: the file message has no `No test's afterEach reported` text | None |

</intent-contract>

## Code Map

- `test/setup.ts` -- the guard (read-only). `beforeEach` calls `currentTest.enterWith({ id, name })` from `context.task`; `onUnhandledRequest` records `{ described, issuedBy: currentTest.getStore() }`; `afterEach` calls `assertNoEscapedRequests(context.task)`, which fails on that test's own requests only; `afterAll` fails on anything left.
- `test/guard-hooks.test.ts` -- the pattern to copy: `runChild(outputFile)` spawns `process.execPath` with `node_modules/vitest/vitest.mjs run --config <child> --reporter=json --outputFile=<tmp>`, then reads `assertionResults` (`title`, `status`, `failureMessages`) and the file `status`/`message`. Timeout 120 s.
- `test/guard-hooks-fixture/{vitest.config.ts,names.ts,*.fixture.ts}` -- the child-config and shared-names pattern. The root `include` does not match `*.fixture.ts`.
- Probe evidence (2026-09-26, this build): the fixture below, run with the real setup, gave four failed tests, each naming only its own URL, and an empty file message.

## Tasks & Acceptance

**Execution:**
- `test/guard-concurrent-fixture/vitest.config.ts` -- child config: `root` the fixture dir, `include: ['*.fixture.ts']`, `setupFiles` the real `../setup.ts`.
- `test/guard-concurrent-fixture/names.ts` -- the four test titles and their `.invalid` URLs, shared with the parent.
- `test/guard-concurrent-fixture/concurrent.fixture.ts` -- a `describe.concurrent` pair and a top-level `it.concurrent` pair. Each test awaits a two-party barrier, then awaits `fetch(ownUrl)` with the rejection swallowed.
- `test/guard-concurrent.test.ts` -- run the child; assert each of the four tests failed with `[no-network]` naming its own URL and none of the other three URLs; assert the file message does not contain `No test's afterEach reported`.

**Acceptance Criteria:**
- Given two concurrent tests whose `beforeEach` hooks have both run, when each issues an unfixtured request, then each test's real `afterEach` names only its own URL. The parent test observes this for `describe.concurrent` and `it.concurrent`.
- Given the guard charged the request to the last `beforeEach` instead of the issuing test, when the parent test runs, then it fails.
- Given the full suite, when `pnpm check` and `pnpm test` run, then both pass.

## Spec Change Log

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 15 findings — high 0, medium 0, low 11, false 4, maybe-false 0
- findings:
  - `[low]` `[patch]` The file-level check only asserts one phrase is absent, so a reworded or other afterAll failure passes — patched: the file message must be `''`.
  - `[false]` `[reject]` AC 2 (charging to the last `beforeEach` fails the test) has no proof — the implementer and the verification-gap layer each ran that mutation, and the parent failed (`describe.concurrent: first test: expected 'passed' to be 'failed'`). Recorded under Auto Run Result.
  - `[low]` `[reject]` A sequential run fails with no named diagnosis — the verification-gap layer's sequential mutation failed loudly (`Test timed out in 5000ms`, no `[no-network]`). A barrier timeout with its own message adds code for a debugging nicety.
  - `[low]` `[patch]` The un-awaited request path, which `AsyncLocalStorage` exists for, is not exercised under concurrency — patched: each test now starts its fetch from a `setTimeout` after the barrier and awaits its settling.
  - `[low]` `[patch]` The fixture comment implies two isolated pairs, but Vitest may run the suite and the top-level pair together — patched: the comment says so; each test still meets only its own partner.
  - `[low]` `[reject]` `runChild` and the report types are now copied in three test files — a shared helper module is more than a direct correction, and the two existing copies predate this change.
  - `[low]` `[patch]` A double charge or a wrong count passes the per-test check — patched: each failure must contain the exact header `[no-network] 1 request(s) had no fixture and were blocked`.
  - `[low]` `[patch]` A failure for another reason (a timeout) could satisfy the check — grouped with the row above: the exact header ties the failure to the guard's `afterEach`.
  - `[low]` `[reject]` (edge) A child that writes no report gives a bare ENOENT and drops its output — debugging-only, same as the sibling tests, where review of the source spec rejected it.
  - `[low]` `[patch]` (edge) Other file-level errors pass the absence check — grouped with the first row.
  - `[low]` `[reject]` (edge) `execFile` has no timeout, so a hung child outlives the parent — the child's own 5 s test timeout ends each fixture test; adds options for a case not shown to occur.
  - `[false]` `[reject]` (edge) A retry re-runs a test after the barrier opened — no retry is configured in the child config or its defaults.
  - `[false]` `[reject]` (intent-alignment) The negative control is asserted, not demonstrated — the mutation was run twice, see the second row.
  - `[low]` `[reject]` (intent-alignment) Requests issued from a concurrent hook, or pairs of more than two, are not covered — the entry's settling criterion names body-issued requests of a pair; widening adds fixture cases.
  - `[false]` `[reject]` (intent-alignment) The fixture makes the entry's "no test uses .concurrent" stale — the entry is removed when this closes, so no stale text remains.

## Verification

**Commands:**
- `pnpm check` -- expected: typecheck, lint and depcruise pass.
- `pnpm test` -- expected: all projects pass, including `test/guard-concurrent.test.ts`.

**Manual checks (if no CLI):**
- Temporarily charge requests to a module-level "last test" variable in `test/setup.ts` instead of `currentTest.getStore()`; `test/guard-concurrent.test.ts` must fail. Revert.

## Auto Run Result

Status: done

**Summary:** the attribution of the no-network guard under `describe.concurrent` and `it.concurrent` is now verified by a committed hook-level test. A child Vitest with the real `test/setup.ts` runs two concurrent pairs. The two tests of each pair meet at a barrier, so both `beforeEach` hooks have run. Each test then starts its own unfixtured request from a timer. Each test's real `afterEach` fails with exactly one request, its own URL, and the file-level check reports nothing. `test/setup.ts` needed no change.

**Files changed:**
- `test/guard-concurrent.test.ts` (new): runs the child and asserts, per test, the exact one-request header, its own URL and none of the other URLs, and an empty file-level message.
- `test/guard-concurrent-fixture/concurrent.fixture.ts` (new): the `describe.concurrent` pair and the top-level `it.concurrent` pair, with the barrier and the timer-started fetch.
- `test/guard-concurrent-fixture/names.ts` (new): the four titles and their `.invalid` URLs.
- `test/guard-concurrent-fixture/vitest.config.ts` (new): the child config, which loads the real setup file.

**Review findings:** one pass, 15 findings: 11 low and 4 false. 4 low groups patched: the empty file-message assertion, the exact one-request header, the timer-started request path, and the fixture comment on pairs that may run together. The Review Triage Log gives the reason for each rejected finding: 3 false, and 4 low not worth the added code. Nothing deferred.

**Follow-up review recommendation:** `false`. Patched: 0 high, 0 medium, 4 low.

**Verification:**
- `pnpm check` passes.
- `pnpm test` passes 75 files and 931 tests.
- Mutation run on the final code: `test/setup.ts` charged requests to a global "last test" set in `beforeEach`. The new test failed with `describe.concurrent: first test: expected 'passed' to be 'failed'`. The file was restored, and the test passes again.
- The verification-gap layer made the fixture sequential. The test failed with `Test timed out in 5000ms`, so a green run proves that the pairs ran concurrently.

**Residual risks:** the concurrency proof depends on the child's default 5 s test timeout at the barrier. `runChild` and the report types are now copied in three test files.
