# Review: Story 1.1 — The four-package workspace and the offline development loop

- **Reviewed:** `docs/stories/spec-1-1-the-four-package-workspace-and-the-offline-development-loop.md` (2,257 words, `review_loop_iteration: 0`, status `ready-for-dev`)
- **Date:** 2026-09-20
- **Lenses run:** adversarial, edge-case-hunter, structure, prose. Verification-gap was skipped — it applies to code, and no application source exists yet.
- **Brief:** whether the harness this story builds for the development agent is missing anything, or solves its problems non-optimally. Web verification was enabled.
- **Status:** findings only. Nothing in the repository was edited in producing this report.

---

## Summary

The pinned stack is sound. Every version in the spine's Structural Seed *Stack* table was checked against the npm registry — TypeScript 6.0.3, Vite 8.3.0, pnpm 12.5.1, ESLint 10.11.0, typescript-eslint 8.70.0, Vitest 5.0.1, MSW 2.15.0, jsdom 30.1.0, dependency-cruiser 18.4.0 and `@mantine/core` 9.6.1 all exist, and their engines and peer ranges are mutually satisfiable on Node 24.21.0. Vitest 5 peers `vite: ^6.4.0 || ^7.0.0 || ^8.0.0`; typescript-eslint 8.70.0 peers `typescript >=4.8.4 <6.1.0` and `eslint ^8.57.0 || ^9 || ^10`. The TypeScript 7 blockers the spine records are still real.

**The defects are in the mechanisms, not the numbers.** Four of the story's named mechanisms do not work as specified, and each one fails *green* — the loop reports success while the guarantee is absent. That is the worst failure mode for an unattended agent, and it is the through-line of this review:

1. `vitest.workspace.ts` does not exist in Vitest 5.
2. `onUnhandledRequest: "error"` does not fail a test.
3. `pnpm dev -- --port 5174` is not valid pnpm argument passing.
4. The boundary fixture cannot be cruised by "overriding only the directory".

A fifth, `jiti`, fails loudly rather than green but blocks the first clean install.

The design reasoning is not at fault. The no-supervisor argument, the strictPort argument and the decision that no acceptance criterion may depend on a running server are all correct and worth keeping. What is missing is that several of the concrete instruments chosen to carry those decisions behave differently from what the spec assumes.

---

## Acting on this: triage and ownership

Findings are sorted by what is needed to act, not by severity. The dividing line that matters is the `<frozen-after-approval>` block — it is human-owned, so a finding landing inside it is a renegotiation request, not an edit an agent may make.

### Tier 1 — green-failure bugs, editable sections

Fix before development starts. All four make `pnpm check` or `pnpm test` report success with the guarantee absent.

| Finding | Where | Editable? |
| --- | --- | --- |
| `vitest.workspace.ts` removed in Vitest 4 | Tasks line 76, Verification line 129 | Yes |
| Root guards (`test/`, `tools/`) get no Vitest project | Tasks lines 76, 86–87 | Yes |
| Fixture rules need a `makeRules(base)` factory | Tasks line 87, Design Notes line 122 | Yes |
| `jiti` missing for `eslint.config.ts` | Tasks line 74 + spine *Stack* table | Yes, plus a spine edit |

### Tier 2 — requires renegotiation of the frozen block

| Finding | Frozen text affected |
| --- | --- |
| MSW `"error"` string does not fail tests | Always bullet: `MSW runs in onUnhandledRequest: "error"` mode in every test setup |
| `pnpm dev -- --port` is wrong syntax | I/O matrix row *Dev server, second worktree* (also an editable AC at line 97) |
| `PORT` env override is unusable under the repo's own command policy | **Decided** bullet on `strictPort` and the `PORT` variable |
| Added devDependencies collide with the exactness rule | Always bullet: *Every installed version matches the Stack table exactly* |

The last one is the same shape as the `jsdom` precedent already recorded in the Spec Change Log: a needed package was added to the spine's *Stack* table so the frozen rule kept holding literally. `jiti`, `postcss` + `postcss-preset-mantine` + `postcss-simple-vars`, `@vitejs/plugin-react`, `@types/react` and `@types/react-dom` are candidates for the same treatment, or for an explicit statement that the placeholder shell uses none of them.

### Tier 3 — harness hygiene, editable

`.npmrc` (frozen-lockfile, engine-strict, manage-package-manager-versions), `engines.node` exact-versus-range, `.gitattributes`, the real `web` devDependency set, `IS_REACT_ACT_ENVIRONMENT` and `matchMedia` stubs, type-only depcruise edges, `sync:dry` exit code and output stream, offline-install coverage.

Note that the `.gitignore` task at line 88 is **already satisfied** by the committed `.gitignore`, which contains `node_modules/`, `dist/`, `build/`, `*.tsbuildinfo`, `coverage/`, `.vite/` and more. Only `.gitattributes` is genuinely absent.

### Tier 4 — editorial

Structure and prose passes, applied together. Roughly 9% shorter with no facts removed.

### Ripple effects

- **Spine:** adding packages to the *Stack* table is an architecture change and needs a spine revision.
- **PRD:** no edit needed. No capability, player-observable behaviour, scope boundary, product-owned number or OQ owner changes.
- **Deferred work:** anything carved out of the spec rather than fixed belongs in `docs/stories/deferred-work.md`, which is currently empty.

---

## Verified on this machine

Four findings were confirmed against the actual environment rather than left as hypotheses.

| Claim | What this machine shows |
| --- | --- |
| `engines.node` pinned to exactly `24.21.0` blocks agents | Local Node is **24.18.0**. This machine fails the pin today. |
| `packageManager` binds pnpm only under Corepack | Local pnpm is **12.4.1**, not the pinned 12.5.1. Corepack 0.35.0 is installed but is not managing it. |
| Windows autocrlf dirties the tree against the LF convention | `core.autocrlf=true` is set, no `.gitattributes` exists, and git emitted `warning: in the working copy of 'docs/epics.md', LF will be replaced by CRLF` during this session. |
| The `.gitignore` task | Already complete, including `*.tsbuildinfo`. |

---

## Adversarial lens — 18 findings

### 1. `vitest.workspace.ts` does not exist in Vitest 5

