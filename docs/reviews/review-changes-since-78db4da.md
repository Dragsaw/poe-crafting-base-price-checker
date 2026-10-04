# Review — changes since 78db4da (78db4da..ec38dce)

- **Content:** 15 commits, 61 files. The diff is mostly `packages/web` code and `tools/dev-stop`, plus story specs, the ledger and UX documents. Class: code.
- **Lenses:** adversarial, edge-case-hunter, verification-gap. Each lens also looked for merge-resolution damage.
- **Baseline at HEAD:** `pnpm check` (typecheck, lint, depcruise) passes. `pnpm test` passes 93 files and 1187 tests. No conflict markers are left. The consolidated constants (`HOUR_MS`, `NBSP`, `TOP_ROWS`, `DEFAULT_THRESHOLD`) are each defined once, in `shared/`.

## Merge interactions (overlap across lenses)

Several lenses report the same defect. Most of these defects come from two branches that were each correct alone and are wrong together:

- **Item 18 × item 20: rust "no figure yet".** All three lenses found this. `display-rows.ts` (item 20) changes every EV phrase in an honest-empty list to "no figure yet". `RankedRow.tsx:108` (item 18) colours the phrase rust when `state === 'unresolvable'`. So an unresolvable row in state 23 shows a waiting phrase in the broken-state colour. No test checks the colour.
- **Item 18 × EXPERIENCE rev 9: "yet" in an all-unresolvable list.** The adversarial and edge-case lenses found this. The rebase made `isHonestEmpty` count unresolvable rows. `honestEmptyCopy` (`list-statement.ts:17`) still always ends with "yet". Rev 9 rules that this copy drops "yet", and the ledger records the code as owed.
- **Item 22 `NO_DECLARED_VERSION = 'none'` sentinel.** All three lenses found this. The declared `"none"` collision is **closed** by `8a47e24`: `declared` is now `string | null`. A non-string `schemaVersion` still reads as no version, as rejected in the item 22 spec's second review pass.
- **`STATE_NOTES` doc comment still says "until UX rules".** The adversarial and edge-case lenses found this.
- **`dev:stop` climb and `taskkill` robustness.** The adversarial and edge-case lenses found this.

## adversarial

1. **All-unresolvable honest-empty statement still says "yet"**
   - Location: `packages/web/src/list/list-statement.ts:16-18` (`honestEmptyCopy`), `listStatement`
   - Problem: EXPERIENCE rev 9 rules that a list of only unresolvable rows drops "yet". The code prints "yet" every time. The deferred-work ledger records this code as owed, but only in a "Resolved" section.
   - Fix: Pass a flag, and drop " yet" when `noListings + notYetSynced === 0 && unresolvable > 0`. Add a unit test and an App assertion.
   - Consequence: The page promises a price that no sync will bring. A later sweep can drop the owed work.
2. **Honest-empty unresolvable rows print "no figure yet" in rust**
   - Location: `packages/web/src/list/RankedRow.tsx:108` with the honest-empty branch of `display-rows.ts`
   - Problem: The rust colour comes from `state`, not from the phrase that prints.
   - Fix: Colour by the printed phrase (`row.ev.text === MONEY_PHRASES.unresolvable`) or by an explicit `evTone`, or let UX rule the open `[NOTE FOR UX]` first. Assert the colour.
   - Consequence: The calm post-reset screen shows a mixed health signal.
3. **UX revision numbers clash with the unmerged item 24 branch**
   - Location: DESIGN `revision: 8`, EXPERIENCE `revision: 10`, the deferred-work heading "revision 8 / revision 7", state 23 `[decision — revision 8]`
   - Problem: Master gave DESIGN 7 / EXPERIENCE 8 to item 20. The local `.memlog.md` (gitignored) gives the same numbers to the item 24 rulings, which are on an unmerged worktree branch. The item 20 and item 18 rulings have no memlog rows.
   - Fix: Renumber item 24 before it rebases. Add memlog rows for rev 8 and rev 9. Cite memlog ids, not revision numbers.
   - Consequence: Two rulings claim the same revision, so a citation can resolve to the wrong one.
4. **Item 19's UX change landed with no revision bump**
   - Location: commit fabd4c2, DESIGN.md and EXPERIENCE.md
   - Problem: The masthead dek section, state 37 and `copyDek` changed, and `revision:` stayed the same. The commits before and after it both bump the revision.
   - Fix: Attribute the change to a revision in memlog and in the frontmatter.
   - Consequence: Epic 3's owed dek rewrite has no revision to cite.
