# Deferred work

Each entry names work carved out of a spec. Append new entries. Do not rewrite other entries. Remove an entry in the last commit of the branch that lands its work, or in a commit that names the decision to cancel it. `pnpm deferred:issues` opens one GitHub issue for each entry, and the `deferred-work-sweep` skill keeps its run state in that issue, not here. A human can add a `retry_when:` line to an entry as a precondition: the sweep skips the entry until the condition is true.

## Deferred from: epic 1 retro item 15 (2026-09-26)

- source_spec: `docs/stories/spec-epic-1-retro-item-15-deferred-ledger-and-commit-convention.md`
  summary: The `deferred-ledger-audit` review layer is wired only into `bmad-build` and `bmad-build-auto`; a spec finalized or edited outside a BMad build workflow (a `bmad-retrospective` output, a `bmad-correct-course` change, a hand edit) gets no automatic check that its carved-out work reached `deferred-work.md`.
  evidence: Blind-hunter review of this item's own diff. The frozen Intent scoped the fix to the two build skills, so this is a known scope boundary and not a defect in what was built; worth revisiting if a carve-out is later found to have escaped through one of those other paths.
  retry_when: A carved-out item is found in `deferred-work.md` history that originated from `bmad-retrospective`, `bmad-correct-course`, or a hand-edited spec rather than a `bmad-build`/`bmad-build-auto` run.

- source_spec: `docs/stories/spec-epic-1-retro-item-15-deferred-ledger-and-commit-convention.md`
  summary: The `deferred-ledger-audit` instruction text is duplicated three times (dispatch and oneshot layers in `_bmad/custom/bmad-build.toml`, plus `_bmad/custom/bmad-build-auto.toml`) instead of factored into one shared `review-prompts/*.md` file the way `edge-case-hunter` and `verification-gap` are.
  evidence: Blind-hunter review of this item's own diff, confirmed against `_bmad/scripts/render_skill.py`: a customization `instruction` string gets `{skill-root}` substituted (the *skill's* own directory) but never `{project-root}` — that substitution exists only for tokens inside a skill's own source `.md` files. There is no safe way to point all three copies at one project file without either a portable `{project-root}` token in `instruction` (an upstream skill capability this project cannot add) or hardcoding this checkout's absolute path (breaks on any other clone). Revisit if a future skill update adds such a token.
  retry_when: The installed `bmad-build`/`bmad-build-auto` skill version supports a `{project-root}` (or equivalent) substitution inside `[[workflow.review_layers]].instruction`.

- source_spec: `docs/stories/spec-1-1-the-four-package-workspace-and-the-offline-development-loop.md`
  summary: No mechanical check enforces the AC "every installed version matches the Stack table exactly".
  evidence: `save-exact=true` governs only future `pnpm add`; a `^` range edited into a manifest later fails nothing. The obstacle is that the spine's Stack table is prose, so any test would pin a hand-copied second source of truth that can drift from the table it claims to enforce — worth solving only alongside a machine-readable Stack table.

## Deferred from: story 1.11 (2026-09-26)

- source_spec: `docs/stories/spec-1-11-league-validation-as-a-run-start-gate.md`
  summary: A 429's `retryAfterMs` is not kept across processes, so the next scheduled `pnpm sync` may send inside the penalty window. Unverified.
  evidence: The ledger is per process by AD-8's design (`packages/sync/src/trade/client.ts`), and both the pricing step's yield and the league gate's yield (`packages/sync/src/league/league-gate.ts`) drop the delay. To settle it, compare the player's scheduler interval with the `Retry-After` windows the trade API actually returns.

## Deferred from: story 2.1 (2026-09-26)


## Deferred from: story 2.2 (2026-09-26)

- source_spec: `docs/stories/spec-2-2-the-raw-ranking-branch-league-scoped-and-computed-at-read-time.md`
  summary: A `no-listings` state recorded in a previous league stays `no-listings` after a league reset. The state carries no league, so `core` (`packages/core/src/rank.ts`) cannot restate it as `not-yet-synced` / `league-mismatch`. The only league-bearing field is the entry's `lastSearchLeague`, and AD-9 forbids `core` to read it.
  evidence: Spec 2.2 restates only a `priced` observation whose `observation.league` differs from the active league. `unresolvable` has the same shape, and so does a published `not-yet-synced` state such as `no-exchange-rate`: it carries no league either, so it outlives a reset under its old reason instead of `league-mismatch`. Settle it with an AD-9 or AD-19 ruling: either `sync` resets carried-over states on a league change, or `core` gains a sanctioned league input for non-`priced` states.

## Deferred from: story 2.3 (2026-09-26)

- source_spec: `docs/stories/spec-2-3-the-ranked-list-at-rest-rows-units-freshness-and-the-key-block.md`
  summary: [NOTE FOR UX] The key block does not list `† pruned` or `* pinned`. The open UX note must rule whether and when they join the key, and `packages/web/src/list/KeyBlock.tsx` must then add them.
  evidence: Spec 2.3 Boundaries say "`† pruned` / `* pinned` are not listed (open UX note)". No story owns adding them after the ruling.
- source_spec: `docs/stories/spec-2-3-the-ranked-list-at-rest-rows-units-freshness-and-the-key-block.md`
  summary: [NOTE FOR UX] The key block and running foot copy exists only in `mockups/key-hero-resting.html`, not in DESIGN.md prose. DESIGN.md must write it out, or state that the mockup is normative for it. Then check `KeyBlock.tsx` and `RunningFoot.tsx` against DESIGN.md.
  evidence: Spec 2.3 Implementation Notes record that the copy was taken verbatim from the mockup. A mockup is not an owner document, so the copy can drift without a signal.
- source_spec: `docs/stories/spec-2-3-the-ranked-list-at-rest-rows-units-freshness-and-the-key-block.md`
  summary: [NOTE FOR UX] Tier 2 and tier 3 ranked rows differ only in rank-numeral colour (`ranked-row-tier-2` / `-3` in DESIGN.md set only `rankColor`). Spec 2.3's grayscale AC asks that tiers be told apart by a glyph, a word, a weight or an italic.
  evidence: `packages/web/src/list/RankedRow.tsx` follows DESIGN.md: tier 1 sets 700, tiers 2 and 3 are both 400 with no other cue. In grayscale, only the gray level of the numeral separates them. Settle it with a DESIGN.md ruling: add a non-colour cue to tier 2, or state that luminance alone is enough between tiers 2 and 3.
- source_spec: `docs/stories/spec-2-3-the-ranked-list-at-rest-rows-units-freshness-and-the-key-block.md`
  summary: [NOTE FOR UX] With exactly 21 rows the list affordance prints `+ Read the remaining 1 rows`. DESIGN.md `listCopyClosed` is `+ Read the remaining {N} rows` and gives no singular form.
  evidence: `expandCopy` in `packages/web/src/list/RankedList.tsx` prints DESIGN.md's copy verbatim for every N. Settle it with a DESIGN.md singular form, then a one-branch change and a test.

## Deferred from: story 2.5 (2026-09-26)

- source_spec: `docs/stories/spec-2-5-row-expansion-the-evidence-behind-a-row-its-tombstones-and-its-trade-link.md`
  summary: The tombstone band (`+ N pruned` toggle, local to its panel and reset on close; struck-through Combination with `† pruned` leading the combination cell, *not tracked*, prune reason + `removed YYYY-MM-DD` in 560 + 406, no trade link) is not built.
  evidence: Decision 2026-09-26 on spec 2.5 Open Question 1 (option a). A pruned raw entry gets no row, so no day-one panel can hold a tombstone. `TrackedEntry` carries `prunedReason` but no removal date, and no owner document defines one. The removal-date field needs a contracts and owner-doc decision before the band can print its date.
