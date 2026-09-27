# Deferred work

Each entry names work carved out of a spec so it is not lost. Stories and reviews append; they do not rewrite. The `deferred-work-sweep` skill (`.claude/skills/deferred-work-sweep/SKILL.md`) removes an entry in the last commit of the branch that closes it, so the removal reaches `master` with the work, and adds `auto_attempt:` / `retry_when:` lines to an entry it could not close.

## Deferred from: epic 1 retro item 15 (2026-09-26)

- source_spec: `docs/stories/spec-epic-1-retro-item-15-deferred-ledger-and-commit-convention.md`
  summary: The `deferred-ledger-audit` review layer is wired only into `bmad-build` and `bmad-build-auto`; a spec finalized or edited outside a BMad build workflow (a `bmad-retrospective` output, a `bmad-correct-course` change, a hand edit) gets no automatic check that its carved-out work reached `deferred-work.md`.
  evidence: Blind-hunter review of this item's own diff. The frozen Intent scoped the fix to the two build skills, so this is a known scope boundary and not a defect in what was built; worth revisiting if a carve-out is later found to have escaped through one of those other paths.
  auto_attempt: 0
  retry_when: A carved-out item is found in `deferred-work.md` history that originated from `bmad-retrospective`, `bmad-correct-course`, or a hand-edited spec rather than a `bmad-build`/`bmad-build-auto` run.

- source_spec: `docs/stories/spec-epic-1-retro-item-15-deferred-ledger-and-commit-convention.md`
  summary: The `deferred-ledger-audit` instruction text is duplicated three times (dispatch and oneshot layers in `_bmad/custom/bmad-build.toml`, plus `_bmad/custom/bmad-build-auto.toml`) instead of factored into one shared `review-prompts/*.md` file the way `edge-case-hunter` and `verification-gap` are.
  evidence: Blind-hunter review of this item's own diff, confirmed against `_bmad/scripts/render_skill.py`: a customization `instruction` string gets `{skill-root}` substituted (the *skill's* own directory) but never `{project-root}` — that substitution exists only for tokens inside a skill's own source `.md` files. There is no safe way to point all three copies at one project file without either a portable `{project-root}` token in `instruction` (an upstream skill capability this project cannot add) or hardcoding this checkout's absolute path (breaks on any other clone). Revisit if a future skill update adds such a token.
  auto_attempt: 0
  retry_when: The installed `bmad-build`/`bmad-build-auto` skill version supports a `{project-root}` (or equivalent) substitution inside `[[workflow.review_layers]].instruction`.

- source_spec: `docs/stories/spec-1-1-the-four-package-workspace-and-the-offline-development-loop.md`
  summary: No mechanical check enforces the AC "every installed version matches the Stack table exactly".
  evidence: `save-exact=true` governs only future `pnpm add`; a `^` range edited into a manifest later fails nothing. The obstacle is that the spine's Stack table is prose, so any test would pin a hand-copied second source of truth that can drift from the table it claims to enforce — worth solving only alongside a machine-readable Stack table.

- source_spec: `docs/stories/spec-1-4-the-committed-trade-catalogue-and-its-explicit-refresh-command.md`
  summary: `data/catalogue/{items,stats,filters,static}.json` are not on disk yet. One human must run `pnpm catalogue:refresh` once against the live API and commit the four files.
  evidence: AGENT-WORKFLOW §Parallel worktrees forbids an agent to run the command against the live API or to author a file under `data/`, so story 1.4 ships the command and its tests but no artifact. Story 1.10 validates tracked ids against those four files offline and has nothing to read until the run happens. The run needs `POE_SYNC_USER_AGENT` set (see `.env.example`); it writes all four files or none, and a second run against an unchanged API must leave `git status` clean.

- source_spec: `docs/stories/spec-1-4-the-committed-trade-catalogue-and-its-explicit-refresh-command.md`
  summary: Nothing checks that the committed catalogue still parses against the `contracts` catalogue schemas, so a GGG shape change is caught only on the next refresh.
  evidence: Story 1.4 validates at write time, inside `refreshCatalogue`. Once `data/catalogue/*.json` exists, a schema tightened in `contracts` could contradict the committed file and no test would say so — the same class of mismatch story 1.4 found twice in the recorded fixtures (a null filter-option id, a null static group label). A test that parses the four committed files against their `Catalogue*FileSchema` would close it; deferred because the files do not exist yet.

## Resolved (2026-09-26)

- The 1.4 entry above that carved out the live `pnpm catalogue:refresh` run is **retired**: a human ran the command and the four files are committed as `edd2c97`. The entry stays in place because this ledger is append-only. Consequence for the entry after it — the committed-catalogue parse check was deferred only because the files did not exist, and is now actionable.

## Deferred from: code review of spec-1-4-the-committed-trade-catalogue-and-its-explicit-refresh-command (2026-09-26)

## Deferred from: sprint change proposal 2026-09-26 (weights contract 6.0.0)

