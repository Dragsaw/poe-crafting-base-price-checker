# Verify: GGG primary sources (OAuth, rate limits, ToU, POESESSID)

Accessed 2026-10-02 for all pages. Method: WebFetch (an extraction model returns the page content) and WebSearch. Quotes below are the exact strings that WebFetch returned when asked for verbatim text. WebFetch would not reproduce the full forum post (it declined on fair-use grounds), so only single sentences from that post are quoted. All target pages fetched successfully. None returned a Cloudflare block or a 403.

---

## V1. OAuth scopes and endpoints. No trade coverage.

- **Status:** verified, with an added detail (an `account:guild:stashes` scope appears on the reference page but not in the authorization scope table).
- **URLs:** https://www.pathofexile.com/developer/docs/authorization ; https://www.pathofexile.com/developer/docs/reference
- **Publisher:** Grinding Gear Games. **Page date:** not shown (footer "© 2010 - 2026 Grinding Gear Games").
- **Scopes listed on the authorization page:**
  - `account:profile`: "for access to the account's basic profile information"
  - `account:leagues`: "for viewing the account's available leagues"
  - `account:stashes`: "for viewing the account's stashes and items"
  - `account:characters`: "for viewing the account's characters and inventories"
  - `account:league_accounts`: "for viewing the account's allocated atlas passives"
  - `account:item_filter`: "for managing the account's item filters"
  - `service:leagues`: "for fetching leagues"
  - `service:leagues:ladder`: "for fetching league ladders"
  - `service:pvp_matches`: "for fetching PvP matches"
  - `service:pvp_matches:ladder`: "for fetching PvP match ladders"
  - `service:psapi`: "for access to the Public Stash API"
  - `service:cxapi`: "for access to the Currency Exchange API"
- **Endpoints on the reference page (scope; game):**
  - GET /profile (account:profile)
  - GET/POST /item-filter[/<id>] (account:item_filter). Accepts the poe2 realm.
  - GET /league, /league/<league> (service:leagues). Accepts the poe2 realm.
  - GET /league/<league>/ladder (service:leagues:ladder)
  - GET /league/<league>/event-ladder (PoE1 only)
  - GET /pvp-match[...] (PoE1 only)
  - GET /account/leagues[/<realm>] (account:leagues; PoE1 only)
  - GET /character[/<realm>][/<name>] (account:characters). Accepts the poe2 realm.
  - GET /stash[/<realm>]/<league>[...] (account:stashes; PoE1 only)
  - GET /league-account[/<realm>]/<league> (account:league_accounts; PoE1 only)
  - GET /guild[/<realm>]/stash/<league>[...] (account:guild:stashes; PoE1 only)
  - GET /public-stash-tabs[/<realm>] (service:psapi; PoE1 only)
  - GET https://web.poecdn.com/api/currency-exchange[/<realm>][/<id>]. The page says it is a public API with no authentication required ("aggregate Currency Exchange trade history across all leagues grouped into hourly digests"). Accepts the poe2 realm.
- **Quotes:** "NOTE: There are currently limited APIs that return PoE2 game information." Realm values: "pc (default), xbox, sony, or poe2".
- **Game scope:** PoE1 and PoE2. The PoE2 realm works only for item filters, leagues, characters and currency exchange.
- **Notes:** No scope and no documented endpoint covers trade search (`/api/trade[2]/search`) or trade fetch (`/api/trade[2]/fetch`). The only "trade" data is the aggregate history from Currency Exchange. The extractor's statement that the scope table has no `account:guild:stashes` row could be an extraction miss.

## V2. Client types, grants, token lifetimes, registration

