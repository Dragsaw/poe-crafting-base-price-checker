---
title: 'Story 7.3: Regenerate tracked.json for T1 and T2'
type: 'chore'
created: '2026-11-15'
status: 'ready-for-dev'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-7-context.md'
  - '{project-root}/.claude/skills/tracked-json/SKILL.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 509 active crafted entries carry a band that spans T1 and T2. 586 references are T1-only where T1 first appears above 79, so at the league-start level their Combination never counts. 1,152 floors sit above what `needs` gives, a residue of the retired shared floor (FR-22, FR-38).

**Approach:** A committed script, `pnpm tracked:regenerate`, rewrites every active crafted entry of `data/tracked.json` from `core`'s `needs`, `ownInterval` and `contains` over the Weights File. Each contained tier becomes its own reference, banded on its own interval (AD-11). A T1-only reference whose T1 floor is above `min(CRAFTING_ITEM_LEVELS)` gains its T2 sibling. Entries are the prefix × suffix product of the variants, each with floor `max(needs(prefix), needs(suffix))`.

## Boundaries & Constraints

**Always:** Raw entries and the 14 pruned tombstones stay byte-identical. A generated entry whose class and references, ignoring floor and label, equal a tombstone's is dropped, so no pruned Combination is revived. The script is deterministic and idempotent: a second run gives a byte-identical file. A replaced span is deleted, never pruned, and the `data` commit message names that as an exception to the FR-15 prune tombstone, as Story 5.1 did. Weights load through `loadWeights`. The story AC, not the skill's lookup-only rule, is the authority for the script reading the Weights File. The script writes `JSON.stringify(file, null, 2) + '\n'`. Generated entries take the position of their source entry, T1 before T2, prefix-major, with the first occurrence of a canonical key kept. Field order is `kind, categoryId, className, itemLevelMin, prefix, suffix, status`.

**Never:** No change to app packages (`packages/*`), to any other `data/` file, or to an owner document. No pruning of rows on the script's own judgment. No `pnpm sync` against the live API.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Span | band contains T1 and T2 | two references, each one tier's `ownInterval`, labelled `T1` and `T2` |
| Overlapping tiers | Bows lightning span, T1 `interval` `[101.5, 123]`, T2 `[79, 103]` | T1 `[103.5, 123]`, T2 `[80.5, 103]`; both load |
| T1 above low level | only T1 contained, T1 `itemLevelMin` 82 | T1 and T2 references |
| Both affixes qualify | both slots as above | four entries |
| T1 at or below 79 | only T1 contained, T1 floor 75 | one reference, banded on its `ownInterval` |
| Hybrid | hybrid span | one reference per hybrid tier, each banded line on that tier's line `ownInterval` |
| Summed pair | one `statId` in both slots | entry byte-identical |
| Floor | prefix needs 75, suffix needs 81 | `itemLevelMin` 81 |
| Duplicate | two sources produce one canonical key | written once |
| Tombstone combination | generated refs equal a pruned entry's | not written |
| Unlabelled contained tier | `tierLabel` absent | script throws, names the entry, and writes nothing |

**Decisions (human, 2026-11-14):** The T2 sibling is the family tier labelled `T2`. A family with no `T2` tier gets no sibling (Crossbows "Loads # additional bolts", `explicit.stat_1967051901`, 6 entries), and the report names those entries.

**Decisions (human, 2026-11-15):** Story 7.5 resolves the former AD-17 blocker. Every reference with a contained tier, whether split, given a sibling or left single, is banded on that tier's `ownInterval` (SKILL.md step 4). A single-tier reference whose band already equals it stays byte-identical. Valueless references and summed pairs keep their bands.

</frozen-after-approval>

## Code Map

