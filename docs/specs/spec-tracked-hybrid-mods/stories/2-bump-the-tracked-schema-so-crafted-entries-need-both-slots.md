---
title: 'Bump the tracked schema so crafted entries need both slots'
type: 'feature'
created: '2026-10-03'
status: 'done'
route: 'dispatch'
baseline_commit: 'ef96f700cecd55bb9370154f9df7a2ef60af4819'
review_loop_iteration: 0
context:
  - '{project-root}/docs/specs/spec-tracked-hybrid-mods/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A crafted tracked entry may omit its prefix or its suffix today, and overlap, probability, search-body, catalogue-check and rendering code each carry an absent-affix branch. SPEC-tracked-hybrid-mods CAP-8 requires both slots, and AD-5 / IMPLEMENTATION-NOTES §4.1 make that a major bump of the tracked schema with a refusal message that tells the curator to re-author.

**Approach:** Give `tracked.json` its own schema version constant at a new major, make both affixes required, withdraw the `null` key form, delete every absent-affix branch, and refuse an earlier-major tracked file with the §4.1 message. Rewrite the committed tracked files to the new version.

## Boundaries & Constraints

**Always:** `dataset.json`, `sync-progress.json`, `sync-report.json` and every other artifact keep their versions and committed contents (§12.1). Owner text is cited, not restated. Follow the AGENTS.md MCP tool rule for code edits.

