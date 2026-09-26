---
title: 'Epic 1 retro item 5: reject duplicate canonical keys in tracked.json'
type: 'bugfix'
created: '2026-09-26'
status: 'done'
baseline_revision: 'e1084a38c466ba32f47c4a61384f7375da379143'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/epic-1-retro-2026-09-26.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** `TrackedFileSchema` (`packages/contracts/src/envelopes.ts:29`) accepts two entries with the same canonical key. `chunkOrder` places both, `runChunk` visits both (2 searches and 2 fetches on one key), `completed` would list the key twice, and only `buildDatasetFile` dedups, last wins (retro finding L-A1, action item 5). Identical keys are not FR-16 overlap, which Epic 3 owns; nobody owned the equal-key case.

**Approach:** Add one file-level refinement to `TrackedFileSchema`: every entry's `canonicalKey` (§4.1) must be unique within `entries`. Each repeat occurrence produces one issue at path `['entries', i]` whose message names the canonical key and the index of its first occurrence. Every loader that uses `parseEnvelope(TrackedFileSchema, …)` then refuses the file with no further change.

## Boundaries & Constraints

**Always:** Uniqueness is on `canonicalKey(entry)` and nothing else, so `status` (`active`/`pinned`/`pruned`), `acceptedTier` and `prunedReason` never make two equal keys distinct. The refusal goes through the existing `parseEnvelope` → `reason: 'invalid'` path, so `runChunk` throws before any request and still releases the lock. `TrackedFileSchema.shape` stays readable (the envelope test reads it).

**Never:** Do not implement FR-16 overlap or any cross-file check (Epic 3, `core`). Do not add a rule to `TrackedEntrySchema` (it sees one entry). Do not dedup silently, and do not change `chunkOrder`, `runChunk` or `buildDatasetFile`. Do not bump the `tracked.json` schema version: the rule narrows what a valid file already meant. Do not edit PRD, spine or IN.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Distinct keys | Two raw entries, same base, different `itemLevelMin` | Accepted | No error expected |
| Exact twin | Same raw entry at indices 0 and 1 | Refused, `reason: 'invalid'` | One issue, path `entries.1`, message contains the canonical key and `entries.0` |
| Status twin | Same key, one `active`, one `pinned` | Refused | One issue at the second index |
| Pruned twin | Same key, one `active`, one `pruned` with `prunedReason` | Refused | One issue at the second index |
| Tier-only difference | Same crafted key, different `acceptedTier` | Refused | `acceptedTier` is not part of the key (AD-5) |
| Triplet | One key at indices 0, 2 and 3 | Refused | Two issues, `entries.2` and `entries.3`, each naming `entries.0` |
| Empty list | `entries: []` | Accepted | No error expected |

</intent-contract>

## Code Map

- `packages/contracts/src/envelopes.ts:28-32` -- `TrackedFileSchema`, a `z.strictObject`. Add the refinement here and extend its doc comment. Zod is 4.6.5: `.superRefine` keeps a `ZodObject`, so `.shape` survives. Nothing calls `.extend` on this schema (checked).
- `packages/contracts/src/canonical-key.ts:66` -- `canonicalKey(entry)`, the only key serialisation. It imports only types from `tracked-entry.ts`, so importing it into `envelopes.ts` creates no cycle.
- `packages/contracts/src/sync-progress.ts:30-35` -- the precedent: `completed` refuses repeated keys with `.refine`. Match its tone; use `superRefine` here because the issue needs a per-index path.
- `packages/contracts/src/tracked-entry.ts:60-88` -- `TrackedEntrySchema.superRefine`, the `ctx.addIssue({ code: 'custom', path, message })` idiom to copy. Its doc comment ("two shape rules … and no others") is per entry and stays true.
- `packages/contracts/src/envelopes.test.ts:19-29` -- `trackedFile` fixture and the `TrackedFileSchema`/`parseEnvelope` tests; add the matrix cases here.
- `packages/sync/src/chunk/run-chunk.ts:612-615` -- `loadEnvelope(fs, TRACKED_PATH, parseEnvelope(TrackedFileSchema, …))`; `describeRefusal` (`:333-336`) renders `tracked.json: invalid: entries.1: <message>`. No change.
- `packages/sync/src/chunk/run-chunk.test.ts:808-817` -- "an invalid tracked list throws and still releases the lock"; the model for the surface test. `harness`, `raw`, `key`, `run`, `scriptedStep` are the helpers there.
- `packages/sync/src/fixtures-record.ts:359`, `packages/sync/src/pricing/price-entry.fixtures.test.ts:50` -- other `TrackedFileSchema` readers; they inherit the rule. Committed `data/tracked.json` (6 entries) must still parse.
- `docs/stories/sprint-status.yaml:102-107` -- item 5 entry, `status: open`.

## Tasks & Acceptance

**Execution:**
- `packages/contracts/src/envelopes.ts` -- add the `superRefine` on `TrackedFileSchema` that tracks the first index per `canonicalKey` and adds one custom issue per repeat at `['entries', i]`; the message names the key and `entries.<first>` and says a key may appear once (L-A1). Update the doc comment to state the rule and that FR-16 overlap stays Epic 3's -- the fix.
- `packages/contracts/src/envelopes.test.ts` -- one test per I/O matrix row, asserting `success`, issue paths and message content -- pins the rule.
- `packages/sync/src/chunk/run-chunk.test.ts` -- add a test beside `:808`: a tracked list with an exact twin makes `run` reject with a message matching `tracked.json` and the twin's key, the step is never called, neither dataset nor progress file exists afterwards, and the lock is released -- surface proof.
- `docs/stories/sprint-status.yaml` -- set item 5 `status: done` -- closes the action item.

