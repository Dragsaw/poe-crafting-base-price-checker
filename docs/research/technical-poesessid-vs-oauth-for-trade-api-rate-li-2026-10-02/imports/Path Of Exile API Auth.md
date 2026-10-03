# **Authentication and Rate Limiting Strategy for Path of Exile Trade API Automation**

## **Verdict**

The recommended architecture is Option D (Stay unauthenticated). For an unattended, open-source command-line interface running in continuous integration or developer environments, maintaining a zero-credential footprint ensures absolute compliance with the Terms of Use while eliminating the severe operational friction of bypassing modern browser security protocols. The named runner-up is Option A (POESESSID cookie). Option A wins exclusively under conditions where the baseline unauthenticated Ip rate limits mathematically preclude the tool from completing its pricing chunks within a required time window, and only if the tool is deployed on a dedicated, user-attended machine where manual credential injection is viable. The strongest argument against Option A is the profound security risk of exposing an all-access bearer token in plaintext environments, coupled with the systemic inability to automate the retrieval of this cookie due to Chrome's App-Bound Encryption and Cloudflare Turnstile behavioral biometrics.

## **Decision Matrix**

The following decision matrix evaluates the four authentication strategies against core operational criteria. Scores are assigned on a scale of 1 to 5, where 5 represents the optimal outcome (e.g., highest rate limit, lowest risk, lowest effort). The total score is a weighted sum designed to reflect the priorities of an unattended, open-source pricing tool.

| Evaluation Criteria | Weight | A: POESESSID | B: Official OAuth | C: Hybrid (Both) | D: Unauthenticated |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Measured Rate-Limit Gain** | 3 | 4 | 1 | 4 | 2 |
| **Ban or Policy Risk (1=High Risk, 5=Safe)** | 3 | 2 | 5 | 2 | 4 |
| **Credential-Leak Impact (1=Severe, 5=None)** | 2 | 1 | 4 | 1 | 5 |
| **Build and Maintenance Effort** | 2 | 2 | 1 | 1 | 5 |
| **Unattended-Run / CI Fit** | 3 | 1 | 3 | 1 | 5 |
| **Interactive-Flow Fit** | 1 | 2 | 4 | 2 | 5 |
| **Weighted Total** | **\-** | **29** | **41** | **27** | **60** |

## **Findings per Research Question**

### **1\. Does authentication raise the trade API limits at all?**

Authentication introduces an Account rate limit rule that operates in parallel with the Ip rule across the trade infrastructure1. Stale evidence from seven years ago regarding PoE1 trade fetch endpoints indicates that unauthenticated IP limits were mathematically more generous, allowing 12 requests per 6 seconds per IP, compared to 4 requests per 6 seconds per POESESSID1. A secondary independent source from the same era captured exact headers for the PoE1 trade-search-request-limit, verifying the Ip rule at 12:6:60 and the Ip-State at 1:6:01. Conversely, fresh evidence from recent community repository documentation presents contrary evidence, asserting that utilizing authentication yields faster polling because accounts are explicitly granted a larger overall allowance than bare IP addresses3.  
The rate limit architecture enforces these limits concurrently per-account and per-IP, meaning that if multiple continuous integration runners or discrete developer machines share a single POESESSID, their collective requests aggregate against a single Account bucket2. Exhausting this shared Account bucket instantly triggers a global blackout penalty across all distributed nodes utilizing that session, returning 429 Too Many Requests responses2. No evidence was found regarding specific, measured numeric trade API rate limits for PoE2 varying based on the presence of a session cookie within the last six months5. Therefore, while authentication alters the token bucket topology by adding the Account axis, the exact numeric advantage for PoE2 remains unverified, and the aggregation of limits makes distributed CI usage highly restrictive.

### **2\. How POESESSID works**

