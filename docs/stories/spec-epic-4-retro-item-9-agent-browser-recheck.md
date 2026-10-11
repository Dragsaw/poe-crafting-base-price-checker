---
title: 'Epic 4 retro item 9: a story is done only after the agent browser checks re-run after the last review fix'
type: 'chore'
created: '2026-10-11'
status: 'done'
baseline_commit: 'ce1186585cf58e2fbf2448338fe04baa0dd3000c'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Agent browser checks kept slipping in epic 4 (retro L1, item 9). Builds deferred them until told, and three times (4.1, 4.8, a 4.5 fix subagent) they were not re-run after review fixes. Step-04 re-runs only the `## Verification` section after a patch, and in practice the agent re-ran the commands and skipped the browser list. The browser found a spacing defect that tests could not see.

**Approach:** Add one rule to the project's bmad-build customization, as a persistent fact, and gate the existing accept step on it:
1. A spec whose change the page can show carries an `**Agent browser checks:**` list in `## Verification`, in the form `spec-4-1-…` uses. The implementing agent runs it itself and never hands it to the human.
2. After the last review fix, the agent re-runs the whole list (not only the checks near the fix) and records the results in Implementation Notes under `### Agent browser checks (after review)`, with the session id and screenshot paths. A failed check is a defect: fix it, then re-run the list.
3. The spec does not go to `done` and the story key does not go to `review` or `done` until that record exists and is later than the last fix. The accept step in `on_complete` checks the record before it asks the user to accept; when the record is missing, it runs the checks first.
4. Set action item `epic-4-retro-item-9-a-story-is-done-only-after-agent-browser` to `done` in `sprint-status.yaml`, and add a status note to item 9 of `docs/stories/epic-4-retro-2026-10-10.md` in the form items 4 to 8 use.

**Decisions (human, 2026-10-11):**
- Trigger: a change needs the checks list when it touches `packages/web/`, `packages/core/`, `packages/contracts/` or a committed data file the page loads, unless the spec states why the page cannot change.
- Scope: both `bmad-build` and `bmad-build-auto` carry the rule. In an unattended run, a check that cannot run, or a failure that cannot be fixed, HALTs `blocked` with a stated condition.

## Boundaries & Constraints

**Always:** Keep the rule in `_bmad/custom/*.toml` (the item 8 pattern). Keep the existing accept step and impeccable offer. Follow the AGENTS.md agent-browser rules (named session via `--session <id>` on each call, `pnpm dev` in the background, `pnpm dev:stop` at the end). Comments obey the AGENTS.md three-line rule.

**Never:** Edit the installed skill under `~/.claude/plugins/` or the rendered files under `_bmad/render/`. Edit `AGENT-WORKFLOW.md` (architect-owned, Review brief rule 2; item 8 already deferred its acceptance gap). Build a dev fixture dataset for unreachable states (retro open question; separate work). Edit an existing `deferred-work.md` entry.

</frozen-after-approval>

## Code Map

- `_bmad/custom/bmad-build.toml` -- `persistent_facts` (literal list; appends to the default) and `on_complete` (the item 8 accept step comes first). Step-04 already re-runs `## Verification` after a patch, so the fact only has to say that the browser list is part of it and must be re-run in full.
- `_bmad/custom/bmad-build-auto.toml` -- same `persistent_facts` key; its step-04 patch branch re-runs `## Verification` and HALTs `blocked` on an unfixable failure.
- `docs/stories/spec-4-1-the-dark-token-set-bundled-inter-and-the-sticky-header-bar.md:125-131,143-150` -- the reference form of the checks list and of the recorded results.
- `_bmad/scripts/render_skill.py` -- renders the customization into `_bmad/render/`; a fresh run proves the TOML parses and the text lands in the steps.
- `docs/stories/sprint-status.yaml` -- action item 9 `status: open`.
- `docs/stories/epic-4-retro-2026-10-10.md` -- item 9 under *Action items*.

## Tasks & Acceptance

**Execution:**
- [x] `_bmad/custom/bmad-build.toml` -- add the persistent fact (rules 1-3) and prepend the record check to the accept step in `on_complete` -- the rule must be in context from planning to accept.
- [x] `_bmad/custom/bmad-build-auto.toml` -- add the same persistent fact, worded for an unattended run (a check that cannot run blocks with a stated condition)
- [x] `docs/stories/sprint-status.yaml` -- action item 9 to `done`, update `last_updated`.
- [x] `docs/stories/epic-4-retro-2026-10-10.md` -- status note on item 9.

