# Epic 7 Context: League-start crafting levels

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The player chooses the item level they craft at (79 or 82), and the crafted ranking follows it. At league start, ilvl 79 bases are easy to get and ilvl 82 bases are rare. Almost every T1 modifier tier needs ilvl 81 or 82. Before this epic every crafted class was valued for ilvl 82 bases, so the ranking was wrong for the bases the player holds at league start. The epic also fixes a game-rule defect: a greater or perfect orb never removes a modifier from the pool, and the old recipe floor (Story 4.7, per `modGroup` and before the level scope) made perfect-recipe EVs wrong. To track T1 and T2 apart where their values overlap (for example "Adds # to # Lightning Damage"), `core` gives each tier its own interval. The epic adds one header control. It changes no sync behaviour and no artifact schema. **Deadline: every story lands before the league start on 2026-12-11.**

## Stories

- Story 7.1: The recipe floor per modifier, after the level scope (done)
- Story 7.2: Per-entry floors and the Crafting Item Level in `core` (done)
- Story 7.5: A tier's own interval in `core`
- Story 7.3: Regenerate `tracked.json` for T1 and T2
- Story 7.4: The item-level toggle

## Requirements & Constraints

- **Two offered levels:** 79 (league start) and 82 (endgame), defined in one place in the code. `rank`, its callers and `tracked:check` all read that place (FR-38).
- **The level scopes every crafted EV.** A crafted entry whose Item Level Floor is above the level is not a summand: it contributes nothing, not zero. An Item Class with no entry that counts at the level is treated as one with no priced Combination (FR-1, FR-38).
- **Raw Bases are unaffected.** A Raw Base's price stays scoped to its own floor at either level (FR-3).
- **The recipe floor never removes a modifier.** If every tier of a modifier that can roll at the level is below the orb's minimum modifier level, the best of those tiers still rolls at its own weight. A "modifier" is one modifier, not its `modGroup` family (FR-26).
- **Unreachable is not a defect.** An entry that a recipe cannot reach at the level contributes nothing under that recipe, and it does not make the class unrankable (FR-26). `tracked:check` and `test:data` fail only for an entry that no recipe reaches at any offered level.
- **No shared floor.** The crafted entries on one Item Class can have different floors (FR-16, FR-22).
- **Curation (FR-22):** an Accepted Tier is one tier. Where a modifier's T1 first appears above 79, also track T2 as a separate entry. Where both affixes qualify, track all four T1/T2 pairings. A band that spans tiers still loads, but it is priced at its cheap end. The tool does not enforce this rule.
- **Adjacent tiers that share values (FR-29):** a band on one tier still counts that tier whole, and its rolls among the shared values are priced with the tier below. A band on the tiers it tracks avoids the partly-covered-tier understatement. The remaining error is accepted.
- **Pick-up filter (FR-36):** a drop qualifies at its Raw Base's own floor, whatever the level. The level changes only the EV that decides the purpose. A jewel kind qualifies at the lowest floor among the non-pruned crafted entries of its class. The rule for one base at two floors (Story 6.4) still holds.
- **Budgets:** a re-rank on a level switch fits NFR-6 on the committed (larger) Tracked List. The regenerated list must still refill within UJ-6's "over the following day". Equal inputs give an equal ranking and byte-identical filter text (NFR-3). No test makes a network call (NFR-1). `pnpm check` is green on each story.

## Technical Decisions

- **One value `L` per ranking (AD-17, AD-1, AD-4).** The Crafting Item Level enters `rank` and the purpose function only as a passed-in value, never as hidden state. Every summand of one `(itemClass, recipe, L)` is normalised against the same pool.
- **Eligible-pool order (AD-17):** scope to `L`, then apply the recipe floor to each modifier of each slot on its own, renormalise, exclude, renormalise. A modifier is one `modGroup` together with one set of stat ids. `modGroup` takes part only in exclusivity. The highest tier of a modifier is its best tier at or below `L`, also when that tier is below the floor. `modifierLevelMin = 0` uses the same code path. The predicate is `eligible` in `packages/core/src/probability.ts`.
- **Reach (AD-17):** `core` exposes one reach verdict per `(entry, recipe, L)`, and `pnpm tracked:lookup tiers`'s `reached` flag uses it. An augment with no eligible entry, or a slot with an empty pool, stays unrankable under its own reason.
- **Per-entry floor (AD-5).** No load check makes the crafted entries of one class share a floor.
- **A tier's own interval (AD-11).** A line's filter-comparable interval comes from `interval` (a two-`#` line uses the average of its two values, which the trade filter compares). Where a tier's interval begins inside the interval of another tier of the same line set in the class's slot pool whose `weight` is above 0, its own interval begins at the first value the line can take above the highest such maximum, so tier N never meets tier N-1. "Below" means lower in value, whatever the two tiers' levels. The slot pool is read unscoped, so the own interval is the same at every level and under every recipe. With no overlap, or if the own interval would be empty, it equals the interval. One exported function, `ownInterval` in `packages/core/src/probability.ts`, derives it. Containment and edge alignment both call it, with exact edges and no tolerance.
- **Containment (AD-11):** whole-tier, over the tier's own interval. A tier only partly covered adds nothing to the numerator and still counts in the denominator, and that is not an error. A hybrid reference contains a tier only when the line sets are equal and every line is covered against its own interval.
- **Edge alignment (AD-17):** a banded line's edges must be exactly the highest contained maximum and, as the lower edge, the lowest contained tier's own minimum or its interval minimum. A curator may write one tier's own interval, its interval, or a run of whole adjacent tiers. A band that contains one tier and clips another is rejected. Prefer a single tier. Two entries that differ only in T1's own interval and T2's interval do not overlap, and each counts at its own floor.
- **Cross-file check scope (AD-17).** The pool only gains tiers as the level rises, so each check runs at levels whose verdict holds at every offered level. No level is the player's `L`, because the `sync` gate runs with no `L`.
  - At the entry's own floor: the empty containment set and the co-rollable combination.
  - At the entry's own floor and at every offered level above it: edge alignment. A tier that enters above the floor can be contained by its own interval while its interval begins below the band.
  - At the highest offered level, or at a higher floor of the entry or pair: `coOccur` for every hybrid pair (same floor or not), line-set completeness and kind agreement.
  - Edge alignment is not a general bound on containment loss. The shapes that escape it are the accepted FR-29 residual.
