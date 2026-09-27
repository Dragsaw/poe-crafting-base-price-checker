---
title: 'Epic 2 retro item 18: render unresolvable Raw Bases as rows'
type: 'bugfix'
created: '2026-09-27'
status: 'done'
baseline_revision: '5fb836a30832812b83b0efbdbaf35dc2a428623b'
baseline_commit: '6a1b743290a7ddaa087566717483d88998ae313c'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/epic-2-retro-2026-09-27.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** `toDisplayRows` drops `ranking.unresolvable` (retro F1). It hands the entry to the story 2.6 health line, but that line counts `sync-report.json` records, not the ranking. When the report is absent, or disagrees with the dataset, an unresolvable Raw Base leaves no trace on the page. This breaks FR-9 and FR-24 ("shown, not merely omitted") and EXPERIENCE state 4 ("surfaced not omitted").

**Approach:** Render each unresolvable Raw Base as a trailing unpriced row. It takes the money phrase *not valued* in rust (EXPERIENCE Money slots). It follows `noListings` and `notYetSynced` in canonical order, carries no numeral, sits at tier 3 and uses the raw cues. Its expansion prints the state-4 combination row. The health line stays as it is.

## Boundaries & Constraints

**Always:**
- `web` computes no ranking term (AD-4). It reads `core`'s `ranking.unresolvable` as `core` ordered it.
- A missing figure is never `0`, a blank or an em dash.
- The unresolvable row counts toward the 20 visible rows and toward N, as the other unpriced rows do (spec 2.3 decision).
- The trade link keeps its stored-field test (`lastSearchId` in the active league). It never reads the Price State.

**Never:**
- Do not change `core` `rank`, contracts, the trust strip or the health line.
- Do not fix the honest-empty grouping claim (retro F3, item 20). Do not render crafted unresolvable rows (Epic 3).
- Do not edit the UX docs. The copy adaptation below goes to `deferred-work.md` as a `[NOTE FOR UX]`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Trail order | priced + no-listings + never-synced + unresolvable (2, out of key order) | numbered priced rows, then no-listings, then not-yet-synced, then the unresolvable rows in canonical key order, all unnumbered | none |
| Row cells | unresolvable, tried 1h ago | EV *not valued*, italic, `colors.rust`; age cell empty (under 48h); raw note present | none |
| Stale unresolvable | tried 3d ago | age mark `tried 3d ago` | none |
| Report absent | `sync-report.json` 404, one unresolvable entry | the row renders; the strip shows the `Not published` line and no health line | none |
| Only unresolvable | every raw entry unresolvable, nothing priced | the rows render under the honest-empty statement | none |
| Expansion | open an unresolvable row | state `× unresolvable`, figure *not valued* (rust), sample `no sample`, note `its id is gone from the trade API — a patch did this`, `tried Nh ago`, no `priced` age | none |

</intent-contract>

## Code Map

- `packages/web/src/list/display-rows.ts` -- `toDisplayRows`: builds the trail with `unpriced(entry, phrase, state)`. Append `ranking.unresolvable` after `notYetSynced`. Update the docblock, which says unresolvable is "Story 2.6's health line".
- `packages/web/src/list/format.ts` -- `CombinationState` union (3 arms). `stateWord`, `rawCombinationNote`, `combinationFigure`, `sampleText` switch on it exhaustively, so the typecheck forces each new case. `combinationAges` already gives `tried …` and no `priced …` to a non-priced state. `MONEY_PHRASES.unresolvable = 'not valued'` exists and has no caller. `STATE_NOTES` holds the state notes. `PRICE_STATE_GLYPHS.unresolvable` exists.
- `packages/web/src/list/RankedRow.tsx` -- the EV cell's `data-money-phrase` span, which is ink. Use rust when `row.state.state === 'unresolvable'`.
- `packages/web/src/list/CombinationRow.tsx` -- the figure cell's `data-money-phrase` span. The same rust rule applies (`row.state.state`).
- `packages/web/src/list/ExpansionPanel.tsx:21` -- `rawCombinationNote(row.state, …)`. Needs no change.
- `packages/web/src/list/list-statement.ts:41` -- the honest-empty predicate counts `noListings + notYetSynced`, which is "the rows the list prints when nothing is priced". Add `unresolvable`.
- `packages/web/src/theme/tokens.ts` -- `colors.rust`.
- Tests that assert "no row" today, to be inverted: `display-rows.test.ts:47`, `ranked-list.test.tsx:183-209`, `App.test.tsx:297-339` ("Matrix: unresolvable — no row"). Reuse the fixtures `rawEntry`, `unpriced`, `hoursBefore`, `mountList`, `rowsIn`, `cell`, `serveArtifacts` and `bodiesWith`.
- `packages/web/src/frame/trust-facts.ts:110` -- the health line reads the report's records. Read-only.

