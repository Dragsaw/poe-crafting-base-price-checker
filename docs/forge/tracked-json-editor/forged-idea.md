# Forged idea: curating tracked.json

Outcome: **hardened**, 2026-09-26. The starting idea (a web page for editing tracked.json) became: judge in the web view, edit through an agent skill.

## Locked

- **Judge** the list in the web view: Epic 2 Stories 2.5, 2.6 and 2.8, already planned. Nothing new is added to `packages/web`.
- **Edit and seed** through Claude Code with a skill at `.claude/skills/tracked-json/SKILL.md`. The loop is lookup → edit → check. The skill follows the AGENT-WORKFLOW reporting rule (name the file, the change and the reason) and applies FR-22's Accepted Tier rule to choose bands.
- **Scripts** are read-only `sync` commands in Node/TS that print JSON to stdout:
  - `pnpm tracked:lookup stat|base|class|tiers <query>` reads `catalogue/*.json`, and `weights.json` for tiers.
  - `pnpm tracked:check` checks the `contracts` schema and the pinned cap now. It adds `core`'s five cross-file checks once Story 3.3 lands.
  - No new package and no Python.
- **Separation:** no editor code goes into `packages/web`, so the web page cannot regress.

## Rejected

- **Editor inside the deployed app** (whether or not it saves): conflicts with AD-15, AD-3 and PRD §4.5/§7.1, and would need a PRD edit.
- **Editor code inside `packages/web`, fenced by entry point:** breaks the strict-separation lock.
- **`packages/curate` local page with a write endpoint:** deferred. It would duplicate Epic 2's judging view without the price data, and it can't import `web`. **Revisit if** a curation pass, after Epic 2 ships, needs something the view and the skill together can't give.
- **Standalone console curator:** its UX is no better than the agent working with scripts.

## Open weak point

- Until Story 3.3 ships, `tracked:check` can't catch band edge-alignment or overlap errors against `weights.json`, and those are the errors seeding is most likely to make. Either build 3.3 before seeding, or re-check once it lands.
