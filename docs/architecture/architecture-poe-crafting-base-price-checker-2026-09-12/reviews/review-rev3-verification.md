# Technical-Currency Review — ARCHITECTURE-SPINE.md (revision 3)

- **Target:** `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md`
- **Review date:** 2026-09-13
- **Reviewer brief:** verify every committed decision was web-researched or reality-checked rather than asserted from training data. Revision 3 is a narrow amendment touching no technology choice, so effort is split: **primary** — the amendment's own factual and arithmetic claims (AD-26); **secondary** — a re-check of the Stack table and the TypeScript 7 upgrade trigger first verified in revision 2.
- **Method:** live npm registry queries against `registry.npmjs.org`; `nodejs.org/dist/index.json`; `pathofexile.com/developer/docs/index`; and **four live unauthenticated header probes** against `https://www.pathofexile.com/api/trade2/{search,fetch,exchange,data}/…` issued during this review (raw response headers captured, not inferred).

## Verdict

**Revision 3's external facts are sound and its bucket choice is the right one — but its central arithmetic does not close.** The `pinned` cap is denominated per chunk, and a chunk's size is a function of invocation cadence, which AD-7 explicitly refuses to know. The result is that rev 3 has *relocated* the non-composing inequality it set out to remove rather than eliminated it: the load-time half can still certify a pinned set that can never run, which is precisely the failure AD-26 says a runtime-only check would permit.

Everything web-checkable checked out. Both AD-8 rate-limit rows were **reproduced exactly, live, today**, and the Stack table and both TS-7 blockers are unmoved since 2026-09-12.

| Severity | Count |
| --- | --- |
| High | 2 |
| Medium | 2 |
| Low | 3 |
| Confirmed clean | 11 |

---

# Part 1 — The amendment's own claims (AD-26)

## 1.1 Live re-verification of the rate-limit substrate AD-26 reasons from

AD-26's cap arithmetic rests entirely on AD-8's measured table. I re-measured it rather than trusting the dateline.

**Probe 1 — search policy** (`GET /api/trade2/search/Rise%20of%20the%20Abyssal`, HTTP 404, headers still served):

```
X-Rate-Limit-Policy: trade-search-request-limit
X-Rate-Limit-Rules: Ip
X-Rate-Limit-Ip: 5:10:60,15:60:300,30:300:1800,600:21600:3600
X-Rate-Limit-Ip-State: 1:10:0,1:60:0,1:300:0,2:21600:0
```

**Probe 2 — fetch policy** (`GET /api/trade2/fetch/nonexistentid`, HTTP 200):

```
X-Rate-Limit-Policy: trade-fetch-request-limit
X-Rate-Limit-Rules: Ip
X-Rate-Limit-Ip: 12:4:10,16:12:300,50:300:300,1000:21600:1800
X-Rate-Limit-Ip-State: 1:4:0,1:12:0,1:300:0,2:21600:0
```

**Both rows of AD-8's table are exact, character for character, including the `30:300:1800` bucket AD-26 seeds from.** Policy names `trade-search-request-limit` and `trade-fetch-request-limit` are confirmed as live `X-Rate-Limit-Policy` values, the rule name is `Ip`, and the derived figures hold: 600 / 21,600 s = 600 per 6 h = **2,400 searches/day**, exactly AD-12's stated measurement. **CONFIRMED — not merely dated, but re-measured.**

Note also that `Access-Control-Expose-Headers` lists the four rate-limit headers explicitly, which is independent corroboration that AD-8's discover-rules-at-runtime mechanism is the intended contract rather than an accident.

## 1.2 New live evidence the spine asserts but never showed: the currency summand is unit-correct

AD-26 makes `count(data/currencies.json)` a summand in an inequality denominated in **searches**, justifying it as "AD-20 spends it at step 0 of the same chunk." The spine nowhere establishes that currency pricing consumes the *search* bucket rather than a bucket of its own. I checked.

