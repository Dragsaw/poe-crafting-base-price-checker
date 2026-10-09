---
title: 'Epic 2 retro action 7: the web code meets UX rulings F5, F13, F15'
type: 'bugfix'
created: '2026-09-27'
status: 'done'
baseline_revision: '64043e8b64298e80bc9dc196c35ba7196fbb183c'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred:
  - summary: >-
      A never-synced entry that has a lastAttemptedAt prints `tried Nd ago` in its Age cell, but its expansion shows no ages.
    evidence: |-
      Reachable: packages/sync/src/pricing/price-entry.ts:299-302 stamps lastAttemptedAt and keeps the never-synced price on a 429, 5xx or timeout at the first attempt. ageMark reads lastAttemptedAt for every non-priced state, and combinationAges (packages/web/src/list/format.ts, the never-synced branch) returns no ages. This predates this change: the baseline ageMark read entry.lastAttemptedAt for the same state. The owner is UX EXPERIENCE.md (does a never-synced row with an attempt show `tried`?).
    location: >-
      packages/web/src/list/format.ts ageMark / combinationAges
    severity: low
---

<intent-contract>

## Intent

**Problem:** UX rulings F5, F13 and F15 (memlog 216, 217, 218, with F5 amended by memlog 222 and 223; EXPERIENCE.md revision 12, DESIGN.md revision 10) changed three printed strings, and the web code still prints the old ones. The health line prints `× pinned entries starved this run` with no count. A league-mismatched row's Age cell prints `priced Nd ago` from another league's observation, but the expansion reads the attempted clock. The Raw Base note and panel sub-line say "ranked at", which is false under the honest-empty state.

**Approach:** Derive the starvation signal from the one `pinned-starvation` record that matches the current curation: its `pinnedCount` equals the loaded Tracked List's pinned-set size, and its `declaredMinChunkSearches` equals the loaded `config.minChunkSearches`. Print `N of M` when N ≥ 1, a separate wording when N = 0, and nothing when no record matches. Resolve the Age cell's clock from the row's resolved Price State, not from the stored one. Change "ranked at" to "valued at" in the two raw-base strings.

## Boundaries & Constraints

**Always:** The line reads the **matching** `pinned-starvation` record (memlog 222): `record.pinnedCount` equals the number of `set.tracked.entries` with `status === 'pinned'`, which is the same count sync writes (`run-chunk.ts:523`), and `record.declaredMinChunkSearches` equals `set.config.minChunkSearches`. These two fields are the record's subject (`RECORD_SUBJECTS`), so at most one record matches. If no record matches, the line raises no starvation signal. The Sync Report panel still lists every record, as it does today. For the matching record, M = `pinnedCount` and N = `pinnedCount − pinnedRefreshed`. When N ≥ 1 the signal text is `N of M pinned entries starved`. When N = 0 it is `M pinned entries left the rotation no search` (memlog 223). Format each count with `toLocaleString('en-US')`, the same as the unresolvable count. The view adds the `×` glyph. No signal ever prints a zero. The Age cell reads `observedAt` only when the row's printed state is `priced`. In all other cases it reads `lastAttemptedAt`, the same clock the expansion's `tried …` age uses. The 48h cut-off, the `floor(hours/24)` day count and the *never attempted* mark do not change.

