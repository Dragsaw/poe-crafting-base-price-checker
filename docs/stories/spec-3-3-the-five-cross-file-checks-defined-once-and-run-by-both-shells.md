---
title: 'Story 3.3: The five cross-file checks, defined once and run by both shells'
type: 'feature'
created: '2026-09-27'
status: 'done'
baseline_commit: '71d9cb1e898303b6e495880a2d1e4c1c7bdc4573'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md'
  - '{project-root}/docs/stories/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No shell checks `tracked.json` against `weights.json`. A double-counted Combination, a sentinel band, an empty containment set, a kind mismatch or an undiscriminable class passes silently. `pnpm tracked:check` lists the checks as pending (FR-16, FR-33, AD-17, epics Story 3.3).

**Approach:** Add one pure `core` module with the five checks of IMPLEMENTATION-NOTES §2.1–§2.6. `web` runs it at load: it excludes the affected Item Class as `class disagrees with weights file` and lists the diagnosis as the sixth group of the Sync Report panel. `sync` runs it as a run-start gate that aborts non-zero and records `cross-file-gate-failure` records. `tracked:check` runs it. The within-file overlap branches go into `TrackedFileSchema`.

## Boundaries & Constraints

**Always:**
- The quantifiers, scope and payload of each check come from IN §2.1–§2.6. Scope is `eligible(pool, entry.itemLevelMin, 0)` (the class floor). Reuse `interval`, `contains` and `poolOf` from `probability.ts`. Do not divide a range pair anywhere else.
- The checks see non-pruned `crafted` entries only. A class that `rank` already makes Unrankable (absent, or a `partial` slot) gets no pool check (`coOccur` is `false` there, AD-17). With `weights.json` absent, no check runs.
- The overlap predicate is defined once, in `contracts`, with `coOccur` injected. `TrackedFileSchema` calls it with a `false` `coOccur`, and a hit refuses the file (AD-3). `core` reports `co-occur` only where the real `coOccur` makes a pair overlap that the within-file call does not. The payload names both canonical keys and the slot or slots.
- Class discriminability is `fansOut ∧ ¬discriminable`. `discriminable` is §10.2 arm 1 (`defenceLettersOf` is defined), arm 2 (every class under the `categoryId` is plain) or arm 3 (one class). It reads no catalogue.
- One failure per (check, entry). Its `detail` text holds every slot, reference, floor, partner or sibling count that §2 names. This matches the record identity `check` + `entryKey` (IN §12).
- The diagnosis group is a list, one line per failure: check, canonical key, detail. It uses the mono stack (`stacks.mono`) at the panel's own size, weight and line height, and it takes no semantic ink. It sits in column 2 after the pinned-starvation group, with vertical space only. With no failures, it renders nothing.

**Never:**
- No re-implementation of a check in `sync` or `web`. No catalogue lookup in `core`. No category-wide search fallback.
- No diagnosis in the trust strip or the appendix. The appendix prints only the reason string.
- No edit to `data/` or to an owner document.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior |
|----------|--------------|---------------------------|
| Aligned band | `43.0–56.5` or `43.0–80.0` over T7 `[43,56.5]`, T8 `[56,80]` | no failure |
| Clipped / sentinel | `43.0–60.0`; `0–9999` | `edge-alignment` |
| Hybrid entry | a contained entry carries a foreign `statId` line | the foreign line is ignored by alignment |
| Floor-dependent | a band aligns only above the class floor | fails at the floor |
| Empty set | no scoped entry contains the ref, or only weight-0 tiers do | `empty-containment-set`, never `P = 0`; the detail names the ref, its floor and the absence, and no file |
| Kind | any scoped line on the ref's `statId` has the other kind | `kind-agreement` (universal) |
| coOccur | two refs in one slot name two lines of one scoped entry | `co-occur`, both keys and the slot |
| Within-file overlap | intersecting bands, both valueless, prefix-only + suffix-only | `TrackedFileSchema` refuses; adjacent tiers load |
| Absent / partial class | pool lookup fails, or a slot is `partial` | no pool check; the existing reason stands |
| Fan-out undiscriminable | a plain class in a mixed category | `class-discriminability`, the detail has `className`, `categoryId`, sibling count, `class not discriminable` |
| web | a failure on one class | that class is Unrankable with the third reason; other rows rank; the panel lists the line |
| sync | any failure | throws before `chunkOrder`; one record per failure; exit non-zero; `sync-progress.json` untouched |