**Acceptance Criteria:**
- Given a `data/tracked.json` holding two entries with one canonical key, when a sync chunk runs, then it throws naming `tracked.json` and that key, never calls the step, writes neither `data/dataset.json` nor `data/sync-progress.json`, and releases the lock. (The existing catch path still writes a report with a run-failure record; that is unchanged behavior.)
- Given the committed `data/tracked.json`, when `pnpm test` runs, then every reader of it still parses it.
- Given the change, when `pnpm check` and `pnpm test` run, then both pass.

## Spec Change Log

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 14 findings — high 0, medium 0, low 8, false 6, maybe-false 0
- findings:
  - `[low]` `[reject]` Blind Hunter: the refinement stays silent while any entry is otherwise invalid (Zod 4 skips object refinements after shape issues) — true, but a curator then meets the twin on the next run; two-stage validation is ordinary and a `when` override adds complexity for a rare case.
  - `[low]` `[reject]` Blind Hunter: a pruned twin's message omits the tombstone's reason, and active+pruned never double-visited — the intent is canonical-key uniqueness, and the dataset and progress are keyed by it, so an entry both pruned and active is contradictory; richer message wording is cosmetic.
  - `[false]` `[reject]` Blind Hunter: sprint status closed before review ended — the spec goes to `done` in the same commit as the sprint entry.
  - `[low]` `[patch]` Blind Hunter: the run-chunk test does not check the run-failure record the AC names — patched: the test now parses `REPORT_PATH` and asserts one `run-failure` record naming `tracked.json` and `key(A)`.
  - `[false]` `[reject]` Blind Hunter: committed `data/tracked.json` has no direct test — `price-entry.fixtures.test.ts:50` calls `TrackedFileSchema.parse` on it directly.
  - `[low]` `[reject]` Blind Hunter: the matrix lacks near-miss distinct-key cases (crafted vs raw, prefix vs suffix, banded vs valueless) — key distinctions are `canonicalKey`'s contract and are pinned in `canonical-key.test.ts`; this rule only compares its output.
  - `[low]` `[reject]` Blind Hunter: message assertions do not pin the fixed wording — cosmetic; key and first index, the actionable parts, are asserted.
  - `[false]` `[reject]` Blind Hunter: import style mixes `.ts` and extensionless — each file keeps its own existing convention (`envelopes.test.ts` is extensionless throughout).
  - `[low]` `[patch]` Blind Hunter: the doc comment restated §4.1's excluded fields — patched: the comment now cites `canonicalKey` (§4.1) instead of listing fields.
  - `[low]` `[reject]` Blind Hunter: Epic 3's overlap check may report twins a second time — speculative about unbuilt code; Epic 3 builds on this schema and will see the rule.
  - `[false]` `[reject]` Blind Hunter: `packages/contracts/dist/envelopes.d.ts` is stale — `dist/` is gitignored (`.gitignore:8`) build output.
  - `[low]` `[reject]` Intent audit: player-facing surfaces (CLI exit code, dry-run, fixtures-record) have no new test — they all load through the same `parseEnvelope(TrackedFileSchema)`; `runChunk` is the outermost tested surface and is covered.
  - `[false]` `[reject]` Intent audit: the predicate is not recorded in IN — IN §2.1 already owns it: equal keys overlap (`overlap(x, x)`) and are rejected at load naming both; this is an early subset of that rule.
  - `[false]` `[reject]` Edge Case Hunter: NFC/NFD or whitespace variants of an id evade the rule — ids are matched verbatim against the catalogue, so a variant is a different id that the catalogue check marks `unresolvable`; no second search for one base.

## Design Notes

Identical keys are the degenerate case of FR-16 overlap (IN §2.1: equal bands intersect), so Epic 3's overlap check will also reject them. This rule is still worth having in `contracts`: it needs only one file, it protects `sync` now, and the dataset, progress file and rotation are all keyed by canonical key, so a repeat is never meaningful. The message shape follows IN §2.1's payload rule in spirit: it names the key and where its partner is, so the curator does not search the list.

## Verification

**Commands:**
- `pnpm check` -- expected: clean
- `pnpm test` -- expected: all pass, including the new contracts and run-chunk tests

## Auto Run Result

**Summary:** `TrackedFileSchema` now refuses a `tracked.json` in which two entries share a canonical key. Each repeat is one `invalid` issue at `entries.<i>` naming the key and its first index. `runChunk` and every other loader inherit the rule through `parseEnvelope`: a twin throws before any request, writes no dataset or progress, records a run-failure, and releases the lock.

**Files changed:**
- `packages/contracts/src/envelopes.ts` -- the `superRefine` uniqueness rule and its doc comment.
- `packages/contracts/src/envelopes.test.ts` -- one test per I/O matrix row.
- `packages/sync/src/chunk/run-chunk.test.ts` -- surface test: a twin aborts the chunk, no step, no dataset/progress, run-failure recorded, lock released.
- `docs/stories/sprint-status.yaml` -- retro item 5 set to `done`.

**Review:** 2 patches applied (both low), 0 deferred, 12 rejected with reasons in the triage log; the verification-gap and deferred-ledger layers reported zero findings. Follow-up review recommended: false (patched: high 0, medium 0, low 2).

**Verification:** `pnpm check` clean; `pnpm test` 58 files, 696 tests passed after the patches; every matrix row has a passing test.

**Residual risk:** a hand-edited `tracked.json` that already holds a twin now stops sync at load instead of searching the key twice. That is the intended behavior; the committed file has none.
