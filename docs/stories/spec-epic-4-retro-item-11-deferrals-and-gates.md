---
title: 'Epic 4 retro item 11: testable deferrals, CSS comment runs, a blocking typecheck-on-stop, no split question'
type: 'chore'
created: '2026-10-11'
status: 'done'
baseline_commit: 'ce1186585cf58e2fbf2448338fe04baa0dd3000c'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/stories/epic-4-retro-2026-10-10.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Four process gaps from the epic 4 retro (item 11). (1) A deferred entry can carry a `retry_when` tied to a future planning event, so the sweep never fires (L2). (2) The three-line comment-run limit covers TS but not CSS (A6). (3) typecheck-on-stop fires on the orchestrator while a background subagent still edits (L5), and a slow `tsc -b` hits the 30 s `run()` timeout, which rejects and exits 1, so type errors pass (R5). (4) bmad-build asks on every story whether to split a spec over the token guideline, and the answer is always "Keep full spec" (L3).

**Approach:**
1. Deferrals: a `retry_when` is absent (eligible now) or one of the three sweep forms. The `Story <n.n>` form must name a story key in `sprint-status.yaml`. A test over the real ledger enforces it. The bmad-build defer rules say so.
2. CSS comment runs: Decision (human, 2026-10-11): extend the lint. Add `@eslint/css` (exact pin) as a devDependency and apply `local/max-comment-run` (maxLines 3) to `packages/**/*.css` through that language. `pnpm lint` and lint-on-edit (which then accepts `.css`) both catch a run. Add its row to the spine Stack table.
3. typecheck-on-stop exits 0 when the Stop payload's `background_tasks` holds a `subagent` entry. `tsc -b` gets its own budget below the hook timeout, and a timeout is a blocking report, not a crash. The real `tsc -b` path gets a test.
4. A bmad-build persistent fact makes "Keep full spec" the standing answer to the step-02 token gate.
5. Set action item 11 to `done` and add a status note to retro item 11.

## Boundaries & Constraints

**Always:** Keep the repeat-stop rule (a repeat stop never blocks). Keep the hooks runnable by bare `node` (builtins and `.ts` siblings only). Keep the three sweep forms word for word as `.claude/skills/deferred-work-sweep/SKILL.md` §5.2 states them. Edits to `_bmad/custom/*.toml` only, never the plugin cache.

**Never:** Change existing ledger entries. Change the multi-goal question in step 01, or bmad-build-auto (it already only warns). Add a `story:` field to the ledger format.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Testable retry | `retry_when: Story 4.7 is done in sprint-status.yaml`, key `4-7-…` exists | no problem | N/A |
| Unknown story | `Story 9.9 is done in sprint-status.yaml`, no `9-9-` key | problem names the entry and the missing story | test fails |
| Planning event | `retry_when: after the restyle stories` | problem names the entry, lists the three forms | test fails |
| Absent / never / sha | no `retry_when`; `never — needs a human`; `master has moved past <40-hex sha>` | no problem | N/A |
| Subagent running | Stop stdin `background_tasks: [{type:'subagent',…}]`, TS files changed | `{code:0, report:''}`, typecheck not run | N/A |
| Shell task only | `background_tasks: [{type:'shell'}]` | typechecks as today | N/A |
| Typecheck timeout | `tsc -b` exceeds its budget, first stop | code 2, report says `tsc -b` did not finish within N s and to run `pnpm typecheck` | repeat stop: code 1 |
| Real tsc | temp project with a TS2322 error | `realTypecheck` returns text with `TS2322`; clean project returns `''` | N/A |

</frozen-after-approval>

## Code Map

