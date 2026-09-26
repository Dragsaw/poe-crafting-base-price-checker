---
title: 'Story 1.8: The published Dataset, written to a git-tracked working tree'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_revision: '01c1e26205e578070af5642ef7120911749cd496'
route: 'dispatch'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/epic-1-context.md'
deferred:
  - summary: >-
      The published dataset (and every artifact) is written non-atomically, so a crash mid-write leaves a truncated data/dataset.json.
    evidence: |-
      writeArtifact calls FilesystemPort.writeTextFile, and the real port (packages/sync/src/shell.ts:78) is a plain mkdir + writeFile with no temp-file-and-rename; the port promises atomicity only for createExclusive. A truncated file makes the next chunk's load refuse it loudly, so rotation stops until the file is restored (it is git-tracked, so `git checkout -- data/dataset.json` recovers it). Pre-existing port behaviour, not introduced by 1.8; it matters once the live command (1.9/1.11) writes to disk. Fix: write `${path}.tmp` then rename in the real port.
    location: >-
      packages/sync/src/shell.ts:78
    severity: medium
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `runChunk` reads `data/dataset.json` but nothing writes it. The pricing step's entries stay on the outcome, so a chunk publishes nothing.

**Approach:** Under the lock, and beside the progress write, `runChunk` merges the step entries into the previous dataset. It validates the result against `DatasetFileSchema` and writes `data/dataset.json` by explicit path, with the league and the output rate set passed in (AD-3, AD-19, AD-20). One validate-then-serialise helper writes every artifact that `sync` writes.

**Decisions (2026-09-26):**
- **Live `pnpm sync`: deferred** to 1.9/1.11. This story ships the writer, and `sync:dry` prints the dataset. No real `data/dataset.json` is written yet.
- **Step throw: write nothing.** The current behaviour stays: the entries completed before the throw are re-searched next run. Story 1.9 owns the abort path with its 4xx record.
- **Spec length kept** at about 1,900 tokens.

## Boundaries & Constraints

**Always:**
- The dataset has one entry per tracked entry, `pruned` included, sorted by `compareCanonicalKeys`. The value of an entry is the step entry, or else the previous dataset entry, or else `not-yet-synced`/`never-synced` with no timestamps (AD-9: absence is never a missing key). A key that is not in `tracked.json` is dropped.
- There is no league filter on write. Stale-league observations are carried over unchanged (AD-19).
- `league` is the active league. `generatedAt` is `clock.now()`. `currencyRates` is `outputRates(rates)`, passed in by the caller. `chunk/` still never names `config.json` or `currencies.json`.
- `completed`, `bounded` and `yielded` write the dataset. `busy` and `dispossessed` write nothing.
- Every artifact write, `sync-progress.json` included, parses with its schema first and serialises the parsed value. The keys then follow the schema's declared order, and the output is UTF-8 without BOM, LF, two-space JSON and one trailing newline. An invalid artifact throws a typed `InvalidArtifactError {path, issues}`, and nothing is written.
- Effects go only through `FilesystemPort`/`ClockPort`. No git write of any kind.

**Never:**
- No `git add`/`commit`/`push`/`pull`, and no `child_process`. No report write (1.9). No league gate (1.11). No catalogue check (1.10). No history, rank or score in the file (AD-4, AD-19).
- No live command. No write on a step throw. No hand-written `data/dataset.json`. No write under `data/` from a test or from `sync:dry`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior |
|---|---|---|
| First run | no dataset file, 5 tracked, 2 visited | 5 entries: 2 step entries, 3 `never-synced` |
| Carry-over | previous file has entry X, X not visited | X is written byte-identical |
| Yielded entry | step yields with `lastAttemptedAt` stamped | the stamped entry replaces the previous one |
| Removed from tracked | previous file has key K, K not tracked | K is absent |
| Pruned | a pruned tracked entry | its previous entry, or `never-synced` |
| League change | the previous observation is from league A, active is B | carried over unchanged, top-level `league` B |
| Rates | currencies file | divine `1`, 4dp, `league`/`asOf` verbatim |
| Busy / dispossessed | lock not held | no dataset write |
| Invalid artifact | a value that fails its schema | `InvalidArtifactError`, file untouched, lock released |
| Re-serialise | the file written twice from the same inputs | byte-identical |

</frozen-after-approval>

## Code Map

