---
name: deferred-work-sweep
description: One unattended pass over docs/stories/deferred-work.md. Picks one eligible entry and builds it with bmad-build-auto in a git worktree. On success, removes the entry and opens a pull request with the work. On failure, opens a pull request that marks the entry with the blocker and a retry condition. Never writes to master. Use when invoked by name.
---
# Deferred work sweep

You run unattended. Never ask a question. Each path through this procedure ends with the report in section 6. `AGENTS.md` applies at all steps.

## Rules for all steps

- Never write to `PRIMARY_BRANCH`, locally or on `REMOTE`. Each result of a run reaches `PRIMARY_BRANCH` only when a human merges its pull request.
- Run `git push` only in steps 4.3, 4.4 and 5.4, and only in the forms that those steps give. Never push with `--force` or `--force-with-lease`.
- Never run `git reset --hard`, `git clean` or `rm -rf`. The one exception is `DROP_DEPS`, which deletes only the `node_modules` directories of `WT_PATH`.
- Never edit files under `PRIMARY` directly. The only commands that this file runs on `PRIMARY` are `git fetch` (section 1), `git worktree remove` and `git branch -d` / `-D` (steps 4.5 and 5.6).
- Never run an `--abort` in `PRIMARY`. An operation in progress in `PRIMARY` belongs to a human.
- Never change `docs/stories/sprint-status.yaml`.
- Write each commit message to `MSG_FILE` with the Write tool, then run `git commit -F "<MSG_FILE>"`. Never put a message on the command line: a summary can contain backticks, `$` or `{}`. If the PR mechanism takes its body through a shell command, pass the body through a file in `<TMP>` in the same way. End each commit message with `ATTRIBUTION` and each PR body with `PR_ATTRIBUTION`.
- This file names pull request operations ("list the open PRs", "open a PR", "open a PR as a draft") but not the mechanism that does them. Use the mechanism that the session provides for the hosting service of `REMOTE`.
- The network use of `git fetch`, `git push` and the PR operations in this file is the sweep's own. It does not make an entry that needs network access eligible (condition 3 of section 1).
- A "go to section N" instruction names a top-level section of this file. This file writes a numbered step inside a section as "step N.M".
- While the session is in the worktree, the harness isolates it. It refuses three kinds of call:
  - a git command that targets `PRIMARY`, for example `git -C "<PRIMARY>" ...`
  - a write to a path under `PRIMARY` that is outside the worktree. This includes the git directory of the worktree, `<PRIMARY>/.git/worktrees/...`.
  - a git command that it cannot verify. Run each git command as a separate Bash call, with literal values. Do not use variables, pipes, redirects, `;` or `&&` in it.

  Thus this file runs each command on `PRIMARY` only after the session has left the worktree with `ExitWorktree` (steps 4.5 and 5.5).

## Fixed names

- `LEDGER` = `docs/stories/deferred-work.md`
- `PRIMARY_BRANCH` = `master`
- `REMOTE` = `origin`
- `BASE` = `origin/master`, the remote-tracking branch. Every read of the ledger and every rebase uses `BASE`, not the local `PRIMARY_BRANCH`: merges happen on the remote, so the local branch can be behind.
- `PRIMARY` = the main working tree. Get it with `git worktree list --porcelain | sed -n '1s/^worktree //p'`. The path contains spaces, so always quote it.
- `TODAY` = the date of today as `YYYY-MM-DD`
- `HHMMSS` = the local time at the start of section 2, as hours, minutes and seconds with two digits each. Set it once and reuse it.
- `ATTRIBUTION` = the `Co-Authored-By` line from the attribution reminder of the session
- `PR_ATTRIBUTION` = the pull request line from the attribution reminder of the session
- `<TMP>` = the output of `node -p "require('os').tmpdir()"`. Files there are outside the repository, so git does not track them, and the isolated session can write them. Do not use the git directory of the worktree: it is under `PRIMARY`, so the harness refuses the write.
- `MSG_FILE` = `<TMP>/dw-commit-msg-<ITEM_SLUG>.txt`
- `PR_BRANCH` = `deferred/<ITEM_SLUG>-<TODAY>-<HHMMSS>`, the remote branch of the work PR. `MARK_PR_BRANCH` = `<PR_BRANCH>-mark`, the remote branch of the marker PR. Both names are new in each run, so a push never updates an existing remote branch.
- `DROP_DEPS` = the command below. Replace `<WT_PATH>` and keep the quotes. Run it only when `WT_PATH` is set and is not `PRIMARY`. It deletes the root `node_modules` and each `packages/*/node_modules` of the worktree.
  ```
  node -e "const fs=require('fs'),p=require('path'),r=process.argv[1];for(const d of ['node_modules',...fs.readdirSync(p.join(r,'packages')).map(n=>p.join('packages',n,'node_modules'))])fs.rmSync(p.join(r,d),{recursive:true,force:true})" "<WT_PATH>"
  ```

  Run `DROP_DEPS` before each removal of the worktree: `ExitWorktree` with `remove`, or `git worktree remove`. On Windows, pnpm links packages with directory junctions. Git for Windows deletes a junction target before the junction that points to it, and it cannot delete a dangling junction. It then stops with "Directory not empty", after it has already unregistered the worktree. Node deletes a junction as a link, so after `DROP_DEPS` git removes the directory. If `DROP_DEPS` fails, continue with the removal: git then reports the failure.

