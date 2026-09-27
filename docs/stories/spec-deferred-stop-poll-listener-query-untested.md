---
title: 'deferred: a test runs the dev:stop listener query'
type: 'bugfix'
created: '2026-09-27'
status: 'done'
baseline_revision: 'f29d175294d7336e5536107f869c25299f39af3c'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      No test runs the Windows pre-kill snapshot reader (`snapshot` / `snapshotWindows`), so its `parseListenerJson` call on `listeners` can be removed with every test still passing.
    evidence: |-
      `snapshot`, `snapshotWindows` and `main` are not exported, and no test file references them; the real-listener test runs only `listenerPids` -> `listenersWindows`. `snapshotWindows` serialises through `@{ listeners = $l } | ConvertTo-Json -Depth 3`, a different shape path from the `-InputObject` query. Pre-existing: the snapshot reader never had a test. Covering it needs `snapshot` exported and a real-listener test asserting `snapshot(port).listeners` contains `process.pid`.
    location: >-
      tools/dev-stop/dev-stop.ts snapshotWindows
    severity: low
---

<intent-contract>

## Intent

**Problem:** No automated check runs the stop poll's listener query (`listenerPids`, `listenersWindows`, `listenersPosix` in `tools/dev-stop/dev-stop.ts`). If PowerShell ever serialises one listener as a bare number (`1708`) and not an array (`[1708]`), `.length` is undefined, the poll reads the port as taken until the deadline, and `dev:stop` exits 1 after it has killed the server.

**Approach:** Parse the PowerShell listener JSON through one exported pure function that accepts `null`, a bare number or an array and always returns a `number[]`, and use it in both Windows readers. Export `listenerPids` and add tests: unit tests for the parser, and a test that runs the real query against a real loopback listener that the test opens and closes.

## Boundaries & Constraints

**Always:** `tools/dev-stop/dev-stop.ts` keeps importing only Node builtins (it runs under bare `node`). The real-listener test binds `127.0.0.1` on port 0 (OS-chosen), closes its server in `finally`/`afterEach`, and makes no HTTP request. A parse result that is not `null`, a finite integer, or an array of finite integers throws; it never reads as a free port.

**Never:** Do not change the `-ErrorAction SilentlyContinue` behaviour of `listenerScript` (a separate ledger entry owns the failed-query guard). Do not change `planStop`, `main`'s flow, the entry guard, or `STOP_TIMEOUT_MS`. Do not stub `execFileSync` or `process.platform`. Do not edit `docs/stories/deferred-work.md` or `docs/stories/sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Free port | JSON `null` (PowerShell prints nothing but `null`) | `[]` | No error expected |
| One listener as array | `[1708]` | `[1708]` | No error expected |
| One listener as bare number | `1708` | `[1708]` | No error expected |
| Several listeners | `[1708, 2210]` | `[1708, 2210]` | No error expected |
| Unexpected shape | `"x"`, `{}`, `[1.5]`, `["1708"]` | — | throws an `Error` naming the value |
| Real listener | test listens on `127.0.0.1:<port>` | `listenerPids(port)` contains `process.pid` | No error expected |
| Listener closed | same port after `server.close()` | `listenerPids(port)` is `[]` | No error expected |

</intent-contract>

## Code Map

- `tools/dev-stop/dev-stop.ts:191-198` -- `listenerScript` / `listenersWindows`: `JSON.parse(out) as number[] | null` is the unchecked cast the entry names.
- `tools/dev-stop/dev-stop.ts:200-208` -- `snapshotWindows`: same cast on `parsed.listeners`; a bare number there makes `planStop`'s `for…of` throw. Route it through the same parser.
- `tools/dev-stop/dev-stop.ts:210-220` -- `listenersPosix`: already returns `number[]`; exercised by the real-listener test on POSIX when `lsof` exists.
- `tools/dev-stop/dev-stop.ts:241-244` -- `listenerPids`: not exported today; export it.
- `tools/dev-stop/dev-stop.ts:296` -- the stop poll's `.length === 0` read that fails on a bare number.
- `tools/dev-stop/dev-stop.test.ts:1-3` -- imports only `DEFAULT_PORT`, `ownAncestry`, `parsePort`, `planStop`; add the new imports.
- `packages/sync/src/shell-fetch.test.ts:1-30` -- precedent for a loopback `node:http`/`node:net` server in a test.
- `vitest.config.ts:20` -- `tools/dev-stop/*.test.ts` is already in a project; no wiring change.

