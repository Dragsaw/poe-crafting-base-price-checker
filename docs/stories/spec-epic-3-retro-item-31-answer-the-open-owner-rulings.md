---
title: 'Epic 3 retro item 31: answer the open owner rulings'
type: 'chore'
created: '2026-10-03'
status: 'done'
baseline_commit: '9be103bd4f676c757230ee3b33925d57a8f42cf6'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-3-retro-2026-10-03.md'
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 3 shipped on player Decisions in places where the owner document says nothing or says the opposite (retro R6, D5, R3). The ledger carries each one as an open owner note, and the crafted Age cell (R3) is blocked on one of them.

**Approach:** Write each of the player's rulings below once, in its owner document. Close the ledger notes they answer. Record every code change a ruling causes as a new ledger entry. This branch changes no code.

**Rulings (player, 2026-10-03):**
1. **Recipe word.** IMPLEMENTATION-NOTES gets a §9 subsection, serving AD-3, that ratifies what ships: the grades are the currency-id prefixes `greater-` and `perfect-` only. A recipe whose currencies carry neither reads `regular`. `RecipesFileSchema` refuses a mixed set (a grade beside an ungraded currency counts as mixed) and two recipes with one word.
2. **AD-10 Age of a crafted row.** The inputs are the summands only: the priced entries the EV rests on. The used currency rates are not timestamp inputs. When there is no summand, the fallback is the oldest `lastAttemptedAt` of the class's entries (*tried Nd ago*), or *never attempted* when no entry was ever attempted. `core` publishes it (UX memlog 232, EXPERIENCE.md crafted Age). Write it into AD-10 as the scope of "every input" for the timestamp.
3. **D5.** An empty `contained ∩ eligible` set under a recipe floor is a reason (`recipe cannot reach this class`), never `P = 0`. Extend IN §9's empty-eligible rule to cover it.
4. **Short forms.** The Chase Combination short-form table is a hand-kept `web` product constant keyed by `statId`, in `packages/web/src/list/short-forms.ts`. It is neither curated nor fetched. One sentence in spine AD-5.
5. **Kind agreement.** A tier with no value reads as the value 1, i.e. band `[1, 1]` (the usual case: "Loads an additional bolt" is 1 beside the `[2, 2]` tier). A reference with no band on a `statId` that has banded lines stays a kind-agreement failure. Rewrite the AD-17 premise sentence and IN §2.3 to match.
6. **Reason string.** `recipe cannot reach this class` stays in code (`rank.ts` `RECIPE_UNREACHABLE`) and is not added to `prd.md`. The player will later refactor the PRD so that reason wording leaves the PRD. Close the FR-4 note with this decision.
7. **Diagnosis format.** Ratify `check · canonical key · detail`, one line per failure, and no group when nothing fails, in EXPERIENCE.md `{components.sync-report-panel}`.
8. **Scope.** Docs and ledger only.

## Boundaries & Constraints

**Always:** One owner per fact. Elsewhere cite by id (AD-n, IN §n). Bump `revision:` in each edited owner doc's frontmatter, and add a spine revision blockquote only if the spine's convention requires one. Write no other revision narrative into a body.

**Never:** Edit `prd.md`, `.memlog.md` or any code. Rewrite ledger entries that are not listed in the Code Map. Build the crafted Age cell.

</frozen-after-approval>

## Code Map

- `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md` -- AD-5 (display rule), AD-10 (:759-819; timestamp at :787, cut-off at :817-819), AD-17 cross-file table, kind agreement row (:1425), revision blockquotes at the top (:32 onward).
- `.../IMPLEMENTATION-NOTES.md` -- §2.3 kind agreement (:239-259), §9 recipe floor (:1185-1239), empty eligible set (:1223-1228), containment on `pool(entry)` (:1230-1235). Sections are `## N. Title (AD-x)`, and each item names its AD.
- `.../AGENT-WORKFLOW.md:66` -- the sentence already reads `skipped` (726f809). Add the caveat from `packages/sync/src/curation/check.ts:23-24`: a pass does not confirm that a floor equals the one IN §8 derives (AD-5).
- `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md:584` -- the sixth group of the sync panel. The format comes from `packages/web/src/frame/trust-facts.ts:158-170`.
- `docs/stories/deferred-work.md` -- close: :147 (short forms), :150 and :294 (AD-10), :153 and :251 (recipe word), :215 (kind), :218 (diagnosis), :221 (pending), :254 (FR-4). Keep :264 (the Age cell build).
- Reference only (no edit): `packages/contracts/src/craft-recipe.ts:52-75`, `envelopes.ts:133-170`; `packages/core/src/rank.ts:201,469-514`, `probability.ts:239-264`, `cross-file.ts:61-62,137-163`, `rank.test.ts:898-913`.

