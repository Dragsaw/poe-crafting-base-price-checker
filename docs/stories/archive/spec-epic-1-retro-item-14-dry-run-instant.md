---
title: 'Epic 1 retro item 14: the dry-run clock derives from the snapshot'
type: 'feature'
created: '2026-09-26'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `pnpm sync:dry` fixes its clock to the constant `DRY_RUN_INSTANT` (`2026-01-01T00:00:00.000Z`). Now that a live dataset exists with real `lastAttemptedAt` values, every entry's age against that constant is negative, so the dry run predicts an order that does not match the order a live run would select next (epic-1-retro-item-14, R-9/L-E5).

**Approach:** Ruled in `AGENT-WORKFLOW.md` (spine revision 21, `.memlog.md:328,336`) and already documented there verbatim:

- Default the dry run's clock to the latest `lastAttemptedAt` across the dataset snapshot's entries; when no entry carries one, fall back to the existing fixed instant `2026-01-01T00:00:00.000Z`.
- Add a `--at <iso>` CLI flag on `pnpm sync:dry` that sets the clock explicitly, overriding the default.
- The dry run still never feeds `notBefore` (AD-8's cross-run penalty, in `data/sync-progress.json`) into the run it simulates — it ignores that instant for pacing — but it reads the real `data/sync-progress.json` when present and prints its `notBefore` in the report, so an agent can see a pending penalty the dry run does not enforce.
- Same inputs still print the same bytes (the `pnpm sync:dry` reference test in `dry-run.test.ts` covers this and needs no behavioural change, since the default clock is a pure function of the snapshot).

</frozen-after-approval>

## Implementation Notes

- `packages/sync/src/dry-run.ts`: added `latestAttemptedAt(entries)`, a `DryRunOptions` type with `at?: string`, and wired the default clock to `options.at ?? latestAttemptedAt(previous) ?? DRY_RUN_INSTANT`. Added `progress?: string` to `DryRunSnapshot` (the real `data/sync-progress.json`, read but never fed into the fake filesystem, so `runChunk` still never sees it and cannot defer). Parsed its `notBefore` separately and surface it on `DryRunReport` only when present (same optional-spread convention as `pinnedStarvation`). `readRepositorySnapshot()` now also reads `PROGRESS_PATH`. Added `parseCliOptions` (`node:util` `parseArgs`, `strict: true`) for `--at <iso>`, wired into `main()`.
- `packages/sync/src/dry-run.test.ts`: updated the "dataset snapshot" describe block's expectations from the old fixed `DRY_RUN_INSTANT` to the snapshot's own latest `lastAttemptedAt` (introduced named constants `A_ATTEMPTED_AT`/`B_ATTEMPTED_AT`); this is the only place existing behaviour changed, everywhere else the tests never supply a dataset so `previous` is empty and the fallback to `DRY_RUN_INSTANT` keeps every other assertion unchanged. Added tests for the `--at` option (unit and spawned-CLI), and a new describe block for `notBefore` (surfaced without deferring the run; omitted when absent).
- Verified manually: `node packages/sync/src/dry-run.ts` now stamps entries with the repository dataset's real latest `lastAttemptedAt` instead of the stale `2026-01-01` constant; `--at <iso>` overrides it; an unknown flag exits non-zero via `parseArgs`'s `strict` mode.
- Blind-hunter review (8 findings) applied 4 fixes: `--at` now validates against `IsoTimestampSchema` and fails loudly naming the flag; an invalid `data/sync-progress.json` now throws a typed refusal naming the file (`readProgressNotBefore`), matching the module's documented convention for every other input; corrected the now-stale `DRY_RUN_INSTANT` doc comment; added CLI tests for a bad `--at` value and an unrecognised flag, and a unit test for an invalid progress file. See Review Triage Log for the four findings not acted on.
- `pnpm check` and `pnpm test` (651 tests, 56 files) both pass after the fixes.

## Review Triage Log

Blind-hunter, one context-free pass over the diff.

- `high`→`patch`: `--at` accepted any string with no validation; a typo silently produced `NaN` timing and a misleading `dispossessed` outcome instead of a clear error. Fixed: validated against `IsoTimestampSchema`, throws naming `--at`.
- `medium`→`patch`: an invalid `data/sync-progress.json` threw a raw, unhandled `ZodError` with no file context, unlike every other input file's documented "typed refusal naming the file". Fixed: `readProgressNotBefore` wraps the parse and names `PROGRESS_PATH`.
- `low`→`patch`: the CLI's usage-error path (bad `--at`, unknown flag) was untested. Fixed: added two spawned-process tests.
- `low`→`patch`: `DRY_RUN_INSTANT`'s doc comment still framed it as the sole determinism mechanism after this change demoted it to the no-dataset fallback. Fixed: reworded.
- `low`→rejected: the `pnpm sync:dry` reference test hardcodes `Object.keys(report)` without `notBefore`, which holds only because the committed `data/sync-progress.json` has none today. Same convention already applies to the pre-existing optional `pinnedStarvation` key; the test fails loudly and points straight at the cause the day a `notBefore` is committed, which is the intended, self-diagnosing behaviour, not a defect.
- `low`→rejected (stale, not fixable here): the frozen Intent cited a line number in `dry-run.test.ts` that later edits in this same diff moved. Corrected before this spec was ever human-approved, so it was never truly frozen; not a defect in the shipped code.
- `low`→rejected: `latestAttemptedAt`'s tie-break (first-seen wins among equal maxima) is undocumented and untested. A tie still resolves deterministically given the same input order, so no incorrect behaviour follows; not worth a dedicated test.
- `low`→rejected: nothing but prose stops a future edit from feeding `DryRunSnapshot.progress` into the simulated run the way `report` is. Speculative; no present defect, and guarding against a hypothetical future edit is out of scope for this change.
