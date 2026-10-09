---
title: 'Deferred: a late request after the last file of a worker fails the run'
type: 'bugfix'
created: '2026-09-27'
status: 'done'
baseline_revision: 'a906d79f4b8cf69165d019ab78151574253c92b8'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/spec-deferred-request-after-afterall-reaches-network.md'
warnings: []
deferred:
  - summary: >-
      The `web` project does not load `test/global-setup.ts`, so a request that a web test starts but does not await, and that fires after the last file of a worker closed, is blocked but reported by nothing, and the run passes.
    evidence: |-
      AGENTS.md forbids edits to `packages/web/vite.config.ts`, where the `web` test project is configured. Without that global setup, `inject('noNetworkRecordDir')` returns `undefined` in `test/setup.ts`, and the guard keeps only its in-memory record. The root, contracts, core and sync projects load the global setup and fail the run.
    location: >-
      packages/web/vite.config.ts test config
    severity: low
  - summary: >-
      The `web` gap could be closed without editing `packages/web/vite.config.ts`, by declaring the `web` project inline in the root `vitest.config.ts` `projects` with `extends: './packages/web/vite.config.ts'` and `globalSetup`, and excluding `packages/web` from the `packages/*` glob; nobody has decided whether that change to how `web` is loaded is acceptable.
    evidence: |-
      Review of the deferred-unawaited-request-reported-by-nothing change (blind layer). The root `projects` array loads every `packages/*` config as is, so an inline `web` entry would run `web` twice unless the glob excludes it. The owner of the `web` test config decides.
    location: >-
      vitest.config.ts projects
    severity: low
---

<intent-contract>

## Intent

**Problem:** A test can start a request that it does not await. If that request fires after the setup file's `afterAll` in the last file of a worker, the guard in `test/setup.ts` blocks it, but nothing reports it, so the run passes. With the default `isolate: true`, every file runs in its own worker, so every file is a "last file".

**Approach:** The window is real. A probe on 2026-09-27 (Vitest 5.0.1, forks and threads) found that a 0 ms timer started in a test fires between the setup file's `afterAll` and the worker's end. It is recorded and blocked, and the run exits 0. A 10 ms or longer timer never fires, because the main process kills the worker first. No hook inside the worker can fail the run: a throwing environment teardown or `onCleanup` still exits 0. So the worker writes a request that arrives after its file closed to a record directory on disk. A main-process check registered with `vitest.onClose` runs after every worker has exited. It reads the record and fails the run with exit 1, naming each URL.

## Boundaries & Constraints

**Always:**
- `test/setup.ts` gets the record directory with Vitest `inject('noNetworkRecordDir')`, declared in a `ProvidedContext` augmentation. A project whose config has no global setup gets `undefined` and writes no record. Its in-memory behavior is unchanged.
- A file is "open" from the start of the setup file's `beforeAll` to the end of its `afterAll`. The guard keeps this flag in the process-wide `NoNetworkGuard`. A request that arrives while no file is open is appended synchronously (`appendFileSync`) to `<dir>/<process.pid>.log` as its `METHOD URL` line. It is also still pushed to the in-memory record, so a later file of a reused worker still reports it as before.
- The new global setup creates the directory with `mkdtempSync` under `os.tmpdir()`, provides it, and registers the check with `project.vitest.onClose`. The check reads every `*.log`, removes the directory, and throws when any line exists. The first line of the error names each URL, because Vitest prints only the message before the stack: `[no-network] N request(s) were blocked after the last test file of a worker closed:` followed by one `METHOD URL` per line.
- Keep the `onUnhandledRequest` callback throwing. Never use the `"error"` string. Keep the loopback and `file:` exemptions, the `[no-network]` messages, the `afterEach` and `afterAll` checks, and the exports `server`, `drainEscapedRequests` and `assertNoEscapedRequests` with their signatures.
- New test URLs use the `.invalid` TLD.

