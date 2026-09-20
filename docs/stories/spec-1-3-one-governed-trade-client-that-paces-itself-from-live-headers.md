---
title: 'Story 1.3: One governed trade client that paces itself from live headers'
type: 'feature'
created: '2026-09-20'
status: 'ready-for-dev'
route: 'full'
review_loop_iteration: 0
baseline_commit: '34e064138ccd2ca2471518275e86865b38a1cbcf'
context:
  - '{project-root}/docs/stories/epic-1-context.md'
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md'
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `packages/sync` has no request path at all — two placeholder exports and a `sync:dry` stub. Stories 1.4, 1.7 and 1.11 each need to reach the trade API, and if any of them builds its own call, two call sites pace independently against one shared budget. The endpoint is undocumented, unsupported surface; losing access to it ends the product.

**Approach:** One governed trade client in `sync`, wrapping the `HttpPort` that `contracts` already declares. It learns the active rule names from `X-Rate-Limit-Rules` at runtime, keeps a bucket ledger per `X-Rate-Limit-Policy`, waits before issuing when the tightest bucket is unsatisfied, and yields rather than retries on a `429`. The human-invoked `pnpm fixtures:record` lands beside it, so every later story has both a request path and a way to capture what the API actually returned.

## Boundaries & Constraints

**Always:**
- Exactly one module in `sync` issues a trade request. Every later story calls it, and no other call site constructs an `HttpPort` request (FR-20, AD-8).
- Rule names arrive from `X-Rate-Limit-Rules` at runtime. **No rule name is a literal in non-test source** — not `Ip`, not `Client`. For each named rule the client parses `X-Rate-Limit-<Name>` (policy) and `X-Rate-Limit-<Name>-State` (consumption); both are comma-separated `hits:seconds:penalty` triples that pair positionally (`IMPLEMENTATION-NOTES.md` §5.3).
- **No rate, hit count, window or penalty is hardcoded.** The measured 2026-09-12 buckets are an expected shape to assert fixtures against, never a constant to compile in.
- Buckets are ledgered per `X-Rate-Limit-Policy` value, so the search bucket and the fetch bucket never share a ledger. The header names its own policy; no policy string appears in code.
- The client paces against the **tightest unsatisfied bucket** across every rule in the policy it is about to spend against.
- On a `429` the client honours `Retry-After` and returns a **yield** result. It never retries, and it never sleeps out a `429`.
- Every request carries a descriptive `User-Agent` naming the tool and a contact address, read from the environment overlay at the `sync` shell edge and passed into the client as a value. `core` performs no environment lookup for it (NFR-9, Consistency Conventions).
- **Decided:** the overlay is **one variable, `POE_SYNC_USER_AGENT`, holding the whole `User-Agent` string verbatim.** Nothing is composed in code, so the tool name has exactly one spelling and it lives outside the repository. When the variable is unset or blank, the client **refuses before it issues anything** — a request with no descriptive contact is precisely what NFR-9 forbids, and a silent generic fallback would make the omission invisible until GGG noticed it.
- **Decided:** `fixtures:record` captures **the five GET endpoints the recorder can construct by itself today** — leagues plus the four `data/*` endpoints. Stories 1.4 and 1.7 each add their own interaction when they have a real request to record. No request body is hand-written here; a hand-written body records what the team believes the API takes rather than what it takes, which is the defect the fixture rules exist to prevent.
- Every request carries `x-requested-with: XMLHttpRequest`; a POST also carries `content-type: application/json` (the captured live shape, `IMPLEMENTATION-NOTES.md` §5.1).
- Time and delay are passed-in values: `ClockPort` for instants, an injected `wait(ms)` for delay. No `Date.now()` and no `setTimeout` is reached below the factory, so a backoff test asserts recorded durations and never waits on the wall clock (NFR-3).
- `pnpm fixtures:record` writes real captured payloads under `fixtures/`, strips every personal identifier at record time, and is referenced by no vitest config.