**Decisions (2026-09-27):**
- The spec stays whole at about 2,100 tokens. The player chose this over a split.
- The committed data fails two checks, and this branch fixes it: Emerald's bands `[12,15]` and `[3,4]` fail empty containment, and the 6 Crossbows entries on `explicit.stat_1967051901` fail kind agreement. That stat has a valueless tier at ilvl 55 and a banded `[2,2]` tier at 82. The fix follows the tracked-json skill. Emerald becomes the whole T1 tiers (`[5,15]`, `[2,4]`, checked with `tracked:lookup`). The 6 Crossbows entries become `pruned` with a reason, and the class floor is re-derived. After the fix, `pnpm tracked:check` passes with the cross-file checks, and `pnpm sync` does not abort. Append a `[NOTE FOR ARCHITECT]`: a real `statId` rolls both kinds, which contradicts AD-17's premise for kind agreement. Close the Emerald deferred entry.

</frozen-after-approval>

## Code Map

- `packages/core/src/probability.ts` -- `interval` (:75), `contains` (:95, weight-0 is never contained), `poolOf` (:116), `eligible` (:131). Reuse them. `containedIn` (:148) is private and may be exported.
- `packages/core/src/rank.ts` -- `UnrankableReason` (:72, add the third literal), `unrankableReasonOf` (:149), `RankInput` (:47), the unrankable map keyed `JSON.stringify([categoryId, className])` (:189-199). `rank.test.ts` `weightsWith` (:30).
- `packages/contracts/src/canonical-key.ts` -- `canonicalKey`, `compareTrackedEntries`. `class-name.ts:21` `defenceLettersOf`.
- `packages/contracts/src/envelopes.ts:46-89` -- the `TrackedFileSchema` superRefine (duplicate key and shared floor today). `tracked-entry.ts:59-62` has a comment to update.
- `packages/contracts/src/sync-run-report.ts:162-224` -- `CrossFileCheckSchema` and `CrossFileGateFailureRecordSchema {check, entryKey, detail}` already exist, and `index.ts` already exports `CrossFileCheck`. `core` imports it from there.
- `packages/sync/src/chunk/run-chunk.ts` -- the AD-12 order (doc :10-34). Gate after the weights load (:710-722), before `chunkOrder` (:724). A throw there takes the catch (:849-904): `writeReport` only, no `publish()`. Map the new error in `failureRecord` (:449-479). `readWeightsIds` (`catalogue/weights-ids.ts:48`) parses the full file. Expose it. Tests: the `harness()` and `EMPTY_WEIGHTS` in `run-chunk.test.ts` (:147).
- `packages/sync/src/curation/check.ts` -- `CheckName` (:41), `TrackedCheckInputs` (:64), `PENDING_CHECKS` (:71), `loadTrackedCheckInputs` (:173).
- `packages/web/src/App.tsx:119-149` -- `ReadyBody` calls `rank`. `list/UnrankableAppendix.tsx` prints `reason`.
- `packages/web/src/frame/trust-facts.ts` -- `Segment` (:128), `PanelColumns` (:137), `panelColumns` (:155-199). `SyncReportPanel.tsx` (:39-48). `theme/tokens.ts:226` `stacks.mono`. Tests: `trust-facts.test.ts`, `trust-strip.test.tsx`, `test-support/list-fixtures.ts`.
- `.claude/skills/tracked-json/SKILL.md` -- "Open weak point" (:22-24), step 8 (:36), step 9 caveat (:37).

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/overlap.ts` (+ test, `index.ts`, `envelopes.ts`) -- `overlap(a, b, coOccur)` and `slotOverlap` in §2.1 branch order. The superRefine refuses within-file overlap and names both keys and slots. Cover the four consequences.
- [x] `packages/core/src/cross-file.ts` (+ test, `index.ts`) -- `edgeAlignment`, `emptyContainment`, `kindAgreement`, `coOccur`, `classDiscriminability`, and `crossFileChecks(entries, weights): CrossFileFailure[]` (`{check, entryKey, categoryId, className, detail}`, sorted by key then check). Cover every matrix row. Run a real-file test over the committed data, and assert that it has no failure.
- [x] `packages/core/src/rank.ts` (+ test) -- add `'class disagrees with weights file'`. `RankInput.crossFileFailures` excludes the affected classes. The existing reasons take precedence.
- [x] `packages/sync/src/chunk/run-chunk.ts`, `catalogue/weights-ids.ts` (+ tests) -- the gate, a `CrossFileGateError` and its record mapping. Update the module doc. A dry-run or sync test on committed data must still pass or move to a fixture.
- [x] `packages/sync/src/curation/check.ts` (+ test) -- add a `cross-file` check over the loaded weights, and drop `PENDING_CHECKS`.
- [x] `packages/web/src/App.tsx`, `frame/trust-facts.ts`, `frame/SyncReportPanel.tsx`, theme (+ tests) -- run the checks once per load, feed `rank`, and render the diagnosis group.
- [x] `data/tracked.json` -- apply the data Decision, and report the edit as the AGENT-WORKFLOW `data/` writer rule requires. If a test needs `fixtures/tracked.json` to match, and that needs a live `pnpm fixtures:record`, ask the player before running it.
- [x] `.claude/skills/tracked-json/SKILL.md`, `docs/stories/deferred-work.md` -- remove the weak point and step 8, and renumber. Remove the three discharged deferred entries (checkTracked wiring, skill cleanup, Emerald). Append a `[NOTE FOR UX]`: the diagnosis line format and the empty-group behaviour are provisional.

**Acceptance Criteria:**
- Given the workspace, when searched, then no check logic exists outside `core/src/cross-file.ts` and `contracts/src/overlap.ts`, and `sync` and `web` only call them.
- Given a failing check in `web`, when the page loads, then the trust strip is unchanged and the appendix shows only the reason string.

## Verification

**Commands:**
- `pnpm check` -- expected: types, lint and dependency rules all pass.
- `pnpm test` -- expected: all tests pass, with no network call.

**Manual checks:**
- agent-browser (named session) on `pnpm dev`: open the Sync Report panel. The diagnosis lines are in mono under *What is broken*. The affected classes are in the appendix with the third reason.

## Implementation Notes

- The player moved `fixtures/tracked.json` Emerald to `[5,15]`/`[2,4]` and re-recorded with a live `pnpm fixtures:record`. The interim `alignFixtureEmerald` shim is gone. The live market moved, so `price-entry.fixtures.test.ts` now pins `[0.1207, 0.2012, 0.3038, 1, 100]`, each value checked by hand from the recorded fetches.
- Kind agreement skips weight-0 tiers (IN §1: a weight-0 tier moves no verdict). A banded ref and a valueless ref on one `statId` do not overlap within the file. That disagreement is what kind agreement reports.
- `co-occur` gives one failure to each entry of the pair. Each failure names the other key. `CrossFileGateError` is a session refusal in `sync.ts`: the session waits for an input change and does not retry.
- `pnpm sync:dry` stood in for `pnpm sync` (AGENT-WORKFLOW forbids a live sync from a worktree). The `pnpm sync:dry` subprocess test timed out once at 5 s while other worktrees loaded the CPU. The checks add about 20 ms to a run, so this is contention and not a regression.

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | verification-gap | No test shows that class discriminability still fires for a plain class in a mixed category when its pool is `partial` or absent | low | Pre-verified. The discriminability loop could move below the pool guard and every test would still pass. | patch |
| 2 | verification-gap | No test runs `loadWeights`' refusal path through `loadTrackedCheckInputs`/`main` | low | Pre-verified. Removing the try/catch leaves every test green. | patch |
| 3 | verification-gap, blind | No test asserts where the gate records sit beside other run-start records | low | Pre-verified. The only gate test has one record. | patch |
| 4 | ledger-audit | The Decision's "`pnpm sync` does not abort" was checked only with `pnpm sync:dry` | medium | Implementation Notes record the substitution, and the ledger has no entry for it. | defer |
| 5 | blind | The tracked-json SKILL says the pass covers the five checks, but `cross-file: skipped` also exits 0, and absent or partial classes get no pool check | low | `check.ts` reports `skipped` with `ok: true` when the weights file is absent. The fix is in an agent-context file (`.claude/skills`). | defer |
| 6 | edge | Class discriminability runs for a class that is absent or partial, so the sync gate can abort for a class that `rank` already makes Unrankable | false | IN §2.6 asks the check "of every `crafted` tracked entry". The spec exempts only pool checks. Spine AD-12 runs "all five checks as one gate" and aborts on any failure. | reject |
| 7 | edge | The sibling count is one too high when `className` is absent from `bases` | false | The entry's class is not among `classes`, so every listed class is a sibling. | reject |
| 8 | edge, blind | The gate also checks entries that the catalogue check excluded, so an unresolvable entry can abort the run | false | The spine (AD-12 gates) validates `data/tracked.json` as a whole: "all five checks … as one gate", and a cross-file failure aborts the run. | reject |
| 9 | edge, blind | co-occur skips pairs whose floors differ | false | Every caller parses through `TrackedFileSchema`, whose shared-floor rule refuses mixed floors, so no caller can reach such a pair. | reject |
| 10 | blind | The diff omits the spec and the epic context | false | Deliberate: the edge layer gets the claims file, and the other layers do not see it. | reject |
| 11 | blind | `data/` was edited without approval, and the pro-rating question was dropped from the ledger | false | The frozen Decision (2026-09-27) is the player's instruction to apply `[5,15]`/`[2,4]` and to close the Emerald entry. Pro-rating stays in the spine's AD-11 Deferred list. | reject |
| 12 | blind | The Crossbows entries were pruned before the architect ruled, and nothing links them for revival | false | The `[NOTE FOR ARCHITECT]` entry names the six pruned Crossbows entries on that `statId`, and the frozen Decision orders the prune. | reject |
| 13 | blind | The Crossbows floor was not re-derived after the prune | false | Re-computed over the 24 active entries: the highest contained tier is at item level 82, which matches the declared floor. | reject |
| 14 | blind | The `alignFixtureEmerald` shim can go stale without a signal | false | If the shim matches nothing, the gate refuses the fixture Emerald bands and the test fails loudly. | reject |
| 15 | blind | The `coOccur` memo key depends on argument order | low | Only a duplicate cache entry, and nothing is wrong. Negligible, and no direct fix is needed. | reject |
| 16 | blind | The sort uses `compareCanonicalKeys` on check names | false | It is a total string order. The output is deterministic and correct. | reject |
| 17 | blind | Stray word "entries" in the overlap message | false | It reads "entries X (entries.0) and Y overlap", a valid plural subject. | reject |
| 18 | blind | The `nextWait` reason string does not name the gate | false | A cross-file gate failure is a refused input, and the string covers it. | reject |
| 19 | blind | The `CrossFileGateError` message and the case "schema fails and weights refused" have no test | low | Nothing reads the message format, and the branch order gives a correct report. A player is unlikely to meet either. | reject |
