---
type: subsystem
title: "Web page: artifact load and ranked list"
description: How the static React 19 + Mantine page loads its seven artifacts into one ready, refused or failed outcome, ranks them through core at the player's Payout Threshold kept in localStorage, turns the ranking into display rows, list statements and trade links, shows sync health in the trust strip, and themes Mantine from the DESIGN.md token set.
tags: [web, react, mantine, artifacts, ranking, threshold, ui]
sources:
  - id: openwiki-source-d952717f7ba616148cf6047b
    resource: repo://packages/web/src/App.tsx
  - id: openwiki-source-b6b8d3f7036bdea92208cf3d
    resource: repo://packages/web/src/frame/FailureScreen.tsx
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
  - id: openwiki-source-81a09436ea8ca32facbe19cd
    resource: repo://packages/web/src/load/load-artifacts.test.ts
  - id: openwiki-source-48083b7e06b93884229c0b35
    resource: repo://packages/web/src/load/load-artifacts.ts
  - id: openwiki-source-814633b3012ba5d3ee46edcd
    resource: repo://packages/web/src/shared/money.ts
  - id: openwiki-source-691a6949d0ba0a26508630f1
    resource: repo://packages/web/src/shared/product.ts
  - id: openwiki-source-112e656cd04521c76d26e7f8
    resource: repo://packages/web/src/shared/text.ts
  - id: openwiki-source-4aa8c981520851c4322528ba
    resource: repo://packages/web/src/shared/time.ts
  - id: openwiki-source-9002c10435ac495970088bad
    resource: repo://packages/web/src/theme/theme.ts
  - id: openwiki-source-717f143b9bad39bbbbe092a7
    resource: repo://packages/web/src/theme/tokens.ts
  - id: openwiki-source-7f1c49c9ea79c77f6775aee2
    resource: repo://packages/web/src/threshold/threshold-storage.ts
generated: { by: "claude-code", at: "2026-09-27T19:26:28.611Z" }
verified:
  - by: openwiki/0.6.0
    at: 2026-09-27T19:26:28.611Z
---

# Web page: artifact load and ranked list

`@poe/web` is a static single page. It has no server and no API of its own. On load it fetches the published JSON files next to it, validates them with the `@poe/contracts` schemas, and asks `@poe/core` to rank them in the browser. The entry is `packages/web/src/main.tsx`: Mantine CSS, then `PageProvider` (the theme), then `App`.

## The seven artifacts

`packages/web/src/load/artifacts.ts` declares the complete fetch set, `ARTIFACTS`, in a fixed order (`ARTIFACT_ORDER`, AD-24). Each artifact has a path, a schema, an expected version, and a class:

| Key | Path | Class | Expected version |
| --- | --- | --- | --- |
| `dataset` | `dataset.json` | required | `SUPPORTED_SCHEMA_VERSION` |
| `syncReport` | `sync-report.json` | tolerable | `SYNC_REPORT_SCHEMA_VERSION` |
| `weights` | `weights.json` | tolerable | `WEIGHTS_SCHEMA_VERSION` (`6.1.0`) |
| `recipes` | `recipes.json` | tolerable | `SUPPORTED_SCHEMA_VERSION` |
| `tracked` | `tracked.json` | required | `SUPPORTED_SCHEMA_VERSION` |
| `config` | `config.json` | required | `SUPPORTED_SCHEMA_VERSION` |
| `catalogueStats` | `catalogue/stats.json` | required | `SUPPORTED_SCHEMA_VERSION` |

The weights artifact is parsed with the full `WeightsFileSchema` from `contracts`, so a weights file that breaks any hard error of the contract (for example plain and defence-suffixed classes in one `categoryId`) refuses the render as a `content` refusal, just like a malformed body. The expected version is the `contracts` constant, not a copy.

