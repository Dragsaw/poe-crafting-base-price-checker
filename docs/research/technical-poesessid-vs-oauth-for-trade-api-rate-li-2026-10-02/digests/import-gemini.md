# Digest: import "Path Of Exile API Auth.md" (Gemini Deep Research, 2026-10-02)

Extractor scope: this digest uses only the one imported file. No other file and no web source was read. Citation numbers `[n]` are the report's own "Works cited" numbers.

## 1. Verdict

- **Pick:** Option D (stay unauthenticated). The report says a "zero-credential footprint ensures absolute compliance with the Terms of Use" and avoids "the severe operational friction of bypassing modern browser security protocols".
- **Runner-up:** Option A (POESESSID cookie).
- **When A wins:** only "where the baseline unauthenticated Ip rate limits mathematically preclude the tool from completing its pricing chunks within a required time window", and only on "a dedicated, user-attended machine where manual credential injection is viable".
- **Strongest argument against A:** "the profound security risk of exposing an all-access bearer token in plaintext environments", together with "the systemic inability to automate the retrieval of this cookie due to Chrome's App-Bound Encryption and Cloudflare Turnstile behavioral biometrics".

### Decision matrix as the report gives it (scale 1–5, 5 = best)

| Criterion | Weight | A: POESESSID | B: Official OAuth | C: Hybrid | D: Unauthenticated |
|---|---|---|---|---|---|
| Measured rate-limit gain | 3 | 4 | 1 | 4 | 2 |
| Ban or policy risk (1 = high risk, 5 = safe) | 3 | 2 | 5 | 2 | 4 |
| Credential-leak impact (1 = severe, 5 = none) | 2 | 1 | 4 | 1 | 5 |
| Build and maintenance effort | 2 | 2 | 1 | 1 | 5 |
| Unattended-run / CI fit | 3 | 1 | 3 | 1 | 5 |
| Interactive-flow fit | 1 | 2 | 4 | 2 | 5 |
| **Weighted total (as reported)** | – | **29** | **41** | **27** | **60** |

The extractor recomputed the totals: A = 29, B = 41, C = 27, **D = 58, not 60**. See flag F1.

## 2. Claims

Columns: game is "unspecified" when the report does not name a game. Publisher, pub_date and accessed come from the report's Source List entry for that citation number. The accessed date is "October 2, 2026" for every source.

### RQ1: Does authentication raise the trade API limits?