**Never:** Do not edit `packages/core`, `packages/contracts`, the UX documents or the PRD. Do not pick a record by its position in `report.records`: the last record by position can describe an older curation, because `carryRecords` updates a repeated record in place. Do not change the panel's list of starvation records. Do not print the words *this run*. Do not add a league parameter to the web layer. The resolved `CombinationState` already carries the mismatch.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| One matching record | 5 pinned entries in tracked, `minChunkSearches: 8`; record `pinnedCount: 5, declaredMinChunkSearches: 8, pinnedRefreshed: 2` | signal `3 of 5 pinned entries starved` | No error expected |
| Matching record, N = 0 | as above, `pinnedRefreshed: 5` | signal `5 pinned entries left the rotation no search` | No error expected |
| Pinned set changed | 5 pinned in tracked; only record has `pinnedCount: 8` | no starvation signal | No error expected |
| Yardstick changed | `minChunkSearches: 10`; only record has `declaredMinChunkSearches: 8` | no starvation signal | No error expected |
| Older record last by position | 8 pinned in tracked, `minChunkSearches: 8`; records `[8/8 refreshed 2, 5/8 refreshed 4]` | signal `6 of 8 pinned entries starved` (from the first record, the one that matches) | No error expected |
| Both triggers | 12 unresolvable + one matching `5/2` starvation | `['12 unresolvable', '3 of 5 pinned entries starved']` | No error expected |
| Only a non-matching record, no unresolvable | 5 pinned in tracked; record `pinnedCount: 8` | `[]`, and the strip raises no health line | No error expected |
| Mismatched observation, old attempt | stored `priced` in `Standard`, observed 96h ago, `lastAttemptedAt` 96h ago, active league differs | Age cell `tried 4d ago` | No error expected |
| Mismatched observation, recent attempt | observed 30d ago, `lastAttemptedAt` 2h ago | no Age mark | No error expected |
| Priced in active league | observed 72h ago, attempted 1h ago | `priced 3d ago` (unchanged) | No error expected |

</intent-contract>

## Code Map

- `packages/web/src/frame/trust-facts.ts:30` -- `HEALTH_STARVED` constant. Replace it with a formatter or inline text. It has no references outside this file and its tests.
- `packages/web/src/frame/trust-facts.ts:105-118` -- `healthSignals(report)`. Its starvation branch is `records.some(...)`. It needs the current curation, so widen its signature, for example `healthSignals(report, curation: { pinnedCount, minChunkSearches })`. Find the record whose `pinnedCount` and `declaredMinChunkSearches` equal those two values. The `pinned-starvation` record type has `pinnedCount`, `declaredMinChunkSearches` and `pinnedRefreshed` (see the `starvation` fixture at `trust-facts.test.ts:40-47`). Update the docblock with the match rule.
- `packages/web/src/frame/TrustStrip.tsx:66` -- the only production caller. It already holds `set: ArtifactSet`, and `tracked` and `config` are required artifacts there, so they are never null. Derive the pinned-set size from `set.tracked.entries` (`status === 'pinned'`, as `run-chunk.ts:523` counts it) and the yardstick from `set.config.minChunkSearches`. Add no prop.
- `packages/web/src/frame/trust-facts.test.ts:112-127` -- the `healthSignals` tests, including "names pinned starvation without a count" (`:116-123`). Pass a curation that matches the fixture, and cover each F5 matrix row.
- `packages/web/src/frame/trust-strip.test.tsx:185` -- the rendered health line. It expects `× pinned entries starved this run`, which becomes `× 3 of 5 pinned entries starved`. The fixture is 5/2. The mounted set's `tracked` and `config` must match the fixture record. Check what the test's set builder puts there, and adjust the fixture record or the set, whichever keeps the other tests unchanged. Add a rendered case where the record does not match and the strip shows no health line.
- `docs/stories/spec-epic-2-retro-item-7-ux-rulings-f5-f13-f15.patch` -- the earlier build, against `baseline_revision`. Its F13 and F15 changes and its N-of-M formatter pass review. Apply it with `git apply`, then change its `findLast` record choice to the curation match and add the N = 0 wording.
- `packages/web/src/list/format.ts:47-67` -- `ageMark(entry, now)` and its docblock. The docblock currently says a mismatched observation reads as priced. Mirror the signature of `combinationAges(state, lastAttemptedAt, now)` at `format.ts:189-201`: `ageMark(state: CombinationState, lastAttemptedAt, now)`. A missing entry has no `lastAttemptedAt`, so it gives *never attempted*, as it does today.
- `packages/web/src/list/display-rows.ts:66-75` -- `detail()`, the only caller of `ageMark`. It already has the resolved `state` and `entry?.lastAttemptedAt`.
- `packages/web/src/list/format.ts:80`, `:213` -- `rawNote` and `rawPanelSubLine`: change "ranked at" to "valued at".
- `packages/web/src/list/format.test.ts:66-104` -- the `ageMark` tests. Adapt them to the new signature. Replace the test "reads a league-mismatched observation as priced too" (`:85-90`). Change the raw strings at `:116` and `:190`.
- `packages/web/src/list/expansion.test.tsx:140` -- the literal sub-line text: change "ranked at" to "valued at".
- `packages/web/src/list/ranked-list.test.tsx` -- `mountList` runs the real `rank` + `toDisplayRows` against `TEST_LEAGUE`, and `cell(row,'age')` reads the Age cell. Put the surface test here. See the trail test at `:185-215` for the pattern. Fixtures: `priced(entry, p, observedAt, league)` in `test-support/list-fixtures.ts:55-72` sets `lastAttemptedAt = observedAt`. Spread an override to separate the two clocks.

