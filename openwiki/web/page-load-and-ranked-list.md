---
type: subsystem
title: "Web page: artifact load and ranked list"
description: How the static React 19 + Mantine page loads its eight artifacts into one ready, refused or failed outcome, ranks them through core at the player's Payout Threshold kept in localStorage, turns the ranking into display rows, list statements and trade links, shows sync health in the trust strip, and themes Mantine from the DESIGN.md token set.
tags: [web, react, mantine, artifacts, ranking, threshold, ui]
sources:
  - id: openwiki-source-d952717f7ba616148cf6047b
    resource: repo://packages/web/src/App.tsx
  - id: openwiki-source-3fa505b4b2c5c6d73ef067c5
    resource: repo://packages/web/src/frame/trust-facts.ts
  - id: openwiki-source-3913fa1d9ed69d69b4d3b106
    resource: repo://packages/web/src/list/display-rows.ts
  - id: openwiki-source-cbe166ac1fc71ae356bc2b0a
    resource: repo://packages/web/src/list/format.ts
  - id: openwiki-source-1cd8d94203d43a3423d47aff
    resource: repo://packages/web/src/list/list-statement.ts
  - id: openwiki-source-886a98f0b5bc7b727f293662
    resource: repo://packages/web/src/list/RankedList.tsx
  - id: openwiki-source-35db1d8c09ed97e59222c4b5
    resource: repo://packages/web/src/list/trade-link.ts
  - id: openwiki-source-b44e23befe2ec1806e6feaf9
    resource: repo://packages/web/src/list/UnrankableAppendix.tsx
  - id: openwiki-source-f20f60e1ecaf073e364173ca
    resource: repo://packages/web/src/load/artifacts.ts
  - id: openwiki-source-48083b7e06b93884229c0b35
    resource: repo://packages/web/src/load/load-artifacts.ts
  - id: openwiki-source-9002c10435ac495970088bad
    resource: repo://packages/web/src/theme/theme.ts
  - id: openwiki-source-717f143b9bad39bbbbe092a7
    resource: repo://packages/web/src/theme/tokens.ts
  - id: openwiki-source-7f1c49c9ea79c77f6775aee2
    resource: repo://packages/web/src/threshold/threshold-storage.ts
generated: { by: "claude-code", at: "2026-09-27T13:11:02.100Z" }
verified:
  - by: openwiki/0.6.0
    at: 2026-09-27T13:11:02.100Z
---

# Web page: artifact load and ranked list

`@poe/web` is a static single page. It has no server and no API of its own. On load it fetches the published JSON files next to it, validates them with the `@poe/contracts` schemas, and asks `@poe/core` to rank them in the browser. The entry is `packages/web/src/main.tsx`: Mantine CSS, then `PageProvider` (the theme), then `App`.

## The eight artifacts

`packages/web/src/load/artifacts.ts` declares the complete fetch set, `ARTIFACTS`, in a fixed order (`ARTIFACT_ORDER`). Each artifact has a path, a schema, an expected version, and a class:

| Key | Path | Class | Expected version |
| --- | --- | --- | --- |
| `dataset` | `dataset.json` | required | `SUPPORTED_SCHEMA_VERSION` |
| `syncReport` | `sync-report.json` | tolerable | `SYNC_REPORT_SCHEMA_VERSION` |
| `weights` | `weights.json` | tolerable | `6.0.0` |
| `recipes` | `recipes.json` | tolerable | `SUPPORTED_SCHEMA_VERSION` |
| `tracked` | `tracked.json` | required | `SUPPORTED_SCHEMA_VERSION` |
| `config` | `config.json` | required | `SUPPORTED_SCHEMA_VERSION` |
| `catalogueStats` | `catalogue/stats.json` | required | `SUPPORTED_SCHEMA_VERSION` |
| `catalogueStatic` | `catalogue/static.json` | required | `SUPPORTED_SCHEMA_VERSION` |

A required artifact that is absent refuses the render, the same as an invalid one. A tolerable artifact that is absent becomes `null` in the set, never a stand-in value, and the page names it as absent. Adding a ninth artifact needs an architecture decision. The build's prune allowlist mirrors this table (see [Build, typecheck and deploy](../operations/build-typecheck-and-deploy.md)). Schemas and envelopes are described in [Contracts, envelopes and the data/ files](../architecture/contracts-and-data-files.md).

## One load, one outcome

`loadArtifacts` (`load/load-artifacts.ts`) fetches all eight in parallel. Each is a plain `fetch` with `cache: 'no-store'` against `import.meta.env.BASE_URL` (the base is `./`). It **never rejects**. Each result is classified first:

- `404` gives *absent*; any other non-OK status or a network error gives *not-arrived*;
- a body that is not JSON, or that fails `parseEnvelope` (including a wrong major version), gives *invalid*, with the declared version or `none`.

Then the precedence across all eight applies, and each screen names the **first** failing artifact in the fixed order:

1. any *not-arrived* gives `failed` (the fetch-failure screen, which has a "Try again" action);
2. otherwise any *invalid*, or a required artifact that is *absent*, gives `refused` (the refusal screen, with the path, the declared version and the expected version);
3. otherwise `ready` with the set and the list of absent tolerable keys.

`App.tsx` is a small state machine: `pending`, then exactly one of `ready`, `refused` or `failed`, in a single transition. The set is never rendered row by row. `pending` paints the masthead, a blank trust-strip slot, and twenty skeleton row slots. "Try again" resets to `pending` and runs all eight fetches again. A load that has been superseded is aborted. On `ready`, "now" is read **once**, and every age on the page uses it, so ages do not update while the page is open.

