---
title: 'OpenWiki auto-PR stages only the openwiki folder'
type: 'chore'
created: '2026-09-27'
status: 'done'
baseline_revision: 'f96b908d6a47cdc1243b043f51c4be606ad140d2'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      `peter-evans/create-pull-request` carries commits already made on the checked-out HEAD into the PR branch, and `add-paths` filters only uncommitted changes, so if `openwiki code --update` commits locally it can still put `AGENTS.md`, `CLAUDE.md` or the workflow file into the auto-PR.
    evidence: |-
      Unverified. `add-paths` in `.github/workflows/openwiki-update.yml` now lists only `openwiki`, but nothing in the workflow checks that HEAD still equals `github.sha` before the `create-pr` step. To settle it, find out whether `openwiki@0.6.0` (`openwiki code --update --print`) or its model can run `git commit`. If it can, add a step before `create-pr` that refuses or soft-resets any commit on top of `github.sha`.
    location: >-
      .github/workflows/openwiki-update.yml:55-61
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** The `Create OpenWiki update pull request` step of `.github/workflows/openwiki-update.yml` lists `AGENTS.md`, `CLAUDE.md` and `.github/workflows/openwiki-update.yml` in `add-paths`, next to `openwiki`. So the unattended model that runs `openwiki code --update` can put changes to the agent instruction files and to its own workflow into the auto-PR (retro F20, review A16).

**Approach:** Narrow `add-paths` to `openwiki` only. The model's edits to any other path stay in the runner and do not reach the PR.

## Boundaries & Constraints

**Always:** Keep every other step, input and pin of the workflow unchanged. `openwiki/.run.json` stays removed by its own step before the PR step.

**Never:** Do not edit `AGENTS.md`, `CLAUDE.md`, `docs/stories/deferred-work.md`, `docs/stories/sprint-status.yaml` or any file under `openwiki/`. Do not add a replacement path for the instruction files (for example a separate PR for them). Do not change the trigger, permissions or action pins.

</intent-contract>

## Code Map

- `.github/workflows/openwiki-update.yml:55-64` -- the `create-pr` step; `add-paths` is a block scalar with four lines (`openwiki`, `AGENTS.md`, `CLAUDE.md`, `.github/workflows/openwiki-update.yml`). Only the first line stays.
- `docs/stories/epic-2-retro-2026-09-27.md:94` -- F20, read-only: "Defer: narrow `add-paths`."
- `docs/reviews/review-epic-2-diff.md:26` -- A16, read-only: the finding and its consequence ("Agent instruction files are rewritten casually").
- No test or tool reads `add-paths`; `grep -rn add-paths` outside `openwiki/` finds only the workflow and the review/retro/ledger text.

## Tasks & Acceptance

**Execution:**
- `.github/workflows/openwiki-update.yml` -- in the `create-pr` step, set `add-paths` to the one path `openwiki` -- the PR can then hold only generated wiki pages.

**Acceptance Criteria:**
- Given the edited workflow, when the `create-pr` step's `add-paths` is read, then it lists exactly `openwiki`, and `AGENTS.md`, `CLAUDE.md` and `.github/workflows/openwiki-update.yml` appear nowhere in it.
- Given the edited workflow, when it is diffed against `origin/master`, then the only change is the removal of those three `add-paths` lines.

## Verification

**Commands:**
- `git diff origin/master -- .github/workflows/openwiki-update.yml` -- expected: three removed lines, no added lines.
- `pnpm check` -- expected: exit 0.
- `pnpm test` -- expected: exit 0.

**Manual checks (if no CLI):**
- `add-paths` in the `create-pr` step reads `openwiki` and nothing else, and the YAML block stays well-formed (`branch:` follows at the same indent).

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 12 findings — high 0, medium 0, low 5, false 3, maybe-false 4
- findings:
  - `[maybe-false]` `[reject]` (blind) OpenWiki's managed `## OpenWiki` block in `AGENTS.md`/`CLAUDE.md` is now dropped without notice — no `docs: update OpenWiki` commit on master has ever touched either file (`git log -- AGENTS.md CLAUDE.md` shows only the install commit 3d9f10b), so it is open whether the tool rewrites them; settle by running `openwiki code --update` and diffing those files. If true the harm is a stale static pointer block (low), and dropping those edits is what the retro F20 remedy asks for.
  - `[low]` `[reject]` (blind) Dropped edits outside `openwiki/` leave no trace — true, but a warning step adds a workflow branch for a case not shown to occur.
  - `[low]` `[reject]` (blind) No regression guard for `add-paths` — true; a test would read YAML text only, which proves no workflow behavior, and adding a YAML parse test is more than a direct correction.
  - `[low]` `[reject]` (blind) The diff check compares against `origin/master`, not `baseline_revision` — the fix edits this build's spec.
  - `[false]` `[reject]` (blind) The ledger entry is never removed — the intent says the caller maintains `docs/stories/deferred-work.md`; the sweep's last branch commit removes it.
  - `[low]` `[reject]` (blind) Frontmatter `context` is empty — the fix edits this build's spec; the Code Map already cites F20 and A16.
  - `[maybe-false]` `[reject]` (blind) The Problem overstates the workflow-file risk, since `GITHUB_TOKEN` usually cannot push `.github/workflows/` changes — the fix edits this build's spec, and the change removes the path either way.
  - `[maybe-false]` `[defer]` (edge) `create-pull-request` carries local commits on HEAD into the PR, and `add-paths` does not filter them — pre-existing and not caused by this change; open whether `openwiki code --update` commits. Deferred as medium (unverified) with what would settle it.
  - `[maybe-false]` `[reject]` (edge) Generator-managed pointer blocks go stale silently — same claim and evidence as the first blind row.
  - `[low]` `[reject]` (edge) A run that changes only paths outside `openwiki/` opens no PR and prints no annotation — no PR is the intended result, and an annotation step adds complexity for a rare, harmless case.
  - `[false]` `[reject]` (edge) An open `openwiki/update` PR may already hold instruction-file edits — `gh pr list --base master --state open` lists no open PR.
  - `[false]` `[reject]` (intent) Divergence from reading R2 (keep the pointer-block refresh) — the entry names all three files as the defect and prescribes "Narrow `add-paths`"; the diff implements reading R1, which the entry's text selects.

## Auto Run Result

- Summary: the `create-pr` step of `.github/workflows/openwiki-update.yml` now has `add-paths: openwiki` only, so the auto-PR can no longer stage `AGENTS.md`, `CLAUDE.md` or the workflow file.
- Files changed:
  - `.github/workflows/openwiki-update.yml` -- removed the three `add-paths` lines `AGENTS.md`, `CLAUDE.md`, `.github/workflows/openwiki-update.yml`.
  - `docs/stories/spec-deferred-openwiki-update-lets-model-stage-agents.md` -- this spec.
- Review findings: 0 patches applied. 1 item deferred (local commits bypass `add-paths`, medium unverified). 11 rejected, each with its reason in the Review Triage Log above.
- Follow-up review recommendation: false (0 patched entries: high 0, medium 0, low 0).
- Verification: `git diff` against the baseline shows three removed lines and no added lines in the workflow. `pnpm check` exit 0. `pnpm test` exit 0 on the implementer's third run (102 files, 1431 tests); runs 1 and 2 each failed once in unrelated tests (`sync-report.test.ts` Windows `EBUSY` on a `node_modules` file; `shell-fetch.test.ts` got `TypeError` in place of `TimeoutError`), and both files pass alone.
- Residual risks: the deferred local-commit path; no workflow run has observed the narrowed PR contents.
