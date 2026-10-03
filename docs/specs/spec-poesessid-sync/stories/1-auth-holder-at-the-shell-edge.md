---
title: 'The auth holder at the shell edge, and a value that never leaves it'
type: 'feature'
created: '2026-10-03'
status: 'done'
baseline_commit: 'e6557935f6464810cfcdb4c843e0a952f67291dc'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/specs/spec-poesessid-sync/SPEC.md'
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Sync has no way to take the operator's optional POESESSID. Before stories 2 and 3 can probe it and attach it, the value needs one owner that reads it at the shell edge, settles absent and malformed values, and makes sure the value never reaches output, errors or artifacts.

**Approach:** The `pnpm sync` and `pnpm sync:batch` shells read `POESESSID` from their injected `env` and build one opaque, process-scoped auth holder (AD-30, IMPLEMENTATION-NOTES §13.1). A blank value settles `absent` and a value outside the RFC 6265 `cookie-value` grammar settles `malformed`. Each prints one §13.5 line before the first request. The holder goes into each chunk's governor, as the pacing state does. The governor and the shells remove the value from every error and cause chain they pass on (§13.6). A canary test scans all output and written files.

## Boundaries & Constraints

**Always:**
- Only `sync.ts` and `sync-batch.ts` read `POESESSID`, from their `env` dependency. `catalogue-refresh`, `fixtures-record` and `dry-run` cannot reach the holder.
- The holder is opaque: its value is a private field. `toJSON`, `String()` and `util.inspect` of the holder never show the value.
- The console line is the §13.5 identifier, printed through the shell's `stderr` dependency with the shell's existing prefix, e.g. `pnpm sync: unauthenticated (absent)`. One line per process for `pnpm sync` (not per chunk), one per run for `sync:batch`. The `absent` line has no off switch.
- An absent or malformed value never changes the exit code. `POE_SYNC_USER_AGENT` stays the only required value, and its refusal still comes first.
- Redaction mutates errors in place (message, stack, each `cause`), so `isTransportFailure` and error-class checks still classify them. It removes the raw, URL-encoded and base64 forms of the value.
- AD-8 holds: no rule name, count or bucket in code.
- Decision (operator, 2026-10-03): the `.env` documentation goes in `.env.example`, as a commented `POESESSID=` block beside `POE_SYNC_USER_AGENT`. The operator grants access to that file for this story.

**Never:**
- Attach the cookie to any request, send a probe, or print `authenticated`. Story 2 owns the probe, the attach and the settle of a valid value. In this story a valid value builds a holder in an unsettled state and prints no line.
- Read or write `authHoldOffUntil`, or change any schema version. Story 3 and story 2 own those.
- Add an auth field to `SyncRunReport`.
- Hand-edit `openwiki/` pages.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Unset | no `POESESSID` key | `unauthenticated (absent)` once, before the first request; run as today | exit code unchanged |
| Blank | `"   "` | trims to empty → `absent` | as above |
| Malformed | `"a b"`, `"a;b"`, `"a,b"`, `"\"x"`, non-ASCII | `unauthenticated (malformed)`; value not in the line | as above |
| Valid | 32+ chars of cookie-octets, or a DQUOTE-wrapped one | no line; holder unsettled; no request carries a `Cookie` | — |
| Throw with value | a valid canary, and the HTTP port rejects with an error whose message, stack and nested cause quote the canary | the error reaches the caller with every form of the canary replaced | type and `name` preserved |

</frozen-after-approval>

## Code Map