5. **`sprint-status.yaml` statuses and refs are stale**
   - Location: `docs/stories/sprint-status.yaml:195-240`
   - Problem: Items 18 and 19 were built and their specs say done, but both still read `status: open`. Items 22 and 23 are done, but their `ref` still points at the retro doc. The item 19 spec has `followup_review_recommended: true`, and no follow-up review is recorded.
   - Fix: Set 18 and 19 to done. Point the refs of 18, 19, 22 and 23 at their specs. Record or run the item 19 follow-up review.
   - Consequence: Sprint planning or the sweep can dispatch finished work again.
6. **Stale `STATE_NOTES` doc comment**
   - Location: `packages/web/src/list/format.ts:94-97`
   - Problem: The comment says the note "names no id kind until UX rules". Rev 9 ruled it, and the ledger says to update this comment.
   - Fix: Cite EXPERIENCE state 4 `[decision — revision 9]`.
   - Consequence: An agent may reopen a string that is already ruled.
7. **Stale "Failure path" sentence in EXPERIENCE UJ-1**
   - Location: EXPERIENCE.md UJ-1 Failure path (about line 1266), the component table, state 26
   - Problem: The text still says "does not match its schema" and "a schema mismatch is fixed by publishing a valid set". Item 22 renamed state 26 and added the `version` and `missing` causes. The component row leaves out the version cause.
   - Fix: Reword the sentence to "a required file cannot be used (state 26)". Add the version cause to the component row.
   - Consequence: The owner document contradicts itself.
8. **`NO_DECLARED_VERSION` sentinel collision**
   - Location: `packages/web/src/load/load-artifacts.ts:19,72,122`, `FailureScreen.tsx:65`
   - Problem: `"schemaVersion": "none"` renders "It declares no schema version". A non-string version such as `1` renders the same sentence.
   - Fix: Carry `declared: string | null`, or a tagged union, through `Fetched`, `LoadOutcome` and `FailureScreenProps`.
   - Consequence: The screen gives the publisher the wrong fix, which is the F10 defect again.
   - Status: The declared `"none"` collision is **closed** by `8a47e24`. `declared` is now `string | null` through `Fetched`, `LoadOutcome` and `FailureScreenProps`. A non-string `schemaVersion` such as `1` still reads as no version, as rejected in the item 22 spec's second review pass.
9. **Duplicated test helpers came back after the consolidation**
   - Location: `App.test.tsx:440,771,979`, `trust-strip.test.tsx:51`, `unrankable-appendix.test.tsx:35`, `payout-threshold.test.tsx:35`
   - Problem: Three files still define their own `createRoot` mount. App.test inlines `[data-ranked-row]` three times, and the item 18 branch added line 771 after `rowsIn` existed. App.test grew from 1181 to 1311 lines. Item 22 added a per-cause copy matrix at page level.
   - Fix: Use `test-support/dom`. Move the refusal copy matrix to unit tests.
   - Consequence: The swept deferred item is quietly undone, and nothing tracks it.
10. **`dev:stop` climb can kill an unrelated tree**
    - Location: `tools/dev-stop/dev-stop.ts:57` (`isDevChainProcess`), `:89-93` (climb)
    - Problem: The climb accepts any ancestor that matches `\b(pnpm|vite)\b`, then runs `taskkill /T /F` on it. Two cases can kill the wrong tree:
      - Windows PID reuse for the ppid of an orphan.
      - A launching shell such as `bash -c "pnpm dev & pnpm test"`, or `pnpm -r --parallel dev`.
    - Fix: Require each parent's creation time to be earlier than its child's. Tighten the command-line match. Alternatively, stop at the first `pnpm … dev`.
    - Consequence: The tool can kill another agent's dev server or test run.
11. **`dev:stop` poll timing and `taskkill` errors**
    - Location: `tools/dev-stop/dev-stop.ts:155-158,181-190`
    - Problem: Each poll runs a full PowerShell CIM snapshot, so the "5 s" poll can take 20–40 s. `taskkill` on a PID that already exited throws, and the tool exits 1 even when the port is free.
    - Fix: Poll only the listener, and bound the loop by elapsed time. Wrap `taskkill` in try/catch and trust the port check.
    - Consequence: Slow stops, and false failures that an agent may escalate.