**Never:**
- No search body construction, no result parsing, no median, no Divine conversion. The client transports; it does not know what a trade query means (Story 1.7).
- No catalogue refresh command (1.4), no league gate (1.11), no chunk runner, lock or progress file (1.5). This story ships the path those stories spend through.
- No retry of any kind, no request queue, and no ledger persisted across processes. The ledger is in memory and per client instance.
- No change to `packages/contracts`. `HttpPort`, `ClockPort` and their fakes are used exactly as they stand.
- No `data/` file created or edited. No committed `.env` carrying a real contact address.
- No test reaches the network, and `fixtures:record` is never reachable from a test run.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Cold start | Empty ledger, no response seen | Issues immediately, then seeds the ledger from the response headers | No error expected |
| Rules learned at runtime | `X-Rate-Limit-Rules: Ip,Client` with both pairs present | Both rules ledgered by name; no code names either | No error expected |
| A named rule's headers absent | `Rules: Ip,Client` but no `X-Rate-Limit-Client` | That rule is skipped; pacing continues on the rules that did arrive | Skip is recorded, never thrown |
| Malformed policy header | `X-Rate-Limit-Ip: banana` | That rule is skipped rather than parsed into `NaN`; no bucket is invented | Skip is recorded |
| Tightest bucket governs | State `4:10:0` against policy `5:10:60`, plus a second rule tighter still | Waits via the injected `wait` until the tightest window permits, then issues | No error expected |
| Policies do not cross | A search response, then a fetch request | Each policy keeps its own ledger; the fetch is not paced by the search's consumption | No error expected |
| 429 with `Retry-After` | `429`, `Retry-After: 43` | Returns a yield result carrying 43000 ms and the policy; issues nothing further | Yield is a returned value, never a throw |
| 429 without `Retry-After` | `429`, header absent | Still yields; the delay derives from the tightest bucket's penalty, and the result says it was derived | Yield names its source |
| Non-429 failure | `503` | Returned to the caller as the response, unchanged | The caller decides |
| Contact overlay unset | `POE_SYNC_USER_AGENT` unset or blank | No request is issued; the client refuses at construction | Typed refusal naming the variable |
| Backoff under test | Supplied header values and a fake `wait` | Recorded wait durations are asserted; no wall-clock time passes | No error expected |

</frozen-after-approval>

## Code Map