- **Tracked List regeneration (AD-3, NFR-5):** a script derives every entry from `core`'s `needs` and the Weights File's tier ranges. No floor or band is typed by hand, and no app package writes `data/tracked.json`. Delete the replaced span entries (no prune tombstone), and name this exception in the commit message. Follow the `tracked-json` skill and *Parallel worktrees* in `AGENT-WORKFLOW.md`. Split entries get new canonical keys, which orphans their price history. That is acceptable, because the league reset wipes prices.
- **Persistence (AD-15):** the level persists in browser storage next to the recipe. A storage access that throws must leave the page working at the first-visit values (FR-7).

## UX & Interaction Patterns

- `{components.level-toggle}` is a segmented control with the segments `79` and `82`. It sits in the header after the recipe toggle and Craft Cost, and before the threshold control. It uses the tokens of `recipe-toggle`, without the `single`, `none` and `craftCost` variants. The header never grows a second line. Its strings come from the Copy Deck (*Header, list and tooltips*). Do not invent copy.
- **Interaction 1b:** the third ranking dial. It behaves as the recipe switch: a synchronous re-rank, with no network, no sync and no debounce. Ranks, EV, trust verdicts and Best combinations change together. Open panels stay open (state 48).
- **Expansion panel:** an entry whose floor is above the level, or that the active recipe cannot reach at the level, comes last behind `+ N not counted` (Interaction 3a, state 49: dimmed, price `—`, its reason in the trust cell). The panel resets when it closes. If both reasons hold, the floor reason shows. A class with nothing counted reads as a pending row with its own reason.
- **State 36 is retired, and its number is kept.** No path in `web` renders the recipe-unreachable reason.
- **First visit:** the `perfect` recipe when one is published, else the first published recipe, and ilvl `82`. The filter download uses the purposes at the level on screen (Interaction 9).
- Check the UI with the agent-browser skill in a named session. Colour alone must not carry a distinction (NFR-10).

## Cross-Story Dependencies

- Order: 7.1, 7.2, 7.5, 7.3, 7.4. Each story is green alone under `pnpm check`.
- 7.1 and 7.2 are done. Until 7.4, `web` passes the first-visit level (82) to `rank` and the purpose function.
- 7.5 lands after 7.2 and before 7.3. It changes `core` and the `tracked:lookup tiers` output (each tier's own interval printed beside its `ranges`). It changes no file under `data/`, no `contracts` schema and no UI. On the committed data, every cross-file result, reach verdict, rank and EV at both levels under every recipe must stay unchanged. If anything changes, the story stops and reports each change with its cause for the architect. A full ranking pass must stay within NFR-6 with the slot pool passed into containment.
- 7.3 is blocked without 7.5. Its split of `explicit.stat_3336890334` on Bows, Crossbows, Spears and Quarterstaves fails `empty-containment-set` today. 7.3 changes only `data/tracked.json`. Raw Bases stay unchanged. The report states the active crafted row count, read from the file, the time of a full refresh rotation against UJ-6 and the time of one ranking pass against NFR-6. If the rotation time misses UJ-6, the curator decides which rows to prune. The story prunes none.
- 7.4 is the only story the player sees. It builds on the header bar (Epic 4) and the filter modal (Epic 6). It also takes the not-counted marker and its ordering (state 49), the `nothing rolls at ilvl <level>` reason for a class with no counted entry, and the transcription of `level-toggle` and the revision 34 Copy Deck strings.
- This epic supersedes the shared-floor criteria of Stories 6.1 and 6.4 and the recipe-floor rule of Story 4.7. Those specs stay unedited as records.