**Never:** Add the `hybrid` kind (story 3). Change the weights contract. Add a new player-facing UI string. Edit owner documents.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Full pair | crafted entry with prefix and suffix, `schemaVersion` at the new major | parses; key has two affix encodings, never `null` | N/A |
| Missing slot | crafted entry without `prefix`, or without `suffix` | schema error at the missing path | refused by `TrackedFileSchema` |
| Earlier major | tracked file at `1.x.y` | refused | sync and `tracked:check` print the §4.1 message: major changed, crafted entries need both affixes and accept `hybrid`, re-author |
| Later major / malformed | `3.0.0` or `abc` | refused | the existing generic refusal |
| Old progress keys | progress file holding keys absent from the current tracked key set | keys age out | no throw |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/schema-version.ts` -- `SUPPORTED_SCHEMA_VERSION` is shared by every file; do not bump it. Pattern to copy: `WEIGHTS_SCHEMA_VERSION` in `weights-file.ts:24`.
- `packages/contracts/src/tracked-entry.ts:39-88` -- `CraftedTrackedEntrySchema` (`.optional()` affixes) and the "at least one affix" `superRefine`.
- `packages/contracts/src/envelopes.ts:47-119, 307` -- `TrackedFileSchema` comment and within-file overlap; `parseEnvelope(schema, data, expected)`.
- `packages/contracts/src/canonical-key.ts:26-66` -- `CanonicalAffix | null`, `encodeAffix(ref | undefined)`.
- `packages/contracts/src/overlap.ts:35-114` -- optional `OverlapAffixes`, `'absent'` branch, `BRANCH_WORDS.absent`.
- `packages/core/src/probability.ts:70, 158-276` -- `containedIn`/`affixProbability`/`combinationProbability` accept `undefined` (P=1).
- `packages/core/src/cross-file.ts:282-285` -- `if (ref === undefined) continue`.
- `packages/sync/src/pricing/search-body.ts:159-167`, `packages/sync/src/chunk/catalogue-check.ts:75-76` -- undefined-ref filters.
- `packages/web/src/list/combination-text.ts:71-74` -- flatMap drops an undefined ref. Keep `AFFIX_JOIN`.
- Tracked loaders using the default version: `packages/web/src/load/artifacts.ts:53`, `packages/sync/src/curation/check.ts:95` (message at 99-111), `packages/sync/src/chunk/run-chunk.ts:728` (`describeRefusal` 386-394), `packages/sync/src/fixtures-record.ts:359`.
- Web refusal (`load-artifacts.ts:115-125`, `FailureScreen.tsx`) shows declared vs expected generically; it needs only the new expected constant.
- Data: `data/tracked.json` (201 crafted, 4 raw), `fixtures/tracked.json`, `test/fixtures/frozen-data/tracked.json` -- all at `1.0.0`, zero partial entries, so only `schemaVersion` changes.
- `.claude/skills/tracked-json/SKILL.md:19, 36, 45-47` -- "at most one prefix/suffix", "zero or more", single-affix pairing.
- Tests building one-sided entries (all gain the missing affix or are deleted): contracts `canonical-key`, `tracked-entry`, `envelopes`, `overlap`; core `rank`, `chunk-order`, `coverage`, `cross-file`, `probability`, `crafted-classes`; sync `run-chunk`, `catalogue-check`, `weights-ids`, `price-entry`, `search-body`; web `test-support/list-fixtures.ts`, `craft-recipe.test.tsx`, `combination-text.test.ts`. Version-asserting tests: `envelopes.test.ts:21,73-93`, `overlap.test.ts:113`, `check.test.ts:64,149-153`, `run-chunk.test.ts:100`, `sync.test.ts:103`, `sync-batch.test.ts:68`, `dry-run.test.ts:92,235,337`, `artifact-server.ts:63`, `App.test.tsx:190`, `load-artifacts.test.ts:75`.
- Opaque key strings with `null` in `trust-facts.test.ts`, `trust-strip.test.tsx`, `ranked-row.test.ts`, `sync-run-report.test.ts` -- leave; §12.1 treats keys as opaque.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/src/tracked-file.ts` or `schema-version.ts` -- add `TRACKED_SCHEMA_VERSION = '2.0.0'` and one helper that builds the §4.1 earlier-major message; export from the contracts index -- one spelling for every site.
- [x] `packages/contracts/src/{tracked-entry,canonical-key,overlap,envelopes}.ts` -- required `prefix`/`suffix`, drop the refine, `null` form, `'absent'` branch and stale comments.
- [x] `packages/core/src/{probability,cross-file}.ts` -- refs non-optional; remove undefined branches.
- [x] `packages/sync/src/{pricing/search-body,chunk/catalogue-check}.ts` -- remove undefined filters.
- [x] `packages/sync/src/{curation/check,chunk/run-chunk,fixtures-record,load-data-file}.ts`, `packages/web/src/load/artifacts.ts` -- load tracked with `TRACKED_SCHEMA_VERSION`; sync and `tracked:check` print the helper message when the found major is lower.
- [x] `packages/web/src/list/combination-text.ts` -- map both refs directly.
- [x] `data/tracked.json`, `fixtures/tracked.json`, `test/fixtures/frozen-data/tracked.json` -- `schemaVersion` `2.0.0`.
- [x] `.claude/skills/tracked-json/SKILL.md` -- every crafted draft names one prefix and one suffix; drop single-affix pairing.
- [x] Tests listed in the Code Map -- add the missing affix, delete absent-branch tests, add: schema rejects a missing prefix and a missing suffix; earlier-major tracked file refused with the §4.1 message in `tracked:check` and sync; old-key progress file ages out without throwing.

**Acceptance Criteria:**
- Given the repo, when grepping production code for `ref === undefined`, `'absent'` or an optional affix, then none remains for crafted affixes.
- Given the committed data, when running `pnpm tracked:check`, then it passes, and `dataset.json`, `sync-progress.json`, `sync-report.json` are byte-unchanged.

## Design Notes

A separate constant is required: bumping `SUPPORTED_SCHEMA_VERSION` would bump `dataset.json`, `config.json`, `recipes.json`, `currencies.json` and the catalogue files, which §12.1 forbids. The §4.1 message names the `hybrid` kind before story 3 adds it; the message is the contract of the 2.0.0 major, and story 3 lands on the same branch. The web failure screen keeps its generic declared/expected sentence, because UI strings are owned by EXPERIENCE.md and the curator reads the sync or `tracked:check` output.

