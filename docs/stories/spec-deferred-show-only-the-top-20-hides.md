---
title: 'Deferred: collapse and the open set — confirm Story 2.5 settled it'
type: 'chore'
created: '2026-09-27'
status: 'done'
baseline_revision: 'b1aee33381f3c24cd00d407758e5f124d5f53825'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The deferred-work entry from spec 2.3 (review triage row 12) says that `− Show only the top 20` leaves hidden rows in `RankedList`'s open set, so they reappear open on the next grow, and that Story 2.5 must decide whether collapse closes hidden rows once a panel hangs off an open row.

**Approach:** Story 2.5 is `done` and made that decision: collapse never changes the open set, so a hidden open row reappears open. The decision is in the UX owner document, in the spec, in the code and in a test. This change adds no code. It records the evidence so the caller can remove the ledger entry.

## Boundaries & Constraints

**Always:** Cite the owner document (EXPERIENCE.md) and the Story 2.5 decision. Do not restate their text as a new rule.

**Never:** Change `RankedList.tsx` behavior. Edit EXPERIENCE.md, DESIGN.md, `deferred-work.md` or `sprint-status.yaml`. Add a new test that duplicates the existing open-set test.

</intent-contract>

## Code Map

- `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md` -- owner of view treatments. The flow step *Expand a ranked row* says "Nothing closes a panel except a second click on its own row". A collapse is therefore not a close. State 33 ("restores the top 20 exactly") names the rows shown and adds no close rule. Read-only.
- `docs/stories/spec-2-5-row-expansion-the-evidence-behind-a-row-its-tombstones-and-its-trade-link.md` -- *Panel* bullet (L26): "Growing or collapsing the list never changes the open set. This settles deferred-work L173: a hidden open row reappears open." The I/O matrix row "Two open, grow" (L53) gives the expected result. Read-only.
- `packages/web/src/list/RankedList.tsx` -- `RankedList` docblock states the rule. `open` is not reset by the grow toggle. Read-only.
- `packages/web/src/list/expansion.test.tsx` -- `describe('the open set')`, test "keeps rows 3 and 22 open, with their panels, across a collapse and a regrow", asserts the rule. Read-only.

## Tasks & Acceptance

**Execution:**
- `packages/web/src/list/expansion.test.tsx` -- run it, no edit -- confirms that the settled behavior still holds on the current base.

**Acceptance Criteria:**
- Given the list grown with rows 3 and 22 open, when the player collapses and regrows it, then both rows and both panels are open again (the existing test passes).
- Given this change, when `git diff` is read against the base, then it holds only this spec file.

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 14 findings — high 0, medium 0, low 2, false 12, maybe-false 0
- findings:
  - `[false]` `[reject]` (blind) AC 2 "diff holds only this spec file" conflicts with the ledger removal — the caller removes the entry in its own commit after build-auto ends; the intent forbids this run to edit `deferred-work.md`. The fix edits this build's spec.
  - `[false]` `[reject]` (blind) The GitHub issue is not named — the caller owns the issue and closes it through its PR body; the intent names no issue.
  - `[false]` `[reject]` (blind) No stable ledger locator; spec 2.5 cites a stale "L173" — the spec identifies the entry by its quoted content, and the intent carries the entry verbatim. The fix edits this build's spec.
  - `[false]` `[reject]` (blind) "The decision is in the UX owner document" overclaims — EXPERIENCE.md flow step 2 says "Nothing closes a panel except a second click on its own row", an owner rule under which a collapse cannot close a panel; spec 2.5 applies it to collapse explicitly.
  - `[false]` `[reject]` (blind) Threshold-hidden rows also stay open — pre-existing and not this entry; spec 2.5 triage already rejected it as consistent with the same owner rule.
  - `[low]` `[reject]` (blind) No evidence that the open set survives the auto-collapse when rows drop to 20 — `RankedList.tsx` resets only `grown` there and never touches `open`, so the rule holds by construction; a new test adds cost for a negligible risk.
  - `[false]` `[reject]` (blind) Imprecise line citations and an empty `context` — the fix edits this build's spec.
  - `[false]` `[reject]` (blind) Verification records no observed result; status inconsistent — the fix edits this build's spec; the result is recorded under Auto Run Result.
  - `[low]` `[reject]` (edge-case) Auto-collapse path unverified — same root as the blind auto-collapse row; same reason.
  - `[false]` `[reject]` (edge-case) A unit that leaves `rows` and returns reappears open — pre-existing and consistent with EXPERIENCE.md flow step 2; not this entry.
  - `[false]` `[reject]` (edge-case) AC 2 cannot be read from a plain diff of an untracked file — finalization commits the spec, after which a diff against the baseline shows it. The fix edits this build's spec.
  - `[false]` `[reject]` (edge-case) Line citations have drifted — the fix edits this build's spec; the Code Map also names each anchor by content.
  - `[false]` `[reject]` (intent-alignment) The diff implements reading B (decision settled) and leaves the literal open-set behavior true — reading A would contradict the owner rule in EXPERIENCE.md flow step 2 and the Story 2.5 decision; the summary's operative claim is the pending decision, which Story 2.5 made.
  - `[false]` `[reject]` (intent-alignment) State 33 still says nothing about open rows — state 33 describes which rows show; the close rule lives in flow step 2 of the same owner document, so no owner gap remains for this entry.
- ledger audit: zero carved-out items. Verification gap: no gaps.

## Verification

**Commands:**
- `pnpm exec vitest run packages/web/src/list/expansion.test.tsx` -- expected: all tests pass.
- `pnpm check` -- expected: passes.

## Auto Run Result

Status: done

- **Summary:** No code change. Story 2.5 (done) made the decision that the entry left open: growing or collapsing the list never changes the open set, so a hidden open row reappears open. EXPERIENCE.md flow step 2 (nothing closes a panel except a second click on its own row), spec 2.5 (Panel bullet, matrix row "Two open, grow"), the `RankedList` docblock and the test "keeps rows 3 and 22 open, with their panels, across a collapse and a regrow" carry it. The caller can remove the entry.
- **Files changed:** `docs/stories/spec-deferred-show-only-the-top-20-hides.md` — this spec, the evidence record.
- **Review:** 14 findings, 0 patched, 0 deferred, 14 rejected (the triage log gives each reason).
- **Follow-up review recommended:** false (no patched entries).
- **Verification:** `pnpm exec vitest run packages/web/src/list/expansion.test.tsx` — 1 file, 19 tests passed. `pnpm check` — exit 0.
- **Residual risks:** the rule is seen only in jsdom. The real-browser grow/collapse check is a separate ledger entry (source spec 2.5).