**Probe 3 — exchange endpoint** (`GET /api/trade2/exchange/Rise%20of%20the%20Abyssal`):

```
X-Rate-Limit-Policy: trade-search-request-limit
X-Rate-Limit-Ip: 5:10:60,15:60:300,30:300:1800,600:21600:3600
X-Rate-Limit-Ip-State: 1:10:0,2:60:0,2:300:0,3:21600:0
```

Two things follow, and the second is the load-bearing one:

1. The exchange endpoint reports the **same policy** (`trade-search-request-limit`) and the **same bucket set** as search.
2. The `-State` counters **incremented continuously across my search and exchange calls** (`1:60` → `2:60`, `1:300` → `2:300`, `2:21600` → `3:21600`). Search and exchange share one counter; they are not parallel budgets.

**AD-26's decision to put the currency count in a search-denominated inequality is therefore correct, and this review supplies the evidence the spine lacks.** Recommend AD-8 or AD-20 record it — it is non-obvious, it is the premise the whole cap rests on, and a builder would reasonably assume the exchange endpoint had its own bucket.

## 1.3 Is `30:300` the right bucket to seed `minChunkSearches` from? — **YES, CONFIRMED**

The brief asks specifically whether `5:10` or `600:21600` would be better. They would not:

| Bucket | As a `minChunkSearches` seed | Verdict |
| --- | --- | --- |
| `5:10:60` | 5 hits per 10 s is an **instantaneous burst limiter**, not a chunk size. A chunk lasting more than 10 s is not bounded by it at all — the window refills mid-chunk. Seeding from it would give `0.5 × 5 = 2.5` pinned entries, an absurd cap driven by a constraint that does not bind a chunk. | Wrong |
| **`30:300:1800`** | 30 hits per 300 s is the **tightest bucket whose window is plausibly ≥ one invocation interval**, so it is the smallest bucket that can bound a whole chunk rather than a burst within one. It is also the only bucket of the four whose magnitude (tens) is the right order for a chunk. | **Correct choice** |
| `600:21600:3600` | 600 per 6 h is a **budget**, not a chunk. `0.5 × 600 = 300` pinned entries per chunk would exceed the entire 6-hour allowance in a single chunk. Denominationally wrong — this is exactly the full-refresh-scale quantity AD-26 was written to stop using. | Wrong |

The bucket choice is right and the reasoning behind denominating against a chunk at all is right. **What is missing is the premise that makes `30` real** — see 1.4.

## 1.4 Does `0.5 × 30` leave a sane pinned set? — **NO, not without a cadence premise AD-7 forbids (HIGH)**

`minChunkSearches` seeded at 30 gives a cap of `count(pinned) + count(currencies) ≤ 15`.

The defect: **30 is a burst ceiling, not a sustained allowance.** The `30:300` bucket permits 30 searches per 5 minutes = 360/hour. The binding long bucket permits 600 per 6 h = **100/hour**. Sustained throughput is therefore 3.6× *below* what the `30:300` bucket alone would allow. A chunk actually receives 30 searches only if the 6-hour bucket has refilled by 30 since the last chunk — which requires an invocation interval of at least `30 / 100` h = **18 minutes**.

AD-7 states, in terms: *"The syncer makes no assumption about what invokes it, how often, or where it runs."* AD-26 silently assumes a cadence no slower and no faster than ~18 minutes. Work the three cases:

| Invocation cadence | Chunks/day | Real searches per chunk | Cap of 15 behaves as |
| --- | --- | --- | --- |
| **5 min** (a natural Task Scheduler setting, permitted by AD-7) | 288 | **8.3** | Load-time validation **passes** a 14-pinned list; runtime allowance of 8 can never cover 14 pinned + 1 active, so the pinned-starvation line fires **every chunk, forever**. The list was certified at load and can never run. |
| **~18 min** (the cadence the seed implicitly assumes) | 80 | 30 | Self-consistent: half of each chunk is half of the 6 h budget. This is the only cadence at which the `0.5` factor means what AD-26 says it means. |
| **60 min** | 24 | 100 | The cap is ~6.7× more restrictive than the chunk can actually bear, needlessly rejecting workable pinned sets. |