**Never:**
- Do not edit `packages/web/vite.config.ts` (AGENTS.md). The `web` project therefore stays without the disk record. Record this gap in frontmatter `deferred`.
- Do not add a dependency. Do not change any planning doc.
- Do not replace `fetch` with a hand-written blocker.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Late request, last file | Default isolate. A test starts a 0 ms timer that fetches a `.invalid` URL and swallows the rejection | The test and its file pass. The run exits 1, and the output names the URL | `[no-network]` close error |
| Timer too late to fire | Same, with a 200 ms timer | The run exits 0 (the worker ends first) | None |
| In-file request | A request inside a test | Same behavior as before: `afterEach` fails the test. Nothing is written to disk | Existing messages |
| Project without global setup | `inject` returns `undefined` | No disk record. Behavior as before | None |

</intent-contract>

## Code Map

- `test/setup.ts` -- the guard. `NoNetworkGuard` (L45-56) holds `server`, `escapedRequests`, `currentTest`, `listening`. `onUnhandledRequest` (L99-106) pushes and throws. `beforeAll` (L92-111) returns early after the first `listen`. The open flag must be set before that early return. `afterAll` (L126-136) must clear the flag in its `finally`.
- `vitest.config.ts` -- root. The inline `root` project (`setupFiles: ['./test/setup.ts']`) gets `globalSetup: ['./test/global-setup.ts']`.
- `packages/{contracts,core,sync}/vitest.config.ts` -- each loads `../../test/setup.ts`. Each gets `globalSetup: ['../../test/global-setup.ts']`.
- `test/guard-reuse.test.ts`, `test/guard-reuse-fixture/` -- the pattern for a child Vitest run (`runChild` with `execFile`, `--reporter=json`, `--outputFile`). The child config loads the real `setup.ts`.
- Probe, outside the repo: `C:\Users\ilyal\AppData\Local\Temp\vitest-probe\` holds `global.mjs` (the `onClose` check), `fixed-setup.ts` (the diff against `setup.ts`), `late.fixture.ts`, and `out-fix0.txt` (the exit-1 output). Read-only reference.
- Vitest 5.0.1 evidence: the main process kills a fork with SIGTERM after `stopped` (`dist/chunks/index.DzobfTyw.js:11056`). `vitest.onClose` callbacks run after `pool.close()` has awaited every worker (`:21420-21434`), and a rejection sets exit 1.

## Tasks & Acceptance

**Execution:**
- `test/global-setup.ts` (new) -- the default export takes the `TestProject`, creates the record directory, provides `noNetworkRecordDir`, and registers the `onClose` check. Declare the `ProvidedContext` augmentation here or in `test/setup.ts`.
- `test/setup.ts` -- inject the directory, keep the open flag on the guard, and append a record when a request arrives while no file is open. Update the doc comments that say nothing reports such a request.
- `vitest.config.ts`, `packages/contracts/vitest.config.ts`, `packages/core/vitest.config.ts`, `packages/sync/vitest.config.ts` -- add the `globalSetup` entry.
- `test/guard-after-last-file-fixture/` (new) -- a child config with default isolate, `setupFiles` set to the real `test/setup.ts`, and `globalSetup` set to the real `test/global-setup.ts`. One fixture file with one test that starts a timer whose delay comes from an environment variable, fetches `https://after-last-file.invalid/late`, and swallows the rejection.
- `test/guard-after-last-file.test.ts` (new) -- run the child as `guard-reuse.test.ts` does, capture its exit code and output. With delay 0: the fixture test passed, the exit code is non-zero, and the output contains `GET https://after-last-file.invalid/late`. With delay 200: the exit code is 0. Use a generous timeout.