- `tools/deferred-issues/ledger.ts` -- `parseLedger`, `LedgerEntry.retryWhen`. Add an exported `retryWhenProblem(entry, storyKeys)` here or in a sibling `ledger-rules.ts`.
- `tools/deferred-issues/ledger.test.ts` -- unit pattern to follow. New test reads the real `docs/stories/deferred-work.md` and `docs/stories/sprint-status.yaml` (key lines match `^  (\d+)-(\d+)-`; no YAML dependency).
- `docs/stories/deferred-work.md` -- header paragraph and the comment's `retry_when` rule: change "optional and human-written" to the testable-forms rule, with "never a future planning event (epic 4 retro L2)". Do not touch entries.
- `_bmad/custom/bmad-build.toml` -- `persistent_facts` (add a deferral fact and the token-gate fact). `deferred-ledger-audit` instruction step 5 format line: add optional `retry_when` in a sweep form.
- `tools/lint-on-edit/typecheck-on-stop.ts` -- `runStopHook`, `realTypecheck`, `isRepeatStop` (pattern for the payload parse). `run()` in `lint-on-edit.ts:69` takes the fixed `TIMEOUT_MS` and rejects on a kill: add an optional timeout parameter, and have `realTypecheck` turn a killed run into the timeout report.
- `tools/lint-on-edit/typecheck-on-stop.test.ts` -- add the matrix rows. The real-tsc test makes a temp project and passes the repo's `node_modules/typescript/bin/tsc`, so `realTypecheck` needs the tsc path and budget as parameters with today's defaults.
- `eslint.config.mjs:130` -- `local/max-comment-run` is on for TS files only (`files` at :55). CSS needs its own block with `language: 'css/css'`; keep TS rules off CSS.
- `tools/eslint-rules/max-comment-run.ts` -- uses `sourceCode.getAllComments()` on `Program:exit`. Make it work for the CSS source code too, without a runtime import.
- `.claude/settings.json` -- Stop hook `timeout: 60`. Budget: 100 s inside a 120 s hook timeout.
- `docs/architecture/.../AGENT-WORKFLOW.md:35` -- the typecheck-on-stop sentence: add the subagent skip and the blocking timeout.
- `docs/stories/sprint-status.yaml`, `docs/stories/epic-4-retro-2026-10-10.md` item 11 -- status, in the form items 5–8 use.

## Tasks & Acceptance

**Execution:**
- [x] `tools/deferred-issues/ledger-rules.ts` + test -- retry_when rule and real-ledger test -- L2 gate
- [x] `docs/stories/deferred-work.md` -- header and format-comment rule -- L2 rule text
- [x] `tools/lint-on-edit/lint-on-edit.ts`, `typecheck-on-stop.ts` + test -- subagent skip, timeout budget, real tsc test -- L5, R5
- [x] `.claude/settings.json` -- Stop timeout 120 -- room for the 100 s budget
- [x] `package.json`, `eslint.config.mjs`, `tools/eslint-rules/max-comment-run.ts` + test, `lint-on-edit.ts` (`TYPESCRIPT_FILE` gate) -- CSS through `@eslint/css`; the rule reads CSS comments (CSS root node, not `Program`) -- A6
- [x] `ARCHITECTURE-SPINE.md` Stack table -- `@eslint/css` row, revision bump and memlog row as the spine's existing pattern does -- canonical versions live there
- [x] `_bmad/custom/bmad-build.toml` -- deferral fact, token-gate fact, audit format line -- L2, L3
- [x] `AGENT-WORKFLOW.md:35` -- describe the new hook behavior -- the doc stays true
- [x] `sprint-status.yaml`, retro item 11 -- action item `done`, status note

**Acceptance Criteria:**
- Given a fresh `render_skill.py` run, when step-02 of bmad-build renders, then `workflow.md` carries the token-gate fact and the deferral fact.
- Given the current CSS files, when the CSS comment-run check runs, then it passes, and a 4-line CSS comment fails it.
- Given the current ledger, when `pnpm check` runs, then it passes.

## Implementation Notes

- `hasRunningSubagent` reads the Stop payload's `background_tasks`, whose entries carry `type: 'subagent'` for an in-flight subagent (Claude Code hooks reference, https://code.claude.com/docs/en/hooks, Stop input).
- `run()` in `lint-on-edit.ts` takes an options object `{ environment, timeoutMs }`; a fifth positional parameter broke `max-params`.
- `@eslint/css` 2.0.0 keeps comments off the AST and counts columns from 1; `max-comment-run` reads `sourceCode.comments` on `StyleSheet:exit`.

