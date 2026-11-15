# Deferred work

Each entry names work carved out of a spec. Append new entries. Do not rewrite other entries. Remove an entry in the last commit of the branch that lands its work, or in a commit that names the decision to cancel it. `pnpm deferred:issues` opens one GitHub issue for each entry, and the `deferred-work-sweep` skill keeps its run state in that issue, not here. An entry can carry a `retry_when:` line as a precondition: the sweep skips the entry until the condition is true. A `retry_when` is absent or one of the three forms that the sweep can test, never a future planning event (epic 4 retro L2). `tools/deferred-issues/ledger-rules.test.ts` checks each entry.

<!--
    Entry format, read by `pnpm deferred:issues` and `deferred-work-sweep` (tools/deferred-issues/ledger.ts).
    The parser does not skip HTML comments. Every line in here is indented, so none counts as an entry.
    A real entry sits at column 0 under a heading, with a blank line after it, like this (indent removed):

    ## Deferred from: <where it came from> (YYYY-MM-DD)

    - source_spec: `docs/stories/spec-example.md`
      summary: One line, or wrapped lines, saying what work is owed. The issue title is this text cut to 70 characters.
      evidence: Where to look and why it is true: file paths, line numbers, the review finding.
      retry_when: Optional. Story 3.7 is done in sprint-status.yaml

    Rules:
    - The bullet starts with `- source_spec:` at column 0. Every other field is indented by exactly two spaces.
    - `source_spec`, `summary` and `evidence` are required. An entry missing one of them is a note and is skipped.
    - `retry_when` is optional. When present, it is one of the forms the sweep can check: `Story <n.n> is done in
      sprint-status.yaml` (a story that sprint-status.yaml lists), `master has moved past <sha>`, or
      `never — needs a human`. Never tie an entry to a future planning event (epic 4 retro L2).
    - A field may wrap onto lines indented by two or more spaces. A blank line, a heading or a new bullet ends the entry.
    - Do not write an id. The id is `dw-` plus a hash of source_spec and summary, so editing either field
      makes a new entry and a new issue.
-->


## Deferred from: spec-retro-4-2 review (2026-10-10)

- source_spec: `docs/stories/archive/spec-retro-4-2-state-23-verdict-and-recipeless-order.md`
  summary: Guard against CRLF in edited files: Serena `replace_content` writes CRLF on Windows, so add a CR check to lint-on-edit or a Known pitfalls line in AGENTS.md.
  evidence: Every Serena edit on this branch left CRLF in the working copy despite `.gitattributes` `eol=lf`; `packages/web/src/list/display-rows.test.ts`'s raw-source scan of `summands` uses then failed on a trailing `\r` until the files were normalised (Blind Hunter finding).
  

## Deferred from: epic 6 retro (2026-11-01)

- source_spec: `docs/stories/epic-6-retro-2026-11-01.md`
  summary: ADV-13: write the active-recipe narrowing once, so the pick-up filter and the ranked list cannot judge a recipe's rows differently.
  evidence: `classValuesOf` in `packages/core/src/pick-up/pick-up.ts` keeps crafted `ordering` rows with `row.recipeId === recipeId` (and drops `ev === null`). `forRecipe` in `packages/web/src/list/active-ranking.ts` narrows `ordering` (raw rows kept), `unpricedCrafted`, `unrankable` (recipe-less items kept) and `uncostableRecipes` with its own `recipeId === id` tests. If the two drift, the filter and the list give two judgements, which FR-35 forbids (`docs/reviews/review-epic-6-diff.md` ADV-13). Done when one exported `core` predicate serves both callers, and a test shows the filter's classes for a recipe equal the crafted classes `forRecipe` keeps for it.

- source_spec: `docs/stories/epic-6-retro-2026-11-01.md`
  summary: VG-2: test that the pick-up filter download never calls the File System Access API.
  evidence: `saveFilter` in `packages/web/src/pick-up-filter/PickUpFilter.tsx` saves through a Blob behind `<a download>` (AD-15, AD-24). jsdom defines no `showSaveFilePicker`, so a feature-detected picker branch would pass every test. Guard: stub `showSaveFilePicker` as a spy, download, and assert no call while the Blob download still happens (`docs/reviews/review-epic-6-diff.md` VG-2).

