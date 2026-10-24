---
title: 'Track all three elemental resistances wherever one is tracked'
type: 'chore'
created: '2026-10-24'
status: 'done'
baseline_commit: 'fe9dd45779d826fd9ee34af8cdaa4a564bcb3eca'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/.claude/skills/tracked-json/SKILL.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 151 crafted entries in `data/tracked.json` pair a prefix with one elemental resistance suffix (Fire on armour and Foci, Cold on Amulets, Rings and Belts), and none has its two sibling elements. A valuable pairing with one element is valuable with the other two, so the recipe EV leaves out two thirds of that population and understates the class.

**Approach:** For each such entry, add the two missing siblings: the same entry with the suffix `statId` swapped to each missing element, at the same band, tier label, floor and status. The result is every resistance-bearing prefix pairing tracked for Fire, Cold and Lightning.

**Decision (search budget, SM-C1, AD-12):** Add all 302 siblings, with no offsetting prunes. The player accepts a full refresh of ~2,030 searches against the ~1,500 ceiling.

## Boundaries & Constraints

**Always:** Follow the `tracked-json` skill. Each sibling takes its band from FR-22 over its own element's tiers. `pnpm tracked:check` exits 0 with `unreachable` empty. The class floors do not move.

**Never:** No change to an existing entry. No Chaos Resistance siblings (not elemental). No edit to any other file in `data/`. No code change beyond the decision below.

**Decision (Lightning short form):** The player allows the code change that `pnpm test:data` needs for the new Lightning entries: a `Lightning Res` short form in `packages/web/src/list/short-forms.ts`, and a remeasured chase-cell budget if the fit check still fails (as commit 8fd63be did). It lands in the same commit as the data.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fire entry | `Boots_dex` prefix X + Fire 41-45 T1 | adds X + Cold 41-45 T1 and X + Lightning 41-45 T1, same `itemLevelMin` | N/A |
| Cold entry | `Belts` prefix X + Cold 36-40 T2 | adds Fire and Lightning at 36-40 T2 | N/A |
| Sibling already tracked | an element entry with the same prefix exists | no duplicate; canonical keys stay unique | `tracked:check` refuses a duplicate key |

</frozen-after-approval>

## Code Map

- `data/tracked.json` -- the only file that changes. 151 crafted entries carry a resistance in the suffix (none in the prefix, none hybrid): Fire in 25 armour classes and Foci, Cold in Amulets (41-45 T1), Rings (36-45 T1-T2) and Belts (36-40 T2).
- Stat ids: Fire `explicit.stat_3372524247`, Cold `explicit.stat_4220027924`, Lightning `explicit.stat_1671376347`.
- `pnpm tracked:lookup tiers <id> --class <c>` -- planning compared the three elements in all 29 classes. T1-T3 are identical in ranges, `itemLevelMin`, weight and recipe reach, and no hybrid tier shares these ids. Lower tiers differ by 1-2 item levels, which no band touches. So the FR-22 band, label and floor of each sibling equal the source entry's.
- `packages/contracts/src/canonical-key.ts` `canonicalKey` -- uniqueness of the new keys.
- `packages/web/src/load/artifacts.ts` -- the page loads `tracked.json`, so new entries show up as tracked but unsynced until the next sync.

## Tasks & Acceptance

**Execution:**
- [x] scratchpad script -- given a `tracked.json` path, insert each missing sibling right after its source entry (order Fire, Cold, Lightning) -- deterministic, so the same edit applies to HEAD's file for staging and to the working tree.
- [x] `data/tracked.json` -- apply the script to the working tree, then run `pnpm tracked:check` -- the data edit.
- [x] `docs/stories/deferred-work.md` -- remove the entry "Track all three elemental resistances…" in the commit that lands the data -- AGENTS.md ledger rule.

**Acceptance Criteria:**
- Given the edited file, when the resistance triplets are counted per (class, prefix), then every group has Fire, Cold and Lightning exactly once.
- Given the edited file, when `pnpm tracked:check` runs, then it exits 0, `unreachable` is empty, and no `cross-file` check is `skipped` that ran before.
- Given story 5.1's uncommitted `tracked.json` edits, when this work is committed, then the commit holds only the added siblings and the ledger removal, and story 5.1's deletions stay unstaged.

## Implementation Notes

