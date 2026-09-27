---
title: 'A real read-only git port for the live pnpm sync'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_revision: '300f3f919c433d240a46537321c5e20b19603945'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The live `pnpm sync` composes `createFakeGitPort()` with no history, so the tracked-list edit date is always tagged `file-modified` and never comes from AD-12's first clock, `git-author-date`. The reason is that `no-git-write.test.ts` forbids every `child_process` import under `packages/sync/src`, and a real adapter needs one. (Deferred by `docs/stories/spec-1-11-league-validation-as-a-run-start-gate.md`, decision *Scope*.)

**Approach:** Add one module, `packages/sync/src/git/read-only-git-port.ts`, that implements `GitPort.lastCommitAuthorDate` with a single fixed `execFile` of `git log`. The live `sync.ts` composes it at the repository root. The scan exempts that one file from the spawn rule only, and a new assertion pins the file to the read-only invocation shape. Each other file keeps the full ban.

## Boundaries & Constraints

**Always:**
- The port stays read-only with its one operation (AD-3, AD-12). The only git invocation is `git --no-optional-locks log -1 --format=%at -- <path>`, run with `execFile` (no shell), with `cwd` set to the repository root the port was built with.
- The result is an ISO-8601 UTC string from `new Date(seconds * 1000).toISOString()`, the same form as `systemClock`.
- Where git yields no date, the result is `undefined`, and `resolveTrackedListAge` falls back to `file-modified`. This covers: empty output (no commit touches the path), a non-zero exit (not a repository) and a `git` binary that cannot start (ENOENT).
- The exemption in `no-git-write.test.ts` names exactly one relative path and lifts exactly one pattern (`a process spawn`). The git-library and git-subcommand patterns still apply to that file.

