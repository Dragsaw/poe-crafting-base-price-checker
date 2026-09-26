# Revision 21 — verification review

Reviewed: 2026-09-26. Scope: the uncommitted diff of revision 21 (`ARCHITECTURE-SPINE.md`, `IMPLEMENTATION-NOTES.md`, `AGENT-WORKFLOW.md`, `.memlog.md`, `docs/epics.md`). Method: each factual claim the new text rests on was checked against the live GGG developer documentation, the `sync` / `contracts` source, the committed `data/` files, and an executed probe against the installed Zod.

**Verdict: issues.** Two claims hold exactly as written: the chunk-path claim and the Retry-After units and cap arithmetic. The GGG claim overstates the documentation. The Zod consequence is real, and the memlog's proposed remedy for it is incomplete. The `notBefore` schema question is not addressed anywhere in the revision.

---

## 1. GGG Invalid Requests Threshold — partly holds, wording overstates

Source: https://www.pathofexile.com/developer/docs (fetched 2026-09-26).

- Section heading "Invalid Requests Threshold": *"Applications (and users) that make too many invalid requests in a short period of time will be restricted from further access to our service. Invalid requests include any response codes in the HTTP 4xx range. This includes common codes such as 401 (Unauthorized), 403 (Forbidden), and 429 (Too Many Requests). Reasonable attempts **must** be made in order to avoid passing the threshold."*
- The word "revoked" appears in the **Rate Limits** section, not in the threshold section: *"Exceeding these limits frequently will result in your application access being revoked."*

What holds: every 4xx counts, and 401, 403 and 429 are named. What does not hold: the threshold consequence is documented as "restricted from further access". Revocation is documented for *frequently* exceeding the rate limits. So "a threshold that revokes access" (SPINE AD-8, around line 601; IN §5.3, line 603) merges two separate sentences. The same wording is already in code (`packages/sync/src/trade/invalid-requests.ts:4-9`, `client.ts:77-79`).

Also, the docs do not say whether the count is per policy, per IP, per application, or over what window ("in a short period of time" only). Per-policy counting (IN §5.3 "counts `4xx` responses per policy") is a project choice. The text should not read as GGG's. GGG's count is plausibly per client or IP, so the per-policy constant under-protects in principle. This is harmless in practice because of §3 below.

**Fix (wording only):** "counts toward an Invalid Requests Threshold past which access is restricted; frequent limit breaches revoke access". State that per-policy counting is the project's own conservative approximation.

## 2. Retry-After units and the cap — holds

- GGG docs: `Retry-After` is *"Time to wait (in seconds) until the rate limit expires."* The third value of `X-Rate-Limit-{rule}` is the restriction duration in seconds. The third value of `-State` is the active restriction remaining, in seconds.
- `client.ts:60-61,212-231` parses delta-seconds only and multiplies by 1000. An HTTP-date or garbage value becomes absent. `0` becomes absent.
- The measured policies (IN §5.3 table): the largest search penalty is `600:21600:3600`, which is 3600 s. The largest fetch penalty is `1000:21600:1800`, which is 1800 s. Both are below `staleLockAfter` = 6 h = 21600 s (IN §7 line 707; `chunk/lock.ts:40` `STALE_LOCK_AFTER_MS = 6*60*60*1000`). The `min()` cap only bites on a malformed or hostile header, as the text says.
- Nuance (no action needed): the no-readable-rule floor `declaredYieldFloorMs` (`client.ts:262-270`) takes `max(penalty, bucket.seconds)`. A policy with all-zero penalties could therefore yield 21600 s, exactly the cap. `derivedYieldDelayMs` (`ledger.ts:179-208`) uses penalties only. The `min()` makes the floor harmless.
- Wording nit: IN §5.3 says the run checks `now < notBefore` "before any load". Reading `notBefore` *is* a load of `sync-progress.json`. The check must also come before the previous-report load (`run-chunk.ts:365-367`), so that a deferred run with a bad report still "writes nothing". Say "before any other load".

## 3. "One process sees at most one 4xx on the chunk path" — holds

- Client: a 429 returns `kind: 'yield'` (`client.ts:389-404`). Every other status is returned unchanged as `kind: 'response'` (`client.ts:406-418`). Every 4xx is counted (`client.ts:383-385`).
- Pricing step (`pricing/price-entry.ts:180-201`): a client yield, a 5xx or a transport failure becomes `yield`. Any other non-2xx becomes `malformed`. A search or fetch `malformed` throws `MalformedRequestError` (`:284-286`, `:317-319`). A `yield` returns `kind: 'yielded'` (`:281-283`, `:314-316`).
- Runner (`chunk/run-chunk.ts:547-550`): `yielded` breaks the loop. A throw goes to the catch, which publishes, reports and rethrows (`:594-624`).
- League gate (`league/league-gate.ts:130-151`): a yield, a 5xx or a transport failure becomes `YIELD`. The chunk ends at `run-chunk.ts:474-484`. Another non-2xx throws `LeagueRequestRejectedError`.
- `sync.ts:91-99`: one `createTradeClients` governor per process, shared by the gate and the step.

Every exit after the first 4xx therefore ends the process's trade traffic. The claim is correct.

