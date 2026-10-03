# Review: docs/specs/spec-poesessid-sync/SPEC.md

- Date: 2026-10-03
- Content class: docs (behavior-defining spec)
- Lenses: adversarial (15), edge-case-hunter (18), structure (16), prose (16, run after structure)
- Skipped: verification-gap (code only)
- Standing rule: the AGENT-WORKFLOW.md *Review brief* applies. A reviewer does not edit an owner document. Findings that target AD-30 or IMPLEMENTATION-NOTES §13 go to the architect.

## Cross-lens overlaps (signal, not duplication)

| Theme | Findings |
| --- | --- |
| The liveness test compares fetch responses against a search baseline | adversarial #9, edge-case #1 |
| `not-probed` has no acceptance case | adversarial #7, edge-case #5 |
| CAP-3: "the search fields it had before" is ambiguous | adversarial #6, edge-case #15, structure (cut "This spec does not keep that answer"), prose (CAP-3 rewording) |
| A replaced cookie stays held off, and the operator docs give no way to clear it | adversarial #10, edge-case #7 |
| `authHoldOffUntil` has no validation or bound | adversarial #12, edge-case #9 |
| A non-writing ending drops the pending hold-off | adversarial #11, edge-case #11 |
| The canary test scope is loose or copied from §13.6 | adversarial #13, structure (condense CAP-4), edge-case #17 (NODE_DEBUG leak path) |
| The operator `.env` doc list is incomplete (User-Agent, hold-off, public traces, account risk) | adversarial #4, #10; structure (User-Agent question) |
| The User-Agent constraint's scope and tense | adversarial #14, prose (OQ-26 "verifies") |

## Adversarial

1. **Constraints "one extra search per run" and CAP-1.** `sync:batch` runs one chunk per process, and the state settles once per process. So the baseline and probe repeat on every scheduled chunk. A `live` result is never carried across processes.
   - Fix: State the cost per process. Accept it, or raise a cross-process `live` carry with the AD-30/§13 owner.
   - Consequence: Probes use up much of the doubled budget in the main unattended mode. The "fewer hours" claim may not hold.
2. **Why: "The only cost of an inactive cookie is a warning."** The spec accepts other costs elsewhere: the Cloudflare 24h hold-off, the discarded paid answer, a 429 risk after the cold reset, and the counted `probe-rejected`.
   - Fix: "An inactive cookie never fails the run or changes its exit code." Cite the accepted costs in AD-30.
   - Consequence: The headline claim is false, and test authors miss the 429 and hold-off paths.
3. **Why and Non-goals: "The burst does not become faster."** The research capture shows the cookie halves the fetch burst (`Account` 6:4 against `Ip` 12:4) and stretches a fetch lockout from 10 s to 60 s.
   - Fix: Say the fetch burst becomes slower and cite the research. Record this as an accepted cost or a risk.
   - Consequence: Fetch-heavy chunks can run slower with the cookie, and nothing tells the operator.
4. **Why and the operator `.env` docs (items 1–4).** With the cookie, 429s and violations count against the game account. The `Account` rule is also shared with the operator's own trade-site and in-game use. The docs mention only credential exposure.
   - Fix: Add a documentation item about account-level penalties and the shared budget. Record the sanction risk as accepted.
   - Consequence: The operator opts in without knowing about the risk to the account.
5. **CAP-3 "`sync:batch` exits 0, and the session continues to its next chunk".** `sync:batch` has no session. The bullet mixes the two invokers and leaves the downgrade path of `pnpm sync` unspecified.
   - Fix: Split into "`sync:batch`: exits 0" and "`pnpm sync`: continues with its next chunk unauthenticated (§13.4)."
   - Consequence: A test that cannot pass, and the real session path left untested.
6. **CAP-3 "keeps the search fields it had before".** It is unclear whether "before" means before the entry or before the request. §13.4 keeps a `lastSearchId` that the same entry answered earlier.
   - Fix: Cite §13.4 for this behavior and keep only the observable claim (price state unchanged).
   - Consequence: A valid `lastSearchId` gets reverted.
