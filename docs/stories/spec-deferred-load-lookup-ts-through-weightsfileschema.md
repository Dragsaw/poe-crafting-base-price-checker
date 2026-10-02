---
title: 'Load tracked:lookup weights through WeightsFileSchema'
type: 'refactor'
created: '2026-10-02'
status: 'done'
baseline_revision: '83d9054f814a28a8e488601ebab38c5383233206'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      A `mods` row of `pnpm tracked:lookup` no longer carries the readable mod text; its `text` repeats `modGroup`, and the families of one `modGroup` differ only in `statIds`.
    evidence: |-
      The weights contract has no field for the mod text (`sourceModifierId` is opaque), so the typed load cannot print it. The skill now names each stat with `pnpm tracked:lookup stat <statId>`. A `text` per row could be joined from `stats.json` by `statId`, or the producer could emit it, which is the decision of the open `modText` entry on `WEIGHTS-FILE-SCHEMA.md`.
    location: >-
      .claude/skills/tracked-json/scripts/lookup.ts:lookupMods
    severity: medium
---

<intent-contract>

## Intent

**Problem:** `.claude/skills/tracked-json/scripts/lookup.ts` reads `data/weights.json` as untyped JSON with its own guards and splits `sourceModifierId` to print mod text, so the curation skill can drift from the weights contract.

**Approach:** Parse the weights file with `WeightsFileSchema` from `@poe/contracts`, walk the typed `bases` tree, and print `modGroup` and `tierLabel` from the typed entries instead of parsing `sourceModifierId`.

## Boundaries & Constraints

**Always:** `lookup.ts` stays read-only and derives nothing (no interval, no floor). Output shapes of `stat`, `base`, `class`, `mods` and `tiers` stay the same except where the mod text changes (below). A weights file that fails the schema prints `{error}` naming `data/weights.json` and the first issue path and message, and exits 1. The catalogue files (`stats`, `items`, `filters`) stay plain-JSON reads.

**Never:** Edit `docs/stories/deferred-work.md`, `sprint-status.yaml`, owner documents, or `packages/*`. Add a second copy of any contract rule. Keep the `modText` split of `sourceModifierId`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid weights | committed `data/weights.json` | same rows as before; `text` of a `mods` row is the first tier's `modGroup` | No error expected |
| Schema-invalid weights | an entry with a missing `modGroup` or a negative `weight` | `{error}` with `data/weights.json`, the issue path and message | exit 1 |
| Absent or non-JSON weights | no file, or bad JSON | unchanged `{error}` | exit 1 |

</intent-contract>

## Code Map

- `.claude/skills/tracked-json/scripts/lookup.ts` -- reads weights through `basesOf`, `resolveClass`, `entriesOf`, `modText`, `lookupClass`, `lookupMods`, `lookupTiers`; `runCommand` reads `WEIGHTS_PATH` via `ReadJson`.
- `.claude/skills/tracked-json/scripts/lookup.test.ts` -- in-memory fixtures (plain objects) and CLI spawn tests; fixtures must become schema-valid.
- `packages/contracts/src/weights-file.ts` -- `WeightsFileSchema`, `WeightsFile` type; `tierLabel` optional, `lines[].statId` nullable.
- `package.json`, `pnpm-lock.yaml` -- root has no `@poe/contracts` link; added as `workspace:*` devDependency (verified: Node resolves it and the committed file parses).

## Tasks & Acceptance

**Execution:**
- `package.json`, `pnpm-lock.yaml` -- add `@poe/contracts` `workspace:*` devDependency -- the script needs the schema at runtime
- `.claude/skills/tracked-json/scripts/lookup.ts` -- add `loadWeights(read)` that parses with `WeightsFileSchema` and throws `LookupError`; type the weights helpers on `WeightsFile`; use `modGroup` for the mod text and `tierLabel`; remove `modText` and the guard helpers no longer used; update the header comment
- `.claude/skills/tracked-json/scripts/lookup.test.ts` -- make fixtures schema-valid, replace the `modText` cases, add a schema-invalid case

**Acceptance Criteria:**
- Given the committed `data/weights.json`, when `pnpm tracked:lookup mods --class Amulets` runs, then it exits 0 and every row has a non-empty `text`.
- Given a weights file that violates the schema, when any weights-reading subcommand runs, then it exits 1 with `{error}` naming the file and path.
- Given `pnpm check` and `pnpm test`, then both pass.

## Spec Change Log

## Review Triage Log

### 2026-10-02 — Review pass
- verdicts: 9 findings — high 0, medium 2, low 4, false 3, maybe-false 0
- findings:
  - `[medium]` `[patch]` SKILL.md still tells the agent to show each mods row's `text`, which is now the modGroup (intent-alignment, blind, edge) — SKILL.md step 2 reworded to show `modGroup` and to name each stat with `tracked:lookup stat`
  - `[medium]` `[defer]` Readable mod text is gone from `mods` rows; GemLevel families differ only by statIds (blind, edge, intent-alignment) — the contract carries no such field; recorded in `deferred`
  - `[false]` `[reject]` Root dependency edge is unwired: ALLOWED_EDGES, tsconfig references, dist entry (blind, edge) — `test/contracts-isolation.test.ts` scans `packages/*` only, contracts `exports.default` is `./src/index.ts`, and `pnpm check` and the spawned-CLI tests pass
  - `[false]` `[reject]` Spec says rows unchanged while `text` changes (edge) — the spec's I/O row names the `text` change
  - `[low]` `[reject]` Only issues[0] is reported; add a count (blind, edge) — one issue per run suffices and the fix adds a branch
  - `[low]` `[reject]` mods and tiers lack an invalid-weights test (blind, edge) — they share `loadWeights` with the tested `class` path
  - `[low]` `[reject]` TierRow typing, repeated `?? null`, long fixture line, test placement and cast helper, extra edge tests (blind, edge) — cosmetic, and the fixes add complexity
  - `[low]` `[reject]` Spec leaves the ledger entry open (blind) — the caller removes it in its own commit
  - `[false]` `[reject]` Verification-gap and ledger layers — zero findings reported, nothing to triage

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0
- `pnpm test` -- expected: exit 0
- `pnpm tracked:lookup mods --class Amulets` -- expected: JSON rows, exit 0

## Auto Run Result

Status: done

Summary: `lookup.ts` parses `data/weights.json` with `WeightsFileSchema`, walks the typed tree, and prints `modGroup` and `tierLabel`. A schema fault prints `{error}` and exits 1.

Files changed:
- `.claude/skills/tracked-json/scripts/lookup.ts` -- typed load, `modText` removed
- `.claude/skills/tracked-json/scripts/lookup.test.ts` -- schema-valid fixtures, new schema-fault cases
- `.claude/skills/tracked-json/SKILL.md` -- mods step wording
- `package.json`, `pnpm-lock.yaml` -- root `@poe/contracts` link

Review: one patch applied (SKILL.md), one item deferred, the rest rejected with reasons in the triage log. Follow-up review not recommended.

Verification: `pnpm check` and `pnpm test` passed (1539 tests). `pnpm tracked:lookup mods --class Amulets` printed 33 rows, each with text.

Residual risk: the `mods` text loss above. The open ledger entry on `modText` and `sourceModifierId` is now stale, since the parse is gone.