A required artifact that is absent refuses the render, the same as an invalid one. A tolerable artifact that is absent becomes `null` in the set, never a stand-in value, and the trust strip prints one line per absent tolerable artifact. The page **never fetches `catalogue/static.json`**. The one denomination word it prints, `Divine`, is the constant `DENOMINATION` in `shared/product.ts`, not the catalogue label. Adding an eighth artifact needs an AD-24 amendment. The build's prune allowlist mirrors this table (see [Build, typecheck and deploy](../operations/build-typecheck-and-deploy.md)). Schemas and envelopes are described in [Contracts, envelopes and the data/ files](../architecture/contracts-and-data-files.md).

## One load, one outcome

`loadArtifacts` (`load/load-artifacts.ts`) fetches all seven in parallel. Each is a plain `fetch` with `cache: 'no-cache'` and no query token, against `import.meta.env.BASE_URL` (the base is `./`). The browser revalidates every load and reuses its copy only on a `304`, so each load is as fresh as a full download. The Pages CDN's `max-age=600` staleness, and a rare set that mixes files across a data commit, are accepted costs. The loader **never rejects**. Each result is classified first:

- `404` gives *absent*. Any other non-OK status, or a network error, gives *not-arrived*.
- A body that is not JSON, or that fails `parseEnvelope`, gives *invalid*, with a **cause** and the declared `schemaVersion` (or `null` when the file declares no string version):
  - `version`: an unknown major, a malformed version, or no string `schemaVersion` at all;
  - `content`: the body is not JSON, or it declares the expected major but its shape fails the schema.

  The switch over the `parseEnvelope` reasons is exhaustive (`satisfies never`). A new reason fails the compile. It does not become a silent `version`.

Then the precedence across all seven applies, and each screen names the **first** failing artifact in the fixed order:

1. Any *not-arrived* gives `failed`.
2. Otherwise, any *invalid* gives `refused` with its own cause. A required artifact that is *absent* gives `refused` with the cause `missing`.
3. Otherwise, the outcome is `ready`, with the set and the list of absent tolerable keys.

`FailureScreen` (`frame/FailureScreen.tsx`) renders the two failure outcomes. Each one replaces the whole page: there is no masthead and no list, and nothing old is served.

- **Refusal**: "A required file cannot be used." The body names the path as `× unresolvable`, then one sentence for the cause. A `version` fault names the declared and the expected versions, or says that the file declares no schema version. A `content` fault names only the expected version. A `missing` file names neither.
- **Fetch failure**: "One of the data files did not arrive." The title has no count and does not say "required", because a 5xx on a tolerable file also shows this screen. The body names the path and offers "+ Try again".

`App.tsx` is a small state machine: `pending`, then exactly one of `ready`, `refused` or `failed`, in a single transition. The set is never rendered row by row. `pending` paints the masthead, a blank trust-strip slot, the asking-price line, twenty skeleton row slots and the page tail. "Try again" resets to `pending` and runs all seven fetches again. A load that has been superseded is aborted. On `ready`, "now" is read **once**, and every age on the page uses it, so ages do not update while the page is open.

## Ranking at the Payout Threshold

`ReadyBody` calls `rank({ tracked, dataset, activeLeague: config.league, threshold, weights: set.weights })` from `@poe/core` and memoises the result on the set, now and the threshold. From that one ranking it renders the list statement, the ranked list, and the page tail led by the Unrankable appendix. The appendix lists crafted classes that are absent from the weights file or declare a partial pool. `web` computes no ranking term itself (see [Core: ranking and refresh rotation](../core/ranking-and-refresh-rotation.md)).

The **Payout Threshold** (`threshold/threshold-storage.ts`) is the only value the page writes to browser storage (key `poe-cbpc.payoutThreshold`). Its range is 0 to 3 Divine, in steps of 0.05, at 2 decimal places (`MONEY_DECIMALS`). The default is 0.25 (`DEFAULT_THRESHOLD` in `shared/product.ts`). Reading happens once at mount. It accepts only a plain decimal string in range. Anything else, including a storage that throws, gives the default. A write is clamped, and a blocked write is ignored. Changing the threshold re-runs `rank`.

