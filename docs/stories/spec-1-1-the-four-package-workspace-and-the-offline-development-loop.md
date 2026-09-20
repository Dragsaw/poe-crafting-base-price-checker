---
title: 'Story 1.1: The four-package workspace and the offline development loop'
type: 'feature'
created: '2026-09-20'
status: 'ready-for-dev'
route: 'full'
review_loop_iteration: 1
context:
  - '{project-root}/docs/stories/epic-1-context.md'
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The repository holds planning documents and no code. Nothing lets a development agent install, typecheck, lint or test, and nothing mechanically stops a wrong-direction import or a test that escapes to the live trade API.

**Approach:** Create the pnpm workspace with the four packages `contracts`, `core`, `sync` and `web` on the spine's pinned stack, wire `pnpm check` and `pnpm test` to run offline with no credentials and no human, and make `dependency-cruiser` and MSW the mechanisms that enforce the package graph and the zero-network rule.

## Boundaries & Constraints

**Always:**
- Every installed version matches the spine's Structural Seed *Stack* table exactly; TypeScript stays at 6.0.3.
- Direction is one-way: `contracts` → `core` → `sync` / `web`. `contracts` declares no workspace dependency; `sync` and `web` never import each other.
- Each package owns a disjoint directory and its own test suite.
- Every test setup records unhandled requests through MSW's `onUnhandledRequest` **callback**, and a global `afterEach` fails the test naming every escaped URL. The `"error"` string is not sufficient and must not be substituted for it.
- Layout follows the spine's Structural Seed *Source tree*.
- If a pinned version is unavailable from the registry, stop and report — never substitute silently.
- **Decided:** `web` gets a minimal Vite + React + Mantine shell rendering one placeholder, so `pnpm dev` works from this story on and the pinned React/Vite/Mantine versions are genuinely exercised. Story 2.1 replaces the placeholder. A jsdom render test, not `pnpm dev`, is what proves the shell mounts — no acceptance criterion depends on a running server.
- **Decided:** `pnpm dev` binds one explicit port and fails rather than moving. `strictPort` is on, the port defaults to 5173, and `--port` on the command line is the only override. A second worktree therefore chooses its own port without editing a tracked file, and an agent that reuses a taken port gets a loud bind failure instead of silently verifying another worktree's build.
- **Decided:** The project ships no dev-server supervisor. Backgrounding `pnpm dev`, capturing its output and stopping it belong to the agent's runtime, not to the repository.
- **Decided:** `pnpm sync:dry` exists as a stub that exits non-zero with a "not implemented yet" message, so the agent loop's command name is present from day one. Story 1.5 gives it a pipeline.

**Never:**
- No dev-server supervisor: no `dev:start`/`dev:stop`/`dev:log` script, no pidfile, no log file, no port-scanning helper.
- No schemas, ports, adapters or logic beyond what proves a package builds and tests (Story 1.2 owns those).
- No `@typescript/typescript6` shim.
- No sync pipeline, no live API call from any script this story adds, no hand-written fixtures.
- No file created or edited under `data/` — each has a single non-agent writer.
- No CI workflow or Pages deploy (Story 2.7).
- No git hooks — no husky, no lint-staged, no pre-commit or pre-push wiring. Decided out of scope; the agent runs `pnpm check` itself.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Clean install | Clean checkout, network up | `pnpm install` succeeds, no credentials, no human | Fails loudly on an unavailable pinned version |
| Offline loop | Installed workspace, network down | `pnpm check` and `pnpm test` both succeed | No error expected |
| Forbidden edge | `core`→`sync`, `core`→`web`, `sync`↔`web`, or `contracts`→sibling | `pnpm check` fails and names the offending edge | Non-zero exit from `dependency-cruiser` |
| `contracts` isolation | Its dependency manifest inspected | No workspace dependency declared | The boundary rule forbids the import too |
| Unfixtured request | A test issues an HTTP request with no handler | That test fails loudly, naming the request | Request never reaches the network |
| Dev server, free port | `pnpm dev`, default port free | Vite serves the shell on the default port and prints that URL | No error expected |
| Dev server, taken port | `pnpm dev`, default port held by another worktree | Vite fails to bind and exits non-zero, naming the port | Never falls through to a different port |
| Dev server, second worktree | `pnpm dev --port 5174` | Serves on 5174; no tracked file was edited to get there | Same loud bind failure if 5174 is also taken |

