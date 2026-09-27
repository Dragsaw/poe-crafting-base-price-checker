---
type: testing
title: Test strategy and network guards
description: How the Vitest suite is organised into per-package projects plus a root project of workspace guards, how the shared MSW setup blocks and attributes every escaped network request, how the guard itself is tested in child Vitest runs, and how port fakes, recorded fixtures and the web artifact server replace live effects.
tags: [testing, vitest, msw, no-network, fixtures, fakes, jsdom]
verified:
  - by: openwiki/0.6.0
    at: 2026-09-27T12:20:24.418Z
sources:
  - id: openwiki-source-c0f6629587ebf863c9fd5ce3
    resource: repo://fixtures/README.md
  - id: openwiki-source-ea0ee5e3beb707ae9018055e
    resource: repo://packages/contracts/src/ports/fakes/http.ts
  - id: openwiki-source-1ab71563450d38af3980fb7d
    resource: repo://packages/sync/src/catalogue-refresh.test.ts
  - id: openwiki-source-d6250e3c0048c6be07b92adf
    resource: repo://packages/sync/src/pricing/fixture-port.ts
  - id: openwiki-source-3041748540f59eec928d359e
    resource: repo://packages/sync/vitest.config.ts
  - id: openwiki-source-c560b764fea9e1d479552dbb
    resource: repo://packages/web/src/test-setup.ts
  - id: openwiki-source-d518aa7bfa6850809e2f0f46
    resource: repo://packages/web/src/test-support/artifact-server.ts
  - id: openwiki-source-ccecd3ec2865b64b4ea6f780
    resource: repo://packages/web/vite.config.ts
  - id: openwiki-source-d121a27980b15c40a65a882b
    resource: repo://test/guard-concurrent.test.ts
  - id: openwiki-source-edc56974d2238006e97de858
    resource: repo://test/guard-hooks.test.ts
  - id: openwiki-source-d9fc82535f361fd626106952
    resource: repo://test/guard-linger.test.ts
  - id: openwiki-source-68cc724e693cd093c4f1d027
    resource: repo://test/guard-reuse.test.ts
  - id: openwiki-source-11c141224a72985968f722ac
    resource: repo://test/setup.ts
  - id: openwiki-source-fbadcd8591b65031efaaedce
    resource: repo://vitest.config.ts
generated: { by: "claude-code", at: "2026-09-27T12:20:24.418Z" }
---

# Test strategy and network guards

**No test at any level makes a network call.** Every effect is replaced: by a port fake from `@poe/contracts`, by a recorded fixture captured from the real API, or, for the web page, by MSW handlers. A shared setup file blocks anything that escapes and fails the test that caused it.

## Layout and commands

`pnpm test` runs `vitest run`. The root `vitest.config.ts` declares projects, because Vitest 5 has no `vitest.workspace.ts`:

- `packages/*`: each package's own config. `contracts`, `core` and `sync` run in Node with `src/**/*.test.ts`. `web` is declared in `packages/web/vite.config.ts` and runs under **jsdom** with `src/**/*.test.{ts,tsx}`.
- `root`: the workspace-level guards that belong to no package: `test/**/*.test.ts`, `tools/boundary-check/*.test.ts`, `tools/dts-specifiers/*.test.ts` and the tracked-json skill's script tests.

Every project lists `test/setup.ts` in `setupFiles`. `web` also adds `src/test-setup.ts`, which provides jsdom shims for Mantine and React 19 (`matchMedia`, `ResizeObserver`, `IS_REACT_ACT_ENVIRONMENT`).

`pnpm test` does not run in the deploy workflow (see [Build, typecheck and deploy](../operations/build-typecheck-and-deploy.md)).

## The no-network guard (test/setup.ts)

The guard is an MSW `setupServer()` whose `onUnhandledRequest` is a **callback**, not the `"error"` string. The string mode only reports the request. The callback does three things for a remote request:

1. records `METHOD URL` and the identity of the test that issued it;
2. **throws**, which stops the request before it reaches the network;
3. lets hooks fail the test afterwards, even when the test body swallowed the rejection.