- source_spec: `docs/stories/spec-2-5-row-expansion-the-evidence-behind-a-row-its-tombstones-and-its-trade-link.md`
  summary: No one has checked in a real browser that open panels survive `− Show only the top 20` and the regrow. Only `packages/web/src/list/expansion.test.tsx` (rows 3 and 22) covers it.
  evidence: Spec 2.5 Implementation Notes say the committed `data/` has only two rows, so the agent-browser grow/collapse check in its manual checks could not be run. To settle it, run that check once a dataset with more than 20 ranked rows is served (a fixture served through `pnpm dev`, or committed data after Story 2.7). Open rows 3 and 22, collapse, regrow, and confirm that both panels are open and flush under their rows.
- source_spec: `docs/stories/spec-2-5-row-expansion-the-evidence-behind-a-row-its-tombstones-and-its-trade-link.md`
  summary: [NOTE FOR UX] DESIGN.md `combination-row` says the right padding is "12px on every cell", and the mockup `key-expanded-states.html` CSS comment says the same. The mockup's `.k5` rule (the 24px trade-link cell) has none. Story 2.5 followed `.k5`, so `packages/web/src/list/CombinationRow.tsx` and `combinationLine1Columns` in `theme/tokens.ts` give the trade-link cell `padRight: 0`. DESIGN.md should exempt the trade-link cell or rule otherwise.
  evidence: Spec 2.5 Implementation Notes (the trade-link cell padding bullet). The owner text and the mockup geometry disagree, and nothing flags the drift. The tests `tokens.test.ts` and `expansion.test.tsx` assert 0, so a ruling for 12px must update them too.

## Deferred from: story 2.6 (2026-09-27)

- source_spec: `docs/stories/spec-2-6-the-trust-strip-its-health-line-and-the-sync-report-panel.md`
  summary: [NOTE FOR UX] The Sync Report panel copy is provisional. It prints only figures `sync-report.json` publishes, with no sum and no numerator: `10 tracked list · 1 league validation requests this pass.` · `N tracked entries were not reached in the last sync pass.` · `N entries are unresolvable.` · `N pinned-starvation records.` with one `pinnedRefreshed of pinnedCount pinned entries refreshed` line per record · `86% of 29 tracked Item Classes.` Zeros print in the panel. With `sync-report.json` absent, each of the five groups reads italic *unknown*. The mockup's prose (a request total, a measured daily ceiling, `N of M tracked entries`, `across N Item Classes`, a record date, a coverage numerator, explanatory sentences) needs figures the report does not publish. UX owns the final wording, including singular forms (`1 entries`, `1 pinned-starvation records` read as written) and whether the panel explains any figure.
  evidence: Spec 2.6 decision 2026-09-27. The copy lives in `panelColumns` in `packages/web/src/frame/trust-facts.ts`; `trust-facts.test.ts` and `trust-strip.test.tsx` assert it, so a ruling changes those three files.

## Deferred from: code review of spec-tracked-json-curation-tooling.md (2026-09-27)

- source_spec: `docs/stories/spec-tracked-json-curation-tooling.md`
  summary: `modText` in `.claude/skills/tracked-json/scripts/lookup.ts` gets the mod text by parsing `sourceModifierId`, and `WEIGHTS-FILE-SCHEMA.md` (the `sourceModifierId` row) calls that field "Opaque to the app".
  evidence: The spec's Always list authorizes the parse. So the spec and the weights contract disagree. The owner of the weights contract decides between two options: allow this curation-only consumer to depend on the layout, or make the producer emit the mod text as its own field. Until that decision, a test over the committed weights detects a change of the layout.

## Deferred from: code review of spec-2-7-day-one-deployed-the-honest-empty-league-reset-and-the-published-site.md (2026-09-27)

- source_spec: `docs/stories/spec-2-7-day-one-deployed-the-honest-empty-league-reset-and-the-published-site.md`
  summary: The literal copy of the two list statements is owed to its owner document. The copy is `In canonical order, not ranked: no tracked unit has a price from <league> yet.` (state 23) and `Nothing clears your Payout Threshold of <x.xx> Divine.` (state 25).
  evidence: The 2026-09-27 human decision in spec 2.7 (Decisions) fixed the copy. Only that spec and `packages/web/src/list/list-statement.ts` (`honestEmptyCopy`, `nothingClearsCopy`) carry it. EXPERIENCE.md states 23 and 25 describe the declaratives, and revision 4 closed the nothing-clears copy (memlog 204), but neither state holds the literal text. A later UX revision of either state can drift from the code without a signal. The UX owner decides where the text lives.

## Deferred from: story 2.8 (2026-09-27)

- source_spec: `docs/stories/spec-2-8-the-unrankable-appendix-and-the-day-one-page-it-completes.md`
  summary: The `docs/epics.md` Story 2.8 AC for state 16 still reads that, for an Unrankable Item Class some of whose Base Types still rank on the raw branch, "the note names that fact". Epic 2 prints no such note. The epics AC edit is owed. [NOTE FOR UX] DESIGN.md, *Where a class's Base Types still rank* (the `{spacing.col-appendix-note}` italic note, *some of its Base Types rank on the raw branch*), still prescribes that note and needs the same ruling.
  evidence: The 2026-09-27 human decision in spec 2.8 (Decisions, "No state-16 note in Epic 2"): "Base Type name is enough for the player, no need to show class name." A raw row already names its Base Type, the page does not relate a raw base to its Item Class, and the appendix note cell stays empty. No class-membership source was built.
- source_spec: `docs/stories/spec-2-8-the-unrankable-appendix-and-the-day-one-page-it-completes.md`
  summary: [NOTE FOR UX] The key block's Provenance gloss `? unknown — absent: partial pool, upper bound only` does not describe the Unrankable appendix's `class absent from weights file` rows, which carry the same `? unknown` mark. The gloss, or the mark on those rows, needs a UX ruling.
  evidence: The 2026-09-27 human decision in spec 2.8 (Decisions, "Mark cell") puts `TrustMark kind="unknown"` with the word `unknown` on every `class absent from weights file` row, as `mockups/key-hero-resting.html` shows. `packages/web/src/list/KeyBlock.tsx` glosses that mark only as a partial pool, which is not the fact these rows state.

## Deferred from: epic 2 retrospective (2026-09-27)

- source_spec: `docs/stories/epic-2-retro-2026-09-27.md`
  summary: Before Epic 3, decide whether `catalogue/stats.json` and `catalogue/static.json` stay required page fetches, whether the denomination text comes from `static.json` (the Story 2.1 AC at `docs/epics.md:1022` says so, but `Divine` is a literal in `PayoutThreshold.tsx`, `format.ts`, `list-statement.ts` and `Masthead.tsx`), and whether the large files use `no-cache` revalidation instead of `no-store`. Owner: architect.
  evidence: Retro F6. `packages/web/src/load/artifacts.ts` fetches and validates both catalogue files on every load, and no web source reads them. The weights and catalogue files together are several MB per reload under `cache: 'no-store'` (`load/load-artifacts.ts:75`).
