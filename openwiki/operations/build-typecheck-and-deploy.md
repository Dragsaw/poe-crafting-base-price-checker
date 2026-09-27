---
type: operations
title: Build, typecheck and deploy
description: How pnpm check, pnpm dev, pnpm build and the GitHub Pages workflow work — the tsc -b solution build with its .d.ts specifier rewrite, lint and dependency-cruiser gates, the Vite config that serves data/ as publicDir, the prune step that limits the published files to seven artifacts, the scheduled OpenWiki update workflow, and the commit-msg hook.
tags: [build, typecheck, vite, github-pages, deploy, ci, git-hooks]
sources:
  - id: openwiki-source-6983d4a49fc6ae63a12ff946
    resource: repo://.githooks/commit-msg
  - id: openwiki-source-6766b7a0c14857435d2077c9
    resource: repo://.github/workflows/deploy.yml
  - id: openwiki-source-6d4b4e707b8d60b6ccfa3425
    resource: repo://.github/workflows/openwiki-update.yml
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-0195b32646fe8a72bfdd1842
    resource: repo://packages/contracts/tsconfig.json
  - id: openwiki-source-612c328aa24af174eea2d601
    resource: repo://packages/web/src/load/prune-allowlist.test.ts
  - id: openwiki-source-ccecd3ec2865b64b4ea6f780
    resource: repo://packages/web/vite.config.ts
  - id: openwiki-source-1ae756613b86ee97ac44bb98
    resource: repo://tools/dts-specifiers/rewrite-dts-specifiers.ts
  - id: openwiki-source-d8f3bf9389be04e71e0c9f6a
    resource: repo://tools/prune-pages.mjs
  - id: openwiki-source-d9161b70d04aabec78253a6c
    resource: repo://tools/setup-git-hooks.mjs
generated: { by: "claude-code", at: "2026-09-27T16:49:38.941Z" }
verified:
  - by: openwiki/0.6.0
    at: 2026-09-27T16:49:38.941Z
---

# Build, typecheck and deploy

The product ships as a static site on GitHub Pages. The page is built by Vite from `packages/web`. The data it shows are committed JSON files under `data/`, which the page fetches at runtime. There is no server and there are no secrets. Every command below runs from the repository root with pnpm (Node `>=24.21.0 <25`, pnpm version from `packageManager`).

## pnpm check

`pnpm check` runs three gates in sequence:

1. **`pnpm typecheck`**: `tsc -b` over the solution `tsconfig.json`, followed by `node tools/dts-specifiers/rewrite-dts-specifiers.ts`.
2. **`pnpm lint`**: `eslint . --max-warnings=0`. It includes the `core` purity bans (see [Package graph, ports and purity boundaries](../architecture/package-graph-and-ports.md)).
3. **`pnpm depcruise`**: dependency-cruiser over `packages` with `.dependency-cruiser.mjs`.

### Why the .d.ts rewrite exists

`packages/contracts` is `emitDeclarationOnly` with `allowImportingTsExtensions`. Its `exports` point at `./src/index.ts`, so commands run by bare `node` with type stripping, such as `pnpm sync`, load the TypeScript source directly. Node's type stripping does no extension resolution, so every relative specifier in the source carries `.ts`. TypeScript's own rewrite changes only `.js` output, so the emitted `.d.ts` files keep `./x.ts` specifiers. A consumer of `dist` cannot follow those.

The post-emit step rewrites each relative `.ts`/`.tsx`/`.mts`/`.cts` specifier in declaration files to `.js`/`.mjs`/`.cjs`. It leaves `.d.ts` specifiers as written, and it writes only the files that change. Only `pnpm typecheck` runs it. A bare `tsc -b`, a watch build or an IDE rebuild writes the `.ts` specifiers back.

