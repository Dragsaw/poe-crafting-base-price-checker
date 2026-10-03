---
type: architecture
title: Package graph, ports and purity boundaries
description: The four-package pnpm workspace (contracts -> core -> sync/web), the functional-core and imperative-shell split with Port interfaces and fakes, and the manifest, dependency-cruiser, ESLint and tsconfig guards that enforce it.
tags: [architecture, workspace, ports, dependency-cruiser, purity, monorepo]
sources:
  - id: openwiki-source-4847b2bf0de7cf8ae11d4e52
    resource: repo://depcruise.rules.mjs
  - id: openwiki-source-2fda883e9b76745f69f487f7
    resource: repo://eslint.config.mjs
  - id: openwiki-source-5c0979efc55be6d55f3309c9
    resource: repo://packages/contracts/src/ports/filesystem.ts
  - id: openwiki-source-f94fe3b4c904d5bc753f7ba1
    resource: repo://packages/contracts/src/ports/http.ts
  - id: openwiki-source-d265cc7c06dcbefb6f92a01b
    resource: repo://packages/core/src/index.ts
  - id: openwiki-source-2f0b966b270953f200695dca
    resource: repo://packages/sync/src/git/read-only-git-port.ts
  - id: openwiki-source-869e9d6242b1ef866e244695
    resource: repo://packages/sync/src/shell.ts
  - id: openwiki-source-e53b6b5ad4b9153dd9ed5b3c
    resource: repo://packages/sync/tsconfig.json
  - id: openwiki-source-f80aa711018ca163059fef3e
    resource: repo://test/contracts-isolation.test.ts
  - id: openwiki-source-8b9f0783d1083318bb017d65
    resource: repo://tools/boundary-check/boundary.test.ts
  - id: openwiki-source-98d5ddb014a0fd4d678f6f2a
    resource: repo://tsconfig.json
generated: { by: "claude-code", at: "2026-10-03T11:56:06.252Z" }
verified:
  - by: openwiki/0.6.0
    at: 2026-10-03T11:56:06.252Z
---

# Package graph, ports and purity boundaries

The repository is a pnpm workspace of four TypeScript packages under `packages/`. The graph is one-way:

```
@poe/contracts  ->  @poe/core  ->  @poe/sync
                              \->  @poe/web
```

| Package | Role | Workspace deps | Notable external deps |
| --- | --- | --- | --- |
| `@poe/contracts` | Zod schemas for every shared concept, the four effect ports, and in-memory fakes | none | `zod` |
| `@poe/core` | Pure logic: the ranking, the probability term, craft cost, provenance, the five cross-file checks and the refresh rotation | `contracts` | none |
| `@poe/sync` | The imperative shell: CLI commands, trade client, chunk runner, file writes | `contracts`, `core` | none (uses Node builtins) |
| `@poe/web` | The static React page that loads the published files and renders the ranking | `contracts`, `core` | React 19, Mantine 9.6.1 |

`sync` and `web` are siblings and never import each other. A shape both need belongs in `contracts`. Logic both need belongs in `core`. For example, `web` calls `core`'s `rank` directly at read time (see [Core: ranking and refresh rotation](../core/ranking-and-refresh-rotation.md)).

## Functional core, imperative shell

`core` is pure. It performs no I/O, reads no clock, generates no randomness, and reads no environment. Time and every other input arrive as arguments. It returns typed results and does not throw for expected conditions.

Effects go through four ports declared in `packages/contracts/src/ports/`:

| Port | Operations | Real adapter |
| --- | --- | --- |
| `HttpPort` | `send(request)`, with `method` GET/POST, headers and body in both directions | `createFetchHttpPort` in `packages/sync/src/shell.ts` |
| `FilesystemPort` | `readTextFile` (undefined when absent), `writeTextFile`, `createExclusive`, `deleteFile`, `exists`, `lastModifiedAt` | `createNodeFilesystemPort(root)` in `shell.ts` |
| `ClockPort` | `now()`, which returns an ISO string | `systemClock` in `shell.ts` |
| `GitPort` | `lastCommitAuthorDate(path)` | `createReadOnlyGitPort` in `packages/sync/src/git/read-only-git-port.ts` |

`HttpPort` passes headers through in both directions on purpose: the trade client reads `X-Rate-Limit-*` headers at runtime (see [Governed trade client and rate limits](../sync/trade-client-and-rate-limits.md)).

