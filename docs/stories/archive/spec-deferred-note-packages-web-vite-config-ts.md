---
title: 'Deferred: vite.config.ts comment says "eight" artifacts'
type: 'chore'
created: '2026-10-02'
status: 'done'
baseline_revision: 'c942894364cb72f97a3a7a10f4418e0f60a9ebe0'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/docs/stories/spec-epic-2-retro-item-8-seven-artifacts-no-cache.md'
warnings: []
deferred:
  - summary: >-
      The comment at `.github/workflows/deploy.yml:4` still says "the eight AD-24 artifacts", but AD-24 fixes seven.
    evidence: |-
      `grep -n eight .github/workflows/deploy.yml` prints line 4. The entry this spec closes covered only `packages/web/vite.config.ts`; the same stale count sits in the workflow comment.
    location: >-
      .github/workflows/deploy.yml:4
    severity: low
---

<intent-contract>

## Intent

**Problem:** The comment in `packages/web/vite.config.ts` says "The eight AD-24 artifacts", but AD-24 fixes seven (`catalogue/static.json` is no longer kept). The earlier spec forbade editing that file, so the comment stayed wrong.

**Approach:** Change the comment's word "eight" to "seven". Change nothing else.

## Boundaries & Constraints

**Always:** The edit is comment text only. `pnpm check` and `pnpm test` pass.

**Never:** Change config values, `publicDir`, the port or `strictPort`. Edit `docs/stories/deferred-work.md` or `docs/stories/sprint-status.yaml`.

</intent-contract>

## Code Map

- `packages/web/vite.config.ts:20` -- the comment "The eight AD-24 artifacts are served, never bundled" is the only "eight" in the file.
- `tools/prune-pages.mjs:21` -- read-only evidence: `ALLOWLIST` holds the seven artifacts.

## Tasks & Acceptance

**Execution:**
- `packages/web/vite.config.ts` -- replace "eight" with "seven" in the line-20 comment -- the comment must match AD-24.

**Acceptance Criteria:**
- Given the repository after the change, when `grep -n eight packages/web/vite.config.ts` runs, then it prints nothing.
- Given the change, when `git diff` runs, then only the comment line differs.

## Verification

**Commands:**
- `grep -n eight packages/web/vite.config.ts` -- expected: no output
- `pnpm check` -- expected: exit 0
- `pnpm test` -- expected: exit 0

## Review Triage Log

### 2026-10-02 — Review pass
- verdicts: 5 findings — high 0, medium 0, low 2, false 1, maybe-false 0, plus 1 low deferred as pre-existing; the ledger audit reported none
- layers run: blind-hunter and deferred-ledger-audit. The edge-case, verification-gap and intent-alignment layers were skipped: the change is one comment word.
- findings:
  - `[low]` `[defer]` Stale "eight" in `.github/workflows/deploy.yml:4` — real, pre-existing and outside the entry's scope (`vite.config.ts` only); added to `deferred`.
  - `[low]` `[reject]` Write the comments with no count — a rewording beyond the entry; the fix is not a direct correction.
  - `[low]` `[reject]` Add a test tying `data/` to the count — adds a new test, is not caused by this change, and the diff is comment-only.
  - `[false]` `[reject]` No verification trail — `pnpm check` and `pnpm test` ran and passed; the commit and the ledger removal belong to the caller.
  - Ledger audit — zero findings.

## Auto Run Result

Status: done

- Summary: the comment at `packages/web/vite.config.ts:20` now says "seven" AD-24 artifacts.
- Files changed: `packages/web/vite.config.ts` (one comment word).
- Review: 0 patches; 1 deferred (`deploy.yml` comment); 3 rejected, reasons above.
- Verification: `grep -n eight packages/web/vite.config.ts` prints nothing; `pnpm check` exit 0; `pnpm test` 1537 passed.
- Follow-up review recommended: false.
- Residual risks: none.
