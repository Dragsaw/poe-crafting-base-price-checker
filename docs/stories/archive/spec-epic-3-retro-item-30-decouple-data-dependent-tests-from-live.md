---
title: 'Decouple data-dependent tests from the live data/ directory'
type: 'chore'
created: '2026-10-03'
status: 'done'
baseline_revision: '9be103bd4f676c757230ee3b33925d57a8f42cf6'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/epic-3-retro-2026-10-03.md'
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md'
warnings: []
deferred:
  - summary: >-
      No automated path runs pnpm test:data, so the live-data invariants are enforced only by hand.
    evidence: |-
      deploy.yml runs check, test and build only. Gating deploy on test:data would re-create the data-push coupling, so a non-blocking job or schedule is needed. Ledgered in deferred-work.md.
    location: >-
      .github/workflows/deploy.yml
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Tests parse the player-owned `data/` files (`tracked.json`, `dataset.json`, `weights.json`, `recipes.json`, `catalogue/stats.json`). A player edit to `tracked.json` or a sync commit turns `pnpm test` red while `pnpm tracked:check` stays green (retro V1, V2). `deploy.yml` skips `pnpm test` for that reason.

**Approach:** Data-dependent tests read a frozen fixture set committed under `test/fixtures/frozen-data/`. The invariants that must hold for the live `data/` move to a separate `data` vitest project behind `pnpm test:data`. `deploy.yml` then runs `pnpm test`.

## Boundaries & Constraints

**Always:** A fixture is a verbatim snapshot of `data/` at HEAD, except `weights.json`, which keeps only the base classes that `tracked.json` references. Test assertions that pin a live count (for example 8437 weights entries) move to the fixture's count or become shape checks. `pnpm test` makes no read of `data/` apart from schema-agnostic snapshot guards (the "writes nothing" checks). Fixtures are read-only inputs. No network.

**Never:** Do not edit anything under `data/`. Do not edit owner documents (PRD, spine, IMPLEMENTATION-NOTES). Do not add a package or a dependency edge. Do not make `sync` import `web` code, so `pnpm tracked:check` is not extended with the short-form or fit checks. Do not weaken any assertion beyond decoupling it from live values.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Player edits `data/tracked.json` | Any schema-valid change | `pnpm test` stays green | n/a |
| Sync lands new `data/dataset.json` | Any valid dataset | `pnpm test` stays green | n/a |
| Live tracked entry lacks a short form | New stat id in `data/tracked.json` | `pnpm test:data` fails, naming the stat id | `pnpm test` unaffected |
| Live combination text breaks fit or falls back to verbatim | Entry added to `data/tracked.json` | `pnpm test:data` fails, naming the text | `pnpm test` unaffected |

</intent-contract>

## Code Map

- `packages/web/src/App.test.tsx` -- five `import.meta.glob('../../../data/…')` tests (lines ~432, 448, 1061, 1133, 1395) that assert the rows, panel, recipe control, appendix and chase cells of the live data.
- `packages/web/src/list/short-forms.test.ts`, `packages/web/src/list/combination-fit.test.ts` -- parse live `tracked.json` (and `catalogue/stats.json`); the latter holds a hand-kept 54-item `PRUNING_CANDIDATES`.
- `packages/web/src/load/load-artifacts.test.ts:263` -- globs all `data/**/*.json` ("the committed data/ set").
- `packages/core/src/{rank,probability,cross-file}.test.ts` (~lines 945, 291, 280) -- dynamic `import(`${here}/../../../data/${name}`)` loaders.
- `packages/contracts/src/weights-file.test.ts:55` -- parses live `weights.json`, pins 8437 entries, 16 null statIds, 0 partial pools.
- `packages/sync/src/catalogue/weights-ids.test.ts:91`, `chunk/sync-report.test.ts:181`, `catalogue/committed-catalogue.test.ts`, `pricing/load-currencies.test.ts`, `pricing/price-entry.fixtures.test.ts`, `dry-run.test.ts`, `curation/check.test.ts` -- read live files; audit each (the snapshot guards in `check.test.ts` and `dry-run.test.ts` only prove "writes nothing" and stay).
- `vitest.config.ts` -- project list; add the `data` project there. `package.json` -- add `test:data`; `pnpm test` must exclude the project.
- `.github/workflows/deploy.yml` -- header comment says tests are deliberately skipped; replace with a `pnpm test` step after `pnpm check`.
- `docs/architecture/.../AGENT-WORKFLOW.md` -- owns command-level rules; one line for `pnpm test:data` and the fixture rule.
- `docs/stories/deferred-work.md` -- append an entry: fold the short-form and fit checks into `pnpm tracked:check` once the short-form module's owner ruling (retro item 31, R6) places the table where `sync` may import it.

