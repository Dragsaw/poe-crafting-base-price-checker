---
title: 'Deferred: a search answered 200 with an unparseable body stamps lastAttemptedAt'
type: 'bugfix'
created: '2026-09-27'
status: 'done'
baseline_revision: '71d9cb1e898303b6e495880a2d1e4c1c7bdc4573'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** When the search answers 200 with a body that has no top-level `id` and `result`, `createPricingStep` throws `UnexpectedTradeResponseError` with no `entry`, so `runChunk` publishes nothing for that entry and its `lastAttemptedAt` is lost, although `sync` issued a request (AD-9 *Timestamps*: "present wherever `sync` issued a request").

**Approach:** The search-leg throw passes `stamped` (the published entry with `lastAttemptedAt` set, the search fields and the price state unchanged). The runner already publishes the `entry` of any `UnexpectedTradeResponseError` that carries one, so no runner logic changes; only its comments and the runner test for the search case follow.

## Boundaries & Constraints

**Always:** The published entry is `stamped` exactly: `lastAttemptedAt` set to the attempt time, `lastSearchId`, `lastSearchLeague` and the price state as published before (the search was not answered, so AD-16's search fields are not set). The failure record stays `run-failure` / `unrecoverable-error` naming the entry. `notBefore` stays cleared for this error. Tests first.

**Never:** Change the fetch-leg behaviour, the failure record shape, `notBefore` handling, any contracts schema, or any planning document. Edit `docs/stories/deferred-work.md` or `sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Search body unparseable | search 200 `{}`, dataset holds `PREVIOUS` | error carries `entry` = `{ ...PREVIOUS, lastAttemptedAt: NOW }`; no fetch sent | `UnexpectedTradeResponseError` thrown, `requestKind: 'search'` |
| Search body unparseable, never published | search 200 `{}`, empty dataset | error carries `entry` = `{ entryKey, price: never-synced, lastAttemptedAt: NOW }` | thrown |
| Runner publish | step rejects with a search-leg `UnexpectedTradeResponseError` carrying a stamped entry | dataset holds that entry; progress `notBefore` absent; report `unrecoverable-error` naming the entry | rethrown, lock released |

</intent-contract>

## Code Map

- `packages/sync/src/pricing/price-entry.ts` -- search-leg throw (line ~316, `new UnexpectedTradeResponseError(entryKey, 'search', 'no top-level `id` and `result`')`): pass `stamped` (defined at line ~296). Class doc comment (line ~72–79) says "On the search there is no answered search to keep, so `entry` is absent": rewrite for the stamped entry. Header table row "2xx, body of the wrong shape" (line 18) says "on the search: nothing published": change to `lastAttemptedAt` stamped, search fields and price state kept.
- `packages/sync/src/chunk/run-chunk.ts` -- failure path (line ~887) already publishes `error.entry` for every `UnexpectedTradeResponseError`; no logic change. Comments that name the fetch only: module header (line ~82–83, "a 2xx body of the wrong shape on the fetch") and the inline comment (line ~880, "An unexpected fetch body also publishes…"): widen to both legs.
- `packages/sync/src/pricing/price-entry.test.ts` -- line ~371 test "a search answered 200 with {} …": now asserts `entry` equals `{ ...PREVIOUS, lastAttemptedAt: NOW }` with `dataset: [PREVIOUS]` (fixture at line 110 has a past league, so kept search fields are visible).
- `packages/sync/src/chunk/run-chunk.test.ts` -- line ~1417 test "unparseable search body: … entry 3 unchanged …": the failure carries a stamped entry for C, and C's published entry equals it. Model on the fetch-leg test above it (line ~1372).

## Tasks & Acceptance

**Execution:**
- `packages/sync/src/pricing/price-entry.test.ts` -- flip the search-leg unexpected-body test to assert the stamped entry -- pins the step's payload.
- `packages/sync/src/chunk/run-chunk.test.ts` -- flip the "unparseable search body" runner test to a stamped carried entry published verbatim -- pins the publish path.
- `packages/sync/src/pricing/price-entry.ts` -- pass `stamped` on the search-leg throw; update the class doc and the header table row.
- `packages/sync/src/chunk/run-chunk.ts` -- widen the two comments to both legs.

**Acceptance Criteria:**
- Given a search answered 200 with `{}`, when `runChunk` runs the pricing step, then the published dataset entry carries the new `lastAttemptedAt` and its previous search fields and price state.
- Given the same run, when the report is written, then it holds one `run-failure` record with reason `unrecoverable-error` and the entry key, and progress has no `notBefore`.

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 8 findings — high 0, medium 0, low 5, false 3, maybe-false 0
- findings:
  - `[low]` `patch` Blind: the new runner-test comment "Only a MalformedRequestError writes the abort notBefore" omits `LeagueRequestRejectedError` (`rejected` in `run-chunk.ts`) — reworded to name a rejected request.
  - `[low]` `reject` Blind: `entry` stays optional on `UnexpectedTradeResponseError` although both production throws now pass one — a future throw site that omits it is hypothetical, and making it required changes the class surface and `sync.test.ts`, which is more than a direct correction.
  - `[low]` `patch` Blind: the runner test's carried entry is never-synced with no search fields, so it cannot show previous search fields and price state published verbatim — the fixture now carries a non-default price and previous search fields. The end-to-end step-plus-runner half is rejected on the source spec's precedent: the step test pins `error.entry` and the runner publishes it unread.
  - `[low]` `patch` Blind: the never-published step test does not assert `requestKind` or that no fetch was sent — both assertions added.
  - `[low]` `reject` Blind: matrix row 2 lists less than row 1 — its fix edits this spec.
  - `[false]` `reject` Blind: the spec does not say how the ledger entry is removed — the invocation intent assigns `deferred-work.md` to the caller.
  - `[false]` `reject` Blind: the header-table row repeats the 429/4xx rows' state text — each row states the AD-9 stamping rule for its cause and the last column tells them apart; nothing is misread into wrong code.
  - `[false]` `reject` Blind: Code Map quoting and line anchors — its fix edits this spec, and the anchors are marked approximate.
- Edge case hunter: no findings. Verification gap: no findings. Deferred ledger audit: no findings.
- Intent alignment auditor: descriptive, no findings. The diff implements the literal reading (the search-leg throw passes `stamped`, the runner test flipped) with the comments kept consistent; it notes the step-to-runner seam is joined by reading, not by a test, as the source spec also accepted.

## Verification

**Commands:**
- `pnpm check` -- expected: clean
- `pnpm test` -- expected: all pass

## Auto Run Result

- **Summary:** When the search answers 200 with an unparseable body, the `UnexpectedTradeResponseError` now carries `stamped`, and the `runChunk` failure path publishes it. The entry's `lastAttemptedAt` therefore reaches the dataset, as AD-9 *Timestamps* requires. The search fields and the price state stay as published before, `notBefore` stays cleared, and the runner logic is unchanged.
- **Files changed:**
  - `packages/sync/src/pricing/price-entry.ts` -- the search-leg throw passes `stamped`; the class doc and the header-table row follow.
  - `packages/sync/src/chunk/run-chunk.ts` -- two comments now cover both legs.
  - `packages/sync/src/pricing/price-entry.test.ts` -- the search case pins the stamped entry; a new never-published case pins it and that no fetch was sent.
  - `packages/sync/src/chunk/run-chunk.test.ts` -- the "unparseable search body" runner test publishes a carried entry that has a non-default price and previous search fields.
- **Review:** 8 findings, all from Blind; the other four layers found nothing. Patched 3 (all `low`): the notBefore comment, the runner fixture and the step-test assertions. Rejected: a required `entry` (`low`: a hypothetical future site, and the fix changes the class surface); matrix row detail and Code Map wording (the fix edits this spec); ledger removal (`false`: the caller owns it); header-row repetition (`false`: intended). Deferred: none.
- **Follow-up review recommended:** `false`. Patched: high 0, medium 0, low 3.
- **Verification:** `pnpm check` clean; `pnpm test` passed 1429 of 1429 in 101 files after the patches.
- **Residual risk:** no test joins the real step to `runChunk`; the source spec accepted the same seam. The source spec's Never line ("Change the search-leg `UnexpectedTradeResponseError`") described that spec's scope and is now historical.
