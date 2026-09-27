---
type: quickstart
title: Quickstart
description: Orientation for the Path of Exile 2 crafting base price checker — what the sync CLI and the static ranked page do, how the four workspace packages fit together, the everyday commands, and which wiki page to read for each kind of task.
tags: [quickstart, overview, orientation, commands]
sources:
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-04c5c6716d7633c4e68e2d4e
    resource: repo://packages/core/src/rank.ts
  - id: openwiki-source-999659a0385fcbff008d129d
    resource: repo://packages/sync/src/sync-batch.ts
  - id: openwiki-source-4c0582c853fafa6e932bf71d
    resource: repo://packages/sync/src/sync.ts
  - id: openwiki-source-f003d449d6194f288151c79f
    resource: repo://packages/sync/src/trade/endpoints.ts
  - id: openwiki-source-d952717f7ba616148cf6047b
    resource: repo://packages/web/src/App.tsx
  - id: openwiki-source-40275cb92c3610938f16ade3
    resource: repo://pnpm-workspace.yaml
generated: { by: "claude-code", at: "2026-09-27T19:26:28.611Z" }
verified:
  - by: openwiki/0.6.0
    at: 2026-09-27T19:26:28.611Z
---

# Quickstart

## What this repository is

A single-operator **Path of Exile 2 crafting base price checker**. It has two halves that share committed JSON files instead of a server:

1. **`sync`**, a Node CLI. It prices a hand-curated list of bases, `data/tracked.json`, against the official PoE2 trade API (`/api/trade2`, realm `poe2`). `pnpm sync` is a long-running session that prices one entry per locked chunk and paces its requests evenly over the API's rate-limit buckets. `pnpm sync:batch` runs one bounded chunk and exits, for a scheduler. Every chunk writes `data/dataset.json` (the latest price per entry), `data/sync-progress.json` and `data/sync-report.json`.
2. **`web`**, a static React 19 + Mantine 9.6.1 page on GitHub Pages. It fetches those files at runtime, validates them, and ranks the entries in the browser above a player-set **Payout Threshold** in Divine.

A price is always one of four states: `priced`, `no-listings`, `not-yet-synced` or `unresolvable`. It is never shown as zero when missing. Today only the **raw** branch is ranked: raw base types, with EV equal to the observed price and a Craft Cost of 0. The crafted EV branch (item classes with recipes and weights) is planned but not implemented in `core` yet. The page already reads the full weights file (contract `6.1.0`) and lists a crafted Item Class in an **Unrankable appendix** when its class is absent from the weights file, when no weights file is loaded, or when one of its pools is `partial`. The planning documents (PRD, architecture spine, UX, stories) are under `docs/`.

## The four packages

```
@poe/contracts  ->  @poe/core  ->  @poe/sync
                              \->  @poe/web
```

- **contracts**: Zod schemas for every shared shape (including the full weights contract), versioned file envelopes, the canonical entry key, and the four effect ports with in-memory fakes.
- **core**: pure functions: `rank` (read-time ranking) and `chunkOrder`/`pinnedToKeep` (the sync refresh rotation).
- **sync**: the imperative shell. It has the governed trade client, the chunk runner, the long-running sync session, the pricing step, the league gate and the operator commands.
- **web**: the page. It loads seven artifacts, ranks them with `core`, and renders the list, the trust strip, row expansions and the Unrankable appendix.

The direction is enforced by manifests, dependency-cruiser, ESLint purity rules and tests.

## Everyday commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Installs dependencies. `prepare` also points git at `.githooks/`. |
| `pnpm check` | Runs typecheck (`tsc -b` plus the `.d.ts` rewrite), eslint and dependency-cruiser. This is the CI gate. |
| `pnpm test` | Runs Vitest across all projects. No test touches the network. |
| `pnpm dev` | Starts the Vite dev server on port 5173 with `strictPort`. Use `--port <n>` for another port. |
| `pnpm dev:stop` | Stops this checkout's `pnpm dev` process tree and checks that the port is free. Run it even after a background task stop, because on Windows Vite keeps the port. |
| `pnpm build` | Runs `vite build` and prunes `dist` to the seven artifacts. |
| `pnpm sync` | Runs the paced sync session until Ctrl-C (SIGINT) or SIGTERM. Needs `POE_SYNC_USER_AGENT`. |
| `pnpm sync:batch` | Runs one live chunk and exits. Needs `POE_SYNC_USER_AGENT`. |
| `pnpm sync:dry` | Predicts the next chunk offline against `fixtures/`. It skips entries outside the recorded workload and lists them as `unrecorded`. |
| `pnpm catalogue:refresh` | Re-fetches the four trade catalogue files. |
| `pnpm fixtures:record` | Re-records API fixtures for the fixed workload `fixtures/tracked.json`. A human runs it. |
| `pnpm tracked:lookup` / `pnpm tracked:check` | Curate and validate `data/tracked.json`. |
| `pnpm deferred:issues` | Syncs `docs/stories/deferred-work.md` to one GitHub issue per entry. Needs `gh`. |

To publish new prices: leave `pnpm sync` running (or run `pnpm sync:batch` repeatedly) until the pass is covered, commit `data/`, and push to `master`. The Pages workflow runs `pnpm check` and `pnpm build`, then deploys.

## Where to go for a task

| If you need to… | Read |
| --- | --- |
| understand the package boundaries, ports, or add a package | [Package graph, ports and purity boundaries](architecture/package-graph-and-ports.md) |
| change a schema (including the weights contract), a `data/` file, versioning or the canonical key | [Contracts, envelopes and the data/ files](architecture/contracts-and-data-files.md) |
| change the ranking, tie-breaks, or which entries a chunk visits | [Core: ranking and refresh rotation](core/ranking-and-refresh-rotation.md) |
| debug a chunk, the lock, progress, or the sync report | [The sync chunk runner](sync/chunk-runner.md) |
| understand why `pnpm sync` is waiting, its pacing, backoff or stop behaviour | [The pnpm sync session](sync/sync-session.md) |
| change how an entry is searched or priced, or the league check | [Pricing step and league gate](sync/pricing-step-and-league-gate.md) |
| touch HTTP, rate limits, 429 handling or the User-Agent | [Governed trade client and rate limits](sync/trade-client-and-rate-limits.md) |
| run or change a CLI command, `dev:stop`, fixtures, or tracked-list curation | [Operator commands and curation workflow](workflows/operator-commands.md) |
| add or resolve deferred work, or run the deferred-work sweep | [Deferred work as GitHub issues](workflows/deferred-work-issues.md) |
| change what the page loads, shows, or stores, or the web `shared/` helpers | [Web page: artifact load and ranked list](web/page-load-and-ranked-list.md) |
| change the build, dev server, Pages deploy, the OpenWiki update workflow or the commit hook | [Build, typecheck and deploy](operations/build-typecheck-and-deploy.md) |
| write tests, or understand the no-network guard | [Test strategy and network guards](testing/test-strategy-and-guards.md) |

## Rules worth knowing up front

- Tests must never reach the network. Copy `test/setup.ts`, and keep its `onUnhandledRequest` **callback**.
- No rate-limit numbers or rule names in source: they are learned from `X-Rate-Limit-*` headers at runtime.
- `core` stays pure: no I/O, clock, randomness or environment.
- A new package needs three edits: `workspace:*` deps, `ALLOWED_EDGES`, and tsconfig `references`.
- Browser checks during development use the agent-browser skill with a named session (see `AGENTS.md`).
