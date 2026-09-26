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

## Resolved (2026-09-26)

- The 1.4 entry above that carved out the live `pnpm catalogue:refresh` run is **retired**: a human ran the command and the four files are committed as `edd2c97`. The entry stays in place because this ledger is append-only. Consequence for the entry after it — the committed-catalogue parse check was deferred only because the files did not exist, and is now actionable.

## Deferred from: code review of spec-1-4-the-committed-trade-catalogue-and-its-explicit-refresh-command (2026-09-26)

- source_spec: `docs/stories/spec-1-4-the-committed-trade-catalogue-and-its-explicit-refresh-command.md`
  summary: The "a second refresh leaves no diff" criterion and the real `createFetchHttpPort` are exercised by nothing.
  evidence: Already recorded in the spec's `deferred` block and confirmed by this review pass — the suite compares one `serialiseCatalogue(...)` result against itself, and every test drives `createFakeHttpPort`. New since that entry was written: four artifacts now sit under `data/catalogue/`, so the two-run check is runnable for the first time. A spot check of those files (LF, one trailing newline, `schemaVersion` last, byte-identical under re-serialisation at two-space JSON) is consistent with a stable second run but is not the run itself.

- source_spec: `docs/stories/spec-1-4-the-committed-trade-catalogue-and-its-explicit-refresh-command.md`
  summary: The emitted `packages/contracts/dist/index.d.ts` carries `.ts` relative specifiers, and the prescribed fix is inert.
  evidence: Already recorded in the spec's `deferred` block; carried here because the ledger is where carved-out work lives and the Auto Run Result points readers at "the deferred entry". `rewriteRelativeImportExtensions` does not affect declaration emit under `emitDeclarationOnly`, reproduced in a minimal project. A consumer probe resolved the `.ts` specifier through to `schema-version.d.ts`, so TypeScript follows it; the risk is a non-TypeScript consumer of `dist`. Settling it needs dropping `emitDeclarationOnly` or a post-emit rewrite.

## Deferred from: sprint change proposal 2026-09-26 (weights contract 6.0.0)

- source_spec: `docs/sprint-change-proposal-2026-09-26.md`
  summary: The Emerald crafted entry's prefix band `[12, 15]` does not contain its only tier `[5, 15]`, so Story 3.3's empty-containment check will reject it.
  evidence: `data/tracked.json`, `jewel`/`Emerald` prefix `explicit.stat_2843214518` `[12, 15]`; `data/weights.json` 6.0.0 carries one tier of that stat on that pool, `T1` at item level 1 with ranges `[[5, 15]]`. Whole-tier containment (IN §1) admits no tier, so §2.5 fires. It predates the 6.0.0 change and is the player's data to fix (AGENT-WORKFLOW: agents do not edit `data/`).

- source_spec: `docs/sprint-change-proposal-2026-09-26.md`
  summary: Resolved 2026-09-26 — the Emerald prefix band entry above is fixed. The player chose `[5, 15]`, the only band whole-tier containment accepts on that pool, and the agent applied it under the revised AGENT-WORKFLOW data rule. The entry prices every roll of the tier (5–15), not only its top end.
  evidence: `data/tracked.json` `jewel`/`Emerald` prefix `explicit.stat_2843214518` now `[5, 15]`, `acceptedTier` `T1`; the band equals its containment set's extremes on the 6.0.0 file.

- source_spec: `docs/sprint-change-proposal-2026-09-26.md`
  summary: Correction 2026-09-26 — the "Resolved" note directly above is WITHDRAWN. The player reverted the Emerald prefix band to `[12, 15]`, and the original Emerald entry stands, now covering the suffix `[3, 4]` over its only tier `[2, 4]` as well.
  evidence: The player wants mid-to-high rolls of one tier only, because the full tier prices quite differently. Whole-tier containment (AD-11) cannot express a band inside one tier, so Story 3.3's empty-containment check (IN §2.5) will reject both Emerald bands once it is built. This is a live case for the pro-rating alternative that AD-11 rejected and carries under Deferred; revisit it when Story 3.3 lands. `[5, 15]` also broke the recorded pricing fixtures (a new search body needs `pnpm fixtures:record`), so the revert keeps them valid.
