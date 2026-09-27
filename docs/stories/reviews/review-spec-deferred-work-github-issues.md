# Review: spec-deferred-work-github-issues.md

- **Content:** `docs/stories/spec-deferred-work-github-issues.md` (docs: a story spec that defines behavior)
- **Date:** 2026-09-27
- **Lenses run:** adversarial, edge-case-hunter, structure, then prose (run on top of the structure findings). Verification-gap was skipped because it applies only to code.
- **Counts:** adversarial 22, edge-case-hunter 31, structure 16, prose 20
- **Triage:** not done. Before any finding is triaged or fixed, read and apply the Review brief in `AGENT-WORKFLOW.md`.

## Overlap (found by more than one lens)

The adversarial and edge-case lenses found these problems on their own. Each is written as adversarial # / edge-case #.

- Step 4.1.3 leaves an orphan `id:` line between PR A and PR B (A5 / E1)
- Run state has no single source: the `## Prior attempts` body vs the `sweep-attempt` comments for condition 2, ITEM_REINTEGRATE and SPEC_FILE (A3, A4 / E2)
- Run state written between PR A and PR B is lost when PR B deletes it (A6 / E3)
- The entry/note split cannot be done mechanically in the test and the parser (A1 / E5, E6)
- Retired entries still get open issues (A2 / E31)
- Parallel sweeps each run the sync, which gives duplicate issues, then exit 1, then a stalled queue (A7, A8 / E12)
- A stale or wrong `--ref` closes live issues (A15 / E11)
- A 6 h claim expires while a build is still running (A9 / E22)
- Claim order depends on client clocks (A10 / E21)
- `sweep-attempt` key=value values contain spaces (A12 / E25)
- Label semantics: labels are not created, `sweep:claimed` goes stale, and removing `sweep:blocked` has no defined effect (A13 / E24, E26)
- #2 may not have the `deferred` label (A14 / E18)
- There is no title or multi-line field rule for summaries (A18 / E19)
- `--limit 1000` truncates, and the first line is not normalized (A22 / E15, E16)
- A `retry_when` written by a human is a precondition, not run state (A3 / E28)
- Duplicate ids at append time and between PRs (A17 / E7, E8)
- Structure (S2, S13) and prose both ask to define "active claim" before its first use.

## Found by one lens only (read these)

- A11: the repo is public, so anyone can forge protocol comments, and the comment text reaches an unattended agent that has push rights.
- A19: `git show` is not behind the injectable runner.
- A20: AGENTS.md and the ledger-rule citation are not updated.
- E10: when the ledger is unparseable or empty, the sync closes every issue.
- E17: an open issue that has the `deferred` label but no marker gets closed.
- E4: work PRs in the old format are still open at the PR B cutover.
- E23: the abort path leaks the claim.
- E30: the one-entry rule contradicts "try the next issue".
- Prose P1: "conditions 1–7 stay the same" contradicts the change to condition 2.

## Adversarial

### A1. Tasks PR A, test/deferred-ledger.test.ts; entry/note split

- **Trigger:** The entry/note split depends on judgment (condition 1), but the test is mechanical. Several notes (ledger lines 43-50, 59-63) have source_spec, summary and evidence
- **Guard:** Define an entry mechanically, for example a `- source_spec:` bullet with an `id:` line. Reject a bullet with the three fields and no `id:` unless it carries `kind: note`, or reshape the notes during the migration
- **Consequence:** The test fails on the notes, or it becomes vacuous. The sync cannot tell notes from entries and creates issues for notes

### A2. Tasks PR A migration; Matrix 'New entry'

- **Trigger:** Entries that are retired or closed stay in the append-only ledger (lines 33, 84, 94). They get ids and open issues, and the sync closes an issue only when its entry leaves the ledger
- **Guard:** In the migration, remove each entry that a note retires, in a commit that names the cancel decision, or give it no id. List those entries in the spec
- **Consequence:** Open issues stay forever for work that is already done, and humans see a false backlog

### A3. Tasks PR B; Design Notes S1 condition 2

- **Trigger:** Some run-state-shaped lines were written by a human (auto_attempt: 0 with a prose retry_when, lines 10-17, and a retry_when alone at line 215). PR B deletes them, and condition 2 reads only `sweep-attempt` comments
- **Guard:** Say how `## Prior attempts` feeds condition 2, or have the first sync post an equivalent `sweep-attempt` comment. Keep a human-authored retry_when as a ledger precondition (condition 6)
- **Consequence:** Entries that a human gated on a precondition become eligible at once and are built too early

### A4. Acceptance Criteria (integrate_branch) vs Design Notes S1/S5

- **Trigger:** The AC says the sweep reads the run state from the issue body, and the Design Notes say it reads the comments. No step sets ITEM_REINTEGRATE or SPEC_FILE from either source
- **Guard:** Name one source for ITEM_ATTEMPT, ITEM_REINTEGRATE, RETRY_WHEN and SPEC_FILE: the latest `sweep-attempt` comment, else the parsed `## Prior attempts`. Give a parse rule for each field
- **Consequence:** The live-sync entry (integrate_branch, retry_when never) is rebuilt from scratch or retried in spite of its gate

### A5. Tasks PR A, SKILL.md 'one small edit only: step 4.1.4'

- **Trigger:** Step 4.1.3 removes the source_spec, summary, evidence and run-state lines but not `id:`. Step 5.3.3 inserts lines 'below the evidence line'
- **Guard:** PR A also edits step 4.1.3 to remove the `id:` line. Test that no `id:` line exists outside a source_spec bullet
- **Consequence:** The first sweep run between the PRs leaves an orphan id line. The ledger is corrupted, or the test fails on master

### A6. Between the PRs; Tasks PR A ('sweep unchanged')

- **Trigger:** The old sweep still writes run state to the ledger between PR A and PR B. The sync copies it only when it creates an issue, and PR B then deletes it
- **Guard:** Allow no sweep run between the first sync and the merge of PR B, or have PR B diff the run-state lines against the issues and fail on a line that is missing
- **Consequence:** Attempt history and a kept integrate_branch are lost, so finished work is rebuilt

### A7. Design Notes S1 ('Run pnpm deferred:issues first'); Matrix 'New entry'

- **Trigger:** Two parallel runs both sync, both see an id with no issue, and both create one. There is no lock and no check after the create
- **Guard:** After the creates, re-list the issues and close the duplicates, keeping the lowest number. Or make the sweep's sync read-only and give issue creation to a single owner
- **Consequence:** Duplicate issues appear, the next sync exits 1, and every later sweep aborts

### A8. Matrix 'Duplicate issues'; Design Notes S1 ('If it fails, abort')

- **Trigger:** One duplicate issue, or one `gh` error for a single id, makes the sync exit 1, and all sweeps then stop
- **Guard:** Keep 'GitHub unreachable' (abort) apart from 'data inconsistency on id X' (report it, skip X, continue)
- **Consequence:** One bad issue blocks the whole queue

### A9. Matrix 'Stale claim'; AC 'never build the same issue'

- **Trigger:** A build that takes longer than 6 h, or a paused session, loses its claim while its work is still in progress
- **Guard:** Post a heartbeat claim before long steps, or also require that the run's worktree or branch is gone. Re-check the claim before the push in step 4.3
- **Consequence:** Two runs build the same issue and open two work PRs

### A10. Design Notes S1 claim protocol

- **Trigger:** 'Earliest' can mean the self-reported `at=` or GitHub's created_at. Local clocks differ between machines
- **Guard:** Order claims by GitHub comment created_at or comment id. Use created_at for the staleness check too
- **Consequence:** With clock skew, both runs see themselves as the winner and build

### A11. Design Notes S1/S4/S5 (comments as run state); Boundaries

