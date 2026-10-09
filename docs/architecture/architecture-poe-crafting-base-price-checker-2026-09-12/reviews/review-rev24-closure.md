---
review: closure + adversarial
target: ARCHITECTURE-SPINE.md AD-30 (and its amendments to AD-7, AD-8, AD-9, AD-12) and IMPLEMENTATION-NOTES.md §13, checked against docs/stories/archive/spec-poesessid-sync/SPEC.md
date: 2026-10-03
closes: review-rev24-rubric.md, review-rev24-adversarial.md, review-rev24-verification.md
verdict: not closed (updated 2026-10-03, see the last section). Of 42 earlier findings, 20 are closed, 16 are partly closed and 6 are open. The fixes add 15 new divergence points (5 medium-high, 6 medium, 4 low).
---

# Closure review: spine revision 24 (AD-30)

## Inputs

- Spine: AD-7 (lines 492-616), AD-8 (618-667), AD-9 (669-736), AD-12 (925-1028), AD-30
  (1779-1829), Consistency Conventions (1850-1870), Deployment (1999-2013), Deferred
  (2127-2133), OQ-26 (2271-2280).
- IMPLEMENTATION-NOTES: §5.3 (596-676), §6 (690-749), §13 (1163-1277).
- SPEC.md (working tree, 96 lines), `prd.md` (lines 367, 546, 571), `stories.yaml` line 7.
- Code, read only to ground the unit shapes: `trade/client.ts`, `compose-chunk.ts`, `sync.ts`,
  `sync-batch.ts`, `chunk/run-chunk.ts`, `pricing/price-entry.ts`.

Line numbers below are the current lines in the working tree. "Spine" means
`ARCHITECTURE-SPINE.md`, and "§13" means `IMPLEMENTATION-NOTES.md` §13.

## Verdict

The revision closes the structural holes. The rule now names a process-scoped holder (C1/H2).
It lists the requests that carry the cookie (H5/M3). It states one liveness test (H4/F1). It
gives the downgrade its own yield and a row in AD-7 (H1/H2). It persists a hold-off (H4/M1/F4).
It has an OQ for the premises that are not measured (F1/F3). SPEC.md and `prd.md` match it
(M8/F5).

Three earlier findings that are still open are each an open divergence point: the canary test
cannot be implemented as written (adv M4), `Set-Cookie` is not removed (adv L3, rubric M7), and
a non-cookie `401`/`403` is still read as expiry (adv M7). The fixes also add new divergence
points. The worst five are these:

- **N1.** The rule for the session's wait after a downgrade cannot work with the session's
  freshness test. A builder who follows §13.4 gets no wait.
- **N2/N3.** Three texts name two different writers of the hold-off. No text says whether a
  progress write keeps the hold-off.
- **N4.** A downgrade on a 2xx response throws away an answered search, which AD-9 keeps.
- **N5.** A probe `5xx` or a Cloudflare `403` holds the cookie off for 24 hours.

## Closure table

Status: **Closed** means a current line removes the second reading. **Partly** means part of
the fix landed and the rest is still open. **Open** means no current line addresses it.

### review-rev24-rubric.md