- **Location:** Tasks & Acceptance line 76; Verification line 129
- **Trigger:** The `workspace` option and the separate `vitest.workspace.ts` file were deprecated in Vitest 3.2 and removed outright in Vitest 4, replaced by `test.projects` inside the root config. The spec pins Vitest 5.0.1.
- **Fix:** Replace the bullet with a root `vitest.config.ts` declaring `test: { projects: ['packages/*', './vitest.root.config.ts'] }`, keeping `packages/*/vitest.config.ts` as the per-project configs the glob picks up. Delete every mention of `vitest.workspace.ts`.
- **Consequence:** The agent writes a file Vitest 5 silently ignores. `pnpm test` runs zero or only root-level tests while appearing green, and the acceptance criterion "four package suites plus the root guards pass" passes vacuously.
- **Evidence:** <https://vitest.dev/guide/projects>, <https://vitest.dev/blog/vitest-3-2.html>, <https://main.vitest.dev/guide/migration/>

### 2. `onUnhandledRequest: "error"` does not fail a test

- **Location:** Boundaries & Constraints (Always list); Tasks `test/setup.ts` line 77; I/O matrix row *Unfixtured request*
- **Trigger:** MSW's `error` policy rejects the *request*; it does not fail the *test*. An unawaited or fire-and-forget request — the exact shape a leaked network call takes — logs an error and the test still passes. Long-standing, still-open MSW behaviour.
- **Fix:** In `test/setup.ts`, pass a callback rather than the string: collect each unhandled request into a module-level array, and add a global `afterEach` that throws when the array is non-empty, naming every URL. Put the assertion mechanism in the frozen Always list so it cannot be silently downgraded back to the string form.
- **Consequence:** The one mechanism AGENT-WORKFLOW.md calls "the load-bearing property of the workflow" (AD-13) reports green while a request escapes to the live GGG API — precisely the failure this story exists to prevent, and invisible because the suite is green.
- **Evidence:** <https://github.com/mswjs/msw/issues/946>, <https://github.com/mswjs/msw/discussions/943>

### 3. `pnpm dev -- --port 5174` is the wrong syntax, and it is baked into an acceptance criterion

- **Location:** I/O matrix line 55 (frozen); AC line 97; Verification line 135
- **Trigger:** Since pnpm 7, `pnpm run <script>` forwards everything after the script name into the script's argv **including a literal `--`**. The command therefore hands Vite the argv `-- --port 5174`, and it passes through a second layer if the root `dev` script is `pnpm --filter web dev`, where pnpm 9 and 10 have documented `--` forwarding bugs.
- **Fix:** Change the matrix row, the AC and the Verification line to `pnpm dev --port 5174`. If the root script delegates, state in the task bullet that passthrough must be verified through both hops, or make `dev` a direct `vite --config packages/web/vite.config.ts` to remove the second hop.
- **Consequence:** The AC is unpassable as written, or passes by accident. The agent concludes the port override is broken and edits `vite.config.ts` — the tracked-file dirtying the design note exists to prevent.
- **Evidence:** <https://pnpm.io/cli/run>, <https://github.com/pnpm/pnpm/issues/3778>, <https://github.com/orgs/pnpm/discussions/8945>

### 4. `eslint.config.ts` requires `jiti`, which appears in no dependency list

- **Location:** Tasks line 74; root `package.json` bullet line 72
- **Trigger:** ESLint 10.11.0 declares `jiti` as an optional peerDependency. Without it installed, ESLint cannot load a TypeScript flat config and `pnpm check` fails at the lint step on a clean install. The spine's Stack table lists no `jiti`.
- **Fix:** Either add `jiti` to root devDependencies and to the Stack table (noting in the Spec Change Log that it is an ESLint-required companion, as `jsdom` was handled), or use `eslint.config.mjs` and drop the requirement.
- **Consequence:** `pnpm check` fails on the first clean install, and the agent — told versions must match the Stack table exactly — has no sanctioned way to add the missing package and stalls on the "stop and report" rule.
- **Evidence:** npm registry `eslint@10.11.0`, `peerDependenciesMeta: { jiti: { optional: true } }`

### 5. The boundary-check fixture cannot be cruised by "overriding only the directory"

- **Location:** Design Notes line 122; Tasks line 87
- **Trigger:** dependency-cruiser forbidden rules are path regexes (`^packages/core`, `^packages/sync`, …). Pointing the same rule set at `tools/boundary-check/` matches nothing, because the fixture's paths do not start with `packages/`. The test would assert a non-zero exit and get zero, or would have to mutate the rules — which defeats the entire "no copy" argument.
- **Fix:** Make the shared module export a factory parameterised by package root, so the real config calls `makeRules()` and the test calls `makeRules('tools/boundary-check/fixture')`. Assert that the rule *names* are identical between the two calls, so a `severity: "warn"` or a typo in the real config still fails the test. Alternatively, mirror the `packages/<name>/src` path shape inside the fixture and keep the rules verbatim.
- **Consequence:** The one test proving the graph is actually enforced returns a false green, and a real forbidden edge later ships because the rule was `warn` — the precise defect the design note says this test exists to catch.

### 6. No acceptance criterion covers either of the story's two named mechanisms

- **Location:** Acceptance Criteria lines 91–97
- **Trigger:** The Approach names `dependency-cruiser` and MSW as "the mechanisms that enforce the package graph and the zero-network rule", yet there is no AC for a forbidden edge failing `pnpm check` with the edge named, and none for an unfixtured request failing its test. Both appear only in the I/O matrix. Meanwhile three of the seven ACs concern the dev server, which the story itself says the loop must not depend on.
- **Fix:** Add two ACs. "Given the boundary fixture holding a `core`→`sync` import, when the boundary test runs, then it fails naming that edge, using the same rule module the shipped config loads." And "Given a test that issues an unhandled `fetch`, when `pnpm test` runs, then that test fails and the failure names the request URL."
- **Consequence:** A reviewer can mark the story done with the graph unenforced and the network guard non-functional, because nothing in the acceptance list asks.

### 7. `pnpm sync:dry` has a task and a Verification line but no acceptance criterion

- **Location:** Tasks line 84; Verification line 130
- **Trigger:** The stub is a frozen **Decided** item and part of AGENT-WORKFLOW.md's five-command loop, yet nothing in Acceptance asserts it exists and behaves.
- **Fix:** Add "Given a clean checkout, when `pnpm sync:dry` runs, then it prints 'not implemented yet' and exits non-zero."
- **Consequence:** The command name silently goes missing or exits 0, and Story 1.5 inherits a loop command that no longer matches the workflow document.

