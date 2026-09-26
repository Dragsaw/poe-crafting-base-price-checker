---
title: 'deferred-late-request-escapes-no-network-guard: charge a late request to the test that issued it'
type: 'bugfix'
created: '2026-09-26'
status: 'done'
baseline_revision: '1f9deee0ac8d9a374d6361e9a3c5475a38aac4be'
review_loop_iteration: 1
followup_review_recommended: false
context:
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md'
warnings: []
deferred:
  - summary: >-
      A request that starts after the setup file's afterAll has run server.close() is not intercepted and would reach the real network.
    evidence: |-
      Pre-existing: server.close() restores the real fetch, and this change does not alter that. A probe on 2026-09-26 found that a timer due after the last test never fired, because the Vitest worker ended first. Unverified: whether a reused worker (isolate false, or a slow teardown) can run such a timer. Would be settled by a probe that keeps the worker alive past afterAll (for example, a slow afterAll in another file of a non-isolated run) and observes whether the request is sent.
    location: >-
      test/setup.ts afterAll
    severity: medium (unverified)
  - summary: >-
      Attribution under it.concurrent / describe.concurrent is unverified. enterWith in interleaved beforeEach hooks could charge a request to the wrong test.
    evidence: |-
      No test in the repository uses .concurrent (a search of packages/ and test/ found none), so no current test is affected. A reviewer's probe was refused by the sandbox. Would be settled by a concurrent pair in which each test issues its own unfixtured request, observing that each test's afterEach names only its own URL.
    location: >-
      test/setup.ts beforeEach
    severity: medium (unverified)
  - summary: >-
      The test identity set by enterWith may linger into a hook that belongs to no test, such as a file-level afterAll, so a request issued there could be charged to the last test.
    evidence: |-
      enterWith never clears the store. A beforeAll in a nested describe did not inherit an earlier test's identity (test/no-network.test.ts, attempt 1), but a file-level afterAll or a later suite's hooks were not probed. If true, the file still fails, but it names the wrong test. Would be settled by a test file whose afterAll issues an unfixtured request, observing the issuer in the file-level message.
    location: >-
      test/setup.ts beforeEach
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** `test/setup.ts` keeps one module-level array of escaped requests and drains all of it in every `afterEach`. A request that a test starts but does not await is recorded in whichever test is running when MSW calls the callback. A probe run on 2026-09-26 showed this: test A started a fetch in a 20 ms timer and passed, and innocent test B then failed and named A's URL. If the late request is recorded after the last `afterEach` of the file, no hook asserts it, so the file passes and the guard is silently bypassed.

**Approach:** When a request is recorded, also record the test that issued it. Node's `AsyncLocalStorage` carries that identity from the test body into its timers and promise continuations. The `afterEach` of a test fails only for that test's own requests. A file-level `afterAll`, which runs before `server.close()`, fails for every request still recorded and names the test that issued each one.

## Boundaries & Constraints

**Always:**
- The `onUnhandledRequest` callback still records the request and throws. The `"error"` string is never used (AGENTS.md, spec 1.1 Always list).
- A test's own request that is recorded before its `afterEach` still fails that test with the existing `[no-network]` message, and the message names every such URL.
- A request that nothing asserts before `server.close()` must fail the file. It must never pass silently.
- The loopback and `file:` exemptions do not change.
- `drainEscapedRequests()` stays exported and still returns the described strings (`METHOD URL`). The existing tests in `test/no-network.test.ts` stay unchanged and green.

**Never:**
- Do not charge a request to a test that did not issue it.
- Do not change a package `vitest.config.ts`, `vitest.config.ts`, or any planning doc.
- Do not add a dependency. `node:async_hooks` is a Node builtin, and `test/` is not `core`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Own request | Test X awaits an unfixtured fetch | X fails in `afterEach` and names the URL | Existing message |
| Late request, later test running | Test A schedules a fetch. It is recorded while test B runs | B passes. The file fails in `afterAll` and names the URL and test A | Message says the request settled after its test ended |
| Late request, after last test | The last test schedules a fetch. It is recorded after that test's `afterEach` | The file fails in `afterAll` and names the URL and the issuing test | Same |
| No test context | The request is recorded with no test identity (a `beforeAll`, or module top level) | The file fails in `afterAll`. The message names no test | Same |

