---
title: 'tracked-json SKILL: read `checks`, not only the exit code'
type: 'chore'
created: '2026-10-02'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The tracked-json SKILL tells the agent to loop `pnpm tracked:check` until exit 0. Exit 0 also happens when `cross-file` is `skipped` (weights file absent), and a class absent from the weights file or with a `partial` slot gets no edge, containment or kind check.

**Approach:** Add both caveats to `.claude/skills/tracked-json/SKILL.md`, so that the agent reads `checks` and not only the exit code.

## Boundaries & Constraints

**Always:** Cite no mechanism text of an owner document. State only what `check.ts` and `cross-file.ts` do.

**Never:** Edit any file other than the SKILL and this spec. Edit no code.

</intent-contract>

## Code Map

- `.claude/skills/tracked-json/SKILL.md` -- the file to edit: the `tracked:check` bullet and loop step 7.
- `packages/sync/src/curation/check.ts` -- pushes `cross-file: skipped` with `ok: true` when the weights file is absent.
- `packages/core/src/cross-file.ts` -- a class absent from the file, or with a `partial` slot, gets no pool check; class discriminability still runs.

## Tasks & Acceptance

**Execution:**
- `.claude/skills/tracked-json/SKILL.md` -- add both caveats to the `tracked:check` bullet, and a read-`checks` instruction to loop step 7 -- the agent must not treat exit 0 as full coverage.

**Acceptance Criteria:**
- Given the SKILL, when an agent reads the `tracked:check` bullet, then it learns that `cross-file` `skipped` exits 0 and that a class absent from the weights file or with a `partial` slot gets no edge, containment or kind check.
- Given loop step 7, when the check exits 0, then the agent reads `checks` and reports any unconfirmed check.

## Spec Change Log

## Review Triage Log

### 2026-10-02 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` The first edit pass wrote the caveat sentences twice in the bullet — duplicate text, removed before commit.
  - `[low]` `[reject]` The reviewer could name class discriminability as still running; the claim in the SKILL names only the three checks that skip, which is correct, so no change.

Review was one pass by the caller, not the five parallel reviewer subagents: the diff is two sentences of prose in an agent-context file.

## Verification

**Commands:**
- `pnpm check` -- expected: exit 0
- `pnpm test` -- expected: exit 0

## Auto Run Result

Status: done

- Summary: the `tracked:check` bullet and loop step 7 of the tracked-json SKILL now say that exit 0 can come with a skipped `cross-file`, and that a class absent from the weights file or with a `partial` slot gets no edge, containment or kind check.
- Files changed: `.claude/skills/tracked-json/SKILL.md` -- two additions; this spec.
- Review: 1 patch applied (duplicate text), 1 rejected, 0 deferred.
- Follow-up review recommended: false.
- Verification: `pnpm check` and `pnpm test` run in section 4 of the sweep.
- Residual risk: none known.