## Tasks & Acceptance

**Execution:**
- `packages/web/src/frame/trust-facts.ts` -- make the starvation signal come from the record that matches the current curation. It reads `N of M pinned entries starved`, or `M pinned entries left the rotation no search` when N = 0, and there is no signal when no record matches. Remove `HEALTH_STARVED` -- F5.
- `packages/web/src/frame/TrustStrip.tsx` -- pass the pinned-set size and `minChunkSearches` from `set` to `healthSignals` -- F5.
- `packages/web/src/frame/trust-facts.test.ts`, `packages/web/src/frame/trust-strip.test.tsx` -- replace the no-count expectations. Cover every F5 matrix row, and add the rendered no-match case -- F5.
- `packages/web/src/list/format.ts` -- give `ageMark` a resolved-state signature and a docblock that says a mismatched observation reads the attempted clock. Change "valued at" in `rawNote` and `rawPanelSubLine` -- F13, F15.
- `packages/web/src/list/display-rows.ts` -- pass `state` and `entry?.lastAttemptedAt` to `ageMark` -- F13.
- `packages/web/src/list/format.test.ts`, `packages/web/src/list/expansion.test.tsx` -- adapt to the new signature and the new strings, and add the mismatch unit cases -- F13, F15.
- `packages/web/src/list/ranked-list.test.tsx` -- add a rendered test: a mismatched row's Age cell prints `tried Nd ago` and never `priced` -- F13.

**Acceptance Criteria:**
- Given a sync report with a `pinned-starvation` record that matches the loaded pinned-set size and `minChunkSearches`, when the trust strip renders, then its health line reads `× N of M pinned entries starved` with the rule's N and M, or `× M pinned entries left the rotation no search` when N = 0. It never contains `this run` or a zero count.
- Given a sync report whose only `pinned-starvation` records do not match the current curation, when the trust strip renders, then it raises no starvation signal, and the Sync Report panel still lists those records.
- Given a dataset entry whose stored `priced` observation belongs to another league, when the ranked list renders, then that row's Age cell shows the `tried Nd ago` mark from `lastAttemptedAt`, or no mark under 48h. It never shows `priced`.
- Given any Raw Base row or its expansion panel, when it renders, then the note and the sub-line say "valued at its own current asking price", and no web source or test string still says "ranked at its own".

## Spec Change Log

