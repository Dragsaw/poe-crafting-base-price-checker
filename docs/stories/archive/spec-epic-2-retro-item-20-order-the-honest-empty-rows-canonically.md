---
title: 'Epic 2 retro item 20: order the honest-empty rows canonically across both unpriced groups'
type: 'bugfix'
created: '2026-09-27'
status: 'done'
baseline_revision: '5fb836a30832812b83b0efbdbaf35dc2a428623b'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/epic-2-retro-2026-09-27.md'
warnings: []
deferred:
  - summary: >-
      EXPERIENCE.md state 23 says every honest-empty EV cell holds no figure yet, which is false in a mixed reset where a no-listings row keeps an open question.
    evidence: |-
      Pre-existing wording (retro F3); sprint item 24 / F15 covers only the raw row note. Ledgered in docs/stories/deferred-work.md under "Deferred from: epic 2 retro item 20".
    location: >-
      docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md:849
    severity: low
---

<intent-contract>

## Intent

**Problem:** In the honest-empty state (EXPERIENCE state 23) the page prints "In canonical order, not ranked: …" (`list-statement.ts:15`), but `toDisplayRows` (`display-rows.ts:108-114`) prints every `noListings` row before every `notYetSynced` row. When a league reset happens mid-refill and some entries already read `no-listings` in the new league, the two groups interleave in canonical key order and the printed order is not canonical, so the statement is false (retro F3, action item 3, sprint id `epic-2-retro-item-20-…`). No test mixes the two groups (verification gap V2).

**Approach:** Keep the statement copy (human decision, story 2.7). When the list is honest-empty, print the unpriced rows as one sequence in canonical key order (`compareCanonicalKeys` on `entryKey`), across both groups. Share one honest-empty predicate between the statement and the row builder, so the statement and the order can never disagree. Add a mixed-group test at the rendered page and at `toDisplayRows`.

## Boundaries & Constraints

**Always:** The honest-empty predicate is the one `listStatement` already uses (`ordering` and `belowThreshold` empty, at least one unpriced row); it is defined once and both callers use it. Each row keeps its own money phrase and Price State: a `no-listings` row still reads *an open question*, a `not-yet-synced` row *no figure yet*. The comparator is `compareCanonicalKeys` from `@poe/contracts`. `unresolvable` and `belowThreshold` stay off the list.

**Never:** Do not change the trailing order outside the honest-empty state: with a non-empty `ordering`, or in the nothing-clears state, unpriced rows still trail as `noListings` then `notYetSynced` (story 2.3 decision 2026-09-26, option a). Do not change the statement copy, `core`'s `rank` groups, or any money phrase (the row note and state 23's "no figure yet" wording are UX item 24 / F15). Do not re-rank in `web`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mixed reset | nothing priced in the active league; `Coral Ring` and `Wide Belt` league-mismatch, `Gold Amulet` no-listings | honest-empty statement; rows `Coral Ring`, `Gold Amulet`, `Wide Belt`; EV `no figure yet`, `an open question`, `no figure yet`; no numerals | No error expected |
| Pure reset | every entry league-mismatch | unchanged: canonical order, all *no figure yet* | No error expected |
| Partial refresh | one entry priced above threshold, others mixed unpriced | ranked row first, then `noListings` group, then `notYetSynced` group; no statement | No error expected |
| Nothing clears | priced entries all below threshold, plus mixed unpriced | nothing-clears statement; unpriced rows grouped as today | No error expected |

</intent-contract>

## Code Map