## Tasks & Acceptance

**Execution:**
- `packages/web/src/list/format.ts` -- add `{ state: 'unresolvable' }` to `CombinationState`. Add `STATE_NOTES.unresolvable = 'its id is gone from the trade API — a patch did this'`. Handle the new case in `stateWord` (`unresolvable`), `rawCombinationNote`, `combinationFigure` (`MONEY_PHRASES.unresolvable`) and `sampleText` (`no sample`) -- the state-4 treatment.
- `packages/web/src/list/display-rows.ts` -- append `ranking.unresolvable.map(e => unpriced(e, MONEY_PHRASES.unresolvable, { state: 'unresolvable' }))` last. Fix the docblock.
- `packages/web/src/list/RankedRow.tsx`, `packages/web/src/list/CombinationRow.tsx` -- set the money phrase in `colors.rust` for the unresolvable state, and in ink otherwise.
- `packages/web/src/list/list-statement.ts` -- count `unresolvable` in the honest-empty predicate, and fix its comment.
- Tests: `format.test.ts` (the new switch arms), `display-rows.test.ts` (trail order with 2 unresolvable), `ranked-list.test.tsx` (the row, EV text and rust colour), `expansion.test.tsx` (the state-4 combination row), `list-statement.test.ts` (only-unresolvable gives honest-empty), `App.test.tsx`. Invert the "no row" assertion, and add one composition test for the story 2.3 → 2.6 hand-off: an unresolvable entry with the report absent still renders its row.
- `docs/stories/deferred-work.md` -- append a `[NOTE FOR UX]` entry. The state-4 note names a statId, but a Raw Base misses on a baseTypeId or categoryId, so the raw note reads `its id is gone from the trade API — a patch did this` until UX rules.