</intent-contract>

## Code Map

- `test/setup.ts` -- the guard. `escapedRequests: string[]` (module-level). `beforeAll` installs `server.listen({ onUnhandledRequest })`. `afterEach` calls `server.resetHandlers()` and then `assertNoEscapedRequests()`. `afterAll` calls `server.close()`. Exports `drainEscapedRequests`, `assertNoEscapedRequests` and `server`. No other file imports these exports except `test/no-network.test.ts`.
- `test/no-network.test.ts` -- the guard's own tests. It uses the unroutable `https://unrouted.invalid/...` URLs (RFC 2606). A new test must use such a URL too.
- `packages/{contracts,core,sync}/vitest.config.ts` and the root project in `vitest.config.ts` -- each lists `setupFiles: [.../test/setup.ts]`. They are read-only here.
- Probe evidence (2026-09-26, deleted after the run): `AsyncLocalStorage.enterWith(context.task.name)` in a `beforeEach` gave the correct store in the test body, in a timer that the test started and that fired while the next test ran, and after an `await` in the next test.

## Tasks & Acceptance

**Execution:**
- `test/setup.ts` -- record each escaped request as `{ described, issuedBy }`. `issuedBy` is the test identity (`id`, `name`) from an `AsyncLocalStorage` that a `beforeEach` sets with `enterWith(...)` from `context.task`. `assertNoEscapedRequests(owner?)` drains and fails only on requests of `owner` when an owner is given, and on all requests when no owner is given. Name the issuing test in the message where there is one. `afterEach` passes its own task. A new check in `afterAll`, before `server.close()` (use `try`/`finally`, so the server still closes), calls it with no owner. `drainEscapedRequests()` drains and returns only the requests of the test that is running when it is called, found with `currentTest.getStore()` (`undefined` matches requests issued outside any test). It must not clear another test's late request, because that would let the request pass silently. The file-level message reads plainly, for example: "These requests were not reported by the afterEach of the test that issued them:", followed by one line per request with `(issued by test "<name>")` or `(issued outside any test)` -- this fixes the defect.
- `test/no-network.test.ts` -- keep the three existing tests. Correct the comment in `'fails a test through the guard, naming every escaped URL'`: it calls the no-owner branch, and the real `afterEach` now takes the owner branch. Add these unit tests of the helper:
  - A late-request pair on the **timer path**. Test A calls `setTimeout` itself. The timer callback waits on a gate that test B opens, and then calls `fetch` on an unroutable URL. B opens the gate and waits until the fetch settles. B then asserts that `assertNoEscapedRequests(B's task)` does not throw, and that `assertNoEscapedRequests()` throws and names both the URL and A.
  - An owner-path test. The test awaits an unfixtured fetch, and then `assertNoEscapedRequests(task)` throws and names the URL.
  - A request recorded after its test's `afterEach`, which a `describe`-level `afterAll` reports. A request from a `beforeAll`, which is reported as `issued outside any test`.
- `test/guard-hooks.test.ts` (new) plus a fixture directory under `test/` -- a **hook-level** test that observes the real hooks, not the helper. It runs a child `vitest run` with `process.execPath` and the local Vitest binary. The child has its own config, with `setupFiles` set to the real `test/setup.ts`. The child runs a fixture file that the root `include` does not match. Use the JSON reporter, or parse the output. The fixture holds three tests, each on an unroutable URL:
  - (i) a test that awaits an unfixtured fetch and drains nothing;
  - (ii) a test A that starts a late request by the timer-and-gate pattern;
  - (iii) an innocent test B that opens the gate and waits for the request to settle.

  The parent asserts that (i) is reported failed with a `[no-network]` message naming its URL, that B is reported passed, and that the child run fails with the file-level message naming A and A's URL. Give the test a generous timeout. The child needs no network.

