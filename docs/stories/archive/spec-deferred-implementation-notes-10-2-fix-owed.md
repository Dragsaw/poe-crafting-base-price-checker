---
title: 'deferred-implementation-notes-10-2-fix-owed: IMPLEMENTATION-NOTES §10.2 cites AD-25 for an unknown jewel-arm base type'
type: 'chore'
created: '2026-09-26'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: 'da37e864bd6299c611ab7e13da78c31571f167a9'
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The deferred-work ledger entry from Story 1.10 says `IMPLEMENTATION-NOTES.md` §10.2 still calls a `jewel`-arm derived base type that the catalogue does not carry a "load error naming the class". AD-25 and the Story 1.10 code mark that entry `unresolvable`, report it, and let the chunk continue.

**Approach:** Make §10.2 state the AD-25 outcome and cite AD-25. Make the smallest change that makes the ledger summary false. If the text already states and cites the AD-25 outcome, make no edit.

## Boundaries & Constraints

**Always:** The spine owns the ruling (AD-25), and §10.2 cites it and does not restate the spine. Keep the rest of §10 unchanged.

**Never:** Do not edit `ARCHITECTURE-SPINE.md`, the PRD, `docs/stories/deferred-work.md` or `docs/stories/sprint-status.yaml`. Do not change code. Do not change the "otherwise" arm's load-error rule (a `className` that satisfies no arm). That is a different case, and the spine keeps it as a load error.

</intent-contract>

## Code Map

- `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md:980-986` -- the §10.2 paragraph "Arm 2's output is a `baseTypeId` and is treated as one." On `da37e86` it already says that an underscore-to-space substitution the catalogue does not carry "marks **that entry** `unresolvable` with a `baseTypeId` record naming its canonical key, and the chunk continues (AD-25) — never a search issued in hope, and never a load error".
- Commit `90b9eb94bc0cce650bfbb554faeb1f2f2a1e2e81` ("docs: spine revision 21, rulings for the epic 1 retro items") made that edit. It replaced "is a **load error naming the class**" as epic 1 retro item 12 (R-4), which `sprint-status.yaml` records as `done`. The spine `.memlog.md:330` records the decision.
- `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md:71,1729` -- read-only. The load error there applies to a `className` that satisfies no arm, not to an arm-2 base type that the catalogue lacks. It is consistent with §10.2.
- `packages/sync/src/pricing/price-entry.ts` -- read-only evidence. It catches `UnknownClassBaseTypeError` and returns an `unresolvable` entry.

## Tasks & Acceptance

**Execution:**
- `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md` -- confirm that §10.2 states the AD-25 outcome and cites AD-25, and make no edit because `90b9eb9` already made the fix -- the ledger summary is already false, and an edit would only churn the owner document.

**Acceptance Criteria:**
- Given `IMPLEMENTATION-NOTES.md` on this branch, when a reader reads §10.2's arm-2 paragraph, then it says the entry is marked `unresolvable` and the chunk continues, it cites AD-25, and it does not call the case a load error.
- Given the repository docs and code, when `load error naming the class` is searched for outside the ledger, the retro record and the memlog, then there is no match.

## Spec Change Log

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 13 findings — high 0, medium 0, low 7, false 6, maybe-false 0 (all 13 rejected; the 7 low are fixes to this build's spec)
- findings:
  - `[low]` `[reject]` Blind: AC2's repo-wide search matches this spec, which quotes the phrase — the fix is to edit this build's spec. The owner document and `packages/` have no match.
  - `[low]` `[reject]` Blind: AC2 has no verification command — the fix is to edit this build's spec. The implementer and the orchestrator both ran the repo-wide search by hand. It matched only the ledger, the retro record, the memlog and this spec.
  - `[false]` `[reject]` Blind: AC1 clashes with "never a load error" in §10.2 — AC1 says "does not call the case a load error". "never a load error" denies that classification, so the text satisfies AC1.
  - `[false]` `[reject]` Blind: the spec does not say how the ledger entry closes — the intent assigns the ledger to the caller, and the spec's Never boundary says so.
  - `[low]` `[reject]` Blind: the Problem sentence is hard to parse — the fix is to edit this build's spec.
  - `[low]` `[reject]` Blind: the spec does not explain why the entry stayed open after `90b9eb9` — the fix is to edit this build's spec. The underlying gap, a retro fix that bypasses the ledger, is already the first ledger entry (the `deferred-ledger-audit` layer is wired only into the build skills).
  - `[false]` `[reject]` Blind: retro item 12's epics.md half is uncovered — the intent covers §10.2 only, and `sprint-status.yaml` records item 12 as `done`.
  - `[low]` `[reject]` Blind: the Code Map omits the AD-25 line reference — the fix is to edit this build's spec. AD-25 is at `ARCHITECTURE-SPINE.md:1585`.
  - `[false]` `[reject]` Blind: `context: []` is empty — the Code Map carries every needed path, and the implementer needed no other load.
  - `[false]` `[reject]` Blind: no execution record — this Finalize section writes `## Auto Run Result`. The I/O matrix is omitted by the template's rule, because the change has no I/O scenario.
  - `[false]` `[reject]` Blind: the retro record's `:949` line citation is stale — the retro record is a historical record outside this diff and the intent. The Code Map's own line anchors are correct on `da37e86`.
  - `[low]` `[reject]` Edge: AC2 matches this spec file — same as the first row. The fix is to edit this build's spec.
  - `[low]` `[reject]` Edge: no command checks AC2 repo-wide — same as the second row. It was checked manually, with the result recorded under Auto Run Result.

## Verification

**Commands:**
- `grep -n "load error naming the class" docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md` -- expected: no output (exit 1)
- `grep -n "chunk continues (AD-25)" docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md` -- expected: one match in §10.2

## Auto Run Result

Status: done

- **Change:** none to the owner document. `IMPLEMENTATION-NOTES.md` §10.2 already states the AD-25 outcome (the entry is marked `unresolvable`, and the chunk continues) and cites AD-25. Commit `90b9eb94bc0cce650bfbb554faeb1f2f2a1e2e81` made that edit under epic 1 retro item 12. The ledger summary is therefore already false, and the caller can close the entry.
- **Files changed:** `docs/stories/spec-deferred-implementation-notes-10-2-fix-owed.md` — this spec, the record of the check.
- **Review:** 13 findings from five layers, all rejected (7 low that only ask for spec edits, 6 false). No patches and no deferrals. See the Review Triage Log.
- **Follow-up review recommended:** false. No entry was patched.
- **Verification:** `grep -n "load error naming the class"` on `IMPLEMENTATION-NOTES.md` gave no match. `grep -n "chunk continues (AD-25)"` gave one match, at line 983 in §10.2. A repo-wide search of `docs` and `packages` for "load error naming the class" matches only `docs/stories/deferred-work.md`, `docs/stories/epic-1-retro-2026-09-26.md`, the spine `.memlog.md` and this spec.
- **Residual risk:** none. The change edits no code or test.