**Acceptance Criteria:**
- Given the default pool and isolate, when a test's un-awaited request fires after its file closed and before the worker ends, then the run fails and names the URL. The new hook-level test observes this. It fails without the fix.
- Given the full suite, when `pnpm check` and `pnpm test` run, then both pass, and no record directory is left in `os.tmpdir()` by the run.

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 25 findings — high 0, medium 1, low 17, false 7, maybe-false 0
- findings:
  - `[false]` `[reject]` (ledger audit) The `web` gap has no ledger entry — it is in frontmatter `deferred`, and the caller appends that list to `deferred-work.md` in its ledger commit.
  - `[low]` `[defer]` (intent-alignment) The summary stays true for the `web` project — pre-existing and not caused by this change; the fix would edit `packages/web/vite.config.ts`, which AGENTS.md forbids. Carried in frontmatter `deferred`.
  - `[false]` `[reject]` (intent-alignment) The entry names an in-worker hook, and the diff uses a main-process check — the entry asked first whether such a hook exists; the probe settled that none can fail the run, and the entry's goal is a report that fails the run, which the `onClose` check gives. No PRD, AD or scope change is involved.
  - `[false]` `[reject]` (intent-alignment) "Fails without the fix" and "no directory left" are not exercised — the implementer disabled the record call and saw the delay-0 test fail; the leftover-directory check is now a test assertion (patched below).
  - `[low]` `[reject]` (blind) In a reused worker a module-top-level request of a later file arrives while no file is open, so it is recorded twice and a drain cannot clear the disk line — no config that loads the global setup uses `isolate: false`; the fix adds a phase flag or dedupe logic for a state no shipped config reaches.
  - `[low]` `[patch]` (blind) The disk record drops the issuing test — the line now carries `(issued by test "…")` via `describeIssuer`, the same text as the in-memory report, and the delay-0 test asserts it. The intent's Boundaries say the line is `METHOD URL`; the line still starts with it.
  - `[low]` `[patch]` (blind) Both child tests race on timing — the too-late case now uses 2000 ms and asserts no `[no-network]` in the output. The 0 ms case fails loudly if a future Vitest kills workers sooner; it cannot pass wrongly.
  - `[low]` `[patch]` (blind) No check that no record directory is left — the child now gets its own `TMP`/`TEMP`/`TMPDIR`, and both tests assert no `no-network-*` entry is left. Runs that end without `onClose` (Ctrl+C, a crash) leave one small directory; rejected as rare, the fix needs a startup sweep.
  - `[low]` `[reject]` (blind) Watch mode reports a late request only when Vitest closes — `pnpm test` is a `vitest run`; a watch session still fails at quit. A per-rerun check adds a reporter hook for a rare case.
  - `[false]` `[reject]` (blind) The deferred `web` gap is not in the ledger and the resolved entry is still there — the caller maintains `deferred-work.md` and removes the entry in the branch's last commit.
  - `[low]` `[defer]` (blind) `web` could be wired by declaring it inline in the root `projects` with `extends: './packages/web/vite.config.ts'` — same root as the deferred `web` gap; it changes how the `web` project is loaded (the `packages/*` glob would need to exclude it), which is a decision for whoever owns that config.
  - `[low]` `[reject]` (blind) The error text says "after the last test file" though the path also covers the gap between files of a reused worker; with threads, workers share one pid file — no shipped config reaches either case; small `appendFileSync` writes interleave safely.
  - `[false]` `[reject]` (blind) Stale Code Map line numbers and probe citations — the fix edits this build's spec.
  - `[medium]` `[patch]` (blind) Nothing checks that several projects' close checks all run — confirmed at `index.DzobfTyw.js` L21429: a synchronous throw inside `_onClose.map` aborts the later checks. Grouped with the edge-case rows below; the callback is now async.
  - `[low]` `[reject]` (verification-gap) The `fileOpen` placement before the early return is not pinned for a reused worker with the global setup — no shipped config combines `isolate: false` with the global setup; the fixture it asks for adds a third child run for a state no config reaches.
  - `[low]` `[patch]` (verification-gap) The no-leftover-directory acceptance criterion has no test — same fix as the blind row.
  - `[medium]` `[patch]` (edge) A synchronous throw in `onClose` skips the later callbacks — the callback is now `async`, so each project's check runs, removes its directory and prints "error during close".
  - `[medium]` `[patch]` (edge) Only the first project's URLs are named — same root and fix.
  - `[low]` `[reject]` (edge) Double report between files of a reused worker — same as the blind reused-worker row.
  - `[low]` `[reject]` (edge) Watch mode — same as the blind row.
  - `[low]` `[reject]` (edge) The 0 ms timer can lose the race on a loaded machine — the failure is loud (exit 0, no URL) and names the case; a retry would hide a real regression.
  - `[low]` `[patch]` (edge) The 200 ms timer can fire on a slow teardown — same fix as the blind timing row (2000 ms).
  - `[low]` `[reject]` (edge) A child crash gives a bare ENOENT — debugging-only; `guard-hooks.test.ts` and `guard-reuse.test.ts` made the same choice.
  - `[false]` `[reject]` (edge, claim) The Code Map says a rejection sets exit 1 while the callback threw synchronously — the callback is now async, so the claim holds; the fix edits this build's spec otherwise.
  - `[false]` `[reject]` (edge, claim) "Each check reads, removes and throws" — true after the async patch.
