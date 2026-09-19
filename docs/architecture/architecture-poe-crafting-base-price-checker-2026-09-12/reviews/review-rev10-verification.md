---
title: 'Verification review — spine rev 10'
type: architecture-review
lens: verification
status: final
created: '2026-09-19'
reviewer: 'verification reviewer (web-checked)'
targets:
  - ARCHITECTURE-SPINE.md (revision 10)
  - IMPLEMENTATION-NOTES.md (2026-09-19)
---

# Verification review — spine rev 10

**Question asked of the documents.** Was every committed decision web-researched or
reality-checked, or was some of it asserted from training data? Every claim below was
re-checked against a live source on **2026-09-19**. Where a claim could not be reached
from here, this review says so explicitly rather than passing it.

**Verdict.** The spine holds up unusually well. Every pinned version exists, every
structural claim about the `trade2` endpoints that can be reached by an unauthenticated
GET is confirmed exactly as written, both TypeScript 7 blockers still bind, and the
~six-month trade-search expiry — previously carried as an unsourced `[ASSUMPTION]` — is
confirmed by a GGG staff post. Two things need a change: one factual claim inside OQ-20 is
now contradicted by the live API, and five pins have drifted by a patch. Three claims
remain **unverifiable from here** and are named as such.

---

## 1. Stack table — version currency

All fetched from `registry.npmjs.org` and `nodejs.org/dist/index.json` on 2026-09-19.

| Pinned | Live latest | Verdict |
| --- | --- | --- |
| Node.js 24.21.0 (Krypton LTS) | v24.21.0 (2026-09-07) is the newest 24.x; codename **Krypton** confirmed | **Exact.** Node 26.9.0 is `current` and not LTS, so the 24.x pin is the right line. |
| TypeScript 6.0.3 | `6.0.4` returns **404**; `6.0.3` exists. `latest` = 7.0.2 | **Exact** — 6.0.3 is the head of the 6.x line. |
| pnpm 12.4.1 | **12.4.2** | Drift, one patch. |
| React 19.3.0 | 19.3.0 (`latest`) | **Exact.** |
| Vite 8.3.0 | 8.3.0 (`latest`), `engines: ^20.19.0 \|\| >=22.12.0` | **Exact**, and compatible with the Node pin. |
| Mantine 9.6.1 | 9.6.1 (`latest`); peers `react ^19.2.0`, `react-dom ^19.2.0`, `@mantine/hooks 9.6.1` | **Exact**, same major, peer satisfied by React 19.3.0. No flag — the pin is deliberate per project instruction, and it happens to also be current. |
| Zod 4.6.4 | **4.6.5** | Drift, one patch. |
| Vitest 5.0.0 | **5.0.1** | Drift, one patch. |
| MSW 2.15.0 | 2.15.0 (`latest`) | **Exact.** |
| ESLint 10.10.0 | **10.11.0** | Drift, one minor. |
| typescript-eslint 8.70.0 | 8.70.0 (`latest`); `canary` 8.70.1-alpha.27 | **Exact.** Peer `eslint: ^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0` — ESLint 10 is in range. |
| dependency-cruiser 18.3.0 | **18.3.1**; `engines: ^22\|\|^24\|\|>=26` | Drift, one patch. Node pin is in range. |

**Finding V-1 (LOW) — five pins are one release stale.** pnpm 12.4.2, Zod 4.6.5, Vitest
5.0.1, ESLint 10.11.0, dependency-cruiser 18.3.1. None is a major change and none breaks a
stated decision. Worth a single refresh pass before the first `pnpm install`, since a pre-code
spine's pins become a lockfile the moment anyone runs the install; leaving them stale means
the first commit's lockfile disagrees with the spine on day one.

**Nothing in the Stack table was asserted from training data and found wrong.** Every name
resolves and every version exists.

---

## 2. The TypeScript 7 upgrade trigger — both blockers still bind

The spine states two blockers, both "re-verified 2026-09-13". Re-checked today:

- **`typescript-eslint` peer-caps TypeScript.** `typescript-eslint@8.70.0` (the current
  `latest`) declares `peerDependencies.typescript: ">=4.8.4 <6.1.0"`. **Confirmed, still
  binding.** No published line lifts it: the only other dist-tags are `rc-v8`
  (`8.0.0-alpha.62`, older) and `canary` (`8.70.1-alpha.27`, same 8.70 line).
