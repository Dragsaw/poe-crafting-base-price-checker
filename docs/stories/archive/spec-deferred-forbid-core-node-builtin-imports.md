---
title: 'deferred-forbid-core-node-builtin-imports: enforce core import purity in depcruise'
type: 'chore'
created: '2026-09-26'
status: 'done'
baseline_revision: '79f3a8aee05a6ac83c0812c45e7ae14bdb9f5dcc'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      Nothing forbids `core` from doing I/O, reading the clock, generating randomness or reading env through globals such as `fetch`, `Date.now()`, `Math.random()` or `process.env`. The depcruise purity rules see imports only.
    evidence: |-
      AD-1 says no `core` module performs I/O, reads the clock, generates randomness or reads environment or config. The deferred-forbid-core-node-builtin-imports rules (`no-core-to-node-builtin`, `no-core-to-npm-package`) close the import path only, and a `Date.now()` in `packages/core/src` still passes `pnpm check`. An ESLint `no-restricted-globals` / `no-restricted-properties` block scoped to `packages/core/src/**` (tests excluded) would make it checkable. Out of scope here because the closed entry covered imports only.
    location: >-
      depcruise.rules.mjs; eslint.config.mjs
    severity: medium
---

<intent-contract>

## Intent

**Problem:** AD-1 says no `core` module performs I/O, and it names `dependency-cruiser` as the mechanism that fails CI on a violation. But the five depcruise rules constrain only the direction of workspace edges. So an `import { readFileSync } from 'node:fs'` in `core`, or an import of an npm package added to `core`'s manifest, passes `pnpm check`.

**Approach:** Add two `core`-scoped rules at `error` severity. One forbids Node builtins (dependency type `core`). The other forbids any resolved target outside `packages/`. Narrow the shipped `exclude` so that resolved npm modules stay visible to the rules. Extend the boundary fixture and test with one violation for each new rule.

## Boundaries & Constraints

**Always:** Every rule lives in `depcruise.rules.mjs` at `error` severity, and its comment names the forbidden edge and cites AD-1. `@poe/contracts` and relative imports inside `core` stay allowed. Each shipped rule has exactly one violation in the forbidden fixture. The existing five violations stay exactly as they are.

**Never:** No change to AD-1, the PRD or the package graph. No new dependency. Do not touch `docs/stories/deferred-work.md` or `sprint-status.yaml`. Do not scope the rules to `sync`, `web` or `contracts`. Do not detect globals such as `process.env` or `Date.now()`: the entry covers imports only.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Builtin in core | `packages/core/src/x.ts` imports `node:fs` or `fs` | depcruise reports `no-core-to-node-builtin` | `pnpm check` exits non-zero |
| npm package in core | `core` source imports a resolvable npm package | depcruise reports `no-core-to-npm-package` | `pnpm check` exits non-zero |
| Allowed | `core` imports `@poe/contracts` or `./sibling.ts` | no violation | none |
| Core test file | `packages/core/src/*.test.ts` imports `vitest` | no violation (a test file is not a valuation module) | none |

</intent-contract>

## Code Map

- `depcruise.rules.mjs` -- the single rules array. The shipped config and the boundary test both consume it.
- `.dependency-cruiser.mjs` -- `options.exclude.path` is `(^|/)(node_modules|dist)/|^tools/boundary-check/fixture/`. Probe: that exclude **drops every resolved npm dependency** from the output. A package resolves under `node_modules/.pnpm/...`, and a `dist/` entry such as vitest's also matches `(^|/)dist/`. So a rule over npm targets could never fire. `doNotFollow: node_modules` already stops traversal into packages.
- `tools/boundary-check/boundary.test.ts` -- `EXPECTED_VIOLATIONS` (one per rule, sorted by rule name). The count must equal `rules.length`. The allowed fixture must report zero violations.
- `tools/boundary-check/fixture/forbidden/packages/core/src/index.ts` -- holds the core-to-sync and core-to-web edges. Add the new violations here. The fixture is excluded from lint and typecheck (`eslint.config.mjs:21`, `tsconfig.tools.json:22`).
- `tools/boundary-check/fixture/allowed/packages/core/src/` -- the mirror tree. Add a test-file case here.
- Tooling: Serena's active project is the primary checkout, not this worktree, and no tool can switch it. A Serena edit would land outside the worktree. Use Read and Edit on absolute paths in the worktree. All touched files are `.mjs` config or small fixtures.
- Probe facts: `node:fs` resolves to `fs` with dependencyTypes `['core', ...]`. `@poe/contracts` resolves to `packages/contracts/src/index.ts`. From the fixture base dir, a root devDependency resolves to `../../../../node_modules/.pnpm/<pkg>@<ver>/...`.

