---
review: rubric
target: ARCHITECTURE-SPINE.md revision 24 (AD-30 + amendments) and IMPLEMENTATION-NOTES.md §13
date: 2026-10-02
verdict: not closed — 4 high, 8 medium, 5 low
---

# Rubric review — spine revision 24 (AD-30, optional POESESSID)

Inputs read: `git diff -- docs/architecture`; spine AD-7, AD-8, AD-9, AD-12, AD-13, AD-30,
Consistency Conventions, Deployment, Deferred; IMPLEMENTATION-NOTES §5.3, §6, §13;
`docs/specs/spec-poesessid-sync/SPEC.md`; `.memlog.md` rev-24 decisions (lines 340-351); code
`packages/sync/src/trade/client.ts`, `trade/user-agent.ts`, `sync.ts`, `sync-batch.ts`,
`compose-chunk.ts`, `pricing/price-entry.ts`, `packages/contracts/src/sync-run-report.ts`,
root `package.json`.

The user's settled amendments are treated as settled: baseline = first pricing search, probe =
same body re-sent with the cookie, one probe per process, probe 429 follows AD-8, `session-probe`
is a fourth AD-12 source, downgrade resets pacing to cold. Findings below flag only the holes
they leave.

## Verdict

AD-30 has the right shape: one client holds the cookie, liveness is tested by structure, the
state only downgrades, the report carries no auth field, and the ceiling stays priced against the
unauthenticated budget. It is not yet closed for the units one level down. Four divergence points
that a story author must decide are left open. (1) How a downgrade ends a chunk. The stated
mechanism, the invalid-request count, does not end a chunk in the current code. (2) Where
process-scoped auth state lives when the session builds a fresh governor for each chunk.
(3) How the client, whose lanes are opaque, knows which request is "the first pricing search",
and which counted port carries the probe. (4) What a dead cookie costs under `sync:batch`: one
GGG-counted `4xx` or one wasted search on every process, with no end.

## Rubric scorecard

| Criterion | Result |
| --- | --- |
| Fixes the real divergence points for shells, trade client, chunk runner, report contract | **Partial.** H1, H2, H3, M3, M4 are open divergence points. |
| Every Rule is enforceable and prevents its divergence | **Partial.** "counts in the invalid-request count, so the chunk ends" (H1) and "their factories cannot accept it" (M6) are not enforceable as written. |
| Nothing under Deferred lets two units diverge | **Pass.** Both new Deferred items are clean exclusions. |
| Ratifies, not contradicts, existing code | **Partial.** Per-chunk governor (H2), opaque lanes and per-port counting (H3), exhaustive Zod record (M4), step-side 4xx classification (H1). |
| Covers SPEC CAP-1..4 and constraints, or departs deliberately | **Mostly.** The departures are deliberate (memlog 343-346), but SPEC.md is not edited to match (M8). The `.env` documentation constraint has no owner (L5). |
| No amended text contradicts unamended text | **Fail in places.** AD-7 wait-by-outcome has no row for a downgrade (H1). AD-9 says "unit is the request", and the downgrade says "lastAttemptedAt alone" (M2). AD-30 step 4 and the §13 reason table disagree on a probe 429 (M1). The AD-12 gate-4xx path is not reconciled (M3). |

## Findings

### H1 — High. The downgrade has no chunk-ending mechanism, and AD-7 has no wait row for it

**Location:** AD-30 "Expiry mid-run" paragraph; §13 "Downgrade"; AD-7 "After each chunk it waits by the outcome"; AD-9 exception sentence.

The spine says the downgrade `4xx` "still counts in the chunk's invalid-request count, so the chunk
ends". That is not how a chunk ends in the code. The threshold is keyed per policy
(`invalid-requests.ts`, §5.3), so a `401` on the fetch policy refuses only the next fetch. The next
entry's search goes out. §5.3 says the first `4xx` ends the chunk only because `price-entry.ts`
throws `MalformedRequestError` on any non-429 `4xx`. The pricing step cannot tell a cookie `401`
from a malformed one, because AD-30 forbids every component except the client to know about the
cookie. So two builders diverge: one teaches the step to inspect a client flag, and the other adds
a new yield reason to the client. The chunk outcome kind is also undefined. A downgrade is not a
`yielded` chunk with a `notBefore`, not a throw, and not a no-answer yield, so `nextWait` in
`sync.ts` has no row for it. The batch exit code is "unchanged", but unchanged from what is not
stated.