- **`dependency-cruiser` caps the transpiler.** Read out of the published package itself,
  not from a search result: `unpkg.com/dependency-cruiser@18.3.1/src/meta.cjs` declares
  `typescript: ">=2.0.0 <7.0.0"`. **Confirmed, still binding, and unchanged in 18.3.1** —
  so the patch drift in V-1 does not move the blocker either way.

**Finding V-2 (LOW, additive) — the trigger names the symptom, not the cause, and the cause
is now public.** Both caps have one upstream reason: TypeScript 7's native compiler does not
yet expose the programmatic API (`Strada`) that type-aware linting and AST tooling import,
and 7.1 is still in development (`next` = `7.1.0-dev.20260919.1`). typescript-eslint tracks
this as issue **#12518**. Microsoft also publishes `@typescript/typescript6`, a compatibility
package exposing a `tsc6` binary and the 6.0 API, which is the documented way to run 7.0's
compiler while tooling still needs the 6.0 API.

This matters to the spine's own argument. The trigger currently reads as *"wait for two
dependencies to bump"*, which invites an agent to check two version numbers periodically. The
real condition is *"wait for a TypeScript 7 API"*, which is one upstream event that clears both
caps at once and is observable in one place. Recommend the trigger cite issue #12518 as the
watch point, and explicitly **reject** the `@typescript/typescript6` shim if that is the
intent — otherwise a builder will find the shim, see that it unblocks `tsc`, and not notice it
leaves `dependency-cruiser` — AD-1's mechanical enforcement — running on the old API anyway.

---

## 3. Path of Exile 2 trade API claims

### 3.1 Confirmed exactly as written

- **`trade2` is undocumented by GGG.** Fetched `pathofexile.com/developer/docs/index`. The
  API Reference lists Server Endpoint, Account Profile, Account Item Filters, Leagues, PvP
  Matches, Account Leagues, Account Characters, Account Stashes, League Accounts, Guild
  Stashes, Public Stashes, Currency Exchange, Type Definitions, Extra Definitions. **No trade
  or `trade2` endpoint appears anywhere.** AD-8's recorded risk is accurate, not defensive
  hedging.

- **The rate-limit header scheme.** The developer docs describe, verbatim, `X-Rate-Limit-Policy`,
  `X-Rate-Limit-Rules`, `X-Rate-Limit-{$rule}`, `X-Rate-Limit-{$rule}-State` and `Retry-After`,
  with the `{$rule}` headers in **`hits:seconds:penalty`** form and `Rules` a comma-delimited
  list naming rules such as ip, account and client. Every element of AD-8 and
  IMPLEMENTATION-NOTES §5.3 — learn rule names at runtime from `Rules`, never enumerate them,
  parse policy and `-State` per name, `Policy` separates the buckets, honour `Retry-After` — is
  supported by the published documentation. The instruction *"never enumerate rule names"* is
  specifically vindicated: the docs name `client` as a rule the product would otherwise miss.

- **The endpoint shapes.** Four live unauthenticated GETs today, each matching AD-25's table:
  - `/api/trade2/data/stats` → `{result: [{id, label, entries: [{id, text, type}]}]}` —
    **category groups, not a flat list**, exactly as AD-25's "Verified 2026-09-12, re-checked
    2026-09-13" note states. Groups seen include `pseudo` and `explicit`.
  - `/api/trade2/data/static` → `{result: [{id, label, entries: [{id, text, image}]}]}` —
    currency ids, labels and icons, matching AD-24's split of display duties and its note that
    icons stay fetched but unconsumed.
  - `/api/trade2/data/items` → entries carry a **`type`** string holding the base type name
    (`"Crimson Amulet"`, `"Leather Vest"`, `"Iron Ring"`). Confirms the Consistency Conventions'
    rule that `baseTypeId` is `data/items`' `type` string verbatim.
  - `/api/trade2/data/filters` → confirms **trap 2 of IMPLEMENTATION-NOTES §5.2 exactly**:
    `sale_type` publishes `{id: "any"}`, `{id: null, text: "Buyout or Fixed Price"}`,
    `{id: "priced_with_info", text: "Price with Note"}`, `{id: "unpriced", text: "No Listed
    Price"}`. The `null` id and the *"Price with Note"* label are live facts, not recollection.

