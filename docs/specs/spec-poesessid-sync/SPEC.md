---
id: SPEC-poesessid-sync
companions:
  - ../../architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md
  - ../../architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md
sources:
  - ../../research/technical-poesessid-vs-oauth-for-trade-api-rate-li-2026-10-02/research.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Optional POESESSID in sync

AD-30 in `ARCHITECTURE-SPINE.md` and §13 in `IMPLEMENTATION-NOTES.md` define the mechanism. Read only those sections of the two companions.

## Why

This spec captures an opportunity. A capture on 2026-10-02 showed that a POESESSID session cookie doubles the sustained trade2 budget for PoE2 search and fetch. The cookie also adds a burst rule for each account. The burst does not become faster. Today sync sends no credential. The operator wants the cookie as an opt-in, so that a long refresh finishes in fewer hours. The cookie gives near-full access to the account, and signing out ends it. Sync must therefore work with no cookie, and with a cookie that no longer works. The only cost of an inactive cookie is a warning.

## Capabilities

- **CAP-1**
  - **intent:** The operator puts POESESSID in `.env`. If the cookie passes the liveness probe, `pnpm sync` and `pnpm sync:batch` send their pricing searches and fetches with it.
  - **success:** A test with a fake HTTP port and a live cookie shows this order of requests:
    1. The first pricing search, with no cookie. This search is the baseline.
    2. The probe, which repeats the baseline with the cookie.
    3. The fetch of that entry and all later pricing requests. Each of these requests carries the `Cookie` header.

    The league request never carries the cookie.
- **CAP-2**
  - **intent:** Sync detects that the cookie is absent or inactive. It prints one warning line that names the reason, and it finishes the run unauthenticated.
  - **success:** Each case below prints exactly one warning line with its §13.5 reason. After the warning, no pricing request carries the cookie.
    - An absent or malformed value: sync prints the warning before the first request and sends no probe.
    - A probe 2xx response that fails the liveness test: sync prints the warning after the probe.
    - A probe 4xx that is not 429: sync prints the warning after the probe. The pricing searches continue.
    - A probe 5xx, a probe that throws, or a probe that times out: sync prints the warning after the probe.

    In each case, the exit code is the same as for a run with no cookie.
- **CAP-3**
  - **intent:** When the cookie stops working during a session, sync drops it, prints one warning and continues unauthenticated.
  - **success:** In a test, a cookie request after the probe receives a 401, a 403, or a 2xx that fails the liveness test. Then:
    - Sync prints one `expired` warning.
    - No later request of the process carries the cookie.
    - The pacing state is cold.
    - On a 2xx that fails the liveness test, sync discards that response. The entry is treated as a request that got no answer: it stamps `lastAttemptedAt`, keeps its price state and keeps the search fields it had before. This spec does not keep that answer.
    - The chunk ends as a yield with no `notBefore` and no invalid-request count.
    - `sync:batch` exits 0, and the session continues to its next chunk.
- **CAP-4**
  - **intent:** The console output of the run tells the operator whether the session cookie was in use. The operator can then tell an authenticated run from an unauthenticated run without seeing the value.
  - **success:** Each settle and each downgrade prints exactly one line: `authenticated`, or `unauthenticated (<reason>)`. A canary test forces each throw path with a known canary value of at least 32 characters. The test fails on any substring of 8 or more characters of that value, in raw, URL-encoded or base64 form, in stdout, stderr or any file that the test writes.
- **CAP-5**
  - **intent:** After a cookie fails, later runs send no probe until a retry is due. An inactive cookie therefore does not cost a request on every scheduled run.
  - **success:** After a `not-elevated`, `probe-rejected` or `expired` outcome, the next run within the hold-off prints `unauthenticated (held-off)` and sends no probe. A `live` probe clears the hold-off. A run that neither writes nor clears the hold-off keeps it unchanged. Such runs include a run with no cookie, a held-off run, a `probe-failed` run and a run that ends on a probe 429. `sync-progress.json` holds the due time and never the value.

## Constraints

