# Technical-Currency Review — ARCHITECTURE-SPINE.md (revision 2)

- **Target:** `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md`
- **Review date:** 2026-09-12
- **Reviewer brief:** verify every committed decision was web-researched or reality-checked, not asserted from training data.
- **Method:** live npm registry queries (`registry.npmjs.org`), `nodejs.org/dist/index.json`, `pathofexile.com/developer/docs`, `docs.github.com/en/actions/reference/limits`, and live unauthenticated GETs against `https://www.pathofexile.com/api/trade2/data/*`.

## Verdict

**The stack table is exemplary — every version is genuinely current and cross-peer-compatible. But three load-bearing behavioural claims are wrong against live reality, and two of the three sit inside AD-16, the AD the spine itself calls "the single most load-bearing definition in the product."**

| Severity | Count |
| --- | --- |
| Critical | 2 |
| High | 1 |
| Medium | 3 |
| Low | 4 |
| Confirmed clean | 16 |

---

## 1. Stack table versions

Every row queried live against `https://registry.npmjs.org/-/package/<pkg>/dist-tags` on 2026-09-12.

| Spine claim | Registry `latest` | Status |
| --- | --- | --- |
| Node.js 24.21.0 (Krypton LTS) | v24.21.0, released 2026-09-07, `lts: "Krypton"` | **CONFIRMED** — and it is 5 days old, i.e. the newest LTS patch in existence. |
| TypeScript 6.0.3 | `latest` is **7.0.2**; 6.0.3 exists and is the final 6.x release | **CONFIRMED as a deliberate pin** (see §2) — not stale-by-accident. |
| pnpm 12.4.1 | `latest` = 12.4.1 (`latest-12` also 12.4.1) | **CONFIRMED** |
| React 19.3.0 | `latest` = 19.3.0 | **CONFIRMED** |
| Vite 8.3.0 | `latest` = 8.3.0 | **CONFIRMED** |
| Mantine 9.6.1 | `@mantine/core` `latest` = 9.6.1 | **CONFIRMED** |
| Zod 4.6.2 | `latest` = 4.6.2 | **CONFIRMED** |
| Vitest 5.0.0 | `latest` = 5.0.0 | **CONFIRMED** |
| MSW 2.15.0 | `latest` = 2.15.0 | **CONFIRMED** |
| ESLint 10.10.0 | `latest` = 10.10.0 | **CONFIRMED** |
| typescript-eslint 8.70.0 | `latest` = 8.70.0 (canary 8.70.1-alpha.0) | **CONFIRMED** |
| dependency-cruiser 18.2.0 | `latest` = 18.2.0 | **CONFIRMED** |

**Nothing is stale and nothing is non-existent.** Twelve of twelve are the exact current `latest`, and the one exception (TypeScript) is an explicitly reasoned pin rather than an oversight. This is clear evidence the table was researched, not recalled.

### Cross-peer compatibility (checked, not asserted — the spine does not claim this, so this is a free confirmation)

- `@mantine/core@9.6.1` peers `react: "^19.2.0"` → satisfied by React 19.3.0. ✅
- `vitest@5.0.0` peers `vite: "^6.4.0 || ^7.0.0 || ^8.0.0"` → satisfied by Vite 8.3.0. ✅
- `typescript-eslint@8.70.0` peers `eslint: "^8.57.0 || ^9.0.0 || ^10.0.0"` → satisfied by ESLint 10.10.0. ✅
- `msw@2.15.0` peers `typescript: ">= 4.8.x"` (unbounded above) → satisfied by TS 6.0.3, and would not block TS 7. ✅

The stack is internally consistent. **CONFIRMED.**

---

## 2. "Upgrade trigger — TypeScript 7"

The spine states:

> TS 7.0.2 is current, but every published `typescript-eslint` line (latest `8.70.0`, canary `8.70.1-alpha.0`) peer-caps `typescript` at `<6.1.0`. Move to TS 7 when a `typescript-eslint` release publishes a peer range including 7. **Nothing else in the stack blocks it — `dependency-cruiser` does not depend on the TypeScript compiler API at all.**

### 2a. The peer cap — CONFIRMED for current lines, OVERBROAD as stated (LOW)

Verified from the registry:

```
typescript-eslint@8.70.0        peerDependencies.typescript = ">=4.8.4 <6.1.0"
typescript-eslint@8.70.1-alpha.0 peerDependencies.typescript = ">=4.8.4 <6.1.0"
```