### 8. TypeScript project references do not enforce the dependency graph

- **Location:** Tasks line 73 ("so typecheck also holds the graph"); Design Notes line 109
- **Trigger:** Under pnpm workspaces, a sibling package resolves through the `node_modules` symlink to its declared types regardless of whether it appears in `references`. `tsc --build` errors only when the referenced output has not been built; in a fully built tree a forbidden import type-checks clean. The real second enforcement layer is pnpm's own resolution — a package that does not declare the workspace dependency cannot resolve it at all.
- **Fix:** Rewrite the claim: the graph is held by each `package.json` declaring only its allowed `workspace:*` dependencies, so an illegal import does not resolve, and by dependency-cruiser, which produces the named-edge failure. Project references buy incremental builds and declaration ordering, not enforcement. Also note that `composite: true` is incompatible with `noEmit`, so the typecheck step needs `emitDeclarationOnly` plus an `outDir`.
- **Consequence:** The agent believes two independent guards exist, relaxes one, and ships an unenforced graph — or burns a cycle discovering the `noEmit`/`composite` conflict with no guidance in the spec.

### 9. Sharing the depcruise rules between a `.cjs` config and an ESM test has an unstated module-format constraint

- **Location:** Tasks line 75; Design Notes line 122
- **Trigger:** If the root `package.json` is `"type": "module"` — likely, given `vite.config.ts` and ESM packages — a `.cjs` config cannot `require()` an ESM rules module, and a `.js` rules module *is* ESM. If the root is CJS, the Vitest test gets the rules only through CJS default-interop, so named exports depend on cjs-module-lexer. Neither direction is addressed.
- **Fix:** dependency-cruiser 18.4.0 supports `.mjs` config files. Specify `.dependency-cruiser.mjs` plus a `rules.mjs` shared module imported by both, and drop the `.cjs` extension from the task bullet.
- **Consequence:** The agent hits `ERR_REQUIRE_ESM` or a missing named export at the moment `pnpm check` is first wired, and resolves it by duplicating the rules — the exact failure the design note forbids.

### 10. "Every installed version matches the Stack table exactly" has no mechanical check

- **Location:** AC line 91; Boundaries; Tasks root `package.json`
- **Trigger:** Nothing pins how versions are written (exact versus caret), commits `pnpm-lock.yaml`, or asserts the installed tree against the table. A later `pnpm install` on a dirty lockfile can drift silently, and "inspected" is not an executable step.
- **Fix:** Write every devDependency as an exact version; commit `pnpm-lock.yaml`; add `.npmrc` with `frozen-lockfile=true`, or make the AC read `pnpm install --frozen-lockfile`; and add a root test that reads the Stack-table versions and asserts `pnpm list --depth 0 --json` matches, so the AC is machine-checkable.
- **Consequence:** Drift is undetectable, which matters more here than usual because the spine's TypeScript 7 upgrade trigger depends on two peer ranges staying exactly where they are.

### 11. Node and pnpm versions are declared but not enforced

- **Location:** Tasks line 72
- **Trigger:** `packageManager` takes effect only under Corepack or pnpm's `manage-package-manager-versions`; `engines` is advisory unless `engine-strict` is set. An agent on the wrong Node or pnpm gets a subtly different lockfile and a green run.
- **Fix:** Add `.npmrc` with `engine-strict=true` and `manage-package-manager-versions=true`, add `.nvmrc` or `use-node-version`, and decide deliberately whether `engines.node` is exactly `24.21.0` (which fails on 24.21.1) or a range.
- **Consequence:** Two parallel worktrees produce different lockfiles and different results from the same commands — the parallel-agent property the whole workflow rests on. Confirmed live: this machine runs Node 24.18.0 and pnpm 12.4.1.

### 12. A Mantine + React Vite app needs devDependencies the story says it does not need

- **Location:** Tasks lines 81–83 ("`jsdom` … is the only new devDependency")
- **Trigger:** A genuine Mantine v9 shell needs `postcss`, `postcss-preset-mantine` and `postcss-simple-vars` with a `postcss.config.cjs`, per Mantine's own Vite guide. A React Vite app normally needs `@vitejs/plugin-react` for the JSX transform and Fast Refresh, and strict TS 6 typechecking of `App.test.tsx` needs `@types/react` and `@types/react-dom`. None appear in the task list or the Stack table.
- **Fix:** Enumerate the actual `web` devDependency set and reconcile it with the "only new devDependency" sentence — either add them to the Stack table as `jsdom` was added, or state explicitly that the placeholder uses no Mantine styles and relies on esbuild's automatic JSX runtime, so no PostCSS and no React plugin are installed until Story 2.1.
- **Consequence:** The agent hits the "stop and report" rule with packages that are not on the list at all, and either stalls or quietly adds untracked dependencies that violate the Always clause.
- **Evidence:** <https://mantine.dev/guides/vite/>, <https://mantine.dev/styles/postcss-preset/>

### 13. The React 19 `act` mount test omits `IS_REACT_ACT_ENVIRONMENT`

- **Location:** Tasks line 83
- **Trigger:** `react-dom/client` rendering inside `act` under jsdom requires `globalThis.IS_REACT_ACT_ENVIRONMENT = true`, normally set by the Testing Library this task explicitly refuses to install. Without it React warns, and on some paths throws, that the update was not wrapped in `act`.
- **Fix:** The `web` setup file sets `globalThis.IS_REACT_ACT_ENVIRONMENT = true` and unmounts the root in a cleanup hook, since no Testing Library auto-cleanup exists.
- **Consequence:** The one test proving React, Vite and Mantine are genuinely exercised fails or emits noise on its first run, and the agent's likely fix is to install Testing Library — quietly reversing a documented decision.

### 14. `tools/boundary-check/` is outside lint and typecheck scope, including the real test file

- **Location:** Code Map line 66; Tasks lines 74 and 87
- **Trigger:** The fixture must be excluded from lint, typecheck and depcruise, but the *test* that cruises it lives in the same directory and is therefore also unlinted and untypechecked — a real source file with no quality gate, and one Vitest must still be configured to collect, which a `projects: ['packages/*']` glob would not do.
- **Fix:** Split the directory: `tools/boundary-check/boundary.test.ts` in scope for ESLint, tsconfig and the Vitest project list, and `tools/boundary-check/fixture/` excluded from all three by explicit named entries. Add the root Vitest project that picks up `tools/` and `test/`.
- **Consequence:** The boundary test and `test/no-network.test.ts` are never type-checked or collected. Both guards are silently absent from `pnpm test` while it reports success.