7. **CAP-2 and CAP-5: no success case for `not-probed`.**
   - Fix: Add "A process that ends with no settle prints one `unauthenticated (not-probed)` line (§13.5)", plus a test where the only probe gets a 429.
   - Consequence: The line can be missing or printed twice, and no test catches it.
8. **CAP-1 step 3 "The fetch of that entry".** A 2xx search with zero results has no fetch.
   - Fix: "every later pricing request, starting with that entry's fetch if it has one."
   - Consequence: The order assertion becomes vacuous or contradictory.
9. **Assumptions and the liveness constraint.** The baseline is a search, but the test also runs on fetch responses. This relies on an unstated assumption that search and fetch have the same rule count.
   - Fix: State that assumption and put it under OQ-26.
   - Consequence: A spurious `expired` with a 24h hold-off, or a dead cookie that passes on fetch.
10. **Operator docs and Success signal.** The docs give no recovery step when the cookie is replaced during a hold-off (removing `authHoldOffUntil` is only in §13.3). They also leave out the browser User-Agent and the public traces.
    - Fix: Add documentation items for the hold-off and its manual clear (§13.3), the browser User-Agent (AD-30), and the published traces.
    - Consequence: The operator decides the feature is broken.
11. **CAP-5.** A run that writes no progress (deferred, busy, dispossessed) drops the pending hold-off, so the next process probes again (§13.3).
    - Fix: Add the case to CAP-5 as a citation, and add a test.
    - Consequence: Under lock contention, a dead cookie spends a counted 4xx on every run.
12. **CAP-5 and the hold-off.** Nothing validates or bounds `authHoldOffUntil`. A skewed clock or a hand edit can hold the cookie off indefinitely.
    - Fix: Treat a value later than now plus the hold-off interval as invalid. This rule goes to the owner (§13.3).
    - Consequence: The opt-in stops working with no signal.
13. **CAP-4 canary.** The spec never lists "each throw path". "Any file the test writes" can be read to exclude the progress and report files. The canary must also fit the cookie grammar.
    - Fix: Cite §13.6 for the path list, require a canary that passes the grammar, and scan every file written during the test.
    - Consequence: A leak through an error cause or a report record ships with a green test.
14. **The User-Agent constraint and Assumptions.** A browser string in `POE_SYNC_USER_AGENT` applies to every shell while it is set (§13.7), not only to cookie runs. No follow-up is defined for each OQ-26 outcome.
    - Fix: State the scope, and add OQ-26 outcome clauses (revert the operator instruction, or reopen AD-30).
    - Consequence: Unauthenticated runs keep a browser User-Agent indefinitely. A wrong assumption about dead-cookie responses goes undetected.
15. **Success signal.** Steps 1–3 need a real account and depend on OQ-26, yet the spec does not name who runs them or where the result is recorded.
    - Fix: Mark them as manual operator acceptance steps gated on OQ-26, and record the result in the OQ-26 resolution.
    - Consequence: The feature is "done" on fake-port tests alone.

## Edge-Case Hunter