- source_spec: `docs/stories/epic-2-retro-2026-09-27.md`
  summary: Once a git remote exists, harden the Pages deploy. Add a test job that excludes the committed-data suites and that the deploy `needs:`. Parse the eight kept artifacts with their `@poe/contracts` envelopes during `pnpm build`. Pin the actions in `deploy.yml` to commit SHAs, as `openwiki-update.yml` does.
  evidence: Retro F16 (review A5, A17, V4). `deploy.yml` gates only on `pnpm check`. `tools/prune-pages.mjs` checks that a required artifact exists, not that it is valid. The job holds `pages: write` and `id-token: write` with tag-pinned actions.
  retry_when: A git remote is configured and `deploy.yml` has run once.
- source_spec: `docs/stories/epic-2-retro-2026-09-27.md`
  summary: Layout claims are proven by arithmetic only. Record one agent-browser measurement of each committed-chrome block against `tokens.ts` `committedChrome` and the 1920 budget, and of `[data-cell]` text fit (`scrollWidth <= clientWidth`) for the "an open question", "no figure yet" and "never attempted" phrases. Add a committed browser fixture set with more than 20 rows and every Price State, so grow/collapse, stale marks and unpriced rows can be seen in a browser.
  evidence: Retro F17 and P3 (review V5, V6). `tokens.test.ts:131-168` and `ranked-list.test.tsx:114-121` sum style strings. No test in the repo measures a rendered box. The committed data gives 2 raw rows, so stories 2.3 and 2.5 could not check grow/collapse in a browser (deferred-work.md story 2.5 entry on grow/collapse).
- source_spec: `docs/stories/epic-2-retro-2026-09-27.md`
  summary: Lower-severity seam findings from the epic 2 diff review. None is reached by today's data:
    - no error boundary, so a render throw gives a blank page (`App.tsx:122-135`)
    - no fetch timeout, so a hung request keeps the skeleton indefinitely (`load/load-artifacts.ts:68-89`)
    - an empty list with no statement when every entry is unresolvable or crafted (`list/list-statement.ts`)
    - the threshold draft shows "3.50" while the page prints "3.00", and the unrounded price is compared with the 2dp threshold (`threshold/PayoutThreshold.tsx:138-146`)
    - an aborted run's `runStartedAt` prints as a completed sync, and a future stamp reads "< 1 minute ago" (`frame/trust-facts.ts:61-81`)
    - a `data/` path that collides with a bundle output (`index.html`, `assets/`) is pruned from `dist` (`tools/prune-pages.mjs`)
    - the pending `TrustStripSlot` reserves no absence or health lines (`frame/TrustStrip.tsx:140-155`)
    - the recipes-absent line claims "no crafted rows can be ranked" although `rank` never reads recipes (`frame/AbsenceLines.tsx:44-48`)
  evidence: Retro F18. `docs/reviews/review-epic-2-diff.md` items A8, A9, A10, A13, A14, A15, A18, E7, E10 and E12.

## Deferred from: epic 2 retro item 18 rebase onto retro item 20 (2026-09-27)

- source_spec: `docs/stories/spec-epic-2-retro-item-18-render-unresolvable-raw-bases-as-rows.md`
  summary: [NOTE FOR UX] EXPERIENCE.md state 23 (revision 8) gives every honest-empty EV cell *no figure yet*, whatever the row's Price State, and `isHonestEmpty` now counts `unresolvable` rows. The rebase applied the ruling as written, so an `unresolvable` row reads *no figure yet* in the list and keeps *not valued* in its expansion. For a list of only `unresolvable` rows this contradicts revision 9: the statement drops "yet" because no sync will bring a price, while each EV cell still says "yet". UX to rule whether an `unresolvable` row keeps *not valued* while honest-empty, or whether the all-unresolvable case is an exception.
  evidence: `packages/web/src/list/display-rows.ts` `toDisplayRows` honest-empty branch. The test "folds the unresolvable rows into the honest-empty canonical sequence" in `display-rows.test.ts` and the two "unresolvable hand-off" tests in `App.test.tsx` assert *no figure yet*, so a ruling that keeps *not valued* must update them.
- source_spec: `docs/stories/spec-deferred-consolidate-duplicated-web-helpers.md`
  summary: [NOTE FOR UX] DESIGN.md `listCopyClosed` (`+ Read the remaining {N} rows`) has no singular form, but the page now prints `+ Read the remaining 1 row` for one hidden row; DESIGN.md should spell the singular so the owner doc and the code agree.
  evidence: Epic 2 retro action item 11 (P5 calls "1 rows" a bug) ordered one pluralize helper. `expandCopy` in `packages/web/src/list/RankedList.tsx` now uses `plural` from `packages/web/src/shared/text.ts`, and `ranked-list.test.tsx` asserts the singular at 21 rows. The story 2.3 `[NOTE FOR UX]` entry on "1 rows" described the reverse drift (code verbatim from DESIGN.md) and can close with this one. The same applies to the provisional Sync Report panel singulars (`1 tracked entry was`, `1 entry is`, `1 pinned-starvation record`, `pinned entry`, `tracked Item Class`) under the story 2.6 panel-copy entry.

## Deferred from: review fix of the web helpers consolidation (2026-09-27)

- source_spec: `docs/stories/spec-review-fix-consolidate-web-helpers-findings.md`
  summary: [NOTE FOR UX] The Sync Report requests line now prints `10 tracked list · 1 league validation request this pass.`, and its noun agrees only with the league-validation figure, so the tracked-list figure has no noun of its own; UX should rule the wording (for example one agreeing noun per figure).
  evidence: The review of `78db4da..ec38dce` found `1 league validation requests`. The fix routes the one trailing noun through `plural` on the league-validation count (`panelColumns` in `packages/web/src/frame/trust-facts.ts`). The story 2.6 panel-copy `[NOTE FOR UX]` entry still quotes the old plural string.

## Deferred from: epic 2 retro item 18 review fix (2026-09-27)

- source_spec: `docs/stories/spec-epic-2-retro-item-18-render-unresolvable-raw-bases-as-rows.md`
  summary: Only Raw Bases in `ranking.unresolvable` render as trailing unpriced rows. The Epic 3 story that adds crafted rows must give a crafted `unresolvable` entry the same state-4 treatment (*not valued* in rust, the `× unresolvable` combination row, the state-4 note) and extend `toDisplayRows`, `list-statement.ts` and their tests to match.
  evidence: The item-18 spec's Never list says "Do not render crafted unresolvable rows (Epic 3)". `packages/web/src/list/display-rows.ts` appends `ranking.unresolvable` with the raw cues only. The story 2.5 entry covers the crafted expansion panel, not the list row.
- source_spec: `docs/stories/spec-epic-2-retro-item-18-render-unresolvable-raw-bases-as-rows.md`
  summary: No browser check has covered an `unresolvable` Raw Base row. When a fixture set with an `unresolvable` entry is served (retro action 10), run an agent-browser check: the row trails `noListings` and `notYetSynced`; its EV cell prints *not valued* in `colors.rust`, and *no figure yet* in ink while honest-empty; its expansion shows the rust `×` with `unresolvable`, *not valued*, `no sample`, the state-4 note and `tried …`.
  evidence: The item-18 spec's Residual risks: the committed data has no `unresolvable` entry, so the colours are asserted only through jsdom inline styles.