### 15. No formatter, so every agent turn produces gratuitous diff churn

- **Location:** Tasks & Acceptance, general; the Never list
- **Trigger:** The story installs lint but no formatter, no `.editorconfig`, and no `.gitattributes`. On Windows with `core.autocrlf` unmanaged, two agents in two worktrees reformat each other's files and CRLF/LF flips appear as whole-file diffs — against the epic's "files are UTF-8 without BOM, LF" convention and against the clean-`git status` AC.
- **Fix:** Either add a formatter with a `pnpm format:check` folded into `pnpm check`, plus `.editorconfig` and a `.gitattributes` enforcing LF — or add an explicit "Never: no formatter, decided out of scope" line with the reasoning, the way git hooks were handled.
- **Consequence:** Parallel worktrees conflict on whitespace, and the LF convention the epic declares has no enforcement anywhere in the repository. Confirmed live: `core.autocrlf=true`, no `.gitattributes`, and git already warned about an LF-to-CRLF rewrite this session.

### 16. `PORT` is a collision-prone variable, and the default lives only in prose

- **Location:** Boundaries **Decided** bullet; Tasks line 82
- **Trigger:** `PORT` is set by many host and CI environments for unrelated reasons. Combined with `strictPort: true`, an inherited value makes `pnpm dev` fail to bind naming a port nobody chose — and that failure looks exactly like the "another worktree holds it" case the design wants to be legible.
- **Fix:** Use a project-scoped variable such as `POE_DEV_PORT`, and have `vite.config.ts` log the resolved port together with its source (CLI, env var, or default 5173) at startup so the bind failure is self-explaining. Record 5173 in the task bullet rather than only in prose.
- **Consequence:** An agent gets a bind failure it cannot diagnose, concludes the dev server is broken, and edits the tracked config — the outcome the design note spends a paragraph preventing.

### 17. The `.gitignore` list omits `*.tsbuildinfo`, which project references guarantee will exist

- **Location:** Tasks line 88; AC line 97
- **Trigger:** `composite: true` writes `.tsbuildinfo` per project. If those are not ignored, `pnpm check` itself dirties the tree and the clean-`git status` AC fails for a reason unrelated to the dev server.
- **Fix:** Name the entries explicitly, and add a verification step: run `pnpm check` then `pnpm test`, then `git status` — clean.
- **Consequence:** The cleanliness AC fails intermittently and gets diagnosed against the wrong subsystem.
- **Note:** the committed `.gitignore` already covers all of these. The task line is stale rather than wrong.

### 18. `Implementation Notes` and `Review Triage Log` are empty headings

- **Location:** Lines 99–106
- **Trigger:** Two sections carry no content and no placeholder, so it is indistinguishable whether they were considered and left deliberately empty or simply skipped.
- **Fix:** Put `_None._` under each.
- **Consequence:** A later reader or tool treats missing content as lost content and re-derives decisions already made.

---

## Edge-case-hunter lens — 26 findings

Overlaps the adversarial lens on Vitest 5, the fixture regexes, the `--` hop, `IS_REACT_ACT_ENVIRONMENT` and the lockfile. That overlap is signal: two independent traces reached the same gaps.