## Tasks & Acceptance

**Execution:**
- `test/fixtures/frozen-data/**` -- snapshot `data/` (trimmed `weights.json`) -- the frozen inputs; add a README line naming the snapshot commit and the rule that it is never regenerated by sync.
- `packages/{web,core,contracts,sync}/**/*.test.*` -- repoint every live-`data/` read in the Code Map to the fixture; repin counts to the fixture; replace the hand-kept `PRUNING_CANDIDATES` check's source with the fixture (list stays valid, now stable).
- `packages/web/src/list/*.data.test.ts` (new, `data` project) -- live-data invariants: every crafted statId has a short form; no verbatim fallback; longest text fits the cell.
- `vitest.config.ts`, `package.json` -- `data` project, `test:data` script, `pnpm test` excludes it.
- `.github/workflows/deploy.yml` -- run `pnpm test` before build; fix the comment.
- `AGENT-WORKFLOW.md`, `deferred-work.md` -- the two doc edits above, append-only for the ledger.

**Acceptance Criteria:**
- Given `data/tracked.json` has a swapped stat id (for example 13 entries moved to `explicit.stat_210067635`) and `data/dataset.json` is truncated to `{}`-valid minimum, when `pnpm test` runs, then it passes.
- Given a live tracked entry whose stat id has no short form, when `pnpm test:data` runs, then it fails and names that id, and `pnpm test` still passes.
- Given the unmodified tree, when `pnpm check`, `pnpm test` and `pnpm test:data` run, then all exit 0 with no network call.
- Given `deploy.yml`, when read, then `pnpm test` runs before `pnpm build` and no comment says tests are skipped.

## Spec Change Log

## Review Triage Log

