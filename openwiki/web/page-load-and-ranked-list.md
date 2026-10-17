---
type: architecture
title: "Web page: artifact load and ranked list"
description: How the static page loads and validates its seven artifacts, ranks them with core, narrows the ranking to the active recipe, and renders the ranked list — the four-column row grid, rarity-coloured names, chase cells, the mark slot, the expansion lines with their trust reasons and trade links, the list statements, the Unrankable appendix and the footer legend.
tags: [web, react, ranked-list, artifacts, loading, expansion, unrankable-appendix]
verified:
  - by: openwiki/0.6.0
    at: 2026-10-17T13:54:42.734Z
sources:
  - id: openwiki-source-d952717f7ba616148cf6047b
    resource: repo://packages/web/src/App.tsx
  - id: openwiki-source-8f6c2195c06d3f201f23082b
    resource: repo://packages/web/src/list/active-ranking.ts
  - id: openwiki-source-928cbcc71a71dd6a9409c86d
    resource: repo://packages/web/src/list/combination-text.ts
  - id: openwiki-source-3913fa1d9ed69d69b4d3b106
    resource: repo://packages/web/src/list/display-rows.ts
  - id: openwiki-source-41a6a38065b41db109392d4c
    resource: repo://packages/web/src/list/ExpansionPanel.tsx
  - id: openwiki-source-1cd8d94203d43a3423d47aff
    resource: repo://packages/web/src/list/list-statement.ts
  - id: openwiki-source-ceed55a939c80c738045d1e1
    resource: repo://packages/web/src/list/ranked-list/chase-count.ts
  - id: openwiki-source-886a98f0b5bc7b727f293662
    resource: repo://packages/web/src/list/RankedList.tsx
  - id: openwiki-source-b38ce79da33c33d67ce7a55b
    resource: repo://packages/web/src/list/RankedRow.tsx
  - id: openwiki-source-35db1d8c09ed97e59222c4b5
    resource: repo://packages/web/src/list/trade-link.ts
  - id: openwiki-source-b44e23befe2ec1806e6feaf9
    resource: repo://packages/web/src/list/UnrankableAppendix.tsx
  - id: openwiki-source-f20f60e1ecaf073e364173ca
    resource: repo://packages/web/src/load/artifacts.ts
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
generated: { by: "claude-code", at: "2026-10-17T13:54:42.734Z" }
---

# Web page: artifact load and ranked list

`packages/web` is a static React 19 + Mantine page. It has no server: it fetches the committed `data/` files at runtime, validates them with the `contracts` schemas, and ranks them in the browser with `core`'s `rank`. This page covers the load and everything inside the list. The shell, the header controls, the theme, the sync report and the failure screens are in [Web frame, theme and controls](frame-theme-and-controls.md).

## Loading the seven artifacts

`packages/web/src/load/artifacts.ts` declares the fetch set in `ARTIFACTS`, in a fixed order (`ARTIFACT_ORDER`):

| Artifact | Class | Expected version |
| --- | --- | --- |
| `dataset.json` | required | `SUPPORTED_SCHEMA_VERSION` |
| `sync-report.json` | tolerable | `SYNC_REPORT_SCHEMA_VERSION` |
| `weights.json` | tolerable | `WEIGHTS_SCHEMA_VERSION` |
| `recipes.json` | tolerable | `SUPPORTED_SCHEMA_VERSION` |
| `tracked.json` | required | `TRACKED_SCHEMA_VERSION` |
| `config.json` | required | `SUPPORTED_SCHEMA_VERSION` |
| `catalogue/stats.json` | required | `SUPPORTED_SCHEMA_VERSION` |

Every expected version is imported from `contracts`, so the page and the schemas cannot drift. The page never fetches `catalogue/static.json` or any other `data/` file. The build prunes the published copy to these seven (see [Build, typecheck and deploy](../operations/build-typecheck-and-deploy.md)).

`loadArtifacts` (`load/load-artifacts.ts`) fetches all seven with `cache: 'no-cache'` and an abort signal, and **never rejects**. Each artifact becomes one result:

- a 404 is **absent**; any other non-OK status or a network error **did not arrive**;
- a body that is not JSON is **invalid** (cause `content`);
- `parseEnvelope` refusing the version (`unknown-major`, `malformed-version`), or a body with no string `schemaVersion`, is invalid with cause `version`; a body that fails the schema at the right major is cause `content`.

Then precedence picks one outcome, naming the first failing artifact in `ARTIFACT_ORDER`: any **did-not-arrive** gives `failed`; else any **invalid** artifact, or an **absent required** one (cause `missing`), gives `refused`; else `ready`, with each absent tolerable artifact set to `undefined` and listed in `absent`. A `refused` outcome carries the declared and expected versions.

The weights file is parsed with the full `WeightsFileSchema`, so a file that breaks a hard rule of the weights contract is a content refusal.

## From ranking to rows

When the set is ready, `App` ranks it once per threshold over **every** recipe (see [Web frame, theme and controls](frame-theme-and-controls.md#the-app-shell)). The list then works only on `core`'s output; `web` orders nothing.

1. **Narrow to the recipe.** `forRecipe(ranking, recipe)` (`list/active-ranking.ts`) keeps raw rows and the active recipe's crafted rows, its unpriced crafted rows, and the Unrankable classes that hold under every recipe or under this one. It marks the ranking `uncostable` when the active recipe is uncostable, and `split` when it is uncostable while something is priced in the league and a crafted row exists.
2. **Build display rows.** `toListBranches` / `toDisplayRows` (`list/display-rows.ts`) turn the ranking into rows:
   - the `ordering` rows, numbered by position, with a tier by position only: ranks 1–5, 6–10 and 11 onward;
   - then the trailing, unnumbered rows in this order: pending crafted classes, raw entries with no listings or not yet synced, broken crafted classes, unresolvable raw entries;
   - then recipeless crafted classes (with no recipe published).
   `belowThreshold` raw rows are not shown.
3. **States that change the shape.** In the **honest-empty** state (nothing priced in the active league, but rows exist), every row prints in canonical key order with no numeral and no EV figure. In the **split** state, the raw and crafted branches print apart, unnumbered, because an uncostable recipe has no EV to rank against raw prices.

A row's EV cell is a figure at 2 decimals, dimmed when negative (the dim follows the printed minus sign or `< 0.00`, never colour alone), or `—` when the row's verdict is `pending` or `broken` or its recipe is uncostable. A crafted row whose provenance is `uniform-prior` carries the ≈ estimate mark next to a figure.

## The list statement

`listStatement` (`list/list-statement.ts`) prints at most one line above the list, by precedence:

1. **honest-empty**: `In canonical order, not ranked: no tracked unit has a price from <league> yet.` The `yet` is dropped when every row is broken, because no sync will price them.
2. **uncostable** (split state): the recipe word, and that Item Classes and Raw Bases are ordered apart.
3. **nothing-clears**: no raw row ranks and no crafted row has a summand, while something is listed: `Nothing clears your Payout Threshold of <threshold> div.`
4. otherwise none.

## The ranked list

`RankedList` (`list/RankedList.tsx`) renders one branch, or two in the split state, under a `ColumnHeader`. The EV column label carries a tooltip (`ExpectedValueTooltip`) that states the live threshold and the active recipe's Craft Cost (or its uncostable or no-recipe variant) and decodes every mark.

- Each branch shows the top 20 rows (`TOP_ROWS` in `shared/product.ts`) and its own `Read the remaining N rows` / `Show only the top 20` toggle. `core` still ranks the whole list; this is a display slice only.
- The set of open rows and the grown flags reset on reload but survive a threshold change or a recipe switch. A crafted row is keyed by its class key, so its open panel survives a recipe switch.

### The row

`RankedRow` (`list/RankedRow.tsx`) uses the shared four-column grid `rankedRowGrid` (rank, name, EV, chase), 38 px high.

- **Rank**: the numeral, with ranks 1–5 emphasised by weight and colour, never by size.
- **Name**: the Base Type id for a raw row, or the `className` with underscores as spaces for a crafted class, in its rarity colour: `rarity-magic` for a crafted class, `rarity-normal` for a raw base. A raw row also prints a plain line in the chase column that tells it apart without colour.
- **EV** with the **mark slot** (`list/row/MarkSlot.tsx`): the verdict mark of the row's price trust, with a tooltip of `<word> · <reasons>` (see [Core: the price-trust verdict](../core/price-trust-verdict.md)).
- **Chase cells**: a crafted row shows its first summands, in `core`'s contribution order, as Combination text. `useChaseCellCount` (`list/ranked-list/chase-count.ts`) measures the list width once for the whole page and shows three cells while each is at least the measured budget (`CHASE_CELL_BUDGET`, 177 px) wide, else two. An unused slot stays empty. A cell whose text is cut opens its full text on hover.

**Combination text** (`list/combination-text.ts`, `list/short-forms.ts`) names each affix by a short form plus its `acceptedTier` (for example `T1 % Armour`), with the prefix and suffix joined by ` · `. Without a short form, or for a banded reference without a tier, it falls back to the catalogue's stat text with the band filled in, set in the mono register. A **hybrid** affix prints its tier and its lines' short forms joined by commas, sorted by printed text; it uses short forms only if every line has one.

### The expansion

Opening a row shows its panel (`list/ExpansionPanel.tsx`):

- a **context line** with the name in its rarity colour, and the ≈ sentence on a `uniform-prior` row;
- for a raw row, one line with no Combination text;
- for a crafted row, one line per entry in `core`'s order (summands, then the other combinations, including priced entries below the threshold), showing the top 8 lines (`TOP_LINES`) with a toggle for the rest, then the pruned entries behind `+ N pruned`.

`ExpansionLine` (`list/expansion/ExpansionLine.tsx`) prints the Combination, the curation mark `* pinned` where it applies, the price or `—`, the trust cell (`<mark> <word> · <reasons>`, where a `no-listings` reason names its attempt age), and the trade link. A pruned line is struck through and led by `† pruned`, with its reason on the next line and no trust or link.

The **trade link** (`list/trade-link.ts`) is `https://www.pathofexile.com/trade2/search/poe2/<league>/<searchId>`, with the league percent-encoded and the search id verbatim. It renders only for a non-pruned entry whose stored `lastSearchLeague` equals the active league; otherwise the cell is empty. It never reads the price state.

## The page tail

Under the list, `PageTail` (pushed to the frame's foot with `margin-top: auto`) holds:

- the **Unrankable appendix** (`list/UnrankableAppendix.tsx`, ready state only): the title `Appendix: Unrankable — <count>`, a lead line, and one non-interactive row per class with its label, reason and note. The notes explain each reason (for example `may return after the next weights run` for an absent class, or that a disagreeing class is fixable in `data/tracked.json`). A class whose base types still rank as Raw Base rows adds `some of its bases still rank, sold as is`.
- the **footer legend** (`list/FooterLegend.tsx`): nine items that decode the rarity swatches, the three trust marks, the curation marks and the ≈ mark, ending with the note that prices are live asking prices, not sales.

## Shared helpers

`packages/web/src/shared/` holds values and helpers that several view folders read: `product.ts` (`TOP_ROWS` 20, `TOP_LINES` 8, `DEFAULT_THRESHOLD` 0.25, the `Divine` denomination and the `div` unit), `money.ts` (2-decimal formatting with the `< 0.01` floor, `< 0.00` for a tiny loss, the true minus sign), `time.ts` (relative, reason and compact age spellings), `text.ts` (`plural`, the no-break space and the ` · ` joiner), `cell.ts` and the `ShowMore` toggle.

## Tests

`load/load-artifacts.test.ts` drives the loader through the MSW artifact server, including the fetch set and its `no-cache` mode. `load/prune-allowlist.test.ts` pins the build's allowlist to `ARTIFACTS`. The list, row, expansion and appendix tests mount through `test-support/dom.tsx`, and `list/ranked-list/chase-count.test.ts` fails when the short-form table outgrows the chase budget. `list/tracked.data.test.ts` checks the live `data/tracked.json` in the `data` project. See [Test strategy and network guards](../testing/test-strategy-and-guards.md).