- **Status:** partly verified, partly **overturned**. Public client with PKCE, the 127.0.0.1 redirect and the 10 h / 7 d lifetimes: verified. Registration "by email to oauth@grindinggear.com": **overturned for the current state.** The official docs now say "We are currently unable to process new applications." The docs give no email address, no approval time and no "we do not grant keys for…" wording.
- **URLs:** https://www.pathofexile.com/developer/docs/authorization ; https://www.pathofexile.com/developer/docs ; https://www.pathofexile.com/developer ; https://fr.pathofexile.com/developer/docs
- **Publisher:** GGG. **Page date:** not shown.
- **Quotes (authorization page):**
  - Confidential: "A confidential client is backend by a secure server controlled by the application owner." "May use any of the available grant types." "Any redirect URIs must point to a secure (HTTPS-enabled) URI with a registered domain controlled by the application owner. We cannot accept IP addresses or localhost domains even for in-development projects." "Have access tokens that last for 28 days and refresh tokens that last for 90 days."
  - Public: "A public client is one without a method of securely storing any credentials." "Must only use the Authorization Code (with PKCE) grant type and must use a local redirect URI (ie. http://127.0.0.1:8080/callback)." "Have access tokens that last for 10 hours and refresh tokens that last for 7 days."
  - PKCE: "Generate a code_verifier as described in RFC 7636 Section 4.1. There should be sufficient entropy (at least 32-bytes) used to ensure the resulting value cannot be guessed." "From this, create a code_challenge by base64url-encoding the SHA256 hash of the code_verifier."
  - client_credentials: only service scopes are allowed (`service:leagues`, `service:leagues:ladder`, `service:pvp_matches`, `service:pvp_matches:ladder`, `service:psapi`, `service:cxapi`). This is the extractor's list. No verbatim sentence was obtained.
