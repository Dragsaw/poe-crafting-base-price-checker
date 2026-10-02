---
title: 'dev:stop must not read a failed Windows listener query as a free port'
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
      No test runs `snapshotWindows` with a failing listener query, so the first-snapshot path to "nothing listens on port N" is pinned only by reading the code.
    evidence: |-
      `snapshotWindows` in `tools/dev-stop/dev-stop.ts` is not exported and no test calls it. It joins `listenerScript` into a larger script, and a hand run of that joined shape with a missing cmdlet exits 1 today. A later edit that inlines its own `SilentlyContinue` query, or wraps the joined script so the `throw` no longer ends it, would make `pnpm dev:stop` print "nothing listens" after a failed query with every test passing. Closing it needs a test seam into `snapshotWindows` (an export or the same `node:child_process` mock the `listenersWindows` failure test uses, reached through an exported caller).
    location: >-
      tools/dev-stop/dev-stop.ts snapshotWindows
    severity: low
---

<intent-contract>

## Intent

**Problem:** `listenerScript` in `tools/dev-stop/dev-stop.ts` runs `Get-NetTCPConnection ... -ErrorAction SilentlyContinue`. A failed query (missing NetTCPIP module, access denied) therefore yields `[]`, and `pnpm dev:stop` prints "nothing listens" or "port is free". The POSIX path (`listenersPosix`) already refuses to read a failed `lsof` as a free port. The Windows path has no such guard.

**Approach:** Make the query stop on error. Catch only the "no matching connection" error (`FullyQualifiedErrorId` starting `CmdletizationQuery_NotFound`) as an empty list, and rethrow every other error. PowerShell then exits non-zero, `execFileSync` throws, and `main` reports the error and exits 1. The fix covers both callers of `listenerScript` (`snapshotWindows` and `listenersWindows`).

## Boundaries & Constraints

**Always:** A free port still reads as `[]` on Windows. A real listener still reads as its PID. The guard matches on the error id, not on the category: a missing cmdlet (`CommandNotFoundException`) is also category `ObjectNotFound`, and it must fail.

**Never:** Do not change `planStop`, the POSIX path, the kill logic or the CLI output text. Do not add a dependency (the module imports only builtins).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Free port | nothing listens on the port | `listenersWindows` returns `[]` | No error expected |
| Listener | a process listens on the port | its PID is in the result | No error expected |
| Failed query | `Get-NetTCPConnection` is missing or errors | PowerShell exits non-zero; `execFileSync` throws; dev:stop exits 1 | Error propagates to `main`'s rejection handler |

</intent-contract>

## Code Map

- `tools/dev-stop/dev-stop.ts` -- `listenerScript` (the `$l = @(Get-NetTCPConnection ... -ErrorAction SilentlyContinue ...)` line) is the defect. It is used by `listenersWindows` (stop poll) and `snapshotWindows` (first snapshot). `listenersPosix` is the reference guard (it rethrows on any `lsof` status other than 1).
- `tools/dev-stop/dev-stop.test.ts` -- co-located tests. Today they import only `DEFAULT_PORT`, `ownAncestry`, `parsePort`, `planStop`. The entry guard (`isInvokedDirectly`) keeps `main` out of tests.
- Probe on this machine (Windows 11, PowerShell 5.1): a free port with `-ErrorAction Stop` raises `CimJobException`, category `ObjectNotFound`, `FullyQualifiedErrorId` `CmdletizationQuery_NotFound,Get-NetTCPConnection`. An uncaught `throw` under `powershell.exe -Command` exits 1.

## Tasks & Acceptance

**Execution:**
- `tools/dev-stop/dev-stop.ts` -- rewrite `listenerScript` so that it wraps the query in `try { ... -ErrorAction Stop ... } catch { if not-found then empty else throw }`, and export `listenerScript` and `listenersWindows` for the tests -- makes a failed query fail loudly, as on POSIX.
- `tools/dev-stop/dev-stop.test.ts` -- add Windows-only tests (`it.runIf(process.platform === 'win32')`): a free port reads `[]`, a loopback `node:net` server's port reads the test process's PID, and the script with the cmdlet name replaced by a missing one makes `powershell.exe` exit non-zero -- covers each matrix row.

**Acceptance Criteria:**
- Given Windows and a `Get-NetTCPConnection` query that fails for any reason other than "no matching connection", when `pnpm dev:stop` queries the listeners, then it does not print "port is free" or "nothing listens", and it exits 1 with the error.

## Design Notes

```powershell
$l = @(try { Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction Stop | ForEach-Object OwningProcess | Sort-Object -Unique }
       catch { if ($_.FullyQualifiedErrorId -notlike 'CmdletizationQuery_NotFound*') { throw } })
```

## Verification

