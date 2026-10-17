---
type: concept
title: "Core: the price-trust verdict"
description: How @poe/core computes a price-trust verdict (current, rough, pending, broken) with typed reasons for every raw entry, crafted combination and crafted row, and how the web page turns those reasons into marks, words and missing figures.
tags: [core, price-trust, ranking, web, ux]
verified:
  - by: openwiki/0.6.0
    at: 2026-10-17T13:54:42.734Z
sources:
  - id: openwiki-source-1d2fe98c46047daad1ac7fee
    resource: repo://packages/contracts/src/ranked-row/price-trust.ts
  - id: openwiki-source-ffcbe620ea8cd829a4542712
    resource: repo://packages/core/src/price-trust.ts
  - id: openwiki-source-1366de320899d3bb9b455ea5
    resource: repo://packages/core/src/rank-crafted-row.ts
  - id: openwiki-source-04c5c6716d7633c4e68e2d4e
    resource: repo://packages/core/src/rank.ts
  - id: openwiki-source-3913fa1d9ed69d69b4d3b106
    resource: repo://packages/web/src/list/display-rows.ts
  - id: openwiki-source-771eae7b972dcbc17b2be35f
    resource: repo://packages/web/src/list/row/trust-words.ts
generated: { by: "claude-code", at: "2026-10-17T13:54:42.734Z" }
---

# Core: the price-trust verdict

Every row the ranking returns carries a **price-trust verdict**: whether the player can rely on the figure. `core` computes it in `packages/core/src/price-trust.ts`. `web` derives none of it; it only maps the verdict to a mark and the reasons to words. The thresholds and the words come from the *Price trust* section of the UX `EXPERIENCE.md`, and the contract is `PriceTrustSchema` in `packages/contracts/src/ranked-row/price-trust.ts`.

## The contract

A `PriceTrust` is `{ verdict, reasons }`:

- `verdict` is one of `current`, `rough`, `pending`, `broken`.
- `reasons` is a list of typed reasons. It is **empty exactly when the verdict is `current`**, and a refinement enforces this. A reason is data, never a display string.

| Reason kind | Payload | Produced for |
| --- | --- | --- |
| `old` | `days` (whole days, rounded down) | a priced entry at least 72 h old |
| `thin` | `listings` (the `sampleSize`) | a priced entry on fewer than 3 listings |
| `no-listings` | optional `minutes` since `lastAttemptedAt` | an entry whose search found nothing |
| `never-synced`, `league-mismatch`, `no-exchange-rate` | none | a `not-yet-synced` entry, by its reason |
| `unresolvable` | none | an entry a patch removed |
| `no-recipe` | none | a crafted class while no recipe is published |
| `uncostable` | none | a crafted row whose recipe has no Craft Cost |
| `all-broken` | none | a crafted row whose every entry is broken |
| `no-prices` | none | a crafted row with no entry priced in the active league |
| `unreliable-share` | `percent` (whole percent, rounded down) | a crafted row whose gross rests mostly on rough prices |

An `old` reason precedes a `thin` one when both apply.

## One entry's verdict

`entryTrust(entry, datasetEntry, activeLeague, now)` gives the verdict of one non-pruned tracked entry. A pruned entry has no verdict and throws `RangeError`. It first resolves the price with `resolvedPrice`:

- no dataset entry reads as `not-yet-synced` / `never-synced`;
- a `priced` observation from another league reads as `not-yet-synced` / `league-mismatch`, so an old league's price is never ranked;
- every other state is used as published.

Then the state decides the verdict:

| Resolved state | Verdict | Reasons |
| --- | --- | --- |
| `priced` | `current`, or `rough` when old or thin | `old` (age ≥ `OLD_AFTER_HOURS`, 72), `thin` (`sampleSize` < `THIN_BELOW_LISTINGS`, 3) |
| `no-listings` | `pending` | `no-listings`, with `minutes` when `lastAttemptedAt` exists |
| `not-yet-synced` | `pending` | the state's own reason |
| `unresolvable` | `broken` | `unresolvable` |