- The data edit is done and staged (HEAD-based blob, 1,752 + 302 entries). `pnpm tracked:check` passed. `pnpm test:data` failed 3 tests in `packages/web/src/list/tracked.data.test.ts` because `short-forms.ts` has no Lightning entry. The player then allowed the code change (frozen block).
- The working tree's other uncommitted `tracked.json` edits include the Body Armour Spirit id change and 7 Rings suffix changes, not only story 5.1's 24 Wand and Staff deletions. 14 staged siblings carry HEAD's old Spirit id, the same as their staged source entries.
- Commit 38746be landed while this work ran. It holds the ledger removal of this entry, so the data commit will not. It also cleared the index. The script re-ran on the new HEAD's `tracked.json` (identical to fe9dd45's) and gave the same blob, which is staged again.
- `packages/web/src/list/short-forms.ts`: added `'explicit.stat_1671376347': 'Lightning Res'`, staged. The fit check passed without a budget remeasure.
- Staged: `data/tracked.json` and `short-forms.ts` only. The story 5.1 edits stay unstaged.
- `pnpm test:data`: 7/7 passed. `pnpm check`: 8 passed, 0 failed (dup, depcruise, knip, typecheck, lint, build, test:data, test).

- After review: the staged state alone (HEAD 0596909 + 302) failed `tracked:check`, as HEAD did alone, because the Spirit and Rings re-key was uncommitted; its extra 14 issues and 28 unreachable pairs were all on the 14 siblings with the old Spirit id. By the player's choice, the story 5.1 data edit was committed first (6f32d36, green alone), and this change was committed on top. On that tree: `tracked:check` passed all five checks, `test:data` 7/7, `pnpm check` 8/8.
- Follow-up (2026-10-24): the player accepts the ellipsis on the Lightning Res chase pairings that overrun the 27-character budget, and keeps `Lightning Res`. Triage row 1 is closed and its deferred entry removed.

### Agent browser checks (before review)

No review had run. The after-review run goes under its own heading.

- Session `poe-79ae64f4395d`, run at 2026-10-24 14:22 local, against HEAD `38746be99c1f6a19396b35ca213131ec1e051e60`. The tree was dirty: the staged change plus the story 5.1 work.
- Load: passed. The page showed no refusal and no cross-file error, the console had no errors, the appendix showed "Unrankable — 0 Item Classes", and the list rendered with its ranked rows.
- New entries visible: passed. The Boots (Dex) row listed six new combinations: % EV, Mov Spd and EV, each with Cold Res and with Lightning Res. Each showed `—` and "pending · not checked yet". The Fire Res source rows were unchanged: Mov Spd · Fire Res and EV · Fire Res each showed 1.00 rough, and % EV · Fire Res showed 0.02, below threshold. Screenshot: `C:/Users/ilyal/AppData/Local/Temp/claude/E--Program-Files-Jetbrains-Projects-poe-crafting-base-price-checker/52cafe76-17a2-4a94-8730-9570816934dc/scratchpad/boots-dex-siblings.png`.
- `pnpm dev:stop`: stopped the server and freed port 5173.

### Agent browser checks (after review)

- Session `poe-79ae64f4395d`, run 2026-10-24 16:52–16:53 local, against HEAD `6f32d361ee91a5a6e6cf2149894c5fd349d6917c`. The tree was dirty: only this spec's change (`data/tracked.json`, `packages/web/src/list/short-forms.ts`, `docs/stories/deferred-work.md` and this spec), unstaged.
- Load: passed. There was no refusal and no cross-file load error, `agent-browser errors` was empty, the console had no errors or warnings, the appendix read "Unrankable — 0 Item Classes", and the ranked list rendered with "+ Read the remaining 21 rows". Screenshot: `C:/Users/ilyal/AppData/Local/Temp/claude/E--Program-Files-Jetbrains-Projects-poe-crafting-base-price-checker/52cafe76-17a2-4a94-8730-9570816934dc/scratchpad/after-review-load.png`.
- New entries visible: passed. The Boots (Dex) row listed six new combinations: % EV, Mov Spd and EV, each with Cold Res and with Lightning Res. Each showed `—` and "pending · not checked yet", with no price. The Fire Res source rows were unchanged: Mov Spd · Fire Res and EV · Fire Res each showed 1.00 rough, priced 7 days ago, and % EV · Fire Res showed 0.02, below threshold. Screenshot: `C:/Users/ilyal/AppData/Local/Temp/claude/E--Program-Files-Jetbrains-Projects-poe-crafting-base-price-checker/52cafe76-17a2-4a94-8730-9570816934dc/scratchpad/after-review-boots-dex-siblings.png`.
- `pnpm dev:stop`: stopped PID 12044 and freed port 5173.