## From ranking to rows

`toDisplayRows(ranking, dataset, now)` (`list/display-rows.ts`) builds the printed list:

- `ordering` rows come first, in `core`'s order. Each is numbered by position, with tier 1 for ranks 1–5, tier 2 for 6–10 and tier 3 for 11 onward. The EV prints at 2 dp, or as `< 0.01` for a value above 0 and below 0.005 (`formatDivine` in `shared/money.ts`).
- The unpriced raw bases follow, unnumbered at tier 3. The order is `noListings` ("an open question"), then `notYetSynced` ("no figure yet"), then `unresolvable` ("not valued"). An unresolvable Raw Base is shown as a row, not only counted.
- `belowThreshold` rows leave the list.

**Honest-empty ordering.** `isHonestEmpty` (`list/list-statement.ts`) is the one predicate that the statement and the row order share. It holds when `ordering` and `belowThreshold` are both empty and at least one unpriced row exists. While it holds, the unpriced rows print as one sequence in canonical key order (`compareCanonicalKeys` on `entryKey`) across all three groups. Every EV cell then reads "no figure yet". Each row keeps its own Price State, so its expansion still prints its own phrase and note.

A missing figure never prints as `0`. The list shows the top **20** rows (`TOP_ROWS` in `shared/product.ts`), with "+ Read the remaining N rows" to grow the list in place. This limit only slices the display: `core` ranks the full tracked list. When the row count drops to 20 or fewer, the grown state is cleared, so a later rise opens collapsed.

The **age cell** (`list/format.ts`, `ageMark`) follows the row's resolved Price State. It uses `observedAt` only where the row prints `priced`, and `lastAttemptedAt` otherwise. A league-mismatched observation therefore reads `lastAttemptedAt`. With neither clock the cell shows "never attempted". An entry younger than 48 hours shows no mark. Older entries show `priced Nd ago` or `tried Nd ago`.

The **list statement** (`list/list-statement.ts`) is a pure check over the ranking:

- *honest empty*: `isHonestEmpty` holds. The copy is "In canonical order, not ranked: no tracked unit has a price from {league} yet." When every row is `unresolvable`, the copy drops "yet", because no sync will bring a price.
- *nothing clears*: nothing is in the ordering but something is below the threshold. The copy is "Nothing clears your Payout Threshold of X.XX Divine."
- Otherwise there is no statement.

**Row expansion** shows the evidence behind a row: the price state with its `not-yet-synced` reason, the sample size, both exact ages, the state's note, and a **trade link**. `tradeSearchHref` (`list/trade-link.ts`) builds `https://www.pathofexile.com/trade2/search/poe2/{league}/{lastSearchId}` only when the entry has a stored search, `lastSearchLeague` equals the active league, and the entry is not pruned. Only the league segment is percent-encoded.

## Page tail and the Unrankable appendix

`PageTail` closes every state except the two failure screens. It is pushed to the frame's foot by `margin-top: auto` and holds, in order, the Unrankable appendix, the key block and the running foot. The appendix renders only in `ready`. While `pending`, no count is known, so the tail holds only the key block and the running foot.

`UnrankableAppendix` (`list/UnrankableAppendix.tsx`) renders `ranking.unrankable`. Every row is an Item Class, never a Base Type. The title is "Appendix: Unrankable — " followed by the count (`1 Item Class`, `N Item Classes`). The count is rust when there are rows and ink when there are none.

- With rows, the lead line "Tracked, but kept out of the ordering." follows. Then there is one row per class: a class glyph and the class label (`unitLabel`, which changes underscores to spaces), an `unknown` trust mark, the reason, and an empty note cell.
- With no rows, the panel is the title alone, with the bottom padding equal to the top padding and no text that says why.

