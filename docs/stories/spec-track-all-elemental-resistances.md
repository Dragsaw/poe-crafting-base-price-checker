---
title: 'Track all three elemental resistances wherever one is tracked'
type: 'chore'
created: '2026-10-24'
status: 'in-progress'
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

**Never:** No change to an existing entry. No Chaos Resistance siblings (not elemental). No edit to any other file in `data/`. No code change.

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
- [ ] scratchpad script -- given a `tracked.json` path, insert each missing sibling right after its source entry (order Fire, Cold, Lightning) -- deterministic, so the same edit applies to HEAD's file for staging and to the working tree.
- [ ] `data/tracked.json` -- apply the script to the working tree, then run `pnpm tracked:check` -- the data edit.
- [ ] `docs/stories/deferred-work.md` -- remove the entry "Track all three elemental resistances…" in the commit that lands the data -- AGENTS.md ledger rule.

**Acceptance Criteria:**
- Given the edited file, when the resistance triplets are counted per (class, prefix), then every group has Fire, Cold and Lightning exactly once.
- Given the edited file, when `pnpm tracked:check` runs, then it exits 0, `unreachable` is empty, and no `cross-file` check is `skipped` that ran before.
- Given story 5.1's uncommitted `tracked.json` edits, when this work is committed, then the commit holds only the added siblings and the ledger removal, and story 5.1's deletions stay unstaged.

## Implementation Notes

## Spec Change Log

## Review Triage Log

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