Both named versions are exactly right. The cap's history also checks out and shows it tracking TS releases:

```
8.20.0 → ">=4.8.4 <5.8.0"
8.40.0 → ">=4.8.4 <6.0.0"
8.60.0 → ">=4.8.4 <6.1.0"
8.68.0 → ">=4.8.4 <6.1.0"
```

**However, "every published `typescript-eslint` line" is literally false.** The `typescript-eslint` meta-package also has published `7.0.0`/`7.0.1` versions and early `8.0.x` versions whose peer is:

```
typescript-eslint@8.0.0  peerDependencies.typescript = "*"
                         peerDependenciesMeta.typescript.optional = true
```

An unbounded `*` peer does not cap at `<6.1.0`. The practical conclusion the spine draws is still correct — no *usable, current* line admits TS 7 — but the universal quantifier is not supported by the registry. **Recommend narrowing to "every currently-supported `typescript-eslint` line (8.60.0 through 8.70.1-alpha.0)".** Severity: **LOW** (wording, not decision).

**Corroborating signal the spine did not cite (worth adding):** `typescript-eslint@8.70.0`'s own devDependencies contain `"@typescript/native": "npm:typescript@^7.0.2"` — upstream is actively testing against TS 7. That is a real, checkable indicator that the trigger will fire, and it strengthens the AD.

### 2b. "Nothing else in the stack blocks it — dependency-cruiser does not depend on the TypeScript compiler API at all" — **WRONG (CRITICAL)**

This is factually incorrect on both halves, and it is the only place in the spine where a *forward-looking* decision rests on an unverified assertion.

From the live `dependency-cruiser@18.2.0` package metadata:

```json
"supportedTranspilers": {
  "swc":        ">=1.0.0 <2.0.0",
  "babel":      ">=7.0.0 <8.0.0",
  "typescript": ">=2.0.0 <7.0.0",
  ...
},
"devDependencies": { "typescript": "^6.0.3", ... }
```

Three things follow:

1. **dependency-cruiser absolutely does consume the TypeScript compiler API.** It ships TypeScript as a first-class supported transpiler (that is how it resolves and parses `.ts`/`.tsx` sources and reads `tsconfig.json` path mappings). Its npm keywords lead with `typescript`; its package description is *"Validate and visualize dependencies… JavaScript, TypeScript, CoffeeScript."*
2. **It declares an explicit upper bound of `<7.0.0` on TypeScript.** dependency-cruiser 18.2.0 does not support TS 7 *at all*.
3. Therefore `dependency-cruiser` is a **second, independent blocker** on the TS 7 upgrade — and, given AD-2 makes dependency-cruiser the mechanical enforcer of the entire package graph, it is arguably the *harder* blocker of the two. A TS 7 move that satisfies typescript-eslint but breaks dependency-cruiser breaks AD-2's enforcement, not merely a lint rule.

**Required amendment.** The sentence must be replaced with something like:

> Two dependencies block TS 7. `typescript-eslint` (all supported lines) peer-caps `typescript` at `<6.1.0`, and `dependency-cruiser@18.2.0` declares `supportedTranspilers.typescript: ">=2.0.0 <7.0.0"` — it uses the TypeScript compiler API to parse TS sources and resolve `tsconfig` paths, so AD-2's enforcement breaks before the lint does. Move to TS 7 only when **both** publish ranges admitting 7.

Severity: **CRITICAL** — the claim is stated as settled fact, it is verifiably false, and acting on it would break the AD-2 enforcement gate that the whole ports-and-adapters discipline depends on.

---

## 3. AD-8 — rate-limit header shape and GGG third-party expectations

Checked against `https://www.pathofexile.com/developer/docs/index` (rate-limits section) and live response headers.

### 3a. Header naming scheme — CONFIRMED

The spine's mechanism — read `X-Rate-Limit-Rules` to learn active rule names, then read `X-Rate-Limit-{rule}` for the policy and `X-Rate-Limit-{rule}-State` for consumption — matches the official docs exactly:

- `X-Rate-Limit-Rules`: "A comma-delimited list of applicable rules."
- `X-Rate-Limit-{$rule}`: maximum hits, period in seconds, restriction time if exceeded.
- `X-Rate-Limit-{$rule}-State`: current hit count, period tested, active restriction time.
- `Retry-After`: "Time to wait (in seconds) until the rate limit expires."

