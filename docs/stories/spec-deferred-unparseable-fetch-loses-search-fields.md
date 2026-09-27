---
title: 'Deferred: a fetch answered 200 with an unparseable body keeps the answered search fields'
type: 'bugfix'
created: '2026-09-27'
status: 'done'
baseline_revision: 'ad453254f56c487ddd25eb820e5f5749cbb19b95'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      A search answered 200 with an unparseable body throws `UnexpectedTradeResponseError` with no entry, so the entry's `lastAttemptedAt` is not published although `sync` issued a request, against AD-9 *Timestamps* ("present wherever `sync` issued a request").
    evidence: |-
      Pre-existing; this spec's Design Notes leave it out of scope because the closed entry named only the fetch leg. In `packages/sync/src/pricing/price-entry.ts` the search-leg throw (`new UnexpectedTradeResponseError(entryKey, 'search', …)`) passes no entry, so the `runChunk` failure path publishes nothing for that entry. The fix is to pass `stamped` on that throw and flip the runner test for the entry-less case (`packages/sync/src/chunk/run-chunk.test.ts`, "unparseable search body").
    location: >-
      packages/sync/src/pricing/price-entry.ts (search-leg UnexpectedTradeResponseError throw)
    severity: low
---

<intent-contract>

## Intent

**Problem:** When the search is answered and the fetch then answers 200 with a body that has no top-level `result` array, `createPricingStep` throws `UnexpectedTradeResponseError` with no entry. `runChunk` publishes the failing entry only for a `MalformedRequestError`, so the answered search's `lastSearchId` and `lastSearchLeague` are lost, against AD-9 rev 21 ("whatever the fetch that follows it returns").

**Approach:** `UnexpectedTradeResponseError` gets an optional `entry: DatasetEntry`. The fetch-leg throw passes `searched`. The runner's failure path publishes `error.entry` when the error is an `UnexpectedTradeResponseError` that carries one, the same way it publishes a `MalformedRequestError`'s entry.

## Boundaries & Constraints

**Always:** The published entry is `searched` exactly: `lastAttemptedAt`, `lastSearchId`, `lastSearchLeague` set, the price state as published before. The failure record stays `run-failure` / `unrecoverable-error` naming the entry. `notBefore` stays cleared for this error (only a `MalformedRequestError` writes the abort `notBefore`). Tests first.

