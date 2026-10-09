---
title: 'poesessid retro item 1: real policy headers in the cookie fixtures'
type: 'chore'
created: '2026-10-04'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Retrospective `docs/stories/archive/spec-poesessid-sync/RETROSPECTIVE.md` finding R2 (action item 1). The CAP-3 shell test (`packages/sync/src/sync-batch.test.ts`, "a 2xx that is not live") and the CAP-4 canary downgrade (`packages/sync/src/session-auth.canary.test.ts`, kind `not-live`) pass only because the baseline and fetch answers carry no `X-Rate-Limit-Policy`, so *none = none* makes a fetch `tested` against the search count (IMPLEMENTATION-NOTES §13.2, §13.4). The real API always sends the policy header (retro O1), so these tests pin a request shape that never occurs, and the realistic quiet downgrade, a search 2xx with the baseline's rule count, is untested at the shell and canary level.

**Approach:** Give the baseline search, the live probe and the fetch answers in both fixtures real `X-Rate-Limit-Policy` headers (a search policy and a separate fetch policy). Move the `not-live` downgrade case onto the next entry's cookie-carrying search. Keep the 401/403 downgrades on the fetch. The production code and §13.2 do not change (the operator ruled R1 theoretical).

</frozen-after-approval>

## Implementation Notes

- `packages/sync/src/sync-batch.test.ts` (session-probe block): the baseline search answers `trade-search-request-limit` with one rule, the fetch `trade-fetch-request-limit` with one rule, and `LIVE` the search policy with two rules. `probingThen`'s `after` now also receives the request; its default gives a later cookie search the live headers and leaves a fetch on the fake's own answer, so the harness no longer fakes a fetch as live (retro P2). The CAP-3 table keeps 401/403 on the fetch; the `not-live` case is a new test with two entries where every answer after the probe equals the cookie-less one, so the second entry's search is the `tested` downgrade. The `live` test now notes that its fetch, with fewer rules under its own policy, is not tested.
- `packages/sync/src/session-auth.canary.test.ts`: `inputs` and `capturing` take the tracked entries (default unchanged). The downgrade block uses the same real policies and two entries; `not-live` answers the second entry's cookie search with the baseline count under the search policy, quoting the cookie. The probe/throw block above it is untouched (its fetch throws, so no 2xx policy comparison happens there).
- Mutation check: giving the fetch the search policy in `sync-batch.test.ts` fails the `live`, the new search-downgrade and the hold-off-past tests, so the fixtures now pin the policy split.
- Real policy names in test files are allowed: `test/no-hardcoded-rate-limits.test.ts` skips `*.test.ts`.
- Verified: `pnpm check` exit 0; `pnpm test` 1996 passed (one case removed from the CAP-3 table, one test added).
- Canary mutation check: giving `FETCH_HEADERS` the search policy fails all three `not-live` cases, because the GET then downgrades and `downgraded()` stays 0.

## Review Triage Log

Layers: Blind Hunter, Deferred Ledger Auditor (zero findings: the spec carves nothing out).

- Retro action item 5 (the ledger entries) not done here: **medium, out of scope**. The user asked for item 1 only. Item 5 names this dev loop as its owner, so it is reported to the user rather than done without being asked.
- The retro still says that no item has been applied: **low, rejected**. `RETROSPECTIVE.md` records the epic at 0ce556e. Applying an item does not make that record wrong.
- V8 lists "no shell-level search downgrade" as an accepted gap: **low, rejected** for the same reason. This spec is where the gap is closed.
- The retro's line citations moved: **false**. They cite the reviewed commit, and that commit does not change.
- The story file is unfinished (status, triage): **false**. The workflow sets status and triage after review. That is this edit.
- The canary mutation was not recorded, and the chunk-level case did not assert `downgraded()`: **low, patched**. The canary mutation was run and is recorded above, and `expect(http.downgraded()).toBe(1)` was added.
- No tripwire test for R1: **low, rejected**. The operator ruled R1 theoretical. Pinning that behavior would mean a new governor test, which is beyond a simple fix and outside this item.
- Header fixtures are duplicated across the two files: **low, rejected**. A shared fixture module is new structure. Retro A6 / action item 3 already tracks fixture duplication.
- The default `after` replaced headers instead of merging them: **low, patched**. It now spreads `answer.headers` before `LIVE.headers`.
- The search-downgrade test did not show that the first entry was priced: **low, patched**. It now asserts that the first entry has `lastSearchId: 'S1'` and `price.state: 'priced'`.
- The `Account` rule values look invented: **low, patched**. The fixtures now say the rule name and the bucket are illustrative. Only the policy names are what the live API returns.

