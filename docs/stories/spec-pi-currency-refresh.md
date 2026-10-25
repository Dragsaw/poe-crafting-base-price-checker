---
title: 'The Pi sync host refreshes currency rates on every tick'
type: 'chore'
created: '2026-10-25'
status: 'done'
baseline_commit: '0127e30326fcb8203ad337686142fbc845df6c1d'
route: 'dispatch'
review_loop_iteration: 1
context:
  - '{project-root}/docs/stories/spec-raspberry-pi-sync-host.md'
  - '{project-root}/docs/stories/spec-currencies-refresh-tool.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `data/currencies.json` goes stale while the PC is off, because only a human runs `pnpm currencies:refresh`. The Pi sync host publishes on its own, but it does not refresh rates.

**Approach:** Every publish tick on the Pi runs `pnpm currencies:refresh` while `poe-sync` is stopped. `data/currencies.json` becomes a tick-owned file and rides the same `chore(data): sync dataset` commit as the sync data. The restarted `poe-sync` reads the new rates.

**Decisions (human, 2026-10-25):**
- Cadence: every tick. No stamp and no separate commit.
- The scheduling rule is not a concern of the owner docs. Remove "Do not run it on a schedule" from `AGENT-WORKFLOW.md` *Fixtures*, and remove the "by hand" refresh wording from spine AD-20 (revision 44). Write the rationale in the commit message.
- No plausibility guard. Schema validation in the tool is enough.

**Decision (human, 2026-10-25, review 1):** Amend spine AD-3 in revision 44. The operator job commits the sync-owned files and `data/currencies.json`, and the Deferred *A publish command* item follows. The two existing commits stay. New work lands in new commits.

## Boundaries & Constraints

**Always:**
- The refresh runs inside `tick.sh`, after the drift guard and before `commit_owned`, as `pnpm currencies:refresh`. No new systemd unit.
- A failed refresh does not fail the tick. The tick logs a warning, restores `data/currencies.json` with `git checkout --`, and publishes the sync data as usual.
- `data/currencies.json` joins `OWNED`. The drift guard allows it, and `commit_owned` stages it.
- `zod` and `@poe/contracts` move from root `devDependencies` to root `dependencies`, because the Pi installs with `--prod`.
- `ops/pi/README.md` describes the refresh. It updates the owned-file lists, *What a tick does*, the rebase recovery `cp` lines and the hand-restore lines, and the *PC hand-off*, and adds a first-run checklist line.