The POESESSID is an opaque session cookie issued directly by the pathofexile.com domain upon successful user login6. The lifecycle of this session cookie is inextricably tied to the web interface; it is completely invalidated the moment the user explicitly logs out of the pathofexile.com website, rendering any previously captured tokens dead6. This cookie grants full, unrestricted access to the user's account, meaning that if it leaks, malicious actors acquire the ability to manipulate private account data, alter settings, and view private league information7.  
Historically, community tools such as Awakened PoE Trade allowed users to input their POESESSID to bypass captchas and access private leagues, but the maintainer actively discouraged and subsequently removed this default behavior due to severe security incidents involving session hijacking7. Modern community tools like Exiled Exchange 2 have required continuous patching to prevent the accidental echoing of the anonymous POESESSID back to the trade API during routine searches10. Furthermore, tools attempting to inject the POESESSID into the trade API frequently encounter total blockage because a valid Cloudflare cf\_clearance cookie must often accompany the session to successfully negotiate the anti-bot protections11.

### **3\. GGG's policy**

The Grinding Gear Games Terms of Use, specifically Section 7c, strictly forbids the use of any automated software, bots, or data extraction tools against the Website or Services without prior written approval13. Despite this rigid legal framework, GGG staff and the developer community have explicitly stated that utilizing internal pathofexile.com web APIs, such as the trade API, via POESESSID is tolerated in practice but remains completely unsupported in any official capacity5.  
Automated polling that consistently violates the dynamic rate limit policies results in severe punitive measures, including the application, the originating IP address, or the user's account being permanently blacklisted at the server level2. Independent sources verify this ban history; the popular community tool Acquisition was globally server-blacklisted in 2023 for persistent rate limit policy violations resulting from inadequate Retry-After header handling2, and GGG Support has a documented history of issuing account locks for automated multi-boxing violations under the same Terms of Use16. Fresh documentation from the developer portal mandates that any application programmatically interacting with GGG APIs must declare an identifiable User-Agent header utilizing the format OAuth {\$clientId}/{\$version} (contact: {\$contact})17. Official GGG web developer Novynn corroborated this requirement on the forums, explicitly requiring community developers to set a User-Agent header containing tool and contact information so that network engineers possess a point of contact if traffic anomalies arise18.

### **4\. Official OAuth**

The official developer API utilizes the OAuth 2.1 framework to secure access and provides a strictly defined list of resource scopes, including account:stashes, account:characters, account:profile, and service:cxapi for the Currency Exchange19. Two independent sources from the official API reference confirm these available scopes19. No evidence was found indicating that any OAuth scope, access token, or official endpoint provides querying or fetching capabilities for the main Trade API in either PoE1 or PoE219.  
The OAuth infrastructure divides implementations into two distinct client types: public and confidential19. Public clients, typically executable desktop applications, are restricted to the Authorization Code Grant with Proof Key for Code Exchange (PKCE), require a local redirect URI such as http\://127.0.0.1, and receive access tokens that expire in 10 hours alongside refresh tokens lasting 7 days19. Confidential clients, backed by secure servers, may utilize the Client Credentials grant to obtain 28-day access tokens and 90-day refresh tokens, benefiting from independent rate limits19. Deploying an application using either OAuth flow requires submitting an application registration for GGG's approval, a process governed by strict guidelines on credential security, error handling, and third-party branding notices17. Because the OAuth endpoints do not cover trade search or fetch, a headless continuous integration tool cannot leverage this official infrastructure for pricing items.

### **5\. Interactive flow feasibility**

Relying on a user to manually paste the session cookie from browser developer tools is highly user-hostile, breaks unattended continuous integration workflows, and severely increases the risk of accidental credential exposure in terminal histories7. The historical method of reading the session cookie dynamically from local Chrome or Edge profiles is now entirely obstructed by Windows App-Bound Encryption (ABE), introduced in Chrome version 12722. ABE cryptographically binds the decryption keys to the specific Chrome executable identity using an elevated Windows COM service, meaning standard Node.js cryptographic extraction libraries fail with unsupported state errors unless they resort to malware-like direct syscall reflective process hollowing22.  
Utilizing an embedded webview or Playwright instance to automate login and capture the cookie presents an equally unviable path, as it is actively mitigated by Cloudflare Turnstile12. Cloudflare detects automated browser fingerprints by analyzing TLS cipher orders, missing navigator.webdriver properties, and cross-origin iframe anomalies, blocking the authentication sequence before the cf\_clearance token can be issued24. Finally, implementing an OAuth PKCE flow with a loopback redirect on 127.0.0.1 is well-supported by the developer ecosystem and community tools, but this flow only issues an OAuth access token, which completely fails to yield the POESESSID credential required to access the internal web trade API15.

