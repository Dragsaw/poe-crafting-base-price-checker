---
title: 'Agent Development Workflow'
status: draft
created: '2026-09-12'
updated: '2026-09-12'
governed_by: [AD-1, AD-2, AD-13]
---

# Agent Development Workflow

The brief makes three things hard requirements rather than preferences: an agent must be able to test and debug the whole system with no human in the loop; several agents must work in parallel git worktrees without colliding; and the primary data source is a live, rate-limited third party that must never appear in the test path. This document is how those hold.

## The offline guarantee

**No test at any level makes a network call** (AD-13). This is the load-bearing property — it is what lets an agent iterate at machine speed against a service that would rate-limit it into uselessness, and what makes a red test mean "the code is wrong" rather than "GGG was slow".

It is enforced, not trusted: the test setup installs an MSW server in `onUnhandledRequest: "error"` mode, so any request without a matching fixture fails the test loudly instead of escaping to the network.

An agent can therefore run the entire suite on a plane. Nothing in the loop below needs credentials, a network, or a human.

## The agent loop

```
pnpm install
pnpm check          # typecheck + lint + dependency-cruiser, all packages
pnpm test           # vitest, all packages, zero network
pnpm dev            # web against the committed dataset + fixtures
pnpm sync:dry       # run the sync pipeline against fixtures, write nowhere
```

`pnpm check` is the boundary enforcement point. `dependency-cruiser` fails the build on a wrong-direction import (AD-2), so an agent that reaches from `core` into `sync` finds out in seconds without a reviewer.

`pnpm sync:dry` is the debugging affordance that matters most: the full sync pipeline, deterministically, against recorded fixtures, producing a dataset and a run report to stdout instead of to disk. An agent can inspect what the syncer would do without touching GGG.

## Fixtures

Fixtures are **real captured trade-API responses**, committed under `fixtures/` (AD-13). They are not hand-written, because hand-written mocks encode what we believe the API returns rather than what it does, and go green on the day that stops being true.

```
pnpm fixtures:record      # EXPLICIT, human-invoked, hits the live API
pnpm catalogue:refresh    # EXPLICIT, human-invoked, hits the live API (AD-25)
```

Neither is part of a test run, and neither is invoked by an agent unattended. Their output is a diff against committed files, and **that diff is the mechanism by which GGG's changes become visible.** A patch that reshapes a response shows up as a reviewable change, not as a production incident.

`catalogue:refresh` pulls the four trade data endpoints into `data/catalogue/` (AD-25). Run it on a GGG patch, not on a schedule. A renamed stat id appears as a line in that diff, and the tracked-list validation that AD-6 performs against the catalogue is what turns it into an `unresolvable` state rather than a silent mismatch.

Fixture hygiene:

- One fixture per distinct API interaction shape, named for the interaction, not the test that uses it.
- Fixtures are trimmed of irrelevant volume but never of structure — a field is kept even if unused, because its disappearance is signal.
- Any personal identifier in a captured response (account names, character names) is scrubbed at record time.

## Parallel worktrees

The package split (AD-2) is what makes parallelism work: `contracts`, `core`, `sync`, `web` each own a disjoint directory, each has its own test suite, and the dependency graph is acyclic and one-way. Two agents working in two packages touch no common file.

Rules for partitioning work across worktrees:

- **A task is scoped to one package where possible.** A task spanning packages is a signal that a contract is missing, not that the boundary is wrong.
- **`contracts` changes are serialised.** It is the one package everything depends on, so a change there is a broad rebuild and a likely conflict. Land contract changes alone, first, and let dependent work rebase onto them.
- **`data/` has one writer per file (AD-21) — never an agent's feature branch.** Hand-owned inputs (`tracked.json`, `currencies.json`, `recipes.json`, `config.json`) belong to the player; `weights.json` belongs to the external scraper project (AD-11); sync-owned outputs (`catalogue/*.json`, `dataset.json`, `sync-report.json`, `sync-progress.json`) belong to the syncer. An agent that needs different data uses a fixture, not an edit.
- **No worktree runs `pnpm sync` or `pnpm catalogue:refresh` against the live API.** Only the scheduled invoker on the player's machine runs a sync (AD-7, AD-8), and it holds an exclusive lock, so a second run anywhere exits immediately by design. An agent verifying sync behaviour uses `pnpm sync:dry`. The catalogue is refreshed by a human on a patch; an agent needing a different catalogue uses a fixture.
- **Never `git add -A` in anything sync-related.** AD-21 requires the syncer to commit only the files it owns, by explicit path, so an in-progress curation edit is never swept into an automated commit.

## Determinism

Agent debugging degrades badly under flakiness, so nondeterminism is structurally excluded rather than tolerated:

- `core` is pure; time, randomness and config are passed in as values (AD-1). A `core` test is literal inputs to literal outputs.
- The clock is a port. Tests inject a fixed instant; nothing calls `Date.now()` below the shell.
- Sync ordering is deterministic given a tracked list, a dataset and a clock value — AD-26 fixes the rotation order (pinned, then oldest-observation-first among `active`, then bounded `unresolvable` retries, never `pruned`), and `core` computes it as a pure function, so a dry run and a real run select identically.
- No test depends on wall-clock timing. Rate-limit backoff is tested by injecting the header values, not by waiting.

## What an agent needs to know before touching a package

| Package | Its job | The rule most likely to be broken |
| --- | --- | --- |
| `contracts` | Zod schemas, derived types, port interfaces | Types are `z.infer`red from schemas, never declared in parallel |
| `core` | Pure valuation, probability, provenance | No I/O, no clock, no randomness, no env — ever (AD-1) |
| `sync` | Trade client, rate-limit governor, chunk runner, catalogue refresher, dataset writer | One governed HTTP client only (AD-8); bounded work then exit (AD-7); rotation order comes from `core`, not from `sync` (AD-26) |
| `web` | Static view, read-time ranking | No backend, no write path, no authenticated request (AD-15) |

## Build order

Two things are sequenced rather than parallel, and both are cheap to get wrong late:

1. **`contracts` first, alone.** Revision 2 changes `ModifierRef` to a band and adds `itemLevelMin` to `TrackedEntry` (AD-5). That is a contract change, so it lands on its own and everything else rebases onto it.
2. **Measure pool coverage before any view work (AD-27).** Take the weights file the scraper project produces, and count what fraction of the distinct `baseTypeId`s in `data/tracked.json` have `poolCoverage: "complete"` in **both** slots. Apply AD-27's thresholds: below 80% the unrankable group stops being a footer and becomes a primary surface; below 50% the ranking premise fails and is escalated rather than worked around. Committing a layout before this number exists is committing to an assumption about how much of the product there is.

## Definition of done for an agent task

1. `pnpm check` and `pnpm test` pass with zero network.
2. New external interactions have committed fixtures.
3. New shared shapes are Zod schemas in `contracts`, validated at their trust boundary.
4. No new dependency edge outside the graph in the spine.
5. Any invariant the task discovered — a call two units could make incompatibly — is raised against the spine rather than encoded locally.