**Commands:**
- `pnpm vitest run tools/dev-stop` -- expected: all tests pass, the Windows-only ones included on this machine.
- `pnpm check` and `pnpm test` -- expected: pass.

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 18 findings — high 0, medium 2, low 12, false 2, maybe-false 2
- findings:
  - `medium` `patch` (blind) The failure test calls `powershell.exe` itself and bypasses `listenersWindows` and `powershell()`, so an error swallowed in the TypeScript layer passes every test — the test now mocks `node:child_process` to rewrite the cmdlet name and asserts that `listenersWindows(DEFAULT_PORT)` throws with `CommandNotFoundException` and the missing name in `stderr`. A mutation that wraps `powershell(...)` in `catch { return [] }` fails only that test. `listenerScript` is no longer exported, since no test imports it.
  - `low` `defer` (blind) `snapshotWindows`, the path to "nothing listens", has no test with a failing query — deferred to the frontmatter `deferred` list. It is untested from before this change, and a seam into it is new surface.
  - `false` `reject` (blind) The status-1 assertion cannot tell the rethrow from a parse error — a parse error in `listenerScript` also breaks the free-port and listener tests, which call the same script. The patched test also asserts `CommandNotFoundException` in `stderr`.
  - `low` `reject` (blind) Only a missing cmdlet is tested, not access denied or another CIM error — the guard rethrows every id except `CmdletizationQuery_NotFound*`. Denied access cannot be reproduced in a unit test without the extra seam this finding asks for.
  - `false` `reject` (blind) The ledger entry is not removed in the diff — the intent assigns `deferred-work.md` to the caller, which removes the entry in the branch's last commit.
  - `low` `reject` (blind) The AC is about CLI output, but no test runs `main` — the entry guard keeps `main` out of tests by design (`isInvokedDirectly`). `main` sends a thrown query error to its rejection handler, which exits 1. After the patch the tests reach the product function that `main` calls. A CLI harness would be new complexity for a developer-only tool.
  - `low` `reject` (blind) The free-port test can race with another bind of the port it just freed — Windows hands out ephemeral ports in rotation, so an immediate reuse within the ~2 s window is unlikely. A retry loop is added complexity.
  - `low` `reject` (blind) Neither `execFileSync` call has a `timeout` — `powershell()` had none before this change, the vitest timeout bounds the test, and a hung CIM query is not seen in everyday use.
  - `low` `reject` (edge) A transient query failure in the stop poll after `taskkill` now aborts without naming the killed PIDs — this is the intended loud failure: before the change, the same case printed "port is free". Retrying inside the poll adds a branch for a case nobody has seen.
  - `low` `reject` (edge) The free-port test races on port reuse — duplicates the blind-layer race row, rejected on the same grounds.
  - `low` `defer` (edge) The failure test does not exercise the `snapshotWindows` composition — shares its root cause with the deferred `snapshotWindows` row.
  - `medium` `patch` (verification-gap) The "fails loudly" test does not go through `listenersWindows` — same root cause as the first blind row, fixed by the same patch.
  - `low` `defer` (verification-gap) `snapshotWindows` is not tested with a failing query — the layer filed it as `defer`, and it shares the deferred `snapshotWindows` row.
  - `low` `reject` (intent) The intent's surface is the CLI, and the tests reach only the function — same as the blind CLI row, rejected on the same grounds.
  - `maybe-false` `reject` (intent) The tested failure (missing cmdlet) is not one of the named causes, and the stability of the not-found id rests on one probe — to settle it, run the query on another PowerShell version or a non-English locale. `FullyQualifiedErrorId` is a fixed identifier, not a localized message, so if the claim were true it would be low.
  - `maybe-false` `reject` (intent) The failure test runs outside the product call path — resolved by the patch above. The remaining claim, that `powershell()` turns a non-zero exit into a throw, is now covered by the patched test, so if true it would be low.
  - `low` `reject` (intent) `snapshotWindows` is not covered in tests — duplicates the deferred `snapshotWindows` row. The route is shared.
  - `low` `reject` (intent) The Windows tests are skipped on non-Windows runners — the code under test runs only on Windows, and the POSIX path is unchanged.

## Auto Run Result

Status: done

- **Change:** `listenerScript` runs `Get-NetTCPConnection` with `-ErrorAction Stop` inside `try/catch`. Only the `CmdletizationQuery_NotFound*` error reads as an empty list. Every other error is rethrown, so PowerShell exits non-zero, `execFileSync` throws, and `pnpm dev:stop` exits 1 with the error. It no longer prints "port is free" or "nothing listens". The change covers both `listenersWindows` (the stop poll) and `snapshotWindows` (the first snapshot).
- **Files:**
  - `tools/dev-stop/dev-stop.ts`: the guarded `listenerScript`, and `listenersWindows` is exported for tests.
  - `tools/dev-stop/dev-stop.test.ts`: three Windows-only tests: a free port reads `[]`, a loopback listener reads the test's PID, and a mocked failing query makes `listenersWindows` throw.
- **Review:** 18 findings. 1 medium patched (reported by two layers). 1 low deferred (`snapshotWindows` untested, reported by three layers). 2 false and 2 maybe-false rejected, and the other lows rejected with the reasons in the triage log. Patched counts: high 0, medium 1, low 0.
- **Follow-up review:** not recommended. It is a first pass with no high patched and only one medium patched.
- **Verification:**
  - `pnpm vitest run tools/dev-stop`: 27/27 passed, the three Windows tests included.
  - `pnpm check`: passed.
  - `pnpm test`: 1434/1434 passed. One earlier run had a failure in `tools/boundary-check/boundary.test.ts` that the diff does not touch. It passed alone and on the next two full runs, so it is a flake.
  - A manual mutation check (the implementer's) confirmed that the failure test catches an error swallowed in `listenersWindows`.
- **Residual risks:** Denied access was not reproduced for real. It uses the same rethrow path as the tested missing cmdlet. The Windows tests run only on Windows, and CI runs on Ubuntu with `pnpm check` only.