**Acceptance Criteria:**
- Given a dataset with an unresolvable Raw Base, when the page loads with `sync-report.json` absent, then the list shows that Base Type's row with *not valued* in its EV cell.
- Given the same page with the report present and recording the entry, then the row renders, and the health line reads `× 1 unresolvable` as before.
- Given `pnpm check` and `pnpm test`, when run, then both pass.

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 21 findings — high 0, medium 0, low 13, false 8, maybe-false 0
- findings:
  - `[low]` `[patch]` (ledger) The F3 / item 20 grouping claim now spans a third, unresolvable group, and no ledger entry says so — appended a second item-18 entry to `deferred-work.md` naming the three groups for item 20.
  - `[false]` `[reject]` (intent 1) Reading B (health-line fallback) is closed off by the report-absent test — the action item id selects "render as rows", and FR-24 / state 4 put the entry on a row; the health line keeps one source, the report.
  - `[false]` `[reject]` (intent 2) The hand-off test consumes the field at the list, not at the 2.6 receiver — with rows the list owns `ranking.unresolvable`; the App test proves the entry survives report absence, the retro's failure mode.
  - `[low]` `[reject]` (intent 3) Report present but drifting from the dataset is untested — the row reads the dataset alone, so drift cannot hide it; the health line is unchanged report-owned behaviour; adding a test adds nothing this change owns.
  - `[low]` `[reject]` (intent 4) No browser check of the new rows — the committed data has no unresolvable entry, so a browser check needs a fixture set (retro action 10); jsdom asserts the cells and inline colours.
  - `[low]` `[patch]` (intent 5) State-23 copy "yet" is wrong for a list of only unresolvable rows — grouped with the ledger finding; recorded as a `[NOTE FOR UX]` in the appended entry (UX owns copy).
  - `[false]` `[reject]` (intent 6) The adapted state-4 note is unowned copy — already ledgered as a `[NOTE FOR UX]` by this change.
  - `[false]` `[reject]` (intent 7) Scope matches — no defect claimed.
  - `[false]` `[reject]` (edge 1) Expansion links an unresolvable row to a stale trade search — EXPERIENCE.md:533 and :986 say most unresolvable rows carry the link; the stored-field test is the ruled behaviour.
  - `[false]` `[reject]` (edge 2) A recovered id still reads unresolvable — the dataset is the published truth and the next sync rewrites its state (AD-7); the page never second-guesses it from the report.
  - `[low]` `[patch]` (edge 3) No test pins the trade link on an unresolvable row — the expansion test now stores an active-league search and asserts the href.
  - `[low]` `[patch]` (blind 1) The `×` glyph is not rust on the state-4 line — `CombinationRow` now sets the glyph span to `colors.rust` for `unresolvable`; asserted in `expansion.test.tsx`.
  - `[false]` `[reject]` (blind 2) The key block's "empty Age cell means nothing is degraded" misstates the row — the Age cell speaks to freshness only; a fresh no-listings row has the same empty cell; the EV phrase carries the state.
  - `[low]` `[reject]` (blind 3) The ranked row carries no × trust mark — EXPERIENCE state 4 specifies the combination row, not a row mark; adding one is a UX decision and new surface.
  - `[low]` `[patch]` (blind 4) Honest-empty "yet" and the widened grouping claim are unrecorded — same root cause as the ledger finding; covered by the appended entry.
  - `[low]` `[reject]` (blind 5) No test puts an unresolvable row past row 20 — `RankedList` slices `rows.length` generically (verification-gap layer confirmed); a dedicated test guards nothing new.
  - `[low]` `[patch]` (blind 6) No trade-link test on an unresolvable row — same as edge 3; patched there.
  - `[low]` `[reject]` (blind 7) The rust rule is duplicated in two components — two one-line ternaries; a helper adds public surface for no named divergence.
  - `[false]` `[reject]` (blind 8) The F18 closure is not traceable for the sweep — the new entry names the F18 bullet's "every entry is unresolvable" case and says the crafted case stays open.
  - `[low]` `[patch]` (blind 9) The `STATE_NOTES` docblock says "verbatim" over an adapted note — reworded to "states 2, 5, 6 and 7 verbatim, and state 4 adapted".
  - `[low]` `[patch]` (blind 10) A test name says "rows" over one row — renamed to "lists a lone unresolvable row under the honest-empty statement".
  - verification-gap layer: no gaps found.

