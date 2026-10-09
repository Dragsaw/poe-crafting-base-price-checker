---
title: 'Story 1.3: One governed trade client that paces itself from live headers'
type: 'feature'
created: '2026-09-20'
status: 'done'
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
- **Renegotiated 2026-09-20 (human).** Every `4xx` counts toward GGG's **Invalid Requests Threshold**, which revokes access; the documentation requires reasonable attempts to avoid passing it. The client therefore counts `4xx` responses **per policy**, surfaces the running count on every result, and **refuses to issue** once the threshold is reached, returning a yield that names the threshold as its reason rather than spending further. The threshold is **passed into the factory as a value** — no threshold number is compiled in, exactly as no rate is.
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
| An invalid request is counted | `403` against a governed policy | Returned as a response, and the result carries the running invalid-request count for that policy | No error expected |
| Invalid-request threshold reached | The threshold passed into the factory has been seen on one policy | The next request against that policy is **not issued**; a yield naming the threshold as its reason is returned | Yield is a returned value, never a throw |
| A policy shared across endpoints | Two lanes whose responses report the same `X-Rate-Limit-Policy` | Both pace off the one shared ledger entry, as the API documents a shared policy to behave | No error expected |
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
- [x] `packages/sync/src/trade/rate-limit-headers.ts` — pure parse of `X-Rate-Limit-Rules`, the per-rule policy and `-State` headers, and `X-Rate-Limit-Policy` into a `{policy, rules: [{name, buckets: [{hits, seconds, penalty}], state: [...]}]}` value. Positional pairing, skip-and-record on a malformed or absent rule. Pure, so the traps are testable without a client.
- [x] `packages/sync/src/trade/ledger.ts` — the per-policy bucket ledger and the tightest-unsatisfied delay computation. Takes the parsed headers and an instant; returns milliseconds to wait, `0` when clear. Pure — no clock, no `wait`.
- [x] `packages/sync/src/trade/user-agent.ts` — read `POE_SYNC_USER_AGENT` once at the shell edge and return it, or a typed refusal when it is unset or blank. The only `process.env` read in `sync`.
- [x] `packages/sync/src/trade/invalid-requests.ts` (or inside `client.ts` if smaller) — the per-policy `4xx` counter and the threshold refusal added by the 2026-09-20 renegotiation. The threshold is a factory value; the count is surfaced on every result; reaching it yields instead of issuing.
- [x] `packages/sync/src/trade/client.ts` — `createTradeClient({ http, clock, wait, userAgent })`. Applies the standing headers, consults the ledger, waits, issues through `HttpPort`, folds the response headers back into the ledger, and returns a discriminated result: a response or a yield.
- [x] `packages/sync/src/index.ts` — export the factory and its result types; `export type { … }` for every type.
- [x] `packages/sync/src/fixtures-record.ts` — the human-invoked recorder. Issues the five GET interactions through the same client, writes captured payloads under `fixtures/`, strips personal identifiers before writing, and refuses to run when `POE_SYNC_USER_AGENT` is absent.
- [x] `package.json` (root) — add `"fixtures:record": "node packages/sync/src/fixtures-record.ts"`, following the `sync:dry` precedent.
- [x] `fixtures/README.md` — the naming and hygiene rules the directory holds itself to: one fixture per distinct interaction shape, named for the interaction and not for a test, structure kept even where unused.
- [x] `.env.example` — `POE_SYNC_USER_AGENT` with a placeholder value showing the expected shape (tool name, version, contact), plus a `.gitignore` entry for `.env`. **Created by the human on 2026-09-20** and tracked by git; the agent permission profile denies every `./.env*` path, so its contents were never read back by an agent. Previously blocked: `.gitignore` already carries `.env`, `.env.*` and `!.env.example` (Story 1.1), but the agent permission profile denies writing any `./.env*` path, so the example file must be created by a human. Its content is in Implementation Notes below.
- [x] `packages/sync/src/trade/*.test.ts` — one co-located suite per module, covering every I/O matrix row against `createFakeHttpPort`, `createFakeClockPort` and a recording fake `wait`.
- [x] `packages/sync/src/fixtures-record.test.ts` — assert the recorder is not reachable from a test run and that its identifier-stripping removes account and character names from a captured payload.