An **entry** is one `- source_spec:` bullet in `LEDGER` that has a `summary:` line and an `evidence:` line. An entry can also have `auto_attempt:`, `retry_when:` and `integrate_branch:` lines from an earlier run. A **note** is any other bullet, or an entry whose summary only describes a different entry. The fields of an entry are the text after `source_spec:`, `summary:` and `evidence:`.

Each PR that this file opens starts its body with the line `Deferred entry: <ITEM_SUMMARY>`, verbatim. Section 1 finds the entries that have a pending PR by this line.

Later sections use these named values. The section in brackets sets each value:

- `ITEM_*`, `PENDING_PRS` (section 1)
- `CREATED_WT`, `WT_PATH`, `WT_BRANCH`, `START_SHA` (section 2)
- `SPEC_FILE`, `BUILD_STATUS`, `BLOCKER`, `FOLLOWUP` (section 3)
- `FAILED_STEP`, `COMMITS`, `PR_URL` (sections 4 and 5)
- `RETRY_WHEN`, `INTEGRATE_BRANCH` (section 5)

If a path does not set a value, the report shows `none` for it.

## 1. Pick one entry

Set `PRIMARY` now, before the session enters a worktree. Then do these checks. If a check fails, go to section 6 with the outcome in brackets. No worktree exists yet, so nothing needs cleanup.

1. The session must have a working way to list and open PRs on `REMOTE`. (`aborted: no PR mechanism available`) Each outcome of a run is a PR, so a run without one cannot deliver anything.
2. `git fetch origin master` must succeed. (`aborted: git fetch failed` and the first error line)
3. Set `PENDING_PRS` = all open PRs against `master` whose head branch starts with `deferred/`, with the URL, head branch and body of each. If the list fails: (`aborted: PR list failed` and the first error line)

Read `LEDGER` as it is on `BASE`: `git show origin/master:docs/stories/deferred-work.md`. All worktrees share the refs, so this command gives the same result in each of them. Do not read the working copy in `PRIMARY`, because it can hold uncommitted edits.

Take the **first** entry, from top to bottom, for which none of the skip conditions below is true. Examine exactly one entry in each run. Never take a second entry, whatever the outcome.

Skip an entry if one or more of these conditions is true:

1. The entry is a note: its summary reports a resolution, a correction, a withdrawal or a retirement of a different entry. Also skip the entry if any bullet in `LEDGER` says that a person or a run resolved, retired or withdrew this entry. Such a bullet can name the entry by its text, by its source spec or by position ("the entry above"). If two notes disagree about the entry, skip it.
2. The entry has an `auto_attempt:` line, and one of these is true:
   - The entry has no `retry_when:` line, or the line is not one of the forms in step 5.2.
   - The `retry_when:` condition is not true now. Check it from the repository only. "The repository" means `sprint-status.yaml` and the files as they are on `BASE`, and the git history, and nothing else.
   - The `auto_attempt:` line has the date `TODAY`.
   - The `auto_attempt:` line records attempt 3 or higher.
3. The entry needs one of these:
   - the live trade API
   - network access
   - a run of `pnpm sync` or `pnpm catalogue:refresh`
   - a decision that belongs to a human, for example the value of a hand-edited `data/` entry

    `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md` forbids an agent to use the first three unattended.
