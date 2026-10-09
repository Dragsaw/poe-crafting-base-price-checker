---
title: 'tracked.json curation tooling: lookup and check scripts plus the tracked-json skill'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_revision: 'bea616132c41aeb9cde0b03571a0cafffb506b64'
route: 'dispatch'
review_loop_iteration: 0
followup_review_recommended: true
deferred:
  - summary: >-
      No test checks that the tsconfig.tools.json, vitest.config.ts and eslint.config.mjs wiring still covers the tracked-json scripts.
    evidence: |-
      Dropping the vitest include line or one negation in the eslint ignore chain would silently remove lookup.ts from type, lint or test coverage, and pnpm check / pnpm test would still pass. The repo has no wiring guard for tools/boundary-check either, so this belongs to a general "every .ts file is covered" guard.
    location: >-
      eslint.config.mjs:25
    severity: low
context:
  - '{project-root}/docs/forge/tracked-json-editor/forged-idea.md'
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** To seed or edit `data/tracked.json`, an agent must find stat ids, base types, item classes and tier bands in about 7 MB of catalogue and weights JSON. It must then check the result, and no command does either task today.

**Approach:** Per the forged idea, add two read-only CLI scripts, `pnpm tracked:lookup stat|base|class|mods|tiers <query>` and `pnpm tracked:check`. Both print JSON to stdout. `tracked:lookup` is convenience tooling for the skill, so it lives next to the skill at `.claude/skills/tracked-json/scripts/lookup.ts`. `tracked:check` reuses the production validators, so it lives in `packages/sync/src/curation/check.ts`. Also add a Claude Code skill at `.claude/skills/tracked-json/SKILL.md` that drives the lookup → edit → check loop. The skill also has an interactive mode: the player asks "show me which mods are possible", and the agent offers classes, then prefixes, then suffixes for the player to pick, and writes only after the player confirms a draft.

## Boundaries & Constraints

**Always:**
- The scripts only read. They never write any file, and they never touch the network.
- `check.ts` lives in `packages/sync/src/curation/` and imports only `@poe/contracts`, `@poe/core` and existing `sync` modules.
- `lookup.ts` lives in `.claude/skills/tracked-json/scripts/`, imports only `node:` built-ins, and reads `data/catalogue/*.json` and `data/weights.json` as plain JSON.
- `pnpm check` and `pnpm test` cover `lookup.ts` and its test: it is in the `tsconfig.tools.json` include, the root vitest project include, and an `eslint.config.mjs` block.
- `tiers` prints each weights line's `ranges` verbatim. It does not derive an interval, because the §1 interval derivation belongs to `core` (Story 3.1/3.3) and a second copy is forbidden.
- The skill cites its rules by id (FR-22, AD-5, AD-17, IMPLEMENTATION-NOTES §1/§8, the AGENT-WORKFLOW hand-edited-input rule) and does not restate them.
- The skill states the open weak point: until Story 3.3, the agent checks band edges by hand against the `tiers` output.
- `mods` prints weights data verbatim: the mod text is the text tail of `sourceModifierId`, and a hybrid modGroup is one row with all its statIds. It derives no interval and no floor.
- The agent may read `data/tracked.json` directly. The ban on direct reads covers only `data/catalogue/*.json` and `data/weights.json`.

**Never:**
- No file in `packages/web`. No new package. No Python.
- No `@poe/*` import in `.claude/skills/tracked-json/`.
- No local implementation of the five cross-file checks, and no floor derivation in code.
- No edit to `data/tracked.json` in this change.