- source_spec: `docs/stories/spec-epic-2-retro-item-18-render-unresolvable-raw-bases-as-rows.md`
  summary: [NOTE FOR UX] The review of `78db4da..ec38dce` resolved the colour half of the "item 18 rebase onto retro item 20" entry as option (b): an honest-empty `unresolvable` row keeps *no figure yet*, and `RankedRow` takes the EV colour from the phrase shown, so the phrase prints in ink and rust goes only to *not valued*. The copy half stays open for UX: in a list of only `unresolvable` rows the statement now drops "yet" (revision 9), while each EV cell still reads *no figure yet*.
  evidence: `packages/web/src/list/RankedRow.tsx` (the money-phrase colour), `packages/web/src/list/list-statement.ts` (`honestEmptyCopy`). `ranked-list.test.tsx` "prints an honest-empty unresolvable row as no figure yet in ink, not rust" and the `App.test.tsx` lone-unresolvable hand-off test assert both halves together, so a UX ruling that changes the phrase must update them.

## Deferred from: epic 2 retro item 12, UX reconciliation pass (2026-09-27)

- source_spec: `docs/stories/epic-2-retro-2026-09-27.md`
  summary: Architect. AD-5 says `web` replaces each underscore with a space and uses "no display mapping". UX memlog 230 rules that a trailing defence-type suffix prints as defence words (`Gloves_dex_int` → `Gloves (Dex/Int)`, `Body_Armours_str_dex_int` → `Body Armours (Str/Dex/Int)`). Amend AD-5 to admit that one rule. After that, `unitLabel` (`packages/web/src/list/format.ts`) implements it with a test for each suffix form. Today's tracked classes (`Amulets`, `Bows`, `Crossbows`, `Emerald`) carry no suffix, so nothing on the page is wrong yet.
  evidence: Finding HR-8. UX memlog 230. `ARCHITECTURE-SPINE.md` AD-5. `docs/epics.md:1125-1132` repeats "no display mapping" and the `Bow` example, so the PM sweeps it after the AD changes.
- source_spec: `docs/stories/epic-2-retro-2026-09-27.md`
  summary: Architect. Confirm that the Chase Combination short-form table is a `web` product constant keyed by `statId` (UX memlog 231), and name its module, before the Story 3.5 spec. No contract or artifact holds it today.
  evidence: Finding HR-9. UX memlog 231. EXPERIENCE.md short-form section. Story 3.5 built the table on that reading, keyed by `statId`, in `packages/web/src/list/short-forms.ts` (`SHORT_FORMS`); the formatter that reads it is `packages/web/src/list/combination-text.ts`. The ruling is still open.
- source_spec: `docs/stories/epic-2-retro-2026-09-27.md`
  summary: Architect. UX memlog 232 rules that a crafted row's Age cell is the age of its figure: its inputs are the priced entries the EV rests on. Confirm that AD-10's "oldest timestamp of every input" means those EV-contributing entries, and that `core` publishes the fallback reading (the oldest attempted entry when nothing is priced, *never attempted* when every entry is `never-synced`). Do this before the Story 3.5 and 3.6 specs.
  evidence: Findings HR-17 and XS-35. UX memlog 232. `ARCHITECTURE-SPINE.md` AD-10.
- source_spec: `docs/stories/epic-2-retro-2026-09-27.md`
  summary: Architect. UX memlog 233 derives a recipe's option word from the grade prefix its currency ids share (`greater-…`, `perfect-…`; none reads `regular`), and a set with mixed grades or duplicate words is refused. Name the prefixes that count as grades, the layer that derives the word, and the cross-file validity predicate (IMPLEMENTATION-NOTES) before the Story 3.4 spec. No contract change.
  evidence: Finding HR-10. UX memlog 233. `CraftRecipeSchema` (`packages/contracts/src/craft-recipe.ts`) carries no display string. `catalogue/static.json` spells `greater-orb-of-transmutation` and `perfect-orb-of-augmentation`.
- source_spec: `docs/stories/epic-2-retro-2026-09-27.md`
  summary: Dev. `FETCH_FAILURE_TITLE` (`packages/web/src/frame/FailureScreen.tsx:14`) becomes `A required file did not arrive.` (UX memlog 229, DESIGN.md `fetch-failure-screen.titleText`). Update the tests that assert the old title, and the `App.tsx:33` docblock that says "all eight fetches".
  evidence: UX memlog 229. The old title restated AD-24's count, and the pending AD-24 amendment makes it seven.
- source_spec: `docs/stories/epic-2-retro-2026-09-27.md`
  summary: Dev, with the retro item 10 measurement pass. Measure the longest Item Class label under UX memlog 230, `Body Armours (Str/Dex/Int)` at tier-1 weight 700, against the space the name really has: the 214px unit cell (`{spacing.col-unit}` less `{spacing.pad-unit-right}`) less the 14px unit-glyph box and its 4px gap. Raise a `[NOTE FOR UX]` if it overruns.
  evidence: UX memlog 230. The unit-cell budget is a verified sum in DESIGN.md, and no rendered box is measured today (retro F17).
- source_spec: `docs/stories/epic-2-retro-2026-09-27.md`
  summary: "[NOTE FOR UX] Copy with no owner: the mockups are the only source for this printed text. The masthead title, the asking-price line's second sentence and the appendix lead (HR-15, HR-16). The tombstone band heading (XS-28). The expansion panel sub-lines (XS-29). The Sync Report panel prose (XS-30). Write each into DESIGN.md or EXPERIENCE.md, or rule that the shipped code's wording is the owner text. The key block and the foot are already ledgered (the entry citing retro F2 copy)."
  evidence: Findings HR-15, HR-16, XS-28, XS-29 and XS-30 (retro item 12 audit). The mockups carry "spine gap" markers at each site.
- source_spec: `docs/stories/epic-2-retro-2026-09-27.md`
  summary: "[NOTE FOR UX] Styles and rules the spines leave open, each needed before an Epic 3 spec quotes it: the separator and size between a Price State and its reason or glyph (XS-31); whether an age inside the expansion past 48h gets the rust mark (XS-32); the italic and colour of line-two notes and the sample cell (XS-33); whether the Raw Base panel title is italic (XS-34); whether `Item Level 82` in a degenerate Combination's line one is a literal or the entry's own level (XS-36); the note on a non-priced Raw Base combination, which today lives only in code (XS-37); and the gloss for the `unknown` mark on a `class absent from weights file` row (HR-14)."
  evidence: Findings XS-31 to XS-34, XS-36, XS-37 and HR-14 (retro item 12 audit). HR-13 (state 16 class membership) and HR-18 (tier 2 against tier 3 by colour alone) are already ledgered and are not repeated here.

## Deferred from: epic 2 retro item 8 (2026-09-27)

- source_spec: `docs/stories/spec-epic-2-retro-item-8-seven-artifacts-no-cache.md`
  summary: "Note. The epic 2 retrospective entry \"Parse the eight kept artifacts … during `pnpm build`\" predates this change. Its \"eight\" now means the seven AD-24 artifacts (`ALLOWLIST` in `tools/prune-pages.mjs`); `catalogue/static.json` is no longer kept in the Pages build."
  evidence: Spec `spec-epic-2-retro-item-8-seven-artifacts-no-cache.md`. `pnpm build` logs `prune-pages: removed … catalogue/static.json …`.

## Deferred from: story 3.1 (2026-09-27)