4. The entry needs a change to a PRD requirement, an architecture decision (`AD-n`) or a scope boundary. These changes go through `bmad-correct-course` with a human, not through this sweep. Exception: some entries ask only for a text edit to a mechanism. If a story already decided and recorded that edit as owed, the entry is eligible.
5. The entry cites a `Story n.n` id, and `docs/stories/sprint-status.yaml` does not list that story as `done`. Apply this condition only to an entry that cites such an id.
6. The text of the entry says that it waits for a precondition that is not yet true. Examples are "a machine-readable Stack table" and "revisit when Story 3.3 lands".
7. You judge that the entry needs more than one implementation session. One session must be sufficient to understand, implement, review and test it. Record each entry that you skip for this reason, with one line of reason, for the `notes` line of the report.
8. A PR in `PENDING_PRS` has a body whose first line is `Deferred entry: ` followed by the `summary:` field of this entry, verbatim. An earlier run already delivered a work PR or a marker PR for the entry, and a human has not merged or closed it yet. Record the PR URL for the `notes` line of the report.

If no entry is eligible, go to section 6 with the outcome `nothing eligible`.

If an entry is eligible, set these values:

- `ITEM_SOURCE_SPEC`, `ITEM_SUMMARY`, `ITEM_EVIDENCE` = the three fields of the entry, verbatim.
- `ITEM_SLUG` = a kebab-case slug of `ITEM_SUMMARY`. Use only `a-z`, `0-9` and `-`, a maximum of six words and a maximum of 40 characters.
- `ITEM_ATTEMPT` = the attempt number in the `auto_attempt:` line plus 1, or 1 if the entry has no such line.
- `ITEM_REINTEGRATE` = the branch in the `integrate_branch:` line, or `none`. Condition 2 already made sure that its `retry_when:` is true. If `ITEM_REINTEGRATE` is not `none` and `git rev-parse --verify -q refs/heads/<ITEM_REINTEGRATE>` prints nothing, the kept branch is gone: set `ITEM_REINTEGRATE` = `none` and add `kept branch <branch> is gone, so the run builds again` to the notes.
- `STALE_NOTES` = each note that names this entry by position or by text. A removal of the entry makes such a note stale. The sweep does not edit notes. It reports them.

## 2. Be in a worktree

Set `HHMMSS`. Run `git rev-parse --path-format=absolute --git-common-dir` and `git rev-parse --path-format=absolute --git-dir`. Before you compare the two outputs, change each `\` to `/`, and compare without regard to letter case.

- If the two paths are the same, you are in `PRIMARY`. Call `EnterWorktree` with the name `dw-<ITEM_SLUG>-<TODAY>-<HHMMSS>`. If the call fails, go to section 6 with the outcome `aborted: EnterWorktree failed` and the error. Otherwise set `CREATED_WT` = `true` and continue in the new worktree.
- If the two paths are different, you are already in a worktree. Set `CREATED_WT` = `false` and continue.

Record `WT_PATH` (the output of `git rev-parse --show-toplevel`) and `WT_BRANCH` (the output of `git branch --show-current`).

Do these checks in sequence. If a check fails, go to the abort path below with the outcome in brackets:

1. `git status --porcelain` must print nothing. (`aborted: worktree dirty at start`)
2. `git merge-base --is-ancestor HEAD origin/master` must succeed: the worktree holds no commit that `BASE` lacks. (`aborted: worktree base is not on origin/master`) Then run `git merge --ff-only origin/master`. It brings the worktree up to `BASE` when the local `PRIMARY_BRANCH` is behind. It moves only `WT_BRANCH`. Then `git rev-parse HEAD` must print the same sha as `git rev-parse origin/master`. (`aborted: worktree base is not origin/master`)
3. `pnpm install --frozen-lockfile --offline` must succeed. A new worktree has no `node_modules`. (`aborted: pnpm install failed` and the first error line)

Record `START_SHA` = `git rev-parse HEAD`.

**Abort path:** if `CREATED_WT` is `true`, run `DROP_DEPS`, then call `ExitWorktree` with the action `remove` and `discard_changes` false. If that call fails, add `worktree left at <WT_PATH>` to the outcome. Then go to section 6. Do not do sections 3 to 5.

## 3. Build it

If `ITEM_REINTEGRATE` is not `none`, an earlier run finished the work, and only its delivery failed. Do not build again. Do step 3.1 and skip step 3.2. Otherwise skip step 3.1 and do step 3.2.

### 3.1 Integrate the kept branch

1. List the commits to carry: `git rev-list --reverse origin/master..<ITEM_REINTEGRATE>`. Drop each commit whose subject starts with `chore(deferred):` or `wip(deferred):`. Section 4 makes a new ledger commit.
2. Run `git cherry-pick` with the remaining shas, in that order. If it fails, run `git cherry-pick --abort` in the worktree. Set `BUILD_STATUS` = `blocked`, `BLOCKER` = `re-integration of <ITEM_REINTEGRATE> conflicted`, `INTEGRATE_BRANCH` = `<ITEM_REINTEGRATE>`, and go to section 5.
3. Set `SPEC_FILE` to the spec path in the `auto_attempt:` line of the entry. Set `BUILD_STATUS` = `done` and `BLOCKER` = `none`. Set `FOLLOWUP` = `true` if the `auto_attempt:` line says `build-auto recommends a follow-up review`, else `false`. Go to section 4.

### 3.2 Run build-auto

Invoke the skill `bmad-method:bmad-build-auto` one time. Give it the intent below as its argument, and nothing else. Replace each placeholder. Do not add selection logic, ledger instructions or git instructions to the intent.

```
Tracking identifier: deferred-<ITEM_SLUG>