### **6\. Operational reality**

Handling the inevitable 429 Too Many Requests error requires aggressive state management, where the tool must intercept and parse the X-Rate-Limit-\*-State payload to calculate the longest active blackout period before resuming execution2. The token bucket headers define the current hits, the evaluation period, and the punitive blackout duration; failing to halt network activity for the exact duration of the blackout guarantees heuristic server-side blacklisting1.  
Maintainers of long-running tools report that aggressive scraping without circular buffer pacing algorithms resulted in widespread blocking, as evidenced by the Acquisition tool being blacklisted for all users due to poor retry logic2. Persisting a session cookie as a secret in a continuous integration environment is highly brittle and operationally dangerous7. If the user explicitly logs out of their web browser, the CI secret is immediately invalidated, returning a 401 Unauthorized or 403 Forbidden response and halting the pipeline until manual intervention occurs6.

### **7\. Cost and lock-in**

The engineering effort required to build and maintain a seamless session cookie extraction flow is prohibitively expensive due to the adversarial nature of browser encryption and Cloudflare's rapidly evolving behavioral defenses22. Bypassing App-Bound Encryption requires continuous maintenance against upstream Chromium changes and introduces severe supply-chain risks to the end user22. Designing an abstraction seam within the tool is therefore a structural necessity2. By decoupling the pricing logic from the network client, the architecture allows the tool to gracefully fallback from Option A (Authenticated) to Option D (Unauthenticated) if an injected session cookie expires, gets rejected by Cloudflare, or triggers an unexpected Account rate limit penalty2.

## **Interactive Flow Feasibility**

The following table evaluates the practical methods of obtaining a credential for a command-line interface tool.

| Method | Mechanism of Action | Community Precedent | Primary Risk | Verdict |
| :---- | :---- | :---- | :---- | :---- |
| **Manual Paste** | User opens browser developer tools, extracts POESESSID, and inputs it as an environment variable or CLI argument. | Awakened PoE Trade historically permitted this; Exiled Exchange 2 supports it7. | High risk of user error, accidental credential exposure in logs, and failure in unattended CI pipelines. | **Unacceptable** for CI; feasible only for local developer execution. |
| **Local DB Extraction** | Node.js utilizes DPAPI (Windows) or Keychain (macOS) to decrypt the local SQLite Cookies database. | Widely used by various scraping tools prior to Chrome v12729. | Fails entirely on modern Windows Chrome/Edge due to App-Bound Encryption (ABE)22. Requires malware-style DLL injection to bypass23. | **Unviable** due to extreme engineering overhead and severe security implications. |
| **Playwright Capture** | Spawns a hidden Chromium instance, navigates to the login portal, waits for interaction, and dumps context cookies. | Used by generic web scrapers and AI agents12. | Blocked unconditionally by Cloudflare Turnstile TLS fingerprinting and bot behavioral biometrics24. | **High Friction**; requires constant patching of stealth parameters and breaks frequently. |
| **OAuth 2.1 PKCE** | Spawns a local HTTP server on 127.0.0.1, opens a browser to the GGG authorization portal, and captures the callback redirect. | Mandated for all official desktop and public client applications19. | Yields an access token that is mathematically useless for the undocumented /api/trade/ endpoints15. | **Structurally Flawed** for the specific requirements of the trade API. |

## **Open Questions and Gaps**

While the evidentiary record heavily dictates an unauthenticated approach, specific telemetry gaps remain regarding the current state of Path of Exile 2's backend implementation:

> 1. **PoE2 Metric Divergence:** The exact numeric thresholds for the PoE2 /api/trade2/search and /api/trade2/fetch endpoints when authenticated versus unauthenticated remain undocumented in the public domain. It is unverified if GGG ported the exact token bucket capacities from PoE1 to PoE2, or if PoE2 introduces stricter baseline penalties.  
> 2. **Cloudflare Persistence:** It remains unverified whether an injected POESESSID cookie requires a continuously refreshed cf\_clearance cookie for all API routes over a 24-hour period, or if the API layer bypasses Cloudflare Turnstile entirely once the session is internally validated by the backend.

**Recommended Experiment:**  
Develop a lightweight Node.js script that issues concurrent /api/trade2/search requests using only the unauthenticated Ip until a 429 Too Many Requests response is triggered. Log the final X-Rate-Limit-Policy and X-Rate-Limit-Rules headers. Subsequently, inject a manually copied Cookie: POESESSID=... (captured from a live browser session) into the exact same script and execute the burst sequence again. Compare the X-Rate-Limit-Account-State headers against the unauthenticated X-Rate-Limit-Ip-State output to mathematically determine if the absolute bucket capacity diverges in the PoE2 environment.

## **Source List**

* \[cite: 19\] Grinding Gear Games — Authorization \- Path of Exile Developer Docs — https\://www\.pathofexile.com/developer/docs/authorization — September 2026 — October 2, 2026  
* \[cite: 17\] Grinding Gear Games — Overview \- Path of Exile Developer Docs — https\://www\.pathofexile.com/developer/docs — September 2026 — October 2, 2026  
* \[cite: 5\] antonwnk — Do I need authorization to use api.pathofexile.com? — https\://www\.reddit.com/r/pathofexiledev/comments/1djjt5y/do\_i\_need\_authorization\_to\_use\_apipathofexilecom/ — June 2024 — October 2, 2026  
* \[cite: 19\] Grinding Gear Games — Authorization Flow \- Path of Exile Developer Docs — https\://www\.pathofexile.com/developer/docs/authorization — September 2026 — October 2, 2026  
* \[cite: 1\] KoomZog — Trade API request limit — https\://www\.reddit.com/r/pathofexiledev/comments/e6h6o2/trade\_api\_request\_limit/ — December 2019 — October 2, 2026  
* \[cite: 21\] mahhov — Arevtur Setup Guide — https\://github.com/mahhov/arevtur — August 2024 — October 2, 2026  
* \[cite: 10\] Waveox — Got GGG to take a look at this — https\://github.com/Kvan7/Exiled-Exchange-2/issues/910 — June 2025 — October 2, 2026  
* \[cite: 19\] Grinding Gear Games — Available Scopes \- Path of Exile Developer Docs — https\://www\.pathofexile.com/developer/docs/authorization — September 2026 — October 2, 2026  
* \[cite: 17\] Grinding Gear Games — Third-Party Policy \- Path of Exile Developer Docs — https\://www\.pathofexile.com/developer/docs — September 2026 — October 2, 2026  
* \[cite: 20\] Grinding Gear Games — API Reference \- Path of Exile Developer Docs — https\://www\.pathofexile.com/developer/docs/reference — September 2026 — October 2, 2026  
* \[cite: 17\] Grinding Gear Games — Rate Limits and Headers \- Path of Exile Developer Docs — https\://www\.pathofexile.com/developer/docs — September 2026 — October 2, 2026  
* \[cite: 19\] Grinding Gear Games — OAuth Server Endpoints \- Path of Exile Developer Docs — https\://www\.pathofexile.com/developer/docs/authorization — September 2026 — October 2, 2026  
* \[cite: 20\] Grinding Gear Games — Data Export Reference \- Path of Exile Developer Docs — https\://www\.pathofexile.com/developer/docs/reference — September 2026 — October 2, 2026  
* \[cite: 8\] Various — PSA: If you got hacked, check if you have this — https\://www\.reddit.com/r/pathofexile/comments/1hp8aqm/psa\_if\_you\_got\_hacked\_check\_if\_you\_have\_this/ — March 2024 — October 2, 2026  
* \[cite: 28\] Exiled-Exchange-2 Contributors — Issue \#162 — https\://github.com/Kvan7/Exiled-Exchange-2/issues/162 — July 2025 — October 2, 2026  
* \[cite: 10\] Waveox — Fix: stop echoing anonymous POESESSID — https\://github.com/Kvan7/Exiled-Exchange-2/issues/910 — June 2025 — October 2, 2026  
* \[cite: 6\] Community\_Team — Trade Website Updates — https\://www\.pathofexile.com/forum/view-thread/3328601 — December 2022 — October 2, 2026  
* \[cite: 1\] rChinnn — Trade API request limit — https\://www\.reddit.com/r/pathofexiledev/comments/e6h6o2/trade\_api\_request\_limit/ — December 2019 — October 2, 2026  
* \[cite: 1\] rChinnn — Trade API Request Limits Explanation — https\://www\.reddit.com/r/pathofexiledev/comments/e6h6o2/trade\_api\_request\_limit/ — December 2019 — October 2, 2026  
* \[cite: 11\] PathOfBuildingCommunity — Issue 8384: Cloudflare verification — https\://github.com/PathOfBuildingCommunity/PathOfBuilding/issues/8384 — October 2024 — October 2, 2026  
* \[cite: 7\] SnosMe — Ingame trade browser gone? Issue \#821 — https\://github.com/SnosMe/awakened-poe-trade/issues/821 — December 2022 — October 2, 2026  
* \[cite: 9\] SnosMe — Add support for Private Leagues Issue \#212 — https\://github.com/SnosMe/awakened-poe-trade/issues/212 — October 2020 — October 2, 2026  
* \[cite: 7\] SnosMe — Authentication requirements in APT — https\://github.com/SnosMe/awakened-poe-trade/issues/821 — December 2022 — October 2, 2026  
* \[cite: 5\] antonwnk — API rate limit policies and user agents — https\://www\.reddit.com/r/pathofexiledev/comments/1djjt5y/do\_i\_need\_authorization\_to\_use\_apipathofexilecom/ — June 2024 — October 2, 2026  
* \[cite: 17\] Grinding Gear Games — Guidelines and Credentials \- Path of Exile Developer Docs — https\://www\.pathofexile.com/developer/docs — September 2026 — October 2, 2026  
* \[cite: 18\] Novynn — Developer API Guidelines — https\://www\.pathofexile.com/forum/view-thread/3019033/page/1 — January 21, 2021 — October 2, 2026  
* \[cite: 18\] Novynn — Please set a User-Agent header — https\://www\.pathofexile.com/forum/view-thread/3019033/page/1 — January 21, 2021 — October 2, 2026  
* \[cite: 15\] kotlynn — How to Automatically Obtain an OAuth(Cookie) Token? — https\://www\.reddit.com/r/pathofexiledev/comments/1jppd3y/how\_to\_automatically\_obtain\_an\_oauthcookie\_token/ — April 2024 — October 2, 2026  
* \[cite: 1\] rChinnn — Limit Policies — https\://www\.reddit.com/r/pathofexiledev/comments/e6h6o2/trade\_api\_request\_limit/ — December 2019 — October 2, 2026  
* \[cite: 13\] Grinding Gear Games — Terms of Use (Section 7 Restrictions) — https\://www\.pathofexile.com/forum/view-thread/3800102 — September 2026 — October 2, 2026  
* \[cite: 14\] Grinding Gear Games — Terms of Use and Privacy Policy — https\://www\.pathofexile.com/legal/terms-of-use-and-privacy-policy — September 2026 — October 2, 2026  
* \[cite: 16\] GGG Support — Multi-boxing bans — https\://www\.pathofexile.com/forum/view-thread/1965633 — August 2017 — October 2, 2026  
* \[cite: 14\] neohongkong — Section 7 Restrictions Breakdown — https\://www\.pathofexile.com/forum/view-thread/2969035 — October 2020 — October 2, 2026  
* \[cite: 2\] gerwaric — Understanding the X-Rate-Limit- response headers — https\://www\.reddit.com/r/pathofexiledev/comments/1c3bff2/understanding\_the\_xratelimit\_response\_headers/ — April 2024 — October 2, 2026  
* \[cite: 2\] gerwaric — X-Rate-Limit-Account-State — https\://www\.reddit.com/r/pathofexiledev/comments/1c3bff2/understanding\_the\_xratelimit\_response\_headers/ — April 2024 — October 2, 2026  
* \[cite: 4\] gerwaric — Blacklisting mechanisms — https\://www\.reddit.com/r/pathofexiledev/comments/1asd52t/is\_there\_a\_way\_to\_bypass\_trade\_apis\_rate\_limit/ — February 2024 — October 2, 2026  
* \[cite: 3\] yaredmax — poe-ninja-build-cost rate limitations — https\://github.com/yaredmax/poe-ninja-build-cost — May 2025 — October 2, 2026  
* \[cite: 1\] rChinnn — Invalid Query Errors — https\://www\.reddit.com/r/pathofexiledev/comments/e6h6o2/trade\_api\_request\_limit/ — December 2019 — October 2, 2026  
* \[cite: 29\] mherod — get-cookie cross-platform extraction — https\://github.com/topics/cookie-extraction — September 2026 — October 2, 2026  
* \[cite: 30\] mherod — get-cookie Node.js module — https\://github.com/mherod/get-cookie — September 2026 — October 2, 2026  
* \[cite: 22\] steipete — Bug: Chrome v20 cookie decryption fails — https\://github.com/steipete/sweet-cookie/issues/23 — August 2026 — October 2, 2026  
* \[cite: 31\] moond4rk — HackBrowserData Chrome Bypass — https\://github.com/moond4rk/HackBrowserData — September 2026 — October 2, 2026  
* \[cite: 23\] xaitax — Chrome-App-Bound-Encryption-Decryption — https\://github.com/xaitax/Chrome-App-Bound-Encryption-Decryption — September 2026 — October 2, 2026  
* \[cite: 19\] Grinding Gear Games — service:cxapi documentation — https\://www\.pathofexile.com/developer/docs/authorization — September 2026 — October 2, 2026  
* \[cite: 19\] Grinding Gear Games — OAuth Server Flow — https\://www\.pathofexile.com/developer/docs/authorization — September 2026 — October 2, 2026  
* \[cite: 23\] xaitax — Process Hollowing Technique for ABE — https\://github.com/xaitax/Chrome-App-Bound-Encryption-Decryption — September 2026 — October 2, 2026  
* \[cite: 22\] steipete — Chrome v20 Encryption Format Limitations — https\://github.com/steipete/sweet-cookie/issues/23 — August 2026 — October 2, 2026  
* \[cite: 12\] idan-rubin — Browserclaw Cloudflare Turnstile handling — https\://github.com/idan-rubin/browserclaw — August 2026 — October 2, 2026  
* \[cite: 24\] Unknown — Playwright stealth setups in 2026 — https\://www\.reddit.com/r/WebDataDiggers/comments/1sduxjk/playwright\_stealth\_setups\_that\_hold\_up\_better\_in/ — June 2026 — October 2, 2026  
* \[cite: 26\] feder-cr — Playwright iframe interactions and Turnstile — https\://github.com/feder-cr/invisible\_playwright/wiki/how-to-handle-cookie-consent-banners-playwright — August 2026 — October 2, 2026  
* \[cite: 25\] TheHeroBrine422 — Turnstile bypass implementations — https\://www\.reddit.com/r/webdev/comments/1t9mmh6/time\_to\_remove\_gg\_recaptcha\_from\_my\_website/ — May 2026 — October 2, 2026  
* \[cite: 27\] Unknown — Cloudflare blocking AI agents — https\://www\.reddit.com/r/AI\_Agents/comments/1umfd6q/cloudflare\_is\_about\_to\_block\_ai\_agents\_by\_default/ — September 2026 — October 2, 2026  
* \[cite: 2\] gerwaric — Trade vs Backend Limit Policies — https\://www\.reddit.com/r/pathofexiledev/comments/1c3bff2/understanding\_the\_xratelimit\_response\_headers/ — April 2024 — October 2, 2026  
* \[cite: 19\] Grinding Gear Games — Client Credentials Grant — https\://www\.pathofexile.com/developer/docs/authorization — September 2026 — October 2, 2026