- `packages/sync/src/trade/user-agent.ts` -- `resolveUserAgent(env)` is the pattern to copy for reading at the shell edge; its header says it is the only `process.env` read, which this story extends to the injected `env`.
- `packages/sync/src/sync-batch.ts` -- `syncCommand` L64: UA refusal L66-70, then `runSync` L73. Print the auth line after the UA check, pass the holder into `runSync`/`composeChunk`. `SyncPorts` L49 omits governor-owned ports.
- `packages/sync/src/sync.ts` -- `syncSessionCommand` L528: UA L537-542; `createPacingState()` L544 is where the holder is built once; loop L549-601 passes `pacing` to `composeChunk` each chunk; pass the holder beside it. `main` L610.
- `packages/sync/src/compose-chunk.ts` -- `ComposeChunkPorts` L44-80 (`pacing?` L69); builds `createTradeGovernor` L106-121. Add optional `auth`.
- `packages/sync/src/trade/client.ts` -- `TradeGovernorOptions` L412, `createTradeGovernor` L436, `exchange()` L475 sends at L509-514. Wrap the send (and anything thrown in `exchange`) to redact through the holder, then rethrow. `headersFor` L221 is story 2's attach point; leave it.
- `packages/sync/src/trade/transport-failure.ts` -- classifies `TimeoutError`/`TypeError('fetch failed')`; redaction must keep these classifications.
- `packages/sync/src/shell.ts` -- `createFetchHttpPort` L51-70; Node fetch errors can carry request data in `cause`.
- `packages/sync/src/fixtures-record.ts` L108-115 -- already redacts a `poesessid` key; do not change.
- `packages/sync/src/sync-batch.test.ts` `depsFor` L140-160 and `sync.test.ts` `sessionFor` L152-213 -- reuse for line and canary tests; `recording()` captures written files; `createFakeHttpPort` from `@poe/contracts` records request headers.

## Tasks & Acceptance

**Execution:**
- [x] `packages/sync/src/trade/session-auth.ts` -- new: `SESSION_COOKIE_ENV_VAR`, the `cookie-value` grammar check, `createSessionAuth(env)` returning the opaque holder (state `absent` | `malformed` | unsettled), the §13.5 reason type, `authLine(holder)` for settled states, and `redact(error)` over message, stack and the cause chain -- one owner for the value (AD-30).
- [x] `packages/sync/src/trade/session-auth.test.ts` -- grammar edges from the matrix, trim, opacity of `JSON.stringify`/`String`/`inspect`, redaction of raw, URL-encoded and base64 forms in a nested cause, class and `name` preserved.
- [x] `packages/sync/src/trade/client.ts` -- optional `auth` on `TradeGovernorOptions`; `exchange` redacts every error it passes on.
- [x] `packages/sync/src/compose-chunk.ts` -- thread optional `auth` to the governor.
- [x] `packages/sync/src/sync-batch.ts`, `packages/sync/src/sync.ts` -- build the holder after the UA check, print its line on `stderr`, pass it into each chunk; redact the error in any shell-level catch before printing.
- [x] `packages/sync/src/sync-batch.test.ts`, `packages/sync/src/sync.test.ts` -- absent/malformed line once and before the first request, exit code unchanged, valid value prints nothing and sends no `Cookie`.
- [x] `packages/sync/src/session-auth.canary.test.ts` -- CAP-4 canary over both shells: a 32+ char canary, an HTTP port that throws transport and non-transport errors quoting it (message, stack, cause); scan `out`, `err`, the thrown value and every recorded file for any 8+ char substring in raw, URL-encoded or base64 form.
- [x] `test/session-cookie-shells.test.ts` -- static guard: only `sync.ts`, `sync-batch.ts` and `trade/session-auth.ts` under `packages/*/src` mention `POESESSID` or import `session-auth` (plus `compose-chunk.ts`/`client.ts` for the type), and `fixtures-record.ts`'s existing redaction key.
- [x] `.env.example` -- add a commented, empty `POESESSID=` block: optional, near-full account access, never commit, signing out revokes it.