**Fix:** In AD-30, and in §13 as binding: "On a `401` or `403` to a request that carried the
cookie, the client drops the cookie, resets the pacing state, and returns a **yield** with reason
`session-expired` (no `retryAfter`). The runner ends the chunk as `yielded`, writes no `notBefore`
and no record, and `sync:batch` exits 0." Add one row to AD-7's wait-by-outcome list: "after a
downgrade, no wait beyond the next chunk's pre-wait." Remove "counts in the invalid-request count,
so the chunk ends" from both texts. The count is incidental and is not the mechanism.

### H2 — High. Process-scoped auth state against a per-chunk governor: where does the cookie live?

**Location:** AD-30 "No component other than the client holds it after the factory call"; "Auth state is per process"; Config convention.

`composeChunk` builds a **fresh governor per chunk** (`compose-chunk.ts:106-119`), and the
session builds one process-level `PacingState` that it passes in (`sync.ts:544`). The rule "per
process, settled once" therefore cannot live in the governor. If it did, every session chunk
would re-probe, and a downgrade would be forgotten on the next chunk. If it lives in the session
shell, then the shell holds the value for the life of the process, against "no component other
than the client holds it after the factory call". Builders will diverge three ways: state on the
governor, state on `PacingState`, or state in `sync.ts`.

**Fix:** Name the holder. For example: "The shell passes the cookie once to
`createSessionAuth(value)`. That call returns a process-scoped handle, a sibling of `PacingState`,
which encloses the value with no getter and carries the auth state. Every chunk's governor receives
the handle. Only the governor's request path reads the value through it. `sync:batch` builds one
handle per process." Then the rule reads "no component other than the session-auth handle and the
client that uses it".

### H3 — High. The client cannot identify "the first pricing search", and the probe has no counted port

**Location:** AD-30 step 3 ("the client re-sends the same body once"); AD-12 `session-probe` row; §13.

The client's lanes are **opaque by design** (`client.ts:95-105`: "never interprets the label,
never compares it to a literal"). Request sources are told apart only by which counted
`HttpPort` a sibling client wraps (`compose-chunk.ts:109-112`, `request-counter.ts`). For a probe
"by the client", the spine leaves three things open. (a) How the client knows that a request is a
pricing search and not the league gate or a fetch. (b) Which port the probe goes out on, so that
it counts under `session-probe` and not `tracked-list`. (c) Whether `sync:dry`, which shares
`composeChunk`, probes. Without a fixture for a probe, a dry run with a cookie would fail. One
builder will key on `POST`, one on the `tracked-list` source, and one will move the probe into the
pricing step.

**Fix:** Bind the trigger in §13. For example: "The governor takes an optional third port,
`session-probe`, in its `http` record. The probe fires on the first 2xx response to a request on
the `tracked-list` client that the pricing step marks `probeEligible` (its search). The client
re-sends that request through the `session-probe` port before it returns the baseline result. A
composition that passes no session-auth handle (batch without a cookie, `sync:dry`,
`catalogue:refresh`, `fixtures:record`) never probes." State also that the probe is sent before
the baseline entry's fetch (CAP-1 order).

### H4 — High. A dead cookie under `sync:batch` costs one GGG-counted `4xx` or one wasted search on every process, with no end

**Location:** AD-30 step 4 and §13 "Probe outcomes"; AD-12 source row; AD-8 Invalid Requests Threshold. Overlaps review-rev24-verification F4. This review rates it higher.

"At most once per process" is once per chunk under `sync:batch`. At a 5-minute cadence that is
288 probes a day. If a dead cookie answers the probe with `401` or `403` (`probe-rejected`), every
process sends one `4xx` that GGG counts toward its Invalid Requests Threshold (§5.3). The local
exclusion from the chunk's count does not change GGG's count. This is the exact cost memlog line
344 gives as the reason not to send a parameterless probe. If a dead cookie answers 2xx with fewer
rules (`not-elevated`), each process spends one extra search from the 2,400/day budget. The spine
prices this against AD-12's headroom nowhere. The only signal is a console warning on a scheduled
job that nobody reads. AD-30's Prevents bullet says "wedging the session behind a penalty", which
covers the session and not the batch.