## Tasks & Acceptance

**Execution:**
- `.dependency-cruiser.mjs` -- change the exclude to `^packages/[^/]+/(node_modules|dist)/|^tools/boundary-check/fixture/`, with a comment on why resolved npm modules must stay in the graph -- otherwise the npm rule is inert.
- `depcruise.rules.mjs` -- add `no-core-to-node-builtin` (from `^packages/core/` with pathNot `\.test\.ts$`, to dependencyTypes `['core']`) and `no-core-to-npm-package` (same from, to pathNot `^packages/` and dependencyTypesNot `['core']`). Update the header comment -- this makes AD-1 purity checkable.
- `tools/boundary-check/fixture/forbidden/packages/core/src/index.ts` -- add `import type` of `node:fs` and of `dependency-cruiser` (a root devDependency, so it resolves from the fixture), and update the comment.
- `tools/boundary-check/fixture/allowed/packages/core/src/index.test.ts` -- a new file that imports `vitest`, which proves the test-file exemption.
- `tools/boundary-check/boundary.test.ts` -- add the two expected violations. The npm `to` is matched with `expect.stringMatching(/node_modules\/dependency-cruiser\//)` so that a version bump does not break it.

**Acceptance Criteria:**
- Given the shipped config, when `pnpm check` runs on the clean tree, then depcruise reports zero violations.
- Given the forbidden fixture, when the boundary test cruises it with the shipped config, then it reports exactly one `error` violation for each of the seven rules, including the two new ones.
- Given the shipped config, when a `core` source file temporarily imports `node:fs`, then `pnpm depcruise` fails and names `no-core-to-node-builtin` (manual, then reverted).

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 24 findings — high 0, medium 4, low 15, false 5, maybe-false 0
- findings:
  - `[low]` `[patch]` Blind: the rules header claims core imports "only `@poe/contracts` and its own siblings", but the npm rule allows any `packages/` target — reworded the header to state what the rules enforce, with workspace edges left to the direction rules.
  - `[low]` `[reject]` Blind: an unresolvable import is reported as `no-core-to-npm-package` — `pnpm check` runs `tsc -b` before depcruise, so an unresolvable import fails typecheck first. A dedicated rule adds surface for a misnomer that is rarely seen.
  - `[false]` `[reject]` Blind: the allowed fixture lacks bare `@poe/contracts` and sibling imports — the real tree has both (`packages/core/src/index.ts` imports `@poe/contracts` and `./chunk-order.ts`), and `pnpm check` cruises it with zero violations.
  - `[low]` `[patch]` Blind: the test-file exemption of `no-core-to-node-builtin` is untested — added a `node:fs` type import to the allowed core test fixture.
  - `[low]` `[reject]` Blind: the exemption matches only `\.test\.ts$` — no core `*.spec.ts`, `*.test.tsx` or test helper exists, and a future one fails loudly and names the rule. Widening the regex guards state that does not exist.
  - `[low]` `[reject]` Blind: the spec says `from ^packages/core/` and the code says `^packages/core/src/` — the fix edits this build's spec. The deviation (to exempt `packages/core/vitest.config.ts`) is recorded under Auto Run Result.
  - `[medium]` `[defer]` Blind: global-based I/O, clock, randomness and env in core stay unenforced — pre-existing, and the intent covers imports only. Deferred to the frontmatter `deferred` list.
  - `[false]` `[reject]` Blind: the narrowed exclude now cruises a nested `dist/` and adds npm nodes to sync and web — `find packages -type d -name dist` shows only package-root `dist/` folders, which stay excluded. The extra npm leaf nodes produce zero violations on the clean tree, with no named harm.
  - `[low]` `[reject]` Blind: the spec has no trace to the ledger entry and uses line anchors — the fix edits this build's spec. The caller tracks the entry.
  - `[low]` `[reject]` Blind: the manual acceptance criterion has no recorded result — the fix edits the spec. The result is recorded under Auto Run Result.
  - `[low]` `[reject]` Edge: test helpers and `*.spec.ts` are not exempt — duplicate of the regex-exemption finding, same reason.
  - `[low]` `[reject]` Edge: an unresolvable import is reported under the npm rule name — duplicate of the unresolvable finding, same reason.
  - `[low]` `[reject]` Edge: a relative import from core that escapes `packages/` is reported as an "npm package" — the edge is correctly forbidden, and only the name is imprecise. It is rare, and the fix adds a rule.
  - `[low]` `[patch]` Edge: the builtin-rule test exemption is untested — same patch as above.
  - `[low]` `[reject]` Edge: core modules outside `src/` are unchecked — `core` ships from `src/` (`exports` → `./src/index.ts`), and the only file outside it is tooling config. Guarding a hypothetical `lib/` adds complexity.
  - `[medium]` `[patch]` Verification gap: a root-anchored exclude would disarm the npm rule in the real cruise while the fixture test stays green — added a boundary test that cruises `packages` from the repo root with the shipped options and asserts that a `node_modules/` module is in the graph.
  - `[low]` `[patch]` Verification gap: the builtin-rule test exemption is not pinned — same patch as above.
  - `[medium]` `[patch]` Intent: the rules are shown firing only on the fixture surface, not the real cruise — grouped with the root-cruise patch, which pins the precondition (npm modules visible) on the real surface. The manual `node:fs` probe on real `core` is recorded under Auto Run Result.
  - `[false]` `[reject]` Intent: bare `fs` is untested — `node:fs` resolves to `fs` with type `core` (probe), so the two specifiers are the same target to the rule.
  - `[false]` `[reject]` Intent: the npm rule is path-based rather than over `dependencyTypes` — it is strictly broader than a dependencyTypes rule and makes the summary false. The Design Notes give the reason (`@poe/contracts` resolves as `undetermined`).
  - `[low]` `[reject]` Intent: "core" is scoped to non-test `src/` — same as the outside-`src/` finding.
  - `[false]` `[reject]` Intent: the exclude change reaches every package's graph — the direction rules match only `^packages/` paths, so the npm nodes cannot trigger them. The clean tree reports zero violations.
  - `[medium]` `[defer]` Intent: the clock, randomness and env parts of the purity claim remain unenforced — same root cause as the deferred globals finding.
  - `[low]` `[reject]` Intent: the spec and the diff disagree on `from` — duplicate of the spec-mismatch finding.

