---
title: 'Extend the coverage guard over the hand-listed tools/ entries'
type: 'chore'
created: '2026-10-02'
status: 'done'
baseline_revision: '504d539ece6974decf2b65395f80658001de0053'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      `tools/prune-pages.mjs` is in `tsconfig.tools.json` only, and that entry checks almost nothing: `checkJs` is `false`, so `tsc` reports no type errors for it, and no ESLint `files` glob names a `.mjs` under `tools/`, so only ESLint's default JS rules apply to it.
    evidence: |-
      Pre-existing; the coverage guard (`test/hand-listed-coverage.test.ts`) pins only the include entry that exists. `eslint.config.mjs` `files` has `tools/**/*.ts` and the root-only `*.{ts,mts,cts,mjs}`. Settle it by deciding whether `tools/*.mjs` gets type-checking (`// @ts-check` or `checkJs`) and an ESLint glob, then extend the guard's `tools/prune-pages.mjs` row.
    location: >-
      tsconfig.tools.json
    severity: low
  - summary: >-
      `tools/setup-git-hooks.mjs` is in no config: `tsconfig.tools.json`, the Vitest `root` project and the ESLint `files` globs all leave it out, so nothing type-checks, lints or tests it.
    evidence: |-
      Pre-existing. `tsconfig.tools.json` `include` lists `tools/prune-pages.mjs` but not `tools/setup-git-hooks.mjs`; the coverage guard covers only hand-listed entries, so it is silent about this file.
    location: >-
      tools/setup-git-hooks.mjs
    severity: low
  - summary: >-
      The other hand-listed config entries outside `tools/` and `.claude/` have no wiring guard: `test/**/*.ts`, `vitest.config.ts`, `packages/*/vitest.config.ts`, `packages/web/vite.config.ts`, `packages/web/vite.config.test.ts`, `depcruise.rules.mjs` and `.dependency-cruiser.mjs` in `tsconfig.tools.json`, `test/**/*.test.ts` in the Vitest `root` project, and `test/**/*.ts` and `.dependency-cruiser.mjs` in the ESLint `files` glob.
    evidence: |-
      Pre-existing. Dropping `test/**/*.ts` from `tsconfig.tools.json` stops the coverage guard itself from being type-checked, and `pnpm check` still passes. The guard's `TARGETS` table could take these rows the same way it takes the `tools/` rows.
    location: >-
      tsconfig.tools.json
    severity: low
---

<intent-contract>

## Intent

**Problem:** `tsconfig.tools.json`, the root Vitest project in `vitest.config.ts` and the `files` glob in `eslint.config.mjs` hand-list `tools/boundary-check`, `tools/deferred-issues`, `tools/dev-stop`, `tools/dts-specifiers` and `tools/prune-pages.mjs`. Only `.claude/skills/tracked-json/scripts/` has a wiring guard, so dropping, for example, `tools/dev-stop/*.ts` from `tsconfig.tools.json` fails neither `pnpm check` nor `pnpm test` (deferred entry from `docs/stories/spec-deferred-no-test-checks-scripts-coverage.md`).

**Approach:** Extend the per-directory checkers of `test/tracked-json-scripts-coverage.test.ts` over a table of guarded targets: the tracked-json scripts plus each hand-listed `tools/` entry. Each target names the config entries that cover it; the test asserts each tool covers every file of each target, and that dropping each named entry in memory makes the checker report that target's files.

## Boundaries & Constraints

**Always:**
- Enumerate each target directory at run time (files only, not subdirectories), so a new file in a guarded directory is covered with no edit.
- Fail when a target holds no source file, or a target with a Vitest entry holds no test file, so no case passes vacuously.
- Ask each tool through its public API (`typescript`, `eslint`, `vitest/node`), as the existing checkers do.
- Guard only the entries a config actually hand-lists for the target: `tools/prune-pages.mjs` has a `tsconfig.tools.json` entry only (its test lives in `test/`, and no ESLint `files` glob names `.mjs` under `tools/`).
- The test runs offline and writes no file. Every failure message names the tool and the config entry.

