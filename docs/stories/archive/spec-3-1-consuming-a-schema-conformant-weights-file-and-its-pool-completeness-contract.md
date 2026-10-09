---
title: 'Story 3.1: Consuming a schema-conformant Weights File and its pool-completeness contract'
type: 'feature'
created: '2026-09-27'
status: 'done'
baseline_commit: '4818ae6e6f96662e6ecff1757ec1382314a149bf'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/WEIGHTS-FILE-SCHEMA.md'
  - '{project-root}/docs/stories/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `weights.json` crosses into the app with only its header typed (`WeightsFileEnvelopeSchema`). `web` accepts a file that has any `bases` shape, and `sync` reads its ids ad hoc. No hard error in `WEIGHTS-FILE-SCHEMA.md` *Validation* refuses a file, so the ranking can rest on a file nobody checked (FR-27, AD-11, epics Story 3.1).

**Approach:** Put the full `6.0.0` contract into `contracts` as one Zod schema. It includes `ModifierWeight` with its nested `lines[]`, and every within-file hard error as schema rules. Both shells load through `parseEnvelope` with that schema, so a non-conforming file is refused as a whole and the refusal names the failure. The `className` grammar has one definition, in `contracts`, and `sync`'s search body and the schema both use it. `core`'s `rank` takes the parsed file and does a direct lookup of each crafted class's pools, which yields the `class absent from weights file` and `pool partial` reasons.

## Boundaries & Constraints

**Always:**
- One Zod schema per concept in `contracts`, with each type `z.infer`red (AD-3). `ModifierWeight` nests `lines[]` and is never flattened.
- The schema rules are exactly the hard errors in `WEIGHTS-FILE-SCHEMA.md` *Validation*, and no others.
- Object schemas are loose (unknown keys pass). Only the major is compared, so a later additive `6.x` file must still load. `tierLabel`, `producer.version` and `producer.sourceUrl` are optional.
- A `null` `statId` is valid data. `sync`'s catalogue check still skips it, and catalogue misses stay report-only (AD-9).
- An absent file keeps its Story 2.8 behaviour unchanged. An invalid file goes through the existing refusal path: `web` shows state 26 with cause `content` or `version`, and `sync` throws a `DataFileError`.

**Never:**
- No component writes, patches or regenerates a weights file.
- No code parses `sourceModifierId` outside the duplicate check, and no code parses or branches on `gamePatch`.
- No arithmetic audit of pool completeness. The app trusts `poolCoverage` as the producer declares it.
- No probability, containment or interval math. That is Story 3.2.
- No cross-file checks. Those are Story 3.3.
- No new refusal-screen copy.

**Decisions (human, 2026-09-27):**
- `rank` reads the parsed file now. `areWeightsLoaded: boolean` becomes `weights: WeightsFile | null`. A crafted entry's class is Unrankable in these cases:
  - `class absent from weights file`, when the file is null or `bases[categoryId][className]` is missing. This is a direct lookup at both rungs, with no sibling fallback.
  - `pool partial`, when either slot declares `partial`.
  - Otherwise `rank` makes no claim, as today. Crafted EV is Story 3.4.
- The app keeps the contract's pool rule unchanged. In the committed data, Emerald and Crossbows are partial only because of data-mined rows that cannot roll. The fix belongs to the producer: it declares `complete` for such a pool. Until it regenerates the file, those two classes show in the appendix as `pool partial`. Record the producer request, and the owner's rewording of the placeholder bullet, in `deferred-work.md`.
- Keep the full spec (about 1,750 tokens).

## I/O & Edge-Case Matrix