- source_spec: `docs/stories/spec-3-1-consuming-a-schema-conformant-weights-file-and-its-pool-completeness-contract.md`
  summary: "[NOTE FOR ARCHITECT] `WeightsFileSchema` refuses a few values that *Validation* in `WEIGHTS-FILE-SCHEMA.md` does not list as hard errors: an empty `producer.id`, a `producer.generatedAt` that is not ISO-8601 UTC, and an empty `categoryId`, `className` or `statId`. The trust strip needs the first two (`utcDate` throws on a non-ISO instant). The reused id schemas carry the rest. Either list them in *Validation*, or say that *Validation* covers only the rules beyond the typed Shape."
  evidence: Story 3.1 review, triage row 2. `packages/contracts/src/weights-file.ts`, `packages/web/src/frame/trust-facts.ts` `utcDate`.

## Deferred from: story 3.2 (2026-09-27)

## Deferred from: UX revision, DESIGN.md 13 and EXPERIENCE.md 16 (2026-09-27)

- source_spec: `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md` (Epistemics, the uniform-prior banner, state 34)
  summary: "PM. Sweep `docs/epics.md` Story 3.6 to UX memlog 238. The banner AC (\"no probability in the loaded set carrying `measured`\") should cite the EXPERIENCE.md rule that the banner counts only the active recipe's pairs, so a recipe switch can raise or lower it. The per-row mark AC (\"a recipe switch may change a class's mark\") should cite state 34, where the mark swaps silently. Cite, do not restate."
  evidence: UX memlog 238. `docs/epics.md` Story 3.6 banner and per-row mark ACs. This closes the PRD revision 23 `[NOTE FOR UX]` on the per-pair mark.

## Deferred from: spec-deferred-rev23-weight-zero-containment-and-empty-pools (2026-09-27)

- source_spec: `docs/stories/spec-deferred-rev23-weight-zero-containment-and-empty-pools.md`
  summary: "[NOTE FOR PM] `docs/epics.md` (\"a pool present, declaring `complete`, over no entries at all\") should cite AD-17's total-weight reading of an empty pool (IN §3), not an entry count. The stories that build AD-17's third cause and `sync`'s coverage figure owe IN §3's `W = 0` test: a slot of only weight-0 tiers is empty."
  evidence: This change guarded `contains` on `weight === 0` (IN §1) in `packages/core/src/probability.ts`. `rank.ts` tests no pool emptiness today and `sync` does not build the coverage figure yet, so no emptiness code changed there. `probability.ts` already keys `empty-eligible-pool` on total weight `0`.

## Deferred from: spec-sync-continuous (2026-09-27)

- source_spec: `docs/stories/spec-sync-continuous.md`
  summary: "Note. `pnpm sync` is now the long-running session, and the one-chunk command moved to `pnpm sync:batch` (`packages/sync/src/sync-batch.ts`). An open entry written before 2026-09-27 that names `pnpm sync` or `packages/sync/src/sync.ts` for the one-chunk command now means `pnpm sync:batch` and `sync-batch.ts`. The entries themselves are not edited."
  evidence: Spec `spec-sync-continuous.md`, Code Map. `package.json` scripts `sync` and `sync:batch`.
- source_spec: `docs/stories/spec-sync-continuous.md`
  summary: "[NOTE FOR ARCHITECT] Two owner-document sentences no longer match the code. First, `IMPLEMENTATION-NOTES.md` §5.3 *Penalty memory across processes* says \"Two chunk endings write a `notBefore` … and nothing else does\", and spine AD-8 names only the 429 and the malformed-request abort. But the gate's non-429 4xx (`LeagueRequestRejectedError`) now writes the abort `notBefore` (`now + staleLockAfter`) in both `pnpm sync` and `pnpm sync:batch`. Second, spine AD-7 says the session's lock \"is never held across a wait\", but the in-chunk spread waits between fetches do hold it. The sentence means a session wait."
  evidence: Review Triage Log row 33. `packages/sync/src/chunk/run-chunk.ts` failure path (`rejected ? notBeforeAfterAbort(...)`), and the run-chunk test that expects `notBefore: '2026-09-26T18:00:00.000Z'` after a gate 4xx. The Review brief (`AGENT-WORKFLOW.md`) forbids a triager to edit the owner document.
- source_spec: `docs/stories/spec-deferred-unawaited-request-reported-by-nothing.md`
  summary: The `web` project does not load `test/global-setup.ts`, so a request that a web test starts but does not await, and that fires after the last file of a worker closed, is blocked but reported by nothing, and the run passes.
  evidence: AGENTS.md forbids edits to `packages/web/vite.config.ts`, where the `web` test project is configured. Without that global setup, `inject('noNetworkRecordDir')` returns `undefined` in `test/setup.ts`, and the guard keeps only its in-memory record. The root, contracts, core and sync projects load the global setup and fail the run.
- source_spec: `docs/stories/spec-deferred-unawaited-request-reported-by-nothing.md`
  summary: The `web` gap could be closed without editing `packages/web/vite.config.ts`, by declaring the `web` project inline in the root `vitest.config.ts` `projects` with `extends: './packages/web/vite.config.ts'` and `globalSetup`, and excluding `packages/web` from the `packages/*` glob; nobody has decided whether that change to how `web` is loaded is acceptable.
  evidence: Review of the deferred-unawaited-request-reported-by-nothing change (blind layer). The root `projects` array loads every `packages/*` config as is, so an inline `web` entry would run `web` twice unless the glob excludes it. The owner of the `web` test config decides.
- source_spec: `docs/stories/spec-deferred-openwiki-update-lets-model-stage-agents.md`
  summary: `peter-evans/create-pull-request` carries commits already made on the checked-out HEAD into the PR branch, and `add-paths` filters only uncommitted changes, so if `openwiki code --update` commits locally it can still put `AGENTS.md`, `CLAUDE.md` or the workflow file into the auto-PR.
  evidence: Unverified. `add-paths` in `.github/workflows/openwiki-update.yml` now lists only `openwiki`, but nothing in the workflow checks that HEAD still equals `github.sha` before the `create-pr` step. To settle it, find out whether `openwiki@0.6.0` (`openwiki code --update --print`) or its model can run `git commit`. If it can, add a step before `create-pr` that refuses or soft-resets any commit on top of `github.sha`.

## Deferred from: story 3.3 (2026-09-27)

- source_spec: `docs/stories/spec-3-3-the-five-cross-file-checks-defined-once-and-run-by-both-shells.md`
  summary: "[NOTE FOR ARCHITECT] A real `statId` rolls both kinds, which contradicts AD-17's premise for kind agreement (\"a `statId` either rolls a value or it does not\"). On `weapon.crossbow`/`Crossbows` the suffix `explicit.stat_1967051901` has a valueless T1 tier at item level 55 and a banded `[2, 2]` T1 tier at 82, so no reference on that `statId` can pass the universal quantifier at a floor of 82. The six Crossbows entries on it are now `pruned`. Decide whether the quantifier stays universal, or reads only the lines of the reference's own kind."
  evidence: `pnpm tracked:lookup tiers explicit.stat_1967051901 --class Crossbows`. `packages/core/src/cross-file.ts` `kindAgreement` implements IN §2.3 and AD-17 as written.
- source_spec: `docs/stories/spec-3-3-the-five-cross-file-checks-defined-once-and-run-by-both-shells.md`
  summary: "[NOTE FOR UX] The cross-file diagnosis line format (`check · canonical key · detail`, one verbatim line per failure) and the empty-group behaviour (no failure renders no group, not a zero line) are provisional. Rule on both in EXPERIENCE.md."
  evidence: `packages/web/src/frame/trust-facts.ts` `diagnosisLine` and `diagnosisGroups`; `trust-facts.test.ts` and `trust-strip.test.tsx` assert them.