**Decisions:**
- `tracked:check` runs three checks: the contracts schema (`TrackedFileSchema`, which includes canonical-key uniqueness), the pinned cap, and AD-9 catalogue resolvability via `checkCatalogue(entries, [], ids)`. Each `records` entry becomes an issue. (Human, 2026-09-26.)
- The full spec is kept above the token guideline, with no split. (Human, 2026-09-26.)
- A crafted entry holds at most one prefix and one suffix. When the player picks more than one of either, the skill asks whether to write every prefix × suffix pair or single-affix entries, and states the resulting entry count before the draft. It does not choose a default. (Human, 2026-09-26.)
- In interactive mode the skill shows the draft entries and waits for the player's confirmation before it edits `data/tracked.json`. (Human, 2026-09-26.)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| stat lookup | `stat "maximum mana"` | `{matches:[{id,text,type}], truncated:n}`: a case-insensitive substring match over every stats group, capped at 50 | exit 0; zero matches is not an error |
| base lookup | `base "amulet"` | base types (items.json entries without `name`), each with `{type, group}` | exit 0 |
| class lookup | `class "amul"` | `{categoryId, categoryText, className}`: a substring match on className, categoryId or category text, with classes taken from weights `bases` | weights absent → exit 1 with `{error}` naming the file |
| mods lookup | `mods --class Body_Armours_dex --slot prefix` | per modGroup of that class and slot, `{slot, modGroup, text, statIds, tierCount, itemLevelMin:{min,max}, tierLabels}`; without `--slot`, both slots | unknown class, or a class name that appears in more than one category without `--category` → exit 1 with `{error}` |
| tiers lookup | `tiers explicit.stat_3981240776 --class Amulets` | per slot, the tiers that have a line with that statId, as `{slot, tierLabel, itemLevelMin, weight, weightSource, modGroup, lines}`, sorted by itemLevelMin | unknown class, or a class name that appears in more than one category without `--category` → exit 1 with `{error}` |
| check passes | the committed `data/` | `{ok:true, checks:[…], pending:["five cross-file checks (Story 3.3)"]}` | exit 0 |
| check fails | schema issue, canonical key repeated, pinned cap exceeded, or an id absent from the catalogue | `{ok:false, issues:[{check, path?, message}]}` | exit 1 |
| bad usage | unknown subcommand or missing query | a usage message on stderr | exit 1 |

</frozen-after-approval>

## Code Map

- `packages/sync/src/dry-run.ts` -- CLI pattern to copy: `main()` with `parseArgs` (strict), the `isInvokedDirectly()` realpath guard (L304-314), stderr `pnpm <cmd>: <error>` plus `process.exitCode = 1`, and `JSON.stringify(x, null, 2) + '\n'`.
- `packages/sync/src/shell.ts` -- `createNodeFilesystemPort(root)` is the real FS port for `check.ts`. Use it with `REPO_ROOT = new URL('../../../', import.meta.url)` (adjust the depth for `curation/`). `lookup.ts` uses `node:fs` with `new URL('../../../../', import.meta.url)` as the repository root.
- `packages/sync/src/load-data-file.ts` -- `loadDataFile(fs, path, d => parseEnvelope(Schema, d))` returns `DataFileResult`. `DataFileError` has `{path, reason}`.
- `packages/contracts/src/envelopes.ts` -- `TrackedFileSchema` (L38) enforces canonical-key uniqueness. `Catalogue{Stats,Items,Filters}FileSchema` (L159-162). `WeightsFileEnvelopeSchema` checks only the envelope.
- `packages/contracts/src/trade-catalogue.ts` -- `flattenStatCatalogue`, `flattenItemCatalogue`, `filterOptionIds`. For `lookup.ts` these are a shape reference only, not an import: walk the catalogue groups the same way with plain guards.
- `packages/sync/src/catalogue/weights-ids.ts` -- `WEIGHTS_PATH`, and `isRecord`/`arrayAt`-style guarded walking of `bases[categoryId][className][prefix|suffix].entries`. Copy that approach into `lookup.ts` (no import); no full 6.0.0 schema exists yet.
- `packages/sync/src/catalogue/catalogue-ids.ts` -- `loadCatalogueIds(fs)` and the path constants. `pricing/load-item-types.ts` has `CATALOGUE_ITEMS_PATH`.
- `packages/sync/src/pinned-cap.ts` -- `checkPinnedCap(entries, config)` returns `{ok:false, error:{kind:'pinned-cap-exceeded', message,…}}`. `load-config.ts` has `loadConfig(fs)`.
- `packages/sync/src/chunk/catalogue-check.ts` -- `checkCatalogue`; pass an empty dataset and use only `records`.
- `packages/sync/src/no-git-write.test.ts` -- scans sync sources. Never write "git" followed by a verb, not even in comments.
- `packages/sync/src/dry-run.test.ts` -- test pattern: `execFile(process.execPath, [SCRIPT, …])`, then assert on stdout, the exit code, and that the sizes and mtimes of `data/` did not change. `sync.test.ts` L491 asserts the `package.json` script string.
- `.claude/skills/deferred-work-sweep/SKILL.md` -- frontmatter format (`name`, `description`).
- `tsconfig.tools.json` (`include`), `vitest.config.ts` (root project `include`), `eslint.config.mjs` (the block that names `tools/**`) -- the three wiring points for `lookup.ts`. `eslint.config.mjs` L9-12: a file that matches no config block passes silently.