1. **Liveness (CAP-1, Constraints, §13.2/§13.4).** Fetch responses are tested against a search baseline, and the two policies differ (§5.3). Fix: keep a baseline per policy, or test search responses only. Consequence: a false downgrade with a 24h hold-off, or a dead cookie passes.
2. **Baseline with no `X-Rate-Limit-Rules` header, or an empty one.** The count is 0, so any cookie response counts as live. Fix: settle `probe-failed` when the baseline has no rules.
3. **`names(h)` with empty tokens (`Ip,,Account,`).** Empty strings are counted as rule names. Fix: filter out empty names after trim and fold.
4. **Probe 1xx or 3xx (for example a redirect to a login page).** No outcome row covers it, and a followed redirect can return HTML with a 2xx. Fix: map any other status to `probe-failed` and use `redirect: 'manual'`.
5. **No settle in the process (no 2xx search, or only probe 429s).** `not-probed` has no acceptance test. Fix: add a CAP-2 case for it.
6. **A long `pnpm sync` session runs past `authHoldOffUntil`.** The session never retries the cookie. Fix: re-arm the probe at chunk start once the due time passes, or state that a restart is needed.
7. **The operator replaces or fixes the cookie during a hold-off.** The new live cookie is ignored for up to 24h. Fix: document the manual clear, or key the hold-off to a change in the value without storing the value.
8. **The operator pastes `POESESSID=abc`.** The `=` passes the grammar, the header doubles the name, the probe is rejected, and a 24h hold-off follows. Fix: strip the prefix, or classify the value as `malformed`.
9. **A hand-edited or invalid `authHoldOffUntil`.** Zod load validation fails the whole run, which breaks "never fails the run". Fix: parse leniently, warn, and treat the value as absent.
10. **A `clear` then a `write` in one chunk (§13.3).** The resolution of two pending actions is not specified. Fix: the latest action wins, and a write overrides a clear.
11. **An in-process pending action across chunks of `pnpm sync`.** §13.3 speaks only of "the next process". Fix: state that the action persists on the holder until a publish applies it.
12. **Non-live probe pacing (§13.2).** The probe's State reading replaces the pacing values, even on a `not-elevated` or `probe-rejected` settle. Authenticated readings then pace unauthenticated requests, which breaks a Constraint. Fix: discard that reading, or reset pacing to cold.
13. **A probe 429 blocks the fetch of the baseline entry.** "The entry keeps its result" is undefined for an entry with a search and no fetch. Fix: define it (stamp, keep price, set search fields from the baseline).
14. **Every chunk's probe gets a 429 in a long session.** The probe retries are unbounded, and the state never settles. Fix: cap the retries, then settle `probe-failed`.
15. **CAP-3 "search fields it had before".** It is unclear what "before" refers to. Fix: "before the downgrading request (§13.4)".
16. **The probe and the chunk search bound (AD-7, `minChunkSearches`).** It is not specified whether the probe counts toward the bound. Fix: state it.
17. **`NODE_DEBUG=http,undici,fetch` or a logging proxy.** The runtime prints the Cookie header to stderr, and the scrubbing does not cover this path. Fix: drop the cookie with a warning when debug output is on.
18. **A non-401/403 4xx on a cookie request after the probe.** A dead cookie can trigger AD-9's malformed-request abort, which changes the exit code. Fix: state the rule explicitly.

## Editorial Structure

Model: Prompt/Task Definition (Functional). 1,469 words. Accepting all changes cuts about 280 words (about 19%), mostly by replacing restated §13 mechanism with citations.

| Original Text | Revised Text | Changes |
| --- | --- | --- |
| Constraints 68, 69, 72, 73 (liveness, probe 429, pacing reset, 401/403) | CONDENSE to citations of §13.2–13.4 and AD-8. Keep the Cloudflare cost sentence and the probe-cost sentence. | Restates the owner almost word for word (one-owner rule). About −110 words. |
| CAP-4 canary sentences | "The canary test of §13.6 passes." | Verbatim copy of §13.6. |
| Constraints 67 (league request) | CUT | CAP-1 already states and tests it. |
| Constraints 74 and Non-goals 88 | MERGE into 75 and the non-goal | The same fact appears three times. |
| Constraints 70, first sentence (exit code) | CUT | CAP-2 and CAP-3 already test it. |
| Constraints as one flat list of 17 items | Group: Secrecy, Where read and sent, Failure handling, Operator duties and accepted costs | The top-priority constraint is buried. |
| Constraints 76 (§13.5 reasons) | MOVE into CAP-2 or CAP-4, then CUT | CAP-2 already gives the citation. |
| Preamble blockquote and line 14 | MERGE into one orientation paragraph | The "complete contract" and "read only those sections" statements conflict. |
| CAP-2 bullets | One schema per bullet (trigger, reason id, timing). Move "pricing searches continue" to the closing line. | Only one bullet says pricing continues, which implies the other cases differ, and they don't. |
| CAP-5 "Such runs include…" | Cite the unchanged rows of §13.3 | A partial copy that already omits cases. |
| CAP-3 "This spec does not keep that answer." | CUT | Repeats "discards". |
| CAP-3 test bullets (pacing cold, stamp, fields) | PRESERVE and append "(§13.4)" | They are the test oracle. |
| Why: "This spec captures an opportunity." | CUT | Throat-clearing. |
| Why: closing sentences | PRESERVE | Motivation for the failure-tolerance rules. |
| Constraints 77 (User-Agent) | QUESTION: move the operator duty into the `.env` docs list? | An operator duty sits inside a constraint about code. |
| No blank line before `## Success signal` | Add a blank line | Some renderers merge the heading into the list. |

