---
title: 'deferred-request-after-afterall-reaches-network: keep the no-network guard installed for the life of the worker'
type: 'bugfix'
created: '2026-09-26'
status: 'done'
baseline_revision: 'f8a9408e0653b9e69d70178afe39024e515de210'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/spec-deferred-late-request-escapes-no-network-guard.md'
warnings: []
deferred:
  - summary: >-
      A request that a test starts but does not await, and that fires after the last file's afterAll in a worker, is blocked by the process-wide guard but reported by nothing, so the run passes.
    evidence: |-
      Pre-existing in kind: before this change the same request passed silently and also escaped. Now it is blocked, because the interceptor stays installed. The file-level check in afterAll reports a late request only when a later file's afterAll runs in the same worker. The 2026-09-26 probe found that a 4000 ms timer never fired, because the worker ended first, so whether such a request can happen at all is unverified. A fix needs a hook that runs in the worker after its last file and before the worker ends, and that can fail the run. A globalSetup teardown runs in the main process and cannot see the worker's record. First settle whether Vitest offers such a hook.
    location: >-
      test/setup.ts afterAll
    severity: low
---

<intent-contract>

## Intent

**Problem:** `test/setup.ts` calls `server.close()` in its `afterAll`, and that restores the real `fetch`. A request that a test starts but does not await, and that fires after that `afterAll`, is not intercepted and would reach the real network. A probe on 2026-09-26 settled the open question of the ledger entry: in a reused worker (`isolate: false`, one worker), timers that file A started fired while file B was still importing, and at that moment `globalThis.fetch` was the real, unpatched `fetch`. The 4000 ms timer never fired: the worker ended first.

**Approach:** Install the guard once per worker process and never uninstall it. The MSW server, the escaped-request record and the test-identity store live in one process-wide object on `globalThis` under a `Symbol.for` key. The first evaluation of the setup file creates it and calls `listen` once. A later evaluation in the same worker reuses it. `afterAll` keeps its file-level check and resets handlers, but it no longer closes the server. A late request is then always blocked, and the next file's `afterAll` reports it with the name of the test that issued it.

## Boundaries & Constraints

**Always:**
- The `onUnhandledRequest` callback still records the request and throws. Never use the `"error"` string.
- Keep the loopback and `file:` exemptions, the `[no-network]` messages, the owner-scoped `afterEach` check, the file-level `afterAll` check and the running-test scope of `drainEscapedRequests()` unchanged.
- The exports `server`, `drainEscapedRequests` and `assertNoEscapedRequests` keep their signatures.
- `test/no-network.test.ts` and `test/guard-hooks.test.ts` stay green without changes to their assertions.
- New test URLs use the unroutable `.invalid` TLD (RFC 2606).

**Never:**
- Do not change a package `vitest.config.ts`, the root `vitest.config.ts`, `packages/web/vite.config.ts` or any planning doc.
- Do not add a dependency.
- Do not replace `fetch` with a hand-written blocker. MSW also intercepts `http`/`https` and `XMLHttpRequest`, so a `fetch`-only guard would leave those paths open.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Late request between files | Reused worker. File A's test starts a timer that fetches after A's `afterAll`, while file B imports | The request is blocked. B's `afterAll` fails B and names the URL and A's test | `[no-network]` file-level message |
| Late request after the last file | The last file's timer fires after its `afterAll` | The request is blocked, because the interceptor is still installed. Nothing reports it if the worker ends first | None: nothing is left to fail |
| Isolated worker (default) | Each file evaluates the setup file | Behavior is the same as before for in-file requests | Existing messages |

</intent-contract>

## Code Map

- `test/setup.ts` -- the guard. Module-level `escapedRequests`, `currentTest` (`AsyncLocalStorage`) and `server = setupServer()`. `beforeAll` calls `server.listen({ onUnhandledRequest })`, whose closure pushes to `escapedRequests` and reads `currentTest`. `afterAll` runs `assertNoEscapedRequests()` in `try` and `server.close()` in `finally` (the defect). All three pieces must move into the one process-wide object, because the closure of the first `listen` is the one that stays installed.
- `test/guard-hooks.test.ts` -- the existing hook-level test. It runs a child Vitest with `process.execPath`, `node_modules/vitest/vitest.mjs`, `--reporter=json` and `--outputFile`, and reads `testResults[].status`, `.message` and `.assertionResults`. Reuse its `runChild` shape for the new child run.
- `test/guard-hooks-fixture/` -- the existing child config and fixture. It uses the default `isolate`. Leave it unchanged.
- Probe (2026-09-26, deleted after the run): `test/probe-late/` with `isolate: false`, `fileParallelism: false`, `maxWorkers: 1`. A's timers at 50 ms and 300 ms fired during B's top-level `await`, with `globalThis.fetch.name === 'fetch'`. B's test saw `fetchProxy`. The 1500 ms timer fired during B's test. The 4000 ms timer never fired.