| id | claim | game | source | publisher | pub_date | accessed | class | confidence | load_bearing |
|---|---|---|---|---|---|---|---|---|---|
| C1 | Authentication adds an Account rate-limit rule that runs in parallel with the Ip rule across the trade infrastructure. | unspecified | https://www.reddit.com/r/pathofexiledev/comments/e6h6o2/trade_api_request_limit/ [1] | KoomZog / rChinnn (Reddit r/pathofexiledev) | December 2019 | October 2, 2026 | auth-effect-on-limits | low | Y |
| C2 | Evidence from seven years ago ("stale") on the PoE1 trade fetch endpoints shows that unauthenticated IP limits were more generous: 12 requests per 6 seconds per IP, against 4 requests per 6 seconds per POESESSID. | PoE1 | https://www.reddit.com/r/pathofexiledev/comments/e6h6o2/trade_api_request_limit/ [1] | KoomZog / rChinnn (Reddit) | December 2019 | October 2, 2026 | rate-limit-number | low | Y |
| C3 | A "secondary independent source from the same era" recorded headers for the PoE1 trade-search-request-limit, with the Ip rule at 12:6:60 and the Ip-State at "1:6:0" (the text reads "1:6:01", which is probably "1:6:0" followed by cite marker 1). | PoE1 | https://www.reddit.com/r/pathofexiledev/comments/e6h6o2/trade_api_request_limit/ [1] | rChinnn (Reddit) | December 2019 | October 2, 2026 | rate-limit-number | low | Y |
| C4 | Recent ("fresh") community repository documentation says that authentication gives faster polling because accounts get a larger overall allowance than bare IP addresses. This contradicts C2. | unspecified | https://github.com/yaredmax/poe-ninja-build-cost [3] | yaredmax (GitHub) | May 2025 | October 2, 2026 | auth-effect-on-limits | low | Y |
| C5 | The limits apply per account and per IP at the same time. Several CI runners or machines that share one POESESSID add their requests to one Account bucket. | unspecified | https://www.reddit.com/r/pathofexiledev/comments/1c3bff2/understanding_the_xratelimit_response_headers/ [2] | gerwaric (Reddit) | April 2024 | October 2, 2026 | auth-effect-on-limits | low | Y |
| C6 | When the shared Account bucket runs out, a blackout penalty starts at once on every node that uses that session, and the API returns 429 Too Many Requests. | unspecified | https://www.reddit.com/r/pathofexiledev/comments/1c3bff2/understanding_the_xratelimit_response_headers/ [2] | gerwaric (Reddit) | April 2024 | October 2, 2026 | auth-effect-on-limits | low | Y |
| C7 | The report found no evidence from the last six months of measured PoE2 trade API limits that change when a session cookie is present. | PoE2 | https://www.reddit.com/r/pathofexiledev/comments/1djjt5y/do_i_need_authorization_to_use_apipathofexilecom/ [5] | antonwnk (Reddit) | June 2024 | October 2, 2026 | auth-effect-on-limits | low | Y |
| C8 | Authentication changes the bucket structure by adding the Account axis, but the numeric advantage for PoE2 "remains unverified", and the shared limits make distributed CI use "highly restrictive". | PoE2 | no citation (the report's own synthesis) | – | – | – | auth-effect-on-limits | low | Y |

### RQ2: How POESESSID works

| id | claim | game | source | publisher | pub_date | accessed | class | confidence | load_bearing |
|---|---|---|---|---|---|---|---|---|---|
| C9 | POESESSID is an opaque session cookie that pathofexile.com issues after a successful login. | unspecified | https://www.pathofexile.com/forum/view-thread/3328601 [6] | Community_Team (GGG forum) | December 2022 | October 2, 2026 | cookie-mechanics | medium | N |
| C10 | The cookie becomes invalid as soon as the user logs out of pathofexile.com. | unspecified | https://www.pathofexile.com/forum/view-thread/3328601 [6] | Community_Team (GGG forum) | December 2022 | October 2, 2026 | cookie-mechanics | medium | Y |
| C11 | The cookie gives full, unrestricted access to the account. A leaked cookie lets attackers change private account data and settings and see private league information. | unspecified | https://github.com/SnosMe/awakened-poe-trade/issues/821 [7] | SnosMe (GitHub) | December 2022 | October 2, 2026 | cookie-mechanics | low | Y |
| C12 | Awakened PoE Trade once let users enter their POESESSID to bypass captchas and use private leagues. The maintainer discouraged this, then removed the default behavior after "severe security incidents involving session hijacking". | unspecified | https://github.com/SnosMe/awakened-poe-trade/issues/821 [7] | SnosMe (GitHub) | December 2022 | October 2, 2026 | cookie-mechanics | low | N |
| C13 | Exiled Exchange 2 needed repeated patches to stop it from accidentally sending the anonymous POESESSID back to the trade API during normal searches. | unspecified | https://github.com/Kvan7/Exiled-Exchange-2/issues/910 [10] | Waveox (GitHub) | June 2025 | October 2, 2026 | cookie-mechanics | low | N |
| C14 | Tools that inject POESESSID into the trade API are often blocked completely, because a valid Cloudflare cf_clearance cookie must often go with the session to get past the anti-bot protections. | unspecified | https://github.com/PathOfBuildingCommunity/PathOfBuilding/issues/8384 [11]; https://github.com/idan-rubin/browserclaw [12] | PathOfBuildingCommunity (GitHub); idan-rubin (GitHub) | October 2024; August 2026 | October 2, 2026 | cookie-mechanics | low | Y |

### RQ3: GGG's policy

| id | claim | game | source | publisher | pub_date | accessed | class | confidence | load_bearing |
|---|---|---|---|---|---|---|---|---|---|
| C15 | Section 7c of the GGG Terms of Use forbids any automated software, bots or data-extraction tools against the Website or Services without prior written approval. | unspecified | https://www.pathofexile.com/forum/view-thread/3800102 [13] (Works cited title: "POE1-WASD-control with script legal ?") | GGG per the Source List; the URL is a forum thread | September 2026 | October 2, 2026 | policy-tos | low | Y |
| C16 | GGG staff and the developer community have said that use of internal pathofexile.com web APIs, such as the trade API, through POESESSID is tolerated in practice but not supported officially. | unspecified | https://www.reddit.com/r/pathofexiledev/comments/1djjt5y/do_i_need_authorization_to_use_apipathofexilecom/ [5]; [14] (Source List URL https://www.pathofexile.com/legal/terms-of-use-and-privacy-policy; Works cited URL https://www.pathofexile.com/forum/view-thread/2969035) | antonwnk (Reddit); GGG / neohongkong (forum) | June 2024; September 2026 / October 2020 | October 2, 2026 | policy-tos | low | Y |
| C17 | Automated polling that keeps breaking the rate-limit policies leads to the application, the source IP or the user's account being blacklisted permanently at the server. | unspecified | https://www.reddit.com/r/pathofexiledev/comments/1c3bff2/understanding_the_xratelimit_response_headers/ [2] | gerwaric (Reddit) | April 2024 | October 2, 2026 | ban-history | low | Y |
| C18 | The community tool Acquisition was blacklisted at the server for all users in 2023 for repeated rate-limit violations, caused by poor Retry-After handling. | unspecified | https://www.reddit.com/r/pathofexiledev/comments/1c3bff2/understanding_the_xratelimit_response_headers/ [2] | gerwaric (Reddit) | April 2024 | October 2, 2026 | ban-history | low | Y |
| C19 | GGG Support has a record of locking accounts for automated multi-boxing under the same Terms of Use. | unspecified | https://www.pathofexile.com/forum/view-thread/1965633 [16] (title: "Is there any chance to get locked account unlocked on weekend") | GGG Support (forum) | August 2017 | October 2, 2026 | ban-history | low | N |
| C20 | The developer portal requires every application that calls GGG APIs to send an identifying User-Agent in the format `OAuth {$clientId}/{$version} (contact: {$contact})`. | unspecified | https://www.pathofexile.com/developer/docs [17] | Grinding Gear Games | September 2026 | October 2, 2026 | policy-tos | high | N |
| C21 | GGG web developer Novynn asked on the forums that community developers set a User-Agent with tool and contact information, so that GGG has a contact if traffic anomalies occur. | unspecified | https://www.pathofexile.com/forum/view-thread/3019033/page/1 [18] | Novynn (GGG forum) | January 21, 2021 | October 2, 2026 | policy-tos | medium | N |

### RQ4: Official OAuth

| id | claim | game | source | publisher | pub_date | accessed | class | confidence | load_bearing |
|---|---|---|---|---|---|---|---|---|---|
| C22 | The official developer API uses OAuth 2.1. Its scopes include account:stashes, account:characters, account:profile and service:cxapi (Currency Exchange). | unspecified | https://www.pathofexile.com/developer/docs/authorization [19] | Grinding Gear Games | September 2026 | October 2, 2026 | oauth-scopes | high | Y |
| C23 | "Two independent sources from the official API reference confirm these available scopes." | unspecified | https://www.pathofexile.com/developer/docs/authorization [19] (one URL only) | Grinding Gear Games | September 2026 | October 2, 2026 | oauth-scopes | low | Y |
| C24 | No evidence shows that any OAuth scope, access token or official endpoint can search or fetch on the main Trade API in PoE1 or PoE2. | both | https://www.pathofexile.com/developer/docs/authorization [19] | Grinding Gear Games | September 2026 | October 2, 2026 | oauth-scopes | high | Y |
| C25 | OAuth has two client types: public and confidential. | unspecified | https://www.pathofexile.com/developer/docs/authorization [19] | Grinding Gear Games | September 2026 | October 2, 2026 | oauth-flow | high | N |
| C26 | Public clients (desktop applications) can use only the Authorization Code Grant with PKCE and need a local redirect URI such as http://127.0.0.1. Their access tokens expire after 10 hours and their refresh tokens after 7 days. | unspecified | https://www.pathofexile.com/developer/docs/authorization [19] | Grinding Gear Games | September 2026 | October 2, 2026 | oauth-flow | high | N |
| C27 | Confidential clients (server-backed) can use the Client Credentials grant and get 28-day access tokens and 90-day refresh tokens, with independent rate limits. | unspecified | https://www.pathofexile.com/developer/docs/authorization [19] | Grinding Gear Games | September 2026 | October 2, 2026 | oauth-flow | high | N |
| C28 | Both OAuth flows need an application registration that GGG approves, under strict guidelines on credential security, error handling and third-party branding notices. | unspecified | https://www.pathofexile.com/developer/docs [17] | Grinding Gear Games | September 2026 | October 2, 2026 | oauth-flow | high | Y |
| C29 | The OAuth endpoints do not cover trade search or fetch, so a headless CI tool cannot use the official infrastructure to price items. | unspecified | no citation (inference from C24) | – | – | – | oauth-scopes | medium | Y |

### RQ5: Interactive-flow feasibility

| id | claim | game | source | publisher | pub_date | accessed | class | confidence | load_bearing |
|---|---|---|---|---|---|---|---|---|---|
| C30 | A manual paste of the cookie from browser developer tools is "highly user-hostile", breaks unattended CI, and increases the risk that the credential appears in terminal histories. | unspecified | https://github.com/SnosMe/awakened-poe-trade/issues/821 [7] | SnosMe (GitHub) | December 2022 | October 2, 2026 | interactive-flow | low | Y |
| C31 | Windows App-Bound Encryption (ABE), introduced in Chrome 127, now blocks the reading of the cookie from local Chrome or Edge profiles. | unspecified | https://github.com/steipete/sweet-cookie/issues/23 [22] | steipete (GitHub) | August 2026 | October 2, 2026 | interactive-flow | medium | Y |
| C32 | ABE binds the decryption keys to the identity of the Chrome executable through an elevated Windows COM service. Standard Node.js extraction libraries fail with unsupported-state errors unless they use "malware-like direct syscall reflective process hollowing". | unspecified | https://github.com/steipete/sweet-cookie/issues/23 [22] | steipete (GitHub) | August 2026 | October 2, 2026 | interactive-flow | medium | Y |
| C33 | An embedded webview or Playwright session that automates login and captures the cookie is "equally unviable", because Cloudflare Turnstile actively blocks it. | unspecified | https://github.com/idan-rubin/browserclaw [12] | idan-rubin (GitHub) | August 2026 | October 2, 2026 | interactive-flow | low | Y |
| C34 | Cloudflare detects automated browsers from TLS cipher order, missing navigator.webdriver properties and cross-origin iframe anomalies, and blocks the login before it issues cf_clearance. | unspecified | https://www.reddit.com/r/WebDataDiggers/comments/1sduxjk/playwright_stealth_setups_that_hold_up_better_in/ [24] | Unknown (Reddit) | June 2026 | October 2, 2026 | interactive-flow | low | Y |
| C35 | An OAuth PKCE flow with a loopback redirect on 127.0.0.1 is well supported, but it issues only an OAuth access token and does not give the POESESSID that the internal web trade API needs. | unspecified | https://www.reddit.com/r/pathofexiledev/comments/1jppd3y/how_to_automatically_obtain_an_oauthcookie_token/ [15] | kotlynn (Reddit) | April 2024 | October 2, 2026 | interactive-flow | low | Y |

### RQ6: Operational reality

| id | claim | game | source | publisher | pub_date | accessed | class | confidence | load_bearing |
|---|---|---|---|---|---|---|---|---|---|
| C36 | To handle 429, the tool must parse the X-Rate-Limit-*-State payload, compute the longest active blackout, and wait before it continues. | unspecified | https://www.reddit.com/r/pathofexiledev/comments/1c3bff2/understanding_the_xratelimit_response_headers/ [2] | gerwaric (Reddit) | April 2024 | October 2, 2026 | operational | low | N |
| C37 | The bucket headers give the current hits, the period and the blackout duration. If the tool does not stop for the full blackout, server-side heuristic blacklisting is "guaranteed". | unspecified | https://www.reddit.com/r/pathofexiledev/comments/e6h6o2/trade_api_request_limit/ [1] | KoomZog / rChinnn (Reddit) | December 2019 | October 2, 2026 | operational | low | N |
| C38 | Maintainers of long-running tools report that aggressive scraping without circular-buffer pacing caused wide blocking. The example is Acquisition, blacklisted for all users because of poor retry logic. | unspecified | https://www.reddit.com/r/pathofexiledev/comments/1c3bff2/understanding_the_xratelimit_response_headers/ [2] | gerwaric (Reddit) | April 2024 | October 2, 2026 | ban-history | low | Y |
| C39 | A session cookie kept as a CI secret is "highly brittle and operationally dangerous". | unspecified | https://github.com/SnosMe/awakened-poe-trade/issues/821 [7] | SnosMe (GitHub) | December 2022 | October 2, 2026 | operational | low | Y |
| C40 | If the user logs out in the browser, the CI secret becomes invalid at once. The API then returns 401 Unauthorized or 403 Forbidden, and the pipeline stops until a person acts. | unspecified | https://www.pathofexile.com/forum/view-thread/3328601 [6] | Community_Team (GGG forum) | December 2022 | October 2, 2026 | operational | low | Y |

### RQ7: Cost and lock-in

| id | claim | game | source | publisher | pub_date | accessed | class | confidence | load_bearing |
|---|---|---|---|---|---|---|---|---|---|
| C41 | Building and maintaining a smooth flow that extracts the session cookie is "prohibitively expensive", because browser encryption and Cloudflare's defenses keep changing against such tools. | unspecified | https://github.com/steipete/sweet-cookie/issues/23 [22] | steipete (GitHub) | August 2026 | October 2, 2026 | cost-effort | medium | Y |
| C42 | A bypass of ABE needs continuous maintenance against upstream Chromium changes and adds severe supply-chain risk for the end user. | unspecified | https://github.com/steipete/sweet-cookie/issues/23 [22] | steipete (GitHub) | August 2026 | October 2, 2026 | cost-effort | medium | Y |
| C43 | An abstraction seam that separates the pricing logic from the network client is "a structural necessity". It lets the tool fall back from A to D when an injected cookie expires, Cloudflare rejects it, or an Account rate-limit penalty occurs. | unspecified | https://www.reddit.com/r/pathofexiledev/comments/1c3bff2/understanding_the_xratelimit_response_headers/ [2] | gerwaric (Reddit) | April 2024 | October 2, 2026 | cost-effort | low | N |

### Interactive-flow feasibility table

| id | claim | game | source | publisher | pub_date | accessed | class | confidence | load_bearing |
|---|---|---|---|---|---|---|---|---|---|
| C44 | Manual paste: Awakened PoE Trade allowed this in the past and Exiled Exchange 2 supports it. The verdict is "Unacceptable for CI; feasible only for local developer execution". | unspecified | https://github.com/SnosMe/awakened-poe-trade/issues/821 [7] | SnosMe (GitHub) | December 2022 | October 2, 2026 | interactive-flow | low | Y |
| C45 | Local DB extraction (DPAPI on Windows, Keychain on macOS, which decrypt the SQLite Cookies database) was widely used before Chrome 127. | unspecified | https://github.com/topics/cookie-extraction [29] | mherod (GitHub Topics) | September 2026 | October 2, 2026 | interactive-flow | low | N |
| C46 | Local DB extraction fails completely on current Windows Chrome/Edge because of ABE, and needs "malware-style DLL injection" to bypass. The verdict is "Unviable". | unspecified | https://github.com/steipete/sweet-cookie/issues/23 [22]; https://github.com/xaitax/Chrome-App-Bound-Encryption-Decryption [23] | steipete (GitHub); xaitax (GitHub) | August 2026; September 2026 | October 2, 2026 | interactive-flow | medium | Y |
| C47 | Playwright capture is "blocked unconditionally" by Cloudflare Turnstile TLS fingerprinting and bot behavioral biometrics. The verdict is "High Friction; requires constant patching of stealth parameters and breaks frequently". | unspecified | https://www.reddit.com/r/WebDataDiggers/comments/1sduxjk/playwright_stealth_setups_that_hold_up_better_in/ [24]; https://github.com/idan-rubin/browserclaw [12] | Unknown (Reddit); idan-rubin (GitHub) | June 2026; August 2026 | October 2, 2026 | interactive-flow | low | Y |
| C48 | OAuth 2.1 PKCE is "Mandated for all official desktop and public client applications". | unspecified | https://www.pathofexile.com/developer/docs/authorization [19] | Grinding Gear Games | September 2026 | October 2, 2026 | oauth-flow | high | N |
| C49 | The PKCE access token is "mathematically useless for the undocumented /api/trade/ endpoints". The verdict is "Structurally Flawed". | unspecified | https://www.reddit.com/r/pathofexiledev/comments/1jppd3y/how_to_automatically_obtain_an_oauthcookie_token/ [15] | kotlynn (Reddit) | April 2024 | October 2, 2026 | oauth-scopes | low | Y |

## 3. Gaps the report admits

1. **PoE2 metric divergence:** "The exact numeric thresholds for the PoE2 /api/trade2/search and /api/trade2/fetch endpoints when authenticated versus unauthenticated remain undocumented in the public domain. It is unverified if GGG ported the exact token bucket capacities from PoE1 to PoE2, or if PoE2 introduces stricter baseline penalties."
2. **Cloudflare persistence:** "It remains unverified whether an injected POESESSID cookie requires a continuously refreshed cf_clearance cookie for all API routes over a 24-hour period, or if the API layer bypasses Cloudflare Turnstile entirely once the session is internally validated by the backend."
3. In RQ1 the report also says that the numeric advantage for PoE2 "remains unverified" (C7, C8).

**Recommended experiment (close paraphrase):** Write a small Node.js script. Send concurrent `/api/trade2/search` requests with no authentication until a 429 occurs, and log the final `X-Rate-Limit-Policy` and `X-Rate-Limit-Rules` headers. Then add a manually copied `Cookie: POESESSID=...` from a live browser session to the same script and run the same burst again. Compare `X-Rate-Limit-Account-State` with the unauthenticated `X-Rate-Limit-Ip-State` to find out whether the bucket capacity differs on PoE2.

## 4. Extractor flags

**Internal arithmetic and logic**
- **F1 – Matrix total is wrong.** The weighted total for D is 58 (6+12+10+10+15+5), not the 60 that the report prints. A, B and C are correct. The ranking does not change.
- **F2 – The runner-up does not follow the matrix.** B scores 41 and A scores 29, but the report names A as runner-up. The matrix and the verdict are inconsistent.
- **F3 – B's scores conflict with the report's own finding.** The report says OAuth cannot reach the trade API (C24, C29, C49), but scores B 3 on "Unattended-Run / CI Fit" and 4 on "Interactive-Flow Fit". It also scores B 5 on policy safety and 4 on leak impact for an option that cannot do the job. This raises B's total.
- **F4 – "Measured rate-limit gain" has no measurement behind it.** A and C score 4 and D scores 2, but the only numbers (C2, PoE1, 2019) show that unauthenticated IP limits were higher (12/6s against 4/6s). The report also says the PoE2 gain is unverified (C7, C8). The only support for "auth is better" is one GitHub README (C4). The scores contradict the report's own evidence.
- **F5 – Option D's ToS claim contradicts C15.** The verdict says D gives "absolute compliance with the Terms of Use". C15 says Section 7c forbids *any* automated software or data extraction without written approval, which includes an unauthenticated automated CLI. The report does not reconcile the two.
- **F6 – Contradictory Playwright verdicts.** The table says "Blocked unconditionally", but the verdict cell says "High Friction; requires constant patching" (which means it is possible). RQ5 says "equally unviable".
- **F7 – Contradictory limit evidence is not resolved.** C2/C3 (auth is lower) and C4 (auth is higher) are both given, and the report does not resolve them.

**Citations that do not match the claim**
- **F8 – [13] for ToS Section 7c (C15)** points to a forum thread titled "POE1-WASD-control with script legal ?", not to the ToS. The Source List calls it "Terms of Use (Section 7 Restrictions)" from "Grinding Gear Games".
- **F9 – [14] has two URLs.** The Source List gives `https://www.pathofexile.com/legal/terms-of-use-and-privacy-policy` (GGG) and also lists [14] as "neohongkong — Section 7 Restrictions Breakdown" at `forum/view-thread/2969035`. Works cited gives "AWAKENED POE TRADE – Forum" at `forum/view-thread/2969035`. So the "GGG staff ... tolerated" claim (C16) rests on a Reddit thread [5] and an uncertain forum thread.
- **F10 – [16] for multi-boxing bans (C19)** is a 2017 thread titled "Is there any chance to get locked account unlocked on weekend". It is not obviously about multi-boxing or about API use.
- **F11 – [6] has two titles.** Works cited says "Do not share POESESSID values with other people", and the Source List says "Trade Website Updates". The 401/403 status codes in C40 do not obviously come from that thread.
- **F12 – [12] (browserclaw, a general AI browser-automation repository)** is used for PoE-specific claims about cf_clearance on the trade API (C14) and Turnstile blocking a PoE login (C33). It is a generic source that is not about PoE.
- **F13 – [7] (APT issue #821) is used for "Exiled Exchange 2 supports it" (C44)**, and for CI-secret brittleness (C39), which is a CI judgment that a 2022 APT issue is unlikely to state.
- **F14 – [2] (a Reddit post about headers) is used for the abstraction-seam recommendation (C43).** That is the report's own design advice, presented as if cited.
- **F15 – [5] (June 2024) is used for "no evidence ... within the last six months" (C7).** A source from 2024 cannot support a claim about the last six months.
- **F16 – C32 "process hollowing" is cited to [22]** (a bug report on cookie decryption). The Source List puts the process-hollowing technique under [23].
- **F17 – [10] has three titles for one URL:** "failed to load leagues" in Works cited, and "Got GGG to take a look at this" and "Fix: stop echoing anonymous POESESSID" in the Source List.
- **F18 – Off-topic or unused sources.** [28] is a Korean translation issue (#162) in the Source List. The body does not cite [4], [8], [9], [20], [21], [25], [26], [27], [28], [30] or [31]. [20] would be the natural second source for the scope list but is not cited at that claim.
- **F19 – The Source List repeats one citation number with different authors and titles** ([1] is credited to both KoomZog and rChinnn under four titles; [19] appears under eight titles). The Source List entries are fragments of one page, not separate sources.

**Breaks of the brief's evidence rules**
- **F20 – Claimed independence is false.** C3 ("secondary independent source") cites the same [1] as C2. C23 ("two independent sources ... confirm these scopes") cites only [19]. The two-source rule for numeric limits and for the OAuth scope list is therefore not met.
- **F21 – Bans rest on one source.** The Acquisition blacklist (C18, C38) and permanent blacklisting (C17) each rest only on [2], a Reddit post. The report says "Independent sources verify this ban history", but the second source is [16] (F10), which is about a different topic.
- **F22 – "Auth raises limits" has no two-source support** in either direction. The "no" side is one 2019 Reddit thread and the "yes" side is one GitHub README.
- **F23 – PoE1 evidence is applied to PoE2.** The only rate-limit numbers are PoE1 from December 2019 (C2, C3), yet the matrix scores the options for a tool that targets PoE2 `/api/trade2`. Most other claims (Acquisition, cookie mechanics, cf_clearance) do not say which game they are about.
- **F24 – Freshness.** Every rate-limit, ban and cookie claim cites sources older than 6 months (2017–May 2025). The only fresh sources are the GGG developer docs (September 2026), which cover OAuth and the User-Agent only, and the browser-security repositories and posts (2026). C15's ToS source is dated September 2026 but points to a forum thread (F8).
- **F25 – The source dates come only from the Source List.** Works cited has no dates. Some Source List dates look inconsistent with the content; the extractor did not check them, by the research firewall.
- **F26 – Claims with no citation:** C8, C29, the verdict, and all matrix scores.
- **F27 – The phrasing overstates certainty:** "mathematically" (verdict, C49, the experiment), "guarantees" (C37), "blocked unconditionally" (C47), "absolute compliance" (F5). None of these has a measurement behind it.

## 5. Source list (as the report gives it)

The Source List has 54 rows. Many repeat one citation number. Rows are shown in the report's order. Where the Works cited title or URL differs, it is given in brackets.

| S# | publisher | title | URL | pub date | access date |
|---|---|---|---|---|---|
| 19 | Grinding Gear Games | Authorization – Path of Exile Developer Docs | https://www.pathofexile.com/developer/docs/authorization | September 2026 | October 2, 2026 |
| 17 | Grinding Gear Games | Overview – Path of Exile Developer Docs | https://www.pathofexile.com/developer/docs | September 2026 | October 2, 2026 |
| 5 | antonwnk | Do I need authorization to use api.pathofexile.com? | https://www.reddit.com/r/pathofexiledev/comments/1djjt5y/do_i_need_authorization_to_use_apipathofexilecom/ | June 2024 | October 2, 2026 |
| 19 | Grinding Gear Games | Authorization Flow – Path of Exile Developer Docs | https://www.pathofexile.com/developer/docs/authorization | September 2026 | October 2, 2026 |
| 1 | KoomZog | Trade API request limit | https://www.reddit.com/r/pathofexiledev/comments/e6h6o2/trade_api_request_limit/ | December 2019 | October 2, 2026 |
| 21 | mahhov | Arevtur Setup Guide | https://github.com/mahhov/arevtur | August 2024 | October 2, 2026 |
| 10 | Waveox | Got GGG to take a look at this [Works cited: "failed to load leagues · Issue #910"] | https://github.com/Kvan7/Exiled-Exchange-2/issues/910 | June 2025 | October 2, 2026 |
| 19 | Grinding Gear Games | Available Scopes – Path of Exile Developer Docs | https://www.pathofexile.com/developer/docs/authorization | September 2026 | October 2, 2026 |
| 17 | Grinding Gear Games | Third-Party Policy – Path of Exile Developer Docs | https://www.pathofexile.com/developer/docs | September 2026 | October 2, 2026 |
| 20 | Grinding Gear Games | API Reference – Path of Exile Developer Docs [Works cited: "Public Stash API – Developer Docs"] | https://www.pathofexile.com/developer/docs/reference | September 2026 | October 2, 2026 |
| 17 | Grinding Gear Games | Rate Limits and Headers – Path of Exile Developer Docs | https://www.pathofexile.com/developer/docs | September 2026 | October 2, 2026 |
| 19 | Grinding Gear Games | OAuth Server Endpoints – Path of Exile Developer Docs | https://www.pathofexile.com/developer/docs/authorization | September 2026 | October 2, 2026 |
| 20 | Grinding Gear Games | Data Export Reference – Path of Exile Developer Docs | https://www.pathofexile.com/developer/docs/reference | September 2026 | October 2, 2026 |
| 8 | Various | PSA: If you got hacked, check if you have this | https://www.reddit.com/r/pathofexile/comments/1hp8aqm/psa_if_you_got_hacked_check_if_you_have_this/ | March 2024 | October 2, 2026 |
| 28 | Exiled-Exchange-2 Contributors | Issue #162 [Works cited: "[Korean] Translate remaining english in app_i18n.json #162"] | https://github.com/Kvan7/Exiled-Exchange-2/issues/162 | July 2025 | October 2, 2026 |
| 10 | Waveox | Fix: stop echoing anonymous POESESSID | https://github.com/Kvan7/Exiled-Exchange-2/issues/910 | June 2025 | October 2, 2026 |
| 6 | Community_Team | Trade Website Updates [Works cited: "Do not share POESESSID values with other people"] | https://www.pathofexile.com/forum/view-thread/3328601 | December 2022 | October 2, 2026 |
| 1 | rChinnn | Trade API request limit | https://www.reddit.com/r/pathofexiledev/comments/e6h6o2/trade_api_request_limit/ | December 2019 | October 2, 2026 |
| 1 | rChinnn | Trade API Request Limits Explanation | https://www.reddit.com/r/pathofexiledev/comments/e6h6o2/trade_api_request_limit/ | December 2019 | October 2, 2026 |
| 11 | PathOfBuildingCommunity | Issue 8384: Cloudflare verification [Works cited: "Error while fetching league list: Response code 403 #8384"] | https://github.com/PathOfBuildingCommunity/PathOfBuilding/issues/8384 | October 2024 | October 2, 2026 |
| 7 | SnosMe | Ingame trade browser gone? Issue #821 | https://github.com/SnosMe/awakened-poe-trade/issues/821 | December 2022 | October 2, 2026 |
| 9 | SnosMe | Add support for Private Leagues Issue #212 | https://github.com/SnosMe/awakened-poe-trade/issues/212 | October 2020 | October 2, 2026 |
| 7 | SnosMe | Authentication requirements in APT | https://github.com/SnosMe/awakened-poe-trade/issues/821 | December 2022 | October 2, 2026 |
| 5 | antonwnk | API rate limit policies and user agents | https://www.reddit.com/r/pathofexiledev/comments/1djjt5y/do_i_need_authorization_to_use_apipathofexilecom/ | June 2024 | October 2, 2026 |
| 17 | Grinding Gear Games | Guidelines and Credentials – Path of Exile Developer Docs | https://www.pathofexile.com/developer/docs | September 2026 | October 2, 2026 |
| 18 | Novynn | Developer API Guidelines [Works cited: "API connection with python – Forum"] | https://www.pathofexile.com/forum/view-thread/3019033/page/1 | January 21, 2021 | October 2, 2026 |
| 18 | Novynn | Please set a User-Agent header | https://www.pathofexile.com/forum/view-thread/3019033/page/1 | January 21, 2021 | October 2, 2026 |
| 15 | kotlynn | How to Automatically Obtain an OAuth(Cookie) Token? | https://www.reddit.com/r/pathofexiledev/comments/1jppd3y/how_to_automatically_obtain_an_oauthcookie_token/ | April 2024 | October 2, 2026 |
| 1 | rChinnn | Limit Policies | https://www.reddit.com/r/pathofexiledev/comments/e6h6o2/trade_api_request_limit/ | December 2019 | October 2, 2026 |
| 13 | Grinding Gear Games | Terms of Use (Section 7 Restrictions) [Works cited: "POE1-WASD-control with script legal ?"] | https://www.pathofexile.com/forum/view-thread/3800102 | September 2026 | October 2, 2026 |
| 14 | Grinding Gear Games | Terms of Use and Privacy Policy [Works cited: "AWAKENED POE TRADE – Forum", https://www.pathofexile.com/forum/view-thread/2969035] | https://www.pathofexile.com/legal/terms-of-use-and-privacy-policy | September 2026 | October 2, 2026 |
| 16 | GGG Support | Multi-boxing bans [Works cited: "Is there any chance to get locked account unlocked on weekend"] | https://www.pathofexile.com/forum/view-thread/1965633 | August 2017 | October 2, 2026 |
| 14 | neohongkong | Section 7 Restrictions Breakdown | https://www.pathofexile.com/forum/view-thread/2969035 | October 2020 | October 2, 2026 |
| 2 | gerwaric | Understanding the X-Rate-Limit- response headers | https://www.reddit.com/r/pathofexiledev/comments/1c3bff2/understanding_the_xratelimit_response_headers/ | April 2024 | October 2, 2026 |
| 2 | gerwaric | X-Rate-Limit-Account-State | https://www.reddit.com/r/pathofexiledev/comments/1c3bff2/understanding_the_xratelimit_response_headers/ | April 2024 | October 2, 2026 |
| 4 | gerwaric | Blacklisting mechanisms [Works cited: "Is there a way to bypass trade api's rate limit?"] | https://www.reddit.com/r/pathofexiledev/comments/1asd52t/is_there_a_way_to_bypass_trade_apis_rate_limit/ | February 2024 | October 2, 2026 |
| 3 | yaredmax | poe-ninja-build-cost rate limitations | https://github.com/yaredmax/poe-ninja-build-cost | May 2025 | October 2, 2026 |
| 1 | rChinnn | Invalid Query Errors | https://www.reddit.com/r/pathofexiledev/comments/e6h6o2/trade_api_request_limit/ | December 2019 | October 2, 2026 |
| 29 | mherod | get-cookie cross-platform extraction [Works cited: "cookie-extraction · GitHub Topics"] | https://github.com/topics/cookie-extraction | September 2026 | October 2, 2026 |
| 30 | mherod | get-cookie Node.js module | https://github.com/mherod/get-cookie | September 2026 | October 2, 2026 |
| 22 | steipete | Bug: Chrome v20 cookie decryption fails | https://github.com/steipete/sweet-cookie/issues/23 | August 2026 | October 2, 2026 |
| 31 | moond4rk | HackBrowserData Chrome Bypass (not in Works cited) | https://github.com/moond4rk/HackBrowserData | September 2026 | October 2, 2026 |
| 23 | xaitax | Chrome-App-Bound-Encryption-Decryption [Works cited: "ChromElevator"] | https://github.com/xaitax/Chrome-App-Bound-Encryption-Decryption | September 2026 | October 2, 2026 |
| 19 | Grinding Gear Games | service:cxapi documentation | https://www.pathofexile.com/developer/docs/authorization | September 2026 | October 2, 2026 |
| 19 | Grinding Gear Games | OAuth Server Flow | https://www.pathofexile.com/developer/docs/authorization | September 2026 | October 2, 2026 |
| 23 | xaitax | Process Hollowing Technique for ABE | https://github.com/xaitax/Chrome-App-Bound-Encryption-Decryption | September 2026 | October 2, 2026 |
| 22 | steipete | Chrome v20 Encryption Format Limitations | https://github.com/steipete/sweet-cookie/issues/23 | August 2026 | October 2, 2026 |
| 12 | idan-rubin | Browserclaw Cloudflare Turnstile handling | https://github.com/idan-rubin/browserclaw | August 2026 | October 2, 2026 |
| 24 | Unknown | Playwright stealth setups in 2026 | https://www.reddit.com/r/WebDataDiggers/comments/1sduxjk/playwright_stealth_setups_that_hold_up_better_in/ | June 2026 | October 2, 2026 |
| 26 | feder-cr | Playwright iframe interactions and Turnstile | https://github.com/feder-cr/invisible_playwright/wiki/how-to-handle-cookie-consent-banners-playwright | August 2026 | October 2, 2026 |
| 25 | TheHeroBrine422 | Turnstile bypass implementations [Works cited: "Time to remove gg recaptcha from my website"] | https://www.reddit.com/r/webdev/comments/1t9mmh6/time_to_remove_gg_recaptcha_from_my_website/ | May 2026 | October 2, 2026 |
| 27 | Unknown | Cloudflare blocking AI agents | https://www.reddit.com/r/AI_Agents/comments/1umfd6q/cloudflare_is_about_to_block_ai_agents_by_default/ | September 2026 | October 2, 2026 |
| 2 | gerwaric | Trade vs Backend Limit Policies | https://www.reddit.com/r/pathofexiledev/comments/1c3bff2/understanding_the_xratelimit_response_headers/ | April 2024 | October 2, 2026 |
| 19 | Grinding Gear Games | Client Credentials Grant | https://www.pathofexile.com/developer/docs/authorization | September 2026 | October 2, 2026 |

Distinct URLs: 30 (Works cited 1–30), plus HackBrowserData [31], which appears only in the Source List.
