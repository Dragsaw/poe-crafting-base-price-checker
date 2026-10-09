---
title: 'deferred-nothing-forbids-core-io-clock-randomness: forbid impure globals in core with ESLint'
type: 'chore'
created: '2026-09-26'
status: 'done'
baseline_revision: 'e381f34558f2f7f1fb17a51d4622c9df09bf73a2'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** AD-1 says no `core` module performs I/O, reads the clock, generates randomness, or reads environment or config. The depcruise rules `no-core-to-node-builtin` and `no-core-to-npm-package` see imports only, so a `Date.now()`, `Math.random()`, `fetch(...)` or `process.env` in `packages/core/src` passes `pnpm check`.

**Approach:** Add one ESLint config block scoped to `packages/core/src/**` (tests excluded). It uses `no-restricted-globals`, `no-restricted-properties` and `no-restricted-syntax` to forbid the impure globals. A root test lints probe snippets through the shipped config and asserts that each ban fires and that pure uses pass.

## Boundaries & Constraints

**Always:** The block lives in `eslint.config.mjs`, at `error` severity, and its comment cites AD-1. Each message names AD-1 and says that the caller passes the value in. `Date.parse(...)` and `new Date(<arg>)` stay allowed: they are pure, and `packages/core/src/chunk-order.ts` uses `Date.parse`. `packages/core/src/**/*.test.ts` is exempt. The existing `core` source passes `pnpm lint` unchanged.

**Never:** No change to AD-1, the PRD, the depcruise rules or the package graph. No new dependency. Do not scope the block to `sync`, `web` or `contracts`. Do not touch `docs/stories/deferred-work.md` or `sprint-status.yaml`. Do not forbid timers (`setTimeout`) or `console`: the entry covers I/O, the clock, randomness and env only.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Clock | `Date.now()`, `new Date()` with no argument, `performance.now()` in `packages/core/src/x.ts` | ESLint error | `pnpm lint` exits non-zero |
| Randomness | `Math.random()`, `crypto.randomUUID()` | ESLint error | same |
| Env | `process.env.X`, `process.argv` | ESLint error | same |
| I/O | `fetch(url)`, `new XMLHttpRequest()`, `new WebSocket(u)`, `localStorage`, `globalThis.fetch(url)` | ESLint error | same |
| Pure date use | `Date.parse(s)`, `new Date(s)` | no error | none |
| Core test file | `packages/core/src/x.test.ts` calls `Date.now()` | no error | none |
| Other package | `packages/sync/src/x.ts` calls `Date.now()` | no error from the block | none |

</intent-contract>

## Code Map

- `eslint.config.mjs` -- one `tseslint.config(...)` array: an ignores block, then one block over `packages/**`, `test/**`, `tools/**` and the root configs. Add the `core` block after it. The non-type-checked `recommended` set needs no `parserOptions.project`, so `lintText` works on a file path that does not exist.
- `packages/core/src/chunk-order.ts:81,97` -- `Date.parse(...)` on passed-in ISO strings. It must stay legal.
- `vitest.config.ts` -- the root project includes `test/**/*.test.ts` with `test/setup.ts` (the MSW no-network guard). A new test in `test/` runs there and is typechecked by `tsconfig.tools.json` (`test/**/*.ts`).
- `test/` -- workspace-level guards live here, for example `test/contracts-isolation.test.ts`.
- Tooling: Serena was not available in this session. All touched files are config or a small test, so Read and Edit apply.

## Tasks & Acceptance

**Execution:**
- `eslint.config.mjs` -- add a block with `files: ['packages/core/src/**/*.{ts,tsx,mts,cts}']` and `ignores: ['packages/core/src/**/*.test.{ts,tsx,mts,cts}']`. Rules: `no-restricted-globals` for `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator`, `localStorage`, `sessionStorage`, `indexedDB`, `document`, `window`, `globalThis`, `self`, `process`, `crypto`, `performance`; `no-restricted-properties` for `Date.now` and `Math.random`; `no-restricted-syntax` for `NewExpression[callee.name='Date'][arguments.length=0]` and a zero-argument `CallExpression` of `Date` (`Date()` returns the current time as a string). Update the header comment -- this makes AD-1 purity through globals checkable.
- `test/core-purity-lint.test.ts` -- new. Build `new ESLint({ cwd: <repo root> })` and call `lintText(code, { filePath })` for each matrix row. Assert that each impure snippet gives at least one error from one of the three rules, and that each allowed snippet gives none of them.