- **League ids carry spaces.** `/api/trade2/data/leagues` returns `Forbidden Rites`,
  `HC Forbidden Rites`, `Runes of Aldur`, `HC Runes of Aldur`, `Standard`, `Hardcore`, realm
  `poe2`. AD-24's percent-encoding rule and IMPLEMENTATION-NOTES §5.4's two example league
  names are both confirmed against the live endpoint, not quoted from memory.

- **Unauthenticated access, for the data endpoints.** All five GETs above returned data with
  no session cookie and no OAuth token, from an unrelated client. AD-15's premise holds for the
  catalogue half of the surface.

- **The ~six-month search expiry.** AD-24 carries this as an `[ASSUMPTION]` with no citation.
  It is in fact **sourced**: a GGG web developer states in forum thread **3524729**,
  *"Currently they'll expire after around 6 months without usage."*

### 3.2 Finding V-3 (MEDIUM) — OQ-20's claim that `securable` is undocumented is false

OQ-20 states: *"The value `securable` is undocumented."* Live `/api/trade2/data/filters`
publishes `status_filters` with these options:

| id | text |
| --- | --- |
| `available` | Instant Buyout and In Person |
| `securable` | **Instant Buyout** |
| `onlineleague` | In Person (Online in League) |
| `online` | In Person (Online) |
| `any` | Any |

So `securable` is published, by name, with a human label, **by an endpoint this product
already commits as `catalogue/filters.json` under AD-25** — the very artifact AD-25 exists to
make authoritative. Three consequences:

1. The sentence is wrong and should be struck. The value is undocumented *by the developer
   docs*, like every other part of `trade2`; it is not undocumented by the API.
2. OQ-20's own resolution instruction — *"comparing the result set with the field present,
   absent, and set to each option `/data/filters` publishes"* — is still correct and still
   needs a live call, because the label tells you the intent but not the default when the
   field is omitted. The open question survives; only its premise is wrong.
3. The label *"Instant Buyout"* is material evidence, not trivia. AD-16 is titled *"the price
   estimate is the cheapest live **instant-buyout** listings"*, and the captured browser search
   already sends `securable`. That is the strongest available signal that `securable` is the
   value AD-16 wants, and OQ-20 should record it as such rather than treating the field as
   opaque.

### 3.3 What could NOT be verified from here

Named explicitly, because each is currently resting on a single local measurement recorded in
the documents and nothing re-confirmed it this pass:

- **Unauthenticated POST search and GET fetch.** AD-15's italic note claims *"`trade2` leagues,
  search and fetch all return 200 with no session cookie"*, measured 2026-09-12. I confirmed
  **leagues** and the four data endpoints. I **could not** confirm search or fetch: the search
  endpoint is a POST, which this review's tooling cannot issue, and a fetch requires result ids
  from a search. The claim is plausible and consistent with every third-party PoE trade tool,
  but **two thirds of AD-15's load-bearing measurement is unre-verified today**, and AD-15 is
  the AD that rules out a backend. Cheap to close: one `curl` from the project machine, recorded
  as a fixture under AD-13, which the project must do anyway.

- **The measured rate-limit buckets.** IMPLEMENTATION-NOTES §5.3's table
  (`trade-search-request-limit` = `5:10:60, 15:60:300, 30:300:1800, 600:21600:3600`;
  `trade-fetch-request-limit` = `12:4:10, 16:12:300, 50:300:300, 1000:21600:1800`) can only be
  read out of live **response headers**, which this review's tooling does not surface. The
  header *scheme* is confirmed (§3.1); the *numbers* are not. This is low risk because AD-8
  forbids hardcoding them and the table is explicitly labelled *"the expected shape, never a
  constant to compile in"* — the architecture is already built so that a wrong number here
  cannot reach the code. But note the numbers **do** reach a decision: AD-12's *"measured 2,400
  searches per day"* ceiling and its ~1,500-search full-refresh budget are derived from
  `600:21600`, and §6's *"roughly 8 searches per chunk at a 5-minute cadence"* seeding guidance
  is too. Those are internally consistent (600 per 6h × 4 = 2,400/day), so the arithmetic is
  sound; the **input** is a 2026-09-12 measurement this review could not re-take.