Ages are clamped at 0, so a timestamp later than `now` never gives a negative age. Every span uses the shared `MINUTE_MS` / `HOUR_MS` / `DAY_MS` constants in `clock.ts`, which `web` also imports.

## The clock

`core` reads no clock. `RankInput.now` is an ISO-8601 instant the caller passes in; the page passes its load time. `rank` calls `assertClock` first and throws `RangeError` for an unparseable value, so a bad clock cannot quietly turn every age into `NaN`.

## A crafted row's verdict

A crafted row (one item class under one recipe) gets one verdict for the whole row, by ordered rules where the first match wins:

1. With no recipe published at all, every crafted class is listed as recipeless with `NO_RECIPE_TRUST` (`pending`, `no-recipe`). This rule sits in `rank.ts`, before any row is built.
2. `craftedTrust` then applies, in order:
   1. the recipe is uncostable → `pending`, `uncostable`;
   2. every entry of the class is `broken` → `broken`, `all-broken`;
   3. no entry is priced in the active league → `pending`, `no-prices`;
   4. the share of the row's gross (sum of `P × price` over priced entries) contributed by `rough` entries is at least `UNRELIABLE_SHARE_MIN` (70 %) → `rough`, `unreliable-share` with the percent;
   5. otherwise `current`.

The share rule counts **every** non-pruned entry of the class, including entries below the Payout Threshold, so hiding a row's cheap entries cannot change its verdict. The comparison allows a `1e-9` tolerance, because a share built from float sums must still match at exactly 70 %.

Each summand and combination inside a crafted row also carries its own entry verdict. `compareCombinations` orders the expansion's combinations as priced (current or rough), then pending, then broken, then by canonical key.

## What the verdict changes in the ranking

The verdict is not only a label:

- A costable crafted row whose verdict is `pending` or `broken` is moved from the ranked list to the **unpriced crafted** group (`isUnpriced` in `rank.ts`). A row below the threshold stays ranked.
- On the page, a `pending` or `broken` row prints `—` as its EV instead of a figure (`hasNoFigure` in `packages/web/src/list/display-rows.ts`), next to its mark.

## How the page shows it

`web` keeps the words in one place, `packages/web/src/list/row/trust-words.ts`:

- `VERDICT_WORDS` names the three marked verdicts; `current` has no mark and no word.
- `rowReasonWords` maps each reason to its tooltip words: for example `old` becomes `priced <age>`, `thin` becomes `only N listings`, and `unreliable-share` becomes `N% of this EV rests on unreliable prices`. The fixed reasons are in `FIXED_ROW_REASONS`.
- `lineReasonWords` differs only for `no-listings` on an expansion line, which names its attempt age (`tried <age> · no listings`).
- `markTooltipParts` and `lineTrustParts` join the reasons with the shared joiner, in `core`'s order.

`packages/web/src/marks/marks.tsx` draws the three marks as small SVGs: a half-filled ring for `rough`, an empty ring for `pending`, a cross for `broken`. Each mark takes its color from the `trust-*` theme tokens. `MarkSlot` in the row shows the mark with a tooltip of `<word> · <reason>`. See [Web page: artifact load and ranked list](../web/page-load-and-ranked-list.md) for the row and expansion layout, and [Web frame, theme and controls](../web/frame-theme-and-controls.md) for the tokens.

## Tests

`packages/core/src/price-trust.test.ts` covers the thresholds at their bounds, the ordered crafted rules and the share tolerance. The rank tests check that rows carry the verdicts. Web tests check the words and marks against the reasons.

## Related

- [Core: ranking and refresh rotation](ranking-and-refresh-rotation.md): where `rank` builds the rows that carry the verdict.
- [Contracts, envelopes and the data/ files](../architecture/contracts-and-data-files.md): the dataset price states the verdict reads.