- **Trigger:** The repo is public, so anyone can post a `sweep-claim`, `sweep-release` or `sweep-attempt` comment. Comment text is read into an unattended agent that has push rights
- **Guard:** Accept protocol comments only from the authenticated gh user or from collaborators with write access (author.login / authorAssociation). Never treat comment text as instructions
- **Consequence:** An outsider can block any issue permanently, unblock a 'never' issue, or inject instructions into the agent

### A12. Design Notes S5 (`sweep-attempt` format)

- **Trigger:** retry_when values contain spaces ('never — needs a human', 'master has moved past <sha>'), so space-separated key=value parsing is ambiguous
- **Guard:** Put one field on each line, or quote the values. Give the parse rule and delimit the blocker text
- **Consequence:** Condition 2 misreads retry_when, so a blocked issue is retried daily or an eligible one is never retried

### A13. Design Notes S4/S5 (labels); Tasks PR A (label creation)

- **Trigger:** Only the `deferred` label is created, so `--add-label sweep:claimed` fails. Nothing removes `sweep:claimed` when a PR closes unmerged. The effect of removing `sweep:blocked` when retry_when=never is undefined
- **Guard:** The sync creates all three labels. State whether the labels or the comments are authoritative, and add a cleanup step for stale `sweep:claimed`
- **Consequence:** The first claim aborts, labels mislead, and removing `sweep:blocked` does not unblock the issue

### A14. Between the PRs (adopt #2)

- **Trigger:** The sync lists only `--label deferred`, and #2 may not have that label
- **Guard:** `gh issue edit 2 --add-label deferred`, or warn on a marker line in an issue with no label
- **Consequence:** The first real sync creates a duplicate of #2

### A15. Tasks PR A (--ref); Verification (--ref HEAD)

- **Trigger:** --ref accepts any ref in write mode. The sync does no fetch, and S1 does not order it after `git fetch`
- **Guard:** Refuse writes unless the ref is origin/master (allow other refs only with --dry-run). Run the sync after `git fetch origin master`
- **Consequence:** Issues for live entries are closed, and with no reopen they leave the queue silently

### A16. Matrix 'Closed but still listed'

- **Trigger:** Only a report, exit 0, and candidates are open issues only. An issue can be closed by hand, by a lost ledger commit, or by the wrong-ref sync
- **Guard:** Show the mismatch in the sweep notes, exit non-zero, or require the ledger removal first
- **Consequence:** Orphaned ledger entries, and no one acts on the signal

### A17. Design Notes 'Why dw-<slug>'; Tasks PR A test

- **Trigger:** A slug collision shows up only in `pnpm test` at step 4.2, after the build is done, and S4's failure path then parks the item as blocked
- **Guard:** In 4.1.4 and in the rebuild after a rebase in 4.2, check new ids against BASE and add a suffix (-2) on a collision
- **Consequence:** Finished work is parked for a cosmetic id clash

### A18. Tasks PR A parser; Matrix 'New entry' (title)

- **Trigger:** Summaries span several lines with nested bullets and backticks, and can be longer than a title allows. There is no rule for fields that continue on more lines and no truncation rule
- **Guard:** Give a continuation rule (indented lines that are not key lines belong to the field) and a 70-char word-boundary title cut. Add a fixture from the real ledger
- **Consequence:** Fields are truncated, or a create fails, which exits 1 and aborts every sweep

### A19. Boundaries ('Every gh call ... one injectable runner')

- **Trigger:** Only gh is injectable, but `git show <ref>:...` also spawns a process
- **Guard:** Route git through the same runner or a second injectable one, and say so in Boundaries
- **Consequence:** Tests spawn git and depend on the local origin/master, which breaks the test/setup.ts rule

### A20. Code Map; Tasks PR A migration ('the ledger rule allows a rewrite')

- **Trigger:** The rule allows removal in a decision commit, not a rewrite of every entry. AGENTS.md ('appends ... does not rewrite') and the header's auto_attempt sentence are not in the Code Map
- **Guard:** Add AGENTS.md to the Code Map and record the new rules there (entries need id:, run state lives in issues). Cite the migration as a one-time human decision
- **Consequence:** Agents keep writing entries with no id, and the instructions contradict the header

### A21. Matrix 'Entry removed'

- **Trigger:** Every removed entry's issue is closed 'as completed', cancellations included
- **Guard:** Close as not planned on a cancel decision, or always close as not planned and let `Closes #N` handle completion
- **Consequence:** Cancelled work shows as completed in the issue history

### A22. Matrix 'Up to date'; Tasks PR A (--limit 1000)

- **Trigger:** `--state all --limit 1000` truncates silently, and matching on the first line is not normalized for CRLF or whitespace
- **Guard:** Paginate, or fail when the count equals the limit. Trim the first line and normalize its line ending
- **Consequence:** Missed matches lead to duplicates, then exit 1 and a stalled sweep

## Edge-Case Hunter

### E1. Tasks PR A, SKILL.md one small edit (step 4.1.3 unchanged)

- **Trigger:** The old sweep removes an entry between PR A and PR B, and step 4.1.3 omits the id line
- **Guard:** PR A also edits step 4.1.3 to remove the bullet's id line with the other lines
- **Consequence:** An orphan `id:` line attaches to the previous bullet, and the ledger test or parser fails on master

### E2. Design Notes S1 condition 2 vs AC (integrate_branch in `## Prior attempts`)

- **Trigger:** A migrated issue holds its run state only in the body and has no sweep-attempt comment
- **Guard:** When there is no sweep-attempt comment, parse the legacy auto_attempt, retry_when and integrate_branch lines under `## Prior attempts`
- **Consequence:** A 'never — needs a human' entry becomes eligible and is rebuilt, and the attempt cap resets

### E3. Tasks PR A sync (Prior attempts only at create); PR B ledger commit

- **Trigger:** A marker PR from the old sweep adds run-state lines after the issue already exists
- **Guard:** Before PR B deletes the lines, diff them against the issue body and post each missing line as a sweep-attempt comment
- **Consequence:** PR B deletes run state that no issue holds, with no signal

### E4. Tasks PR B cutover (no in-flight PR handling)

