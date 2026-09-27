---
title: 'Story 2.7: Day one, deployed — the honest-empty league reset and the published site'
type: 'feature'
created: '2026-09-27'
status: 'done'
baseline_revision: 'ad453254f56c487ddd25eb820e5f5749cbb19b95'
route: 'dispatch'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/docs/stories/epic-2-context.md'
deferred:
  - summary: >-
      Once Epic 3 ranks crafted rows, `listStatement` never returns nothing-clears, because the crafted rows stay in `ordering`, and "rank numerals stay" in state 25 goes untested.
    evidence: |-
      EXPERIENCE.md state 25: every crafted Item Class is still ranked at minus its Craft Cost, and rank numerals stay. list-statement.ts returns `none` whenever `ordering.length > 0`. Today `KIND_ORDER` in packages/core/src/rank.ts is `{ raw: 0 }`, so the bad outcome cannot occur yet. Settled when Epic 3 defines how a crafted row relates to the threshold in `Ranking`, and a crafted-plus-threshold test is written.
    location: >-
      packages/web/src/list/list-statement.ts:39
    severity: medium (unverified)
  - summary: >-
      EXPERIENCE.md state 35 (active recipe uncostable) adds a third plain declarative "in state 25's register", so the one-slot, two-exclusive-statements design will need a third kind and a co-occurrence ruling.
    evidence: |-
      EXPERIENCE.md L861, state 35. The `ListStatement` union and `frameReserveListStatement` both assume exactly two exclusive statements. Craft recipes are Epic 3, so this cannot occur yet. Settled when the Epic 3 story for state 35 decides whether state 35 can co-occur with state 23 or 25.
    location: >-
      packages/web/src/list/list-statement.ts:13
    severity: medium (unverified)
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A league reset and a threshold that nothing clears both leave the list without a ranked row, and today the page cannot tell them apart from a data outage. It prints no statement for either. There is also no deploy: no `.github/`, no `build` script, and `vite build` publishes all of `data/`.

**Approach:** Derive two mutually exclusive list statements from `core`'s `Ranking`. Render them in one new chrome slot under the asking-price line. Add a guard test for the interaction surface. Add `pnpm build`, a prune step that keeps only the eight AD-24 artifacts, and `.github/workflows/deploy.yml`, which builds and deploys to Pages on a push to `master`.

## Boundaries & Constraints

**Always:**
- Honest-empty (state 23): `ordering` and `belowThreshold` are both empty and the list has at least one row. Show the canonical statement. Show no numerals. Every EV cell shows *no figure yet* (already true through `display-rows.ts`).
- Nothing-clears (state 25): `ordering` is empty and `belowThreshold` is not. Show a plain declarative that names the live threshold at 2dp, with no instruction. The rows and their numerals stay. It is not the uniform-prior banner and not a money-slot phrase.
- A partial refresh (state 24) renders normally, with no global stale treatment.
- The asking-price line, the key block and the running foot render in every one of these states. The running foot copy already meets UX-DR32, so keep it.
- Any new resting chrome gets a new `frameReserve*` token and a budget assertion.
- The deploy has no secrets. `base: './'` stays, and the artifacts are fetched at runtime.

**Never:**
- Editing `packages/web/vite.config.ts`.
- Changing `core`'s ranking output shape. The predicates are pure `web` functions over `Ranking`.
- Tooltips, modals, sorting, hover row actions, auto-refresh, clipboard snippets or virtualisation.
- Running `pnpm test` in the deploy workflow. The committed-data tests would block a player's data push.
- Removing the deferred-work entry for the `data/` trim. Only `deferred-work-sweep` removes an entry.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| League reset | every observation is from another league | canonical order, `∆` glyph + `not-yet-synced`/`league-mismatch`, no numerals, *no figure yet*, canonical statement | N/A |
| Partial refresh | some rows priced in the active league | ranked normally, no statement | N/A |
| Nothing clears | every priced row is below the threshold | nothing-clears declarative with the threshold at 2dp; the trail rows stay | N/A |
| Threshold lowered | after nothing-clears, a row clears | the statement goes away and the ranked row appears | N/A |
| Empty Tracked List | no rows at all | neither statement | N/A |
| Built site | `pnpm build` | `dist/` holds the eight artifacts, plus the app, and no other `data/` file | prune fails loudly if an allowlisted artifact is missing, except the three tolerable ones |