**Acceptance Criteria:**
- Given the whole repository, when it is searched for a trade-API rule name or a rate constant outside a test or a fixture, then there is no match — the client learns both from headers.
- Given a second call site in `sync` that wants a trade request, when it is written, then the only exported way to make one is the client factory, and `HttpPort` is not re-exported from `sync`.
- Given `pnpm check`, when it runs, then typecheck, lint and dependency-cruiser pass and `sync` still declares only its two allowed workspace edges.
- Given `pnpm test`, when it runs, then every I/O matrix row is asserted, no wall-clock delay elapses, and `assertNoEscapedRequests` reports nothing.
- Given `pnpm fixtures:record`, when a human invokes it, then it issues live requests through the governed client and its output is a reviewable diff under `fixtures/`; when a test run executes, then nothing invokes it.

## Implementation Notes

**A request is paced through an opaque `lane`, and the ledger still keys on the policy.** A
response names its own policy, but a request has to be paced *before* one arrives, so the
client remembers which policy each lane's last response carried and paces the next request in
that lane against that policy's ledger entry. The lane is an opaque caller label whose default
**drops the final path segment**, because that is where a trade URL varies — a result id on a
fetch, a league on a search — and keeping it would make every fetch its own lane, so the memo
would miss on every call and each request would issue unpaced. The memo is capped at 64 lanes,
least recently used evicted, since its key space is the caller's. The client never interprets
the label, never compares it to a
literal, and never maps it to a policy in code. This does not reopen the design note above —
the ledger is keyed on `X-Rate-Limit-Policy` exactly as decided, and the lane is only the memo
key that says which entry to consult. Without it there is no way to honour *"the fetch is not
paced by the search's consumption"* on the fetch's first request, because a cold lane has no
policy and pacing against every known policy would cross the buckets the ledger keeps apart.

**A bucket is unsatisfied at `state.hits >= policy.hits`, not below it.** The state header
describes the situation *after* the response that carried it, so remaining allowance is exactly
what the next request is for. The client issues serially and folds every response back in, so
the consumption is never more than one request out of date. *Tightest* is resolved as the
**maximum** delay across every unsatisfied bucket of every rule in the policy — the bucket that
makes you wait longest, which is not always the one with the shortest window.

**`allowImportingTsExtensions` was added to `packages/sync/tsconfig.json`, and the `trade/`
modules import each other with an explicit `.ts`.** `pnpm fixtures:record` runs
`node packages/sync/src/fixtures-record.ts` directly, following the `sync:dry` precedent, and
Node's type stripping performs **no extension resolution** — a relative specifier without `.ts`
on that entry path fails with `ERR_MODULE_NOT_FOUND` (verified). The flag is permitted because
the package is `emitDeclarationOnly`. `src/index.ts` keeps extensionless specifiers, since it is
never on the `node` entry path and its emitted declarations resolve more cleanly without them.

**The Invalid Requests Threshold is counted on the ledger's own key.** `4xx` counts live in
`trade/invalid-requests.ts`, keyed per policy exactly as the buckets are, so a run of invalid
searches never closes the fetch bucket. A response that named no policy is counted under a
single ungoverned key rather than going free — a `403` is the response *least* likely to carry
rate-limit headers. The threshold is optional on the factory: omitted, nothing is refused and
the running count still rides on every result, which is right for a short command that aborts
on its own first failure (`fixtures:record` does) and wrong for a chunk run, which will pass
the player's declared number in Story 1.5. A threshold yield carries `retryAfterMs: 0` and the
reason `invalid-request-threshold`, because that breach is the one limit waiting does not
clear. The yield's `reason` field replaced `retryAfterSource`, and its `response` is absent
there — nothing was issued.

**`Retry-After` is honoured in delta-seconds only.** An HTTP-date form is treated as absent and
the yield delay derives from the ledger's penalties instead, because a half-parsed date is a
`NaN` delay that compares false against every threshold and silently disables the yield.