Only `file:` URLs and loopback hosts (`localhost`, `127.0.0.1`, `::1`) pass through, because jsdom and Vite load assets that way. There is no exemption by file extension. A passthrough performs the request for real, so exempting `*.json` would exempt every trade endpoint.

Attribution and lifecycle:

- `beforeEach` stores the running test's `{id, name}` in an `AsyncLocalStorage` with `enterWith`. Timers and promise continuations started by the test therefore carry its identity, and a request the test did not await is still charged to it.
- `afterEach` resets the handlers and fails the test on **its own** escaped requests only.
- `afterAll` fails the file on anything still recorded, including requests issued outside any test and late requests from earlier tests, and names the issuer of each.
- The server, the record and the identity store live in one object on `globalThis` (`Symbol.for(...)`). In a reused worker (`isolate: false`), later files share one interceptor instead of stacking a second one. The server is **never closed**, so a timer that fires after `afterAll` is still blocked.

`drainEscapedRequests()` and `assertNoEscapedRequests(owner?)` are exported for tests of the guard itself. `test/no-network.test.ts` uses them.

When a new test setup is needed, copy `test/setup.ts`. Do not replace the callback with `"error"`.

### Testing the guard

The real hooks are tested by running a **child Vitest** over a fixture directory with its own config, then reading the outcome that Vitest reported. All fixture URLs are under `.invalid`, so the child needs no network.

| Test | What it proves |
| --- | --- |
| `test/guard-hooks.test.ts` | the real `afterEach` owner check and the `afterAll` file check fire |
| `test/guard-concurrent.test.ts` | under `describe.concurrent`, each test's `afterEach` names only its own URL. A barrier proves the pair really ran concurrently. |
| `test/guard-linger.test.ts` | requests from suite and file hooks are reported as issued outside any test, never charged to a test |
| `test/guard-reuse.test.ts` | in a reused worker, a late timer from file A is blocked and reported by file B |

## Other workspace guards

| Test | Guard |
| --- | --- |
| `test/contracts-isolation.test.ts` | manifest workspace edges match `ALLOWED_EDGES` |
| `tools/boundary-check/boundary.test.ts` | the shipped dependency-cruiser config catches forbidden edges in fixture trees |
| `test/core-purity-lint.test.ts`, `test/core-rank-purity.test.ts` | `core` purity bans fire |
| `test/no-hardcoded-rate-limits.test.ts` | no rate-limit rule, policy or rate constant in non-test source |
| `test/prune-pages.test.ts` | the Pages prune step |
| `test/commit-msg-hook.test.ts` | the commit subject rules |

See [Package graph, ports and purity boundaries](../architecture/package-graph-and-ports.md) for what these guards protect.

## Replacing live effects

- **Port fakes.** `createFakeHttpPort(fixtures)` answers requests keyed `"METHOD url"`, records every request it received, and **rejects** an unfixtured request instead of returning a default 404. Filesystem, git and clock fakes work the same way. Units take ports as values, so `sync` tests build a chunk entirely in memory. `run-chunk.test.ts` is the largest suite.
- **Recorded fixtures.** `fixtures/` holds real trade-API responses captured by `pnpm fixtures:record`, a command that only a human runs. Nobody writes a fixture by hand. Personal identifiers are redacted when the fixture is recorded. The pricing fixture port (`packages/sync/src/pricing/fixture-port.ts`) serves `trade-search-*`/`trade-fetch-*` files by a digest of method, URL and body. It serves `trade-data-leagues.json` for the league gate. It rejects any other request with a message that names the missing fixture. `price-entry.fixtures.test.ts` and `pnpm sync:dry` use it.
- **Web artifact server.** `packages/web/src/test-support/artifact-server.ts` registers MSW handlers for all eight artifacts on the shared server, with minimal valid bodies. Every web fetch test registers all eight. Loopback URLs pass through the guard, so a missing handler would reach a real socket instead of failing.

## Commands no test runs

`pnpm sync`, `pnpm catalogue:refresh` and `pnpm fixtures:record` each have an entry guard, so importing the module runs nothing. Their tests drive the exported functions (`syncCommand`, `refreshCatalogue`, `recordFixtures`) against fakes. `createFetchHttpPort` runs only in `shell-fetch.test.ts`, against a loopback `node:http` server, and a test asserts that no other test file names it.