```json
[
  {"location":"spec:76","trigger_condition":"Vitest 5 removed vitest.workspace.ts and defineWorkspace (dropped in v4)","guard_snippet":"vitest.config.ts at root: export default defineConfig({ test: { projects: ['packages/*/vitest.config.ts', './vitest.root.config.ts'] } })","potential_consequence":"Task prescribes a file the pinned Vitest ignores; no suite runs"},
  {"location":"spec:76,86-87,129","trigger_condition":"Root guards live outside packages/*, but projects are one-per-package","guard_snippet":"add a 'root' project covering test/**/*.test.ts and tools/boundary-check/**/*.test.ts","potential_consequence":"no-network and boundary tests never execute; pnpm test passes vacuously"},
  {"location":"spec:87,122","trigger_condition":"Shared rules' path regexes (^packages/<pkg>) never match the fixture tree","guard_snippet":"export makeRules({contractsGlob,coreGlob,...}) so the test parameterises paths, not only the cruised dir","potential_consequence":"Boundary test cannot fire the real rule; passes for the wrong reason"},
  {"location":"spec:87","trigger_condition":"Fixture imports resolve to nothing outside the pnpm workspace","guard_snippet":"assert the violation is reported by the named forbidden rule id, not by no-unresolvable","potential_consequence":"Non-zero exit comes from unresolvable modules; a severity:warn typo goes undetected"},
  {"location":"spec:75,87","trigger_condition":"Shared rules module must load from a .cjs config and a TS/ESM test","guard_snippet":"author rules as .cjs and import via createRequire in the test, or dual-publish","potential_consequence":"require/import format mismatch breaks either depcruise or its test"},
  {"location":"spec:66,87","trigger_condition":"Fixture tree excluded from lint/typecheck, so its own test is unchecked","guard_snippet":"include tools/** in eslint scope and a tsconfig, excluding only the fixture subtree","potential_consequence":"Boundary test rots untypechecked; failures surface only at runtime"},
  {"location":"spec:82","trigger_condition":"PORT empty string or non-numeric coerces to 0 or NaN","guard_snippet":"const p = Number(process.env.PORT); port: Number.isInteger(p) && p > 0 ? p : 5173","potential_consequence":"Port 0 binds a random free port; strictPort guarantee silently voided"},
  {"location":"spec:31,82","trigger_condition":"Repo policy forbids `export VAR=x` / `VAR=x cmd` single-line forms","guard_snippet":"document --port as the only supported override; note PORT is for non-agent use","potential_consequence":"Documented PORT mechanism is unusable by the agent it was written for"},
  {"location":"spec:55,72,82","trigger_condition":"Root `dev` delegates to a filtered child script; `--` forwards only one hop","guard_snippet":"root: \"dev\": \"pnpm --filter web exec vite\" so the port argument reaches vite","potential_consequence":"--port swallowed or parsed by pnpm; agent silently gets the default port"},
  {"location":"spec:134","trigger_condition":"Backgrounded Vite orphaned; TaskStop kills shell, not the node child","guard_snippet":"document a recovery step (kill the listener on the port) despite the no-supervisor rule","potential_consequence":"Worktree's dev port is permanently held with no sanctioned remedy"},
  {"location":"spec:53-55,96","trigger_condition":"pnpm dev run in a worktree where node_modules was never installed","guard_snippet":"matrix row: uninstalled worktree -> pnpm dev fails naming the missing install step","potential_consequence":"Opaque resolver error read as a port or config fault"},
  {"location":"spec:48-49,91-92","trigger_condition":"Offline `pnpm install` (fresh worktree, network down) has no row or AC","guard_snippet":"row: network down + warm store -> pnpm install --offline --frozen-lockfile succeeds","potential_consequence":"Agent loop's first command is undefined in the offline mode the epic promises"},
  {"location":"spec:72,91","trigger_condition":"No frozen-lockfile or exact-version pinning stated for install","guard_snippet":"save-exact=true in .npmrc; agent path uses pnpm install --frozen-lockfile","potential_consequence":"Later install drifts off the Stack table and dirties the lockfile"},
  {"location":"spec:72","trigger_condition":"engines.node pinned to exact 24.21.0; any patch bump mismatches","guard_snippet":"engines.node: \">=24.21.0 <25\" plus explicit engine-strict decision in .npmrc","potential_consequence":"Every agent on 24.21.1 is blocked, or the pin is never enforced at all"},
  {"location":"spec:72","trigger_condition":"packageManager field only binds pnpm when Corepack is enabled","guard_snippet":"preinstall guard asserting npm_config_user_agent matches pnpm/12.5.1","potential_consequence":"A different global pnpm rewrites the lockfile format unnoticed"},
  {"location":"spec:73,109","trigger_condition":"Project references require composite builds, not plain tsc --noEmit","guard_snippet":"check script runs `tsc -b` with composite:true and tsbuildinfo paths set","potential_consequence":"Typecheck fails on missing declarations, or silently stops holding the graph"},
  {"location":"spec:88,97","trigger_condition":"Composite build output untracked during the git-clean AC","guard_snippet":".gitignore: dist/, *.tsbuildinfo, coverage/, .vite/","potential_consequence":"git status dirty after check; AC fails for an unrelated reason"},
  {"location":"spec:88,97","trigger_condition":"Windows checkout with autocrlf rewrites LF files the conventions require","guard_snippet":".gitattributes: * text=auto eol=lf","potential_consequence":"Tree reads dirty on Windows; the clean-status AC is unmeetable"},
  {"location":"spec:83","trigger_condition":"react-dom act() without IS_REACT_ACT_ENVIRONMENT set true","guard_snippet":"globalThis.IS_REACT_ACT_ENVIRONMENT = true in the web test setup","potential_consequence":"Mount test throws or warns about an unconfigured test environment"},
  {"location":"spec:83","trigger_condition":"jsdom provides no matchMedia; MantineProvider reads it on mount","guard_snippet":"stub window.matchMedia (and ResizeObserver) in the jsdom setup file","potential_consequence":"Shell mount test fails on a missing DOM API, not on the shell"},
  {"location":"spec:52,77,86","trigger_condition":"MSW error mode rejects the request; a swallowed rejection still passes","guard_snippet":"onUnhandledRequest callback that records and throws, plus afterEach(server.resetHandlers)","potential_consequence":"Code catching fetch errors escapes the zero-network guard silently"},
  {"location":"spec:52,77","trigger_condition":"Non-HTTP escapes (WebSocket, raw node:net, child process) are uninterceptable","guard_snippet":"state the guard's scope: HTTP/XHR/fetch only; other transports are out of scope","potential_consequence":"NFR-1's 'zero network' is claimed broader than the mechanism delivers"},
  {"location":"spec:33,84,130","trigger_condition":"sync:dry stub exits non-zero inside a loop that treats non-zero as failure","guard_snippet":"reserve a distinct exit code and document it as not-yet-implemented","potential_consequence":"Unattended build loop reports the workspace red from day one"},
  {"location":"spec:84,130","trigger_condition":"Stub's output stream unspecified (stdout vs stderr)","guard_snippet":"print 'not implemented yet' to stderr and say so in Verification","potential_consequence":"Automation grepping stdout sees empty output and misclassifies the run"},
  {"location":"spec:50-51,71","trigger_condition":"Forbidden edges listed only for imports, not devDependency or type-only imports","guard_snippet":"depcruise rules set dependencyTypes and forbid type-only edges too","potential_consequence":"`import type` from web into sync passes both typecheck and depcruise"},
  {"location":"spec:54,96","trigger_condition":"Port held by a non-Vite process, or on an interface Vite binds differently","guard_snippet":"state host binding (server.host) so the AC's occupancy test is deterministic","potential_consequence":"Bind succeeds on a different interface; the loud-failure AC passes or fails by luck"}
]
```

The findings this lens contributes that the adversarial lens did not reach:

- **Root guards never run.** `test/no-network.test.ts` and the boundary test live outside `packages/*`, so a one-project-per-package configuration collects neither. Both guards absent, `pnpm test` green.
- **`PORT` empty or non-numeric coerces to 0**, and Vite then binds a random free port — voiding the strictPort guarantee entirely, in the one case the guarantee exists for.
- **`PORT` is unusable by the agent regardless**, because the repo's own command policy forbids `VAR=x cmd` and `export`. The documented override cannot be exercised by its intended user.
- **Offline `pnpm install` has no matrix row and no AC.** The epic promises an offline loop, but the loop's first command is undefined in that mode.
- **jsdom has no `matchMedia`**, which `MantineProvider` reads on mount. The mount test fails on a missing DOM API rather than on the shell.
- **The zero-network guard's scope is overclaimed.** MSW covers HTTP, XHR and fetch; WebSocket, raw `node:net` and child processes are uninterceptable. Worth stating so NFR-1 is not read as broader than its mechanism.
- **`sync:dry` exiting non-zero** collides with any unattended loop that reads non-zero as failure, and its output stream is unspecified.
- **Type-only edges** need `dependencyTypes` set, or `import type` from `web` into `sync` passes both gates.
- **An orphaned Vite process** has no sanctioned recovery under the no-supervisor rule.
- **An uninstalled worktree** produces an opaque resolver error that reads as a port or config fault.