- source_spec: `docs/stories/epic-6-retro-2026-11-01.md`
  summary: ADV-12: order pick-up filter entries readably, not by JSON key text.
  evidence: `compareKeyed` in `packages/core/src/pick-up/pick-up.ts` sorts by `compareCanonicalKeys`, so a floor of 9 sorts after a floor of 70 and every jewel kind comes before every raw base. The order is deterministic, so NFR-3 holds (`docs/reviews/review-epic-6-diff.md` ADV-12). No owner document names the target order (numeric floors, raw bases or jewel kinds first, rarity tiebreak); the order is visible in the downloaded filter, so UX decides it before a build. A new order changes the expected text of the App-level download oracle tests (`d5be2a8`).
  retry_when: never — needs a human

## Deferred from: spec-epic-6-retro-item-4 review (2026-11-02)

- source_spec: `docs/stories/spec-epic-6-retro-item-4-unresolvable-raw-base-pick-up.md`
  summary: Check in game whether a pick-up filter with a `BaseType ==` block for a base the game does not know loads, skips that block, or fails as a whole.
  evidence: FR-36 (PRD revision 37) keeps craft and check-the-rolls blocks for an unresolvable Raw Base, and the player accepted the risk. Unverified, severity medium to high if true: if the game rejects the whole file, every block fails and the filter adds no visibility (FR-35). 0 unresolvable Raw Bases in `data/dataset.json` today. Proof: import a filter that names a made-up base in a `BaseType ==` line and observe the game.
  retry_when: never — needs a human

## Deferred from: spec-7-1 (2026-11-14)

- source_spec: `docs/stories/spec-7-1-the-recipe-floor-per-modifier-after-the-level-scope.md`
  summary: Name the words for the pair failures `pool empty` and `augment exhausted`: FR-4 and the `EXPERIENCE.md` Copy Deck name none, and AD-17 calls that gap a PRD finding.
  evidence: `UnrankableReason` in `packages/core/src/rank.ts` reports the causes `core` observed as `pool empty` (an empty class pool, or a slot the scope leaves empty, with `recipeId`) and `augment exhausted` (with `recipeId`). The appendix prints them verbatim with no reason note (`APPENDIX_NOTES` in `packages/web/src/list/UnrankableAppendix.tsx`). The committed data hits neither cause today. The PRD owner adds the FR-4 members, and UX adds the Copy Deck strings; then `core` and `web` adopt those words. [NOTE FOR UX] The appendix prints a recipe-scoped pair failure (with `recipeId`) the same as a class-wide one, so the player cannot tell that the row may go away on a recipe switch: the words should tell a recipe-scoped failure from a class-wide one.
  retry_when: never — needs a human

## Deferred from: spec-7-3 review (2026-11-15)

- source_spec: `docs/stories/spec-7-3-regenerate-tracked-json-for-t1-and-t2.md`
  summary: Add an end-to-end test that spawns `pnpm tracked:regenerate` against a temp copy of the data and checks the fixed point, the output format and the schema-failure exit.
  evidence: `regenerate.test.ts` imports only `regenerateEntries` and `isTrackedFile`. `main` in `.claude/skills/tracked-json/scripts/regenerate.ts` (the schema guard, `JSON.stringify(file, undefined, 2) + '\n'`, exit code) has no test. `lookup.end-to-end.test.ts` spawns its CLI with `execFile`. The script writes a fixed `data/tracked.json` path, so the test first needs an injectable path or a temp root. Found by the verification-gap layer of the spec-7-3 review.

## Deferred from: spec-7-4 (2026-11-15)