## Tasks & Acceptance

**Execution:**
- [x] `.claude/skills/tracked-json/scripts/lookup.ts` -- pure `lookupStat/Base/Class/Mods/Tiers` over loaded data, plus a `main()` CLI -- the lookup half of the loop
- [x] `packages/sync/src/curation/check.ts` -- pure `checkTracked(loaded)` returning `{ok, checks, issues, pending}`, plus a `main()` CLI -- the check half
- [x] `.claude/skills/tracked-json/scripts/lookup.test.ts`, `packages/sync/src/curation/check.test.ts` -- in-memory cases for every matrix row, one CLI spawn per script against the committed `data/` with a no-write assertion, and a `package.json` script-string assertion in each file
- [x] `package.json` -- add `"tracked:lookup": "node .claude/skills/tracked-json/scripts/lookup.ts"` and `"tracked:check": "node packages/sync/src/curation/check.ts"`
- [x] `tsconfig.tools.json`, `vitest.config.ts`, `eslint.config.mjs` -- one include each for `.claude/skills/tracked-json/scripts/*.ts`
- [x] `.claude/skills/tracked-json/SKILL.md` -- a triggering description, then the loop: `class` → `stat` → `tiers` → write the band as a whole tier's edges (or a run of whole adjacent tiers) → floor per §8 → `acceptedTier` label → `tracked:check` → hand-check edges until 3.3 → report the file, the change and the reason. Plus the interactive mode: `class` (mark the classes that `tracked.json` already covers) → player picks → `mods --slot prefix` → player picks → `mods --slot suffix` → player picks → pairing question → `tiers` per pick and a suggested FR-22 band → show the draft and wait for confirmation → edit → `tracked:check` → report

**Acceptance Criteria:**
- Given the committed `data/`, when `pnpm tracked:check` runs, then it exits 0 and `data/` is unchanged.
- Given the Amulets class, when `pnpm tracked:lookup tiers explicit.stat_3981240776 --class Amulets` runs, then it lists the prefix tiers T5 to T1 with itemLevelMin 16/25/33/46/54 and verbatim ranges.
- Given the Body_Armours_dex class, when `pnpm tracked:lookup mods --class Body_Armours_dex --slot prefix` runs, then it lists 7 modGroups, and `BaseLocalDefencesAndLife` is one row with two statIds.
- Given a type error in `.claude/skills/tracked-json/scripts/lookup.ts`, when `pnpm check` runs, then it fails.
- Given an agent asked to add a tracked entry, when it loads the skill, then it runs lookup and then check, and does not open `data/catalogue/*.json` or `data/weights.json` directly.
- Given a player who asks which mods are possible, when the agent follows the skill, then it offers classes, prefixes and suffixes as choices in that order, asks the pairing question when a slot has more than one pick, and edits `data/tracked.json` only after the player confirms the draft.

### Review Findings

Follow-up code review of `8f5b580`, 2026-09-27. The review layers were Blind Hunter, Edge Case Hunter, Verification Gap and Acceptance Auditor.

