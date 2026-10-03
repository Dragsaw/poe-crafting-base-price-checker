---
id: SPEC-poesessid-sync
companions: []
sources:
  - ../../research/technical-poesessid-vs-oauth-for-trade-api-rate-li-2026-10-02/research.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Optional POESESSID in sync

## Why

An opportunity to capture. A capture on 2026-10-02 showed that a POESESSID session cookie doubles the sustained trade2 budget for PoE2 search and fetch. The cookie also adds a burst rule for each account, and the burst does not get faster. Sync is unauthenticated today. The operator wants the cookie as an opt-in, so that a long refresh finishes in fewer hours. The cookie gives near-full access to the account, and signing out ends it. So sync must work with no cookie, and with a cookie that has stopped working, at no cost beyond a warning.

## Capabilities

- **CAP-1**
  - **intent:** The operator puts POESESSID in `.env`. If the cookie passes a liveness probe, `pnpm sync` and `pnpm sync:batch` send their trade requests with it.
  - **success:** A test with a fake HTTP port and a live cookie shows this order: the baseline probe search with no cookie, the probe search with the cookie, then the pricing requests, which all carry the `Cookie` header.
- **CAP-2**
  - **intent:** Before the first pricing request, sync detects that the cookie is absent or inactive. It prints one warning line that names the reason and finishes the run unauthenticated.
  - **success:** Each of these cases gives exactly one warning line: an absent cookie, a probe whose cookie response lists no more rules than the baseline, a non-2xx probe, and a probe timeout. In each case no pricing request carries a cookie. The exit code is the same as for a run with no cookie.
- **CAP-3**
  - **intent:** When the cookie stops working during a session, sync drops it, prints one warning and continues unauthenticated.
  - **success:** In a test, a request sent with the cookie gets 401 or 403. Sync prints one warning, no later request of the session carries the cookie, and the session continues to its next chunk.
- **CAP-4**
  - **intent:** The console output of the run says whether the session cookie was in use, so the operator can tell an authenticated run from an unauthenticated one without seeing the value.
  - **success:** The console prints `authenticated` or `unauthenticated`, with a reason for `unauthenticated`. A scan of all output and all written artifacts finds no fragment of the cookie value.

## Constraints

- The cookie value never appears in stdout, stderr, error messages, the Sync Report, `data/sync-progress.json`, the dataset, fixtures or git.
- Sync reads the cookie only from the environment, which `.env` populates through `--env-file-if-exists`. The read happens at the shell edge. The value goes to the client factory as a parameter, the same way `POE_SYNC_USER_AGENT` does.
- The operator documentation for `.env` says four things about POESESSID: it is optional, it gives near-full access to the account, it must never be committed, and signing out revokes it.
- AD-8 holds. The one governed trade client sends the probe and attaches the cookie. Pacing reads every rule that `X-Rate-Limit-Rules` names. No rule name, policy name or bucket is compiled in (`test/no-hardcoded-rate-limits.test.ts`).
- The probe is a trade search with no parameters, sent twice: once without the cookie as a baseline, and once with it. The cookie is live only if the response with the cookie lists more rules than the baseline. Each run spends two search hits on the probe.
- A non-2xx probe response means inactive. A 4xx on the probe must not stop the pricing searches that follow, even though the invalid-request threshold is 1.
- A missing or dead cookie never fails the run and never changes its exit code. `POE_SYNC_USER_AGENT` stays the only required environment value.
- The absent-cookie warning prints on every run. It has no off switch.
- After sync drops the cookie, the shared session pacing must not apply authenticated budget readings to unauthenticated requests. It learns the limits again from the next response.
- Only `pnpm sync` and `pnpm sync:batch` use the cookie. `catalogue:refresh` and `fixtures:record` stay unauthenticated, so the committed fixtures never record the headers of a session.
- The trade API accepts only a browser User-Agent. For cookie runs, the operator puts a browser User-Agent string in `POE_SYNC_USER_AGENT`, and no code changes. This departs from the contact rule of NFR-9.
- This change reverses planned scope. The PRD says "Background sync: unauthenticated" and defers "Authenticated sync". The spine lists "Authenticated sync" as a deferred alternative. Under the AGENTS.md owner rules, the build needs a new spine AD first. It also needs a PRD scope edit that records the NFR-9 departure.

## Non-goals

- OAuth, which has no trade scope and is closed to new registrations.
- An interactive login, reading the cookie from a browser profile, or an embedded browser.
- Authentication in `web`. AD-15 does not change.
- A faster burst. The gain is in sustained throughput only.
- Automatic refresh or rotation of the cookie, storing it anywhere other than the operator's `.env`, and solving Cloudflare challenges.
- A field in the Sync Report that records authentication. Console output is enough.

## Success signal

- The operator adds a live POESESSID to `.env`, sets a browser User-Agent and runs `pnpm sync`. The run reports `authenticated`. The operator then signs out of pathofexile.com and runs it again. That run prints one warning, reports `unauthenticated` and completes as it did before this change.

## Assumptions

- A 401 or 403 on a request that carries the cookie means the cookie expired during the run. That 4xx still ends the current chunk under the existing invalid-request threshold. The chunks after it run unauthenticated.
- Sync runs only on the operator's machine, not in CI, so no CI secret is needed.
