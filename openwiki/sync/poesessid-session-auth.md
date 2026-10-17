---
type: architecture
title: POESESSID session auth
description: How the optional POESESSID session cookie is read at the shell edge, held by one SessionAuth object that never leaks it, probed once against an unauthenticated baseline, attached to pricing requests, downgraded mid-run, and held off across processes through sync-progress.json.
tags: [sync, auth, poesessid, session-cookie, rate-limits, security, trade-client]
verified:
  - by: openwiki/0.6.0
    at: 2026-10-17T13:54:42.734Z
sources:
  - id: openwiki-source-0d9a279bef1e1d147b0742a8
    resource: repo://packages/sync/src/chunk/run-chunk/publish-artifacts.ts
  - id: openwiki-source-46c0c66948769af343dff03d
    resource: repo://packages/sync/src/compose-chunk.ts
  - id: openwiki-source-b293525c0b4d3d93a18fe376
    resource: repo://packages/sync/src/pricing/price-entry.ts
  - id: openwiki-source-999659a0385fcbff008d129d
    resource: repo://packages/sync/src/sync-batch.ts
  - id: openwiki-source-9728b2c47c3bfb260a78a2b8
    resource: repo://packages/sync/src/trade/client/exchange.ts
  - id: openwiki-source-448041850d249d42d0692aa1
    resource: repo://packages/sync/src/trade/client/serial-sender.ts
  - id: openwiki-source-e174af319561c811f72b18b8
    resource: repo://packages/sync/src/trade/client/session-cookie.ts
  - id: openwiki-source-fbdbde9f9dbf09ca94d95852
    resource: repo://packages/sync/src/trade/session-auth.ts
  - id: openwiki-source-c81a66cabe03fb6b729e1f9b
    resource: repo://test/session-cookie-shells.test.ts
generated: { by: "claude-code", at: "2026-10-17T13:54:42.734Z" }
---

# POESESSID session auth

A logged-in trade session can get more generous rate-limit rules than an anonymous one. `sync` can therefore send the player's `POESESSID` cookie on its pricing requests. The cookie is optional: without it, sync runs exactly as before. The decision is AD-30 in the architecture spine. The code is the auth holder `packages/sync/src/trade/session-auth.ts` and the governor side `packages/sync/src/trade/client/session-cookie.ts`.

## Supplying the cookie

The two live sync shells, `pnpm sync` and `pnpm sync:batch`, read the cookie from the environment variable `POESESSID`. Both run Node with `--env-file-if-exists=.env`, so a git-ignored `.env` file at the repository root can carry it. No other command sends the cookie. Agents must not read `.env` files; the project settings deny it.

`createSessionAuth(env, { onSettle })` builds the holder at the shell edge, after the User-Agent check:

- an empty or missing value settles at once as `unauthenticated (absent)`;
- a value that is not an RFC 6265 cookie value settles at once as `unauthenticated (malformed)`, and the value is not kept;
- a valid value is kept, and the holder starts `unsettled`.

Each settle prints one line through `onSettle` (for example `pnpm sync: authenticated` or `pnpm sync: unauthenticated (not-elevated)`), at the moment it settles.

## Who may touch the cookie

`SessionAuth` is the **only** owner of the value. It keeps it in a private field and never returns it. Its `toJSON`, `toString` and `util.inspect` forms show only the state.

- `withCookie(headers)` returns a copy of the headers with `cookie: POESESSID=<value>`. This is the only way the value leaves the holder, and only the governor calls it.
- `redact(error)` scrubs the value **in place** from a thrown value: strings, an `Error`'s own properties (its `message` and `stack`), arrays and plain objects, recursively. It replaces the raw value, its URL-encoded form and its base64 / base64url forms at three byte alignments (and the inner value of a quoted cookie) with `[redacted]`. Scrubbing in place keeps the error's class and identity, so classifiers such as `isTransportFailure` still work. The governor's serial sender redacts every throw of an exchange, and the shells redact again before they print.