- source_spec: `docs/sprint-change-proposal-2026-09-26.md`
  summary: The Emerald crafted entry's prefix band `[12, 15]` does not contain its only tier `[5, 15]`, so Story 3.3's empty-containment check will reject it.
  evidence: `data/tracked.json`, `jewel`/`Emerald` prefix `explicit.stat_2843214518` `[12, 15]`; `data/weights.json` 6.0.0 carries one tier of that stat on that pool, `T1` at item level 1 with ranges `[[5, 15]]`. Whole-tier containment (IN §1) admits no tier, so §2.5 fires. It predates the 6.0.0 change and is the player's data to fix (AGENT-WORKFLOW: agents do not edit `data/`).

- source_spec: `docs/sprint-change-proposal-2026-09-26.md`
  summary: Resolved 2026-09-26 — the Emerald prefix band entry above is fixed. The player chose `[5, 15]`, the only band whole-tier containment accepts on that pool, and the agent applied it under the revised AGENT-WORKFLOW data rule. The entry prices every roll of the tier (5–15), not only its top end.
  evidence: `data/tracked.json` `jewel`/`Emerald` prefix `explicit.stat_2843214518` now `[5, 15]`, `acceptedTier` `T1`; the band equals its containment set's extremes on the 6.0.0 file.

- source_spec: `docs/sprint-change-proposal-2026-09-26.md`
  summary: Correction 2026-09-26 — the "Resolved" note directly above is WITHDRAWN. The player reverted the Emerald prefix band to `[12, 15]`, and the original Emerald entry stands, now covering the suffix `[3, 4]` over its only tier `[2, 4]` as well.
  evidence: The player wants mid-to-high rolls of one tier only, because the full tier prices quite differently. Whole-tier containment (AD-11) cannot express a band inside one tier, so Story 3.3's empty-containment check (IN §2.5) will reject both Emerald bands once it is built. This is a live case for the pro-rating alternative that AD-11 rejected and carries under Deferred; revisit it when Story 3.3 lands. `[5, 15]` also broke the recorded pricing fixtures (a new search body needs `pnpm fixtures:record`), so the revert keeps them valid.

## Deferred from: story 1.9 (2026-09-26)

- source_spec: `docs/stories/spec-1-9-the-structured-sync-report-with-requests-accounted-per-source.md`
  summary: The ARCHITECTURE-SPINE edit is still owed. The tagged `TrackedListAge` decided in Story 1.2 (`git-author-date`, else `file-modified`, else absent) replaces the epic AC's "no history yields no date" and AD-12's "an uncommitted working-tree edit does not move the date". Story 1.9 did not make the spine edit.
  evidence: The spec's agent decision *Edit date* says "The spine edit is still owed. It is not made here." `packages/contracts/src/tracked-list-age.ts` says the same in its doc comment ("The spine needs the matching edit"). Story 1.9's `runChunk` writes `figures.trackedListEditedAt` from `resolveTrackedListAge`, so the report now follows the tagged order and the spine text is out of date.

## Resolved: spine edit owed by story 1.9 (2026-09-26)

- source_spec: `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md` (AD-12, revision 20)
  summary: The spine edit that story 1.9 left owed is made. AD-12 now states the tagged `TrackedListAge`: the git author date first, then the file's last-modified time, then absent. Still owed outside the spine: PRD FR-18's third consequence and the matching `docs/epics.md` criteria still say that a file with no commit history yields no date.
  evidence: Spine memlog, revision 20 entries.
- resolved_by: PRD FR-18 revision 21, `docs/epics.md`, and `EXPERIENCE.md` revision 6 (2026-09-26). The PRD, the epics and the UX now match AD-12. The UX adds the plain-text suffix `(not committed)` for a `file-modified` date.
  code_owed: The trust strip must render that suffix when Epic 2 builds it. Story 1.9's code already writes the tag, so `sync` needs no change.

## Deferred from: story 1.10 (2026-09-26)

## Deferred from: story 1.11 (2026-09-26)

- source_spec: `docs/stories/spec-1-11-league-validation-as-a-run-start-gate.md`
  summary: The live `pnpm sync` runs on the in-memory fake git port, so the tracked-list edit date never comes from the `git-author-date` clock of AD-12. A real read-only git adapter is owed.
  evidence: The spec's human decision *Scope* defers the adapter. `packages/sync/src/sync.ts` passes `createFakeGitPort()`, so `resolveTrackedListAge` always falls to `file-modified`. The adapter needs a process spawn, and `packages/sync/src/no-git-write.test.ts` forbids `child_process` in every non-test source under `packages/sync/src`. The design pass must decide where a read-only spawn may live (a separate module the scan exempts, or a narrower rule that forbids only write subcommands) without weakening the no-git-write guarantee of AD-3.
  auto_attempt: 2026-09-27 — attempt 1 — status done. build-auto recommends a follow-up review. Branch `worktree-dw-live-sync-runs-on-fake-git-port-2026-09-26-235651`, spec `docs/stories/spec-deferred-live-sync-runs-on-fake-git-port.md`.
  retry_when: never — needs a human
  integrate_branch: worktree-dw-live-sync-runs-on-fake-git-port-2026-09-26-235651