**Never:**
- No change to `tsconfig.tools.json`, `vitest.config.ts`, `eslint.config.mjs` or any file under `tools/`.
- No general "every `.ts` file in the repo is covered" guard, and no guard for `tools/` files that no config lists (`tools/setup-git-hooks.mjs`).
- No edit to `docs/stories/deferred-work.md` or `docs/stories/sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Wiring intact | committed configs | every case passes | No error expected |
| tsconfig entry dropped | e.g. `tools/dev-stop/*.ts` removed from `include` | the TypeScript case for that target fails, naming each file of the target | message names `tsconfig.tools.json` and the entry |
| Vitest entry dropped | e.g. `tools/dts-specifiers/*.test.ts` removed from the `root` project | the Vitest case fails, naming each test file of the target | message names Vitest and the entry |
| ESLint glob dropped | `tools/**/*.ts` removed from the `files` block | the ESLint case fails for every `tools/` `.ts` target | message names ESLint and the glob |
| boundary-check fixture | `tools/boundary-check/fixture/` subdirectory | not enumerated (excluded by `tsconfig.tools.json` and ESLint on purpose) | No error expected |

</intent-contract>

## Code Map

- `test/tracked-json-scripts-coverage.test.ts` -- the existing guard. `tsUncovered`, `eslintUncovered`, `vitestUncovered` are per-file-list checkers; `uncovered`/`key`/`relativeLabel` normalise paths; `importDefault` loads the configs by computed specifier (static imports break `tsc -b`, TS6307/TS5097). Generalise these checkers to take the file list, and rename the file to `test/hand-listed-coverage.test.ts` because it no longer guards only tracked-json.
- `tsconfig.tools.json:14-27` -- `include` entries `tools/boundary-check/*.ts`, `tools/deferred-issues/*.ts`, `tools/dev-stop/*.ts`, `tools/dts-specifiers/*.ts`, `tools/prune-pages.mjs`, `.claude/skills/tracked-json/scripts/*.ts`; `exclude` `tools/boundary-check/fixture`. `allowJs: true`, so the `.mjs` is a root file.
- `vitest.config.ts:16-23` -- `root` project includes `tools/<dir>/*.test.ts` for the four dirs and the tracked-json scripts.
- `eslint.config.mjs` -- `files` glob `tools/**/*.ts` covers all four `tools/` dirs; the `.claude/` negation chain and `.claude/skills/tracked-json/scripts/*.ts` cover the scripts. `tools/boundary-check/fixture/**` is ignored.
- `tools/` -- today: `boundary-check/{boundary.test.ts,fixture/}`, `deferred-issues/{7 .ts files}`, `dev-stop/{dev-stop.ts,dev-stop.test.ts}`, `dts-specifiers/{2 .ts files}`, `prune-pages.mjs`, `setup-git-hooks.mjs` (in no config; out of scope).
- `openwiki/` -- generated; not edited (regenerates from source).

## Tasks & Acceptance

**Execution:**
- `test/hand-listed-coverage.test.ts` (renamed with `git mv` from `test/tracked-json-scripts-coverage.test.ts`) -- define a table of targets, each with its files (a directory read at run time, or one named file), its `tsconfig.tools.json` include entry, its optional Vitest `root` include entry, and its optional ESLint entry (the `files` glob, plus the negation for tracked-json). Generalise the three checkers to take a target's file list. For each target and each named entry: a positive case (the committed config covers every file) and a negative case (an in-memory copy without that entry makes the checker report exactly the target's files). Keep the `tsconfig.json` → `tsconfig.tools.json` reference case and the tracked-json negation case. -- makes the deferred summary false.

**Acceptance Criteria:**
- Given the committed configs, when `pnpm test` runs, then the guard passes.
- Given any one hand-listed `tools/` entry removed from its config locally, when the guard runs, then it fails and its message names the tool, the entry and the uncovered file.
- Given the renamed file, when `pnpm check` runs, then it passes.

## Spec Change Log

## Review Triage Log

### 2026-10-02 — Review pass
- verdicts: 25 findings — high 0, medium 0, low 15, false 9, maybe-false 1
- findings:
  - `[low]` `[patch]` Verification: `TARGETS` is a hand-kept list; a new `tools/<dir>` wired into the configs without a row is unguarded (grouped with Intent 5 and Edge 1) — added two cases that match every `tools/`/`.claude/` include of `tsconfig.tools.json` and the Vitest `root` project to a `TARGETS` row.
  - `[low]` `[reject]` Verification: `directoryFiles` reads only the top level, so a file in a new subdirectory is not checked — no target has a subdirectory besides the deliberately excluded fixture; recursion plus a fixture exclusion adds complexity for a rare layout.
  - `[false]` `[reject]` Intent 1: real config edits are exercised only by hand — the positive cases read the committed configs, and a mutation probe (dropping `tools/dev-stop/*.ts`, `tools/dts-specifiers/*.test.ts`) failed them.
  - `[false]` `[reject]` Intent 2: ESLint has one shared `tools/**/*.ts` glob, not per-directory entries — descriptive; the guard checks the glob that exists, and per-directory drift cannot occur.
  - `[false]` `[reject]` Intent 3: the diff adds `tools/deferred-issues`, which the summary does not name — it is hand-listed in all three configs, so the summary's "hand-listed `tools/` entries" covers it.
  - `[low]` `[defer]` Intent 4: `tools/prune-pages.mjs` is guarded through tsconfig only (grouped with Blind 1 and Edge 5) — recorded in frontmatter `deferred`.
  - `[low]` `[patch]` Intent 5: `TARGETS` hand-kept (group with Verification 1) — same patch.
  - `[false]` `[reject]` Intent 6: the drop fails `pnpm test`, not `pnpm check` — the summary is "No test checks", which a test now does.
  - `[low]` `[reject]` Intent 7: the old test path stays in the closed spec and the ledger — historical text; the ledger is the caller's and the entry is being removed; OpenWiki regenerates.
  - `[low]` `[patch]` Edge 1: `TARGETS` hand-kept (group with Verification 1) — same patch.
  - `[low]` `[patch]` Edge 2: `SOURCE` skips `.js`/`.mjs`/`.cjs` (grouped with Blind 2) — widened `SOURCE` and `TEST` to `[jt]sx?`; a temporary `tools/dev-stop/helper.mjs` was then reported.
  - `[low]` `[reject]` Edge 3: a symlinked source file is dropped by `isFile()` — the repository has no symlinked sources; unlikely, and the fix adds a branch.
  - `[false]` `[reject]` Edge 4: a renamed target directory throws ENOENT at module load — the file still fails loudly naming the path; a loud failure is correct.
  - `[low]` `[defer]` Edge 5: `prune-pages.mjs` unlinted (group with Intent 4) — deferred.
  - `[false]` `[reject]` Edge 6: a missing `include` array throws a type error — a loud failure; `tsc -b` would reject such a config first.
  - `[low]` `[defer]` Blind 1: the `prune-pages.mjs` target checks almost nothing (group with Intent 4) — deferred.
  - `[low]` `[patch]` Blind 2: `SOURCE` skips JS (group with Edge 2) — same patch.
  - `[false]` `[reject]` Blind 3: ENOENT at module load (same as Edge 4) — same evidence.
  - `[low]` `[defer]` Blind 4: other hand-listed entries (`test/**`, root configs) stay unguarded — pre-existing and outside the entry's `tools/` scope; recorded in frontmatter `deferred`.
  - `[low]` `[defer]` Blind 5: `tools/setup-git-hooks.mjs` is in no config and nothing records it — pre-existing; recorded in frontmatter `deferred`.
  - `[maybe-false]` `[reject]` Blind 6: six nested Vitest globs may exceed the 5 s default per case on a cold run — the whole file ran in about 2.5 s; settle by timing cold CI; if true it is low.
  - `[low]` `[reject]` Blind 7: the shared-glob ESLint negative case repeats per target, and splitting the glob gives a misleading message — the message names the missing entry accurately; rare edit.
  - `[low]` `[reject]` Blind 8: only the innermost `.claude/` negation has a negative case — the positive case fails when either outer negation is dropped (shown in the earlier spec's review); more cases add complexity.
  - `[false]` `[reject]` Blind 9: the TypeScript check measures root files, not program membership — the guard asks whether the hand-listed entry covers the file, which is root-file membership; a file reached only by import still has its entry dropped, which is the drift to report.
  - `[false]` `[reject]` Blind 10: a widened config entry fails with "has no include entry" — that is a loud, named failure telling the editor to update `TARGETS`.

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0
- `pnpm test` -- expected: exit 0
- `pnpm vitest run test/hand-listed-coverage.test.ts` with `tools/dev-stop/*.ts` dropped from `tsconfig.tools.json`, then with `tools/dts-specifiers/*.test.ts` dropped from `vitest.config.ts`, each restored with `git restore` -- expected: fails each time

## Auto Run Result

Status: done

**Summary:** Renamed `test/tracked-json-scripts-coverage.test.ts` to `test/hand-listed-coverage.test.ts` and generalised it over a `TARGETS` table: the tracked-json scripts, `tools/boundary-check`, `tools/deferred-issues`, `tools/dev-stop`, `tools/dts-specifiers` and `tools/prune-pages.mjs`. For each target, TypeScript, ESLint and Vitest are asked through their public APIs whether the committed config still covers every file, and an in-memory copy without each named entry must make the checker report the target's files. Two more cases fail when a `tools/` or `.claude/` include in `tsconfig.tools.json` or the Vitest `root` project has no `TARGETS` row.

**Files changed:**
- `test/hand-listed-coverage.test.ts` -- renamed and generalised guard, 42 cases.
- `docs/stories/spec-deferred-no-test-checks-hand-listed-tools.md` -- this spec.

**Review findings:** 25 findings from 5 layers. 2 low entries were patched: the `TARGETS` completeness cases, and `SOURCE`/`TEST` widened to JS extensions. 3 low pre-existing gaps were deferred (frontmatter `deferred`): `prune-pages.mjs` lint and type-check, `setup-git-hooks.mjs` in no config, and the hand-listed entries outside `tools/` and `.claude/`. 20 were rejected, each with its reason in the Review Triage Log.

**Follow-up review recommendation:** false. The pass patched 0 high, 0 medium and 2 low entries.

**Verification:**
- `pnpm check`: exit 0.
- `pnpm test`: 104 files and 1537 tests passed.
- With `tools/dev-stop/*.ts` dropped from `tsconfig.tools.json`, the guard failed 2 cases; with `tools/dts-specifiers/*.test.ts` dropped from `vitest.config.ts`, it failed 2 cases; with `tools/**/*.ts` dropped from the ESLint `files`, it failed 8 cases. Each config was restored with `git restore`.

**Residual risks:**
- The guard makes six nested Vitest globs; cold CI timing has not been measured.
- `TARGETS` rows are checked against the tsconfig and Vitest includes, not against ESLint globs, because ESLint names `tools/` through one shared glob.