**Acceptance Criteria:**
- Given the shipped config, when `pnpm check` runs on the clean tree, then it passes.
- Given the shipped config, when a `core` source file temporarily calls `Date.now()`, then `pnpm lint` fails and names `no-restricted-properties` (manual, then reverted).

## Spec Change Log

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 24 findings — high 0, medium 2, low 18, false 4, maybe-false 0
- findings:
  - `[medium]` `[patch]` Blind: `Date(x)` with an argument reads the clock and passes lint — dropped `[arguments.length=0]` from the `CallExpression` selector, and added a `Date(s)` probe.
  - `[low]` `[reject]` Blind: aliasing (`const D = Date`), `Reflect.construct(Date, [])` and `new Date(...[])` bypass the bans — deliberate evasion is unlikely in everyday code, and closing it needs dataflow or broad value bans. That is more than a direct fix.
  - `[low]` `[reject]` Blind: `Date.parse(s)` / `new Date(s)` on a string without an offset depends on the host time zone — the spine stores ISO-8601 UTC strings (Conventions, dates and time), and banning a legal pure call adds rule complexity.
  - `[low]` `[patch]` Blind: the allow tests pass vacuously if a path is ignored or unmatched — added `calculateConfigForFile` controls for the three probe paths, and a no-`fatal` assertion on every lint result.
  - `[low]` `[patch]` Blind: the I/O messages say "the caller passes the value in", but AD-1 routes I/O through a port — the I/O and global-object bans now end "`sync` or `web` does it through a port."
  - `[low]` `[patch]` Blind: seven banned names have no probe — same root cause as the verification-gap finding. One IMPURE row now covers each name.
  - `[low]` `[reject]` Blind: only `.ts` paths are probed — `core` has no `.tsx`/`.mts` source, and the glob is one brace pattern for all four extensions.
  - `[low]` `[reject]` Blind: `AGENT-WORKFLOW.md` does not mention the ESLint block — nothing it says is false ("No I/O, no clock, no randomness, no env — ever (AD-1)" still holds). An edit to an agent-context file is defer-only, and it closes no harm that anyone named.
  - `[false]` `[reject]` Blind: the spec is not in the diff — this is on purpose. The spec is the claims file and goes to the edge-case layer only.
  - `[low]` `[patch]` Blind: the header comment points at "the last block" by position — the rationale moved to a docblock on `coreRestrictedGlobals`, and the block's comment cites it.
  - `[medium]` `[patch]` Edge: `Date(x)` is not caught — duplicate of the first finding, same patch.
  - `[low]` `[reject]` Edge: alias and spread bypasses — duplicate of the aliasing finding, same reason.
  - `[low]` `[patch]` Edge: Node's `global` is not banned — added to the whole-object list, with a `global.fetch` probe.
  - `[false]` `[reject]` Edge: `console` and timers are not banned — neither is one of the four categories that the intent names (I/O through a port, clock, randomness, env). AD-1's effect ports are HTTP, filesystem, git and time.
  - `[low]` `[patch]` Edge: `Temporal.Now`, `location` and `caches` are not banned — added, each with a probe.
  - `[low]` `[patch]` Edge: fatal parse or ignored-file results make the allow tests vacuous — duplicate of the vacuous-allow finding, same patch.
  - `[low]` `[patch]` Edge: an IMPURE row passes on an unrelated rule — each row now names its expected ruleId, and the test asserts it.
  - `[low]` `[patch]` Edge (claim): the comment "`Date()` returns the current time" understated the ban — the comment is corrected with the selector patch.
  - `[low]` `[patch]` Verification gap: seven banned globals are unprobed — rows added for `EventSource`, `navigator`, `sessionStorage`, `indexedDB`, `document`, `window` and `self`.
  - `[low]` `[reject]` Verification gap (other): `new Intl.DateTimeFormat().format()` with no argument reads the clock implicitly — it is rare in valuation code, and detecting a no-argument `format` on an `Intl` instance needs type information. `Temporal.Now` is patched above. Timers and `console` are rejected above.
  - `[low]` `[reject]` Intent: the automated test drives `lintText`, not the `pnpm check` gate — both use the same config resolution. The new `calculateConfigForFile` control pins the scope, and the manual `pnpm lint` probe below exercised the gate.
  - `[false]` `[reject]` Intent: indirect bypasses (alias, `Reflect.get`, `Function('return this')`) — the summary's "through globals" is made false for every direct global form. The indirect forms are the aliasing finding, rejected above.
  - `[low]` `[patch]` Intent: `import.meta.env` is an unbanned env read — added a `no-restricted-syntax` selector and a probe.
  - `[false]` `[reject]` Intent: banning `globalThis` outright affects a future legitimate use — `core` has no use of it today, and the ban is the design (Design Notes).