- source_spec: `docs/stories/spec-1-11-league-validation-as-a-run-start-gate.md`
  summary: The live `pnpm sync` does not call `checkPinnedCap`, the load-time half of AD-7's pinned cap. A tracked list over the cap therefore runs live and reports only `pinned-starvation` at runtime.
  evidence: `packages/sync/src/pinned-cap.ts` documents `count(pinned) > 0.5 × minChunkSearches` as "a `tracked.json` validation error". No shell calls `checkPinnedCap` (only `index.ts` and `pinned-cap.test.ts` name it). `sync:dry` never did either, and the spec's composition list does not name it. Location: `packages/sync/src/sync.ts` (live composition).
- source_spec: `docs/stories/spec-1-11-league-validation-as-a-run-start-gate.md`
  summary: A 429's `retryAfterMs` is not kept across processes, so the next scheduled `pnpm sync` may send inside the penalty window. Unverified.
  evidence: The ledger is per process by AD-8's design (`packages/sync/src/trade/client.ts`), and both the pricing step's yield and the league gate's yield (`packages/sync/src/league/league-gate.ts`) drop the delay. To settle it, compare the player's scheduler interval with the `Retry-After` windows the trade API actually returns.

## Resolved by epic 1 retro item 11 (2026-09-26)

- Two story 1.4 entries are **retired**. First, "`data/catalogue/{items,stats,filters,static}.json` are not on disk yet" was already closed by `edd2c97`, as the Resolved note above records. Second, "Nothing checks that the committed catalogue still parses against the `contracts` catalogue schemas" is closed by `packages/sync/src/catalogue/committed-catalogue.test.ts`. That test parses each `CATALOGUE_ENDPOINTS` file, `static.json` included, with `parseEnvelope` against its `Catalogue*FileSchema`. It also fails when `data/catalogue/` holds a `.json` file that is not one of the endpoint artifacts, or lacks one of them. Both entries stay in place because this ledger is append-only; `deferred-work-sweep` owns removal.

## Deferred from: story 1.7 (2026-09-26)

- source_spec: `docs/stories/spec-1-7-a-divine-price-estimate-for-one-tracked-entry.md`
  summary: A step that throws (`UnknownClassBaseTypeError`, `UnexpectedTradeResponseError`) loses the progress of every entry the chunk completed before it, so those entries are searched again on the next run.
  evidence: The spec's frontmatter `deferred` recorded this, and it was never appended here. `runChunk` wrote `data/sync-progress.json` once, after the loop, so a throw skipped that write. The behaviour predates story 1.7 (the story 1.5 runner). Location: `packages/sync/src/chunk/run-chunk.ts`.

## Resolved by epic 1 retro items 1, 2, 3, 6, 7 (2026-09-26)

- Two entries are **closed** by `docs/stories/spec-epic-1-retro-items-6-7-1-2-3-run-start-sequence.md`. First, the "Deferred from: story 1.7 (2026-09-26)" entry on a step throw losing the chunk's progress: once the order exists, any throw other than a league mismatch now publishes the step entries so far and the catalogue marks, and writes progress for the completed rotation keys (`packages/sync/src/chunk/run-chunk.ts`). Second, the story 1.11 entry "The live `pnpm sync` does not call `checkPinnedCap`": `packages/sync/src/compose-chunk.ts`, which both `pnpm sync` and `pnpm sync:dry` use, evaluates the inequality under the lock and throws `PinnedCapExceededError`, reported as a `run-failure` that names `data/tracked.json` before any request. Both entries stay in place because this ledger is append-only; `deferred-work-sweep` owns removal. The retro item 17 entry on `UnexpectedTradeResponseError` stays open: the publish path now exists, but the error still carries no entry payload.

## Deferred from: epics revision of Stories 2.6 to 2.8 (2026-09-26)

- source_spec: `docs/epics.md` (Epic 2, Story 2.8)
  summary: [NOTE FOR UX] The empty Unrankable appendix has no treatment. The committed data has `weights.json` 6.0.0 present and `recipes.json` absent. That is AD-24's absent-recipes state, so no class is Unrankable and the appendix holds no row. `EXPERIENCE.md` specifies the appendix only with rows in it: its copy, its count and its height at zero rows are undefined.
  evidence: Story 2.8's revised criteria keep the region rendered and its count readable, and defer the copy to UX. Story 2.1's absence line (`Not published: recipes.json — no crafted rows can be ranked.`) already names the cause, so the empty appendix must not restate it or contradict it. Story 2.8 is blocked on this ruling for the empty case only; the absent-weights case is fully specified.
- source_spec: `docs/epics.md` (Epic 2, Story 2.6)
  summary: [NOTE FOR UX] Coverage wording when `weights.json` is present but `sync-report.json` omits the figure. `sync` does not measure coverage until Story 3.6, so on the committed data the figure is omitted while the file is present. AD-27 describes omission only for an absent file.
  evidence: Story 2.6 renders the case as provisional *not measured*, never `0`, and never as file absence. The page tells the two cases apart by the weights envelope it loaded. UX owns the final copy and placement in the *what the weights cover* column. The case goes away once Story 3.6 ships the sync-side measurement.

## Deferred from: story 2.1 (2026-09-26)