The `hits:seconds:penalty` triple format in AD-8's measured table matches the documented three-number colon-delimited encoding. **CONFIRMED.**

### 3b. "There is no `X-Rate-Limit-Client` header." — **WRONG (CRITICAL)**

The official documentation names three common rules — **Ip, Client, and Account** — and its own worked example is, verbatim:

```
X-Rate-Limit-Policy: ladder-view
X-Rate-Limit-Rules: client
X-Rate-Limit-Client: 10:5:10
X-Rate-Limit-Client-State: 1:5:0
```

`X-Rate-Limit-Client` is the header GGG chose to *illustrate the entire mechanism with*. The spine's flat denial of its existence is contradicted by the primary source.

**What is true** is the narrower statement the spine already makes one clause earlier: *unauthenticated, the active rule is `Ip`*, so a client that discovers rules from `X-Rate-Limit-Rules` will only ever see `Ip`/`Ip-State` on this project's traffic. That is correct and sufficient.

The danger of the current wording is that it is a **negative universal about GGG's API surface baked into an AD**, and AD-8 binds the one adapter that must be robust. A builder reading "there is no X-Rate-Limit-Client header" could reasonably hardcode a rule allowlist of `["Ip"]` and silently fail the day GGG adds a second rule — precisely the hardcoding AD-8's own "**No rate is hardcoded**" clause exists to prevent. The sentence undercuts the AD it sits in.

**Required amendment:** replace with *"Unauthenticated, `X-Rate-Limit-Rules` returns only `Ip`; `Client` and `Account` rules exist but apply to OAuth-authenticated traffic, which AD-15 forbids. The client must parse whatever rules the header names and never assume the set."*

Severity: **CRITICAL** — a verifiably false factual claim in the AD governing the API access the entire product depends on.

### 3c. Missing: `X-Rate-Limit-Policy` — MEDIUM

The docs document a fourth header, `X-Rate-Limit-Policy` ("The policy that applies to this request"), which names the policy the rules belong to (e.g. `ladder-view`, and in AD-8's own measured data `trade-search-request-limit` / `trade-fetch-request-limit` — those *are* policy values, not rule values). AD-8's measured table already uses policy names in its "Policy" column but the parsing rule above it never mentions how the client learns them. **The governed client must read `X-Rate-Limit-Policy` to know which bucket set it is pacing against**, because search and fetch are separate policies and conflating their buckets would over- or under-pace both. This is a real gap in an otherwise careful AD.

### 3d. "as GGG asks of third-party tools" (User-Agent) — **UNCONFIRMED / partially unsupported (MEDIUM)**

The docs specify a User-Agent format **only for OAuth applications**:

```
User-Agent: OAuth {$clientId}/{$version} (contact: {$contact})
```

There is **no documented User-Agent policy for unauthenticated or non-OAuth requests**. AD-8's "descriptive `User-Agent` identifying the tool and a contact address, as GGG asks of third-party tools" is directionally correct community practice and unambiguously good citizenship — but "as GGG asks" attributes to GGG a requirement they do not publish for this access mode. Soften to "as GGG asks of OAuth applications, and as community practice extends to unauthenticated clients."

### 3e. Unrecorded risk: the trade API is outside GGG's supported surface — MEDIUM

The developer docs state plainly: **"We can only support resources defined in our API Reference or listed in our Data Exports."** The docs contain **no reference whatsoever to the trade API, `trade2` endpoints, or trading systems.**

Every endpoint this architecture depends on — search, fetch, and all four AD-25 catalogue endpoints — is therefore *undocumented and explicitly unsupported*. This is the single largest external risk to a system whose stated horizon is one year, and the spine does not record it anywhere. AD-13's fixture-diff mechanism partially mitigates *change*, but nothing addresses *withdrawal*. Recommend adding it to Open Questions or Deferred with an explicit "if the trade2 endpoints close, the product ends" acknowledgement — the spine is elsewhere scrupulous about naming exactly this class of thing (cf. AD-23's "recorded, not solved").

Adjacent, lower-confidence note: the docs' third-party policy tiers websites as "little to no risk" while stating standalone executables require public OAuth clients. This project is a local Node CLI plus a static site, not a game-file-reading executable (the category GGG actually prohibits), so the risk is low — but AD-15's "no secret material, unauthenticated" premise and GGG's OAuth-for-standalone-apps guidance are in mild tension and this was not weighed.

