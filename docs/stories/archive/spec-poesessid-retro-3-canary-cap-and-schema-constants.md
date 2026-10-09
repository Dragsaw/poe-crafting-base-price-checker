---
title: 'poesessid retro item 3: a loud cap on the canary session and schema constants in the sync fixtures'
type: 'chore'
created: '2026-10-04'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** This is action item 3 of `docs/stories/archive/spec-poesessid-sync/RETROSPECTIVE.md`, which covers findings V1 and A6.
- V1: `runSession` in `packages/sync/src/session-auth.canary.test.ts` stops only after two chunk-result lines. Its fake `sleep` and `wait` resolve at once. Fixture drift that refuses the inputs therefore gives a busy loop that starves Vitest's timeout. This is the hang that shipped to CI before 1186a98 and 0698562.
- A6: the sync test fixtures hard-code the schema versions that the build writes and reads. Every contract bump then turns into a bulk edit of literals, which was 81 diff lines for the progress bump of story 3. A hard-coded tracked version is also what caused the hang.

**Approach:**
- Count the fake `sleep`/`wait` calls in `runSession`. When the count passes a fixed cap, abort the session and then throw an error that names the cap and the lines captured so far, so the test fails with a reason.
- In the sync shell and chunk test fixtures, replace each literal that stands for the current version with the exported `@poe/contracts` constant. That covers progress, report, dataset/config/catalogue and weights.
- Keep the literals that pin a specific other version: an older minor, an unknown major, a malformed value, or a refusal message.

</frozen-after-approval>

## Implementation Notes

- Constants: `SYNC_PROGRESS_SCHEMA_VERSION`, `SYNC_REPORT_SCHEMA_VERSION`, `SUPPORTED_SCHEMA_VERSION` (the version the dataset and catalogue writers stamp, in `publish-dataset.ts` and `catalogue-refresh.ts`), and `WEIGHTS_SCHEMA_VERSION`. The tracked version already uses `TRACKED_SCHEMA_VERSION` (1186a98).
- Files: `session-auth.canary.test.ts`, `sync.test.ts`, `sync-batch.test.ts`, `dry-run.test.ts`, `chunk/run-chunk.test.ts` and `chunk/sync-report.test.ts`, all under `packages/sync/src/`. Retro A6 names the first three and run-chunk. The other two hold the same exact current-version literals.
- The rule applied: every written version a test expects, and every input at the current version, becomes a constant. An input at an *older minor* of progress or report stays a literal. Examples are `progressText` at `'1.0.0'`, the `'1.1.0'` progress seeds in sync-batch, dry-run and `progressWith`, and the previous reports at `'1.0.0'`/`'1.1.0'` in run-chunk. A reader compares only the major (`schema-version.test.ts`, "accepts an older minor"), so such an input survives a minor bump. A6 is therefore closed for minor bumps. A major bump re-authors those seeds on purpose. The test "reads a 1.1.0 progress file and writes 1.2.0" is renamed "... writes the current version".
- Weights inputs move from `'6.0.0'` to `WEIGHTS_SCHEMA_VERSION`, which follows `curation/check.test.ts`. Older-minor acceptance is pinned in `contracts`, as above.
- The unknown-major progress seeds move from `'2.0.0'` to `'9.0.0'`, like the report tests. A literal `'2.0.0'` would become the known major on the next progress major bump.
- Kept: `'3.0.0'`/`'abc'`/`'9.0.0'`/`'5.1.0'` (refusals) and the tracked `'1.0.0'` that feeds `trackedEarlierMajorMessage`.
- `runSession` counts its fake pauses (session `sleep` plus in-chunk `wait`). Past `MAX_SESSION_PAUSES = 200` it aborts and then throws `runSession: no second chunk line after 200 pauses; lines: …`. Measured headroom: with a cap of 5 the passing cases fail, and with a cap of 10 they all pass, so 200 is about 20 times the peak.
- Mutation check: with the canary's tracked version set to `'1.0.0'`, which is the exact fixture that 1186a98 replaced, the file fails 44 tests in seconds, and the session cases fail with that error. The drift that hung CI (retro P3) now fails fast.
- Not done, with entries in `deferred-work.md`: merging the three `inputs()` copies (new structure; the retro asks only for the constants), and a loud error for the silent 200-sleep guard in the `sync.test.ts` session harness (V1 names only the canary; that guard still ends the loop).
- Verified: `pnpm check` exits 0. `pnpm test` passes 1996 tests.

## Review Triage Log

Layers: Blind Hunter, Deferred Ledger Auditor.

- `sync-report.test.ts` still expected `'1.2.0'`: **low, patched**. Now `SYNC_REPORT_SCHEMA_VERSION`.
- The `'2.0.0'` unknown-major seeds flip on the next major: **low, patched**. Now `'9.0.0'`.
- Older-minor seeds break on a major bump: **low, rejected**. A major bump is a breaking contract change that re-authors fixtures on purpose. The note now says that A6 is closed for minor bumps.
- The weights change breaks the stated rule: **low, patched (notes)**. The rule covers progress and report seeds. Weights follows `curation/check.test.ts`, and `schema-version.test.ts` pins older-minor acceptance.
- No permanent test that the cap fires: **low, rejected**. A test of the test harness adds structure for a guard that only fires on fixture drift. The mutation check is recorded above.
- The cap of 200 was not measured: **low, patched**. The headroom was measured and is recorded above.
- The cap error can be lost if the command rejects after the abort, or the counter may not move: **low, rejected**. A rejection still fails the test loudly with its own error. Every session loop iteration either runs a chunk, which prints a line, or pauses.
- The two exclusions had no ledger entries (both layers): **medium, deferred**. Two entries were appended to `deferred-work.md`.
- The pre-fix hang was "not re-run": **false**. The mutation is the fixture that 1186a98 replaced, so it is the drift that hung CI.
- Assertions now follow the constants: **low, rejected**. That is the intent. `contracts` tests pin the literal values (`sync-progress.test.ts`, `sync-run-report.test.ts`, `schema-version.test.ts`).
- The notes cited drifting line numbers and a tooling note: **low, patched**. Both are removed.
