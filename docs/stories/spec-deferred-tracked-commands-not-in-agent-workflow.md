---
title: 'Name pnpm tracked:lookup and pnpm tracked:check in AGENT-WORKFLOW.md and AGENTS.md'
type: 'chore'
created: '2026-09-27'
status: 'done'
baseline_revision: 'fc4a98873c965031938ab5f9e02df7e653b045e1'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `pnpm tracked:lookup` and `pnpm tracked:check` are named neither in `AGENT-WORKFLOW.md`, which owns command-level rules, nor in the "Where things are" section of `AGENTS.md`. Only the `tracked-json` skill description makes them discoverable, so an agent that edits `data/tracked.json` without triggering the skill does not find the check (deferred-work entry from `spec-tracked-json-curation-tooling.md`).

**Approach:** Add one command-level rule to `AGENT-WORKFLOW.md` next to the hand-edited-input rule: for `data/tracked.json`, look up with `pnpm tracked:lookup`, then run `pnpm tracked:check`, which must exit 0. Add one "Where things are" bullet to `AGENTS.md` that names both commands and the skill, and cites `AGENT-WORKFLOW.md` for the rule without restating it.

## Boundaries & Constraints

**Always:**
- `AGENT-WORKFLOW.md` owns the rule. The `AGENTS.md` bullet points to the commands and the skill and cites the owner. It does not restate the rule (AGENTS.md, "Each planning fact has one owner").
- Keep the wording in the style of the surrounding text: short declarative sentences.
- The `AGENTS.md` edit stays inside the `bmad:context` block, in "Where things are", because the entry names that section.

**Never:**
- No change to code, tests, `package.json`, the `tracked-json` skill, `data/`, `docs/stories/deferred-work.md` or `docs/stories/sprint-status.yaml`.
- No restatement of the skill's loop, of the three checks `tracked:check` runs, or of the five cross-file checks (Story 3.3).
- No new AD, no PRD edit, no edit to another owner document.

</intent-contract>

## Code Map

- `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md:66` -- the *Parallel worktrees* `data/` writer rule. It says an agent edits a hand-edited input directly and names the file, change and reason in its report. The new command rule goes directly after the "so the player knows." sentence, because it applies to that edit.
- `AGENTS.md:12-17` -- the "Where things are" list inside the `<!-- bmad:context -->` block. Other tasks already edited this block (for example `5fb836a`, retro item 13). A new bullet goes at the end of the list.
- `package.json:24-25` -- the script strings: `tracked:lookup` runs `.claude/skills/tracked-json/scripts/lookup.ts`, `tracked:check` runs `packages/sync/src/curation/check.ts`. Read-only evidence for the names.
- `.claude/skills/tracked-json/SKILL.md` -- the skill that drives lookup → edit → check. Cite it by path. Do not edit it.
- No test reads `AGENTS.md` or `AGENT-WORKFLOW.md` (grep over `*.ts`), so no test changes.

## Tasks & Acceptance

**Execution:**
- `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md` -- in the `data/` writer bullet, after "so the player knows.", add: for `data/tracked.json`, get catalogue and weights facts from `pnpm tracked:lookup`, and after the edit run `pnpm tracked:check`, which must exit 0; the `tracked-json` skill (`.claude/skills/tracked-json/SKILL.md`) drives that loop -- makes the command rule live in its owner.
- `AGENTS.md` -- append a "Where things are" bullet that names `pnpm tracked:lookup`, `pnpm tracked:check`, the skill path and the `AGENT-WORKFLOW.md` *Parallel worktrees* rule as the owner -- makes the tools discoverable without the skill.

**Acceptance Criteria:**
- Given `AGENT-WORKFLOW.md`, when an agent reads the *Parallel worktrees* hand-edited-input rule, then it finds `pnpm tracked:lookup` and `pnpm tracked:check` named, with the rule that `tracked:check` must exit 0 after an edit to `data/tracked.json`.
- Given `AGENTS.md`, when an agent reads "Where things are", then it finds both commands and the skill path, and a citation of `AGENT-WORKFLOW.md` for the rule.
- Given the diff, when it is inspected, then only those two files change.

## Spec Change Log

## Review Triage Log

