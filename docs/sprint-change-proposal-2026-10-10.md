# Sprint Change Proposal: the recipe floor per modifier group

- Date: 2026-10-10
- Scope: Moderate (one new story, backlog reorder, no PRD change)
- Mode: incremental, every edit proposal reviewed

## 1. Issue summary

AD-17 models the game's Minimum Modifier Level (`recipe.modifierLevelMin`: greater 44, perfect 70) as a cut of every tier below the floor. In the game the floor never removes a modifier type from the pool. The recipe floor values in `data/recipes.json` are correct. The rule is wrong.

Evidence:

- The in-game keyword text (poe2wiki *List of keywords*): "Added random Modifiers are at least this level or higher, except if a specific Modifier type would be excluded entirely from being able to roll."
- The poe2wiki pages for Perfect Orb of Transmutation, Greater Orb of Transmutation, Exalted Orb and Essence of the Abyss give the same exemption.
- A user check on the poe2db.tw crafting simulator: with perfect transmutation, T1 `#% increased Armour` (65), T1 base armour and T1 item rarity still roll.
- PoE forum thread 3863869 (a player report, no staff reply).
- The poe2db model: inside each `modGroup` of a slot, a group with a tier at or above the floor loses its tiers below the floor. A group whose absolute top tier is below the floor keeps that top tier only, at its own weight. Hybrids are their own groups. The survivors renormalise.

How the open questions were decided:

| Question | Decision |
|---|---|
| Unit of the rule | Each `modGroup` within a slot |
| Which tier survives | The group's absolute top tier (the poe2db model). The wiki's "respecting item level" reading is rejected |
| Weights | The survivors keep their own weights and renormalise |
| An entry that a recipe cannot reach | A curation defect. `pnpm tracked:check` catches it and the entry is pruned. Ranking keeps the pair-unrankable backstop |
| An item level below the recipe floor | Not possible: nothing is tracked below item level 70 |

## 2. Impact analysis

**Epics.**
- Epic 3 (done) delivered the wrong rule in Stories 3.2 and 3.4. Those stories are not reopened.
- Epic 4 (in progress) gets one new story, 4.7.
- No epic becomes obsolete.

**Artifacts.**

| Artifact | Impact |
|---|---|
| `prd.md` | None. FR-4 has no recipe reason, and the string stays in code (item-31 ruling). The promise at line 459 still holds |
| `ARCHITECTURE-SPINE.md` AD-17 | The recipe-floor paragraphs are rewritten. The one-axis predicate is deleted. AD-5 is unchanged |
| `epics.md` Story 3.4 | A superseded note is added. The body is unchanged |
| `EXPERIENCE.md` state 36 | The cause changes to backstop only |
| `AGENT-WORKFLOW.md` | One line about `tracked:check` `unreachable` is added |
| `.claude/skills/tracked-json/SKILL.md` | The floor rule is replaced by a citation of AD-17 (lines 20, 36, 58). Lines 11–12 and 40 become true |
| `data/weights.json`, weights schema, sync, web | None |

**Code.**
- `packages/core/src/probability.ts`: `eligible` and `canRecipeRoll` change.
- `packages/core/src/provenance.ts` follows `eligible`.
- `packages/core/src/index.ts` exports change.
- The `canRecipeRoll` caller in `lookup-mods.ts` uses the new verdict.
- `packages/sync/src/curation/check.ts` gets the `unreachable` list.
- Tests: `probability.test.ts`, `rank/crafted-branch.test.ts`, `rank/provenance.test.ts`, `provenance.test.ts`, `lookup.mods.test.ts`, `check.data.test.ts`.

**Data.**
- `data/tracked.json` has 104 entries pruned as below the recipe floor: Amulets 56, Helmets_str 21, Crossbows 12, Sceptres 8, Bows 7. Many are probably reachable under the corrected rule.

## 3. Recommended approach

Direct adjustment: one corrective story, then a re-check of the pruned entries.

- Rollback was rejected: Stories 3.2 and 3.4 hold much correct work around the rule.
- An MVP review is not needed: no scope changes.
- Effort is medium and risk is low. The change sits in one `core` function and its tooling callers.

## 4. Detailed change proposals

### 4.1 ARCHITECTURE-SPINE.md, AD-17 (approved)

Replace the recipe-floor paragraphs (currently lines 1299–1330) with:

> **A recipe restricts the pool from below, one modifier group at a time, and that is its whole distribution term.** A `CraftRecipe` declares a **`modifierLevelMin`** — the game's *Minimum Modifier Level*, which a greater or perfect orb imposes and a plain orb does not. After AD-5's scope, `core` takes each `modGroup` of each slot on its own. **Where the group has a tier at or above the floor, its tiers below the floor are removed. Where the group's highest tier is below the floor, that tier alone survives at its own weight**, because the floor never removes a modifier type entirely. `core` then renormalises the surviving weights, before AD-11's containment and this AD's probability term run. The transform is a truncation and a renormalisation; it is never a reweighting, and `core` invents no numbers. The predicate is `eligible` in `packages/core/src/probability.ts`, binding under AD-0.
>
> **The highest tier is the group's highest tier in the unscoped pool, not the highest the item level allows.** A group whose top tier is above the entry's item level, and whose other tiers are below the floor, contributes nothing under that recipe.
>
> **An entry that a recipe cannot reach is a curation defect, not a ranking input.** `core` exposes the reach verdict for each `(entry, recipe)` pair. `pnpm tracked:check` fails while any entry is unreachable under any recipe in `data/recipes.json` (`AGENT-WORKFLOW.md`). Ranking keeps the backstop: an unreachable entry makes its `(itemClass, recipe)` pair unrankable.
>
> **Ordering is therefore recipe-dependent**, and the cross product AD-3 ranks is a real cross product rather than one distribution repeated at different cost offsets. The floors themselves are recipe **data** and live in `data/recipes.json`, never in this document, so adding a recipe stays the data edit AD-3 promises.

The following go:
- the one-axis paragraph;
- the empty-surviving-pool paragraph;
- the `[ASSUMPTION]` paragraph.

### 4.2 docs/epics.md (approved)

- Story 3.4: the body is unchanged. Under its heading, add: *Superseded for the recipe floor by Story 4.7 (AD-17).*
- Add Story 4.7 to Epic 4, with the acceptance criteria in section 5.

### 4.3 EXPERIENCE.md, state 36 (approved)

In the third column, replace "AD-17 truncates the Eligible Pool below a recipe's `modifierLevelMin`. An empty surviving pool makes that pair unrankable." with:

> AD-17 makes that pair unrankable only when a tracked entry of the class cannot be reached under that recipe. `pnpm tracked:check` rejects such an entry, so this state is a backstop.

The rest of the row is unchanged.

### 4.4 AGENT-WORKFLOW.md and the tracked-json skill (approved)

- `AGENT-WORKFLOW.md`, in the `tracked:check` rules, add: "`pnpm tracked:check` reports each `(entry, recipe)` pair that AD-17 makes unreachable under `unreachable`, and exits non-zero while that list is non-empty. `pnpm test:data` fails on the same list."
- `SKILL.md`: at lines 20, 36 and 58, replace the one-axis floor rule with "the recipe floor follows AD-17".

### 4.5 PRD

No edit. No capability, promise, scope boundary or OQ owner changes.

## 5. Implementation handoff

**Story 4.7: The recipe floor per modifier group.** Epic 4, `backlog`. Developer agent.

Acceptance criteria:

- Given a `modGroup` in a slot of the scoped pool, when `core` applies the recipe floor:
  - it removes the group's tiers below `modifierLevelMin` if the group has a tier at or above the floor;
  - otherwise it keeps only the group's absolute top tier, at its own weight;
  - it never removes a whole group because of the floor (AD-17).
- A hybrid `modGroup` is its own group. Groups that share a `statId` are not merged.
- Scope runs first, then the floor, then renormalisation. All of these run before containment, and coverage is read on the unrestricted pool (AD-17, AD-27).
- A `modifierLevelMin` of `0` changes nothing, through the same code path.
- `core` exposes a reach verdict for each `(entry, recipe)` pair, which replaces `canRecipeRoll`.
- `pnpm tracked:check` lists `unreachable` pairs and exits non-zero while any exist. `pnpm test:data` fails on the same list.
- The `reached` flag of `pnpm tracked:lookup tiers` uses the new verdict.
- Ranking keeps the backstop: an unreachable entry makes its `(itemClass, recipe)` pair unrankable.
- The docs edits in section 4 land in the first commit of the branch. The commit message carries the decision and the rejected alternatives:
  - the item-level reading of the wiki;
  - an unreachable entry counting as `P = 0`;
  - a separate unrankable reason for an item level below the floor.
- `pnpm check` passes. Any entry that is now unreachable is pruned with the tracked-json skill to keep `test:data` green.

**Order:**

1. Story 4.7, next, ahead of 4.4–4.6. Every perfect-recipe ranking is wrong until it lands, and it touches no UI file of those stories.
2. Re-check the 104 pruned `tracked.json` entries with the tracked-json skill, and restore the ones that are reachable.
3. Stories 4.4, 4.5 and 4.6, unchanged.

**`sprint-status.yaml`:** add `4-7-the-recipe-floor-per-modifier-group: backlog` under `epic-4`.

**Success criteria:**
- the perfect-recipe probabilities match the per-group rule on a fixture with:
  - a group that has a tier at or above the floor;
  - a group whose top tier is below the floor;
  - a group whose top tier is above the item level;
- no class is unrankable through the floor while `tracked:check` is clean;
- the pruned entries are re-checked.