**Never:**
- No change to `GitPort`, `createFakeGitPort`, `resolveTrackedListAge`, `runChunk` or `composeChunk`.
- No change to `pnpm sync:dry` (`dry-run.ts`). It keeps the fake by design: its report is a prediction and its writes go to a fake filesystem.
- No `exec`, `spawn`, `fork` or `shell: true`. No git library dependency. No change to the spine, the PRD or `data/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Committed file | the path's last commit has author date `2026-09-20T14:00:00+02:00` | `'2026-09-20T12:00:00.000Z'` | none |
| Later commits elsewhere | a later commit does not touch the path | the date of the last commit that touches the path | none |
| Uncommitted edit | the committed file is changed in the working tree | the commit date, unchanged (AD-12) | none |
| Untracked file | file exists, no commit touches it | `undefined` | none |
| Not a repository | the root is a plain directory | `undefined` | the non-zero exit is not thrown |
| Malformed output | git prints a line that is not an integer | throws an `Error` that names the path and the output | a bug; do not hide it |

</intent-contract>

## Code Map

- `packages/contracts/src/ports/git.ts` -- `GitPort`: the one method `lastCommitAuthorDate(path)`, `undefined` for no history. Read-only.
- `packages/contracts/src/tracked-list-age.ts` -- `resolveTrackedListAge`: git first, then `filesystem.lastModifiedAt`. Read-only.
- `packages/sync/src/chunk/run-chunk.ts:589` -- calls the resolver with `TRACKED_PATH` (repo-relative `data/tracked.json`).
- `packages/sync/src/sync.ts` -- `main()` passes `git: createFakeGitPort()`, and the module doc and the `SyncPorts` comment say the fake is used. `REPO_ROOT` is the root to pass.
- `packages/sync/src/shell.ts` -- the node adapters (`createNodeFilesystemPort(root)` resolves paths against `root`). Follow its style. Do not put the spawn here, because that would exempt all of `shell.ts`.
- `packages/sync/src/no-git-write.test.ts` -- `sources()`, `FORBIDDEN`, and the two tests. The exemption goes here.
- `packages/sync/src/dry-run.ts:25,224` -- keeps the fake. Do not touch it.
- `test/setup.ts` -- the network guard. A local `git` spawn is not a network request.

## Tasks & Acceptance

**Execution:**
- `packages/sync/src/git/read-only-git-port.ts` -- add `createReadOnlyGitPort(root: string): GitPort` as described in Always. Add a doc comment on why this module is the one spawn site and what makes it read-only (AD-3). Use the `promisify(execFile)` form or a callback wrapper. Treat ENOENT and a non-zero exit as `undefined`. Throw on malformed output.
- `packages/sync/src/git/read-only-git-port.test.ts` -- in a fresh `mkdtemp` directory, set up a git repository with an isolated config: `GIT_CONFIG_GLOBAL` goes to an empty file, `GIT_CONFIG_NOSYSTEM=1`, `GIT_CEILING_DIRECTORIES` is set, `commit.gpgsign=false`, and each commit has a fixed `GIT_AUTHOR_DATE`. Cover each row of the matrix. Test the malformed-output row through the exported pure parser `parseAuthorDate(path, stdout)`, which the port uses. That row needs no repository.
- `packages/sync/src/no-git-write.test.ts` -- add a map of exemptions, `{ 'git/read-only-git-port.ts': ['a process spawn'] }`, keyed by the path relative to `ROOT` with `/` separators. Add a test that the exempted file exists, imports `execFile` only from `node:child_process`, contains no `exec(`, `spawn`, `fork` or `shell:`, and calls `execFile('git', ['--no-optional-locks', 'log', ...`. Update the header comment.
- `packages/sync/src/sync.ts` -- `main()` passes `createReadOnlyGitPort(REPO_ROOT)`. Rewrite the module doc paragraph and the `SyncPorts` comment to describe the real port. Remove the `createFakeGitPort` import.

**Acceptance Criteria:**
- Given the repository checkout, when `pnpm sync` runs, then `main()` composes `createReadOnlyGitPort(REPO_ROOT)`, and `data/tracked.json`'s last commit author date reaches `sync-report.json` tagged `git-author-date`.
- Given a new non-test file under `packages/sync/src` that imports `node:child_process`, when `pnpm test` runs, then `no-git-write.test.ts` still fails.
- Given the exempted file, when the file gains a git write subcommand, `exec`, `spawn` or a shell option, then `no-git-write.test.ts` fails.

### Review Findings

Follow-up review, 2026-09-27. There were 27 raw findings: 2 decision-needed (both rejected by the user), 3 patch, 0 defer and 14 rejected, after grouping.

- [x] [Review][Decision] The live `main()` wiring and the report tag are unverified (AC1) — Reverting `packages/sync/src/sync.ts:85` to `createFakeGitPort()`, or passing a wrong root, leaves the whole suite green. The composition test stops at `resolveTrackedListAge`, and nothing asserts that `git-author-date` reaches `sync-report.json`. There are three options. (a) Export a small live-ports factory from `sync.ts` and test that its `git` port dates a committed file. This adds public surface. (b) Add a `runSync` test with the real port on a temp repository. This covers the report field but not the `main()` line. (c) Accept the gap under the "no test runs `main`" policy. (verification-gap+acceptance-auditor+blind-hunter) — **Resolved 2026-09-27: rejected by user (option c).** The module keeps its "no test runs `main`" policy.
- [x] [Review][Decision] The `log.showSignature` test cannot fail without `--no-show-signature` — The fixture commits are unsigned, so git prints no signature lines whether or not the flag is present. The pin regex locks the flag in source text only. A behavioural test needs a signed commit, such as SSH signing with a throwaway `ssh-keygen` key and `gpg.format=ssh`, which makes the suite depend on `ssh-keygen`. Otherwise, accept the source pin plus git's documented semantics. (verification-gap+blind-hunter) — **Resolved 2026-09-27: rejected by user.** The literal pin in `no-git-write.test.ts` plus git's documented `--no-show-signature` semantics are accepted.
- [x] [Review][Patch] The pin does not cover the `execFile` options object, so a shorthand `shell`, an added `env` or a changed `cwd` passes AC3 [packages/sync/src/no-git-write.test.ts:85]. The fix is to extend the pin regex through the literal `{ cwd: root, encoding: 'utf8', windowsHide: true }`. (acceptance-auditor+blind-hunter) — Fixed: the pin runs through the exact options literal, so any added option fails. A bare `\bshell\b` ban was not used, because the module doc says "no shell".
- [x] [Review][Patch] The git-subcommand rule misses a write subcommand after an option token, such as `['--no-optional-locks', 'push']`, so in the exempted file it is no second barrier (AC3) [packages/sync/src/no-git-write.test.ts:50]. The fix is to allow `-`-prefixed option tokens between `git` and the subcommand, and to add that case to the pattern test. (edge-case-hunter) — Fixed: an option token must end at a boundary, and the pattern test covers the option-prefixed push and commit cases and the port's own read-only line.
- [x] [Review][Patch] Some new comment lines are longer than the lines around them [packages/sync/src/git/read-only-git-port.ts:6, packages/sync/src/sync.ts:16, packages/sync/src/sync.ts:42]. The fix is to reflow them. (blind-hunter) — Fixed.

**Rejected:**
- `low` (spec edit) The Always bullet and the Tasks pin still show the command without `--no-show-signature`. The fix edits the spec under review.
- `low` (spec edit) The Spec Change Log is empty although the first pass changed the contract. The fix edits the spec under review.
- `low` (spec edit) The Auto Run Result's patch counts do not match the triage log. The fix edits the spec under review.
- `low` (spec edit) The Code Map cites line numbers that will go stale. The fix edits the spec under review.
- `low` (spec edit) `sync:dry` keeps the fake, so its report predicts `file-modified`. Changing it contradicts the spec's Never rule on `dry-run.ts`.
- `false` The negative example in the pattern test uses the old argument list. It tests that `log` is not a write subcommand, which still holds. No harm follows.
- `false` The exemption key is not proven on Windows or against lookalike paths. The lookup is an exact map key, and on Windows the main scan would fail the port file if the key did not match.
- `low` EACCES or EPERM rejects instead of falling back. The spec scopes the fallback to ENOENT. This is unlikely in use, and a loud failure is acceptable.
- `low` A Windows `git.cmd` shim looks like "no git". Git for Windows ships `cmd\git.exe`, which is what `where git` shows here. This is unlikely.
- `low` A "dubious ownership" exit 128 falls back silently. The spec allows a non-zero exit to become `undefined`, and the tag stays truthful. The fix adds a stderr branch.
- `low` A pre-1970 author date makes `%at` negative and throws. This is unreachable for `data/tracked.json` in practice.
- `low` An inherited `GIT_TRACE*` makes the call write a trace file. This needs user-level env, is unlikely, and the fix is env filtering.
- `low` A comment-embedded pin, `execFile (` with a space, or a second call through `promisify(execFile)` evades the count. The first two need deliberate evasion. For the harmful form, a second call with a write subcommand, the subcommand-rule patch closes it.
- `low` The claim that only ENOENT maps to `undefined` differs from "a binary that cannot start". This is the same root cause as the EACCES entry, and the spec names ENOENT.

Second follow-up review, 2026-09-27, over `300f3f9` to the working tree. There were 29 raw findings: 0 decision-needed, 1 patch, 0 defer and 17 rejected, after grouping.

- [x] [Review][Patch] Two port tests leave the shared fixture dirty: one leaves `tracked.json` edited and the other leaves `untracked.json` behind. Later tests are correct only because they read commit history. Restore both in `finally`, as the `log.showSignature` test does. [packages/sync/src/git/read-only-git-port.test.ts:87] (edge-case-hunter+blind-hunter) — Fixed: both tests restore the fixture in `finally`.

**Rejected:**
- `decided` The `main()` wiring and the report tag have no test (AC1). The user rejected this earlier on 2026-09-27 (option c). (acceptance-auditor+verification-gap)
- `decided` The `log.showSignature` test cannot fail without the flag. The user accepted the source pin earlier on 2026-09-27. (acceptance-auditor+verification-gap)
- `low` (spec edit) The Always bullet names the invocation without `--no-show-signature`. The fix edits the spec under review. (acceptance-auditor)
- `low` (spec edit) "Cannot start" is broader than the ENOENT the code checks. The fix edits the spec under review, and the first pass rejected this too. (acceptance-auditor)
- `low` The subcommand rule still misses an option that takes a separate value, such as `git -C dir push` or `['-c', 'k=v', 'commit']`. In the exempted file, the whole-literal pin and the `execFile(` count of 1 catch it. In every other file, the spawn ban catches it first. Widening the regex to take any token risks false matches in comments. (acceptance-auditor+edge-case-hunter+verification-gap+blind-hunter)
- `low` A non-zero exit other than "not a repository", such as dubious ownership, falls back silently. The Always bullet allows it, and the first pass rejected it. (edge-case-hunter+blind-hunter)
- `low` `execFile` has no `timeout`. `log -1` on one path of a local repository is fast. The fix adds an option, an error branch and a change to the pin. (edge-case-hunter+blind-hunter)
- `low` An inherited `GIT_DIR` or `GIT_WORK_TREE`, for example from a git hook, redirects the read. `pnpm sync` is not run from hooks, and the fix is env filtering. (edge-case-hunter)
- `false` The pathspec is not literal. The only caller passes the constant `TRACKED_PATH = 'data/tracked.json'` (`run-chunk.ts:130`), which has no glob or magic characters. (edge-case-hunter+blind-hunter)
- `low` A shallow clone dates the file at the graft boundary. The repository has no CI workflow, and the sync runs in the curator's full clone. (edge-case-hunter+blind-hunter)
- `low` An all-digit value that overflows `Date` throws a bare `RangeError`. git's `%at` output cannot reach that range. (edge-case-hunter+blind-hunter)
- `low` An aliased or indirect `execFile` call evades the count. That takes deliberate evasion, and the first pass rejected it. (edge-case-hunter)
- `false` The real port returns milliseconds (`.000Z`) and the fake returns seconds. Always bullet 2 requires the `systemClock` form, and `systemClock` is `new Date().toISOString()` (`shell.ts:72`). (edge-case-hunter)
- `low` A spawn error other than ENOENT aborts the run. The catch in `run-chunk.ts` logs the failure of the second report write and rethrows the first error, so the failure is loud. EACCES and EPERM are unlikely. (blind-hunter)
- `low` On Windows, a `git.exe` at the repository root runs before the one on `PATH`. That needs a planted binary in the curator's own checkout. (blind-hunter)
- `low` No test covers a deleted-then-recreated or renamed `data/tracked.json`, or the real-port `file-modified` arm. Both cases are unlikely for the curated file, and `resolveTrackedListAge` tests its fallback against the fake. (blind-hunter)
- `false` The docs are stale or the housekeeping is missing. `spec-1-11` and the epic-1 retro record their own time. `dist/` is ignored (`.gitignore:8`). The `deferred-work.md` entry is removed by the sweep, per `AGENTS.md`. (blind-hunter)

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 30 findings — high 0, medium 8, low 18, false 4, maybe-false 0
- findings:
  - `[medium]` `[patch]` (blind) The pin matches only the prefix of the argument list, so an added `--output=<file>` would pass. — Fixed: the pin regex matches the whole literal array up to `]`.
  - `[low]` `[patch]` (blind) The exempted-file check reads only static imports, so a dynamic `import('node:child_process')` would pass. — Fixed: `child_process` must occur exactly once in the file text.
  - `[medium]` `[patch]` (blind) With `log.showSignature=true` set, gpg lines reach stdout, `parseAuthorDate` throws, and the live sync fails. — Fixed: `--no-show-signature` in the fixed argument list, plus a config test.
  - `[low]` `[reject]` (blind) `execFile` has no timeout, so a hung git stalls the run. — Unlikely in everyday use. The fix adds a timeout option and signal-exit semantics, which is more than a direct correction.
  - `[low]` `[reject]` (blind) A non-zero exit becomes `undefined` with no trace. — The spec's Always rule allows it (AD-12 "where git yields no date"). The `file-modified` tag stays visible. Diagnostics would add surface.
  - `[low]` `[patch]` (blind) The doc says "the binary cannot start", but only ENOENT is caught. — Fixed: the wording is now "no `git` binary is found" in the port and in `sync.ts`.
  - `[low]` `[reject]` (blind) A shallow clone gives the boundary commit's date. — `pnpm sync` runs on the player's local checkout, not in CI. Unlikely, and the fix adds a second git call.
  - `[medium]` `[patch]` (blind) Acceptance criterion 1 has no test, so a revert of the wiring passes. — Fixed together with the nested-path finding: a test composes the real port with `resolveTrackedListAge` on a committed `data/tracked.json` and asserts `git-author-date`. `main()` itself stays untested under the module's standing "no test runs `main`" policy.
  - `[medium]` `[patch]` (blind) No test uses a nested repo-relative path. — Grouped with the finding above. Same fix.
  - `[low]` `[reject]` (blind) No test shows that the port rejects on malformed output. — The parser is tested directly, and the port passes its output through unchanged.
  - `[low]` `[reject]` (blind) No test covers the non-ENOENT spawn error path. — Unlikely in use, and it needs an injected failure seam.
  - `[low]` `[reject]` (blind) No test shows that nothing under `.git` changes. — `log` with `--no-optional-locks` writes nothing. A runtime check is extra test machinery for an unlikely regression, which the pin already blocks.
  - `[low]` `[patch]` (blind) The Unix-seconds test expectation is circular. — Fixed: the expected ISO string is hard-coded.
  - `[low]` `[reject]` (blind) The uncommitted-edit and untracked tests leave shared state behind. — No later test reads those files, so no order dependence occurs today.
  - `[false]` `[reject]` (blind) `expect(dirname(plain)).toBe(base)` does not prove the ceiling. — No bad outcome: `GIT_CEILING_DIRECTORIES` is set for the call whatever the line asserts.
  - `[low]` `[reject]` (edge) A signal exit (code null) rejects and skips the report. — Without a timeout, nothing in `sync` kills git. Unlikely.
  - `[medium]` `[patch]` (edge) `log.showSignature` makes the parser throw. — Grouped with the blind finding. Same fix.
  - `[low]` `[reject]` (edge) A shallow clone gives a wrong date. — Same as the blind finding.
  - `[low]` `[reject]` (edge) An inherited `GIT_DIR` or `GIT_WORK_TREE` redirects the read. — `pnpm sync` does not run from a git hook. Env filtering is added complexity.
  - `[low]` `[reject]` (edge) No timeout. — Same as the blind finding.
  - `[false]` `[reject]` (edge) A 17-or-more-digit output throws a RangeError. — `%at` prints Unix seconds, which stay 10 digits until the year 2286.
  - `[medium]` `[patch]` (edge) The pin checks only the prefix. — Grouped with the first blind finding. Same fix.
  - `[low]` `[reject]` (edge) An aliased `execFile` with a write subcommand passes the guard. — This needs a deliberate evasion. The fix would need AST analysis.
  - `[medium]` `[patch]` (verification-gap) The live `main()` wiring and the nested path are unverified. — Grouped with the acceptance-criterion finding. The composition test was added. The `main()` line stays unexecuted by policy.
  - `[low]` `[reject]` (verification-gap other) A non-zero exit falls back without a signal. — Same as the blind finding.
  - `[medium]` `[patch]` (intent) The live-command surface is untested. — Grouped with the acceptance-criterion finding.
  - `[low]` `[reject]` (intent) No runtime test shows that `.git` is unchanged. — Same as the blind finding.
  - `[low]` `[reject]` (intent) Every non-zero exit maps to `file-modified`. — The spec allows it. The tag stays truthful.
  - `[false]` `[reject]` (intent) `sync:dry` output parity. — AD-12 requires that the resolution order is written once in `contracts`, and it still is. The dry run's fake port is a stated boundary.
  - `[false]` `[reject]` (intent) The design choice needed a human (R4). — The entry gives the choice to the design pass. Neither option changes an AD (AD-3 already allows a read-only port with one operation).

## Design Notes

The entry offered two designs. The first is a separate module that the scan exempts. The second is a narrower rule that forbids only the write subcommands. The first keeps the strong rule, "no spawn anywhere in sync", for each file but one. It also pins that one file to a literal read-only call. The narrower rule would allow a spawn of any program from any file, provided the program is not visibly `git <write>`. That would weaken AD-3's guarantee, so this spec uses the separate module.

`%at` (Unix seconds) is used instead of `%aI` so that the UTC conversion is exact and needs no offset parsing. `--no-optional-locks` stops even an opportunistic index refresh, so the call writes nothing to `.git`.

## Verification

**Commands:**
- `pnpm check` -- expected: passes
- `pnpm test` -- expected: passes, including the new port test and the extended scan

## Auto Run Result

Status: done

**Change.** The live `pnpm sync` now composes a real read-only `GitPort` (`createReadOnlyGitPort(REPO_ROOT)`), so the tracked-list edit date comes from AD-12's `git-author-date` clock when `data/tracked.json` has commit history. The one spawn site is a separate module. `no-git-write.test.ts` lifts only its spawn rule for that one path, and it pins the file to the full literal read-only invocation.

**Files.**
- `packages/sync/src/git/read-only-git-port.ts`: new. It runs one `execFile` of `git --no-optional-locks log --no-show-signature -1 --format=%at -- <path>`, and it has the pure parser `parseAuthorDate`.
- `packages/sync/src/git/read-only-git-port.test.ts`: new. It uses an isolated temp repository to cover each matrix row, the `log.showSignature` config and the composition with `resolveTrackedListAge` on `data/tracked.json`.
- `packages/sync/src/no-git-write.test.ts`: one exemption that lifts only the spawn rule, plus pin tests: the full argument array, one `child_process` mention, and no exec, spawn, fork or shell.
- `packages/sync/src/sync.ts`: `main()` composes the real port. The doc comments are updated.

**Review.** 30 findings: 8 medium, 18 low and 4 false. Six entries were patched: 3 medium and 3 low (the full-array pin, `--no-show-signature`, the nested-path composition test, the `child_process` count, the ENOENT wording and the hard-coded parse expectation). Nothing was deferred. Each rejected finding has its reason in the Review Triage Log.

**Follow-up review recommended: true.** This first pass patched three medium entries. Two risks are still unverified:
- The `main()` wiring line is still unexecuted by any test (the module's "no test runs `main`" policy).
- The `log.showSignature` test uses unsigned commits, so it shows only that git accepts the flag, not that the flag suppresses gpg output on a signed commit.

**Verification.**
- `pnpm check` passes.
- `pnpm test` passes: 77 files, 945 tests.
- A manual run of the port against this checkout returned `2026-09-26T11:23:27.000Z` for `data/tracked.json`, which matches `git log -1 --format=%aI` (`2026-09-26T13:23:27+02:00`).

**Residual risks.** These were rejected as low:
- A shallow clone reports the boundary commit's date.
- There is no timeout on the git call.
- An inherited `GIT_DIR` or `GIT_WORK_TREE` would redirect the read.
- Every non-zero exit falls back to `file-modified` silently.
