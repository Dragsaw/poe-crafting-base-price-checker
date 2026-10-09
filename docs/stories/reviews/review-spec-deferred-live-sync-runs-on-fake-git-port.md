# Review: spec-deferred-live-sync-runs-on-fake-git-port

- **Date:** 2026-09-27
- **Content:** `docs/stories/archive/spec-deferred-live-sync-runs-on-fake-git-port.md`, a behavioral spec (docs). The lenses also read the implementation under `packages/sync/src` for grounding.
- **Lenses:** adversarial, edge-case-hunter, structure, prose (prose ran on top of the structure findings). verification-gap did not run, because it applies to code only.
- **Context:** This is the follow-up review that the first pass requested (`followup_review_recommended: true`). In this procedure, that flag stops the fast-forward to master.

## Overlap between lenses

These findings came from more than one lens, which makes them the strongest signals:

1. **The `main()` wiring has no test.** The spec names this as an open risk. The adversarial lens (A5) and the edge-case lens (E2, E3) both found that if `sync.ts:85` is reverted to `createFakeGitPort()`, every test still passes. Both lenses propose a static source-text pin, like the one in `no-git-write.test.ts`, that does not break the "no test runs `main`" policy.
2. **The `log.showSignature` test proves nothing.** The spec names this as an open risk. The adversarial lens (A4) and the edge-case lens (E4) both found that an unsigned commit prints no signature lines, so the test passes with or without `--no-show-signature`. The fix is to sign with a stub or an ssh key.
3. **Every non-zero exit becomes a silent fallback.** A git older than 2.10 (which lacks `--no-show-signature`) exits 129, and a safe.directory refusal exits 128. In both cases the feature is off permanently and nothing signals it (A3, E5).
4. **The spec has drifted from the code.** The Always bullet still names the old invocation, and the Spec Change Log is empty (A1, structure row 4). The ENOENT wording is also stale (A2).
5. **"done" hides the blocked state.** The spec says `status: 'done'`, but `followup_review_recommended: true` and `review_loop_iteration: 0` also apply (A9, structure rows 1 to 3).
6. **The matrix does not cover a rename or a deletion.** The spec does not say which date is correct after a rename, a merge, a rebase or a deleted-then-recreated file (A11, E6).

Neither open risk that blocks the fast-forward is closed. Both lenses that read the code confirm that the two risks the first pass named are real and have cheap fixes.

## Adversarial

