---
title: 'Deferred: reject a repeated entryKey in dataset.json'
type: 'bugfix'
created: '2026-09-27'
status: 'done'
baseline_revision: 'f050aa8bd4a027f0ef4e78ebe593390c73c9fd61'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/spec-2-2-the-raw-ranking-branch-league-scoped-and-computed-at-read-time.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `DatasetFileSchema` (`packages/contracts/src/envelopes.ts`) accepts two entries with the same `entryKey`. `rank` (`packages/core/src/rank.ts:112`) builds `new Map(dataset.map(...))`, so the later entry wins and the ranked result depends on dataset order.

**Approach:** `sync` cannot emit a repeat: `buildDatasetFile` (`packages/sync/src/chunk/publish-dataset.ts`) emits one entry per distinct canonical key, from a `Set`. AD-19 already says the file carries "only the latest observation per tracked entry". So the contract should state the invariant. Add the same file-level `superRefine` that `TrackedFileSchema` and `RecipesFileSchema` use: each `entryKey` appears once in `entries`, and each repeat gives one issue at `['entries', i]` that names the key and the index of its first occurrence.

## Boundaries & Constraints

**Always:** The rule compares the `entryKey` string exactly, and nothing else: `price`, timestamps and search fields never make two equal keys distinct. A refusal goes through the existing `parseEnvelope` → `reason: 'invalid'` path, so `web`'s loader refuses `dataset.json` with no loader change. The committed `data/dataset.json` must still load.

**Never:** Do not change `rank`, `buildDatasetFile`, `runChunk` or the web loader. Do not dedupe silently. Do not bump the dataset schema version: the rule narrows what a valid file already meant. Do not edit the PRD, the spine or IMPLEMENTATION-NOTES. Do not add a rule to `DatasetEntrySchema`, because it sees only one entry.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Distinct keys | Two entries, different `entryKey` | Accepted | No error expected |
| Exact twin | The same entry at indices 0 and 1 | Refused | One issue, path `entries.1`, message contains the key and `entries.0` |
| State twin | Same `entryKey`, one `priced`, one `no-listings` | Refused | One issue at index 1 |
| Triplet | One key at indices 0, 2 and 3 | Refused | Two issues, `entries.2` and `entries.3`, each naming `entries.0` |
| Empty list | `entries: []` | Accepted | No error expected |

</intent-contract>

## Code Map

- `packages/contracts/src/envelopes.ts:127-138` -- `DatasetFileSchema`, a `z.strictObject`. Add the `superRefine` here and extend the doc comment. The precedents are `TrackedFileSchema` (`:37-58`) and `RecipesFileSchema` (`:66-86`). Copy the `firstIndexBy…` map idiom and the message shape of the recipes rule. Nothing calls `.shape`/`.extend`/`.pick` on `DatasetFileSchema` (checked).
- `packages/contracts/src/envelopes.test.ts:202-230` -- `describe('the sync-owned envelopes')`, where the dataset parse test sits. Add the matrix tests here. `INITIAL_SCHEMA_VERSION` and `parseEnvelope` are already imported.
- `packages/sync/src/chunk/publish-dataset.ts:34-55` -- read only. It shows that `sync` never emits a repeat (`new Set(tracked.map(canonicalKey))`).
- `packages/core/src/rank.ts:112` -- read only. It is the last-wins lookup that the rule makes order-independent.
- `packages/web/src/load/artifacts.ts:48` -- `ARTIFACTS.dataset` uses `DatasetFileSchema`, which is the outermost surface.
- `packages/web/src/load/load-artifacts.test.ts` -- the loader matrix tests. `serveArtifacts(server, { dataset: { kind: 'json', body } })` and `VALID_BODIES.dataset` from `../test-support/artifact-server` are the helpers. The model is the "refuses a body that fails its schema" test.

## Tasks & Acceptance

**Execution:**
- `packages/contracts/src/envelopes.ts` -- add a `superRefine` on `DatasetFileSchema` that records the first index for each `entryKey` and adds one custom issue for each repeat at `['entries', i]`. The message names the key and `entries.<first>`, and says that a key may appear once in `dataset.json`. Extend the doc comment to state the rule. -- the fix.
- `packages/contracts/src/envelopes.test.ts` -- add one test for each I/O matrix row. Assert `success`, the issue paths and the message content. -- pins the rule.
- `packages/web/src/load/load-artifacts.test.ts` -- add a test where a `dataset.json` with an exact-twin `entryKey` resolves to `{ kind: 'refused', path: 'dataset.json', declared: '1.0.0', expected: '1.0.0' }`. -- surface proof.