12. **`coveragePercent` comment misstates the epsilon; no guard for >1 or NaN**
    - Location: `packages/web/src/frame/trust-facts.ts` `coveragePercent`
    - Problem: The comment's explanation of the epsilon and the 99 cap is wrong. The function has no clamp for `coverage > 1` or `NaN`.
    - Fix: Reword the comment. Clamp to [0, 1], and show the unknown value for a non-finite input. Add tests.
    - Consequence: The trust strip can print "NaN%" or ">100%".
13. **The mockup still shows the retired Epic 2 dek, with no marker**
    - Location: `mockups/key-hero-resting.html:401` compared with the `Masthead.tsx` header comment
    - Problem: The mockup shows the retired dek with no note. The Epic 3 dek rewrite is recorded only in deferred-work.
    - Fix: Add an HTML comment to the mockup. Add the rewrite to an Epic 3 AC in `epics.md`.
    - Consequence: A later reconciliation "fixes" the code back to the mockup dek.
14. **Ledger inconsistencies in `deferred-work.md`**
    - Location: the sections of `docs/stories/deferred-work.md` added in this range
    - Problem: Four problems:
      - The item 18 entry claims it closes the all-unresolvable case, and findings 1 and 2 show it does not.
      - The item 22 entry and its "Resolved" block sit in different sections.
      - The story 2.3 and 2.6 panel entries "can close with this one", and nothing points back at them.
      - A "Resolved by" heading uses the clashing revision numbers.
    - Fix: Append notes that correct and cross-reference these, without rewriting. Use memlog ids.
    - Consequence: The sweep can remove entries whose code is still owed.

## edge-case-hunter

1. **All-unresolvable honest-empty statement keeps "yet"** — `list-statement.ts:16-18,55-57`. Same as adversarial 1.
2. **"no figure yet" in rust** — `RankedRow.tsx:108` with `display-rows.ts:124-133`. Same as adversarial 2.
3. **Singular league-validation request count**
   - Location: `packages/web/src/frame/trust-facts.ts:141`
   - Problem: When `requestsBySource['league-validation'] === 1`, the fixed text prints "1 league validation requests this pass.".
   - Fix: `text(\` league validation ${plural(n, 'request', 'requests')} this pass.\`)`
   - Consequence: This is the "1 rows" bug class that the consolidation claimed to close. Claim check: 9e5f57b says "Every count-plus-noun goes through plural".
4. **`schemaVersion: "none"` sentinel** — `load-artifacts.ts:65-73,115-122`, `FailureScreen.tsx:65`. Same as adversarial 8. **Closed** by `8a47e24`: `declared` is now `string | null`.
5. **`taskkill` throws on a PID that is already gone**
   - Location: `tools/dev-stop/dev-stop.ts:155-158,181`
   - Problem: A root exits between the snapshot and the kill, or the first root's `/T` already killed a second root.
   - Fix: Wrap the call in try/catch, and let the port poll decide.
   - Consequence: The tool exits 1 before it polls, even when the port is free.
6. **`snapshotPosix` swallows every `lsof` failure**
   - Location: `tools/dev-stop/dev-stop.ts:119-126`
   - Problem: `lsof` is missing (ENOENT), or fails for a reason other than "no match".
   - Fix: `catch (e) { if ((e as { status?: number }).status !== 1) throw e; }`
   - Consequence: The tool reports that the port is free and exits 0 while Vite still listens.
7. **The climb loop has no cycle guard**
   - Location: `tools/dev-stop/dev-stop.ts:90-93`
   - Problem: The ppid chain can form a cycle, for example through PID reuse on Windows. `ownAncestry` has a visited set. The climb loop does not.
   - Fix: Add a `seen` set.
   - Consequence: `dev:stop` hangs.
8. **`isDevChainProcess` is too broad** — `dev-stop.ts:57`. Same as adversarial 10.
9. **Claim: the `STATE_NOTES` comment was updated after the ruling** — `format.ts:97`. The comment was not updated. Same as adversarial 6.
10. **Claim: the singular fix covers every count-plus-noun** — `trust-facts.ts:141`. The requests line was not converted (see 3).
11. **Claim: 997f7f6, an unresolvable row trails "not valued" in rust**
    - Location: `display-rows.ts:124-133` with `RankedRow.tsx:108`
    - Problem: After 9621486 merged, honest-empty lists (every all-unresolvable list is one) show neither the item 18 treatment nor the item 20 treatment. `deferred-work.md:127` records the text conflict. The colour half is not recorded.
    - Consequence: The merged behaviour matches neither story's claim.

## verification-gap