- **A1.** Location: Boundaries › Always, bullet 1, compared with `read-only-git-port.ts:62`. Problem: the contract names `git --no-optional-locks log -1 --format=%at -- <path>`, but the code and the pin use `... log --no-show-signature -1 ...`, and the Spec Change Log is empty. Fix: update the invocation and add a Change Log entry. Consequence: someone who follows the spec removes the flag, or the spec and the code drift apart with no signal.
- **A2.** Location: Always, bullet 3. Problem: the bullet still says "a `git` binary that cannot start (ENOENT)", but the triage changed that wording in the code only. Fix: "no `git` binary is found (ENOENT); any other spawn error rejects". Consequence: the spec suggests that EACCES and EPERM fall back, but the code rejects them.
- **A3.** Location: `read-only-git-port.ts:50-53` (`isNoDate`) and the I/O matrix. Problem: every numeric exit becomes `undefined`. This includes exit 129 (an unknown flag on an older git) and exit 128 "dubious ownership". Fix: fall back only when exit 128 comes with "not a git repository" in stderr, and otherwise reject or report the stderr text. Add matrix rows for these cases. Consequence: on such a machine, `git-author-date` never appears and nothing says why.
- **A4.** Location: Auto Run Result, risk 2, and `read-only-git-port.test.ts:105-114`. Problem: on an unsigned commit, `log.showSignature` prints nothing, so the test does not guard the flag. Fix: make a signed commit through a stub `gpg.program`, an ssh signing key or a hand-built `gpgsig` object. Assert that the port still returns the date, and add a control check that plain `--show-signature` output does not parse. Consequence: the triage log says the medium finding is fixed, but it is not proven.
- **A5.** Location: AC 1, Auto Run Result › Verification, and `sync.ts:85`. Problem: AC 1 is not tested through `pnpm sync`, and reverting the wiring passes every test. Fix: add a static test that `sync.ts` matches `/git:\s*createReadOnlyGitPort\(REPO_ROOT\)/` and does not match `createFakeGitPort`. Another option is to export `livePorts()`. Consequence: the story's main deliverable can regress with CI still green.
- **A6.** Location: `read-only-git-port.test.ts:38-42`. Problem: the fixtures set the committer date equal to the author date. Fix: give one commit a committer date that is different from its author date, and assert that the author date comes back. Consequence: a `%ct` regression is caught only by the literal pin, not by any semantic test.
- **A7.** Location: the triage reject "aliased `execFile` … needs AST analysis". Problem: a count of the `\bexecFile\b` token would catch an alias without an AST. Fix: assert the exact number of `execFile` tokens. Consequence: a refactor can route the call through a wrapper, which weakens the AD-3 pin.
- **A8.** Location: the triage reject "the port passes output through unchanged" and `read-only-git-port.ts:65-77`. Problem: no test covers the port's reject paths. Fix: put a stub `git` on `PATH` that prints "nonsense" and exits 0, and assert that the port rejects with the path in the message. Consequence: a regression that resolves to `undefined`, or never settles while the lock is held, goes unseen.
- **A9.** Location: the frontmatter. Problem: `status: 'done'` and `review_loop_iteration: 0` appear after one review pass, while the flag is still true. Fix: set the iteration to 1, and keep the status before done or say in the frontmatter that the merge is blocked. Consequence: a tool that reads only `status` can fast-forward too early.
- **A10.** Location: the timeout rejects and Residual risks. Problem: git runs while the sync lock is held and has no timeout. Fix: `timeout: 10_000, killSignal: 'SIGKILL'`, with `killed` mapped to `undefined`. Consequence: a rare hang holds the lock for the whole staleness window of AD-7.
- **A11.** Location: the I/O matrix. Problem: the spec does not say what date results from a rename (no `--follow`), from history simplification after a merge, or from a rebase where `-1` gives an older author date. Fix: add rows that state the intended result, or name these cases as accepted limits. Consequence: a date that claims authority (`git-author-date`) may not be the player's last curation edit.
- **A12.** Location: `read-only-git-port.test.ts:87-97, 105-114`. Problem: tests change the shared fixture state, and the `finally` unset can hide the first error. Fix: give each test its own repository, or pass config for each call (`GIT_CONFIG_PARAMETERS`). Consequence: order-dependent failures in future tests.

## Edge-Case Hunter

- **E1.** Location: `run-chunk.ts:583-606,749,752-799`. Problem: if the git port rejects inside `writeReport` after the dataset publish (malformed output, EACCES or a signal), both report writes call git again and fail. Fix: `resolveTrackedListAge(...).catch(fault => { log(...); return undefined; })`. Consequence: the previous `sync-report.json` stays next to the new dataset, with no record of the failure. *New. The triage treated the malformed-output throw as a bug to surface, but did not trace where the throw lands.*
- **E2.** Location: AC 1 and `read-only-git-port.test.ts:116-124`. Problem: no real port runs the path from `syncCommand` through `runChunk` and `writeReport` to `sync-report.json`. Fix: a `syncCommand` test with injected ports, the real fs and git ports, and an assertion that the report has `trackedListEditedAt.source === 'git-author-date'`. Consequence: the field can be lost between the resolver and the file, and no test fails.
- **E3.** Location: `sync.ts:85`. Problem: the wiring can revert, or get the wrong root. Fix: a static pin on `git:\s*createReadOnlyGitPort\(REPO_ROOT\)`. Consequence: the sync silently goes back to `file-modified`.
- **E4.** Location: `read-only-git-port.test.ts:105-114`. Problem: an unsigned commit prints no signature. Fix: sign with an ssh key (`gpg.format ssh`) and use `it.skipIf(!hasSshKeygen)`. Consequence: the flag's effect is not proven.
- **E5.** Location: `read-only-git-port.ts:50-53`. Problem: a git older than 2.10 exits 129 on `--no-show-signature`. Fix: reject when stderr says "unknown option". Consequence: permanent silent fallback.
- **E6.** Location: the I/O matrix and `read-only-git-port.ts:62`. Problem: the last commit that touched the path deleted or renamed it, and a new untracked file now has that path. Fix: `--diff-filter=AMR`, or a matrix row that states the intended date. Consequence: uncommitted content gets the deletion date under the `git-author-date` tag.

