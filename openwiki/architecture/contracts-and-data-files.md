---
type: architecture
title: Contracts, envelopes and the data/ files
description: How @poe/contracts defines every cross-package concept as a Zod schema, how versioned file envelopes are loaded and refused, and which data/ files exist, who writes them and who reads them.
tags: [contracts, zod, schema-versioning, data-files, canonical-key, dataset]
verified:
  - by: openwiki/0.6.0
    at: 2026-09-27T19:26:28.611Z
sources:
  - id: openwiki-source-91bd8d7e3af778926d4b2592
    resource: repo://packages/contracts/src/canonical-key.ts
  - id: openwiki-source-8c407ff378bab85ada4b33bf
    resource: repo://packages/contracts/src/class-name.ts
  - id: openwiki-source-0e80138456af752cd4b08741
    resource: repo://packages/contracts/src/dataset.ts
  - id: openwiki-source-f665aa4d4823a299e4515493
    resource: repo://packages/contracts/src/envelopes.ts
  - id: openwiki-source-a797f51bc94356333a6f31c7
    resource: repo://packages/contracts/src/schema-version.ts
  - id: openwiki-source-2d752de239872597421a156a
    resource: repo://packages/contracts/src/sync-progress.ts
  - id: openwiki-source-fc8e6504126345a5411a22ce
    resource: repo://packages/contracts/src/tracked-entry.ts
  - id: openwiki-source-222fe4a37391165498b5d8d1
    resource: repo://packages/contracts/src/weights-file.ts
  - id: openwiki-source-6463c78c974805557d576aa0
    resource: repo://packages/sync/src/pricing/search-body.ts
  - id: openwiki-source-869e9d6242b1ef866e244695
    resource: repo://packages/sync/src/shell.ts
  - id: openwiki-source-64f4b9e1de8f9b00250b3775
    resource: repo://packages/sync/src/write-artifact.ts
  - id: openwiki-source-f20f60e1ecaf073e364173ca
    resource: repo://packages/web/src/load/artifacts.ts
generated: { by: "claude-code", at: "2026-09-27T19:26:28.611Z" }
---

# Contracts, envelopes and the data/ files

`@poe/contracts` is the leaf package of the workspace. Every concept that crosses a package boundary is declared there exactly once as a Zod schema, with its TypeScript type inferred from the schema. The package also declares the four effect ports and their fakes (see [Package graph, ports and purity boundaries](package-graph-and-ports.md)). This page covers the data side: the entities, the file envelopes, and the committed JSON files under `data/` that tie `sync` and `web` together.

## The data/ files

The repository is its own database. `sync` writes JSON files under `data/`, the files are committed with git, and the static page fetches a subset of them at runtime.

| File | Owner / writer | Readers | Notes |
| --- | --- | --- | --- |
| `data/tracked.json` | The player (with the `tracked-json` skill) | `sync`, `web` (required) | The curated workload. |
| `data/config.json` | The player | `sync`, `web` (required) | Active league and `minChunkSearches` only. |
| `data/currencies.json` | The player | `sync` only | Hand-maintained exchange rates. It is never fetched from an API. |
| `data/dataset.json` | `sync` chunk | `web` (required) | The published snapshot: latest price state per tracked entry. |
| `data/sync-report.json` | `sync` chunk | `web` (tolerable) | Figures for the last chunk and records that persist until the player deletes them. |
| `data/sync-progress.json` | `sync` chunk | `sync` only | Completed keys of the current pass and the `notBefore` penalty. |
| `data/weights.json` | External producer | `sync` (report-only checks), `web` (tolerable) | The full weights contract `6.1.0` is typed here (see below). The app never writes it. |
| `data/recipes.json` | The player | `web` (tolerable) | Craft recipes. Ids must be unique. |
| `data/catalogue/{items,stats,filters,static}.json` | `pnpm catalogue:refresh` | `sync`, `web` (`stats.json` only) | Captured trade-API catalogue payloads. |

The seven files `web` fetches (AD-24), and whether each is required or tolerable, are covered in [Web page: artifact load and ranked list](../web/page-load-and-ranked-list.md). How the chunk writes the `sync` files is in [The sync chunk runner](../sync/chunk-runner.md).

