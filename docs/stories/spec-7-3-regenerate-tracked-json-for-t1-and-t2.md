---
title: 'Story 7.3: Regenerate tracked.json for T1 and T2'
type: 'chore'
created: '2026-11-14'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-7-context.md'
  - '{project-root}/.claude/skills/tracked-json/SKILL.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 509 active crafted entries carry a band that spans T1 and T2. 586 references are T1-only where T1 first appears above 79, so at the league-start level their Combination never counts. 1,152 floors sit above what `needs` gives, a residue of the retired shared floor (FR-22, FR-38).

**Approach:** A committed script, `pnpm tracked:regenerate`, rewrites every active crafted entry of `data/tracked.json` from `core`'s `needs`, `interval` and `contains` over the Weights File. Each contained tier becomes its own reference. A T1-only reference whose T1 floor is above `min(CRAFTING_ITEM_LEVELS)` gains its T2 sibling. Entries are the prefix × suffix product of the variants, each with floor `max(needs(prefix), needs(suffix))`.

## Boundaries & Constraints

**Always:** Raw entries and the 14 pruned tombstones stay byte-identical. A generated entry whose class and references, ignoring floor and label, equal a tombstone's is dropped, so no pruned Combination is revived. The script is deterministic and idempotent: a second run gives a byte-identical file. A replaced span is deleted, never pruned, and the `data` commit message names that as an exception to the FR-15 prune tombstone, as Story 5.1 did. Weights load through `loadWeights`. The story AC, not the skill's lookup-only rule, is the authority for the script reading the Weights File. The script writes `JSON.stringify(file, null, 2) + '\n'`. Generated entries take the position of their source entry, T1 before T2, prefix-major, with the first occurrence of a canonical key kept. Field order is `kind, categoryId, className, itemLevelMin, prefix, suffix, status`.

**Never:** No change to app packages (`packages/*`), to any other `data/` file, or to an owner document. No pruning of rows on the script's own judgment. No `pnpm sync` against the live API.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Span | band contains T1 and T2 | two references, each one tier's `interval`, labelled `T1` and `T2` |
| T1 above low level | only T1 contained, T1 `itemLevelMin` 82 | T1 and T2 references |
| Both affixes qualify | both slots as above | four entries |
| T1 at or below 79 | only T1 contained, T1 floor 75 | one reference, unchanged band |
| Hybrid | hybrid span | one reference per hybrid tier, each line banded from that tier |
| Floor | prefix needs 75, suffix needs 81 | `itemLevelMin` 81 |
| Duplicate | two sources produce one canonical key | written once |
| Tombstone combination | generated refs equal a pruned entry's | not written |
| Unlabelled contained tier | `tierLabel` absent | script throws, names the entry, and writes nothing |

**Decisions (human, 2026-11-14):** The T2 sibling is the family tier labelled `T2`. A family with no `T2` tier gets no sibling (Crossbows "Loads # additional bolts", `explicit.stat_1967051901`, 6 entries), and the report names those entries.

</frozen-after-approval>

## Open Questions