## Editorial Structure

Purpose: a record of a finished story, whose main question for the reader is now "can this merge?". The structure lens judged it against the Pyramid model, which puts the status first. Total length is 2,173 words. The Review Triage Log is 37% of that.

| Original Text | Revised Text | Changes |
|---|---|---|
| Auto Run Result, the "Follow-up review recommended: true." paragraph and its 2 bullets (lines 137–139) | MOVE: put a "Follow-up review: open" callout after the frontmatter that names the flag, the block and the 2 risks. Leave a pointer in Auto Run Result. | The blocking state is now explained only after 1,700+ words. About +15 words. |
| The follow-up paragraph does not say what clears each risk | QUESTION: add a "To clear" line for each risk (accept the `main()` exception in writing or add a pin; add a signed-commit test or accept the risk), and say who resets the flag. | The flag has no defined exit. About +40 words. |
| `status: 'done'` (line 5) and "Status: done" (line 125) | QUESTION: "Status: done — merge blocked pending follow-up review". | "done" without a qualifier invites a merge. About +6 words. |
| Always bullet 1 (stale invocation) and the empty Spec Change Log | MOVE: add a Change Log entry for `--no-show-signature` and the full-array pin. | The contract no longer matches the implementation. About +25 words. |
| "Six entries were patched: 3 medium and 3 low" and "patched three medium entries" | CONDENSE and relabel: "8 medium findings (3 distinct fixes after grouping) and 3 low fixes were patched." | The summary counts fixes after grouping, but the log has 8 medium `[patch]` rows, so the numbers seem to disagree. ±0 words. |
| The Follow-up bullets and the Residual risks bullets, with Verification between them | MERGE into one "Open risks" block with two groups, "Unverified" and "Accepted". | The follow-up reviewer needs both groups together. About −10 words. |
| Residual risks (4 items) compared with the triage rejects | QUESTION: list every reject, or add "Others: see Review Triage Log". | The list looks complete but leaves out five rejects, one of them the aliased-`execFile` reject (AD-3). About +8 words. |
| The duplicate triage rows (lines 96–107, about 9 rows) | CONDENSE: one row for each distinct issue, with its lenses listed. Keep the log itself. | True redundancy. About −150 words. |
| Spec Change Log, a heading with no content | CONDENSE to "None." (or the entry above). | An empty heading is ambiguous. About +1 word. |
| Design Notes, which come after the triage log | MOVE after Intent › Approach, or add a pointer from Approach. | The rationale for the exemption comes after 803 words of triage. ±0 words. |
| Verification (expected) and Auto Run Result › Verification (actual) | PRESERVE. | One section gives the expectation and the other the result. |

Net change: about −75 words (3.5%). The main effect is reordering, not length.

## Editorial Prose

Style to keep: short STE-like sentences, cited ids, no serial comma (house style, as in `AGENTS.md`). This lens skipped the text that the structure lens proposes to move or condense.