- `packages/sync/src/chunk/run-chunk.ts`:
  - `runChunk` (L192–322): the dataset write goes after `holdsLock` and beside the progress write at L313. It reuses the loaded `tracked` entries and `dataset` (L221).
  - `ChunkPorts`: add a required `publication: {league, currencyRates}`.
  - `DATASET_PATH`: update the doc comment.
  - The module doc (L23) says 1.8 adds to the outcome and does not rewrite the lock path. Keep the `finally` release.
- `packages/sync/src/shell.ts` `serialiseJsonArtifact` (L36): reuse it inside the new helper. Callers in `catalogue-refresh.ts` and `fixtures-record.ts` stay as they are. Fixtures are not artifacts.
- `packages/contracts/src/envelopes.ts` `DatasetFileSchema` (L57): the key order is `schemaVersion, league, generatedAt, entries, currencyRates`. `SUPPORTED_SCHEMA_VERSION`. No contracts change.
- `packages/sync/src/pricing/normalise.ts` `outputRates` (L87): the rate set that callers pass in.
- `packages/sync/src/dry-run.ts` `dryRun` (L84): pass `publication`. Read the dataset back from the fake. Add `dataset: DatasetFile | null` to `DryRunReport`, printed as written. Remove the "parse would reorder" workaround for progress.
- `packages/sync/src/index.ts`: update the stale "1.7 and 1.8 wire the live command" doc. Export the helper and the error.
- Guards that stay green: the `run-chunk.test.ts` source scan of `chunk/`, `depcruise.rules.mjs`, and `test/no-hardcoded-rate-limits.test.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/sync/src/write-artifact.ts` + test: `writeArtifact(fs, path, schema, value)`, and `InvalidArtifactError`. Cover the key order, LF, no BOM, the trailing newline and the refusal.
- [x] `packages/sync/src/chunk/publish-dataset.ts` + test: a pure `buildDatasetFile({tracked, previous, stepEntries, league, currencyRates, now})` covering the matrix rows.
- [x] `packages/sync/src/chunk/run-chunk.ts` + test: `publication` on the ports; the dataset and progress written through `writeArtifact`; no write on busy or dispossessed.
- [x] `packages/sync/src/dry-run.ts` + test: `dataset` in the report; two runs print identical stdout; nothing on disk.
- [x] `packages/sync/src/no-git-write.test.ts`: a source scan of `packages/sync/src` for `child_process` and for `git` subcommands.
- [x] `packages/sync/src/index.ts`: the exports and the doc.

**Acceptance Criteria:**
- Given `pnpm check`, when it runs, then it passes.
- Given `pnpm test`, when it runs, then every suite passes, no request escapes, and nothing is written under `data/`.
- Given `pnpm sync:dry`, when it runs, then its stdout carries a `dataset` that `DatasetFileSchema` accepts, with every tracked entry present.

## Implementation Notes