1. **No colour assertion for honest-empty unresolvable rows**
   - Location: `RankedRow.tsx:103-108`, `display-rows.ts:125-133`
   - Gap: regression-gap. `App.test.tsx:789,810` checks only the text. `ranked-list.test.tsx:174-181` checks the rust colour only when the list is not honest-empty.
   - Fix: A test in `ranked-list.test.tsx` that mounts the mixed reset and asserts the EV phrase colour of the unresolvable row.
   - Consequence: A shipped colour defect with no failing test. This is the verification side of adversarial 2.
2. **`schemaVersion: "none"` is untested**
   - Location: `FailureScreen.tsx:65`, `load-artifacts.ts:115-122`
   - Gap: The tests cover only `'abc'` (`App.test.tsx:228`, `load-artifacts.test.ts:132`).
   - Fix: Serve `{ ...dataset, schemaVersion: 'none' }` and assert "declares schema version none".
   - Status: **Closed** by `8a47e24`. `declared` is now `string | null`. Regression tests: `load-artifacts.test.ts` "keeps a declared \"none\" as a declared malformed version" and `App.test.tsx` "refuses dataset.json declaring \"none\" by naming it, not as declaring no version".
3. **No test runs the self-protection and exit codes of `dev-stop`**
   - Location: `tools/dev-stop/dev-stop.ts:141-153` (`ownAncestry`), `:167-190` (`main`)
   - Gap: regression-gap. The tests import only `DEFAULT_PORT`, `parsePort` and `planStop`, and give `protectedPids` by hand.
   - Fix: Export `ownAncestry` with a `selfPid` parameter. Inject `snapshot` and `killTree`, and test how `main` maps each plan to an exit code.
   - Consequence: A refactor can make the tool kill its own caller, or return 0 while the port is still held, and no test fails. AGENTS.md promises this behaviour.
4. **Merged App tests repeat the unit tests**
   - Location: `App.test.tsx:766-829,950-986`
   - Gap: other. The item 18 and item 20 App tests again check order, numerals and phrases that `display-rows.test.ts` and `list-statement.test.ts` already pin.
   - Fix: Cut them down to the composition facts. No assertion is missing.

Checked and clean. The merge weakened none of these:
- The removed App tests are still covered, by `core/rank.test.ts:365-397` and `list-statement.test.ts:96-98`.
- The `formatDivine` and age assertions moved to `shared/*.test.ts` intact.
- The timestamps in `trust-facts.test.ts` moved correctly to the shared `NOW`.
- `expansion.test.tsx` lost only its local helpers.
- The fixedCell and plural changes are pinned.

## Findings (JSON)