Close one entry from the deferred-work ledger. The entry, verbatim:

source_spec: <ITEM_SOURCE_SPEC>
summary: <ITEM_SUMMARY>
evidence: <ITEM_EVIDENCE>

Scope: do exactly what the entry describes. Make the smallest change that makes the summary false. Read the source spec for context. Do not edit docs/stories/deferred-work.md or docs/stories/sprint-status.yaml. The caller maintains both files. If a correct fix for the entry needs a PRD change, an AD change, a scope change or a human decision, HALT with status blocked. Name the necessary decision in the blocking condition.
```

Wait until the workflow halts. Then find the result file that this run wrote. Only a file that is new or changed since `START_SHA` counts. Do not select a file by its modification time or by a predicted name.

1. Collect the candidates: the output of `git diff --name-only <START_SHA> -- docs/stories` (committed and uncommitted changes to tracked files), plus the output of `git ls-files --others --exclude-standard -- docs/stories` (untracked files). Keep only the names `docs/stories/spec-*.md` and `docs/stories/bmad-build-auto-result-*.md`.
2. If exactly one `spec-*.md` candidate remains, use it. If more than one remains, use the one whose name starts with `docs/stories/spec-deferred-<ITEM_SLUG>` and continues with `.md` or `-<digit>`. If that does not give exactly one file, set `BUILD_STATUS` = `blocked` and `BLOCKER` = `ambiguous result file`, and go to section 5.
3. If no `spec-*.md` candidate remains, use the one `bmad-build-auto-result-*.md` candidate.
4. If no candidate remains, set `BUILD_STATUS` = `blocked` and `BLOCKER` = `build-auto left no result file`, and go to section 5.

Set `SPEC_FILE` to the path of that file. Then read it:

- `BUILD_STATUS` = the `status` value in its frontmatter. If the value is missing, or is not one of `draft`, `ready-for-dev`, `in-progress`, `in-review`, `done` or `blocked`, set `BUILD_STATUS` = `blocked` and `BLOCKER` = `unreadable result status`.
- `BLOCKER` = the text after the first line that starts with `Blocking condition:`, anywhere in the file. If there is no such line, or its text is empty, use `none recorded`. Join the text into one line: the ledger line in step 5.3 must stay one line.
- `FOLLOWUP` = the `followup_review_recommended` value in its frontmatter, or `false` if it is missing.

Route:

- If `BUILD_STATUS` is `done`, go to section 4. A `FOLLOWUP` of `true` does not block: the PR is the review, and step 4.4 opens it as a draft.
- Otherwise go to section 5.

## 4. Outcome `done`: open the work PR

The last commit on the branch removes the ledger entry. Thus the removal and the code land on `PRIMARY_BRANCH` together when a human merges the PR, or neither lands.

Do the steps below in sequence. Steps 4.1 to 4.4 run in the worktree. If a step before the PR exists fails, do these actions in this order:

1. If step 4.1 or 4.2 failed: if `git rev-parse --git-path rebase-merge` or `git rev-parse --git-path rebase-apply` names a directory that exists, run `git rebase --abort`.
2. If step 4.1 or 4.2 failed: if `LEDGER` holds uncommitted changes in the worktree, run `git restore --staged --worktree -- docs/stories/deferred-work.md`.
3. Set `FAILED_STEP` = the number of the step. Set `BUILD_STATUS` = `blocked`. Set `BLOCKER` = the name of the failed step and the first line of its error output, unless the step sets its own `BLOCKER`. A `BLOCKER` that a step sets replaces this one.
4. If step 4.1 already made the ledger-removal commit, set `INTEGRATE_BRANCH` = `WT_BRANCH`. The branch holds the finished work. Leave the commit on the branch.
5. Go to section 5.

Steps:

1. **Remove the entry.** In the worktree:
   1. `git status --porcelain` must print nothing. build-auto commits its work when it ends with `done`, so a dirty tree is a failure.
   2. `git diff --name-only <START_SHA> HEAD -- docs/stories/deferred-work.md docs/stories/sprint-status.yaml` must print nothing. The intent forbids build-auto to edit these files.
   3. Edit `LEDGER`. Find the entry whose three fields equal `ITEM_SOURCE_SPEC`, `ITEM_SUMMARY` and `ITEM_EVIDENCE`. If no entry or more than one entry matches, the step fails. Remove that bullet: its `source_spec`, `summary` and `evidence` lines, and any `auto_attempt`, `retry_when` and `integrate_branch` lines. Remove nothing else.
   4. If the `deferred:` list in the frontmatter of `SPEC_FILE` has items, append one entry at the end of `LEDGER` for each item. Its `source_spec:` is ``<SPEC_FILE>``. Its `summary:` and `evidence:` come from the item. Use the indent of the other entries. Join each value into one line.
   5. Commit only `LEDGER`, with the subject `chore(deferred): resolve — <ITEM_SUMMARY>`.
2. **Rebase and check.** Run `git fetch origin master`, then `git rebase origin/master`.
   - If a conflict interrupts the rebase, and the only conflicted path is `LEDGER`, the conflict is in the removal commit. Rebuild that commit: run `git checkout --ours -- docs/stories/deferred-work.md` (during a rebase, "ours" is `BASE`). Do sub-steps 3 and 4 of step 4.1 again on that file. Then run `git add -- docs/stories/deferred-work.md` and `git -c core.editor=true rebase --continue`.
   - If a conflict touches any other path, the step fails.

    If `git diff --quiet <START_SHA> HEAD -- pnpm-lock.yaml` fails, run `pnpm install --frozen-lockfile --offline` again. Then run `pnpm check` and `pnpm test`. Both must pass. Always run them, also when `BASE` did not move.
3. **Push.** Set `COMMITS` = the output of `git rev-list origin/master..HEAD`. Run `git push origin HEAD:refs/heads/<PR_BRANCH>`. The branch name is new, so the push creates it.
4. **Open the PR.** The body:
   ```
   Deferred entry: <ITEM_SUMMARY>

   Closes one entry of `docs/stories/deferred-work.md`, found and built by `deferred-work-sweep` on <TODAY>. The last commit removes the entry, so merging this PR resolves it.

   - source_spec: <ITEM_SOURCE_SPEC>
   - evidence: <ITEM_EVIDENCE>
   - spec: `<SPEC_FILE>`
   - checks: `pnpm check` and `pnpm test` passed on <the sha of HEAD>
   - follow-up review: <"recommended by build-auto — review before merge", or "not recommended">
   - new ledger entries: <each summary that step 4.1.4 appended, or none>

   <PR_ATTRIBUTION>
   ```
   Open a PR with base `master`, head `PR_BRANCH`, the title `<TITLE>` and that body. Open it as a draft if `FOLLOWUP` is `true`. `<TITLE>` = `deferred: ` followed by `ITEM_SUMMARY` cut at a word boundary to at most 70 characters in all, with each `"` removed. Set `PR_URL` = the URL of the new PR.

   If opening the PR fails, run `git push origin --delete <PR_BRANCH>`: a pushed branch without a PR hides the work from section 1 and from humans. Then do the failure actions.

   From this point the work is in a PR. A later failure never goes to section 5.