- `packages/web/src/list/list-statement.ts:33-45` -- `listStatement`; the honest-empty test at `:34-43` is the predicate to extract (e.g. `isHonestEmpty(ranking)`), exported and reused by `listStatement`.
- `packages/web/src/list/display-rows.ts:52-115` -- `toDisplayRows`; `unpriced` builder at `:96-106`, the grouped concat at `:108-114`. Doc comment at `:52-60` describes the order and must name the honest-empty exception.
- `packages/contracts/src/canonical-key.ts:102` -- `compareCanonicalKeys`, the system's one tie-break comparator. `DisplayRow.key` is the `entryKey` (the serialised canonical key), and `core` sorts each group by it (`packages/core/src/rank.ts:131`, `:233-235`).
- `packages/web/src/App.tsx:131-132` -- the two call sites; both receive the same `ranking`, so no signature change is needed.
- `packages/web/src/list/display-rows.test.ts:24` -- existing partial-refresh grouping test (must stay green; it pins option a outside honest-empty).
- `packages/web/src/App.test.tsx:783-827` -- the league-reset page test; model the mixed-group page test on it (`rawEntry`, `priced(..., 'Standard')`, `unpriced(entry, { state: 'no-listings' }, …)`, `unitNames()`, `evCells()`, `numerals()`).
- `packages/web/src/test-support/list-fixtures.ts:74` -- `unpriced` fixture.
- `docs/stories/sprint-status.yaml` -- `epic-2-retro-item-20-order-the-honest-empty-rows-canonically`, `status: open` → `done` with `ref` to this spec.

## Tasks & Acceptance

**Execution:**
- `packages/web/src/list/list-statement.ts` -- extract and export the honest-empty predicate; `listStatement` calls it -- one definition for statement and order.
- `packages/web/src/list/display-rows.ts` -- when the predicate holds, sort the unpriced rows by `compareCanonicalKeys` on `key`; otherwise keep the grouped concat; update the doc comment -- the fix.
- `packages/web/src/list/display-rows.test.ts` -- add the mixed reset case (interleaved canonical order, per-row phrases, no numerals) and a nothing-clears case that keeps the grouping -- unit cover of the matrix.
- `packages/web/src/list/list-statement.test.ts` -- a mixed-group case is honest-empty -- predicate cover.
- `packages/web/src/App.test.tsx` -- add a page-level mixed-reset test beside the league-reset test -- outermost surface.
- `docs/stories/sprint-status.yaml` -- set the item to `done`, `ref` to this spec -- tracking.

**Acceptance Criteria:**
- Given a loaded page whose ranking is honest-empty and holds both `no-listings` and `not-yet-synced` rows, when the list renders, then the statement reads the state 23 copy and the rendered row labels are in canonical key order across both groups, with no rank numerals.
- Given a page with at least one ranked row, when the list renders, then no statement prints and the unpriced rows trail as all `no-listings` then all `not-yet-synced`, as before.
- Given the change, when `pnpm check` and `pnpm test` run, then both pass.

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 17 findings — high 0, medium 0, low 10, false 6, maybe-false 0
- findings:
  - `[low]` `[defer]` Deferred ledger: state 23's "every cell holds no figure yet" has no owner; item 24 / F15 covers only the row note — pre-existing UX wording; appended to `deferred-work.md` and frontmatter `deferred`.
  - `[low]` `[defer]` Intent audit R4: a no-listings row still reads *an open question* under honest-empty — same root cause as the row above; deferred with it.
  - `[false]` `[reject]` Intent audit R4: Item Classes are not merged into the honest-empty order — Epic 2 builds no crafted rows (`DisplayRow.unit` is `raw` only, `recipes.json` empty), so no class row can reach the list.
  - `[false]` `[reject]` Intent audit R5: the order is computed in `web`, not `core` — no ranking term is computed; `web` already owned the trailing concat of `core`'s pre-sorted groups (story 2.3 option a), and the merge uses `core`'s own comparator.
  - `[low]` `[patch]` Edge case: AC2 grouping not pinned when `ordering` is non-empty (`display-rows.test.ts:24` fixtures agree under both orders) — added a partial-refresh case with an interleaving no-listings key; an always-sort edit fails it.
  - `[low]` `[patch]` Verification gap: comparator not pinned; `localeCompare` on key or label passes — added lowercase-initial `amber Ring` and a keys-sorted-by-`compareCanonicalKeys` assertion; a label `localeCompare` edit fails it.
  - `[low]` `[patch]` Verification gap: AC2 interleaved case missing — same root cause as the edge-case row; fixed by the same partial-refresh case.
  - `[low]` `[patch]` Blind: no test proves grouping with ranked rows — same root cause; same fix.
  - `[false]` `[reject]` Blind: the Verification claim is overstated because the list-statement test passes on old code — the fix edits this spec; rejected by rule (and the claim concerns the mixed display tests, which do fail on old code).
  - `[low]` `[patch]` Blind: tests compare labels, not canonical keys — same root cause as the comparator row; fixed by the keys-sorted assertion.
  - `[low]` `[patch]` Blind: the nothing-clears case does not prove its state — now asserts non-empty `belowThreshold` and `isHonestEmpty` false.
  - `[low]` `[patch]` Blind: the honest-empty branch drops `ranked` silently — now returns `[...ranked, ...sorted]`.
  - `[low]` `[patch]` Blind: the `listStatement` doc comment restates the predicate — the bullet now cites `isHonestEmpty`.
  - `[false]` `[reject]` Blind: sorting in `web` breaks "do not re-rank in web" — same refutation as intent audit R5.
  - `[low]` `[defer]` Blind: the UX contradiction is not handed off — same root cause as the ledger row; deferred with it.
  - `[false]` `[reject]` Blind: spec and tracker disagree on status — finalize sets the spec to `done` in the same commit as the tracker.
  - `[false]` `[reject]` Blind: no page-level test for pure reset or nothing-clears with mixed groups — the pure reset has a page test (`App.test.tsx`, "lists a league reset in canonical order"), and the nothing-clears grouping is unchanged code pinned at `toDisplayRows`, where it is decided.