## Tasks & Acceptance

**Execution:**
- `tools/dev-stop/dev-stop.ts` -- add exported `parseListenerJson(value: unknown): number[]` (null → `[]`, integer → `[n]`, integer array → copy, else throw); use it in `listenersWindows` and `snapshotWindows`; export `listenerPids` -- makes the bare-number serialisation harmless and gives the test a seam.
- `tools/dev-stop/dev-stop.test.ts` -- add a `parseListenerJson` describe covering every matrix row but the last two; add a `listenerPids` describe that opens a `node:net` server on `127.0.0.1:0`, asserts its port lists `process.pid`, closes it, and asserts `[]`. Give that test a timeout of 30 s (each query starts PowerShell). Skip it only on non-Windows hosts without `lsof`.

**Acceptance Criteria:**
- Given the test suite, when `pnpm test` runs on Windows, then a test executes `listenerPids` (and so `listenersWindows` and its PowerShell query) against a real listener and passes.
- Given PowerShell prints `1708` for one listener, when the stop poll reads it, then it sees one listener, and once the port frees it sees `[]` and exits 0.

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 22 findings — high 0, medium 0, low 17, false 5, maybe-false 0
- findings:
  - `[low]` `[patch]` (blind) `parseListenerJson` comment states as fact that `ConvertTo-Json` prints `null` / a bare number; `-InputObject @(...)` on PowerShell 5.1 prints `[]` / `[pid]` — comment reworded: the real query prints `[]` or `[pid, …]`, `null` and a bare number are accepted defensively.
  - `[low]` `[patch]` (blind) parser tests miss `[]`, the free-port shape the real query prints — added a `[]` test; `null` test no longer labelled "a free port".
  - `[low]` `[defer]` (blind) the `snapshotWindows` change has no test — pre-existing gap (the snapshot reader never had a test); covering it needs a new export; deferred in frontmatter.
  - `[low]` `[reject]` (blind) the real-listener test cannot see the raw JSON shape — the test's purpose is running the real query; every accepted shape is unit-tested; pinning raw output adds a second PowerShell harness for a shape change nobody has observed.
  - `[low]` `[reject]` (blind) acceptance criterion 2 has no test that runs `main`'s poll — the spec forbids stubbing `execFileSync`/`process.platform`; the poll only reads `listenerPids(port).length`, and the bare-number shape is covered at the parser.
  - `[low]` `[reject]` (blind) an unexpected shape during the poll exits 1 with a message that does not say the server was killed — only an unobserved shape reaches it; reporting the kill needs a new try/catch branch in `main`.
  - `[low]` `[reject]` (blind) IPv6 `::1` listener not tested — `Get-NetTCPConnection` and `lsof -iTCP` list both families; an IPv6 case adds an availability-guarded test for no observed defect.
  - `[low]` `[reject]` (blind) `Number.isInteger` accepts 0 / negatives, and a non-JSON output gives a bare `SyntaxError` — `-State Listen` never reports PID 0 or negatives; the `SyntaxError` path is unchanged from before; fix adds guards.
  - `[false]` `[reject]` (blind) Code Map line numbers go stale — fix edits this build's spec.
  - `[false]` `[reject]` (blind) spec frontmatter and body out of step — the triage log and Auto Run Result are written by this step; status was correctly `in-review` during review.
  - `[low]` `[reject]` (edge) `listen()` error not handled in the test — binding `127.0.0.1:0` does not fail in practice; the 30 s timeout still ends the test; fix adds a guard.
  - `[false]` `[reject]` (edge) a Windows host without `Get-NetTCPConnection` fails instead of skipping — a loud failure there is correct: the query really does not work on that host.
  - `[low]` `[reject]` (edge) another worker may take the freed ephemeral port before the second query — ephemeral ports rotate through a range of thousands, so reuse within seconds is unlikely; weakening the assertion would drop the matrix's `[]` row.
  - `[low]` `[reject]` (edge) 0 / negative / unsafe integers read as PIDs — same as the blind finding above; not produced by `-State Listen`.
  - `[low]` `[reject]` (edge) one malformed output during the poll exits at once without retry — the `JSON.parse` throw is pre-existing; a retry needs a new try/catch branch for an unobserved case.
  - `[low]` `[defer]` (verification-gap) `snapshotWindows` switch to `parseListenerJson` has no test — grouped with the blind `snapshotWindows` finding; filed disposition defer; recorded in frontmatter.
  - `[low]` `[reject]` (verification-gap, other) no CI workflow runs `pnpm test` — deliberate and pre-existing (`.github/workflows/deploy.yml` header); out of this entry's intent.
  - `[low]` `[reject]` (intent) the bare-number path is exercised only by a synthetic parser test — same as the raw-shape finding above.
  - `[low]` `[reject]` (intent) poll / exit code stay untested (reading R4) — same as the criterion-2 finding above; the entry's evidence offers "a real listener" as a sufficient check.
  - `[low]` `[patch]` (intent) the `null` test is labelled "a free port" while the real query prints `[]` — grouped with the `[]` test patch above.
  - `[false]` `[reject]` (intent) scope reaches `snapshotWindows` — the spec's Code Map routes it on purpose; the same bare-number shape would break `planStop` there.
  - `[false]` `[reject]` (intent) POSIX without `lsof` stays untested — the skip is the spec's allowed condition, and `listenersPosix` itself refuses to run without `lsof`.

