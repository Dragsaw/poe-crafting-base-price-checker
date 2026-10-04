---
title: 'poesessid retro item 5: ledger the deferred findings'
type: 'chore'
created: '2026-10-04'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** This is action item 5 of `docs/specs/spec-poesessid-sync/RETROSPECTIVE.md`. The retro marked V2, V4, V5, R5, A2, A3, A4 and A5 **defer**, but none has a `deferred-work.md` entry. So `pnpm deferred:issues` opens no issue for them and the sweep cannot pick them up. P1 shows this failure: a rejection that names a later story was lost.

**Approach:** Append one `## Deferred from:` group to `docs/stories/deferred-work.md` with six entries, as item 5 groups them: V2 with V5, V4, R5, A2, A3 with A4, and A5. `source_spec` is the retrospective. Each entry names its owner role, the code sites by symbol, and the retro finding ids. Do not edit other entries.

</frozen-after-approval>

## Implementation Notes

- One group, `## Deferred from: spec-poesessid-sync retrospective (2026-10-04)`, was appended to `docs/stories/deferred-work.md`. It holds six entries in the item 5 order. No other entry was edited. Retro A6 is not in the group: retro item 3 already ledgered the shared `inputs()` helper.
- `source_spec` is the retrospective, as for `epic-2-retro-2026-09-27.md`. The retrospective is untracked in this worktree, so it must be committed on this branch before the branch merges. Otherwise each `source_spec` cites a file that is not on master.
- Each summary starts with an owner role. The first 70 characters become the issue title (`issueTitle` in `tools/deferred-issues/ledger.ts`). The code sites are named by symbol, not by line, because items 1–4 have already moved lines.
- The V4 mechanism was checked against the source. `send` in `trade/client.ts` computes `remaining` from the baseline's headers before `probe` spends its search. The runtime effect is still unverified, and the entry says so.
- A3 with A4 names the architect first, because IN §13.2 and §13.4 own the two tests.
- Verified: `parseLedger` reads the working-tree file as 80 entries with 80 unique ids. The six new ids are `dw-a8db5c9379`, `dw-5be354509b`, `dw-6ccfd0ece3`, `dw-3a405fd3ae`, `dw-77b8413798` and `dw-731f1b725c`. `pnpm deferred:issues` was not run. It reads `origin/master` and creates GitHub issues.

## Review Triage Log

Layers: Blind Hunter, Deferred Ledger Auditor (no findings: the spec carves out no work).

- The V2/V5 entry said only the `sync.ts` catch redacts. `syncCommand` in `sync-batch.ts` also calls `auth.redact`. **medium, patched**. The entry now names both shells.
- The V2/V5 entry did not say why `isWalkable` skips class instances (an unbounded object graph). **low, patched**. The entry now says to handle each class on its own and not to widen the walk.
- The V4 settle step used a fake bucket, and a fake cannot show whether the API charges the probe to the baseline's bucket. **medium, patched**. The entry now names that live fact first.
- The V4 entry also listed `discoveredAllowance` as wrong. It pairs the pre-probe count with the steps, and neither includes the probe, so it is probably right. **low, patched**. The entry now names `boundOf` and `pinnedToKeep`.
- The R5 entry gives no regex and no rule name. **low, rejected**. The retro does not name the rule, and a guessed pattern could ban the wrong literal. The implementer reads the name from live headers.
- The A3/A4 and V4 entries have no `retry_when:`, so the sweep can claim them before the IN edit or the live check. **low, rejected for this spec**. The ledger header reserves `retry_when:` for a human. The operator was told at hand-off.
- Retro P8 (the `dev-stop.test.ts` flake) and the process items 6–7 have no ledger home. **low, rejected (out of scope)**. Item 5 lists its entries exactly, and items 6–7 belong to the operator. The operator was told at hand-off.
- This group meets the `retry_when` of the epic 1 retro item 15 entry. **false**. That condition is a carve-out that escaped the audit. This group came in through the retro's own action item, so nothing escaped.
- The retrospective is stale (it says "None has been applied", and its line citations have moved). **low, rejected (out of scope)**. The retro is the operator's document. The operator was told at hand-off.
- `status: in-progress` and no triage log. **false**. Finalize sets `done` and writes this log. Who commits the retrospective is recorded in the notes above and goes to the operator.

