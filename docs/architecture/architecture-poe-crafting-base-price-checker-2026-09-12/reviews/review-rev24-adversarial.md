---
type: architecture-review
lens: adversarial
target: ARCHITECTURE-SPINE.md revision 24 (AD-30, amendments to AD-8, AD-9, AD-12, Conventions, Deployment, Deferred) and IMPLEMENTATION-NOTES.md §13
date: '2026-10-02'
inputs:
  - git diff -- docs/architecture (working tree against fa1a1a8)
  - docs/specs/spec-poesessid-sync/SPEC.md (the probe shape as amended: the baseline is the first pricing search, and one probe re-sends that body with the cookie)
  - docs/research/technical-poesessid-vs-oauth-for-trade-api-rate-li-2026-10-02/digests/capture-trade2-headers.md
  - packages/sync/src (trade/client.ts, trade/ledger.ts, compose-chunk.ts, sync.ts, sync-batch.ts, chunk/run-chunk.ts), read only to ground the unit shapes
---

# Adversarial review: spine revision 24 (AD-30)

## Verdict

**Not ready to bind.** AD-30 assumes one trade client for each process. AD-8 and the
code build a new governor for each chunk. Because of this, no unit owns the auth state, and
a builder who obeys AD-30 exactly ("no component other than the client holds it") cannot
build the `pnpm sync` session. Also, an existing path writes the text of every thrown error
into `sync-report.json`, which is committed and published. The ordering of the probe, the
downgrade path and the liveness test each allow two builds that obey the text and are
incompatible. Two of these are critical and five are high. Each finding has a fix that is a
tightened rule and not a redesign.

Each finding names two units, A and B. Each unit obeys every AD as written, and the units
are incompatible. The fix is the rule that removes one of the two readings.

---

## Critical

### C1. Nothing owns the auth state: per-process state against a per-chunk governor

- **A (session shell, `sync.ts`):** AD-8 says "each chunk gets a fresh governor seeded with
  that state". `composeChunk` builds the governor for each chunk from values that the session
  passes in, including `userAgent` (`compose-chunk.ts:108-118`, `sync.ts:563-569`). AD-30 says
  the cookie goes "into the trade-client factory as a value". So the session passes the cookie
  into each `composeChunk`. The session then holds the cookie for the whole process. This
  breaks "No component other than the client holds it after the factory call". Each new
  governor also starts with a new auth state. As a result it re-probes on each chunk, prints
  a settle line on each chunk, and **re-arms the cookie on the chunk after a downgrade**. So
  "drops the cookie for the rest of the process" lasts for one chunk only.
- **B (the same shell, built to obey AD-30):** creates the client once for each process and
  makes it outlive the chunks. This breaks AD-8's fresh governor for each chunk, which keeps
  invalid-request counts per chunk. A 401 then refuses the search policy for the rest of the
  session.
- **Why it is a hole:** AD-30 says the state is "per process" and "settled once", and AD-8
  says the client is per chunk. Neither AD names the process-scoped holder that `PacingState`
  is for pacing.
- **Fix (AD-30 and AD-8):** Name a process-scoped **`SessionAuth`** holder, the auth
  equivalent of `PacingState`. The shell creates it once at the shell edge from the env
  value, through a factory in `trade/`. It holds the cookie value and the state, it is opaque,
  and it exposes only `{ state, reason }`. The shell passes it into the governor of each chunk
  as it passes `pacing`. Only the governor reads the value, through a module-private accessor.
  Change AD-30's sentence to: "No component other than the `SessionAuth` holder and the
  governor that it is passed to can read the value. The shells pass the holder and never the
  string." `SessionAuth` is the **only** unit that changes state (settle, downgrade), so the
  per-process guarantees hold for each chunk. `sync:batch` builds one holder for its one chunk.

### C2. Thrown text already flows into a committed, published artifact

- **A (governed client):** attaches `Cookie: POESESSID=<value>` and passes the request to
  `HttpPort`. The shell's `fetch` adapter (`shell.ts:57-59`) passes the headers to undici.
  When undici rejects a header value, for example a value from `.env` that has a stray `"`,
  a space or a `;`, it throws a `TypeError` whose message quotes the value. That is not
  `fetch failed`, so `isTransportFailure` rethrows it (`trade/transport-failure.ts`).