- source_spec: `docs/stories/spec-2-1-the-page-s-substrate-the-override-layer-the-fixed-frame-and-one-consistent-artifact-set.md`
  summary: [NOTE FOR UX] Skeleton rows (state 22) still have no designed treatment. Story 2.1 ships DESIGN.md's documented fallback: twenty 28px slots in the six-column layout, each cell a flat `paper-inset` bar 10px tall at its column width less its right padding, no shimmer, no animation, and no column header. The masthead eyebrow holds a blank line until the league is known.
  evidence: DESIGN.md Components, the skeleton `[NOTE FOR UX]`, names the fallback but draws no fill, bar height or header. `packages/web/src/frame/RowSlots.tsx` holds the treatment in one place, so a ruling changes one file.
- source_spec: `docs/stories/spec-2-1-the-page-s-substrate-the-override-layer-the-fixed-frame-and-one-consistent-artifact-set.md`
  summary: [NOTE FOR UX] Absence-line copy and placement. Each absent tolerable artifact prints one plain sans line under the masthead in `ink-secondary`, at 11.5px on a 21px line: `Not published: recipes.json — no crafted rows can be ranked.`, `Not published: weights.json — every crafted class is unrankable.`, `Not published: sync-report.json — the sync report is unavailable.` Each takes its own 21px entry in the chrome budget (`packages/web/src/theme/tokens.ts`, `reservedChrome`). UX owns the final wording, the position relative to the trust strip (Story 2.6), and whether a line carries a mark.
  evidence: Story 2.1 decision 2026-09-26. EXPERIENCE.md has no treatment for a named absence; AD-24 requires only that a degraded render names what is missing.
- source_spec: `docs/stories/spec-2-1-the-page-s-substrate-the-override-layer-the-fixed-frame-and-one-consistent-artifact-set.md`
  summary: [NOTE FOR UX] DESIGN.md's vertical budget does not add up. The table commits 1390px and says `frame-slack = 1920 − 1390 = 528`, but 1920 − 1390 is 530. The frontmatter token `spacing.frame-slack` is `528px`. Story 2.1 keeps the frontmatter value, which is 2px conservative, and the token test asserts the bound rather than equality.
  evidence: Found while writing `packages/web/src/theme/tokens.test.ts`. Either a committed block is 2px taller than its row in the table, or the token is off by 2px; UX owns which.
- source_spec: `docs/stories/spec-2-1-the-page-s-substrate-the-override-layer-the-fixed-frame-and-one-consistent-artifact-set.md`
  summary: `packages/web/vite.config.ts` sets `publicDir` to the whole repo `data/`, so `vite build` publishes files AD-24 never fetches (`sync-progress.json`, `currencies.json`, `catalogue/items.json`, `catalogue/filters.json`, about 375 KB) on Pages. Trim the copy to the eight AD-24 artifacts, for example with an allowlist derived from `packages/web/src/load/artifacts.ts` `ARTIFACTS`.
  evidence: Spec decision 2026-09-26 *Serving* says "Story 2.7 may trim the files AD-24 never fetches", but Story 2.7's criteria in `docs/epics.md` do not mention it, so no story owns it. Verified by building to a scratch `dist/`: `sync-progress.json` and `currencies.json` are present. Review of story 2.1, blind, edge-case and ledger layers.
- source_spec: `docs/stories/spec-2-1-the-page-s-substrate-the-override-layer-the-fixed-frame-and-one-consistent-artifact-set.md`
  summary: `WeightsFileEnvelopeSchema` in `packages/contracts/src/envelopes.ts` is a stopgap: it checks `schemaVersion` against major 6 and passes the rest of `weights.json` through unvalidated. When Story 3.1 tightens the weights schema, `packages/web/src/load/artifacts.ts` `ARTIFACTS.weights` must switch to it.
  evidence: Spec decision 2026-09-26 *Weights envelope*: "Story 3.1 tightens it." `docs/epics.md` has Story 2.6 widen only three header fields. Nothing tracks the loader's switch to the full schema.
- source_spec: `docs/stories/spec-2-1-the-page-s-substrate-the-override-layer-the-fixed-frame-and-one-consistent-artifact-set.md`
  summary: (unverified, would be medium) `CraftRecipeSchema` in `packages/contracts/src/craft-recipe.ts` accepts `currencies: []` and a `currencyId` repeated within one recipe. A zero-cost recipe may make the per-craft EV degenerate once a story reads recipes for valuation.
  evidence: The spec fixes the shape but says nothing on an empty or repeated currency list. Settle it by checking AD-20 and the FR-1 EV formula when the first story costs a recipe: if a recipe must spend something, add `.min(1)` and a per-recipe `currencyId` uniqueness refinement.

## Resolved by UX rulings, DESIGN.md revision 6 and EXPERIENCE.md revision 7 (2026-09-26)