---

## Editorial: structure lens

> Purpose read: this document exists to help a development agent, and the human approving its work, build the four-package workspace correctly the first time.
>
> Structure model: **Prompt/Task Definition (Functional)** — meta-first, instructions separated from rationale, explicit execution order. The BMad template fixes the section sequence, so findings judge placement *within* sections and redundancy *across* them, not the order itself.

| Pass | Original text | Revised text | Changes |
| --- | --- | --- | --- |
| structure | §Design Notes — lines 113–120 (~370 words) | CONDENSE to ~250 words | The dev-server decision is now stated four times: the frozen **Decided** bullets carry the rule, Design Notes the rationale, the Spec Change Log the narration, Verification the procedure. Each rationale paragraph re-opens with the rule before arguing it. Cut the restatements; keep only the reasoning the frozen block cannot carry — the tool-timeout mechanism, the `>`-redirection policy collision, and the wrong-worktree wrong-answer failure mode. Saves ~120 words |
| structure | §Tasks — `App.test.tsx` bullet, "No Testing Library:" through "it needs no server." (~55 words) | MOVE to §Design Notes | Premature detail inside an execution checklist: three sentences of justification interrupt a list the agent reads as deliverables. Every other bullet states an artifact and its shape. Leave the mechanics; move the argument beside the other rejected alternatives |
| structure | §Spec Change Log — "Also adds three I/O matrix rows…" through "…rewrites Verification's dev-server guidance." (~40 words) | CUT | True redundancy: enumerates content already visible in the sections it names, so it must be re-edited whenever those sections change. Keep what a reader cannot reconstruct — the gap that prompted the amendment, the human approval, the `jsdom` addition, the no-PRD-edit determination. Per the repo's ownership rule, revision narrative lives in git. Saves ~40 words |
| structure | §Verification — the dev-server block, three bullets (~95 words) | CONDENSE to two commands plus a cross-reference | Duplicates §Design Notes at the mechanism level: `run_in_background`, `TaskStop`, "do not edit `vite.config.ts`" and the leaked-process consequence all appear in both. Keep the leaked-port warning — it is a live operational hazard, not rationale. Saves ~45 words |
| structure | §Tasks — `.dependency-cruiser.cjs` trailing clause | CONDENSE to "rules defined in a shared module (see §Design Notes)" | The same rationale is argued at full length in Design Notes. The task bullet needs only the structural fact. Saves ~10 words |
| structure | §Implementation Notes and §Review Triage Log — both empty | PRESERVE, add "None yet." to each | Template-fixed, so their position is not the author's choice — but two consecutive bare headings read as truncation or a lost paste, and they split Tasks from the Design Notes that explain those tasks. Adds ~6 words |
| structure | §Code Map — last two bullets | QUESTION | These are prohibitions, not a map of where code lives; they read as §Boundaries "Never" content. The correct home is inside the frozen block, so this cannot be fixed without renegotiation. Leaving them is defensible, since both concern existing files the agent will touch |
| structure | §Boundaries — the four **Decided** bullets (~200 of 377 words) | PRESERVE (frozen), noted | Each carries rule plus rationale, and that rationale is re-argued in Design Notes. Normally a MERGE — rule here, argument there. Frozen and human-owned, so this is an observation for the next renegotiation. If the Design Notes condense is accepted, the overlap shrinks from the other side |
| structure | §Intent (86 words), §I/O & Edge-Case Matrix (242 words) | PRESERVE | Front-loading works: problem, approach, then the testable behaviour table before any file names. The matrix is the highest-density section and earns every row, including the three dev-server rows — the only place those behaviours are stated as verifiable outcomes rather than argued |
| structure | Whole document — pacing | PRESERVE | Short Intent, scannable bullet blocks, one table for breathing room, bolded lead sentences that let a reader skim the argument structure. No recommendation above removes a visual aid or an orientation cue |

**Summary:** 10 recommendations — 1 CUT, 1 MOVE, 3 CONDENSE, 1 QUESTION, 4 PRESERVE. Estimated reduction if all accepted: ~215 words removed, ~6 added, net ~209 of 2,257, or **about 9%**, concentrated in §Design Notes (~120), §Verification (~45) and §Spec Change Log (~40). No length target was provided.

**Comprehension trade-off:** none of the cuts removes a fact. The one risk is the Verification condense — an agent reading only that section loses the inline reminder of *why* foregrounding `pnpm dev` is fatal. If that section is read standalone mid-task, keep one clause ("it blocks the turn until the tool timeout kills it") rather than a bare pointer.

**Note for the human:** the document's single real shape problem — rule and rationale for the dev-server decision living in two places at near-equal length — straddles the frozen boundary. The author can only fix the Design Notes half.

---

## Editorial: prose lens

Style noted and preserved: terse declarative spec voice; bolded lead-in sentences as topic markers in Design Notes; italics for emphasis; inline code for every command, path and identifier; Given/when/then acceptance grammar; deliberate reasoning-with-rejected-alternatives passages.