- source_spec: `docs/stories/spec-3-3-the-five-cross-file-checks-defined-once-and-run-by-both-shells.md`
  summary: "[NOTE FOR ARCHITECT] `AGENT-WORKFLOW.md` *Parallel worktrees* says \"A pass does not cover the checks that `pnpm tracked:check` lists under `pending`.\" `tracked:check` now runs the five cross-file checks and has no `pending` field. Retire the sentence, or state what a pass still does not confirm (a floor declared too high, AD-5)."
  evidence: `packages/sync/src/curation/check.ts`. The spec forbids an edit to an owner document in this story.
- source_spec: `docs/stories/spec-deferred-listenerscript-runs-get-nettcpconnection.md`
  summary: No test runs `snapshotWindows` with a failing listener query, so the first-snapshot path to "nothing listens on port N" is pinned only by reading the code.
  evidence: `snapshotWindows` in `tools/dev-stop/dev-stop.ts` is not exported and no test calls it. It joins `listenerScript` into a larger script, and a hand run of that joined shape with a missing cmdlet exits 1 today. A later edit that inlines its own `SilentlyContinue` query, or wraps the joined script so the `throw` no longer ends it, would make `pnpm dev:stop` print "nothing listens" after a failed query with every test passing. Closing it needs a test seam into `snapshotWindows` (an export or the same `node:child_process` mock the `listenersWindows` failure test uses, reached through an exported caller).
- source_spec: `docs/stories/spec-deferred-pm-sweep-epics-md-to-follow-ux.md`
  summary: The open deferred-work entry that says the tombstone band is not built still describes the band as prune reason plus `removed YYYY-MM-DD` in 560 + 406, and says the removal date needs a contracts and owner-doc decision; UX memlog 234 (DESIGN.md `tombstone-band`, EXPERIENCE.md state 10) has since ruled that line two is the prune reason alone in one 966px cell with no removal date.
  evidence: docs/stories/deferred-work.md, the Story 2.5 entry that begins "The tombstone band (`+ N pruned` toggle". The implementer who takes that entry reads the retired layout. The entry predates this sweep, and this sweep may not edit deferred-work.md.
- source_spec: `docs/stories/spec-deferred-pm-sweep-epics-md-to-follow-ux.md`
  summary: The craft-recipe AC in docs/epics.md (Story 3.4, `{components.craft-recipe}`) prints the two options as the fixed pair `greater | perfect`, but the grade-prefix rule it now cites also gives `regular` for a recipe with no grade prefix and refuses mixed grades or duplicate words; the AC has no Given/When/Then for either branch.
  evidence: docs/epics.md, the `{components.craft-recipe}` AC just above the grade-prefix citation; EXPERIENCE.md `{components.craft-recipe}` and DESIGN.md `craft-recipe.optionTextSource` carry the `regular` and refusal branches. The pair predates this sweep. The architect's grade-prefix predicate is already ledgered before the Story 3.4 spec; the PM owes the AC wording once it lands.
- source_spec: `docs/stories/spec-deferred-no-test-checks-hand-listed-tools.md`
  summary: `tools/prune-pages.mjs` is in `tsconfig.tools.json` only, and that entry checks almost nothing: `checkJs` is `false`, so `tsc` reports no type errors for it, and no ESLint `files` glob names a `.mjs` under `tools/`, so only ESLint's default JS rules apply to it.
  evidence: Pre-existing; the coverage guard (`test/hand-listed-coverage.test.ts`) pins only the include entry that exists. `eslint.config.mjs` `files` has `tools/**/*.ts` and the root-only `*.{ts,mts,cts,mjs}`. Settle it by deciding whether `tools/*.mjs` gets type-checking (`// @ts-check` or `checkJs`) and an ESLint glob, then extend the guard's `tools/prune-pages.mjs` row.
- source_spec: `docs/stories/spec-deferred-no-test-checks-hand-listed-tools.md`
  summary: `tools/setup-git-hooks.mjs` is in no config: `tsconfig.tools.json`, the Vitest `root` project and the ESLint `files` globs all leave it out, so nothing type-checks, lints or tests it.
  evidence: Pre-existing. `tsconfig.tools.json` `include` lists `tools/prune-pages.mjs` but not `tools/setup-git-hooks.mjs`; the coverage guard covers only hand-listed entries, so it is silent about this file.
- source_spec: `docs/stories/spec-deferred-no-test-checks-hand-listed-tools.md`
  summary: The other hand-listed config entries outside `tools/` and `.claude/` have no wiring guard: `test/**/*.ts`, `vitest.config.ts`, `packages/*/vitest.config.ts`, `packages/web/vite.config.ts`, `packages/web/vite.config.test.ts`, `depcruise.rules.mjs` and `.dependency-cruiser.mjs` in `tsconfig.tools.json`, `test/**/*.test.ts` in the Vitest `root` project, and `test/**/*.ts` and `.dependency-cruiser.mjs` in the ESLint `files` glob.
  evidence: Pre-existing. Dropping `test/**/*.ts` from `tsconfig.tools.json` stops the coverage guard itself from being type-checked, and `pnpm check` still passes. The guard's `TARGETS` table could take these rows the same way it takes the `tools/` rows.
- source_spec: `docs/stories/spec-deferred-note-packages-web-vite-config-ts.md`
  summary: The comment at `.github/workflows/deploy.yml:4` still says "the eight AD-24 artifacts", but AD-24 fixes seven.
  evidence: `grep -n eight .github/workflows/deploy.yml` prints line 4. The entry this spec closes covered only `packages/web/vite.config.ts`; the same stale count sits in the workflow comment.
- source_spec: `docs/stories/spec-deferred-load-lookup-ts-through-weightsfileschema.md`
  summary: A `mods` row of `pnpm tracked:lookup` no longer carries the readable mod text; its `text` repeats `modGroup`, and the families of one `modGroup` differ only in `statIds`.
  evidence: The weights contract has no field for the mod text (`sourceModifierId` is opaque), so the typed load cannot print it. The skill now names each stat with `pnpm tracked:lookup stat <statId>`. A `text` per row could be joined from `stats.json` by `statId`, or the producer could emit it, which is the decision of the open `modText` entry on `WEIGHTS-FILE-SCHEMA.md`.

## Deferred from: story 3.4 (2026-10-02)

- source_spec: `docs/stories/spec-3-4-the-crafted-ev-craft-cost-and-the-craft-recipe-control.md`
  summary: "[NOTE FOR ARCHITECT] Take ownership of the recipe-word predicate in IMPLEMENTATION-NOTES, so the grade-ruling entry above (UX memlog 233, finding HR-10) can close. Story 3.4 built the player's Decision: the grades are the currency-id prefixes `greater-` and `perfect-` only; a recipe whose currencies carry neither reads `regular`; `RecipesFileSchema` refuses a recipe that mixes grades (a grade beside an ungraded currency counts as mixed) and two recipes that derive one word (AD-3 refusal)."
  evidence: "`packages/contracts/src/craft-recipe.ts` (`RECIPE_GRADES`, `recipeWord`), `packages/contracts/src/envelopes.ts` (`RecipesFileSchema` refine). The spec forbids an owner-document edit."