- The five `[NOTE FOR UX]` entries above are **ruled**. They stay in place because this ledger is append-only; `deferred-work-sweep` owns removal, and three of them still owe code.
  - Story 2.8, the empty Unrankable appendix (UX memlog 214, EXPERIENCE state 37). The title alone, `Appendix: Unrankable — 0 Item Classes`, with the count in `ink` and not rust. No lead, no rows, bottom padding 16px, same place. It says nothing about why it is empty. Story 2.8 is unblocked.
  - Story 2.6, a coverage figure the report omits (UX memlog 212). *not measured* while a weights envelope is loaded, *unknown* without one. Italic sans, no mark, never `0`. Story 2.6's provisional copy is final.
  - Story 2.1, skeleton rows (UX memlog 211). The shipped flat-bar fallback is ratified. code_owed: `packages/web/src/frame/RowSlots.tsx` must paint the column header with its final labels.
  - Story 2.1, absence-line copy and placement (UX memlog 213, EXPERIENCE state 38). The three bodies are kept verbatim under the lead `Not published`, now inside the trust strip after line two and before the health line, plain, with no mark. code_owed: move the lines out from under the masthead into the strip. Story 2.6 builds the strip, so the move lands there. Add the token `frame-reserve-absence-line` (21px) in place of reusing the health-line token in `reservedChrome`. The uniform-prior banner must stay down when `weights.json` or `recipes.json` is absent (EXPERIENCE *The uniform-prior banner*); that belongs to the story that builds the banner.
  - Story 2.1, the vertical budget (UX memlog 210). `frame-slack` is 530; the 528 was the old 2px frame border. code_owed: `packages/web/src/theme/tokens.ts` `frameSlack` becomes 530. The worst case counts only reservations that can co-occur: 95px (the banner with the health line or the `sync-report.json` absence line), which leaves 435px, above the 400px Sync Report cap. A test that sums all five reservations (179px) would describe a state no data can produce.

## Deferred from: story 2.2 (2026-09-26)

- source_spec: `docs/stories/spec-2-2-the-raw-ranking-branch-league-scoped-and-computed-at-read-time.md`
  summary: A `no-listings` state recorded in a previous league stays `no-listings` after a league reset. The state carries no league, so `core` (`packages/core/src/rank.ts`) cannot restate it as `not-yet-synced` / `league-mismatch`. The only league-bearing field is the entry's `lastSearchLeague`, and AD-9 forbids `core` to read it.
  evidence: Spec 2.2 restates only a `priced` observation whose `observation.league` differs from the active league. `unresolvable` has the same shape, and so does a published `not-yet-synced` state such as `no-exchange-rate`: it carries no league either, so it outlives a reset under its old reason instead of `league-mismatch`. Settle it with an AD-9 or AD-19 ruling: either `sync` resets carried-over states on a league change, or `core` gains a sanctioned league input for non-`priced` states.
- source_spec: `docs/stories/spec-deferred-emitted-dts-carries-ts-specifiers.md`
  summary: The post-emit rewrite covers only `packages/contracts/dist`; `packages/core/dist` and `packages/sync/dist` emit the same `.d.ts` shape and still carry relative `.ts` specifiers.
  evidence: The spec's Never boundary excludes them because the closed entry named only contracts. A grep after `pnpm typecheck` on 2026-09-26 finds `.ts` specifiers in `packages/core/dist/index.d.ts` and `packages/sync/dist/dry-run.d.ts`. The fix is to add both directories to `TARGET_DIRS` in `tools/dts-specifiers/rewrite-dts-specifiers.ts`.

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
- source_spec: `docs/stories/spec-2-3-the-ranked-list-at-rest-rows-units-freshness-and-the-key-block.md`
  summary: `− Show only the top 20` hides rows 21 and up but leaves them in `RankedList`'s open set, so they reappear open on the next grow. Story 2.5 must decide whether collapse closes hidden rows, once a panel hangs off an open row.
  evidence: `RankedList.tsx` keeps `open` across the grown toggle. In Story 2.3 an open row shows only the 3px marker, so nothing visible is lost. EXPERIENCE state 33 says clicking again "restores the top 20 exactly" but says nothing about open rows.
- source_spec: `docs/stories/spec-deferred-request-after-afterall-reaches-network.md`
  summary: A request that a test starts but does not await, and that fires after the last file's afterAll in a worker, is blocked by the process-wide guard but reported by nothing, so the run passes.
  evidence: Pre-existing in kind: before this change the same request passed silently and also escaped. Now it is blocked, because the interceptor stays installed. The file-level check in afterAll reports a late request only when a later file's afterAll runs in the same worker. The 2026-09-26 probe found that a 4000 ms timer never fired, because the worker ended first, so whether such a request can happen at all is unverified. A fix needs a hook that runs in the worker after its last file and before the worker ends, and that can fail the run. A globalSetup teardown runs in the main process and cannot see the worker's record. First settle whether Vitest offers such a hook.

## Deferred from: story 2.5 (2026-09-26)

- source_spec: `docs/stories/spec-2-5-row-expansion-the-evidence-behind-a-row-its-tombstones-and-its-trade-link.md`
  summary: The crafted row's expansion must list every Tracked Entry on its Item Class, priced or not and above or below the threshold, with the note *below the threshold — adds nothing to EV* on a below-threshold entry and an `unresolvable` combination row (`×` rust, *not valued*, the state-4 note).
  evidence: Decision 2026-09-26 on spec 2.5 Open Question 1 (option a). Day one has no crafted row: `RankedRow` has only the raw arm, and an `unresolvable` raw entry gets no row (spec 2.3). The panel's `CombinationRow` is generic over one entry, so the Epic 3 story that adds the crafted arm renders more rows in the same panel.
