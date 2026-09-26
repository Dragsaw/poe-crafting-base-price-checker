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
