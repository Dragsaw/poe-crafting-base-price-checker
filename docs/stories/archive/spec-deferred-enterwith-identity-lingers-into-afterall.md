---
title: 'deferred-enterwith-identity-lingers-into-afterall: prove a request from a hook outside any test is not charged to the last test'
type: 'chore'
created: '2026-09-26'
status: 'done'
baseline_revision: '1238f4496138c6f4f0f0c68297787d75a63c7333'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The deferred entry from `docs/stories/spec-deferred-late-request-escapes-no-network-guard.md` says that the identity which the setup `beforeEach` sets with `enterWith` may linger into a hook that belongs to no test. Examples are a file-level `afterAll` and a later suite's hooks. A request issued there could then be charged to the last test. No committed test probes those hooks, so the claim is unverified.

**Approach:** Add a hook-level test that runs the real `test/setup.ts` in a child Vitest, in the same way as `test/guard-hooks.test.ts` and `test/guard-concurrent.test.ts`. The fixture issues an unfixtured request from each hook that belongs to no test, and each hook runs after a test has run. The parent asserts that the file-level message reports each request as `issued outside any test` and never names a test. A probe on 2026-09-26 against the current setup file already gave that result for all three hooks, so no change to `test/setup.ts` is expected. If the test shows a linger, fix `test/setup.ts` so that the test passes.

## Boundaries & Constraints

**Always:**
- Use only unroutable `https://unrouted.invalid/...` URLs. The child needs no network.
- The fixture is not matched by the root `include` (`test/**/*.test.ts`). Its file name ends in `.fixture.ts`.
- Each hook awaits its fetch and swallows the rejection, so only the guard reports the request.

**Never:**
- Do not change `vitest.config.ts`, a package `vitest.config.ts`, `test/guard-hooks*` or any planning doc.
- Do not add a dependency.
- Do not change the existing messages of `test/setup.ts`. If a fix is needed, it must keep every existing test green.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Nested suite `afterAll` | Suite one's only test has run; its `afterAll` fetches | Line `GET <url> (issued outside any test)` in the file-level message | File fails |
| Later suite `beforeAll` | Suite one finished; suite two's `beforeAll` fetches before its test | Same form | File fails |
| File-level `afterAll` | Every test has run; the file-level `afterAll` of the fixture fetches | Same form | File fails |

</intent-contract>

## Code Map

- `test/setup.ts` -- the guard. `beforeEach` calls `currentTest.enterWith(...)` (around line 112). `onUnhandledRequest` records `issuedBy: currentTest.getStore()`. The setup `afterAll` (around line 125) calls `assertNoEscapedRequests()` with no owner. It prints `(issued outside any test)` when `issuedBy` is `undefined`, and `(issued by test "<name>")` otherwise. The setup file's `afterAll` is registered before the fixture's hooks. Vitest runs `afterAll` hooks in reverse order by default (`sequence.hooks: 'stack'`), so the fixture's file-level `afterAll` runs first and the check then sees its request. The probe confirmed this.
- `test/guard-concurrent.test.ts` -- the template to copy: `runChild` with `process.execPath` plus `node_modules/vitest/vitest.mjs`, the JSON reporter to a temporary file, and `JsonReport`/`FileResult` types.
- `test/guard-concurrent-fixture/{vitest.config.ts,names.ts}` -- the templates for the child config and the shared names module.
- Probe (2026-09-26, deleted): a fixture with `describe('suite one')` { test; `afterAll` fetch }, `describe('suite two')` { `beforeAll` fetch; test }, and a file-level `afterAll` fetch. The file failed with three lines, each `(issued outside any test)`. Both tests passed.

## Tasks & Acceptance

**Execution:**
- `test/guard-linger-fixture/vitest.config.ts` (new) -- copy the concurrent child config, with the comment naming `test/guard-linger.test.ts`.
- `test/guard-linger-fixture/names.ts` (new) -- export the two test titles and the three hook URLs, each URL labelled by its hook.
- `test/guard-linger-fixture/linger.fixture.ts` (new) -- the three hooks of the matrix, around two passing tests. A file comment says that only the parent runs it.
- `test/guard-linger.test.ts` (new) -- run the child, then assert: the run fails; there is one file result; both tests passed; the file message contains `GET <url> (issued outside any test)` for each of the three URLs; and the file message does not contain `issued by test`. Timeout 120 s.

**Acceptance Criteria:**
- Given the fixture, when the real hooks of `test/setup.ts` run in the child, then the test file fails, both tests pass, and each of the three hook requests is reported as `issued outside any test`.
- Given the full suite, when `pnpm check` and `pnpm test` run, then both pass.

