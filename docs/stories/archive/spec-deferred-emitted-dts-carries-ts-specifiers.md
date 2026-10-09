---
title: 'deferred-emitted-dts-carries-ts-specifiers — rewrite the `.ts` specifiers out of the emitted contracts declarations'
type: 'bugfix'
created: '2026-09-26'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      The post-emit rewrite covers only `packages/contracts/dist`; `packages/core/dist` and `packages/sync/dist` emit the same `.d.ts` shape and still carry relative `.ts` specifiers.
    evidence: |-
      The spec's Never boundary excludes them because the closed entry named only contracts. A grep after `pnpm typecheck` on 2026-09-26 finds `.ts` specifiers in `packages/core/dist/index.d.ts` and `packages/sync/dist/dry-run.d.ts`. The fix is to add both directories to `TARGET_DIRS` in `tools/dts-specifiers/rewrite-dts-specifiers.ts`.
    location: >-
      tools/dts-specifiers/rewrite-dts-specifiers.ts
    severity: low
baseline_revision: '8c64767485f108cbbccd6ed067856789a4eafd3f'
---

<intent-contract>

## Intent

**Problem:** `pnpm typecheck` (`tsc -b`) emits `packages/contracts/dist/*.d.ts` with relative specifiers that end in `.ts` (`export { … } from './schema-version.ts'`). TypeScript follows them, but a non-TypeScript consumer of `dist` does not. Neither `rewriteRelativeImportExtensions` nor dropping `emitDeclarationOnly` fixes it: TypeScript 6.0.3 rewrites the `.js` output only and leaves the `.d.ts` output unchanged (probed 2026-09-26 in a scratch project: `--declaration --rewriteRelativeImportExtensions` without `emitDeclarationOnly` emits `from "./a.js"` in `index.js` and `from './a.ts'` in `index.d.ts`).

**Approach:** Add a post-emit step to `pnpm typecheck` that rewrites each relative `.ts`/`.tsx`/`.mts`/`.cts` specifier in `packages/contracts/dist/**/*.d.ts` to `.js`/`.js`/`.mjs`/`.cjs`. The tool is a small TypeScript module under `tools/`, run by bare `node` (type stripping), with the pure rewrite exported for tests.

## Boundaries & Constraints

**Always:** Keep `emitDeclarationOnly` and `allowImportingTsExtensions` in `packages/contracts/tsconfig.json`. The bare-`node` entries load `src` directly and need the `.ts` specifiers in source. Rewrite only relative specifiers (`./`, `../`). Leave a specifier that ends in `.d.ts` unchanged. Write a file only when its content changes. `pnpm check` and `pnpm test` stay green.