## Spec Change Log

## Review Triage Log

Pass 1 (2026-10-24). Diff: the staged change against HEAD `38746be`, histogram algorithm (the baseline `fe9dd45` predates the player's story 5.1 commits).

| # | Layer | Finding | Verdict | Evidence | Route |
|---|-------|---------|---------|----------|-------|
| 1 | design | `Lightning Res` makes ~68 new chase texts overrun the 27-character budget; `T1 Added Lightning · T1-T2 <el> Res` siblings may read the same in the cell | medium | EXPERIENCE.md *Combinations and short forms*: an overrun ends in an ellipsis; *Escape valve* makes it a pruning candidate, the player's call | defer |
| 2 | blind | `Lightning Res` margin unrecorded; consider `Ltng Res` | medium | same root cause as 1; a shorter coinage is ruled out by *Escape valve* and coining rule 2 | grouped with 1 |
| 3 | design | no live-data chase-budget check | medium | `combination-fit.test.ts` reads the frozen fixture only; Fire hybrid overruns at HEAD are already unreported, so the gap predates this change | defer |
| 4 | blind | SM-C1 ceiling exceeded, not recorded with the PRD | medium | 2,030 vs ~1,500; the list was at 1,728 before; the PRD is PM-owned (Review brief rule 2) | defer, note for PM |
| 5 | blind | `tracked-json` skill does not state the sibling rule | low | SKILL.md has no such rule; the fix edits agent context | defer |
| 6 | blind | no lasting guard for triplet completeness | low | no product rule (FR) requires triplets; a new check adds surface for a curation preference; covered by 5 | reject |
| 7 | blind | Cold-source groups come out Cold, Fire, Lightning | low | siblings follow their source; entry order has no effect on the canonical key, sync or rank | reject |
| 8 | blind | 14 staged siblings carry HEAD's old Spirit id | low | their staged source entries carry the same id; the unstaged Spirit re-key covers both; named in the commit message | reject |
| 9 | blind | generator script not kept in the repo | low | one-shot curation edit; the data is the artifact and `tracked:check` validates it | reject |
| 10 | blind | `Lightning Res` placed apart from `Cold Res` | false | the table is not grouped by family: `Fire Res` already sits apart from `Cold Res`; the new line sits next to `Fire Res` | reject |
| 11 | blind | class EV and trust unchecked while siblings are unpriced | false | an unsynced entry is handled the same as any new entry; the browser check saw "Unrankable — 0 Item Classes" and unchanged Fire rows | reject |
| 12 | blind | time to first price for 302 entries unstated | maybe-false | settled by AD-7's rotation order for never-attempted entries; would only be low, since the player accepted the budget | reject |
| 13 | edge | AC3 names a ledger removal the commit does not hold | low | 38746be removed it (Implementation Notes); the fix edits this spec | reject |
| 14 | verification | the staged state alone was not run through `tracked:check` | maybe-false | every run read the working tree; the reviewer's own run was denied permission; settled by checking the staged blob | raised with the player |

## Design Notes

Commit separation: run the script on `git show HEAD:data/tracked.json`, write the blob with `git hash-object -w`, and stage it with `git update-index --cacheinfo`. First confirm that the 24 Wand and Staff entries that story 5.1 deletes carry no resistance, so that both runs add the same 302 entries.

## Verification

**Commands:**
- `pnpm tracked:check` -- expected: exit 0, `ok: true`, `unreachable: []`.
- `pnpm test:data` -- expected: green.
- `pnpm check` -- expected: green, or failing only where it failed before this change (story 5.1 is in progress in the same tree).

**Agent browser checks:** The implementing agent runs these itself, with a named session (`agent-browser session id --scope worktree --prefix poe`, `--session <id>` on every call). Start `pnpm dev` in the background and run `pnpm dev:stop` at the end. Record the results per `_bmad/custom/prompts/agent-browser-checks.md`.
- **Load:** Open the app. Expected: no refusal and no cross-file load error. The list renders as it did before the edit.
- **New entries visible:** Find a Boots_dex Cold or Lightning sibling in the list or the appendix and take a screenshot. Expected: it shows as tracked and unsynced, with no price, and its Fire source row is unchanged.