## Design Notes

F3 offered two fixes: reorder, or reword the statement. The sprint item selects the reorder, and state 23 (`EXPERIENCE.md:849`) requires canonical order, so the copy stays. Scoping the reorder to the honest-empty state leaves story 2.3's option a intact where no order claim is printed. A `no-listings` row keeps *an open question*: its price is missing for a different reason than a league mismatch, and state 23's "every cell holds no figure yet" assumes a pure reset; that copy is UX item 24's (F15).

## Verification

**Commands:**
- `pnpm check` -- expected: clean
- `pnpm test` -- expected: all pass; the new mixed tests fail against the old `display-rows.ts`

## Auto Run Result

- **Summary:** In the honest-empty state (state 23), the unpriced rows now print as one sequence in canonical key order (`compareCanonicalKeys`) across `noListings` and `notYetSynced`, so "In canonical order, not ranked" is true in a mixed reset. One predicate, `isHonestEmpty`, drives both the statement and the order. Outside honest-empty the story 2.3 grouping is unchanged.
- **Files changed:**
  - `packages/web/src/list/list-statement.ts` -- `isHonestEmpty` extracted and exported; `listStatement` uses it.
  - `packages/web/src/list/display-rows.ts` -- canonical merge of the unpriced rows when `isHonestEmpty` holds.
  - `packages/web/src/list/display-rows.test.ts` -- mixed reset (with a lowercase id that pins code-point order), partial refresh with interleaving keys, nothing clears with an asserted state.
  - `packages/web/src/list/list-statement.test.ts` -- mixed-group predicate case.
  - `packages/web/src/App.test.tsx` -- page-level mixed-reset test.
  - `docs/stories/sprint-status.yaml` -- item 20 `done`, `ref` to this spec.
  - `docs/stories/deferred-work.md` -- the state 23 wording note for UX.
- **Review:** 17 findings. Patched 10 low findings in 5 groups. Deferred 1 low group of 3 rows (the state 23 wording). Rejected 6 as false, each with its reason in the triage log.
- **Follow-up review recommended:** false. The pass patched no high finding and no medium finding.
- **Verification:** `pnpm check` is clean. `pnpm test` passes 88 files and 1160 tests. The implementer ran the mixed tests against the old `display-rows.ts` and they failed. The always-sort and label-`localeCompare` mutations each fail at least one new test.
- **Residual risk:** No browser check was run. The change is covered by the jsdom page test only.
