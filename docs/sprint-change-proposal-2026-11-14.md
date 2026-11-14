---
title: Sprint Change Proposal — League-start crafting levels
date: 2026-11-14
status: approved
mode: incremental
scope: moderate
---

# Sprint Change Proposal — League-start crafting levels

## 1. Issue summary

The next PoE2 league starts on 2026-12-11. At league start, ilvl 79 bases are easy to get (T15 maps). ilvl 82 bases are rare: they need T16 maps that are both irradiated and have abyssal depths. Almost every T1 modifier tier starts at ilvl 81 or 82, and every T2 tier starts at ilvl 75 or lower. So the curated crafted entries declare floor 82 (or 81), and AD-17 forces one shared floor on every crafted entry of an Item Class. The ranking therefore values every crafted class for ilvl 82 bases, which the player does not have at league start.

The analysis also found a defect in the recipe floor (AD-17, Story 4.7). The tool applies the floor of a greater or perfect orb before the item-level scope, and per `modGroup`. In the game, a perfect orb never removes a modifier from the pool. The player confirmed in game that an ilvl 79 wand under a perfect orb can roll +4 to Level of all Cold Spell Skills (T2, ilvl 55). The tool says it cannot. This error changes today's perfect-recipe EVs for the floor-81 classes (Wands, Staves, Talismans, Belts) and the floor-75 jewels.

**Type:** new requirement from the player, plus a misreading of a game rule.

