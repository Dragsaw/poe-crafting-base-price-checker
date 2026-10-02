---
title: 'Test the pre-kill snapshot reader of dev-stop'
type: 'chore'
created: '2026-10-02'
status: 'done'
baseline_revision: 'cab4c234536916b2d146bc8268257c439c451fb6'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** No test runs `snapshot` / `snapshotWindows` in `tools/dev-stop/dev-stop.ts`. Its `parseListenerJson(parsed.listeners)` call can be removed with every test still passing. The `@{ listeners = $l } | ConvertTo-Json` shape differs from the `-InputObject` query that `listenersWindows` tests cover.

**Approach:** Export `snapshot` and add a real-listener test that asserts `snapshot(port).listeners` contains `process.pid`.

## Boundaries & Constraints

**Always:** Keep `dev-stop.ts` importing only builtins. Match the style of the `listenerPids` and `listenersWindows` tests. Skip where the platform cannot query (same `canQuery` guard).

**Never:** Change the behavior of `snapshot`, `main` or the other functions. Do not export `snapshotWindows` or `main`. Do not edit the ledger or `sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Listening port | loopback server on a free port | `snapshot(port).listeners` contains `process.pid`; `processes` contains an entry with `pid === process.pid` | No error expected |
| Free port | port after the server closes | `snapshot(port).listeners` equals `[]` | No error expected |

</intent-contract>

## Code Map

- `tools/dev-stop/dev-stop.ts` -- `snapshot` (line ~257) is not exported; `snapshotWindows` calls `parseListenerJson(parsed.listeners)`.
- `tools/dev-stop/dev-stop.test.ts` -- `listenerPids` real-listener test (line ~249) is the pattern; `canQuery` guard and 30 s timeout.

## Tasks & Acceptance

**Execution:**
- `tools/dev-stop/dev-stop.ts` -- export `snapshot`, and export the `Snapshot` interface it returns -- lets a test reach the reader
- `tools/dev-stop/dev-stop.test.ts` -- add a `snapshot` describe with a real-listener test, listening then free -- pins the shape path

**Acceptance Criteria:**
- Given a loopback listener, when `snapshot(port)` runs, then `listeners` contains `process.pid` and `processes` has an entry for it.
- Given the listener closed, when `snapshot(port)` runs, then `listeners` is `[]`.
- Given `parseListenerJson` is removed from `snapshotWindows`, when the tests run on Windows, then a test fails.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `pnpm vitest run tools/dev-stop` -- expected: pass
- `pnpm check` -- expected: pass

### 2026-10-02 — Review pass
- verdicts: 15 findings — high 0, medium 1, low 3, false 4, maybe-false 0 (the rest are descriptive notes with no defect)
- findings:
  - `[medium]` `[patch]` Removing `parseListenerJson` from `snapshotWindows` left every test passing (edge-case claim, AC 3 without evidence) — confirmed by running the mutation: the first test still passed. Fixed by a `snapshot with an unreadable listener list` test that makes the query print a non-PID; the mutation now fails 1 test.
  - `[false]` `[reject]` Verification-gap: "toContain would fail without the parse" — disproved by the same mutation run.
  - `[low]` `[reject]` Port rebinding by another process between the two snapshots — random OS port; the `listenerPids` test has the same pattern.
  - `[false]` `[reject]` Vitest pool may run the test in another process than the server — server and query share one worker; the `listenerPids` test relies on the same fact.
  - `[false]` `[reject]` Test throws if cmdlets are denied — a loud failure is the intent; `listenersWindows` tests share it.
  - `[low]` `[reject]` Two snapshot calls share one 30 s timeout — the `listenerPids` test does the same.
  - `[low]` `[reject]` Array (several listeners) shape not covered — `parseListenerJson` unit tests cover arrays.
  - `[false]` `[reject]` `processes` checked by pid only — outside the entry, which concerns `listeners`.
  - `[false]` `[reject]` `skipIf(!canQuery)` also runs the POSIX reader — matches the `listenerPids` test; extra coverage, no harm.
  - `[false]` `[reject]` Ledger entry not removed — the caller removes it by design.
  - Intent-alignment: diff implements the entry's prescribed remedy; no other divergence.

## Auto Run Result

Status: done

- Summary: exported `snapshot` and `Snapshot`; added a real-listener test of `snapshot` and a shape-failure test that fails if `parseListenerJson` is removed from `snapshotWindows`.
- Files: `tools/dev-stop/dev-stop.ts` (exports), `tools/dev-stop/dev-stop.test.ts` (tests, mock flag `badShape`).
- Review: 1 patch applied (mutation gap), 0 deferred, the rest rejected as above.
- Follow-up review recommended: false.
- Verification: `pnpm vitest run tools/dev-stop` 39 passed; `pnpm check` passed; mutation run fails 1 test.
- Residual risks: the tests need PowerShell on Windows; elsewhere the real-listener test needs `lsof`.