- `packages/sync/src/index.ts` — the barrel. Holds `SYNC_PLACEHOLDER` and `SYNC_CONTRACTS_SCHEMA_VERSION`; `src/index.test.ts` asserts both. Add the client's exports; leave the placeholders alone unless the suite is updated with them.
- `packages/sync/src/dry-run.ts` — the `sync:dry` stub. Writes to **stderr** and sets `exitCode = 1` on purpose; stdout is reserved as the report channel. `dry-run.test.ts` spawns it via `execFile`. **Do not change it** — AGENT-WORKFLOW pins it as a stub until Story 1.5.
- `packages/contracts/src/ports/http.ts` — `HttpPort.send(HttpRequest): Promise<HttpResponse>`. Header-transparent both ways; **non-2xx is a returned value, never a throw**. Headers are `Readonly<Record<string,string>>` compared lower-case by every adapter and fake.
- `packages/contracts/src/ports/fakes/http.ts` — `createFakeHttpPort(fixtures)`, keyed `"<METHOD> <url>"`, with `respondTo()` and a `requests` log. An unfixtured request **rejects**. This is what the client's tests drive; it is why no MSW handler is needed for unit tests.
- `packages/contracts/src/ports/clock.ts` — `ClockPort.now(): string` only. **There is no `sleep` and this story adds none** (a `contracts` change lands alone and first, per AGENT-WORKFLOW).
- `packages/sync/tsconfig.json` — `types: ["node"]`, so `node:` builtins are available here (unlike `contracts`). `rootDir: src`, `emitDeclarationOnly`.
- `packages/sync/vitest.config.ts` — `include: ['src/**/*.test.ts']`, `setupFiles: ['../../test/setup.ts']`. Co-located tests need no config change.
- `test/setup.ts` — the MSW guard: `onUnhandledRequest` records the URL and throws; exports `drainEscapedRequests`, `assertNoEscapedRequests`, `server`. Loopback and `file:` are exempt. **Copy this callback, never substitute `"error"`.**
- `packages/sync/package.json` — no `scripts` block today; deps are `@poe/contracts` and `@poe/core`, both `workspace:*`. No new dependency is needed.
- Root `package.json` — scripts are `typecheck | lint | depcruise | check | test | dev | sync:dry`. `sync:dry` runs `node packages/sync/src/dry-run.ts` directly, which is the precedent for how a new command is wired.
- `test/contracts-isolation.test.ts` — `ALLOWED_EDGES['@poe/sync'] = ['@poe/contracts', '@poe/core']`. Adding a third-party dependency is fine; adding a `@poe/*` one is not.
- `depcruise.rules.mjs` — `no-sync-to-web` is the only rule this story can trip.
- `tsconfig.base.json` — `verbatimModuleSyntax`, `isolatedModules`, `noUncheckedIndexedAccess`, `noUnusedLocals`. Every type re-export must be `export type { … }`, and every indexed read is `| undefined`.
- `docs/architecture/.../IMPLEMENTATION-NOTES.md` §5.1 (captured request shape) and §5.3 (rate-limit governance). Read, never edit.
- `fixtures/` — **does not exist yet.** This story creates it. No recording harness exists anywhere in the repo.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/sync/src/trade/rate-limit-headers.ts` — pure parse of `X-Rate-Limit-Rules`, the per-rule policy and `-State` headers, and `X-Rate-Limit-Policy` into a `{policy, rules: [{name, buckets: [{hits, seconds, penalty}], state: [...]}]}` value. Positional pairing, skip-and-record on a malformed or absent rule. Pure, so the traps are testable without a client.
- [ ] `packages/sync/src/trade/ledger.ts` — the per-policy bucket ledger and the tightest-unsatisfied delay computation. Takes the parsed headers and an instant; returns milliseconds to wait, `0` when clear. Pure — no clock, no `wait`.
- [ ] `packages/sync/src/trade/user-agent.ts` — read `POE_SYNC_USER_AGENT` once at the shell edge and return it, or a typed refusal when it is unset or blank. The only `process.env` read in `sync`.
- [ ] `packages/sync/src/trade/client.ts` — `createTradeClient({ http, clock, wait, userAgent })`. Applies the standing headers, consults the ledger, waits, issues through `HttpPort`, folds the response headers back into the ledger, and returns a discriminated result: a response or a yield.
- [ ] `packages/sync/src/index.ts` — export the factory and its result types; `export type { … }` for every type.
- [ ] `packages/sync/src/fixtures-record.ts` — the human-invoked recorder. Issues the five GET interactions through the same client, writes captured payloads under `fixtures/`, strips personal identifiers before writing, and refuses to run when `POE_SYNC_USER_AGENT` is absent.
- [ ] `package.json` (root) — add `"fixtures:record": "node packages/sync/src/fixtures-record.ts"`, following the `sync:dry` precedent.
- [ ] `fixtures/README.md` — the naming and hygiene rules the directory holds itself to: one fixture per distinct interaction shape, named for the interaction and not for a test, structure kept even where unused.
- [ ] `.env.example` — `POE_SYNC_USER_AGENT` with a placeholder value showing the expected shape (tool name, version, contact), plus a `.gitignore` entry for `.env`.
- [ ] `packages/sync/src/trade/*.test.ts` — one co-located suite per module, covering every I/O matrix row against `createFakeHttpPort`, `createFakeClockPort` and a recording fake `wait`.
- [ ] `packages/sync/src/fixtures-record.test.ts` — assert the recorder is not reachable from a test run and that its identifier-stripping removes account and character names from a captured payload.

**Acceptance Criteria:**
- Given the whole repository, when it is searched for a trade-API rule name or a rate constant outside a test or a fixture, then there is no match — the client learns both from headers.
- Given a second call site in `sync` that wants a trade request, when it is written, then the only exported way to make one is the client factory, and `HttpPort` is not re-exported from `sync`.
- Given `pnpm check`, when it runs, then typecheck, lint and dependency-cruiser pass and `sync` still declares only its two allowed workspace edges.
- Given `pnpm test`, when it runs, then every I/O matrix row is asserted, no wall-clock delay elapses, and `assertNoEscapedRequests` reports nothing.
- Given `pnpm fixtures:record`, when a human invokes it, then it issues live requests through the governed client and its output is a reviewable diff under `fixtures/`; when a test run executes, then nothing invokes it.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

**Why `wait` is injected rather than added to `ClockPort`.** The backoff test must assert durations without spending them, so the delay has to be substitutable. Adding `sleep` to `ClockPort` would work, but AGENT-WORKFLOW makes a `contracts` change land alone and first, and this story is its only consumer. A `wait: (ms: number) => Promise<void>` parameter on the factory is a passed-in value, which is exactly what NFR-3 asks for, and it costs no cross-package rebuild. If a second consumer appears, promoting it to the port is a small, motivated change.

**Why a 429 yields instead of sleeping.** The two are not the same shape. Pacing is the client's own business — it knows the ledger and nobody else does — so it waits. A `429` means the ledger was already wrong, and the right response is to stop spending, which is a decision about the whole chunk rather than about one request. Returning the delay lets Story 1.5's runner release its lock and exit, which is what "yields the chunk" means; sleeping inside the client would hold the lock through a penalty window.

**Why the ledger keys on the policy header and not on the operation.** The client cannot be told "this is a search" without a caller that knows what a search is, and that caller does not exist until Story 1.7. `X-Rate-Limit-Policy` names the bucket in the response itself, so the split arrives for free and survives GGG adding a third policy.

## Verification

**Commands:**
- `pnpm check` — expected: typecheck, lint and depcruise all pass, zero violations
- `pnpm test` — expected: the new `sync` suites pass, no escaped request, and total runtime shows no backoff delay was actually waited out
- `git status` — expected: clean apart from the intended new files; nothing under `data/`

**Manual checks (if no CLI):**
- `pnpm fixtures:record` is **not** run as part of verification. Confirm by inspection that no vitest config, setup file or test imports `fixtures-record.ts` for execution.