- source_spec: `docs/stories/spec-3-4-the-crafted-ev-craft-cost-and-the-craft-recipe-control.md`
  summary: "[NOTE FOR PM] FR-4 owes a ruling on the provisional reason `recipe cannot reach this class`. `core` gives it to an `(Item Class, recipe)` pair whose `combinationProbability` returns `empty-eligible-pool` or `augment-exhausted`; the appendix prints it for the active recipe only. Adopt or reword it. The Emerald case is closed (retro item 34, player decision 2026-10-03): the producer now emits every jewel mod at `itemLevelMin` 75, so both v1 floors reach it and jewels use the same recipe model as other crafted classes. The reason stays provisional for any other unreachable pair."
  evidence: "`packages/core/src/rank.ts` `RECIPE_UNREACHABLE`; `packages/web/src/App.test.tsx`, the committed-data appendix test. Check with `pnpm tracked:lookup` on `jewel/Emerald`, or `combinationProbability` at floors 0, 44 and 70."
- source_spec: `docs/stories/spec-3-4-the-crafted-ev-craft-cost-and-the-craft-recipe-control.md`
  summary: "Player. Replace the four dummy orb rates in `data/currencies.json` (`greater-` and `perfect-orb-of-transmutation` / `-augmentation`, `source: \"dummy, not measured\"`) with measured values. Until the next sync copies them into `dataset.json`, both recipes are uncostable and the page renders state 35."
  evidence: "`data/currencies.json`; `dataset.json` `currencyRates` holds only divine, exalted and chaos."
  retry_when: The player has measured rates for the four orbs.
- source_spec: `docs/stories/spec-3-4-the-crafted-ev-craft-cost-and-the-craft-recipe-control.md`
  summary: "[NOTE FOR UX] Three provisional choices need an owner. (1) State 35's declarative copy: `The <word> Craft Recipe has no Craft Cost figure yet: Item Classes and Raw Bases are ordered apart, not ranked against each other.` (2) The one list-statement slot prints at most one statement, by the precedence honest-empty (23), then uncostable (35), then nothing-clears (25). (3) The crafted panel's sub-line `Payout Threshold N.NN Divine | Craft Recipe <word>. <asking-price sentence>` drops the mockup's lead sentence about the listed Combinations until Story 3.5 lists them."
  evidence: "`packages/web/src/list/list-statement.ts` (`uncostableCopy`, `listStatement`), `packages/web/src/list/format.ts` (`classPanelSubLine`)."
- source_spec: `docs/stories/spec-3-4-the-crafted-ev-craft-cost-and-the-craft-recipe-control.md`
  summary: "The crafted Age cell. A crafted row's Age cell is empty: Story 3.5 built the chase cells and the crafted panel rows, and left the Age cell for the architect's ruling on its inputs (AD-10). The Provenance cell is Story 3.6's."
  evidence: "`packages/web/src/list/display-rows.ts` `ClassDisplayRow.age` is always `undefined`. Story 3.5 Decisions (2026-10-02): the Age cell stays deferred."
- source_spec: `docs/stories/spec-3-4-the-crafted-ev-craft-cost-and-the-craft-recipe-control.md`
  summary: "Review B3. The dummy orb rates in `data/currencies.json` reach `dataset.json` on the next sync. The published page then prints made-up Craft Costs and crafted EVs, and nothing flags them. No layer reads a rate's `source`."
  evidence: "`data/currencies.json` (`source: \"dummy, not measured\"`). `craftCost` in `packages/core/src/craft-cost.ts` reads only `rate` and `league`. Settled when the player replaces the rates before a sync, or when a gate refuses a non-measured `source`. Severity: medium."

## Deferred from: story 3.5 (2026-10-02)

- source_spec: `docs/stories/spec-3-5-chase-combinations-on-the-collapsed-crafted-row.md`
  summary: "[NOTE FOR UX] Two bands of one modifier on one Item Class that declare one Accepted Tier print identically, in the chase cell and in the combination row (EXPERIENCE.md memlog 143, re-derived; epics Story 3.5, last AC). Story 3.5 prints `acceptedTier` verbatim and does not settle what the second band prints."
  evidence: "`packages/web/src/list/combination-text.ts` `affixText`; the test `prints two bands of one modifier that declare one tier identically` in `combination-text.test.ts` pins the current behaviour. The committed `data/tracked.json` has no such pair today."
- source_spec: `docs/stories/spec-3-5-chase-combinations-on-the-collapsed-crafted-row.md`
  summary: "[NOTE FOR UX] A valueless Modifier Reference prints its short form alone, with no tier, in the curated register (`Extra Bolt`); with no short form it takes the mono fallback with no band. This is the player's Decision of 2026-10-02 on spec 3.5. EXPERIENCE.md's tier-plus-short-form rule and its fallback (a missing Accepted Tier is a curation gap) do not name the valueless case. Rule on it."
  evidence: "`packages/web/src/list/combination-text.ts` `affixText` (the `valueless` arm). `AcceptedTierSchema` says the label is unused on `valueless` (`packages/contracts/src/modifier-ref.ts`). `explicit.stat_1967051901` (Loads an additional bolt) is valueless in the committed `data/tracked.json`."
- source_spec: `docs/stories/spec-3-5-chase-combinations-on-the-collapsed-crafted-row.md`
  summary: "Player. 54 committed chase pairings run over the 27-character chase budget (EXPERIENCE.md memlog 104, *Escape valve*): candidates for pruning, not for a shorter coinage. Decide per pairing whether to prune it from `data/tracked.json` or keep it and let its chase cell ellipsise. The longest is `T1-T2 Flat Lightning · T1-T2 Proj Skills` (40). Every one fits the combination cell, where nothing is cut."
  evidence: "`PRUNING_CANDIDATES` in `packages/web/src/list/combination-fit.test.ts` lists all 54 and fails when the committed list changes. They are: T1 % Evasion · T1 Crit Chance; T1 % Evasion · T1 Mana Regen; T1 % Evasion · T1 Melee Skills; T1 % Evasion · T1 Minion Skills; T1 % Evasion · T1 Proj Skills; T1 % Evasion · T1 Spell Skills; T1 % Life · T1 Minion Skills; T1 % Mana · T1 Minion Skills; T1 Ele Atk Dmg · T1 +Crit Chance; T1 Ele Atk Dmg · T1 +Crit Dmg; T1 Ele Atk Dmg · T1 Proj Skills; T1 Flat Cold · T1 +Crit Chance; T1 Flat Cold · T1 Proj Skills; T1 Flat Fire · T1 +Crit Chance; T1 Flat Fire · T1 Proj Skills; T1 Flat Lightning · T1 +Crit Chance; T1 Flat Lightning · T1 +Crit Dmg; T1 Flat Lightning · T1 Atk Spd; T1 Flat Lightning · T1 Proj Skills; T1 Flat Phys · T1 +Crit Chance; T1 Flat Phys · T1 Proj Skills; T1 Flat Phys · T1-T2 Extra Arrow; T1 Flat Phys · T1-T2 Proj Skills; T1 Rarity · T1 Minion Skills; T1 Spell Dmg · T1 Crit Chance; T1 Spell Dmg · T1 Mana Regen; T1 Spell Dmg · T1 Melee Skills; T1 Spell Dmg · T1 Minion Skills; T1 Spell Dmg · T1 Proj Skills; T1 Spell Dmg · T1 Spell Skills; T1 Spirit · T1 Minion Skills; T1-T2 % Phys · T1 +Crit Chance; T1-T2 % Phys · T1-T2 Extra Arrow; T1-T2 % Phys · T1-T2 Proj Skills; T1-T2 Ele Atk Dmg · T1 +Crit Chance; T1-T2 Ele Atk Dmg · T1 +Crit Dmg; T1-T2 Ele Atk Dmg · T1 Atk Spd; T1-T2 Ele Atk Dmg · T1-T2 Extra Arrow; T1-T2 Ele Atk Dmg · T1-T2 Proj Skills; T1-T2 Flat Cold · T1 +Crit Chance; T1-T2 Flat Cold · T1 +Crit Dmg; T1-T2 Flat Cold · T1 Atk Spd; T1-T2 Flat Cold · T1-T2 Extra Arrow; T1-T2 Flat Cold · T1-T2 Proj Skills; T1-T2 Flat Fire · T1 +Crit Chance; T1-T2 Flat Fire · T1 +Crit Dmg; T1-T2 Flat Fire · T1 Atk Spd; T1-T2 Flat Fire · T1-T2 Extra Arrow; T1-T2 Flat Fire · T1-T2 Proj Skills; T1-T2 Flat Lightning · T1 +Crit Chance; T1-T2 Flat Lightning · T1 +Crit Dmg; T1-T2 Flat Lightning · T1 Atk Spd; T1-T2 Flat Lightning · T1-T2 Extra Arrow; T1-T2 Flat Lightning · T1-T2 Proj Skills. In the browser at 10.5px sans, `T1 Spell Dmg · T1 Spell Skills` (30 characters) fit its 154px text box without an ellipsis, so the 27-character budget is conservative for this face."