### 2026-09-27 — Review pass
- verdicts: 13 findings — high 0, medium 3, low 7, false 2, maybe-false 1. Layers: blind 8, edge 2, verification-gap 0, intent-alignment 3 (its descriptive divergences, one row each), deferred-ledger 0.
- findings:
  - `[medium]` `[patch]` (blind) A clean `tracked:check` reads as full validation; the rule does not say that the `pending` checks stay unrun — grouped: the text now says that a pass does not cover the checks `pnpm tracked:check` lists under `pending` (`check.ts:169`), with no Story 3.3 date that would go stale.
  - `[false]` `[reject]` (blind) The owner rule is weaker than the skill's "never open" ban, which cites it as authority — the skill's ban (`SKILL.md:15`) cites nothing; its AGENT-WORKFLOW citation (`SKILL.md:16`) covers only the edit-and-report rule, so no owner text is contradicted.
  - `[low]` `[patch]` (blind) The new sentences split "…so the player knows." from "The agent does not stop and hand a known edit back" — moved the tracked.json sentences after the hand-back sentence.
  - `[low]` `[reject]` (blind) The commands are missing from *The agent loop* and *Fixtures* code blocks — the agent-loop block lists commands every task runs, and the fixtures block lists live-API commands; neither class fits a per-edit curation tool, so listing them there would misclassify them.
  - `[low]` `[reject]` (blind) *Definition of done* does not require `tracked:check` — the *Parallel worktrees* rule now binds it; a second copy in the same document is the duplication the one-owner rule forbids.
  - `[medium]` `[patch]` (blind) "Drives that loop" reduces the procedure to two commands and does not bind an agent editing without the skill to 4b, the shared floor and the hand check — grouped with the `pending` finding: the text now says the agent follows the `tracked-json` skill for every edit to `data/tracked.json`.
  - `[false]` `[reject]` (blind) The AGENTS.md bullet does not say how to start `tracked:lookup` — running it with no arguments prints the usage (`SKILL.md:10`), which lists the subcommands; no bad outcome.
  - `[low]` `[reject]` (blind) The citation by section title has no stable anchor — the repository cites AGENT-WORKFLOW by section title throughout (for example `deferred-work.md`, "AGENT-WORKFLOW §Parallel worktrees"); a doc-link test is new tooling beyond a direct correction.
  - `[medium]` `[patch]` (edge) Exit 0 does not cover the five cross-file checks — grouped with the `pending` finding; same fix.
  - `[low]` `[patch]` (edge) No rule for a non-zero exit — grouped with the `pending` finding: the text now says to fix the file until the command exits 0.
  - `[low]` `[reject]` (intent) The rule sits in a prose bullet, not a command list or *Definition of done* — same claim as the command-lists row; rejected on the same reason.
  - `[low]` `[reject]` (intent) Nothing mechanical ties an edit of `data/tracked.json` to running the check — the intent limits the work to "exactly what the entry describes", and the entry asks for naming, not enforcement.
  - `[maybe-false]` `[reject]` (intent) A `bmad-project-context` refresh may drop the bullet inside the managed block — settled by reading how a refresh re-derives "Where things are"; earlier edits in the block (`5fb836a`) survived, and the bullet cites files that exist. If true it would be low, so it is rejected with this note.

## Verification

**Commands:**
- `pnpm check` -- expected: passes
- `pnpm test` -- expected: passes, with no network call
- `grep -n "tracked:check" AGENTS.md docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md` -- expected: one hit in each file

**Manual checks (if no CLI):**
- The `AGENTS.md` bullet cites and does not restate the `AGENT-WORKFLOW.md` rule.

## Auto Run Result

Status: done

**Summary:** `pnpm tracked:lookup` and `pnpm tracked:check` are now named in both places the entry lists. `AGENT-WORKFLOW.md` holds the rule, in the *Parallel worktrees* `data/` writer bullet. For every edit to `data/tracked.json` the agent follows the `tracked-json` skill, gets facts from `tracked:lookup`, and runs `tracked:check` until it exits 0. A pass does not cover the checks that `tracked:check` lists under `pending`. `AGENTS.md` "Where things are" points to the two commands and the skill, and cites that rule.

**Files changed:**
- `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md`: four sentences after the hand-back sentence of the `data/` writer rule.
- `AGENTS.md`: one "Where things are" bullet, inside the `bmad:context` block.

**Review findings:** 13 in total. There were 2 patch entries: one medium, which groups 4 rows (the `pending` caveat, the skill binding and the non-zero-exit rule), and one low (the sentence order). 0 were deferred. The rejected findings are 2 false, 1 maybe-false with a low grade if true, and 6 low: the command lists, twice; *Definition of done*; the section-title anchor; mechanical enforcement, which the intent excludes; and the managed block, which is the maybe-false. The reasons are in the triage log above.

**Follow-up review recommendation:** false. This pass patched 1 medium entry and 1 low entry, and no high.

**Verification:**
- `pnpm check`: passes, before and after the patches.
- `pnpm test`: passes, before and after the patches, with no network call.
- `grep tracked:check`: one line in each of the two files.
- The `pending` label matches `packages/sync/src/curation/check.ts:169`.

**Residual risks:**
- The `AGENTS.md` bullet is inside the `bmad:context` block. A `bmad-project-context` refresh must keep it.
- The rule reaches only an agent that reads `AGENT-WORKFLOW.md` or `AGENTS.md`. Nothing enforces a `tracked:check` run after an edit.