## Design Notes

The npm rule is path-based, not dependency-type-based. `@poe/contracts` resolves as `undetermined`, and an npm import not declared in `core`'s manifest resolves as `npm-no-pkg` or `unknown`. "Outside `packages/` and not a builtin" covers all of these. It leaves the workspace-direction rules the only owners of the cross-package edges, so no fixture edge is reported twice.

## Verification

**Commands:**
- `pnpm check` -- expected: pass, with zero depcruise violations.
- `pnpm test` -- expected: all pass, including `tools/boundary-check/boundary.test.ts`.

## Auto Run Result

Status: done

**Summary:** depcruise now enforces AD-1 import purity for `core`. `no-core-to-node-builtin` forbids Node builtins, and `no-core-to-npm-package` forbids any target outside `packages/`. Both apply to non-test files under `packages/core/src/`. The shipped `exclude` now drops only a workspace package's own `node_modules/` and `dist/`, so resolved npm modules stay in the graph. Before, the rule could never fire.

**Deviation from Tasks:** the rules use `from: ^packages/core/src/` instead of `^packages/core/`. With the wider path, `packages/core/vitest.config.ts` (package tooling, not a valuation module) imports vitest and failed `pnpm check` on the clean tree.

**Files changed:**
- `.dependency-cruiser.mjs` -- the narrowed `exclude`, with a comment on why.
- `depcruise.rules.mjs` -- the two purity rules and the header update.
- `tools/boundary-check/boundary.test.ts` -- two expected violations, plus a repo-root cruise test that npm modules stay in the graph.
- `tools/boundary-check/fixture/forbidden/packages/core/src/index.ts` -- `node:fs` and `dependency-cruiser` type imports.
- `tools/boundary-check/fixture/allowed/packages/core/src/index.test.ts` -- new. A core test file importing `node:fs` and `vitest`, unreported.

**Review:**
- 24 findings: 3 patch entries, 1 deferred entry, the rest rejected (reasons in the triage log).
- Patched: 1 medium (the repo-root cruise guard), 2 low (the builtin test exemption fixture, and the header and rule-comment wording).
- Deferred: global-based I/O, clock, randomness and env in core (medium).

**Follow-up review recommended:** false. The first pass patched one medium and no high.

**Verification:**
- `pnpm check` passes, with 0 violations across 127 modules.
- `pnpm test` passes: 51 files, 528 tests.
- Manual check on real `core`: a temporary `packages/core/src/zz-probe.ts` importing `node:fs` made `pnpm depcruise` fail with `no-core-to-node-builtin: packages/core/src/zz-probe.ts → fs`. The file was removed afterwards.
- Mutation checks:
  - Adding `^node_modules/` to the exclude fails the new repo-root test.
  - Removing `pathNot` from `no-core-to-node-builtin` fails the allowed-fixture test.

**Residual risks:**
- Purity through globals is still unenforced (deferred).
- An unresolvable import in core is named `no-core-to-npm-package`, but typecheck fails first.