- **`data/items` "groups only ten coarse labels".** IMPLEMENTATION-NOTES §5.2 trap 1 asserts
  the items endpoint groups into ten coarse labels, which is the reason the product uses
  `query.type` rather than `type_filters.category`. The live response was truncated in transit
  and I could see only `accessory` / `Accessories` and `armour` / `Armour`. **The group count
  is unconfirmed.** The trap's conclusion does not depend on the exact number — coarse is coarse
  at ten or at twelve — but the figure itself should be re-counted from the committed
  `catalogue/items.json` once AD-25's refresh command exists, rather than left as a number
  nobody can reproduce.

- **`query.status`'s behaviour when omitted.** Not verifiable without live POSTs. OQ-20 stands
  as an open question, correctly.

- **Which response field carries the search identifier** (`id` vs `tradeId`). Not verifiable
  without a live POST. The open question stands, correctly, and §5.1's reasoning about the
  `referer` blob being an encoded-query form rather than a saved-search id is sound.

---

## 4. Claims that are internal and out of scope for web verification

Recorded so the reader knows they were considered and deliberately not checked here: the
producer's *"53 of 63 item classes"* overlap measurement (AD-11), the *"a 56.5 range edge can
only arise from averaging two integers"* poe2db inference behind OQ-12, and the pool-coverage
gate thresholds. The first two are the weights-scraper project's measurements, correctly
attributed to it and correctly carried as OQ-12/OQ-19 rather than as settled facts. The third
is a design choice, not a fact.

---

## 5. Recommended changes, in priority order

1. **Strike OQ-20's "The value `securable` is undocumented"** and replace it with the live
   `/data/filters` evidence, including the *"Instant Buyout"* label and its alignment with
   AD-16's title. Keep the open question and its resolution method. *(V-3, MEDIUM)*
2. **Cite the source for the six-month expiry** in AD-24, and carry the *"without usage"*
   nuance — the clock is reset by use, which makes the assumption stronger than stated, and the
   permanent-league case correspondingly cheaper. Note the source is a PoE1 Technical Support
   thread, so its application to `trade2` is an inference. *(LOW)*
3. **Re-verify AD-15's search and fetch legs** with one recorded fixture, and update the italic
   note's date. Two thirds of the measurement behind the no-backend decision is currently a
   week old and unre-confirmed. *(LOW, cheap)*
4. **Refresh the five drifted pins** before the first install. *(V-1, LOW)*
5. **Point the TypeScript 7 trigger at typescript-eslint#12518** and the missing TS 7 API,
   rather than at two version numbers, and state whether `@typescript/typescript6` is rejected.
   *(V-2, LOW)*
6. **Re-count `data/items`' group labels** from the committed catalogue once it exists, or soften
   "ten" to "a handful of coarse labels". *(INFO)*

## Sources

- [registry.npmjs.org](https://registry.npmjs.org/) — `typescript`, `typescript@6.0.3`,
  `typescript@6.0.4`, `react`, `vite`, `pnpm`, `@mantine/core`, `zod`, `vitest`, `msw`,
  `eslint`, `typescript-eslint`, `dependency-cruiser` (`/latest` and `/-/package/…/dist-tags`)
- [nodejs.org/dist/index.json](https://nodejs.org/dist/index.json)
- [unpkg.com/dependency-cruiser@18.3.1/src/meta.cjs](https://unpkg.com/dependency-cruiser@18.3.1/src/meta.cjs)
- [PoE Developer Docs](https://www.pathofexile.com/developer/docs/index)
- [/api/trade2/data/stats](https://www.pathofexile.com/api/trade2/data/stats),
  [/static](https://www.pathofexile.com/api/trade2/data/static),
  [/filters](https://www.pathofexile.com/api/trade2/data/filters),
  [/items](https://www.pathofexile.com/api/trade2/data/items),
  [/leagues](https://www.pathofexile.com/api/trade2/data/leagues)
- [PoE forum thread 3524729 — trade query link expiration](https://www.pathofexile.com/forum/view-thread/3524729)
- [typescript-eslint#12518 — TypeScript 7.0.2 Support](https://github.com/typescript-eslint/typescript-eslint/issues/12518)