1. **BLOCKED on an AD-17 change (the human's decision, 2026-11-14).** "Adds # to # Lightning Damage" (`explicit.stat_3336890334`) appears on Bows, Crossbows, Spears and Quarterstaves. Its averaged intervals overlap: T2 [79, 103] and T1 [101.5, 123]. A T1 entry beside a T2 entry is therefore refused at load (FR-16, 26 overlap issues in the dry run). This affects 20 references: 15 spans and 5 T1-only references that would gain a T2 sibling. The human wants a split in which T1's minimum does not overlap T2's maximum. Measured: T1 `[103.5, 123]` is refused by `tracked:check` as `empty-containment-set` on 26 entries, and the same 26 are listed `unreachable`. `needs` returns `undefined` for them, because `isCovering` (`packages/core/src/probability.ts:89`) requires the band to cover the tier's whole `interval`. Lowering T2's maximum fails in the same way. The loadable fallbacks were offered and declined: keep the span, T2 only, or T1 only. 7.3 resumes once the architect amends AD-17 containment for overlapping averaged tiers. The rest of the plan does not depend on it.

## Code Map

- `.claude/skills/tracked-json/scripts/lookup-weights.ts` -- `loadWeights`, `ReadJson`. Reuse these.
- `.claude/skills/tracked-json/scripts/lookup.ts` -- entry pattern (`isInvokedDirectly` from `tools/entry-guard/`). Copy it.
- `packages/core/src/index.ts` -- `needs`, `interval`, `contains`, `lineSet`, `statIds`, `untrackable`, `poolOf`, `CRAFTING_ITEM_LEVELS`. Import these and reimplement none of them.
- `packages/contracts/src/canonical-key.ts` -- `canonicalKey` (returns a string) for dedupe.
- Wiring is already in place: the skill scripts glob is in `knip.json`, `tsconfig.tools.json`, `eslint.config.mjs` and the vitest `root` project. Only `package.json` needs a `tracked:regenerate` script.
- Tier family: pool entries with `weight > 0`, `!untrackable`, and `lineSet` equal to `statIds(ref)`. A tier is one family entry, not one label: the Crossbows family has two `T1` entries.
- Dry run (scratch prototype, fallback (a) for Q1, (a) for Q2): 3,336 active crafted rows plus 90 raw. `tracked:check` passes all five checks, with 0 unreachable and 0 unvalidated. The two summed pairs (Amulets, Rings) pass. No tombstone is revived. Of 2,110 crafted dataset observations, 589 keep their key, so most crafted rows read unpriced until the rotation refills them.
- Budget references: search limit 100/h without the cookie, 200/h with it (`docs/research/technical-poesessid-vs-oauth-for-trade-api-rate-li-2026-10-02/digests/capture-trade2-headers.md:38`). One entry costs one search (AD-12). NFR-6 reference: `packages/core/src/rank/purity-and-budget.test.ts:102` (100 ms).

## Tasks & Acceptance

**Execution:**
- [ ] `.claude/skills/tracked-json/scripts/regenerate-entries.ts` -- pure `regenerateEntries(tracked, weights)` returning the new file and a summary (split, sibling, dropped-as-duplicate, dropped-as-tombstone counts, and the Q1/Q2 cases).
- [ ] `.claude/skills/tracked-json/scripts/regenerate.ts` -- entry: read `data/tracked.json` and the weights, write the file, and print the summary as JSON.
- [ ] `.claude/skills/tracked-json/scripts/regenerate.test.ts` -- one test per matrix row on synthetic pools, plus idempotence and raw/pruned byte-identity. No network.
- [ ] `package.json` -- `"tracked:regenerate": "node .claude/skills/tracked-json/scripts/regenerate.ts"`.
- [ ] `.claude/skills/tracked-json/SKILL.md` -- fix "They only read" and name `tracked:regenerate` in one bullet.
- [ ] Commit the script (`feat(tools): ...`), then run it and commit `data/tracked.json` alone (`chore(data): ...`), with the FR-15 exception line and the counts in the body.
- [ ] Measure NFR-6: a scratch script, outside the repo, that runs `rank` over the regenerated file with every active entry priced synthetically in memory, at both levels and both recipes, fastest of 5. Record the result in Implementation Notes.

**Acceptance Criteria:**
- Given the regenerated file, when `pnpm tracked:check` runs, then it exits 0 with all five checks `passed`, `unreachable` empty and `unvalidated` empty.
- Given the regenerated file, when the script runs again, then `git diff` is empty.
- Given the change, when `pnpm check` and `pnpm test:data` run, then both pass.
- Given the report, then it names `data/tracked.json`, the change and the reason. It states the active crafted row count read from the file, the rotation time at 100/h and 200/h against UJ-6, and the NFR-6 timing.

## Design Notes

Rotation estimate at the dry-run count: 3,426 searches is about 34 h without the cookie and about 17 h with it. That is within UJ-6's "about a day and a half" and "within a day". The re-key orphans most price history. That is accepted, because the league reset on 2026-12-11 wipes prices (epic context).

## Verification

**Commands:**
- `pnpm tracked:regenerate && pnpm tracked:check` -- expected: exit 0, as in the AC.
- `pnpm check` and `pnpm test:data` -- expected: pass.

**Agent browser checks:** The implementing agent runs these in a named session with `pnpm dev` in the background, and runs `pnpm dev:stop` at the end.
1. **Perfect list at 82:** the page renders crafted rows, unpriced rows read as pending, and there is no page error. Take a screenshot.
2. **A split class (Bows):** open the row. The expansion lists T1 and T2 combinations with their labels. Take a screenshot.
3. **Filter modal:** generating the filter shows no error. Take a screenshot.

## Implementation Notes

## Spec Change Log

## Review Triage Log
