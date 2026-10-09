---
title: 'Epic 2 retro item 19: the committed day-one state explains itself'
type: 'bugfix'
created: '2026-09-27'
status: 'done'
baseline_revision: '5fb836a30832812b83b0efbdbaf35dc2a428623b'
route: 'dispatch'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The committed `data/recipes.json` is an object with an empty `recipes` list (story 2.7 Decisions), so no `recipes.json` absence line prints. About 200 tracked crafted entries are on no row and in no appendix, and the page gives no reason. The masthead dek promises "Item Classes ranked by expected payout per craft", which the page does not do. The epics text (`docs/epics.md` "Two day-one worlds", the story 2.7 and story 2.8 ACs) and the UX docs (EXPERIENCE.md state 37 and the absence-line prose, DESIGN.md the absence-line rationale) still describe the committed state as an absent `recipes.json` whose absence line names why (retro F2).

**Approach:** Copy and spec alignment only (human, 2026-09-27). The masthead dek becomes the one place that says what the Epic 2 page ranks and why no crafted Item Class is on it. The owner documents are corrected to describe the committed state as `recipes.json` published with no recipe, explained by the dek and not by an absence line.

**Decision (human, 2026-09-27) — the dek copy is capability-based:** `The Base Types worth selling raw, ranked by price. Crafted Item Classes are not ranked yet. Every figure is in Divine.` It is true in every Epic 2 state, because Epic 2 ranks no crafted row even with recipes present. "yet" carries the reason: the crafted ranking is Epic 3. Epic 3 rewrites the dek when it ranks crafted rows.

## Boundaries & Constraints

**Always:** The dek fits two lines at `{spacing.dek-max-width}` 480px (the 170px masthead budget, DESIGN.md Layout). Each fact is written in its owner document and cited elsewhere (AGENTS.md owner rule). The absent-recipes and absent-weights states keep their current behaviour and copy.

**Never:** No change to load, rank, absence-line or appendix logic. No new line, banner or condition. The empty appendix stays silent about why it is empty (state 37). Do not name `recipes.json` in the dek (`App.test.tsx` committed-data test asserts the frame never prints it). Do not edit the mockups, the PRD or the spine. Do not remove `deferred-work.md` entries: only `deferred-work-sweep` removes them.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Committed | weights present, recipes `[]` | new dek; no absence line; appendix `— 0 Item Classes` | N/A |
| Absent recipes | recipes 404 | new dek plus the unchanged `recipes.json` absence line | N/A |
| Absent weights | weights 404 | new dek; appendix rows carry `class absent from weights file` | N/A |

</frozen-after-approval>

## Code Map