Each port has a pure in-memory fake in `packages/contracts/src/ports/fakes/` (`createFakeHttpPort`, `createFakeFilesystemPort`, `createFakeGitPort`, `createFakeClockPort`). Tests drive units through these fakes. `pnpm sync:dry` also runs the real chunk composition over a fake filesystem.

The real effects are concentrated in the shell:

- `shell.ts` is the only `sync` module with `fetch`, the system clock, a real delay and real file writes. It has two delays: `sleep`, used inside a chunk, and `abortableSleep(ms, signal)`, which the long-running `pnpm sync` session uses for its waits. `abortableSleep` resolves (never rejects) when the signal aborts, so the session reads `signal.aborted` afterwards and exits 0 on the first SIGINT or SIGTERM (see [The pnpm sync session](../sync/sync-session.md)). `createNodeFilesystemPort` resolves every path against the repository root, so code below it names `data/...` exactly as the fakes do. `createExclusive` opens with `wx` (O_CREAT|O_EXCL), so of two concurrent takers exactly one succeeds. The chunk lock depends on this.
- `read-only-git-port.ts` is the only module in `sync` that starts a child process. It runs one fixed `git --no-optional-locks log --no-show-signature -1 --format=%at -- <path>` through `execFile`, with no shell. It returns `undefined` when there is no history, no repository or no `git` binary. `no-git-write.test.ts` bans the child-process module everywhere else in `sync`.

## How the boundaries are enforced

The rules are enforced at several layers, so that a violation cannot pass one silently.

1. **Manifest edges.** A package can resolve only the workspace packages it declares. `test/contracts-isolation.test.ts` holds `ALLOWED_EDGES` and checks every `@poe/*` entry in every dependency field of every `packages/*/package.json`. A package with no entry in `ALLOWED_EDGES` fails the test. The test also asserts that `contracts` has no workspace dependency at all.
2. **dependency-cruiser.** `depcruise.rules.mjs` is the single source of the forbidden-edge rules: no core→sync, core→web, sync→web, web→sync or contracts→sibling edges. It also has two purity rules for `packages/core/src/` (test files are exempt): no Node builtins and no npm packages. `.dependency-cruiser.mjs` spreads these rules into the shipped config. It sets `tsPreCompilationDeps: true`, so an `import type` edge is still visible. `pnpm depcruise` runs it.
3. **Boundary fixture test.** `tools/boundary-check/boundary.test.ts` cruises fixture trees (`fixture/forbidden`, `fixture/allowed`) with the **shipped** config. A disarmed config, for example `forbidden: []` or a `warn` severity, therefore fails the test. The fixtures sit outside `packages/`, so the real tree stays clean.
4. **ESLint purity block.** dependency-cruiser sees only imports, so `eslint.config.mjs` has a `core`-scoped block. It bans I/O globals (`fetch`, `localStorage`, `document`, ...), the global object (`globalThis`, `window`, ...), `process`, `crypto`, `performance`, `Date.now`, `Math.random`, `Temporal.Now`, a no-argument `new Date()`, `Date(...)` calls and `import.meta.env`. `Date.parse` stays legal. `test/core-purity-lint.test.ts` lints probe snippets through this config and proves that each ban fires. `test/core-rank-purity.test.ts` also checks that `rank.ts` names no `Date`, `Math.random`, `process` or `import.meta`.
5. **TypeScript project references.** The root `tsconfig.json` is a solution file that references the four packages and `tsconfig.tools.json`. Each package's tsconfig references its dependencies. `tsc -b` builds them in dependency order.

## Adding a package

A new package needs three edits: its `workspace:*` dependencies, its entry in `ALLOWED_EDGES`, and its tsconfig `references`. TypeScript gives no diagnostic for a missing reference. The fault shows up only as `TS2307` at the importer, on a clean checkout.

## Related

- [Contracts, envelopes and the data/ files](contracts-and-data-files.md): the schemas that `contracts` exports.
- [Test strategy and network guards](../testing/test-strategy-and-guards.md): how the fakes and guards are used in tests.
- [Build, typecheck and deploy](../operations/build-typecheck-and-deploy.md): `pnpm check`, which runs typecheck, lint and depcruise.
