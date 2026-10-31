---
title: 'A Raspberry Pi sync host that publishes on its own'
type: 'chore'
created: '2026-10-25'
status: 'done'
route: 'dispatch'
baseline_commit: '4a00fb73d643d00773414f5f5282b7c7596772f5'
review_loop_iteration: 1
context:
  - '{project-root}/docs/sprint-change-proposal-2026-10-25.md'
  - '{project-root}/docs/forge/raspberry-pi-sync-host/forged-idea.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Sync and publishing need the PC on. AD-3 calls publishing "a human act", and *Deployment & environments* puts the syncer on "the player's machine", so an unattended publish tick contradicts the spine.

**Approach:** Land proposal edits A1, A2, A3 and G1 verbatim in one docs commit (spine revision 42). Add git-tracked `ops/pi/` as the forged idea locks it: a runbook, a tick script, `poe-sync.service`, `poe-sync-tick.service` + `.timer`, and `set-poesessid.sh`.

## Boundaries & Constraints

**Always:**
- The tick owns exactly `data/dataset.json`, `data/sync-progress.json`, `data/sync-report.json`. Any other dirty or untracked path aborts it non-zero before a commit.
- The tick runs `git pull --rebase`, then a plain `git push --no-verify`. Never `--force`, `--force-with-lease` or `+refspec`. On failure it aborts a half-done rebase, exits non-zero and leaves the local commit for the next tick.
- Commit subject `chore(data): sync dataset` (passes `.githooks/commit-msg`). Skip the commit when nothing changed, but still pull and push.
- The sync service is stopped for the whole tick and started again even when the tick fails.
- Placeholders (`<pi-host>`, `<pi-user>`, `<repo-dir>`) only. No secret, address or hostname of the operator.
- The runbook marks the human-only steps: Imager flash, `.env` values, deploy-key approval. The agent never reads or writes `.env`.

**Decision (human, 2026-10-25):** this run does not provision the Pi. It ships the docs and `ops/pi/`, verified locally. The runbook ends with a first-run checklist for the live criteria: a Pi push deploys within one tick, the drift guard aborts, no force-push, the service survives a reboot and a power cut, and `pnpm install --prod` is enough to run `pnpm sync`.

