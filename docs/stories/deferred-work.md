# Deferred work

Append-only. Each entry names work carved out of a spec so it is not lost.

- source_spec: `docs/stories/spec-1-1-the-four-package-workspace-and-the-offline-development-loop.md`
  summary: Nothing forbids `core` from importing `node:*` builtins or a runtime dependency, so its documented purity is unenforced.
  evidence: `packages/core/src/index.ts` states "no I/O, no clock, no randomness, no env" and AD-1 calls `core` pure, but the five depcruise rules constrain only the direction of workspace edges. The first `import { readFileSync } from 'node:fs'` in `core` passes `pnpm check`. A `core`-scoped rule over `dependencyTypes` would make the claim checkable; deferred because story 1.1's intent covers the graph's direction, not import purity.

- source_spec: `docs/stories/spec-1-1-the-four-package-workspace-and-the-offline-development-loop.md`
  summary: A request that settles after its own test's `afterEach` may escape the no-network guard, or fail an innocent later test naming a foreign URL.
  evidence: `test/setup.ts` drains a module-level array per test, with no association between a recorded URL and the test that issued it. Unverified: neither the diff nor a run settles whether MSW's interception can deliver the callback after the hook has drained. Would be settled by a test that starts a fire-and-forget request and resolves it in a later tick, then observes which test fails.

- source_spec: `docs/stories/spec-1-1-the-four-package-workspace-and-the-offline-development-loop.md`
  summary: No mechanical check enforces the AC "every installed version matches the Stack table exactly".
  evidence: `save-exact=true` governs only future `pnpm add`; a `^` range edited into a manifest later fails nothing. The obstacle is that the spine's Stack table is prose, so any test would pin a hand-copied second source of truth that can drift from the table it claims to enforce — worth solving only alongside a machine-readable Stack table.

- source_spec: `docs/stories/spec-1-4-the-committed-trade-catalogue-and-its-explicit-refresh-command.md`
  summary: `data/catalogue/{items,stats,filters,static}.json` are not on disk yet. One human must run `pnpm catalogue:refresh` once against the live API and commit the four files.
  evidence: AGENT-WORKFLOW §Parallel worktrees forbids an agent to run the command against the live API or to author a file under `data/`, so story 1.4 ships the command and its tests but no artifact. Story 1.10 validates tracked ids against those four files offline and has nothing to read until the run happens. The run needs `POE_SYNC_USER_AGENT` set (see `.env.example`); it writes all four files or none, and a second run against an unchanged API must leave `git status` clean.

- source_spec: `docs/stories/spec-1-4-the-committed-trade-catalogue-and-its-explicit-refresh-command.md`
  summary: Nothing checks that the committed catalogue still parses against the `contracts` catalogue schemas, so a GGG shape change is caught only on the next refresh.
  evidence: Story 1.4 validates at write time, inside `refreshCatalogue`. Once `data/catalogue/*.json` exists, a schema tightened in `contracts` could contradict the committed file and no test would say so — the same class of mismatch story 1.4 found twice in the recorded fixtures (a null filter-option id, a null static group label). A test that parses the four committed files against their `Catalogue*FileSchema` would close it; deferred because the files do not exist yet.