### 3f. Measured bucket table — NOT RE-VERIFIED, but internally coherent (LOW)

AD-8's table is labelled "Measured 2026-09-12" and I did not re-issue searches (doing so would consume the very budget AD-12 rations). Two coherence checks pass:

- `600:21600:3600` = 600 searches per 21,600 s = 6 h → the stated "600 searches / 6h". ✅
- 600 per 6 h × 4 = 2,400/day, which is exactly the "measured 2,400 searches/day" AD-12 reasons from, and the ~1,500-search ceiling leaves the headroom AD-12 claims. ✅

The arithmetic is consistent across three ADs. Treated as **CONFIRMED-by-session-evidence**, flagged only as not independently re-measured.

### 3g. Live observation the spine should absorb — LOW

I issued a live `GET https://www.pathofexile.com/api/trade2/data/filters` and dumped response headers: **the `/data/*` catalogue endpoints return no `X-Rate-Limit-*` headers at all** (HTTP 200, no rate-limit family present).

AD-8 routes catalogue refreshes (AD-25) through the same governed client and says it "reads `X-Rate-Limit-Rules` to learn the active rule names". On the catalogue path there are no such headers. The client must therefore treat their **absence** as a valid, non-exceptional case rather than as a parse failure or an unknown-rule error. This is a concrete, cheap-to-get-wrong implementation detail that the AD as written would lead a builder to mishandle.

---

## 4. AD-25 — the four trade2 data endpoints

Session evidence supplied: `items` 186 KB / 3,900 base types; `stats` 853 KB / 3,108 explicit stat ids with entry shape `{id,text,type}` only; `static` 184 KB / 40 currencies; `filters` 9 KB. I independently re-fetched `items` and `filters` this session.

### Independent re-verification

```
GET /api/trade2/data/items   → HTTP 200, 186,664 bytes, 3,900 "type" entries   ✅ matches
GET /api/trade2/data/filters → HTTP 200,   9,464 bytes                          ✅ matches
```

Both unauthenticated, no session cookie. **Existence and unauthenticated access: CONFIRMED.**

### Overclaim audit of the AD-25 table

| Claim | Verdict | Note |
| --- | --- | --- |
| `items.json` carries "base types by category" | **CONFIRMED, with a caveat (LOW)** | Live shape is `{result: [{id, label, entries: [{type}]}]}` with 10 coarse groups: `accessory`/Accessories, Armour, Currency, Flasks, Gems, Jewels, Maps, Sanctum, Weapons, Wombgift. So "by category" is fair — **but see §5b, because these group ids are *not* the `type_filters.category` vocabulary.** Also, "base types" is loose: the 3,900 entries include currency, gems and maps, not only craftable bases. |
| `stats.json` carries "stat ids + display text" | **CONFIRMED** | Exactly within the supplied evidence. |
| `static.json` carries "currency ids + icons" | **CONFIRMED, mild caveat (LOW)** | Evidence establishes 40 currencies. `/data/static` in fact carries more than currencies (fragments, maps, etc.); the AD's narrower reading is safe but the artifact will contain more than the AD describes, which matters for the Zod schema in `contracts`. |
| `filters.json` carries "filter ids + options" | **CONFIRMED** | Re-fetched and parsed. |
| All four unauthenticated | **CONFIRMED** | Re-verified live. |
| Refresh = four requests | **CONFIRMED** | Four endpoints, one GET each. |

### AD-25's strongest claim — "3,108 explicit stat ids, each `{id, text, type}` and nothing more"

**CONFIRMED against the supplied evidence, with one structural nit (LOW).** The phrase "a **flat global list**" slightly misdescribes the payload: `/data/stats` is top-level **grouped by stat type** (explicit, implicit, fractured, pseudo, …), and 3,108 is the count of the *explicit* group, not the whole document. "Flat" would mislead whoever writes the `contracts` Zod schema for `catalogue/stats.json`. Recommend: *"a global list grouped by stat type; the explicit group holds 3,108 ids, each `{id, text, type}`."*

Substantively, the load-bearing negative — **no per-base association, no tier, no item-level availability, no spawn weight** — is fully supported by the observed entry shape. This is the claim AD-11, AD-18 and AD-27 all rest on, and it holds. **No overclaim.**

