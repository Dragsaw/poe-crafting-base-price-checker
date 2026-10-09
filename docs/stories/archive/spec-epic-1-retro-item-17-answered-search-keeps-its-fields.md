---
title: 'Epic 1 retro item 17: an answered search keeps lastSearchId and lastSearchLeague when the fetch leg fails'
type: 'bugfix'
created: '2026-09-26'
status: 'done'
baseline_revision: '910a2c47e906f51574ae0d77fa432f478c2f513c'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When the search is answered and the fetch leg then yields (429, 5xx, timeout) or returns another 4xx, `createPricingStep` returns `stamped` and drops the answered `lastSearchId` and `lastSearchLeague` (retro finding L-E2). AD-9 rev 21 (`ARCHITECTURE-SPINE.md:677`) rules the unit is the request: "an answered search sets lastSearchId and lastSearchLeague whatever the fetch leg returns". The dropped id hides the AD-24 trade link for that entry.

**Approach:** In `packages/sync/src/pricing/price-entry.ts`, the fetch-leg yield and the fetch-leg `MalformedRequestError` carry `searched`, not `stamped`. Tests first, in `price-entry.test.ts`. Fix the module header table in `price-entry.ts` and the 429/5xx/timeout matrix row in spec 1.7 to match. When done, set `epic-1-retro-item-17-an-answered-search-keeps-its-lastsearchid` to `done` in `sprint-status.yaml`.

</frozen-after-approval>

## Implementation Notes

- Search-leg yield and search-leg 4xx keep `stamped`: no search was answered, so the search fields stay as published.
- The price state is unchanged on both fetch-leg paths: `searched` spreads `stamped`, so it keeps `before.price`.
- The `DatasetEntrySchema` doc comment in `packages/contracts/src/dataset.ts` repeats the "receives no answer" sentence that L-E2 names as reading the other way. It gets one clause saying the unit is the request, so it agrees with AD-9 rev 21.
- Spec 1.7 is `done`, and its matrix sits inside its frozen block. The user asked for this edit as part of the rev 21 ruling.
- `PREVIOUS` in `price-entry.test.ts` now carries `lastSearchLeague: 'Standard'`, a past league. With the active league, a test could not tell a kept `lastSearchLeague` from a set one. The search-leg 429/503 and 400 tests, which use `PREVIOUS`, now also prove that both fields stay unchanged.
- Serena's `replace_content` rewrote `price-entry.ts` and `price-entry.test.ts` with CRLF line endings. They are restored to LF.
- Files changed: `price-entry.ts` (the fetch-leg returns, the inline comment, the header table), `price-entry.test.ts`, `dataset.ts` (doc comment), spec 1.7 (the 429/5xx/timeout row and the Other 4xx row), `sprint-status.yaml`.
- Verified: `pnpm run check` is clean. `pnpm test` passes 644 of 644.

## Review Triage Log

Blind Hunter, one pass:

- `medium` `defer`: a fetch answered 200 with an unparseable body throws `UnexpectedTradeResponseError` with no entry, so the answered search fields are not published. This is real (`run-chunk.ts` publishes only for `MalformedRequestError`), but the fix needs an error payload and a publish path, which overlaps retro item 3. Logged in `deferred-work.md`.
- `low` `patch`: the `DatasetEntrySchema` doc comment read as contradicting itself. It is reworded around the request as the unit.
- `low` `patch`: three `run-chunk.ts` comments said a failing or yielded entry is "stamped with `lastAttemptedAt`" alone. They now name the search fields.
- `low` `patch`: the Implementation Notes overstated the search-leg coverage. The search-timeout test uses an empty dataset. The note is narrowed.
- `low` `patch`: the spec 1.7 review log argued for `stamped` next to the updated matrix. A superseded note is appended.
- `low` `reject`: no `run-chunk.test.ts` case pins a fetch-leg failure in the published dataset. The runner publishes `result.entry` / `error.entry` without looking at it, and the step tests pin that entry exactly. A runner test would only retest the step.
- `false`: "the spec status disagrees with sprint-status". The spec status is set to `done` at finalize, in the same commit.
- `false`: "the spec has no acceptance criteria". A oneshot spec leaves out that section by design, and the Intent names the checkable outcomes. The tests pin them.
- `low` `reject`: the retro document still lists L-E2 as open. The retro is a dated record, and `sprint-status.yaml` tracks the closure.
