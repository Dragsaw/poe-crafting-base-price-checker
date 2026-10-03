---
title: 'Epic 3 retro item 27: rewrite the masthead dek'
type: bugfix
created: '2026-10-03'
status: 'done'
baseline_revision: '23562c6d1f29eb1326d521f6a6def219bd83dc4f'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/epic-3-retro-2026-10-03.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The masthead dek says "Crafted Item Classes are not ranked yet", and Epic 3 now ranks crafted rows beside it (retro R2). Epic 3 left this rewrite unbuilt, although the epic 2 retro item 19 decision said Epic 3 rewrites it.

**Approach:** Replace the Epic 2 dek with the full-product copy that the key-hero mockup already holds. Change EXPERIENCE.md (owner), `MASTHEAD_DEK` and its test assertions in one change (human decision: retro action item 3 assigns this change to dev).

## Boundaries & Constraints

**Always:** The new dek is exactly `Item Classes ranked by expected payout per craft, beside the Base Types worth selling raw. Every figure is in Divine.` (mockup `key-hero-resting.html`, `.dek`). It states a capability and names no file, so it is true in every state, including with `recipes.json` absent or holding no recipe. `Divine` stays the `DENOMINATION` placeholder in source. The dek stays within two lines at `{spacing.dek-max-width}`. Bump EXPERIENCE.md `revision` and `updated` when its body changes.

**Never:** Do not edit `prd.md`, the architecture documents or `epics.md` (Epic 2 story ACs there are history). Do not give the dek the job of explaining an empty crafted branch. A rankable crafted class with no recipe stays with retro item 29. Do not touch the Craft Recipe control or ranking code.

</intent-contract>

## Code Map

- `packages/web/src/frame/Masthead.tsx:8-14` -- `MASTHEAD_DEK` and its doc comment (says "Epic 2 ranks no crafted row").
- `packages/web/src/App.test.tsx:325,488,1082,1188` -- dek assertions: `:1082` is the literal old string in the committed-data test; `:488` is the copy scan, which strips the dek source before banning "worth"; `:325` and `:1188` compare with `MASTHEAD_DEK`.
- `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md` -- `:284-288` (absence-line prose naming the dek), `:302-311` (*The Epic 2 masthead dek*), `:739` (banner prose), `:914` (state 37).
- `docs/ux-designs/.../DESIGN.md:419,1683,2144` -- cite the dek section by name or say the dek explains the empty appendix.
- `docs/ux-designs/.../mockups/key-hero-resting.html:428-433` -- comment says "Do not reconcile the code to this line"; stale after this change.
- `docs/stories/deferred-work.md:113-118,276-277` -- two open entries this change discharges. `docs/stories/sprint-status.yaml:265-271` -- item 27 status.

## Tasks & Acceptance

**Execution:**
- `packages/web/src/frame/Masthead.tsx` -- set `MASTHEAD_DEK` to the Always copy; rewrite the doc comment to say the dek is EXPERIENCE.md's masthead copy -- fixes R2.
- `packages/web/src/App.test.tsx` -- in the committed-data test, assert the new literal dek; drop the "not ranked yet" expectation; assert the dek holds no "not ranked yet" -- pins the copy.
- `EXPERIENCE.md` -- rename *The Epic 2 masthead dek* to *The masthead dek* with the new text, rationale and decision tag; remove every claim that the dek says why no crafted class is ranked (`:284`, `:739`, state 37); bump `revision` and `updated`.
- `DESIGN.md` -- update the three references to match the renamed section and the removed claim.
- `key-hero-resting.html` -- replace the stale comment with one that says the page now prints this dek.
- `deferred-work.md`, `sprint-status.yaml` -- remove the two entries; set item 27 `done`.