- 2026-09-27 -- intent gap resolved by the UX owner (memlog 222 and 223; EXPERIENCE.md revision 12, DESIGN.md revision 10). The line reads the record that matches the current curation, not the last by position. No match gives no signal. N = 0 prints `M pinned entries left the rotation no search`. The intent contract, the F5 matrix rows, the Code Map, the tasks and the ACs are updated. Status is blocked → ready-for-dev. F13 and F15 are unchanged.

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 21 findings — high 0, medium 4, low 11, false 6, maybe-false 0
- findings:
  - `[medium]` `[intent_gap]` (verification-gap) A pinned-starvation record with `pinnedRefreshed === pinnedCount` makes the health line print `0 of M pinned entries starved` — confirmed reachable: `packages/sync/src/chunk/run-chunk.ts:720-723` sets `truncated` "even when nothing is left to cut". That contradicts `trust-facts.ts:101` ("no trigger ever prints a zero") and EXPERIENCE.md's "no counts of nothing". Suppressing the signal instead contradicts DESIGN.md's trigger ("a pinned-starvation record is present") and hides a real starvation of the rotation (IMPLEMENTATION-NOTES.md §6). Memlog 216 settles neither reading. Attempted change saved at `docs/stories/spec-epic-2-retro-item-7-ux-rulings-f5-f13-f15.patch`, code reverted.
  - `[medium]` `[defer]` (edge-case) `findLast` by array position can pick an older chunk's record, because `carryRecords` replaces a repeat in place at its earlier index — real (`packages/sync/src/chunk/sync-report.ts:47-66`), but "last in report order" is the UX-owned rule itself (EXPERIENCE.md trust strip, memlog 216). Changing it edits the UX ruling. Moot this pass under the intent gap. Record it for the UX owner with the N = 0 question.
  - `[medium]` `[defer]` (edge-case) Several coexisting starvation records with different subjects (`declaredMinChunkSearches`, `pinnedCount`) collapse to one count on the line — real (`RECORD_SUBJECTS` in `packages/contracts/src/sync-run-report.ts:255`). It has the same root cause as the row above, the ruling's choice of one record. Moot this pass.
  - `[low]` `[reject]` (edge-case) `pinnedRefreshed > pinnedCount` prints a negative N — the producer counts kept entries out of the pinned set, so it never writes this. It is unlikely in use, and a guard would cover an undemonstrated state.
  - `[medium]` `[intent_gap]` (edge-case) `0 of 5` / `0 of 0` when `pinnedRefreshed === pinnedCount` — same root cause and route as the first row.
  - `[false]` `[reject]` (edge-case) A league-mismatched priced entry with no `lastAttemptedAt` prints *never attempted* — `DatasetEntrySchema` says `lastAttemptedAt` is present wherever sync issued a request, and a stored observation needs one. The expansion shows the same absence, so the two surfaces still agree.
  - `[false]` `[reject]` (edge-case) A ranked row with no dataset entry now prints a priced age — `rank` builds the ordering from the dataset, so every ranked row joins an entry by `entryKey`.
  - `[medium]` `[intent_gap]` (blind) Zero or negative N is not guarded against the docblock invariant — the zero half is the first row's root cause. The negative half is rejected as above.
  - `[low]` `[reject]` (blind) The `healthSignals` docblock does not state the N-of-M rule — moot this pass: the code is reverted and re-derives after the ruling.
  - `[low]` `[reject]` (blind) The health line uses `findLast` and the panel uses `flatMap` — this follows the ruling (line: one count; panel: every record). No named harm.
  - `[low]` `[reject]` (blind) Some `ageMark` unit inputs are unrealistic, and the 48h boundary is not tested on the tried path — the rendered test covers the mismatch path. Extra cases add no protection for a real defect.
  - `[low]` `[reject]` (blind) The rendered mismatch test does not assert the resolved state — the exact `toBe('… tried 4d ago')` fails loudly if the rows resolve otherwise.
  - `[low]` `[reject]` (blind) The `ageMark` docblock is hard to parse — moot this pass: the code is reverted.
  - `[low]` `[reject]` (blind) No test ties a row's Age word to its expansion ages — both come from the one `detail()` call on the same `state` and `lastAttemptedAt`. `expansion.test.tsx:253-257` already asserts the expansion's `tried` age.
  - `[low]` `[reject]` (blind) The `display-rows.test.ts` fixture does not separate the two clocks — moot this pass. The `ranked-list.test.tsx` test separates them.
  - `[false]` `[reject]` (blind) Verification evidence is missing — `pnpm test` (88 files, 1160 tests pass), `pnpm check` (exit 0) and the grep (no output) all ran at step 03.
  - `[low]` `[reject]` (intent) No single test renders one mismatched entry and compares its row with its expansion — same refutation as the row-versus-expansion row above.
  - `[low]` `[reject]` (intent) The App-level honest-empty test does not assert the Age cells — `ranked-list.test.tsx` renders mismatched rows through the real `rank`, and state 23 is only several such rows.
  - `[low]` `[reject]` (intent) The F15 note is not rendered under honest-empty — `rawNote` takes no state input, so the string is the same in every state.
  - `[low]` `[reject]` (intent) `EXPERIENCE.md:90` still says "ranked at their own asking price" — it is a component-role description of the list, not the printed note that memlog 218 rules on. UX documents are outside this build.
  - `[false]` `[reject]` (intent) The ledger entry `deferred-work.md:293` is still present — AGENTS.md: only `deferred-work-sweep` removes it, as the last commit of the closing branch.