```json
[
  {"lens":"adversarial","location":"packages/web/src/list/list-statement.ts:16-18","trigger_condition":"All-unresolvable honest-empty list; statement still says 'yet' against EXPERIENCE rev 9","guard_snippet":"Drop ' yet' when noListings+notYetSynced===0 && unresolvable>0; add unit + App test","potential_consequence":"Promises a price no sync brings; owed code sits in a Resolved ledger section"},
  {"lens":"adversarial","location":"packages/web/src/list/RankedRow.tsx:108 + display-rows.ts honest-empty branch","trigger_condition":"Honest-empty override prints 'no figure yet' while rust keys on state==='unresolvable'","guard_snippet":"Colour by printed phrase or explicit evTone; assert colour","potential_consequence":"Mixed health signal on the calm reset screen"},
  {"lens":"adversarial","location":"DESIGN.md/EXPERIENCE.md revision frontmatter; deferred-work 'Resolved by' heading","trigger_condition":"Master and unmerged item 24 branch both claim DESIGN 7 / EXPERIENCE 8; item 18/20 rulings have no memlog rows","guard_snippet":"Renumber item 24 before rebase; add memlog rows; cite memlog ids","potential_consequence":"Revision citations resolve to the wrong ruling"},
  {"lens":"adversarial","location":"commit fabd4c2 DESIGN.md/EXPERIENCE.md","trigger_condition":"Item 19 changed dek, state 37, copyDek without a revision bump","guard_snippet":"Attribute to a revision in memlog/frontmatter","potential_consequence":"Epic 3 dek rewrite has no revision anchor"},
  {"lens":"adversarial","location":"docs/stories/sprint-status.yaml:195-240","trigger_condition":"Items 18/19 still open though done; items 22/23 refs point at retro doc; item 19 follow-up review unrecorded","guard_snippet":"Set 18/19 done; retarget refs to specs; record item 19 follow-up review","potential_consequence":"Finished work re-dispatched"},
  {"lens":"adversarial","location":"packages/web/src/list/format.ts:94-97","trigger_condition":"STATE_NOTES comment says 'until UX rules' after rev 9 ruled","guard_snippet":"Cite EXPERIENCE state 4 [decision — revision 9]","potential_consequence":"Ruled string treated as provisional"},
  {"lens":"adversarial","location":"EXPERIENCE.md UJ-1 Failure path (~1266), component table, state 26","trigger_condition":"Still says 'does not match its schema'; component row omits version cause","guard_snippet":"'a required file cannot be used (state 26)'; add version cause","potential_consequence":"Owner doc contradicts itself"},
  {"lens":"adversarial","location":"packages/web/src/load/load-artifacts.ts:19,72,122; FailureScreen.tsx:65","trigger_condition":"schemaVersion 'none' or non-string renders 'declares no schema version'","guard_snippet":"declared: string | null through Fetched/LoadOutcome/FailureScreenProps","potential_consequence":"Publisher told the wrong fix"},
  {"lens":"adversarial","location":"App.test.tsx:440,771,979; trust-strip.test.tsx:51; unrankable-appendix.test.tsx:35; payout-threshold.test.tsx:35","trigger_condition":"Local mounts and inline [data-ranked-row] queries remain or were re-added after consolidation; App.test grew 1181->1311","guard_snippet":"Use test-support/dom; move refusal copy matrix to unit tests","potential_consequence":"Swept deferred item silently regresses"},
  {"lens":"adversarial","location":"tools/dev-stop/dev-stop.ts:57,89-93","trigger_condition":"Climb accepts any pnpm/vite-matching ancestor, incl. PID-reused parents or multi-command shells","guard_snippet":"Require parent creation time < child; tighten match; stop at first 'pnpm … dev'","potential_consequence":"Kills another agent's dev server or test run"},
  {"lens":"adversarial","location":"tools/dev-stop/dev-stop.ts:155-158,181-190","trigger_condition":"Per-poll CIM snapshot makes 5 s poll 20-40 s; taskkill on exited PID throws","guard_snippet":"Listener-only poll bounded by elapsed time; try/catch taskkill","potential_consequence":"Slow or false-failure stops"},
  {"lens":"adversarial","location":"packages/web/src/frame/trust-facts.ts coveragePercent","trigger_condition":"Comment misstates epsilon/cap; no clamp for >1 or NaN","guard_snippet":"Reword; clamp [0,1]; unknown on non-finite; tests","potential_consequence":"'NaN%' or '>100%' in trust strip"},
  {"lens":"adversarial","location":"mockups/key-hero-resting.html:401 vs Masthead.tsx","trigger_condition":"Mockup prints retired Epic 2 dek unmarked","guard_snippet":"HTML comment in mockup; add rewrite to an Epic 3 AC","potential_consequence":"Reconciliation reverts code to mockup dek"},
  {"lens":"adversarial","location":"docs/stories/deferred-work.md sections added in range","trigger_condition":"Item 18 entry over-claims closure; item 22 split across sections; 2.3/2.6 entries not cross-referenced; clashing revision numbers","guard_snippet":"Append correction/cross-reference notes; use memlog ids","potential_consequence":"Sweep removes entries whose code is owed"},
  {"lens":"edge-case-hunter","location":"packages/web/src/list/list-statement.ts:16-18,55-57","trigger_condition":"Every shown row is unresolvable","guard_snippet":"isOnlyUnresolvable ? copy without ' yet' : honestEmptyCopy(league)","potential_consequence":"Statement promises a price no sync brings"},
  {"lens":"edge-case-hunter","location":"packages/web/src/list/RankedRow.tsx:108 + display-rows.ts:124-133","trigger_condition":"Honest-empty list holds an unresolvable row","guard_snippet":"rust only when row.ev.text === MONEY_PHRASES.unresolvable","potential_consequence":"'no figure yet' in rust reads as broken"},
  {"lens":"edge-case-hunter","location":"packages/web/src/frame/trust-facts.ts:141","trigger_condition":"requestsBySource['league-validation'] === 1","guard_snippet":"plural(n, 'request', 'requests')","potential_consequence":"'1 league validation requests this pass.'"},
  {"lens":"edge-case-hunter","location":"packages/web/src/load/load-artifacts.ts:65-73,115-122; FailureScreen.tsx:65","trigger_condition":"File declares schemaVersion 'none'","guard_snippet":"declared: string | undefined instead of sentinel string","potential_consequence":"'It declares no schema version' misstates the file"},
  {"lens":"edge-case-hunter","location":"tools/dev-stop/dev-stop.ts:155-158,181","trigger_condition":"Root exits before taskkill, or already killed as a descendant of an earlier root","guard_snippet":"try { taskkill } catch { /* port poll decides */ }","potential_consequence":"Exit 1 before polling even when port is free"},
  {"lens":"edge-case-hunter","location":"tools/dev-stop/dev-stop.ts:119-126","trigger_condition":"lsof missing (ENOENT) or failing for reason other than no match","guard_snippet":"catch (e) { if ((e as {status?: number}).status !== 1) throw e; }","potential_consequence":"Reports port free and exits 0 while Vite listens"},
  {"lens":"edge-case-hunter","location":"tools/dev-stop/dev-stop.ts:90-93","trigger_condition":"ppid chain forms a cycle (PID reuse)","guard_snippet":"seen set in the climb loop","potential_consequence":"dev:stop hangs"},
  {"lens":"edge-case-hunter","location":"tools/dev-stop/dev-stop.ts:57","trigger_condition":"Non-dev ancestor command line contains pnpm or vite","guard_snippet":"Match the executable token or a 'dev' script argument","potential_consequence":"taskkill /T kills an unrelated tree"},
  {"lens":"edge-case-hunter","location":"packages/web/src/list/format.ts:97","kind":"claim","confidence":"medium","trigger_condition":"Ledger rev 9 ruling says update the doc comment","guard_snippet":"Comment still says 'until UX rules'","potential_consequence":"Ruled string reopened"},
  {"lens":"edge-case-hunter","location":"packages/web/src/frame/trust-facts.ts:141","kind":"claim","confidence":"medium","trigger_condition":"9e5f57b: 'Every count-plus-noun goes through plural'","guard_snippet":"Requests group appends fixed plural text","potential_consequence":"Singular bug class stays open"},
  {"lens":"edge-case-hunter","location":"packages/web/src/list/display-rows.ts:124-133 + RankedRow.tsx:108","kind":"claim","confidence":"medium","trigger_condition":"997f7f6: unresolvable row trails 'not valued' in rust","guard_snippet":"After 9621486, honest-empty overrides text to 'no figure yet' and keeps rust","potential_consequence":"Merged path matches neither story; colour half unrecorded"},
  {"lens":"verification-gap","location":"packages/web/src/list/RankedRow.tsx:103-108; display-rows.ts:125-133","trigger_condition":"No colour assertion for unresolvable rows in the honest-empty state","guard_snippet":"ranked-list.test.tsx: mount mixed reset, assert EV phrase colour of unresolvable row","potential_consequence":"Shipped colour defect with no failing test","gap_shape":"regression-gap","consumer":"RankedRow via RankedList in App ReadyBody (App.tsx:143-146)","evidence":"App.test.tsx:789,810 text only; ranked-list.test.tsx:174-181 rust only outside honest-empty"},
  {"lens":"verification-gap","location":"packages/web/src/frame/FailureScreen.tsx:65; load-artifacts.ts:115-122","trigger_condition":"schemaVersion 'none' untested","guard_snippet":"Serve {...dataset, schemaVersion:'none'}; assert 'declares schema version none'","potential_consequence":"Wrong cause sentence for an edge input","gap_shape":"other","evidence":"Only 'abc' tested (App.test.tsx:228, load-artifacts.test.ts:132)"},
  {"lens":"verification-gap","location":"tools/dev-stop/dev-stop.ts:141-153,167-190","trigger_condition":"ownAncestry and main exit codes never run by a test","guard_snippet":"Export ownAncestry(processes, selfPid); inject snapshot/killTree; test plan->exit-code","potential_consequence":"Refactor could kill own caller or return 0 with port held, unnoticed","gap_shape":"regression-gap","consumer":"pnpm dev:stop (package.json), required by AGENTS.md","evidence":"dev-stop.test.ts imports only DEFAULT_PORT, parsePort, planStop"},
  {"lens":"verification-gap","location":"packages/web/src/App.test.tsx:766-829,950-986","trigger_condition":"Merged item 18/20 App tests re-assert unit-level facts","guard_snippet":"Cut to composition facts; nothing missing","potential_consequence":"Same rule pinned in three places","gap_shape":"other"}
]
```
