---
title: 'Handover — business rules stay in the PRD, mechanism leaves it (PRD revision 26)'
status: handover
from: 'John (PM), session 2026-10-09'
to: 'Winston (architect)'
created: '2026-10-09'
---

# Handover to Winston

The player moved the PRD's altitude line. I did not change the spine or any companion document.

## 1. The rule changed

A **business rule** is a rule that, when it changes, changes the ranking or what the player can rely on. The PRD owns it. The PRD includes the formula or predicate when that is the clearest form. The EV rule in FR-1 is the model.

- **The spine cites the FR of a business rule and never restates it.** Please sweep AD-17 and AD-5 for restated EV, threshold and overlap-intent text, and replace it with a citation.
- **Code and tests own the implementation** of each rule, and the mechanism predicates and field identifiers.
- `AGENTS.md` now says this (the *Each planning fact has one owner document* bullet). That bullet used to say the code owned formulas and predicates.

## 2. What stays in the PRD as business rule

- FR-1's EV rule, with its formula block.
- FR-16's intent: tracked outcomes on one Item Class are mutually exclusive, so one item is never counted twice.
- FR-22's Accepted Tier curation rule and the shared Item Level Floor.
- The three Unrankable causes in FR-4.

## 3. What left the PRD, and what the spine must hold

Check each item is stated in the cited AD. Add whatever is missing.

| Removed from | Mechanism | Owner |
|---|---|---|
| FR-16 | The overlap predicate and its branch order. The PRD now says only "two entries overlap when one item could satisfy both". | AD-17 |
| FR-17 | "Two runs from the same files and clock select the same entries" and "a dry run predicts a live run". | AD-7 |
| FR-18 | The commit-history rule for the Tracked List date, and the no-history fallbacks. The wording went to `EXPERIENCE.md`. | AD-12 |
| FR-22 | How a floor derives from the band, tier-span arithmetic, and "the floor scopes the Eligible Pool". | AD-5, AD-17 |
| FR-25 | The Sync Report field list. | AD-12, AD-7, AD-27 |
| NFR-1 to NFR-9 | Each is now a one-line stub with an AD citation. The ids stay because FRs, SMs and R-7 cite them. | AD-1, 3, 4, 8, 13, 15, 24, 30; `AGENT-WORKFLOW.md` |

## 4. Open for you

- **The 48-hour freshness cut-off** left the PRD. FR-12 now says that a cut-off exists and that it reads the clock AD-10 names. `EXPERIENCE.md` owns the value, and it uses 3 days. Make AD-10 say that a cut-off exists, and cite UX for its value.
- **The share-of-EV formula** for the "rough" verdict. `EXPERIENCE.md` carries a `[NOTE FOR ARCHITECT]` that asks you to put it in the spine. It is not a PRD matter.
- **Curator rules** (FR-22's Accepted Tier text) are better served by the `tracked-json` skill. I did not edit the skill. Say if you want it to carry the rule.
- **`prd.md` frontmatter** lists archived specs under `sources` and your three documents under `inherits`. I left both as they were.
