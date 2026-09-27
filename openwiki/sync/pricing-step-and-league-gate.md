---
type: subsystem
title: Pricing step and league gate
description: How sync prices one tracked entry against the Path of Exile 2 trade API — the deterministic search body, one search and at most one fetch of the ten cheapest results, Divine normalisation from data/currencies.json, the lower median, the outcome per response class — and how the run-start league gate validates the configured league.
tags: [sync, pricing, trade-api, search-body, divine, median, league]
sources:
  - id: openwiki-source-296818e62a60a3d8c9064ad5
    resource: repo://packages/sync/src/catalogue/weights-ids.ts
  - id: openwiki-source-674c962be00b9b26529f4d45
    resource: repo://packages/sync/src/chunk/run-chunk.ts
  - id: openwiki-source-1586f13640754a9ac798c146
    resource: repo://packages/sync/src/league/league-gate.ts
  - id: openwiki-source-e1ea73778672f5f776de6c82
    resource: repo://packages/sync/src/load-data-file.ts
  - id: openwiki-source-96fe542c9b978e4fb23f0314
    resource: repo://packages/sync/src/pricing/normalise.ts
  - id: openwiki-source-b293525c0b4d3d93a18fe376
    resource: repo://packages/sync/src/pricing/price-entry.ts
  - id: openwiki-source-6463c78c974805557d576aa0
    resource: repo://packages/sync/src/pricing/search-body.ts
  - id: openwiki-source-f003d449d6194f288151c79f
    resource: repo://packages/sync/src/trade/endpoints.ts
generated: { by: "claude-code", at: "2026-09-27T19:26:28.611Z" }
verified:
  - by: openwiki/0.6.0
    at: 2026-09-27T19:26:28.611Z
---

# Pricing step and league gate

The chunk runner calls one **pricing step** per visited entry, and one **league gate** before the first step (see [The sync chunk runner](chunk-runner.md)). Both send their requests through the governed trade client (see [Governed trade client and rate limits](trade-client-and-rate-limits.md)). Neither module reads a player file. The league, the rates and the item types arrive as values from `composeChunk`.

The target is the Path of Exile 2 trade API: `https://www.pathofexile.com/api/trade2`, realm `poe2` (`packages/sync/src/trade/endpoints.ts`).

## The search body

`buildSearchBody(entry, itemTypes)` in `packages/sync/src/pricing/search-body.ts` is pure. It builds the body from the tracked entry and the committed item catalogue only. Its object literals use a fixed key order, so one entry always serialises to the same bytes. The recorded fixtures are keyed on those bytes (see [Operator commands and curation workflow](../workflows/operator-commands.md)).

Every body has `status: securable`, the price filter `exalted_divine`, `sort: { price: 'asc' }`, `ilvl.min = itemLevelMin`, and one `and` stat group.

- **Raw entry**: `query.type` is the `baseTypeId`, with no category, rarity `normal`, and no stat filters.
- **Crafted entry**: `type_filters.category` is the `categoryId` and rarity is `magic`. There is one stat filter per affix. A banded affix sends `{min: valueMin, max: valueMax}` exactly as declared, never rounded. A valueless affix sends `{}`. Every filter has `disabled: false`. The `className` then chooses one of three arms, tried in order:
  1. **Defence arm**: the class ends in a run of `str`/`dex`/`int` tokens, such as `body_armour_str_int`. All three `equipment_filters` are sent. A letter that is present gives `{min: 1}` for its defence (`ar`/`ev`/`es`), and a letter that is absent gives `{max: 0}`. The split is `defenceLettersOf` from `@poe/contracts` (`class-name.ts`), the same grammar the weights schema validates class keys with, so the two cannot drift (see [Contracts, envelopes and the data/ files](../architecture/contracts-and-data-files.md)).
  2. **Type arm**: the `categoryId` names a whole group in `data/catalogue/items.json`, for example jewels. The class, with `_` replaced by spaces, must be one of that group's base types, and it is sent as `query.type`. If the base type is not in the catalogue, the builder throws `UnknownClassBaseTypeError` **before any request exists**.
  3. **No discriminator**: the category filter is already exact.

`acceptedTier` is display-only and never read. No `sale_type` is sent.

## The weights ids check

`readWeightsIds` (`packages/sync/src/catalogue/weights-ids.ts`) is the run-start reader of `data/weights.json`. It loads the file through `parseEnvelope` with the full `contracts` `WeightsFileSchema` (version `WEIGHTS_SCHEMA_VERSION`). It then collects the outer `bases` keys (`categoryId`s) and every line's `statId`, skipping a `null` `statId`, which is the producer's own unresolved marker.

- An absent file is `absent`: the chunk records `weights-absent` and goes on.
- Invalid JSON, an unknown or malformed major, or any hard error of the contract refuses the **whole file** with a `DataFileError` naming `data/weights.json`, before any request. An `invalid` refusal names only the first issue's path and message.
- Ids that the catalogue does not know become `uncatalogued-weights-id` report records. A miss never refuses the file or rewrites it.

