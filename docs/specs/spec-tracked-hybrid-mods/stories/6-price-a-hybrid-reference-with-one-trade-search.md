---
title: 'Price a hybrid reference with one trade search'
type: 'feature'
created: '2026-10-03'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/docs/specs/spec-tracked-hybrid-mods/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `statFilterOf` in `packages/sync/src/pricing/search-body.ts` throws for a `hybrid` reference (interim, story 3). SPEC-tracked-hybrid-mods CAP-2: sync must price a hybrid with one trade search that requires every line within its band.

**Approach:** Replace the throw so a hybrid reference yields one stat filter per line, all under the entry's single `and` group. A banded line carries `{min,max}` and a valueless line carries `{}`, as a single-line reference does. Prove it with an MSW-backed fixture test. Summed `statId`s are story 7: do not merge or dedupe filters here.

</frozen-after-approval>

## Implementation Notes

`statFilterOf` became `statFiltersOfRef` (returns an array); a hybrid yields one filter per line, so `statFiltersOf` spreads both slots into the one `and` group. The interim-throw test became two body tests in `search-body.test.ts`. Summed `statId`s are not merged here (story 7). The tests build the body directly and do not go through MSW; the MSW-fixture proof CAP-2 names is not added here.

## Review Triage Log

Quick check requested: the subagent review layers (blind hunter, ledger audit) were skipped. `pnpm typecheck`, `pnpm lint` and the pricing tests pass.