## Tasks & Acceptance

**Execution:**
- [x] `ARCHITECTURE-SPINE.md` -- rulings 2, 4 and 5: AD-10 timestamp scope and fallback; AD-5 short-form sentence; AD-17 kind-agreement premise.
- [x] `IMPLEMENTATION-NOTES.md` -- rulings 1, 3 and 5: the new §9 recipe-word subsection; extend the empty-eligible rule to `contained ∩ eligible`; §2.3 reads a valueless tier as `[1, 1]`.
- [x] `AGENT-WORKFLOW.md` -- the floor caveat on :66.
- [x] `EXPERIENCE.md` -- ruling 7 at `{components.sync-report-panel}`.
- [x] `deferred-work.md` -- remove the nine closed entries. Append new entries under `## Deferred from: epic 3 retro item 31 (2026-10-03)` for: (a) `core` crafted `asOf` on summands only plus the attempted fallback; (b) D5 in `probability.ts`/`rank.ts`, flipping `rank.test.ts:898-913`; (c) `kindAgreement` and containment reading a valueless tier as `[1, 1]`, then the player re-checks the 6 pruned Crossbows entries; (d) the comment at `craft-recipe.ts:52` cites IN §9.
- [x] `docs/stories/sprint-status.yaml` -- set `epic-3-retro-item-31-…` to `done`.

**Acceptance Criteria:**
- Given each ruling 1 to 7, when a reader opens its owner document, then the ruling is stated there once and matches the frozen text.
- Given the ledger, when it is read, then the nine entries are gone, the four new entries exist, and no other entry changed.
- Given `prd.md`, when the diff is read, then it is untouched.

## Implementation Notes

## Spec Change Log

## Review Triage Log

Pass 1 (blind, edge-case, verification-gap, ledger-audit):

| Finding | Verdict | Evidence | Route |
|---|---|---|---|
| AD-5 says a valueless line is not a degenerate band, which contradicts the `[1, 1]` reading | medium | SPINE AD-5 :394 is unchanged; IN §1 now gives `[1, 1]` | patch (architect) |
| AD-17 kind row's lead clause states the old rule | medium | the row opens with "any scoped line … disagrees" before the new text | patch (architect) |
| AD-10 "no exception" and AD-20 "rate asOf drags freshness" contradict ruling 2 | medium | SPINE :791, :1630 | patch (architect) |
| AD-10 fallback unclear for a class with mixed attempt history | low | the new sentence does not say "among those attempted" | patch (architect) |
| Short-form sentence breaks the AD-5 "Neither rung" flow | low | placed mid-paragraph | patch (architect) |
| IN §9 D5 counts pruned entries | low | `rank.ts` computes P for non-pruned entries only | patch (architect) |
| D5 voids the whole pair, not the entry | false | `rank.ts` `craftedRow` already voids the pair on any entry's reason; the extension is consistent | reject |
| EXPERIENCE.md "therefore" now hangs on the no-group clause | low | sentence order | patch (UX) |
| Ledger (c): the six Crossbows entries are valueless, so a re-check alone will not restore them; the trade semantics of value 1 are unverified | medium | `data/tracked.json` suffix `kind: valueless` | patch (ledger) |
| `[1, 1]` may not hold for every mixed-kind statId | low | the ruling says "the usual case"; folded into ledger (c) as a check | patch (ledger) |
| No-group is ambiguous between not run and all passing | medium | `diagnosisGroups` returns `[]` in both cases; pre-existing | defer ([NOTE FOR UX]) |
| Banded reference on an all-valueless statId passes kind agreement | false | §2.5 empty containment fails any band without 1 in it | reject |
| Below-threshold priced entries fall back to "tried" | false | ruling 2 says summands only, so this is what was ruled | reject |
| Ledger entry needed for the PRD reason-wording refactor; ruling 6 is in no owner doc | false | the player chose "leave it in code" over the option with a PM ledger note | reject |
| IN §9 restates the UI string | low | it cites `RECIPE_UNREACHABLE` alongside; harmless | reject |
| GitHub issues for the removed and added entries are not synced | false | the sweep process syncs via `pnpm deferred:issues`; an outward action, left to the player | reject |
| sprint-status `done` before review closes | false | the status lands with the branch | reject |
| Code Map line numbers stale | false | the fix edits this spec | reject |

## Verification

**Commands:**
- `git diff --stat master` -- expected: only the docs files above.
- `pnpm check` -- expected: exit 0.

**Manual checks:**
- Each AD or IN edit names the AD it serves. No owner doc restates another's text.