| ID | Status | Closing line(s) | Still open |
| --- | --- | --- | --- |
| H1 downgrade ends no chunk; no AD-7 row | **Closed** | Spine 1810-1813 ("ends the chunk as a yield that persists no `notBefore`, and the batch command exits 0"); §13.4 1236-1242 (the `session-expired` yield, `yielded`, exit 0); AD-7 527-528 (the `backoff(1)` row). The "counts in the invalid-request count" text is gone. | The wait mechanism is defective. See **N1**. |
| H2 where process auth state lives | **Closed** | Spine 1794-1796 ("One process-scoped auth holder owns the value and the state … passes it into each chunk's governor, as AD-8 does with the pacing state"); Prevents 1786. | Who changes the state is now ambiguous. See **N2**. |
| H3 "first pricing search" identity, probe port, `sync:dry` | **Partly** | `sync:dry`: §13 1165-1166. Probe accounting result: §13.2 1198-1199. Order relative to the fetch: §13.2 1185 ("before that entry's fetch"). | How the client recognises a pricing search through opaque lanes, and which port the probe uses, are still not bound. See **N10**. |
| H4 dead cookie costs a counted `4xx` on every batch process | **Closed** | Spine 1817-1818; §13.3 1209-1220 (hold-off written on `not-elevated`, `probe-rejected` and a downgrade, for 24h); AD-12 939; Prevents 1788. | — |
| M1 auth state after a probe `429` | **Closed** | Spine 1806-1807 ("A probe `429` settles nothing"); §13.3 1211, 1215-1216; §13.5 1255 (`probe-rejected` excludes `429`); AD-12 939 ("Each probe `429` allows one more"). | The penalty can be lost. See **N6**. |
| M2 "lastAttemptedAt alone" against AD-9 | **Closed** | §13.4 1239-1240 ("An answered search keeps its two search fields (AD-9)"); AD-9 729-732. | A 2xx downgrade case is new. See **N4**. |
| M3 which requests carry the cookie; two rules for a gate `401` | **Closed** | Spine 1800-1801 ("pricing searches and fetches only, never on the league request"); SPEC 29, 66. A gate `4xx` is now only an AD-12/AD-7 gate abort. | — |
| M4 `sync-report.json` contract | **Partly** (2026-10-03: `web` half closed by spine AD-30 1839-1840 and EXPERIENCE.md 554) | §13.7 1271-1273 (`1.2.0`, a reader accepts a `1.1.0` report without the key); AD-12 945-946. | The rule does not say whether a `1.2.0` writer always writes `session-probe: 0`. The Zod record is exhaustive, so this decides validity. It also does not say whether `web` shows the figure. |
| M5 cost of the cold reset is understated | **Closed** | Spine 1813-1815 ("Accepted cost: the next request can receive a `429` … one `Ip` counter"); AD-8 651-653. | — |
| M6 "factories cannot accept it" is not enforceable; `sync:dry` | **Partly** | `sync:dry` is named: §13 1165-1166, SPEC 59. | Spine 1791-1792 still says "cannot accept it" and binds no mechanism or test. `composeChunk` is shared with `sync:dry` (`compose-chunk.ts:1-3`), so an optional holder field accepts the cookie there too. |
| M7 leak surface: `Set-Cookie`, ports below the client | **Partly** | Error redaction: spine 1797-1798; §13.6 1263-1264. | `Set-Cookie` removal and the ports below the client are not addressed. |
| M8 SPEC.md and `prd.md` not edited | **Closed** | SPEC CAP-1 23-29 (baseline, then probe, then cookie requests), 67; `prd.md` 546 (NFR-9 departure), 571 (scope), 367; the "Authenticated sync" deferral is gone. | — |
| L1 console line placement and stream | **Partly** | §13.5 1251 (`absent` prints "on every run"). | The stream, and whether `not-probed` (1257) prints on SIGINT, busy, deferred or dispossessed exits, are not bound. See **N11**. |
| L2 probe pacing and allowance | **Open** | — | §13.2 1185-1187 does not say how the probe is paced or bounded. See **N8** and **N9**. |
| L3 silent expiry (2xx with fewer rules) | **Closed** | §13.4 1228 (`a 2xx with ¬live(r)`); spine 1810-1811. | — |
| L4 §6 seeding ignores the probe | **Open** | — | §6 736-749 is unchanged. Under `sync:batch` the probe spends at most one search per 24h with the hold-off, and every chunk while the cookie is live. |
| L5 code comments and the owner of the `.env` documentation | **Partly** | `stories.yaml` 7 assigns the `.env` documentation to a story. | No story or memlog lists the comments that the revision makes false (`user-agent.ts:9`, `sync-run-report.ts:21,31`, `compose-chunk.ts:5-7`). |

### review-rev24-adversarial.md