`test/session-cookie-shells.test.ts` scans the non-test source: only `sync.ts`, `sync-batch.ts` and `session-auth.ts` may name the variable, only the two shells may import the holder's values, and only `compose-chunk.ts` and `trade/client.ts` may import its type. `fixtures-record.ts` may name it once, to redact a recorded header.

## States

```
unsettled ──settle──> authenticated ──expire──> unauthenticated (expired)
    │
    └──settle──> unauthenticated (absent | malformed | held-off | not-elevated
                                   | probe-rejected | probe-failed | not-probed)
```

`settle` moves only from `unsettled`, and `expire` only from `authenticated`, so no state line prints twice. A batch run that ends while still `unsettled` (no successful pricing search to probe on) settles `not-probed` in its `finally`.

## The probe

The governor gets the holder and a separate `session-probe` HTTP port from `composeChunk`. That port is counted on its own, so the sync report's `session-probe` request figure is the probe's only trace. The pricing step marks its search and fetch requests `cookieEligible`; league checks and catalogue requests never carry the cookie.

1. **Baseline.** While the holder is `unsettled`, every request goes out without the cookie. The first `cookieEligible` request that answers 2xx is the baseline.
2. **Probe.** Right after that answer, the governor sends the same request once more, with the cookie, on the same lane and pacing (`probe` in `session-cookie.ts`). The probe never counts toward the invalid-request threshold, and its answer and any error are never returned to the caller.
3. **Settle.** The holder settles by the probe's answer:

| Probe answer | Holder state |
| --- | --- |
| 2xx with more `X-Rate-Limit-Rules` names than the baseline | `authenticated` |
| 2xx with the same or fewer rule names | `not-elevated` |
| any 4xx except 429 (every 401 and 403, a Cloudflare 403 too) | `probe-rejected` |
| 5xx, other status, or a thrown error | `probe-failed` |
| 429 | nothing settles; the 429 is latched |

On a 2xx the holder remembers the baseline's rule-name count and rate-limit policy for the rest of the process. Only counts are kept, never rule names.

A latched probe 429 makes the next send yield with that penalty without sending, and `latchedRetryAfterMs` makes the chunk end as a 429 yield even when no later request was sent. See [The sync chunk runner](chunk-runner.md).

Once `authenticated`, the governor attaches the cookie to every `cookieEligible` request.

## Mid-run downgrade

A cookie request is a **downgrade** when it answers 401 or 403, or answers 2xx under the baseline's policy with a rule-name count not above the baseline's. A 429, a 5xx or another 4xx is not a downgrade. On a downgrade (`expireSession`):

- the governor drops the cookie for the rest of its life;
- it resets the shared pacing state to cold in place, because the learned rules belonged to the session;
- the holder moves to `unauthenticated (expired)`;
- the request yields with reason `session-expired`. The downgrading answer is neither counted nor returned.

The chunk ends `yielded` with `sessionExpired: true` and writes no `notBefore`. The `pnpm sync` session then waits `backoff(1)` before its next chunk, since pacing is cold again (see [The pnpm sync session](sync-session.md)).

## The hold-off across processes

A cookie that failed once should not be probed again by every scheduled run. `data/sync-progress.json` carries the optional `authHoldOffUntil`, which holds a due time only, never the value.

- An `authenticated` settle records the action `clear`. A `not-elevated`, `probe-rejected` or `expired` settle records `write`. Other reasons record nothing.
- The chunk's next progress write applies the pending action: `write` sets `authHoldOffUntil` to `now + 24 h`, `clear` removes it, and no action carries the old value forward. `holdOffApplied` clears the pending action only if it is still the one applied, so an action recorded after the read survives to the next write.
- At run start, after the lock and the `notBefore` check, the runner calls `settleHeldOffIfDue`. While the clock is before `authHoldOffUntil`, a holder that could probe settles `held-off`, and no probe is sent.

## Related

- [Governed trade client and rate limits](trade-client-and-rate-limits.md): the governor, lanes, pacing and 429 handling the probe shares.
- [Contracts, envelopes and the data/ files](../architecture/contracts-and-data-files.md): the `authHoldOffUntil` field and the `session-probe` request source.
- [Operator commands and curation workflow](../workflows/operator-commands.md): the commands that read `.env`.