- source_spec: `docs/stories/spec-3-5-chase-combinations-on-the-collapsed-crafted-row.md`
  summary: "[NOTE FOR UX] A mixture tier prints with a hyphen (`T1-T2 % Phys`), because the player decided on 2026-10-02 to print `acceptedTier` verbatim. EXPERIENCE.md coinage rule 5 says a mixture takes an en dash (`T1–T2`). Rule on which one wins: change the rule, or have `web` or `data/tracked.json` print the en dash."
  evidence: "Review of spec 3.5. `packages/web/src/list/combination-text.ts` `affixText` prints `acceptedTier` as written. `combination-fit.test.ts` and its `PRUNING_CANDIDATES` pin the hyphen. EXPERIENCE.md, *How a short form may be coined*, rule 5."
- source_spec: `docs/stories/spec-3-5-chase-combinations-on-the-collapsed-crafted-row.md`
  summary: "[NOTE FOR UX] The fallback can print text that EXPERIENCE.md forbids. A stat with two `#` keeps both and appends one band (`Adds # to # Fire Damage 4.41–5`). A stat that the catalogue lacks prints its raw `statId` (`explicit.stat_404 1–2`). EXPERIENCE.md *Rendered text, not raw ids* calls a raw id a legibility failure. Rule on the two-`#` band and the missing-catalogue case. Also rule on whether a long fallback on line one of a combination row may overflow into the state cell, because nothing in the expansion is ellipsised."
  evidence: "Review of spec 3.5. `packages/web/src/list/combination-text.ts` `bandedFallback` and `affixText` follow the spec 3.5 Design Notes and matrix. Today's committed data takes no fallback: `combination-fit.test.ts` asserts this, and `short-forms.test.ts` requires a form for every committed `statId`."
- source_spec: `docs/stories/spec-3-5-chase-combinations-on-the-collapsed-crafted-row.md`
  summary: "Architect. `web` reproduces `core`'s rules for a crafted entry's Price State and summand predicate. `format.ts` `resolvedState` maps absent to `never-synced` and another league to `league-mismatch`. `craftedCombinationNote` treats a priced non-summand as below the threshold. If `core` ever leaves out an entry for another reason, the panel mislabels it, and nothing signals the drift. Decide whether `core` publishes each entry's resolved state and its reason for exclusion on `CraftedRankedRow`."
  evidence: "Review of spec 3.5. `core` `rank.ts` `craftedRow` keeps an entry that is priced, in the active league and at or above T. Spec 3.5 forbids any change to `core` or `contracts`, so the copy lives in `web`. No parity test runs both predicates on the same inputs. Severity: medium."
- source_spec: `docs/stories/spec-3-6-provenance-the-uniform-prior-banner-and-the-appendix-s-remaining-reasons.md`
  summary: "[NOTE FOR UX] The appendix note cell is empty for `pool partial` and `class absent from weights file`, and for `recipe cannot reach this class`. Story 3.6 fills it for `class disagrees with weights file` only (*The pool is published and complete; the disagreement is in your Tracked List.*). Write the note wording for `pool partial` (the row carries provenance `absent`, mark *unknown*) and for the other reasons, or rule that they stay empty. Also rule on the banner's lead and body copy and its dismiss text, which Story 3.6 wrote from EXPERIENCE.md *The uniform-prior banner*."
  evidence: "`packages/web/src/list/UnrankableAppendix.tsx` `DISAGREES_NOTE`; `packages/web/src/list/UniformPriorBanner.tsx` `BANNER_LEAD`, `BANNER_BODY`, `BANNER_DISMISS`."
- source_spec: `docs/stories/spec-3-6-provenance-the-uniform-prior-banner-and-the-appendix-s-remaining-reasons.md`
  summary: "Architect. The crafted Age cell stays empty. `core` now publishes `asOf` on `CraftedRankedRow`, the minimum over each summand's `observedAt` and each used rate's `asOf`, but `web` does not print it. Rule on AD-10's oldest-timestamp reading (the Story 3.5/3.6 entry above) before an Age mark is built."
  evidence: "`packages/core/src/rank.ts` `craftedRow`, `packages/core/src/provenance.ts` `oldestOf`; `packages/web/src/list/display-rows.ts` `ClassDisplayRow.age` is `undefined`."

## Deferred from: spec-epic-3-retro-item-30-decouple-data-dependent-tests-from-live (2026-10-03)

- source_spec: `docs/stories/spec-epic-3-retro-item-30-decouple-data-dependent-tests-from-live.md`
  summary: Fold the short-form and combination-fit checks of the live `data/tracked.json` into `pnpm tracked:check`, so one command owns the data invariants. Today they run only under `pnpm test:data`, because the short-form table lives in `web` and the spine forbids `sync` importing `web`.
  evidence: `packages/web/src/list/tracked.data.test.ts` holds the live checks. `pnpm tracked:check` (`packages/sync/src/curation/check.ts`) runs the schema and cross-file checks only. Retro item 31 (R6) is the open ruling on where the short-form table lives.
  retry_when: The owner ruling on the short-form module (retro item 31, R6) places the table where `sync` may import it.

- source_spec: `docs/stories/spec-epic-3-retro-item-30-decouple-data-dependent-tests-from-live.md`
  summary: No automated path runs `pnpm test:data`, so the live-data invariants (short forms, cell fit, `tracked:check` exit 0, `sync:dry` output shape) are enforced only by hand. Add a non-blocking CI job or a scheduled run. Do not gate `deploy.yml` on it: that blocks a player's data-only push, which is the coupling this spec removed.
  evidence: `deploy.yml` runs `pnpm check`, `pnpm test` and `pnpm build`; `grep test:data .github` finds only a comment. The `*.data.test.ts` files and the `data` project in `vitest.config.ts`.
  retry_when: The player picks the signal channel for a failing live-data check (a non-blocking job, a schedule or a hook).