**Never:** Do not change any source specifier under `packages/*/src`. Do not rewrite `packages/core/dist` or `packages/sync/dist`: the entry names only the contracts output (see Design Notes). Do not add a dependency. Do not edit `docs/stories/deferred-work.md` or `docs/stories/sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| static re-export | `export { a } from './a.ts';` | `export { a } from './a.js';` | none |
| type import, double quotes | `import type { B } from "../b.ts";` | `import type { B } from "../b.js";` | none |
| inline type query | `x: import('./c.ts').C;` | `x: import('./c.js').C;` | none |
| module extensions | `'./m.mts'`, `'./c.cts'`, `'./t.tsx'` | `'./m.mjs'`, `'./c.cjs'`, `'./t.js'` | none |
| bare or scoped package | `from 'zod'`, `from '@poe/x.ts'` | unchanged | none |
| declaration specifier | `from './types.d.ts'` | unchanged | none |
| already rewritten | `from './a.js'` | unchanged, file not rewritten | none |
| dist missing | `packages/contracts/dist` absent | tool exits non-zero and names the directory | fails `pnpm typecheck` loudly |

</intent-contract>

## Code Map

- `packages/contracts/tsconfig.json` -- `emitDeclarationOnly` + `allowImportingTsExtensions`, `outDir: dist`. Read-only.
- `packages/contracts/package.json` -- `exports["."].types` = `./dist/index.d.ts`: the surface the entry names. Read-only.
- `package.json` -- `"typecheck": "tsc -b"`; `check` runs `typecheck`. Add the post-emit step here.
- `tsconfig.tools.json` -- `include` lists `tools/boundary-check/*.ts`; add the new tool directory so `tsc -b` checks it.
- `vitest.config.ts` -- the root project `include` lists `tools/boundary-check/*.test.ts`; add the new test glob.
- `eslint.config.mjs` -- already lints `tools/**/*.ts`. No change.
- `tools/boundary-check/boundary.test.ts` -- idiom for a tool-level test (vitest, `node:url` paths).

## Tasks & Acceptance

**Execution:**
- `tools/dts-specifiers/rewrite-dts-specifiers.ts` -- export `rewriteDtsSpecifiers(text: string): string` and `rewriteDtsSpecifiersIn(dir: string): string[]` (returns the files changed). When run as the entry, walk `packages/contracts/dist` and exit non-zero if the directory is missing -- the post-emit rewrite.
- `tools/dts-specifiers/rewrite-dts-specifiers.test.ts` -- unit-test each I/O matrix row. Add one emit test: run the workspace `typescript` compiler on a scratch project in a temp dir (`emitDeclarationOnly`, `allowImportingTsExtensions`), run `rewriteDtsSpecifiersIn` on its `outDir`, and assert that no `.d.ts` carries a relative `.ts` specifier. Assert that the root `typecheck` script runs the tool after `tsc -b`.
- `package.json` -- `typecheck` becomes `tsc -b && node tools/dts-specifiers/rewrite-dts-specifiers.ts`.
- `tsconfig.tools.json`, `vitest.config.ts` -- include the new directory.

**Acceptance Criteria:**
- Given a clean checkout, when `pnpm typecheck` runs, then no `packages/contracts/dist/**/*.d.ts` contains a relative specifier that ends in `.ts`, `.tsx`, `.mts` or `.cts`, and `packages/contracts/dist/index.d.ts` re-exports from `./schema-version.js`.
- Given the rewritten `dist`, when `pnpm check` runs a second time, then it passes (the downstream projects resolve `./x.js` to `x.d.ts`).
- Given the workspace, when `pnpm test` runs, then the new tests pass and no existing test changes.

## Spec Change Log

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 27 findings — high 0, medium 5, low 21, false 1, maybe-false 0 (grouped rows carry their group's verdict)
- findings:
  - `[low]` `[patch]` blind: the entry guard lacks realpath and no test runs the bare-`node` entry — worst case is a silent exit 0 that leaves `.ts` specifiers, which is the original low defect. Fixed: `isInvokedDirectly()` compares `realpathSync` of both sides (the `sync.ts` idiom); spawn tests run a scratch copy of the tool for the rewrite case and the missing-dist case.
  - `[medium]` `[patch]` blind: the emit test never proves that the rewritten output resolves. Fixed: consumer compile of the rewritten scratch `dist` under Bundler and NodeNext, zero diagnostics asserted.
  - `[false]` `[reject]` blind: a second `tsc -b` over rewritten outputs is unverified — `tsc -b --verbose` after `pnpm typecheck` reports every project up to date, and a re-emit under `pnpm typecheck` is rewritten again.
  - `[low]` `[patch]` blind: `.d.mts`/`.d.cts` files are never walked. Fixed: walk matches `/\.d\.[mc]?ts$/`, with a `.d.mts` test.
  - `[low]` `[patch]` blind: the side-effect import and multi-line re-export are untested. Fixed: one unit test each.
  - `[low]` `[reject]` blind: `declare module`, `import = require` and `/// <reference path>` forms are not rewritten — none occurs in the ESM, `verbatimModuleSyntax` contracts output, and handling them adds branches.
  - `[low]` `[reject]` blind: the regex also rewrites specifier-shaped text in JSDoc — harmless (the comment then names the resolvable path); a comment-aware scan adds complexity.
  - `[medium]` `[defer]` blind: the `core`/`sync` gap is recorded only in Design Notes. Deferred to frontmatter `deferred`.
  - `[low]` `[reject]` blind: symlink cycles and non-atomic writes — `tsc` emits no symlinks into `dist`, and an interrupted write is repaired by the next `pnpm typecheck`; the guards add complexity.
  - `[low]` `[reject]` blind: the script test pins an exact string — deliberate; the string is the wiring the spec prescribes.
  - `[low]` `[patch]` blind: a bare `tsc -b`, watch or IDE build skips the rewrite. Fixed: the doc comment says so.
  - `[low]` `[patch]` blind: the emit test may exceed 5 s on a cold run. Fixed: `COMPILE_TIMEOUT` 30_000 on the compile tests.
  - `[low]` `[patch]` edge: realpath guard — same group as the blind entry-guard row.
  - `[low]` `[patch]` edge: `.d.mts`/`.d.cts` walk — same group as above.
  - `[low]` `[reject]` edge: `declare module`/`require`/reference forms — same refutation as above.
  - `[low]` `[reject]` edge: comment text rewritten — same reason as above.
  - `[low]` `[patch]` edge: bare `tsc -b` re-emit — same group as the doc-comment row.
  - `[low]` `[reject]` edge: symlink cycle — same reason as above.
  - `[low]` `[patch]` edge: exit-code path untested — same group as the entry-guard row.
  - `[low]` `[patch]` verification-gap: the bare-`node` entry path is never executed — same group as the entry-guard row.
  - `[medium]` `[patch]` verification-gap: downstream consumption of the rewritten `.d.ts` is never type-checked — same group as the consumer-compile row.
  - `[low]` `[patch]` verification-gap other: guard lacks realpath — same group as the entry-guard row.
  - `[low]` `[reject]` verification-gap other: `*.test.d.ts` files are emitted into `dist` — pre-existing tsconfig `include`, harmless, not caused by this change.
  - `[medium]` `[defer]` intent: scope (b), `core`/`sync` dist still carry `.ts` specifiers — same group as the deferred row.
  - `[low]` `[patch]` intent: the invariant holds only on the `pnpm typecheck` path — same group as the doc-comment row.
  - `[low]` `[reject]` intent: the ledger evidence says dropping `emitDeclarationOnly` would settle it; the correction lives only in this spec — the ledger entry is removed on close, and this spec's Intent records the probe.
  - `[medium]` `[defer]` ledger: the `core`/`sync` carve-out has no ledger entry — same group as the deferred row; the caller appends the frontmatter `deferred` item to the ledger.