| ID | Status | Closing line(s) | Still open |
| --- | --- | --- | --- |
| C1 nothing owns the auth state | **Closed** | Spine 1794-1796; Prevents 1786. | See **N2**. |
| C2 thrown text reaches a committed artifact | **Partly** | §13.1 1173 and §13.6 1262-1263 (a `malformed` value is refused before an HTTP stack can quote it); §13.6 1263-1264 (the governor redacts each error and its cause chain); §13.6 1266-1267 (the canary test). | `stack` is not named. The second layer in `failureRecord` and the shells' stderr writers is not bound. The canary predicate cannot be tested (adv M4). |
| H1 three readings of a probe `429` | **Partly** | §13.3 1211 (not counted, settles nothing, "the next request yields with the penalty"); 1215-1216; §13.5 1255. | The probe is not bound as eager and atomic, so both placements are legal (**N8**). The latched penalty can be lost when no next request follows (**N6**). |
| H2 downgrade chunk has no outcome kind, exit code or session wait | **Partly** | §13.4 1236-1242 (outcome kind, no `notBefore`, no record, exit 0, the wait); AD-7 527-528. | §13.4 1234-1235 says the reset happens "in place" so that the session does not see a fresh reading. That does not hold. See **N1**. |
| H3 cold reset sends the next request unpaced; reverse leak | **Partly** | The cold reset is kept, and its cost is accepted: spine 1813-1815, AD-8 651-653. | Reverse leak: §13.2 1196-1197 still folds every probe reading into the ledger, `not-elevated` and `probe-rejected` included. Prevents 1787 claims the opposite. |
| H4 two liveness tests | **Closed** | Spine 1803-1805 ("One liveness test applies to every response that carried the cookie"); §13.4 1224-1228; OQ-26 2271-2280. | Header-less responses. See **N7**. |
| H5 which requests carry the cookie | **Closed** | Spine 1800-1801. | — |
| M1 dead cookie under `sync:batch` | **Closed** | Spine 1817-1818; §13.3 1218-1220; AD-12 939, 1014. | — |
| M2 trigger, port and result shape of the settle | **Partly** | Accounting: §13.2 1198-1199. Body: §13.2 1196 ("The baseline's answer is the pricing step's result"). | The trigger (**N10**) and which response's `remaining` the result carries (**N9**) are still open. |
| M3 fetch downgrade against AD-9 | **Closed** | §13.4 1239-1240. | — |
| M4 "any part of the value" cannot be tested | **Closed** 2026-10-03: §13.6 1301-1304 (canary of 32+ chars, any 8+ char substring, raw, URL-encoded or base64) | — | §13.6 1262 and 1267 still say "any part", and SPEC CAP-4 (49) says "no fragment". |
| M5 line count for runs that send nothing | **Partly** | `sync:dry` prints nothing, because it never reads the value (§13 1165-1166). `absent` prints on every run (§13.5 1251). | The unit that prints, the stream, and `not-probed` on deferred, busy and SIGINT exits are not bound. See **N11**. |
| M6 a transient probe fault disables the cookie | **Closed** 2026-10-03: §13.3 1213, 1218-1223; §13.5 1291 | A throw or timeout settles `probe-failed` for the process, with no hold-off (§13.3 1213). | A `5xx` falls under "any other non-2xx" and becomes `probe-rejected` with a 24h hold-off. See **N5**. |
| M7 a non-cookie `401`/`403` is read as expiry | **Closed (decided: no carve-out)** 2026-10-03: spine 1814-1819 (rejected carve-out, accepted cost); §13.3 1212, 1215-1216; §13.4 1253-1254 | — | There is no Cloudflare or HTML-body carve-out and no accepted-cost sentence. The hold-off makes this worse. See **N5**. |
| L1 env value inherited | **Partly** | Spine 1789-1792 (only two shells read it). | The child processes of the git port still inherit `POESESSID`. |
| L2 the `session-probe` figure is public | **Closed** 2026-10-03: spine 1835-1840 | Spine 1821-1822 names it as the one cookie trace. The schema bump is in §13.7 1271-1272. | The rule does not say that the trace is published to Pages. `authHoldOffUntil` is a second committed trace. See **N15**. |
| L3 `Set-Cookie` on responses | **Open** | — | The rule does not say that `set-cookie` is removed before the `HttpResponse` leaves the governor (`client.ts:132-160`). It does not ask `fixtures:record` to check for the header. |
| L4 probe ordering against the gates | **Closed** | §13.2 1183 (the baseline is a pricing search, which comes after every gate by AD-12 968-972); §13.1 1175. | — |

### review-rev24-verification.md

| ID | Status | Closing line(s) | Still open |
| --- | --- | --- | --- |
| F1 expiry signal assumed, stated as fact | **Closed** | OQ-26 2271-2280 (assumed, safe either way, re-check by 2026-11-02); §13.4 1228 (structural downgrade); SPEC 96. | — |
| F2 browser `User-Agent` premise not recorded | **Closed** 2026-10-03: spine 1842-1845, §13.7 1312-1314, OQ-26 2300-2303, SPEC 77, `prd.md` 546 (operator observation, OQ-26 verifies) | Spine 1824-1825 no longer states it as an API fact. OQ-26 2278-2279 asks for the contact-UA capture. | `prd.md` 546 ("because the trade API accepts nothing else for it") and SPEC 74 ("The trade API accepts only a browser User-Agent") still state it as fact. |
| F3 liveness test rests on one capture | **Closed** | OQ-26 2271-2272, 2277-2278 (re-check date, record the rule names of the first live run). | — |
| F4 dead cookie costs a counted `4xx` on every process | **Closed** | Spine 1817-1818; §13.3. | — |
| F5 `prd.md` does not record the departure | **Closed** | `prd.md` 546, 571. | — |
| F6 OAuth facts carry no date | **Open** | — | Deferred 2127-2130 still has no access date. |
| F7 browser UA also affects the cookie-free commands | **Closed** | §13.7 1275-1277. | — |