## Decisions

- **`data/recipes.json` stays committed as an empty list** (human, 2026-09-27). The deployed day-one page therefore has an empty crafted branch because `recipes` is empty, and prints **no** `recipes.json` absence line. This amends the epics AC "Story 2.1's absence line names the missing `recipes.json`". The absent-recipes and absent-weights states stay covered by fixtures.
- **Statement copy** (human, 2026-09-27): honest-empty `In canonical order, not ranked: no tracked unit has a price from <league> yet.`; nothing-clears `Nothing clears your Payout Threshold of <x.xx> Divine.` (`<x.xx>` is the live threshold at 2dp).
- **Scope kept whole** at about 2,100 tokens (human, 2026-09-27).

</frozen-after-approval>

## Code Map

- `packages/core/src/rank.ts` -- `rank` (L111) and `Ranking` (L60). A league mismatch goes to `notYetSynced`. `belowThreshold` is canonical. Read only.
- `packages/web/src/list/display-rows.ts` -- `toDisplayRows` (L68) drops `belowThreshold` and numbers `ordering` only. Add the `listStatement(ranking, threshold, league)` predicate here or in a sibling file.
- `packages/web/src/App.tsx` -- `ReadyList` (L107) calls `rank`. The ready tree (L81-89) is `Masthead > TrustStrip > AskingPriceLine > ReadyList > PageTail`. Put the statement between `AskingPriceLine` and the list.
- `packages/web/src/list/format.ts` -- `formatDivine` (L34) and the threshold `toFixed(2)` precedent (L215).
- `packages/web/src/list/RunningFoot.tsx`, `AskingPriceLine.tsx`, `KeyBlock.tsx` -- reuse them as they are.
- `packages/web/src/theme/tokens.ts` -- `frameReserve*` (L71-74), `reservedChrome` (L335), `coOccurringReserve` (L349, 95). `tokens.test.ts` L132-168. Add a 21px `frameReserveListStatement`. The statements are exclusive, so one slot serves both. Keep `syncReportMaxHeight ≤ frameSlack − coOccurring`.
- `packages/web/test-support/list-fixtures.ts` -- `priced(entry, p, at, league)` and `bodiesWith`. `artifact-server.ts` `serveArtifacts`.
- `packages/web/src/load/artifacts.ts` -- `ARTIFACTS` is the eight paths. This is the prune allowlist source.
- Root `package.json` -- has no `build` script. `packageManager` is `pnpm@12.5.1` and Node is `>=24.21.0 <25`. `prepare` (git hooks) exits cleanly in CI. `.gitignore` has `dist/`. The output is `packages/web/dist`.
- `packages/web/vite.config.test.ts` -- the precedent for testing the config without editing it.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/web/src/list/list-statement.ts` (+ test) -- a pure `listStatement` that returns `honest-empty` | `nothing-clears` | `none`, together with the copy. It covers the matrix rows.
- [ ] `packages/web/src/list/ListStatement.tsx`, `App.tsx` -- render the statement in the new slot.
- [ ] `packages/web/src/theme/tokens.ts` (+ test) -- the reserve token and the updated sums.
- [ ] `packages/web/src/App.test.tsx` -- the league-reset, partial-refresh and nothing-clears pages end to end. Add an interaction-surface guard: no `title`, `role=dialog|tooltip`, `aria-sort`, or clickable header, and no storage write other than the threshold key.
- [ ] `tools/prune-pages.mjs` + root `package.json` `build` (`vite build --config packages/web/vite.config.ts && node tools/prune-pages.mjs`) -- delete the `data/` files in `dist` outside the allowlist. A test asserts that the allowlist equals `ARTIFACTS`.
- [ ] `.github/workflows/deploy.yml` -- on push to `master` and on `workflow_dispatch`. The steps are checkout, `pnpm/action-setup`, setup-node 24 with the pnpm cache, `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build`, `configure-pages`, `upload-pages-artifact` (`packages/web/dist`) and `deploy-pages`. Permissions: `contents: read`, `pages: write`, `id-token: write`. Use a `pages` concurrency group.

**Acceptance Criteria:**
- Given `pnpm build`, when it finishes, then `packages/web/dist` holds `index.html`, the assets and exactly the committed subset of the eight artifacts.
- Given `pnpm check` and `pnpm test`, when they run, then both pass.
- Given the built site served statically, when agent-browser (named `--session`) opens it, then the committed page renders the raw list, no `recipes.json` absence line prints and the crafted branch is empty, and no request goes outside the eight artifacts.

### Review Findings

Code review 2026-09-27 (follow-up pass; blind, edge-case, verification-gap and acceptance layers over `ad45325...057129e`).

- [x] [Review][Patch] `role="status"` specifies a screen-reader behaviour the accessibility floor excludes, and is probably silent anyway: remove it and its comment. EXPERIENCE.md L1082 and UX-DR45 (epics.md L1609) say no screen-reader behaviour is specified. The region also mounts together with its text, which screen readers often skip, and no test asserts the role (verification-gap). A deletion closes all three [packages/web/src/list/ListStatement.tsx:21]
- [x] [Review][Patch] Append two ledger entries for the Epic 3 deferrals in this spec's frontmatter `deferred:` block (crafted rows in `ordering` suppress nothing-clears; state 35's third statement). They live only in frontmatter, so the Epic 3 author will not find them in `deferred-work.md` [docs/stories/deferred-work.md]
- [x] [Review][Patch] Append a ledger entry that the two statement strings are owed to their owner document. They exist only in `list-statement.ts` and this spec's Decisions. EXPERIENCE.md states 23 and 25 describe the declaratives but carry no literal text, so a UX revision of either state will drift from the code without a signal [docs/stories/deferred-work.md]
- [x] [Review][Patch] Append a closure note for the story 2.1 `data/` trim entry (deferred-work.md L120), which this story's prune closes, so `deferred-work-sweep` gets the signal. Follow the precedent of the notes at L87 and L97 [docs/stories/deferred-work.md:120]
- [x] [Review][Patch] Add `<link rel="icon" href="data:,">` so the built page sends no `favicon.ico` request. As verified, AC 3 ("no request goes outside the eight artifacts") recorded that request, which answered 404 [packages/web/index.html:6]

**Rejected** (20):
- `false` DESIGN.md's 116px worst case wrongly adds the list statement to the banner (blind, acceptance). EXPERIENCE.md state 25 keeps crafted rows ranked beside the declarative, so the two co-occur once Epic 3 ranks crafted rows. The present predicate is the one already deferred, not the budget.
- `false` Honest-empty also fires on no-listings rows (acceptance, info). The spec's Always predicate is exactly that, and the text is true.
- `false` The workflow targets `master` (acceptance, info). That is the default branch, the one AGENTS.md names.
- `false` `import.meta.main` is undefined below Node 24.2 (edge). `engines` requires `>=24.21.0`, and CI installs the latest 24.x.
- `false` The prune misses a stray `dist` file with no counterpart in `data/` (blind). `vite build` empties `outDir` first. Only a `publicDir` change reaches it, and `vite.config.ts` is under the Never list.
- `low` Spec `status: done` versus sprint `review` (acceptance, blind). The fix edits the spec under review, and this is the expected hand-off state.
- `low` The triage summary counts disagree with the log (blind). The fix edits the spec under review.
- `low` Execution tasks are left unticked (blind). The fix edits the spec under review.
- `low` "Numerals stay" in state 25 is untested (acceptance). It is already deferred in frontmatter, and the ledger patch above carries it.
- `low` The guard does not cover the epic's full interaction list (acceptance). This was rejected in the prior triage: the other features have no code to guard.
- `low` The guard misses hover-only tooltips and storage writes that bypass `setItem` (blind). Catching them adds hover and IndexedDB machinery against features nobody is writing.
- `low` The guard clicks only the header's direct children (edge, two entries). The same kind of guard hardening, for a sort nobody is writing.
- `low` The storage guard ignores `removeItem` and `clear` (edge). The same kind of guard hardening.
- `low` The allowlist copies `ARTIFACTS` instead of importing it (blind). The drift test covers it, and the fix restructures the tool.
- `low` The allowlist drift test never runs in CI (blind). A change to `ARTIFACTS` is a code change, which runs `pnpm test` locally. A CI test job is new scope, and the Never list keeps `pnpm test` out of the deploy.
- `low` `checkJs: false` leaves the prune untyped (blind). The include exists so that the tests get inferred types. Typing the tool would add JSDoc across it.
- `low` The prune lacks a final sweep of non-bundle files in `dist` (blind). The case is unreachable, as in the `false` entry above.
- `low` No test renders the statement together with other chrome (blind). The spec asks for a budget assertion, and `tokens.test.ts` has it.
- `low` The committed-data recipes test serves fixture config, not `data/config.json` (edge). The existing committed-data tests at App.test.tsx L353 and L368 follow the same pattern.
- `low` A symlinked directory in `data/` (edge). This was rejected in the prior triage: `data/` has none.

## Implementation Notes

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 32 findings — high 0, medium 4, low 17, false 8, maybe-false 3
- findings:
  - `low` `patch` The workflow has never run, and the Pages-source setup has no ledger entry — appended a story 2.7 entry to deferred-work.md.
  - `low` `patch` The owed edit to the epics.md AC about the `recipes.json` absence line has no ledger entry — appended a story 2.7 entry to deferred-work.md.
  - `medium` `patch` No test runs the `build` script or the prune CLI branch, so a dropped prune step or a lost `exit(1)` would ship — added subprocess tests to test/prune-pages.test.ts (a temp root, `execFileSync`, a non-zero exit on a missing required artifact) and an assertion that `scripts.build` ends with the prune.
  - `maybe-false` `defer` Nothing-clears cannot fire once crafted rows sit in `ordering` — `KIND_ORDER` is raw-only today, so this cannot occur yet. Settled by Epic 3's crafted ranking. Deferred (medium, unverified).
  - `maybe-false` `defer` State 35 adds a third declarative, so the slot is not truly two-way exclusive — craft recipes are Epic 3. Deferred (medium, unverified).
  - `medium` `patch` DESIGN.md (the budget owner) still said 95px/1485px/435px and had no list-statement token — added `frame-reserve-list-statement` and updated the Layout & Spacing arithmetic to 116/1506/414 and 84 without the banner.
  - `false` `reject` The threshold should use `formatDivine` — the page already prints the threshold with `toFixed(2)` (format.ts `rawPanelSubLine`), so the statement matches the rest of the page.
  - `low` `reject` The fixed 21px statement can wrap — the frame is a fixed 1060px (`spacing.frameWidth`), with no phone width, and league names are short. An ellipsis would truncate the league name.
  - `low` `reject` The statement borrows the `trust-strip` type role — cosmetic. DESIGN.md names no separate role, and adding one is a UX decision.
  - `low` `patch` The statement is not announced when it toggles — added `role="status"` to ListStatement's `<p>`. The guard still passes.
  - `low` `reject` A `data/index.html` or `data/assets/*` would collide with bundle output — `data/` holds only JSON artifacts, and a guard would add branches for an unreachable case.
  - `false` `reject` A missing `data/` gives a raw ENOENT — it still fails loudly with a non-zero exit, which is correct.
  - `false` `reject` `removeEmptyDirs` compares by plain prefix — the walk starts at a target under `dist` and stops at `dist`, so it never reaches a sibling such as `dist-old`.
  - `low` `reject` CI runs no tests — the intent's Never list excludes `pnpm test` from the deploy workflow.
  - `low` `reject` The deploy does not verify sub-path serving — `base: './'` makes every fetch relative, and the built site was checked with vite preview and agent-browser.
  - `false` `reject` Loose action/Node pins — `node-version: 24` resolves to the latest 24.x, which satisfies `>=24.21.0 <25`. The workflow holds no secrets.
  - `low` `reject` The tests hard-code the tolerable list, and one assertion is redundant — cosmetic duplication with no harm to coverage.
  - `low` `reject` Edge: a prune collision with bundle output — the same as above: `data/` is JSON-only, so this is unreachable.
  - `medium` `patch` The `invokedDirectly` url comparison can silently no-op (junction, drive-letter case) and exit 0 — the CLI now runs under `import.meta.main`.
  - `low` `reject` A symlinked directory in `data/` — `data/` has none, and a guard would add a branch for an unreachable case.
  - `low` `reject` Edge: statement wrap overflow — the same as above: fixed 1060px frame.
  - `low` `reject` The header shifts 21px when the statement toggles — typing a threshold already changes which rows show. A placeholder slot would add layout complexity and blank space in every normal state.
  - `low` `reject` Intent: honest-empty also fires over no-listings rows (*an open question*, two blocks) — the intent's Always defines state 23 as `ordering` and `belowThreshold` empty with at least one row, and the statement text is true there.
  - `maybe-false` `defer` Intent: "the rows and their numerals stay" is unexercised — a raw-only ranking prints no numbered row in state 25. Grouped with the Epic 3 crafted-predicate deferral.
  - `false` `reject` Intent: nothing-clears shows with no printed rows — the intent's nothing-clears predicate has no row condition, and the statement is true.
  - `medium` `patch` Intent: the real `pnpm build` output is untested — grouped with the build-wiring gap. The subprocess test runs the real script, and `pnpm build` was run in verification.
  - `low` `reject` Intent: the guard does not cover hover actions, clipboard, virtualisation or auto-refresh — the guard covers the spec task's named checks, and the other features have no code to guard.
  - `low` `reject` Intent: the slot reserves no space while empty — the same as the header-shift row.
  - `low` `reject` Intent: the recipes test mixes committed files and fixtures — the built-site browser check served the whole committed `data/` set.
  - `false` `reject` Intent: Node 24 versus 24.21 — the same as the pins row.
  - `false` `reject` Intent: `master` versus `main` — the `master` branch exists, and AGENTS.md names `master` as the fast-forward target.
  - `false` `reject` Intent: `toFixed(2)` versus `formatDivine` — the same as the formatDivine row.

## Verification

**Commands:**
- `pnpm check` -- expected: clean.
- `pnpm test` -- expected: green, with no escaped request.
- `pnpm build && ls -R packages/web/dist` -- expected: only the allowlisted `data/` files.

**Manual checks:**
- Serve `packages/web/dist` with `pnpm exec vite preview --config packages/web/vite.config.ts --port 4173` in the background. With agent-browser: take a screenshot of the committed page, of a league-reset fixture copied over `dist/dataset.json`, and of a threshold of 3.00 (nothing clears). Then stop the server.
- The Pages source must be set to "GitHub Actions" in the repository settings. No remote is configured, so the workflow is not run here.

## Auto Run Result

Status: done

**Summary:** The list now makes one statement about itself, under the asking-price line:
- **honest-empty** (state 23): `In canonical order, not ranked: no tracked unit has a price from <league> yet.`
- **nothing-clears** (state 25): `Nothing clears your Payout Threshold of <x.xx> Divine.`

A pure `web` predicate over `core`'s `Ranking` derives the statement, and it renders in one new 21px reserved slot. An interaction-surface guard test was added. The deploy consists of three parts:
- `pnpm build`, which runs vite build and then `tools/prune-pages.mjs`. The prune keeps only the eight AD-24 artifacts and fails loudly on a missing required one.
- `.github/workflows/deploy.yml`, which deploys to Pages on a push to `master` or on `workflow_dispatch`. It uses no secrets and does not run `pnpm test`.
- a Pages source setting of "GitHub Actions", which a human still has to make.

**Files changed:**
- `packages/web/src/list/list-statement.ts` (+ test): the `listStatement` predicate and the copy.
- `packages/web/src/list/ListStatement.tsx`: the 21px `role="status"` statement line.
- `packages/web/src/App.tsx`: `ReadyList` computes the statement from the same `rank` call and renders it above the list.
- `packages/web/src/theme/tokens.ts` (+ test): `frameReserveListStatement`, the `reservedChrome` line and `coOccurringReserve` 116.
- `packages/web/src/App.test.tsx`: end-to-end tests for league reset, partial refresh, nothing-clears then lowered, an empty list and the committed recipes, plus the interaction-surface guard.
- `tools/prune-pages.mjs`: the prune allowlist and the CLI, run under `import.meta.main`.
- `test/prune-pages.test.ts`: the prune behaviour, the CLI subprocess and the `scripts.build` wiring.
- `packages/web/src/load/prune-allowlist.test.ts`: asserts that the allowlist equals `ARTIFACTS`.
- `package.json`: the `build` script.
- `tsconfig.tools.json`: includes the prune script.
- `.github/workflows/deploy.yml`: the Pages deploy.
- `docs/ux-designs/.../DESIGN.md`: the list-statement reserve token and the updated budget arithmetic.
- `docs/stories/deferred-work.md`: two appended story 2.7 entries, one for the unrun deploy and one for the owed epics AC edit.

**Review findings:** 32 in total.
- 7 patched: 3 medium entries (the build/CLI verification gap, DESIGN.md drift, the `invokedDirectly` silent no-op) and 3 low (two ledger entries, `role="status"`).
- 2 deferred, both medium (unverified), both about Epic 3: the crafted rows versus the nothing-clears predicate, and the third statement of state 35.
- 23 rejected, with the reasons in the Review Triage Log.

**Follow-up review recommended: true.** Three medium entries were patched, 0 high. Two risks remain unverified:
- The DESIGN.md Layout & Spacing edit was made by an agent in the UX owner document. It asserts that the list statement co-occurs with the banner. That is not reachable on today's raw-only ranking, and the UX owner has not reviewed it.
- The new `import.meta.main` CLI path has run only on local Windows, not on the CI Linux runner.

**Verification:**
- `pnpm check`: clean.
- `pnpm test`: 86 files, 1100 tests passed, with no escaped request.
- `pnpm build`: `packages/web/dist` holds `index.html`, `assets/*` and exactly the eight artifacts. The build removed `catalogue/filters.json`, `catalogue/items.json`, `currencies.json` and `sync-progress.json`.
- In the first pass, the implementer served `dist` with vite preview on port 4173 and used agent-browser with a named session. The committed page ranks the raw list with no statement, no absence line and an empty crafted branch. The only fetches were the eight artifacts, plus the browser's own `favicon.ico`, which answered 404. A threshold of 3.00 shows nothing-clears. A league-reset fixture shows honest-empty.

**Residual risks:**
- The deploy workflow has never run, because no remote is configured. The Pages source must be set to "GitHub Actions".
- `node-version: 24` floats within the 24.x line.
- The statement toggling moves the column header by 21px.