</frozen-after-approval>

## Code Map

Greenfield — no application source exists. Everything this story creates is new; the entries below are the documents it reads and the files it extends.

- `docs/architecture/.../ARCHITECTURE-SPINE.md` — §Structural Seed holds the exact versions (*Stack*) and the layout (*Source tree*). Read, never edit.
- `docs/architecture/.../AGENT-WORKFLOW.md` — the agent loop's command names and the definition of done. Read, never edit. Note that the definition of done covers `pnpm check` and `pnpm test` only, and that `sync:dry` writes its report to **stdout**.
- `.gitignore` — exists and already covers `node_modules/`, `dist/`, `build/`, `*.tsbuildinfo`, `coverage/`, `.vite/` and `.vitest/`. **No edit needed.** `*.lock` does not shadow `pnpm-lock.yaml`.
- `.gitattributes` — absent. This story creates it.
- `docs/`, `_bmad/`, `.claude/`, `.serena/` — existing; exclude from lint, typecheck and depcruise scope. Do not touch.

## Tasks & Acceptance

**Execution:**
- [ ] `pnpm-workspace.yaml` — declare `packages/*`.
- [ ] `package.json` (root) — private; `packageManager` pnpm 12.5.1, `engines.node` `>=24.21.0 <25`, shared devDependencies at Stack-table versions written as **exact** strings, scripts `check` (typecheck + lint + depcruise), `test`, `dev`, `sync:dry`.
- [ ] `.npmrc` — `engine-strict=true`, `manage-package-manager-versions=true`, `save-exact=true`. The second makes pnpm self-correct to the pinned 12.5.1 rather than trusting whatever pnpm is on PATH.
- [ ] `.gitattributes` — `* text=auto eol=lf`, so the epic's LF convention survives a Windows checkout with `core.autocrlf=true` and `git status` stays clean.
- [ ] `tsconfig.base.json` + `packages/*/tsconfig.json` — strict shared base. `contracts`, `core` and `sync` are referenced by something, so they set `composite: true`, `declaration: true`, `emitDeclarationOnly: true`, `rootDir: "src"` and `outDir: "dist"`, with `types` pointing at `dist/index.d.ts`. A referenced project **may not disable emit** (TS6310); `emitDeclarationOnly` satisfies that while leaving JS emit to Vite. `web` is a leaf and may use `noEmit` — on TypeScript 6 that is compatible with `composite`. Do **not** pass a global `tsc -b --noEmit`: it forces `noEmit` onto the upstream projects and trips TS6310. References buy build ordering and incrementality, **not** graph enforcement — see §Design Notes.
- [ ] `eslint.config.mjs` — flat config scoped to `packages/**` plus `tools/boundary-check/*.test.ts`. ESM, not TypeScript: ESLint 10 needs `jiti` to load a `.ts` config, and `.mjs` removes that dependency entirely.
- [ ] `.dependency-cruiser.mjs` + `depcruise.rules.mjs` — the shared module exports a plain rules array; the config file spreads it into an exported **object literal** (dependency-cruiser requires an object, not a factory). Forbid every edge in the matrix row at `error` severity with a message naming the edge, and set `dependencyTypes` so a type-only `import type` is caught too.
- [ ] `vitest.config.ts` (root) — `test.projects` listing `'packages/*'` **plus an inline project** covering `test/**/*.test.ts` and `tools/boundary-check/*.test.ts`. `vitest.workspace.ts` does not exist in Vitest 5 and must not be created.
- [ ] `test/setup.ts` — `setupServer()` with no handlers, started before all tests and closed after. `onUnhandledRequest` is a **callback** that filters static-asset requests and pushes the rest onto a module-level array; a global `afterEach` throws when that array is non-empty, naming every URL, then clears it.
- [ ] `packages/contracts/{package.json,src/index.ts}` — no workspace dependency; placeholder export only.
- [ ] `packages/core/{package.json,src/index.ts}` — depends on `contracts` only.
- [ ] `packages/sync/{package.json,src/index.ts}` — depends on `contracts` and `core`.
- [ ] `packages/web/` — depends on `contracts` and `core`, plus `@types/react` and `@types/react-dom` at 19.3.0; minimal Vite + React + Mantine shell rendering one placeholder element, backing `pnpm dev`. No PostCSS and no `@vitejs/plugin-react` — see §Design Notes.
- [ ] `packages/web/vite.config.ts` — `server.strictPort: true`; `server.port: 5173`, overridden only by a CLI `--port`. No JSX configuration is needed: Vite 8 transforms JSX with Oxc and the automatic runtime is its default. If a JSX option is ever required, it belongs under the `oxc` key — the `esbuild` key is deprecated in Vite 8 and converted internally.
- [ ] `packages/web/src/App.test.tsx` — mounts the shell through `MantineProvider` with `react-dom/client` inside `act`, and asserts the placeholder text is in `document.body`. Its setup sets `globalThis.IS_REACT_ACT_ENVIRONMENT = true`, stubs `window.matchMedia` and `ResizeObserver`, and unmounts the root in a cleanup hook. The `web` Vitest project uses the `jsdom` environment.
- [ ] `packages/sync/` `sync:dry` stub — prints "not implemented yet" to **stderr** and exits non-zero. Stdout is the report channel `AGENT-WORKFLOW.md` reserves for the real pipeline.
- [ ] `packages/*/src/*.test.ts` — one smoke test per package, proving its suite runs.
- [ ] `test/no-network.test.ts` — an unhandled `fetch` fails the test rather than reaching the network.
- [ ] `tools/boundary-check/boundary.test.ts` — in scope for ESLint, tsconfig and the root Vitest project. Calls `cruise(['packages/core'], { baseDir: <fixture>, ruleSet, validate: true })` with the **unmodified** shared rules and asserts the violation is reported by its named rule id.
- [ ] `tools/boundary-check/fixture/packages/{core,sync}/src/` — a fixture tree mirroring the real `packages/<name>/src` shape so the shipped path regexes match it verbatim; holds one forbidden `core`→`sync` import. Excluded by explicit named entry from lint, typecheck and the shipped depcruise run.