- source_spec: `docs/stories/spec-2-5-row-expansion-the-evidence-behind-a-row-its-tombstones-and-its-trade-link.md`
  summary: The tombstone band (`+ N pruned` toggle, local to its panel and reset on close; struck-through Combination with `† pruned` leading the combination cell, *not tracked*, prune reason + `removed YYYY-MM-DD` in 560 + 406, no trade link) is not built.
  evidence: Decision 2026-09-26 on spec 2.5 Open Question 1 (option a). A pruned raw entry gets no row, so no day-one panel can hold a tombstone. `TrackedEntry` carries `prunedReason` but no removal date, and no owner document defines one. The removal-date field needs a contracts and owner-doc decision before the band can print its date.
- source_spec: `docs/stories/spec-2-5-row-expansion-the-evidence-behind-a-row-its-tombstones-and-its-trade-link.md`
  summary: Combination text (Accepted Tier + canonical short form, `T1 Cold Res · T1 Mana`, en-dashed mixtures) and its mono-verbatim fallback (catalogue stat name + value band) are not built on the expansion surface.
  evidence: Decision 2026-09-26 on spec 2.5 Open Question 1 (option a). A Raw Base's only Combination prints `no affixes`. No short-form table exists in the repository (UX-DR39 calls it hand-maintained). Build it with the chase cells so both surfaces share one formatter and one fallback cue (UX-DR40, UX-DR50).
- source_spec: `docs/stories/spec-2-5-row-expansion-the-evidence-behind-a-row-its-tombstones-and-its-trade-link.md`
  summary: No one has checked in a real browser that open panels survive `− Show only the top 20` and the regrow. Only `packages/web/src/list/expansion.test.tsx` (rows 3 and 22) covers it.
  evidence: Spec 2.5 Implementation Notes say the committed `data/` has only two rows, so the agent-browser grow/collapse check in its manual checks could not be run. To settle it, run that check once a dataset with more than 20 ranked rows is served (a fixture served through `pnpm dev`, or committed data after Story 2.7). Open rows 3 and 22, collapse, regrow, and confirm that both panels are open and flush under their rows.
- source_spec: `docs/stories/spec-2-5-row-expansion-the-evidence-behind-a-row-its-tombstones-and-its-trade-link.md`
  summary: [NOTE FOR UX] DESIGN.md `combination-row` says the right padding is "12px on every cell", and the mockup `key-expanded-states.html` CSS comment says the same. The mockup's `.k5` rule (the 24px trade-link cell) has none. Story 2.5 followed `.k5`, so `packages/web/src/list/CombinationRow.tsx` and `combinationLine1Columns` in `theme/tokens.ts` give the trade-link cell `padRight: 0`. DESIGN.md should exempt the trade-link cell or rule otherwise.
  evidence: Spec 2.5 Implementation Notes (the trade-link cell padding bullet). The owner text and the mockup geometry disagree, and nothing flags the drift. The tests `tokens.test.ts` and `expansion.test.tsx` assert 0, so a ruling for 12px must update them too.
- source_spec: `docs/stories/spec-2-5-row-expansion-the-evidence-behind-a-row-its-tombstones-and-its-trade-link.md`
  summary: The Story 2.5 AC requires a build-time measurement that the longest Accepted Tier + short-form Combination text still fits the 460px combination cell (less its 12px padding) when `* pinned ` leads it. The measurement is not built.
  evidence: Story 2.5 prints only `no affixes` and `* pinned no affixes`, and both fit. No short-form table exists yet (see the Combination-text entry above). Build the measurement with that table, because line one is `white-space: nowrap` in fixed-width cells and an overlong text would run into the state cell, not wrap.

## Deferred from: story 2.6 (2026-09-27)

- source_spec: `docs/stories/spec-2-6-the-trust-strip-its-health-line-and-the-sync-report-panel.md`
  summary: [NOTE FOR UX] The Sync Report panel copy is provisional. It prints only figures `sync-report.json` publishes, with no sum and no numerator: `10 tracked list · 1 league validation requests this pass.` · `N tracked entries were not reached in the last sync pass.` · `N entries are unresolvable.` · `N pinned-starvation records.` with one `pinnedRefreshed of pinnedCount pinned entries refreshed` line per record · `86% of 29 tracked Item Classes.` Zeros print in the panel. With `sync-report.json` absent, each of the five groups reads italic *unknown*. The mockup's prose (a request total, a measured daily ceiling, `N of M tracked entries`, `across N Item Classes`, a record date, a coverage numerator, explanatory sentences) needs figures the report does not publish. UX owns the final wording, including singular forms (`1 entries`, `1 pinned-starvation records` read as written) and whether the panel explains any figure.
  evidence: Spec 2.6 decision 2026-09-27. The copy lives in `panelColumns` in `packages/web/src/frame/trust-facts.ts`; `trust-facts.test.ts` and `trust-strip.test.tsx` assert it, so a ruling changes those three files.

