---
type: quickstart
title: Quickstart
description: Orientation for the Path of Exile 2 crafting base price checker — what the sync CLI and the static ranked page do, how the four workspace packages fit together, the everyday commands, and which wiki page to read for each kind of task.
tags: [quickstart, overview, orientation, commands]
sources:
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-004d71a620eb2ebfe8d87ae5
    resource: repo://packages/contracts/src/ranked-row.ts
  - id: openwiki-source-04c5c6716d7633c4e68e2d4e
    resource: repo://packages/core/src/rank.ts
  - id: openwiki-source-b293525c0b4d3d93a18fe376
    resource: repo://packages/sync/src/pricing/price-entry.ts
  - id: openwiki-source-999659a0385fcbff008d129d
    resource: repo://packages/sync/src/sync-batch.ts
  - id: openwiki-source-4c0582c853fafa6e932bf71d
    resource: repo://packages/sync/src/sync.ts
  - id: openwiki-source-f003d449d6194f288151c79f
    resource: repo://packages/sync/src/trade/endpoints.ts
  - id: openwiki-source-d952717f7ba616148cf6047b
    resource: repo://packages/web/src/App.tsx
  - id: openwiki-source-8f6c2195c06d3f201f23082b
    resource: repo://packages/web/src/list/active-ranking.ts
  - id: openwiki-source-40275cb92c3610938f16ade3
    resource: repo://pnpm-workspace.yaml
generated: { by: "claude-code", at: "2026-10-17T13:54:42.734Z" }
verified:
  - by: openwiki/0.6.0
    at: 2026-10-17T13:54:42.734Z
---

# Quickstart

## What this repository is

A single-operator **Path of Exile 2 crafting base price checker**. It has two halves that share committed JSON files instead of a server:

1. **`sync`**, a Node CLI. It prices a hand-curated list of bases, `data/tracked.json`, against the official PoE2 trade API (`/api/trade2`, realm `poe2`). `pnpm sync` is a long-running session that prices one entry per locked chunk and paces its requests evenly over the API's rate-limit buckets. `pnpm sync:batch` runs one bounded chunk and exits, for a scheduler. An optional `POESESSID` session cookie can raise the rate limits; it is probed once and dropped if it does not help. Every chunk writes `data/dataset.json` (the latest price per entry), `data/sync-progress.json` and `data/sync-report.json`.
2. **`web`**, a static React 19 + Mantine 9.6.1 page on GitHub Pages, in a dark theme with bundled Inter. It fetches those files at runtime, validates them, and ranks the entries in the browser above a player-set **Payout Threshold** in Divine, under the active **Craft Recipe**.

A price is always one of four states: `priced`, `no-listings`, `not-yet-synced` or `unresolvable`. It is never shown as zero when missing. Both branches are ranked. An observed price is the mean of the first two (cheapest) listings, normalised to Divine. Each row also carries a **price-trust verdict** (current, rough, pending or broken) with its reasons. A raw base type has EV equal to the observed price and a Craft Cost of 0. A crafted Item Class is ranked once per Craft Recipe: its EV is the sum of probability times price over its priced tracked entries, less the recipe's Craft Cost, and an uncostable recipe gives no figure. A crafted class that is absent from the weights file, has a partial pool, fails a cross-file check, or cannot be reached by a recipe is listed in the **Unrankable appendix** instead. The planning documents (PRD, architecture spine, UX, stories) are under `docs/`.

## The four packages

```
@poe/contracts  ->  @poe/core  ->  @poe/sync
                              \->  @poe/web
```

- **contracts**: Zod schemas for every shared shape (including the full weights contract), versioned file envelopes, the canonical entry key, and the four effect ports with in-memory fakes.
- **core**: pure functions: `rank` (read-time ranking of both branches, with the price-trust verdict per row), the probability term (with the recipe floor per modifier group and hybrid containment), craft cost, provenance, pool coverage, the six cross-file checks, and `chunkOrder`/`pinnedToKeep` (the sync refresh rotation).
- **sync**: the imperative shell. It has the governed trade client, the session-cookie holder, the chunk runner, the long-running sync session, the pricing step, the league gate and the operator commands.
- **web**: the page. It loads seven artifacts, ranks them with `core`, and renders the sticky header (recipe toggle, threshold, sync button), the sync report panel, the ranked list with chase cells, trust marks and row expansions, the Unrankable appendix and the footer legend.

The direction is enforced by manifests, dependency-cruiser, ESLint purity rules and tests.

