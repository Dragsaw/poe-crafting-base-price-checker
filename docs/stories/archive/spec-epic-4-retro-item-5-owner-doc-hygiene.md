---
title: 'Epic 4 retro item 5: owner-doc revisions, memlog rows, gap rulings and stale citations'
type: 'chore'
created: '2026-10-10'
status: 'done'
baseline_commit: 'b9a4656573e2b9d4001ceaee7c4b4a1f3b5075c3'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-4-retro-2026-10-10.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 4 edited three owner documents without a revision bump or memlog row (retro S5), so two different `DESIGN.md` texts both read rev 20. The human rulings on four known gaps stayed in specs and never reached `EXPERIENCE.md` (S-Gaps), the Copy Deck *Appendix reasons* row still says FR-4 owns its words (T3), and `epics.md` / `epic-4-context.md` cite old revisions, a wrong interaction number and a line that contradicts AD-12 (S2–S4).

**Approach:** One docs-only pass per owner role. UX: `DESIGN.md` rev 21 and `EXPERIENCE.md` rev 27, with memlog rows for each unlogged edit and the write-back of the rulings. Architect: spine rev 35 with a memlog row for the AD-5 edit. PM: fix the stale citations. Close sprint-status action item 5.

## Boundaries & Constraints

**Always:** Each memlog row cites the commit it logs by its full hash. A ruling written into `EXPERIENCE.md` cites its source spec and lands in the section that owns the treatment, not only in the gaps list. New UX memlog rows use the table format of rows 281–284 (the file has no frontmatter, so `memlog.py append` fails). Spine memlog rows use the bullet format of that file.

**Never:** No change to code, tests or `prd.md`, except the two revision checks the bumps break (`tokens.test.ts` DESIGN rev, `trust-words.test.ts` EXPERIENCE rev). Do not reword the content of the four logged edits; log them as they stand. Do not rewrite older memlog rows. Do not edit Epics 1–3 text or the historical revision statements at `epics.md:6` and `:63`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Rev collision | `DESIGN.md` reads rev 20 for two texts | rev 21; a memlog row names `d26b787` as the rev-21 edit | N/A |
| Ruled gap | report absent, non-numeric threshold, state 35 boundary, all-pruned panel | each leaves *Known gaps* and holds a ruling in its owning section (the all-pruned panel as "cannot occur", spec-4-4 Design Notes) | N/A |
| Unraised gap | UJ-3–5 failure paths; show-more at 20 rows or fewer | stays under *Known gaps* naming UX as owner and its ledger entry; one `deferred-work.md` entry each, `retry_when: never — needs a human` | N/A |

**Decisions (2026-10-10, human):**
1. The two unraised gaps are ledgered: owner UX, one `deferred-work.md` entry each, so `pnpm deferred:issues` gives each a GitHub issue. This pass does not rule on them.
2. The full spec is kept above the token guideline: one retro item across three owner roles.
3. The two tests that pin the DESIGN.md and EXPERIENCE.md revisions move to 21 and 27 with the bumps; no token or reason word changes, so no other code follows.

</frozen-after-approval>

## Code Map