**Fix:** Pick one of these and write it into AD-30 and §13.
(a) **Persist a hold-off.** After a `probe-rejected` or `not-elevated` settle, or a downgrade,
`sync:batch` writes `authHoldOffUntil = now + staleLockAfter` to `sync-progress.json`. This is
additive and a minor version. A batch process before that instant skips the probe and prints
`unauthenticated (held-off)`. No cookie material is stored.
(b) **Accept and record.** State the cost in AD-30 ("a dead cookie under `sync:batch` costs one
GGG-counted `4xx` per invocation until the operator removes it") and in the AD-12 headroom
sentence, so that no story author "fixes" it in a different way.
Option (a) is recommended, because AD-8 calls the threshold a risk to the product's access.

### M1 — Medium. The auth state after a probe `429` is undefined, and the texts disagree

**Location:** AD-30 step 4; §13 reason table (`probe-rejected` = "the probe got an answer that is not 2xx"); AD-12 row "at most once per process".

AD-30 lists a `429` apart from "any other non-2xx … settles `unauthenticated`". This implies that
a `429` does **not** settle. The §13 table classes every non-2xx answer as `probe-rejected`, which
includes a `429`. Under the session, after the `notBefore` wait, one builder re-probes on the next
chunk, which breaks AD-12's "at most once per process". Another builder settles
`unauthenticated`, so a rate event drops a live cookie for a run that can last many hours.

**Fix:** Decide and write it in both places. Recommended: "A probe `429` leaves the state
unsettled. The first answered pricing search after the wait is a new baseline, and one more probe
is allowed." Change the AD-12 cadence to "one probe per process, plus one after each probe 429".
Narrow `probe-rejected` to "a non-2xx answer other than 429". The alternative is "a probe 429
settles `unauthenticated (probe-rate-limited)`", which needs a new reason id.

### M2 — Medium. The downgrade's "lastAttemptedAt alone" contradicts AD-9's "the unit is the request"

**Location:** AD-30 "The entry stamps `lastAttemptedAt` alone"; §13 bullet 4; AD-9 timestamps paragraph; `price-entry.ts` table.

If the `401` arrives on the **fetch** after a search that carried the cookie and was answered, AD-9
says that the answered search sets `lastSearchId` and `lastSearchLeague` "whatever the fetch that
follows it returns". AD-30 says "alone". The step's existing table (`price-entry.ts:13-19`)
follows AD-9.

**Fix:** Replace the text with "the entry is stamped as AD-9 stamps a request with no answer:
`lastAttemptedAt`, plus the search fields where this entry's search was answered. The price state
is kept."

### M3 — Medium. The spine does not say which requests carry the cookie. A gate `401` or `403` with the cookie has two rules

**Location:** AD-30 (silent on the league gate); AD-12 gate yield and abort text; AD-7 "a gate `4xx`" wait row; `LeagueRequestRejectedError` path in `run-chunk.ts` / `sync.ts:251`.

Before the probe settles, no request may carry the cookie, or the baseline is not "without the
cookie". After an `authenticated` settle, the session runs the league gate again on each new pass.
The spine does not say whether that gate request carries the cookie. If it does and gets a `401`
or `403`, AD-9's carve-out ("a request that carried the session cookie") calls it a downgrade.
AD-12 and AD-7 treat a gate `4xx` as an abort with a `notBefore` wait. The existing
`LeagueRequestRejectedError` path implements that.

**Fix:** Add this to AD-30: "Before the state settles, no request carries the cookie. After an
`authenticated` settle, every trade request on the chunk path carries it, the league gate included.
A gate `401` or `403` with the cookie is a downgrade. The chunk is a yield with no entry attempted
(AD-12), not a gate abort." Add "or a downgrade" to AD-7's gate-4xx row as an exception.

### M4 — Medium. The `sync-report.json` contract change is unspecified, and the Zod record is exhaustive

**Location:** AD-12 per-source sentence; AD-30 Binds `contracts`; `contracts/src/sync-run-report.ts:22-68`; `web/src/frame/trust-facts.ts:194-197`.

`RequestsBySourceSchema` is `z.record(ChunkRequestSourceSchema, …)`. In Zod 4 that record is
exhaustive over the enum (noted in the rev21 verification). Adding `session-probe` therefore makes
the key **required**. Every committed 1.1.0 report then fails to parse. One builder will write `0`
for a run with no cookie, and another will omit the key. The memlog (346) says "additive minor
version", and the spine says nothing. AD-12 binds `web`, but the spine does not say whether the
trust strip shows the new figure. `trust-facts.ts` reads the two keys by name.

**Fix:** State in AD-12, or in §12 or §5.3: "`sync-report.json` 1.2.0. `session-probe` is always
written, `0` when no probe was sent. A reader defaults an absent key to `0` for a file at or below
1.1.0, by the same preprocess pattern as `dropLegacyRequestSource`. `web` shows / does not show the
figure (choose one)." Retarget the code comments "Exactly three sources" and "The two sources a
chunk spends" in `sync-run-report.ts`.

### M5 — Medium. The accepted cost of a downgrade reset to cold is understated and lives only in the memlog

**Location:** AD-8 "AD-30's downgrade … resets to cold"; AD-30 Prevents ("wedging the session behind a penalty"); memlog 347.

The memlog accepts "one possible 429 … AD-8 handles it". The 2026-10-02 capture shows the
authenticated `Ip` search rules at `60:300` and `600:10800`, and the unauthenticated rules at
`30:300:1800` and `600:21600:3600`. An even spread at the authenticated sustained rate can put more
than 600 hits in a 6-hour window. A cold first request after a downgrade can then draw a
`Retry-After` of up to 3,600 s, and it counts toward GGG's threshold. The cold reset discards the
only data, the current hit counts, that would let the pacer wait. A story author who reads only
the spine sees "re-learns from the next response" and does not see the cost.

**Fix:** Either write the accepted cost into AD-30 ("the first request after a downgrade may draw a
429 with a restriction up to the unauthenticated bucket's penalty; AD-8 handles it"), or use a
safer reset. Keep the process's **baseline** (unauthenticated) policy reading as the reset target,
and carry over the latest hit counts of rule names that appear in both readings. The spread and
the batch pacer then wait instead of spending. That still meets the SPEC constraint, because no
authenticated limit paces an unauthenticated request.

### M6 — Medium. "Their factories cannot accept it" cannot be enforced as written, `.env` is loaded into every shell, and `sync:dry` is not named

**Location:** AD-30 first paragraph; Config convention; `package.json:21-25`.

`catalogue:refresh` and `fixtures:record` both run with `--env-file-if-exists=.env`, so
`POESESSID` is in their `process.env`. They build through the same
`createTradeGovernor`/`createTradeClient` factory as the chunk path. If the cookie becomes an
optional field of `TradeClientOptions`, which is the natural edit, then every factory accepts it.
`sync:dry` shares `composeChunk` and is in neither list.

**Fix:** Bind the enforcement. "The cookie enters only through the session-auth handle (H2), which
only `sync.ts` and `sync-batch.ts` construct. `TradeClientOptions` has no cookie field. A test
asserts that the `POESESSID` identifier occurs in exactly one shell-edge module, as `resolveUserAgent`
is for the UA, and that `catalogue-refresh.ts`, `fixtures-record.ts` and `dry-run.ts` do not import
it." Add `sync:dry` to the never-reads list.

### M7 — Medium. The leak surface is wider than the rule names: `Set-Cookie`, ports below the client, and the `response` on a yield

**Location:** AD-30 "The cookie value stays in the governed client"; `client.ts:132-160` (results carry `response`); `request-counter.ts`, the `HttpPort` fetch adapter.

The client returns the whole `HttpResponse` on every result and on a 429 yield. A session response
can carry `Set-Cookie: POESESSID=…`. That header would leave the client in the response headers, and
an error or debug line could print it. The request, with its `Cookie` header, also passes through
the counting wrapper and the fetch port. These are components below the client that hold the value
in transit. The rule "No component other than the client holds it" is false for them, and silent
about what they may do with it.

**Fix:** Add two sentences to AD-30. "The client strips `set-cookie` from every response it
returns. Ports below the client carry the header in transit only, never log it and never retain
it." For CAP-4, bind one test in §13: run with a sentinel cookie value, and scan stdout, stderr,
every thrown message and every written artifact for any substring of 8 or more characters of the
value.

### M8 — Medium. The spine contradicts its two sources: SPEC.md and prd.md are not edited

**Location:** AD-30 last sentence ("`prd.md` records that departure"); spine `sources:` lists SPEC.md. Overlaps review-rev24-verification F5.

`prd.md` is unmodified. Line 569 says "Background sync: unauthenticated". Line 588 lists
"Authenticated sync" as a spine-owned deferral, and that deferral no longer exists. NFR-9 still
requires a contact UA. By the AGENTS.md five-trigger rule, a scope boundary and player-visible
behavior (NFR-9) change, so the PRD edit is required. SPEC.md still states the superseded probe:
"a trade search with no parameters, sent twice … two search hits" (line 37). CAP-1 success shows
a separate baseline probe search. CAP-2 detects "before the first pricing request". Memlog 343
records that the SPEC "needs a matching edit". A story generated from SPEC.md will build the probe
that was rejected.

**Fix:** In the same change, edit SPEC.md (CAP-1 success order, the CAP-2 "before the first pricing
request" wording, constraint line 37) and prd.md (scope line 569, deferral line 588, the NFR-9
departure for cookie runs). Until then, reword the spine to "the PRD must record that departure
(pending)".

### L1 — Low. The console line's placement and stream are not bound for runs that send nothing

**Location:** AD-30 "The console, not the report"; §13 `absent` and `not-probed` rows.

`absent` "prints before the first request, on every run". A busy-lock or deferred (`notBefore`)
batch run sends no request, so it is unclear whether the line prints. `not-probed` prints when "the
process ended". It is unclear whether that covers a SIGINT exit and a busy or deferred exit.
`sync-batch.ts` writes the outcome to stdout and failures to stderr, and the stream for the warning
is not stated. CAP-2 tests "exactly one line", so the test authors need the stream.

**Fix:** "The `absent` line prints at the shell edge before the chunk runs, on every invocation,
deferred and busy included. `not-probed` prints on every exit path where a cookie was set and no
probe was sent. Warnings go to stderr and `authenticated` goes to stdout."

### L2 — Low. Probe pacing and allowance are not stated

**Location:** §13 step 2.

The spine does not say that the probe waits the even spread or the batch pacer like any search, or
that it spends from the chunk's search allowance (the `remaining` bound). A story could send it
immediately after the baseline because it is "the same request". Under the session, the baseline
reading `1 of 5:10` asks for a wait of 2.5 s.

**Fix:** "The probe is paced and bounded like any search on its lane (§5.3). Its response's
`remaining` bounds the chunk."

### L3 — Low. A silent expiry (2xx with fewer rules) is not detected, so the console line can be false

**Location:** AD-30 "Expiry mid-run"; related to review-rev24-verification F1.

If a signed-out cookie gets 2xx answers with the `Ip` rule only, and no 401 or 403, the process
keeps printing nothing after `authenticated` and keeps sending a dead cookie. Pacing stays safe,
because every reading replaces the last. CAP-4's "whether the session cookie was in use" is then
wrong.

**Fix:** Add a structural downgrade: "a 2xx to a cookie-carrying request whose
`X-Rate-Limit-Rules` lists fewer names than the probe's is a downgrade with reason `expired`,
without ending the chunk".

### L4 — Low. The §6 seeding guidance does not count the probe under `sync:batch`

**Location:** IMPLEMENTATION-NOTES §6 "Seeding `minChunkSearches`"; AD-12 headroom sentence.

With a cookie set, every batch chunk spends one search on the probe. At about 8 searches per chunk
in steady state, that is 12% of a minimum chunk. A player who seeds `minChunkSearches` from §6
over-certifies the pinned set by one.

**Fix:** Add one sentence to §6: "With `POESESSID` set, subtract one search per batch chunk for the
session probe (AD-30)."

### L5 — Low. Code comments the revision falsifies, and the `.env` documentation constraint has no owner

**Location:** `trade/user-agent.ts:9` ("the only `process.env` read in `sync`"), `:25` and the `MissingUserAgentError` message (NFR-9 contact wording); `contracts/src/sync-run-report.ts:21,31`; `compose-chunk.ts:5-7` ("two sibling trade clients"). The SPEC constraint "operator documentation for `.env` says four things" is cited nowhere.

**Fix:** List these as a story checklist in the rev-24 memlog or the story. Have `.env.example`
cited as the operator-doc owner in AGENT-WORKFLOW.md or in the story. Do not put it in the spine.

## Checked and clean

- AD-7's `notBefore` check order and the probe: the check runs under the lock before every load
  (§5.3), and the probe follows the first pricing search, so a deferred run never probes. This is
  consistent.
- AD-12's "No request precedes an offline check": the probe is after the gates. This is consistent.
- AD-12's ceiling stays against the unauthenticated budget. This is consistent with "may drop
  mid-run".
- Liveness test: compares counts only, names are case-folded, and nothing is compiled in. This is
  enforceable by `test/no-hardcoded-rate-limits.test.ts`, which exists.
- Deferred: the OAuth exclusion and the rotation/Cloudflare exclusion give no shared surface that
  two units could implement differently.
- Deployment: no CI secret, and `.env` only. This is consistent with the Assumptions in SPEC.md.
- AD-15 (`web` unauthenticated) is untouched. This is correct.