**`.env.example` could not be written and is the one outstanding file.** The agent permission
profile denies every `./.env*` path. `.gitignore` already carries `.env`, `.env.*` and
`!.env.example` from Story 1.1, so only the file itself is missing. Create it with:

```
# Copy to `.env` (git-ignored) or export in your shell before running any command that
# reaches the live trade API — `pnpm fixtures:record` today, `pnpm sync` and
# `pnpm catalogue:refresh` later.
#
# NFR-9 / AD-8: every request identifies the tool and a contact address. This is ONE
# variable holding the whole `User-Agent` header verbatim — nothing is composed in code, so
# the tool name has exactly one spelling and the contact address lives outside the
# repository. Unset or blank, the trade client refuses before it issues anything.
POE_SYNC_USER_AGENT=poe-crafting-base-price-checker/0.0.0 (+https://github.com/you/poe-crafting-base-price-checker; contact: you@example.com)
```

## Spec Change Log

**2026-09-20 — human renegotiation of the frozen intent, not a review loopback.** Triggered by two gaps read off GGG's API documentation: the Invalid Requests Threshold (all `4xx`, explicitly `401`, `403` and `429`, count toward a threshold that revokes access, with a documented duty to avoid passing it) had no implementation, no counter and no test, so a caller looping on a `403` spent the threshold at full speed; and no test covered a policy shared across endpoints, which the documentation names explicitly. Amended: one Boundaries bullet and three I/O matrix rows. Known-bad state avoided: the client special-casing `429` alone while every other `4xx` returned as an ordinary response with no accounting — the threshold is the one limit whose breach is not recoverable by waiting. KEEP: the per-policy ledger keyed on `X-Rate-Limit-Policy`, the yield-never-retry shape of a `429`, the pure header parse, and the rule that no rate, window, penalty or threshold is compiled in — the threshold arrives as a factory value like every other number.

## Review Triage Log

Iteration 1 — layers: blind-hunter, edge-case-hunter, verification-gap.

### Routed to patch

| # | Verdict | Finding and evidence |
|---|---|---|
| 1 | high | **Default lane leaves a per-id request unpaced.** `laneOf` defaults to `"<METHOD> <pathname>"`, and a fetch URL carries its ids in the path, so every distinct id set is a new lane, `lanePolicies.get(lane)` is `undefined`, `paceBeforeNext` returns `CLEAR`, and the request issues with no pacing. Verified at `client.ts:111-120,171-178`; the only default-lane test re-sends the same URL twice, so the varying-path case never runs. The recorder passing an explicit `DATA_LANE` is itself evidence the default is a trap for Story 1.7. `lanePolicies` also grows unbounded over that lane space. |
| 2 | high | **A yield can carry zero delay.** `fromHeader ?? derived` keeps a literal `Retry-After: 0` (`??` does not treat `0` as absent), and `derivedYieldDelayMs` returns `0` when the policy was never observed — so a `429` on a lane's first request yields `0 ms` while naming the source `derived-penalty`. A runner trusting that delay re-enters immediately against an endpoint that just rate-limited it. Verified at `client.ts:139-152,199-210` and `ledger.ts:154-183`. |
| 3 | medium | **`recordObservation` widens the allowance it was written to protect.** It replaces the whole per-policy entry with `parsed.rules`, so a later response whose second rule is malformed drops that rule's saturated buckets from the ledger and stops pacing against them — the exact silent widening its own doc comment argues against. Verified at `ledger.ts:65-77`. |
| 4 | medium | **Two concurrent `send` calls pace on the same stale ledger.** The read-pace-issue sequence is not serialized; the "issues serially" reasoning at `client.ts:174-178` is an assumption, not an enforced property, and a caller that fetches ids with `Promise.all` overspends the bucket. |
| 5 | medium | **The record-time identifier strip has two holes.** Only a *string* directly under an exact key is redacted, so an identifier inside an array (`{"characterNames":["Bob"]}`) passes through the `Array.isArray` branch unredacted (`fixtures-record.ts:98-113`), and `whisper`/`whisper_token` — whose value is literally `@CharacterName …` — are not in `IDENTIFIER_KEYS`. Not reachable through today's five catalogue interactions, but this is the committed hygiene control Stories 1.4 and 1.7 will record listings through. |
| 6 | medium | **The recorder's two guarantees are asserted as source text, not behaviour** (verification-gap, pre-verified). `main`, `createFetchHttpPort` and the write pipeline are untested: deleting `stripPersonalIdentifiers(` from the `writeFile` call, or dropping the trailing newline, or swapping `client.send` for a bare `fetch`, leaves all five tests green. The entry guard is checked with `toContain('invokedDirectly')`, which still passes if the guard is inverted or deleted. `dry-run.test.ts` already establishes the `execFile` precedent. |
| 7 | medium | **The recorder leaves `fixtures/` half-written and can hang.** It writes each fixture inside the loop and returns on the first yield or non-200, mixing old and new API shapes in one commit; `JSON.parse` of a 200 HTML interstitial surfaces only as `String(error)`; `createFetchHttpPort` passes no `AbortSignal`, so a hung connection blocks the command indefinitely. |
| 8 | medium | **The barrel exports a parallel pacer.** `index.ts` exports `paceBeforeNext`, `recordObservation`, `EMPTY_LEDGER`, `derivedYieldDelayMs` and `parseRateLimitHeaders`. The spec's task is "export the factory and its result types"; withholding `HttpPort` to make a second pacer inconvenient is undone when the pieces to assemble one ship in the same public surface. Named harm: Story 1.7 or 1.11 builds its own pacing without ever touching `@poe/contracts`. |
| 9 | low | **AC-1 rests on human discipline.** "No rule name or rate constant in non-test source" is stated as a repository-wide search and nothing runs it; `fixtures-record.test.ts` already proves the source-scanning pattern is available here. |