**Acceptance Criteria:**
- Given test A starts an unfixtured fetch that is recorded while test B runs, when the real hooks run, then B passes, and the file fails with a message naming A and the URL. The hook-level test observes this.
- Given a test awaits an unfixtured fetch and drains nothing, when its real `afterEach` runs, then that test fails with a `[no-network]` message that names the URL. The hook-level test observes this.
- Given a test calls `drainEscapedRequests()` while another test's late request is recorded, when the drain runs, then the late request stays recorded for the file-level check.
- Given the full suite, when `pnpm check` and `pnpm test` run, then both pass.

## Spec Change Log

### 2026-09-26 — review pass 1 (bad_spec)
- **Triggering findings:** the setup file's new `afterAll` check and the owner passed by `afterEach` were verified untested: a reviewer deleted each of them, and the suite stayed green. `drainEscapedRequests()` still cleared other tests' late requests. The reported scenario (a timer-started fetch) had no committed test.
- **Amended:** Tasks and Acceptance Criteria. `drainEscapedRequests()` is scoped to the running test. The pair uses the timer path. The comment and the file-level message are corrected. A new hook-level subprocess test observes the real hooks.
- **Known-bad state avoided:** a guard whose failing hooks can be deleted with the suite still green. This is the exact regression that review 1.1 found for the original `afterEach`. Also a draining test that silently swallows another test's late request.
- **KEEP:** the attempt-1 `test/setup.ts` design worked and must survive: `AsyncLocalStorage` + `enterWith` in `beforeEach`, the `{ described, issuedBy }` record, the owner-filtered `assertNoEscapedRequests(owner?)`, and the `afterAll` `try { check } finally { server.close() }`. The attempt-1 diff is saved at `C:/Users/ilyal/AppData/Local/Temp/dw-late-attempt1.diff` for reference. Its gate pattern for deterministic ordering also worked. Use unroutable `.invalid` URLs only.

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 19 findings — high 0, medium 8, low 6, false 1, maybe-false 4
- findings:
  - `[medium]` `[bad_spec]` Setup `afterAll` check untested; deleting it leaves the suite green — confirmed by the verification-gap layer's deletion run. Amendment: hook-level subprocess test.
  - `[medium]` `[bad_spec]` `drainEscapedRequests()` clears other tests' late requests, so a draining test swallows them or is blamed — read in the code: it spliced the whole array. Amendment: drain scoped to the running test.
  - `[low]` `[reject]` Pair A/B coupled through module state under `-t` or shuffle — it only affects a hand-filtered run, which gives a confusing but loud failure. The fix adds guard code.
  - `[low]` `[reject]` A lost async context (a module-level queue) turns a per-test failure into an unnamed file-level failure — it still fails loudly. No code in the repo issues `fetch` from such a queue under test, and the fix would bring back misattribution.
  - `[false]` `[reject]` No canary for the runner's `enterWith` behavior — the owner-path test fails if the identity is lost: `issuedBy` becomes `undefined`, the owner filter finds nothing, and `toThrow` fails. The edge-case layer confirmed this.
  - `[maybe-false]` `[defer]` The identity may linger into hooks that belong to no test (a file-level `afterAll`) — the `beforeAll` test showed that it does not carry into a nested suite's `beforeAll`. Would be settled by a request issued in a file-level `afterAll`. If true, medium.
  - `[maybe-false]` `[defer]` Attribution under `.concurrent` — no concurrent tests exist in the repo. Deferred with the settling probe.
  - `[low]` `[bad_spec]` The comment in the existing guard test now names the wrong branch — a direct correction, folded into the amendment.
  - `[low]` `[bad_spec]` The file-level message is a garden-path sentence and is false when called mid-test — a direct correction, folded into the amendment.
  - `[low]` `[reject]` The owner-path message gives no hint of held-back foreign requests — cosmetic, and the fix adds message branching.
  - `[maybe-false]` `[defer]` A request started after `server.close()` reaches the real network — pre-existing. The probe's post-file timer never fired. Deferred with the settling probe.
  - `[low]` `[reject]` Retry and repeat attempts share `task.id` — no test in the repo uses `retry` or `repeats`, and any misattribution stays within the same test.
  - `[medium]` `[bad_spec]` The timer path of the reported scenario is untested — the pair used only a promise continuation. Amendment: the pair and the fixture use `setTimeout` in A.
  - `[medium]` `[bad_spec]` (verification-gap, pre-verified) The setup `afterAll` check is never exercised — grouped with the first row. Hook-level test.
  - `[medium]` `[bad_spec]` (verification-gap, pre-verified) The owner passed by the setup `afterEach` is never checked — `{ id: "x" }` stayed green. Hook-level test.
  - `[medium]` `[bad_spec]` (intent-alignment a) A never calls `fetch` or a timer itself — grouped with the timer-path row.
  - `[medium]` `[bad_spec]` (intent-alignment b) The tests reach the helper, not the Vitest-reported outcome — grouped with the hook-level row.
  - `[maybe-false]` `[defer]` (intent-alignment c) Escape after `server.close()` — grouped with the deferred row above.
  - `[medium]` `[bad_spec]` (intent-alignment d) The premise-settling test is not committed — the hook-level fixture with the timer path is that test.