The appendix has one arrangement: every row renders and the document grows. Nothing switches on a count or a measurement. Rows are not interactive: they have no handler, hover tone, role or title. The panel spacing (`appendixPad*`, `appendixLead*`) comes from `theme/tokens.ts`.

## Trust strip and sync report panel

`frame/trust-facts.ts` holds pure formatters over the published `sync-report.json` and the `weights.json` envelope. It counts records and derives nothing else. The trust strip prints the weights file's producer, date and patch, "Last synced" (a relative age from the report's run times), and "Tracked List last edited" (from the report's `trackedListEditedAt`, with "(not committed)" for a `file-modified` clock). It prints one line per absent tolerable artifact. It also prints a **health line** with exactly two triggers:

- a count of `unresolvable` records;
- pinned starvation, read only from the `pinned-starvation` record whose `pinnedCount` equals the loaded pinned-set size and whose `declaredMinChunkSearches` equals the loaded `minChunkSearches`. It reads "N of M pinned entries starved", or "M pinned entries left the rotation no search" when N is 0. A stale record for a different curation raises nothing.

An absent report raises no health signal, no trigger prints a zero, and a missing value prints as italic *unknown*. The "+ the full sync report" panel shows three columns of published figures: the sync run, what is broken, and what the weights cover. Zeros do print in the panel. Missing coverage reads *not measured* when a weights envelope loaded and *unknown* when none did. The coverage percent is floored, lifted to 1% when it is non-zero, and capped at 99% while coverage is partial.

## Shared helpers and module homes

`packages/web/src/shared/` holds the helpers that more than one view folder uses. Each concept has one home, so there are no parallel spellings:

| Module | Holds |
| --- | --- |
| `shared/product.ts` | product-owned numbers and words: `TOP_ROWS`, `DEFAULT_THRESHOLD`, `DENOMINATION` |
| `shared/money.ts` | the 2 dp money precision: `formatDivine` (with `< 0.01`) and `formatThreshold` |
| `shared/time.ts` | `MINUTE_MS`/`HOUR_MS`/`DAY_MS`, `exactAge` (`< 1h`, `Nh`, `Nd`) and `relativeAge` (`N minutes ago`) |
| `shared/text.ts` | `NBSP` and `plural(count, singular, pluralForm)`, which agrees nouns and verbs ("1 row", "1 entry was") |
| `shared/cell.ts` | `fixedCell`, the fixed-width flex cell style |
| `shared/affordance.css` | the text-button affordance style |

The 48-hour list age mark stays in `list/format.ts`, because only the list uses it. The list and threshold styles live in `list/list.css` and `threshold/threshold.css`. `frame/frame.css` keeps only the frame's own styles.

## Theme

`theme/tokens.ts` transcribes the token set from the frontmatter of the UX `DESIGN.md` ("Field Guide"). When the two disagree, `DESIGN.md` wins. `theme/theme.ts` replaces Mantine's defaults entirely: a sepia primary palette, ink and paper as black and white, a zero radius everywhere, no shadows (with `shadow="none"` as the default on every component that has a shadow prop), and components such as Accordion without chevrons or transitions. `PageProvider` applies the theme and a CSS-variables resolver.

## Tests

Web tests run under jsdom. `test-support/artifact-server.ts` registers MSW handlers for all seven artifacts and a trap for `catalogue/static.json`. `test-support/dom.tsx` holds the shared mount helpers (see [Test strategy and network guards](../testing/test-strategy-and-guards.md)). The main suites are `load-artifacts.test.ts`, `App.test.tsx` (composition only), `ranked-list.test.tsx`, `expansion.test.tsx`, `display-rows.test.ts`, `list-statement.test.ts`, `format.test.ts`, `unrankable-appendix.test.tsx`, `trade-link.test.ts`, `payout-threshold.test.tsx`, `threshold-storage.test.ts`, `trust-strip.test.tsx`, `trust-facts.test.ts`, the `shared/*.test.ts` files, and `theme.test.ts` / `tokens.test.ts`.