- **Registration (docs index):** "We are currently unable to process new applications." "You can manage applications owned by your account by visiting the Manage applications link in your profile." The French mirror shows the same text and no email address.
- **Secondary only (not GGG):** the poedb.tw wiki (https://poedb.tw/API%3AOAuth) says "You set that up by contacting the `oauth@` email address with the details they desire". Search snippets attribute oauth@grindinggear.com to this wiki. This describes an earlier process. The current official page does not show it.
- **Game scope:** OAuth on pathofexile.com applies to both games. Its endpoints are as in V1.
- **Notes:** A new tool cannot get an OAuth client today. Even if it could, a client gives no trade scope.

## V3. Rate-limit headers, User-Agent, policy on undocumented endpoints

- **Status:** verified. The docs prohibit undocumented endpoints in general through ToU 7i. The docs make **no statement** that names the trade site or session cookies (unverified/absent).
- **URL:** https://www.pathofexile.com/developer/docs (also https://www.pathofexile.com/developer). **Publisher:** GGG. **Page date:** not shown.
- **Quotes:**
  - "In order to protect our services we employ the use of rate limits on the majority of our endpoints. These limits are dynamic and can change at any time depending on our requirements."
  - Headers: `X-Rate-Limit-Policy`, `X-Rate-Limit-Rules` (comma-delimited rules, e.g. ip, account, client), `X-Rate-Limit-{$rule}` ("A comma-delimited list of text representing the rule": max hits, period s, restriction s), `X-Rate-Limit-{$rule}-State` (current hits, period, active restriction), `Retry-After` ("Time to wait (in seconds) until the rate limit expires").
  - "Exceeding these limits frequently will result in your application access being revoked."
  - User-Agent: "User-Agent: OAuth {$clientId}/{$version} (contact: {$contact}) ..." Example: "User-Agent: OAuth mypoeapp/1.0.0 (contact: mypoeapp@gmail.com) SomeOptionalThingHere"
  - Notice: "This product isn't affiliated with or endorsed by Grinding Gear Games in any way."
  - **"It is against our Terms of Use (section 7i) to reverse-engineer endpoints outside of this documentation."**
  - "Don't share your account or application's credentials with anyone else. Don't include any application keys or credentials in your code." (from /developer)
  - Requests that fail with 4xx above a threshold cause access restrictions. Apps must make "reasonable attempts" to avoid them (from /developer, partial quote).
- **Game scope:** both games.
- **Notes:** The extractor said: "The document does not contain content about websites, trade, sessions, cookies, or scraping beyond general API guidance."

## V4. Terms of Use: automation, scraping, reverse engineering

- **Status:** verified.
- **URL:** https://www.pathofexile.com/legal/terms-of-use-and-privacy-policy. **Publisher:** GGG. **Page date:** "Last Updated: October 2024".
- **Quotes:**
  - Lead-in to §7: "Under no circumstances, without the prior written approval of Grinding Gear Games, may you:"
  - 7(c): "Utilise any automated software or 'bots' in relation to your access or use of the Website, Materials or Services."
  - 7(d): "Knowingly perform any actions that may cause the computers used to support the Website, Materials and Services (the 'Servers') to become overloaded or crash."
  - 7(e): "Connect to the Servers through any software other than the authorised game client software."
  - 7(f): "Use any data gathering and extraction tools or software to extract information from the Website or utilize framing techniques to enclose any of the contents of the Website."
  - 7(i): "Reverse engineer, de-compile or disassemble the Website, Materials or Services or seek to establish the technical processes, operations and communication protocols of the Website, Materials or Services through any means, including without limitation by reference to the input or output of the Website, Materials or Services or the internal structure and workings of the Website, Materials or Services."
  - §16: "You must keep all password and login information associated with your Member Account confidential and not disclose such information to any third-party or allow a third-party access to your Member Account without first obtaining Grinding Gear Games' written consent."
  - §17 (partial): GGG may "cancel your registration and access to your Member Account" or "restrict, limit or otherwise change your existing rights" ... "without prior notice or explanation."
- **Game scope:** all GGG services (the Website, Materials and Services), so both games.

## V8. POESESSID warnings

- **Status:** verified for the warning, for what the cookie grants and for invalidation by logout. **Unverified** for invalidation by password change: the post says nothing about it.
- **URL:** https://www.pathofexile.com/forum/view-thread/3328601. Title "Do not share POESESSID values with other people". **Publisher:** GGG, posted by Community_Team (staff). **Page date:** 14 Dec 2022 (shown as "December 14, 2022, 3:20:40 AM").
- **Quotes:**
  - "This cookie value gives the recipient almost complete access to your Path of Exile account on the website, enabling them to do almost any action including viewing personal information, spending your points, or posting on the forums as you."
  - "While sharing any login information with other people is specifically against Path of Exile's terms of use, we haven't yet proactively banned any users for sharing their POESESSID values."
  - "if you want to reset your POESESSID, just log out of the pathofexile.com website and back in again." (The extractor also returned "Any previous session cookies you gave out before will now be invalid.")
  - "The secure way of granting tools access to your data is via OAuth."
- **Game scope:** the pathofexile.com website account. Both games use one account.
- **Notes:** The post warns that third-party tools may be changed to harvest the credential and that local storage of it is often not secure (paraphrase from the extractor). It names tools that asked for POESESSID: Path of Building, Exilence Next, Acquisition, CurrencyCop and Chaos Recipe Enhancer (some names come from the comments).

---

## Other decision-relevant facts

1. **No new OAuth clients:** "We are currently unable to process new applications." (https://www.pathofexile.com/developer/docs). OAuth is not available to this project now, whatever the scope.
2. **The Currency Exchange API needs no auth and supports poe2:** GET https://web.poecdn.com/api/currency-exchange[/<realm>][/<id>] (reference page). It is a documented, sanctioned PoE2 price source for currency only, with hourly digests, not bases.
3. **The Public Stash API is PoE1 only** (reference page). Today no documented PoE2 item-listing stream exists.
4. **The trade data delay for non-whitelisted consumers** (Bex_GGG, 7 Dec 2017, https://pathofexile.com/forum/view-thread/2036957): "Our solution is to delay the item data by 60 seconds for everyone except certain whitelisted public sites." "If you're a developer of a public community tool who would like to unlock the undelayed data, please email us at contact@grindinggear.com." Later edit: "As of 3.11.0 the delay has been increased to 5 minutes (from 1 minute)." This is about the stash-tab feed (PoE1), not /api/trade.
5. **Rate-limit header behavior has had bugs** (Novynn, GGG, 20 Mar 2022, https://www.pathofexile.com/forum/view-thread/3257587). The policy header said "Account", but the limiting was per IP. Novynn: "This is indeed a bug and we'll get it fixed." Parse the headers, and do not trust the header name alone.
6. **Bottom line from the sources:** any programmatic call to /api/trade or /api/trade2 is an undocumented endpoint. The docs say use of one is "against our Terms of Use (section 7i)", and ToU 7(c) and 7(f) also apply. If a POESESSID is sent, §16 and the 2022 staff post also apply. GGG has said it "haven't yet proactively banned" users for sharing POESESSID (2022).
