# Capture: trade2 rate-limit headers with and without POESESSID (V3)

First-hand capture, 2026-10-02, run by the project from one residential IP (Cloudflare edge AMS). This file is the primary evidence for the Deepen pass on V3. It is a measurement, not a published source.

## Method

- Client: Node.js built-in `fetch` (undici), plain HTTP, no browser, no Cloudflare cookies.
- `User-Agent`: a desktop Chrome string, `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36`. This is not the descriptive contact `User-Agent` that sync sends.
- Query: one saved search, chosen at random from the project's `data/dataset.json` (the `lastSearchId` of entry `["crafted","accessory.amulet","Amulets",82,["explicit.stat_1050105434",180,189],["explicit.stat_789117908",60,69]]`), decoded and sent with `sort: {price: "asc"}`. League `Forbidden Rites`, realm `poe2`.
- Sequence: `POST /api/trade2/search/poe2/Forbidden%20Rites`, wait 2 s, `GET /api/trade2/fetch/{10 ids}?query={id}&realm=poe2`. Wait 8 s. Repeat both with the header `Cookie: POESESSID=<one logged-in account's value>`. Four requests in total.
- The cookie value is not recorded here or anywhere in the run folder.

## Results

All four responses: HTTP 200, `server: cloudflare`. Search: 24 results in both runs (same search id). Fetch: 10 items in both runs.

Rule format: `hits:period_s:restriction_s`. State format: `hits:period_s:active_restriction_s`.

| Request | cf-ray | `X-Rate-Limit-Policy` | `-Rules` | `-Account` | `-Account-State` | `-Ip` | `-Ip-State` |
|---|---|---|---|---|---|---|---|
| Search, no cookie | `a446998b2d1b271b-AMS` | `trade-search-request-limit` | `Ip` | – | – | `5:10:60,15:60:300,30:300:1800,600:21600:3600` | `1:10:0,1:60:0,1:300:0,54:21600:0` |
| Fetch, no cookie | `a4469999aaf9271b-AMS` | `trade-fetch-request-limit` | `Ip` | – | – | `12:4:10,16:12:300,50:300:300,1000:21600:1800` | `1:4:0,1:12:0,1:300:0,50:21600:0` |
| Search, POESESSID | `a44699cd8db3ff2d-AMS` | `trade-search-request-limit` | `Account,Ip` | `3:5:60` | `1:5:0` | `8:10:60,15:60:120,60:300:1800,600:10800:3600` | `1:10:0,2:60:0,2:300:0,55:10800:0` |
| Fetch, POESESSID | `a44699dbe872ff2d-AMS` | `trade-fetch-request-limit` | `Account,Ip` | `6:4:10` | `1:4:0` | `12:4:60,16:12:60,100:300:300,1000:10800:1800` | `1:4:0,2:12:0,2:300:0,51:10800:0` |

Other observations:

- The no-cookie responses each carried `set-cookie: POESESSID=…` (a new anonymous session). The cookie responses carried no `set-cookie`.
- No response carried `cf-mitigated` or `Retry-After`, and no response was a Cloudflare challenge page.
- The no-cookie Ip values are identical to the project's own unauthenticated capture of 2026-09-12 (memlog, assumption line). The unauthenticated budget did not change in 20 days.

## Derived figures (arithmetic on the table above)

The binding limit is the minimum across every listed rule and window.

| Budget | No cookie | POESESSID | Change |
|---|---|---|---|
| Search, longest window | 600 per 6 h = 100/h | 600 per 3 h = 200/h | 2× |
| Search, 5-minute window | 30 | 60 | 2× |
| Search, 60 s window | 15 | 15 | same |
| Search, short burst | 5 per 10 s | 3 per 5 s (Account) and 8 per 10 s (Ip), so 6 per 10 s | about the same |
| Fetch, longest window | 1000 per 6 h ≈ 167/h | 1000 per 3 h ≈ 333/h | 2× |
| Fetch, 5-minute window | 50 | 100 | 2× |
| Fetch, short burst | 12 per 4 s | 6 per 4 s (Account) | half |
| Ip lockouts | search 60 s window: 300 s; fetch 12 s window: 300 s; fetch 4 s window: 10 s | 120 s; 60 s; 60 s | 2 shorter, 1 longer, 5 unchanged |

## Interpretation notes

- **One Ip counter, two limit sets.** The Ip state in the cookie run counts the earlier no-cookie requests (`2:60`, `2:300`). The session does not open a separate Ip bucket. It changes the Ip limits and adds an Account rule.
- **The Account rule is a burst cap only.** It has one short window per policy (5 s search, 4 s fetch). The sustained gain comes from the larger Ip limits, not from the Account rule.
- **The 2018 GGG statement [V3, Novynn] holds in direction for PoE2:** the Ip rule allows about double over the longer windows. Its "same limits" part does not match: the Account rule has different, smaller, short-window numbers.
- **The 2019 claim [V3, Reddit] "session fetch 4/6s vs Ip 12/6s"** does not match either. The measured session fetch Account rule is 6 per 4 s, and the Ip rule stays at 12 per 4 s.
- **Rule names agree with the limits** in this capture. The 2022 header-name bug [10] did not show.

## Limits of this evidence

- One sample from one IP and one account at one time. GGG says limits are dynamic.
- One browser `User-Agent`. The capture does not show whether the descriptive contact `User-Agent` gets the same limits or the same Cloudflare treatment.
- Four requests in about 15 s. This is not evidence about Cloudflare behaviour over a 24-hour schedule.
- The capture does not show whether the Account rule's numbers depend on the account (for example account age or supporter status).