## Tasks & Acceptance

**Execution:**
- `test/setup.ts` -- hold `server`, the record and `currentTest` in one object at `globalThis[Symbol.for(...)]`, created on first evaluation. Call `listen` only when that object is not yet listening. In `afterAll`, keep `try { assertNoEscapedRequests() } finally { server.resetHandlers() }`, with no `server.close()`. Update the comments that name `server.close()`.
- `test/guard-reuse-fixture/` (new) -- a child config with `isolate: false`, `fileParallelism: false`, `maxWorkers: 1`, `setupFiles` set to the real `test/setup.ts`, and a sequencer that orders files by path. Add fixture `a-issuer.fixture.ts`: one test that starts a 50 ms timer, which fetches a `.invalid` URL and swallows the rejection. Add fixture `b-bystander.fixture.ts`: a top-level `await` of about 1000 ms, then one passing test. Share the names in a `names.ts`.
- `test/guard-reuse.test.ts` (new) -- run the child as `guard-hooks.test.ts` does. Assert that A's test passed, that B's test passed, that B's file failed, and that its message contains `GET <URL> (issued by test "<A's test>")`. Use a generous timeout.

**Acceptance Criteria:**
- Given a reused worker, when a late request from file A fires after A's `afterAll` and before B's tests, then the request is blocked and the run fails with a file-level message that names the URL and A's test. The new hook-level test observes this. Without the fix the request is not recorded, B passes, and that test fails.
- Given the full suite, when `pnpm check` and `pnpm test` run, then both pass.

