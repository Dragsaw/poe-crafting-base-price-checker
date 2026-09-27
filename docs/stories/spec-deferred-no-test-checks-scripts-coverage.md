---
title: 'A guard test that the tracked-json scripts stay under type, lint and test coverage'
type: 'chore'
created: '2026-09-27'
status: 'done'
baseline_revision: '3191bbe9e346656c14b504635810639671ac75c2'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      No test checks that the hand-listed `tools/` entries in `tsconfig.tools.json`, `vitest.config.ts` and `eslint.config.mjs` (`tools/boundary-check`, `tools/dev-stop`, `tools/dts-specifiers`, `tools/prune-pages.mjs`) still cover their files; only `.claude/skills/tracked-json/scripts/` has a wiring guard.
    evidence: |-
      The closed entry's evidence says `tools/boundary-check` has no wiring guard either and that the fix belongs to a general "every .ts file is covered" guard. This change built only the tracked-json guard (`test/tracked-json-scripts-coverage.test.ts`), whose checkers are per directory. Dropping, for example, `tools/dev-stop/*.ts` from `tsconfig.tools.json` still fails neither `pnpm check` nor `pnpm test`. Extending the same checkers over each hand-listed directory would close it.
    location: >-
      tsconfig.tools.json
    severity: low
---

<intent-contract>

## Intent

**Problem:** `.claude/skills/tracked-json/scripts/*.ts` sits outside every package, so three hand-written config entries bring it under `pnpm check` and `pnpm test`: the `tsconfig.tools.json` include, the root Vitest project include, and the `.claude/` ignore-negation chain plus `files` glob in `eslint.config.mjs`. If one entry is dropped, `lookup.ts` silently loses that coverage and both commands still pass (deferred entry from `docs/stories/spec-tracked-json-curation-tooling.md`).

**Approach:** Add one root test that asks each tool itself whether it covers every `.ts` file in that directory: TypeScript parses `tsconfig.tools.json` (and `tsconfig.json` references it), ESLint reports the file as not ignored and with a config, and Vitest's own glob collects each `*.test.ts` in the `root` project.

## Boundaries & Constraints

**Always:**
- Enumerate the directory at run time, so a new script is covered by the guard with no edit.
- Fail when the directory holds no `.ts` file or no `.test.ts` file, so the guard cannot pass vacuously.
- Ask each tool through its public API (`typescript`, `eslint`, `vitest/node`); do not re-implement glob matching.
- The test runs offline and writes no file.

