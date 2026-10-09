---
date: 2026-10-04
verdict: accepted-with-open-items
criteria: declared
headless: false
---

# Retrospective: spec-poesessid-sync (Optional POESESSID in sync)

## Epic summary

- **Mode.** This is a stories-mode retrospective of `docs/stories/archive/spec-poesessid-sync/`, which holds `SPEC.md`, `stories.yaml` and three stories.
- **Stories.** All three stories have `status: done` in their frontmatter, so `pending_stories` is empty.
  1. `1-auth-holder-at-the-shell-edge` landed as **926c042**. It was committed as 5090eb0 before the rebase.
  2. `2-baseline-probe-and-settle-in-the-governed-client` landed as **296f807**, with follow-ups **0698562** (`ci: cap the test job at 15 minutes`) and **1186a98** (`test: write the canary fixture at the current tracked schema version`). All three arrived in PR #140, merge 7654dfe.
  3. `3-mid-run-downgrade-and-the-hold-off-across-processes` landed as **5d9a5ba**, plus **0ce556e**, which is the fix that made spine rev 28. Both arrived in PR #143, merge 0080268.
- **Diff ranges.**
  - The recorded baselines are e655793 (story 1), 5090eb0 (story 2) and 7654dfe (story 3). They do not give clean ranges. The baseline of story 2 is the pre-rebase commit of story 1. Commits of the tracked-hybrid epic (PRs #138, #139, #141, #142) are interleaved on master.
  - Evidence was therefore taken per commit, over two contiguous ranges that hold no merges:
    - `192f566..1186a98` for stories 1 and 2, plus the ci and test fixes.
    - `82801ba..0ce556e` for story 3. The end of this range is inferred, because no story records it.
  - `git_evidence.py` reported 0 merges in both ranges.
- **Evidence inventory.**
  - Available: SPEC, the 3 story specs with their triage logs, AD-30 of the spine and §13 of IMPLEMENTATION-NOTES, all 6 commits, and 9 session logs.
    - The session logs are in `~/.claude/projects/…-poesessid-1/` (sessions c33a4f7c, 465ab569, 41710481, 9b5b9c31 and c0edef36) and `…-poesessid-3/` (sessions 15878faf, adce9552, fc8e4b6b and 46d65ac1).
    - The hang was diagnosed in session c4bce8c1 of the primary checkout.
  - Missing: `.env.example` could not be read, because a permission deny rule blocks it. The four-point `.env` documentation constraint is therefore **unverified**.
  - There is no `sprint-status.yaml` in stories mode, and none was read or written.
- **Delegation.** Four sub-agents each derived one view: spec reconciliation, an adversarial/edge-case/verification-gap review, aggregate views, and the session logs. The `bmad-review` skill was not invoked. Its lenses ran through the review sub-agent over the full epic diff, weighted on the story boundaries. Every finding below that an action item relies on was re-checked against the primary source by the parent session.

## Findings

Dispositions: **fix** = fix now, **defer** = defer to a tracked entry, **accept** = accept as is.

### Spec-to-implementation reconciliation

All CAP-1 to CAP-5 success criteria and all Constraints have an implementation site and at least one test. The exceptions are listed below.

| # | Finding | Source | Disposition |
|---|---|---|---|
| R1 | **A dead cookie can stay `authenticated` for the whole process.** The probe settles on the rule count alone and never checks that its own policy matches the baseline's. The post-probe test applies only when the policy of the answer equals `baselinePolicy`. Example: the baseline 2xx carries no `X-Rate-Limit-Policy` and the cookie answers do. A later quiet expiry (a 2xx with fewer rules) then never counts as `tested`. No `expired` line prints, no hold-off is written, and the cookie is sent until the process ends, which for `pnpm sync` means indefinitely. The reviewer reproduced this with a scratch script against `createTradeGovernor`: `authenticated`, then 5 responses, and the state stays `authenticated`. A control run with the policy on the baseline gives `expired`. The code follows §13.2, so the gap is in the spec. **Operator ruling (2026-10-04): the gap is theoretical, because the API always sends the policy header** (O1). | `client.ts:572-583`, `client.ts:671-677`; IMPLEMENTATION-NOTES.md:1555-1565 ("*None* equals *none*") | **accept** (operator ruling) |
| R2 | **The inverse case of R1.** When neither the baseline nor a fetch carries a policy header, *none = none* makes the fetch `tested` against the search count. §13.2 itself says that is meaningless. The shell and canary tests named for a "2xx that is not live on the cookie fetch" pass only because of this. With real headers, a fetch 2xx is never a downgrade. The operator ruling on R1 makes the production path theoretical. The tests still pin a request shape that the API never sends, and they leave the realistic search downgrade untested at the shell and canary level. | `sync-batch.test.ts:765` with baseline `headers: {}` at :584-588; `session-auth.canary.test.ts:548-581`; spine rev 28 AD-30 | **fix** (test realism only) |
| R3 | **SPEC and story 3 were not fully reconciled to rev 28.** `SPEC.md:99` (Assumptions) still says a 2xx with fewer rules causes a downgrade with no qualifier. Rows 46–47 of the I/O matrix in story 3 still describe every cookie 2xx. 0ce556e edited only `SPEC.md:68` and line 26 of story 3. | `git show 0ce556e`; `SPEC.md:99`; story 3 I/O matrix | **fix** (spec reconciliation, proposed) |
| R4 | **The fix commit edited a frozen block.** Line 26 of story 3 sits inside `<frozen-after-approval>` (lines 14–56). The edit was made on the user's architecture decision in session fc8e4b6b, but the story's Spec Change Log does not record a renegotiation. **Operator ruling (2026-10-04): the edit was sanctioned.** | story 3:14, :26, :56; session fc8e4b6b L177 and L453 | **accept** (operator ruling) |
| R5 | **A SPEC citation overstates what its guard test checks.** `SPEC.md:66` cites `test/no-hardcoded-rate-limits.test.ts` for "no rule name, policy name, rule count or bucket". The test predates the epic and bans only `trade-*-request-limit`, the per-rule header names, `d:d:d` literals and `'Ip'`/`'Client'`. It has no check for the authenticated rule name or for a rule count. The code is compliant by grep. | `test/no-hardcoded-rate-limits.test.ts:26-43` | **defer** |
| R6 | **Inside a long `pnpm sync` session, `held-off` is permanent.** A session that starts within the hold-off never probes after the hold-off expires. Story 3 triage #5 ruled this matches the frozen transitions. | `session-auth.ts:264-271` | **accept** |
| R7 | **A deferred or busy run inside the hold-off prints `unauthenticated (not-probed)`, not `held-off`.** This follows the §13.1 order, but a literal reading of CAP-5 expects `held-off`. | `run-chunk.ts:584-624`; `sync-batch.ts:93` | **accept** (cosmetic) |
| R8 | **Unspecified edges.** A probe 3xx settles `probe-failed`. The `session-expired` yield carries `retryAfterMs: 0` where story 3 says it carries none. Story 3 triage #3 rejected this without a Spec Change Log entry. | `client.ts:685-686`, `client.ts:764` | **accept** |

### Diff-scope review (adversarial, edge-case, verification-gap)

| # | Finding | Source | Disposition |
|---|---|---|---|
| V1 | **The canary session harness can still hang forever.** `runSession` aborts only after two chunk-result lines and has no cap on iterations or time. A fake `sleep` resolves at once, so any fixture drift that gets the inputs refused gives a busy loop that starves Vitest's timeout. 1186a98 fixed the symptom, which was the hard-coded tracked schema version, and not the harness. The CI cap from 0698562 is the only guard, and it does not apply locally. | `session-auth.canary.test.ts:236-270`; 1186a98; 0698562 | **fix** |
| V2 | **Redaction has gaps that no story closed.** <ul><li>The walk skips class instances such as `Headers`, `URL`, `Request` and `Map`.</li><li>`main().catch` writes `String(error)` without redaction, and the holder is not in scope there.</li><li>`pnpm sync` throws from `inputSignature` and `runWait` outside the per-chunk redacting `try`.</li></ul>Story 1 triage #9 and #10 handed the first gap to "Story 2's attach". Story 2's triage never mentions it, and it was never written to `deferred-work.md`. All three are latent today: the fetch port attaches no `Headers` or `Request`. So CAP-4's "every throw path" is met for the paths that exist, not structurally. | `session-auth.ts:358-364`; `sync.ts:687-688`; `sync-batch.ts:129`; story 1 spec :96-97 | **defer** |
| V3 | **The CAP-4 canary's base64 needles are weaker than the SPEC wording.** The needles encode 8-byte windows at alignment 0 only, so whether a base64 leak is caught depends on the canary's characters. The reconciliation agent measured 0 hits for a letters-only canary at offsets 0 and 2. Production `formsOf` covers all three alignments, so redaction itself is sound. | `session-auth.canary.test.ts:76-86` vs `session-auth.ts:103-123` | **fix** |
| V4 | **`searchRemaining` leaves out the probe's spend.** In the chunk that probes, the bound and the pinned allowance are overstated by one. `sync:batch` can then pace a full bucket while holding the lock, instead of ending `bounded: search`. Story 2 triage #7 rejected this. The reviewer rates it should-fix with minor impact. The runtime effect is plausible and was not run. | `client.ts:774`, `:793-809`; `run-chunk.ts:495-503`, `:913-922` | **defer** |
| V5 | **The failure record is written to `sync-report.json` before the shell redacts.** The comment "this covers the rest" holds for stderr only. This is latent, because no non-governor error carries the value today. | `run-chunk.ts:1026-1031`; `sync.ts:610-611` | **defer** (fold into V2) |
| V6 | **A test name claims an assertion the test does not make.** "a probe 429: no line, notBefore persisted, and the next chunk probes again" never reads `sync-progress.json`. Unit coverage exists at `run-chunk.test.ts:3323-3393`. | `sync.test.ts:748-767` | **fix** (rename or assert) |
| V7 | **Unbounded `authHoldOffUntil`.** A value written ahead of the clock, or a bad hand edit, is never capped at now+24h. A malformed value fails the strict progress schema, so every run exits 1. `notBefore` has the same failure mode. | `session-auth.ts:264-271`; `run-chunk.ts:576-582` | **accept** |
| V8 | **Coverage gaps the reviews accepted.** <ul><li>No shell-level test of a search downgrade (story 3 triage #9).</li><li>No test that `web` hides a non-zero `session-probe` count (story 2 triage #17).</li><li>The canary does not scan the lock contents written through `createExclusive`.</li><li>No test of the `.env.example` content.</li></ul> | the triage logs cited | **accept** (the `.env.example` content is noted under O3) |

Checked by the reviewer and found clean:
- A downgrade before the baseline is impossible.
- A cookie 429 is an ordinary yield.
- The probe-429 latch and a downgrade are mutually exclusive.
- A probe at the end of a chunk is handled on both the normal and failure paths.
- One holder serves each process.
- No re-probe or re-attach happens after a settle or an expire.
- The hold-off is written once and survives a failed progress write.
- The in-place pacing reset is safe under the serial queue.
- Exit codes are unchanged on every cookie outcome.
- A 1.1.0 progress file parses at 1.2.0.

### Aggregate views

| # | Finding | Source | Disposition |
|---|---|---|---|
| A1 | **Architecture delta: clean.** `session-auth.ts` is a leaf that imports only `node:buffer` and `node:util`. trade/ gained no edge to chunk/ or the shells. Story 3 added no module edge: the runner sees the holder through the local structural `ChunkAuth`. Cycle count is unchanged. `pnpm check` (depcruise) passes, and `ALLOWED_EDGES` holds. | depcruise before and after (agent scratch); `run-chunk.ts:215-226`; `compose-chunk.ts:170-184` | **accept** (win) |
| A2 | **The governor took on the session state machine.** `createTradeGovernor` grew from 153 to 344 lines, and client.ts from 589 to 848. The governor now holds 9 auth responsibilities: eligibility, attach, `cookieDropped`, probe orchestration, the outcome-to-reason mapping, the 429 latch, the downgrade predicate, the four-step downgrade, and redaction wrapping. `session-auth.ts` stores the decisions; client.ts makes them. | `client.ts:504-848` vs `192f566:client.ts:436-589` | **defer** (refactor candidate) |
| A3 | **The liveness predicate exists twice, with different guards.** The probe uses a count only. The downgrade uses count and policy equality. R1 is a direct consequence. | `client.ts:674-676` vs `:572-583` | **defer** (R1 is theoretical) |
| A4 | **Two policy readers normalize differently.** `parseRateLimitHeaders` trims. `rateLimitPolicyOf` trims and case-folds. | `rate-limit-headers.ts:137-138` vs `:226-229` | **defer** |
| A5 | **Hold-off policy is split over three owners.** The action table is in session-auth.ts:59-64, the duration `AUTH_HOLD_OFF_MS` in run-chunk.ts:208, and the write/clear in run-chunk.ts:745-766. The `now + ms → ISO` arithmetic exists three ways: `sync.ts:249`, `run-chunk.ts:487`, and the inline `run-chunk.ts:751`. | as cited | **defer** |
| A6 | **The schema versions in fixtures are hard-coded, which is what caused 1186a98.** The `inputs()` builder exists in 3 copies (the canary, `sync.test.ts:100`, `sync-batch.test.ts:64`). Story 3's progress bump touched 81 diff lines of `'1.1.0'`/`'1.2.0'` literals, and none of them use `SYNC_PROGRESS_SCHEMA_VERSION`. | canary:43-71; run-chunk.test.ts (41 literals) | **fix** |
| A7 | **Pattern divergence.** `SessionAuth` is the only non-Error class in sync, contracts and core; every other stateful unit is a factory closure. The listener is named `onSettle` where other ports use `log`. The boundary guard is a line-regex test, not a depcruise rule. Test setup complies with the MSW rule in AGENTS.md. | `session-auth.ts:148`; `test/session-cookie-shells.test.ts:17-28` | **accept** (record) |

### Process lessons (session logs)

| # | Lesson | Source | Upstream fix |
|---|---|---|---|
| P1 | **A rejected finding that names a later story was dropped.** Story 1 rejected two redaction findings as "Story 2's attach". Story 2's spec says "`redact` stays as it is", and nothing reached `deferred-work.md`. This is V2. | story 1 spec :96-97; story 2 spec :55; session 465ab569 L347 | Make the triage rule explicit: a rejection that names a later story is deferred work and goes into `deferred-work.md`. |
| P2 | **A test harness was bent to make "live" pass, and nobody treated it as a spec smell.** The story 3 implementer made the harnesses answer every later cookie request as live (adce9552 L119). The Blind reviewer found the cause: fetches were checked against the search baseline (L257). Triage deferred it to the architect, so story 3 shipped with the defect, and 0ce556e plus rev 28 followed. R1 shows the patch still treats policy-less answers loosely. | sessions adce9552 L119/L257/L310 and fc8e4b6b L177 | At planning, check every predicate against each request lane or policy. Make "the harness must fake X for the test to pass" an explicit review prompt. |
| P3 | **A test hang shipped to CI.** The rebase brought in the tracked 2.0.0 bump. The canary spun forever at the 600 s tool timeout. The user said "push and open pr" (c0edef36 L150). CI then hung until 0698562 capped it, and 1186a98 fixed the fixture. Story 1 triage #17 had rejected "canary can hang". | sessions c0edef36 L62/L124/L150 and c4bce8c1 L156/L308 | finish-worktree runs tests under a hard timeout and reports a hang as a failure. A retry loop under a fake clock needs a test-side cap (V1). |
| P4 | **A permission deny overrode the user's planning answer.** The user chose "Allow .env.example" (c33a4f7c L183). The implementer was still denied, the user pasted the block by hand, and reviewers never saw the file. This retro hit the same deny. | sessions c33a4f7c L183 and 465ab569 L148/L153/L180 | Reconcile the deny rule for `.env.example` (it is a template, not a secret), or route reviews of it through the user. |
| P5 | **The commit-msg hook rejected spec-folder story commits twice.** The hook expects `story <epic>.<n>`. | sessions 465ab569 L331 and fc8e4b6b L462-479 | Document or accept the spec-folder story form in the hook. |
| P6 | **Story 3 rewrote earlier stories' tests.** It changed the probe harnesses to answer live by default and bulk-replaced versions, which also changed unrelated report fixtures; review caught that. | session adce9552 L119/L289 | A story spec names the earlier-story tests it will change, and a bulk replace gets a scoped check. |
| P7 | **A bare `python` waited on stdin and hung finish-worktree for 120 s.** AGENTS.md already forbids bare `python`. | session 46d65ac1 L76-82 | Already a rule; consider a shell hook. |
| P8 | **A known Windows flake in `dev-stop.test.ts` cost time in two sessions.** The error was "Bad control character". | sessions c4bce8c1 L213 and adce9552 L119 | Track the flake as its own entry. |

## Behavior verification

- **Run in this retro.** `pnpm test` passed: 117 files, 1996 tests. `pnpm check` passed (typecheck, lint, depcruise; 259 modules, no violations). The review agent ran 11 targeted files with 530 tests, all passing. The reviewer also reproduced R1 against `createTradeGovernor` with a scratch script.
- **Live run (2026-10-04, at the operator's request).** One `pnpm sync:batch` ran against the live trade API, using the operator's `.env` (POESESSID and User-Agent). Observed:
  - The console printed exactly `pnpm sync:batch: authenticated`, then `pnpm sync:batch: bounded, 3 completed`, and the process exited 0. This is Success signal 1, and the CAP-4 line format.
  - `data/sync-report.json` counts `session-probe: 1`, `league-validation: 1` and `tracked-list: 6`. That is one probe per run (§13.2), and the report has no auth field.
  - `data/sync-progress.json` is at schema `1.2.0` with no `authHoldOffUntil`, which matches CAP-5 (a `live` probe clears).
  - A grep of `data/*.json` for `cookie` and `poesessid` found nothing. The value itself could not be scanned for, because the deny rule blocks reading `.env`.
  - The `data/` files that the run wrote were reverted afterwards, at the operator's request.
- **Not exercised.** Success signals 2 (a run after sign-out) and 3 (a held-off run) were not run. The operator declined to sign out. The fake-port tests cover both paths (`sync-batch.test.ts:762`, `:791`; `sync.test.ts:769`, `:821`).

## Previous-retro follow-through

`docs/stories/archive/spec-poesessid-sync/` has no earlier `RETROSPECTIVE.md`, so there is nothing to follow through on for this spec folder. In stories mode, `sprint-status.yaml` action items from other epics are out of scope and were not read.

## Action items

All of these are proposals. None has been applied.

| # | Action | Kind | Owner |
|---|---|---|---|
| 1 | R2: give the baseline and cookie answers in the fixtures of `sync-batch.test.ts:765` and canary :548-581 real `X-Rate-Limit-Policy` headers, and move the `not-live` downgrade case onto a search. The §13.2 change to the probe and the *none = none* rule is not needed, because the operator ruled R1 theoretical. | remediation | dev loop |
| 2 | Reconcile `SPEC.md:99` (Assumptions) and the I/O matrix rows 46–47 of story 3 to spine rev 28 (R3). The frozen-block edit itself was sanctioned (R4). | spec reconciliation | operator (human-owned frozen intent) |
| 3 | Give `runSession` in the canary an iteration or elapsed-time cap that fails loudly (V1). Replace hard-coded schema-version literals in the sync test fixtures with the exported constants (A6). | remediation | dev loop |
| 4 | Strengthen the canary's base64 needles to cover all three byte alignments (V3). Fix the name or the assertion of `sync.test.ts:748` (V6). | remediation | dev loop |
| 5 | Add `deferred-work.md` entries for: V2 together with V5 (structural redaction of class instances, `main().catch`, throws outside the redacting `try`); V4 (`searchRemaining` and the probe); R5 (guard test for AD-30 additions); A2 (move session decisions out of the governor); A3 with A4 (one liveness predicate and one policy reader); A5 (one owner for the hold-off). | defer | the dev loop that lands item 1 |
| 6 | Process: amend the triage rule so that "rejected, owned by a later story" means a `deferred-work.md` entry (P1). Add the "harness must fake it" review prompt (P2). Give finish-worktree a hard test timeout (P3). | process | operator (workflow owner) |
| 7 | Process: resolve the `.env.example` deny rule (P4) and the commit-msg hook story form (P5). Then verify the four-point `.env` docs, which this retro could not read. | process | operator |

## Acceptance verdict

**accepted-with-open-items** (criteria: declared, SPEC CAP-1 to CAP-5 and Constraints).

- **Met.** Every CAP success criterion has an implementation site and a passing test. The full suite and the static checks are green. No story is unfinished. The architecture stayed clean (A1). A live `sync:batch` settled `authenticated` with one probe and exited 0 (Success signal 1).
- **Open items.**
  - R1 is closed as theoretical by operator ruling. R2 remains as a test-realism fix (action item 1).
  - The CAP-4 canary is weaker than worded (V3) and redaction is not structural (V2), but no current path leaks.
  - The `.env` docs constraint is unverified (O3).
  - Success signals 2 and 3 were not exercised live.

A human may override this verdict.

## Open questions

- **O1 (answered).** The operator states that the API always sends `X-Rate-Limit-Policy`, so R1 is theoretical.
- **O2 (answered).** The frozen-block edit was sanctioned.
- **O3 (partly answered).** The operator added POESESSID with comments to their own `.env`. The constraint is on the committed operator documentation, which is `.env.example` (edited by hand in story 1, 926c042). That file must state four things: the value is optional, it gives near-full account access, it must never be committed, and signing out revokes it. Confirming those four points closes O3.
- **O4 (answered).** Success signal 1 was verified live. Signals 2 and 3 will not be run live, because the operator will not sign out. They rest on the fake-port tests.