**Acceptance Criteria:**
- Given the committed data with a ranked crafted row, when the page loads, then the masthead dek reads the new copy and nothing on the page says crafted classes are not ranked.
- Given `recipes.json` absent or holding no recipe, when the page loads, then the same dek reads true and names no file.
- Given the repo, when `grep "not ranked yet"` runs over `packages/` and the UX docs, then it finds nothing.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0
- `pnpm --filter @poe-cbpc/web test` (or the workspace's web test command) -- expected: the dek tests pass. The 3 stale committed-data failures that retro V1 lists are separate.

### 2026-10-03 — Review pass
- verdicts: 19 findings — high 0, medium 1, low 3, false 4, maybe-false 0 (11 more are duplicates or restated facts, rejected below)
- findings:
  - `[low]` `[patch]` Blind: banner paragraph in EXPERIENCE.md joined into one long line (also edge-case, verification-gap) — re-wrapped.
  - `[low]` `[patch]` Blind: DESIGN.md cites state 37 for the absence line; it is state 38 — fixed.
  - `[low]` `[patch]` Blind: DESIGN.md edited with no revision bump — `revision` 14, `updated` 2026-10-03.
  - `[medium]` `[reject]` Edge/Blind: nothing on the page now says why the crafted branch is empty in the committed state — the committed state now ships two recipes (the test asserts `greater|perfect`), so the branch is not empty; the no-recipe case is retro item 29, named in the spec Never clause and an open sprint item, so no new ledger entry.
  - `[low]` `[reject]` Edge/Blind/Gap: AC3's grep matches the two new negative assertions — the assertions are the intended pin; the criterion means no copy prints the phrase.
  - `[low]` `[reject]` Edge/Blind: `epics.md:1625` and other Epic 2 story text still cite the old dek — history of Epic 2 stories; the spec Never clause excludes `epics.md`, owned by the PM.
  - `[low]` `[reject]` Edge/Blind/Intent: AC1/AC2 have no state-varying test — the dek is a constant, so a state-varying test asserts nothing the literal pin does not; adding guards is more than a direct fix.
  - `[false]` `[reject]` Blind: sprint item `done` while spec `in-review` — the spec goes to `done` in this run's finalization, same commit; the CLAUDE.md rule asks that the ledger entry go in the last commit of the branch, which this is.
  - `[false]` `[reject]` Blind: decision tag overstates authority — the retro action item assigns the change to dev and the mockup holds the copy; the tag cites the spec Approach, as the Epic 2 decision did.
  - `[false]` `[reject]` Blind: dek misleading in the committed state — "Item Classes ranked by expected payout per craft" is true there, since Amulets ranks (retro R2).
  - `[false]` `[reject]` Gap: copy scan at `App.test.tsx:488` unverified — the run of `App.test.tsx` passes 55/55.
  - Remaining rows: intent-alignment readings A to E, with no divergence that calls for a change, and the deferred ledger audit's zero findings.

## Auto Run Result

Status: done

- Summary: the masthead dek now reads the full-product copy ("Item Classes ranked by expected payout per craft, beside the Base Types worth selling raw. Every figure is in Divine.") in `Masthead.tsx`, `App.test.tsx`, EXPERIENCE.md and the mockup comment. EXPERIENCE.md, DESIGN.md and the ledger no longer claim the dek explains an empty crafted branch.
- Files: `packages/web/src/frame/Masthead.tsx` (copy), `packages/web/src/App.test.tsx` (literal and negative assertions), `EXPERIENCE.md` (rev 17), `DESIGN.md` (rev 14), `mockups/key-hero-resting.html` (comment), `deferred-work.md` (two entries removed), `sprint-status.yaml` (item 27 done).
- Review: 3 patches applied (all low), 0 deferred, rest rejected with reasons in the log.
- Follow-up review recommended: false.
- Verification: `pnpm check` exit 0. `vitest run src/App.test.tsx`: 55 passed. No browser check of the two-line fit (118 characters, 1 more than the old dek).
- Residual risk: the dek's two-line fit at `{spacing.dek-max-width}` is unverified in a browser.