- `packages/web/src/frame/Masthead.tsx:8-9` -- `MASTHEAD_DEK`, the only code change. The doc comment at `:6` says the strings come from `mockups/key-hero-resting.html` (the Epic 3 page); after this change the dek is EXPERIENCE's Epic 2 copy, so the comment must say so. The new dek is 117 characters, under the ~136 two-line cap at 480px (DESIGN.md `:393-398`, ~68 characters a line); the old one was 118.
- `packages/web/src/App.test.tsx:405-417` -- the copy scan strips `MASTHEAD_DEK` (the new dek keeps "worth"); its title says "masthead copy DESIGN.md owns", which becomes the masthead copy the UX docs own. `:886-903` -- the committed-data test; add the dek assertions here. `MASTHEAD_DEK` is already imported in this file.
- `docs/epics.md:6` -- frontmatter `revisionPass` names the 2026-09-26 targeted revision "with recipes.json absent"; name this 2026-09-27 revision instead. `:367` "Two day-one worlds"; `:1621-1625` story 2.7 AC; `:1659-1661` story 2.8 AC.
- `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md:277-282` absence-line prose ("The committed deploy has no `recipes.json`"); `:694-700` banner prose ("The trust strip's absence line already says why"); `:863` state 37 ("State 38's absence line already says so"). The masthead eyebrow paragraph starts `:284`; the Epic 2 dek text goes beside it.
- `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/DESIGN.md:1667-1669` masthead dek rule; `:2032-2036` "Why no mark" ("that line appears on every load"); `:2125-2127` empty-appendix prose ("when `recipes.json` is absent, the trust strip's absence line already says so").
- `docs/stories/deferred-work.md:99` (the `[NOTE FOR UX]` empty-appendix entry, which claims `recipes.json` absent on the committed data) and `:221-223` (the story 2.7 epics-AC entry) -- closed by this work; append only.
- Do not change: `frame/AbsenceLines.tsx`, `load/artifacts.ts`, `appendix/*`, `mockups/*`, `prd.md`, `ARCHITECTURE-SPINE.md`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/web/src/frame/Masthead.tsx` -- set `MASTHEAD_DEK` to the Decision copy verbatim; make the doc comment say the title comes from the mockup and the dek from EXPERIENCE.md's Epic 2 masthead copy -- F2 copy.
- [x] `packages/web/src/App.test.tsx` -- in the committed-data test, assert the masthead prints `MASTHEAD_DEK`, that the dek contains `Crafted Item Classes are not ranked yet`, and that it does not match `/ranked by expected payout/`; retitle the copy-scan test to name the UX docs as the owner -- pins the copy.
- [x] `docs/ux-designs/.../EXPERIENCE.md` -- add the Epic 2 dek text as the owner of that copy, beside the masthead eyebrow paragraph, with the Decision's "yet" reason and that Epic 3 rewrites it. Rewrite the absence-line prose, banner prose and state 37: the committed state is `recipes.json` published with no recipe, no absence line prints, and the dek says why no crafted Item Class is ranked; in the absent-recipes state the absence line says why -- UX owner.
- [x] `docs/ux-designs/.../DESIGN.md` -- the "Why no mark" rationale no longer claims the line prints on every load; the empty-appendix prose names both explainers (the dek in the committed state, the absence line when `recipes.json` is absent); the masthead rule cites EXPERIENCE for the Epic 2 dek text -- UX owner.
- [x] `docs/epics.md` -- rewrite `:367`, the story 2.7 AC and the story 2.8 AC to the committed state above, citing the story 2.7 Decisions and EXPERIENCE state 37; update `revisionPass` -- PM reconciliation.
- [x] `docs/stories/deferred-work.md` -- append one entry under a new "Deferred from: epic 2 retro item 19 (2026-09-27)" heading noting that the entries at `:99` and `:221` are now closed and sweepable -- ledger rule.

**Acceptance Criteria:**
- Given the committed `data/` set, when the page renders, then the dek names the raw Base Type list and states that crafted Item Classes are not ranked, and it never claims a crafted ranking.
- Given the built page at 1060px, when agent-browser measures the dek, then it sets in two lines (42px) and the masthead stays 170px.
- Given `docs/epics.md`, EXPERIENCE.md and DESIGN.md, when grepped for "committed" next to "recipes", then no text says `recipes.json` is absent in the committed state or that an absence line explains it.

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 27 findings — high 0, medium 4, low 17, false 6, maybe-false 0
- findings:
  - `[low]` `[patch]` Blind: DESIGN.md `copyDek` token (:421) still says "one sentence", contradicting the rule and the three-sentence dek — group A (the DESIGN dek rule not fully handed to EXPERIENCE); token and prose now keep width and two-line limits and cite EXPERIENCE for content.
  - `[low]` `[patch]` Blind: the DESIGN.md masthead rule describes dek content that EXPERIENCE now owns and omits the "not ranked" job — group A; fixed with the row above.
  - `[low]` `[patch]` Blind: dek and absence line both explain the empty crafted branch in the absent-file states — group B (one-reason rule unclarified); EXPERIENCE now says the dek states capability and the absence line states cause.
  - `[low]` `[patch]` Blind: the uniform-prior banner condition list omits the committed state — verified at EXPERIENCE.md:710-711; the committed state added to the list.
  - `[medium]` `[patch]` Blind: nothing records that Epic 3 owes the dek rewrite — group C (owed rewrite unledgered); verified no Epic 3 AC or ledger entry; appended a deferred-work item.
  - `[low]` `[reject]` Blind: no automated test enforces the two-line dek — group D; the constraint is layout, which jsdom cannot measure; a character-count guard is a proxy that adds a test rule; the dek was measured 42px in the browser (see Verification). Low and unlikely in daily use.
  - `[low]` `[reject]` Blind: `[data-masthead] p` is a loose selector — the dek `<p>` precedes the control group in DOM order, so querySelector returns it today; the fix adds a new `data-*` hook for a hypothetical layout change.
  - `[false]` `[reject]` Blind: matrix rows unevenly covered, combined absent case has no dek assertion — every matrix row has a passing test asserting the dek (App.test.tsx absent-recipes, committed-data, absent-weights); the combined case is not a matrix row.
  - `[low]` `[patch]` Blind: the new ledger entry names target (2) loosely — heading and summary opening now quoted.
  - `[low]` `[patch]` Blind: "there" in epics.md:367 reads as the absent-recipes world only — reworded to name both worlds.
  - `[low]` `[patch]` Blind: `[decision — human, 2026-09-27]` has no source — no UX memlog exists in the tree; the tag now cites this spec's Decision.
  - `[low]` `[patch]` Blind: edited lines at DESIGN.md:1669 and EXPERIENCE.md:715 not re-wrapped — re-wrapped.
  - `[low]` `[patch]` Edge: the one-reason rule reads as broken when both dek and absence line print — group B; fixed as above.
  - `[low]` `[reject]` Edge: nothing automated enforces the two-line cap — group D; rejected as above.
  - `[medium]` `[patch]` Edge: dek assertions compare the constant with itself — group E (dek not pinned to its literal); the committed-data test now asserts the full EXPERIENCE literal.
  - `[low]` `[patch]` Edge: the negative regex covers only "ranked by expected payout" — group E; the full-literal assertion subsumes it.
  - `[low]` `[patch]` Verification gap: no test pins the full dek literal — group E; fixed as above (pre-verified gap).
  - `[low]` `[reject]` Verification gap (other): the two-line fit is browser-only — group D; rejected as above.
  - `[low]` `[reject]` Intent: the two-line fit is checked only in prose — group D; rejected as above.
  - `[medium]` `[patch]` Intent: the test oracle is the code constant, not the decided string — group E; fixed as above.
  - `[false]` `[reject]` Intent: the Committed row's `— 0 Item Classes` is not asserted in the edited test — the appendix title-alone test on committed data (App.test.tsx:956) asserts it, and it passes.
  - `[false]` `[reject]` Intent: the mockup still shows the old dek — the intent's Never list forbids editing the mockups; the code comment now names EXPERIENCE as the dek's owner.
  - `[low]` `[patch]` Intent: DESIGN.md does not mention the "not ranked yet" clause — group A; fixed as above.
  - `[false]` `[reject]` Intent: DESIGN's "one sentence" rule was loosened to fit the copy — the human Decision fixes a three-sentence dek, so keeping "one sentence" would contradict the intent.
  - `[false]` `[reject]` Intent: the PRD and brief still say the view ranks Item Classes by payout — they describe the whole product, crafted ranking is Epic 3, and the intent forbids PRD edits.
  - `[false]` `[reject]` Intent: the Story 2.8 AC now joins two states in one Given — the intent asks the ACs to describe the committed state, and the joined Given keeps the absent-recipes state stated; no bad outcome.
  - `[medium]` `[patch]` Ledger: the owed Epic 3 dek rewrite has no deferred-work entry — group C; appended.

### Follow-up review

The recommended follow-up review is the code review of `78db4da..ec38dce` (2026-09-27). Its Acceptance Auditor checked this spec against the final `master` code and found it held in full. `MASTHEAD_DEK` is the decided literal, the committed-data test pins the full string, and the absent-recipes and absent-weights tests assert the dek. The docs chunk of that review found one gap: `fabd4c2` changed DESIGN.md and EXPERIENCE.md without a revision bump, so the dek change sits in DESIGN.md revision 7 and EXPERIENCE.md revision 8. The UX memlog now records that attribution.

## Verification

**Commands:**
- `pnpm check` -- expected: passes.
- `pnpm test` -- expected: all tests pass.
- `grep -n "committed" docs/epics.md docs/ux-designs/*/EXPERIENCE.md docs/ux-designs/*/DESIGN.md | grep -i recipe` -- expected: no line says `recipes.json` is absent or unpublished in the committed state.

**Manual checks (if no CLI):**
- `pnpm dev`, agent-browser with a named `--session` at 1060px: the dek `<p>` is 42px tall, and `[data-masthead]` is 170px tall. Stop the server with `pnpm dev:stop`.

## Auto Run Result

Status: done

**Summary:** The masthead dek is now the human-decided capability copy: `The Base Types worth selling raw, ranked by price. Crafted Item Classes are not ranked yet. Every figure is in Divine.` EXPERIENCE.md owns that text. It is the one place that says why no crafted Item Class is on the committed page. `docs/epics.md` (Two day-one worlds, the Story 2.7 and 2.8 ACs), EXPERIENCE.md (the absence-line prose, the banner prose, state 37) and DESIGN.md (the masthead rule, `copyDek`, "Why no mark", the empty appendix) now describe the committed state as `recipes.json` published with no recipe. No absence line prints in that state, and the dek explains it. No load, rank, absence-line or appendix logic changed.

**Files changed:**
- `packages/web/src/frame/Masthead.tsx`: the new `MASTHEAD_DEK`; the doc comment names EXPERIENCE as the dek's owner.
- `packages/web/src/App.test.tsx`: the committed-data test pins the full dek literal; the absent-recipes and absent-weights tests assert the dek (matrix coverage); the copy-scan title names the UX docs.
- `docs/ux-designs/.../EXPERIENCE.md`: new *The Epic 2 masthead dek* paragraph; rewrites of the absence-line prose, banner prose and state 37; the dek states capability and the absence line states cause.
- `docs/ux-designs/.../DESIGN.md`: the masthead rule and `copyDek` keep only the width and two-line limits and cite EXPERIENCE; "Why no mark" and the empty-appendix prose are corrected.
- `docs/epics.md`: `revisionPass`, "Two day-one worlds", the Story 2.7 and 2.8 ACs.
- `docs/stories/deferred-work.md`: appended the retro item 19 entry, which marks two entries sweepable and records the owed Epic 3 dek rewrite.

**Review findings:** 27 findings (medium 4, low 17, false 6). Patched as five groups: A, the DESIGN dek rule and `copyDek` (low); B, the dek and absence line as capability and cause (low); C, the Epic 3 dek rewrite ledgered (medium); E, the dek pinned to its full literal (medium); and single-row fixes for the banner condition, the ledger target naming, the epics "there", the decision tag source and the line wrap (low). Nothing deferred. Rejected: the two-line layout guard (jsdom cannot measure layout; the browser measured 42px), the loose `[data-masthead] p` selector (correct in DOM order today), and six false findings. The Review Triage Log gives every reason.

**Follow-up review:** recommended (`true`). Two medium entries were patched (C and E), and no reviewer re-read the patched prose: the EXPERIENCE capability-versus-cause sentence and the banner-condition list. That prose is an unverified risk against the AGENTS.md one-owner rule.

**Verification:** `pnpm check` passed. `pnpm test` passed: 88 files, 1155 tests. The committed-recipe grep over epics, EXPERIENCE and DESIGN finds only text that describes the new state. agent-browser (session `poe-29f90ff02546`, 1060px, committed `data/`): the dek sets at 42px (two lines), `[data-masthead]` is 170px and no `[data-absence-lines]` element is on the page. `pnpm dev:stop` freed port 5173.

**Residual risks:** The mockup `key-hero-resting.html` still shows the old dek (the spec says not to edit mockups). The PRD, brief and `PRODUCT.md` still describe the whole-product crafted ranking; that is correct for the product and out of scope here. No automated test enforces the two-line fit, so a later copy edit needs the browser check.