**This is the same class of defect revision 3 was written to fix.** The rev-3 header says AD-12's full-refresh ceiling and the pinned cap "never composed into a writable inequality." They still do not — the inequality is now writable, but only because a cadence term was dropped rather than resolved. AD-26's own justification for having both halves ("a runtime check alone would let a list be authored that can never work") is undercut: with a cadence-free seed, the **load-time check lets exactly that list be authored too**, at any cadence faster than ~18 minutes.

**Recommended amendment.** Either (a) make the cadence explicit — declare a `minChunkIntervalMinutes` alongside `minChunkSearches` and state that the pair is what makes the cap sound, noting AD-7 still imposes nothing on the invoker but the *validator* needs the curator's intent; or (b) denominate the load-time cap against the sustained share instead of the burst bucket — `count(pinned) + count(currencies) ≤ 0.5 × 600 / chunksPer6h`, which is the quantity that actually binds. Option (b) needs the same cadence input, so the honest fix is to admit the term exists and let the player declare it. Severity: **HIGH** — the load-time half of a two-ended enforcement mechanism does not enforce what the AD claims, in the AD added to fix an enforcement gap.

## 1.5 The cap and AD-12's budget still do not reconcile (HIGH)

Take the cadence most favourable to AD-26 — ~18 min, the one at which `minChunkSearches = 30` is real — and max out the cap at 14 pinned + 1 currency:

```
pinned cost = 14 searches/chunk × 80 chunks/day = 1,120 searches/day
              = 46.7% of the measured 2,400 searches/day
```

AD-12 reserves its non-refresh headroom explicitly: the ~1,500-search full refresh leaves headroom "for retries, the currency set, the catalogue refresh, the per-run leagues check (AD-19) and a second recipe." **`pinned` appears nowhere in that enumeration** — yet at the cap it is by far the largest consumer in it, roughly 1,120/day against the ~900/day AD-12 leaves over. A pinned set sized exactly as AD-26 permits makes AD-12's stated full refresh unreachable within a day.

So the two quantities AD-26 set out to compose are still uncomposed: AD-26 bounds pinned per chunk without telling AD-12 what that costs per day, and AD-12 enumerates its headroom without reserving anything for pinned. Whichever way 1.4 is resolved, **AD-12's headroom sentence needs `pinned` added to its list with a stated share**, or the cap needs to be derived from that share rather than from a bucket. Severity: **HIGH**.

## 1.6 `count(data/currencies.json)` — right unit, unverified cardinality (MEDIUM)

1.2 confirms currency pricing spends from the search bucket. It does **not** confirm that it spends *one search per currency*, which is what `count(data/currencies.json)` as a bare summand asserts.

- AD-12 quantifies the currency source only as "small, fixed" — it never says one request each.
- The trade2 bulk-exchange endpoint returns **many currency pairs per request**. If one request covers the declared set, the correct summand is `1`, not `N`, and the cap is tightened by up to ~14 slots for no reason.
- Conversely if it is one request per pair, `N` is right and AD-12's "small, fixed" is an under-description of a term that competes directly with pinned.

The spine never states which endpoint prices currencies or how many requests the set costs. A load-bearing inequality should not have a summand whose cardinality is undefined in every AD that mentions it. **Recommend AD-12 quantify the currency source in searches**, and AD-26 cite that quantity rather than a file's row count. Severity: **MEDIUM**.

## 1.7 The cap's denominator is authored by the party it constrains (MEDIUM)

`minChunkSearches` is a declared field of `data/config.json`, which AD-21 makes **player-owned, written by hand**. The load-time validation `count(pinned) + count(currencies) ≤ 0.5 × config.minChunkSearches` therefore has its own bound supplied by the same person authoring the list it restricts. A curator who wants more pinned entries raises `minChunkSearches` and the check passes.