**Acceptance Criteria:**
- Given a clean checkout, when `pnpm install` runs, then it succeeds with no credentials and no human, and every installed version matches the Stack table exactly.
- Given an installed workspace with the network disconnected, when `pnpm check` and `pnpm test` run, then both succeed.
- Given the four packages, when the workspace is inspected, then each owns a disjoint directory with its own test suite.
- Given TypeScript, when its version is inspected, then it is 6.0.3 and no shim stands in for it.
- Given the boundary fixture holding a `core`→`sync` import, when `pnpm test` runs, then the boundary test fails that fixture naming the offending edge, using the same rule module the shipped config loads — so a `severity: "warn"` or a mistyped module name in the real config fails this test.
- Given a test that issues an unhandled `fetch`, when `pnpm test` runs, then that test fails and the failure names the request URL.
- Given a clean checkout, when `pnpm sync:dry` runs, then it prints "not implemented yet" on stderr and exits non-zero.
- Given the `web` package, when `pnpm test` runs, then the shell mounts under `MantineProvider` and the placeholder is asserted present — without any dev server running.
- Given the default dev port is already held by another process, when `pnpm dev` runs, then it exits non-zero naming the port, and never serves on a different one.
- Given a second worktree, when `pnpm dev --port <other>` runs, then it serves on that port with no tracked file modified — `git status` stays clean.
- Given `pnpm check` and `pnpm test` have both run, when `git status` is inspected, then the tree is clean.

## Implementation Notes

_None yet._

## Spec Change Log

Held in `docs/stories/reviews/review-1-1-the-four-package-workspace-and-the-offline-development-loop.md`, §Triage outcome — two entries as of 2026-09-20 (dev-server observability; mechanisms that failed green). Append new entries there, not here.

## Review Triage Log

Held in the same file, §Triage outcome. The 2026-09-20 specification review is triaged there in full, with the refutations and the evidence behind each verdict.

## Design Notes

**`dependency-cruiser` alone holds the package graph.** An earlier draft claimed TypeScript project references as a second enforcement layer; that is false. Under pnpm workspaces a sibling resolves through the `node_modules` symlink to its declared types whether or not it appears in `references`, so a forbidden import type-checks clean in a built tree. The two real guards are each package's manifest — declaring only its allowed `workspace:*` dependencies, so an illegal import does not resolve at all — and depcruise, which produces the named-edge failure the AC requires. References buy build ordering and incrementality, nothing more.