## Versioned envelopes

Every file has an envelope schema in `packages/contracts/src/envelopes.ts`. Each envelope carries `schemaVersion`, a three-part semver string. Entity schemas inside a file do not repeat the field.

`parseEnvelope(schema, data, expected)` is the one load path for every versioned file:

1. It probes only `schemaVersion` first.
2. `checkSchemaVersion` compares **the major only**. A different major gives `unknown-major`. A string that is not semver gives `malformed-version`. Both refusals name the expected version and the found version.
3. Only after the version is accepted does it parse the full body. A body failure gives `invalid` with the Zod issues.

The version is checked before the body, so a file from a newer major is refused as one version mismatch. It is not reported as many shape errors. The result is a typed value (`ok: true | false`), and the function does not throw for an expected condition.

Most files use `SUPPORTED_SCHEMA_VERSION` (`1.0.0`). Three contracts have their own version constants: `SYNC_REPORT_SCHEMA_VERSION` and `SYNC_PROGRESS_SCHEMA_VERSION` (both `1.1.0`; 1.1.0 of progress added the optional `notBefore`), and `WEIGHTS_SCHEMA_VERSION` (`6.1.0`, in `weights-file.ts`). The page imports the weights constant from `contracts` rather than declaring its own, so the reader and the schema cannot drift.

### File-level rules

- `TrackedFileSchema` refuses a repeated canonical key. Each repeat is one issue at its own index and names the first occurrence.
- `DatasetFileSchema` refuses a repeated `entryKey`, compared as an exact string, with the same issue shape.
- `RecipesFileSchema` refuses a repeated recipe `id`.
- `ConfigFileSchema` is a `strictObject` with only `schemaVersion`, `league` and `minChunkSearches` (an integer ≥ 1). It is not a general settings file.
- The four catalogue files share `catalogueFileEnvelope`: the trade API's `result` payload with `schemaVersion` beside it, so a refresh diff stays a diff of the API's own response.

## The weights file

`packages/contracts/src/weights-file.ts` is the *Validation* section of `WEIGHTS-FILE-SCHEMA.md` in code. It replaced the earlier header-only `WeightsFileEnvelopeSchema` (Story 3.1). Every object is a `looseObject`, so a later additive `6.x` file still loads; only the major is compared.

Shape: `{schemaVersion, gamePatch, producer: {id, version?, generatedAt, sourceUrl?}, bases}`. `bases` maps `categoryId` → `className` → `{prefix, suffix}` pools. Each pool declares `poolCoverage` (`complete` or `partial`, no default) and a list of entries. An entry is one poe2db tier of one modifier: `sourceModifierId`, `modGroup`, `itemLevelMin`, optional `tierLabel`, `weight` (≥ 0), `weightSource` (`published`, `absent` or `not-in-game`) and nested `lines` of `{statId | null, ranges}`. The lines stay nested because a hybrid tier's co-occurrence cannot be rebuilt once flattened.

Hard errors enforced by refinements, each with a message that names the rule:

- a `not-in-game` entry must have weight 0;
- a `statId` appears once among one entry's lines, and a line has at most two `[min, max]` pairs with `min ≤ max`;
- a `sourceModifierId` appears once per slot pool;
- within one `categoryId`, every `className` matches one of two grammars. A defence-suffixed key is `<family>_<letters>` with a non-empty family. Defence-suffixed classes carry distinct letter sets, and defence-suffixed and plain classes never share a `categoryId`.

The defence-suffix grammar lives once in `class-name.ts`: `defenceLettersOf` takes the maximal trailing run of distinct `str` / `dex` / `int` tokens, with at least one token before it, and `DEFENCE_OF_LETTER` maps them to `ar` / `ev` / `es`. Both the weights schema and `sync`'s search-body discriminator read it from there (see [Pricing step and league gate](../sync/pricing-step-and-league-gate.md)).

## Tracked entries

A tracked entry (`tracked-entry.ts`) is one of exactly two kinds. The entry names its kind. The kind is never inferred from missing fields.