## Design Notes

A post-emit rewrite is the only option of the two that the entry names that changes the `.d.ts` output. The probe in Intent shows that dropping `emitDeclarationOnly` changes only the `.js` output. A `.js` specifier in a declaration file resolves to the sibling `.d.ts` under every TypeScript module resolution mode. `packages/core` and `packages/sync` emit the same shape, but the entry names only contracts, and the intent asks for the smallest change. The tool takes a directory, so a later change can add those two packages in one line.

## Verification

**Commands:**
- `pnpm check` -- expected: passes.
- `pnpm test` -- expected: passes.
- `grep -rEn "from '\.{1,2}/[^']*\.(ts|tsx|mts|cts)'" packages/contracts/dist --include=*.d.ts` -- expected: no output.

## Auto Run Result

Status: done

**Summary:** `pnpm typecheck` now runs `tsc -b` and then a post-emit step that rewrites each relative `.ts`/`.tsx`/`.mts`/`.cts` specifier in `packages/contracts/dist/**/*.d.{,m,c}ts` to `.js`/`.js`/`.mjs`/`.cjs`. `packages/contracts/dist/index.d.ts` now re-exports from `./schema-version.js`.

**Files changed:**
- `tools/dts-specifiers/rewrite-dts-specifiers.ts` -- new: the pure rewrite, the directory walk, and a realpath-guarded bare-`node` entry that targets `packages/contracts/dist` and exits 1 when it is missing.
- `tools/dts-specifiers/rewrite-dts-specifiers.test.ts` -- new: 18 tests (matrix rows, `.d.mts` walk, a scratch `tsc` emit, consumer compiles under Bundler and NodeNext, spawn tests of the entry, the script wiring).
- `package.json` -- `typecheck` runs the post-emit step after `tsc -b`.
- `tsconfig.tools.json`, `vitest.config.ts` -- include `tools/dts-specifiers`.

**Review findings:** 27 findings. Patched: 1 medium entry (consumer compile), 5 low entries (entry guard and spawn test, `.d.mts` walk, side-effect and multi-line tests, doc comment on other `tsc -b` paths, compile timeout). Deferred: 1 (the `core`/`sync` dist carry the same specifiers). Rejected: `declare module`/`require`/reference forms (absent from ESM output, adds branches); JSDoc text rewrite (harmless); symlink cycles and non-atomic writes (not reachable from `tsc` output); exact-string script test (deliberate wiring); `*.test.d.ts` in `dist` (pre-existing); the ledger evidence wording (the entry is removed on close); a second `tsc -b` (false: verified up to date).

**Follow-up review recommendation:** false. Patched on this first pass: high 0, medium 1, low 5.

**Verification:** `pnpm check` passes twice in a row. The Verification grep returns nothing. `pnpm test`: 786 of 787 pass. The one failure, `packages/web/src/load/load-artifacts.test.ts` > "the committed data/ set", is on the baseline too: baseline commit `8c64767` added `data/recipes.json`, and the test still expects `recipes` to be absent. This change does not touch `packages/web` or `data/`.

**Residual risks:** A bare `tsc -b`, watch mode or an IDE build that re-emits contracts writes the `.ts` specifiers back until the next `pnpm typecheck`. The pre-existing web test failure blocks any gate that needs a green `pnpm test` until someone fixes it.