- The cookie value never appears in these places: stdout, stderr, error messages and their causes, the Sync Report, `data/sync-progress.json`, the dataset, fixtures and git.
- Sync reads the cookie only from the environment. `.env` sets the environment through `--env-file-if-exists`.
- Only the shells of `pnpm sync` and `pnpm sync:batch` read the cookie, at the shell edge. The shell gives the value as a parameter, the same way it gives `POE_SYNC_USER_AGENT`.
- `catalogue:refresh`, `fixtures:record` and `sync:dry` cannot accept the cookie. The committed fixtures therefore never record the headers of a session.
- The operator documentation for `.env` says four things about POESESSID:
  1. It is optional.
  2. It gives near-full access to the account.
  3. The operator must never commit it.
  4. Signing out revokes it.
- AD-8 holds. The one governed trade client attaches the cookie. Pacing reads every rule that `X-Rate-Limit-Rules` names. The code contains no rule name, policy name, rule count or bucket (`test/no-hardcoded-rate-limits.test.ts`).
- The cookie goes on pricing searches and fetches only. It never goes on the league request.
- The liveness test compares the rule count of a cookie response with the rule count of the no-cookie baseline, under the same rate-limit policy only (`IMPLEMENTATION-NOTES.md` §13.2). The probe costs one extra search per run.
- A probe 429 settles nothing and stays an ordinary 429. Sync persists the `notBefore` of that 429, also when no further request follows in that chunk. A probe 4xx that is not 429 is not an invalid request, and it does not cause a malformed-request abort.
- An absent or inactive cookie never fails the run and never changes its exit code. `POE_SYNC_USER_AGENT` stays the only required environment value.
- The absent-cookie warning prints on every run. It has no off switch.
- After sync drops the cookie, the shared pacing state resets to cold. It learns the limits again from the next response. It never applies authenticated readings to unauthenticated requests.
- Every 401 or 403 on a cookie request means an inactive cookie. This includes a 403 from Cloudflare, and no exception exists. On the probe, the outcome is `probe-rejected`. After the probe, the outcome is `expired`. Both outcomes write the hold-off. The operator accepts the cost: a Cloudflare block can hold off a live cookie for 24 hours.
- The Sync Report has no auth field. Its one cookie trace is the `session-probe` request count.
- `sync-report.json` is published. Its `session-probe` count and the `authHoldOffUntil` field in `sync-progress.json` are therefore public traces, and the operator accepts them.
- The console reasons are the identifiers in `IMPLEMENTATION-NOTES.md` §13.5.
- The operator observed that the trade API accepts only a browser User-Agent. OQ-26 verifies this observation. For cookie runs, the operator puts a browser User-Agent string in `POE_SYNC_USER_AGENT`. No code changes. This departs from the contact rule of NFR-9. AD-30 and PRD rev 24 record the departure.

## Non-goals

- OAuth. It has no trade scope, and GGG accepts no new registrations for it.
- An interactive login, reading the cookie from a browser profile, or an embedded browser.
- Authentication in `web`. AD-15 does not change.
- A faster burst. The gain is in sustained throughput only.
- Automatic refresh or rotation of the cookie.
- Storing the cookie anywhere other than the operator's `.env`.
- Solving Cloudflare challenges.
- A field in the Sync Report that records authentication. Console output is enough.
- Showing on the site whether sync used a cookie. `web` shows no auth figure, and the trust strip does not show the `session-probe` count.
## Success signal

1. The operator adds a live POESESSID to `.env`, sets a browser User-Agent and runs `pnpm sync`. The run reports `authenticated`.
2. The operator signs out of pathofexile.com and runs `pnpm sync` again. The run prints one warning and reports `unauthenticated`. It completes as it did before this change.
3. The operator runs `pnpm sync` a third time, within the hold-off. The run prints `unauthenticated (held-off)` and sends no probe.

## Assumptions

- Sync runs only on the operator's machine, not in CI. CI therefore needs no secret.
- An inactive cookie receives a 401 or 403, or a 2xx with fewer rules. Both cause a downgrade. By 2026-11-02, OQ-26 finds out which response happens.