## Editorial Prose

Runs after structure and skips the text that structure cuts. None of these changes alters content.

| Original Text | Revised Text | Changes |
| --- | --- | --- |
| CAP-3 "The entry is treated as a request that got no answer: it stamps…" | "Sync treats the entry as unanswered: it stamps `lastAttemptedAt` on the entry and keeps the entry's price state and earlier search fields." | Active voice. "It" was ambiguous. |
| CAP-1 step 3 "The fetch of that entry…" | "The fetch for the baseline search's entry, and all later pricing requests." | "That entry" had no antecedent. |
| CAP-3 "The pacing state is cold." | Consider adding: "it holds no learned limits and learns them again from the next response." | Undefined term once line 72 is condensed. |
| CAP-5 intent "until a retry is due" | "until the hold-off ends" | Introduces the term that the success line uses. |
| CAP-1 intent "passes the liveness probe" | "If the probe shows that the cookie is live" | Keeps "probe" and "liveness test" separate. |
| Assumptions "Both cause a downgrade… OQ-26 finds out…" | "…fewer rules than the no-cookie baseline. Either response causes a downgrade. OQ-26 is to determine by 2026-11-02…" | "Both" after three items, a missing comparison point, and wrong tense. |
| Constraint 77 "OQ-26 verifies… No code changes." | "OQ-26 tracks the check… This needs no code change." | The check is not done yet. The fragment can read as a command. |
| `data/sync-progress.json` vs `sync-progress.json` | Use one form everywhere | The two names read as two files. |
| "never the value" / "without seeing the value" | "never the cookie value" / "without the console showing the cookie value" | Unclear antecedent and meaning. |
| Constraint 59 "at the shell edge… gives the value as a parameter" | "The shell passes the value to the core as a parameter, as it passes `POE_SYNC_USER_AGENT`." | Redundant phrase and no named receiver. |
| Constraint 58 "`.env` sets the environment through…" | Consider: "Node loads `.env` into the environment through `--env-file-if-exists`." | A file cannot act. |
| Why "The burst does not become faster." | "The burst limit does not rise." (Non-goals: "A higher burst limit.") | A burst has no speed. Note adversarial #3: the fetch burst actually falls. |
| Why "signing out ends it" | "signing out revokes it" | Ambiguous referent. Matches docs item 4. |
| CAP-4 "Each settle" | Consider: "Each settled probe outcome" | Noun use of "settle" is unclear. |
| "cookie request" | Define once: "a request that carries the cookie (a cookie request)" | A coined term with no definition. |
| Why "A capture on 2026-10-02" | Consider: "A traffic capture…" | Says what was captured. |

## Findings (JSON)