`DataFileError` (`load-data-file.ts`) carries the path and a reason. `runChunk` raises the same error for the envelopes it reads under the lock, so the `pnpm sync` session can tell a file refusal, which only an edit clears, from a transient fault (see [The pnpm sync session](sync-session.md)).

## One entry, step by step

`createPricingStep` in `packages/sync/src/pricing/price-entry.ts` returns a step with this flow:

1. Build the body. On `UnknownClassBaseTypeError` the entry is marked `unresolvable` with nothing stamped. The step returns an `unresolvable` record (`identifierKind: baseTypeId`), sends no request, and the chunk continues.
2. Stamp `lastAttemptedAt` with the clock.
3. **Search**: `POST /search/poe2/{league}`. Only the league segment is percent-encoded. The request goes in the search lane.
4. If the search is answered, set `lastSearchId` (the response's top-level `id`, stored verbatim) and `lastSearchLeague`. These are set whatever the fetch returns later. An empty `result` array gives `no-listings`.
5. **Fetch**: `GET /fetch/{ids}?query={searchId}&realm=poe2` for at most the first **10** result ids (`FETCH_LIMIT`). The request goes in the fetch lane.
6. Parse the priced listings. A `null` result, or a listing without a finite positive amount and a currency, is skipped and not counted.
7. Compute the price:
   - no priced listings gives `no-listings`.
   - any listing whose currency has no current rate gives `not-yet-synced` with reason `no-exchange-rate`. No listing is stored without normalisation.
   - otherwise each listing is normalised to divine and the **lower median** is taken. The result is `priced`, with an observation of `league`, `observedAt`, `priceDivine`, `sampleSize` and the `exchangeObservation` rate behind the median listing.

The step returns `completed` with the new entry and the `remaining` search and fetch allowances from the response headers. The runner uses these to bound the chunk.

### Outcome by response class

The step sends each request once. It has no retry and no queue of its own.

| Answer | Entry | Chunk |
| --- | --- | --- |
| Search answered | `lastAttemptedAt`, `lastSearchId`, `lastSearchLeague` set, whatever the fetch returns | continues |
| 429, 5xx, timeout or network failure | `lastAttemptedAt` stamped and price state kept. On a fetch, the search fields are also set. | **yields**. After a 429 the yield carries `retryAfterMs`. |
| Any other non-2xx | as above | throws `MalformedRequestError`, and the chunk aborts |
| 2xx with a body of the wrong shape | on the fetch: search fields set and price kept, published. On the search: nothing is published. | throws `UnexpectedTradeResponseError` |
| Jewel-arm base type missing from `items.json` | `unresolvable`, nothing stamped, plus a record | continues |

A request that gets no answer never changes the price state. An older price stays published.

## Divine normalisation

`packages/sync/src/pricing/normalise.ts` holds pure functions. No rate is ever fetched. The rates are the player's `data/currencies.json`, loaded by `load-currencies.ts`.

- `currentRates(rates, league)` keeps only rates whose own `league` equals the active league. A rate from another league counts as missing and is never relabelled. When a currency appears twice, the first current entry wins. `divine` is always exactly `1`.
- `toDivine(amount, rate)` computes `amount × rate` with the unrounded file rate, then rounds **once** to 4 decimal places. `core` never rounds again.
- `lowerMedian` takes the lower of the two middle values on an even sample, so every stored price is a price someone actually asked. It throws on an empty sample. An empty sample is `no-listings`, never a price.
- `outputRate` / `outputRates` write divine at exactly 1 and every other rate at 4 decimal places. The file's `league` and `asOf` are copied unchanged. This is the `currencyRates` set published in `dataset.json`.

## The league gate

`createLeagueGate` (`packages/sync/src/league/league-gate.ts`) runs once per chunk, after all offline checks and the order, and before any search. It sends **one** `GET /data/leagues` in the shared data lane. `composeChunk` counts it as `league-validation`. It then checks that the configured league is one of the returned ids, compared **byte for byte**: `forbidden rites` is not `Forbidden Rites`.

| Answer | Gate result | Report |
| --- | --- | --- |
| 2xx, league present | `pass` | none |
| 2xx, league absent | throws `LeagueMismatchError` (lists the available ids) | `league-mismatch` |
| 2xx, body not the leagues payload | throws `UnexpectedLeaguesResponseError` | `run-failure` / `unrecoverable-error` |
| client yield (429, invalid-request threshold), 5xx, timeout, network failure | `yield` (with `retryAfterMs` after a 429) | none. The chunk yields before its first entry. |
| other non-2xx | throws `LeagueRequestRejectedError` | `run-failure` / `trade-request-rejected` |

A gate yield sends no search. So no budget is spent under a league that was not validated, and the dataset keeps its previously published league label.

## Tests

`price-entry.test.ts`, `search-body.test.ts`, `normalise.test.ts` and `league-gate.test.ts` drive these modules against the fake HTTP port and fixed clocks.