- **B (chunk runner):** obeys *Error shape*. It turns any unrecoverable throw into a
  `run-failure` record with `message: error.message` (`run-chunk.ts:474-491`). Both shells
  also print `error.message` to stderr (`sync.ts:583`, `sync-batch.ts:78`).
  `sync-report.json` is committed and deployed to Pages (AD-3, AD-24).
- **The test-suite variant:** a fake `HttpPort` in a test that throws
  `Unexpected request ${JSON.stringify(request)}` on an unrecorded fixture follows the same
  path. AD-30's rule ("No yield, throw, error message … carries the value") binds the
  component that throws. Here a third-party library and a test double throw, and nothing
  sanitises the text on the way out.
- **Fix (AD-30 and §13):**
  1. The `SessionAuth` factory validates the value against RFC 6265 `cookie-octet` after the
     trim. If the value fails, it settles `unauthenticated (malformed)` before the first
     request. The fixed message names no part of the value, and the exit code does not
     change. Add `malformed` to §13's reason table.
  2. The governor catches every rejection from `http.send` on a request that carried the
     cookie. It rethrows the error with the value replaced by a fixed token in `message`,
     `stack` and each `cause` in the chain. Then the error goes to `isTransportFailure`.
  3. `failureRecord` in `run-chunk.ts` and the stderr writers of both shells pass the text
     through the same redactor, as a second layer.
  4. The binding test sets a canary cookie and forces three throws: an invalid header value,
     an unrecorded fixture and a timeout. It then scans stdout, stderr and every file written
     under `data/`.

---

## High

### H1. A 429 on the probe has three readings, and one of them loses the `notBefore`

- **§13's table** says `probe-rejected` is "the probe got an answer that is not 2xx". That
  includes 429. Step 4 of AD-30 says that a 429 on the probe persists `notBefore` and yields,
  and does not say whether it settles the state.
