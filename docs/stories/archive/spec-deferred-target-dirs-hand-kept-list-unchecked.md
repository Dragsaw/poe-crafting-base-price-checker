---
title: 'deferred-target-dirs-hand-kept-list-unchecked — check `TARGET_DIRS` against the `emitDeclarationOnly` packages'
type: 'chore'
created: '2026-10-02'
status: 'done'
baseline_revision: '47fb4d737602a71015a8398eab68cf891d8c62dc'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `TARGET_DIRS` in `tools/dts-specifiers/rewrite-dts-specifiers.ts` is a hand-kept list (`contracts`, `core`, `sync`). Nothing compares it with the packages whose `tsconfig.json` sets `emitDeclarationOnly`, so a new such package keeps its `.ts` specifiers in `dist` with no signal.

**Approach:** Export the package list from the tool, and add a test that resolves each `packages/*/tsconfig.json` with the TypeScript config API and asserts that the set of `emitDeclarationOnly` packages equals that list.

## Boundaries & Constraints

**Always:** Resolve each tsconfig through `ts.readConfigFile` and `ts.parseJsonConfigFileContent`, so JSONC comments and `extends` are honoured. The tool still imports only builtins, because bare `node` runs it. The rewrite function, the walk, the entry guard and the CLI behaviour stay unchanged. `pnpm check` and `pnpm test` stay green.

**Never:** Do not change any `tsconfig.json`, any `packages/*/src` file, `AGENTS.md`, `docs/stories/deferred-work.md` or `docs/stories/sprint-status.yaml`. Do not derive `TARGET_DIRS` from the tsconfigs at run time: that makes the tool parse JSONC and is a larger change than the entry asks for. Do not add a dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| in sync | `contracts`, `core`, `sync` set `emitDeclarationOnly`; `web` sets `noEmit` | the test passes | none |
| new package | a `packages/x/tsconfig.json` sets `emitDeclarationOnly` and the list lacks `x` | the test fails and its diff names `x` | `pnpm test` fails |
| stale list | the list names a package whose tsconfig no longer sets `emitDeclarationOnly` | the test fails and its diff names it | `pnpm test` fails |

</intent-contract>

## Code Map

- `tools/dts-specifiers/rewrite-dts-specifiers.ts:84-91` -- `TARGET_DIRS`, built by mapping `['contracts', 'core', 'sync']` to `../../packages/<pkg>/dist`. The literal array becomes an exported `TARGET_PACKAGES` constant; `TARGET_DIRS` maps it.
- `tools/dts-specifiers/rewrite-dts-specifiers.test.ts:1-40` -- already imports `typescript` (`ts`), `fileURLToPath` and `readFileSync`; imports `rewriteDtsSpecifiers` and `rewriteDtsSpecifiersIn` from the tool. The new test goes here.
- `packages/{contracts,core,sync}/tsconfig.json` -- `emitDeclarationOnly: true`, with `//` comments (JSONC) and `extends: ../../tsconfig.base.json`. Read-only.
- `packages/web/tsconfig.json` -- `noEmit: true`. Read-only.
- `tsconfig.base.json` -- sets no emit option. Read-only.

## Tasks & Acceptance

**Execution:**
- `tools/dts-specifiers/rewrite-dts-specifiers.ts` -- export `TARGET_PACKAGES` (the package names) with a doc comment that names the test that guards it; build `TARGET_DIRS` from it -- gives the test one source to compare.
- `tools/dts-specifiers/rewrite-dts-specifiers.test.ts` -- add a test that lists `packages/*` directories with a `tsconfig.json`, resolves each with the TypeScript config API, collects those with `options.emitDeclarationOnly === true`, and asserts the sorted list equals the sorted `TARGET_PACKAGES` -- covers the matrix.

**Acceptance Criteria:**
- Given the workspace as committed, when `pnpm test` runs, then the new test passes.
- Given a temporary edit that removes `'sync'` from `TARGET_PACKAGES`, when the new test runs, then it fails and names `sync`.
- Given the workspace, when `pnpm check` runs, then it passes.

## Spec Change Log

## Review Triage Log