## Ranking at the Payout Threshold

`ReadyBody` calls `rank({ tracked, dataset, activeLeague: config.league, threshold, weightsLoaded: set.weights !== null })` from `@poe/core` and memoises the result on the set, now and the threshold. From that one ranking it renders the list statement, the ranked list, and the page tail led by the Unrankable appendix. `web` computes no ranking term itself (see [Core: ranking and refresh rotation](../core/ranking-and-refresh-rotation.md)).

The **Payout Threshold** (`threshold/threshold-storage.ts`) is the only value the page writes to browser storage (key `poe-cbpc.payoutThreshold`). Its range is 0 to 3 Divine, in steps of 0.05, at 2 decimal places, with a default of 0.25 (`DEFAULT_THRESHOLD`). Reading happens once at mount. It accepts only a plain decimal string in range, and anything else, including a storage that throws, gives the default. A write is clamped, and a blocked write is ignored. Changing the threshold re-runs `rank`.

## From ranking to rows

`toDisplayRows(ranking, dataset, now)` (`list/display-rows.ts`) builds the printed list:

- `ordering` rows come first, in `core`'s order. Each is numbered by position, with tier 1 for ranks 1–5, tier 2 for 6–10 and tier 3 for 11 onward. The EV is printed at 2 dp, or as `< 0.01` for tiny positive values.
- then unpriced raw bases follow, unnumbered at tier 3: `noListings` ("an open question") and then `notYetSynced` ("no figure yet").
- `belowThreshold` rows leave the list. `unresolvable` entries appear only as a health signal (see below).

A missing figure never prints as `0`. The list shows the top **20** rows (`TOP_ROWS`), with an affordance to show the rest. This limit only slices the display: `core` ranks the full tracked list.

The **age cell** (`list/format.ts`, `ageMark`) uses `observedAt` for a priced entry and `lastAttemptedAt` otherwise. With neither it shows "never attempted". An entry younger than 48 hours shows no mark. Older entries show `priced Nd ago` or `tried Nd ago`.

The **list statement** (`list/list-statement.ts`) is a pure check over the ranking:

- *nothing clears*: something is priced, and all of it is below the threshold. The copy is "Nothing clears your Payout Threshold of X.XX Divine."
- *honest empty*: nothing is priced in the active league, but there are rows to show. This is typical right after a league reset.
- otherwise there is no statement.

**Row expansion** shows the evidence behind a row: the price state, the sample size, both exact ages, and a **trade link**. `tradeSearchHref` (`list/trade-link.ts`) builds `https://www.pathofexile.com/trade2/search/poe2/{league}/{lastSearchId}` only when the entry has a stored search, `lastSearchLeague` equals the active league, and the entry is not pruned. Only the league segment is percent-encoded.

## Page tail and the Unrankable appendix

`PageTail` closes every state except the two failure screens. It is pushed to the frame's foot by `margin-top: auto` and holds, in order, the Unrankable appendix, the key block and the running foot. The appendix renders only in `ready`: while `pending` no count is known, so the tail holds only the key block and the running foot.

`UnrankableAppendix` (`list/UnrankableAppendix.tsx`) renders `ranking.unrankable`. Every row is an Item Class, never a Base Type. The title is "Appendix: Unrankable — " followed by the count (`1 Item Class`, `N Item Classes`), in rust when there are rows and in ink when there are none.

- With rows, the lead line "Tracked, but kept out of the ordering." follows, then one row per class: a class glyph and the class name, an `unknown` trust mark, the reason, and an empty note cell.
- With no rows, the panel is the title alone, with the bottom padding equal to the top padding and no text that says why.

The appendix has one arrangement: every row renders and the document grows. Nothing switches on a count or a measurement. Rows are not interactive: they have no handler, hover tone, role or title. The panel spacing (`appendixPad*`, `appendixLead*`) comes from `theme/tokens.ts`.

## Trust strip and sync report panel

`frame/trust-facts.ts` holds pure formatters over the published `sync-report.json` and the `weights.json` envelope. It counts records and derives nothing else. The trust strip prints the weights file's producer and patch, "Last synced" (from the report's run times), and "Tracked List last edited" (from the report's `trackedListEditedAt`). It also prints a **health line** with exactly two triggers: a count of `unresolvable` records, and "pinned entries starved this run" when a `pinned-starvation` record exists. An absent report raises no health signal, and a missing value prints as italic *unknown*. The "+ the full sync report" panel shows three columns of published figures: the sync run, what is broken, and what the weights cover.

## Theme

`theme/tokens.ts` transcribes the token set from the frontmatter of the UX `DESIGN.md` ("Field Guide"). When the two disagree, `DESIGN.md` wins. `theme/theme.ts` replaces Mantine's defaults entirely: a sepia primary palette, ink and paper as black and white, a zero radius everywhere, no shadows (with `shadow="none"` as the default on every component that has a shadow prop), and components such as Accordion without chevrons or transitions. `PageProvider` applies the theme and a CSS-variables resolver.

## Tests

Web tests run under jsdom. `test-support/artifact-server.ts` registers MSW handlers for all eight artifacts (see [Test strategy and network guards](../testing/test-strategy-and-guards.md)). The main suites are `load-artifacts.test.ts`, `App.test.tsx`, `ranked-list.test.tsx`, `expansion.test.tsx`, `display-rows.test.ts`, `list-statement.test.ts`, `unrankable-appendix.test.tsx`, `trade-link.test.ts`, `payout-threshold.test.tsx`, `threshold-storage.test.ts`, `trust-strip.test.tsx`, `trust-facts.test.ts`, and `theme.test.ts` / `tokens.test.ts`.