## Spec Change Log

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 33 findings — high 0, medium 2, low 21, false 10, maybe-false 0
- findings:
  - `[false]` `[reject]` (intent) Title promises a working-tree write; every test runs on the fake FS — the intent's 2026-09-26 decision defers the live write and forbids writes under `data/` from tests and `sync:dry`.
  - `[false]` `[reject]` (intent) Rates row verified at `dryRun`, not at `runChunk` — the intent says `currencyRates` is `outputRates(rates)` passed in by the caller; `dryRun` is that caller, and `outputRates`' divine-1/4dp rules are tested in `pricing/normalise.test.ts`.
  - `[low]` `[reject]` (intent) The lock file is not written through `writeArtifact` — the lock is a coordination file written by atomic `createExclusive`, not a published artifact; routing it through the helper changes lock semantics.
  - `[low]` `[reject]` (intent) Carry-over byte identity holds only because the previous file is already in schema order — every previous file is written by `writeArtifact` (hand-written `dataset.json` is forbidden by the intent), so it is always canonical; raw-byte preservation would add a second serialisation path.
  - `[low]` `[reject]` (intent) `sync-progress.json` now puts `schemaVersion` last — mandated by "keys follow the schema's declared order"; the committed catalogue files already put `schemaVersion` last, so no schemaVersion-first convention existed; no progress file is committed and no reader depends on key order.
  - `[false]` `[reject]` (intent) `publication` is a new required `ChunkPorts` field — this is what the Code Map specifies.
  - `[low]` `[patch]` (verification-gap) "Later step entry wins" untested; duplicate tracked keys are reachable (no uniqueness refine on tracked) — added a `publish-dataset.test.ts` case with two step entries for one key asserting the later one is published.
  - `[low]` `[reject]` (edge) `tracked.json` absent/empty wipes the dataset to zero entries — false in substance: the intent mandates dropping every key not in `tracked.json`; the previous dataset is git-tracked. Logged low only because the outcome is real; rejecting as intended behaviour.
  - `[low]` `[reject]` (edge) Lock takeover between the `holdsLock` check and the two writes — a takeover needs a lock older than `STALE_LOCK_AFTER_MS` (6 h) and the window is milliseconds; same single-check pattern as the pre-existing progress write; a fix adds guards.
  - `[medium]` `[defer]` (edge) Non-atomic `writeFile` can leave a truncated `dataset.json` — pre-existing real-port behaviour (`shell.ts:78`); recorded in `deferred`.
  - `[low]` `[reject]` (edge) Dataset written, then progress write throws — the progress value is built from validated keys, so only I/O can fail; the outcome is the spec's step-throw behaviour (re-search next run).
  - `[low]` `[reject]` (edge) Previous dataset with duplicate entryKeys silently collapses — only a hand-edited file can hold duplicates (the writer deduplicates by key); a fix adds a guard.
  - `[low]` `[reject]` (edge) A step entry whose key is not tracked is silently dropped — the step receives tracked entries and keys them with the same `canonicalKey`; a fix adds a branch.
  - `[false]` `[reject]` (edge) Invalid `publication.league` burns the chunk — the league comes from `loadActiveLeague`, which parses `ConfigFileSchema`, before any step runs.
  - `[low]` `[reject]` (edge) Git scan misses `git -C dir commit` — regex growth for an unlikely source form; the `child_process` ban already blocks any spawn.
  - `[low]` `[patch]` (edge) Git scan misses mutating subcommands (branch, update-ref, config, worktree, notes, commit-tree, write-tree, update-index, gc) — alternation extended, with self-check cases for `update-ref` and `worktree`.
  - `[low]` `[patch]` (edge) Git scan reads only `*.ts` — `sources()` now matches `/\.[cm]?[jt]sx?$/` and skips `.test.` files.
  - `[low]` `[reject]` (edge) Git scan misses `.git/` path writes and `worker_threads` — speculative spawn paths; the fix adds new patterns rather than correcting one.
  - `[low]` `[reject]` (edge) Progress `schemaVersion` last (deletion) — same reasoning as the intent row above: mandated by declared order; catalogue files already put it last.
  - `[low]` `[reject]` (edge) Lock not validated through the helper (claim) — same as the intent lock row.
  - `[low]` `[reject]` (blind) Progress key order changed on disk — same group as the progress rows above.
  - `[medium]` `[defer]` (blind) Dataset write is not atomic — same group as the edge-case deferral.
  - `[false]` `[reject]` (blind) Dataset-before-progress ordering is never tested — the invalid-artifact test asserts no progress file when the dataset write is refused, which fails if the order is reversed.
  - `[low]` `[reject]` (blind) One ownership check before two writes — same group as the edge-case lock-race row.
  - `[false]` `[reject]` (blind) One bad step entry throws away the chunk — the intent mandates `InvalidArtifactError` with nothing written; `issues` carry the offending `entries.N` path.
  - `[low]` `[patch]` (blind) "Later step entry wins" untested — same group as the verification-gap row; fixed by the same test.
  - `[low]` `[patch]` (blind) Determinism test only repeats one object — replaced with forward/reversed/rotated input orderings asserted equal and sorted.
  - `[false]` `[reject]` (blind) Rates row half tested — divine forced to 1 is covered by `pricing/normalise.test.ts`; `runChunk` trusting `publication` is the intent's "passed in by the caller".
  - `[false]` `[reject]` (blind) `datasetOf` reuses input rates as expected output — a fixture change breaks the test loudly, never silently; no defect.
  - `[low]` `[reject]` (blind) Git scan gaps (non-.ts files, other spawn libraries, prose false positives) — the file-extension part is patched via the edge-case row; the rest are speculative, and a prose false positive fails loudly.
  - `[false]` `[reject]` (blind) `publication` is data, not a port — the Code Map specifies it on `ChunkPorts`.
  - `[low]` `[patch]` (blind) Formatter/lint leftovers — wrapped the long `runChunk({...})` calls, moved the `outputRates` import into order, renamed `written` → `dataset` in `dryRun`, replaced the literal BOM with `'﻿'`.
  - `[false]` `[reject]` (blind) Story bookkeeping missing — the triage log, Auto Run Result and status are written at finalisation of this run.