**Acceptance Criteria:**
- Given any `POESESSID`, when `pnpm test` runs, then `test/no-hardcoded-rate-limits.test.ts` and `test/contracts-isolation.test.ts` still pass.
- Given `pnpm sync` runs several chunks with an absent value, when the session ends, then exactly one `unauthenticated (absent)` line was printed.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Layer | Finding | Verdict | Route | Evidence |
|---|-------|---------|---------|-------|----------|
| 1 | blind, edge | DQUOTE-wrapped value: bare inner octets are not redacted | low | patch | `formsOf` builds forms from the quoted string only; an error quoting the inner value keeps it. Direct fix. |
| 2 | blind | Shell canary cases do not prove the throw path ran | medium | patch | `lines.length > 0` is met by the normal outcome line, so a swallowed throw would pass vacuously. |
| 3 | blind | Shell-level `auth.redact` in the two catch blocks is never exercised | medium | patch | Every canary throw goes through the governor first; removing the shell redaction leaves the suite green. |
| 4 | blind | Guard lets `compose-chunk.ts`/`client.ts` value-import `session-auth` | low | patch | `IMPORTS_HOLDER` matches `import type` and value imports alike. Direct regex fix. |
| 5 | edge | Guard's `catch {}` around package `readdirSync` swallows every error | low | patch | An unreadable package would be skipped silently. Direct fix: rethrow non-`ENOENT`. |
| 6 | blind, edge | `.env.example` hunk missing from the reviewed diff | false | reject | Excluded from the review diff on purpose: the permission settings deny the file. The operator made the edit and `git status` shows it modified. |
| 7 | edge | A very short valid value (e.g. `e`) mangles common substrings on redaction | low | reject | Real POESESSID values are 32-char tokens. A 1-char value is operator error, and the result is a loud failure. The fix adds a length rule that §13.1 does not own. |
| 8 | edge | `""` accepted although the Valid row says 32+ chars | false | reject | §13.1 and the Approach define `malformed` by the RFC 6265 grammar only. The Valid row gives examples, not a floor. |
| 9 | blind, edge | Redaction skips non-plain objects (`Headers`, `URL`, `Map`) | false | reject | This story attaches no cookie, so no request object can hold the value. Story 2's attach and canary own this path. |
| 10 | blind, edge | Truncated or partial quotes of the value are not redacted | false | reject | No path in this story quotes the value: it is never sent. Story 2's attach owns this. |
| 11 | blind | `encodeURIComponent` only; `%21` and lowercase-hex variants missed | low | reject | Real values are alphanumeric tokens. Unlikely, and the fix adds encoder branches. |
| 12 | edge | DOMException message is a prototype getter, so own-key walk misses it | false | reject | Timeout DOMException messages are fixed text and cannot contain the value. |
| 13 | edge | Trim strips Unicode whitespace, so NBSP-only settles `absent` | low | reject | §13.1 says "trims" without a character set. Unlikely input; no named harm. |
| 14 | edge | Throws outside the per-chunk try print unredacted in `main` | false | reject | Those paths (`inputSignature`, `runWait`) carry no request data and the value never enters them. |
| 15 | edge | Guard misses dynamic `import()`/`require` and `.js`/`.mts` sources | low | reject | The packages are static-import TypeScript. Unlikely, and the fix adds branches. |
| 16 | blind | `SessionAuth` constructor is exported and bypasses the grammar | low | reject | Developer-only, no caller does it, and the fix adds a private-token mechanism. |
| 17 | blind | `pnpm sync` canary can hang until the Vitest timeout | low | reject | A hang ends as a Vitest timeout failure, so it fails loudly. |
| 18 | blind | `SessionAuthReason` lists reasons this story never produces | false | reject | These are the §13.5 identifiers that the type stories 2 and 3 fill in. No caller diverges. |
| 19 | blind | Few ACs, empty spec sections, hedged verification commands, line-number Code Map | false | reject | The fix edits this build's spec. |
| 20 | ledger | No carved-out items without a ledger entry | — | none | Zero findings. |
| 21 | verification-gap | No verification gaps | — | none | Zero findings. |

## Verification

**Commands:**
- `pnpm -r --filter @poe/sync exec vitest run` (or the repo's sync project equivalent) -- expected: all pass.
- `pnpm test` -- expected: all pass, including root guard tests.
- `pnpm typecheck` (or `tsc -b`) -- expected: no errors.