## Spec Change Log

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 14 findings — high 0, medium 0, low 10, false 4, maybe-false 0
- findings:
  - `[low]` `[reject]` (blind) No positive control: if the identity were lost entirely, every line would still read `issued outside any test` — the suite already fails in that case: `test/guard-hooks.test.ts` asserts `(issued by test "...")` and the owner-path test in `test/no-network.test.ts` fails when `issuedBy` is `undefined`. A control here would duplicate them.
  - `[low]` `[patch]` (blind) The request count is not asserted, so a duplicated or extra record passes — patched: the test asserts `[no-network] 3 request(s) ...`, with 3 derived from `HOOK_URLS`.
  - `[low]` `[patch]` (blind) The hook order depends on the default `sequence.hooks: 'stack'` — patched: the child config sets it explicitly, and the fixture comment says so.
  - `[low]` `[reject]` (blind) A child crash gives a bare ENOENT and drops the child output — this only matters when you debug a broken child. The same template in `guard-hooks`/`guard-concurrent` was rejected for the same reason, and the fix adds a guard.
  - `[low]` `[reject]` (blind) The child harness is now in four copies — these are short test-only copies. A shared module would touch three files outside this entry. The earlier spec rejected the same duplication.
  - `[false]` `[reject]` (blind) A nested `afterAll` inside a suite that still has a later test is not covered — suite one's `afterAll` is exactly that case: it runs inside the file suite before suite two's test, and it reports `issued outside any test`.
  - `[low]` `[patch]` (blind) The probe directory `test/probe-linger/` was left behind — patched: deleted.
  - `[low]` `[reject]` (edge) A child that writes no report loses its output — same as the blind row above.
  - `[low]` `[patch]` (edge) `sequence.hooks` is not pinned — same fix as the blind row above.
  - `[low]` `[patch]` (verification-gap, other) The leftover probe directory — same deletion.
  - `[false]` `[reject]` (intent R3) The mechanism is not removed, because `enterWith` still never clears the store — the summary is a behavioural claim ("could be charged to the last test"), and the entry names a test as the way to settle it. The test proves that no hook outside a test gets the store, and it would fail if one did (a mutation that falls back to a fixed identity made it fail).
  - `[false]` `[reject]` (intent R4) A later file in a reused worker was not probed — probed on 2026-09-26: with `isolate: false` and one worker, a request from the top level and from the `beforeAll` of file b, after file a's test, both read `issued outside any test`.
  - `[false]` `[reject]` (intent) Deeper nesting was not probed — same mechanism as the nested row above. The runner starts each hook outside the test's async chain.
  - `[low]` `[patch]` (intent) The leftover probe directory — same deletion.
- deferred-ledger-audit: 0 findings. The spec has no carved-out item.

## Verification

**Commands:**
- `pnpm test` -- expected: all projects pass, including `test/guard-linger.test.ts`.
- `pnpm check` -- expected: typecheck, lint and depcruise pass.

## Auto Run Result

Status: done

**Summary:** the deferred claim is now settled and pinned by a test. The identity that the setup `beforeEach` sets with `enterWith` does not linger into a hook that belongs to no test. A request from a suite `afterAll` after its test, from a later suite's `beforeAll`, or from the file-level `afterAll` is reported as `issued outside any test`, and never as the last test. `test/setup.ts` needed no change.

**Files changed:**
- `test/guard-linger.test.ts` (new): runs the child Vitest with the real setup file. It asserts that the file fails, that both tests pass, that the message reports exactly three requests, each `issued outside any test`, and that no test is named.
- `test/guard-linger-fixture/linger.fixture.ts` (new): the three hooks around two passing tests.
- `test/guard-linger-fixture/names.ts` (new): the test titles and one `.invalid` URL for each hook.
- `test/guard-linger-fixture/vitest.config.ts` (new): the child config. It loads `test/setup.ts` and pins `sequence.hooks: 'stack'`.

**Review findings:** 14 in total. Low patches applied: 3 distinct fixes (the count assertion, pinning `sequence.hooks`, deleting the leftover probe directory). Nothing deferred. Rejected, each with the reason in the Review Triage Log:
- the positive control, because other tests already cover it
- the crash output, because it matters only when debugging a broken child
- the harness duplication, because the copies are test-only
- the nested-hook, structural and reused-worker readings, all refuted

**Follow-up review recommendation:** `false`. Patched: 0 high, 0 medium, and 3 low entries.

**Verification:**
- `pnpm check` passes.
- `pnpm test` passes 76 files and 932 tests.
- A mutation of `test/setup.ts` that charged a hook request to a fixed test identity made `test/guard-linger.test.ts` fail. The mutation was then reverted.
- A reused-worker probe (`isolate: false`, one worker, two files) also showed no linger into a later file's top level or its `beforeAll`. The probe was deleted.

**Residual risks:** the result depends on how the Vitest 5 runner starts hook contexts. A runner change that let a test's store reach later hooks would make this test fail, and that failure is the intended signal. The test adds about 0.9 s.
