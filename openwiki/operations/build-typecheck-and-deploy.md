---
type: operations
title: Build, typecheck and deploy
description: What pnpm check runs (its two parallel stages), how pnpm build prunes data/ for GitHub Pages, the dev server rules, the deploy, test and OpenWiki workflows, the commit-msg and pre-push hooks, and the agent lint-on-edit and typecheck-on-stop hooks.
tags: [build, typecheck, deploy, github-pages, ci, git-hooks, vite, lint-on-edit]
verified:
  - by: openwiki/0.6.0
    at: 2026-10-17T13:54:42.734Z
sources:
  - id: openwiki-source-1fe463fcf07912e5cdbb5a91
    resource: repo://.claude/settings.json
  - id: openwiki-source-6983d4a49fc6ae63a12ff946
    resource: repo://.githooks/commit-msg
  - id: openwiki-source-baf30c604828cfde90a8ab63
    resource: repo://.githooks/pre-push
  - id: openwiki-source-6766b7a0c14857435d2077c9
    resource: repo://.github/workflows/deploy.yml
  - id: openwiki-source-6d4b4e707b8d60b6ccfa3425
    resource: repo://.github/workflows/openwiki-update.yml
  - id: openwiki-source-4f2678f93d3fd3835f9f2909
    resource: repo://.github/workflows/test.yml
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-612c328aa24af174eea2d601
    resource: repo://packages/web/src/load/prune-allowlist.test.ts
  - id: openwiki-source-ccecd3ec2865b64b4ea6f780
    resource: repo://packages/web/vite.config.ts
  - id: openwiki-source-bf67e2e0ceec6b0af5c16a26
    resource: repo://tools/check/check.ts
  - id: openwiki-source-1ae756613b86ee97ac44bb98
    resource: repo://tools/dts-specifiers/rewrite-dts-specifiers.ts
  - id: openwiki-source-496b7c1f5cec4366a0ad0d7a
    resource: repo://tools/lint-on-edit/lint-on-edit.ts
  - id: openwiki-source-b9a92b64dc396f92a1c4a13e
    resource: repo://tools/lint-on-edit/typecheck-on-stop.ts
  - id: openwiki-source-d8f3bf9389be04e71e0c9f6a
    resource: repo://tools/prune-pages.mjs
  - id: openwiki-source-d9161b70d04aabec78253a6c
    resource: repo://tools/setup-git-hooks.mjs
  - id: openwiki-source-d67c063568992560840377ea
    resource: repo://tsconfig.tools.json
generated: { by: "claude-code", at: "2026-10-17T13:54:42.734Z" }
---

# Build, typecheck and deploy

The product ships as a static site on GitHub Pages. The page is built by Vite from `packages/web`. The data it shows are committed JSON files under `data/`, which the page fetches at runtime. There is no server and there are no secrets in the site. Every command below runs from the repository root with pnpm (Node `>=24.21.0 <25`, pnpm version from `packageManager`).

## pnpm check: the done gate

`pnpm check` runs `tools/check/check.ts`. It is the gate for "done" (see `AGENT-WORKFLOW.md`), the pre-push hook and both CI workflows. It runs eight steps in two stages. The steps of one stage run in parallel; stage B starts after stage A ends.

| Stage | Step | Command |
| --- | --- | --- |
| A | `typecheck` | `tsc -b`, then the `.d.ts` specifier rewrite |
| A | `lint` | `eslint . --max-warnings=0` |
| A | `depcruise` | dependency-cruiser over `packages` with `.dependency-cruiser.mjs` |
| A | `dup` | `jscpd` duplicate detection |
| A | `knip` | unused files, exports and dependencies |
| B | `test` | `vitest run --project=!data` |
| B | `test:data` | `vitest run --project data`, the invariants of the live `data/` |
| B | `build` | `pnpm build` |

Every step runs even when another fails, so one run shows every problem. The tool buffers each step's output, prints one `PASS`/`FAIL` line per step, then the full output of each failed step and a totals line. It exits 1 when any step failed. Flags:

- `--fast` (also `pnpm check:fast`) keeps stage A only.
- `--only a,b` runs the named steps. An unknown name is an error.
- `--bail` aborts the running siblings when one step fails and reports later stages as `skipped`. Aborting kills the step's whole process tree (`taskkill /T` on Windows).

The lint baseline is `eslint-suppressions.json`. `pnpm lint:prune` prunes it. Never run `eslint --suppress-*`.

### Why the .d.ts rewrite exists

