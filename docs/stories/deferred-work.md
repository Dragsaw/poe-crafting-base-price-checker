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