| Scenario | Input | Expected |
|---|---|---|
| Conforming | committed `data/weights.json` (6.0.0, 8,437 entries, 17 `null` statIds, 11 partial pools) | Parses. Every entry keeps its `lines[]` nested. |
| Old major | `schemaVersion: "5.1.0"` | Refused as `unknown-major`, before the body is parsed. |
| Hard error | a missing or empty `modGroup`; a negative `weight`; a bad `weightSource`; empty `lines`; `min > max`; 3 range pairs; a duplicate `sourceModifierId` in one slot; a duplicate `statId` in one entry's lines; an empty `gamePatch`; a missing `poolCoverage`; one category that mixes defence-suffixed and plain classes; two defence classes with the same letter set | Each is refused as `invalid`, with an issue path and a message that names the rule. |
| Not an error | the same `sourceModifierId` in `prefix` and `suffix`; `ranges: []`; `weight: 0`; an empty `entries` list | Parses. |
| Rank: absent | `weights: null`, or the pair is missing (including a sibling `className` that is present under the same category) | One appendix row, `class absent from weights file`. |
| Rank: partial | either slot declares `poolCoverage: "partial"` | One appendix row, `pool partial`. |
| Rank: complete | both slots declare `complete` | No appendix row, and no ranked row. |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/envelopes.ts` -- `WeightsFileEnvelopeSchema`, header only; it gets replaced. `parseEnvelope` is the one load path. The `superRefine` duplicate pattern of `TrackedFileSchema` is the model to follow.
- `packages/contracts/src/item-class.ts`, `modifier-ref.ts` -- reuse `CategoryIdSchema`, `ClassNameSchema`, `StatIdSchema`.
- `packages/sync/src/pricing/search-body.ts:111-137` -- `DEFENCE_OF_LETTER`, `defenceLettersOf`, the §10.2 arm-1 split. It moves to `contracts`. `discriminatorOf` stays in `sync`.
- `packages/sync/src/catalogue/weights-ids.ts` -- `readWeightsIds` reads the file ad hoc, and has its own `WEIGHTS_SCHEMA_VERSION`. `checkWeightsIds` and `weightsAbsentRecord` stay as they are.
- `packages/web/src/load/artifacts.ts:22,50` -- `WEIGHTS_EXPECTED_VERSION`, and the `ARTIFACTS.weights` descriptor. `load-artifacts.ts` needs no change.
- `packages/web/src/frame/trust-facts.ts:41` -- `weightsFacts` reads `producer.id`, `generatedAt` and `gamePatch` through `Parsed<'weights'>`. It keeps working unchanged.
- `packages/web/src/test-support/artifact-server.ts:56` -- the weights fixture (`bases: {}`), which already conforms.
- `docs/stories/deferred-work.md:96-100` -- the Story 2.1 entry "`WeightsFileEnvelopeSchema` ... is a stopgap". This story discharges it.
- `packages/core/src/rank.ts:55-66,169-176` -- the `areWeightsLoaded` input, the `UnrankableReason` union and the crafted branch. The callers are `packages/web/src/App.tsx:134`, `packages/web/src/test-support/dom.tsx:69`, `rank.test.ts`, `display-rows.test.ts` and `list-statement.test.ts`. The `areWeightsLoaded` parameter of `trust-facts.ts` `panelColumns` is a different flag, so leave it.
- `packages/web/src/list/UnrankableAppendix.tsx:113` -- prints `item.reason` verbatim, so the new reason needs no web change.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/class-name.ts` -- move `DEFENCE_OF_LETTER`, `DefenceLetter` and `defenceLettersOf` here and export them from `index.ts`. -- The grammar is defined once, and both the refine and the search body use it.
- [x] `packages/contracts/src/weights-file.ts` (+ test) -- add `WeightsLineSchema`, `ModifierWeightSchema`, `WeightsPoolSchema` (duplicate `sourceModifierId` per slot) and `WeightsFileSchema` (a `bases` record of records of `{prefix, suffix}`; a category-level refine for no-mixing and distinct letter sets), plus `WEIGHTS_SCHEMA_VERSION = '6.0.0'`. Export them and their types. The tests cover every matrix row, including a test that parses the committed `data/weights.json`.
- [x] `packages/contracts/src/envelopes.ts` -- delete `WeightsFileEnvelopeSchema` and `WeightsFileEnvelope`, and fix their exports and tests. -- One schema, no parallel definition.
- [x] `packages/sync/src/pricing/search-body.ts` (+ test import) -- import `defenceLettersOf` from `@poe/contracts`.
- [x] `packages/sync/src/catalogue/weights-ids.ts` (+ test) -- `readWeightsIds` parses through `parseEnvelope(WeightsFileSchema, …, WEIGHTS_SCHEMA_VERSION)`. On `invalid`, it throws `DataFileError('invalid', …)` naming the first issue's path and message. It collects the ids from the typed value. Rewrite the module doc so it no longer calls the schema Story 3.3's. `sync/index.ts` re-exports the `contracts` constant.
- [x] `packages/web/src/load/artifacts.ts` (+ `load-artifacts.test.ts`) -- `ARTIFACTS.weights` uses `WeightsFileSchema`, and `WEIGHTS_EXPECTED_VERSION` becomes the `contracts` constant. Add a test that a hard-error file refuses the page with cause `content`.
- [x] `packages/core/src/rank.ts` (+ `rank.test.ts`) -- replace `areWeightsLoaded` with `weights: WeightsFile | null`, and widen `UnrankableReason` with `'pool partial'`. The crafted branch does the direct lookup from the Decisions and emits one row per class. Update the docs on `RankInput` and `UnrankableReason`, and cover the three Rank matrix rows.
- [x] `packages/web/src/App.tsx`, `test-support/dom.tsx`, `list/display-rows.test.ts`, `list/list-statement.test.ts` -- pass `weights: set.weights`, or a fixture file, in place of `areWeightsLoaded`.
- [x] `docs/stories/deferred-work.md` -- append two notes. A note for the producer: declare `complete` for a pool whose only missing rows are data-mined mods that cannot roll (Emerald, Crossbows). A note for the architect: reword the *placeholder row* bullet of the pool-completeness rule to match. In the branch's last commit, remove the Story 2.1 stopgap entry.