- source_spec: `docs/stories/spec-7-4-the-item-level-toggle.md`
  summary: Decide how the header gives the league eyebrow back its full width now that the level toggle overruns the bar's width budget (UX decision).
  evidence: With the level toggle (103.3px wide, plus its 22px gap) the controls measure 913px in Inter in agent-browser. The brand block yields as before (`minWidth: 0` in `packages/web/src/frame/HeaderBar.tsx`, the human's option A in spec-7-4 Decisions). At the 1063px target viewport the brand block is 80px, so the 148px title and the 111px eyebrow `Forbidden Rites` both cut with an ellipsis. At the 1000px content-min viewport the brand block is 17px. DESIGN.md `header-bar.layout` says the eyebrow never cuts and the brand block never narrows below it, and its width budget asks for an overrun report. `App/header-bar.test.tsx` now asserts the reserved-width title room is above 0 and below the title width at both frames.

- source_spec: `docs/stories/spec-7-4-the-item-level-toggle.md`
  summary: Add a web test that clicks the level toggle during the cold load (state 22) and checks that the choice is stored and ranks the first ready render.
  evidence: `pendingControls` in `packages/web/src/frame/header-controls.tsx` renders a live `LevelToggle` while pending. The cold-load test in `packages/web/src/App/header-bar.test.tsx` only finds `[data-level-toggle]`, and every test in `packages/web/src/level/level-toggle.test.tsx` clicks after `ready()`. A no-op `onLevelChange` in `renderPending` (`packages/web/src/App.tsx`) would pass every test. Found by the verification-gap layer of the spec-7-4 review.

## Deferred from: spec-epic-7-retro-item-1 (2026-11-15)

- source_spec: `docs/stories/spec-epic-7-retro-item-1-measured-refresh-time.md`
  summary: Measure the full-refresh time without the session cookie, then give UJ-6 and SM-C1 that figure.
  evidence: PRD revision 40 gives UJ-6 and SM-C1 about a day and a half with the cookie and only "takes longer" without it, because no no-cookie figure was measured. The committed sync history holds only short pre-cookie runs, and every Pi session since 2026-11-08 ran with the cookie (`epic-7-retro-2026-11-15.md` D1). The inferred figure is about 70 h (about 50 searches/h under AD-8's spread), not measured. Until this lands, AD-12's no-cookie pace clause has no figure. Proof: run the Pi sync unauthenticated (`ops/pi/README.md`) long enough for a steady rate, take entries per hour from the `sync-progress.json` `completed` growth per 4 h tick, skipping any tick where a new pass restarts the completed list, and divide the Tracked List's search count by it. Cost: the run holds the only sync host at the unauthenticated pace for its duration. Afterwards, `ops/pi/set-poesessid.sh` restores the cookie. The PM then puts the figure in UJ-6 and SM-C1.
  retry_when: never — needs a human

- source_spec: `docs/stories/spec-epic-7-retro-item-1-measured-refresh-time.md`
  summary: Recheck the Price trust rationale for the 72 h old mark against the accepted refresh cycle of about 36 h.
  evidence: [NOTE FOR UX] `EXPERIENCE.md` *Price trust* (about lines 672-673) justifies the 72 h *old* threshold by "the partial refresh cycle of about 15 hours". PRD revision 40 accepts a full refresh of about 36 h with the cookie (UJ-6, SM-C1). A no-cookie cycle, inferred at about 70 h, would come near the 72 h *old* mark. Two more `EXPERIENCE.md` lines state the old one-day refill: the league-reset row of the state table (about line 876, "The list refills over the following day") and the league-reset journey step 6 (about line 1353, "Over the following day, rows lose their ○"). UX owns the threshold, its rationale and these lines; a reviewer does not edit the owner document.
  retry_when: never — needs a human

## Deferred from: spec-epic-7-retro-item-2 (2026-11-15)

- source_spec: `docs/stories/spec-epic-7-retro-item-2-inexact-midpoint-step.md`
  summary: Make `tools/dev-stop/stop-listeners.test.ts` deterministic: one `pnpm check` run failed it on a control character in the live process-list JSON.
  evidence: On 2026-11-15 one full `pnpm check` on Windows failed two tests in that file, "snapshot > reads this process as the listener of a real port, then no listener once it closes" and "snapshot with an unreadable listener list > throws instead of passing a non-PID listener on", with `SyntaxError: Bad control character in string literal in JSON at position 94651 (line 1 column 94652)`. The second test expected `/unexpected listener query result/`. The file passed twice when run alone, and the next full `pnpm check` passed. The done gate therefore holds a nondeterministic failure that depends on the machine's live process state. The JSON comes from PowerShell `ConvertTo-Json` output parsed with `JSON.parse` (`tools/dev-stop/development-stop.ts:186-187`, or the snapshot path the test exercises). Done when the test no longer reads unescaped process text, or the parser tolerates it, and a test feeds it a control character.

## Deferred from: spec-epic-7-retro-item-4 (2026-11-15)

- source_spec: `docs/stories/spec-epic-7-retro-item-4-reach-check-skips-levels-below-the-floor.md`
  summary: [NOTE FOR ARCHITECT] Say "at or above the entry's floor" in the AD-17 gate sentence and in AGENT-WORKFLOW.md's `unreachable` rule, to match `tracked:check` after retro item 4.
  evidence: `ARCHITECTURE-SPINE.md` AD-17 ("fails only for an entry that no recipe in `data/recipes.json` reaches at any offered `L` ... because such an entry can never count") and `AGENT-WORKFLOW.md` ("unreachable under every recipe at every offered Crafting Item Level") do not name the floor. Since retro item 4, `isReached` in `packages/sync/src/curation/check.ts` skips levels below `entry.itemLevelMin`, as `countedProbability` in `rank` does (FR-38). The AD-17 reason clause already implies this, but the literal text allows the old reading. The Review brief forbids an implementer from editing these architect-owned files. The `tracked-json` SKILL.md is already updated.

## Deferred from: epic 7 retro (2026-11-15)

- source_spec: `docs/stories/epic-7-retro-2026-11-15.md`
  summary: [NOTE FOR ARCHITECT] ADV-2: edge alignment can pass at the entry's floor and fail at 82, so AD-17's "a wider pool cannot undo a pass" is false for it.
  evidence: AD-17 (`ARCHITECTURE-SPINE.md`, about lines 1297-1299) runs edge alignment at the entry's own `itemLevelMin` on that premise, and the `FLOOR_CHECKS` JSDoc (`packages/core/src/cross-file.ts:161`) states it word for word. The `HIGHEST_CRAFTING_ITEM_LEVEL` JSDoc (`packages/core/src/crafting-item-level.ts:7`) rests on the related claim that the scoped pool only grows with the level. Story 7.5 lets the lower edge equal the lowest own minimum (`packages/core/src/cross-file/edge-alignment.ts:21`). A higher-level tier whose derived interval begins below the band and whose own interval lies inside it becomes contained at 82: it lowers `min` below `valueMin` while `ownMin` stays above it. Run counterexample: T1@60 [30,40], T2@75 [40,50], T3@82 [35,48], band [40,50] passes at 75 and 79 and fails at 82, and the gate checks only at the floor (`FLOOR_CHECKS`, `:162`). The EV effect (T3's rolls 35-39 fall outside the search) stays inside AD-11's accepted residual. Options: run edge alignment at every offered level at or above the floor; restrict the own-minimum acceptance so that a pass at the floor holds at every level; or rule ECH-3 so that AD-11 gives the overlap to the lower-level tier, which leaves T3 uncontained. Decide this entry and ECH-3 together. Align the AD-17 sentence and both JSDocs with the ruling. This reopens 7.2 Edge 2 / Blind 2, which `a474893` (rev 48) closed on the premise. 0 cases in the committed data (`docs/reviews/review-epic-7-diff.md` ADV-2). The commit that records the ruling removes this entry and appends a buildable entry for any code it needs (retro P1).
  retry_when: never — needs a human

- source_spec: `docs/stories/epic-7-retro-2026-11-15.md`
  summary: [NOTE FOR ARCHITECT] ECH-3: say whether AD-11 gives an own-interval overlap to the tier below in level or below in value.
  evidence: AD-11 (`ARCHITECTURE-SPINE.md`, about line 693) gives the overlap to the tier below. `ownInterval` and `deriveOwnInterval` (`packages/core/src/probability.ts:75-113`) cut any tier whose derived minimum lies inside another positive-weight tier's interval of the same line set, whatever their levels. The tier with the lower values therefore keeps the overlap. In a family whose values fall as the level rises, that is the higher-level tier: with T2@75 [40,50] and T3@82 [35,48], T2 is cut to start above 48 and T3 keeps [35,48]. The code reads "below" as below in value. This is the shape that makes ADV-2 possible, so decide this entry and ADV-2 together. 0 overlaps that a higher-level tier keeps over 8,990 banded lines of `data/weights.json` (`docs/reviews/review-epic-7-diff.md` ECH-3). The code follows one reading of its owner document, so a change is an AD-11 decision. The commit that records the ruling removes this entry and appends a buildable entry for any code it needs (retro P1).
  retry_when: never — needs a human

- source_spec: `docs/stories/epic-7-retro-2026-11-15.md`
  summary: VG-1: test the floor term of `widestLevel` with a cross-file entry whose floor is above 82.
  evidence: `widestLevel(...floors)` (`packages/core/src/cross-file.ts:244-246`) sets the level of the `WIDEST_CHECKS` loop (`:228-229`) and of `pairOverlap` (`:253`). No cross-file test entry has a floor above 82: the explicit floors are 70 and 75, and `entry()` defaults to 82 (`packages/core/src/cross-file/test-support.ts:68`). Cutting `widestLevel` down to `HIGHEST_CRAFTING_ITEM_LEVEL` therefore fails no test, and kind-agreement, line-set and co-occur failures from tiers between 83 and the floor would go unreported. Done when `packages/core/src/cross-file/per-entry-floors.test.ts` has a case with `entry({ prefix: valueless() }, { itemLevelMin: 90 })` over a banded tier at 86 that expects a `kind-agreement` failure "at item level 90", and one for a hybrid pair through `pairOverlap`, and both fail with `widestLevel` cut to 82. 0 crafted floors above 82 in the committed data (`docs/reviews/review-epic-7-diff.md` VG-1).

- source_spec: `docs/stories/epic-7-retro-2026-11-15.md`
  summary: ADV-3: report in `noT2` a T1-only reference whose every T2 sibling sits above 79, instead of counting it only as `sibling`.
  evidence: `variantsOf` (`.claude/skills/tracked-json/scripts/regenerate-entries.ts:103-111`) gives a T1-only reference whose T1 is above `LOW_LEVEL` (79) every trackable T2 of its line set as a sibling, and does not check the sibling's `itemLevelMin`. A T2 above 79 counts as `sibling` and keeps the reference out of `noT2`, so the reference gets no variant that counts at 79 and the run report does not say so. The sibling still counts at 82, so keep it in the output. Done when a reference whose siblings all sit above `LOW_LEVEL` is pushed to `noT2`, a reference with at least one sibling at or below `LOW_LEVEL` is not, `regenerate.test.ts` covers both cases, and `pnpm tracked:regenerate` still leaves `data/tracked.json` unchanged. 0 such T2 tiers in `data/weights.json` today. New against the 7.3 log: Edge 2 and Blind 3 cover the sibling's family and a missing T2, not its floor (`docs/reviews/review-epic-7-diff.md` ADV-3).

- source_spec: `docs/stories/epic-7-retro-2026-11-15.md`
  summary: ADV-5: the `NO_CRAFTED_CONTEXT` comment says no line is built, but the default context throws on a not-counted combination.
  evidence: The JSDoc at `packages/web/src/list/display-rows.ts:128` says "no line is built and the level is never printed". `craftedDetail` (`:162-165`) throws on `recipeWord === undefined` before `notCountedLine` would find no tracked entry, so `toDisplayRows(ranking, dataset)` with the default context throws for any ranking that has a not-counted combination. Production callers pass `crafted` (`:305`, `:316-317`). Only `packages/web/src/test-support/dom.tsx:99` uses the default, and it ranks with no weights, so it has no crafted row. The 7.4 triage (#11) kept the throw. Done when either the comment states that the default context throws on that path, or the tracked-entry lookup runs before the `recipeWord` check and a test calls `toDisplayRows` with the default context on a ranking with a not-counted combination and gets no throw and no line (`docs/reviews/review-epic-7-diff.md` ADV-5).

- source_spec: `docs/stories/epic-7-retro-2026-11-15.md`
  summary: [NOTE FOR UX] B1: decide whether the filter-modal lead names the crafting item level, because the download depends on it.
  evidence: The Copy Deck's modal lead (`EXPERIENCE.md`, about line 486) has `<threshold>` and `<recipe>` but no level. The download holds the purposes at the Crafting Item Level on screen (Interaction 9, about line 1025), so two downloads at one threshold and recipe differ by a dial the lead does not name. Seen at ilvl 79 in the retro's browser run: "…at your threshold of 0.25 div with perfect orbs" (`epic-7-retro-2026-11-15.md` B1). UX owns the Copy Deck, and a reviewer does not edit the owner document. If UX adds the level, the commit that changes the Copy Deck removes this entry and appends a buildable entry for `web` to adopt the string.
  retry_when: never — needs a human
