---
title: 'Epic 2 retro item 22 review: switch the refusal cause on the envelope reason exhaustively'
type: 'refactor'
created: '2026-09-27'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/spec-epic-2-retro-item-22-refusal-cause.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The code review of `78db4da..ec38dce` found that `fetchOne` in `packages/web/src/load/load-artifacts.ts` splits the refusal cause with `result.reason !== 'invalid'`. If a later change adds a reason to `EnvelopeResult`, that reason becomes `cause: 'version'` and the compiler gives no signal.

**Approach:** Switch on `result.reason`, with one case per reason, as `parseEnvelope` in `packages/contracts/src/envelopes.ts` does. The switch has an exhaustive `never` default, so a new reason is a compile error. Behavior does not change: `unknown-major` and `malformed-version` give `version`, and `invalid` gives `version` when no string version is declared and `content` otherwise.

</frozen-after-approval>

## Implementation Notes

- `packages/web/src/load/load-artifacts.ts` `fetchOne`: the `if (result.reason !== 'invalid')` split is now a `switch (result.reason)` with a `default: return result satisfies never;`. The package had no `never` helper, so the check is inline.
- No test change: behavior is the same, and the existing loader and screen matrices cover every case. `pnpm check` exit 0; `pnpm test` 93 files, 1187 passed.
- Exhaustiveness proof: with the `'malformed-version'` case deleted, `tsc -p packages/web` fails with TS1360 ("does not satisfy the expected type 'never'") at the default. The case was restored.
- `docs/stories/spec-epic-2-retro-item-22-refusal-cause.md`: ticked the one `[Review][Patch]` finding. The `### Review Findings` section itself came from the code review of `78db4da..ec38dce` and was uncommitted. It is committed separately, before this fix.


## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 7 blind findings in 8 rows (the bookkeeping finding is split in two), ledger 0 — high 0, medium 0, low 7, false 1, maybe-false 0
- findings:
  - `low` `reject` (blind) If a reason unknown to the types arrives at runtime, `satisfies never` returns the raw envelope as a `Fetched`. — `contracts` and `web` build together through `tsc -b` in one workspace, so skew between them cannot reach runtime. A throwing guard would guard a path nobody has shown is reachable.
  - `low` `reject` (blind) `parseEnvelope` gets exhaustiveness from TS2366 with no `default`, and this change uses a `never` default. — The frozen Intent picks the `never` default. Both idioms fail at compile time.
  - `low` `patch` (blind) Nothing proves the exhaustiveness. — Recorded a manual proof in Implementation Notes: deleting a case gives TS1360.
  - `low` `reject` (blind) `declaredVersion` restates the `VersionProbeSchema` predicate, so the two can drift. — This predates the change and was ruled in item 22's Code Map. The fix needs a new reason in `@poe/contracts`, which item 22 forbids.
  - `false` `reject` (blind) The frontmatter still reads `in-progress`. — The review ran before finalize, and finalize sets `done`.
  - `low` `reject` (blind) The parent finding's anchor `load-artifacts.ts:116` is out of date. — The anchor records the review as it was, and a review record is not rewritten.
  - `low` `patch` (blind) The uncommitted `### Review Findings` section would land in the fix commit, and the notes call it a tick. — The review record is committed separately first, and the notes say so.
  - `low` `patch` (blind) The `invalid` comment hides the accepted non-object and non-string mapping. — Added a pointer to the item 22 review.
  - (ledger) Zero findings: the spec has no carved-out items.