### One genuine extrapolation — UNCONFIRMED but plausible (LOW)

AD-11 states: *"The trade API exposes no pool membership, no tier, no item-level availability and no spawn weight (AD-25)."* The citation points at AD-25, but AD-25's evidence covers only the four **data** endpoints. This is a claim about the **entire trade API** — including the search and fetch endpoints, whose response shapes were not enumerated in evidence. The inference is almost certainly right (fetch returns listed items, not game metadata) and the conclusion is safe, but the spine presents a four-endpoint observation as an API-wide proof. Worth one honest qualifier: *"no endpoint observed on 2026-09-12 exposes…"*.

---

## 5. AD-16 — named filter ids

I re-fetched `/api/trade2/data/filters` live and parsed the actual option lists. Two of the six rows are wrong, and both are load-bearing.

### 5a. Rows that check out

| Row | Live evidence | Verdict |
| --- | --- | --- |
| `type_filters.rarity` = `magic` / `normal` | `rarity` options: `normal`, `magic`, `rare`, `unique`, `uniquefoil`, `nonunique` | **CONFIRMED** — both values exist and mean what AD-5/AD-16 need. |
| `type_filters.ilvl` with `min` | `{"id":"ilvl","text":"Item Level","minMax":true}` | **CONFIRMED** — `minMax: true` confirms a `min`/`max` pair is accepted, so AD-16's `min`-only use and AD-18's `ilvl >= floor` superset caveat are both sound. |
| stat filters carrying both `min` and `max` | Standard trade-API stat filter shape; band-bounded filtering is supported | **CONFIRMED** — and AD-16's reasoning for passing `max` (so the priced population matches AD-18's probability population) is exactly right. This is the best-reasoned paragraph in the document. |
| sort by price ascending | Not expressible in `/data/filters` (sort is a sibling of `query`, not a filter) | **UNCONFIRMED by this payload, but standard** — `{"sort": {"price": "asc"}}` is the long-standing trade API form. Low risk; note only that its presence was *not* established by the filters payload the AD cites as its source. |

### 5b. `type_filters.category` = "the entry's `baseTypeId`" — **WRONG (CRITICAL)**

AD-16's table row reads:

| `type_filters.category` / base type | the entry's `baseTypeId` |

Live `/data/filters`, `type_filters.category` option ids:

```
weapon, weapon.onemelee, weapon.claw, weapon.dagger, weapon.bow, weapon.crossbow,
weapon.wand, weapon.sceptre, weapon.staff, armour, armour.helmet, armour.chest,
armour.gloves, armour.boots, armour.quiver, armour.shield, armour.focus,
accessory, accessory.amulet, accessory.belt, accessory.ring, gem, jewel, flask,
map, map.waystone, card, sanctum.relic, currency, currency.omen, currency.rune, …
```

`category` takes an **item-class taxonomy id** (`weapon.bow`), never a base type name. The spine's own Consistency Conventions state `baseTypeId` is *"the `type` string exactly as `data/items` spells it (e.g. `"Guardian Bow"`)"* — and `"Guardian Bow"` is not a member of the `category` option set. **A search built as AD-16 specifies would be rejected or would silently match nothing.**

The base type belongs in the query's top-level **`type`** field, which is a sibling of `filters`, not a member of `type_filters`. AD-16 conflates two different fields with two different vocabularies, and the slash-gloss "`type_filters.category` / base type" is where the conflation hides.

**Compounding problem:** the live `/data/items` grouping is *coarse* — its group ids are `accessory`, `armour`, `weapon`-level labels (10 groups), **not** the leaf ids `accessory.amulet` / `weapon.bow` that `type_filters.category` actually wants. So the committed catalogue (AD-25) **cannot** supply a base-type→category mapping at the granularity `category` requires. If a builder tried to repair AD-16 by deriving a category from `items.json`, they would find the data is not there. This needs resolving in the spine, not at the keyboard.

**Required amendment:** split the row —

| Field | Value |
| --- | --- |
| `query.type` (top level, not a filter) | the entry's `baseTypeId`, verbatim from `data/items` |
| `type_filters.category` | omitted — `type` already pins the base type; category is a coarser sibling whose leaf ids are not derivable from `data/items` |

Severity: **CRITICAL** — AD-16 is the AD the spine itself flags as "the single most load-bearing definition in the product… the brief calls this section *the product; everything else is presentation*". The one search it specifies does not work as written.

