---
title: 'Technical research: POESESSID versus OAuth versus both for higher PoE trade API rate limits'
type: 'technical'
shape: 'select'
topic: 'POESESSID vs OAuth vs both for higher PoE trade API rate limits in sync'
decision: 'Which auth route (A POESESSID, B official OAuth, C both, D none) sync supports for the trade API, and whether an interactive credential flow is feasible'
source: 'Process of imports/Path Of Exile API Auth.md (Gemini Deep Research, inferred from export format, produced 2026-10-02, from brief.md), plus a native spot-check of the load-bearing claims on 2026-10-02 (digests/verify-ggg.md, digests/verify-community.md), plus a first-hand trade2 header capture with and without POESESSID on 2026-10-02 (digests/capture-trade2-headers.md, Deepen pass)'
status: complete
preset: 'standard'
validation: 'normal'
claims_tally: 'per ref: verified 9 (V1 V2 V3 V4 V6 V7 V8 V9 V10), overturned 1 (V5); V3 moved from disputed to verified by the capture'
created: '2026-10-02'
updated: '2026-10-02'
---

# Technical research: POESESSID versus OAuth versus both for higher PoE trade API rate limits

**Decision this research serves:** which auth route sync supports for the trade API (A POESESSID, B official OAuth, C both, D none), and whether an interactive credential flow is feasible.

## Executive summary

**Do this: keep D (unauthenticated) as the default. Eliminate B and C. Hold A as a gated, opt-in experiment.** The gate opens only when both conditions are true: a header capture shows that a session cookie raises the PoE2 trade budget, and the unauthenticated budget no longer finishes a sync. **The first condition is now met.** The 2026-10-02 capture shows that a session cookie doubles the sustained PoE2 search and fetch budget, and does not raise the short burst [30]. A now waits only on the second condition.

The imported report also picks D, but its reasons are wrong in three places. The verification pass corrected them:

1. **Official OAuth cannot do the job.** No OAuth scope or documented endpoint covers trade search or fetch, in PoE1 or PoE2 [2][3]. Grinding Gear Games (GGG) also says "We are currently unable to process new applications" [1]. B fails both hard gates: it cannot reach trade, and it is closed to new projects. C gives nothing more than A.
2. **D is not "absolute compliance".** The trade API is outside GGG's documentation, so A and D carry the same base policy risk. A adds credential-sharing and account-access risk [1][4][5]. See *Policy and terms*.
3. **The import did not measure the effect of a session cookie. The Deepen capture did, for PoE2 [30].** With POESESSID, the trade2 response adds an `Account` rule, and the `Ip` limits double over the 5-minute and longest windows. The longest window goes from 6 h to 3 h for the same hit count. One client therefore gets about 2× the sustained throughput: 200 searches per hour instead of 100, and about 333 fetches per hour instead of about 167. The short burst does not improve, and the fetch burst halves (6 per 4 s instead of 12 per 4 s). The 2018 GGG statement [6] holds in direction. The 2019 community figure [8] does not match.

**Biggest caveat:** the capture is one sample, from one IP and one account, with a browser `User-Agent` [30]. GGG says the limits "are dynamic and can change at any time" [1]. The unauthenticated values are the same as in the project's 2026-09-12 capture [30]: two captures 20 days apart gave the same values. Re-check the GGG OAuth and Terms of Use (ToS) facts and the trade2 limits by 2026-11-02. After 2027-04-02, refresh the whole report before anyone acts on it.

## Findings by dimension

### Integration and interoperability: the auth routes