| Original Text | Revised Text | Changes |
|---|---|---|
| L21 "composes it at the repository root." | "composes it with the repository root (`REPO_ROOT`)." | "At" can read as a file location. |
| L21 "Each other file keeps the full ban." | "Every other file keeps the full ban." | Avoids the reciprocal-pronoun reading. |
| L109, L113 "The entry …" | "The deferred-work entry …" | "The entry" has no referent in this document. |
| L54 "…, and the module doc and the `SyncPorts` comment say the fake is used." | Split into two sentences, "…say that the fake is used." | Run-on sentence. |
| L146 "These were rejected as low:" | "The review rated these findings low and rejected them:" | "Low" has no noun, and the passive hides who rejected them. |
| L26 "stays read-only with its one operation" | "stays read-only and has exactly one operation" | These are two separate constraints. |
| L69 "`data/tracked.json`'s last commit author date" | "the author date of the last commit to `data/tracked.json`" | Possessive on a code element, and a noun stack. |
| L19 "Deferred by `…spec-1-11…`, decision *Scope*" | "Deferred from `…spec-1-11…`, *Scope* decision" | The work was deferred from that story, which did not do the deferring. |
| L84 "Diagnostics would add surface." | Consider: "…would add code and output for little gain." | Unclear jargon. |
| L98 "Env filtering is added complexity." | "Filtering the environment adds complexity." | Abbreviation, and a noun phrase in place of a verb. |
| L28 "This covers: empty output…" | "This covers three cases: empty output…" | No colon directly after a verb. |
| L132 "one `child_process` mention, and no exec, spawn, fork or shell." | "one `child_process` mention and no `exec`, `spawn`, `fork` or `shell` option." | Code formatting, and the stray serial comma removed. |
| L82, L139 "gpg lines", "gpg output" | "GPG lines", "GPG output" | Acronym in capitals. |
| L64 the list of isolation settings | Consider using parallel "X is Y" clauses and stating the value of `GIT_CEILING_DIRECTORIES` (check it against the test). | The list mixes clauses and bare assignments. |
| Serial comma, whole document | Consider it only if Microsoft style is meant to override the house style. | The document is consistent with the house style. |

## Findings (JSON)

The editorial lenses use their own table shape (above). The behavioral findings are:

```json
[
  {"lens":"adversarial","location":"Boundaries & Constraints > Always bullet 1; read-only-git-port.ts:62","trigger_condition":"Contract names the invocation without --no-show-signature; code and pin include it; Spec Change Log empty","guard_snippet":"Update the Always invocation and add a Spec Change Log entry","potential_consequence":"Re-implementer drops the flag, or spec and code drift silently"},
  {"lens":"adversarial","location":"Boundaries & Constraints > Always bullet 3","trigger_condition":"Spec still says 'a git binary that cannot start (ENOENT)' although the wording was fixed in code only","guard_snippet":"'no git binary is found (ENOENT); any other spawn error rejects'","potential_consequence":"Spec implies EACCES/EPERM fall back; code rejects them"},
  {"lens":"adversarial","location":"read-only-git-port.ts:50-53; I/O matrix","trigger_condition":"Every numeric exit maps to undefined, including 129 (old git, unknown flag) and 128 dubious ownership","guard_snippet":"Fall back only on 128 + 'not a git repository'; reject or report otherwise; add matrix rows","potential_consequence":"Feature permanently and silently off on affected machines"},
  {"lens":"adversarial","location":"Auto Run Result risk 2; read-only-git-port.test.ts:105-114","trigger_condition":"log.showSignature test uses unsigned commits, so it passes without the flag","guard_snippet":"Signed commit via stub gpg.program / ssh key / fake gpgsig; assert date; control assertion without the flag","potential_consequence":"Medium finding recorded as fixed but unproven"},
  {"lens":"adversarial","location":"Acceptance Criteria 1; sync.ts:85","trigger_condition":"Reverting main() to createFakeGitPort() passes every test","guard_snippet":"Static test: sync.ts matches /git:\\s*createReadOnlyGitPort\\(REPO_ROOT\\)/ and not createFakeGitPort","potential_consequence":"Core deliverable regresses with green CI"},
  {"lens":"adversarial","location":"read-only-git-port.test.ts:38-42","trigger_condition":"Fixture committer date equals author date","guard_snippet":"One commit with a different committer date; assert author date","potential_consequence":"%ct regression caught only by the literal pin"},
  {"lens":"adversarial","location":"Review Triage Log: aliased execFile reject","trigger_condition":"Reject claims AST is needed; a token count suffices","guard_snippet":"Assert exact count of /\\bexecFile\\b/g in the exempt file","potential_consequence":"Refactor routes execFile through a wrapper, weakening the AD-3 pin"},
  {"lens":"adversarial","location":"Review Triage Log: malformed-output port reject; read-only-git-port.ts:65-77","trigger_condition":"Port reject paths are untested","guard_snippet":"PATH stub git printing 'nonsense'; assert rejection naming the path","potential_consequence":"Swallowed throw resolves undefined or never settles under the lock"},
  {"lens":"adversarial","location":"Frontmatter","trigger_condition":"status done, review_loop_iteration 0 after one pass, flag true","guard_snippet":"review_loop_iteration: 1; non-done status or explicit gating until follow-up clears","potential_consequence":"Status-only tooling fast-forwards early"},
  {"lens":"adversarial","location":"Timeout rejects; Residual risks","trigger_condition":"git spawns under the sync lock with no timeout","guard_snippet":"timeout: 10_000, killSignal: 'SIGKILL'; killed -> undefined","potential_consequence":"Hang holds the lock for the AD-7 staleness window"},
  {"lens":"adversarial","location":"I/O & Edge-Case Matrix","trigger_condition":"No intended result for rename, merge simplification, rebase ordering","guard_snippet":"Add rows stating intended date, or accepted limits","potential_consequence":"git-author-date tag on a date that is not the last curation edit"},
  {"lens":"adversarial","location":"read-only-git-port.test.ts:87-97,105-114","trigger_condition":"Tests mutate shared fixture state; finally-unset can mask the first error","guard_snippet":"Per-test repo, or per-call config via GIT_CONFIG_PARAMETERS","potential_consequence":"Order-dependent future failures"},
  {"lens":"edge-case-hunter","location":"run-chunk.ts:583-606,749,752-799","trigger_condition":"Git port rejects inside writeReport after the dataset publish","guard_snippet":"resolveTrackedListAge(...).catch((fault) => { log(`sync: tracked-list date failed: ${String(fault)}`); return undefined; })","potential_consequence":"Stale sync-report.json beside the new dataset, no failure record"},
  {"lens":"edge-case-hunter","location":"Acceptance Criteria 1; read-only-git-port.test.ts:116-124","trigger_condition":"syncCommand -> runChunk -> writeReport -> sync-report.json runs no real port","guard_snippet":"syncCommand test with real fs+git ports asserting trackedListEditedAt.source === 'git-author-date'","potential_consequence":"Field dropped between resolver and report goes unnoticed"},
  {"lens":"edge-case-hunter","location":"sync.ts:85","trigger_condition":"main() wiring reverts or gets a different root","guard_snippet":"expect(readFileSync(join(ROOT, 'sync.ts'), 'utf8')).toMatch(/git:\\s*createReadOnlyGitPort\\(REPO_ROOT\\)/)","potential_consequence":"Silent return to file-modified"},
  {"lens":"edge-case-hunter","location":"read-only-git-port.test.ts:105-114","trigger_condition":"log.showSignature on an unsigned commit prints nothing","guard_snippet":"gpg.format ssh + temp ssh-keygen key + commit -S; it.skipIf(!hasSshKeygen)","potential_consequence":"Flag effect unproven"},
  {"lens":"edge-case-hunter","location":"read-only-git-port.ts:50-53","trigger_condition":"git < 2.10 exits 129 on --no-show-signature","guard_snippet":"Reject when stderr matches /unknown option|unrecognized argument/","potential_consequence":"Permanent silent fallback"},
  {"lens":"edge-case-hunter","location":"I/O matrix; read-only-git-port.ts:62","trigger_condition":"Last commit touching the path deleted/renamed it; new untracked file at that path","guard_snippet":"--diff-filter=AMR, or a matrix row stating intent","potential_consequence":"Uncommitted content tagged with the deletion commit's date"}
]
```
