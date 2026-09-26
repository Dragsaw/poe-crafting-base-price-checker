# Adversarial review — spine revision 21 (uncommitted)

- **Scope:** `git diff` of `ARCHITECTURE-SPINE.md`, `IMPLEMENTATION-NOTES.md` (IN), `AGENT-WORKFLOW.md` (AW) and `docs/epics.md`, read against the unchanged text of the same files and against the built code under `packages/` for context.
- **Method:** For each finding, two units one level down (two `sync` builders, `sync` vs `sync:dry`, `sync` vs `web`) each obey every cited sentence literally and still build incompatibly, or the text lets a conforming build produce the failure the rule exists to prevent.
- **Verdict: not closed.** Two high findings and six medium findings. Rulings 1, 2, 4, 6 and 7 are sound in intent. Ruling 3 (`notBefore`) meets existing AD-7 text it does not reconcile with, and it does not cover the 4xx case its own rationale names. Ruling 5 (dry-run clock) meets ruling 3.

Line numbers are from the working tree.

---

## High

### H-1 — A non-429 4xx has no memory across processes. The Invalid Requests Threshold rationale is unmet.

- **Where:** Spine AD-8 :597–606. Spine AD-9 :677–683. IN §5.3 :603–621.
- **Text:** AD-8's new rationale says: "GGG counts every `4xx` toward an Invalid Requests Threshold that revokes access … an in-memory backoff protects nothing: the next invocation would spend a request inside the same penalty." The only persistence it adds is `notBefore`, and a `notBefore` is written only by "a yield that carries a retry delay" (IN :611). AD-9 makes a non-429 4xx an **abort**, not a yield, and it carries no retry delay. The threshold constant `1` is in-process only: "No process therefore sends a second request…"
- **Consequence:** A malformed-request defect (OQ-12's `valueless` shape is the live candidate) aborts chunk N. AD-9 stamps the failing entry, so the next entry in the order leads chunk N+1. AD-9 states that "the same defect will fail every entry". So each cron tick sends exactly one invalid request, which is 288 a day at a 5-minute cadence. That is the revocation path the paragraph cites as its reason. Retro L-A7 names the same hole for 429s. Rev21 closes it for 429s only.
- **Two builders:** Builder A reads "every 4xx" in AD-8 as the scope of the cross-process rule. That builder persists a `notBefore` on the AD-9 abort, which gives the abort a `sync-progress.json` write. Builder B reads IN §5.3 literally and writes nothing. AD-12 :883–885 says an aborting run leaves `sync-progress.json` untouched. The code's `MalformedRequestError` path already writes progress. A and B produce different files and different request streams.
- **Fix:** In IN §5.3, add: "An AD-9 malformed-request abort writes `notBefore = now + staleLockAfter` to `sync-progress.json`, the one progress write an abort makes." Alternatively, add a latch that only the player's edit clears. Then state in AD-12 :883 that AD-9's abort is not a gate abort, so the "`sync-progress.json` untouched" rule does not apply to it.

### H-2 — A deferred run that broke a stale lock must both write and not write the `stale-lock-broken` record.

- **Where:** Spine AD-7 :505–507 against :512–513. IN §5.3 :618–620 against IN §7 :714. Epics :584–586.
- **Text:** IN §5.3 says: "A run evaluates `now < notBefore` immediately after it takes the lock … the run releases the lock, sends nothing, **writes nothing** and exits 0." AD-7 and IN §7 say: "A run that breaks a stale lock takes it, proceeds, and **records `stale-lock-broken`**." Taking the lock includes breaking a stale one (`acquireLock` returns `broken`).
- **The window is real:** Run X takes the lock at t0, gets a 429 at t1 with a large delay (the malformed-header case the cap exists for), and commits `notBefore = t1 + min(d, 6h)`. X then crashes or hangs before release. The lock goes stale at t0 + 6h. `notBefore` can reach t1 + 6h, which is later than t0 + 6h. Any run in that window breaks the lock and is also deferred.
- **Two builders:** Builder A writes the report alone with the record, which breaks "writes nothing". Builder B writes nothing and releases the lock. The next run then finds no lock, so the crash is never recorded. That is the failure AD-7 :514–518 calls "the worst one available".
- **Fix:** Add to IN §5.3 :620: "A deferred run that broke a stale lock writes `sync-report.json` alone, carrying the `stale-lock-broken` record. It writes nothing else." Also state the order explicitly: acquire or break the lock first, check `notBefore` second.

---

## Medium

### M-1 — The default `sync:dry` clock always lands inside a penalty. The AW promise then fails in one of two ways.

- **Where:** AW :35. IN §5.3 :615–620. `dry-run.ts` header (the snapshot list omits `sync-progress.json`).
- **The problem:** The default clock is "the latest `lastAttemptedAt` in the dataset snapshot", which "predicts the live run that immediately follows the last live run". After a yield with a retry delay, `notBefore = yieldTime + delay`, which is later than every `lastAttemptedAt`. The live run that follows is therefore a deferred no-op.
- **Two builders:** Builder A snapshots `sync-progress.json`, as a faithful prediction needs. With the default clock, that dry run prints a deferred no-op after every 429 chunk, which breaks epics :610–612 ("emits … a dataset and a run report"). Builder B does not snapshot progress, which is today's code. That dry run predicts a chunk that will not run, and without the live `completed` set, so the "predicts" sentence is false.
- **Fix:** Add to AW: "`sync:dry` ignores `notBefore` and prints it beside the outcome. It reads the snapshot's `completed` set." Or make the default clock `max(latest lastAttemptedAt, notBefore)`.

### M-2 — "The delay the client derived from the headers" is not bounded to a yield.

- **Where:** IN §5.3 :611–612. AD-7 :498–500 (three bounds). The `ChunkOutcome` kinds `completed`, `bounded` and `yielded`.
- **The problem:** A chunk that stops because the search or fetch allowance fell below 1 (`bounded`) has a delay the client can derive from `-State`: the time until the tightest bucket clears. The `-State` penalty field also reports an active penalty on a 200.
- **Two builders:** Builder A treats every allowance-bounded chunk as a yield with a derived delay and writes `notBefore`. Later invocations defer, which changes the cadence and the bytes of `sync-progress.json`. Builder B writes `notBefore` only after a 429 and clears it on every bounded chunk ("a chunk that finishes with no retry delay clears the field"). Both obey the text.
- **Fix:** In IN §5.3, replace "or the delay the client derived from the headers" with "or an active penalty in a `-State` header. A chunk that stopped at an allowance bound writes no `notBefore`."

### M-3 — A penalty, and the `notBefore` behind it, is invisible to `web`.

- **Where:** Spine AD-7 :505–507. IN §5.3 :611–621. Spine Logging row :1726.
- **The problem:** `notBefore` lives only in `sync-progress.json`, which `web` does not read. A deferred run writes nothing, so for up to `staleLockAfter` (6 h) the report on the site is the yielding chunk's report. That report has `runFinishedAt`, no record, and nothing that names the deferral. A misparsed `Retry-After`, the case the cap exists for, gives 6 h of silence behind a green surface. AD-7 :514–518 forbids exactly that shape for the lock.
- **Two builders:** A `web` builder cannot tell a deferral from a stalled cron. A `sync` builder has no report field to put the deferral in.
- **Fix:** In AD-8, add: "The yield that writes `notBefore` also writes it to `sync-report.json` as a figure (`deferredUntil`)." Add the figure to the Logging row list.

### M-4 — AD-9's "the unit is the request" meets the 4xx wording in AD-9 itself and in the epics.

- **Where:** Spine :672–675 against :680. Epics :752 (new) against :756 (unchanged).
- **The problem:** The new rule sets `lastSearchId` and `lastSearchLeague` "whatever the fetch that follows it returns", and that includes a non-429 4xx on the fetch. The unchanged 4xx sentence says `sync` "stamps `lastAttemptedAt`, **leaves the entry's state as it was**". The epics carve the exception only into the no-answer criterion (:752), not into the 4xx criterion (:756).
- **Two builders:** Builder A reads "state" as price state and records the answered search id. Builder B follows the epics 4xx criterion, which has no exception, and leaves the entry untouched. The two produce different `dataset.json` bytes on the same fixture.
- **Fix:** Change spine :680 and epics :756 to "leaves the entry's **price state** as it was (an answered search still sets `lastSearchId`, AD-9)".

### M-5 — `requestsBySource` has three stale anchors, and the contract makes the key mandatory.

- **Where:** Epics :825–828. Spine :875. `RequestsBySourceSchema` in `contracts/src/sync-run-report.ts`.
- **The problem:** The epics criterion reads "**When the report enumerates them**, Then exactly three generate a request … **And** the catalogue refresh is not a report figure". The criterion both makes the report enumerate three sources and says it enumerates two. Spine :875 still says "Three run-start gates stand in front of **those three sources**", but only two sources are on the chunk path. In the contract, `z.record(z.enum([...3]))` is exhaustive in Zod 4, so every valid report must carry `catalogue-refresh`.
- **Two builders:** A `sync` builder that follows AD-12 :868–874 drops the key and fails the existing schema. A builder that keeps the schema writes `catalogue-refresh: 0`. A `web` builder that follows EXPERIENCE :508 ("requests per source") then prints a zero row that AD-12 says does not exist.
- **Fix:** Change the epics :826 "When" to "When AD-12 declares them". Change spine :875 to "in front of the two sources a chunk spends". Add a note in AD-12 that the report's source enum is `tracked-list | league-validation` (retro item 9).

### M-6 — A league mismatch now follows the catalogue check. The fate of that check's records is unruled.

- **Where:** Spine :889–898. Epics :904–917.
- **The problem:** The catalogue check now runs before the league gate, so on a mismatch it has already produced `unresolvable` and `weights-absent` or `uncatalogued-weights-id` records. The mismatch "aborts and writes the report alone" and leaves `dataset.json` untouched, so the marks are discarded. The text does not say whether the records are discarded too. Retro R-7 raised this, and the ruling does not answer it.
- **Two builders:** Builder A includes the check records. Under §12 the records then survive until the player's edit, so the site states that entry X is `unresolvable` while `dataset.json` never marks it. That builder also computes `notReachedCount` from the order, as the yield rule does. Builder B writes the `league-mismatch` record alone with `notReachedCount = 0`. `web` renders different "what is broken" groups for the same run.
- **Fix:** Add to spine :898: "A mismatch report carries the `league-mismatch` record alone. The catalogue check's records are discarded with its marks, and `notReachedCount` is the eligible count."

---

## Low

### L-1 — "Exactly this sequence" omits step 0, and "before any load" contradicts it.

- **Where:** Spine :889–893 against IN :618–619.
- **The problem:** The spine sequence starts at "the file loads and their load-time validation". IN puts the `notBefore` check "before any load or gate", but reading `notBefore` is itself a load of `sync-progress.json`. The code also reads the previous report first (NFR-8). The text does not say how an invalid or unknown-major `sync-progress.json` is handled at this step.
- **Two builders:** Builder A parses the file strictly and aborts with a report. Builder B reads `notBefore` leniently and continues.
- **Fix:** Put step 0 in the spine list: "the `notBefore` check (IN §5.3), which reads `sync-progress.json` through its schema. A refusal there is a load failure like any other."

### L-2 — The schema change to `sync-progress.json` is not stated.

- **Where:** `SyncProgressSchema` is a `strictObject` with `completed` only.
- **The problem:** Under the "minor may be newer" rule, a build that knows only `completed` refuses a file that carries `notBefore`. No text states the version bump.
- **Fix:** Add to IN §5.3: "`notBefore` is an optional ISO-8601 field of `sync-progress.json`, a minor bump." Also relax the body parse for unknown optional fields, or call it a major bump.

### L-3 — §12 identity collapses distinct `unrecoverable-error` failures, and `web`'s unresolvable count has two readings.

- **Where:** IN :1099. EXPERIENCE :508.
- **Collapse:** Two unrelated throws that name no entry and no status (for example ENOENT, then a Zod refusal) are `same`, so the first diagnosis is overwritten.
- **Two readings of the count:** `unresolvable` records are per miss, not per entry, and persist after recovery. A `web` builder that counts records and a builder that counts dataset entries with price state `unresolvable` show different numbers.
- **Fix:** For `reason = unrecoverable-error`, make `message` a subject field. State in AD-9 or EXPERIENCE that the count is the number of distinct entries in the dataset with price state `unresolvable`.

### L-4 — IN §10.2's jewel-arm miss does not define "attempted".

- **Where:** IN :969–972. AD-25 :1609–1614. AD-7 row 3 :538–539 and the not-reached definition :571–574.
- **The problem:** The miss is offline, so no stamp is written (AD-9 :661). A jewel entry that is marked `unresolvable` is therefore due in row 3 on every chunk: its 24 h retry is measured from a `lastAttemptedAt` that is absent or old. The text does not say whether such a visit counts as attempted for `notReachedCount` or whether it enters `completed`.
- **Two builders:** Builders that answer these two questions differently publish different figures and different progress.
- **Fix:** Add to IN §10.2: "The visit counts as attempted, it enters `completed`, and row 3's 24 h bound for a jewel-arm miss is measured from `runStartedAt` of the chunk that marked it." Or state that the entry is excluded from row 3 until the catalogue changes.

### L-5 — Rulings 3 and 5 have no vehicle.

- **The problem:** `notBefore` and the dry-run clock have no epics criterion. Retro items 8 and 14 cover the threshold constant and the dry-run instant, but no action item persists `notBefore`. The gate order and the league-yield rule were appended to stories that are already `done`, and they rely on retro items 1–2.
- **Fix:** Add a retro action item, or a criterion in Story 1.3 or 1.7 (the governed client or the lock), for "persist and honour `notBefore`" and for H-1's abort latch.

---

## Checked and clear

- **Record identity versus the old wording:** The Logging row now says a repeat replaces fields in place, and no other text says "not already present / deep equal". Only the code comment in `sync-report.ts` does, which is expected pre-change.
- **League-gate "no answer" versus the old abort wording:** The epics §1.11 mismatch criterion is scoped to "a league the endpoint does not carry", and the new criterion covers the no-answer case. PRD FR-14 ("a failure that invalidates the run aborts it") still reads correctly, because a no-answer does not invalidate the premise. No PRD edit is needed by AGENTS.md's five triggers.
- **AD-7 "writes nothing unless it still holds the lock" versus the deferred release:** These are compatible. The deferred run writes nothing, and it releases only a lock it holds (the ownership condition applies).
- **`notBefore` cleared by a later 5xx-yield or gate yield:** This is harmless. Any run that reached the gate already started after `notBefore`.