**Never:** provision or `ssh` to a Pi in this run; change `packages/`, `package.json` or `AGENT-WORKFLOW.md`; add a package script; edit `prd.md`, `epics.md` or `EXPERIENCE.md`; use a shallow clone (the git port reads `tracked.json`'s author date, AD-12).

## I/O & Edge-Case Matrix

| Scenario | State | Expected |
|---|---|---|
| Fresh data | only owned files changed | one commit, rebase, push, exit 0 |
| No change | clean tree | no commit, pull + push, exit 0 |
| Drift | `data/tracked.json` modified or a stray untracked file | abort before commit, exit ≠ 0, log the path |
| Remote ahead, no conflict | new commits on `origin/master` | rebase, push fast-forward |
| Rebase conflict | remote changed `dataset.json` | `rebase --abort`, exit ≠ 0, local commit kept |
| Leftovers | stale `.git/index.lock`, half-done rebase | removed or aborted, then normal tick |
| Lockfile changed by pull | `pnpm-lock.yaml` differs across the pull | `pnpm install --prod --frozen-lockfile` |

</frozen-after-approval>

## Code Map

- `docs/architecture/.../ARCHITECTURE-SPINE.md` -- front matter (rev 41 → 42, `updated`), AD-3 publishing paragraph L137–142, Stack "Sync invoker" L1715, *Deployment & environments* para 1 L1822–1834 and para 2 first sentence L1836.
- `docs/architecture/.../.memlog.md` -- append the A3 row at the end.
- `AGENTS.md` -- *Where things are*: G1 bullet.
- `package.json` `sync` -- `node --env-file-if-exists=.env packages/sync/src/sync.ts`. The unit runs this command with `node` as the main process (see Implementation Notes).
- `packages/sync/src/sync.ts` `main` -- first SIGTERM aborts the session. The running entry finishes, and the inter-entry waits are abortable. In-entry pacing waits (`trade/client/governor-context.ts` `paceLane`, `trade/ledger.ts` `spreadBeforeNext`) are not abortable. One wait is at most a bucket window, so `TimeoutStopSec=15min`.
- `packages/sync/src/trade/user-agent.ts`, `trade/session-auth.ts` -- `.env` needs `POE_SYNC_USER_AGENT` (required) and optional `POESESSID`. `set-poesessid.sh` must keep other lines.
- `packages/contracts/package.json` -- `zod` is a prod dep, so `pnpm install --prod` covers the runtime imports (`@poe/*`, `zod`).
- `.githooks/pre-push` -- runs `pnpm check`, which a prod install cannot run, hence `--no-verify`. `deploy.yml` still gates on `pnpm check`. `tools/setup-git-hooks.mjs` runs on install.
- `.gitignore` -- `*.lock` covers `data/sync.lock` and `data/sync.break.lock`.
- `packages/sync/src/chunk/lock.ts` -- the lock is stale by time alone (`STALE_LOCK_AFTER_MS` = 6 h). A lock left by a power cut or a SIGKILL blocks the session for up to 6 h unless the unit clears it before start.
- `test/pre-push-hook.test.ts` -- precedent for testing repo tooling from vitest: `spawnSync` against an `mkdtempSync` dir. `vitest.config.ts` project `root` includes `test/**/*.test.ts`. CI (`test.yml`) runs `pnpm check` on `ubuntu-latest`.
- Done in loop 0 and kept: docs commit `8b9166e` (A1/A2/A3/G1 + proposal). Do not touch it.

## Tasks & Acceptance

**Execution:**
- [x] spine, `.memlog.md`, `AGENTS.md` -- apply A1, A2, A3, G1 verbatim, commit `docs(architecture): spine rev 42, publishing is an operator job` with the proposal file. (Done: `8b9166e`.)
- [x] `ops/pi/tick.sh` -- bash, `set -Eeuo pipefail`, repo dir from `$1`/env. Steps per the matrix. Run the lockfile install **right after the pull and before the push**, so a failed push does not leave pulled code on old `node_modules`.
- [x] `ops/pi/poe-sync.service` -- `ExecStart=node --env-file-if-exists=.env packages/sync/src/sync.ts` (the `sync` script's command with `node` as main; see Implementation Notes), `ExecStartPre=/bin/rm -f data/sync.lock data/sync.break.lock` (systemd runs one instance per checkout, so a lock at start is stale), `KillMode=mixed`, `User=`, `WorkingDirectory=`, `Restart=always`, `RestartSec=60`, `After=`/`Wants=network-online.target time-sync.target`, `TimeoutStopSec=15min`, `MemoryMax=700M`.
- [x] `ops/pi/poe-sync-tick.service` + `.timer` -- oneshot. `After=`/`Wants=network-online.target`. `ExecStartPre=+systemctl stop poe-sync`, `ExecStart=tick.sh`, `ExecStopPost=+systemctl start poe-sync`, `TimeoutStartSec=45min`. Timer `OnCalendar` every 4 h, `Persistent=true`.
- [x] `ops/pi/set-poesessid.sh` -- read the value from stdin without echo, replace or add only the `POESESSID=` line, `chmod 600`, restart the service. Detect a running tick with `systemctl show -p ActiveState --value poe-sync-tick.service` in `activating` or `active` (a oneshot is `activating` while it runs, and `is-active` misses it).
- [x] `ops/pi/README.md` -- provision (OS Lite 64-bit, Ethernet, Node 24 arm64, `corepack enable`, full clone over SSH with a write deploy key, noreply identity, `systemd-time-wait-sync`, memory cgroup on the kernel cmdline), install units, operate (the agent may stop and start the service), the per-checkout lock and one-syncer rule, the measurement of CPU and memory per entry after the first pass (add the `inputSignature` cache to `deferred-work.md` only if CPU is high), recovery (rebase conflict, truncated `dataset.json`), and the first-run checklist of the decision above. Also:
  - GitHub host key: write `ssh-keyscan` output to a temp file, compare the fingerprint, and only then append it to `known_hosts`.
  - Pause and resume use `disable --now` / `enable --now` on `poe-sync` and the timer, so a pause survives a reboot. State that a manual tick starts `poe-sync` through `ExecStopPost`.
  - PC hand-off: pause, then run `tick.sh` by hand (no unit, so nothing restarts sync) to publish the Pi's data. The PC pulls, syncs and pushes. To resume, run `tick.sh` by hand first, so the Pi pulls the PC's data before sync writes, then enable.
  - Rebase-conflict recovery that works for any number of local tick commits: copy the three owned files aside, `git reset --hard origin/master`, copy them back (or skip the copy to keep the remote's data), commit with the tick subject, push. Not `rebase --continue`, and not `--ours`/`--theirs`.
  - Exit-status table: add "other non-zero: an unexpected failure, logged by the ERR trap".
  - Measurement: take both samples between two ticks (a tick restarts `poe-sync` and resets its counters), or stop the timer for the window.
  - Reinstall the units after a pull changes `ops/pi/*.service`, `ops/pi/*.timer` or the `sync` script in `package.json`.
- [x] `test/pi-tick.test.ts` -- vitest, `describe.skipIf(process.platform === 'win32')`. Drive `ops/pi/tick.sh` and `ops/pi/set-poesessid.sh` with `spawnSync('bash', …)` against an `mkdtempSync` bare remote, a "PC" clone and a "Pi" clone, with a fake `pnpm`, `systemctl` and `sudo` first on `PATH`. The tests use the repo's real `.githooks`. Cover every matrix row. Also cover: a leftover local commit is pushed; ignored files are not drift; a failed install retries; a failed push after a lockfile change has already installed; detached HEAD exits 2; the ERR trap logs; `set-poesessid.sh` keeps other lines, never prints the value, refuses an empty one, and skips the restart when the fake reports `ActiveState=activating`; the remote reflog shows no forced update. No network.

**Acceptance Criteria:**
- Given the proposal, when the docs commit lands, then A1/A2/A3/G1 text matches it and the spine reads `revision: 42`.
- Given `ops/pi/`, when grepped, then it holds no `--force`, no secret and no real host, user or address.
- Given `pnpm check`, when run, then it passes.

## Verification

**Commands:**
- `bash -n ops/pi/*.sh`, plus `shellcheck` (`uvx --from shellcheck-py shellcheck`) -- clean.
- `test/pi-tick.test.ts` covers every matrix row. It is skipped on Windows, so locally run its scenarios once in Git Bash (for example, the scratch harness) and check that CI's `pnpm check` on Linux runs the file and passes.
- `pnpm check` -- passes.

No agent browser checks: the change touches only `docs/`, `AGENTS.md` and `ops/`, which neither the page nor its data reads.

## Implementation Notes

- **Deviation, `poe-sync.service` ExecStart.** The unit runs the `sync` script's command with `node` as its main process, not `pnpm sync`. Under pnpm (Corepack shim → pnpm → shell → node), the wrapper exits on the stop SIGTERM. systemd then enters `final-sigterm` and signals the cgroup again, and a second SIGTERM gets Node's default handling in `sync.ts` `main`, so sync dies mid-entry. With `node` as main, a stop sends exactly one SIGTERM. The first-run checklist checks this (`pnpm sync: stopped`, `status=0/SUCCESS`).
- **Lockfile reinstall.** `tick.sh` compares `HEAD:pnpm-lock.yaml` with a stamp of the last installed blob (`.git/poe-tick-installed-lockfile`), not before and after the pull, so a failed install retries on the next tick. Exit codes: 2 setup, 3 drift, 4 pull/rebase, 5 push, 6 install.
- **Additions not in the task list:** `TimeoutStartSec=45min` on the tick (the stop alone can take 15 min); a kernel cmdline step `cgroup_enable=memory cgroup_memory=1`, because Raspberry Pi kernels ship with the memory cgroup off and `MemoryMax` would otherwise do nothing; placeholders `<repo-ssh-url>` and `<noreply-email>`. `set-poesessid.sh` skips its restart while a tick runs, because the tick's `ExecStopPost` starts the service.
- **Commits.** `8b9166e` is the docs commit (A1/A2/A3/G1 plus the proposal). `ops/pi/` is staged with mode 100755 on both scripts (`core.filemode=false` on this checkout).
- **Verification (pre-review).** `bash -n` and `shellcheck` (via `uvx --from shellcheck-py`) are clean. The scratch harness `C:\Users\ilyal\AppData\Local\Temp\claude\E--Program-Files-Jetbrains-Projects-poe-crafting-base-price-checker\235853ba-c798-47be-be7f-35d289674611\scratchpad\harness.sh` uses a bare remote, a PC clone and a Pi clone, the real commit-msg and pre-push hooks, and a fake pnpm and systemctl. It covers every matrix row plus a leftover local commit, ignored files, the runbook's conflict recovery, an install retry, detached HEAD, the ERR trap and `set-poesessid.sh`. It printed ALL PASS. `pnpm check` passed (implementation run).
- **Known limits.** Nothing ran on a Pi (decision). A pull that changes a unit file needs a manual reinstall of the units (runbook §2). Pausing sync needs the timer stopped too (runbook §3).
- **Loop 0 reverted (review, bad_spec).** `ops/pi/` was removed from the index and the tree for re-derivation. The loop-0 files and the scratch harness are kept at `C:\Users\ilyal\AppData\Local\Temp\claude\E--Program-Files-Jetbrains-Projects-poe-crafting-base-price-checker\235853ba-c798-47be-be7f-35d289674611\scratchpad\keep-ops-pi\`. Docs commit `8b9166e` stays.

- **Round-2 review patches (2026-10-25).** All 12 patch rows (25–27, 30–32, 35–37, 39, 42, 45) are applied. Deviation: the `set-poesessid.sh` tests moved to `test/pi-set-poesessid.test.ts` to stay under the 300-line lint limit. `test/pi-tick-sandbox.ts` holds the shared helpers. Verification after the patches: `bash -n` and shellcheck are clean. An unskipped copy of both test files ran in Git Bash on Windows: 25 of 27 pass. The two failures are the mode-600 assertions, because Windows has no POSIX modes. `pnpm check` passes 8 of 8 (the pi tests are skipped on win32, and CI on `ubuntu-latest` runs them). The new no-force case was shown to fail when `--force` was added to the push.

## Spec Change Log

- **Loop 1 (2026-10-25).** Trigger: verification-gap finding. `tick.sh` pushes to `master` unattended, yet only a scratch harness outside the repo tested it, so a regression (drift guard, force-push, conflict handling) would pass `pnpm check` unseen. The old Verification asked for no committed test. Amended: Tasks gain `test/pi-tick.test.ts`, and Verification names it. Review fixes that were folded into Tasks: install before push; stale lock cleared at unit start; `KillMode=mixed`; network ordering on the tick; `ActiveState` tick detection; runbook host-key, pause/resume, PC hand-off, recovery, exit-table, measurement and unit-reinstall wording. Code Map gains the lock and test-precedent facts. Known-bad state avoided: an untested unattended pusher, and every verified runbook defect. **KEEP:** start from the loop-0 files in the `keep-ops-pi` folder named in Implementation Notes and change only what the amended Tasks name. Keep: the structure of `tick.sh` (functions, exit codes 2–6, the stamp-based install, the drift parse of `git status --porcelain=v1 -z --untracked-files=all --no-renames`); `node` as the unit's main process; the `+` pre/post stop-start in the tick unit; `set-poesessid.sh`'s awk rewrite through a mode-600 temp file; the runbook's sections, HUMAN markers, placeholders and first-run checklist. Port the scratch harness `harness.sh` into the vitest test instead of writing a new one.

## Review Triage Log

| # | Layer | Finding | Verdict | Route / evidence |
|---|---|---|---|---|
| 1 | verification-gap | `tick.sh` only tested by an out-of-repo scratch harness | medium | bad_spec. The gap was pre-verified; `tools/check/check.ts` STEPS run no such test, and the spec's Verification chose the harness. |
| 2 | verification-gap, blind, edge | `set-poesessid.sh` `is-active` never sees a running oneshot tick (`activating`) | low | Folded into loop 1. True per systemd oneshot semantics. The outcome stays correct, but the message is wrong and a `try-restart` can collide with the tick's stop job. |
| 3 | verification-gap, edge | Install runs after the push, so a failed push leaves pulled code on old deps | medium | Folded. `main` order is pull, push, install, and `die 5` skips the install. |
| 4 | blind | An install failure itself leaves new code on old deps | low | Rejected. Needs a pull rollback branch. It is rare (network failure during install), and the next tick retries. |
| 5 | blind, edge | Spine diagram edge "player commits + pushes" (L1774) and the deferred item "A publish command" (L1907) still describe human-only publishing | medium | Deferred as [NOTE FOR ARCHITECT]. The text is confirmed, but it lies outside the approved A1–A3, and the Review brief bars editing an owner document. |
| 6 | blind, edge | PRD L443/L549 contradict an unattended tick | false | The operator is the player, and the Pi is the player's own host. The product still commits nothing (AD-3 "hand"). No capability, promise, scope or OQ changed (AGENTS.md rule). |
| 7 | blind | One-syncer rule only in the runbook, not the spine | false | The approved proposal (W1) puts the per-checkout lock note in the runbook on purpose. Out of scope by intent. |
| 8 | blind, edge | No JSON-validity check before the commit; a truncated or deleted file gets pushed | low | Rejected. The forged idea rejects "a JSON-validity guard in the tick", and `deploy.yml` `pnpm check` keeps a bad file off the site. |
| 9 | blind | PC hand-off procedure guarantees a rebase conflict; "keep the Pi data" default is wrong for it | medium | Folded. Confirmed: pause leaves uncommitted Pi data, which conflicts with the PC's push on resume. |
| 10 | blind | Conflict recipe handles one rebase stop only; `--ours` leaves an empty commit | low | Folded. N failed ticks leave N commits that each touch `dataset.json`. The fix is a doc correction. |
| 11 | blind, edge, ledger | Pause via `stop` does not survive a reboot; a manual tick restarts a paused sync | medium | Folded (`disable --now`/`enable --now` + caveat). Enabled units start at boot. |
| 12 | blind | Tick unit has no network ordering; `Persistent=true` fires at boot | low | Folded. A direct one-line fix. |
| 13 | blind | No alerting on failure | low | Rejected. The forged idea rejects an attention signal (cookie record, ntfy push). |
| 14 | blind, edge | Unit hard-codes the `sync` command, which can drift from `package.json` | low | Folded as a runbook reinstall rule. A direct doc correction. |
| 15 | blind | Exit table omits ERR-trap statuses | low | Folded. A direct one-row correction. |
| 16 | blind | SD wear unmitigated | low | Rejected. The forged idea accepts it as an open risk, with a high-endurance card as the answer. |
| 17 | edge | Rebase textually merges two syncers' JSON | low | Rejected. Needs two syncers, which the runbook forbids. The guard adds branches. |
| 18 | edge | A manual commit on the Pi with a non-owned path bypasses the drift guard | low | Rejected. Nobody commits on the Pi (forged idea). The guard adds a branch. |
| 19 | edge | A stale `data/sync.lock` after a power cut or SIGKILL blocks sync for up to 6 h | medium | Folded (`ExecStartPre` rm). `lock.ts` is stale by time alone (6 h). |
| 20 | edge | The default `KillMode` sends SIGTERM to the git child of an in-flight entry | low | Folded. A direct one-line fix (`KillMode=mixed`). |
| 21 | edge | `ssh-keyscan` appended before the fingerprint is compared | low | Folded. A direct doc correction to the trust step. |
| 22 | edge | Measurement samples straddle a tick that resets the counters | low | Folded. A direct doc correction. |
| 23 | ledger | Pi provisioning, first-run checklist and CPU/memory measurement owed | medium | Deferred (`never — needs a human`). The human decision moved them out of this run. |
| 24 | ledger | Tick does not reinstall changed units | low | Rejected as work; documented by row 14's runbook rule. Auto-reinstall needs root logic in the tick for a rare change. |
| 25 | verification-gap (r2) | The no-force reflog check cannot see a `--force` push, because the pull makes every push a fast-forward | medium | Patch. Pre-verified: no test moves the remote between the pull and the push. Add a case where the fake `pnpm` pushes a PC commit in that window: expect exit 5, the PC commit kept, the reflog clean. |
| 26 | blind, edge (r2) | The test sandbox inherits `POE_REPO_DIR` and `FAKE_*`, so the no-arg test could tick a real checkout | low | Patch. `Sandbox` strips only `GIT_*` and `EMAIL`. A direct filter fix. |
| 27 | blind, edge (r2) | Pause and recovery do not wait for an in-flight tick, whose `ExecStopPost` restarts `poe-sync` after the pause | medium | Patch (runbook). `systemctl start` starts a disabled unit. The tick's stop alone can last up to 15 min. Disable the timer, wait until the tick is inactive, then disable `poe-sync`. |
| 28 | edge (r2) | No `flock` in `tick.sh` against two ticks | low | Rejected. With row 27's pause procedure, *Tick by hand* runs only while the timer is off and no unit tick is in flight. A lock adds a branch. |
| 29 | blind (r2) | *Tick by hand* does not check that `poe-sync` is idle | low | Rejected. The runbook states the precondition. A guard would also need a fake-state branch in the tests. |
| 30 | blind (r2) | Tick unit not ordered after `time-sync.target`; a boot catch-up tick runs before NTP | low | Patch. The Pi 3B has no RTC. A direct one-line fix (same reason as row 12, a different target). |
| 31 | blind (r2) | `TimeoutStopSec` comment ignores penalty waits and several waits per entry | low | Patch (comment only). `ledger.ts` `paceBeforeNext` has `cause: 'penalty'`. State the real reason: a SIGKILL during a pacing wait loses that entry only, with no write in flight. |
| 32 | blind (r2) | The power-cut checklist expects the JSON check to pass, though the runbook says a cut can truncate | low | Patch. A direct checklist correction: a pass is `poe-sync` active and either a valid JSON check or the truncation recovery done and recorded. |
| 33 | blind (r2) | No deferred entry for atomic writes in sync | low | Rejected. The forged idea rejects "Atomic artifact write". |
| 34 | blind (r2) | No `systemd-analyze verify` of the units in CI | low | Rejected. Needs new CI machinery for placeholder units. The first-run checklist (deferred) exercises them. |
| 35 | blind (r2) | `set-poesessid.sh` tests miss whitespace refusal, a missing `.env`, and output on refusal | low | Patch. Test-only additions. |
| 36 | blind (r2) | `tick.sh` tests miss the other-branch exit 2; a deleted owned file; a newline in a drift path | low | Patch for the other-branch case only. The deleted file falls under row 8. A newline path is implausible on the Pi. |
| 37 | blind (r2) | Checklist quotes `git push --no-verify origin master`, but the script reads `"$REMOTE" "$BRANCH"` | low | Patch. A direct wording fix. |
| 38 | blind (r2) | Spec cites session scratchpad paths | low | Rejected: the fix edits this build's spec (step-04 rule). |
| 39 | blind (r2) | README opening and unit `Description=` say `pnpm sync`, but the unit runs `node` | low | Patch. A direct wording fix. The spine's "`pnpm sync` session" names the command the unit runs and stays. |
| 40 | blind (r2) | Spine "only the sync host runs sync" vs the PC hand-off | false | During a hand-off the PC is the sync host, and one host syncs at a time. No contradiction. Spine edits are out of this build's approved text in any case. |
| 41 | blind (r2) | `Restart=always` restarts forever on a config error | low | Rejected. Alerting was rejected by the forged idea. The journal shows it, and the first-run checklist covers start-up. |
| 42 | edge (r2) | `cd` to a missing repo dir exits 1 via the ERR trap, not 2 | low | Patch. A direct `|| die 2`. |
| 43 | edge (r2) | Repo dir given as `.git` or a subdirectory passes the guard | low | Rejected. The unit passes a fixed top-level path. |
| 44 | edge (r2) | Race between the `ActiveState` read and `try-restart` in `set-poesessid.sh` | low | Rejected. A sub-second window during a rare manual rotation. The fix adds a branch. |
| 45 | edge (r2) | A pnpm modules purge without a TTY aborts the install, so every tick exits 6 before the push | medium | Patch. pnpm's `confirmModulesPurge` prompt aborts with no TTY. With the install now before the push, publishing would stop until someone noticed. Add `--config.confirm-modules-purge=false`. |
| 46 | edge (r2) | Engines bump without a lockfile change runs an unsupported Node | low | Rejected. Unlikely, and the guard needs a semver dependency. |
| 47 | edge (r2) | Unconditional lock `rm` at unit start defeats a manual `pnpm sync` in the same checkout | low | Rejected. One syncer per checkout is the operating rule, and pid probing adds logic. |