**Acceptance Criteria:**
- Given a `dataset.json` whose `entries` repeat an `entryKey`, when the page loads its artifacts, then the loader refuses `dataset.json` and does not render a ranking from it.
- Given the committed `data/` set, when the existing "committed data/ set" test runs, then it still loads as ready.

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 15 findings — high 0, medium 0, low 9, false 6, maybe-false 0
- findings:
  - `[low]` `[patch]` (blind) `sync`'s `runChunk` now refuses a previous `dataset.json` with a repeated `entryKey`, where `buildDatasetFile` used to heal it silently; no test pins it — the refusal is the intended effect of the contract rule and matches every other invalid dataset (`run-chunk.test.ts` "an invalid dataset throws"). Patched: added a `runChunk` test that seeds a twin-key dataset and asserts the throw names `dataset.json` and `repeats entries.0`, and that the lock is released.
  - `[false]` `[reject]` (blind) The write path has no test that a publish cannot trip the new rule — `buildDatasetFile` builds `entries` from `new Set(tracked.map(canonicalKey))`, so a repeat cannot be emitted, and `publish-dataset.test.ts` already parses its output with `DatasetFileSchema`.
  - `[false]` `[reject]` (blind) The doc comment overstates the parallel with `TrackedFileSchema` and hides that the compare is not canonical — the comment says in so many words "compared as an exact string", and `sync` writes `entryKey` only as `canonicalKey(entry)`.
  - `[low]` `[reject]` (blind) The tests use `.ok` instead of `success`, and the state-twin test skips the message asserts — `.ok` from `parseEnvelope` is the same outcome. The exact-twin and triplet tests already pin the message, so a gap in one test is negligible.
  - `[false]` `[reject]` (blind) The web test cannot tell the uniqueness refusal from another schema refusal — the twin entry's shape is accepted on its own (the contracts "Distinct keys" test), so only the rule refuses it.
  - `[low]` `[reject]` (blind) The priced fixture in the state-twin test is long — it is cosmetic, and the matrix row asks for a priced/no-listings pair.
  - `[low]` `[reject]` (blind) The spec does not cite the ledger entry it closes — the fix edits this build's spec.
  - `[low]` `[reject]` (blind) The Code Map line ranges are stale after the diff — the fix edits this build's spec.
  - `[false]` `[reject]` (blind) Verification does not name the sync test files — `pnpm test` runs every package, sync included (83 files).
  - `[low]` `[patch]` (edge-case) `sync` halts at load on a twin-key previous dataset instead of rewriting it — the same root cause as the first row. It is patched by the same `runChunk` test.
  - `[low]` `[reject]` (edge-case) Zod skips the file-level refine while an entry has a non-continuable issue, so twin issues show only after the other errors are fixed — `TrackedFileSchema` and `RecipesFileSchema` behave the same way. Consumers report one refusal either way, and a `when` option adds complexity for a case no one meets.
  - `[false]` `[reject]` (verification-gap) No verification gaps — no defect claimed.
  - `[low]` `[patch]` (verification-gap, other) A new `sync` halt on a twin previous dataset has no test — the same root cause as the first row. It is patched by the same test.
  - `[false]` `[reject]` (intent-alignment) The guarantee lives at the parse boundary, not in `rank` — the intent prescribes the contract rule. `rank`'s only caller (`packages/web/src/App.tsx`) receives the dataset through `loadArtifacts`, which parses with `DatasetFileSchema`.
  - `[low]` `[patch]` (intent-alignment) The `sync` read of the previous dataset changes behavior with no test — the same root cause as the first row. It is patched by the same test.
  - (deferred-ledger-audit) zero findings: the spec carves out nothing.

## Verification

**Commands:**
- `pnpm check` -- expected: passes
- `pnpm test` -- expected: passes, including the new tests

## Auto Run Result

Status: done

**Summary:** `DatasetFileSchema` now refuses a `dataset.json` that repeats an `entryKey`, so `rank`'s last-wins lookup can no longer depend on dataset order. The check found that `sync` cannot emit a repeat (`buildDatasetFile` keys come from a `Set`), and AD-19 already implies one entry for each tracked entry. So this change narrows the contract without a schema-version bump or an AD change.

**Files changed:**
- `packages/contracts/src/envelopes.ts` -- file-level `superRefine` on `DatasetFileSchema`, with one issue for each repeat at `entries.<i>` that names the key and `entries.<first>`.
- `packages/contracts/src/envelopes.test.ts` -- one test for each I/O matrix row.
- `packages/web/src/load/load-artifacts.test.ts` -- the loader refuses `dataset.json` with a twin key (surface proof).
- `packages/sync/src/chunk/run-chunk.test.ts` -- `runChunk` throws on a previous dataset with a twin key and releases the lock (review patch).

**Review:** 15 findings, 4 low findings from one root cause patched (the `sync` load-time refusal is now pinned by a test), 0 deferred, 11 rejected with reasons in the Review Triage Log. Patched counts by verdict: high 0, medium 0, low 1 entry.

**Follow-up review recommended:** false. Only one low entry was patched.

**Verification:** `pnpm check` passed (typecheck, lint, depcruise). `pnpm test` passed: 83 files, 1080 tests. The existing committed-`data/` loader test still loads as ready.

**Residual risk:** A hand-edited `data/dataset.json` with a repeated key now stops `pnpm sync` at load, where before the file was healed. A person must fix it. This is intended, and a test pins it.