- [x] [Review][Patch] (medium) `mods` merges the separate mod families of one modGroup into one row. 53 of the 1758 modGroups in the committed weights have tiers with different stat sets, for example Amulets `IncreaseSocketedGemLevel`, which covers Spell, Melee, Minion and Projectile skills. The row shows only the first tier's `text`, mixes the tiers and statIds of all the families, and the skill then reads that row as a hybrid [.claude/skills/tracked-json/scripts/lookup.ts:297]
- [x] [Review][Patch] (medium) The skill has no path for a `valueless` reference. The weights hold lines with `ranges: []`, which AD-5 and §8 treat as `valueless`, but loop steps 4 and 6 always write a band [.claude/skills/tracked-json/SKILL.md:31]
- [x] [Review][Patch] Interactive mode offers `mods` rows with a `null` statId, and such a row cannot become an entry. The committed weights hold 17 such lines [.claude/skills/tracked-json/SKILL.md:49]
- [x] [Review][Patch] The step 3 check of an unknown id uses the substring match of `stat`, so a truncated id looks resolved. For example, `stat_39` matches `stat_3981240776`. The skill must require a match whose `id` is exactly the statId [.claude/skills/tracked-json/SKILL.md:30]
- [x] [Review][Patch] Step 5 applies §8 to a raw entry. §8 excludes raw entries, and the raw item level is owned by FR-3 (the Raw Base in the glossary) [.claude/skills/tracked-json/SKILL.md:32]
- [x] [Review][Patch] The skill never says which `status` a new entry gets. `status` is required by `TrackedEntrySchema` [.claude/skills/tracked-json/SKILL.md:28]
- [x] [Review][Patch] For a hybrid pick, the skill does not say which line of a tier gives the band [.claude/skills/tracked-json/SKILL.md:52]
- [x] [Review][Patch] The step 9 report does not say that the five cross-file checks did not run [.claude/skills/tracked-json/SKILL.md:36]
- [x] [Review][Patch] Steps 4 to 6 restate FR-22, §8 and AD-5 text, and the skill's own Rules forbid that [.claude/skills/tracked-json/SKILL.md:31]
- [x] [Review][Patch] Interactive step 4 does not cover picks in one slot only, 1+0 or 0+1 [.claude/skills/tracked-json/SKILL.md:51]
- [x] [Review][Patch] No test asserts the `mods` row `text` from the committed weights. Only a fixture pins the `sourceModifierId` layout [.claude/skills/tracked-json/scripts/lookup.test.ts]
- [x] [Review][Patch] No test covers the `not readable` and `not valid JSON` `LookupError` paths of `readJsonAt` [.claude/skills/tracked-json/scripts/lookup.test.ts]
- [x] [Review][Defer] Nothing guards the tsconfig, vitest and eslint wiring of the tracked-json scripts [eslint.config.mjs:25] — deferred: the item is in the spec frontmatter but was never appended to `deferred-work.md`
- [x] [Review][Defer] `modText` parses `sourceModifierId`, and `WEIGHTS-FILE-SCHEMA.md:258` calls that field "Opaque to the app" [.claude/skills/tracked-json/scripts/lookup.ts:279] — deferred: the spec authorizes the parse, so this is a conflict between the spec and the weights contract for the owner of that contract to settle
- [x] [Review][Defer] `pnpm tracked:lookup` and `pnpm tracked:check` are not named in `AGENT-WORKFLOW.md` or `AGENTS.md` — deferred: the fix edits agent-context files

**Rejected:**
- `false` — The `acceptedTier` en dash has no owner. `AcceptedTierSchema` is a free label, and nothing validates its spelling (`modifier-ref.ts:29`).
- `false` — `followup_review_recommended` is not tracked. This review is that follow-up.
- `low` — The tests pinned to live data break on a data refresh. That failure is loud and costs one line to fix, and the ACs name those values.
- `low` — `class ""` fails through PowerShell before 7.3. Agents run the commands through Git Bash, and the risk is already recorded under Residual risks.
- `low` — `class` fails when `filters.json` is absent. The file is committed, and the fix adds a guard.
- `low` — The CLI no-write spawn covers only `tiers`. No subcommand has a write path, and the fix adds tests.
- `low` — The renumber instruction in the deferred-work entry does not list the citing steps. The fix rewrites an existing entry, and `deferred-work.md` is append-only.
- `low` — `tracked:check` writes plain stderr and no JSON when a read fails with an error other than ENOENT. EACCES or EISDIR on a committed file is unlikely, and the fix adds a guard.
- `low` — For a repeated `--class`, the last value wins without a signal. This is unlikely, and the fix adds a guard.
- `low` — `tracked:check` refuses an absent `tracked.json` that sync accepts. The file is committed, and a loud failure is acceptable.

## Design Notes

Commit subjects use scope `curation`, for example `feat(curation): tracked lookup and check scripts`. The commit-msg hook requires a story id only for package scopes, and this work belongs to no story.

## Verification