## Verification

**Commands:**
- `pnpm vitest run tools/dev-stop` -- expected: all dev-stop tests pass, the real-listener test not skipped on Windows.
- `pnpm check` -- expected: exit 0.
- `pnpm test` -- expected: exit 0.

## Auto Run Result

Status: done

**Summary:** The dev:stop listener query now parses PowerShell's JSON through one exported `parseListenerJson` (`[]`/`null` → no listener, a bare integer → one listener, an integer array → a copy, anything else throws). Both Windows readers use it. `listenerPids` is exported, and a test runs it against a real loopback listener: it finds `process.pid` while the listener is open and `[]` after the listener closes.

**Files changed:**
- `tools/dev-stop/dev-stop.ts`: adds `parseListenerJson`, routes `listenersWindows` and `snapshotWindows` through it, and exports `listenerPids`.
- `tools/dev-stop/dev-stop.test.ts`: adds parser unit tests for each matrix shape and the real-listener `listenerPids` test.
- `docs/stories/spec-deferred-stop-poll-listener-query-untested.md`: this spec.

**Review:** 22 findings. 3 low patches (2 entries): the doc comment is corrected, and a `[]` test is added with the `null` test renamed. 2 low rows deferred as 1 entry: the untested `snapshotWindows` reader, recorded in frontmatter `deferred`. 12 low findings rejected, and 5 false findings rejected. The Review Triage Log gives the reason for each.

**Follow-up review:** not recommended. Patched counts: high 0, medium 0, low 2 entries.

**Verification:**
- `pnpm vitest run tools/dev-stop`: 34 passed. The real-listener test ran on Windows (about 3.7 s) and was not skipped.
- `pnpm check`: exit 0.
- `pnpm test`: exit 0, 102 files and 1441 tests.

**Residual risks:** The POSIX branch of the real-listener test has not run (Windows host only). No CI job runs `pnpm test`. The pre-kill snapshot reader stays untested (deferred).
