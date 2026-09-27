---
type: workflow
title: Operator commands and curation workflow
description: The human-invoked pnpm commands — sync, sync:dry, fixtures:record, catalogue:refresh, tracked:lookup and tracked:check — what each reads, writes and sends, their exit codes, the POE_SYNC_USER_AGENT requirement, and the lookup-edit-check loop for curating data/tracked.json.
tags: [workflow, cli, sync, dry-run, fixtures, catalogue, curation]
sources:
  - id: openwiki-source-92f333db8794b007cec6ef03
    resource: repo://.claude/skills/tracked-json/scripts/lookup.ts
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-180234a48180085440ad4117
    resource: repo://packages/sync/src/catalogue-refresh.ts
  - id: openwiki-source-5c4f3b9059dbca2e99ce1429
    resource: repo://packages/sync/src/curation/check.ts
  - id: openwiki-source-576ebaae523f4c6763eede84
    resource: repo://packages/sync/src/dry-run.ts
  - id: openwiki-source-54de0b684b6ea392e59b40f0
    resource: repo://packages/sync/src/fixtures-record.ts
  - id: openwiki-source-4c0582c853fafa6e932bf71d
    resource: repo://packages/sync/src/sync.ts
generated: { by: "claude-code", at: "2026-09-27T13:11:02.100Z" }
verified:
  - by: openwiki/0.6.0
    at: 2026-09-27T13:11:02.100Z
---

# Operator commands and curation workflow

The product runs as a set of `pnpm` commands run from the repository root, plus the static page. None of the commands runs unattended by default, and no test runs a live command. Each command's module has an entry guard, so importing it runs nothing (see [Test strategy and network guards](../testing/test-strategy-and-guards.md)). The commands run under bare `node` with TypeScript type stripping. The live commands load `.env` with `--env-file-if-exists=.env`.

| Command | Network | Writes | Purpose |
| --- | --- | --- | --- |
| `pnpm sync` | yes | `data/dataset.json`, `data/sync-progress.json`, `data/sync-report.json` | Run one live chunk |
| `pnpm sync:dry` | no | nothing | Predict the next chunk against recorded fixtures |
| `pnpm catalogue:refresh` | 4 GETs | `data/catalogue/*.json` | Refresh the trade catalogue |
| `pnpm fixtures:record` | yes | `fixtures/*.json` | Re-record the API fixtures |
| `pnpm tracked:lookup` | no | nothing | Find ids for tracked entries |
| `pnpm tracked:check` | no | nothing | Validate `data/tracked.json` |

## Configuration

- **`POE_SYNC_USER_AGENT`** (environment or `.env`) holds the whole `User-Agent` value: the tool name and a contact address. `pnpm sync`, `pnpm catalogue:refresh` and `pnpm fixtures:record` refuse and exit 1 before any request when it is unset or blank (see [Governed trade client and rate limits](../sync/trade-client-and-rate-limits.md)).
- **`data/config.json`**: the active `league` and `minChunkSearches`.
- **`data/currencies.json`**: hand-maintained exchange rates per league.
- **`data/tracked.json`**: the curated workload.

## pnpm sync

`packages/sync/src/sync.ts`. `syncCommand` resolves the User-Agent, then composes one chunk with the real filesystem at the repository root, the system clock, the `fetch` port, the real `sleep`, the process pid, and the **read-only git port**. The git port supplies the author date of the last commit to `data/tracked.json`, and falls back to the file modification time. It runs one chunk and prints one line, such as `pnpm sync: bounded, 12 completed` or `pnpm sync: deferred until <iso>`.

- Exit **0** for any outcome: `completed`, `bounded`, `yielded`, `busy`, `deferred` or `dispossessed`.
- Exit **1** for a missing User-Agent or any throw: a load refusal, a league mismatch, a malformed request, or an unexpected response. By the time the throw reaches the command, the chunk has already written its report and released the lock.

To cover the whole tracked list, run `pnpm sync` repeatedly, for example on a schedule. Each run continues the pass. To publish, commit `data/` and push (see [Build, typecheck and deploy](../operations/build-typecheck-and-deploy.md)). Chunk internals are in [The sync chunk runner](../sync/chunk-runner.md).

## pnpm sync:dry

`packages/sync/src/dry-run.ts` runs **the same composition** as a live run, fully in memory:

- It takes read-only snapshots of `data/tracked.json`, `dataset.json`, `config.json`, `currencies.json`, `catalogue/{items,stats,filters}.json`, `weights.json` and `sync-report.json` into a fake filesystem.
- HTTP goes to the offline fixture port. The league gate is served `fixtures/trade-data-leagues.json`. Searches and fetches are served `fixtures/trade-{search,fetch}-<digest>.json` by a digest of the request.
- **Unrecorded entries are skipped.** The recorded searches cover only the fixed fixture workload (`fixtures/tracked.json`), not the whole tracked list. Through the `wrapStep` seam of `composeChunk`, the dry run checks each entry for a recorded search fixture before it prices the entry. An entry with no recorded search is visited with no request, keeps its dataset state, and is listed in `unrecorded`. An entry whose search body cannot be built counts as recorded, so the pricing step handles it as a live run does.
- Any other unrecorded request, such as the fetch leg of a recorded search, **rejects** and names the missing fixture. The run never yields.
- The pid is fixed, there is no pacing wait, and the git port is a fake with no history.
- **Clock**: the latest `lastAttemptedAt` in the dataset snapshot, so the run predicts the live run that follows the last one. If there is none, the fixed `DRY_RUN_INSTANT` is used. `--at <iso>` overrides the clock. The real `notBefore` is reported but never fed into the simulation, so it cannot defer the dry run.

It prints `{outcome, completed, entries, progress, dataset, records, report}`, plus `unrecorded` (the skipped entry keys, in visiting order), `pinnedStarvation` and `notBefore` where relevant, as JSON to stdout, and writes nothing to disk. An absent config, currencies or catalogue file is a typed refusal that names the file, with exit 1.

## pnpm catalogue:refresh

`packages/sync/src/catalogue-refresh.ts`. The four trade data endpoints are the only authority on what a `statId`, `baseTypeId` or `categoryId` means. The command sends **exactly four GETs** through one governed client. They share one lane and are counted as `catalogue-refresh`. It validates each response against its `contracts` schema, stamps `schemaVersion`, and writes `data/catalogue/{items,stats,filters,static}.json`.

- **All-or-nothing across fetch and validation**: nothing is written until all four have arrived and parsed, so a failure in the middle cannot leave a new `stats.json` beside an old `items.json`.
- The write loop is not transactional. A filesystem error part way through reports how many files were written and which path failed.
- It prints the request count on success and on failure. This is the only place that source's spend is visible, because no chunk report includes it.

The output is a git diff to review. A game patch that renames a stat id shows up as one changed line. After a refresh, the next `pnpm sync` catalogue check marks any tracked entry whose ids no longer resolve as `unresolvable`.

## pnpm fixtures:record

`packages/sync/src/fixtures-record.ts` is only for a human to run. It records the leagues endpoint and the four data endpoints, with URLs from `trade/endpoints.ts`. For every non-pruned entry of the fixture workload `fixtures/tracked.json` (`FIXTURE_WORKLOAD_PATH`) it also records the POST search and its fetch. The workload is a small fixed list with one entry per search shape, not `data/tracked.json`, so the player's list can grow with no new recording. An edit to the workload changes the digests and needs a new recording. The search bodies come from `buildSearchBody`, the same builder the pricing step uses, in the configured league. It sends through the same governed client, reads `data/` and the workload without writing them, and writes `fixtures/`. `stripPersonalIdentifiers` replaces account and character names with a redaction marker and keeps the keys, so the shape survives. The rules for fixtures are in `fixtures/README.md`: never hand-written, one fixture per interaction shape, remove bulk but never structure.

## Curating data/tracked.json

The `tracked-json` skill (`.claude/skills/tracked-json/`) runs a **lookup → edit → check** loop:

1. **`pnpm tracked:lookup stat|base|class|mods|tiers <query>`** reads the committed catalogue and `data/weights.json` as plain JSON and prints matches as JSON. The `stat` and `base` queries print at most 50 matches. It derives nothing: `tiers` and `mods` print the weights data unchanged. A lookup error prints `{error}` and exits 1. Zero matches is not an error.
2. **Edit** `data/tracked.json`. Each entry is `crafted` or `raw` with a status of `active`, `pinned` or `pruned` (see [Contracts, envelopes and the data/ files](../architecture/contracts-and-data-files.md)).
3. **`pnpm tracked:check`** (`packages/sync/src/curation/check.ts`) is read-only. It runs the production validators and prints `{ok, checks, issues, pending}`:
   - `schema`: `TrackedFileSchema` through `parseEnvelope`, including canonical-key uniqueness;
   - `pinned-cap`: `checkPinnedCap` against `config.minChunkSearches` (pinned count ≤ 0.5 × minChunkSearches);
   - `catalogue`: resolvability through `checkCatalogue` with an empty dataset.

   It exits 0 only when every check passes. The five cross-file checks against `weights.json` are listed in `pending` and not run yet, so a pass does not confirm band edges or floors.