**Commands:**
- `pnpm check` -- expected: passes
- `pnpm test` -- expected: passes, with no network call
- `pnpm tracked:check`, `pnpm tracked:lookup tiers explicit.stat_3981240776 --class Amulets` and `pnpm tracked:lookup mods --class Body_Armours_dex --slot prefix` -- expected: JSON as in the ACs

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 33 findings — high 0, medium 10, low 20, false 2, maybe-false 1
- findings:
  - `[medium]` `[patch]` (ledger) No deferred-work entry for wiring the five Story 3.3 checks into `tracked:check` — appended an entry to `docs/stories/deferred-work.md`.
  - `[medium]` `[patch]` (ledger) No deferred-work entry for removing the skill's weak-point text and hand-check step at Story 3.3 — appended an entry to `docs/stories/deferred-work.md`.
  - `[false]` `[reject]` (blind) `tiers` interleaves modGroups, so a band could span groups — IMPLEMENTATION-NOTES §1 consequence 1 defines adjacency per `statId` per slot, which is exactly the list `tiers` prints.
  - `[medium]` `[patch]` (blind) An unknown statId gives `tiers: []`, and the skill then calls the pair impossible — skill step 3 now confirms the id with `stat` before it reports "not possible".
  - `[medium]` `[patch]` (blind) The weak-point section named the wrong three failures instead of the five checks — it now cites the AGENT-WORKFLOW five-check rule (AD-17) and says that step 8 covers only the edges and the floor.
  - `[medium]` `[patch]` (blind) Nothing links Story 3.3 back to this tooling — grouped with the two ledger rows; fixed by the same two deferred-work entries.
  - `[medium]` `[patch]` (blind) The skill does not cover removal or change, or the shared-floor re-derivation they need — added "Changing or removing an entry": the `pruned` tombstone (AD-12), then re-derive the class floor (§8, AD-17).
  - `[low]` `[patch]` (blind) "At most one prefix and one suffix" is stated without its owner — added the AD-5 citation in the rules and in interactive step 4.
  - `[low]` `[reject]` (blind) Nothing enforces "no `@poe/*` import" in the scripts folder — an import would fail typecheck because the root has no `@poe/*` dependency, and a new lint rule is more than a direct correction.
  - `[low]` `[reject]` (blind) `check.ts` imports `TRACKED_PATH` from `run-chunk.ts` — importing it runs no write, and moving the constant is churn beyond a direct correction.
  - `[low]` `[patch]` (blind) Every fatal error in `check.ts` printed the usage text — usage now prints only for a `parseArgs` failure.
  - `[medium]` `[patch]` (blind) The exit-1 path of `tracked:check` is untested — `main(argv, fs, out, err)` now returns the exit code, and a new test asserts 1 with an `ok:false` report.
  - `[low]` `[patch]` (blind) The name of the absent-files test overclaims — renamed to match its assertions.
  - `[maybe-false]` `[reject]` (blind) `class ""` may be dropped by Windows PowerShell before 7.3 — it depends on the PowerShell version, and agents run the scripts from Git Bash, where it works (checked). If true it would be low.
  - `[low]` `[patch]` (blind) Some branches have no test (stat matched by id, base de-duplication) — added fixture cases for both. The others (invalid JSON, a missing slot pool) are rejected: rare, and they do not change the path.
  - `[low]` `[reject]` (blind) The `snapshot`/`runScript` helpers are duplicated across the two test files — a shared helper is refactoring beyond a direct correction, and the copies are small.
  - `[low]` `[reject]` (blind) The test files are inconsistent about import extensions — `tsconfig.tools.json` lacks `allowImportingTsExtensions`, so the fix needs a config change.
  - `[medium]` `[patch]` (intent) The matrix error rows run only at the function level on the CLI — grouped with the exit-1 finding. The `check` exit path is now tested, and the lookup `LookupError`→exit 1 mapping has one CLI test that proves it.
  - `[low]` `[reject]` (intent) The tests run `node <script>`, not `pnpm` — each test file asserts the `package.json` script string, and pnpm writes its echo line to stderr.
  - `[low]` `[reject]` (intent) The no-write check covers only `data/` — neither script contains a write or network call.
  - `[false]` `[reject]` (intent) The pinned-cap test depends on a fixture config — the CLI run over the committed `data/config.json` exits 0, so the committed config is covered.
  - `[low]` `[reject]` (intent) The skill's agent-behaviour promises exist only as instructions — they are inherent to a skill, and the ACs judge them by what SKILL.md instructs.
  - `[low]` `[reject]` (intent) The pairing question is asked even when the other slot has zero picks — this is the intent's literal rule, and the agent states the entry count of each answer, so no wrong entry results.
  - `[low]` `[patch]` (intent) The skill paraphrases some rules next to their citations — grouped with the AD-5 citation fix. The step 4/5 wording keeps its citations (F2 reading).
  - `[low]` `[reject]` (edge) `--class __proto__` gives a false ambiguity error — no player types that, and the fix adds a guard.
  - `[medium]` `[patch]` (edge) An unknown statId gives empty tiers — grouped with the blind finding; fixed in skill step 3.
  - `[low]` `[patch]` (edge) A non-ENOENT read error went to stderr as plain text — `readJsonAt` now turns every read failure into a `LookupError` that names the path.
  - `[low]` `[reject]` (edge) A malformed weights entry is dropped without a signal — the producer's schema writes `weights.json`, and the fix adds guards.
  - `[low]` `[reject]` (edge) A non-string statId becomes `null` — the committed data has only string or null ids.
  - `[low]` `[reject]` (edge) Only the first absent catalogue file is reported — this is existing `loadCatalogueIds` behaviour, and changing it goes beyond a direct correction.
  - `[low]` `[patch]` (edge) A usage line was printed on every error — grouped with the blind finding; fixed.
  - `[medium]` `[patch]` (verification) `stat`/`base`/`class` are tested only on fixtures — `describe('the committed data/')` now asserts known rows from the committed catalogue and weights.
  - `[low]` `[defer]` (verification) No test checks the tsconfig/vitest/eslint wiring — the repo has no such guard yet. Recorded in the frontmatter `deferred`.