### 5c. `trade_filters.sale_type` = `priced_with_info` — "instant buyout only" is **WRONG (HIGH)**

The option id exists, so the *id* is confirmed. Its *meaning* is not what AD-16 says. Live `/data/filters`:

```json
{"id":"sale_type","text":"Sale Type","option":{"options":[
  {"id":"any",              "text":"Any"},
  {"id":null,               "text":"Buyout or Fixed Price"},
  {"id":"priced_with_info", "text":"Price with Note"},
  {"id":"unpriced",         "text":"No Listed Price"}
]}}
```

`priced_with_info` is labelled **"Price with Note"** — it selects listings whose price is expressed as a *note* (the `~b/o` / `~price` note form), which is a statement about *how the price was entered*, not about whether it is an instant buyout. The option that actually means buyout-or-fixed-price is the one with **`"id": null`** — the unnamed default.

Three consequences:

1. **The stated filter selects the wrong population.** "Price with Note" both admits listings AD-16 intends to exclude and excludes fixed-price listings AD-16 intends to include.
2. **AD-16's justification collapses with it.** The rule reasons: *"instant-buyout-only is what removes listings priced below market, which would already have been bought."* That argument is sound, but `priced_with_info` is not the filter that implements it. The AD's conclusion and its mechanism have come apart.
3. **The correct value is an awkward `null`**, which is a genuine implementation trap worth recording explicitly in the AD — a builder serialising a filter object will naturally omit a `null`-id option rather than emit it, producing an unfiltered search that still returns 200 and still yields a plausible-looking median. This fails *silently*, which is exactly the failure mode AD-3, AD-6 and AD-9 are otherwise built to prevent.

**Required amendment:** state the intended semantics, name the `null`-id option explicitly, and note that if "listings with a price note" is genuinely wanted instead, the AD should say so and drop the "instant buyout" justification.

Severity: **HIGH** — wrong filter semantics on the price estimate, with a silent-failure serialisation trap attached.

---

## 6. GitHub Actions and Pages claims

### 6a. 6-hour per-job ceiling — CONFIRMED (but not actually asserted in the spine)

`docs.github.com/en/actions/reference/limits`, verbatim: **"Each job in a workflow can run for up to 6 hours of execution time. If a job reaches this limit, the job is terminated and fails."** (GitHub-hosted runners; self-hosted is 5 days; a whole workflow run may span 35 days including waits.)

Note that the spine **never states the 6-hour figure**. AD-7 says only *"a host's wall-clock ceiling becoming a correctness problem"* and lists "a CI runner" among valid invokers. That generality is correct and survives the limit changing. **CONFIRMED — and the abstraction is the right call; do not add the number.**

One coherence observation worth recording as a strength: AD-8's measured buckets are denominated in 21,600-second (6 h) windows, which coincides exactly with the GitHub-hosted job ceiling. If a CI runner is ever used as the invoker (AD-7 permits it), one job can at most exhaust one full rate-limit window — a happy alignment, but an undocumented one.

### 6b. "Branch-published Pages runs Jekyll and cannot build this app" — CONFIRMED

Confirmed against Vite's own deployment guide and GitHub Pages documentation. Branch-source ("Deploy from a branch") publishing runs the content through **Jekyll**, and Jekyll is the only generator with native Pages support; it runs with `--safe` (plugins restricted to an official allowlist) and has no Node/npm/bundler step. It cannot execute a Vite build. Publishing a Vite app therefore requires either committing `dist/` to the branch or — the route the spine chose — the **GitHub Actions source** with `upload-pages-artifact` + `deploy-pages`.

The spine's conclusion — *"the workflow is required, not optional"* — is **CONFIRMED**, and `.github/workflows/deploy.yml` is correctly present in the source tree.

Minor completeness note (LOW): the strictly accurate framing is that branch publishing cannot *build* a Vite app; it can still *serve* a pre-built `dist/` committed to the branch (with a `.nojekyll` marker to stop Jekyll mangling `_`-prefixed asset paths). That alternative is worse for this project — it would put build output under the sync commit path and collide with AD-21's one-writer-per-file rule — so the decision stands. But "cannot build" is the precise claim, and "cannot" alone slightly overstates it.

---

## Summary table

