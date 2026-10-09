---
title: 'deferred-post-emit-rewrite-covers-only-contracts — extend the post-emit `.d.ts` specifier rewrite to `core` and `sync`'
type: 'bugfix'
created: '2026-09-27'
status: 'done'
baseline_revision: '4818ae6e6f96662e6ecff1757ec1382314a149bf'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      `TARGET_DIRS` in `tools/dts-specifiers/rewrite-dts-specifiers.ts` is a hand-kept list of packages, and nothing checks it against the `emitDeclarationOnly` packages, so a new such package keeps its `.ts` specifiers in `dist` with no signal.
    evidence: |-
      Review of this spec (blind and edge-case layers). The list was hand-kept before this change too (contracts only), which is how the closed entry arose. A test that reads each `packages/*/tsconfig.json` and compares the `emitDeclarationOnly` ones with `TARGET_DIRS`, or a fourth item in the AGENTS.md "A new package needs three edits" pitfall, would close it.
    location: >-
      tools/dts-specifiers/rewrite-dts-specifiers.ts (TARGET_DIRS)
    severity: low
---

<intent-contract>

## Intent

**Problem:** The post-emit step of `pnpm typecheck` rewrites relative `.ts` specifiers only in `packages/contracts/dist`. `packages/core` and `packages/sync` are also `emitDeclarationOnly` with `allowImportingTsExtensions`, so their `dist/**/*.d.ts` still carry `./x.ts` specifiers (for example `packages/core/dist/index.d.ts`, `packages/sync/dist/dry-run.d.ts`), which a non-TypeScript consumer of `dist` cannot follow.

**Approach:** Add `packages/core/dist` and `packages/sync/dist` to `TARGET_DIRS` in `tools/dts-specifiers/rewrite-dts-specifiers.ts`, the one-line extension the source spec's Design Notes anticipate. Update the doc comments and the bare-`node` spawn test to match.

## Boundaries & Constraints

**Always:** Keep the rewrite function, the walk and the entry guard unchanged. A missing target directory still makes the tool exit non-zero and name the directory. `pnpm check` and `pnpm test` stay green.