## Design Notes

"Stable key order" is taken to mean the schema's declared order. It comes from serialising Zod's parsed output, so a caller cannot change the order by the way it builds the object. The entries are sorted by canonical key, which is the only ordering the spine defines. That gives a data diff one hunk per changed entry. `generatedAt` changes on every run, and that one line is accepted as the chunk's signature.

## Verification

**Commands:**
- `pnpm check` -- expected: pass
- `pnpm test` -- expected: all green
- `pnpm sync:dry` -- expected: exit 0, and byte-identical stdout on two runs
- `git status -- data/` -- expected: clean

## Auto Run Result

Status: done

**Summary:** Under the lock, a `completed`, `bounded` or `yielded` chunk now builds the published Dataset. The build is pure: one entry per tracked key, `pruned` included, sorted by canonical key, taking the step entry, else the previous entry, else `never-synced`. Untracked keys are dropped and no league filter is applied. The chunk writes the dataset to `data/dataset.json` before `sync-progress.json`. Both writes go through one validate-then-serialise helper, `writeArtifact`, which throws `InvalidArtifactError {path, issues}` and writes nothing when validation fails. `busy`, `dispossessed` and a step throw write nothing. The caller passes in the league and the output rate set as `ChunkPorts.publication`. `pnpm sync:dry` now prints the dataset. No live command and no git write were added.

**Files changed:**
- `packages/sync/src/write-artifact.ts` (+ test): `writeArtifact`, `InvalidArtifactError` and `ArtifactSchema`. These parse the value and then serialise the parsed value: schema key order, LF, no BOM, one trailing newline.
- `packages/sync/src/chunk/publish-dataset.ts` (+ test): the pure `buildDatasetFile`, with a test for each row of the matrix, plus tests that a later step entry for the same key wins and that input order does not change the output.
- `packages/sync/src/chunk/run-chunk.ts` (+ test): adds `publication` to the ports, and writes the dataset then progress through `writeArtifact`. The test covers the published-dataset matrix, and the `chunk/` source scan now also forbids `currencies.json`.
- `packages/sync/src/dry-run.ts` (+ test): passes `publication` (active league and `outputRates(rates)`), adds `dataset` to the report, and removes the progress workaround that parsing reordered.
- `packages/sync/src/no-git-write.test.ts`: a source scan that forbids `child_process`, git libraries and mutating git subcommands.
- `packages/sync/src/index.ts`: new exports, and the stale docs about the live command are rewritten.

**Review findings:**
- 33 findings: 0 high, 2 medium, 21 low, 10 false, 0 maybe-false.
- 7 low patches applied:
  - a test that a later step entry wins
  - a real test that input order does not change the output
  - the git scan covers more subcommands
  - the git scan covers more file extensions
  - lint and format leftovers fixed
  - a BOM check in a test now uses the `'\uFEFF'` escape
  - the same later-entry-wins gap, reported by two layers
- 1 group deferred (medium): the dataset write is not atomic (`shell.ts:78`). It is in frontmatter `deferred`.
- Every rejected finding and its reason is in the Review Triage Log above.

**Follow-up review recommended:** false. The pass patched 0 high and 0 medium findings.

**Verification:** Commands were run after the patches.
- `pnpm check` passes: tsc -b, eslint with 0 warnings, and depcruise with no violations.
- `pnpm test` passes: 46 files, 435 tests, and no request escaped.
- `pnpm sync:dry` exited 0 on two runs, and the two stdouts were byte-identical. The printed `dataset` holds league "Forbidden Rites" and 6 of 6 tracked entries, with keys in schema order.
- `git status -- data/` is clean.
- Every row of the I/O matrix is covered by a test that ran and passed.

**Residual risks:**
- `sync-progress.json` now writes `schemaVersion` last, following the declared order of `SyncProgressSchema.extend`. That matches the committed catalogue files, but not `dataset.json`, which writes it first.
- The first real rewrite of any existing progress file will show as a whole-file diff.
- The live `pnpm sync` path and the real-disk write remain unexercised until Stories 1.9 and 1.11.
- The dataset write is not atomic (deferred above).