## Spec Change Log

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 23 findings — high 0, medium 0, low 15, false 3, maybe-false 5
- findings:
  - `[low]` `[patch]` (blind) The 50 ms issuer timer can fire before A's own hooks end on a loaded machine, which flakes the parent test — the delay is raised to 300 ms, still well below B's 1000 ms import wait.
  - `[maybe-false]` `[reject]` (blind) The shared identity store may carry A's last test into B's top level or `beforeAll` — B's run starts from a new runner message, so it probably has no store. Would be settled by a reuse fixture whose B `beforeAll` issues a request. If true, low: the file still fails loudly and only the issuer name is wrong.
  - `[low]` `[patch]` (blind) The test never asserts that the issuer's file passed — added `expect(issuer?.status).toBe('passed')`.
  - `[low]` `[reject]` (blind) No assertion that the request is reported exactly once — the verification-gap layer showed that a stacked second `listen` already fails the test. The fix adds an assertion for a state no code produces.
  - `[low]` `[reject]` (blind) A child crash gives a bare ENOENT and drops the child output — only for debugging a broken child. `guard-hooks.test.ts` made the same choice (source spec, pass 2).
  - `[low]` `[reject]` (blind) `runChild` and the report interfaces are copied from `guard-hooks.test.ts` — two short test-only copies. A shared module adds a file for little gain. The source spec rejected the same duplication.
  - `[low]` `[reject]` (blind) `execFile` has no timeout, so a hung child outlives the run — no hang has been observed. The fix adds options to both harnesses.
  - `[low]` `[patch]` (blind) `guard.listening` is set before `listen` succeeds — the flag is now set after `server.listen(...)` returns.
  - `[low]` `[reject]` (blind) The exported `server.close()` can turn the guard off for the rest of the worker — no file in the repo calls it (grep of `packages/` and `test/`). The fix adds a wrapper.
  - `[low]` `[patch]` (blind) The doc says "per worker process", but under `threads` the singleton is per thread — reworded to "per worker (process or thread)".
  - `[low]` `[defer]` (blind) The after-last-file case is blocked but reported by nothing — recorded in frontmatter `deferred`. The no-test part is rejected: nothing runs after the last file's hooks to observe it (the verification-gap layer agrees).
  - `[low]` `[patch]` (edge) Timer can fire before the issuer's `afterAll` — same fix as the first row.
  - `[low]` `[reject]` (edge) Child crash hides its diagnostics — same as the blind row above.
  - `[low]` `[reject]` (edge) A hung child is orphaned — same as the blind row above.
  - `[low]` `[patch]` (edge) `listening` is set before `listen` — same fix as the blind row above.
  - `[maybe-false]` `[reject]` (edge) Under `vmThreads`/`vmForks`, each file gets a new `globalThis`, so interceptors stack — no config in the repo uses a `vm` pool (root, four packages). Would be settled by running the suite with `--pool=vmForks`. If true, low for this repo.
  - `[low]` `[reject]` (verification-gap) `test/probe-late/` is still in the worktree — it holds only an ignored `node_modules/.vite` cache, so it is not part of the change. The skill rules forbid `rm -rf`, and the worktree is removed after the run.
  - `[false]` `[reject]` (intent-alignment) The test runs a synthetic `isolate: false` config that no project ships — the entry itself names "isolate false" as the route to settle. With the default isolate, each file gets a new worker, so no window exists.
  - `[maybe-false]` `[reject]` (intent-alignment) The slow-teardown and default-isolate windows are not tested — default isolate starts a new worker per file (the full suite's "72 workers spawned" line), so the only reachable window is the reused-worker gap, which is tested. Would be settled by a teardown hook that is observed to run timers.
  - `[false]` `[reject]` (intent-alignment) The test proves interception through the record, not through the socket — MSW records the request in `onUnhandledRequest`, which throws before any request is sent, so a recorded request is a blocked request.
  - `[false]` `[reject]` (intent-alignment) The singleton changes the module state of the setup file in every project — `pnpm test` passes 72 files and 885 tests. With the default isolate, each worker still evaluates the setup file once.
  - `[maybe-false]` `[reject]` (intent-alignment) The spec says the probe was deleted, but its directory is left — same as the verification-gap row. The fix would edit this spec.
  - `[maybe-false]` `[defer]` (ledger audit) The after-last-file gap has no ledger entry — grouped with the deferred blind row. The frontmatter `deferred` list carries it, and the sweep appends that list to `deferred-work.md`.

## Design Notes

Why never close. A worker process ends when Vitest is done with it, so an interceptor that stays installed costs nothing: MSW's `setupServer` opens no socket. Every window where the real `fetch` is back is a window for escape. Such windows are the gap between files in a reused worker and the tail after the last file. Only an interceptor that is never uninstalled closes both.

Why a `globalThis` singleton. In a reused worker the setup file is evaluated again for each file. A second `setupServer().listen()` would stack a second interceptor, and the first one's closure would still write to the first file's record. One object per process gives one interceptor, one record and one identity store.

## Verification

**Commands:**
- `pnpm test` -- expected: all projects pass, including `test/guard-reuse.test.ts`.
- `pnpm check` -- expected: typecheck, lint and depcruise pass.

## Auto Run Result

Status: done

**Summary:** the no-network guard in `test/setup.ts` is now installed once per worker and never uninstalled. The MSW server, the escaped-request record and the test-identity store live in one object on `globalThis`, and `listen` runs once. `afterAll` keeps its file-level check and resets handlers instead of calling `server.close()`. A late request that fires after its file's `afterAll` is therefore blocked, not sent. In a reused worker, the next file's `afterAll` reports it and names the issuing test. The probe of 2026-09-26 confirmed the defect: in a reused worker the real `fetch` was back while the next file imported.

**Files changed:**
- `test/setup.ts`: the process-wide guard object, a one-time `listen`, and no `server.close()`.
- `test/guard-reuse.test.ts` (new): runs a child Vitest with one reused worker and checks the outcome that Vitest reports for each file.
- `test/guard-reuse-fixture/{vitest.config.ts,a-issuer.fixture.ts,b-bystander.fixture.ts,names.ts}` (new): the child config (`isolate: false`, one worker, path-order sequencer), its fixtures and shared names.

**Review findings:** one pass, 23 findings.
- Patched (4 entries, all `low`): the issuer timer is 300 ms, not 50 ms. The test asserts that the issuer's file passed. `listening` is set after `listen` returns. The guard doc says "per worker (process or thread)".
- Deferred (1, `low`): a late request after the last file of a worker is blocked but reported by nothing.
- Rejected: the Review Triage Log gives each rejected finding with its reason.

**Follow-up review recommendation:** `false`. Patched: 0 high, 0 medium, 4 low.

**Verification:** `pnpm check` passes. `pnpm test` passes 72 files and 885 tests. The verification-gap layer made three deletions: it put back `server.close()`, removed the singleton, and removed the once-only `listen`. `test/guard-reuse.test.ts` failed after each one.

**Residual risks:** the between-files test depends on timing: a 300 ms timer against a 1000 ms top-level wait. A very slow machine can fail it, but it cannot pass it wrongly. The child run adds about 1 s to the suite. It writes an ignored Vite cache under `test/guard-reuse-fixture/node_modules/`. A `vm*` pool would give each file its own `globalThis`, so the singleton would not hold there. No config uses such a pool.
