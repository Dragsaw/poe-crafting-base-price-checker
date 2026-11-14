# Epic 7 Context: League-start crafting levels

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The player chooses the item level he crafts at (79 or 82), and the crafted ranking follows it. At league start, ilvl 79 bases are easy to get and ilvl 82 bases are rare. Almost every T1 modifier tier needs ilvl 81 or 82. Today every crafted class is valued for ilvl 82 bases, so the ranking is wrong for the bases the player holds at league start. The epic also fixes a game-rule defect: a greater or perfect orb never removes a modifier from the pool. The current recipe floor (Story 4.7) applies the floor before the level scope and per `modGroup`, and that makes perfect-recipe EVs wrong. The epic adds one header control. It changes no sync behaviour and no artifact schema. **Deadline: all four stories land before the league start on 2026-12-11.**

## Stories

- Story 7.1: The recipe floor per modifier, after the level scope
- Story 7.2: Per-entry floors and the Crafting Item Level in `core`
- Story 7.3: Regenerate `tracked.json` for T1 and T2
- Story 7.4: The item-level toggle

## Requirements & Constraints

- **Two offered levels:** 79 (league start) and 82 (endgame). Define them in one place in the code. `rank`, its callers and `tracked:check` all read that place (FR-38).
- **The level scopes every crafted EV.** A crafted entry whose Item Level Floor is above the level is not a summand: it contributes nothing, not zero. An Item Class with no entry that counts at the level is treated as one with no priced Combination (FR-1, FR-38).
- **Raw Bases are unaffected.** A Raw Base's price stays scoped to its own floor at either level (FR-3).
- **The recipe floor never removes a modifier.** If every tier of a modifier that can roll at the level is below the orb's minimum modifier level, the best of those tiers still rolls at its own weight. A "modifier" is one modifier, not its `modGroup` family (FR-26). The confirmed in-game case: an ilvl 79 wand under perfect can roll T2 `+# to Level of all Cold Spell Skills`. At ilvl 82, perfect cannot roll it.
- **Unreachable is not a defect.** An entry that a recipe cannot reach at the level contributes nothing under that recipe. It is not a curation defect, and it does not make the class unrankable (FR-26). `tracked:check` and `test:data` fail only for an entry that no recipe reaches at any offered level.
- **No shared floor.** The crafted entries on one Item Class can have different floors (FR-16, FR-22).
- **Curation (FR-22):** an Accepted Tier is one tier. Where a modifier's T1 first appears above 79, also track T2 as a separate entry. Where both affixes qualify, track all four T1/T2 pairings. A band that spans tiers still loads, but it is priced at its cheap end. This rule is for curation only. The tool does not enforce it.
- **Pick-up filter (FR-36):** a drop qualifies at its Raw Base's own floor, whatever the level. The level changes only the EV that decides the purpose. A jewel kind qualifies at the lowest floor among the non-pruned crafted entries of its class. The rule for one base at two floors (Story 6.4) still holds.
- **Budgets:** a re-rank on a level switch fits NFR-6 on the committed (larger) Tracked List. The regenerated list must still refill within UJ-6's "over the following day". Equal inputs give an equal ranking and byte-identical filter text (NFR-3). No test makes a network call (NFR-1). `pnpm check` is green on each story.

## Technical Decisions

- **One value `L` per ranking (AD-17, AD-1, AD-4).** The Crafting Item Level enters `rank` and the purpose function only as a passed-in value, never as hidden state. Every summand of one `(itemClass, recipe, L)` is normalised against the same pool.
- **Eligible-pool order (AD-17):** scope to `L` first. Then apply the recipe floor to each modifier of each slot on its own. Then renormalise, exclude and renormalise again. A modifier is one `modGroup` together with one set of stat ids, so two modifiers in one `modGroup` are floored apart. `modGroup` takes part only in exclusivity. The highest tier of a modifier is its best tier at or below `L`, also when that tier is below the floor. `modifierLevelMin = 0` uses the same code path and changes nothing.
- **Reach (AD-17):** `core` exposes one reach verdict per `(entry, recipe, L)`. The `reached` flag of `pnpm tracked:lookup tiers` uses the same verdict. Remove the unreachable-entry cause from `RECIPE_UNREACHABLE` in `packages/core/src/rank.ts`. An augment with no eligible entry, or a slot with an empty pool, stays unrankable under its own reason.
- **Per-entry floor (AD-5).** Remove the shared-floor load check in `packages/contracts/src/envelopes/tracked-file-checks.ts`.
- **Cross-file check scope (AD-17).** The pool only gains tiers as the level rises. So each check runs at one fixed level, and its verdict holds at every offered level. Neither level is the player's `L`: the `sync` gate runs with no `L`.
  - At the entry's own floor: edge alignment, the empty containment set and the co-rollable combination. A wider pool cannot undo a pass of theirs.
  - At the highest offered level, or at a higher floor of the entry or pair: `coOccur` for every hybrid pair (same floor or not), line-set completeness and kind agreement. Each one searches the pool for a violating tier. This stops two hybrid entries below 82 that co-occur only on a tier above their floor from passing the gate and double-counting in `rank` at 82.
  - Edge alignment is not a general bound on containment loss. A band that clips an uncontained, overlapping tier escapes it at any scope. This is the accepted FR-29 residual.
