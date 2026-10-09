---
title: 'Price summed-statId entries with one summed filter'
type: 'feature'
created: '2026-10-04'
status: 'done'
route: 'dispatch'
baseline_commit: '0080268ced283a821ac4c1efcb2b4c9623db887e'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/archive/spec-tracked-hybrid-mods/SPEC.md'
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An entry whose prefix and suffix name one `statId` (committed: Amulets rarity, `data/tracked.json` entry 161) sends two filters on that id, and trade compares each against the summed value. Overlap runs with `S = ∅`, and no rule refuses a valueless summed operand or one `statId` under two kinds. SPEC-tracked-hybrid-mods CAP-6 and §2.3's within-file half.

**Approach:** Implement IMPLEMENTATION-NOTES §2.1 and §2.2 with `S`, §2.3's three within-file refusals in `TrackedFileSchema`, and §5.5's summed filter in the search body. Cite the sections; do not restate them.

## Boundaries & Constraints

**Always:** `summed(e)` is defined once in `contracts` and both shells use it. `contracts` and `core` keep §2.1's pair split (*Who evaluates a pair*). An overlap payload names both keys, the slots and each summed `statId` whose intervals intersect. The within-file rules skip `pruned` entries and `raw` entries, as the floor and overlap rules do. Sums are plain addition, never rounded (AD-16). Follow the AGENTS.md MCP tool rule. Use MSW fixtures only, and make no live trade calls.

