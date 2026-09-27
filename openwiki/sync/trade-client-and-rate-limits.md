---
type: subsystem
title: Governed trade client and rate limits
description: The one governed trade client every sync request goes through — standing headers and the POE_SYNC_USER_AGENT contact, pacing from live X-Rate-Limit headers via a per-policy ledger, a serial queue, yields instead of retries on 429, the invalid-request threshold, transport-failure classification, per-source request counting, and the real fetch port's timeout.
tags: [sync, trade-api, rate-limit, http, user-agent, backoff]
verified:
  - by: openwiki/0.6.0
    at: 2026-09-27T12:20:24.418Z
sources:
  - id: openwiki-source-760d02e851905e7ae55350ae
    resource: repo://packages/contracts/src/sync-run-report.ts
  - id: openwiki-source-d42f48dba7197fecd52daea6
    resource: repo://packages/sync/src/request-counter.ts
  - id: openwiki-source-869e9d6242b1ef866e244695
    resource: repo://packages/sync/src/shell.ts
  - id: openwiki-source-b3be66a69069961cf317f20c
    resource: repo://packages/sync/src/trade/client.ts
  - id: openwiki-source-a3675307379799bec7583b7d
    resource: repo://packages/sync/src/trade/invalid-requests.ts
  - id: openwiki-source-71ca1c1a9324e2fb9c9eb03f
    resource: repo://packages/sync/src/trade/ledger.ts
  - id: openwiki-source-dfb628fc18ff09e65e6aa8eb
    resource: repo://packages/sync/src/trade/rate-limit-headers.ts
  - id: openwiki-source-26f57dfb91497a8908d9e6a2
    resource: repo://packages/sync/src/trade/transport-failure.ts
  - id: openwiki-source-34d9faa08258f9080511cdcb
    resource: repo://packages/sync/src/trade/user-agent.ts
  - id: openwiki-source-6c1728bcce531bca96d02755
    resource: repo://test/no-hardcoded-rate-limits.test.ts
generated: { by: "claude-code", at: "2026-09-27T12:20:24.418Z" }
---

# Governed trade client and rate limits

**Exactly one module in `sync` sends trade requests**: `packages/sync/src/trade/client.ts`. The pricing step, the league gate, `pnpm catalogue:refresh` and `pnpm fixtures:record` all send through it. If a second call site built its own requests, it would pace independently against the same shared budget of the trade API. That is the failure this module prevents.

The client transports and nothing more. It does not build search bodies, parse results, compute medians, convert currency, retry, queue work across runs, or persist anything.

## What one send does

For each `TradeRequest` (`method`, `url`, optional `body` and `headers`, and an opaque `lane` label), the exchange does this:

1. **Threshold check.** If the policy this lane last used has reached the invalid-request threshold, the client refuses without sending. It returns a `yield` with reason `invalid-request-threshold` and `retryAfterMs: 0`, because waiting does not fix this condition.
2. **Pace.** `paceBeforeNext(ledger, policy, now)` computes the tightest unsatisfied delay: an active penalty, or a full bucket's remaining window, aged by the time since each rule was observed. The client waits that long **once**, using the injected `wait`.
3. **Send** through `HttpPort` with the **standing headers**, which are applied last so a caller cannot remove them: `User-Agent` (the configured contact string), `X-Requested-With: XMLHttpRequest`, and `Content-Type: application/json` on POST.
4. **Fold** the response's `X-Rate-Limit-*` headers back into the ledger and remember the lane's policy (`X-Rate-Limit-Policy`). The lane memo is capped at 64 lanes, and the least recently used lane is evicted first.
5. **Count** every 4xx against the policy. A response that names no policy counts under `(no policy named)`.
6. **Answer**:
   - `429` gives a **yield**. `retryAfterMs` comes from a `Retry-After` value in integer seconds. When that is absent, zero or an HTTP date, it is derived from the ledger's penalties, with a floor of the widest window or penalty the response declared and at least 1 s.
   - any other status, including 5xx and non-429 4xx, is returned unchanged as a `response`. The caller decides what it means.

Every result carries `invalidRequests` (the running 4xx count on the policy) and, where the headers declared a rule, `remaining`. `remaining` is the smallest `hits − state.hits` over all buckets and is never below 0. The chunk runner stops when it drops below 1 (see [The sync chunk runner](chunk-runner.md)).