- **Tracked List regeneration (AD-3, NFR-5):** a script derives every entry from `core`'s `needs` and the Weights File's tier ranges. No floor or band is typed by hand, and no app package writes `data/tracked.json`. An entry's floor is the higher of its two `needs`. Delete the replaced span entries (no prune tombstone), and name this exception in the commit message. Follow the `tracked-json` skill and *Parallel worktrees* in `AGENT-WORKFLOW.md`. Split entries get new canonical keys, which orphans their price history. That is acceptable, because the league reset wipes prices.
- **Persistence (AD-15):** the level persists in browser storage next to the recipe. A storage access that throws must leave the page working at the first-visit values (FR-7).

## UX & Interaction Patterns

- `{components.level-toggle}` is a segmented control with the segments `79` and `82`. It sits in the header after the recipe toggle and Craft Cost, and before the threshold control. It uses the tokens of `recipe-toggle`, without the `single`, `none` and `craftCost` variants. The header never grows a second line. Its strings come from the Copy Deck (*Header, list and tooltips*). Do not invent copy.
- **Interaction 1b:** the third ranking dial. It behaves as the recipe switch: a synchronous re-rank, with no network, no sync and no debounce. Ranks, EV, trust verdicts and Best combinations change together. Open panels stay open (state 48).
- **Expansion panel:** an entry whose floor is above the level, or that the active recipe cannot reach at the level, comes last behind `+ N not counted` (Interaction 3a, state 49: dimmed, price `—`, its reason in the trust cell). The panel resets when it closes. If both reasons hold, the floor reason shows. A class with nothing counted reads as a pending row with its own reason.
- **State 36 is retired, and its number is kept.** No path in `web` renders the recipe-unreachable reason.
- **First visit:** the `perfect` recipe when one is published, else the first published recipe, and ilvl `82`. The filter download uses the purposes at the level on screen (Interaction 9).
- Check the UI with the agent-browser skill in a named session. Colour alone must not carry a distinction (NFR-10).

## Cross-Story Dependencies

- Do the stories strictly in order: 7.1, 7.2, 7.3, 7.4. Each story is green alone.
- 7.1 can land alone, because it corrects the perfect-recipe EVs at once. Until 7.2, `rank` passes each entry's own floor as `L`.
- 7.2 lands its `contracts` change alone and first, and the `core` work rebases onto it. Until 7.4, `web` passes the first-visit level (82). The golden filter text may change only in the blocks for Item Classes whose crafted floors are below 82. The report lists each changed block with its cause, and the story updates the golden text in the same change.
- 7.3 changes only `data/tracked.json`. It is the first story that adds entries with floors below 82, so it relies on the AD-17 cross-file scope above being in force in `core`. Raw Bases stay unchanged. The report states the active crafted row count, read from the file, the time of a full refresh rotation against UJ-6 and the time of one ranking pass against NFR-6. If the rotation time misses UJ-6, the curator decides which rows to prune. The story prunes none.
- 7.4 is the only story the player sees. It builds on the header bar (Epic 4) and the filter modal (Epic 6). It also takes the open work that 7.1 left for later: the not-counted marker and its ordering (state 49), the `nothing rolls at ilvl <level>` reason for a class with no counted entry, and the transcription of `level-toggle` and the revision 34 Copy Deck strings.
- This epic supersedes the shared-floor criteria of Stories 6.1 and 6.4 and the recipe-floor rule of Story 4.7. Those specs stay unedited as records.