### 2026-10-02 — Review pass
- verdicts: 15 findings — high 0, medium 0, low 10, false 3, maybe-false 2
- findings:
  - `[low]` `[reject]` edge: an `emitDeclarationOnly` package whose `outDir` is not `dist` passes the test. The tool then throws `declaration directory not found` and `pnpm typecheck` exits 1 naming the directory, so the drift is loud, not silent. Every package uses `outDir: dist` today, and the fix adds a second assertion.
  - `[low]` `[reject]` edge: a package with only `tsconfig.build.json` is skipped. The root `tsconfig.json` references each package directory, which resolves to its `tsconfig.json`, and no package uses another name. Unlikely, and the fix adds a branch.
  - `[low]` `[reject]` edge: a symlinked or junction `packages/<x>` is skipped by `isDirectory()`. No package is linked, and `pnpm-workspace.yaml` globs real directories. Unlikely, and the fix adds a branch.
  - `[false]` `[reject]` edge: TS18003 ("No inputs were found") throws instead of the list diff. The test still fails, and the TypeScript message names the config path, so the signal exists.
  - `[low]` `[reject]` intent: the test compares package names, not the `TARGET_DIRS` paths or `outDir`. Same root cause and reason as the first edge row.
  - `[false]` `[reject]` intent: an `emitDeclarationOnly` project outside `packages/*` gets no signal. The entry scopes the check to `packages/*/tsconfig.json`, and `pnpm-workspace.yaml` lists only `packages/*`.
  - `[low]` `[reject]` intent: the stale-list direction was not shown to run. Shown during triage: with `'web'` added to `TARGET_PACKAGES`, the test failed with `+   "web"` in its diff, then the list was restored. No code change.
  - `[maybe-false]` `[reject]` blind: the predicate should also catch a full-emit package with `declaration` and `allowImportingTsExtensions`. Settling it needs a check of whether `rewriteRelativeImportExtensions` rewrites `.d.ts` specifiers. If true it is only low, because the entry names `emitDeclarationOnly` packages and none emits in full today.
  - `[low]` `[reject]` blind: the `dist` path is assumed and not checked. Same root cause and reason as the first edge row.
  - `[low]` `[patch]` blind: the module header still named contracts, core and sync, a second hand-kept copy of the list. Fixed: the header now refers to the packages `TARGET_PACKAGES` lists, and the paragraph is reflowed.
  - `[low]` `[reject]` blind: discovery scans `packages/*` and ignores the workspace globs. `pnpm-workspace.yaml` is exactly `packages/*`, so the two sets are the same.
  - `[low]` `[reject]` blind: the spec's Verification exercises only the new-package direction. Same as the intent stale-list row: demonstrated in triage, and the fix would edit this spec.
  - `[false]` `[reject]` blind: the spec does not say who removes the ledger entry. The intent says the caller maintains `deferred-work.md`, and the caller removes the entry.
  - `[low]` `[patch]` blind: the `TARGET_PACKAGES` doc comment named its guard by the exact test title. Fixed: it now names the `TARGET_PACKAGES` describe block.
  - `[maybe-false]` `[reject]` verification-gap (other): a listed package with a different `outDir` fails at typecheck with "missing dir". Same root cause as the first edge row. The reviewer itself calls the failure loud, so at most low.

## Verification

**Commands:**
- `pnpm check` -- expected: passes.
- `pnpm test` -- expected: passes.
- `pnpm vitest run tools/dts-specifiers` with `'sync'` temporarily removed from `TARGET_PACKAGES` -- expected: the new test fails naming `sync`; restore afterwards.

## Auto Run Result

Status: done

**Summary:** A new test makes `TARGET_DIRS` drift visible. It resolves each `packages/*/tsconfig.json` with the TypeScript config API and fails unless the `emitDeclarationOnly` packages equal the exported `TARGET_PACKAGES`, from which `TARGET_DIRS` is built.

**Files changed:**
- `tools/dts-specifiers/rewrite-dts-specifiers.ts` -- exports `TARGET_PACKAGES`, and builds `TARGET_DIRS` from it. The module header and the doc comments refer to the list and do not restate it.
- `tools/dts-specifiers/rewrite-dts-specifiers.test.ts` -- a `resolveCompilerOptions` helper and the `TARGET_PACKAGES` describe block with the guard test.

**Review findings:** 15 findings: high 0, medium 0, low 10, false 3, maybe-false 2.
- Patched (2 low): the module header no longer names the three packages, and the `TARGET_PACKAGES` comment names its describe block, not the test title.
- Deferred: none.
- Rejected:
  - an `outDir` other than `dist`, raised in four rows: the tool already fails loudly at typecheck
  - a package with only `tsconfig.build.json`, and a symlinked package: unlikely, and each fix adds a branch
  - TS18003, a project outside `packages/*`, and the owner of ledger removal: false
  - a full-emit package with `.ts` specifiers: maybe-false, at most low, outside the entry's `emitDeclarationOnly` scope
  - discovery against the workspace globs: the globs are exactly `packages/*`
  - the stale-list direction not shown: demonstrated during triage

**Follow-up review recommendation:** false. This first pass patched high 0, medium 0, low 2.

**Verification:**
- `pnpm check` passed.
- `pnpm test` passed: 104 files, 1503 tests.
- `pnpm vitest run tools/dts-specifiers` passed 20 of 20 tests after the final comment reflow.
- Negative checks:
  - with `'sync'` removed, the guard test failed showing `-   "sync"`
  - with `'web'` added, it failed showing `+   "web"`
  - the list was restored both times

**Residual risks:** The guard checks which packages are listed, not where they emit. A package with an `outDir` other than `dist` still fails, loudly, at `pnpm typecheck`.