**Acceptance Criteria:**
- Given any matrix row, when the file is loaded through `parseEnvelope`, the outcome matches the matrix, and no partly loaded value is ever returned.
- Given a hard-error `weights.json`, when `sync` runs, it throws `DataFileError` naming `data/weights.json` and the failing rule, before any request.
- Given a hard-error `weights.json`, when the page loads, the refusal screen names `weights.json` with cause `content`.
- Given `weights.json` is absent, when the page loads, the Story 2.8 behaviour is unchanged.
- Given the committed data, when the page loads, Emerald and Crossbows appear in the appendix as `pool partial`, and Amulets and Bows appear nowhere.
- Given the workspace, when searched, no source file other than `contracts` defines a weights schema or a className letter split.

## Design Notes

A `superRefine` issue carries a `path` down to the offending index. For example, `['bases','jewel','Emerald','prefix','entries',12,'sourceModifierId']` with the message "sourceModifierId … repeats entries.3; a sourceModifierId may appear once per slot". `sync`'s `DataFileError` message is `invalid: <path joined by '.'>: <message>`, so the refusal names the failure. Web's state-26 copy is owned by UX, and it prints only the file and the cause.

## Verification

**Commands:**
- `pnpm check` -- expected: types, lint and dependency rules all pass.
- `pnpm test` -- expected: all tests pass, with no network call.

## Review Triage Log

Loop 0. Layers: blind-hunter, edge-case-hunter, verification-gap (no gaps), deferred-ledger-audit (zero findings).

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | blind | Spec and epic context are missing from the reviewed patch | false | Excluded from the diff on purpose. Both files are in the tree and reached the claims-aware layer by path. | reject |
| 2 | blind, edge | The schema enforces more than *Validation*: non-empty `producer.id`, ISO-UTC `generatedAt`, non-empty `categoryId`/`className`/`statId`, typed optionals, `poolCoverage` enum | low | Real, but the header rules come from the Story 2.x envelope, and `utcDate` in `trust-facts.ts` throws on a non-ISO `generatedAt`. The key rules come from the id schemas that the Code Map says to reuse. The enum and the optional types are the Shape, which the doc says the Zod schema *is*. The module doc overclaimed "no others". | patch (reword the doc) + defer (architect note) |
| 3 | blind | No refusal test for a missing `sourceModifierId`, `itemLevelMin`, `weight` or `lines` | low | The first bullet of *Validation* had no test row. | patch |
| 4 | blind | The committed-data tests hard-code counts and rows, so they break when the producer regenerates | low | They are meant to break loudly. The deferred producer entry did not say so. | patch (ledger sentence) |
| 5 | blind | The web refusal does not carry the failing rule | false | Spec *Never*: no new refusal-screen copy. Design Notes: web prints only the file and the cause. | reject |
| 6 | blind | A hard error in a tolerable artifact refuses the whole page | false | Spec *Always*: an invalid file takes the existing refusal path (state 26, cause `content`). | reject |
| 7 | blind | Nothing measures the cost of the full parse in the browser | maybe-false | About 8.4k entries. The contracts test that parses the committed file runs well within the suite time. Would be low at most. | reject |
| 8 | blind | Web fixtures flip to `weights: null` | false | `rowsFor`, `statementFor` and `rankedList` take `RawTrackedEntry[]`, so a crafted entry cannot enter them. | reject |
| 9 | blind | `defenceLettersOf('_str')` returns `{str}` while the schema refuses `_str` | low | Real, but a tracked `className` of `_str` is contrived, and the fix changes a shared helper's semantics (more than a direct correction). | reject |
| 10 | blind | Alias `WEIGHTS_EXPECTED_VERSION` and the `sync` re-export are redundant | false | Both are directed by the spec's tasks. | reject |
| 11 | blind | Barrel export order, over-long JSDoc line, dead test branch, single-line fixtures | low | The first three are direct fixes. The single-line fixtures pass lint. | patch (first three) / reject (fixtures) |
| 12 | blind | "at both rungs" is undefined locally in `rank.ts` | low | Direct rewording. | patch |
| 13 | blind, edge | A `__proto__` class or category key is dropped by `z.record` | low | No poe2db `className` or trade `categoryId` is `__proto__`. The fix adds a guard. | reject |
| 14 | edge | `__str` passes the grammar with family `_` | low | Literally a non-empty family under the doc's grammar. Contrived. | reject |
| 15 | edge | The dotted issue path is ambiguous (`bases.weapon.bow.Bows`) | low | The format is the spec's Design Notes. Changing it means editing this spec. | reject |
| 16 | edge, blind | `.claude/skills/tracked-json/scripts/lookup.ts` reads `weights.json` ad hoc and splits `sourceModifierId` | low | Pre-existing curation script outside the product packages. It conflicts with the spirit of the spec's *Never*. | defer |
| 17 | ledger | Code Map line reference `deferred-work.md:96-100` is stale | low | The fix edits this spec. | reject |