- **`crafted`**: `categoryId`, `className`, `itemLevelMin`, optional `prefix` and `suffix` modifier refs. At least one affix is required.
- **`raw`**: `baseTypeId` and `itemLevelMin`, with no affix members at all. The arms are `strictObject`s, so an affix on a raw entry is a parse error.

Each entry has a curation `status`: `active` (rotates), `pinned` (refreshed every chunk, subject to a cap) or `pruned` (a tombstone). A `pruned` entry must carry a free-form `prunedReason`, and a non-pruned entry must not. Only `TrackedEntrySchema` is exported. The two arm schemas are internal because they do not carry these cross-field rules.

A modifier ref is either `banded` (`statId`, `valueMin`, `valueMax`, display-only `acceptedTier`) or `valueless` (`statId` only).

## The canonical key

`canonical-key.ts` defines the one serialisation that keys entries across the system:

```
crafted: ["crafted", categoryId, className, itemLevelMin, prefixAffix, suffixAffix]
raw:     ["raw", baseTypeId, itemLevelMin]
```

An affix encodes as `[statId, valueMin, valueMax]`, as `[statId, null, null]` for a valueless ref, or as the literal `null` when absent. So an absent affix and a valueless affix can never collide. `canonicalKey` is the `JSON.stringify` of these elements. It is the `entryKey` of every dataset entry and the key recorded in `sync-progress.json`.

Keys compare with `compareByCodeUnit`, which compares Unicode code points, the same order as UTF-8 bytes. It never uses locale collation or JavaScript's UTF-16 `<`. The leading kind tag makes the order total over a mixed list: every `crafted` key sorts before every `raw` key. The rotation, the ranking tie-breaks and the published dataset order all use this comparator.

## Dataset entries and price states

A dataset entry (`dataset.ts`) holds `entryKey`, a `price` state, and three optional request fields.

`price` is a discriminated union of four states. A missing price is never represented as zero, null or a missing key:

| State | Payload |
| --- | --- |
| `priced` | `observation` (a `PriceObservation`, including its league) |
| `no-listings` | none |
| `not-yet-synced` | `reason`: `never-synced`, `league-mismatch` or `no-exchange-rate` |
| `unresolvable` | none |

The request fields sit beside the state:

- `lastAttemptedAt` is present wherever `sync` issued a request for the entry. Offline work never sets it.
- `lastSearchId` is the trade site's search id, stored verbatim.
- `lastSearchLeague` is the league that search ran in. The page shows the outbound trade link only when this equals the active league.

A request with no answer (429, 5xx, timeout) stamps `lastAttemptedAt` and leaves both search fields unchanged. So `lastSearchId` can be older than `lastAttemptedAt`. A never-synced entry carries none of the three fields, and no component may insert a placeholder. `core` never reads the search fields.

The dataset file also carries the top-level `league`, `generatedAt`, and `currencyRates`. The rate set travels inside the dataset so that the page's fetch set stays at seven files.

## Sync progress and the sync report

`sync-progress.ts` defines two shapes:

- `SyncLockSchema`: `{pid, startedAt}`, the contents of the chunk lock file.
- `SyncProgressSchema`: `completed`, the unique canonical keys the current pass has finished, and optional `notBefore`, the cross-run rate-limit penalty. A run that starts before `notBefore` defers.

`sync-run-report.ts` defines the Sync Report. It has **figures**, which describe the last chunk and are replaced each run, including requests counted per source (`tracked-list`, `league-validation`). It also has **records**, a discriminated union by `kind`: `stale-lock-broken`, `pinned-starvation`, `unresolvable`, `weights-absent`, `uncatalogued-weights-id`, `cross-file-gate-failure`, `run-failure` (reason `trade-request-rejected` or `unrecoverable-error`) and `league-mismatch`. `sameRecord` defines when a new record replaces an existing one.

## Writing artifacts

`sync` writes every chunk artifact through `writeArtifact` (`packages/sync/src/write-artifact.ts`). It parses the value with its schema and serialises the **parsed** value, so the keys follow the schema's declared order. The bytes come from `serialiseJsonArtifact`: two-space JSON, LF and one trailing newline. A value that fails its schema throws `InvalidArtifactError` with the issues, and nothing is written. The result is byte-stable: a second run over unchanged data leaves no git diff.
