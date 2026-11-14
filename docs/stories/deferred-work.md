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

- source_spec: `docs/stories/spec-7-1-the-recipe-floor-per-modifier-after-the-level-scope.md`
  summary: Mark a not-counted (unreachable) entry in `CraftedCombination` and give it its own display and ordering in `web` (state 49, `+ N not counted`).
  evidence: `scanSummands` in `packages/core/src/rank-crafted-row.ts` pushes a not-counted entry as `{entryKey, trust}` with the entry's own trust, which can be `current`, and no price. `compareCombinations` sorts it with the priced group, and `display-rows.ts` renders it as an ordinary unpriced line. The `CraftedCombinationSchema` description in `packages/contracts/src/ranked-row.ts` still says "below threshold, pending or broken". Stories 7.2 and 7.4 own the marker and the treatment (`EXPERIENCE.md` Interaction 3a, state 49). Found in the spec-7-1 review.

- source_spec: `docs/stories/spec-7-1-the-recipe-floor-per-modifier-after-the-level-scope.md`
  summary: Give a pair with no counted entry the reason `nothing rolls at ilvl <level>`, not `no prices yet`.
  evidence: `craftedTrust` in `packages/core/src/price-trust.ts` returns `pending` with `no-prices` for an empty entry list. That tells the player prices are coming, when no entry counts. `EXPERIENCE.md` states 18 and 48 give `nothing rolls at ilvl <level>`, and Stories 7.2 and 7.4 add that reason kind. Found in the spec-7-1 review.

- source_spec: `docs/stories/spec-7-1-the-recipe-floor-per-modifier-after-the-level-scope.md`
  summary: Transcribe `level-toggle` and the revision 34 Copy Deck strings in Story 7.4. The DESIGN.md and EXPERIENCE.md revision pins no longer trip for them.
  evidence: spec-7-1 raised the pins in `packages/web/src/theme/tokens.test.ts` and `packages/web/src/list/row/trust-words.test.ts` to DESIGN.md 24 and EXPERIENCE.md 34. Every content assertion passed against those revisions, and commit `15575f7` had left the pins failing for 7.4. With the pins green, nothing fails until 7.4 adds the `level-toggle` component and the new strings (`needs ilvl <floor>`, `<recipe> orbs can't roll this at ilvl <level>`, `nothing rolls at ilvl <level>`).

## Deferred from: spine revision 48 (2026-11-14)

- source_spec: `docs/stories/spec-7-2-per-entry-floors-and-the-crafting-item-level-in-core.md`
  summary: Run `coOccur` for every hybrid pair, line-set completeness and kind agreement at the highest offered Crafting Item Level, as AD-17 (spine revision 48) states.
  evidence: `referenceFailures` in `packages/core/src/cross-file.ts` runs all four `REF_CHECKS` at `entry.itemLevelMin`, and `pairOverlap` checks a same-floor pair at that floor. AD-17 keeps edge alignment, the empty containment set and the co-rollable combination at the entry's own floor, and moves the three checks that search the pool for a violating tier to `HIGHEST_CRAFTING_ITEM_LEVEL`. Until then, two same-floor hybrid entries below 82 that co-occur only on a tier between their floor and 82 pass the gate and double-count in `rank` at 82. The committed data has 0 such failures. Story 7.3 adds lower-floor entries, so land this before 7.3. Done when tests feed a same-floor hybrid pair that co-occurs only above its floor, and an entry whose line-set or kind defect appears only above its floor, and each fails.