5. **Leave the worktree and clean up.** If `CREATED_WT` is `true`:
   1. Run `DROP_DEPS`. Then call `ExitWorktree` with the action `keep`. The action `keep` only returns the session to `PRIMARY`. It removes nothing.
   2. Run `git -C "<PRIMARY>" worktree remove "<WT_PATH>"`. Do not add `--force`. If the command fails (for example, a Windows file lock), keep the branch and set the outcome to `resolved, cleanup failed: worktree left at <WT_PATH>`.
   3. If the removal succeeded, and `git -C "<PRIMARY>" rev-parse <WT_BRANCH>` prints the same sha as `git -C "<PRIMARY>" rev-parse origin/<PR_BRANCH>`, run `git -C "<PRIMARY>" branch -D <WT_BRANCH>`: the remote holds every commit. `-D` is necessary because `PRIMARY_BRANCH` does not have the commits yet. If the shas differ, keep the branch.

   If `ITEM_REINTEGRATE` is not `none`, add `old branch <ITEM_REINTEGRATE> holds work that is now in <PR_URL> by cherry-pick, and a human can remove it` to the notes.
6. Go to section 6 with the outcome `resolved, PR opened` (`resolved, draft PR opened` if `FOLLOWUP` is `true`), unless step 4.5 set a different outcome.

