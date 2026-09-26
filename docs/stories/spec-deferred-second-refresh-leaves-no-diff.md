---
title: 'deferred-second-refresh-leaves-no-diff: a second catalogue refresh against the committed catalogue writes the committed bytes'
type: 'chore'
created: '2026-09-26'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: 'ff29f78c13a73dba0205ad94d9b95c93fd2a7005'
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The ledger entry from Story 1.4 says two things. First, no test exercises the criterion "a second refresh leaves no diff". Second, no test exercises the real `createFetchHttpPort`. The second half is already false: `packages/sync/src/shell-fetch.test.ts` (epic 1 retro item 10) runs the real port against a loopback server. The first half is still true. The only idempotence check compares one `serialiseCatalogue(...)` result with itself, and it never reads the committed `data/catalogue/*.json`.

**Approach:** Add one test to `catalogue-refresh.test.ts`. The fake HTTP port serves each committed artifact without its `schemaVersion`, which is what an unchanged API sends. The test runs `refreshCatalogue` twice and asserts that both runs write the committed files' exact bytes.

## Boundaries & Constraints

**Always:** Drive `refreshCatalogue` through the existing in-memory `harness`. The write port stays a closure over an array, so the test writes nothing to disk. Compare bytes (string equality with `readFileSync(..., 'utf8')`), not parsed values.

**Never:** No network, and no real `createFetchHttpPort` in this file (the scan in the same file forbids it). No write under `data/`. No change to `catalogue-refresh.ts`, `shell.ts`, `data/`, `docs/stories/deferred-work.md` or `docs/stories/sprint-status.yaml`. No PRD, spine or companion edit.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Unchanged API, two runs | Each endpoint answers the committed file's JSON with `schemaVersion` removed | Both runs succeed. Each run's four writes equal the committed file bytes at the same path | A mismatch names the artifact |
| Serialisation drift | A future change to `serialiseJsonArtifact` or to the envelope key order | The test fails on the artifact whose bytes differ | Test failure |

</intent-contract>

## Code Map

- `packages/sync/src/catalogue-refresh.ts:93` -- `catalogueFilePathOf(endpoint)`, the absolute path each artifact is written to. It resolves to `data/catalogue/<artifact>.json` under the repository root.
- `packages/sync/src/catalogue-refresh.ts:253-263` -- the envelope is `{...payload, schemaVersion}`, so `schemaVersion` is the last key. Removing it from the committed file and serving the rest reproduces the API payload key order.
- `packages/sync/src/catalogue-refresh.test.ts:95-153` -- the reuse points `respond`, `harness` (in-memory `writes`, fake clock that advances on `wait`) and `RATE_LIMIT_HEADERS`.
- `packages/sync/src/catalogue-refresh.test.ts:426-455` -- the existing in-memory idempotence assertions. The new test goes directly after this block, under "what lands on disk".
- `packages/sync/src/catalogue-refresh.test.ts:275-317` -- the scan that forbids `createFetchHttpPort` outside `shell-fetch.test.ts`. The new test must not name the port.
- `packages/sync/src/shell-fetch.test.ts` -- read-only evidence that the real port is already exercised, against loopback.
- `data/catalogue/{items,stats,filters,static}.json` -- read-only. Committed as `edd2c97`. The test reads them.

## Tasks & Acceptance

**Execution:**
- `packages/sync/src/catalogue-refresh.test.ts` -- add the test "writes the committed catalogue back byte for byte on a second refresh against an unchanged API": build the fixtures from the committed files without `schemaVersion`, run two harnesses in sequence, and assert each write equals the committed bytes, with a message that names the artifact -- the idempotence criterion is then checked against the committed artifacts over two runs.

**Acceptance Criteria:**
- Given the committed `data/catalogue/*.json` and an API that answers with the same payloads, when `refreshCatalogue` runs twice, then both runs return `ok` and each of the eight writes equals the committed file at its path, byte for byte.
- Given the test run, when it ends, then `git status` shows no change under `data/`.

