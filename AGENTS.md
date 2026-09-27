<!-- bmad:context -->
<!-- Verified 2026-09-26 against a6b67c9. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## poe-crafting-base-price-checker

A crafting base price checker for Path of Exile. The repository is a pnpm workspace of four packages. The stack is TypeScript, React 19, Vite, Mantine v9, Zod, Vitest and MSW. The product contains no Python. Planning documents are in `docs/`.

## Policy

- Use the agent-browser skill for all browser work during development. This includes tests in a browser, screenshots, UI checks and exploratory QA. Do not use claude-in-chrome. Do not use other browser automation.

## Where things are

- Architecture spine, which holds the canonical stack versions: `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md`
- Story specs, their reviews, `sprint-status.yaml` and `deferred-work.md`: `docs/stories/`. A story or review appends to `deferred-work.md` and does not rewrite other entries. Remove an entry in the last commit of the branch that lands its work, or in a commit that names the decision to cancel it.
- Mantine documentation for agents: https://mantine.dev/llms.txt
- UX design system: `docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/DESIGN.md`. impeccable finds only `PROJECT_ROOT/DESIGN.md`. Give `--target <path>` to use this file.

## Running and verifying

- Run Python scripts with `uv run script.py`. Do not run bare `python`.
- Browser work needs a named session. Run `agent-browser session id --scope worktree --prefix poe`. Put the printed id before each subcommand: `agent-browser --session <id> open <url>`. The unnamed default session is one browser for every agent on this machine.
- The agent-browser documentation sets that id with `export AGENT_BROWSER_SESSION="$(...)"`. Do not use that form. Shell state does not carry between tool calls, so the variable is empty in the next call and agent-browser falls back to the shared default session. Pass `--session <id>` on each call.
- `pnpm dev` binds port 5173 with `strictPort`. A taken port gives a loud bind failure, and Vite does not move to the next port. To use a different port, run `pnpm dev --port <n>`. Do not edit `packages/web/vite.config.ts`.
- `pnpm dev` runs until you stop it. Start it with the background facility of your runtime. The repository ships no supervisor.
- Stop it with `pnpm dev:stop`, and give `--port <n>` if you started it on another port. Run this even after you stop the background task. On Windows, a task stop kills only the top process, and Vite keeps the port. `pnpm dev:stop` kills the whole `pnpm dev` process tree and exits 1 if the port stays taken. It refuses a listener that is not the Vite of this checkout, for example the server of another worktree.

## Conventions that differ from defaults

- The UI uses Mantine v9 (`@mantine/core`, `@mantine/hooks`) at version 9.6.1, which the Stack table of the architecture spine pins. Do not install a different major version.
- A test setup blocks the network with an MSW `onUnhandledRequest` callback. The callback records the URL and throws. A global `afterEach` then fails the test and names each escaped URL. Copy `test/setup.ts`. The `"error"` string does not fail a test. Do not substitute that string for the callback.
- Use a connected MCP tool, not Read, Grep or Edit, when the tool does the task above the text level. Examples are symbol lookup, references, implementations, renames, symbol-body edits and diagnostics. MCP tools start deferred, so load them with ToolSearch before the first call. When a server's instructions name a first call, such as Serena `initial_instructions`, make that call before any other tool of that server. Use Read, Grep and Edit for docs, YAML, JSON and config.

## Known pitfalls

- A new package needs three edits, not one. Add its `workspace:*` dependencies. Add its entry to `ALLOWED_EDGES` in `test/contracts-isolation.test.ts`. Add its tsconfig `references`. TypeScript gives no diagnostic for a missing reference (microsoft/TypeScript#43770). The fault shows as `TS2307` at the importer, and only on a clean checkout.
- Each planning fact has one owner document. Write the fact there. Cite it elsewhere by stable id (`FR-n`, `AD-n`, `OQ-n`, companion `§n`). Do not restate the text of the owner. A citation stays correct when the source changes, and a copy drifts without a signal. The owners are:
  - `prd.md` owns what the player gets, and why. This covers capabilities, player-observable behavior, scope, risks and metrics. It also covers product-owned numbers, such as top 20 and the 0.25 Divine default. It also covers the literal strings the UI prints (reason enums). `prd.md` owns no mechanism. It holds no formulas, predicates, field names, file paths, schema versions, filter shapes or revision narrative. The EV formula of FR-1 is the one exception.
  - `ARCHITECTURE-SPINE.md` owns decisions (ADs) and the open questions of the spine. `IMPLEMENTATION-NOTES.md` owns formulas, predicates, report field identifiers and error payloads. `WEIGHTS-FILE-SCHEMA.md` owns the weights contract and its version. `AGENT-WORKFLOW.md` owns command-level rules. UX `EXPERIENCE.md` owns view treatments. The PRD keeps the requirement, and UX owns the appearance.
  - Write rationale and rejected alternatives in `addendum.md` of the PRD. Write revision history in `.memlog.md` and in git. Do not write revision history into a document body.
  - A spine change needs a PRD edit only when one of five things changes. Those five are a capability, player-visible behavior, a scope boundary, a product-owned number, and the owner of an OQ. A retired-id retarget follows the Retired AD map of the spine. Such a retarget is a citation sweep, not a PRD revision.
  - A review that asks you to add mechanism to the PRD is a finding against the brief of the reviewer. Propose the citation instead.
  Observed 2026-09-19: ten of twelve PRD revisions propagated spine changes into copied mechanism. About 79% of the approximately 407 normative rules of the PRD duplicated the spine or a companion.
- `PRODUCT.md` is a distillation of `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md`. It is not an independent source. Refresh `PRODUCT.md` when the user, positioning or constraint facts of the PRD change. No tool detects drift between the two files.

<!-- /bmad:context -->

<!-- OPENWIKI:START -->

## OpenWiki

This repository has a generated `openwiki/` evidence index. It is optional just-in-time context, not required startup reading.

- Do not enumerate, preload, or search wikis at task start. Use retrieval when the user asks for it, when unfamiliar architecture or dependency behavior materially affects the task, or when source inspection leaves an important uncertainty. Stop once the question is grounded.
- When those conditions apply and OpenWiki retrieval tools are available, use `openwiki_search` for just-in-time context and `openwiki_read` for the relevant complete sections. If search returns `workspace_required`, ask which listed workspace to use and retry with its ID.
- Use `openwiki_list_workspaces` or `openwiki_list_wikis` when workspace membership itself needs to be discovered.
- If the retrieval tools are unavailable, read `openwiki/quickstart.md` and follow its links to the relevant pages.
- Treat source code and tests as authoritative. A brief's unknowns and review items are verification gaps, not automatic requirements.
- Prefer the narrowest quiet validation that proves the changed behavior. Preserve complete failure output.

The scheduled OpenWiki GitHub Actions workflow refreshes the repository wiki. Do not hand-edit generated OpenWiki pages unless explicitly asked; prefer updating source code/docs and letting OpenWiki regenerate.

<!-- OPENWIKI:END -->