**Never:**
- No change to `tsconfig.tools.json`, `vitest.config.ts`, `eslint.config.mjs` or the scripts.
- No general "every `.ts` file in the repo is covered" guard; that is wider than the entry.
- No edit to `docs/stories/deferred-work.md` or `docs/stories/sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Wiring intact | today's three configs | test passes | No error expected |
| tsconfig include dropped | `.claude/skills/tracked-json/scripts/*.ts` removed from `tsconfig.tools.json` | test fails naming each uncovered file | assertion message names tsconfig |
| ESLint negation dropped | one `!.claude/...` line removed | test fails: file is ignored | assertion message names ESLint |
| Vitest include dropped | the root project line removed | test fails: `lookup.test.ts` not collected by `root` | assertion message names Vitest |

</intent-contract>

## Code Map

- `tsconfig.tools.json:17` -- include line `.claude/skills/tracked-json/scripts/*.ts`; `tsconfig.json:9` references `tsconfig.tools.json`, so `tsc -b` builds it.
- `vitest.config.ts:23` -- root project (`name: 'root'`) include `.claude/skills/tracked-json/scripts/*.test.ts`.
- `eslint.config.mjs:64-72` -- `.claude/*` ignore chain with three negations; `:83` `files` glob for the scripts.
- `test/core-purity-lint.test.ts` -- existing pattern: `new ESLint({ cwd: REPO_ROOT })` against the shipped config from a root test.
- `.claude/skills/tracked-json/scripts/` -- today `lookup.ts` and `lookup.test.ts`.
- `vitest/node` `createVitest('test', { watch: false, run: true, root })` then `globTestSpecifications()` lists each spec with `project.name` and `moduleId`; probed in about 0.5 s.

## Tasks & Acceptance

**Execution:**
- `test/tracked-json-scripts-coverage.test.ts` -- new root test. Write one checker per tool that takes a config input and returns the uncovered script paths. Assert each checker returns `[]` for the committed config, and assert it returns the scripts for an in-memory copy with that tool's scripts entry removed (tsconfig: parse the JSON with the include line dropped; ESLint: pass the imported `eslint.config.mjs` array with one `!.claude/...` negation dropped through `overrideConfigFile: true` + `overrideConfig`; Vitest: `createVitest` with the root project's include lacking the scripts line, for example through `config: false` and inline `projects`). The negative cases cover the matrix failure rows and prove the checker is not vacuous -- makes the summary of the deferred entry false.

**Acceptance Criteria:**
- Given the configs as committed, when `pnpm test` runs, then the new test passes.
- Given any one of the three config entries removed locally, when the new test runs, then it fails and its message names the tool and the uncovered file.
- Given the new file, when `pnpm check` runs, then it passes (the test is itself under `test/**`, so all three tools cover it).

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 20 findings — high 0, medium 0, low 12, false 5, maybe-false 3
- findings:
  - `[maybe-false]` `[reject]` Edge: the ESLint and nested `createVitest` cases may exceed the 5 s default timeout on a cold run — measured slowest case 675 ms locally; settle by timing a cold CI run. If true it is low, and adding a timeout is new surface, so rejected.
  - `[false]` `[reject]` Edge: `parseJsonConfigFileContent` errors are not checked, so a broken `extends` is masked — a broken `tsconfig.tools.json` fails `tsc -b` in `pnpm check` loudly, so nothing is masked.
  - `[low]` `[patch]` Edge: a `.mts`/`.cts`/`.tsx` script escapes the `.ts`-only enumeration — widened the script and test-script filters so such a file is reported as uncovered.
  - `[false]` `[reject]` Edge: a missing scripts directory throws ENOENT at module load instead of the named non-vacuity assertion — the file still fails loudly with ENOENT naming the path; a loud failure is correct behavior.
  - `[low]` `[reject]` Edge: only the innermost ESLint negation has a negative case (grouped with Blind 1 and Intent 3) — the positive case was shown to fail when each of the other two negations and the `files` glob is removed (hand removal in step 3; the verification-gap layer probed the `files` glob in memory); more cases add complexity for a rare edit.
  - `[low]` `[reject]` Blind: the ESLint negative case covers one of four ESLint entries (group above) — same evidence.
  - `[false]` `[reject]` Blind: `calculateConfigForFile` returning any config does not prove the TypeScript block applies — no block without `files` exists besides the global ignores; with the scripts glob dropped the verification-gap probe saw both files reported, and a generic JS-only block would fail `eslint .` on TypeScript syntax.
  - `[low]` `[reject]` Blind: `package.json` `typecheck`/`lint`/`test` scripts are not checked — the entry names the three config files only; the command wiring is outside the intent.
  - `[low]` `[defer]` Blind: the general "every .ts file is covered" guard for `tools/` loses its tracked follow-up once the entry is removed (grouped with Intent 1) — pre-existing gap; recorded in frontmatter `deferred`.
  - `[low]` `[reject]` Blind: the spec does not say who removes the ledger entry — fix edits this build's spec; the sweep removes it in the branch's last commit.
  - `[maybe-false]` `[reject]` Blind: no timeout on the Vitest cases (same as Edge timeout) — same evidence.
  - `[maybe-false]` `[reject]` Blind: nested `createVitest` may write cache files, against "writes no file" — `globTestSpecifications` only globs; settle by diffing `node_modules/.vite` before and after. If true it is low (a cache under `node_modules`), so rejected.
  - `[low]` `[patch]` Blind: the negative cases and entry-exists setup checks carry no assertion message — added a message naming the tool and the config entry to each.
  - `[false]` `[reject]` Blind: the ESLint negative case breaks if the config is reformatted — it already searches every block of the flattened array and filters per block; only a changed negation text breaks it, which the new message now names.
  - `[low]` `[reject]` Blind: the Code Map cites `eslint.config.mjs:64-72` while the chain starts at 68 — fix edits this build's spec.
  - `[low]` `[defer]` Intent: the diff guards one directory, not the general guard the evidence names (group with Blind general guard) — deferred as above.
  - `[false]` `[reject]` Intent: `pnpm check` still passes when an entry is dropped — the summary asks for a test; the new test runs under `pnpm test` and fails there.
  - `[low]` `[reject]` Intent: ESLint outer negations, `files` glob and the `tsconfig.json` reference have no negative test (group with Edge ESLint negative) — same evidence.
  - `[low]` `[reject]` Intent: the ledger evidence cites the stale `eslint.config.mjs:25` — ledger text; the sweep removes the entry, and this build may not edit the ledger.
  - `[low]` `[reject]` Intent: the guard relies on the broader `test/**` entries, which it does not guard — outside the entry's summary; dropping `test/**` would drop dozens of suites visibly.

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0
- `pnpm test` -- expected: exit 0
- `pnpm vitest run test/tracked-json-scripts-coverage.test.ts` with each config entry removed in turn, then restored -- expected: fails each time

## Auto Run Result

Status: done

**Summary:** Added `test/tracked-json-scripts-coverage.test.ts`, a root guard that asks TypeScript, ESLint and Vitest through their public APIs whether each file in `.claude/skills/tracked-json/scripts/` is still covered. It also checks that `tsconfig.json` references `tsconfig.tools.json`. Each tool's checker also runs against an in-memory copy of its config with the scripts entry removed, which proves the checker is not vacuous.

**Files changed:**
- `test/tracked-json-scripts-coverage.test.ts` -- new guard test, 8 cases.
- `docs/stories/spec-deferred-no-test-checks-scripts-coverage.md` -- this spec.

**Deviation from the Tasks wording:** the test loads `eslint.config.mjs` and `vitest.config.ts` through a computed `import()` and not static imports. A static import made `tsc -b` fail (TS6307, TS5097), and fixing that would have meant editing `tsconfig.tools.json`, which the spec forbids.

**Review findings:** 20 findings from 5 layers. 2 low findings were patched: the script filter now accepts `.mts`, `.cts` and `.tsx`, and every negative and setup assertion now has a message. 1 low finding was deferred: a general wiring guard for the hand-listed `tools/` entries (frontmatter `deferred`). 17 were rejected, each with its reason in the Review Triage Log.

**Follow-up review recommendation:** false. The pass patched 0 high, 0 medium and 2 low findings.

**Verification:**
- `pnpm check`: exit 0.
- `pnpm test`: 94 files and 1223 tests passed.
- I removed each of these entries in turn and ran `pnpm vitest run test/tracked-json-scripts-coverage.test.ts`, then restored it with `git restore`:
  - the `tsconfig.tools.json` scripts include
  - the ESLint `!.claude/skills/tracked-json/scripts/` negation
  - the Vitest root scripts include

  Each removal made two cases fail. The implementer also saw a failure when the ESLint `files` glob entry was dropped.

**Residual risks:**
- No automated negative case covers the two outer ESLint negations or the `files` glob. Only the positive check guards them, and that check was shown by hand to fail when each is removed.
- The Vitest cases start a nested Vitest instance. They took under 1 s locally, and cold CI timing has not been measured.