## Verification

**Commands:**
- `pnpm typecheck` and `pnpm lint` -- expected: no errors.
- `pnpm test` -- expected: all pass.
- `pnpm tracked:check` -- expected: pass on `data/tracked.json`.
- `git diff --stat data/` -- expected: only `data/tracked.json` changed.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Route | Evidence |
|---|-------|---------|---------|-------|----------|
| 1 | blind | `trackedEarlierMajorMessage` gives the 1→2 reasons for any lower major | low | patch | The text names both affixes and `hybrid`, and the guard is `foundMajor >= expectedMajor`. A 2.x file under a later major would get the wrong explanation. Fix: key on major 1. |
| 2 | blind | The §4.1 message names `hybrid` before the schema accepts it | low | reject | Design Notes accept this on purpose: the message is the 2.0.0 contract, and story 3 lands on the same branch. |
| 3 | blind | `parseEnvelope` still defaults to `SUPPORTED_SCHEMA_VERSION`, so a tracked site can forget the version | low | reject | A forgotten version refuses every valid tracked file, which is a loud failure that every load test catches. A contracts-level wrapper would add public surface. |
| 4 | blind | No test checks the version of the committed tracked files | false | reject | `check.data.test.ts` covers `data/tracked.json` under `pnpm test:data`. The core tests parse the frozen fixture at `TRACKED_SCHEMA_VERSION`. `dry-run.test.ts` sends `fixtures/tracked.json` through `runChunk`. |
| 5 | blind | The web test support hardcodes `'2.0.0'` | low | reject | Same as the existing pattern: the sibling bodies in `artifact-server.ts` use `'1.0.0'` literals. A bump fails loudly. |
| 6 | blind | The earlier-major message drops the generic "refused … this build reads" lead-in and doubles the file name in `tracked:check` | low | patch | `check.ts` prints `data/tracked.json: tracked.json declares …`. Fix: a direct string correction in the helper. |
| 7 | blind + edge | `SKILL.md` steps 2–3 ("one or more") contradict step 4's empty-pick branches, and a class with no writable row in a slot loops on step 4 | low | patch | Steps 2–4 of the text changed in this diff. Fix: stop when a slot lists no writable row, and make step 4 consistent. |
| 8 | blind | `SKILL.md` step 4 does not warn about co-occur collisions in the full cross product | low | reject | Pre-existing: the pair answer existed before. Step 5 already runs the 4b collision check, and loop step 7 runs `tracked:check` before the report. |
| 9 | blind | A class whose suffix pool is all weight-0 now blocks sync for its crafted entries | false | reject | This follows from CAP-8 by design: every crafted entry names a suffix, and the cross-file check requires that the pool contain it. The committed data passes `tracked:check`. |
| 10 | blind | `tracked:check` is tested only for a missing suffix | low | reject | Contracts tests cover the prefix and both-missing paths. `check.ts` passes schema issues through unchanged. |
| 11 | blind | The overlap test labels keep the numbers "1:" and "3:" after 2 and 4 were deleted | low | patch | A direct correction. |
| 12 | blind | Half-edited comments in `envelopes.ts`, `tracked-entry.ts` and the `canonical-key.test.ts` describe name | low | patch | A direct correction. |
| 13 | blind | Two copies of the refusal switch (`describeRefusal`, `loadDataFile`) | low | reject | The duplication is pre-existing. Only the shared message builder is new. |
| 14 | blind + verification-gap | The tracked load in `fixtures-record.ts` `main` has no test | medium | defer | A pre-verified gap. No test reached the recorder's tracked load before this change either. `main` is a manual, network-gated script. Recorded in `deferred-work.md`. |
| 15 | ledger | No carved-out items | — | — | The audit found nothing missing. |