**Never:** Edit an owner document or `data/`. Bump a schema version. Labels (story 8). `lookup.ts`, `SKILL.md`, the §5.1d capture (story 9). Probability, edge alignment or §2.7 for summed lines: they stay per slot (§5.5).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Pure + pure | rarity prefix 16–19, suffix 15–18 | one `explicit.stat_3917489142` filter, `{min:31,max:37}` | N/A |
| Hybrid + pure | hybrid prefix {A,B}, banded suffix on B | one summed B filter, one A filter | N/A |
| Hybrid + hybrid | Bows phys%+acc hybrid prefix, `LightRadiusAndAccuracy` hybrid suffix | one `stat_691932474` filter with summed accuracy bands, one `stat_1509134228` (phys%) and one `stat_1263695895` (light radius) filter; no repeated id | N/A |
| Sum overlap | two entries, disjoint per-slot bands, intersecting sums | overlap; payload names the summed `statId` and both intervals | refused (`contracts`) / `co-occur` (`core`, if a hybrid) |
| Sum disjoint | summed intervals disjoint | no overlap | N/A |
| One side sums | only one entry sums `s` | `s` compared per slot | N/A |
| Valueless operand | a summed `statId` with a valueless line in either slot | issue names entry, slot, `statId` | refused |
| Missing bound | summed operand lacks `valueMax` | shape issue at that slot | refused |
| Kind clash | `statId` banded in one line, valueless in another, any entry/slot/line | issue at the later line names both locations | refused |
| Divergence fixture | summed filter vs listings: low T2 prefix + high T1 suffix | MSW returns it in the priced set; per-slot `contains` excludes its prefix tier | N/A |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/overlap.ts` -- export `summedStatIds(affixes)` and `linesOf`. `CoOccur` gains a `summed: ReadonlySet<string>` parameter. `slotOverlapBranch` takes `S`: new branch `'summed'` ("names only summed statIds") when either ref names nothing outside `S`. Shared ids and `linesIntersect` run outside `S`. `overlapBranches` computes `S` and returns `{ prefix, suffix, sums }` (`sums` = intersecting summed `statId`s and both intervals), or `undefined`. A sum with a valueless operand never intersects, because the schema refuses it. `describeOverlap` prints the sums. Update the module doc (no `S = ∅`).
- `packages/contracts/src/envelopes.ts:58-124` -- add the two §2.3 rules to `TrackedFileSchema.superRefine`. The issue path is the offending line (`entries.i.prefix[.lines.j]`). Update the doc comment.
- `packages/contracts/src/index.ts` -- export new symbols.
- `packages/core/src/probability.ts:163` -- `contains(ref, entry, summed = ∅)`: a reference line on a summed `statId` drops the band test and keeps the line-set test (§2.2 `contains_S`). For a single-line reference, this means a line on that `statId`.
- `packages/core/src/cross-file.ts:347-366` -- `coOccur` passes `summed` into `contains` and its cache key. Update the doc. The pair loop needs no change.
- `packages/sync/src/pricing/search-body.ts:151-172` -- `statFiltersOf`: a prefix filter on a summed id becomes the §5.5 sum. The suffix filter on that id is dropped. A missing operand bound throws (it cannot pass the schema).
- Tests: `contracts/src/overlap.test.ts` (stubs at `:26-40`, `:161-175`), `envelopes.test.ts`, `core/src/cross-file.test.ts` (helpers `tier`, `line`, `band`, `pools`, `bows`), `probability.test.ts`, `sync/src/pricing/search-body.test.ts` (`:202+`), and a new `price-entry.summed.test.ts` modelled on `price-entry.hybrid.test.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/{overlap,envelopes,index}.ts` + tests -- §2.1 with `S`, the sum payload, and the §2.3 within-file refusals.
- [x] `packages/core/src/{probability,cross-file}.ts` + tests -- `contains_S` and `coOccur(…, S)`. Add a hybrid pair whose shared line is summed: the sum decides.
- [x] `packages/sync/src/pricing/search-body.ts` + `search-body.test.ts` -- the summed filter for all three operand pairs.
- [x] `packages/sync/src/pricing/price-entry.summed.test.ts` -- an MSW body test for rarity and for the Bows hybrid + `LightRadiusAndAccuracy` hybrid, plus the divergence fixture.

**Acceptance Criteria:**
- Given the repo, when running `pnpm typecheck`, `pnpm lint` and `pnpm test`, then all pass.
- Given the committed data, when running `pnpm tracked:check`, then it exits 0 and `git diff --stat data/` is empty.
- Given `packages/`, when searching for `S = ∅`, then nothing matches.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Route | Evidence |
|---|-------|---------|---------|-------|----------|
| 1 | verification-gap, blind | `coOccur` cache key now includes `S`, but no test proves one instance separates ∅ from a non-empty `S` | medium | patch | Pre-verified gap: one `coOccur` per floor serves every pair of the class (`cross-file.ts` pair loop), so a key without `S` would make `co-occur` failures order-dependent, and reverting the key passes all tests. |
| 2 | verification-gap (other) | Divergence test's `contains` assertions pass no `summed` | false | reject | Matrix row asks that per-slot `contains` excludes the prefix tier; §5.5 says probability stays per slot, so plain `contains` is the intended check. |
| 3 | edge-case | Float noise when summing non-dyadic decimal edges (0.1 + 0.2) | low | reject | Committed bands are integers or half-integers; a rounding fix contradicts the frozen "never rounded (AD-16)". |
| 4 | edge-case, blind | Summed-valueless throw is a plain `Error` that aborts the pricing step | false | reject | `load-data-file.ts:63` parses tracked.json through `TrackedFileSchema`, which refuses that entry first; the throw is unreachable and fails loudly by design. |
| 5 | edge-case, blind | Hybrid issue path `lines.j` counts sorted order, not file order | low | reject | Both messages also name the `statId`, and the doc comment states the order; mapping back to input order needs index tracking across the sort transform. |
| 6 | blind | Kind-clash message names paths, not canonical keys | false | reject | The matrix asks for "both locations"; paths name the lines of the file being validated, so they are current when reported. |
| 7 | blind | Divergence fixture tests its own mock; equal amounts hide which listing priced | false | reject | `t2t2` sums 23, outside [31, 37], so `sampleSize: 2` is exactly `t1t1` + `t2t1`; a trade-modelling mock is what §5.5's fixture requires. |
| 8 | blind | §5.5's single-slot-reaches-the-sum divergence is not pinned | false | reject | CAP-6 and the matrix ask only for the low-prefix + high-suffix fixture; the other population is accepted behaviour, not a defect. |
| 9 | blind | `tradeServerOver` fetch mock accepts any ids | false | reject | Fetch URL production code is pinned by the Bows test in the same file and the other price-entry tests; no wrong behaviour slips through. |
| 10 | blind | MSW harness copied from `price-entry.hybrid.test.ts` | low | reject | Test-only duplication the Code Map asked to model; extracting a shared helper is a refactor beyond a direct correction. |
| 11 | blind | Cache key uses whole `S`, not `S ∩ statIds(x ∪ y)` | low | reject | Cache efficiency only; answers stay correct. |
| 12 | blind | Summed filter is a second inline literal beside `statFilterOfLine` | low | patch | Fixture byte stability relies on one key order (module doc); routing the sum through `statFilterOfLine` is a direct correction. |
| 13 | blind | Spec Implementation Notes empty despite departures from the Code Map | — | reject | Fix is to edit this build's spec. |
| 14 | blind | Valueless+banded summed case asserts paths, not the second (kind-clash) message | low | patch | Both rules legitimately fire (§2.3 rules 1 and 2); asserting the messages is a direct test correction. |
| 15 | blind | Ordering of several sums in one pair untested | low | reject | Two shared summed ids need a hybrid+hybrid pair sharing two lines across slots, which the game data does not hold. |
| 16 | blind | `summed` branch words ambiguous; `NO_SUMMED` defined twice | low | reject | Wording is the Design Notes' text; exporting the empty set adds public surface for a two-line constant. |

## Design Notes

Filter order: a summed filter takes its prefix line's place, so the body stays prefix-then-suffix. Overlap words: `prefix (names only summed statIds), suffix (…); sum explicit.stat_X [31, 37] and [33, 39] intersect`.

## Verification

**Commands:**
- `pnpm typecheck`, `pnpm lint` and `pnpm test` -- expected: all pass.
- `pnpm tracked:check` -- expected: exit 0.