```json
[
  {"lens":"adversarial","location":"Constraints (probe cost); CAP-1","trigger_condition":"sync:batch runs one chunk per process and settle is per process, so baseline+probe repeat every scheduled chunk; live is never carried across processes","guard_snippet":"State cost per process; accept it or raise a cross-process live carry with the AD-30/§13 owner","potential_consequence":"Probes eat much of the doubled budget in the main unattended mode; 'fewer hours' may not hold"},
  {"lens":"adversarial","location":"Why","trigger_condition":"'The only cost of an inactive cookie is a warning' contradicts accepted costs (Cloudflare 24h hold-off, discarded answer, 429 after cold reset, counted probe-rejected)","guard_snippet":"'An inactive cookie never fails the run or changes its exit code'; cite AD-30 accepted costs","potential_consequence":"False headline claim; test authors miss 429 and hold-off paths"},
  {"lens":"adversarial","location":"Why; Non-goals","trigger_condition":"Research shows the cookie halves the fetch burst and lengthens a fetch lockout 10s→60s; 'does not become faster' hides this","guard_snippet":"State that the fetch burst gets slower, cite research, record as accepted cost or risk","potential_consequence":"Fetch-heavy chunks slower with the cookie, unsignalled"},
  {"lens":"adversarial","location":"Why; Constraints (operator docs items 1-4)","trigger_condition":"With the cookie, violations count against the game account and the Account rule is shared with the operator's own trade use; docs cover only credential exposure","guard_snippet":"Add docs item on account-level penalties and shared budget; record sanction risk as accepted","potential_consequence":"Operator opts in unaware of account risk"},
  {"lens":"adversarial","location":"CAP-3 last bullet","trigger_condition":"sync:batch has no session; bullet mixes invokers and omits pnpm sync's downgrade path","guard_snippet":"Split: sync:batch exits 0; pnpm sync continues next chunk unauthenticated (§13.4)","potential_consequence":"Unpassable test; real session path untested"},
  {"lens":"adversarial","location":"CAP-3 search-fields bullet","trigger_condition":"'had before' ambiguous vs §13.4 keeping an earlier same-entry lastSearchId","guard_snippet":"Cite §13.4; keep only 'price state unchanged'","potential_consequence":"Valid lastSearchId reverted"},
  {"lens":"adversarial","location":"CAP-2; CAP-5","trigger_condition":"No success case for not-probed (no settle, or only probe 429s)","guard_snippet":"Add one 'unauthenticated (not-probed)' line case (§13.5) and a probe-429-only test","potential_consequence":"Line missing or doubled, untested"},
  {"lens":"adversarial","location":"CAP-1 success step 3","trigger_condition":"A 2xx search with zero results has no fetch","guard_snippet":"'every later pricing request, starting with that entry's fetch if it has one'","potential_consequence":"Order assertion vacuous or contradictory"},
  {"lens":"adversarial","location":"Assumptions; Constraints (liveness)","trigger_condition":"Liveness applies to fetch responses against a search baseline; equal unauth rule counts is unstated","guard_snippet":"State the assumption and put it under OQ-26","potential_consequence":"Spurious expired + 24h hold-off, or dead cookie passes on fetch"},
  {"lens":"adversarial","location":"Constraints (operator docs); Success signal","trigger_condition":"No documented recovery when replacing a cookie during hold-off; UA and public traces missing from docs","guard_snippet":"Add docs items: hold-off and manual clear (§13.3), browser UA (AD-30), published traces","potential_consequence":"Operator concludes the feature is broken"},
  {"lens":"adversarial","location":"CAP-5","trigger_condition":"A non-writing ending (deferred/busy/dispossessed) drops the pending hold-off","guard_snippet":"Add the case by citation of §13.3 and a test","potential_consequence":"Dead cookie spends a counted 4xx every run under lock contention"},
  {"lens":"adversarial","location":"CAP-5; hold-off","trigger_condition":"authHoldOffUntil is unbounded and unvalidated","guard_snippet":"Treat values beyond now+interval as invalid (owner: §13.3)","potential_consequence":"Opt-in silently disabled indefinitely"},
  {"lens":"adversarial","location":"CAP-4 canary","trigger_condition":"Throw paths unlisted; 'files the test writes' may exclude progress/report; canary must fit cookie grammar","guard_snippet":"Cite §13.6 path list; grammar-valid canary; scan every file written during the test","potential_consequence":"Leak ships with a green test"},
  {"lens":"adversarial","location":"Constraints (User-Agent); Assumptions","trigger_condition":"Browser UA applies to every shell while set (§13.7); no OQ-26 outcome follow-up","guard_snippet":"State scope; add OQ-26 outcome clauses (revert instruction / reopen AD-30)","potential_consequence":"Permanent browser UA; wrong dead-cookie assumption undetected"},
  {"lens":"adversarial","location":"Success signal","trigger_condition":"Steps need a real account and OQ-26; no owner or record","guard_snippet":"Mark as manual operator acceptance gated on OQ-26; record in the OQ-26 resolution","potential_consequence":"Done on fake-port tests alone"},
  {"lens":"edge-case-hunter","location":"CAP-1; Constraints; §13.2/§13.4","trigger_condition":"Fetch response tested against a search baseline; policies differ (§5.3)","guard_snippet":"Baseline per policy, or test search responses only","potential_consequence":"False downgrade with 24h hold-off, or dead cookie passes"},
  {"lens":"edge-case-hunter","location":"Constraints (liveness); §13.2","trigger_condition":"Baseline has no or empty X-Rate-Limit-Rules","guard_snippet":"Settle probe-failed when baseline has no rules","potential_consequence":"Any cookie response counts as live"},
  {"lens":"edge-case-hunter","location":"§13.2 names(h)","trigger_condition":"Header has empty tokens, e.g. 'Ip,,Account,'","guard_snippet":"Filter empty names after trim/fold","potential_consequence":"Wrong liveness result"},
  {"lens":"edge-case-hunter","location":"CAP-2; §13.3","trigger_condition":"Probe receives 1xx/3xx (e.g. login redirect)","guard_snippet":"Other status → probe-failed; redirect: 'manual'","potential_consequence":"Inconsistent classification; followed redirect yields HTML 2xx"},
  {"lens":"edge-case-hunter","location":"CAP-2; CAP-4","trigger_condition":"Process ends with no settle","guard_snippet":"Add CAP-2 case for not-probed line (§13.5)","potential_consequence":"Line missing or doubled"},
  {"lens":"edge-case-hunter","location":"CAP-5; §13.1/§13.3","trigger_condition":"Long pnpm sync session passes authHoldOffUntil","guard_snippet":"Re-arm probe at chunk start after due time, or state restart is needed","potential_consequence":"Session never retries"},
  {"lens":"edge-case-hunter","location":"CAP-5; operator docs","trigger_condition":"Operator replaces/fixes cookie during hold-off","guard_snippet":"Document manual clear, or key hold-off to a value change without storing the value","potential_consequence":"New live cookie ignored up to 24h"},
  {"lens":"edge-case-hunter","location":"Constraints (.env); §13.1","trigger_condition":"Operator pastes 'POESESSID=abc' as the value","guard_snippet":"Strip prefix or classify malformed","potential_consequence":"Rejected probe and 24h hold-off for a typo"},
  {"lens":"edge-case-hunter","location":"CAP-5; §13.1","trigger_condition":"Hand-edited invalid authHoldOffUntil","guard_snippet":"Lenient parse; warn; treat as absent","potential_consequence":"Zod load fails the run, breaking 'never fails the run'"},
  {"lens":"edge-case-hunter","location":"§13.3 pending action","trigger_condition":"clear then write recorded in one chunk","guard_snippet":"Latest wins; write overrides clear","potential_consequence":"Dead cookie re-probed next run"},
  {"lens":"edge-case-hunter","location":"§13.3 non-writing ending","trigger_condition":"In-process pending action across pnpm sync chunks","guard_snippet":"Action persists on holder until a publish applies it","potential_consequence":"Stale action applied or dropped"},
  {"lens":"edge-case-hunter","location":"CAP-2; §13.2","trigger_condition":"Non-live probe State reading replaces pacing values","guard_snippet":"Discard that reading or reset to cold on a non-live settle","potential_consequence":"Authenticated readings pace unauthenticated requests, violating a Constraint"},
  {"lens":"edge-case-hunter","location":"Constraints (probe 429); §13.3","trigger_condition":"Probe 429 blocks the baseline entry's fetch","guard_snippet":"Define the entry result for search-answered, fetch-unsent","potential_consequence":"Builders persist different states"},
  {"lens":"edge-case-hunter","location":"§13.3 'each probe 429 allows one more'","trigger_condition":"Every chunk's probe gets 429 in a long session","guard_snippet":"Cap retries per process, then probe-failed","potential_consequence":"Unbounded probe spend; no line until exit"},
  {"lens":"edge-case-hunter","location":"CAP-3","trigger_condition":"Fetch downgrades after a live search of the same entry","guard_snippet":"'before the downgrading request (§13.4)'","potential_consequence":"lastSearchId wrongly reverted"},
  {"lens":"edge-case-hunter","location":"CAP-1; Constraints (probe cost)","trigger_condition":"Chunk is at its search bound before the probe (AD-7)","guard_snippet":"State whether the probe counts toward the bound and ceiling","potential_consequence":"Overrun or displaced entry; inconsistent counting"},
  {"lens":"edge-case-hunter","location":"Constraints (stderr); CAP-4","trigger_condition":"NODE_DEBUG=http,undici,fetch or a logging proxy","guard_snippet":"Drop the cookie with a warning when debug output is on","potential_consequence":"Cookie header printed to stderr"},
  {"lens":"edge-case-hunter","location":"CAP-3 triggers","trigger_condition":"Non-401/403 4xx on a cookie request after the probe","guard_snippet":"State explicitly whether AD-9 malformed abort applies","potential_consequence":"Dead cookie changes the exit code"},
  {"lens":"structure","location":"Constraints 68, 69, 72, 73","trigger_condition":"Restates §13.2–13.4","guard_snippet":"CONDENSE to citations; keep Cloudflare cost and probe-cost sentences","potential_consequence":"Drift between spec and owner"},
  {"lens":"structure","location":"CAP-4 canary","trigger_condition":"Copies §13.6","guard_snippet":"'The canary test of §13.6 passes.'","potential_consequence":"Drift"},
  {"lens":"structure","location":"Constraints 67","trigger_condition":"Duplicates CAP-1","guard_snippet":"CUT","potential_consequence":"Redundancy"},
  {"lens":"structure","location":"Constraints 74; Non-goals 88","trigger_condition":"Same fact three times","guard_snippet":"MERGE into 75 and the non-goal","potential_consequence":"Redundancy"},
  {"lens":"structure","location":"Constraints 70","trigger_condition":"Exit-code sentence duplicates CAP-2/3","guard_snippet":"CUT first sentence","potential_consequence":"Redundancy"},
  {"lens":"structure","location":"Constraints","trigger_condition":"Flat list of 17 mixed items","guard_snippet":"Group: Secrecy; Where read and sent; Failure handling; Operator duties and accepted costs","potential_consequence":"Top-priority constraint buried"},
  {"lens":"structure","location":"Constraints 76","trigger_condition":"Repeats CAP-2 citation","guard_snippet":"MOVE into CAP-2/4, then CUT","potential_consequence":"Redundancy"},
  {"lens":"structure","location":"Preamble; line 14","trigger_condition":"Two conflicting meta paragraphs","guard_snippet":"MERGE into one orientation paragraph","potential_consequence":"Reader must reconcile 'complete' vs 'read only'"},
  {"lens":"structure","location":"CAP-2 bullets","trigger_condition":"Inconsistent bullet schema","guard_snippet":"Trigger, reason id, timing per bullet; move 'pricing continues' to closing line","potential_consequence":"Implied difference between cases"},
  {"lens":"structure","location":"CAP-5","trigger_condition":"Partial copy of §13.3 unchanged list","guard_snippet":"Cite §13.3","potential_consequence":"Incomplete list drifts"},
  {"lens":"structure","location":"CAP-3","trigger_condition":"'This spec does not keep that answer.' repeats 'discards'","guard_snippet":"CUT","potential_consequence":"Redundancy"},
  {"lens":"structure","location":"CAP-3 test bullets","trigger_condition":"Copies §13.4 but is the test oracle","guard_snippet":"PRESERVE; append '(§13.4)'","potential_consequence":"n/a"},
  {"lens":"structure","location":"Why opener","trigger_condition":"Throat-clearing","guard_snippet":"CUT","potential_consequence":"Noise"},
  {"lens":"structure","location":"Why closing","trigger_condition":"Overlaps Constraints but motivates them","guard_snippet":"PRESERVE","potential_consequence":"n/a"},
  {"lens":"structure","location":"Constraints 77","trigger_condition":"Operator duty inside a code constraint","guard_snippet":"QUESTION: move into .env docs list?","potential_consequence":"Docs miss the UA step"},
  {"lens":"structure","location":"Before ## Success signal","trigger_condition":"Missing blank line","guard_snippet":"Add blank line","potential_consequence":"Heading merged into list"},
  {"lens":"prose","location":"CAP-3","trigger_condition":"Passive voice; ambiguous 'it'","guard_snippet":"'Sync treats the entry as unanswered: it stamps lastAttemptedAt on the entry and keeps the entry's price state and earlier search fields.'","potential_consequence":"Unclear actor"},
  {"lens":"prose","location":"CAP-1 step 3","trigger_condition":"'that entry' has no antecedent","guard_snippet":"'The fetch for the baseline search's entry…'","potential_consequence":"Ambiguity"},
  {"lens":"prose","location":"CAP-3","trigger_condition":"'cold' undefined after condensing","guard_snippet":"Add short gloss","potential_consequence":"Undefined term"},
  {"lens":"prose","location":"CAP-5 intent","trigger_condition":"'hold-off' not introduced","guard_snippet":"'until the hold-off ends'","potential_consequence":"Term mismatch"},
  {"lens":"prose","location":"CAP-1 intent","trigger_condition":"Merges probe and liveness test","guard_snippet":"'If the probe shows that the cookie is live'","potential_consequence":"Term confusion"},
  {"lens":"prose","location":"Assumptions","trigger_condition":"'Both' after three items; no comparison; tense","guard_snippet":"'…fewer rules than the no-cookie baseline. Either response… OQ-26 is to determine by 2026-11-02…'","potential_consequence":"Ambiguity"},
  {"lens":"prose","location":"Constraints 77","trigger_condition":"'verifies' implies done; fragment","guard_snippet":"'OQ-26 tracks the check… This needs no code change.'","potential_consequence":"Misread status"},
  {"lens":"prose","location":"Constraints 57; CAP-5; Constraints 75","trigger_condition":"Two names for one file","guard_snippet":"Use one form","potential_consequence":"Read as two files"},
  {"lens":"prose","location":"CAP-5; CAP-4","trigger_condition":"'the value' unclear; 'without seeing'","guard_snippet":"'cookie value'; 'without the console showing the cookie value'","potential_consequence":"Ambiguity"},
  {"lens":"prose","location":"Constraints 59","trigger_condition":"Repeated phrase; no receiver","guard_snippet":"'passes the value to the core as a parameter'","potential_consequence":"Ambiguity"},
  {"lens":"prose","location":"Constraints 58","trigger_condition":"File as actor","guard_snippet":"'Node loads .env into the environment through --env-file-if-exists'","potential_consequence":"Imprecision"},
  {"lens":"prose","location":"Why; Non-goals","trigger_condition":"'burst does not become faster'","guard_snippet":"'The burst limit does not rise.'","potential_consequence":"Imprecision"},
  {"lens":"prose","location":"Why","trigger_condition":"'ends it' ambiguous","guard_snippet":"'revokes it'","potential_consequence":"Ambiguity"},
  {"lens":"prose","location":"CAP-4","trigger_condition":"'settle' as noun","guard_snippet":"'Each settled probe outcome'","potential_consequence":"Unclear on first read"},
  {"lens":"prose","location":"CAP-3; Constraints 73","trigger_condition":"'cookie request' undefined","guard_snippet":"Define once","potential_consequence":"Coined term"},
  {"lens":"prose","location":"Why","trigger_condition":"'A capture' unspecific","guard_snippet":"'A traffic capture'","potential_consequence":"Vague"}
]
```