**Tally:** rubric 9 closed, 6 partly, 2 open. Adversarial 6 closed, 9 partly, 3 open.
Verification 5 closed, 1 partly, 1 open.

## New divergences that the fixes created (adversarial lens)

Each finding names two builders, A and B. Both obey every current line, and their units are
incompatible.

### N1. The session's `backoff(1)` after a downgrade cannot be reached by the stated mechanism

- **Where:** §13.4 1234-1235 ("resets … **in place**, so that the session does not take the
  reset for a fresh State reading") and 1241; AD-7 527-528.
- **Code shape:** the session decides freshness by reference: `freshReading: pacing.ledger !==
  ledgerBefore` (`sync.ts:591`). The ledger is an immutable value. `recordObservation` returns a
  new one, and `EMPTY_LEDGER` is a constant (`client.ts:454`, `:334`). A reset "in place" on
  `PacingState` still assigns `pacing.ledger`, so the reference changes. A session chunk is one
  entry, and its earlier responses (the baseline, the probe, the downgrading response) already
  replaced the ledger. So `freshReading` is `true`, and `nextWait` returns `NO_WAIT` for a
  yielded chunk (`sync.ts:278-280`). `ChunkOutcome`'s `yielded` arm has no reason field
  (`run-chunk.ts:366-377`), so `nextWait` cannot tell `session-expired` from a `5xx`.
- **A:** follows §13.4 literally and gets no wait.
- **B:** adds a reason to the outcome and a `nextWait` row, and waits `backoff(1)`.
- **Fix (§13.4):** Remove the "so that the session does not take …" clause. Bind this: "The
  `yielded` outcome carries `endedBy: 'session-expired'`. `nextWait` maps it to `backoff(1)`,
  ahead of the freshness test, and `nextState` sets `backoffCount` to 1."

### N2. Three texts disagree on who writes the hold-off and who changes the state

- **Where:** §13.4 1233 and 1236 ("the governor … drops the cookie … writes the hold-off");
  §13.3 1218-1219 ("Sync writes both with the chunk's other `sync-progress.json` writes, under
  the lock"); spine 1796 ("only the holder changes the state").
- **Code shape:** the governor has no filesystem port (`client.ts:377-386`). Progress is written
  only by `publish` in the runner (`run-chunk.ts:643-673`).
- **A:** gives the governor a filesystem port and writes the file at once, which is outside the
  chunk's ordered writes.
- **B:** has the holder record the outcome, and the runner writes it.
- **Fix:** "The governor reports the response to the holder. The holder changes the state and
  records a pending hold-off action (`write` or `clear`). The runner reads that action and
  applies it in `publish`." Change §13.4 step 3 to "records the hold-off".

### N3. No rule says whether a progress write keeps `authHoldOffUntil`

- **Where:** §13.3 1218-1220; §5.3 636 (`notBefore`: "ends for any other reason clears the
  field"); `run-chunk.ts:665-671` builds the file again from nothing on each write.
- **A:** follows the `notBefore` precedent. Every ending that does not write the field drops
  it, so a `held-off` run, a `probe-failed` run, a no-cookie run or a probe-`429` run clears
  the hold-off.
- **B:** keeps the loaded value. A new hold-off is also lost on every ending that publishes
  nothing: a league mismatch, a throw before the order, deferred, dispossessed. The rule does
  not say whether that loss is accepted.
- **Fix (§13.3):** "Every progress write keeps the loaded `authHoldOffUntil`, unless this
  process wrote or cleared it. An ending that writes no progress drops a new hold-off. That
  loss is accepted, because the next process probes once."

### N4. A downgrade on a 2xx response discards an answered search or fetch

- **Where:** §13.4 1228 (`a 2xx with ¬live(r)` is a downgrade), 1237 (the governor returns a
  yield), 1239-1240 ("An answered search keeps its two search fields"); AD-9 722-725 ("the unit
  is the request").
- **Code shape:** the step reads the search `id` only from a `response` result
  (`price-entry.ts:315-324`). `TradeYieldResult.response` is optional (`client.ts:159`).
- **A:** returns the yield without a response. The answered search's `id` is lost, which is
  against AD-9. A 2xx fetch's listings are also discarded.
- **B:** attaches the response to the yield, and the step parses it. This gives the entry
  different search fields, and maybe a price.
- **Fix (§13.4):** Either "a 2xx downgrade returns the response, and the client yields
  `session-expired` on the **next** `send`" (the request stands), or "a 2xx downgrade's answer
  is discarded, and the entry is treated as a request that got no answer". AD-9 1239's wording
  must name the result that is chosen.

### N5. A transient or edge refusal of the probe holds the cookie off for 24 hours

- **Where:** §13.3 1212 ("any other non-2xx" → `probe-rejected`, hold-off written) against 1213
  (throw or timeout → `probe-failed`, no hold-off); AD-9 721 (a `5xx` is "no answer", with
  `429` and timeout).
- **A:** maps a probe `503` to `probe-rejected` by the table and writes a 24h hold-off. A
  Cloudflare `403` challenge does the same (adv M7 is still open).
- **B:** follows AD-9's grouping. It treats the `5xx` as no answer, which is `probe-failed`,
  and writes no hold-off.
- **Fix (§13.3):** "A `5xx` is `probe-failed`. `probe-rejected` is a non-429 `4xx`." Decide
  adv M7 in the same edit: a `403` with `cf-mitigated` or an HTML body is `probe-failed`.

### N6. The penalty latched by a probe `429` is lost when no next request follows

- **Where:** §13.3 1211 ("The next request yields with the penalty, and `notBefore` follows
  §5.3"); §5.3 636 (a chunk that completes clears `notBefore`).
- **Case:** the baseline search returns zero results, so there is no fetch, and it is the last
  entry of the chunk, or the chunk is bounded after it. The chunk completes, `notBefore` is
  cleared, and the next batch process sends into the penalty.
- **A:** latches the penalty in the governor and loses it with the governor.
- **B:** has the runner read the latch at `publish` and write `notBefore`.
- **Fix:** "A probe `429` ends the chunk as a `429` yield at once. The step receives the yield
  in place of the next request's result, or, where the chunk would end, the runner writes
  `notBefore` from the latch."

### N7. A 2xx with no `X-Rate-Limit-Rules` header downgrades the cookie and holds it off

- **Where:** §13.2 1188-1192 (`names(h)` of an absent header is the empty set); §13.4 1228.
- **Code shape:** the client accepts responses with no readable rule elsewhere, and leaves
  `remaining` undefined (`client.ts:122-129`, `:263-273`).
- **A:** treats an absent header as zero names. One header-less 2xx then drops a live cookie
  and writes a 24h hold-off. If the baseline has no header (count 0), every probe with one rule
  is `live`, which is a false `authenticated`.
- **B:** treats an absent or unreadable header as giving no result.
- **Fix (§13.2):** "`live` is decided only for a response whose Rules header parses. A baseline
  without one is not a baseline, and the next answered search is the baseline. A cookie
  response without one is not a downgrade."

### N8. Where the probe is sent, how it is paced and what bounds it are not bound

- **Where:** §13.2 1185-1187 ("when baseline.status is 2xx, before that entry's fetch").
- **A (eager):** the governor sends the probe inside the baseline's `send`, at once, with no
  wait.
- **B (lazy):** sends the probe before the next `send`. When the entry has no fetch (zero
  results) and the chunk ends, B never probes and prints `not-probed`.
- **C:** paces the probe with the spread, so under the session it waits about 2.5 s after the
  baseline. With a baseline `remaining` of `0`, A sends into an empty bucket.
- **Fix (§13.2):** "The governor sends the probe straight after a 2xx baseline, inside the same
  `send`. It paces the probe like any request on the baseline's lane. It skips the probe, and
  the state stays unsettled, when the baseline's `remaining` is below 1."

### N9. The rule does not say which `remaining` rides on the baseline's result

- **Where:** §13.2 1196 ("The baseline's answer is the pricing step's result") is silent on
  `remaining` and `policy`.
- **Code shape:** the runner computes `discoveredAllowance` and pinned truncation from
  `searchRemaining` (`run-chunk.ts:818-827`, `price-entry.ts:325`).
- **A:** returns the baseline's `remaining`, which is one too high because the probe spent a
  search.
- **B:** returns the probe's `remaining`.
- **Result:** the pinned-starvation record differs by one.
- **Fix:** "The result carries the probe's `remaining` and `policy`, which is the later
  reading."

### N10. The client still cannot recognise "the first pricing search"

- **Where:** §13.2 1183, 1198-1199; `client.ts:95-105` (lanes are opaque, and the client never
  compares a lane to a literal); `compose-chunk.ts:108-112` (a source is known by its port).
- **A:** keys on `method === 'POST'`.
- **B:** keys on the `tracked-list` client.
- **C:** adds a request flag.
- **Port:** the probe is counted under `session-probe`, but the rule does not say whether that
  needs a third counted port or a re-labelled count. The behaviour is the same on the chunk
  path today. It diverges as soon as a second POST source appears.
- **Fix:** Bind one mechanism, for example a `probeEligible` flag that the pricing step sets on
  its search, and a third `session-probe` port in the governor's `http` record.

### N11. The rule does not say which unit prints the auth line, or on which stream

- **Where:** spine 1820; §13.5 1246-1257; SPEC CAP-2 (32, "exactly one warning line").
- **Code shape:** the runner logs to stderr by default (`compose-chunk.ts:56`). The batch shell
  prints its outcome to stdout (`sync-batch.ts:75`). The session prints to both
  (`sync.ts:580-583`).
- **A:** the shell prints. **B:** the holder prints through an injected writer. **C:** the
  runner prints, so a session prints once per chunk unless the holder deduplicates.
- **`not-probed` (1257):** "the process ended" does not name SIGINT, `busy`, `deferred` or
  `dispossessed`. A deferred batch run with a valid cookie never reaches the hold-off read, so
  one builder prints `not-probed` and another prints nothing.
- **Fix (§13.5):** "The holder emits every line, once per state change. Warnings go to stderr,
  and `authenticated` goes to stdout. `not-probed` prints on every exit after the `notBefore`
  check, SIGINT included, and on no exit before it."

### N12. "The run reads `authHoldOffUntil`" does not say once per chunk or once per process

- **Where:** §13.1 1175-1178; spine 1803 ("settles once per process").
- **Code shape:** under the session, every chunk takes the lock and checks `notBefore`
  (`run-chunk.ts:519-552`).
- **A:** reads the hold-off on every chunk. A hold-off that a concurrent `sync:batch` wrote can
  then move an `authenticated` session to `held-off`, which is a downgrade that §13.4 does not
  define.
- **B:** reads it once, on the first chunk that passes `notBefore`.
- **Fix (§13.1):** "The holder reads the hold-off once, on the first chunk that passes the
  `notBefore` check. A settled state ignores it."

### N13. The invalid-request count on a downgrade is asserted in SPEC.md and missing from §13

- **Where:** SPEC CAP-3 45 ("no invalid-request count"); §13.4 1230-1237 is silent.
- **A:** counts the `401` (`client.ts:461-463` counts every `4xx`) and then yields.
- **B:** does not count it.
- **Result:** nothing differs at run time, because the chunk ends. The CAP-3 test passes for
  one build and fails for the other.
- **Fix:** Add "not counted" to §13.4, as the §13.3 table does for the probe.

### N14. The `cookie-value` grammar allows a quoted form

- **Where:** §13.1 1173. RFC 6265 `cookie-value = *cookie-octet / ( DQUOTE *cookie-octet DQUOTE )`.
- **A:** sends `"abc"` with the quotes.
- **B:** removes the quotes.
- **C:** rejects the value as `malformed`.
- **Note:** Node's `--env-file` already removes the outer quotes, so this matters only for a
  value that the shell exported directly.
- **Fix:** "The value must match `*cookie-octet` after the trim. A quoted value is
  `malformed`."

### N15. `authHoldOffUntil` is a second committed cookie trace

- **Where:** spine 1821-1822 ("Its one cookie trace is the `session-probe` request count");
  §13.3 1218; AD-7 508-509 (`sync-progress.json` is tracked in git).
- **Result:** the hold-off instant is public in the history and adds a diff to a data commit
  every 24h while a cookie is dead. One reviewer reads 1821 as being about the report only.
  Another reads it as about all output.
- **Fix:** In AD-30, say "the report's one trace", and name the hold-off as the progress
  file's trace that the rule accepts.

## Findings (JSON)

```json
[
  {"lens":"adversarial","location":"IMPLEMENTATION-NOTES §13.4 lines 1234-1235, 1241; spine AD-7 527-528","trigger_condition":"The in-place reset cannot hide a fresh reading: freshReading compares ledger references (sync.ts:591), the ledger is immutable, and the chunk's responses already replaced it, so nextWait returns NO_WAIT; the yielded outcome has no reason field","guard_snippet":"The yielded outcome carries endedBy 'session-expired'; nextWait maps it to backoff(1) ahead of the freshness test; remove the 'so that the session does not take…' clause","potential_consequence":"A literal build sends the next session chunk at once after a downgrade; another waits backoff(1)"},
  {"lens":"adversarial","location":"§13.4 lines 1233, 1236; §13.3 1218-1219; spine AD-30 1796","trigger_condition":"The governor 'writes the hold-off' and drops the cookie, the runner writes progress, and 'only the holder changes the state'","guard_snippet":"The governor reports to the holder; the holder changes state and records a pending hold-off action; the runner applies it in publish","potential_consequence":"One build gives the governor a filesystem port outside the ordered writes; another routes the write through the runner"},
  {"lens":"adversarial","location":"§13.3 1218-1220; §5.3 636; run-chunk.ts:665-671","trigger_condition":"No rule says whether a progress write keeps authHoldOffUntil; the notBefore precedent clears the field on every other ending","guard_snippet":"Every progress write keeps the loaded value unless this process wrote or cleared it; an ending with no progress write drops a new hold-off (accepted)","potential_consequence":"A held-off, no-cookie or probe-failed run clears the hold-off in one build, so the dead cookie is probed on every run again"},
  {"lens":"adversarial","location":"§13.4 1228, 1237, 1239-1240; spine AD-9 722-725","trigger_condition":"A 2xx ¬live downgrade returns a yield, so the answered search id or fetch listings never reach the step","guard_snippet":"Either return the response and yield on the next send, or state that a 2xx downgrade's answer is discarded","potential_consequence":"Entries differ in lastSearchId/lastSearchLeague and maybe price between builds; AD-9's unit-is-the-request rule is broken in one"},
  {"lens":"adversarial","location":"§13.3 1212-1213; spine AD-9 721","trigger_condition":"A probe 5xx or a Cloudflare 403 is 'any other non-2xx', so probe-rejected writes a 24h hold-off; a timeout writes none","guard_snippet":"A 5xx, and a 403 with cf-mitigated or an HTML body, is probe-failed; probe-rejected is a non-429 4xx","potential_consequence":"One transient 503 disables a live cookie for a day across all processes in one build and not in another"},
  {"lens":"adversarial","location":"§13.3 1211; §5.3 636","trigger_condition":"'The next request yields with the penalty' gives no result when no next request follows (zero-result baseline at the end of a chunk)","guard_snippet":"The runner writes notBefore from a latched probe 429 at publish, or the probe 429 ends the chunk at once","potential_consequence":"The completed chunk clears notBefore, and the next batch process sends into the penalty, which GGG counts"},
  {"lens":"adversarial","location":"§13.2 1188-1192; §13.4 1228","trigger_condition":"A response with no X-Rate-Limit-Rules header has zero names, so a header-less cookie 2xx is ¬live and a header-less baseline makes any probe live","guard_snippet":"live is decided only for a response whose Rules header parses; no header means no baseline and no downgrade","potential_consequence":"A spurious downgrade with a 24h hold-off, or a false 'authenticated', depending on the build"},
  {"lens":"adversarial","location":"§13.2 1185-1187","trigger_condition":"The probe's placement (eager or lazy), its pacing and its remaining<1 guard are not bound","guard_snippet":"The governor sends the probe straight after a 2xx baseline inside the same send, paced on the baseline's lane, and skips it when the baseline's remaining < 1","potential_consequence":"A lazy build never probes on a zero-result last entry; an eager unpaced build sends into an empty bucket"},
  {"lens":"adversarial","location":"§13.2 1196; run-chunk.ts:818-827","trigger_condition":"The rule does not say which response's remaining and policy ride on the baseline's result","guard_snippet":"The result carries the probe's remaining and policy","potential_consequence":"discoveredAllowance and pinned truncation differ by one search between builds"},
  {"lens":"adversarial","location":"§13.2 1183, 1198-1199; client.ts:95-105; compose-chunk.ts:108-112","trigger_condition":"The client has opaque lanes and no rule tells it which request is the pricing search, or which port counts the probe","guard_snippet":"Bind a probeEligible flag that the pricing step sets, and a third session-probe port in the governor's http record","potential_consequence":"POST-keyed, client-keyed and flag-keyed builds diverge once a second POST source exists, and the session-probe count differs"},
  {"lens":"adversarial","location":"spine AD-30 1820; §13.5 1246-1257; SPEC CAP-2","trigger_condition":"The unit that prints the auth line, its stream, and not-probed on SIGINT, busy, deferred or dispossessed exits are not bound","guard_snippet":"The holder emits each line once per state change; warnings go to stderr and 'authenticated' to stdout; not-probed prints on every exit after the notBefore check","potential_consequence":"Per-chunk duplicate lines under the session, and CAP-2's 'exactly one line' test is unstable between builds"},
  {"lens":"adversarial","location":"§13.1 1175-1178; spine AD-30 1803","trigger_condition":"'The run reads authHoldOffUntil' does not say once per session chunk or once per process","guard_snippet":"The holder reads the hold-off once, on the first chunk that passes notBefore; a settled state ignores it","potential_consequence":"A session can be moved from authenticated to held-off by a concurrent batch write, which is a state change that §13.4 does not define"},
  {"lens":"adversarial","location":"§13.4 1230-1237; SPEC CAP-3 line 45","trigger_condition":"SPEC asserts the downgrade adds no invalid-request count; §13 is silent, and the client counts every 4xx","guard_snippet":"Add 'not counted' to §13.4","potential_consequence":"The CAP-3 test passes for one build and fails for another"},
  {"lens":"adversarial","location":"§13.1 1173","trigger_condition":"RFC 6265 cookie-value allows a DQUOTE-wrapped form","guard_snippet":"The value must match *cookie-octet after the trim; a quoted value is malformed","potential_consequence":"Builds send, strip or reject a quoted value"},
  {"lens":"adversarial","location":"spine AD-30 1821-1822; §13.3 1218; AD-7 508-509","trigger_condition":"authHoldOffUntil in the git-tracked sync-progress.json is a second cookie trace, but AD-30 says there is one","guard_snippet":"Say 'the report's one trace' and name the hold-off as the progress file's trace that the rule accepts","potential_consequence":"Reviewers disagree on whether the hold-off breaks AD-30, and a builder may hide or drop it"}
]
```

## Order of closure

1. N1, N2 and N3 together. They decide the holder-to-runner interface: the outcome reason and
   the hold-off action.
2. N4, N5 and adv M7. These are the classification rules in §13.3 and §13.4.
3. N6, N7, N8 and N9, with rubric L2. These are the probe mechanics in §13.2.
4. N10, N11 and N12, with rubric L1 and adv M5. These are the interface and console bindings.
5. Adv M4 (canary predicate), adv L3 and rubric M7 (`Set-Cookie`), and rubric M4 (the
   `session-probe: 0` write rule).
6. The citation-level edits: rubric L4 (§6), verification F2 (`prd.md` 546 and SPEC 74), F6,
   N13, N14 and N15.

No item needs a PRD edit except F2's rewording of the "accepts nothing else" premise in
NFR-9. That is a change to how a reason is worded, not to scope.

## Operator decisions applied (2026-10-03)

The operator decided items 1-8 of the closure step. SPEC-poesessid-sync carries the
capabilities, and AD-30 and §13 carry the mechanism. Line numbers are the working tree after
the edit.

| Finding | New status | Closing line(s) | Still open |
| --- | --- | --- | --- |
| N2 who writes the hold-off | **Partly** | §13.3 1236-1239 (the holder records `write` or `clear`, the runner applies it in `publish`, no other unit writes the field); §13.4 1258-1265 step 3. | The governor still drops the cookie (§13.4 step 1) while spine 1796 says only the holder changes the state. |
| N3 does a progress write keep `authHoldOffUntil` | **Closed** | §13.3 1241-1246; spine 1831-1833. | — |
| N4 2xx downgrade discards an answer | **Closed** | §13.4 1264-1275 (yield with no response; `price-entry` reads it as AD-9's request with no answer; order: reset, hold-off recorded, entry stamped, one progress write); spine 1824-1825. | — |
| N5 probe `5xx` and Cloudflare `403` | **Closed** | §13.3 1212-1223 (table split; every `401`/`403` is `probe-rejected`; a probe `5xx` feeds no `5xx` or abort rule); §13.5 1290-1291; spine 1809-1819. | — |
| N6 probe `429` penalty lost | **Closed** | §13.3 1225-1231 (latch, runner reads it before `publish`, `notBefore` by §5.3); spine 1807-1809. | §5.3 636 does not cite the exception. §13.3 1230-1231 states it. |
| N13 downgrade not counted | **Closed** | §13.4 step 4 ("not counted toward the invalid-request count"). | — |
| N15 second committed trace | **Closed** | Spine 1835-1840. | — |
| adv M4, adv M6, adv M7, adv L2, F2 | See the closure tables above. | | |

Not in the operator's eight items, and still open: N1, N7, N8, N9, N10, N11, N12, N14;
rubric H3, M4 (`session-probe: 0`), M6, M7, L1, L2, L4, L5; adv C2, H1, H3, M2, M5, L1, L3;
verification F6.