### Rejected

| Verdict | Finding and refutation |
|---|---|
| false | *Unrelated edits ride along (`epic-1-context.md`, `sprint-status.yaml` 1-1/1-2 → done).* Not caused by this change: the spec's recorded `baseline_commit` predates commit `38eae07`, so that commit's documentation edits appear in the diff. `git status` shows neither file touched by this story beyond the 1-3 status line. |
| false | *`derivedYieldDelayMs` is not "the tightest bucket's penalty".* The matrix row requires a yield, a derived delay and a named source; max-attributed-else-max-declared satisfies all three and is the conservative reading. The genuine defect in that row is the zero case, filed as #2. |
| low | *A multi-hour pace could hold Story 1.5's lock.* Reaching it needs the 600/21600s bucket saturated, which a bounded chunk stops far short of; the 10s/60s/300s buckets govern in practice. The fix adds a new result branch the spec does not describe, so it is more than a direct correction. |
| low | *`hits: 0` in a declared bucket paces forever.* No evidence the API declares one; the fix adds a branch guarding state never demonstrated. |
| low | *`parseBuckets` accepts digit strings beyond `Number.MAX_SAFE_INTEGER`.* The regex already bounds the value to digits; the harm is hypothetical and the guard is pure complexity. |
| low | *A body on PUT/PATCH gets no content type.* The spec specifies the JSON content type for POST; no other method has a call site, and inventing one guards undemonstrated state. |
| low | *Fixtures capture the body only, not status and headers.* A rate-limit header change is already visible at runtime as a recorded skip returned to every caller, and capturing response headers would newly require redacting `set-cookie` — more than a direct correction. |
| low | *The `.ts` / extensionless specifier split is unguarded.* Typecheck and a real `node` invocation both pass today; a lint rule is added machinery for a convention one comment already explains. The stale "four levels up" comment is corrected under #7. |
| false | *Importing the recorder means a test run can reach it.* The entry guard makes the import inert; that the guard is not *verified* is the real finding, filed as #6. |

### Known, outside the patch loop

| Verdict | Finding |
|---|---|
| medium | **`.env.example` does not exist** while `missingUserAgentMessage()` and `fixtures/README.md` both point a reader at it. The agent permission profile denies every `./.env*` path; the human is creating the file from the content in Implementation Notes, and the task stays unchecked until it lands. |

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