## Everyday commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Installs dependencies. `prepare` also points git at `.githooks/`. |
| `pnpm check` | The done gate: typecheck, eslint, dependency-cruiser, jscpd and knip in parallel, then `test`, `test:data` and `build`. CI, the deploy and the pre-push hook run it. `--fast` runs only the static checks. |
| `pnpm test` | Runs Vitest across every project except `data`. No test touches the network. |
| `pnpm test:data` | Runs the invariants of the live `data/` files. |
| `pnpm dev` | Starts the Vite dev server on port 5173 with `strictPort`. Use `--port <n>` for another port. |
| `pnpm dev:stop` | Stops this checkout's `pnpm dev` process tree and checks that the port is free. Run it even after a background task stop, because on Windows Vite keeps the port. |
| `pnpm build` | Runs `vite build` and prunes `dist` to the seven artifacts. |
| `pnpm sync` | Runs the paced sync session until Ctrl-C (SIGINT) or SIGTERM. Needs `POE_SYNC_USER_AGENT`. |
| `pnpm sync:batch` | Runs one live chunk and exits. Needs `POE_SYNC_USER_AGENT`. |
| `pnpm sync:dry` | Predicts the next chunk offline against `fixtures/`. It skips entries outside the recorded workload and lists them as `unrecorded`. |
| `pnpm catalogue:refresh` | Re-fetches the four trade catalogue files. |
| `pnpm currencies:refresh` | Rewrites the rates in `data/currencies.json` from poe2scout. |
| `pnpm fixtures:record` | Re-records API fixtures for the fixed workload `fixtures/tracked.json`. A human runs it. |
| `pnpm tracked:lookup` / `pnpm tracked:check` | Curate and validate `data/tracked.json`. |
| `pnpm deferred:issues` | Syncs `docs/stories/deferred-work.md` to one GitHub issue per entry. Needs `gh`. |

To publish new prices: leave `pnpm sync` running (or run `pnpm sync:batch` repeatedly) until the pass is covered, commit `data/`, and push to `master`. The Pages workflow runs `pnpm check` and `pnpm build`, then deploys.

## Where to go for a task

| If you need to… | Read |
| --- | --- |
| understand the package boundaries, ports, or add a package | [Package graph, ports and purity boundaries](architecture/package-graph-and-ports.md) |
| change a schema (including the weights contract), a `data/` file, versioning or the canonical key | [Contracts, envelopes and the data/ files](architecture/contracts-and-data-files.md) |
| change the ranking, the probability term, tie-breaks, the cross-file checks, or which entries a chunk visits | [Core: ranking and refresh rotation](core/ranking-and-refresh-rotation.md) |
| change when a price counts as current, rough, pending or broken, or the words for it | [Core: the price-trust verdict](core/price-trust-verdict.md) |
| debug a chunk, the lock, progress, or the sync report | [The sync chunk runner](sync/chunk-runner.md) |
| understand why `pnpm sync` is waiting, its pacing, backoff or stop behaviour | [The pnpm sync session](sync/sync-session.md) |
| change how an entry is searched or priced, or the league check | [Pricing step and league gate](sync/pricing-step-and-league-gate.md) |
| touch HTTP, rate limits, 429 handling or the User-Agent | [Governed trade client and rate limits](sync/trade-client-and-rate-limits.md) |
| touch the `POESESSID` cookie, its probe, downgrade or hold-off | [POESESSID session auth](sync/poesessid-session-auth.md) |
| run or change a CLI command, `dev:stop`, fixtures, the currency refresh, or tracked-list curation | [Operator commands and curation workflow](workflows/operator-commands.md) |
| add or resolve deferred work, or run the deferred-work sweep | [Deferred work as GitHub issues](workflows/deferred-work-issues.md) |
| change what the page loads, or the list, rows, expansions, appendix or web `shared/` helpers | [Web page: artifact load and ranked list](web/page-load-and-ranked-list.md) |
| change the theme, header, threshold or recipe controls and what they store, the sync button or report panel, or the failure screens | [Web frame, theme and controls](web/frame-theme-and-controls.md) |
| change `pnpm check`, the build, dev server, Pages deploy, CI workflows, the git hooks or the agent lint hooks | [Build, typecheck and deploy](operations/build-typecheck-and-deploy.md) |
| write tests, use frozen data, or understand the no-network guard | [Test strategy and network guards](testing/test-strategy-and-guards.md) |

## Rules worth knowing up front

- Tests must never reach the network. Copy `test/setup.ts`, and keep its `onUnhandledRequest` **callback**.
- No rate-limit numbers or rule names in source: they are learned from `X-Rate-Limit-*` headers at runtime.
- `core` stays pure: no I/O, clock, randomness or environment.
- A new package needs three edits: `workspace:*` deps, `ALLOWED_EDGES`, and tsconfig `references`.
- Browser checks during development use the agent-browser skill with a named session (see `AGENTS.md`).