- `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/DESIGN.md` -- frontmatter `revision: 20`; Density rule and `expansion-panel.borderBottom` changed by `d26b787`.
- `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md` -- frontmatter `revision: 26`; *Known gaps* at :84–93; Copy Deck *Appendix reasons* at :496; state 35 row at :828; threshold Interaction 1 at ~:850–858 (non-numeric input unstated); Sync Report panel `unknown` lines at ~:750–761. `7a64307` changed *Price trust* (:629) and states 2, journeys; `f252ca9` changed the all-league journey age (:1192).
- `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/.memlog.md` -- last row 284 (rev 26 / rev 20, `c433841`).
- `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md` -- `revision: 34`, `updated`; AD-5 raw-key row at :226 changed by `816818b` (Story 4.8).
- `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/.memlog.md` -- bullet log; last rows log rev 34.
- Rulings: `spec-4-5…md:58-60` (report absent; non-numeric restores the last valid figure on blur), `spec-4-6…md:56` (state 35: no new chrome, raw branch's show-more ends it, rank cell reserved and blank), `spec-4-4…md:156` (all-pruned panel cannot occur). Their Copy Deck strings already landed (:450, :485, :504).
- `docs/epics.md` -- :2487 (EXPERIENCE rev 25, DESIGN rev 19, spine rev 32), :2503 and :2676 (DESIGN rev 19), :2632 "Interaction 2" → Interaction 1 (EXPERIENCE :50, :524).
- `docs/stories/epic-4-context.md` -- :7 (rev 25 / rev 19); :28 "no problem count of its own" contradicts AD-12 (`ARCHITECTURE-SPINE.md` ~:845, web reads the count from the dataset); :55 open gaps line.
- `docs/stories/sprint-status.yaml` -- item 5 at :113, `status: open`.

## Tasks & Acceptance

**Execution:**
- [x] `DESIGN.md` -- bump to rev 21 -- d26b787 shipped under rev 20.
- [x] `EXPERIENCE.md` -- rev 27; write the four rulings into their owning sections and drop them from *Known gaps*; keep the two unraised gaps under *Known gaps* with UX as owner and a pointer to the ledger; reword *Appendix reasons*: FR-4 owns the three causes, the Copy Deck owns the words -- S-Gaps, T3.
- [x] `docs/stories/deferred-work.md` -- append one heading `## Deferred from: epic 4 retro item 5 (2026-10-10)` with two entries (source_spec this spec; `retry_when: never — needs a human`) -- decision 1.
- [x] UX `.memlog.md` -- rows 285+: one each for `d26b787` (DESIGN rev 21), `7a64307` and `f252ca9` (logged under rev 27), and one for this pass's rulings and Copy Deck reword.
- [x] `ARCHITECTURE-SPINE.md` + its `.memlog.md` -- rev 35, `updated`, and an event row logging `816818b`'s AD-5 edit.
- [x] `docs/epics.md` -- cite EXPERIENCE rev 27, DESIGN rev 21, spine rev 35 at :2487/:2503/:2676; Interaction 1 at :2632.
- [x] `docs/stories/epic-4-context.md` -- same revisions at :7; :28 reads that web derives no trust fact or freshness cut-off and reads the problem count from the dataset (AD-12); :55 reflects the rulings.
- [x] `docs/stories/sprint-status.yaml` + `epic-4-retro-2026-10-10.md` -- item 5 `done`, with a status note under retro action 5 like item 4's.

**Acceptance Criteria:**
- Given the branch, when `git diff master --stat` runs, then only files under `docs/` and those two tests change.
- Given each of `d26b787`, `7a64307`, `f252ca9`, `816818b`, when the memlogs are searched for its full hash, then exactly one row logs it with the revision it belongs to.
- Given `EXPERIENCE.md`, when *Known gaps* is read, then no ruled gap remains, and grep finds each ruling in its owning section with its spec cited.
- Given `epics.md` and `epic-4-context.md`, when grepped for `revision 25`, `revision 19` (outside :6/:63), `revision 32` and `Interaction 2`, then nothing matches in Epic 4 text.

## Implementation Notes

- Blocker against the frozen boundary: `packages/web/src/theme/tokens.test.ts:70-71` pins `DESIGN.md` revision 20 and `packages/web/src/list/row/trust-words.test.ts:54-55` pins `EXPERIENCE.md` revision 26 (added by `3868a7f`). The required bumps fail both, so `pnpm check` is red with exactly those two tests and every other test green. The fix is the two pins to 21 and 27; no transcribed token or reason word changes. It is a test edit, which *Never* forbids, so it waits for a human ruling.
- The UX memlog row for this pass is 288; `EXPERIENCE.md` cites it at each ruling.
- The test-pin blocker was resolved by Decision 3; both pins now read 21 and 27.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | edge | Memlog 285 says d26b787 shipped under rev 20 | medium | `git show d26b787:DESIGN.md` reads rev 19; the collision came from merge 0f1bd2f with c433841 | patch |
| 2 | edge | Memlog 286/287 omit the revisions 7a64307 and f252ca9 edited | low | Both read EXPERIENCE rev 25 on the parallel branch; merged into rev 26 | patch |
| 3 | blind | Memlog 288 calls spec-4-4's item a human ruling | low | spec-4-4:156 is a Design Notes bullet | patch |
| 4 | blind | epic-4-context:28 says the problem count comes from the dataset | medium | AD-12 :850-852 names a source per problem; starved pinned comes from the report | patch |
| 5 | blind | No-report paragraph quotes Copy Deck strings | low | Copy Deck :435-436 already owns them | patch |
| 6 | edge | No-report paragraph omits that Problems still lists broken entries | low | `problemSummary` (`trust-facts.ts:180`) lists dataset broken entries with no report | patch |
| 7 | blind | All-pruned ruling restates mechanism in EXPERIENCE.md | low | The clause describes `craftedClassesOf` and the raw ranking | patch |
| 8 | blind, edge | Known gaps lead claims a GitHub issue and names a ledger heading that will be removed | low | `pnpm deferred:issues` has not run; entries are removed when work lands | patch |
| 9 | blind | Retro note says done without the ledger substitution | low | Item 5 asked for a due story; Decision 1 chose ledger entries | patch |
| 10 | blind | Coverage Self-Check implies UJ-6 has an unlisted failure-path gap | low | Self-Check :1240 predates this change; *Known gaps* already listed only UJ-3 to UJ-5 | defer |
| 11 | blind | Item 5 marked done before the work lands | false | The status change lands with the work in the same PR; nothing reaches master before review | reject |
| 12 | blind | Spine memlog "(FR-4 state 16)" mixes owners | false | It quotes the AD-5 row as committed by 816818b; the row logs that text | reject |
| 13 | blind | Reviewed diff omits the spec; Implementation Notes stale | false | The spec is the claims file and is committed with the branch; fix would edit this build's spec | reject |
| 14 | edge | State 35 boundary relies on an affordance absent at 20 rows or fewer | low | That case is the ledgered show-more gap | reject |
| 15 | edge | No-report fallback count could include pruned broken entries | false | The paragraph cites state 31, which owns the count; pruned exclusion is retro item 1 | reject |
| 16 | edge | Empty or partial threshold input has no ruling | false | Empty is non-numeric and restores; `0.` is a valid parse | reject |
| 17 | edge | Appendix reasons reword removes the FR-4 drift guard | low | The reword is the explicit ask of the rev-26 UX handover (T3); rare, and a guard adds tests | reject |

## Verification

**Commands:**
- `pnpm check` -- expected: green (docs only; confirms no lint or link breakage).
- `git log -1 --format=%H d26b787` (and the other three) -- expected: the full hashes written into the memlog rows.