### 2026-09-26 — Review pass
- verdicts: 20 findings — high 0, medium 0, low 12, false 3, maybe-false 5
- findings:
  - `[low]` `[reject]` The real hooks are exercised for one matrix row only — the after-last and no-context rows go through the same setup `afterAll` code path, which the hook-level test exercises. Their logic is unit-tested. The fix adds fixture cases.
  - `[maybe-false]` `[defer]` The identity may linger into a file-level `afterAll` — carried: this is the same claim as the deferred row of pass 1, and the code there is unchanged. Patched separately: the `beforeAll` test's comment overstated what it proves. It is narrowed to a nested suite's `beforeAll`.
  - `[low]` `[patch]` The file-level header is false for a request issued outside any test — patched: the header is reworded to hold for both kinds of line.
  - `[low]` `[reject]` When the child writes no report, the parent throws a bare ENOENT and drops the child output — only for debugging a broken child. The JSON goes to a file, so `maxBuffer` is not reached. The fix adds a guard.
  - `[maybe-false]` `[reject]` The child inherits `VITEST*` and `NODE_OPTIONS` from the parent — it passes under `pnpm test`. The repo configures no coverage or inspector hook. If true, low.
  - `[false]` `[reject]` The spec's deferred items are missing from `deferred-work.md` — the intent forbids this build to edit that file, and the caller appends the spec's `deferred:` list.
  - `[maybe-false]` `[defer]` No guard against `.concurrent` — carried: same claim as the deferred row of pass 1.
  - `[low]` `[reject]` The pair breaks under `-t` or shuffle — carried: same claim as the rejected row of pass 1.
  - `[low]` `[reject]` The timer-and-gate code is duplicated in the unit test and the fixture — two short test-only copies. A shared helper adds a module for little gain.
  - `[low]` `[reject]` The new meaning of `drainEscapedRequests()` outside a test is not pinned by a test — no caller outside a test exists in the repo, and the JSDoc states the behaviour.
  - `[low]` `[reject]` (edge) Child crash gives ENOENT — same as the row above.
  - `[maybe-false]` `[defer]` (edge) A request after `server.close()` — carried: same claim as the deferred row of pass 1.
  - `[maybe-false]` `[defer]` (edge) The `enterWith` store is never cleared — carried: same claim as the identity-linger deferred row.
  - `[low]` `[reject]` (edge) A drain in a test whose async context was lost takes outside-test requests — this needs a test that both lost its context and drains. No such test exists, and the fix adds a branch.
  - `[low]` `[reject]` (edge) Duplicate test names across `describe` blocks make the issuer ambiguous — the message still fails loudly and names the URL. Using `fullName` changes the message format and its assertions.
  - `[false]` `[reject]` (intent-alignment) The file-level failure departs from spec 1.1's "that test fails" — Vitest cannot fail a test that has already finished, and a request that a timer has not yet started cannot be awaited. File-level failure naming the issuer is the only achievable reading. It is not a human decision.
  - `[low]` `[reject]` (intent-alignment) Attribution in the jsdom `web` project is not verified — `web` loads this setup and its suite passes. If the identity were lost there, requests would still fail the file as "issued outside any test".
  - `[low]` `[reject]` (intent-alignment) The change exceeds a minimal edit — the extra harness was required by review pass 1's verified gaps.
  - `[low]` `[reject]` (intent-alignment) The deferred surfaces are not covered — they are recorded in `deferred:`.
  - `[false]` `[reject]` (intent-alignment) "settles" versus "recorded" — the auditor itself notes that recording happens at interception, so the effect is the same.