- **OAuth scopes.** The scopes are six `account:*` (profile, leagues, stashes, characters, league_accounts, item_filter) and six `service:*` (leagues, leagues:ladder, pvp_matches, pvp_matches:ladder, psapi, cxapi) [2]. None covers trade. **Status: verified. Confidence: high.**
- **OAuth and PoE2.** Only a few endpoints accept the `poe2` realm: item filters, leagues, characters, and the Currency Exchange API [3]. The docs say "There are currently limited APIs that return PoE2 game information" [3]. The public stash API is PoE1 only [3]. **Status: verified. Confidence: high.**
- **OAuth clients.** Public clients use authorization code with Proof Key for Code Exchange (PKCE) and a loopback redirect such as `http://127.0.0.1:8080/callback`. Their access tokens last 10 hours, and their refresh tokens last 7 days [2]. Confidential clients need an HTTPS redirect on a registered domain, with no localhost. Their access tokens last 28 days, and their refresh tokens last 90 days [2]. **Status: verified. Confidence: high.** `client_credentials` gives only `service:*` scopes [2]. Confidence for this sentence is medium, because the verifier did not find the exact sentence.
- **OAuth registration.** The docs say "We are currently unable to process new applications" [1]. The import describes an approval process. The verification overturned this claim: registration is closed now. The `oauth@` email address appears only on a third-party wiki. It is not on the official page.
- **The Currency Exchange API** is documented, needs no auth, and accepts `poe2` [3]. It gives hourly aggregate currency history, not item bases, so it does not replace trade search. **Status: verified. Confidence: high.**
- **POESESSID.** It is the pathofexile.com website session cookie. GGG staff wrote in 2022: "This cookie value gives the recipient almost complete access to your Path of Exile account on the website", and "The secure way of granting tools access to your data is via OAuth" [5]. Signing out and signing in again invalidates earlier cookie values [5]. **Status: verified. Confidence: high.** No source says whether a password change revokes the cookie.
- **User-Agent.** The docs give the format `OAuth {clientId}/{version} (contact: {contact})` for OAuth apps [1]. **Status: verified. Confidence: high.**

### Policy and terms

- **Undocumented endpoints.** GGG's docs say that it "is against our Terms of Use (section 7i) to reverse-engineer endpoints outside of this documentation" [1]. The trade API is not in that documentation [2][3]. **Status: verified. Confidence: high.**
- **Bots and data extraction.** Without prior written approval, the ToS bars "any automated software or 'bots'" (7c) and "any data gathering and extraction tools" (7f) [4]. The ToS was last updated in October 2024. **Status: verified. Confidence: high.**
- **Credential sharing.** ToS §16 forbids giving a third party access to the account without GGG's written consent [4]. In 2022, GGG said that they "haven't yet proactively banned any users" for sharing POESESSID [5]. **Status: verified. Confidence: high.**
- **The import's claim that D gives "absolute compliance"** is overturned by the three points above.

### Implementation reality: rate limits and enforcement

- **Header contract.** GGG documents `X-Rate-Limit-Policy`, `X-Rate-Limit-Rules` (rules such as `ip`, `account`, `client`), `X-Rate-Limit-{rule}`, `X-Rate-Limit-{rule}-State`, and `Retry-After`. The rule format is `hits:period:restriction` [1]. "Exceeding these limits frequently will result in your application access being revoked" [1]. **Status: verified. Confidence: high.**
- **Effect of a session cookie on the budget (PoE2, measured).** The project captured one search and one fetch on `/api/trade2`, without a cookie and then with `Cookie: POESESSID=…`, on 2026-10-02 [30]. All four requests returned 200. Rule format `hits:period:restriction`:

  | Policy | Rules, no cookie | Rules, POESESSID | `Account` | `Ip`, no cookie | `Ip`, POESESSID |
  |---|---|---|---|---|---|
  | `trade-search-request-limit` | `Ip` | `Account,Ip` | `3:5:60` | `5:10:60, 15:60:300, 30:300:1800, 600:21600:3600` | `8:10:60, 15:60:120, 60:300:1800, 600:10800:3600` |
  | `trade-fetch-request-limit` | `Ip` | `Account,Ip` | `6:4:10` | `12:4:10, 16:12:300, 50:300:300, 1000:21600:1800` | `12:4:60, 16:12:60, 100:300:300, 1000:10800:1800` |

  The session does three things [30]. First, it raises the `Ip` limits over the 5-minute window (2×) and the longest window (the same hits in 3 h instead of 6 h, so 2×). Second, it adds an `Account` rule that has only one short window. That rule caps the burst at about the unauthenticated level for search (3 per 5 s), and at half of it for fetch (6 per 4 s against 12 per 4 s). Third, it changes three `Ip` lockouts and leaves five unchanged. Two get shorter: the search 60 s window (300 s to 120 s) and the fetch 12 s window (300 s to 60 s). One gets longer: the fetch 4 s window (10 s to 60 s). The `Ip` counter is shared: the cookie requests counted the earlier no-cookie requests from the same IP [30].
  
  Older evidence, now superseded for PoE2: the 2018 GGG statement that the Ip rule "will allow double" [6] holds in direction, but its "same limits" for the account does not match the measured `Account` rule. The 2019 figure of 4 fetches per 6 s [8] does not match the measured 6 per 4 s. A 2025 README says accounts get a larger budget [9]. That agrees, but it gives no numbers. **Status: verified (one sample). Confidence: medium**, because the limits are dynamic [1] and the capture used a browser `User-Agent`, not the contact `User-Agent` that sync sends [30].