- **Trigger:** Old-format work or marker PRs (`Deferred entry: <summary>`) are still open when PR B merges
- **Guard:** Precondition for PR B: no open deferred/* PR whose first line fails ^Deferred entry: dw-. Close or merge those PRs first
- **Consequence:** Condition 8 misses them and the entry is built twice, or a late marker merge fails the ledger test

### E5. Tasks PR A ledger test; Boundaries Never (no bmad-build change)

- **Trigger:** bmad-build's deferred-ledger-audit, a retro or a hand edit appends an entry with no id
- **Guard:** Define a mechanical entry/note rule. Update every appender, or have the sync report entries with no id without failing
- **Consequence:** Unrelated builds fail pnpm test, or the entry never gets an issue

### E6. Tasks PR A migration (entry/note split) and ledger test

- **Trigger:** The test must tell entries from notes, but the split is a judgment
- **Guard:** Treat every source_spec bullet with a summary and evidence as an entry, or give notes a `kind: note` marker
- **Consequence:** The test and the sync disagree with the migration about notes such as [NOTE FOR UX] or resolved_by bullets

### E7. Tasks PR A migration (ITEM_SLUG as id)

- **Trigger:** Two entries produce the same six-word slug, or a summary produces an empty slug or one that starts with punctuation
- **Guard:** On a collision append -2, -3 within the 40-char cap. For an empty slug use dw-entry-<n>
- **Consequence:** The migration gives duplicate or invalid ids, and no rule resolves them

### E8. Tasks PR A test rationale ('duplicate fails ... does not merge')

- **Trigger:** Two open PRs append the same id, and each passes on its own base
- **Guard:** The sync exits 1 on an id that two ledger entries share and names both. Add a matrix row
- **Consequence:** A duplicate id reaches master, and the sync behavior is undefined

### E9. Matrix 'Closed but still listed' + 'New entry'

- **Trigger:** A new entry reuses the id of a closed issue, or a human closes an issue whose entry is still listed
- **Guard:** Check uniqueness against all issue ids ever used, or create a new issue when the entry was re-added
- **Consequence:** The entry never gets an open issue and is never a candidate

### E10. Matrix 'Entry removed'

- **Trigger:** The ledger at the ref is missing, empty or partly unparseable, or `git show` fails
- **Guard:** Exit 1 before any close when git show fails, when 0 entries parse, or when any bullet fails to parse
- **Consequence:** Every open deferred issue is closed at once

### E11. Design Notes S1; sync default --ref

- **Trigger:** The sync runs on a stale origin/master while another run already created an issue for a new id
- **Guard:** Fetch before the sync. Close only issues that were created before the ref's commit date
- **Consequence:** A stale run closes a valid new issue

### E12. Design Notes S1 (sync at the start of each parallel run)

- **Trigger:** Two sweeps sync at the same time, and both create an issue for a new id
- **Guard:** Re-list after the create, and close the newer duplicate
- **Consequence:** Duplicate issues, exit 1, and every later sweep aborts

### E13. Tasks PR A sync ('creates the label deferred if missing')

- **Trigger:** Two runs create the missing label at the same time
- **Guard:** `gh label create deferred --force`, or treat 'already exists' as success
- **Consequence:** The second run exits 1, and its sweep aborts

### E14. Matrix 'New entry' error handling

- **Trigger:** The create times out after the server already made the issue, or the comment posts but the close fails
- **Guard:** Re-list by marker before a retry. Skip the comment if a left-the-ledger comment already exists
- **Consequence:** The rerun makes a duplicate, or close comments repeat

### E15. Tasks PR A (--limit 1000, state all)

- **Trigger:** Deferred issues, closed ones included, grow past 1000
- **Guard:** Paginate with `gh api --paginate`, or fail when the count equals the limit
- **Consequence:** Issues past the limit are not seen, so the sync creates duplicates

### E16. Tasks PR A ('matches them on the first body line')

- **Trigger:** The body is empty or null, has CRLF or trailing spaces, or one id is a prefix of another
- **Guard:** first = (body ?? '').split(/\r?\n/)[0].trim(); match exactly /^Deferred entry: (dw-[a-z0-9-]{1,40})$/
- **Consequence:** A crash, a missed match that leads to a duplicate, or a match with the wrong entry

### E17. Matrix (no row); Between the PRs (#2)

- **Trigger:** An open issue with the `deferred` label has no marker that parses (for example #2, or an issue a human made)
- **Guard:** Report an unparseable marker and leave the issue alone. Never treat it as 'id not in ledger'
- **Consequence:** The sync comments on a human's issue and closes it

### E18. Between the PRs (`gh issue edit 2`)

- **Trigger:** #2 has no `deferred` label, and the sync lists only that label
- **Guard:** gh issue edit 2 --add-label deferred --body-file <file>
- **Consequence:** The first real sync creates a duplicate of #2

### E19. Matrix 'New entry' (title from summary)

- **Trigger:** The summary is longer than 256 chars, spans several lines, or is wrapped in quotes
- **Guard:** Title = the first line, unquoted, cut at a word boundary to 70 chars (the PR TITLE rule)
- **Consequence:** The create fails (exit 1 on every run), or the title is garbled

### E20. Design Notes S1 condition 8 ('body contains Closes #<N>')

- **Trigger:** Issue #1 is checked while a PR body says Closes #12
- **Guard:** Match /^Closes #<N>$/m, not a substring
- **Consequence:** The issue is skipped as in flight when it is not

### E21. Design Notes S1 claim ('earliest active sweep-claim wins')

- **Trigger:** Two claims share a second, the clocks differ, or read-after-write lag hides an earlier claim
- **Guard:** Order by GitHub created_at, then by comment id. Re-read a second time after a short delay
- **Consequence:** Both runs believe they won

### E22. Matrix 'Stale claim' (6 h) / Design Notes S1

- **Trigger:** A build-auto run lasts longer than 6 h and has no PR yet
- **Guard:** Refresh the claim between sections 2, 3 and 4, or require that WT_BRANCH is gone before a takeover
- **Consequence:** A second run claims a live issue, and the AC fails

### E23. Design Notes S1 claim vs S2 abort path / crash

- **Trigger:** A run claims an issue, then aborts (EnterWorktree, dirty tree, pnpm install) or the session dies
- **Guard:** The S2 abort path posts sweep-release and removes sweep:claimed before S6
- **Consequence:** The issue stays locked for 6 h with a label that no one owns

### E24. Design Notes S4 ('keep sweep:claimed until PR merges or closes')

- **Trigger:** A human closes the work PR without a merge
- **Guard:** The sync or S1 removes sweep:claimed when there is no active claim and no open Closes PR
- **Consequence:** The label stays forever

### E25. Design Notes S5 (sweep-attempt format)

- **Trigger:** retry_when values contain spaces
- **Guard:** Put retry_when last on its own line, or quote the value
- **Consequence:** The key=value parse misreads retry_when, integrate_branch and branch

### E26. Design Notes S5 (human removes sweep:blocked)

- **Trigger:** A human removes sweep:blocked, but the latest comment still says retry_when=never
- **Guard:** Define that a missing sweep:blocked label overrides the latest retry_when, and state it in condition 2
- **Consequence:** Removing the label has no effect, or the effect is undefined

### E27. Design Notes S5 (issue writes replace marker PR)

- **Trigger:** A comment or label write fails during the blocked path
- **Guard:** Report 'blocked, issue not updated: <step>' and keep the claim so that the 6 h rule stops a retry
- **Consequence:** The attempt goes unrecorded, runs repeat without end, and they bypass the cap

### E28. Tasks PR B ledger commit ('removes every retry_when: line')

- **Trigger:** A hand-written retry_when has no auto_attempt ('A git remote is configured...')
- **Guard:** Keep preconditions that are not run state: move them into evidence, or keep a retry_when that has no auto_attempt
- **Consequence:** The precondition is deleted, and condition 6 no longer skips the entry

### E29. Design Notes S1 ('entry read from ledger on BASE by id')

- **Trigger:** An open issue's id is not in BASE (it was removed after the sync)
- **Guard:** When no entry has the id, skip the candidate and note it
- **Consequence:** The lookup fails mid-pick, and the behavior is undefined

### E30. Design Notes S1 ('try the next issue') vs 'Examine exactly one entry'

- **Trigger:** A run loses its claim and moves on to the next candidate
- **Guard:** Rewrite the rule: one claimed issue per run, and a lost claim does not count
- **Consequence:** The skill contradicts itself

### E31. Matrix 'New entry' (entries retired by notes)

- **Trigger:** A note retires an entry (condition 1), but the entry stays in the ledger
- **Guard:** The sync skips retired entries, or labels them sweep:retired
- **Consequence:** Open issues stay for dead work (for example pinned-cap #2)

## Editorial Structure

| # | Location | Issue | Recommendation | Why |
|---|---|---|---|---|
| S1 | Design Notes 'Sweep changes' and Tasks PR B SKILL.md task | The PR B task points to Design Notes, and Design Notes holds both the rationale and the section-by-section procedure | MOVE 'Sweep changes' and 'Rules for all steps' under the PR B task, or into a '### Sweep rewrite (PR B)' subsection. Keep only the dw-<slug> rationale in Design Notes | A PR B implementer has to jump about 60 lines to find the steps |
| S2 | Design Notes S1 (pick) bullet | Six operations are in one bullet, and 'active claim' is defined last although condition 8 uses it earlier | CONDENSE into numbered steps (sync, candidates, skip 1-8, claim, resolve race). Define 'active claim' first | The execution order is only implied, and the term is used before its definition |
| S3 | Design Notes S5 (blocked) bullet | Steps that depend on their order are written as prose | CONDENSE into six numbered steps, with the sweep-attempt format on its own code line | The release and cleanup order can be misread |
| S4 | Tasks PR A deferred-issues.ts task | The densest bullet holds every requirement, and its '-- reason' tail holds an architecture rule | CONDENSE into sub-bullets: Inputs, Matching, Writes, --dry-run, Structure (parser -> diff -> gh) | The core deliverable is hard to scan, and the bullet breaks the pattern |
| S5 | Tasks 'Between the PRs' paragraph | The only public-repo writes that PR B depends on are in a prose paragraph | PRESERVE the position, and make it a three-item checklist with the gating line above | A reader can skip the step |
| S6 | Code Map, last bullet (issue #2) | #2 is not a code location | MOVE it into the `gh issue edit 2` step | The Code Map mixes in non-code facts |
| S7 | Verification, dry-run explanation | It repeats the adoption reasoning | CONDENSE: 'one create per entry (including pinned-cap; #2 not yet adopted), no writes' | Redundancy, about 15 words |
| S8 | Verification, whole section | The checks are not tied to PR A or PR B, and the two-session check works only after PR B | Tag each item (PR A) / (PR B) / (both), or group them by PR | It is unclear which check gates which merge |
| S9 | Frontmatter title | The title has 25 words | CONDENSE to 'Deferred work as GitHub issues' | The title is unwieldy in sprint lists and PR references |
| S10 | Design Notes 'Rules for all steps' | A rule that covers every step comes after the steps | MOVE it to the top of the sweep-rewrite block | A reader learns the constraint too late |
| S11 | Tasks PR B test bullet | It has no '-- reason' tail, unlike the other bullets | Add '-- keeps run state out of the ledger for good' | The pattern has a gap |
| S12 | Intent, Approach last bullet (frozen) | A constraint sits among the approach steps | QUESTION (human-owned): move it to Boundaries Never? | It is separated from the matching Never item |
| S13 | Matrix Claim race / Stale claim rows (frozen) | 'active claim' is used before it is defined | QUESTION: fix it outside the frozen block by defining the term early (see the S1 row) | The term is undefined at first use |
| S14 | Tasks opening paragraph | (keep) | PRESERVE | It gives the reader the two-PR model before the checklists |
| S15 | Acceptance Criteria item 4 | (keep) | PRESERVE | It is a testable restatement, not redundancy |
| S16 | Empty Implementation Notes / Change Log / Triage Log | (keep) | PRESERVE | These are template slots that the workflow fills |

## Editorial Prose

| # | Location | Original | Revised | Why |
|---|---|---|---|---|
| P1 | Design Notes S1 | 'Skip conditions 1–7 stay the same.' The next sentence changes condition 2 | 'Skip conditions 1 and 3–7 stay the same.' | The two sentences contradict each other |
| P2 | Tasks PR B SKILL.md bullet | 'except for the renamed values' has no antecedent | Name the values, or delete the clause | The implementer guesses what to rename |
| P3 | Tasks PR A SKILL.md bullet | 'the sweep must still pass the new test' | 'entries that the sweep appends must pass the new test until PR B rewrites the sweep' | The subject is wrong |
| P4 | Between the PRs | '<id of the pinned-cap entry>' does not identify the entry | Give the literal dw- id, or quote the summary | The human cannot tell which entry is meant |
| P5 | AC item 2 | 'After the migration' is ambiguous, because there are two migration commits | 'After PR B merges, the sweep reads the line from the issue.' | The timing is ambiguous |
| P6 | Tasks PR A / PR B ledger bullets | 'names the decision' has no referent | Name each decision (add ids; move run state to issues) | The commit subject is underspecified |
| P7 | Design Notes S1 | 'with the same run' | 'with the same `run=` value' | It reads as the process, not the token |
| P8 | Design Notes S6 | 'Add `issue: #<N>`.' | 'Add an `issue: #<N>` line to the report.' | The target is unstated |
| P9 | Design Notes S4 | 'not by matching three fields' | Name the three fields | The fields are opaque when SKILL.md is not open |
| P10 | Design Notes S4 | '...; condition 8 still sees the open PR' reads as the reason the label stays | Say that the label is for people only, and state what removes it | The rationale is muddled |
| P11 | Design Notes S5 | 'Replace it all' / 'the blocker on the next line' | 'Replace the whole section' / 'a one-line description of the blocker on the next line' | Vague references |
| P12 | Tasks PR A deferred-issues.ts bullet | 'the matrix', 'with no runner', '(+ ...)' | 'the I/O & Edge-Case Matrix', 'without the gh runner', '(with ...)' | Loose references, and a '+' used for 'and' |
| P13 | Tasks PR A test bullet | '... and does not merge' (a run does not merge) | '..., and its PR does not merge.' | The subject is wrong |
| P14 | Between the PRs | 'since these write' | 'because these steps write' | Microsoft style ('because' for cause) |
| P15 | Design Notes S1 | '6 h' in running text | '6 hours' (the table may keep '6 h') | Microsoft style |
| P16 | Design Notes S1/S5 | 'label `deferred`' vs 'the label `sweep:blocked`' | Use 'the label' in every place | Inconsistent wording |
| P17 | Throughout | 'ids' in prose | Consider 'IDs', keeping `id:` for the token (low priority) | Microsoft style |
| P18 | Throughout | No serial comma | Accept only if the Microsoft guide overrides the house style (AGENTS.md omits the serial comma on purpose) | A conflict between the style guide and the house style |
| P19 | Frozen, Boundaries Never | 'Section 5' does not say which document | QUESTION: 'The sweep skill's section 5 ...'? | The reference is unclear at first read |
| P20 | Frozen, Matrix 'New entry' | 'first line' could mean the title | QUESTION: 'whose body's first line names it'? | Misreading |

Prose also noted two minor fixes: "as today" could read "as the sweep does today", and "settles a blocker" could read "resolves a blocker".

## Findings JSON

```json
[
  {
    "lens": "adversarial",
    "location": "Tasks PR A, test/deferred-ledger.test.ts; entry/note split",
    "trigger_condition": "The entry/note split depends on judgment (condition 1), but the test is mechanical. Several notes (ledger lines 43-50, 59-63) have source_spec, summary and evidence",
    "guard_snippet": "Define an entry mechanically, for example a `- source_spec:` bullet with an `id:` line. Reject a bullet with the three fields and no `id:` unless it carries `kind: note`, or reshape the notes during the migration",
    "potential_consequence": "The test fails on the notes, or it becomes vacuous. The sync cannot tell notes from entries and creates issues for notes"
  },
  {
    "lens": "adversarial",
    "location": "Tasks PR A migration; Matrix 'New entry'",
    "trigger_condition": "Entries that are retired or closed stay in the append-only ledger (lines 33, 84, 94). They get ids and open issues, and the sync closes an issue only when its entry leaves the ledger",
    "guard_snippet": "In the migration, remove each entry that a note retires, in a commit that names the cancel decision, or give it no id. List those entries in the spec",
    "potential_consequence": "Open issues stay forever for work that is already done, and humans see a false backlog"
  },
  {
    "lens": "adversarial",
    "location": "Tasks PR B; Design Notes S1 condition 2",
    "trigger_condition": "Some run-state-shaped lines were written by a human (auto_attempt: 0 with a prose retry_when, lines 10-17, and a retry_when alone at line 215). PR B deletes them, and condition 2 reads only `sweep-attempt` comments",
    "guard_snippet": "Say how `## Prior attempts` feeds condition 2, or have the first sync post an equivalent `sweep-attempt` comment. Keep a human-authored retry_when as a ledger precondition (condition 6)",
    "potential_consequence": "Entries that a human gated on a precondition become eligible at once and are built too early"
  },
  {
    "lens": "adversarial",
    "location": "Acceptance Criteria (integrate_branch) vs Design Notes S1/S5",
    "trigger_condition": "The AC says the sweep reads the run state from the issue body, and the Design Notes say it reads the comments. No step sets ITEM_REINTEGRATE or SPEC_FILE from either source",
    "guard_snippet": "Name one source for ITEM_ATTEMPT, ITEM_REINTEGRATE, RETRY_WHEN and SPEC_FILE: the latest `sweep-attempt` comment, else the parsed `## Prior attempts`. Give a parse rule for each field",
    "potential_consequence": "The live-sync entry (integrate_branch, retry_when never) is rebuilt from scratch or retried in spite of its gate"
  },
  {
    "lens": "adversarial",
    "location": "Tasks PR A, SKILL.md 'one small edit only: step 4.1.4'",
    "trigger_condition": "Step 4.1.3 removes the source_spec, summary, evidence and run-state lines but not `id:`. Step 5.3.3 inserts lines 'below the evidence line'",
    "guard_snippet": "PR A also edits step 4.1.3 to remove the `id:` line. Test that no `id:` line exists outside a source_spec bullet",
    "potential_consequence": "The first sweep run between the PRs leaves an orphan id line. The ledger is corrupted, or the test fails on master"
  },
  {
    "lens": "adversarial",
    "location": "Between the PRs; Tasks PR A ('sweep unchanged')",
    "trigger_condition": "The old sweep still writes run state to the ledger between PR A and PR B. The sync copies it only when it creates an issue, and PR B then deletes it",
    "guard_snippet": "Allow no sweep run between the first sync and the merge of PR B, or have PR B diff the run-state lines against the issues and fail on a line that is missing",
    "potential_consequence": "Attempt history and a kept integrate_branch are lost, so finished work is rebuilt"
  },
  {
    "lens": "adversarial",
    "location": "Design Notes S1 ('Run pnpm deferred:issues first'); Matrix 'New entry'",
    "trigger_condition": "Two parallel runs both sync, both see an id with no issue, and both create one. There is no lock and no check after the create",
    "guard_snippet": "After the creates, re-list the issues and close the duplicates, keeping the lowest number. Or make the sweep's sync read-only and give issue creation to a single owner",
    "potential_consequence": "Duplicate issues appear, the next sync exits 1, and every later sweep aborts"
  },
  {
    "lens": "adversarial",
    "location": "Matrix 'Duplicate issues'; Design Notes S1 ('If it fails, abort')",
    "trigger_condition": "One duplicate issue, or one `gh` error for a single id, makes the sync exit 1, and all sweeps then stop",
    "guard_snippet": "Keep 'GitHub unreachable' (abort) apart from 'data inconsistency on id X' (report it, skip X, continue)",
    "potential_consequence": "One bad issue blocks the whole queue"
  },
  {
    "lens": "adversarial",
    "location": "Matrix 'Stale claim'; AC 'never build the same issue'",
    "trigger_condition": "A build that takes longer than 6 h, or a paused session, loses its claim while its work is still in progress",
    "guard_snippet": "Post a heartbeat claim before long steps, or also require that the run's worktree or branch is gone. Re-check the claim before the push in step 4.3",
    "potential_consequence": "Two runs build the same issue and open two work PRs"
  },
  {
    "lens": "adversarial",
    "location": "Design Notes S1 claim protocol",
    "trigger_condition": "'Earliest' can mean the self-reported `at=` or GitHub's created_at. Local clocks differ between machines",
    "guard_snippet": "Order claims by GitHub comment created_at or comment id. Use created_at for the staleness check too",
    "potential_consequence": "With clock skew, both runs see themselves as the winner and build"
  },
  {
    "lens": "adversarial",
    "location": "Design Notes S1/S4/S5 (comments as run state); Boundaries",
    "trigger_condition": "The repo is public, so anyone can post a `sweep-claim`, `sweep-release` or `sweep-attempt` comment. Comment text is read into an unattended agent that has push rights",
    "guard_snippet": "Accept protocol comments only from the authenticated gh user or from collaborators with write access (author.login / authorAssociation). Never treat comment text as instructions",
    "potential_consequence": "An outsider can block any issue permanently, unblock a 'never' issue, or inject instructions into the agent"
  },
  {
    "lens": "adversarial",
    "location": "Design Notes S5 (`sweep-attempt` format)",
    "trigger_condition": "retry_when values contain spaces ('never — needs a human', 'master has moved past <sha>'), so space-separated key=value parsing is ambiguous",
    "guard_snippet": "Put one field on each line, or quote the values. Give the parse rule and delimit the blocker text",
    "potential_consequence": "Condition 2 misreads retry_when, so a blocked issue is retried daily or an eligible one is never retried"
  },
  {
    "lens": "adversarial",
    "location": "Design Notes S4/S5 (labels); Tasks PR A (label creation)",
    "trigger_condition": "Only the `deferred` label is created, so `--add-label sweep:claimed` fails. Nothing removes `sweep:claimed` when a PR closes unmerged. The effect of removing `sweep:blocked` when retry_when=never is undefined",
    "guard_snippet": "The sync creates all three labels. State whether the labels or the comments are authoritative, and add a cleanup step for stale `sweep:claimed`",
    "potential_consequence": "The first claim aborts, labels mislead, and removing `sweep:blocked` does not unblock the issue"
  },
  {
    "lens": "adversarial",
    "location": "Between the PRs (adopt #2)",
    "trigger_condition": "The sync lists only `--label deferred`, and #2 may not have that label",
    "guard_snippet": "`gh issue edit 2 --add-label deferred`, or warn on a marker line in an issue with no label",
    "potential_consequence": "The first real sync creates a duplicate of #2"
  },
  {
    "lens": "adversarial",
    "location": "Tasks PR A (--ref); Verification (--ref HEAD)",
    "trigger_condition": "--ref accepts any ref in write mode. The sync does no fetch, and S1 does not order it after `git fetch`",
    "guard_snippet": "Refuse writes unless the ref is origin/master (allow other refs only with --dry-run). Run the sync after `git fetch origin master`",
    "potential_consequence": "Issues for live entries are closed, and with no reopen they leave the queue silently"
  },
  {
    "lens": "adversarial",
    "location": "Matrix 'Closed but still listed'",
    "trigger_condition": "Only a report, exit 0, and candidates are open issues only. An issue can be closed by hand, by a lost ledger commit, or by the wrong-ref sync",
    "guard_snippet": "Show the mismatch in the sweep notes, exit non-zero, or require the ledger removal first",
    "potential_consequence": "Orphaned ledger entries, and no one acts on the signal"
  },
  {
    "lens": "adversarial",
    "location": "Design Notes 'Why dw-<slug>'; Tasks PR A test",
    "trigger_condition": "A slug collision shows up only in `pnpm test` at step 4.2, after the build is done, and S4's failure path then parks the item as blocked",
    "guard_snippet": "In 4.1.4 and in the rebuild after a rebase in 4.2, check new ids against BASE and add a suffix (-2) on a collision",
    "potential_consequence": "Finished work is parked for a cosmetic id clash"
  },
  {
    "lens": "adversarial",
    "location": "Tasks PR A parser; Matrix 'New entry' (title)",
    "trigger_condition": "Summaries span several lines with nested bullets and backticks, and can be longer than a title allows. There is no rule for fields that continue on more lines and no truncation rule",
    "guard_snippet": "Give a continuation rule (indented lines that are not key lines belong to the field) and a 70-char word-boundary title cut. Add a fixture from the real ledger",
    "potential_consequence": "Fields are truncated, or a create fails, which exits 1 and aborts every sweep"
  },
  {
    "lens": "adversarial",
    "location": "Boundaries ('Every gh call ... one injectable runner')",
    "trigger_condition": "Only gh is injectable, but `git show <ref>:...` also spawns a process",
    "guard_snippet": "Route git through the same runner or a second injectable one, and say so in Boundaries",
    "potential_consequence": "Tests spawn git and depend on the local origin/master, which breaks the test/setup.ts rule"
  },
  {
    "lens": "adversarial",
    "location": "Code Map; Tasks PR A migration ('the ledger rule allows a rewrite')",
    "trigger_condition": "The rule allows removal in a decision commit, not a rewrite of every entry. AGENTS.md ('appends ... does not rewrite') and the header's auto_attempt sentence are not in the Code Map",
    "guard_snippet": "Add AGENTS.md to the Code Map and record the new rules there (entries need id:, run state lives in issues). Cite the migration as a one-time human decision",
    "potential_consequence": "Agents keep writing entries with no id, and the instructions contradict the header"
  },
  {
    "lens": "adversarial",
    "location": "Matrix 'Entry removed'",
    "trigger_condition": "Every removed entry's issue is closed 'as completed', cancellations included",
    "guard_snippet": "Close as not planned on a cancel decision, or always close as not planned and let `Closes #N` handle completion",
    "potential_consequence": "Cancelled work shows as completed in the issue history"
  },
  {
    "lens": "adversarial",
    "location": "Matrix 'Up to date'; Tasks PR A (--limit 1000)",
    "trigger_condition": "`--state all --limit 1000` truncates silently, and matching on the first line is not normalized for CRLF or whitespace",
    "guard_snippet": "Paginate, or fail when the count equals the limit. Trim the first line and normalize its line ending",
    "potential_consequence": "Missed matches lead to duplicates, then exit 1 and a stalled sweep"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Tasks PR A, SKILL.md one small edit (step 4.1.3 unchanged)",
    "trigger_condition": "The old sweep removes an entry between PR A and PR B, and step 4.1.3 omits the id line",
    "guard_snippet": "PR A also edits step 4.1.3 to remove the bullet's id line with the other lines",
    "potential_consequence": "An orphan `id:` line attaches to the previous bullet, and the ledger test or parser fails on master"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Design Notes S1 condition 2 vs AC (integrate_branch in `## Prior attempts`)",
    "trigger_condition": "A migrated issue holds its run state only in the body and has no sweep-attempt comment",
    "guard_snippet": "When there is no sweep-attempt comment, parse the legacy auto_attempt, retry_when and integrate_branch lines under `## Prior attempts`",
    "potential_consequence": "A 'never — needs a human' entry becomes eligible and is rebuilt, and the attempt cap resets"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Tasks PR A sync (Prior attempts only at create); PR B ledger commit",
    "trigger_condition": "A marker PR from the old sweep adds run-state lines after the issue already exists",
    "guard_snippet": "Before PR B deletes the lines, diff them against the issue body and post each missing line as a sweep-attempt comment",
    "potential_consequence": "PR B deletes run state that no issue holds, with no signal"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Tasks PR B cutover (no in-flight PR handling)",
    "trigger_condition": "Old-format work or marker PRs (`Deferred entry: <summary>`) are still open when PR B merges",
    "guard_snippet": "Precondition for PR B: no open deferred/* PR whose first line fails ^Deferred entry: dw-. Close or merge those PRs first",
    "potential_consequence": "Condition 8 misses them and the entry is built twice, or a late marker merge fails the ledger test"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Tasks PR A ledger test; Boundaries Never (no bmad-build change)",
    "trigger_condition": "bmad-build's deferred-ledger-audit, a retro or a hand edit appends an entry with no id",
    "guard_snippet": "Define a mechanical entry/note rule. Update every appender, or have the sync report entries with no id without failing",
    "potential_consequence": "Unrelated builds fail pnpm test, or the entry never gets an issue"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Tasks PR A migration (entry/note split) and ledger test",
    "trigger_condition": "The test must tell entries from notes, but the split is a judgment",
    "guard_snippet": "Treat every source_spec bullet with a summary and evidence as an entry, or give notes a `kind: note` marker",
    "potential_consequence": "The test and the sync disagree with the migration about notes such as [NOTE FOR UX] or resolved_by bullets"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Tasks PR A migration (ITEM_SLUG as id)",
    "trigger_condition": "Two entries produce the same six-word slug, or a summary produces an empty slug or one that starts with punctuation",
    "guard_snippet": "On a collision append -2, -3 within the 40-char cap. For an empty slug use dw-entry-<n>",
    "potential_consequence": "The migration gives duplicate or invalid ids, and no rule resolves them"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Tasks PR A test rationale ('duplicate fails ... does not merge')",
    "trigger_condition": "Two open PRs append the same id, and each passes on its own base",
    "guard_snippet": "The sync exits 1 on an id that two ledger entries share and names both. Add a matrix row",
    "potential_consequence": "A duplicate id reaches master, and the sync behavior is undefined"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Matrix 'Closed but still listed' + 'New entry'",
    "trigger_condition": "A new entry reuses the id of a closed issue, or a human closes an issue whose entry is still listed",
    "guard_snippet": "Check uniqueness against all issue ids ever used, or create a new issue when the entry was re-added",
    "potential_consequence": "The entry never gets an open issue and is never a candidate"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Matrix 'Entry removed'",
    "trigger_condition": "The ledger at the ref is missing, empty or partly unparseable, or `git show` fails",
    "guard_snippet": "Exit 1 before any close when git show fails, when 0 entries parse, or when any bullet fails to parse",
    "potential_consequence": "Every open deferred issue is closed at once"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Design Notes S1; sync default --ref",
    "trigger_condition": "The sync runs on a stale origin/master while another run already created an issue for a new id",
    "guard_snippet": "Fetch before the sync. Close only issues that were created before the ref's commit date",
    "potential_consequence": "A stale run closes a valid new issue"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Design Notes S1 (sync at the start of each parallel run)",
    "trigger_condition": "Two sweeps sync at the same time, and both create an issue for a new id",
    "guard_snippet": "Re-list after the create, and close the newer duplicate",
    "potential_consequence": "Duplicate issues, exit 1, and every later sweep aborts"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Tasks PR A sync ('creates the label deferred if missing')",
    "trigger_condition": "Two runs create the missing label at the same time",
    "guard_snippet": "`gh label create deferred --force`, or treat 'already exists' as success",
    "potential_consequence": "The second run exits 1, and its sweep aborts"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Matrix 'New entry' error handling",
    "trigger_condition": "The create times out after the server already made the issue, or the comment posts but the close fails",
    "guard_snippet": "Re-list by marker before a retry. Skip the comment if a left-the-ledger comment already exists",
    "potential_consequence": "The rerun makes a duplicate, or close comments repeat"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Tasks PR A (--limit 1000, state all)",
    "trigger_condition": "Deferred issues, closed ones included, grow past 1000",
    "guard_snippet": "Paginate with `gh api --paginate`, or fail when the count equals the limit",
    "potential_consequence": "Issues past the limit are not seen, so the sync creates duplicates"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Tasks PR A ('matches them on the first body line')",
    "trigger_condition": "The body is empty or null, has CRLF or trailing spaces, or one id is a prefix of another",
    "guard_snippet": "first = (body ?? '').split(/\\r?\\n/)[0].trim(); match exactly /^Deferred entry: (dw-[a-z0-9-]{1,40})$/",
    "potential_consequence": "A crash, a missed match that leads to a duplicate, or a match with the wrong entry"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Matrix (no row); Between the PRs (#2)",
    "trigger_condition": "An open issue with the `deferred` label has no marker that parses (for example #2, or an issue a human made)",
    "guard_snippet": "Report an unparseable marker and leave the issue alone. Never treat it as 'id not in ledger'",
    "potential_consequence": "The sync comments on a human's issue and closes it"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Between the PRs (`gh issue edit 2`)",
    "trigger_condition": "#2 has no `deferred` label, and the sync lists only that label",
    "guard_snippet": "gh issue edit 2 --add-label deferred --body-file <file>",
    "potential_consequence": "The first real sync creates a duplicate of #2"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Matrix 'New entry' (title from summary)",
    "trigger_condition": "The summary is longer than 256 chars, spans several lines, or is wrapped in quotes",
    "guard_snippet": "Title = the first line, unquoted, cut at a word boundary to 70 chars (the PR TITLE rule)",
    "potential_consequence": "The create fails (exit 1 on every run), or the title is garbled"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Design Notes S1 condition 8 ('body contains Closes #<N>')",
    "trigger_condition": "Issue #1 is checked while a PR body says Closes #12",
    "guard_snippet": "Match /^Closes #<N>$/m, not a substring",
    "potential_consequence": "The issue is skipped as in flight when it is not"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Design Notes S1 claim ('earliest active sweep-claim wins')",
    "trigger_condition": "Two claims share a second, the clocks differ, or read-after-write lag hides an earlier claim",
    "guard_snippet": "Order by GitHub created_at, then by comment id. Re-read a second time after a short delay",
    "potential_consequence": "Both runs believe they won"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Matrix 'Stale claim' (6 h) / Design Notes S1",
    "trigger_condition": "A build-auto run lasts longer than 6 h and has no PR yet",
    "guard_snippet": "Refresh the claim between sections 2, 3 and 4, or require that WT_BRANCH is gone before a takeover",
    "potential_consequence": "A second run claims a live issue, and the AC fails"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Design Notes S1 claim vs S2 abort path / crash",
    "trigger_condition": "A run claims an issue, then aborts (EnterWorktree, dirty tree, pnpm install) or the session dies",
    "guard_snippet": "The S2 abort path posts sweep-release and removes sweep:claimed before S6",
    "potential_consequence": "The issue stays locked for 6 h with a label that no one owns"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Design Notes S4 ('keep sweep:claimed until PR merges or closes')",
    "trigger_condition": "A human closes the work PR without a merge",
    "guard_snippet": "The sync or S1 removes sweep:claimed when there is no active claim and no open Closes PR",
    "potential_consequence": "The label stays forever"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Design Notes S5 (sweep-attempt format)",
    "trigger_condition": "retry_when values contain spaces",
    "guard_snippet": "Put retry_when last on its own line, or quote the value",
    "potential_consequence": "The key=value parse misreads retry_when, integrate_branch and branch"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Design Notes S5 (human removes sweep:blocked)",
    "trigger_condition": "A human removes sweep:blocked, but the latest comment still says retry_when=never",
    "guard_snippet": "Define that a missing sweep:blocked label overrides the latest retry_when, and state it in condition 2",
    "potential_consequence": "Removing the label has no effect, or the effect is undefined"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Design Notes S5 (issue writes replace marker PR)",
    "trigger_condition": "A comment or label write fails during the blocked path",
    "guard_snippet": "Report 'blocked, issue not updated: <step>' and keep the claim so that the 6 h rule stops a retry",
    "potential_consequence": "The attempt goes unrecorded, runs repeat without end, and they bypass the cap"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Tasks PR B ledger commit ('removes every retry_when: line')",
    "trigger_condition": "A hand-written retry_when has no auto_attempt ('A git remote is configured...')",
    "guard_snippet": "Keep preconditions that are not run state: move them into evidence, or keep a retry_when that has no auto_attempt",
    "potential_consequence": "The precondition is deleted, and condition 6 no longer skips the entry"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Design Notes S1 ('entry read from ledger on BASE by id')",
    "trigger_condition": "An open issue's id is not in BASE (it was removed after the sync)",
    "guard_snippet": "When no entry has the id, skip the candidate and note it",
    "potential_consequence": "The lookup fails mid-pick, and the behavior is undefined"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Design Notes S1 ('try the next issue') vs 'Examine exactly one entry'",
    "trigger_condition": "A run loses its claim and moves on to the next candidate",
    "guard_snippet": "Rewrite the rule: one claimed issue per run, and a lost claim does not count",
    "potential_consequence": "The skill contradicts itself"
  },
  {
    "lens": "edge-case-hunter",
    "location": "Matrix 'New entry' (entries retired by notes)",
    "trigger_condition": "A note retires an entry (condition 1), but the entry stays in the ledger",
    "guard_snippet": "The sync skips retired entries, or labels them sweep:retired",
    "potential_consequence": "Open issues stay for dead work (for example pinned-cap #2)"
  },
  {
    "lens": "structure",
    "location": "Design Notes 'Sweep changes' and Tasks PR B SKILL.md task",
    "trigger_condition": "The PR B task points to Design Notes, and Design Notes holds both the rationale and the section-by-section procedure",
    "guard_snippet": "MOVE 'Sweep changes' and 'Rules for all steps' under the PR B task, or into a '### Sweep rewrite (PR B)' subsection. Keep only the dw-<slug> rationale in Design Notes",
    "potential_consequence": "A PR B implementer has to jump about 60 lines to find the steps"
  },
  {
    "lens": "structure",
    "location": "Design Notes S1 (pick) bullet",
    "trigger_condition": "Six operations are in one bullet, and 'active claim' is defined last although condition 8 uses it earlier",
    "guard_snippet": "CONDENSE into numbered steps (sync, candidates, skip 1-8, claim, resolve race). Define 'active claim' first",
    "potential_consequence": "The execution order is only implied, and the term is used before its definition"
  },
  {
    "lens": "structure",
    "location": "Design Notes S5 (blocked) bullet",
    "trigger_condition": "Steps that depend on their order are written as prose",
    "guard_snippet": "CONDENSE into six numbered steps, with the sweep-attempt format on its own code line",
    "potential_consequence": "The release and cleanup order can be misread"
  },
  {
    "lens": "structure",
    "location": "Tasks PR A deferred-issues.ts task",
    "trigger_condition": "The densest bullet holds every requirement, and its '-- reason' tail holds an architecture rule",
    "guard_snippet": "CONDENSE into sub-bullets: Inputs, Matching, Writes, --dry-run, Structure (parser -> diff -> gh)",
    "potential_consequence": "The core deliverable is hard to scan, and the bullet breaks the pattern"
  },
  {
    "lens": "structure",
    "location": "Tasks 'Between the PRs' paragraph",
    "trigger_condition": "The only public-repo writes that PR B depends on are in a prose paragraph",
    "guard_snippet": "PRESERVE the position, and make it a three-item checklist with the gating line above",
    "potential_consequence": "A reader can skip the step"
  },
  {
    "lens": "structure",
    "location": "Code Map, last bullet (issue #2)",
    "trigger_condition": "#2 is not a code location",
    "guard_snippet": "MOVE it into the `gh issue edit 2` step",
    "potential_consequence": "The Code Map mixes in non-code facts"
  },
  {
    "lens": "structure",
    "location": "Verification, dry-run explanation",
    "trigger_condition": "It repeats the adoption reasoning",
    "guard_snippet": "CONDENSE: 'one create per entry (including pinned-cap; #2 not yet adopted), no writes'",
    "potential_consequence": "Redundancy, about 15 words"
  },
  {
    "lens": "structure",
    "location": "Verification, whole section",
    "trigger_condition": "The checks are not tied to PR A or PR B, and the two-session check works only after PR B",
    "guard_snippet": "Tag each item (PR A) / (PR B) / (both), or group them by PR",
    "potential_consequence": "It is unclear which check gates which merge"
  },
  {
    "lens": "structure",
    "location": "Frontmatter title",
    "trigger_condition": "The title has 25 words",
    "guard_snippet": "CONDENSE to 'Deferred work as GitHub issues'",
    "potential_consequence": "The title is unwieldy in sprint lists and PR references"
  },
  {
    "lens": "structure",
    "location": "Design Notes 'Rules for all steps'",
    "trigger_condition": "A rule that covers every step comes after the steps",
    "guard_snippet": "MOVE it to the top of the sweep-rewrite block",
    "potential_consequence": "A reader learns the constraint too late"
  },
  {
    "lens": "structure",
    "location": "Tasks PR B test bullet",
    "trigger_condition": "It has no '-- reason' tail, unlike the other bullets",
    "guard_snippet": "Add '-- keeps run state out of the ledger for good'",
    "potential_consequence": "The pattern has a gap"
  },
  {
    "lens": "structure",
    "location": "Intent, Approach last bullet (frozen)",
    "trigger_condition": "A constraint sits among the approach steps",
    "guard_snippet": "QUESTION (human-owned): move it to Boundaries Never?",
    "potential_consequence": "It is separated from the matching Never item"
  },
  {
    "lens": "structure",
    "location": "Matrix Claim race / Stale claim rows (frozen)",
    "trigger_condition": "'active claim' is used before it is defined",
    "guard_snippet": "QUESTION: fix it outside the frozen block by defining the term early (see the S1 row)",
    "potential_consequence": "The term is undefined at first use"
  },
  {
    "lens": "structure",
    "location": "Tasks opening paragraph",
    "trigger_condition": "(keep)",
    "guard_snippet": "PRESERVE",
    "potential_consequence": "It gives the reader the two-PR model before the checklists"
  },
  {
    "lens": "structure",
    "location": "Acceptance Criteria item 4",
    "trigger_condition": "(keep)",
    "guard_snippet": "PRESERVE",
    "potential_consequence": "It is a testable restatement, not redundancy"
  },
  {
    "lens": "structure",
    "location": "Empty Implementation Notes / Change Log / Triage Log",
    "trigger_condition": "(keep)",
    "guard_snippet": "PRESERVE",
    "potential_consequence": "These are template slots that the workflow fills"
  },
  {
    "lens": "prose",
    "location": "Design Notes S1",
    "trigger_condition": "'Skip conditions 1–7 stay the same.' The next sentence changes condition 2",
    "guard_snippet": "'Skip conditions 1 and 3–7 stay the same.'",
    "potential_consequence": "The two sentences contradict each other"
  },
  {
    "lens": "prose",
    "location": "Tasks PR B SKILL.md bullet",
    "trigger_condition": "'except for the renamed values' has no antecedent",
    "guard_snippet": "Name the values, or delete the clause",
    "potential_consequence": "The implementer guesses what to rename"
  },
  {
    "lens": "prose",
    "location": "Tasks PR A SKILL.md bullet",
    "trigger_condition": "'the sweep must still pass the new test'",
    "guard_snippet": "'entries that the sweep appends must pass the new test until PR B rewrites the sweep'",
    "potential_consequence": "The subject is wrong"
  },
  {
    "lens": "prose",
    "location": "Between the PRs",
    "trigger_condition": "'<id of the pinned-cap entry>' does not identify the entry",
    "guard_snippet": "Give the literal dw- id, or quote the summary",
    "potential_consequence": "The human cannot tell which entry is meant"
  },
  {
    "lens": "prose",
    "location": "AC item 2",
    "trigger_condition": "'After the migration' is ambiguous, because there are two migration commits",
    "guard_snippet": "'After PR B merges, the sweep reads the line from the issue.'",
    "potential_consequence": "The timing is ambiguous"
  },
  {
    "lens": "prose",
    "location": "Tasks PR A / PR B ledger bullets",
    "trigger_condition": "'names the decision' has no referent",
    "guard_snippet": "Name each decision (add ids; move run state to issues)",
    "potential_consequence": "The commit subject is underspecified"
  },
  {
    "lens": "prose",
    "location": "Design Notes S1",
    "trigger_condition": "'with the same run'",
    "guard_snippet": "'with the same `run=` value'",
    "potential_consequence": "It reads as the process, not the token"
  },
  {
    "lens": "prose",
    "location": "Design Notes S6",
    "trigger_condition": "'Add `issue: #<N>`.'",
    "guard_snippet": "'Add an `issue: #<N>` line to the report.'",
    "potential_consequence": "The target is unstated"
  },
  {
    "lens": "prose",
    "location": "Design Notes S4",
    "trigger_condition": "'not by matching three fields'",
    "guard_snippet": "Name the three fields",
    "potential_consequence": "The fields are opaque when SKILL.md is not open"
  },
  {
    "lens": "prose",
    "location": "Design Notes S4",
    "trigger_condition": "'...; condition 8 still sees the open PR' reads as the reason the label stays",
    "guard_snippet": "Say that the label is for people only, and state what removes it",
    "potential_consequence": "The rationale is muddled"
  },
  {
    "lens": "prose",
    "location": "Design Notes S5",
    "trigger_condition": "'Replace it all' / 'the blocker on the next line'",
    "guard_snippet": "'Replace the whole section' / 'a one-line description of the blocker on the next line'",
    "potential_consequence": "Vague references"
  },
  {
    "lens": "prose",
    "location": "Tasks PR A deferred-issues.ts bullet",
    "trigger_condition": "'the matrix', 'with no runner', '(+ ...)'",
    "guard_snippet": "'the I/O & Edge-Case Matrix', 'without the gh runner', '(with ...)'",
    "potential_consequence": "Loose references, and a '+' used for 'and'"
  },
  {
    "lens": "prose",
    "location": "Tasks PR A test bullet",
    "trigger_condition": "'... and does not merge' (a run does not merge)",
    "guard_snippet": "'..., and its PR does not merge.'",
    "potential_consequence": "The subject is wrong"
  },
  {
    "lens": "prose",
    "location": "Between the PRs",
    "trigger_condition": "'since these write'",
    "guard_snippet": "'because these steps write'",
    "potential_consequence": "Microsoft style ('because' for cause)"
  },
  {
    "lens": "prose",
    "location": "Design Notes S1",
    "trigger_condition": "'6 h' in running text",
    "guard_snippet": "'6 hours' (the table may keep '6 h')",
    "potential_consequence": "Microsoft style"
  },
  {
    "lens": "prose",
    "location": "Design Notes S1/S5",
    "trigger_condition": "'label `deferred`' vs 'the label `sweep:blocked`'",
    "guard_snippet": "Use 'the label' in every place",
    "potential_consequence": "Inconsistent wording"
  },
  {
    "lens": "prose",
    "location": "Throughout",
    "trigger_condition": "'ids' in prose",
    "guard_snippet": "Consider 'IDs', keeping `id:` for the token (low priority)",
    "potential_consequence": "Microsoft style"
  },
  {
    "lens": "prose",
    "location": "Throughout",
    "trigger_condition": "No serial comma",
    "guard_snippet": "Accept only if the Microsoft guide overrides the house style (AGENTS.md omits the serial comma on purpose)",
    "potential_consequence": "A conflict between the style guide and the house style"
  },
  {
    "lens": "prose",
    "location": "Frozen, Boundaries Never",
    "trigger_condition": "'Section 5' does not say which document",
    "guard_snippet": "QUESTION: 'The sweep skill's section 5 ...'?",
    "potential_consequence": "The reference is unclear at first read"
  },
  {
    "lens": "prose",
    "location": "Frozen, Matrix 'New entry'",
    "trigger_condition": "'first line' could mean the title",
    "guard_snippet": "QUESTION: 'whose body's first line names it'?",
    "potential_consequence": "Misreading"
  }
]
```