## Spec Change Log

## Review Triage Log

- medium — the `.d.ts` rewrite ran with the default 30 s timeout after a 100 s `tsc -b`, so the hook could pass the 120 s Stop timeout, and a killed rewrite exited 1 (Blind Hunter, Edge Case Hunter, Verification Gap). Patched: one deadline for both runs, a killed rewrite is a `TypecheckTimeout`, budget lowered for margin.
- low — a maxBuffer kill also sets `killed`, so it read as a timeout (Blind Hunter, Edge Case Hunter). Patched: that error code is excluded.
- medium — nothing tied `TYPECHECK_BUDGET_MS` to the settings.json Stop timeout (Verification Gap, Blind Hunter). Patched: a test reads settings.json.
- medium — the real eslint.config.mjs was never shown to lint CSS; deleting the CSS block passed every test (Verification Gap). Patched: a `lintText` test on a virtual `.css` file.
- low — the CSS RuleTester cases missed a directive comment and a two-run file (Blind Hunter). Patched.
- low — `SHA_FORM` demanded 40 hex, stricter than sweep §5.2 (Blind Hunter). Patched: 7–40 hex, "(the full sha)" dropped.
- low — `ledger-rules.ts` claimed bare-node use; `storyIds` doc claimed development_status scope (Blind Hunter). Patched: comment removed, doc and test name corrected.
- low — `LedgerEntry.retryWhen` JSDoc said "that a human wrote" (Blind Hunter). Patched.
- medium — AGENT-WORKFLOW.md copied the code-owned 100 s / 120 s numbers (Blind Hunter). Patched: behavior plus a `TYPECHECK_BUDGET_MS` citation.
- low — deferred-work-sweep SKILL.md still described free-form human-written `retry_when` (Blind Hunter). First deferred as an agent-context edit; the human ruled to fix it in this story. Patched: the entry definition and condition 6 name the step 5.2 forms and the ledger test.
- false — `background_tasks` is unverified (Blind Hunter, Verification Gap): the Claude Code hooks reference documents Stop's `background_tasks` with `type: 'subagent'` entries for in-flight tasks; cited in Implementation Notes.
- false — a finished subagent entry would skip forever (Edge Case Hunter): the reference lists only in-flight tasks in `background_tasks`.
- false — spec `in-review` while sprint-status reads `done` (Blind Hunter): the finalize step moves the spec to `done` in the same commit, as item 8 did.
- false — the render acceptance criterion has no check (Blind Hunter): a fresh render, `_bmad/render/bmad-build/retro-11-c944f748710b/e33ef0594d19b67dfaaf/workflow.md`, carries both facts.
- low, rejected — the real-ledger test can fail an unrelated branch when a story key is renamed (Blind Hunter): that is the gate working; keys are not renamed in practice.
- low, rejected — a `.css` file outside `packages/` is selected but matched by no config block (Edge Case Hunter): no such file exists, and ESLint passes it silently, which harms nothing.
- low, rejected — a `*.config.css` file would hit the `**/*.config.*` block (Edge Case Hunter): no such file exists.
- low, rejected — a lettered story key like `4-10b-` is not collected (Edge Case Hunter): sprint-status.yaml has none.

## Design Notes

Token-gate fact wording: "The human's standing answer to the step-02 token-count gate is Keep full spec (epic 4 retro L3). Do not ask; state the token count in CHECKPOINT 1."

Deferral fact wording: "Each deferred entry you append either has no `retry_when` or uses one of the three sweep forms. A `Story <n.n>` form names a story already in sprint-status.yaml. Never tie an entry to a future planning event (epic 4 retro L2)."

## Verification

**Commands:**
- `pnpm vitest run tools/deferred-issues tools/lint-on-edit` -- expected: pass
- `pnpm check` -- expected: pass
