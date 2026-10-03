# Verify: community evidence (V3, V5, V6, V7, tool handling)

Verifier run 2026-10-02. Web tools only. All URLs were accessed on 2026-10-02 unless the bullet says "NOT FETCHED".
Fetch limits in this run: reddit.com, old.reddit.com and two Reddit mirrors refused the connection. Both Reddit sources named in the brief are therefore unverified at first hand. GitHub code search needs authentication, so this run read repository files through raw.githubusercontent.com and the public git-tree API.

Game tags: PoE1 = `/api/trade`, PoE2 = `/api/trade2`, Both = the site or tool serves both games, n/a = not game-specific.

---

## V3. Does a POESESSID change the trade rate limit?

**Status: partly verified, numbers unverified.** A GGG staff statement from 2018 says that a session moves the search policy to an account rule with the same limits, and that the IP rule then allows twice as many requests. This run found no captured `X-Rate-Limit-Account` header values, with or without a session, for PoE1 or PoE2. The 2019 Reddit claim (Ip 12/6s against 4/6s per POESESSID for fetch) could not be fetched. It is unverified, and it conflicts in direction with the 2018 staff statement for the search policy.

Evidence:
- **GGG staff, PoE1, 2018.** Novynn (GGG web developer), forum thread "PoE Trade API Questions", post dated 2018-01-29. https://www.pathofexile.com/forum/view-thread/2079853 (publisher GGG forum; accessed 2026-10-02). Quoted via fetch: "logging in will rate-limit you based on your account instead of your IP (with the same limits) and the rate-limit based on your IP will allow double the requests per interval." The example rule in that post is `20:5:60`. This applies to the trade search policy in 2018. It does not say whether the Account rule is sent in addition to Ip or in place of it.
- **Community capture, PoE1, 2021.** Verdale (player), forum thread "API rate limit for trade searches", post dated 2021-02-24. https://www.pathofexile.com/forum/view-thread/3056323 (GGG forum; accessed 2026-10-02). IP-based state values as posted: search `5/12s, 15/62s, 30/302s`; exchange `5/17s, 10/92s, 30/302s`; fetch `12/6s, 16/14s`. A different player in the thread says that a login raises the limit, but gives no numbers. These are unauthenticated (Ip) figures only.
- **Official docs, n/a (current).** GGG Developer Docs. https://www.pathofexile.com/developer/docs (accessed 2026-10-02). `X-Rate-Limit-Rules` lists rules such as `ip`, `account`, `client`. The format is `max_hits:period:restriction`. The docs give `Retry-After` and say the limits are dynamic. The docs do not cover the trade site endpoints.
- **Tool code, PoE1, current.** SnosMe/awakened-poe-trade `renderer/src/web/price-check/trade/common.ts` (master; accessed 2026-10-02). https://raw.githubusercontent.com/SnosMe/awakened-poe-trade/master/renderer/src/web/price-check/trade/common.ts. The client defaults to 1 request per 5 s for SEARCH, EXCHANGE and FETCH. It then reads `x-rate-limit-rules` and every `x-rate-limit-<rule>` and `-state` header that the rules header names. The code is not specific to `ip` or `account`.
- **Reddit 2019 claim, PoE1.** https://www.reddit.com/r/pathofexiledev/comments/e6h6o2/trade_api_request_limit/ — NOT FETCHED (Reddit blocked). The claim is unverified.
- **PoE2 trade2.** Searches in this run (for example `"api/trade2" "x-rate-limit"` and `"trade2" "X-Rate-Limit-Rules" "Account"`) returned no header captures. No PoE2 evidence was found.

Notes:
- The only first-hand statement (2018, PoE1, search policy) says that the account limit equals the old IP limit and the IP limit doubles. This makes authentication neutral-to-positive for a single user. A user does not get a larger budget than one account allows.
- The direction of the 2019 Reddit claim (Account 4/6s is lower than Ip 12/6s for fetch) would mean that a session could *reduce* fetch throughput. This run cannot confirm or deny it. Treat it as an open item, and capture headers directly with and without a cookie before the decision.
- Limits are dynamic per the official docs. Any number from 2018–2021 can be out of date.

---

## V5. Was "Acquisition" blacklisted server-side in 2023 for rate-limit violations caused by poor Retry-After handling?