### 2026-09-27 — Review pass
- verdicts: 16 findings — high 0, medium 1, low 7, false 5, maybe-false 0
- findings:
  - `[medium]` `[patch]` (verification-gap) No strip test shows that only `status: 'pinned'` entries count toward M, because `CURATION_5_OF_8` held only pinned entries. Dropping the filter in `TrustStrip.tsx` would keep every test green and would hide the signal in production. Fixed: the fixture now has two `status: 'active'` entries as well, and the rendered `× 3 of 5` assertion now fails without the filter.
  - `[low]` `[reject]` (blind) The spec body still describes the blocked run. The fix edits this build's spec, and Finalize rewrites the Auto Run Result.
  - `[low]` `[reject]` (blind) The old `.patch` file is still in `docs/stories`. This spec's earlier triage log and Auto Run Result cite it as the record of the blocked run, so deleting it would break that evidence. Nothing applies it automatically.
  - `[low]` `[patch]` (blind) Two `healthSignals` tests had the same body (`pinnedCount: 8` against `CURATION`). Fixed: deleted the duplicate. The matrix row "only a non-matching record" stays covered by the unit test for the changed pinned set and the rendered no-health-line test.
  - `[medium]` `[patch]` (blind) No rendered test checks the pinned-status filter. This is the same root cause as the verification-gap row. Fixed by the same fixture change.
  - `[false]` `[reject]` (blind) No rendered test shows that `minChunkSearches` passes through. `BASE_SET.config.minChunkSearches` is 1, the fixture overrides it to 8 and the record declares 8, so a wrong or unwired value fails the positive rendered assertion.
  - `[low]` `[reject]` (blind) No rendered test covers the N = 0 wording or the absence of `this run`. The strip prints each `healthSignals` string with the same `×` join as the covered case, and unit tests pin both strings. A new rendered case would add a test for no defect that has been shown.
  - `[low]` `[reject]` (blind) The re-narrowing on `starvation?.kind` after `find` is redundant. It is cosmetic, TypeScript needs it without a type-guard predicate, and no harm is named.
  - `[low]` `[patch]` (blind) The `ageMark` docblock says "a league-mismatched observation included", which is ambiguous. Fixed: reworded to "A league-mismatched observation resolves to `not-yet-synced`, so it reads `lastAttemptedAt`".
  - `[false]` `[reject]` (blind) The docblock claims "no trigger ever prints a zero" and the code does not enforce it for a negative N. A zero is guarded by the `pinnedCount > 0` check and the N = 0 wording. A negative N is not a zero, and the carried row below covers it.
  - `[false]` `[reject]` (intent) The `pinnedCount > 0` guard goes beyond the matrix. It implements the contract's Always rule "No signal ever prints a zero", so it does not diverge from the intent.
  - `[low]` `[defer]` (intent) A never-synced entry with `lastAttemptedAt` prints `tried …` in its Age cell while its expansion shows no ages. This is reachable (`price-entry.ts:299-302` stamps the attempt and keeps never-synced on a 429 at the first attempt), and it predates this change: the baseline `ageMark` read `lastAttemptedAt` for the same state. Deferred to the UX owner.
  - `[false]` `[reject]` (intent) A yardstick mismatch is never rendered. This is the same claim as the blind `minChunkSearches` row, with the same refutation.
  - `[low]` `[reject]` (intent) The N = 0 wording is never rendered. This is the same claim and the same reasoning as the blind N = 0 row.
  - `[false]` `[reject]` (intent) The rendered row note compares against `rawNote(82)` and so is circular. `format.test.ts` pins the literal "valued at" string, and any wording change fails there.
  - `[low]` `[reject]` (edge-case) `pinnedRefreshed > pinnedCount` prints a negative N. carried: this matches the 2026-09-27 row "`pinnedRefreshed > pinnedCount` prints a negative N", and `trust-facts.ts` still computes `pinnedCount − pinnedRefreshed` unguarded. The producer never writes that state.

