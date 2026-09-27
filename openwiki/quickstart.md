---
type: quickstart
title: Quickstart
description: Orientation for the Path of Exile 2 crafting base price checker — what the sync CLI and the static ranked page do, how the four workspace packages fit together, the everyday commands, and which wiki page to read for each kind of task.
tags: [quickstart, overview, orientation, commands]
verified:
  - by: openwiki/0.6.0
    at: 2026-09-27T12:20:24.418Z
sources:
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-4c0582c853fafa6e932bf71d
    resource: repo://packages/sync/src/sync.ts
  - id: openwiki-source-f003d449d6194f288151c79f
    resource: repo://packages/sync/src/trade/endpoints.ts
  - id: openwiki-source-d952717f7ba616148cf6047b
    resource: repo://packages/web/src/App.tsx
  - id: openwiki-source-40275cb92c3610938f16ade3
    resource: repo://pnpm-workspace.yaml
generated: { by: "claude-code", at: "2026-09-27T12:20:24.418Z" }
---

# Quickstart

## What this repository is

A single-operator **Path of Exile 2 crafting base price checker**. It has two halves that share committed JSON files instead of a server:

1. **`sync`**, a Node CLI. It prices a hand-curated list of bases, `data/tracked.json`, against the official PoE2 trade API (`/api/trade2`, realm `poe2`). Each run of `pnpm sync` prices one rate-limited chunk and writes `data/dataset.json` (the latest price per entry), `data/sync-progress.json` and `data/sync-report.json`.
2. **`web`**, a static React 19 + Mantine 9.6.1 page on GitHub Pages. It fetches those files at runtime, validates them, and ranks the entries in the browser above a player-set **Payout Threshold** in Divine.

A price is always one of four states: `priced`, `no-listings`, `not-yet-synced` or `unresolvable`. It is never shown as zero when missing. Today only the **raw** branch is ranked: raw base types, with EV equal to the observed price and a Craft Cost of 0. The crafted branch (item classes with recipes and weights) is planned but not implemented in `core` yet. The planning documents (PRD, architecture spine, UX, stories) are under `docs/`.

## The four packages

```
@poe/contracts  ->  @poe/core  ->  @poe/sync
                              \->  @poe/web
```

- **contracts**: Zod schemas for every shared shape, versioned file envelopes, the canonical entry key, and the four effect ports with in-memory fakes.
- **core**: pure functions: `rank` (read-time ranking) and `chunkOrder`/`pinnedToKeep` (the sync refresh rotation).
- **sync**: the imperative shell. It has the governed trade client, the chunk runner, the pricing step, the league gate and the operator commands.
- **web**: the page. It loads eight artifacts, ranks them with `core`, and renders the list, the trust strip and row expansions.

The direction is enforced by manifests, dependency-cruiser, ESLint purity rules and tests.

## Everyday commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Installs dependencies. `prepare` also points git at `.githooks/`. |
| `pnpm check` | Runs typecheck (`tsc -b` plus the `.d.ts` rewrite), eslint and dependency-cruiser. This is the CI gate. |
| `pnpm test` | Runs Vitest across all projects. No test touches the network. |
| `pnpm dev` | Starts the Vite dev server on port 5173 with `strictPort`. Use `--port <n>` for another port. |
| `pnpm build` | Runs `vite build` and prunes `dist` to the eight artifacts. |
| `pnpm sync` | Runs one live chunk. Needs `POE_SYNC_USER_AGENT`. |
| `pnpm sync:dry` | Predicts the next chunk offline against `fixtures/`. |
| `pnpm catalogue:refresh` | Re-fetches the four trade catalogue files. |
| `pnpm fixtures:record` | Re-records API fixtures. A human runs it. |
| `pnpm tracked:lookup` / `pnpm tracked:check` | Curate and validate `data/tracked.json`. |

To publish new prices: run `pnpm sync` (repeatedly, until the pass is covered), commit `data/`, and push to `master`. The Pages workflow runs `pnpm check` and `pnpm build`, then deploys.

## Where to go for a task

| If you need to… | Read |
| --- | --- |
| understand the package boundaries, ports, or add a package | [Package graph, ports and purity boundaries](architecture/package-graph-and-ports.md) |
| change a schema, a `data/` file, versioning or the canonical key | [Contracts, envelopes and the data/ files](architecture/contracts-and-data-files.md) |
| change the ranking, tie-breaks, or which entries a chunk visits | [Core: ranking and refresh rotation](core/ranking-and-refresh-rotation.md) |
| debug a sync run, the lock, progress, or the sync report | [The sync chunk runner](sync/chunk-runner.md) |
| change how an entry is searched or priced, or the league check | [Pricing step and league gate](sync/pricing-step-and-league-gate.md) |
| touch HTTP, rate limits, 429 handling or the User-Agent | [Governed trade client and rate limits](sync/trade-client-and-rate-limits.md) |
| run or change a CLI command, fixtures, or tracked-list curation | [Operator commands and curation workflow](workflows/operator-commands.md) |
| change what the page loads, shows, or stores | [Web page: artifact load and ranked list](web/page-load-and-ranked-list.md) |
| change the build, dev server, Pages deploy or commit hook | [Build, typecheck and deploy](operations/build-typecheck-and-deploy.md) |
| write tests, or understand the no-network guard | [Test strategy and network guards](testing/test-strategy-and-guards.md) |

## Rules worth knowing up front

- Tests must never reach the network. Copy `test/setup.ts`, and keep its `onUnhandledRequest` **callback**.
- No rate-limit numbers or rule names in source: they are learned from `X-Rate-Limit-*` headers at runtime.
- `core` stays pure: no I/O, clock, randomness or environment.
- A new package needs three edits: `workspace:*` deps, `ALLOWED_EDGES`, and tsconfig `references`.
- Browser checks during development use the agent-browser skill with a named session (see `AGENTS.md`).