**Never:** Do not change any source specifier under `packages/*/src` or any `tsconfig.json`. Do not add `packages/web` (it emits no declarations). Do not add a dependency. Do not edit `docs/stories/deferred-work.md` or `docs/stories/sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| all three dists present | each `packages/{contracts,core,sync}/dist/index.d.ts` holds `from './a.ts'` | each file reads `from './a.js'`, exit 0 | none |
| contracts dist missing | no `packages/contracts/dist` | exit non-zero, stderr names `packages/contracts/dist` | fails `pnpm typecheck` loudly |
| core or sync dist missing | contracts present, `packages/core/dist` absent | exit non-zero, stderr names the missing directory | fails `pnpm typecheck` loudly |

</intent-contract>

## Code Map

- `tools/dts-specifiers/rewrite-dts-specifiers.ts:83-87` -- `TARGET_DIRS`, built with `fileURLToPath(new URL('../../packages/contracts/dist', import.meta.url))`; its doc comment says "Only the contracts output". The module header (lines 12-24) names only `packages/contracts`.
- `tools/dts-specifiers/rewrite-dts-specifiers.test.ts:235-270` -- `copyToolIntoScratch` and the two spawn tests. The rewrite test seeds only `packages/contracts/dist`, so it fails once the tool also expects `core` and `sync`; the missing-dist test asserts the contracts path.
- `packages/core/tsconfig.json`, `packages/sync/tsconfig.json` -- `emitDeclarationOnly`, `allowImportingTsExtensions`, `outDir: dist`. Read-only.
- `packages/core/package.json`, `packages/sync/package.json` -- `exports["."].types` = `./dist/index.d.ts`. Read-only.
- `package.json` -- `typecheck` already runs the tool after `tsc -b`. No change.

## Tasks & Acceptance

**Execution:**
- `tools/dts-specifiers/rewrite-dts-specifiers.ts` -- add `packages/core/dist` and `packages/sync/dist` to `TARGET_DIRS`; reword the module header and the `TARGET_DIRS` comment so they name the three `emitDeclarationOnly` packages -- the fix the entry names.
- `tools/dts-specifiers/rewrite-dts-specifiers.test.ts` -- the bare-`node` rewrite test seeds and asserts all three dists; add a spawn test where contracts exists and `packages/core/dist` is missing, asserting non-zero exit and the core path in stderr -- covers the matrix.

**Acceptance Criteria:**
- Given a clean checkout, when `pnpm typecheck` runs, then no `packages/{contracts,core,sync}/dist/**/*.d.ts` contains a relative specifier that ends in `.ts`, `.tsx`, `.mts` or `.cts`.
- Given the rewritten dists, when `pnpm check` runs a second time, then it passes.
- Given the workspace, when `pnpm test` runs, then it passes.

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 16 findings — high 0, medium 0, low 9, false 7, maybe-false 0
- findings:
  - `[low]` `[reject]` edge: a missing core dist exits 1 after contracts is already rewritten (partial mutation). The rewrite is idempotent, and `pnpm typecheck` fails loudly. `tsc -b` emits all three dists before the tool runs, so a user rarely meets this. A pre-check adds a branch.
  - `[low]` `[reject]` edge: stderr names only the first missing directory. The same reason applies: `tsc -b` emits every dist first, and collecting all names adds a branch.
  - `[low]` `[defer]` edge: the hardcoded list skips a future `emitDeclarationOnly` package silently. This existed before the change, so it goes to frontmatter `deferred`.
  - `[false]` `[reject]` edge: "if sync is dropped from `TARGET_DIRS`, no test fails". This is refuted: the three-dist spawn test seeds `sync` and asserts its rewrite, so it fails.
  - `[false]` `[reject]` edge: the claim that the matrix row "core or sync dist missing" is untested. The row is satisfied by one instance, and the core test covers it. Every directory takes the same loop path.
  - `[low]` `[defer]` blind: the hardcoded package list lets the bug come back. It has the same root cause as the edge row above and shares its deferral.
  - `[low]` `[reject]` blind: a missing directory stops the run partway. The same refutation applies as the two edge rows above.
  - `[false]` `[reject]` blind: the sync-missing case is half tested. The refutation is the same as the edge `sync` row.
  - `[low]` `[reject]` blind: the AC and the Verification grep would also flag a legitimate `./x.d.ts` specifier. The fix edits this build's spec, and no such specifier occurs in the emitted output: the grep returns nothing.
  - `[false]` `[reject]` blind: consumer resolution is unchecked for core and sync. This is refuted by two compiles against the rewritten dists. `tsc -p packages/sync/tsconfig.json --noEmit` (composite and declaration off) exits 0. `tsc -p packages/web/tsconfig.json --composite false --incremental false` exits 0. The Bundler and NodeNext consumer-compile tests of the source spec already prove the `.js`→`.d.ts` mechanism.
  - `[false]` `[reject]` blind: a second `tsc -b` may rebuild sync each time. This is refuted: `tsc -b --verbose` after `pnpm check` reports every project up to date.
  - `[low]` `[reject]` blind: the Code Map cites line numbers. The fix edits this build's spec.
  - `[false]` `[reject]` blind: the spec does not say who removes the ledger entry. The intent says the caller maintains `deferred-work.md`, and the caller removes the entry.
  - `[low]` `[patch]` blind: the header doc comment was not reflowed after the edit. Fixed: the paragraph is rewrapped to the width of the block, with no wording change.
  - `[false]` `[reject]` blind: the spec is `in-review` with empty review sections. That is the state this step starts from, and this pass fills them.
  - `[low]` `[reject]` intent: no automated test runs against the real `tsc -b` output of core or sync. The Verification grep checks the real output, and the source spec's scratch-emit test covers the walk. A real-output test would repeat the grep inside `pnpm test` and depend on build order.

## Verification

**Commands:**
- `pnpm check` -- expected: passes (twice in a row).
- `pnpm test` -- expected: passes.
- `grep -rEn "(from|import)\s*\(?\s*['\"]\.{1,2}/[^'\"]*\.(ts|tsx|mts|cts)['\"]" packages/contracts/dist packages/core/dist packages/sync/dist --include=*.d.ts` -- expected: no output.

## Auto Run Result

Status: done

**Summary:** The post-emit step of `pnpm typecheck` now rewrites the relative `.ts` specifiers in `packages/core/dist` and `packages/sync/dist` as well as `packages/contracts/dist`. After `pnpm typecheck`, `packages/core/dist/index.d.ts` re-exports from `./chunk-order.js`.

**Files changed:**
- `tools/dts-specifiers/rewrite-dts-specifiers.ts` -- `TARGET_DIRS` now lists the `contracts`, `core` and `sync` dists. The module header and the `TARGET_DIRS` comment name the three `emitDeclarationOnly` packages.
- `tools/dts-specifiers/rewrite-dts-specifiers.test.ts` -- a `seedDist` helper. The bare-`node` rewrite test covers all three dists. A new spawn test covers a missing core dist.

**Review findings:** 16 findings: high 0, medium 0, low 9, false 7.
- Patched (1 low): the header comment is reflowed.
- Deferred (1 low, from two reviewer rows): `TARGET_DIRS` is hand-kept and nothing checks it against the `emitDeclarationOnly` packages.
- Rejected:
  - partial mutation, and only the first missing directory named: `tsc -b` emits every dist first, and a pre-check adds a branch
  - the `.d.ts` stem in the AC or grep, and the Code Map line numbers: the fix would edit this spec
  - no automated test against the real output: the Verification grep covers it
  - the sync-missing test, consumer resolution, the incremental rebuild, the owner of ledger removal, and the empty review sections: false, with refutations in the triage log

**Follow-up review recommendation:** false. Patched on this first pass: high 0, medium 0, low 1.

**Verification:**
- `pnpm check` passed three times: twice by the implementer and once after the patch.
- `pnpm test` passed: 93 files, 1215 tests.
- The Verification grep over the three dists found nothing.
- `tsc -p packages/sync/tsconfig.json --noEmit` and `tsc -p packages/web/tsconfig.json --composite false --incremental false` exit 0 against the rewritten dists.
- `tsc -b --verbose` reports every project up to date after `pnpm check`.

**Residual risks:** A bare `tsc -b`, watch mode or an IDE re-emit writes the `.ts` specifiers back until the next `pnpm typecheck`. This existed before the change and the module header documents it.