- follow-up: patched entries — medium 1 (the async close check), low 3 (issuer in the record, leftover-directory assertion, 2000 ms margin).

## Design Notes

Why `onClose` and not the global-setup teardown: the teardown runs before `pool.close()` waits for the workers, so a record written in the last milliseconds of a worker can be missed. `onClose` runs after every worker has exited.

Why `provide`/`inject` and not an environment variable: a child Vitest that a test starts would inherit the variable and write into the parent's directory, which would fail the parent run. `provide` belongs to one Vitest instance.

## Verification

**Commands:**
- `pnpm exec vitest run --project root test/guard-after-last-file.test.ts test/guard-reuse.test.ts test/guard-hooks.test.ts test/no-network.test.ts` -- expected: all pass.
- `pnpm test` -- expected: all projects pass.
- `pnpm check` -- expected: typecheck, lint and depcruise pass.

## Auto Run Result

Status: done

- **Summary:** A request that a test starts but does not await, and that fires after the last test file of its worker closed, now fails the run and names the URL and the issuing test. The worker appends such a request to a per-run record directory, which `test/global-setup.ts` provides through `provide`/`inject`. An async `vitest.onClose` check in the main process reads the record after every worker has exited, removes the directory, and rejects. A probe on 2026-09-27 showed the window is real (a 0 ms timer fires after the setup file's `afterAll`), and no hook inside the worker can fail the run.
- **Files changed:**
  - `test/global-setup.ts` (new) — the record directory, `provide`, and the async `onClose` check.
  - `test/setup.ts` — the `fileOpen` flag, `inject`, and `recordAfterFileClosed`.
  - `vitest.config.ts`, `packages/{contracts,core,sync}/vitest.config.ts` — `globalSetup`.
  - `test/guard-after-last-file.test.ts`, `test/guard-after-last-file-fixture/` (new) — a child run with delay 0 (fails and names the URL and test) and 2000 ms (passes, silent), both with no leftover record directory.
- **Review:** 25 findings. Patched: 1 medium (async close check), 3 low. Deferred: the `web` gap and the root-inline option for it. Rejected: the rest, with reasons in the triage log.
- **Follow-up review recommended:** false (patched: 0 high, 1 medium, 3 low).
- **Verification:** `pnpm check` exit 0. `pnpm test` 100 files, 1330 tests passed. The only `no-network-*` directory in the temp dir predates the runs (the probe).
- **Residual risks:** the delay-0 test depends on Vitest 5.0.1 letting a 0 ms timer fire before it ends the worker; a faster teardown makes it fail loudly. The `web` project is not covered. A watch session reports a late request only when it quits. The disk line carries the issuer after `METHOD URL`, which the intent's Boundaries describe as the line's start.