| Pass | Original text | Revised text | Changes |
| --- | --- | --- | --- |
| prose | §Code Map — "Greenfield — no application source exists. Everything below is new." | "Greenfield — no application source exists. Everything this story creates is new; the entries below are the documents it reads and the files it extends." | "Everything below is new" contradicts the bullets that follow, three of which describe files that already exist. A reader acting on the lead-in edits the wrong things |
| prose | §Design Notes — "Typecheck and `dependency-cruiser` both express the graph deliberately: project references catch a bad edge at build time, depcruise produces the named-edge failure the AC requires." | "Typecheck and `dependency-cruiser` both express the graph, and the duplication is deliberate: project references catch a bad edge at build time, while depcruise produces the named-edge failure the AC requires." | The point is that the redundancy is intentional, but "deliberately" attaches to "express" and hides it; a reader can finish the sentence thinking one mechanism is redundant |
| prose | §Design Notes — "blocks its own turn until its tool timeout kills the server" | "blocks its own turn until the tool timeout kills the server" | Three pronouns with two antecedents in one clause. Dropping the third possessive removes the ambiguity without losing the ownership |
| prose | §Tasks (relocated by the structure pass) — "No Testing Library: … Story 2.1 can add an assertion library when it has a UI worth querying." | "Testing Library is deliberately not used: … Story 2.1 can add an assertion library once there is a UI worth querying." | The bare label reads as a heading rather than a claim, and standing alone in §Design Notes it loses the bullet that made it parse. "it" has no workable antecedent — a story does not have a UI |
| prose | "behaviour" (§Design Notes, §Spec Change Log) | "behavior" | Microsoft Writing Style Guide is US English, and the document's own I/O matrix header already uses "Behavior" |
| prose | "typecheck, lint and depcruise" (two locations); "detached spawn, output capture and kill" | Add the serial comma | Microsoft style requires the Oxford comma. Applied to the four editable occurrences; frozen-block instances need renegotiation for consistency |
| prose | §Spec Change Log — "Human-approved amendment to the frozen block adds three decisions:" | "A human-approved amendment to the frozen block adds three decisions:" | Missing article. The headless noun phrase reads as a log tag rather than the sentence subject it is |
| prose | §Design Notes — "so \"just add a log file\" is not a smaller option than the whole supervisor." | "so adding only a log file is no smaller a change than the whole supervisor." | The scare-quoted fragment is compared to a noun it does not grammatically match, stalling the sentence exactly where the rejection argument lands |
| prose | §Design Notes — "carries a typo'd module name" | "carries a mistyped module name" | "typo'd" is nonstandard and the apostrophe form is not in Microsoft style |
| prose | §Verification — "expected: four package suites plus the root guards pass" | "expected: all four package suites plus the root guards pass" | "four package suites" invites a momentary parse as "four-package suites", which this workspace makes plausible |
| prose | §Tasks — "CLI `--port` still wins." | "a CLI `--port` argument overrides both." | Consider: "still wins" leaves the losing side implicit, and the precedence order is the one thing a reader consults this bullet for |

**Frozen block — noted only, requires human renegotiation:**

- §Boundaries, `web` shell bullet: "A jsdom render test, not `pnpm dev`, is what proves the shell mounts" is a cleft that delays the verb; "…proves the shell mounts" says the same in six fewer words. Low impact.
- §I/O matrix, `contracts` isolation row: "Boundary rule forbids the import too" is missing its article; the other cells in that column are full clauses.
- §I/O matrix, second-worktree row: the parenthetical "(a single literal command, per the repo's command policy)" is longer than the command it annotates and is the only cell carrying a policy citation. It belongs in §Boundaries or a footnote if the block is reopened.

**Summary:** 11 prose recommendations plus 3 frozen-block notes. Net change roughly −10 words, under 0.5% of the document — these are comprehension fixes, not trims. No comprehension trade-offs; nothing removes an example, a rationale or a warning. The two highest-impact rows are the §Code Map lead-in contradiction and the "deliberately" sentence, both of which can cause a reader to act on a wrong understanding rather than merely slow them down.

---

## Sources

