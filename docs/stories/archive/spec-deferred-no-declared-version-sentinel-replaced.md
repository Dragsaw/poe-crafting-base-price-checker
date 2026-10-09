---
title: 'Record that the item 22 sentinel fix landed, in its spec and its review'
type: 'chore'
created: '2026-09-27'
status: 'done'
baseline_revision: 'f96b908d6a47cdc1243b043f51c4be606ad140d2'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Commit `8a47e2464fa9f455b9436addc30736a18e6582fb` replaced the `NO_DECLARED_VERSION = 'none'` sentinel with `declared: string | null`. The item 22 spec still describes the sentinel (Code Map and three `reject` triage rows), and the review of `78db4da..ec38dce` still lists the sentinel finding as open. Neither document says that the fix landed.

**Approach:** Append one dated Spec Change Log note to the item 22 spec that names the fix commit and the superseded lines. Mark the sentinel finding closed at each place where the review lists it.

## Boundaries & Constraints

**Always:** Cite the fix commit by its short sha `8a47e24`. The spec note names each superseded passage (the Code Map `NO_DECLARED_VERSION` predicate, the sentinel `reject` rows of both triage passes) and states the predicate the code uses now (`declared === null`). A review "closed" mark names the commit and the new type.

**Never:** Do not edit code or tests. Do not rewrite or delete existing Code Map, triage or Auto Run Result text in the spec: the Spec Change Log is the record of the change. Do not edit the review's `## Findings (JSON)` block (reviewer output data). Do not edit `docs/stories/deferred-work.md`, `docs/stories/sprint-status.yaml` or any owner planning document.

</intent-contract>

## Code Map

- `docs/stories/spec-epic-2-retro-item-22-refusal-cause.md` -- `status: done` spec. `:51` Code Map says "Split these with `declaredVersion(data) === NO_DECLARED_VERSION`". `:76` `## Spec Change Log` is empty. `:83`, `:84`, `:93` (blind sentinel row) and `:101` are the first pass's sentinel `reject` rows; `:111` and `:117` are the second pass's rejected sentinel rows. `:151` Auto Run Result counts the sentinel as 3 rejected rows.
- `docs/reviews/review-changes-since-78db4da.md` -- `:13` merge-interaction bullet "Item 22 `NO_DECLARED_VERSION = 'none'` sentinel"; `:54-58` adversarial finding 8; `:105` edge-case-hunter finding 4; `:136-140` verification-gap finding 2. The file has no existing "closed" convention.
- `packages/web/src/load/load-artifacts.ts:43-46,69,119-130` -- read-only evidence: `declared: string | null`, `declaredVersion` returns `null`, and `cause: declared === null ? 'version' : 'content'`.
- `packages/web/src/load/load-artifacts.test.ts:145-152`, `packages/web/src/App.test.tsx:239-247` -- read-only evidence: regression tests for a declared `"none"`, which close the verification-gap finding.

## Tasks & Acceptance