**Threshold constant of 1 in the other commands: no breakage.** `catalogue-refresh.ts:193-206` and `fixtures-record.ts:292-298` both return a failure on the first yield or on any status other than 200. Neither sends another request after a 4xx. A threshold of 1 is as inert there as on the chunk path.

Dev follow-ups the revision implies but does not list (they belong in the story, not the spine):
- No shell passes `invalidRequestThreshold` today (`sync.ts:91`, `dry-run.ts:175`, `catalogue-refresh.ts:164`, `fixtures-record.ts:276`). IN §5.3 says "passed ... by every shell that builds one".
- The retry delay does not reach the runner. `sendLeg` discards `retryAfterMs` (`price-entry.ts:190-192`). `StepResult.yielded` (`run-chunk.ts:141`) and `GateResult` (`run-chunk.ts:156`) carry no delay. `notBefore` needs both widened.
- The threshold check keys on the lane's *learned* policy (`client.ts:339,344`). A cold lane checks under `(no policy named)`. The IN sentence "No process therefore sends a second request on a policy that has already refused it once" is only literally true for lanes that have already learned their policy. It is true in effect because of the abort-or-yield structure above.

## 4. Zod 4 enum-keyed `z.record` — claim holds, and the proposed remedy is incomplete

- Installed version: `zod` pinned at `4.6.5` (`packages/contracts/package.json:14`; `pnpm-lock.yaml:1653`; `node_modules/.pnpm/zod@4.6.5`).
- Executed probe against that install, with `z.record(z.enum(['tracked-list','league-validation']), z.int().min(0))`:
  - both keys: OK
  - a missing key: `invalid_type` at `["league-validation"]`. The record is **exhaustive**.
  - an extra `catalogue-refresh: 0`: `unrecognized_keys`. The record **rejects keys outside the enum**.
  - `z.partialRecord` accepts a missing key and still rejects the extra key.
- Schema today: `RequestSourceSchema` includes `'catalogue-refresh'` (`packages/contracts/src/sync-run-report.ts:22-32`). The committed `data/sync-report.json:5-9` carries `"catalogue-refresh": 0` under `schemaVersion` `"1.0.0"`.

Consequence: remove the enum member without touching the data, and `runChunk` refuses the previous report *before writing anything* (`run-chunk.ts:365-367`, the NFR-8 path). Every later `pnpm sync` then fails until someone edits the file by hand. `web` also fails to load the report.

The memlog (line 327) says "needs a schema-version bump or a tolerant reader". **A bump alone does not solve this.** Removing a required key breaks old readers, so the bump is a major. A new reader then refuses the committed `1.0.0` file as `unknown-major` (`envelopes.ts:153-165`), which is the same brick. The change needs one of these:
- (a) the same commit rewrites `data/sync-report.json` without the key, with a bump if old builds must refuse the new file; or
- (b) the reader accepts and drops the legacy key.

Also, this dev note exists only in `.memlog.md`. No binding document, story AC or `deferred-work.md` entry carries it, so the story that implements retro item 9 can miss it.

## 5. `notBefore` on `sync-progress.json` without a major bump — mostly holds, with one caveat the revision does not state

- Convention (`contracts/src/schema-version.ts:3-6,27`; SPINE Consistency Conventions "Schema versioning"): a consumer compares the **major only**, and "the minor may be newer". Current file: `data/sync-progress.json` `schemaVersion` `"1.0.0"`. Writer: `run-chunk.ts:433-439` writes `SUPPORTED_SCHEMA_VERSION`.
- New reader, old file: an optional `notBefore` makes a file without it valid. No bump is needed in this direction, and IN §5.3 "An absent `notBefore` never defers a run" matches.
- Old reader, new file: **`SyncProgressSchema` is `z.strictObject`** (`contracts/src/sync-progress.ts:29`). The probe confirms that `strictObject` rejects an unknown key. A build from before the change refuses a progress file that carries `notBefore` as `invalid`, whatever minor it declares. So the "minor may be newer" promise does not hold for this file as specified. The practical impact is low, because only `sync` reads the file and the same build writes it. This matters only across a rollback or mixed checkout.
- The revision takes no position on the version. Record the change as additive minor `1.1.0`, and accept (or note) that strict parsing makes minors one-way. The pattern has a precedent in WEIGHTS-FILE-SCHEMA.md line 49 ("Additive, and minor rather than major on purpose").

---

## Summary of actions

| # | Severity | Action |
|---|---|---|
| 1 | Low | Fix "threshold that revokes access" (SPINE AD-8; IN §5.3) to match GGG's wording. Mark per-policy counting as the project's own choice. |
| 4 | Medium | Replace the memlog's "bump or tolerant reader" with a data rewrite in the same commit, or a legacy-key-tolerant reader. Put the note where the implementing story will see it. |
| 5 | Low | State the `sync-progress.json` version decision (additive minor), with the strict-object caveat. |
| 3 | Info | Story-level follow-ups: pass the threshold in every shell; carry `retryAfterMs` through `StepResult`/`GateResult`. |
| 2 | Info | "before any load" becomes "before any other load (the report included)". |