| # | Item | Verdict | Severity |
| --- | --- | --- | --- |
| 1 | Node 24.21.0 Krypton LTS | CONFIRMED | — |
| 2 | React / Vite / Mantine / Zod / Vitest / MSW / ESLint / pnpm / dep-cruiser versions | CONFIRMED (all = current `latest`) | — |
| 3 | TypeScript 6.0.3 pin, TS 7.0.2 current | CONFIRMED | — |
| 4 | Cross-package peer compatibility | CONFIRMED (free check) | — |
| 5 | typescript-eslint peer cap `<6.1.0` on current lines | CONFIRMED | — |
| 6 | "*every* published typescript-eslint line" caps | WRONG (8.0.0 / 7.x use `"typescript":"*"`) | Low |
| 7 | **"dependency-cruiser does not depend on the TS compiler API at all"** | **WRONG** — declares `supportedTranspilers.typescript ">=2.0.0 <7.0.0"`; is a second TS-7 blocker | **Critical** |
| 8 | AD-8 header scheme (`Rules` / `{rule}` / `{rule}-State` / `Retry-After`) | CONFIRMED | — |
| 9 | **"There is no `X-Rate-Limit-Client` header"** | **WRONG** — it is GGG's own documented example header | **Critical** |
| 10 | `X-Rate-Limit-Policy` unmentioned; search vs fetch are distinct policies | Gap | Medium |
| 11 | "as GGG asks of third-party tools" (User-Agent) | UNCONFIRMED — documented for OAuth apps only | Medium |
| 12 | trade2 is outside GGG's supported/documented API surface | Unrecorded risk | Medium |
| 13 | AD-8 measured bucket table | Not re-measured; arithmetic coherent across AD-8/AD-12 | Low |
| 14 | `/data/*` returns no `X-Rate-Limit-*` headers at all | Live finding; client must tolerate absence | Low |
| 15 | AD-25 four endpoints exist, unauthenticated | CONFIRMED (re-fetched items + filters) | — |
| 16 | AD-25 "3,108 explicit stat ids, `{id,text,type}` and nothing more" | CONFIRMED — no overclaim | — |
| 17 | AD-25 "flat global list" | Imprecise — `/data/stats` is grouped by stat type | Low |
| 18 | AD-11 "the trade API exposes no… " generalised from 4 data endpoints | UNCONFIRMED extrapolation (plausible) | Low |
| 19 | `type_filters.rarity` magic/normal, `type_filters.ilvl` min, stat min+max | CONFIRMED live | — |
| 20 | **`type_filters.category` = `baseTypeId`** | **WRONG** — category takes `weapon.bow`-style ids; base type belongs in `query.type`; leaf ids not derivable from `data/items` | **Critical** |
| 21 | **`sale_type: priced_with_info` = "instant buyout only"** | **WRONG** — live label is "Price with Note"; buyout-or-fixed-price is the `id: null` option | **High** |
| 22 | sort price ascending | Standard, but not established by the cited `/data/filters` payload | Low |
| 23 | GitHub Actions 6h per-job ceiling | CONFIRMED (and correctly left un-numbered in AD-7) | — |
| 24 | Branch-published Pages runs Jekyll, cannot build Vite | CONFIRMED | — |

## Overall assessment

**Research discipline on the dependency stack is excellent** — twelve of twelve versions are the exact current `latest`, the one deviation is a reasoned pin, and the peer graph is coherent. Nothing there was asserted from memory.

**Research discipline on external API behaviour is weaker than the document's confident tone implies.** Three claims (`X-Rate-Limit-Client`, `type_filters.category`, `priced_with_info`) are stated as verified fact — two of them with an explicit "verified on 2026-09-12" dateline — yet contradict the live payloads and GGG's own documentation. The pattern is specific and worth naming: **endpoint existence was verified, but field semantics were inferred.** `/data/filters` was clearly fetched (the ids are all real); its `options` arrays and `text` labels were apparently not read. That is a narrow, fixable gap in method rather than a broad failure of rigour.

The three critical items and the one high item all sit in the request-construction path — the exact place where a wrong constant produces a 200 response, a plausible number, and a silently wrong ranking. Everything downstream of them (AD-17's partition, AD-18's normalisation, AD-27's coverage gate) is carefully reasoned and unaffected by these errors, so the fixes are local: **re-read the live `/data/filters` option lists and rewrite the AD-16 table; drop the `X-Rate-Limit-Client` denial from AD-8; correct the dependency-cruiser sentence in the upgrade trigger.**
