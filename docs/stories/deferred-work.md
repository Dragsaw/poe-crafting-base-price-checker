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