## Design Notes

`globalThis`, `self` and `window` are banned whole: otherwise `globalThis.fetch` or `globalThis['Date'].now()` bypasses the name bans. `core` has no use for any of them. `Date` itself cannot be banned whole, because `Date.parse` is pure and in use. `no-restricted-properties` also catches a destructured `const { now } = Date`.

## Verification

**Commands:**
- `pnpm check` -- expected: pass.
- `pnpm test` -- expected: all pass, including `test/core-purity-lint.test.ts`.

## Auto Run Result

Status: done

**Summary:** ESLint now enforces AD-1 purity through globals in `core`. A block scoped to non-test files under `packages/core/src/` bans the I/O globals (`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator`, the storage APIs, `document`, `location`, `caches`). It bans the global object whole (`globalThis`, `window`, `self`, `global`), and it bans `process`, `crypto` and `performance`. It bans `Date.now`, `Temporal.Now` and `Math.random`, a zero-argument `new Date()`, any `Date(...)` call and `import.meta.env`. `Date.parse(s)` and `new Date(s)` stay legal. A `Date.now()` in `core` now fails `pnpm check`.

**Deviation from Tasks:** the review widened the task list. `Date(...)` is banned with any argument count, not only zero, because it ignores its arguments. `global`, `location`, `caches`, `Temporal.Now` and `import.meta.env` were added. The I/O messages point to a port rather than to a passed-in value.

**Files changed:**
- `eslint.config.mjs` -- the `core` purity block, the `coreRestrictedGlobals` list with its AD-1 rationale, and the message helpers.
- `test/core-purity-lint.test.ts` -- new. It lints one probe per ban through the shipped config and asserts the expected rule. It also checks the allowed pure uses, and the exemptions for core tests and other packages, with `calculateConfigForFile` scope controls and no-fatal assertions.

**Review:**
- 24 findings: 13 patch rows, which make 8 patch entries. No entry was deferred. 11 findings were rejected, with the reasons in the triage log.
- Patched: 1 medium entry (`Date(x)`) and 7 low entries.

**Follow-up review recommended:** false. The first pass patched no high and one medium.

**Verification:**
- `pnpm check` passes.
- `pnpm test` passes: 71 files, 884 tests.
- Manual check: a temporary `packages/core/src/zz-probe.ts` that called `Date.now()` made `pnpm lint` fail with `no-restricted-properties` and the AD-1 message. The implementer removed the file afterwards.

**Residual risks:** name-based lint rules do not follow aliases (`const D = Date; D.now()`), `Reflect` or `Function('return this')()`. They also cannot see an implicit clock read such as a no-argument `Intl.DateTimeFormat().format()`. All of these were rejected as deliberate or rare forms.