AD-26 is partly protected here — the runtime half is measured from live headers and cannot be talked out of — so the consequence is not a wrong ranking but a **load-time check that certifies nothing it does not already assume**, degrading to advisory. That is a meaningfully weaker claim than "enforced at both ends because neither end is sufficient alone." Worth either deriving the seed from the client's own observed bucket (the adapter already parses it) or stating plainly that the load-time half is an authoring aid, not a guarantee.

**Related smaller gap:** AD-26 labels the load-time check "a `tracked.json` validation error" but the predicate spans **three** files — `tracked.json`, `currencies.json` and `config.json`. AD-6 is scrupulous about assigning an owner and a surfacing channel to each of its two checks; AD-26 assigns neither. `sync` reads all three and is the obvious owner, but `web` also loads `tracked.json` and `config.json` (AD-24) and would have to either duplicate the rule or knowingly skip it. **Name the owner.** Severity: **MEDIUM** (combined).

## 1.8 The `unresolvable` retry-bound rationale — CONFIRMED internally coherent

Rev 3 corrects this bound's rationale from budget protection to (a) pacing re-validation and (b) keeping row 3 beneath row 2. The correction is right and follows from AD-6: detection is offline against the committed catalogue, so a retry issues no request until a human has refreshed the catalogue and the id resolves. The two retained reasons are real and are not budget claims. The dependency on `lastAttemptedAt` existing in all four price states is correctly carried by AD-9. **No finding.**

## 1.9 Where the web cannot confirm, stated plainly

Per the brief, this is recorded explicitly rather than glossed:

- `pathofexile.com/developer/docs/index` was re-fetched this review. It documents the rate-limit header scheme (`X-Rate-Limit-Policy`, `X-Rate-Limit-Rules`, `X-Rate-Limit-{$rule}`, `X-Rate-Limit-{$rule}-State`, `Retry-After`) and names **ip / account / client** as the common rules — all matching AD-8. It contains **no mention of the trade API, `trade2`, or any trading endpoint.** AD-8's recorded risk is accurate and current.
- The policy names `trade-search-request-limit` and `trade-fetch-request-limit`, and the specific bucket values AD-26 seeds from, are **not documented anywhere on the web** — targeted searches returned nothing authoritative. They are observable only by measurement. This review measured them (1.1) rather than citing them, which is the only verification available for undocumented surface.
- Consequently, **no bucket value in AD-8 can ever be "confirmed current" in a durable way.** GGG may change these without notice or changelog. This strengthens rather than weakens AD-8's "**No rate is hardcoded**" clause — and it is an additional argument against `minChunkSearches` being a hand-declared constant seeded from a measurement that can silently move (1.7).

## 1.10 Two AD-12 sources do not spend from the search bucket at all (LOW)

**Probe 4** (`GET /api/trade2/data/static`) and a fifth probe (`GET /api/trade2/data/leagues`) both returned HTTP 200 with **no `X-Rate-Limit-*` headers of any kind**, served from CDN cache (`cf-cache-status: HIT`, `Cache-Control: public, max-age=14400`).

Therefore:

- AD-25's catalogue refresh (4 requests) does **not** consume the search budget.
- AD-19's per-run leagues check does **not** consume the search budget either — which incidentally **vindicates AD-26 for omitting it** from the cap inequality, despite it firing once per run and so once per chunk, exactly like a pinned entry. Had it been metered, its absence from the inequality would have been a real defect. It is not.
- AD-12 lists both as budget-consuming declared sources. That is conservative and only creates headroom, so it is harmless to the arithmetic — but it slightly overstates the pressure on the ceiling and should be annotated.
- The client must still treat **absent rate-limit headers as a normal case**, not a parse failure (rev 2 raised this at §3g; it remains true and remains unaddressed in AD-8's text).

Severity: **LOW** — direction of error is safe.

---

# Part 2 — Stack table and the TypeScript 7 upgrade trigger (re-check)

Every row re-queried live against `registry.npmjs.org` on 2026-09-13.

| Spine claim | Registry `latest` today | Status |
| --- | --- | --- |
| Node.js 24.21.0 (Krypton LTS) | v24.21.0, `lts: "Krypton"`, newest 24.x | **UNMOVED** |
| TypeScript 6.0.3 | `latest` = **7.0.2** (unchanged); 6.0.3 remains final 6.x | **UNMOVED** — pin still deliberate |
| pnpm 12.4.1 | 12.4.1 | **UNMOVED** |
| React 19.3.0 | 19.3.0 | **UNMOVED** |
| Vite 8.3.0 | 8.3.0 | **UNMOVED** |
| Mantine 9.6.1 | `@mantine/core` 9.6.1 | **UNMOVED** |
| Zod 4.6.2 | 4.6.2 | **UNMOVED** |
| Vitest 5.0.0 | 5.0.0 | **UNMOVED** |
| MSW 2.15.0 | 2.15.0 | **UNMOVED** |
| ESLint 10.10.0 | 10.10.0 | **UNMOVED** |
| typescript-eslint 8.70.0 | 8.70.0 | **UNMOVED** |
| dependency-cruiser 18.2.0 | 18.2.0 | **UNMOVED** |

**Twelve of twelve versions are still the exact current `latest`, unchanged since 2026-09-12.** Nothing has moved and nothing has gone stale in the intervening day. **No finding.**

Node context worth one line: the newest Node **overall** is now **v26.8.2** (released 2026-09-09, `lts: false`). The spine correctly stays on the Krypton LTS line rather than chasing it — and `dependency-cruiser@18.2.0`'s `engines` field is `^22||^24||>=26`, so both 24 and 26 would be acceptable to the one tool that gates AD-2. The LTS choice stands on its own merits.

## 2.1 TS-7 blocker 1 — `typescript-eslint` peer cap — **CONFIRMED VERBATIM**

Live from `registry.npmjs.org/typescript-eslint/latest`:

```json
"version": "8.70.0",
"peerDependencies": {
  "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0",
  "typescript": ">=4.8.4 <6.1.0"
}
```

The cap is exactly as the spine states, and the ESLint peer still admits the pinned ESLint 10.10.0. **HOLDS.**

## 2.2 TS-7 blocker 2 — `dependency-cruiser` transpiler range — **CONFIRMED VERBATIM**

Live from `registry.npmjs.org/dependency-cruiser/latest`: version `18.2.0`, `supportedTranspilers.typescript: ">=2.0.0 <7.0.0"`, with `typescript: "^6.0.3"` as its own devDependency.

The range excludes TS 7 exactly as the spine states. **HOLDS.**

This was rev 2's one Critical finding and rev 2's correction landed cleanly: the current text names both blockers, states the constraint for each, and — correctly — identifies `dependency-cruiser` as the more consequential because it is AD-2's mechanical enforcer. The rewritten paragraph is accurate against the registry today. **Both blockers still block; the trigger has not fired. No change needed.**

One small strength the spine could still absorb (carried from rev 2 §2a, still true and still uncited): `typescript-eslint@8.70.0` carries `"@typescript/native": "npm:typescript@^7.0.2"` in its devDependencies — upstream is actively testing against TS 7. That is a checkable signal the trigger will eventually fire, and it costs one clause.

---

## Summary table

| # | Item | Verdict | Severity |
| --- | --- | --- | --- |
| 1 | AD-8 search buckets `5:10:60,15:60:300,30:300:1800,600:21600:3600`, policy `trade-search-request-limit` | **CONFIRMED — re-measured live 2026-09-13, exact** | — |
| 2 | AD-8 fetch buckets `12:4:10,16:12:300,50:300:300,1000:21600:1800`, policy `trade-fetch-request-limit` | **CONFIRMED — re-measured live, exact** | — |
| 3 | AD-12 "2,400 searches/day" derivation from `600:21600` | CONFIRMED arithmetically | — |
| 4 | `/api/trade2/exchange` shares the **search** policy and counter | **CONFIRMED live — new evidence; validates AD-26's currency summand unit** | — |
| 5 | `30:300` is the right bucket to seed from (vs `5:10` / `600:21600`) | **CONFIRMED — the other two are denominationally wrong** | — |
| 6 | **`0.5 × 30` leaves a sane pinned set** | **NO — sound only at a ~18-min cadence AD-7 forbids assuming; at 5-min cadence load-time certifies lists that can never run** | **High** |
| 7 | **AD-26 cap vs AD-12 headroom** | **Still uncomposed — maxed pinned costs ~1,120 searches/day (47% of budget); AD-12's headroom list omits `pinned` entirely** | **High** |
| 8 | `count(data/currencies.json)` as a summand | Unit correct (per #4); **cardinality undefined** — bulk exchange may cost 1 request, not N | Medium |
| 9 | `minChunkSearches` authored in player-owned config; load-time check self-certifying. Check spans 3 files with no named owner | Weakens the load-time half to advisory | Medium |
| 10 | AD-26 omits the leagues check from the inequality | **CORRECT** — leagues endpoint is unmetered (#12) | — |
| 11 | `unresolvable` retry-bound rationale correction | CONFIRMED coherent with AD-6 | — |
| 12 | `/data/*` and `/data/leagues` return **no** rate-limit headers, CDN-cached | AD-12 overstates their budget cost (safe direction); client must tolerate header absence | Low |
| 13 | GGG docs: header scheme + ip/account/client rules | CONFIRMED unchanged | — |
| 14 | GGG docs contain no mention of trade/`trade2` | CONFIRMED — AD-8's recorded risk accurate | — |
| 15 | trade2 policy names/buckets are web-undocumented | Unconfirmable by web **by nature**; measured instead. Reinforces "no rate is hardcoded" | Low |
| 16 | All 12 stack versions | **CONFIRMED — all still exact current `latest`, none moved** | — |
| 17 | `typescript-eslint` peer-caps `typescript` at `<6.1.0` | **CONFIRMED verbatim** | — |
| 18 | `dependency-cruiser` `supportedTranspilers.typescript: ">=2.0.0 <7.0.0"` | **CONFIRMED verbatim** | — |
| 19 | Node v26.8.2 now newest overall (non-LTS) | Krypton LTS choice correctly retained | Low (context) |

## Overall assessment

**Research discipline on external facts is now strong and demonstrably so.** Every web- or wire-checkable claim revision 3 depends on was re-verified live this session, and every one held — including the two AD-8 bucket rows reproduced character-for-character, which is the strongest possible evidence that table was measured rather than recalled. Rev 2's Critical findings in the Stack section were absorbed correctly and the corrected text is accurate against the registry today. The one fact the spine asserts *without* evidence — that currency pricing spends from the search bucket — turns out to be **true**, and this review supplies the measurement; it should be cited rather than left as an assumption that happens to be right.

**The weakness is internal, not external, and it is arithmetic.** AD-26 chose the right bucket, built the right two-ended structure, and identified the right binding requirement — but the quantity it actually needs is *searches available per chunk in steady state*, and that is `600 / chunksPer6h`, not `30`. The `30:300` bucket is an upper bound on a chunk, never a guarantee of one. Because AD-7 declines to know the invocation cadence, the term that converts between them is missing, and both findings 6 and 7 are consequences of that single gap.

The fix is local and does not touch any technology choice: **declare the cadence the curator intends, derive the cap from the sustained share rather than the burst bucket, and add `pinned` to AD-12's headroom enumeration with a stated share.** Nothing downstream — AD-17's partition, AD-18's normalisation, AD-27's narrowed coverage denominator — is affected by any of this.
