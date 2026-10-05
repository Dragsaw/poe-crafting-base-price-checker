// Excerpts of `docs/stories/deferred-work.md` from before the 2026-09-27 cleanup: nested
// bullets, quoted summaries, a human `retry_when:`, no `source_spec`, a `resolved_by:` note.
export const FIXTURE_LEDGER = `# Deferred work

Each entry names work carved out of a spec. Append new entries.

## Deferred from: story 1.11 (2026-09-26)

- source_spec: \`docs/stories/spec-1-11-league-validation-as-a-run-start-gate.md\`
  summary: A 429's \`retryAfterMs\` is not kept across processes, so the next scheduled \`pnpm sync\` may send inside the penalty window. Unverified.
  evidence: The ledger is per process by AD-8's design (\`packages/sync/src/trade/client.ts\`), and both the pricing step's yield and the league gate's yield (\`packages/sync/src/league/league-gate.ts\`) drop the delay. To settle it, compare the player's scheduler interval with the \`Retry-After\` windows the trade API actually returns.

## Resolved by epic 1 retro item 11 (2026-09-26)

- Two story 1.4 entries are **retired**. First, "\`data/catalogue/{items,stats,filters,static}.json\` are not on disk yet" was already closed by \`edd2c97\`, as the Resolved note above records.

## Resolved: spine edit owed by story 1.9 (2026-09-26)

- source_spec: \`docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md\` (AD-12, revision 20)
  summary: The spine edit that story 1.9 left owed is made.
  evidence: Spine memlog, revision 20 entries.
- resolved_by: PRD FR-18 revision 21, \`docs/epics.md\`, and \`EXPERIENCE.md\` revision 6 (2026-09-26).
  code_owed: The trust strip must render that suffix when Epic 2 builds it.

## Deferred from: epic 2 retrospective (2026-09-27)

- source_spec: \`docs/stories/epic-2-retro-2026-09-27.md\`
  summary: Once a git remote exists, harden the Pages deploy. Add a test job that excludes the committed-data suites and that the deploy \`needs:\`.
  evidence: Retro F16 (review A5, A17, V4). \`deploy.yml\` gates only on \`pnpm check\`.
  retry_when: A git remote is configured and \`deploy.yml\` has run once.
- source_spec: \`docs/stories/epic-2-retro-2026-09-27.md\`
  summary: Lower-severity seam findings from the epic 2 diff review. None is reached by today's data:
    - no error boundary, so a render throw gives a blank page (\`App.tsx:122-135\`)
    - no fetch timeout, so a hung request keeps the skeleton indefinitely (\`load/load-artifacts.ts:68-89\`)
  evidence: Retro F18. \`docs/reviews/review-epic-2-diff.md\` items A8, A9, A10, A13, A14, A15, A18, E7, E10 and E12.

## Deferred from: epic 2 retro item 12, UX reconciliation pass (2026-09-27)

- source_spec: \`docs/stories/epic-2-retro-2026-09-27.md\`
  summary: "[NOTE FOR UX] Copy with no owner: the mockups are the only source for this printed text. The masthead title, the asking-price line's second sentence and the appendix lead (HR-15, HR-16)."
  evidence: Findings HR-15, HR-16, XS-28, XS-29 and XS-30 (retro item 12 audit).

## Deferred from: epic 2 retro item 8 (2026-09-27)

- source_spec: \`docs/stories/spec-epic-2-retro-item-8-seven-artifacts-no-cache.md\`
  summary: "Note. \`packages/web/vite.config.ts\` still has a comment that says \\"eight\\" artifacts."
  evidence: Spec \`spec-epic-2-retro-item-8-seven-artifacts-no-cache.md\`, Never.
`;