## Auto Run Result

Status: done

**Summary:** Added the tracked.json curation loop. `pnpm tracked:lookup stat|base|class|mods|tiers` is a read-only lookup over the committed catalogue and weights. It imports only `node:` built-ins and prints the weights data verbatim. `pnpm tracked:check` runs the contracts schema, the pinned cap and AD-9 catalogue resolvability through the production validators, and lists the five cross-file checks as pending. The `tracked-json` skill drives lookup → edit → check, has an interactive pick-and-confirm mode, and states the Story 3.3 weak point.

**Files changed:**
- `.claude/skills/tracked-json/SKILL.md`: the skill. It has the loop, the change/remove section, the interactive mode and the weak point.
- `.claude/skills/tracked-json/scripts/lookup.ts`: the lookup CLI and its pure `lookup*` functions.
- `.claude/skills/tracked-json/scripts/lookup.test.ts`: fixture tests for every lookup row, tests on the committed data, CLI spawns with a no-write snapshot, and the script-string assertion.
- `packages/sync/src/curation/check.ts`: `checkTracked`, `loadTrackedCheckInputs`, and a testable `main` that returns the exit code.
- `packages/sync/src/curation/check.test.ts`: every check-fail case, `main` exit 1, a CLI spawn over the committed data with a no-write snapshot, and the script-string assertion.
- `package.json`: the `tracked:lookup` and `tracked:check` scripts.
- `tsconfig.tools.json`, `vitest.config.ts`, `eslint.config.mjs`: bring the scripts into typecheck, test and lint. The eslint `.claude/**` ignore became a per-level chain that un-ignores only the scripts folder.
- `docs/stories/deferred-work.md`: two appended entries for the Story 3.3 follow-ups.

**Review findings:** 33 in total. 10 patch entries were applied to 17 finding rows (6 medium entries and 4 low entries). 1 item was deferred (the wiring guard, low). The rejected findings and their reasons are in the triage log above: 2 false, 1 maybe-false with a low if-true grade, and 12 low.

**Follow-up review recommendation:** true. This first pass patched 6 medium entries. The risk no test verifies is the rewritten skill text: step 3's statId confirmation, the change/remove section with its AD-12 tombstone and floor re-derivation, and the reworded weak point. No agent run has exercised them, and no test can.

**Verification:**
- `pnpm check` passes: tsc -b, eslint and depcruise.
- `pnpm test` passes: 65 files, 815 tests.
- `pnpm tracked:check` exits 0 with `ok:true`, and `data/` is unchanged.
- `tiers explicit.stat_3981240776 --class Amulets` gives T5–T1 at 16/25/33/46/54.
- `mods --class Body_Armours_dex --slot prefix` gives 7 modGroups.
- Earlier, the implementer confirmed that a deliberate type error in `lookup.ts` fails typecheck.

**Residual risks:**
- `tracked:check` cannot catch band edges, a wrong floor or class discriminability until Story 3.3 (ledger entries recorded).
- Only fixtures exercise the ambiguous-class `--category` path, because no class name appears in two categories in the committed weights.
- `class ""` through Windows PowerShell before 7.3 may drop the empty argument.