## Deferred from: tracked.json curation tooling (2026-09-27)

- source_spec: `docs/stories/spec-tracked-json-curation-tooling.md`
  summary: When Story 3.3 builds the five cross-file checks in `core`, `checkTracked` in `packages/sync/src/curation/check.ts` must call them over `data/tracked.json` and `data/weights.json` and drop its `pending` item "five cross-file checks (Story 3.3)".
  evidence: The spec's Never list forbids a local implementation of the five checks, so `pnpm tracked:check` runs only the schema, the pinned cap and catalogue resolvability, and it lists the rest under `pending`. The five checks are named in `AGENT-WORKFLOW.md` (the five cross-file checks rule; AD-17).
- source_spec: `docs/stories/spec-tracked-json-curation-tooling.md`
  summary: When `checkTracked` calls the five cross-file checks, remove the "Open weak point" section and the hand-check step 8 of the loop from `.claude/skills/tracked-json/SKILL.md`, and renumber the steps that cite it.
  evidence: The spec's Always list makes the skill state the weak point until Story 3.3. The hand check exists only because `tracked:check` cannot yet see `data/weights.json`.

## Deferred from: code review of spec-tracked-json-curation-tooling.md (2026-09-27)

- source_spec: `docs/stories/spec-tracked-json-curation-tooling.md`
  summary: No test checks that `tsconfig.tools.json`, `vitest.config.ts` and `eslint.config.mjs` still cover `.claude/skills/tracked-json/scripts/*.ts`.
  evidence: If the vitest include line or one negation in the eslint ignore chain (`eslint.config.mjs:25`) is dropped, `lookup.ts` silently loses type, lint or test coverage, and `pnpm check` and `pnpm test` still pass. `tools/boundary-check` has no wiring guard either, so this belongs to a general "every .ts file is covered" guard. The spec frontmatter recorded this item but did not append it here.
- source_spec: `docs/stories/spec-tracked-json-curation-tooling.md`
  summary: `modText` in `.claude/skills/tracked-json/scripts/lookup.ts` gets the mod text by parsing `sourceModifierId`, and `WEIGHTS-FILE-SCHEMA.md` (the `sourceModifierId` row) calls that field "Opaque to the app".
  evidence: The spec's Always list authorizes the parse. So the spec and the weights contract disagree. The owner of the weights contract decides between two options: allow this curation-only consumer to depend on the layout, or make the producer emit the mod text as its own field. Until that decision, a test over the committed weights detects a change of the layout.
- source_spec: `docs/stories/spec-tracked-json-curation-tooling.md`
  summary: `pnpm tracked:lookup` and `pnpm tracked:check` are named neither in `AGENT-WORKFLOW.md`, which owns command-level rules, nor in the "Where things are" section of `AGENTS.md`.
  evidence: Only the description of the tracked-json skill makes the tools discoverable. An agent that edits `data/tracked.json` without triggering the skill does not find the check.
- source_spec: `docs/stories/spec-deferred-unparseable-fetch-loses-search-fields.md`
  summary: A search answered 200 with an unparseable body throws `UnexpectedTradeResponseError` with no entry, so the entry's `lastAttemptedAt` is not published although `sync` issued a request, against AD-9 *Timestamps* ("present wherever `sync` issued a request").
  evidence: Pre-existing; this spec's Design Notes leave it out of scope because the closed entry named only the fetch leg. In `packages/sync/src/pricing/price-entry.ts` the search-leg throw (`new UnexpectedTradeResponseError(entryKey, 'search', …)`) passes no entry, so the `runChunk` failure path publishes nothing for that entry. The fix is to pass `stamped` on that throw and flip the runner test for the entry-less case (`packages/sync/src/chunk/run-chunk.test.ts`, "unparseable search body").

## Deferred from: story 2.7 (2026-09-27)

- source_spec: `docs/stories/spec-2-7-day-one-deployed-the-honest-empty-league-reset-and-the-published-site.md`
  summary: `.github/workflows/deploy.yml` has never run, because no remote is configured. A human must set the repository's Pages source to "GitHub Actions", push to `master` or run `workflow_dispatch`, and confirm that the published site serves the app and only the allowlisted AD-24 artifacts.
  evidence: Spec 2.7, Verification, manual checks.
- source_spec: `docs/stories/spec-2-7-day-one-deployed-the-honest-empty-league-reset-and-the-published-site.md`
  summary: The `docs/epics.md` Story 2.7 AC still reads "Story 2.1's absence line names the missing `recipes.json`". The epics AC edit is owed.
  evidence: The 2026-09-27 human decision in spec 2.7 (Decisions) keeps `data/recipes.json` committed as an empty list, so the day-one page prints no such line.

## Deferred from: code review of spec-2-7-day-one-deployed-the-honest-empty-league-reset-and-the-published-site.md (2026-09-27)