- **Newest unauthenticated numbers.** The 2026-10-02 capture [30] gives the same Ip values as the project's own 2026-09-12 PoE2 capture (in `brief.md`): search `5:10:60, 15:60:300, 30:300:1800, 600:21600:3600`, fetch `12:4:10, 16:12:300, 50:300:300, 1000:21600:1800`. A player posted older PoE1 Ip state values in 2021 [7]. They are history, not the current PoE2 budget. **Status: verified (two captures, 20 days apart). Confidence: medium.**
- **Header names have been wrong.** In 2022 GGG staff confirmed a bug: the policy header said "Account", but the limiting was per IP [10]. Pace from the `-State` values, not from the rule name alone. In the 2026-10-02 capture the rule names agreed with the header contents: `Account` appeared only with the cookie [30]. No request reached a limit, so the capture did not test enforcement. **Status: single source. Confidence: medium.**
- **Shared budget.** GGG staff in 2026: "rate-limiting will consider any third-party tools … and in-game search, and trade website utilisation. It all hits the same API" [11]. Tool, in-game, and site traffic therefore share one budget. That thread is about PoE1. With a session cookie, trade2 applies both an `Account` and an `Ip` rule [30]. Every machine that uses the same cookie therefore probably shares the `Account` burst cap (the import says this as well [28]). Each IP keeps its own `Ip` counter. **Status: single source. Confidence: medium.**
- **Enforcement record.** GGG blocked one version of Acquisition (v0.9.7) in 2023 for rate-limit violations. The fix was "dynamic rate limiting based on HTTP reply headers" [12]. Acquisition uses the stash APIs, not trade. It moved to OAuth in v0.15.0 and kept POESESSID only for forum shops [13]. The import says that GGG blocked every user of the tool because of poor Retry-After handling. The verification overturned that claim. In 2025 GGG refused access to a PoE2 tool user because of an IP "matching previously banned accounts" [14]. Short rate-limit lockouts are common. **Status: verified with corrections. Confidence: medium.**
- **Cloudflare.** Cloudflare bot checks on pathofexile.com repeatedly break tools: in 2020 [23] and in 2024 on PoE2 trade [24]. In 2026 a player's browser also failed a Turnstile check on the trade site [25]. No source records a fix. Awakened PoE Trade (APT) blames Cloudflare for "failed to load leagues". Its workaround is to solve a CAPTCHA about every 15 minutes or to change the IP address [19]. One tool lists `cf_clearance` as optional next to POESESSID [22]. No source says it is always required. The import's citation for this claim (PoB #8384) does not mention Cloudflare. In the 2026-10-02 capture, four plain Node `fetch` requests with a browser `User-Agent`, two of them with a pasted POESESSID, got no challenge [30]. That sample lasted about 15 seconds. It does not show how Cloudflare treats a scheduled sync over a day. **Status: verified (blocks happen). Confidence: medium.**

### Interactive-flow feasibility

| Method | How it works | Precedent | Risk | Verdict |
|---|---|---|---|---|
| Paste the cookie by hand | The user copies POESESSID from DevTools into an environment variable or a secret | Path of Building asks for a session ID [the PoB #8384 workaround text, via verifier] | Full-account token in shell history and CI secrets [5]; stops working when the user signs out [5]; Cloudflare challenges hit tools repeatedly [19][20], though a short plain-HTTP sample passed [30] | **Feasible.** The only route that fits an unattended CLI |
| Read the cookie from the browser profile | Decrypt Chrome or Edge cookies on disk | Common before Chrome 127 | App-Bound Encryption (ABE, Chrome and Edge 127+) stops same-user programs [15][16][17]. A bypass needs SYSTEM privileges or code injected into the browser [16][26] | **Not feasible.** It needs malware techniques |
| Own login window (Electron, WebView, headed Playwright) | The tool hosts a browser, the user signs in, the tool keeps its own cookie jar | APT and Exiled Exchange 2 (EE2) route trade calls through an Electron session cookie jar and keep Cloudflare cookies [20][21] | Chrome 136+ ignores remote debugging on the default profile [18], so the tool needs its own profile. Cloudflare can challenge an automated browser | **Feasible for a desktop app.** Too much work for a CLI. The cookie must still reach CI by hand |
| OAuth PKCE with a loopback redirect | Standard public-client flow [2] | GGG's sanctioned route [5] | No risk of its own, but it gives no trade scope and registration is closed [1][2] | **Not applicable** to trade |

### Decision matrix (re-scored from the verified evidence)

The matrix scores the options against the findings above.

Hard gates: **G1** the option can reach trade search and fetch; **G2** the route is available to a new project today. B fails G1 [2][3] and G2 [1]. C inherits B's failure and adds nothing over A.

Scores run from 1 to 5, and 5 is best. D is the baseline (3) for rate-limit gain. You can change the weights.

| Criterion | Weight | A POESESSID | B OAuth | C Both | D None |
|---|---|---|---|---|---|
| Measured rate-limit gain | 3 | 4 (2× sustained, no burst gain [30]) | – | 4 | 3 |
| Ban or policy risk (5 = safest) | 3 | 2 (§7i + §16 [1][4]) | – | 2 | 3 (§7i [1]) |
| Credential-leak impact (5 = none) | 2 | 1 [5] | – | 1 | 5 |
| Build effort (5 = least) | 1 | 3 | – | 1 | 5 |
| Unattended or CI fit | 3 | 2 (sign-out, Cloudflare [5][19]) | – | 2 | 5 |
| Interactive-flow fit | 1 | 3 (manual paste) | – | 2 | 5 (none needed) |
| **Weighted total** | | **32** | **fails G1, G2** | **29** | **53** |

The import's matrix had arithmetic and logic errors; see [27]. The Deepen capture [30] moved A's rate-limit score from 3 to 4. A gets 4 and not 5 because the gain is in sustained throughput only. Even a 5 would give A 35, so the ranking does not change. The measured gain matters only when the unauthenticated budget does not finish a sync.

## Cross-dimension insights

- **Policy risk does not separate A from D. Credential risk does.** Both call an undocumented endpoint (§7i [1]). A adds an account-level credential [5][4]. In return it gives a measured 2× sustained budget, but no burst gain [30]. A trades a full-account credential for throughput. That trade pays only when the throughput is the bottleneck.
- **The gain is in duration, not speed.** With a cookie, a sync of N searches does not run faster in its first minute: the 60 s search window stays at 15, and the `Account` rule caps the burst [30]. It runs faster over the 5-minute window (60 against 30) and doubles the hourly ceiling. A sync that already finishes inside the unauthenticated windows gains little. Earlier text here said the cookie helps only a multi-account setup. That came from the 2018 PoE1 statement [6], and the PoE2 capture overturns it for one client [30].
- **The cookie flow and Cloudflare can make each other worse.** The only workable credential route for a CLI is a manual paste. Cloudflare challenges repeatedly hit tools [19][23][24], and the tools that work reliably embed a browser [20][21]. A short plain-HTTP sample with a pasted cookie passed [30]. Whether a scheduled sync passes over a day is still open.

## Recommendations

1. **Architecture spine: record D as the trade-API auth decision, and record the reason.** OAuth has no trade scope and is closed to new applications [1][2]. A session cookie doubles the sustained budget [30], but it costs a full-account credential [5] and gives no burst gain [30]. *Confidence: high for eliminating B and C. Medium for D over A, because the A-versus-D choice depends on whether the unauthenticated budget finishes a sync, and this research does not measure that.*
2. **Architecture spine: keep the auth seam behind the HTTP client.** The rate-limit pacer must read `X-Rate-Limit-Rules` and pace every listed rule's `-State`, not only `Ip` [1][29]. The capture confirms that this matters: with a cookie, trade2 sends `Account,Ip`, and the `Account` rule is the tighter burst limit for fetch [30]. A pacer that reads only `Ip` would overrun it. The 2022 header-name bug also shows why the pacer should trust the state values [10]. *Confidence: high.*
3. **Roadmap risk: make A a spike, gated on the sync budget.** The capture met the first gate condition: the PoE2 budget is higher with a cookie [30]. Build A only when the tracked list also outgrows the unauthenticated budget. If it is built, keep it opt-in: environment variable only, never committed, never logged, and documented as a full-account token that signing out revokes [5]. Treat a 401 or 403 as "the cookie expired, fall back to D". *Confidence: medium, because it rests on whether the unauthenticated budget finishes a sync, which nobody has measured yet.*
4. **Brief or PRD (feasibility): drop any "log in with your PoE account" or browser-capture flow for the CLI.** Profile reading is blocked [15][17]. An embedded login is desktop-app scope [20]. *Confidence: high.*
5. **Architecture spine: use a descriptive User-Agent that includes contact details.** The project has no OAuth client id, so the documented format [1] is good practice, not a requirement. *Confidence: medium.*

## Open questions

- ~~**Does a session cookie raise the PoE2 trade2 budget?**~~ **Answered on 2026-10-02 [30]:** yes, 2× sustained and no burst gain. See *Implementation reality*.
- **Do the cookie limits hold with the contact `User-Agent` that sync sends?** The capture used a browser `User-Agent` [30]. *Cheap experiment:* repeat the four-request capture with `POE_SYNC_USER_AGENT` set to the contact string.
- **Do the `Account` numbers depend on the account?** One account was measured [30]. A second account, for example a newer one or one without supporter packs, would show whether the numbers are global.
- **Do pasted-cookie requests from a plain Node HTTP client trip Cloudflare over a 24-hour sync window?** A 15-second sample passed [30]. Run the capture on a schedule for a day.
- **Does a password change revoke POESESSID?** No source says.
- ~~**Is the 2019 "session fetch 4/6s" claim real** [8]?~~ **Answered by the capture [30]:** no, not for PoE2 on 2026-10-02. The session fetch `Account` rule is 6 per 4 s.

## Source appendix

| # | Supports | Publisher | Published | Accessed | Confidence |
|---|---|---|---|---|---|
| [1] | Rate-limit headers, dynamic limits, §7i statement, registration closed, User-Agent format | [GGG — Developer Docs overview](https://www.pathofexile.com/developer/docs) | not shown | 2026-10-02 | high |
| [2] | OAuth scopes, client types, token lifetimes, PKCE | [GGG — Developer Docs: Authorization](https://www.pathofexile.com/developer/docs/authorization) | not shown | 2026-10-02 | high |
| [3] | Endpoints, poe2 realm support, Currency Exchange API | [GGG — Developer Docs: Reference](https://www.pathofexile.com/developer/docs/reference) | not shown | 2026-10-02 | high |
| [4] | ToS §7(c), 7(f), 7(i), §16 | [GGG — Terms of Use](https://www.pathofexile.com/legal/terms-of-use-and-privacy-policy) | 2024-10 | 2026-10-02 | high |
| [5] | What POESESSID grants, invalidation, no proactive bans, OAuth is the secure route | [GGG Community_Team — Do not share POESESSID values](https://www.pathofexile.com/forum/view-thread/3328601) | 2022-12-14 | 2026-10-02 | high |
| [6] | Session moves the limit to an Account rule with the same limits, and Ip doubles (PoE1 search) | [GGG Novynn — PoE Trade API Questions](https://www.pathofexile.com/forum/view-thread/2079853) | 2018-01-29 | 2026-10-02 | low (stale) |
| [7] | Unauthenticated Ip state values (PoE1) | [Verdale, GGG forum — API rate limit for trade searches](https://www.pathofexile.com/forum/view-thread/3056323) | 2021-02-24 | 2026-10-02 | low (stale) |
| [8] | Session fetch 4/6s vs Ip 12/6s (PoE1); via import, not fetched | [KoomZog / rChinnn, Reddit — Trade API request limit](https://www.reddit.com/r/pathofexiledev/comments/e6h6o2/trade_api_request_limit/) | 2019-12 | via import 2026-10-02 | low (unverified) |
| [9] | Accounts get a larger allowance; via import | [yaredmax — poe-ninja-build-cost](https://github.com/yaredmax/poe-ninja-build-cost) | 2025-05 | via import 2026-10-02 | low (unverified) |
| [10] | Header said Account while limiting was per IP (bug) | [GGG Novynn — forum thread 3257587](https://www.pathofexile.com/forum/view-thread/3257587) | 2022-03-20 | 2026-10-02 | medium |
| [11] | Tools, in-game search, and trade site share one budget | [GGG Sameer_GGG — Rate-limiting is active for your account](https://www.pathofexile.com/forum/view-thread/3996346) | 2026-08-12 | 2026-10-02 | medium |
| [12] | GGG blocked Acquisition v0.9.7 for rate-limit violations | [gerwaric — Acquisition release v0.9.9](https://github.com/gerwaric/acquisition/releases/tag/v0.9.9) | 2023-10-27 | 2026-10-02 | medium |
| [13] | Acquisition moved to OAuth, kept POESESSID for forum shops | [gerwaric — Acquisition releases](https://github.com/gerwaric/acquisition/releases?page=3) | 2024-12-22 | 2026-10-02 | medium |
| [14] | IP refused as "matching previously banned accounts" (PoE2 tool) | [Exiled Exchange 2 — issue #646](https://github.com/Kvan7/Exiled-Exchange-2/issues/646) | 2025-09-08 | 2026-10-02 | medium |
| [15] | App-Bound Encryption from Chrome 127 | [Google Online Security Blog — Improving the security of Chrome cookies on Windows](https://security.googleblog.com/2024/07/improving-security-of-chrome-cookies-on.html?m=1) | 2024-07-30 | 2026-10-02 | high |
| [16] | ABE bypass needs SYSTEM or injection | [BleepingComputer — Chrome adds App-Bound Encryption](https://www.bleepingcomputer.com/news/security/google-chrome-adds-app-bound-encryption-to-block-infostealer-malware/) | 2024-07-30 | 2026-10-02 | high |
| [17] | ABE state in 2026, Edge included, same-user tools fail | [ElcomSoft — Browser forensics in 2026](https://blog.elcomsoft.com/2026/01/browser-forensics-in-2026-app-bound-encryption-and-live-triage/) | 2026-01-13 | 2026-10-02 | high |
| [18] | Chrome 136 ignores remote debugging on the default profile (search result only) | [Chrome for Developers — Changes to remote debugging switches](https://developer.chrome.com/blog/remote-debugging-port) | 2025-03-17 | 2026-10-02 | medium |
| [19] | Cloudflare flags tools; CAPTCHA every ~15 min workaround | [SnosMe — APT: Failed to load leagues](https://snosme.github.io/awakened-poe-trade/failed-load-leagues.html) | not shown | 2026-10-02 | medium |
| [20] | APT routes requests through an Electron session cookie jar | [SnosMe — APT main/src/proxy.ts](https://raw.githubusercontent.com/SnosMe/awakened-poe-trade/master/main/src/proxy.ts) | master | 2026-10-02 | medium |
| [21] | EE2 (PoE2) uses the same proxy design | [Kvan7 — EE2 main/src/proxy.ts](https://raw.githubusercontent.com/Kvan7/Exiled-Exchange-2/master/main/src/proxy.ts) | master | 2026-10-02 | medium |
| [22] | cf_clearance listed as optional next to POESESSID | [POEFixer — FixerWiki: Trade Cookies](https://github.com/POEFixer/FixerWiki/wiki/Trade-Cookies) | 2026-09-29 | 2026-10-02 | medium |
| [23] | Cloudflare on the /login page broke a tool (2020) | [Procurement — issue #1113](https://github.com/Procurement-PoE/Procurement/issues/1113) | 2020-06-13 | 2026-10-02 | low (stale) |
| [24] | Cloudflare broke PoE2 trade integration | [GGG forum — [Trade] Cloudflare broken integration](https://www.pathofexile.com/forum/view-thread/3647344) | 2024-12-18 | 2026-10-02 | medium |
| [25] | Cloudflare Turnstile failure on the trade site in 2026 | [GGG forum — Unable to access trade site, cloudflare issue](https://www.pathofexile.com/forum/view-thread/3987579) | 2026-07-24 | 2026-10-02 | medium |
| [26] | Only in-browser injection still reads ABE cookies (Chrome 144) | [xaitax — Chrome-App-Bound-Encryption-Decryption](https://github.com/xaitax/Chrome-App-Bound-Encryption-Decryption) | 2026 | 2026-10-02 | medium |
| [27] | The imported report (verdict, matrix, flags) | [Gemini Deep Research — imports/Path Of Exile API Auth.md](imports/Path%20Of%20Exile%20API%20Auth.md) | 2026-10-02 | 2026-10-02 | low |
| [28] | A shared session draws on one Account bucket; via import, not fetched | [gerwaric, Reddit — Understanding the X-Rate-Limit response headers](https://www.reddit.com/r/pathofexiledev/comments/1c3bff2/understanding_the_xratelimit_response_headers/) | 2024-04 | via import 2026-10-02 | low (unverified) |
| [29] | APT paces from every rule that `x-rate-limit-rules` names | [SnosMe — APT trade/common.ts](https://raw.githubusercontent.com/SnosMe/awakened-poe-trade/master/renderer/src/web/price-check/trade/common.ts) | master | 2026-10-02 | medium |
| [30] | PoE2 trade2 rate-limit headers with and without POESESSID; unauthenticated values same as the 2026-09-12 capture; no Cloudflare challenge on 4 plain-HTTP requests | [Project first-hand capture — digests/capture-trade2-headers.md](digests/capture-trade2-headers.md) (cf-ray `a446998b2d1b271b`, `a4469999aaf9271b`, `a44699cd8db3ff2d`, `a44699dbe872ff2d`) | 2026-10-02 | 2026-10-02 | medium (one sample) |

Every claim in the import that this summary does not use is listed, with its flags, in `digests/import-gemini.md` [27].

## Staleness map

Computed by `recon_kit.py staleness`. Re-check windows: 1 month for OAuth, policy, and rate-limit numbers. 6 months for auth effect, ban history, cookie mechanics, and interactive flow. Dates marked † are access dates, because those pages show no date. The ToS row uses the access date because the docs statement [1] has no date. The ToS page itself was last updated 2024-10 [4].

| Claim | Class | Published | Re-check by | Stale now |
|---|---|---|---|---|
| OAuth has no trade scope [2] | oauth-scopes | 2026-10-02 † | 2026-11-02 | no |
| OAuth registration closed [1] | oauth-flow | 2026-10-02 † | 2026-11-02 | no |
| ToS §7 and §16, docs §7i statement [1][4] | policy-tos | 2026-10-02 † | 2026-11-02 | no |
| Session adds an Account burst rule and doubles sustained Ip limits (PoE2) [30] | auth-effect-on-limits | 2026-10-02 | 2027-04-02 | no |
| Unauthenticated trade2 Ip numbers [30] | rate-limit-number | 2026-10-02 | 2026-11-02 | no |
| Session gives an Account rule with the same limits [6] (superseded for PoE2 by [30]) | auth-effect-on-limits | 2018-01-29 | 2018-07-29 | **yes** |
| Session fetch 4/6s vs Ip 12/6s [8] (superseded for PoE2 by [30]) | rate-limit-number | 2019-12 | 2020-01-01 | **yes** |
| Unauthenticated Ip numbers [7] (superseded for PoE2 by [30]) | rate-limit-number | 2021-02-24 | 2021-03-24 | **yes** |
| One budget for tools and the trade site [11] | auth-effect-on-limits | 2026-08-12 | 2027-02-12 | no |
| POESESSID gives near-full access [5] | cookie-mechanics | 2022-12-14 | 2023-06-14 | **yes** |
| Acquisition v0.9.7 blocked [12] | ban-history | 2023-10-27 | 2024-04-27 | **yes** |
| IP refused, "matching previously banned accounts" [14] | ban-history | 2025-09-08 | 2026-03-08 | **yes** |
| App-Bound Encryption blocks same-user reads [17] | interactive-flow | 2026-01-13 | 2026-07-13 | **yes** |
| Cloudflare blocks on tools recur [23][24] | cookie-mechanics | 2024-12-18 | 2025-06-18 | **yes** |
| APT and EE2 Electron cookie-jar design [20][21] | interactive-flow | 2026-10-02 † | 2027-04-02 | no |

Eight of the fifteen rows are stale. For PoE2, the 2026-10-02 capture [30] supersedes the three stale rate-limit rows, so the conclusions no longer rest on them. Repeat the capture by 2026-11-02 to keep the rate-limit numbers fresh. The re-check dates for the fresh GGG rows and for the whole report are in the *Biggest caveat* of the summary.