## Design Notes

A test's `afterEach` cannot fail a test that has already finished, so the only honest place to report a late request is at file level. A file-level failure names the test that issued the request, which is the test that must change. `enterWith` in the setup `beforeEach` is enough. Vitest calls the hook and the test body in one async chain, and the probe confirmed that the store reaches the timers of the test body. A late request that fires after the worker has torn the file down cannot run: the probe's post-file timer never fired.

## Verification

**Commands:**
- `pnpm test` -- expected: all projects pass, including the new pair in `test/no-network.test.ts`.
- `pnpm check` -- expected: typecheck, lint and depcruise pass.

## Auto Run Result

Status: done

**Summary:** the no-network guard now records the test that issued each escaped request. It gets that test from an `AsyncLocalStorage` that a `beforeEach` sets with `enterWith`. `afterEach` fails a test only for its own requests. A new check in `afterAll`, which runs before `server.close()`, fails the file for any request still recorded, and names the test that issued it or says `issued outside any test`. `drainEscapedRequests()` takes only the running test's requests. A late request therefore no longer fails an innocent later test, and it can no longer pass silently after the last `afterEach`. The probe of 2026-09-26 confirmed the original defect: innocent test B failed and named A's URL.

**Files changed:**
- `test/setup.ts`: records the issuer, filters the `afterEach` check by owner, adds the file-level check in `afterAll` and scopes the drain to the running test.
- `test/no-network.test.ts`: corrects one comment, and adds unit tests of the helper: the late-request pair on the timer path, the owner path, a request recorded after its test's `afterEach`, and a request from a `beforeAll`.
- `test/guard-hooks.test.ts` (new): a hook-level test. It runs a child Vitest with the real setup file and checks the outcome that Vitest reports for each test and for the file.
- `test/guard-hooks-fixture/{vitest.config.ts,late-request.fixture.ts,names.ts}` (new): the child's config, its fixture tests and shared names.

**Review findings:**
- Pass 1 had 19 findings: 9 routed to `bad_spec`, 4 deferred, 6 rejected. That caused one spec amendment and a re-derivation.
- Pass 2 had 20 findings: 2 `low` patches (the file-level message header, and the comment on the `beforeAll` test). The rest were rejected or carried. The Review Triage Log gives each rejected finding with its reason.
- Deferred, in frontmatter `deferred:`:
  - a request that starts after `server.close()`;
  - attribution under `.concurrent`;
  - identity lingering into a file-level `afterAll`.

**Follow-up review recommendation:** `false`. Pass 2 patched 0 high, 0 medium and 2 low findings.

**Verification:** `pnpm check` passes. `pnpm test` passes 52 files and 533 tests. The implementer deleted each guard piece in turn: the owner in `afterEach`, the `afterAll` check, and the drain scoping. Each deletion made a test fail.

**Residual risks:** attribution depends on the ordering of the Vitest 5 runner: `beforeEach` and the test body run in one async chain. If that ordering changes, the owner-path test fails. The child-process test adds about 0.6 s to the suite, and it needs `node_modules/vitest/vitest.mjs`. The child writes a Vite cache under `test/guard-hooks-fixture/node_modules/`, which git ignores.