This cuts the other way too, and the failure is order-dependent rather than loud. TypeScript emits **no diagnostic for a missing `references` entry** (microsoft/TypeScript#43770, still open), so an omission is invisible while the dependency's `dist/` happens to be built, and surfaces only on a clean checkout as `TS2307: Cannot find module` — pointing at the importer rather than at the missing reference. Keep each package's `references` in step with its `workspace:*` dependencies by convention; nothing mechanical enforces it.

**The fixture is cruised with the shipped rules, unmodified.** The forbidden-edge AC cannot be proven by committing a violation into `packages/`, because `pnpm check` must pass on a clean tree — hence a fixture tree outside it. Writing the violation at test time was rejected: it dirties `packages/`, which two agents in parallel worktrees would collide on. Because `cruise()`'s `baseDir` makes reported module paths relative to it, a fixture that mirrors `packages/<name>/src` internally is matched by the real `^packages/…` regexes with no parameterisation. A second copy of the rules would pass while the real config sat at `severity: "warn"` or carried a mistyped module name — the exact failure this test exists to catch.

**`pnpm dev` is the one long-running command in the agent loop, and the loop must not depend on it.** Every other command starts, does its work and exits. A dev server does not, so an agent that runs it in the foreground blocks its own turn until the tool timeout kills the server — the process is gone before anything can be checked against it. Hence: no acceptance criterion may require a running server, and the jsdom mount test carries that weight instead.

**Backgrounding is the runtime's job, not the repository's.** A `dev:start`/`dev:log`/`dev:stop` supervisor was rejected. A log file cannot be produced without either a supervisor script or `>` redirection, and the repo's command policy forbids the redirection, so adding only a log file is no smaller a change than the whole supervisor. Every runtime this project targets already provides detached spawn, output capture, and kill. A supervisor would add a pidfile, a stale-pidfile failure mode and a readiness-poll race to re-implement them.

**What the repository owes the agent is a knowable URL**, because that is the one thing the runtime cannot supply. Vite's default is to increment silently past a taken port, which in a second worktree means the agent opens a URL serving *another agent's build* and reports on the wrong code — a wrong answer, not a visible failure. `strictPort: true` converts that into a bind error.

**The `web` shell installs no PostCSS and no React plugin.** Mantine's Vite guide prescribes `postcss-preset-mantine` and `postcss-simple-vars`, but those matter only when authoring CSS with Mantine's mixins and breakpoint variables; `@mantine/core` ships pre-built CSS that a consumer imports directly. `@vitejs/plugin-react` supplies Fast Refresh and DevTools naming, neither of which a placeholder build or a jsdom test needs. Story 2.1 may add both when it has a UI worth styling.

**Testing Library is deliberately not used.** The mount test asserts against `document.body` directly, so `jsdom` is the only new runtime devDependency. Story 2.1 can add an assertion library once there is a UI worth querying.

## Verification

**Commands:**
- `pnpm install` — expected: success, no credential prompt, lockfile at the pinned versions
- `pnpm check` — expected: typecheck, lint, and depcruise pass, zero violations
- `pnpm test` — expected: all four package suites plus the root guards pass, no network call; the `web` suite mounts the shell and asserts the placeholder without a server
- `pnpm sync:dry` — expected: prints "not implemented yet" on stderr, exits non-zero
- `git status` after `pnpm check` and `pnpm test` — expected: clean

**Dev server (long-running — never run this in the foreground):**
- `pnpm dev` — start it through the runtime's background-process facility (Claude Code: a Bash call with `run_in_background: true`); it blocks the turn until the tool timeout kills it otherwise. Read the URL from its captured output before opening anything.
- Stop it through the runtime when done (Claude Code: `TaskStop`). A leaked Vite process holds the port and makes every later `pnpm dev` in this worktree fail; recover by killing the listener on that port.
- In a second worktree, or if the default port is held: `pnpm dev --port <other>`. Do not edit `vite.config.ts` to change the port.

**Manual checks:**
- Disconnect the network, re-run `pnpm check` and `pnpm test` — both still pass.
- With the dev server already running, run `pnpm dev` again — the second one must exit non-zero naming the port, not serve on the next one up.