**Never:** Change the search-leg `UnexpectedTradeResponseError` (it keeps no entry, so its behaviour is unchanged). Change the failure record shape, `notBefore` handling, any contracts schema, or any planning document. Edit `docs/stories/deferred-work.md` or `sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fetch body unparseable | search 200 with id + results; fetch 200 `{}` | error carries `entry` = searched (search fields set, price state as before) | `UnexpectedTradeResponseError` thrown, `requestKind: 'fetch'` |
| Search body unparseable | search 200 `{}` | error carries no `entry`; no fetch sent | thrown as today |
| Runner publish | step rejects with a fetch-leg `UnexpectedTradeResponseError` carrying an entry | dataset holds that entry; progress `notBefore` absent; report `unrecoverable-error` naming the entry | rethrown, lock released |

</intent-contract>

## Code Map

- `packages/sync/src/pricing/price-entry.ts` -- `UnexpectedTradeResponseError` (line ~76): add `readonly entry?: DatasetEntry` and a fourth optional constructor parameter. Fetch-leg throw (line ~341) passes `searched`. The header table's "search answered" row already states the rule; add nothing to it unless a row contradicts.
- `packages/sync/src/chunk/run-chunk.ts` -- failure path (line ~783): `malformed ? [...stepEntries, error.entry] : stepEntries`. Extend it so an `UnexpectedTradeResponseError` with an `entry` also appends it; `notBefore` stays `malformed`-only. Module header (line ~80) lists what a throw publishes: add the unexpected-body case. Import the class beside `MalformedRequestError` (line 121).
- `packages/sync/src/pricing/price-entry.test.ts` -- lines 371–390: the two `UnexpectedTradeResponseError` tests. Extend them: the fetch case asserts `entry` equals the searched entry (use `PREVIOUS` in the dataset so kept price state and a changed `lastSearchLeague` are visible); the search case asserts `entry` is undefined.
- `packages/sync/src/chunk/run-chunk.test.ts` -- model on the test at line ~1304 ("4xx abort: entries 1–2 published, entry 3 stamped…"): a new test where entry C rejects with `new UnexpectedTradeResponseError(key(C), 'fetch', '…', searched)`.

## Tasks & Acceptance

**Execution:**
- `packages/sync/src/pricing/price-entry.test.ts` -- extend both unexpected-body tests as in the Code Map -- pins the step's payload.
- `packages/sync/src/chunk/run-chunk.test.ts` -- add the runner publish test -- pins the publish path.
- `packages/sync/src/pricing/price-entry.ts` -- add the optional `entry`, pass `searched` on the fetch leg, update the class doc comment.
- `packages/sync/src/chunk/run-chunk.ts` -- publish the carried entry on the failure path; update the header comment.

**Acceptance Criteria:**
- Given an answered search and a fetch answered 200 with `{}`, when `runChunk` runs the pricing step, then the published dataset entry carries the answered `lastSearchId` and `lastSearchLeague` and its previous price state.
- Given the same run, when the report is written, then it holds one `run-failure` record with reason `unrecoverable-error` and the entry key, and progress has no `notBefore`.

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 12 findings — high 0, medium 0, low 10, false 2, maybe-false 0
- findings:
  - `[low]` `defer` Blind: the search-leg gap (no `lastAttemptedAt` on an unparseable search answer) is named but not recorded — pre-existing and outside the closed entry; added to frontmatter `deferred` for the caller to append. The sub-claim that the Never list over-forbids ledger edits is not a code finding: the invocation intent sets it.
  - `[low]` `patch` Blind: the `price-entry.ts` consequence table has no row for a 2xx body of the wrong shape — a row was added.
  - `[low]` `reject` Blind: no test joins the real step to `runChunk` for this path — the step test pins `error.entry` exactly and the runner publishes `error.entry` without reading it, the same seam the retro item 17 spec rejected a runner retest for.
  - `[low]` `patch` Blind: the runner test's carried entry uses the default never-synced price, so it cannot show the entry is published verbatim — the fixture now carries a non-default price state.
  - `[low]` `patch` Blind + Verification gap (one root cause): no runner test sends an entry-less `UnexpectedTradeResponseError` — a sibling search-leg runner test was added.
  - `[low]` `patch` Blind: `malformed || error instanceof … ? … : …` relies on precedence — parenthesised.
  - `[low]` `patch` Blind: the search-leg step test gained a `dataset: [PREVIOUS]` no assertion reads — removed.
  - `[low]` `patch` Blind: the `run-chunk.ts` header states "clears `notBefore`" twice — reworded into two statements.
  - `[false]` `reject` Blind: the spec does not say whether the failing entry counts toward progress — its fix edits this spec; the runner already leaves a failing entry out of `completed` for every throw.
  - `[low]` `patch` Verification gap: runner path for an entry-less `UnexpectedTradeResponseError` untested — grouped with the Blind finding above.
  - `[false]` `reject` Edge case: a non-transport rejection of the fetch send loses the search fields — `sendLeg` rethrows only a non-transport fault (a programming error or unrecorded fixture), which is not an answer the fetch returned; failing loudly there is intended and predates this change.
  - `[low]` `defer` Deferred ledger audit: the search-leg `lastAttemptedAt` carve-out has no ledger entry — same item as the first row; in frontmatter `deferred`.
- Intent alignment auditor: descriptive, no findings. The diff implements the narrow reading (fetch leg only, class-specific publish).

## Design Notes

The field is optional because the search-leg throw has no answered search to keep, and the intent names only the fetch leg. Whether an unparseable search answer should stamp `lastAttemptedAt` (AD-9 *Timestamps*: present wherever `sync` issued a request) is a separate question and is not changed here.

## Verification

**Commands:**
- `pnpm check` -- expected: clean
- `pnpm test` -- expected: all pass

## Auto Run Result

- **Summary:** `UnexpectedTradeResponseError` carries an optional `entry`. The fetch-leg throw passes the answered `searched` entry, and the `runChunk` failure path publishes it, so an answered search keeps `lastSearchId` and `lastSearchLeague` when the fetch body is unparseable (AD-9 rev 21). `notBefore` stays `MalformedRequestError`-only. The search-leg throw is unchanged.
- **Files changed:**
  - `packages/sync/src/pricing/price-entry.ts` -- optional `entry` on the error, `searched` passed on the fetch leg, header table row and class doc.
  - `packages/sync/src/chunk/run-chunk.ts` -- failure path publishes a carried `UnexpectedTradeResponseError` entry; header comment.
  - `packages/sync/src/pricing/price-entry.test.ts` -- fetch case pins `entry`; search case pins its absence.
  - `packages/sync/src/chunk/run-chunk.test.ts` -- runner tests for the fetch-leg (entry published) and search-leg (nothing extra published) cases.
- **Review:** 12 findings. Patched 6 (all `low`): header table row, parentheses, header comment wording, non-default price in the runner fixture, an entry-less runner test, an unused test fixture. Deferred 1 (two rows, one item): the search leg does not stamp `lastAttemptedAt`. Rejected: an end-to-end step-plus-runner test (`low`: the step test pins the payload and the runner publishes it unread); progress accounting in the spec (`false`: fix edits this spec); a non-transport fetch rejection losing the fields (`false`: a programming fault, not an answer).
- **Follow-up review recommended:** `false`. Patched: high 0, medium 0, low 6.
- **Verification:** `pnpm check` clean; `pnpm test` 83 files, 1073 of 1073 passed, after the patches.
- **Residual risk:** any future `UnexpectedTradeResponseError` given an entry is published; only the fetch leg passes one. Serena was not available in this session, so code edits used Read, Edit and sed.