**Acceptance Criteria:**
- Given the edited TOML, when `render_skill.py` runs for bmad-build, then it succeeds and the rendered `workflow.md` persistent facts and `step-05-present.md` / `step-oneshot.md` On Complete carry the new text.
- Given a run whose spec has an Agent browser checks list and a review patch, when the run reaches the accept step with no `### Agent browser checks (after review)` record after that patch, then the agent runs the checks before asking to accept.
- Given a change outside the trigger (for example, only `docs/` or `tools/`), when a spec is written, then no checks list is required.

## Implementation Notes

- The rule lives once in `_bmad/custom/prompts/agent-browser-checks.md`. Both skills load it with a `file:` persistent fact. bmad-build-auto adds one literal fact for unattended HALTs. Each skill has an `on_complete` record check. In bmad-build it sits between the impeccable offer and the accept step. Rendered with `render_skill.py`: the `file:` entry is in each `workflow.md`, the record check is in bmad-build `step-05-present.md` and `step-oneshot.md` and in bmad-build-auto `workflow.md`. `_bmad/render/` is gitignored.
- No agent browser checks list: this change touches only `_bmad/custom/` and `docs/`, outside the trigger.

## Spec Change Log

## Review Triage Log

### 2026-10-11 — Review pass

Layers: Blind Hunter, Edge Case Hunter, Verification Gap (no gaps: instruction text only; both TOMLs parse), Deferred Ledger Audit (zero findings). Impeccable skipped: no `packages/web/src/` file.

- medium, patch — the same rule was copied into both TOMLs and the copies already drifted. Fixed: one `_bmad/custom/prompts/agent-browser-checks.md`, loaded by a `file:` fact in both skills; only the unattended clause stays literal in bmad-build-auto.
- medium, patch — the record had no time or commit, so "later than the last fix" could not be checked, and spec-4-1's pre-review heading differs. Fixed: the record names the time, HEAD and dirty state; only the after-review heading satisfies the gate.
- medium, patch — the accept-step record check fixed code after review, never committed the fix or the record, and was skipped when `{story_key}` was unset. Fixed: a separate record check runs for every spec, commits only the spec record on a pass, and on a failure sets the spec back to `in-review`, keeps the key at `review` and sends the user back to bmad-build.
- medium, patch — a diff on a trigger path with no list and no exception passed the backstop silently. Fixed: the record check writes the list first.
- medium, patch — a oneshot spec has no `## Verification`, so the list had no home. Fixed: a oneshot spec puts it under Implementation Notes.
- medium, patch — a HALT after `pnpm dev` leaked Vite on the port, and parallel sweep worktrees collide on 5173. Fixed: `pnpm dev:stop` before any HALT or hand-back; `--port <n>` when 5173 is taken.
- medium, patch — bmad-build-auto had no end-of-run backstop. Fixed: its own `on_complete` record check, HALT `blocked` on failure.
- low, patch — an impeccable polish after the record could change the page unchecked. Fixed: the impeccable offer now comes before the record check, and the record must be later than any polish.
- low, patch — "a committed data file that the page loads" named no path. Fixed: `data/`.
- low, patch — `last_updated` was a placeholder time. Fixed.
- low, reject — the trigger misses root dependency bumps and shared config. Human ruling (2026-10-11): these files stay out of scope, because a browser check needs something specific to see on the rendered page. The deferred entry was cancelled.
- false — an interactive run with an unfixable check loops forever: step-04 already HALTs and escalates when `## Verification` fails, and the list is part of it.
- false — the action item and retro note say `done` before review ends: nothing is committed until step-05, which sets the spec to `done` first (the item 8 pattern).
- low, reject — screenshot paths live in a temp scratchpad; the written result is the evidence, as in spec-4-1, and a lasting store adds machinery for no named reader.
- low, reject — the Verification section greps nothing for the behavioural ACs: the fix edits this build's spec. Renders were grepped by the implementer and re-run in this pass.
- low, reject — the `file:` fact is not inlined by the render: the rendered workflow.md Step 2 tells the agent to load `file:` entries as facts at activation.

## Verification

**Commands:**
- `uv run --no-cache _bmad/scripts/render_skill.py --project-root <root> --skill <bmad-build skill dir>` -- expected: prints one workflow.md path; grep of the render shows the new fact and the gated accept step.
- `pnpm check` -- expected: passes.