`packages/contracts`, `packages/core` and `packages/sync` are `emitDeclarationOnly` with `allowImportingTsExtensions`. `packages/web` emits no declarations. Their `exports` point at `./src/index.ts`, so commands run by bare `node` with type stripping, such as `pnpm sync`, load the TypeScript source directly. Node's type stripping does no extension resolution, so every relative specifier in the source carries `.ts`. TypeScript's own rewrite changes only `.js` output, so the emitted `.d.ts` files keep `./x.ts` specifiers. A consumer of `dist` cannot follow those.

The post-emit step (`tools/dts-specifiers/rewrite-dts-specifiers.ts`) walks the `dist` of each package in `TARGET_PACKAGES`. It rewrites each relative `.ts`/`.tsx`/`.mts`/`.cts` specifier in declaration files to `.js`/`.mjs`/`.cjs`. It leaves `.d.ts` specifiers as written, and it writes only the files that change. Its test compares `TARGET_PACKAGES` with the packages whose tsconfig sets `emitDeclarationOnly`. Only `pnpm typecheck` runs it. A bare `tsc -b`, a watch build or an IDE rebuild writes the `.ts` specifiers back.

`tsconfig.base.json` is strict and also enables `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `noUnusedLocals`/`Parameters` and `moduleResolution: bundler`. Do not pass a global `--noEmit` to the solution build. That forces `noEmit` onto referenced projects and fails with TS6310.

`tsconfig.tools.json` is the `noEmit` project for code outside `packages/`: `test/**/*.ts`, the `tools/` scripts (check, currencies-refresh, deferred-issues, dev-stop, dts-specifiers, entry-guard, eslint-rules, lint-on-edit, boundary-check, prune-pages) and the `tracked-json` skill scripts. It sets `allowImportingTsExtensions`, because these scripts also run under bare `node` and import their siblings with `.ts` specifiers. Most tool entry points run only when `isInvokedDirectly` (`tools/entry-guard/`) says the module is the process entry, so their tests can import them.

## pnpm dev

`pnpm dev` runs `vite --config packages/web/vite.config.ts`. The config has these settings:

- `server.port: 5173` with **`strictPort: true`**. If the port is taken, Vite fails loudly instead of moving to another port. Without this, an agent in a second worktree could end up checking another worktree's server. To use another port, run `pnpm dev --port <n>`. Do not edit the config.
- `publicDir` is the repository `data/` folder. The artifacts are served and copied, never bundled. Source never imports `data/**`.
- `base: './'`, so asset and fetch URLs are relative and the site works under any Pages path.
- `appType: 'mpa'`, which gives no SPA fallback. A missing artifact must return 404 so the loader can treat it as absent. An `index.html` with status 200 would be refused as invalid.
- No `@vitejs/plugin-react` and no PostCSS. Vite 8 transforms JSX with Oxc, and Mantine ships pre-built CSS.

The same file declares the `web` Vitest project: jsdom, `test/setup.ts` plus `src/test-setup.ts`, excluding `*.data.test.*` files (see [Test strategy and network guards](../testing/test-strategy-and-guards.md)).

`pnpm dev` runs until it is stopped. Start it in the background and stop it after use with `pnpm dev:stop` (`--port <n>` for another port). On Windows, stopping the background task kills only the top process and Vite keeps the port, so run `pnpm dev:stop` even after the task ends. The command kills the whole `pnpm dev` process tree of this checkout, refuses a listener that is not this checkout's Vite, and exits 1 when the port stays taken. [Operator commands and curation workflow](../workflows/operator-commands.md) describes how it finds that tree.

## pnpm build and the prune step

`pnpm build` runs `vite build` and then `node tools/prune-pages.mjs`.

Because `data/` is the `publicDir`, `vite build` copies **all** of it into `packages/web/dist`. That includes files the page never fetches: `sync-progress.json`, `currencies.json`, `catalogue/items.json`, `catalogue/filters.json` and `catalogue/static.json`. `prunePages(distDir, dataDir)` works as follows:

- It deletes each file that came from `data/` and is not on `ALLOWLIST`, and then removes any directory that the deletion left empty. It does not touch bundle output such as `index.html` and `assets/` (including the bundled Inter font files).
- It throws, naming each one, when a **required** artifact (`dataset.json`, `tracked.json`, `config.json`, `catalogue/stats.json`) is missing from `dist`. The three tolerable artifacts (`sync-report.json`, `weights.json`, `recipes.json`) may be missing.
- It throws when `dist` does not exist.

The script runs only under `import.meta.main`, not a comparison with `process.argv[1]`. With a path comparison, a junction or a drive-letter case difference could skip the prune, so the build would publish all of `data/` and still exit 0.

`ALLOWLIST` mirrors `ARTIFACTS` in `packages/web/src/load/artifacts.ts`. `packages/web/src/load/prune-allowlist.test.ts` asserts that both have the same seven paths, the same order and the same required set.

## CI workflows

### Deploy to GitHub Pages

`.github/workflows/deploy.yml` runs on each push to `master` and on manual dispatch. Its steps: checkout, pnpm setup (version from `packageManager`), Node 24 with pnpm cache, `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build`, and then upload of `packages/web/dist` as the Pages artifact and `actions/deploy-pages`. Concurrency group `pages` does not cancel a run in progress.

Because `pnpm check` now includes `pnpm test` and `pnpm test:data`, a push whose `data/` breaks an invariant of the live files does not deploy. The site uses the Actions-based Pages source, not branch publishing, because branch publishing runs Jekyll. The repository's Pages source must be set to "GitHub Actions" once.

Because the data are committed files, publishing new prices is a git operation: run `pnpm sync`, commit `data/`, and push to `master`.

### Tests on pull requests

`.github/workflows/test.yml` runs on every pull request. A `dorny/paths-filter` step checks whether code or build config changed (TypeScript and `.mjs` files, manifests, the lockfile, tsconfigs, the lint, knip and jscpd configs, `.githooks/**`, the workflow itself). Only then does it install and run `pnpm check`. It filters inside the job instead of with a `paths:` trigger, because a required check that never reports leaves the pull request unmergeable. A newer push to the same pull request cancels the older run, and the job has a 15-minute limit.

### Scheduled OpenWiki update

`.github/workflows/openwiki-update.yml` refreshes this wiki. Its daily schedule is **paused** (commented out); it runs only on manual dispatch until the schedule is restored. It checks out the full history (`fetch-depth: 0`), because `openwiki code --update` diffs `HEAD` against the last documented commit and a shallow clone hides that commit. It installs a pinned `openwiki` and runs `openwiki code --update --print` against an OpenAI-compatible provider from repository secrets. The run step is `continue-on-error`. The workflow then deletes `openwiki/.run.json` and opens or updates a pull request on the branch `openwiki/update`. The pull request adds only the `openwiki/` folder. When the OpenWiki step fails, the pull request keeps only the pages completed before the failure, and a last step fails the job. Do not hand-edit generated wiki pages. Change the source or docs and let the workflow regenerate them.

## Git hooks

The `prepare` script runs `tools/setup-git-hooks.mjs`. It sets `core.hooksPath` to `.githooks` when the checkout is a git work tree and no other hooks path is configured. When a different `core.hooksPath` is already set, it warns and leaves it unchanged.

`.githooks/commit-msg` lints the subject line:

- The form is `type: description` or `type(scope): description`, with a lowercase known type: `feat, fix, test, docs, chore, wip, refactor, perf, build, ci`. A known type in the wrong case gets a message with the lowercased subject.
- There is no trailing period. The `deferred` scope is exempt, because the deferred-work-sweep automation ends its subjects with a ledger sentence.
- `Merge`, `Revert`, `fixup!` and `squash!` subjects pass without checks.

`.githooks/pre-push` runs `pnpm check` before a push and blocks the push when it fails. A push that only deletes refs passes without a check. It removes git's local environment variables (`git rev-parse --local-env-vars`) before it runs the gate, so a test's git call cannot write to this repository. `git push --no-verify` skips it. `test/commit-msg-hook.test.ts` and `test/pre-push-hook.test.ts` cover both hooks.

## Agent hooks: lint on edit, typecheck on stop

`.claude/settings.json` wires two hooks for coding agents:

- **PostToolUse** (`tools/lint-on-edit/lint-on-edit.ts`) runs after each file edit tool, including Serena's symbol edits. It runs `lint` (with `LINT_FAST=1`, which skips the type-aware block) and `depcruise` on the edited `.ts`/`.tsx`/`.css` file, inside a 30-second budget. With no path in the payload it falls back to at most 20 files from `git diff`. It skips `node_modules` and `dist`.
- **Stop** (`tools/lint-on-edit/typecheck-on-stop.ts`) runs `tsc -b` and the rewrite once per agent turn, within 90 seconds, when the working tree has uncommitted changes. Exit code 2 blocks the stop and hands the diagnostics back to the agent.

## Related

- [Test strategy and network guards](../testing/test-strategy-and-guards.md): the Vitest projects that `pnpm check` runs.
- [Package graph, ports and purity boundaries](../architecture/package-graph-and-ports.md): what `depcruise` and the lint purity block enforce.
- [Web frame, theme and controls](../web/frame-theme-and-controls.md): the page the build ships.