`tsconfig.base.json` is strict and also enables `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `noUnusedLocals`/`Parameters` and `moduleResolution: bundler`. Do not pass a global `--noEmit` to the solution build. That forces `noEmit` onto referenced projects and fails with TS6310.

## pnpm dev

`pnpm dev` runs `vite --config packages/web/vite.config.ts`. The config (`packages/web/vite.config.ts`) has these settings:

- `server.port: 5173` with **`strictPort: true`**. If the port is taken, Vite fails loudly instead of moving to another port. Without this, an agent in a second worktree could end up checking another worktree's server. To use another port, run `pnpm dev --port <n>`. Do not edit the config.
- `publicDir` is the repository `data/` folder. The artifacts are served and copied, never bundled. Source never imports `data/**`.
- `base: './'`, so asset and fetch URLs are relative and the site works under any Pages path.
- `appType: 'mpa'`, which gives no SPA fallback. A missing artifact must return 404 so the loader can treat it as absent. An `index.html` with status 200 would be refused as invalid.
- No `@vitejs/plugin-react` and no PostCSS. Vite 8 transforms JSX with Oxc, and Mantine ships pre-built CSS.

The same file declares the `web` Vitest project: jsdom, `test/setup.ts` plus `src/test-setup.ts` (see [Test strategy and network guards](../testing/test-strategy-and-guards.md)).

`pnpm dev` runs until it is stopped. Start it in the background and stop it after use with `pnpm dev:stop` (`--port <n>` for another port). On Windows, stopping the background task kills only the top process and Vite keeps the port, so run `pnpm dev:stop` even after the task ends. The command kills the whole `pnpm dev` process tree of this checkout, refuses a listener that is not this checkout's Vite, and exits 1 when the port stays taken. [Operator commands and curation workflow](../workflows/operator-commands.md) describes how it finds that tree.

## pnpm build and the prune step

`pnpm build` runs `vite build` and then `node tools/prune-pages.mjs`.

Because `data/` is the `publicDir`, `vite build` copies **all** of it into `packages/web/dist`. That includes files the page never fetches: `sync-progress.json`, `currencies.json`, `catalogue/items.json`, `catalogue/filters.json` and `catalogue/static.json`. `prunePages(distDir, dataDir)` works as follows:

- It deletes each file that came from `data/` and is not on `ALLOWLIST`, and then removes any directory that the deletion left empty. It does not touch bundle output such as `index.html` and `assets/`.
- It throws, naming each one, when a **required** artifact (`dataset.json`, `tracked.json`, `config.json`, `catalogue/stats.json`) is missing from `dist`. The three tolerable artifacts (`sync-report.json`, `weights.json`, `recipes.json`) may be missing.
- It throws when `dist` does not exist.

The script runs only under `import.meta.main`, not a comparison with `process.argv[1]`. With a path comparison, a junction or a drive-letter case difference could skip the prune, so the build would publish all of `data/` and still exit 0.

`ALLOWLIST` mirrors `ARTIFACTS` in `packages/web/src/load/artifacts.ts`. `packages/web/src/load/prune-allowlist.test.ts` asserts that both have the same seven paths, the same order and the same required set.

## Deploy to GitHub Pages

`.github/workflows/deploy.yml` runs on each push to `master` and on manual dispatch. Its steps: checkout, pnpm setup (version from `packageManager`), Node 24 with pnpm cache, `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build`, and then upload of `packages/web/dist` as the Pages artifact and `actions/deploy-pages`. Concurrency group `pages` does not cancel a run in progress.

The workflow does not run `pnpm test`. Tests over the committed data would block a data-only push, such as a new sync result or a tracked-list edit. `pnpm check` is the gate. The site uses the Actions-based Pages source, not branch publishing, because branch publishing runs Jekyll. The repository's Pages source must be set to "GitHub Actions" once.

Because the data are committed files, publishing new prices is a git operation: run `pnpm sync`, commit `data/`, and push to `master`.

## Scheduled OpenWiki update

`.github/workflows/openwiki-update.yml` refreshes this wiki. It runs daily at 08:00 UTC and on manual dispatch. It checks out the full history (`fetch-depth: 0`), because `openwiki code --update` diffs `HEAD` against the last documented commit and a shallow clone hides that commit. It installs a pinned `openwiki` and runs `openwiki code --update --print` against an OpenAI-compatible provider from repository secrets. The run step is `continue-on-error`. The workflow then deletes `openwiki/.run.json` and opens or updates a pull request on the branch `openwiki/update`. The pull request covers `openwiki/`, `AGENTS.md`, `CLAUDE.md` and the workflow file. When the OpenWiki step fails, the pull request keeps only the pages completed before the failure, and a last step fails the job. Do not hand-edit generated wiki pages. Change the source or docs and let the workflow regenerate them.

## Git hooks and commit conventions

The `prepare` script runs `tools/setup-git-hooks.mjs`. It sets `core.hooksPath` to `.githooks` when the checkout is a git work tree and no other hooks path is configured. When a different `core.hooksPath` is already set, it warns and leaves it unchanged.

`.githooks/commit-msg` lints the subject line:

- The form is `type: description` or `type(scope): description`, with a lowercase known type: `feat, fix, test, docs, chore, wip, refactor, perf, build, ci`.
- There is no trailing period. The `deferred` scope is exempt, because it is used by the deferred-work-sweep automation.
- `feat`, `fix` and `test` commits scoped only to known packages (`contracts, core, sync, web`) must name a `story <epic>.<n>` or a `retro item(s)` in the description.
- `Merge`, `Revert`, `fixup!` and `squash!` subjects pass without checks.

`test/commit-msg-hook.test.ts` covers these rules.
