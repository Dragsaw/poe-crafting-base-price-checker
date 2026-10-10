---
title: 'Epic 4 retro item 2: state 23 reads the verdict; recipeless combinations in trust order'
type: 'bugfix'
created: '2026-10-10'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** (R2) State 23 drops "yet" only when no crafted, recipeless, no-listings or not-yet-synced row remains, so a crafted row whose combinations are all broken (verdict `broken`, reason `all-broken`) keeps "yet" and promises a refill that never comes; EXPERIENCE.md's Copy Deck says "without `yet` when every listed row is broken". (R3) A recipeless class lists its combinations in canonical key order, not priced → pending → broken as crafted rows do, so priced lines can hide behind "+ N more" in the top-8 panel.

**Approach:** In `packages/web/src/list/list-statement.ts`, decide "no yet" from the trust verdict of every listed row (`ordering`, `noListings`, `notYetSynced`, `unresolvable`, `recipeless`): all `broken` drops "yet"; pending rows (recipeless, uncostable, no-prices) keep it. In `packages/core/src/rank.ts`, sort recipeless combinations with the same comparator crafted rows use (`compareCombinations`/`COMBINATION_GROUP` in `rank-crafted-row.ts`), and correct the `RecipelessClass.combinations` JSDoc. Tests: an all-broken crafted row from the real `rank()` drops "yet" (and an uncostable one keeps it); a recipeless class with a priced entry keyed after a broken one lists the priced line first. Both packages, one branch, both kept by the human on 2026-10-10.

</frozen-after-approval>

## Implementation Notes

- `packages/web/src/list/list-statement.ts`: `isEveryRowBroken` reads `trust.verdict` across the five listed groups; `honestEmptyCopy`'s flag renamed `isNeverPriced` (no-shadow).
- `packages/core/src/rank.ts`: recipeless combinations sort with `compareCombinations`, now exported from `rank-crafted-row.ts` (module-internal, not in `index.ts`).
- Tests: `core/src/rank/recipeless.test.ts` (new order test whose fixture keys sort canonically in reverse trust order; the first test now expects trust order); `web/src/recipe/craft-recipe/crafted-states.test.tsx` (real `rank()` through the App: costable greater drops "yet", uncostable perfect keeps it).
- Surprise: Serena's `replace_content` wrote CRLF, and `display-rows.test.ts`'s source scan of `summands` uses then saw a trailing `\r`. Normalised to LF.
- Review fixes: `compareCombinations` JSDoc reads "priced (current or rough)" and cites EXPERIENCE.md *The expansion*; `RecipelessClass.combinations` cites `compareCombinations` instead of restating it; two unit cases in `list-statement.test.ts`; retro item 2 closed in `sprint-status.yaml` and the retro doc (items 1 and 2 split back onto their own lines).

## Review Triage Log

- BH1 retro item not closed, items 1/2 run together — low, real: patched (tracker `done`, status note, line split).
- BH2 spec lacks the full template sections — false: the oneshot route deletes them by design; status goes `done` at finalize.
- BH3 `compareCombinations` JSDoc says "below-threshold" — low, real: patched.
- BH4 `RecipelessClass.combinations` JSDoc restates the rule — low, real: patched to cite the comparator.
- BH5 no unit case for the new predicate — medium, real: patched (broken crafted + unresolvable drops "yet"; + not-yet-synced keeps it).
- BH6 no web test of the top-8 fold for recipeless lines — low, rejected: the panel takes core's array order; the core test pins that order, and a web fixture of 9+ recipeless lines is more than a simple fix.
- BH7 core order test lacks `rough` and tie cases — low, rejected: `COMBINATION_GROUP` and its tie-break are the crafted-row comparator, unchanged here; the new test proves the recipeless path uses it.
- BH8 web test does not check the verdict — false: "yet" drops only when every listed row's verdict is `broken`, so the copy assertion observes the verdict; the `perfect` half shows the pending case.
- BH9 no owner doc for the order — false: EXPERIENCE.md *The expansion* (line 171) sets priced, then pending, then broken.
- BH10 CRLF pitfall belongs in AGENTS.md or a guard — medium, real: deferred (edits AGENTS.md or a hook) to `deferred-work.md`.
- Deferred ledger audit: no findings. Impeccable design review: no findings.