- `.claude/skills/tracked-json/scripts/lookup-weights.ts` -- `loadWeights`, `ReadJson`, `SLOTS`. Reuse them.
- `.claude/skills/tracked-json/scripts/lookup.ts` -- entry pattern (`isInvokedDirectly` from `tools/entry-guard/`). Copy it.
- `packages/core/src/index.ts` -- `needs`, `interval`, `ownInterval`, `contains` (`isContaining(ref, entry, pool, summed?)`, now takes the pool), `lineSet`, `statIds`, `untrackable`, `poolOf`, `CRAFTING_ITEM_LEVELS`. Import these and reimplement none of them.
- `packages/contracts/src/canonical-key.ts` -- `canonicalKey` for dedupe.
- Wiring is in place: the skill scripts glob is in `knip.json`, `tsconfig.tools.json`, `eslint.config.mjs` and the vitest `root` project. Only `package.json` needs a `tracked:regenerate` script.
- Tier family: pool entries with `weight > 0`, `!untrackable`, and `lineSet` equal to `statIds(ref)`. A tier is one family entry, not one label: the Crossbows family has two `T1` entries.
- Summed pairs (one `statId` in both slots; Amulets and Rings, 2 entries): the script keeps them byte-identical. Their containment is per `statId` (`summed` argument), so splitting them is not defined.
- Dry run on HEAD `822da15` (scratch prototype `proto-7-3.ts`, session scratchpad, `uniform` mode, which matches the 2026-11-15 decisions): 542 span references split, 586 T1 references gain a T2 sibling, 6 have no T2, 193 single references move to their own interval, 0 duplicates, 0 tombstones revived, matched by band and by contained tier. Result: 3,362 active crafted rows plus 90 raw. `tracked:check` passes all five checks with 0 issues, 0 unreachable and 0 unvalidated. `pnpm test:data` passes. 594 active keys are kept, so most crafted rows read unpriced until the rotation refills them.
- NFR-6 measured on the dry-run file (`time-7-3.ts`, every active entry priced synthetically, `rank` ranks every recipe in one pass): fastest of 5 is 61.5 ms at 79 and 89.6 ms at 82. The committed list gives 16.9 and 57.0 ms. The 100 ms bound of `packages/core/src/rank/purity-and-budget.test.ts:102` holds, with a thin margin at 82.
- Budget references: search limit 100/h without the cookie, 200/h with it (`docs/research/technical-poesessid-vs-oauth-for-trade-api-rate-li-2026-10-02/digests/capture-trade2-headers.md:38`). One entry costs one search (AD-12).

## Tasks & Acceptance

**Execution:**
- [ ] `.claude/skills/tracked-json/scripts/regenerate-entries.ts` -- pure `regenerateEntries(tracked, weights)` that returns the new file and a summary: split, sibling, rebanded-single, no-T2 (with entry paths), dropped-as-duplicate and dropped-as-tombstone counts.
- [ ] `.claude/skills/tracked-json/scripts/regenerate.ts` -- entry: read `data/tracked.json` and the weights, write the file, and print the summary as JSON.
- [ ] `.claude/skills/tracked-json/scripts/regenerate.test.ts` -- one test per matrix row on synthetic pools, including an overlapping-tier split that uses the own interval, plus idempotence, summed-pair and raw/pruned byte-identity. No network.
- [ ] `package.json` -- `"tracked:regenerate": "node .claude/skills/tracked-json/scripts/regenerate.ts"`.
- [ ] `.claude/skills/tracked-json/SKILL.md` -- fix "They only read" and name `tracked:regenerate` in one bullet.
- [ ] Commit the script (`feat(tools): ...`). Then run it and commit `data/tracked.json` alone (`chore(data): ...`), with the FR-15 exception line and the counts in the body.
- [ ] Measure NFR-6 on the committed result with a scratch script outside the repo, as in the Code Map: both levels, fastest of 5. Record it in Implementation Notes.

**Acceptance Criteria:**
- Given the regenerated file, when `pnpm tracked:check` runs, then it exits 0 with all five checks `passed`, `unreachable` empty and `unvalidated` empty.
- Given the regenerated file, when the script runs again, then `git diff` is empty.
- Given the change, when `pnpm check` and `pnpm test:data` run, then both pass.
- Given the report, then it names `data/tracked.json`, the change and the reason. It states the active crafted row count read from the file, the rotation time at 100/h and 200/h against UJ-6, and the NFR-6 timing.

## Design Notes

Rotation at the dry-run count: 3,452 searches is about 34.5 h without the cookie and about 17.3 h with it. That is within UJ-6's "about a day and a half" and "within a day". The re-key orphans most price history. That is accepted, because the league reset on 2026-12-11 wipes prices (epic context).

## Verification

**Commands:**
- `pnpm tracked:regenerate && pnpm tracked:check` -- expected: exit 0, as in the AC.
- `pnpm check` and `pnpm test:data` -- expected: pass.

**Agent browser checks:** The implementing agent runs these in a named session with `pnpm dev` in the background, and runs `pnpm dev:stop` at the end.
1. **Perfect list at 82:** the page renders crafted rows, unpriced rows read as pending, and there is no page error. Take a screenshot.
2. **A split class (Bows):** open the row. The expansion lists the T1 and T2 combinations with their labels. Take a screenshot.
3. **Filter modal:** generating the filter shows no error. Take a screenshot.

## Implementation Notes

## Spec Change Log

## Review Triage Log