**Never:**
- No change to `packages/sync` (AD-20: sync fetches no rate). No change to `tools/currencies-refresh/`.
- No force-push. No new exit status.
- No real host, user or address in `ops/pi/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Rates changed | Refresh exits 0 and rewrites the file; sync files changed | One `chore(data): sync dataset` commit holding `currencies.json` and the sync files; push | N/A |
| Only rates changed | Sync files clean; refresh rewrites the file | One commit with `currencies.json` only | N/A |
| Refresh fails | Refresh exits non-zero (poe2scout down, schema fail) and may leave the file dirty | Warning logged; `currencies.json` equals `HEAD`; sync data still committed and pushed; exit 0 | warning, no abort |
| Refresh leaves file identical | Exit 0, no byte change | Commit only if sync files changed | N/A |
| Stray `currencies.json` edit | File dirty before the tick | Not drift. The refresh overwrites it, or on failure it is restored to `HEAD` | N/A |

</frozen-after-approval>

## Code Map

- `ops/pi/tick.sh` -- `OWNED` (drift guard and `git add` list), `commit_owned`, `main` (call order), `log`/`die` helpers. Leave the exit codes, `pull_rebase`, `push` and the install stamp unchanged. Call the refresh in an `if` so the ERR trap and `set -e` do not fire on its failure.
- `ops/pi/README.md` -- intro paragraph, the `tick.sh` table row, *Nobody curates on the Pi* (owned list), *What a tick does*, *PC hand-off*, *Recovery* (`cp` lines in *Rebase conflict*, the `git checkout` lines in *Truncated `dataset.json`*), *First-run checklist*.
- `ops/pi/poe-sync-tick.service` -- `TimeoutStartSec=45min`. The refresh is bounded by the tool's 30 s per-page timeout, so leave it unchanged.
- `tools/currencies-refresh/currencies-refresh.ts` -- exits 0 or 1. It writes `data/currencies.json.tmp` and renames it into place, and removes the temp file when the write fails. The temp file is not git-ignored, so a power cut can leave it behind and trip the drift guard. `clear_leftovers` removes it.
- `package.json` -- the `currencies:refresh` script; `zod`, `@poe/contracts` under `devDependencies`.
- `test/pi-tick.test.ts`, `test/pi-tick-sandbox.ts` -- tick tests in a git sandbox with a fake `pnpm`. `FAKE_PNPM_RUN` runs a command (use it to write `data/currencies.json`), and `FAKE_PNPM_EXIT` sets the exit code. The fake also serves `pnpm install`, so a test must not combine a lockfile change with a failing refresh. The seed needs a `data/currencies.json`.
- `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md:59` -- the "by hand ... Do not run it on a schedule" sentence.
- `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md` -- AD-20 "Rates are hand-maintained committed data" paragraph (~line 1386), the `data/` tree comment (~line 1857), and frontmatter `revision`/`updated`. The AD-3 table row stays: "by hand" there already means a writer outside the app.
- Same file, AD-3 *Publishing is an operator job* paragraph (~lines 137-143): "commits and pushes the sync-owned files" and "An operator job therefore commits only the sync-owned files". Name `data/currencies.json` next to the sync-owned files and keep the AD-19 rationale. Deferred *A publish command* (~lines 1907-1912): "an operator job must commit only the sync-owned files (AD-3). The sync host's scheduled job enforces that". `revision` stays 44.
- `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/.memlog.md` -- append one `(decision) [USER] Spine revision 44 (2026-10-25, ...)` row at the end, in the form of the rev 42 and 43 rows: what changed, what it binds and what it prevents. Set frontmatter `updated`. The file repeats a block of rows. Do not dedupe it.
- `ops/pi/README.md` *PC hand-off* (~lines 183-193) and *One syncer at a time*: the hand-back pulls on the paused Pi (`git -C <repo-dir> pull --rebase`, the tree is clean after step 2) before *Tick by hand*, because a tick commits refreshed rates before it pulls. The tool's own warnings are lowercase `currencies:refresh: warning:` lines (`tools/currencies-refresh/currencies-refresh.ts:142`).

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- move `zod` and `@poe/contracts` to `dependencies`, then `pnpm install` so the lockfile follows -- the `--prod` install on the Pi must resolve the tool.
- [x] `ops/pi/tick.sh` -- add `data/currencies.json` to `OWNED`; add `refresh_currencies` (run, on failure warn and `git checkout -- data/currencies.json`); call it in `main` after `check_drift`; `clear_leftovers` removes a stale `data/currencies.json.tmp` -- the feature.
- [x] `test/pi-tick-sandbox.ts`, `test/pi-tick.test.ts` -- seed `data/currencies.json`; one test for each matrix row; update existing assertions about fake-log lines -- proof.
- [x] `ops/pi/README.md` -- the sections in the Code Map -- the runbook.
- [x] `AGENT-WORKFLOW.md`, `ARCHITECTURE-SPINE.md` -- the edits in Decisions; spine `revision: 44`, `updated: '2026-10-25'`; a separate `docs(architecture)` commit -- owner docs.
- [x] `ARCHITECTURE-SPINE.md`, `.memlog.md` -- amend AD-3 and the *A publish command* item per the review-1 Decision; append the rev-44 memlog row; a new `docs(architecture)` commit -- owner docs (triage 1, 2).
- [x] `ops/pi/tick.sh` -- `refresh_currencies` restores with `git checkout HEAD -- "$RATES"`, so the file and the index equal `HEAD` as the warning says -- triage 5.
- [x] `ops/pi/README.md` -- hand-back step 1 pulls on the Pi before *Tick by hand*; *One syncer at a time* says not to commit `data/currencies.json` on the PC while the Pi syncs (the next rebase conflicts, status 4); hand-off step 3 commits `data/currencies.json` after a PC refresh; the checklist line also requires no `currencies:refresh: warning:` line -- triage 3, 4, 6.
- [x] `test/pi-tick.test.ts` -- both status-3 drift tests assert `sandbox.fakeLog()` is empty; the rates-and-sync test asserts the pushed `currencies.json` equals what the fake refresh wrote -- triage 7, 8.
- [x] The tick, README and test fixes land in one new `fix(ops)` commit. Do not amend or rewrite the existing commits.

**Acceptance Criteria:**
- Given a successful refresh and changed sync files, when the tick runs, then the remote gains exactly one `chore(data): sync dataset` commit that contains all four files, and no update is forced.
- Given `pnpm check`, when it runs, then it passes and makes no network call.

## Implementation Notes

## Spec Change Log

- **Review 1, loop 1.** Triggered by triage 1 (intent_gap: AD-3 allowed the operator job only the sync-owned files) and triage 2 (bad_spec: no rev-44 memlog row). Amended: the frozen Decisions gained the human's AD-3 ruling, and the Code Map and Tasks gained the AD-3, memlog and triage 3–8 patch work. Known-bad state avoided: a spine whose AD-3 forbids the tick's commit, so a later builder drops the rates from `OWNED`. KEEP: the commits `06d7b5e` and `a9fc87d` as they are (the human kept them, so there is no revert); the `refresh_currencies` structure (`if` around the run, `warn` helper), `clear_leftovers` removing the `.tmp`, the five matrix tests and `seedTickRepos`. `git checkout HEAD --` keeps the frozen "restores with `git checkout --`" constraint and matches the matrix's "equals `HEAD`".

## Review Triage Log

Review 1 (diff `0127e30..` working tree). Layers: blind-hunter, edge-case-hunter, verification-gap, deferred-ledger-audit (zero findings). impeccable-design-review skipped: no `packages/web/src/` change.

| # | Finding | Verdict | Evidence | Route |
|---|---------|---------|----------|-------|
| 1 | Spine AD-3 says "An operator job therefore commits only the sync-owned files" (~l.142), and Deferred *A publish command* says the scheduled job enforces that (~l.1907). The tick now commits `data/currencies.json`, a player-written file. | medium | Verified at both lines. A builder who reads AD-3 would drop the rates from `OWNED` or reject the tick. The Decisions amend only AD-20 and `AGENT-WORKFLOW.md`, and more than one reading is possible (amend AD-3, or exempt the rates file). | intent_gap |
| 2 | No `.memlog.md` row for spine rev 44. Revs 42 and 43 each have one. | low | Verified: the architecture memlog has rows for 42 and 43 and none for 44. The Tasks list for owner docs leaves it out. | bad_spec |
| 3 | The tick refreshes before `pull_rebase`. A rates commit from the PC then conflicts (exit 4). The documented hand-back (PC step 3 refreshes; hand-back step 1 runs *Tick by hand*) hits that conflict. | medium | Verified: a refresh rewrites `asOf`, so the Pi always commits `currencies.json` before it pulls. The frozen intent fixes the order, so the fix is in the runbook: pull on the Pi before *Tick by hand* in the hand-back, and do not commit rates on the PC while the Pi syncs. | patch |
| 4 | PC hand-off step 3 does not say to commit `data/currencies.json` after a refresh. | low | Verified at README l.187-188. Direct correction. | patch |
| 5 | `refresh_currencies` restores from the index (`git checkout --`), but its warning, the runbook and the matrix say HEAD. | low | Verified: a staged copy survives a failed `git commit` (tested path). `git checkout HEAD --` matches the warning. Direct correction. | patch |
| 6 | The first-run checklist looks for "no `WARNING`", but a partial refresh prints the lowercase `currencies:refresh: warning:` and exits 0. | low | Verified at `plan.ts:75,79` and `currencies-refresh.ts:142`. Direct wording fix. | patch |
| 7 | The drift tests do not check that the refresh did not run before the drift guard stopped the tick. | low | Verified: the status-3 tests check only HEAD. One `fakeLog` assertion per test fixes it. | patch |
| 8 | The rates-and-sync test does not check the content of the pushed `currencies.json`. Its `isAncestor` check is redundant. | low | Content: verified, one assertion. Redundant: false, because `before..master == 1` also holds for a forced sibling commit. | patch |
| 9 | Nothing checks that the `--prod` install resolves the refresh tool's runtime imports. | low | Gap confirmed: the tick tests fake `pnpm`. The current imports resolve (`@poe/contracts` exports `src/index.ts` and lists `zod` itself; entry-guard imports only `node:`). Harm needs a future manifest edit, the first-run checklist covers the `--prod` path, and the fix is a new import-walking test. | reject |
| 10 | The refresh reads `config.json` before the pull, so a pushed league change gets old-league rates for one tick. | low | Real but bounded to one tick. Before this change, old-league rates stayed until a human refresh. The frozen intent fixes the order. | reject |
| 11 | `git checkout` failure under `set -e` ends the tick before the sync data publishes. | false | Not reachable: `currencies.json` is committed at HEAD, and `clear_leftovers` removes a stale `index.lock`. | reject |
| 12 | 50 pages x 30 s can exceed `TimeoutStartSec=45min`. | false | `fetchItems` returns on the first failed page (`currencies-refresh.ts:92`). One category at `PerPage=100` is about 1–2 pages. | reject |
| 13 | `refreshWrites` breaks on a single quote and also runs on `pnpm install`. | low | Test-only and no current test hits it. The fix adds a guard, and the Code Map already sets the constraint. | reject |
| 14 | "hand-maintained" remains in AD-20 (~l.1413, 1423), AD-12 (~l.764), ~l.840, ~l.926, `AGENT-WORKFLOW.md:85` and `epics.md`. | false | The user direction of 2026-10-24 (memlog) defines "by hand" as any writer outside the app. Rev 42 made the tick an operator job outside the product, so the wording holds. | reject |
| 15 | Deferred *Automated currency rates* is out of date. | false | The item concerns the product (`sync`) fetching rates. The product still makes no rate request and has no poe2scout dependency. | reject |
| 16 | `AGENT-WORKFLOW.md:52,54,59` still say human-invoked, unattended and review. | false | These bind agents and hand runs. The tick is operator tooling outside the product (AD-3), and the Decisions rule out a review guard. | reject |
| 17 | `asOf` changes on every refresh, so every tick commits. | low | Real, but one commit per tick is the publish cadence AD-3 allows, and the Decisions chose every tick. Sync files change every tick anyway. | reject |
| 18 | An unattended refresh weakens the staleness signal of `asOf`. | low | The intent excludes it: "No plausibility guard. Schema validation in the tool is enough." | reject |
| 19 | A failed refresh leaves `currencies.json.tmp` until the next tick. | false | The tool removes the temp file when the write fails. A crash leftover is untracked and harmless until the next `clear_leftovers`, which runs before the drift guard. | reject |
| 20 | The rebase recovery copies the Pi's rates over the PC's. | false | The runbook's model makes the Pi the only refresher, and it already offers "skip the second `cp` line" to keep the remote's data. | reject |
| 21 | No test covers a rebase conflict on `currencies.json`, a league change, or a failed refresh that leaves `.tmp`. | low | The existing conflict test runs the same generic recovery. League: see 10. `.tmp`: see 19. | reject |

## Verification

**Commands:**
- `pnpm vitest run test/pi-tick.test.ts` -- expected: all pass.
- `pnpm check` -- expected: exit 0.

**Manual checks (if no CLI):**
- No agent browser checks: the change touches only `ops/`, `test/`, root `package.json`, the lockfile and docs, and no page input changes (agent-browser-checks rule 1).

Review 2 (diff `0127e30..c1c084b`). Layers: blind-hunter, edge-case-hunter, verification-gap, deferred-ledger-audit (zero findings). impeccable-design-review skipped: no `packages/web/src/` change.

| # | Finding | Verdict | Evidence | Route |
|---|---------|---------|----------|-------|
| 22 | No automated check that the `--prod` install resolves the refresh tool's imports or the `currencies:refresh` script. | low | carried from 9: same claim, and `package.json` and the tool imports still read as row 9 describes. | reject |
| 23 | "hand-maintained" remains in AD-20 (~l.1413, 1423), AD-12 (~l.764) and Deferred *Automated currency rates* (~l.1913), now beside the new "committed data" lead. | false | carried from 14 and 15. The rev-44 memlog row restates the 2026-10-24 direction: "by hand" names a writer outside the app, so both wordings describe the same file. | reject |
| 24 | `AGENT-WORKFLOW.md:52-54` still says human-invoked, unattended and review. | false | carried from 16. | reject |
| 25 | A failed `git checkout HEAD --` ends the tick under `set -e`. | false | carried from 11. | reject |
| 26 | `asOf` is restamped on every refresh, so every tick commits. | low | carried from 17. | reject |
| 27 | No outer timeout on the refresh against `TimeoutStartSec=45min`. | false | carried from 12. | reject |
| 28 | The refresh runs before the pull, so a league change or a tool fix applies one tick late. | low | carried from 10. | reject |
| 29 | The rebase recovery copies the Pi's `currencies.json` (edge: it overwrites a PC-added entry; blind: the copy does nothing). | low | Verified: after `reset --hard origin/master` the next tick either overwrites the copy (refresh succeeds) or runs `git checkout HEAD --`, which is the remote's file (refresh fails). The copy never reaches a commit, so no PC entry is lost, and the step is dead. Direct deletion from both `cp` lines. | patch |
| 30 | Adding a currency needs a hand edit, and a PC commit stalls every tick at status 4. | false | *One syncer at a time* already forbids committing `data/currencies.json` on the PC while the Pi syncs, and the *PC hand-off* is the path for that edit. | reject |
| 31 | No test pins the HEAD restore of triage 5: the suite passes with `git checkout --`. | low | Verified: in every test the index equals HEAD at tick start. A test that stages a rates edit and then fails the refresh pins it. That state is reachable (a failed `git commit`, tested path). | patch |
| 32 | `AGENT-WORKFLOW.md` l.59 tells an agent to refresh and commit rates, but does not say that a PC rates commit while the Pi syncs stalls every tick at status 4. | medium | Verified: the rule is only in `ops/pi/README.md`. The fix adds a rule to an owner doc beyond the human's decisions (Review brief rule 2). | defer |
| 33 | `poe-sync-tick.service` `Description=` says "(commit, rebase, push)", and the `TimeoutStartSec` comment does not name the refresh. | low | Verified at the unit's l.2 and l.15. Direct wording fix. `TimeoutStartSec` stays (Code Map). | patch |
| 34 | The README reason "so the restarted `poe-sync` reads the new rates" is wrong, because sync reloads rates each chunk. | false | The clause is true: sync loads `currencies.json` in each chunk (`compose-chunk.ts:106`), so the restarted session reads the new rates. The frozen Approach states the same. | reject |
| 35 | No automatic resolution or alert for a rates-only rebase conflict. | low | The runbook rule (row 32 and *One syncer at a time*) avoids the conflict. Auto-resolution is a new mechanism, and an alert is outside the intent. | reject |
| 36 | Hand-back: the manual pull, then *Tick by hand*, runs the refresh before the install, so a changed tool dependency warns for one tick. | low | It needs a PC change to the tool's dependencies during a hand-off, and the next tick heals it. The fix adds a runbook step. | reject |
| 37 | The matrix row "identical" is half tested (sync change with identical rates), and the rates-alone test does not assert one commit with the subject. | low | Verified: the first test changes sync files with a no-op refresh but does not assert that `currencies.json` is absent from the pushed files. Two direct assertions. | patch |
| 38 | Lines in AD-3, the *A publish command* item and `ops/pi/README.md` go past the wrap width. | low | Verified, cosmetic. Direct reflow. | patch |