- [Vitest — Test Projects](https://vitest.dev/guide/projects)
- [Vitest 3.2 release notes — workspace deprecation](https://vitest.dev/blog/vitest-3-2.html)
- [Vitest migration guide](https://main.vitest.dev/guide/migration/)
- [MSW issue #946 — `onUnhandledRequest: "error"` does not fail tests](https://github.com/mswjs/msw/issues/946)
- [MSW discussion #943](https://github.com/mswjs/msw/discussions/943)
- [pnpm run CLI documentation](https://pnpm.io/cli/run)
- [pnpm issue #3778 — running scripts without `--`](https://github.com/pnpm/pnpm/issues/3778)
- [pnpm 10 argument-forwarding discussion](https://github.com/orgs/pnpm/discussions/8945)
- [Mantine — usage with Vite](https://mantine.dev/guides/vite/)
- [Mantine PostCSS preset](https://mantine.dev/styles/postcss-preset/)
- npm registry metadata for `vitest@5.0.1`, `vite@8.3.0`, `typescript@6.0.3`, `typescript@7.0.2`, `pnpm@12.5.1`, `eslint@10.11.0`, `typescript-eslint@8.70.0`, `dependency-cruiser@18.4.0`, `jsdom@30.1.0`, `msw@2.15.0`, `@mantine/core@9.6.1`

---

# Triage outcome — 2026-09-20

This section is the spec's change log and triage record, held here rather than in
`spec-1-1-the-four-package-workspace-and-the-offline-development-loop.md` so the spec stays
close to the size an implementation agent can hold. The spec points here. Append-only.

Every finding acted on below was re-verified against shipped package source, the npm registry,
or a live run before the spec was amended — the review's own citations were not taken on trust.

## Spec Change Log

- **2026-09-20 — dev-server observability.** *(Predates this review; carried over from the spec.)* The spec named `pnpm dev` in the agent loop but gave the agent no way to run it without blocking, no knowable URL, and no stated owner for stopping it. A human-approved amendment to the frozen block adds three decisions: no acceptance criterion depends on a running server (a jsdom mount test proves the shell instead); `pnpm dev` uses `strictPort` with a command-line port override; the project ships no supervisor, because backgrounding, output capture and kill belong to the agent's runtime. The mount test needs a DOM environment, so `jsdom` 30.1.0 was added to the spine's Structural Seed *Stack* table — the frozen "matches the Stack table exactly" rule therefore still holds literally. No PRD edit.

- **2026-09-20 — mechanisms that failed green.** This review found that four named mechanisms did not behave as the spec assumed, each reporting success while its guarantee was absent. Three required a human-approved frozen-block amendment.
  - **MSW.** `onUnhandledRequest: "error"` throws inside request interception and never calls a test-runner failure hook, so a floating or swallowed request leaves the suite green — defeating AD-13, which `AGENT-WORKFLOW.md` calls the load-bearing property of the workflow. The frozen Always bullet now names the callback-plus-`afterEach` assertion instead of the mode string, so it cannot be silently downgraded. `docs/epics.md` was corrected in the same change, because it restated the same wrong mechanism.
  - **Port syntax.** `pnpm dev -- --port 5174` passes a literal `--` into argv on pnpm 12 (verified by running it). The frozen matrix row now reads `pnpm dev --port 5174`. Delegation through `pnpm --filter web dev` was tested and forwards arguments correctly, so the root script keeps its shape.
  - **`PORT` environment variable.** The repo's own command policy forbids `VAR=x cmd` and `export`, making the documented override unusable by the agent it was written for; an empty or non-numeric value also coerces to 0, which makes Vite bind a random port and voids the `strictPort` guarantee outright. The frozen Decided bullet is now CLI-only with a 5173 default.
  - **`vitest.workspace.ts`.** Removed in Vitest 4 and absent from the shipped Vitest 5 code, so the file is ignored rather than erroring — `pnpm test` would have run nothing while passing. Replaced by `test.projects`, with an inline project added because `packages/*` collects neither root guard.
  - **Additions.** `@types/react` and `@types/react-dom` 19.3.0 were added to the spine's *Stack* table, following the `jsdom` precedent. `jiti` was avoided rather than added by using `eslint.config.mjs`. PostCSS and `@vitejs/plugin-react` were investigated and found **not** required — Mantine 9.6.1 ships pre-built CSS, and the plugin only supplies HMR.
  - **KEEP.** The no-supervisor argument, the `strictPort` argument, and the rule that no acceptance criterion may depend on a running server were all upheld by the review and must survive any re-derivation.
  - No PRD edit: no capability, player-visible behavior, scope boundary, product-owned number or OQ owner changed.

## Review Triage Log

**2026-09-20 — specification review** (adversarial, edge-case-hunter, structure, prose).
18 + 26 findings triaged. Counts: 11 confirmed and patched, 5 refuted, 3 already satisfied,
the remainder editorial.

| Finding | Verdict | Action / evidence |
|---|---|---|
| `vitest.workspace.ts` dead in Vitest 5 | Confirmed | Zero occurrences in the shipped 5.0.1 tarball — ignored, not an error. Replaced with `test.projects` |
| Root guards get no project | Confirmed | Inline project added for `test/` and `tools/` |
| MSW `"error"` does not fail tests | Confirmed | Read from `msw@2.15.0` source. Frozen block + `docs/epics.md` amended. Callback print key is `warning`, and a custom callback also receives static-asset requests, so it must filter |
| `pnpm dev -- --port` wrong | Confirmed | Live run: argv `["--","--port","5174"]`. Frozen row corrected |
| Second delegation hop swallows args | **Refuted** | Live run: `pnpm --filter web dev` forwards verbatim. Root script unchanged |
| Fixture needs a `makeRules(base)` factory | **Refuted** | Live run: `cruise()` with `baseDir` reports module paths relative to it, so unmodified `^packages/…` rules match a mirrored fixture and fire the **named** rule, not `no-unresolvable`. The review's rejected alternative is simpler and stronger |
| `jiti` missing | Confirmed, avoided | Optional peer of ESLint 10 confirmed in the registry. Using `eslint.config.mjs` removes the need |
| Project references enforce the graph | Confirmed (spec was wrong) | `tsc --build` resolves through the pnpm symlink regardless of `references`. Claim removed; depcruise is the sole enforcement |
| `composite` + `noEmit` conflict | **Refuted as stated** | Corrected 2026-09-20 after an empirical re-check on TS 6.0.3: `composite` + `noEmit` type-check cleanly under both `tsc -p` and `tsc -b`; TS5053 no longer fires. The real constraint is **TS6310** — a *referenced* project may not disable emit — so the three upstream packages use `emitDeclarationOnly` + `outDir` and leaf `web` may use `noEmit`. A global `tsc -b --noEmit` still trips TS6310 |
| Missing `references` entry goes undetected | New, found during re-check | TypeScript emits no diagnostic (microsoft/TypeScript#43770, open); a clean checkout surfaces it as `TS2307` at the importer. Recorded in §Design Notes as a convention to maintain |
| JSX needs an `oxc`/`esbuild` config key | **Refuted** | Vite 8's default JSX runtime is already automatic; a build with and without tsconfig `jsx: react-jsx` produced a byte-identical bundle. No JSX config required at all |
| Mantine needs PostCSS trio | **Refuted** | `@mantine/core` 9.6.1 ships pre-built CSS; PostCSS is for authoring Mantine-flavoured CSS only |
| `@vitejs/plugin-react` required | **Refuted** | Supplies HMR and DevTools naming only; nothing a build or Vitest run needs. Vite 8 transforms JSX with Oxc, so the config key is `oxc`, not `esbuild` |
| `IS_REACT_ACT_ENVIRONMENT` | Confirmed | Warns rather than throws. Stub added anyway, with `matchMedia`/`ResizeObserver` |
| Type-only edges escape | Confirmed | `dependencyTypes` set on the rules |
| `.gitignore` incomplete | **Already satisfied** | Committed file covers every named entry, and `*.lock` does not shadow `pnpm-lock.yaml`. Task removed; `.gitattributes` was the real gap |
| Offline `pnpm install` has no row | **Refuted** | `docs/epics.md` decides install reaches the registry; the offline rule binds `check` and `test` only |
| `sync:dry` non-zero breaks the loop | **Refuted** in part | Definition of done covers `check` and `test` only. The stdout/stderr half was confirmed and patched — stdout is the report channel the real pipeline reserves |
| `engines.node` exact pin blocks agents | Confirmed | Now `>=24.21.0 <25` with `engine-strict`. Node here is now 24.21.0; pnpm was 12.4.1, which `manage-package-manager-versions` self-corrects |
| No formatter / `.gitattributes` | Confirmed in part | `.gitattributes` added. A formatter stays out of scope, consistent with the git-hooks decision |
| Empty headings, prose and structure passes | Confirmed | Applied |

## Verification addenda beyond the review's own sources

- `vitest@5.0.1` tarball grep: no `vitest.workspace` / `defineWorkspace` strings ship at all.
- `msw@2.15.0` `lib/core/utils/request/onUnhandledRequest.js`: `"error"` calls `devUtils.error()` then throws `InternalError` from inside interception.
- pnpm 12.4.1 live argv experiment, both with and without `--`, and across the `--filter` hop.
- dependency-cruiser 18.4.0 live `cruise()` run against a scratch mirrored fixture with `baseDir` set; violation reported as the named rule. `baseDir` has no CLI equivalent, and the config must export an object, not a factory.
- Registry: `eslint@10.11.0` `peerDependenciesMeta.jiti.optional = true`; `@types/react` and `@types/react-dom` both 19.3.0.
- Local environment at triage time: Node 24.21.0, pnpm 12.4.1, npm 11.19.0, `core.autocrlf=true`, no `.gitattributes`.
