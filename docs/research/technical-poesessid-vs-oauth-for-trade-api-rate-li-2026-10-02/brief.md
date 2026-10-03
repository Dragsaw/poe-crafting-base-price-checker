# Deep-research prompt: authenticating a Path of Exile trade-API client to get higher rate limits

Paste everything below the line into a deep-research tool (ChatGPT Deep Research, Gemini Deep Research, Perplexity, or similar). Today is 2026-10-02. Bring the finished report back and ask to "process it".

---

## Role and decision

You are a technical researcher. I must choose how my open-source, unattended price-sync tool authenticates to Path of Exile's trade API to get **higher rate limits**. The options are:

- **A. POESESSID cookie** (the session cookie of a pathofexile.com login).
- **B. Official OAuth 2.0** (GGG developer API, https://www.pathofexile.com/developer/docs/authorization).
- **C. Both**, or a hybrid.
- **D. Stay unauthenticated** (the baseline).

I also want to know whether a **user-friendly interactive flow** (a browser-based login or a capture of the cookie) is feasible and acceptable.

## My situation (use only to focus the search; it is not evidence)

- Tool: a Node/TypeScript CLI that runs unattended, in chunks, on a developer machine or CI. It prices items through the trade API and commits the results to git. It has no backend and no user accounts.
- Game: **Path of Exile 2** (`/api/trade2/...` endpoints). Also check whether PoE1 (`/api/trade/...`) differs.
- I read the `X-Rate-Limit-*` headers at runtime and pace myself from them. I send a descriptive `User-Agent`.
- Measured by me on 2026-09-12 while **unauthenticated**, rule `Ip`:
  - search policy `trade-search-request-limit`: `5:10:60, 15:60:300, 30:300:1800, 600:21600:3600` (hits:seconds:penalty)
  - fetch policy `trade-fetch-request-limit`: `12:4:10, 16:12:300, 50:300:300, 1000:21600:1800`
- Hypothesis to test, not to assume: "A session moves the client to a more generous rule." Confirm or refute it with evidence.
- Hypothesis to test: the OAuth documentation covers only the account and character API, not the trade API.

## Research questions (priority order)

1. **Does authentication raise the trade API limits at all?** For PoE2 and PoE1 trade endpoints (search, fetch, and the exchange endpoint if relevant):
   - What rule names appear when authenticated (for example `Account` versus `Ip`)?
   - What are the actual numbers, per policy, with and without a POESESSID? Give measured header values from people who have captured them. Say who measured, when, and for which game.
   - Does the limit apply per account, per IP, or both? What happens when several machines share one account?
2. **How POESESSID works.**
   - What it is, how it is issued, how long it lives, what ends it (logout, password change, IP change, 2FA, inactivity).
   - What it grants. Is it full account access? What is the worst case if it leaks?
   - How Path of Building, Awakened PoE Trade, Exiled Exchange 2, and similar community tools use it. Start from https://www.reddit.com/r/pathofexile/comments/zmkm9t/how_pob_uses_your_poesessid/ and then find newer sources.
   - How a client sends it (header `Cookie: POESESSID=...`) and any other cookies or headers it needs (for example `cf_clearance` and Cloudflare handling).
3. **GGG's policy.** What do the Terms of Use, the Developer Docs and the API usage rules say about:
   - using the session cookie in third-party tools;
   - the trade API for third-party tools, and whether it is "officially supported";
   - automated or unattended polling, and account-ban or IP-ban history for it;
   - required `User-Agent` format and contact details.
   Quote the exact wording and give the document date. Find statements by GGG staff on the forums, Reddit, or Discord archives.
4. **Official OAuth.**
   - Which scopes exist, and does any scope or endpoint cover trade search or fetch?
   - Client types (public versus confidential), grant types (authorization code with PKCE, client credentials, device flow), token lifetimes, and refresh behavior.
   - How an application gets approved and registered, how long that takes, and what GGG requires.
   - Rate limits that apply to OAuth tokens, and whether they differ from session limits.
   - Whether a headless or CI tool can use it, or only an interactive desktop app with a redirect URI.
5. **Interactive flow feasibility.** For a CLI tool, assess each way to get a credential from a user:
   - paste the cookie by hand from browser dev tools;
   - read the cookie from the local browser profile (and the risks, such as encryption in Chromium on Windows and how tools do it);
   - open a browser window or embedded webview and let the user log in, then capture the cookie (Electron or Playwright style);
   - OAuth authorization code with PKCE, with a loopback redirect on `127.0.0.1`, or a device-style flow;
   - which of these have precedent in community tools and which GGG has banned or warned about.
6. **Operational reality.** Credential storage (OS keychain versus env var versus file), rotation and expiry handling, behavior on a 401 or 403, what a ban looks like, and what to put in CI secrets safely. What do maintainers of long-running tools report 6–12 months in?
7. **Cost and lock-in.** Effort to build, ongoing burden, ban risk, and how to design an abstraction seam so the tool can switch between A, B, C, and D.

## Evidence rules (non-negotiable)

- **Every claim needs a source URL and a publication date.** Add an access date for pages that change.
- Prefer: pathofexile.com developer docs and Terms of Use, GGG staff posts, official forum threads, GitHub source and issues of PoB, Awakened PoE Trade, Exiled Exchange 2, and `poe-api` clients, and Reddit threads with production numbers. Do not rely on SEO blog summaries.
- **Two independent sources** for: any numeric rate limit; any claim that auth does or does not raise limits; any claim about bans; any claim about the OAuth scope list.
- **Freshness:** GGG policy, OAuth docs and rate limits must come from the last 1 month, or be flagged as stale. API behavior claims need a source from the last 6 months. Community pain points older than 2 years must be checked against whether they were fixed since, and flagged if not re-confirmed.
- Distinguish **PoE1** evidence from **PoE2** evidence in every claim. Do not transfer one to the other without saying so.
- Report **contrary evidence** and disagreement between sources as findings.
- If you cannot find evidence, write **"no evidence found"**. Do not pad, guess, or fill the gap from memory.

## Required output structure

1. **Verdict** (at most 10 lines): the recommended option among A, B, C, D, the named runner-up, the conditions under which the runner-up wins, and the strongest argument against your pick.
2. **Decision matrix:** options A–D against these criteria — measured rate-limit gain, ban or policy risk, credential-leak impact, build effort, unattended-run fit, interactive-flow fit. Show the score for each cell and the weights, so I can re-weight.
3. **Findings per research question** (1–7). Each finding is one sentence plus a source tag like `[S3]`.
4. **Interactive flow table:** each method, how it works, precedent, risk, verdict.
5. **Open questions and gaps:** what you could not verify, and a cheap experiment I can run myself (for example, "send one search with and without the cookie and compare `X-Rate-Limit-Policy` and `X-Rate-Limit-*` headers").
6. **Source list:** `[S#] publisher — title — URL — publication date — access date`.