**Execution:**
- `docs/stories/spec-epic-2-retro-item-22-refusal-cause.md` -- under `## Spec Change Log`, add a `### 2026-09-27 — sentinel replaced by declared: null` entry: the fix commit, the new type, the current predicate, and that the Code Map `:51` predicate and the sentinel rows of both triage passes (and the Auto Run Result's "sentinel \"none\" (3 rows)") describe the superseded design -- makes "neither says the fix has now landed" false for the spec.
- `docs/reviews/review-changes-since-78db4da.md` -- append a closed mark naming `8a47e24` and `declared: string | null` to the `:13` bullet, to adversarial finding 8, to edge-case-hunter finding 4, and to verification-gap finding 2 (which also names the two regression tests) -- marks the sentinel finding closed.

**Acceptance Criteria:**
- Given the item 22 spec, when a reader opens its Spec Change Log, then one dated entry says that `8a47e24` replaced the sentinel with `declared: string | null` and names the superseded Code Map predicate and triage rows.
- Given the review file, when a reader finds any listing of the sentinel finding outside the JSON block, then that listing says it is closed by `8a47e24`.
- Given the diff, when it is inspected, then it touches only these two Markdown files.

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 19 findings — high 0, medium 0, low 18, false 1, maybe-false 0
- findings:
  - `low` `patch` (blind) Adversarial 8 is marked fully closed, but its non-string half (`schemaVersion: 1` prints "declares no schema version") is still open. — Real: `declaredVersion` returns `null` for a non-string. The Status line now closes only the `"none"` collision and says the non-string case stays rejected in the item 22 second pass.
  - `low` `reject` (blind) The `## Findings (JSON)` block still reads as open. — The block is the reviewers' raw output and carries no status for any finding; the prose sections carry status. A header note adds surface for a reader who is unlikely to take the JSON as status.
  - `low` `reject` (blind) The review header does not say it was amended later. — Each mark names its commit, `8a47e24`, which dates it. A header line adds surface.
  - `low` `patch` (blind) The Spec Change Log calls the reject rows "superseded design" but does not say the verdict was reversed. — Added one bullet: the review of `78db4da..ec38dce` reopened the collision and `8a47e24` fixed it; the non-string rejection stands.
  - `low` `reject` (blind) This spec's AC "touches only these two Markdown files" is false because the diff adds this spec. — The fix edits this build's spec.
  - `low` `reject` (blind) This spec's Problem says three rows but lists six, and cites the full sha. — The fix edits this build's spec.
  - `low` `reject` (blind) This spec's Code Map anchors are pre-edit. — The fix edits this build's spec.
  - `low` `reject` (blind) The review uses two closed-mark formats. — Each mark follows the shape of its item: a one-line item gets an inline mark, an item with sub-bullets gets a `Status:` sub-bullet. A reader meets no ambiguity.
  - `false` `reject` (blind) Nothing says who removes the ledger entry. — The intent says the caller maintains `deferred-work.md`; the sweep's closing commit removes it.
  - `low` `reject` (blind) Verification checks nothing this change can break. — The fix edits this build's spec; the AC were checked by reading the diff.
  - `low` `reject` (blind) The closed mark cites the test titles but not what they assert. — The titles name the behaviour ("by naming it, not as declaring no version"); more text adds nothing a reader needs.
  - `low` `patch` (edge-case) Adversarial 8 Status overstates the fix (non-string half). — Same fix as the first blind row.
  - `low` `patch` (edge-case) The line-13 merge bullet is marked closed with no scope. — The bullet now closes the declared `"none"` collision and says a non-string version still reads as no version.
  - `low` `reject` (edge-case) This spec's Code Map anchors are stale. — The fix edits this build's spec.
  - `low` `patch` (edge-case, claim) The non-string half of adversarial 8 is marked fixed but is not. — Same fix as the first blind row.
  - `low` `reject` (intent-alignment) The item 22 Code Map line still reads `NO_DECLARED_VERSION` with no forward pointer. — The intent asks for a Spec Change Log note, and the spec's Never keeps the done spec's body as written; the change log names that line.
  - `low` `reject` (intent-alignment) The JSON rows have no closed status. — Same as the blind JSON row.
  - `low` `reject` (intent-alignment) This spec is a third file against its own AC. — The fix edits this build's spec.
  - `low` `reject` (intent-alignment) The named verification does not exercise the doc change. — The fix edits this build's spec.

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0
- `pnpm test` -- expected: all pass

**Manual checks (if no CLI):**
- `git diff --stat` lists only the two Markdown files above.

## Auto Run Result

Status: done

**Summary:** The item 22 spec and the review of `78db4da..ec38dce` now record that `8a47e24` replaced the `NO_DECLARED_VERSION = 'none'` sentinel with `declared: string | null`.

**Files changed:**
- `docs/stories/spec-epic-2-retro-item-22-refusal-cause.md`: one dated Spec Change Log entry. It names the fix, the current predicate, the superseded passages, the reversed reject verdicts and the regression tests.
- `docs/reviews/review-changes-since-78db4da.md`: closed marks on the merge bullet, adversarial 8, edge-case-hunter 4 and verification-gap 2. The first two are scoped to the `"none"` collision.

**Review:** 19 findings. Patched: 5 `low` rows (one root cause: the unscoped closed mark, plus the reversed-verdict clause). Deferred: 0. Rejected: 13 `low` rows and 1 `false` row. The Review Triage Log gives each reason: edits to this build's spec (7), JSON and header notes (3), format and test-description rows (2), the Code Map pointer (1), and the ledger owner (`false`).

**Follow-up review:** `false`. No `high` or `medium` entry was patched.

**Verification:** `pnpm check` exit 0. `pnpm test` 102 files, 1431 tests passed, before and after the patches. I read the diff: only the two Markdown files and this spec changed.

**Residual risks:** None for runtime; the change is documentation only.
