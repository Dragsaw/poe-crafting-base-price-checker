---
title: 'Epic 3 retro item 29: give a rankable crafted class with no recipe a reason'
type: 'bugfix'
created: '2026-10-03'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** With `recipes.json` absent or `[]`, a rankable crafted class yields no row and no unrankable entry, so it is in neither the list nor the appendix (retro D3, `rank.ts`).

**Approach:** Human decision, 2026-10-03: reuse the existing `recipe cannot reach this class` reason (`RECIPE_UNREACHABLE`). When there is no recipe, `rank` emits one unrankable entry per rankable crafted class with that reason and no `recipeId`. No PRD, spine or UX edit. Appendix and `active-ranking.ts` already show a recipe-less entry under every recipe.

</frozen-after-approval>

## Implementation Notes

- `packages/core/src/rank.ts` -- in the rankable-class loop, when `recipes` is empty, set the unrankable entry (`categoryId`, `className`, `RECIPE_UNREACHABLE`, no `recipeId`); update the `UnrankableClass.recipeId` and `RECIPE_UNREACHABLE` doc comments.
- `packages/core/src/rank.test.ts` -- replace "ranks no crafted row when there is no recipe" with the new expectation; cover absent `recipes` too.
- The string is provisional and, with no recipe tried, a loose fit. The PRD/UX owners may reword it later (3.4 Decision).
- `packages/web/src/App.test.tsx` -- the cross-file test serves no recipe, so its rankable Amulets class now shows in the appendix; assertion updated.
- Six existing `rank.test.ts` cases that call `ranked` with no recipe now also expect the no-recipe entry.
- `pnpm test` (1676) and `pnpm check` pass. Review layers skipped: the diff is small and carves nothing out.