## Verification

**Commands:**
- `pnpm test` -- expected: all tests pass
- `pnpm check` -- expected: typecheck, lint and depcruise exit 0
- `git grep -n "ranked at its own\|starved this run" -- packages` -- expected: no output

## Auto Run Result

Status: done

**Summary:** The health line now takes its starvation signal from the one `pinned-starvation` record that matches the loaded curation: the pinned-set size and `minChunkSearches`. It prints `N of M pinned entries starved`, or `M pinned entries left the rotation no search` when N = 0, and nothing when no record matches (F5). The Age cell takes its clock from the row's resolved Price State, so a league-mismatched row reads `tried Nd ago` (F13). The Raw Base note and the panel sub-line say "valued at" (F15). F13 and F15 come from the saved patch without changes. F5 is re-derived to the amended ruling.

**Files changed:**
- `packages/web/src/frame/trust-facts.ts`: adds the `Curation` type and `healthSignals(report, curation)` with the match rule and both wordings. Removes `HEALTH_STARVED`.
- `packages/web/src/frame/TrustStrip.tsx`: passes the pinned count from `set.tracked.entries` and `set.config.minChunkSearches`.
- `packages/web/src/frame/trust-facts.test.ts`: covers every F5 matrix row, the en-US grouping, the empty-pinned-set guard and the absence of `this run`.
- `packages/web/src/frame/trust-strip.test.tsx`: adds the `CURATION_5_OF_8` fixture (5 pinned and 2 active entries), the rendered `× 3 of 5` line, and a rendered no-match case in which the panel still lists the record.
- `packages/web/src/list/format.ts`: `ageMark(state, lastAttemptedAt, now)` with a new docblock, and "valued at" in `rawNote` and `rawPanelSubLine`.
- `packages/web/src/list/display-rows.ts`: passes the resolved `state` to `ageMark`.
- `packages/web/src/list/format.test.ts`, `display-rows.test.ts`, `expansion.test.tsx`: updated to the new signature and strings, with the mismatch unit cases.
- `packages/web/src/list/ranked-list.test.tsx`: a rendered Age-cell test covering priced in the active league, a mismatch with an old attempt, and a mismatch with a recent attempt.

**Review findings:**
- 16 findings in total.
- 4 patched. The medium entry is the pinned-status coverage gap, reported by two layers. The two low patches are the deleted duplicate test and the `ageMark` docblock rewording.
- 1 deferred (low): a never-synced entry that has an attempt clock prints `tried …` while its expansion shows no ages. This predates the change.
- 11 rejected:
  - The spec-body finding edits this build's spec.
  - The stale `.patch` file is cited as evidence.
  - The rendered-only coverage gaps (the yardstick and N = 0) are covered by the unit tests plus the shared render path, or refuted by the positive rendered assertion.
  - The redundant narrowing is cosmetic.
  - The docblock "zero" claim is refuted.
  - The M = 0 guard implements the Always rule.
  - The circular render check is covered by the literal in the unit test.
  - The negative N is carried from the prior pass: the producer never writes it.

**Follow-up review recommended:** false. This pass patched 0 high, 1 medium and 2 low entries.

**Verification:**
- `pnpm test`: 88 files, 1165 tests pass.
- `pnpm check`: exit 0 (typecheck, eslint, depcruise).
- `git grep -n "ranked at its own\|starved this run" -- packages`: no output.
- Matrix audit: each of the 10 matrix rows has a covering test that ran and passed.

**Residual risks:**
- There is no browser check. The rendered DOM tests cover the strings.
- The `.patch` file from the earlier run stays in `docs/stories` as a record.
- The deferred never-synced Age-cell question is open.