### 2026-09-27 — Review pass (fix of the `78db4da..ec38dce` findings, diff from `6a1b743`)
- verdicts: 17 findings — high 0, medium 0, low 13, false 4, maybe-false 0
- findings:
  - `[low]` `[patch]` (ledger 1) The Never-list carve-out of crafted unresolvable rows (Epic 3) had no ledger entry — appended one to `deferred-work.md`.
  - `[low]` `[patch]` (ledger 2) The skipped browser check had no ledger entry — appended one naming the checks for when a fixture set with an `unresolvable` entry exists (retro action 10).
  - `[false]` `[reject]` (edge 1) Dropping "yet" while `ranking.unrankable` is non-empty — revision 9 speaks of "every row the list shows"; unrankable classes print in `UnrankableAppendix`, not as list rows, and `isHonestEmpty` does not count them.
  - `[low]` `[reject]` (edge 2) The Execution task still says rust keys on the state — the fix edits this spec; review decision (b) in Review Findings records the change.
  - `[low]` `[reject]` (edge 3) AC1's *not valued* cannot show on an all-unresolvable fixture — the fix edits this spec; decision (b) ruled the honest-empty phrase, and AC1 holds with a priced row present (`ranked-list.test.tsx` rust assertions).
  - `[low]` `[patch]` (blind 1, blind 2) The copy clash of `deferred-work.md:332` is pinned by a test, and nothing records that decision (b) settled its colour half — appended a `[NOTE FOR UX]` entry: colour resolved as (b), copy half open for UX.
  - `[low]` `[reject]` (blind 3) The rust colour matches display text — decision (b) says "take the colour from the phrase shown"; a tone field adds surface for no named divergence.
  - `[low]` `[reject]` (blind 4) No test that an honest-empty row's expansion stays rust — `CombinationRow` builds its phrase from `combinationFigure(row.state)` and never sees the honest-empty swap in `display-rows.ts`; the existing expansion test covers it.
  - `[false]` `[reject]` (blind 5) No test for rust outside honest-empty — `ranked-list.test.tsx:175-179` asserts *not valued* in `colors.rust` under the text rule.
  - `[low]` `[reject]` (blind 6) `onlyUnresolvable` repeats the group list — no fourth unpriced group exists; a shared helper guards no demonstrated state.
  - `[low]` `[reject]` (blind 7) The `onlyUnresolvable` boolean is unlabelled — one production call site names it in a local; cosmetic.
  - `[low]` `[reject]` (blind 8) Spec body and Change Log not updated — the fix edits this spec.
  - `[low]` `[reject]` (blind 9) Ticked review items name no closure — the fix edits this spec; this log and the commit trace them.
  - `[low]` `[reject]` (blind 10) Two baselines — the fix edits this spec; `baseline_revision` is the original build, `baseline_commit` this fix pass.
  - `[false]` `[reject]` (blind 11) `tools/dev-stop/` changes are not in the diff — they are another session's unrelated edits, excluded from the review and from this change's commit.
  - `[low]` `[reject]` (blind 12) Missing statement cases (not-yet-synced from a Price State, only no-listings) — `listStatement` reads group lengths only; core's grouping owns which group an entry lands in, and the existing honest-empty tests keep "yet" for no-listings.
  - verification-gap layer: no gaps found.

### Review Findings

Code review 2026-09-27 of `78db4da..ec38dce`, chunk `packages/web`. It covers every web stream that branched from `5fb836a` and landed in series. A merge-integrity pass found no conflict markers. Each line that commits in the range added and HEAD lacks has a deliberate successor. `pnpm check` is clean, and `pnpm test` passes 1187/1187.

- [x] [Review][Patch] Honest-empty unresolvable row prints *no figure yet* in rust. Resolved 2026-09-27 as option (b): the row keeps *no figure yet*, and `RankedRow` takes the EV colour from the phrase shown, so rust goes only to *not valued*. Add a colour assertion for the honest-empty case. [packages/web/src/list/RankedRow.tsx:108] — Decision detail: this comes from the item 18 rebase onto item 20. `toDisplayRows` (`packages/web/src/list/display-rows.ts`, the `isHonestEmpty` branch) gives every unpriced row *no figure yet* but keeps `state: 'unresolvable'`. `RankedRow.tsx:108` takes the EV colour from the state, so the phrase paints rust. EXPERIENCE *Money slots* gives rust to *not valued* only. An all-unresolvable list, which is the AC1 fixture, therefore no longer shows *not valued*. The tests assert only the text, never the colour. The ledger `[NOTE FOR UX]` ("item 18 rebase onto retro item 20", `deferred-work.md:332`) is still open. Options: (a) an unresolvable row keeps *not valued* in rust while honest-empty; (b) keep *no figure yet* and take the colour from the phrase shown, so it prints in ink; (c) wait for UX to rule and defer.
- [x] [Review][Patch] EXPERIENCE revision 9 code owed was never implemented, because `a8d4842` landed its ruling after `997f7f6`. `honestEmptyCopy` still ends in "yet" for an all-unresolvable list, which needs the one branch plus a test (`deferred-work.md:327`). The `STATE_NOTES` doc comment still says the note waits for a UX ruling (`deferred-work.md:326`). [packages/web/src/list/list-statement.ts:17, packages/web/src/list/format.ts:97]
- Rejected:
  - `low` (blind) With the report absent, an all-unresolvable list shows no unresolvable signal at rest. The health line depends on the Sync Report by design (state 23), and the expansion carries the state.
  - `false` (auditor) AC1 was changed to fit the code. The same root cause as the Decision row, which is where it is grouped.
  - `reject` (auditor) Item 20's Always rules and matrix read against the code (UX revision 8 overrode them), and item 22 AC4 says the title is unchanged (overridden by the UX title ruling). Both fixes would edit a spec.