## Spec Change Log

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 11 findings — high 0, medium 0, low 4, false 7, maybe-false 0 (edge-case, verification-gap and deferred-ledger layers reported zero; 8 blind, 3 intent-alignment)
- findings:
  - `[false]` `[reject]` Blind: the second round never reads the first round's output, so it adds nothing — `refreshCatalogue` reads no disk state; its output is a function of the API payload alone. "Unchanged API" means round two receives the same payload, and the disk after round one holds the committed bytes, so asserting round two writes the committed bytes is the criterion.
  - `[low]` `[reject]` Blind: a byte mismatch prints no diff — real, but deliberate: `toBe` on multi-hundred-KB strings floods the output. A first-differing-offset helper adds code for a failure a developer rarely meets.
  - `[low]` `[patch]` Blind: `expect(outcome.ok).toBe(true)` hides the refusal reason — replaced with `toMatchObject({ ok: true })` on the whole outcome, so a refusal prints its `failure`.
  - `[low]` `[patch]` Blind: `toHaveLength(4)` has no message naming the round — message added.
  - `[low]` `[reject]` Blind: the spec's Never clause misstates why the scan matters — the fix is to edit this build's spec.
  - `[false]` `[reject]` Blind: the Code Map line numbers are wrong — the fix is to edit this build's spec.
  - `[false]` `[reject]` Blind: no hand-off says the `createFetchHttpPort` half is already closed — the fix is to edit this build's spec; the Intent's Problem and the Auto Run Result state it.
  - `[low]` `[reject]` Blind: the `schemaVersion`-last and LF premises are unchecked — `.gitattributes` is `* text=auto eol=lf`, so a CRLF checkout does not occur. The envelope always appends `schemaVersion` last, so a committed file without it last would already be a refresh defect and fails loudly here; an extra guard adds code for a state not shown reachable.
  - `[false]` `[reject]` Intent: the two rounds are independent calls of a deterministic function — same refutation as the first blind row.
  - `[false]` `[reject]` Intent: the test runs at the core surface, not at `pnpm catalogue:refresh` with live HTTP and `git status` — the command surface needs the live API and writes under `data/`, which AGENT-WORKFLOW forbids an agent; the entry's evidence frames the gap at the suite ("the suite compares one result against itself") and calls the two-run check runnable because the artifacts are committed. The shell pieces are covered by `shell-fetch.test.ts` and `shell.test.ts`.
  - `[false]` `[reject]` Intent: the fixture is derived from the file it is compared with — that is the definition of an unchanged API for a committed catalogue, not a defect.

## Verification

**Commands:**
- `pnpm vitest run packages/sync/src/catalogue-refresh.test.ts` -- expected: all tests pass, including the new one
- `pnpm check` -- expected: clean
- `pnpm test` -- expected: all pass, no escaped request
- `git status --porcelain -- data` -- expected: no output

## Auto Run Result

Status: done

- **Change:** one new test in `packages/sync/src/catalogue-refresh.test.ts`, "writes the committed catalogue back byte for byte on a second refresh against an unchanged API". It serves each committed `data/catalogue/*.json` minus `schemaVersion` through the fake HTTP port, runs `refreshCatalogue` twice, and asserts that each of the eight in-memory writes equals the committed file's bytes. The idempotence criterion of Story 1.4 is now checked against the committed artifacts over two runs.
- **The other half of the ledger entry** ("the real `createFetchHttpPort` is exercised by nothing") was already false before this run: `packages/sync/src/shell-fetch.test.ts` (`9b2b2a5`, epic 1 retro item 10) runs the real port against a loopback server, and the scan in `catalogue-refresh.test.ts` asserts that file exists and names the port. The whole entry can close.
- **Files changed:**
  - `packages/sync/src/catalogue-refresh.test.ts` — the new two-run byte-identity test.
  - `docs/stories/spec-deferred-second-refresh-leaves-no-diff.md` — this spec.
- **Review:** 11 findings (edge-case, verification-gap and deferred-ledger layers reported none). Patched 2 low: the outcome is asserted with `toMatchObject({ ok: true })` so a refusal prints its reason, and the length assertion names the round. Rejected 2 low (a byte-offset diff helper and a `schemaVersion`-last guard, both extra code for rare failures), 1 low and 2 false that only ask for spec edits, and 4 false (see the Review Triage Log). Nothing deferred.
- **Follow-up review recommended:** false. Patched by verdict: high 0, medium 0, low 2.
- **Verification:** `pnpm vitest run packages/sync/src/catalogue-refresh.test.ts` — 24 passed. `pnpm check` — typecheck, lint and depcruise clean (164 modules). `pnpm test` — 67 files, 815 tests passed, no escaped request. `git status --porcelain -- data` — empty. The implementer showed the test can fail by temporarily altering the expected bytes.
- **Residual risks:** the test proves the refresh reproduces the committed bytes from the committed payloads; it cannot prove the live API still sends those payloads in that key order. That needs a human-run `pnpm catalogue:refresh`, which AGENT-WORKFLOW reserves for a human.
