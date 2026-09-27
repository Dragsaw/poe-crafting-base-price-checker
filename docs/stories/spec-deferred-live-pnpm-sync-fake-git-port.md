---
title: 'Confirm the live pnpm sync composes the read-only git port'
type: 'chore'
created: '2026-09-27'
status: 'done'
baseline_revision: 'dad50fd7894b354666f3ace88f3d5e6c221959c5'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The deferred-work ledger still holds the story 1.11 entry "The live `pnpm sync` runs on the in-memory fake git port … A real read-only git adapter is owed." The adapter has since landed on `master` (commits `e15297bb9b01e6eb53fc1a66d17ea0f618c274c6` and `9966620`, spec `docs/stories/spec-deferred-live-sync-runs-on-fake-git-port.md`, status `done`), but no commit removed the entry.

**Approach:** Verify from the repository that the entry's summary is already false. Make no code change. The caller removes the ledger entry.

## Boundaries & Constraints

**Always:** Judge only from the files on `HEAD` and their tests. The summary is false when both live composition roots pass `createReadOnlyGitPort(REPO_ROOT)` as `git`, and the spawn exemption in `no-git-write.test.ts` names only `git/read-only-git-port.ts` and lifts only the spawn rule.

**Never:** Edit `docs/stories/deferred-work.md` or `docs/stories/sprint-status.yaml`. Change `packages/sync/src/dry-run.ts`: the dry run is offline by design and keeps `createFakeGitPort()`. It is not the live `pnpm sync`. Edit the source spec of story 1.11 or the done spec of the adapter.

</intent-contract>

## Code Map

- `packages/sync/src/sync.ts:621` -- live `pnpm sync` session composition root; passes `git: createReadOnlyGitPort(REPO_ROOT)`.
- `packages/sync/src/sync-batch.ts:91` -- live `pnpm sync:batch` (one-chunk) composition root; passes `git: createReadOnlyGitPort(REPO_ROOT)`.
- `packages/sync/src/git/read-only-git-port.ts` -- the real `GitPort`: one fixed `execFile('git', ['--no-optional-locks','log','--no-show-signature','-1','--format=%at','--',path])`.
- `packages/sync/src/git/read-only-git-port.test.ts` -- tests the port against a temporary repository (author date, no history, not a repository).
- `packages/sync/src/no-git-write.test.ts:24-75` -- `EXEMPTIONS` holds exactly `git/read-only-git-port.ts` → `['a process spawn']`, and a test pins that file to the read-only call.
- `packages/sync/src/dry-run.ts:258` -- read-only evidence: offline dry run, keeps the fake port on purpose.

## Tasks & Acceptance

**Execution:**
- (no file change) -- run the Verification commands and inspect the two composition roots -- the work the entry asks for is already on `master`, so the smallest change that makes the summary false is none.

**Acceptance Criteria:**
- Given `HEAD`, when `grep -n "createFakeGitPort\|createReadOnlyGitPort" packages/sync/src/sync.ts packages/sync/src/sync-batch.ts` runs, then each file shows `createReadOnlyGitPort` in its composition root and neither shows `createFakeGitPort`.
- Given `HEAD`, when the sync package tests for the port and the no-git-write scan run, then they pass.
- Given the change set of this run, when it is diffed against the baseline, then it holds only this spec file.

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 12 findings — high 0, medium 0, low 0, false 12, maybe-false 0
- findings:
  - `false` `reject` The grep criterion covers only two files, so another live composition root could still use the fake port — refuted: in non-test sources under `packages/sync/src`, `createFakeGitPort` appears only at `dry-run.ts:258`, the offline dry run. The fix is also an edit to this build's spec.
  - `false` `reject` Nothing checks that HEAD holds the adapter commits — refuted: the Verification commands run on the files at HEAD, and `e15297b` and `9966620` are ancestors of HEAD. The fix is a spec edit.
  - `false` `reject` No test shows that the tracked-list age resolves to `git-author-date` — refuted: the `read-only-git-port.test.ts` case "dates a nested repo-relative path through resolveTrackedListAge as git-author-date" asserts this through the real port, and it ran in Verification.
  - `false` `reject` The spec gives no line or issue number for the entry — no bad outcome in code. The caller identifies the entry by its fields. The fix is a spec edit.
  - `false` `reject` No hand-off says that the removal goes in the last commit of the branch — no bad outcome. The procedure of the caller owns that rule. The fix is a spec edit.
  - `false` `reject` The status is in-review with no recorded results — Finalize records the results under Auto Run Result. The fix is a spec edit.
  - `false` `reject` The two commits are cited in different hash forms — cosmetic, with no bad outcome. The fix is a spec edit.
  - `false` `reject` The follow-up review of the adapter is not accounted for — `9966620` (`fix(sync): follow-up review patches…`) is that follow-up, and it is on HEAD. The fix is a spec edit.
  - `false` `reject` The Never list is hard to parse — no bad outcome. The fix is a spec edit.
  - `false` `reject` The Code Map line numbers will go stale — they are as of `baseline_revision`. The fix is a spec edit.
  - `false` `reject` The Verification expectations are underspecified (dry-run left out, working directory) — the Never list names the dry-run exclusion, and the commands run from the repository root. The fix is a spec edit.
  - `false` `reject` Intent alignment: only inference covers the runtime outcome (reading R4) — refuted: the resolveTrackedListAge test above observes `git-author-date` through the real port, and both live roots compose that port.

## Verification

**Commands:**
- `grep -n "createFakeGitPort\|createReadOnlyGitPort" packages/sync/src/sync.ts packages/sync/src/sync-batch.ts` -- expected: two `import` lines and two `git: createReadOnlyGitPort(REPO_ROOT)` lines; no `createFakeGitPort`.
- `pnpm vitest run packages/sync/src/git/read-only-git-port.test.ts packages/sync/src/no-git-write.test.ts` -- expected: all tests pass.

## Auto Run Result

Status: done

- **Change:** none to code. The summary of the entry is already false on HEAD `dad50fd7894b354666f3ace88f3d5e6c221959c5`. `pnpm sync` (`sync.ts:621`) and `pnpm sync:batch` (`sync-batch.ts:91`) compose `createReadOnlyGitPort(REPO_ROOT)`. Commits `e15297b` and `9966620` landed the port under `spec-deferred-live-sync-runs-on-fake-git-port.md`.
- **Files changed:** this spec only.
- **Review:** 12 findings, all rejected as false (see Review Triage Log). 0 patches, 0 deferred.
- **Follow-up review recommended:** false, because no patch was applied.
- **Verification:** the grep shows two imports, two `git: createReadOnlyGitPort(REPO_ROOT)` lines and no `createFakeGitPort`. `pnpm vitest run packages/sync/src/git/read-only-git-port.test.ts packages/sync/src/no-git-write.test.ts` passed: 2 files, 15 tests.
- **Residual risk:** none named.