## 5. Outcome `blocked` (or any status other than `done`): mark it

The ledger marker must reach `PRIMARY_BRANCH` without the code. The marker travels as a commit that changes only `LEDGER`, in its own PR. That commit is on a temporary branch that starts at `BASE`, so its parent has the same ledger as `BASE`. Until a human merges or closes the marker PR, condition 8 of section 1 skips the entry, so the next run does not repeat the attempt.

Steps 5.1 to 5.4 run in the worktree.

1. **Keep the output of the run.** In the worktree:
   1. If `LEDGER` holds uncommitted changes, run `git restore --staged --worktree -- docs/stories/deferred-work.md`.
   2. Run `git add -A -- docs packages test data`. Do not stage other paths: they can hold stray files that the run did not mean to keep.
   3. If `git diff --cached --quiet` fails, record the output of `git diff --cached --name-only` for the notes. Then commit with the subject `wip(deferred): blocked run state — <ITEM_SLUG>`. This commit keeps `SPEC_FILE`, any saved patch and the other output of the run on `WT_BRANCH`.
2. **Set `RETRY_WHEN`.** Use exactly one of these forms. Each form is a condition that a later run can check from the repository alone:
   - `Story <n.n> is done in sprint-status.yaml` — the blocker is work that a story owns.
   - `master has moved past <sha>` — use the current sha of `origin/master`. Use this form for a failure in section 4, and for a re-integration conflict: a later base can remove the cause.
   - `never — needs a human` — use this form for an intent gap, a planning change (`bmad-correct-course`), a human decision, and every other blocker. A human who settles the blocker edits or removes the `retry_when:` line.

    If `INTEGRATE_BRANCH` is not set, set it to `none`.
3. **Make the marker commit.** In the worktree:
   1. Set `MARK_BRANCH` = `<WT_BRANCH>-mark`. Run `git switch -c <MARK_BRANCH> origin/master`. If the command fails, set the outcome to `blocked, ledger not updated: git switch failed`, set `COMMITS` = `none`, and go to step 5.5.
   2. In `LEDGER`, find the entry whose three fields equal `ITEM_SOURCE_SPEC`, `ITEM_SUMMARY` and `ITEM_EVIDENCE`. If no entry matches, set the outcome to `blocked, ledger not updated: entry gone from origin/master`, set `COMMITS` = `none`, run `git switch <WT_BRANCH>`, and go to step 5.5.
   3. If the entry has `auto_attempt:`, `retry_when:` or `integrate_branch:` lines from an earlier attempt, remove them. Then add these lines directly below the `evidence:` line of the entry, with the same indent as the fields above them. Add the `integrate_branch:` line only if `INTEGRATE_BRANCH` is not `none`:
      ```
         auto_attempt: <TODAY> — attempt <ITEM_ATTEMPT> — status <BUILD_STATUS>. <BLOCKER>. Branch `<WT_BRANCH>`, spec `<SPEC_FILE>`.
         retry_when: <RETRY_WHEN>
         integrate_branch: <INTEGRATE_BRANCH>
      ```
   4. Commit only `LEDGER`, with the subject `chore(deferred): mark blocked — <ITEM_SUMMARY>`. Set `COMMITS` = the sha of this commit.