- **A (eager probe, inside the baseline's `send`):** returns the probe's yield in place of
  the baseline's 2xx. The pricing step then sees a search that "got no answer". It stamps
  `lastAttemptedAt` alone and **drops a search id that did get an answer**. This breaks
  AD-9's "the unit is the request".
- **B (eager probe, returns the baseline's 2xx):** the step goes on to the fetch. The client
  (`client.ts:461-463`) counted the probe's 429 as an invalid request. With threshold 1 the
  client refuses the fetch with reason `invalid-request-threshold`, `retryAfterMs: 0`.
  `penaltyRetryAfterMs` then returns `undefined`, so **no `notBefore` is persisted**. This
  contradicts step 4. If the 429 was not counted, the fetch goes into the penalty, which
  AD-8 forbids.
- **C (lazy probe, before the next `send`):** the fetch call receives a 429 that belongs to
  the search policy. The `notBefore` is correct, but the fetch lane learns the wrong policy.
- **Settle:** the 429 settles `unauthenticated` (by the table) or leaves the state unsettled
  (by step 4). Under the session, AD-12's "at most once per process" then disables the
  cookie until the process exits.
- **Fix (§13):**
  - The probe is **eager and atomic** inside the governor's handling of the baseline. The
    baseline's own result is the value that `send` returns, so AD-9 sets the search fields.
  - A probe 429 **latches** a penalty in the governor. The next `send` of the chunk returns
    a yield with reason `retry-after-header` or `derived-penalty` and the probe's
    `retryAfterMs`, so §5.3's `notBefore` follows unchanged.
  - The probe 429 does not enter the invalid-request count.
  - A probe 429 **does not settle**. The next answered pricing search is the baseline again,
    and AD-12's row becomes "at most one *answered* probe per process".
  - Change `probe-rejected` to "a non-2xx answer other than 429".

### H2. The chunk that ends on a downgrade has no outcome kind, no exit code and no session wait

- **A (runner):** ends the chunk as `yielded`. It publishes the dataset and progress, clears
  `notBefore` (§5.3: "ends for any other reason clears the field") and exits 0.
- **B (runner):** reads "persists no `notBefore`, writes no report record" as "writes
  nothing". It takes the abort path without the record, so the dataset is not published and
  the exit code is whatever that path gives. The current non-429 `4xx` path is a
  `MalformedRequestError` that exits 1.
- **Session wait:** none of AD-7's wait-by-outcome classes match. `sync.ts:591` sets
  `freshReading` to `pacing.ledger !== ledgerBefore`. **A reset to cold replaces the ledger
  object, so it counts as a fresh State reading.** This resets the backoff to 0, and the cold
  ledger gives a pre-wait of 0. So the session sends the next chunk at once, unpaced. One
  builder does that. A second builder treats the case as "a yield that brought no reading"
  and waits `backoff(1)`.
- **Batch, fetch lane:** the invalid-request count is keyed per policy (§5.3). A 401 on the
  *fetch* policy does not refuse the next entry's search. Under `sync:batch`, "counts … so
  the chunk ends" is false. One more search goes out, without the cookie, before the next
  fetch is refused.
- **Fix (AD-30, AD-7, §13):**
  - The downgrade is its own client yield reason, `session-expired`, that ends the chunk
    explicitly, whatever the policy. The runner takes the `yielded` path: it publishes like a
    yielded chunk, clears `notBefore`, writes no record and exits 0.
  - Add a row to AD-7's wait-by-outcome: after `session-expired` the session waits
    `backoff(1)` from §5.3.
  - The reset **is not a State reading** and does not reset `n`.
  - The reset mutates the process `PacingState` **in place**: the ledger becomes
    `EMPTY_LEDGER` and `lanePolicies.clear()` runs. The session and the governor hold the
    same reference (`sync.ts:544`, `client.ts:385`), so a builder who replaces the object
    would leave the session's `preWaitMs` reading the old ledger.

### H3. "Reset to cold" sends the next request unpaced into buckets that are already overdrawn

- The capture (`capture-trade2-headers.md`, rows 1 and 3) shows **one Ip counter with two
  limit sets**. Authenticated limits are `60:300` and `600:10800`. Unauthenticated limits are
  `30:300` and `600:21600`.
- The session spreads at the authenticated rate. In the 5-minute window it can spend more
  than 30. Over a 3-hour run it can spend up to 600.
- After the downgrade, a cold ledger lets the next request go with no wait (§5.3: "a policy
  with no reading waits 0"). That request goes to an Ip rule that is already full, so a 429
  with a 1800 s or 3600 s penalty is near certain. GGG also counts that 4xx against the
  threshold that AD-8 exists to protect.
- **The reverse leak:** `recordObservation` merges **per rule name**, and a rule that a later
  response does not list is kept (`ledger.ts:75-82`). If a probe settles `unauthenticated`
  but its response listed `Account`, the `Account` rule stays in the ledger and paces
  unauthenticated requests. This is the exact case that AD-30's *Prevents* names. §13 says
  instead "the probe's State reading replaces the pacing values like any other reading".
- **Fix (§13, AD-8):**
  1. Snapshot the baseline's ledger entry, which is the unauthenticated limit shape, read at
     runtime, before the probe folds in.
  2. A probe that settles `unauthenticated` restores that snapshot and does not keep its own
     reading.
  3. On downgrade, reseed from the snapshot's limits, and do not go cold. Set each bucket's
     `used` to the number of requests that **this process sent** on that policy inside the
     bucket's period, from a send log kept in the governor. Nothing is compiled in, because
     the limits come from a response and the counts come from the governor's own sends.
  4. Change AD-8's "discards the pacing state" to "replaces the pacing state with the
     unauthenticated snapshot".

### H4. Two liveness tests, and the expiry signal is not verified

- AD-30's *Prevents* names "two builders deciding liveness differently, such as one by a
  rule name and one by a status code". AD-30 itself has two tests: a rule **count** at the
  probe, and a **status code** (401 or 403) after it.
- The 401/403 expiry signal is the research's recommendation 3 ("Treat a 401 or 403 as …").
  It is not a capture. No one has recorded the response to a signed-out cookie.
- **A (client):** gets 2xx responses with `Rules: Ip` after the operator signs out, because
  the server ignores a dead session. The client keeps the state `authenticated`, prints
  nothing and sends the cookie for the rest of the process. CAP-3 and the success signal
  fail without any error. The ledger also keeps the stale `Account` rule (see H3).
- **B (client):** applies the probe's predicate to each response and downgrades.
- **Fix (§13):** Define **one** liveness predicate:
  `live(r) ⇔ 2xx(r) ∧ |names(r)| > baselineCount`. Apply it to the probe and to each 2xx
  response to a request that carried the cookie. A 2xx that fails the predicate is a
  downgrade with reason `expired`. It does not end the chunk, because the request got an
  answer and its result stands. A 401 or 403 stays a downgrade that ends the chunk (H2). Add
  an OQ: "capture the response to a signed-out POESESSID", owned by `sync`.

### H5. The rule does not say which requests carry the cookie, and the league gate has two owners

- AD-30 says only the client attaches the cookie. It does not say **to which requests**.
  CAP-1 says "the pricing requests". The fetch policy is not covered by the probe.
- **A:** attaches the cookie to every request after `authenticated` settles. Under the
  session, the league gate runs again on each new pass (AD-7), after the settle, so it
  carries the cookie. Under batch it always runs before the settle, so it never carries the
  cookie. The same request then behaves differently under the two invokers.
- **The clash:** a 401 on that league request is a "gate `4xx`" by AD-7 and AD-12, so the
  run waits for `notBefore`, and under batch it aborts. By AD-30 it is a downgrade, with no
  `notBefore` and no change to the exit code.
- **B:** attaches the cookie to searches only. It then never sees a fetch 401, and the
  fetch keeps the unauthenticated burst. Under the cookie the fetch's `Account` burst
  `6:4` is half of `12:4`, so A and B also pace the fetch differently.
- **Fix (AD-30):** List the requests in the rule: "With the state `authenticated`, the
  cookie rides on pricing searches and pricing fetches. It never rides on the league
  request, the probe's baseline or any request sent before the state settles." The gate's
  4xx then has one owner (AD-12) under both invokers.

---

## Medium

### M1. A dead cookie under `sync:batch` sends a counted 4xx on every invocation

- The state is per process, and `sync:batch` is one process per chunk. With a dead cookie
  left in `.env`, each invocation sends a baseline and then a probe that gets 401. At a
  5-minute cadence that is 288 refused requests a day.
- AD-8's argument for `notBefore` is that GGG's Invalid Requests Threshold is **cross-process**,
  and AD-30 brings back the in-memory-only memory that AD-8 rejects.
- AD-12's table ("at most once per process") hides that under batch the probe costs one
  search on each chunk. That is also cadence-dependent, as pinned is (§6).
- **Fix:**
  - Persist `authRejectedUntil` in `sync-progress.json`, as an instant with no value, as a
    minor schema version. Write it after `probe-rejected` or a 401/403 `expired`, with a
    value of now + `staleLockAfter`.
  - A process with a cookie skips the probe before that instant and prints
    `unauthenticated (rejected-recently)`. A 2xx-predicate `expired` (H4) does not write it.
  - Change AD-12's row to "at most one per process, so one per invocation under
    `sync:batch`", and count the probe in the headroom argument as pinned is counted.

### M2. The settle has no defined trigger, accounting port or result shape

- **Trigger:** the client's lanes are opaque (`client.ts:95-105`), so the client cannot
  tell a "pricing search" from the league GET or a catalogue request without reading the
  lane.
  - **A:** uses `method === 'POST'`.
  - **B:** reads the lane label, which the client's own contract forbids.
- **Accounting:** each source is counted by its wrapped port
  (`compose-chunk.ts:108-112`). A probe sent from inside the `tracked-list` client goes
  through that port, so the probe is counted as `tracked-list`. That breaks AD-12's
  `session-probe` figure.
- **Result shape:** it is not defined which response's `remaining` and `policy` ride on
  the baseline's result, the baseline's or the probe's. The runner stops the chunk on that
  value.
- **Fix (§13):**
  - The pricing step marks its search request `baselineEligible: true`. This is the one
    flag that the client reads, and it is not a lane.
  - The governor takes a third port, `session-probe`, and sends the probe through it.
  - The returned result carries the baseline response's `remaining`, `policy` and
    `invalidRequests`. The next `send` paces with the probe's reading (as amended by H3).

### M3. A downgrade on the fetch contradicts AD-9 on the search fields

- AD-30 and §13 say the entry "stamps `lastAttemptedAt` alone". When the 401 arrives on
  the fetch that follows an answered search, AD-9 says the answered search sets
  `lastSearchId` and `lastSearchLeague` whatever the fetch returns.
- **A:** keeps the search id.
- **B:** obeys AD-30 and drops it.
- **Fix:** Change the sentence to: "The entry is treated as AD-9's request that got no
  answer: it stamps `lastAttemptedAt`, and an answered search keeps its two search fields."

### M4. "Any part of the value" cannot be tested as written

- A single character of any cookie is always present in the output, so a literal test of
  "no fragment" always fails. A test of the whole value misses a value cut short in an error
  message.
- **A:** one test suite is too strict to pass.
- **B:** another test suite is too weak to catch a cut value.
- **Fix (§13):**
  - Define a leak as "any substring of the value of length ≥ min(8, length), in raw, URL-
    encoded or base64 form".
  - The canary value is at least 32 characters from a fixed alphabet that does not appear
    in fixtures.
  - The scan covers stdout, stderr and every file that a test run writes.

### M5. The auth line count is not defined for runs that send nothing, or for the session's end

- "The absent-cookie warning prints on every run" and "exactly one line per settle" do not
  say what happens in these runs:
  - a `deferred` run (`notBefore`), a `busy` run or a dispossessed run, which sends
    nothing;
  - `sync:dry`, which does not read the cookie;
  - the session's `not-probed`, which settles only "when the process ended". After a
    SIGKILL it never prints, and a session that never settles prints no line for days.
- **A:** prints at shell start, before the lock.
- **B:** prints only after the `notBefore` check.
- Under C1 option A, each chunk prints its own line.
- **Fix:**
  - `SessionAuth` alone emits the line.
  - `absent` and `malformed` print at shell start, once for each process, in every run,
    before the lock.
  - `not-probed` prints at process end only for a run that passed the `notBefore` check.
  - `sync:dry` prints no auth line.
  - The session prints `pending` once at start when a cookie is set. This is not a settle,
    and it is not counted toward "exactly one".

### M6. A transient fault on the probe disables the cookie for a session that runs for days

- `probe-failed` (a throw or timeout) and a 5xx `probe-rejected` settle for the life of the
  process. A long-running `pnpm sync` process that hits one 503 on its first chunk runs
  unauthenticated until it is restarted.
- **A:** probes once, as written.
- **B:** reads "a request that got no answer backs off" (AD-7) as "probe again".
- **Fix:** Choose one. Either a 5xx, a throw or a timeout on the probe leaves the state
  unsettled and the next baseline probes again, at most once on each pass. Or state in
  AD-30 that "settled once" covers transient faults, and give the operator a restart as the
  recovery.

### M7. A 401 or 403 that does not come from the cookie is classified as expiry

- A malformed body or a Cloudflare challenge on a request that carries the cookie becomes a
  downgrade. The next request, without the cookie, then gets the same 4xx. That costs one
  extra counted 4xx before AD-9's abort, and under batch it costs a whole process.
- **Fix:** Classify a 403 that carries `cf-mitigated` or has an HTML body as AD-9's, not as
  expiry. Record in AD-30 that one extra 4xx is the accepted cost of the remaining
  ambiguity.

---

## Low

- **L1. The env value is inherited.** Node's `--env-file-if-exists` loads `.env` into
  `process.env` for `catalogue:refresh` and `fixtures:record` too (`package.json:21-25`).
  The git port's child processes also inherit it.
  - **Fix:** after the read, the `sync` shells delete `process.env.POESESSID`. Every spawn
    gets an explicit environment. AD-30's "never read it" becomes "never read it, and their
    factories cannot accept it" (already true), plus "no child process inherits it".
- **L2. The `session-probe` figure is public.** The probe count is in `sync-report.json`,
  which is deployed to Pages, so the public site shows that the operator uses a session
  cookie.
  - **Fix:** accept this and record it in AD-30, or fold the count into the `tracked-list`
    figure.
  - Either way, the new `requestsBySource` key is an additive change to `SyncRunReport`.
    AD-30 binds `contracts` and must say "a minor `schemaVersion` bump".
- **L3. `Set-Cookie` on responses.** Unauthenticated responses carry
  `set-cookie: POESESSID=…`, an anonymous session (capture, "Other observations"). A cookie
  response could rotate the authenticated id the same way.
  - **Fix:** the governor removes `set-cookie` from each `HttpResponse` before it returns
    the response. `fixtures:record` asserts that the header is absent, so a recorded or
    rotated session can never reach a fixture.
- **L4. Ordering against the gates.** It is implied but not stated that the probe can never
  precede AD-12's league gate or the `notBefore` check, because the baseline is a pricing
  search and the rotation follows the gate.
  - **Fix:** state in §13: "The probe is sent only inside the rotation, after every gate of
    AD-12."

---

## Order of closure

1. C1, because the location of the holder decides the fixes for M2, M5 and H2.
2. C2.
3. H1 to H5, which change §13's sequence and the AD-30 text.
4. M1, which needs a minor bump to `sync-progress.json` and so goes with H2's outcome row.
5. The rest are citation-level edits.

None of these fixes needs a PRD edit except M1's visible reason `rejected-recently` and
M5's `pending`, if they are added. Those are reason strings that the UI prints, which
`prd.md` owns. They print on the console, not in the UI, so confirm the owner before you
add them.