**The client never retries and never waits out a 429.** A 429 shows that the ledger was wrong, so the right action is to stop spending for the whole chunk. Returning the delay lets the runner release its lock and exit. If the client slept here instead, it would hold the lock through the penalty window.

### One governor, several sources

`createTradeClients({ http: { sourceA: port, sourceB: port }, ... })` builds sibling clients that share one ledger, one set of invalid-request counts, one lane memo and **one serial queue**. Requests are chained one at a time. The pacing logic assumes the ledger is at most one response out of date, and that holds only when nothing else is in flight. The queue survives a rejected exchange. `composeChunk` uses this to count `league-validation` and `tracked-list` requests separately while pacing them together.

## Rate limits are learned, never compiled in

`rate-limit-headers.ts` reads the rule names from `X-Rate-Limit-Rules` **at runtime**. For each rule it reads `X-Rate-Limit-<Name>` (the limits) and `X-Rate-Limit-<Name>-State` (the consumption). Both are comma-separated `hits:seconds:penalty` triples paired by position. A rule whose headers are missing or malformed is skipped and recorded as a skip. It never throws and never becomes `NaN`. Pacing continues on the rules that did arrive.

`ledger.ts` is pure: it takes no clock and has no `wait`. It is keyed on the policy name the response carried, not on an operation. So the search and fetch buckets separate by themselves, and a new policy from the API is handled without code changes. The ledger is in memory and per governor. Nothing persists across processes, except the `notBefore` penalty that the chunk runner writes to `data/sync-progress.json`.

`test/no-hardcoded-rate-limits.test.ts` scans non-test source under `packages/` and fails on any trade-API policy name, rule name or rate constant. Tests may name the measured buckets, but production code may not.

Lane labels (`endpoints.ts`) mean nothing to the client. It learns which policy a lane maps to from responses. The four catalogue GETs and the leagues GET share `DATA_LANE`, so they pace against one ledger entry. Search and fetch have separate lanes because they spend from different buckets. A request without a lane defaults to its method plus its URL path without the final segment.

## The invalid-request threshold

The trade API revokes access after too many 4xx responses, and waiting does not undo that. `invalid-requests.ts` counts every 4xx per policy. The client has no threshold of its own: every shell passes `INVALID_REQUEST_THRESHOLD` (`1`). On the chunk path the first 4xx ends the chunk anyway, so a threshold of 1 refuses any second request on a policy that has already returned one.

## Transport failures

`isTransportFailure(error)` is true only for a `TimeoutError` (from the request timeout) or a `TypeError('fetch failed')`. The pricing step and the league gate treat these as a **yield**, the same as a 429 or a 5xx. Any other rejection, such as an unrecorded fixture in the dry run or a programming error, is rethrown so that it fails loudly.

## The User-Agent contact

Every request must identify the tool and a contact address. `user-agent.ts` reads **`POE_SYNC_USER_AGENT`**, which holds the whole header value verbatim. It is the only `process.env` read in `sync`, and it runs at the shell edge. If the variable is unset or blank, `resolveUserAgent` returns a typed refusal: `pnpm sync` prints it and exits 1 before any request. The client factories also throw `MissingUserAgentError` on a blank value, so no request can go out without a contact. The live commands load `.env` with `node --env-file-if-exists=.env`.

## The real HTTP port and request counting

`createFetchHttpPort` in `packages/sync/src/shell.ts` is the only real `HttpPort`. It calls `fetch` with `AbortSignal.timeout(REQUEST_TIMEOUT_MS)` (30 s), so a stalled connection cannot hang the command. It lowercases response header names. Only `shell-fetch.test.ts` runs it, against a loopback server.

`request-counter.ts` wraps an `HttpPort` per source (`tracked-list`, `league-validation`, `catalogue-refresh`). It counts each request **before** it is answered, so a timeout still counts. `requestsBetween` gives the per-chunk difference. The Sync Report narrows this to the two chunk sources.

## Related

- [Pricing step and league gate](pricing-step-and-league-gate.md): how yields and statuses become entry states.
- [Operator commands and curation workflow](../workflows/operator-commands.md): the commands that build clients.