### 2026-10-03 — Review pass
- verdicts: 21 findings — high 0, medium 1, low 3, false 4, maybe-false 0 (rejected as intent-consistent or negligible: 13)
- findings:
  - `[medium]` `[defer]` (verification-gap, blind, intent) `test:data` has no automatic trigger; `sync:dry` and `tracked:check` success paths run only there — gating deploy on it re-creates the coupling; ledger entry appended, frontmatter `deferred` set.
  - `[low]` `[patch]` (edge, blind, verification-gap) combination-fit header cites a nonexistent `combination-fit.data.test.ts` — comment now names `tracked.data.test.ts`.
  - `[low]` `[patch]` (edge, blind) "writes nothing" guards discard the script result and can pass vacuously — both now assert the run produced a numeric exit code.
  - `[low]` `[patch]` (blind) AGENT-WORKFLOW command block says `pnpm test` "reads no live data/ file", contradicting the snapshot-guard sentence — reworded.
  - `[false]` `[reject]` (blind, edge) README missing in `test/fixtures/frozen-data/` — the file exists.
  - `[false]` `[reject]` (blind, edge, verification-gap) unused imports in `dry-run.test.ts` — `pnpm check` (eslint --max-warnings=0) exits 0.
  - `[false]` `[reject]` (edge, verification-gap) `data` project lacks jsdom/aliases — `pnpm test:data` passes 3 files, 6 tests.
  - `[false]` `[reject]` (blind, edge) `--project=!data` unverified — `pnpm test` ran 112 files and excluded the data project.
  - `[low]` `[reject]` (edge, blind) `readSnapshot` `slice(5)` without prefix check; `committed-catalogue` same — test-plumbing, every caller passes `data/` paths, guard adds branches.
  - `[low]` `[reject]` (blind) stale titles "committed $outputPath", "committed" in weights-file comments — cosmetic.
  - `[low]` `[reject]` (blind) duplicated `snapshot`/`runScript` in the `.data` files — cosmetic.
  - `[low]` `[reject]` (blind, verification-gap) no live counterpart for PRUNING_CANDIDATES or the form-collision check — by design: a hand-kept list over live data is the coupling removed.
  - `[low]` `[reject]` (edge) `vite.config.test.ts`/`prune-allowlist.test.ts` still read `data/`, so the spec "Always" line overstates — they assert a path and an allowlist, not data content; fix would edit the spec.
  - `[low]` `[reject]` (edge) misplaced `*.data.test.*` outside `src/` never runs — convention is stated in AGENT-WORKFLOW.
  - `[low]` `[reject]` (blind) four copies of the data-test exclude, bare `vitest run` runs the data project — the pnpm script is the documented entry.
  - `[low]` `[reject]` (blind) fixture schema-bump refresh not documented — the next schema bump fails the fixture tests loudly.
  - `[low]` `[reject]` (blind) production `dry-run.ts` gained an optional `dataDir` — small, defaulted, required to point tests at the fixture.
  - `[low]` `[reject]` (intent) R-B (fold live checks into tracked:check) not implemented — spec Design Notes and ledger entry record why.
  - `[low]` `[reject]` (intent) `price-entry.fixtures.test.ts` mixes frozen and repo `fixtures/` inputs — both are committed fixtures, none is live.
  - `[low]` `[reject]` (intent, blind) load-currencies not in diff; stale `deferred: []` — audit found no live read; frontmatter now updated.
  - `[low]` `[reject]` (edge) `dry-run.data.test.ts` mtime snapshot can flake under parallel runs — data tests run only by hand, serially.

## Design Notes

The `data` project is not folded into `pnpm tracked:check`: the short-form table and theme tokens live in `web`, and the spine forbids `sync` → `web`. Ownership of the table is an open ruling (retro R6, item 31), so the move is ledgered, not decided here.

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0
- `pnpm test` -- expected: exit 0, then still exit 0 after the perturbation in the first AC (restore `data/` with `git checkout -- data` afterwards)
- `pnpm test:data` -- expected: exit 0 on the unmodified tree

## Auto Run Result

Status: done

- Summary: tests that read the live `data/` now read `test/fixtures/frozen-data/`. Live-data invariants run under `pnpm test:data` (`data` vitest project). `deploy.yml` runs `pnpm test`.
- Files: `test/fixtures/frozen-data/**` (snapshot, trimmed weights); web, core, contracts and sync tests repointed; `*.data.test.ts` files (3, new); `vitest.config.ts`, package vitest configs and `package.json` (`test`, `test:data`); `dry-run.ts` (optional `dataDir`); `deploy.yml`; `AGENT-WORKFLOW.md`; `deferred-work.md` (2 entries).
- Review: 3 low patches applied, 1 medium deferred (ledgered), 17 rejected with reasons in the triage log.
- Follow-up review recommended: false (no high patched, no two mediums patched).
- Verification: `pnpm check` exit 0; `pnpm test` 112 files, 1674 tests pass; `pnpm test:data` 3 files, 6 tests pass. The implementer ran the AC perturbation (13 stat ids swapped, dataset emptied): `pnpm test` green, `pnpm test:data` red; `data/` restored.
- Residual risks: the missing-short-form AC was not run by perturbation; `test:data` has no automated trigger (deferred).