- source_spec: `docs/stories/spec-2-7-day-one-deployed-the-honest-empty-league-reset-and-the-published-site.md`
  summary: Once Epic 3 ranks crafted rows, `listStatement` never returns nothing-clears, because the crafted rows stay in `ordering`. "Rank numerals stay" in EXPERIENCE.md state 25 goes untested.
  evidence: The spec's frontmatter `deferred` recorded this, and it was never appended here. EXPERIENCE.md state 25 keeps every crafted Item Class ranked at minus its Craft Cost, with rank numerals. `packages/web/src/list/list-statement.ts` returns `none` whenever `ordering.length > 0`. Today `KIND_ORDER` in `packages/core/src/rank.ts` is `{ raw: 0 }`, so the bad outcome cannot occur yet. Settled when Epic 3 defines how a crafted row relates to the threshold in `Ranking`, and a crafted-plus-threshold test is written. Severity: medium (unverified).
- source_spec: `docs/stories/spec-2-7-day-one-deployed-the-honest-empty-league-reset-and-the-published-site.md`
  summary: EXPERIENCE.md state 35 (active recipe uncostable) adds a third plain declarative "in state 25's register". The single slot built for two exclusive statements will then need a third kind and a ruling on which statements can co-occur.
  evidence: The spec's frontmatter `deferred` recorded this, and it was never appended here. The `ListStatement` union in `packages/web/src/list/list-statement.ts` and `spacing.frameReserveListStatement` both assume exactly two exclusive statements. Settled when the Epic 3 story for state 35 decides whether state 35 can co-occur with state 23 or state 25. Severity: medium (unverified).
- source_spec: `docs/stories/spec-2-7-day-one-deployed-the-honest-empty-league-reset-and-the-published-site.md`
  summary: The literal copy of the two list statements is owed to its owner document. The copy is `In canonical order, not ranked: no tracked unit has a price from <league> yet.` (state 23) and `Nothing clears your Payout Threshold of <x.xx> Divine.` (state 25).
  evidence: The 2026-09-27 human decision in spec 2.7 (Decisions) fixed the copy. Only that spec and `packages/web/src/list/list-statement.ts` (`honestEmptyCopy`, `nothingClearsCopy`) carry it. EXPERIENCE.md states 23 and 25 describe the declaratives, and revision 4 closed the nothing-clears copy (memlog 204), but neither state holds the literal text. A later UX revision of either state can drift from the code without a signal. The UX owner decides where the text lives.

## Resolved by story 2.7 (2026-09-27)

- One entry is **closed**: the "Deferred from: epics revision of Stories 2.6 to 2.8 (2026-09-26)" entry saying that `publicDir` publishes all of `data/` on Pages. `pnpm build` now runs `tools/prune-pages.mjs` after `vite build`. The prune deletes every `data/` file in `packages/web/dist` that is not on the eight-artifact AD-24 allowlist, and `packages/web/src/load/prune-allowlist.test.ts` asserts that the allowlist equals `ARTIFACTS`. The entry stays in place because this ledger is append-only; `deferred-work-sweep` owns removal.

## Deferred from: story 2.8 (2026-09-27)

- source_spec: `docs/stories/spec-2-8-the-unrankable-appendix-and-the-day-one-page-it-completes.md`
  summary: The `docs/epics.md` Story 2.8 AC for state 16 still reads that, for an Unrankable Item Class some of whose Base Types still rank on the raw branch, "the note names that fact". Epic 2 prints no such note. The epics AC edit is owed. [NOTE FOR UX] DESIGN.md, *Where a class's Base Types still rank* (the `{spacing.col-appendix-note}` italic note, *some of its Base Types rank on the raw branch*), still prescribes that note and needs the same ruling.
  evidence: The 2026-09-27 human decision in spec 2.8 (Decisions, "No state-16 note in Epic 2"): "Base Type name is enough for the player, no need to show class name." A raw row already names its Base Type, the page does not relate a raw base to its Item Class, and the appendix note cell stays empty. No class-membership source was built.
- source_spec: `docs/stories/spec-2-8-the-unrankable-appendix-and-the-day-one-page-it-completes.md`
  summary: [NOTE FOR UX] The key block's Provenance gloss `? unknown — absent: partial pool, upper bound only` does not describe the Unrankable appendix's `class absent from weights file` rows, which carry the same `? unknown` mark. The gloss, or the mark on those rows, needs a UX ruling.
  evidence: The 2026-09-27 human decision in spec 2.8 (Decisions, "Mark cell") puts `TrustMark kind="unknown"` with the word `unknown` on every `class absent from weights file` row, as `mockups/key-hero-resting.html` shows. `packages/web/src/list/KeyBlock.tsx` glosses that mark only as a partial pool, which is not the fact these rows state.

## Resolved by story 2.8 (2026-09-27)

- One entry is **closed**: the "Deferred from: epics revision of Stories 2.6 to 2.8 (2026-09-26)" `[NOTE FOR UX]` entry saying that the empty Unrankable appendix has no treatment. DESIGN.md `unrankable-appendix.emptyState` (memlog 214) rules it, and `packages/web/src/list/UnrankableAppendix.tsx` builds it: the title alone, the count in `ink`, no lead or row, 16px bottom padding, above the key block. The entry stays in place because this ledger is append-only; `deferred-work-sweep` owns removal.