**Status: partly verified, with corrections.** GGG did block Acquisition **v0.9.7** in 2023 for rate-limit violations (the maintainer's own release notes say so). Corrections to the claim as stated: (a) the block was on that version, which affected every user of v0.9.7. The evidence does not say "all users of the tool forever". (b) The cause "poor Retry-After handling" is not stated in any source fetched. The fix was "dynamic rate limiting based on HTTP reply headers". (c) Acquisition calls the stash/character APIs, not the trade search API.

Evidence:
- **Maintainer, PoE1.** gerwaric/acquisition, release v0.9.9, dated October 27 (2023, from the release-list ordering: v0.9.10 is 2023-11-01). https://github.com/gerwaric/acquisition/releases/tag/v0.9.9 (GitHub; accessed 2026-10-02). Text: "This is the first release of Acquisition since GGG blocked v0.9.7 for rate-limit violations in 2023." The new feature is "dynamic rate limiting based on HTTP reply headers".
- **Maintainer, PoE1.** gerwaric/acquisition release list. https://github.com/gerwaric/acquisition/releases?page=3 (accessed 2026-10-02). v0.15.0 (2024-12-22): "OAuth login now required (POESESSID still needed for forum shops)." The tool moved to OAuth for the documented APIs and kept POESESSID only for an undocumented website function.
- **Reddit source in the claim.** https://www.reddit.com/r/pathofexiledev/comments/1c3bff2/understanding_the_xratelimit_response_headers/ — NOT FETCHED (Reddit blocked).
- **GGG policy, n/a.** https://www.pathofexile.com/developer/docs (accessed 2026-10-02): "Exceeding these limits frequently will result in your application access being revoked." https://www.pathofexile.com/developer/docs/index (accessed 2026-10-02): "Applications (and users) that make too many invalid requests in a short period of time will be restricted from further access to our service." The same page also says: "Requests for access to any other internal website APIs or in-game resources will be denied. It is against our Terms of Use (section 7i) to reverse-engineer endpoints outside of this documentation." And: "Introducing features against these guidelines or our Terms of Use can result in account termination for you as well as your users."

Other documented bans or restrictions:
- **GGG support, PoE2 (EE2).** Kvan7/Exiled-Exchange-2 issue #646, opened 2025-09-08 by dkasupremo. https://github.com/Kvan7/Exiled-Exchange-2/issues/646 (accessed 2026-10-02). EE2 got `net::ERR_NETWORK_ACCESS_DENIED` on www.pathofexile.com. The user quotes a GGG support reply: "You may be connecting to our website using IP addresses that are flagged by our system (matching previously banned accounts)." This is an IP-level block. The quote does not say the cause was automation.
- **GGG staff, PoE1, 2026.** Sameer_GGG, forum thread "Rate-limiting is active for your account", 2026-08-12. https://www.pathofexile.com/forum/view-thread/3996346 (accessed 2026-10-02): "rate-limiting will consider any third-party tools such as the one you mention, and in-game search, and trade website utilisation. It all hits the same API." The tool in that thread is Awakened PoE Trade. The restriction was a temporary rate-limit lockout, not a ban.
- **Player thread, PoE1, 2022.** Thread "Your connection has been restricted", 2022-05-25. https://www.pathofexile.com/forum/view-thread/3274269 (accessed 2026-10-02). Will_GGG replied by PM only. A community answer attributes the restriction to IP-level spamming of the backend APIs by extensions or third-party tools.
- **Player thread, PoE1, 2021.** https://www.pathofexile.com/forum/view-thread/3056323. One poster reports a lockout of about 20 minutes. Another says 15–30 minutes.

---

## V6. Does Chrome 127+ App-Bound Encryption stop third-party programs from decrypting Chrome (and Edge) cookies on Windows?

**Status: verified, with limits.** ABE stops a normal program that runs as the same user from decrypting Chrome cookies through DPAPI. It does not stop code that runs with SYSTEM privileges or code that is injected into the browser process. Edge also uses ABE (independent sources; Google's post does not mention Edge). There is no official API for an outside program to read the cookies. Chrome 136 also closed the remote-debugging route on the default profile.

Evidence:
- **Google, n/a (Windows).** Will Harris, Chrome Security Team, "Improving the security of Chrome cookies on Windows", Google Online Security Blog, 2024-07-30. https://security.googleblog.com/2024/07/improving-security-of-chrome-cookies-on.html?m=1 (accessed 2026-10-02; the non-`?m=1` URL returned only navigation). The post says that Chrome 127 can encrypt data tied to app identity, and that a privileged service checks the identity. Another app that tries to decrypt fails. Attackers with system privileges can bypass it. The `ApplicationBoundEncryptionEnabled` policy exists for roaming profiles. The post says the protection will extend to passwords and payment data later.
- **Independent, n/a.** Sergiu Gatlan, BleepingComputer, 2024-07-30. https://www.bleepingcomputer.com/news/security/google-chrome-adds-app-bound-encryption-to-block-infostealer-malware/ (accessed 2026-10-02). The service runs as SYSTEM. A bypass needs SYSTEM privileges or code injection into Chrome.
- **Independent, 2026 state.** Oleg Afonin, ElcomSoft blog, 2026-01-13. https://blog.elcomsoft.com/2026/01/browser-forensics-in-2026-app-bound-encryption-and-live-triage/ (accessed 2026-10-02): "a third-party forensic tool running as the user cannot successfully ask the OS to decrypt the data." The post lists Chrome 127+, Edge 127+ and other Chromium browsers. Firefox is not affected. Offline extraction no longer works.
- **Bypass research, 2026.** xaitax/Chrome-App-Bound-Encryption-Decryption README (GitHub; accessed 2026-10-02). https://github.com/xaitax/Chrome-App-Bound-Encryption-Decryption. Tested on Chrome 144, Edge 145 and Brave 1.86. The tool injects into the browser process without admin rights. Chrome 144+ uses a new `IElevator2` COM interface. This shows that only malware-style injection still reads the cookies. A legitimate tool must not do this.
- **Google, n/a.** "Changes to remote debugging switches to improve security", Chrome for Developers blog, 2025-03-17. https://developer.chrome.com/blog/remote-debugging-port (seen in search results this run; page not fetched). From Chrome 136, `--remote-debugging-port` and `--remote-debugging-pipe` are ignored for the default user-data directory. Google cites cookie theft after ABE as the reason.

Notes: The only sanctioned ways to get a cookie value are (1) the user copies POESESSID by hand from DevTools, (2) a browser extension that uses the `cookies` permission (this run did not verify it against docs), or (3) the tool hosts its own login window (Electron or WebView) and keeps the cookie jar it owns. That last way is how APT and EE2 work (see below).

---

## V7. Do Cloudflare challenges on pathofexile.com block tools, and is a cf_clearance cookie needed alongside POESESSID?

**Status: verified that Cloudflare blocks tools at times. Partly verified that cf_clearance is needed. PoB #8384 is not evidence of Cloudflare.** Cloudflare bot checks on pathofexile.com do break tools at times, mostly when an IP gets flagged and around league launch. Tool makers handle this by sending requests through a browser context that can solve the challenge. One tool documents cf_clearance as an optional cookie. No source says that cf_clearance is always required.

Evidence:
- **PoB issue cited in the brief, PoE1.** PathOfBuildingCommunity/PathOfBuilding #8384, "Error while fetching league list: Response code 403", opened 2024-12-20 by kornuolis2, closed. https://github.com/PathOfBuildingCommunity/PathOfBuilding/issues/8384 (accessed 2026-10-02). The visible content does not name Cloudflare, cf_clearance or POESESSID. The workaround was to delete two cached files, which also means you must enter the username and session ID again. The page did not show the comments or how it was closed. This issue does **not** prove that Cloudflare caused the error.
- **APT docs, PoE1.** "Failed to load leagues", SnosMe Awakened PoE Trade docs (undated page; accessed 2026-10-02). https://snosme.github.io/awakened-poe-trade/failed-load-leagues.html. The page says the failure is "most likely" because Cloudflare bot protection flags the user. Permanent fix: "change the IP address or write to GGG support". Temporary fix: "complete a CAPTCHA every ~15 minutes" through the Browser button of the app, then Retry.
- **APT source, PoE1.** `main/src/proxy.ts` (master; accessed 2026-10-02). https://raw.githubusercontent.com/SnosMe/awakened-poe-trade/master/main/src/proxy.ts. The proxy uses `useSessionCookies: true`. It strips the `Partitioned` attribute from Set-Cookie with this comment: "Cloudflare sets cookies with Partitioned attribute, however `net.request` API doesn't provide a way to specify partition key, so we simply remove it." This is so that Cloudflare cookies (cf_clearance and similar) persist in the Electron session.
- **EE2 source, PoE2.** Kvan7/Exiled-Exchange-2 `main/src/proxy.ts` (master; accessed 2026-10-02). https://raw.githubusercontent.com/Kvan7/Exiled-Exchange-2/master/main/src/proxy.ts. It has the same Partitioned-strip workaround and the same Cloudflare comment, and it uses `useSessionCookies: true`.
- **Tool docs, Both.** POEFixer FixerWiki "Trade Cookies", edited 2026-09-29 by Lafko. https://github.com/POEFixer/FixerWiki/wiki/Trade-Cookies (accessed 2026-10-02). POESESSID is required. "You can include `cf_clearance` here if needed." It is optional.
- **Procurement, PoE1, 2020.** Procurement-PoE/Procurement #1113, opened 2020-06-13 by nomis51, closed. https://github.com/Procurement-PoE/Procurement/issues/1113 (accessed 2026-10-02). The `/login` page triggered Cloudflare. The proposed fix was to check POESESSID against `/my-account` and avoid `/login`.
- **Players, PoE2 and PoE1.** Thread "[Trade] Cloudflare broken integration" (PoE2 Early Access trading), 2024-12-18. https://www.pathofexile.com/forum/view-thread/3647344. Thread "Cloudflare Flagged again" (PoE1), 2023-10-14, names APT. https://www.pathofexile.com/forum/view-thread/3443101. Thread "Unable to access trade site, cloudflare issue" (PoE1), 2026-07-24 to 2026-09-16, about a Turnstile failure in Firefox fixed by an incognito window. https://www.pathofexile.com/forum/view-thread/3987579. All accessed 2026-10-02. None of the three has a GGG staff reply.

Notes: No source in this run says GGG has "fixed" Cloudflare for tools. The issue keeps coming back (2020, 2023, 2024, 2026). A tool that sends plain HTTP with only a pasted POESESSID cannot solve a challenge. A tool with an embedded browser session can solve one.

---

## How Awakened PoE Trade and Exiled Exchange 2 handle POESESSID

- **APT (PoE1, `/api/trade`).** No source file fetched this run names POESESSID. `pathofexile-trade.ts` calls `/api/trade/search` and `/api/trade/fetch` through `Host.proxy()` and sends only the Accept and Content-Type headers. https://raw.githubusercontent.com/SnosMe/awakened-poe-trade/master/renderer/src/web/price-check/trade/pathofexile-trade.ts (accessed 2026-10-02). Authentication and Cloudflare clearance come from the Electron default-session cookie jar (`useSessionCookies: true` in `main/src/proxy.ts`). The jar is filled when the user uses the in-app Browser window, according to the failed-load-leagues doc. The repo tree has no file named login or auth. Inference: APT does not ask for a pasted POESESSID. It stores cookies in its own Electron profile so that one browser context holds both the Cloudflare cookies and any login cookie. This run did not confirm whether APT has a "log in" flow in a released version.
- **EE2 (PoE2, `/api/trade2`).** It is a fork with the same proxy design (see V7). Its FAQ (`docs/faq.md`) does not mention POESESSID, login or Cloudflare. https://raw.githubusercontent.com/Kvan7/Exiled-Exchange-2/master/docs/faq.md (accessed 2026-10-02).
- **Contrast.** Path of Building asks for a username and session ID (PoB #8384 workaround text; also PoB #5316 "POESESSID is invalid", seen in search results this run and not fetched). Acquisition moved to OAuth in v0.15.0 (2024-12-22) and kept POESESSID only for forum shops.

---

## Other decision-relevant facts

- **OAuth has no trade scope.** GGG Developer Docs, authorization page. https://www.pathofexile.com/developer/docs/authorization (accessed 2026-10-02). Account scopes: `account:profile`, `leagues`, `stashes`, `characters`, `league_accounts`, `item_filter`. Service scopes (confidential clients only): `service:leagues`, `service:leagues:ladder`, `service:pvp_matches`, `service:pvp_matches:ladder`, `service:psapi`, `service:cxapi`. Public clients must use PKCE. Their tokens last 10 h (access) and 7 d (refresh). Confidential-client tokens last 28 d and 90 d. Result: OAuth cannot authorize `/api/trade` or `/api/trade2` search or fetch. "Official OAuth for higher trade limits" has no documented basis.
- **Trade endpoints are outside the documented API.** The docs/index policy denies access to "any other internal website APIs" and says reverse-engineering endpoints outside the docs is against ToS 7i. All trade tools (APT, EE2, PoB) use these endpoints anyway. GGG staff accept that tool traffic counts against the same limits (Sameer_GGG, 2026-08-12).
- **User-Agent.** The official docs require `User-Agent: OAuth {clientId}/{version} (contact: {contact})` for OAuth apps (https://www.pathofexile.com/developer/docs).
- **Low-reliability source, not used as evidence.** HivemindOverlord/poe2-mcp TRADE_AUTH_SETUP_GUIDE.md (raw GitHub; accessed 2026-10-02) says that trade2 searches return 401/403 without POESESSID, and that the cookie "only works for trade API requests". The second statement is doubtful, because POESESSID is the full website session cookie. Neither statement is corroborated.