4. **Push and open the marker PR.** Still on `MARK_BRANCH`:
   1. Run `git push origin HEAD:refs/heads/<MARK_PR_BRANCH>`. If it fails, set the outcome to `blocked, ledger not updated: push failed`, set `COMMITS` = `none`, run `git switch <WT_BRANCH>`, and go to step 5.5. The marker stays on `MARK_BRANCH`.
   2. The body:
      ```
      Deferred entry: <ITEM_SUMMARY>

      `deferred-work-sweep` could not close this entry of `docs/stories/deferred-work.md` on <TODAY>. This PR changes only the ledger: it records the attempt and the retry condition. Merge it to let a later run retry when the condition is true. The code is not in this PR.

      - status: <BUILD_STATUS>
      - blocker: <BLOCKER>
      - retry_when: <RETRY_WHEN>
      - failed step: <FAILED_STEP, or none>
      - spec: `<SPEC_FILE>`
      - run output: local branch `<WT_BRANCH>`<, kept for re-integration, if INTEGRATE_BRANCH is not none>

      <PR_ATTRIBUTION>
      ```
      Open a PR with base `master`, head `MARK_PR_BRANCH`, the title `<TITLE>` and that body. `<TITLE>` = `deferred: mark blocked — ` followed by `ITEM_SUMMARY` cut at a word boundary to at most 70 characters in all, with each `"` removed. Set `PR_URL` = the URL of the new PR.
   3. If opening the PR failed, run `git push origin --delete <MARK_PR_BRANCH>`, set the outcome to `blocked, ledger not updated: opening the PR failed` and the first error line, and set `COMMITS` = `none`. The marker stays on `MARK_BRANCH`.
   4. Run `git switch <WT_BRANCH>`. If the PR exists, run `git branch -D <MARK_BRANCH>`: its commit is on the remote.
5. **Leave the worktree.** If `CREATED_WT` is `true`, run `DROP_DEPS`. Then call `ExitWorktree` with the action `keep`. The action `keep` only returns the session to `PRIMARY`. It removes nothing. If step 4.5 already took the session out of the worktree, skip this step.
6. **Clean up.** Do this step on every path through section 5. If `CREATED_WT` is `true`, remove the worktree directory, but keep the branches: run `git -C "<PRIMARY>" worktree remove "<WT_PATH>"`. `WT_BRANCH` stays, so that a human can examine it and a later run can re-integrate it. If the command fails (for example, untracked files or a Windows file lock), add `worktree left at <WT_PATH>` to the outcome. Do not add `--force`.
7. Go to section 6 with the outcome `blocked, marker PR opened`, unless an earlier step in section 5 set a different outcome.

## 6. Report and end the turn

Print one short block. Then end the turn.

```
deferred-work-sweep <TODAY>
outcome:     <resolved, PR opened | resolved, draft PR opened | resolved, cleanup failed: ... | blocked, marker PR opened | blocked, ledger not updated: ... | nothing eligible | aborted: ...>
entry:       <ITEM_SUMMARY, or none>
build:       <BUILD_STATUS, or not run> — <BLOCKER, or none>
failed_step: <FAILED_STEP, or none>
spec:        <SPEC_FILE, or none>
retry_when:  <RETRY_WHEN, or none>
pr:          <PR_URL, or none>
commits:     <COMMITS (shas in the PR), or none>
branch:      <WT_BRANCH kept | WT_BRANCH removed | none>
worktree:    <removed | left at WT_PATH | none created>
notes:       <STALE_NOTES, entries skipped by condition 7 with reasons, entries skipped by condition 8 with PR URLs, new ledger entries from the deferred list, files the wip commit kept, or none>
```

`master` in `PRIMARY` does not change in any run. A human merges the PR on the remote and then runs `git pull --ff-only` in `PRIMARY`.