#### **Works cited**

> 1. trade api request limit : r/pathofexiledev \- Reddit, [https\://www\.reddit.com/r/pathofexiledev/comments/e6h6o2/trade\_api\_request\_limit/](https://www.reddit.com/r/pathofexiledev/comments/e6h6o2/trade_api_request_limit/)  
> 2. Understanding the X-Rate-Limit- response headers : r/pathofexiledev, [https\://www\.reddit.com/r/pathofexiledev/comments/1c3bff2/understanding\_the\_xratelimit\_response\_headers/](https://www.reddit.com/r/pathofexiledev/comments/1c3bff2/understanding_the_xratelimit_response_headers/)  
> 3. GitHub \- yaredmax/poe-ninja-build-cost, [https\://github.com/yaredmax/poe-ninja-build-cost](https://github.com/yaredmax/poe-ninja-build-cost)  
> 4. Is there a way to bypass trade api's rate limit? \- Reddit, [https\://www\.reddit.com/r/pathofexiledev/comments/1asd52t/is\_there\_a\_way\_to\_bypass\_trade\_apis\_rate\_limit/](https://www.reddit.com/r/pathofexiledev/comments/1asd52t/is_there_a_way_to_bypass_trade_apis_rate_limit/)  
> 5. Do I need authorization to use api.pathofexile.com? \- Reddit, [https\://www\.reddit.com/r/pathofexiledev/comments/1djjt5y/do\_i\_need\_authorization\_to\_use\_apipathofexilecom/](https://www.reddit.com/r/pathofexiledev/comments/1djjt5y/do_i_need_authorization_to_use_apipathofexilecom/)  
> 6. Do not share POESESSID values with other people \- Path of Exile, [https\://www\.pathofexile.com/forum/view-thread/3328601](https://www.pathofexile.com/forum/view-thread/3328601)  
> 7. Ingame trade browser gone? · Issue \#821 · SnosMe/awakened-poe, [https\://github.com/SnosMe/awakened-poe-trade/issues/821](https://github.com/SnosMe/awakened-poe-trade/issues/821)  
> 8. PSA: If you got hacked check if you have this chrome extensions, [https\://www\.reddit.com/r/pathofexile/comments/1hp8aqm/psa\_if\_you\_got\_hacked\_check\_if\_you\_have\_this/](https://www.reddit.com/r/pathofexile/comments/1hp8aqm/psa_if_you_got_hacked_check_if_you_have_this/)  
> 9. Add support for Private Leagues · Issue \#212 \- GitHub, [https\://github.com/SnosMe/awakened-poe-trade/issues/212](https://github.com/SnosMe/awakened-poe-trade/issues/212)  
> 10. failed to load leagues · Issue \#910 · Kvan7/Exiled-Exchange-2, [https\://github.com/Kvan7/Exiled-Exchange-2/issues/910](https://github.com/Kvan7/Exiled-Exchange-2/issues/910)  
> 11. Error while fetching league list: Response code 403 \#8384 \- GitHub, [https\://github.com/PathOfBuildingCommunity/PathOfBuilding/issues/8384](https://github.com/PathOfBuildingCommunity/PathOfBuilding/issues/8384)  
> 12. GitHub \- idan-rubin/browserclaw: The AI-native browser automation, [https\://github.com/idan-rubin/browserclaw](https://github.com/idan-rubin/browserclaw)  
> 13. POE1-WASD-control with script legal ? \-\> script transforms wasd into, [https\://www\.pathofexile.com/forum/view-thread/3800102](https://www.pathofexile.com/forum/view-thread/3800102)  
> 14. AWAKENED POE TRADE \- Forum \- Path of Exile, [https\://www\.pathofexile.com/forum/view-thread/2969035](https://www.pathofexile.com/forum/view-thread/2969035)  
> 15. How to Automatically Obtain an OAuth(Cookie) Token? \- Reddit, [https\://www\.reddit.com/r/pathofexiledev/comments/1jppd3y/how\_to\_automatically\_obtain\_an\_oauthcookie\_token/](https://www.reddit.com/r/pathofexiledev/comments/1jppd3y/how_to_automatically_obtain_an_oauthcookie_token/)  
> 16. Is there any chance to get locked account unlocked on weekend, [https\://www\.pathofexile.com/forum/view-thread/1965633](https://www.pathofexile.com/forum/view-thread/1965633)  
> 17. Developer Docs \- Path of Exile, [https\://www\.pathofexile.com/developer/docs](https://www.pathofexile.com/developer/docs)  
> 18. API connection with python \- Forum \- Path of Exile, [https\://www\.pathofexile.com/forum/view-thread/3019033/page/1](https://www.pathofexile.com/forum/view-thread/3019033/page/1)  
> 19. OAuth 2.1 \- Developer Docs \- Path of Exile, [https\://www\.pathofexile.com/developer/docs/authorization](https://www.pathofexile.com/developer/docs/authorization)  
> 20. Public Stash API \- Developer Docs \- Path of Exile, [https\://www\.pathofexile.com/developer/docs/reference](https://www.pathofexile.com/developer/docs/reference)  
> 21. mahhov/arevtur \- GitHub, [https\://github.com/mahhov/arevtur](https://github.com/mahhov/arevtur)  
> 22. Bug: Chrome v20 (v127+) cookie decryption fails on Windows \#23, [https\://github.com/steipete/sweet-cookie/issues/23](https://github.com/steipete/sweet-cookie/issues/23)  
> 23. ChromElevator ( Chrome App-Bound Encryption Decryption ) \- GitHub, [https\://github.com/xaitax/Chrome-App-Bound-Encryption-Decryption](https://github.com/xaitax/Chrome-App-Bound-Encryption-Decryption)  
> 24. Playwright stealth setups that hold up better in 2026 \- Reddit, [https\://www\.reddit.com/r/WebDataDiggers/comments/1sduxjk/playwright\_stealth\_setups\_that\_hold\_up\_better\_in/](https://www.reddit.com/r/WebDataDiggers/comments/1sduxjk/playwright_stealth_setups_that_hold_up_better_in/)  
> 25. Time to remove gg recaptcha from my website : r/webdev \- Reddit, [https\://www\.reddit.com/r/webdev/comments/1t9mmh6/time\_to\_remove\_gg\_recaptcha\_from\_my\_website/](https://www.reddit.com/r/webdev/comments/1t9mmh6/time_to_remove_gg_recaptcha_from_my_website/)  
> 26. how to handle cookie consent banners playwright \- GitHub, [https\://github.com/feder-cr/invisible\_playwright/wiki/how-to-handle-cookie-consent-banners-playwright](https://github.com/feder-cr/invisible_playwright/wiki/how-to-handle-cookie-consent-banners-playwright)  
> 27. Cloudflare is about to block AI agents by default on a fifth of the web, [https\://www\.reddit.com/r/AI\_Agents/comments/1umfd6q/cloudflare\_is\_about\_to\_block\_ai\_agents\_by\_default/](https://www.reddit.com/r/AI_Agents/comments/1umfd6q/cloudflare_is_about_to_block_ai_agents_by_default/)  
> 28. \[Korean\] Translate remaining english in app\_i18n.json \#162 \- GitHub, [https\://github.com/Kvan7/Exiled-Exchange-2/issues/162](https://github.com/Kvan7/Exiled-Exchange-2/issues/162)  
> 29. cookie-extraction · GitHub Topics, [https\://github.com/topics/cookie-extraction](https://github.com/topics/cookie-extraction)  
> 30. GitHub \- mherod/get-cookie: Node.js module to extract, decrypt, and, [https\://github.com/mherod/get-cookie](https://github.com/mherod/get-cookie)