## Design Notes

The retro offered two fixes: rows, or a health-line count fed from the ranking. The action item id ("render unresolvable raw bases as rows") selects rows. FR-24 and EXPERIENCE state 4 also put the entry on a combination row. The health line keeps its single source, the report, so it has no second clock.

## Verification

**Commands:**
- `pnpm check` -- expected: typecheck, lint and depcruise pass
- `pnpm test` -- expected: all tests pass

## Auto Run Result

Status: done

**Summary:** Unresolvable Raw Bases now render as trailing unpriced rows (retro F1, FR-24). They follow `noListings` and `notYetSynced` in canonical key order, carry no numeral, sit at tier 3 and print *not valued* in rust. Their expansion prints the state-4 combination row: a rust `×` with `unresolvable`, *not valued*, `no sample`, an adapted note and `tried …`. The row renders whether or not `sync-report.json` is present. The health line is unchanged. A lone-unresolvable list now takes the honest-empty statement.

**Files changed:**
- `packages/web/src/list/format.ts` -- `unresolvable` arm in `CombinationState`, its note, figure and sample.
- `packages/web/src/list/display-rows.ts` -- appends `ranking.unresolvable` to the trail.
- `packages/web/src/list/RankedRow.tsx` -- rust money phrase for the unresolvable state.
- `packages/web/src/list/CombinationRow.tsx` -- rust money phrase and rust `×` glyph for the unresolvable state.
- `packages/web/src/list/list-statement.ts` -- honest-empty counts `unresolvable`.
- Tests: `format.test.ts`, `display-rows.test.ts`, `ranked-list.test.tsx`, `expansion.test.tsx`, `list-statement.test.ts`, `App.test.tsx` (the story 2.3 → 2.6 hand-off describe block).
- `docs/stories/deferred-work.md` -- two appended item-18 entries: the state-4 note wording `[NOTE FOR UX]`, and the widened F3 grouping claim plus the "yet" copy `[NOTE FOR UX]`.

**Review findings:** 21 findings. 8 low were patched (the ledger entry, the "yet" and grouping notes, the trade-link test twice, the rust glyph, the docblock, the test name). Nothing was deferred to the frontmatter. 13 were rejected: 8 false and 5 low (intent 3, intent 4, blind 3, blind 5, blind 7). Each rejected finding's reason is in the triage log. The verification-gap layer found no gaps.

**Follow-up review:** not recommended. The patches were 0 high and 0 medium, and 8 were low.

**Verification:** `pnpm check` passes (typecheck, lint, depcruise: no violations, 204 modules). `pnpm test` passes: 88 files, 1160 tests. The matrix audit covers every row: trail order (`display-rows.test.ts`, `ranked-list.test.tsx`), row cells and stale age (`ranked-list.test.tsx`), report absent and only-unresolvable (`App.test.tsx`), and expansion (`expansion.test.tsx`).

**Residual risks:**
- No browser check was run, because the committed data has no unresolvable entry (retro action 10). The rust colours are asserted only through jsdom inline styles.
- The honest-empty "In canonical order … yet" copy is now shown over a third group (retro item 20, ledgered).
- The adapted state-4 note awaits a UX ruling.
