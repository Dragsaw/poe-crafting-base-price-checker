# Epic 5 Context: Weights fidelity

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 5 makes the crafted valuation match what the game can really roll. On Wands and Staves, an elemental damage prefix stops the other elements' spell-level and ailment suffixes from rolling, and the reverse. `modGroup` cannot express this, because the effect crosses groups and slots. The weights contract therefore moves to `7.0.0` with two blocking-tag fields. `core` removes blocked entries from the second draw, and a new cross-file check rejects a tracked combination that the game cannot roll in either draw order. The player then reads Wand and Staff rows valued on co-rollable modifiers only, and an impossible combination is never ranked. The epic adds no state, string or control to the page. Owners: `WEIGHTS-FILE-SCHEMA.md` `7.0.0`, `ARCHITECTURE-SPINE.md` revision 39 (AD-11, AD-17), PRD revision 30 (FR-1, FR-4, unchanged), `EXPERIENCE.md` states 15a and 27, and `docs/research/technical-poe2-no-tag-mod-blocking-2026-10-23/research.md` for the game data. Acceptance criteria cite these documents and copy no rule.

## Stories

- Story 5.1: Blocking mod tags in the second draw

## Requirements & Constraints

- Epic 5 retouches FR-1 and FR-4. Their ownership stays with Epic 3. NFR-1, NFR-3 and NFR-8 apply.
- A `7.0.0` weights file loads. A `6.x` file is refused as an unknown major. Each `7.0.0` hard error refuses the file (`WEIGHTS-FILE-SCHEMA.md` *7.0.0* and *Validation*; NFR-8).
- A combination the game cannot roll is a validation error, never a probability of `0` (FR-4). It makes its Item Class Unrankable under the existing cross-file reason. One reason covers every cross-file check, and the failed check and entry are diagnosis only (FR-4).
- Classes where no blocking tag decides (Foci, jewels) must give exactly the probabilities they gave before the epic (research doc, *Not affected*).
- Tracked entries that fail the co-rollable check are **deleted** from `data/tracked.json`, not pruned. This is a named exception to the prune tombstone (FR-15), and the commit message says so. The story derives the list from `pnpm tracked:check` and never copies a fixed list or count.
- No test makes a network call (NFR-1). `pnpm check` is green at the end.

## Technical Decisions

- **Contract (AD-11, `WEIGHTS-FILE-SCHEMA.md` `7.0.0`).** Every entry carries the required `addsTags` and `blockedByTags`. The producer resolves `blockedByTags` per class. `core` reads the two fields only for AD-17's exclusion, and never parses `sourceModifierId`. Weights, `modGroup`, `lines`, the `className` grammar and the `6.x` hard errors are unchanged.
- **Draw model (AD-17, *The exclusivity rule*).** The second draw removes every entry of the other slot that shares the first affix's `modGroup`, or whose `blockedByTags` meets the first affix's `addsTags`, and then renormalises. The step order with the recipe floor and scope stays as AD-17 fixes it in `combinationProbability`. Where no group and no tag crosses the slots, the result stays exactly `P(prefix) × P(suffix)`. An augment left with no eligible entry makes the `(itemClass, recipe)` pair unrankable, never a zero.
- **Co-rollable combination check (AD-17 cross-file table).** One exported pure function in `packages/core/src/cross-file/co-rollable.ts`. Every shell calls it: `web` at load (report and still render), the `sync` run-start gate (abort before any search, record in `sync-report.json`), and `pnpm tracked:check` (name the entry, exit non-zero). It is crafted-only, and its payload names the entry by canonical key. Where the weights file cannot answer, the entry is unvalidated, not failed.
- **Reach rule (AD-17).** An `(entry, recipe)` pair with probability `0` is unreachable. `pnpm tracked:check` lists it under `unreachable` and exits non-zero. Ranking keeps the unrankable backstop.
- **Game data (research doc).** Only five `no_*` tags act on items, one per spell element. Wands and Staves are the only tracked classes affected. The research doc's Wand example (`increased Cold Damage`) gives the expected second-draw suffix pool.
- **Edits to `data/tracked.json`** follow the `tracked-json` skill and end with `pnpm tracked:check` at exit 0 (`AGENT-WORKFLOW.md`). Tests use fixtures and never edit `data/`.

## UX & Interaction Patterns

- No new view work. A co-rollable failure shows through existing states: the Item Class sits in the appendix as Unrankable with the cross-file reason (state 15a), and the sync report's Problems column lists the diagnosis without counting it (state 27).

## Cross-Story Dependencies

- **External producer.** The epic depends on the producer emitting `7.0.0`. Once `contracts` refuses `6.x`, every crafted Item Class is Unrankable until a `7.0.0` `data/weights.json` is committed. Story 5.1 merges only together with that file. A `7.0.0` `data/weights.json` is already committed on this branch.
- The frozen test data in `test/fixtures/frozen-data/` still holds a `6.1.0` `weights.json`. `contracts` will refuse that file, so it moves to `7.0.0` in the same story.
- The epic builds on Epic 3's cross-file checks, probability term and Unrankable appendix, and on Story 4.7's recipe floor and reach verdict.