**Evidence** (measured with `core`'s own `needs`, `recipeReach`, `floored` and `eligible` against `data/tracked.json` and `data/weights.json` on 2026-11-14):

| Fact | Value |
|---|---|
| Active crafted entries | 2,096 on 40 Item Classes |
| Entries with an affix that needs ilvl 80+ | 991 on 38 classes |
| …of which every such affix is a T1–T2 span | 478 |
| …of which some such affix is T1 only | 513 |
| Existing spans that do not contain a T1 at ilvl 80+ | 0 |
| T2 rows that perfect cannot reach (current rule, ilvl 79 and 82) | 414 |
| T2 rows that perfect cannot reach (scope first, per modifier) | 0 at ilvl 79; 414 at ilvl 82, which the game confirms |
| Crafted rows after the change | 3,373 (+1,277) |

Example tier ladders: fire resistance T1 82, T2 71; chaos resistance T1 81, T2 68; movement speed T1 82, T2 65; maximum ES (amulet) T1 80, T2 70; physical damage % (bow) T1 82, T2 75.

## 2. Impact analysis

### Epic impact

Epics 1 to 6 are done, and no story in progress is blocked. The change is a new Epic 7. Story 4.7 (done) built the recipe floor that Story 7.1 corrects. Story 6.4 (done) keeps its two-floor rule, because Raw Base floors do not change.

### Artifact conflicts

| Artifact | Sections |
|---|---|
| `prd.md` | Glossary (Item Level Floor, Crafting Item Level, Accepted Tier, Eligible Pool); FR-1; FR-16; FR-22; FR-26; FR-29; FR-36; new FR-38; §7.1; frontmatter |
| `ARCHITECTURE-SPINE.md` | AD-5; AD-17 (shared floor, scope, assumption, edge alignment, cross-file checks, recipe floor, highest tier, reach); Consistency Conventions *Item level*; Core entities; Deferred *`itemLevelMin` as a ranking key* |
| `AGENT-WORKFLOW.md` | the `tracked:check` unreachable rule |
| `.claude/skills/tracked-json/SKILL.md` | the floor rule, recipe reach, the shared floor, T2 siblings |
| `EXPERIENCE.md` | Information Architecture; Component Patterns; Copy Deck; Interaction 1b; states 36 and 48; *What survives a reload*; the expansion panel |
| `DESIGN.md` | header layout; `level-toggle` |
| `epics.md`, `sprint-status.yaml` | FR-38 in the inventory and the coverage map; Epic 7 and its four stories |

`WEIGHTS-FILE-SCHEMA.md` does not change.

### Technical impact

- `core`: `floored` and `eligible` (scope first, then the floor per modifier); `recipeReach` per `(entry, recipe, L)`; the shared-floor cross-file check is removed; `rank` and the pick-up purpose take `L`.
- `web`: a new header control, persisted, with first-visit defaults.
- `data/tracked.json`: regenerated with a script that uses `core`. The split changes canonical keys, so the price history of the changed entries is orphaned. The 2026-12-11 reset wipes prices anyway.
- Sync budget: a full refresh at about 800 searches per run and 6 runs per day goes from about 11 h to about 17.5 h. That is still inside UJ-6's "refills over the following day".

## 3. Recommended approach

**Direct adjustment:** a new Epic 7 of four stories. Rollback is not needed: Story 4.7's code is corrected, not removed. MVP review is not needed: scope grows by one control and the T2 rows, and nothing is cut.

- **Effort:** medium. **Risk:** medium, from the 2026-12-11 deadline and the 61% larger Tracked List.
- **Timeline:** the four stories land before 2026-12-11. Story 7.1 can land first on its own, because it fixes today's perfect-recipe EVs.

## 4. Detailed change proposals

Each proposal below was approved in incremental mode on 2026-11-14.

### P1. PRD Glossary

- **Item Level Floor**, NEW: the lowest item level at which a Tracked Entry's outcome can roll, declared per entry by the curator from its Accepted Tier (FR-22). A crafted entry counts toward its Item Class's EV only when its floor is at or below the Crafting Item Level (FR-38). A Raw Base's floor scopes its price (FR-3).
- **Crafting Item Level**, new entry after *Item Level Floor*: the item level the player crafts at, chosen in the view. It scopes the Eligible Pool of every crafted EV and decides which crafted entries count (FR-38, AD-17).
- **Accepted Tier**: "the tier or run of adjacent tiers worth chasing … such as `T1` or `T1–T2`" becomes "the one tier worth chasing … such as `T1` or `T2`". The rest is unchanged.
- **Eligible Pool**: "scoped to a Tracked Entry's Item Level Floor" becomes "scoped to the Crafting Item Level".

### P2. PRD FR-22

- Intro: "declares the item level that scopes the modifiers it can roll" becomes "declares the lowest item level at which its outcome can roll".
- Consequence 1, NEW: The Accepted Tier of a modifier is one tier. Where a modifier's tier 1 first appears above the lower Crafting Item Level, the curator tracks tier 1 and tier 2 as separate entries, so that the Combination still ranks at the lower level *(PRD-owned)* (FR-38).
- Consequence 2, NEW: Where both affixes have such a tier 1, the curator tracks all four pairings of tier 1 and tier 2 *(PRD-owned)*.
- Consequence 3, NEW: A band covers one tier. This is a curation rule, not a check: the tool does not enforce it *(PRD-owned)*.
- Shared-floor consequence, NEW: Each entry's floor is the item level its bands need, so the crafted entries on one Item Class can have different floors (AD-5, AD-17). A Raw Base's floor scopes its price (FR-3).
- Span consequence, NEW: A band that spans tiers still loads. The tool prices it at its cheap end, it counts only at or above the floor of its highest tier, and below the Payout Threshold it can zero a jackpot (AD-17).
- The hybrid, one-act and display-only-label consequences are unchanged.

### P3. PRD FR-1, FR-16, FR-26

- FR-1, the probability half of the price bullet, NEW: The probability of the Combination is scoped to the Crafting Item Level, because the level the player crafts at sets what can roll. A Combination whose Item Level Floor is above the Crafting Item Level contributes nothing to the sum — not zero, nothing (AD-17, FR-22, FR-38).
- FR-16: the bullet "The crafted entries on one Item Class share one Item Level Floor; a Raw Base is exempt (AD-17, FR-22)." is removed.
- FR-26, two new bullets after "A Craft Recipe changes which outcomes are reachable …":
  - A greater or perfect orb never removes a modifier from the pool. Where every tier of a modifier that can roll at the Crafting Item Level is below the orb's minimum modifier level, the best of those tiers can still roll. "Modifier" here means one modifier, not the family it shares with others *(PRD-owned)*.
  - An outcome that a recipe cannot reach at the Crafting Item Level contributes nothing under that recipe, and it is not a curation defect (AD-17).

### P4. PRD FR-36

The second bullet, NEW: A drop qualifies at or above its Raw Base's own Item Level Floor. The Crafting Item Level does not change which drops qualify. It changes only the EV that decides a drop's purpose, as it changes the ranking (FR-38, FR-1). A jewel kind qualifies at the lowest Item Level Floor among the non-pruned crafted entries of its Item Class *(PRD-owned)*.

### P5. PRD FR-38, FR-29, §7.1, frontmatter

New §4.12 *The Crafting Item Level*:

> #### FR-38: Choose the Crafting Item Level
>
> The player chooses the item level he crafts at, and the crafted ranking follows it. Realises UJ-1 and UJ-6.
>
> **Consequences (testable):**
> - The player chooses between two levels: 79, the league-start level that the last-but-one map tier gives, and 82, the endgame level *(PRD-owned)*.
> - The Crafting Item Level scopes the Eligible Pool of every crafted EV. A crafted entry counts only when its Item Level Floor is at or below the Crafting Item Level (FR-1, FR-22, AD-17).
> - Changing the level reorders the list without a sync, as the Payout Threshold and the Craft Recipe do (AD-4).
> - A Raw Base is unaffected. Its price stays scoped to its own floor (FR-3).
> - An Item Class with no entry that counts at the chosen level is treated as one with no priced Combination (FR-1).
> - The level does not change which drops the Pick-up Filter names, only the EV behind their purpose (FR-36).

- FR-29: in the title and the intro, "scoped to the entry's floor" / "scoped to the Tracked Entry's Item Level Floor" becomes "scoped to the Crafting Item Level".
- §7.1, first bullet: add ", and ranked at the Crafting Item Level the player chooses (FR-38)" after "derived by the Accepted Tier rule (FR-22)".
- Frontmatter: `revision: 38`, `updated: 2026-11-14`, and add this proposal to `sources:`.

### P6. Spine AD-5 and AD-17, the floor

- AD-5, the conformance paragraph: drop "and floors that disagree across one base by AD-17's shared-floor check". The last sentence becomes "… it decides whether the entry counts at the player's Crafting Item Level (AD-17)."
- AD-17, the shared-floor paragraph, NEW: **The scope of every crafted `EV` is the player's Crafting Item Level `L`, one value per ranking (`prd.md` FR-38).** `EV` is an expectation over one crafting act on one item population, so every summand of one `(itemClass, recipe, L)` is normalised against the same pool. A crafted entry with `itemLevelMin > L` is not a summand. A raw entry takes no part: its `itemLevelMin` scopes only its price search (AD-16).
- AD-17, the probability formula: `L = entry.itemLevelMin` becomes `L` = the Crafting Item Level.
- AD-17 *[ASSUMPTION]*: "at exactly the entry's floor" becomes "at exactly `L`".
- AD-17, edge alignment, NEW: Edge alignment is evaluated at the entry's own `itemLevelMin`, which is independent of `L`, so the check gives one verdict whatever level the player chooses.
- AD-17, cross-file checks table: the shared-floor row is removed.
- Consistency Conventions, *Item level*: "uniform across an item class's crafted tracked entries (AD-17)" becomes "a declared floor per tracked entry (AD-5); the crafted scope is the Crafting Item Level (AD-17)".
- Core entities: the clause "`ItemClass` shares that class's `itemLevelMin` (AD-17)" is removed.
- Deferred: "`itemLevelMin` as a ranking key" is removed as resolved. `L` is a view parameter, so rows do not multiply.

### P7. Spine AD-17, the recipe floor and reach

- The recipe floor, NEW: After the scope to `L`, `core` takes each **modifier** of each slot of the scoped pool on its own. A modifier is one `modGroup` together with one set of stat ids. Where the modifier has a tier at or above the floor, its tiers below the floor are removed. Where its highest tier in the scoped pool is below the floor, that tier alone survives at its own weight, because the floor never removes a modifier (`prd.md` FR-26). `core` then renormalises. The `modGroup` keeps its role in the exclusivity rule and plays no part in the floor.
- The highest tier, NEW: The highest tier is the modifier's highest tier that can roll at `L`. A modifier whose top tier is above `L` keeps its best tier at or below `L`, even when that tier is below the floor.
- Reach, NEW: `core` exposes the reach verdict for each `(entry, recipe, L)`. An entry that a recipe cannot reach at `L` is not a summand of that `(itemClass, recipe, L)`, and it is neither a defect nor a reason for unrankability (`prd.md` FR-26). `pnpm tracked:check` fails only for an entry that no recipe reaches at any offered `L`, because such an entry can never count.
- The formula order note: "scope to `L`, then the floor per modifier, renormalise, exclude, renormalise".

### P8. AGENT-WORKFLOW.md and the `tracked-json` skill

- `AGENT-WORKFLOW.md` §107: `tracked:check` lists under `unreachable` each crafted entry that AD-17 makes unreachable under every recipe at every offered Crafting Item Level, and exits non-zero while that list is non-empty. `pnpm test:data` fails on the same list. An entry that only some `(recipe, L)` pairs reach is not listed.
- `SKILL.md`:
  - line 12: the same `unreachable` rule; the `RECIPE_UNREACHABLE` backstop sentence is removed.
  - line 19: "The Accepted Tier rule and the band rule are FR-22; the per-entry floor is AD-5."
  - *The floor rule*: an entry's floor is the higher of its two `needs`. There is no class floor.
  - Step 4b: refuse only a pick that no recipe reaches at any offered level. Name a pick that only some do, and write it.
  - Step 5: write the entry's own floor; the other entries keep theirs.
  - Line 47: removed.
  - Seed flow step 6: show each entry's own floor.
  - New step: for a T1 above the lower Crafting Item Level, draft the T2 sibling too, and all four T1/T2 pairings when both affixes qualify (FR-22).

### P9. UX

`EXPERIENCE.md`:
- Information Architecture, header bar: `{components.level-toggle}` after the recipe toggle and Craft Cost, before `{components.threshold-control}`.
- Component Patterns: `{components.level-toggle}` · Header bar · Interaction 1b; state 48; *What survives a reload*.
- Copy Deck, header: Item level · `ilvl` · segments `79` and `82`.
- Interaction 1b, *Switch the Crafting Item Level*: the third ranking dial (FR-38). It behaves as 1a: a synchronous re-rank with no network, no sync and no debounce; ranks, EV figures, trust verdicts and Best combinations change together; a Raw Base keeps its price; open panels stay open.
- State 48, *Crafting Item Level switched*: whole list + `{components.level-toggle}`; Interaction 1b; a row's ≈ swaps silently when the new pair differs.
- State 36: retired, and its number kept.
- *What survives a reload*: add the Crafting Item Level. A first visit shows the recipe whose option word is `perfect` when one is published, otherwise the first published recipe, and item level `82`.
- Expansion panel: entries whose floor is above the level, or that the active recipe cannot reach at that level, come last behind `+ N not counted`. It works like `+ N pruned` and is not remembered across reloads.

`DESIGN.md`:
- Header layout: `{components.level-toggle}` after `{components.recipe-toggle}`.
- `level-toggle`: the same tokens as `recipe-toggle`, without the `single`, `none` and `craftCost` variants.

### P10. Epics

- `epics.md`: FR-38 in the requirements inventory. The FR coverage map gets "FR-38: Epic 7" and the note "Epic 7 changes the probability scope behind FR-1, FR-22, FR-26, FR-29 and FR-36. Their owning epics keep them."
- **Epic 7: League-start crafting levels.**
  - FRs covered: FR-38. Changes: FR-1, FR-16, FR-22, FR-26, FR-29, FR-36.
  - Depends on Epics 3, 4 and 6. Standalone. Deadline 2026-12-11.
  - Order: 7.1, then 7.2, then 7.3, then 7.4.
- Stories:
  - **7.1 The recipe floor per modifier, after the level scope.** `core` scopes, then floors per modifier (`modGroup` + stat-id set). A fixture covers the +4 Cold Spell Skills case at ilvl 79 under perfect. Reach is per `(entry, recipe, L)`. `tracked:check` lists only entries that nothing reaches at any offered level. The `RECIPE_UNREACHABLE` backstop and state 36 are removed. The `tracked-json` skill follows P8.
  - **7.2 Per-entry floors and the Crafting Item Level in `core`.** The shared-floor check is removed. `rank` takes `L`, and entries above `L` are not summands. Edge alignment runs at the entry's own floor. The pick-up purpose uses EV at the current `L`, and a jewel kind qualifies at its lowest crafted floor. The golden filter text is byte-identical for today's data at `L = 82`.
  - **7.3 Regenerate `tracked.json` for T1 and T2.** Split the spans, add the T2 siblings, keep all four pairings, and give each entry its own floor. About 3,373 crafted rows, written by a script over `core`'s `needs` and the tier ranges. `tracked:check` exits 0. The report states the row count and the full-rotation time against UJ-6.
  - **7.4 The item-level toggle.** `{components.level-toggle}`, Interaction 1b, state 48, `+ N not counted`, and persistence with the first-visit defaults perfect and 82.
- `sprint-status.yaml`: `epic-7: backlog` and the four story keys as `backlog`.

## 5. Implementation handoff

**Scope: moderate.** One new epic, and owner-document edits across the PRD, the spine and UX. No replan.

| Role | Responsibility |
|---|---|
| Developer agent (`bmad-build`) | Stories 7.1 to 7.4 in order; `pnpm check` green on each |
| Curator (player) | Review the 7.3 regeneration report; prune low-value rows if the refresh time misses UJ-6 |
| Player | Confirm the in-game behaviour behind P7 again after any patch before 2026-12-11 |

**Commits.** One commit holds this proposal, `epics.md` and `sprint-status.yaml` (`AGENT-WORKFLOW.md`, *A change to the stories of an epic*). The PRD, spine, workflow, skill and UX edits can follow in a later commit.

**Success criteria:**
- At ilvl 79 under perfect, the +4 Cold Spell Skills T2 row is reachable, and `tracked:check` exits 0 on the regenerated list.
- Switching between 79 and 82 re-ranks the list without a sync. At 79, no entry with a floor above 79 counts.
- The pick-up filter text is unchanged for today's data at 82.
- Everything lands before 2026-12-11.

**Out of scope.** Each of the last 12 sync reports (since 2026-11-12) logs trade-search 405 responses and a refused dataset write, `currencyRates.3.rate: Too small: expected number to be >0` (`greater-orb-of-transmutation`). `dataset.json` is still committed every four hours, so these are partial chunk failures. The cause is not investigated here.
