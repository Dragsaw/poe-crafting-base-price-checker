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

- source_spec: `docs/stories/spec-retro-4-2-state-23-verdict-and-recipeless-order.md`
  summary: Guard against CRLF in edited files: Serena `replace_content` writes CRLF on Windows, so add a CR check to lint-on-edit or a Known pitfalls line in AGENTS.md.
  evidence: Every Serena edit on this branch left CRLF in the working copy despite `.gitattributes` `eol=lf`; `packages/web/src/list/display-rows.test.ts`'s raw-source scan of `summands` uses then failed on a trailing `\r` until the files were normalised (Blind Hunter finding).

## Deferred from: spec-currencies-refresh-tool review (2026-10-11)

- source_spec: `docs/stories/spec-currencies-refresh-tool.md`
  summary: [NOTE FOR ARCHITECT] AD-20 and the data writer table still call `data/currencies.json` hand-maintained; record that `pnpm currencies:refresh` may write it from poe2scout, and rule on whether `source: "measured"` still fits.
  evidence: ARCHITECTURE-SPINE.md AD-20 (~l.1373 "Rates are hand-maintained committed data"), the writer table (l.125 "the player, by hand") and the `CurrencyRateSchema.source` description in `packages/contracts/src/currency-rate.ts` predate the tool in `tools/currencies-refresh/`; a reviewer may not edit the spine (AGENT-WORKFLOW.md Review brief rule 2). Blind Hunter findings 1 and 2.

## Deferred from: player feedback on tracked data and weights (2026-10-18)

- source_spec: `data/tracked.json`
  summary: Fix the Spirit stat id on body armour entries: `explicit.stat_2704225257` gets no listings on any armour; find the stat id the trade site uses for Spirit on body armours.
  evidence: The body armour entries (`armour.chest`, `Body_Armours_*`) are uncommitted in the `Dragsaw/sync-4` worktree and use `explicit.stat_2704225257` ("# to Spirit"). Amulets use `explicit.stat_3981240776` for the same text. Player report: no listing on any armour matches the tracked id.

- source_spec: `data/tracked.json`
  summary: Track all three elemental resistances wherever one is tracked, so that a valuable fire-res pairing also prices its cold and lightning twins and the recipe EV is complete.
  evidence: Player report: if boots with Movement Speed and Fire Resistance are valuable, the Cold and Lightning variants are too, and leaving them out lowers the recipe's EV. Example: the body armour entries in the `Dragsaw/sync-4` worktree track Fire (`explicit.stat_3372524247`) and Chaos Resistance but not Cold or Lightning.

- source_spec: `data/tracked.json`
  summary: Delete (not prune) the seven Rings entries whose suffix is "# to all Attributes" (`explicit.stat_2897413282`): the mod does not exist on rings.
  evidence: `data/tracked.json` Rings entries pair each of seven prefixes with suffix `explicit.stat_2897413282`. `pnpm tracked:lookup tiers explicit.stat_2897413282 --class Rings` still lists an `AllAttributes` suffix tier (T4, ilvl 1, weight 400), so the producer's ring pool may also be wrong; check where that tier comes from. Player asks for deletion, which is an exception to the AD-12 prune tombstone.

- source_spec: `data/tracked.json`
  summary: Find out why the Emerald entries with "increased bonuses gained from Equipped Quiver" and "increased Effect of your Mark Skills" get no listings; check the stat ids against the trade site.
  evidence: In the `Dragsaw/sync-4` worktree, 18 Emerald entries use `explicit.stat_1200678966` (quiver bonuses) and 18 use `explicit.stat_712554801` (Mark effect). The catalogue also has the radius forms `explicit.stat_4180952808` and `explicit.stat_179541474`; jewels may roll those instead. The player plans to check the market.
  retry_when: never — needs a human

- source_spec: `data/tracked.json`
  summary: Track more normal (raw) bases.
  evidence: `data/tracked.json` on master holds only four raw entries (two Amulets, two Belts, one of them pruned) beside 1,255 crafted entries. The player did not name the bases to add.
  retry_when: never — needs a human

## Deferred from: spec-jewel-craft-cost-zero review (2026-10-23)

- source_spec: `docs/stories/spec-jewel-craft-cost-zero.md`
  summary: [NOTE FOR UX] The Accessibility Floor names only the minus sign and `< 0.00` as the cue of a dimmed figure, but state 21 now dims a jewel's `0.00`, which has neither.
  evidence: EXPERIENCE.md *Accessibility Floor* (line ~1027, "never by tone alone") against state 21 rev 31 (memlog 294). `packages/web/src/list/display-rows.ts` `figure()` dims a jewel's `0.00` by tone; the exact `0.00` beside empty chase cells is the only other cue. UX decides whether the Floor names that cue or the dim changes. Review finding from three layers.
  retry_when: never — needs a human

- source_spec: `docs/stories/spec-jewel-craft-cost-zero.md`
  summary: [NOTE FOR UX] UJ-2 says "Jewel rows do not move" across `greater` and `perfect`, but only a jewel's EV stays the same; its rank position can change as non-jewel EVs move.
  evidence: EXPERIENCE.md UJ-2 rev 31. `compareOrdering` (`packages/core/src/rank-order.ts`) orders by EV, and every non-jewel crafted EV changes with the recipe's Craft Cost, so a jewel row can change rank between recipes. Blind review finding.
  retry_when: never — needs a human
