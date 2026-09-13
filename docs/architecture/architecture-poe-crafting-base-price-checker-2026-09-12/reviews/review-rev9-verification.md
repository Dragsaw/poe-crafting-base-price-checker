# Reviewer Gate — Verification lens, ARCHITECTURE-SPINE.md revision 9

- **Date:** 2026-09-13
- **Target:** `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md`, revision 9
- **Lens:** Was every committed decision web-researched or reality-checked, rather than asserted from training data? Are named technologies current, extant, and correctly described?
- **Verdict:** **Amend before build.** The stack table and the TypeScript 7 upgrade trigger survive re-verification almost untouched. The revision-9 trade-site claims do not: one is contradicted by a live fetch, one is contradicted by a GGG staff statement, and one rests on a URL shape the spine never wrote down.

Method note: every version claim below was re-checked today against the live npm registry and `nodejs.org/dist/index.json`. Every trade-API claim below marked *verified live* was re-checked by fetching the endpoint itself today. Claims I could not confirm are called out as such rather than passed over.

---

## F1 — `static.json` does not carry stat text, and after revision 9 it has no `web` consumer at all — **high**

**What the spine says.** AD-24: "`catalogue/static.json` is fetched for the stat-text path and for currency id validation." AD-25's catalogue table, `static.json` row, *Consumed for*: "`data/currencies.json` ids; **stat-text path in `web`**. The icons this artifact carries are not consumed in v1 (AD-24)."

**What is actually true.** *Verified live 2026-09-13*, `GET https://www.pathofexile.com/api/trade2/data/static` returns a `result` array of currency-ish category groups — Currency, Fragments, Verisium, Runes, Expedition, Vaal, Delirium — whose entries carry an id, a display label and an `image` path of the form `/gen/image/<blob>/<name>.png`. **There is no stat id and no stat text anywhere in the artifact.** Stat text lives in `/api/trade2/data/stats`, which *verified live* returns stat entries of the form `{id, text, type}`. AD-25's own `stats.json` row already says exactly this ("stat ids + display text ... modifier text in `web`"). So the spine contradicts itself inside one table.

**Why this is high and not cosmetic.** Revision 9's stated purpose for this edit was to withdraw the icon rationale (AD-24: "v1 denominates currency as text and defines no icon"). Having removed the only true consumer, revision 9 substituted two consumers, and neither exists:

1. *Stat-text path* — false on the artifact's contents, as above.
2. *Currency id validation* — AD-25 scopes this to "`data/currencies.json` ids", and AD-24 states plainly that **`web` never fetches `data/currencies.json`**; AD-21 confirms `currencies.json` is read by `sync` **only**, and AD-26 leans on exactly that fact to make the pinned cap a sync-side check. There is therefore nothing in `web` for `static.json` to validate against.

**Consequence.** AD-24's "eight artifacts ... the eight artifacts are the complete set" is, on revision 9's own reasoning, a set of **seven** plus one artifact fetched for no consumer. That is a read-time cost and a validation surface (AD-3 requires every fetched artifact to be schema-validated on load, so `contracts` must carry a Zod schema for a file nothing reads) taken on for a justification that does not hold.

**Recommendation.** Either (a) drop `static.json` from AD-24's fetch set, making it seven, and mark `static.json` as `sync`-only in AD-25 alongside `items.json` and `filters.json` — its currency-id validation consumer is `sync`, which does hold `currencies.json`; or (b) keep it and state the real reason, which is forward-compatibility for the deferred multi-denomination view, and say so as a *deliberately unconsumed* artifact rather than inventing a consumer. Option (a) is the one consistent with AD-6's own principle that a check belongs to the component that holds both sides.

---

## F2 — "a stale search id merely lands the player on an empty result page" is contradicted by the evidence — **high**

**What the spine says.** The revision-9 header and AD-9/AD-24 rest the whole design on graceful degradation: the identifier is persisted, `web` renders the link on a pure data test (`lastSearchId` present ∧ `lastSearchLeague` == active league), and no component validates the identifier, because the worst case is said to be a harmless empty result page.

**What I found.** On the PoE forum thread *"Expiration time of a trade website query link"* (`pathofexile.com/forum/view-thread/3524729`), GGG web developer **Novynn** states: *"Currently they'll expire after around 6 months without usage."* So the identifier has a real, GGG-stated TTL that resets on use, and expiry is a documented behaviour rather than a hypothetical. Separately, the third-party tool ecosystem reports an explicit failure string on invalid searches — *"Failed to load the search state. The search is no longer valid"* (awakened-poe-trade issue #1573) — which is an error state, not an empty result set. I could **not** find a primary source describing exactly what `trade2` renders for an expired or unknown id, and I did not mint a live search to test it (doing so would be a write against GGG's search bucket). So the precise rendering is **unconfirmed in both directions** — but the spine's confident assertion is the weaker of the two readings and is not sourced anywhere in the document.

**Why it matters despite the mitigations.** AD-26's rotation re-stamps `lastAttemptedAt` — and therefore, per AD-16, `lastSearchId` — for `active` entries far more often than every six months, and AD-24's league test already sheds last league's links. The residual exposure is narrow: a long-idle row in a long-running league. But the spine does not argue that narrowness; it argues a benign failure mode it has not checked. A reviewer gate is precisely the place to refuse an unchecked benign-failure claim, because this is the one claim that licenses `web` to render a link it never validates.

**Recommendation.** Replace the "empty result page" assertion with what is actually known: GGG states ~6 months of disuse expires a saved query, the rendered failure mode is unconfirmed, and the mitigation is AD-26's re-stamping cadence rather than a benign server response. Add the verification to the Open Questions with an owner, at the same weight as the multi-`#` filter-unit question — it is the same class of fact (one empirical property of an undocumented endpoint).

---

## F3 — The trade-site URL shape is asserted but never written down, and it has three parts, not two — **medium**

**What the spine says.** AD-24: "`web` renders the link for a tracked entry if and only if the entry's `lastSearchId` is present ... and its `lastSearchLeague` equals the active league." AD-9 and AD-16 describe stamping the identifier. Nowhere does the spine state the URL a builder is to construct.

**What I found.** *Verified live 2026-09-13*, `GET https://www.pathofexile.com/api/trade2/data/leagues` returns every league with a **`realm` field whose value is `poe2`**, and the live league ids are `Forbidden Rites`, `HC Forbidden Rites`, `Runes of Aldur`, `HC Runes of Aldur`, `Standard`, `Hardcore`. Community sources consistently give the search endpoint as `POST /api/trade2/search/poe2/{league}` and the site URL as `https://www.pathofexile.com/trade2/search/poe2/{league}/{id}`. Three things follow that the spine does not record:

1. **There is a realm segment**, `poe2`, in both the API path and the site path. A builder given "a search id plus a league" will not produce a working URL.
2. **League ids contain spaces** (`Forbidden Rites`, `Runes of Aldur`), so the league segment must be percent-encoded. This is exactly the class of detail that two builders get differently, which is what this document exists to prevent.
3. AD-25's catalogue table lists the four data endpoints without a realm segment (`/api/trade2/data/items` etc.) — *verified live*, those genuinely do **not** take a realm. So the realm is present on `search`/`fetch` and absent on `data/*`, an asymmetry worth stating once rather than rediscovering.

**Related, and cheaper than it looks.** Community documentation gives the fetch endpoint as `GET /api/trade2/fetch/{ids}?query={searchId}` — that is, **AD-16's fetch already requires the search id**. `lastSearchId` is therefore not a new thing `sync` has to go and capture; it is a value `sync` necessarily already holds at fetch time. The spine should say so, because a builder reading AD-16 as written could discard the identifier after the fetch and then have to re-derive it. Stating the dependency also makes revision 9's cost claim ("adds no ninth fetched artifact") concretely true rather than merely asserted.

**What I could not confirm.** The **field name** on the search response that carries the identifier. Community sources disagree — one gives `id`, another `tradeId`. No primary source was reachable. `contracts` must not guess this; it needs one live capture, which AD-13's fixture recording command produces anyway.

**Recommendation.** Add the URL template to AD-24 verbatim, with the realm segment and an explicit percent-encoding rule for the league; add a one-line note to AD-16 that the identifier is the same value the fetch's `query` parameter takes; and record the response field name as pending a fixture rather than naming it now.

---

## F4 — AD-25's "flat global list" description of `/data/stats` is structurally wrong — **medium**

Not a revision-9 edit, but it is load-bearing for revision 9, because AD-24 now leans on the stat-text path as a justification (see F1) and `web` parses this artifact.

AD-25 states: "Verified 2026-09-12: `/data/stats` is a flat global list of 3,108 explicit stat ids, each of the form `{id, text, type}` and nothing more."

*Verified live 2026-09-13*: the response is **not flat**. `result` is an array of **category groups**, each `{id, label, entries[]}` — `pseudo`, `explicit`, and others — with the `{id, text, type}` entries nested one level inside. A builder who codes to "flat global list" writes the wrong parser and fails on the real payload. The correct statement is that the stat ids are globally unique across the groups (which is what makes them usable as an identity authority), and that the grouping is presentational.

I could **not** re-verify the **3,108** count; the fetch is large enough that the reading tool summarised rather than enumerated, and its rough estimate disagreed with 3,108 by enough that I treat neither number as established. The count is also patch-volatile by AD-25's own argument, so it should be phrased as "measured 2026-09-12, expected to move at patch cadence" rather than as a fact the document carries forward.

Related and unresolved: AD-16 asserts "`data/items` groups only ten coarse labels". *Verified live* that `data/items` entries do carry a `type` field holding the base type name, exactly as the Consistency Conventions *Ids* row requires — but the payload truncated before I could count the groups, so **the "ten coarse labels" figure is unconfirmed**. The argument built on it (that no committed artifact maps a base type to its leaf category, so `sync` must use `query.type`) does not depend on the exact number, so this is a labelling risk rather than a design risk.

---

## F5 — Stack table: all current bar one, and the TypeScript 7 trigger holds — **low**

Re-verified today against the npm registry and `nodejs.org/dist/index.json`:

| Spine pin | Current | Verdict |
| --- | --- | --- |
| Node.js 24.21.0 (Krypton LTS) | 24.21.0, released 2026-09-07, codename Krypton | **correct**, and the codename is right. Node 26.8.2 is Current but not yet LTS, so 24 is the right choice for a zero-upkeep host. |
| TypeScript 6.0.3 | 6.0.3 is the newest 6.x (`typescript@^6` resolves 6.0.2, 6.0.3); registry `latest` is 7.0.2 | **correct** |
| pnpm 12.4.1 | 12.4.1 | **correct** |
| React 19.3.0 | 19.3.0 | **correct** |
| Vite 8.3.0 | 8.3.0 | **correct** |
| `@mantine/core` / `@mantine/hooks` 9.6.1 | 9.6.1 / 9.6.1 | **correct**, and matches the project's own instruction to build on Mantine v9 |
| Zod 4.6.4 | 4.6.4 | **correct** |
| Vitest 5.0.0 | 5.0.0 | **correct** |
| MSW 2.15.0 | 2.15.0 | **correct** |
| ESLint 10.10.0 + typescript-eslint 8.70.0 | 10.10.0 / 8.70.0 | **correct** |
| dependency-cruiser 18.2.0 | **18.3.0** | **stale by one minor** |

**The TypeScript 7 upgrade trigger re-verifies clean, and both blockers still bind:**

- `typescript-eslint` — `@typescript-eslint/typescript-estree@8.70.0` declares `peerDependencies: { typescript: '>=4.8.4 <6.1.0' }`. The canary tag is still `8.70.1-alpha.0`, exactly as the spine recorded on 2026-09-12. **Unchanged.**
- `dependency-cruiser` — and this is the part worth correcting rather than merely noting: **18.3.0**, the version the spine has not yet caught up to, still declares `supportedTranspilers.typescript: ">=2.0.0 <7.0.0"`. So the newer release does *not* lift the blocker. The spine's conclusion survives; only its version number is stale. (18.3.0's `engines` is `^22||^24||>=26`, which the pinned Node 24.21.0 satisfies.)

**Recommendation.** Bump the `dependency-cruiser` row to 18.3.0 and re-date the blocker table's "verified" stamp to 2026-09-13, noting that the constraint was re-checked against 18.3.0 specifically — otherwise a future reader will assume the blocker was only ever checked against a version that has since moved.

---

## What I could confirm, and what I could not

**Confirmed by live fetch today:** `trade2` is alive and answers unauthenticated (`data/leagues`, `data/stats`, `data/static`, `data/items` all returned content without a session), which re-validates AD-15's footnote and AD-8's premise a day on. `data/leagues` carries a `realm: "poe2"` field. `data/static` carries currency ids, labels and `image` paths and **no** stat text. `data/stats` carries `{id, text, type}` entries **nested inside category groups**. `data/items` entries carry a `type` base-type string.

**Confirmed by a GGG staff statement:** trade query links expire after roughly six months without usage.

**Confirmed against the npm registry:** every stack version above, and both TypeScript 7 blockers.

**Could not confirm:** the exact field name carrying the search identifier in the `trade2` search response; what the trade site renders for an expired or unknown search id; the 3,108 stat-id count; the "ten coarse labels" count in `data/items`. None of these needs a guess — the first three fall out of the fixture recording AD-13 already mandates, and the fourth from the catalogue refresh AD-25 already mandates. The correct move is to mark them as pending capture rather than to carry them as verified.

**Not in scope of this lens, and deliberately untouched:** the internal consistency of AD-17/AD-18/AD-28/AD-29, which earlier gates have already worked over.

---

## Sources

- [Expiration time of a trade website query link — Path of Exile forum (GGG staff reply)](https://www.pathofexile.com/forum/view-thread/3524729)
- [awakened-poe-trade issue #1573 — "Failed to load the search state. The search is no longer valid"](https://github.com/SnosMe/awakened-poe-trade/issues/1573)
- [Path of Exile Developer Docs](https://www.pathofexile.com/developer/docs)
- [PoE 2 Trade Site Guide — Mobalytics](https://mobalytics.gg/poe-2/guides/poe2-trade-site)
- [Trade Search Integration Guide — poe2-mcp docs](https://glama.ai/mcp/servers/@HivemindOverlord/poe2-mcp/blob/27a007d214fe78de40962d230467161b5e81a074/docs/guides/TRADE_SEARCH_GUIDE.md)
- [zenojunior/poe2-trade-api](https://github.com/zenojunior/poe2-trade-api)
- [klayveR/poe-api-wrappers](https://github.com/klayveR/poe-api-wrappers)
- Live endpoints fetched 2026-09-13: `https://www.pathofexile.com/api/trade2/data/leagues`, `.../data/stats`, `.../data/static`, `.../data/items`
- npm registry, 2026-09-13: `typescript`, `react`, `pnpm`, `vite`, `zod`, `vitest`, `msw`, `eslint`, `typescript-eslint`, `@typescript-eslint/typescript-estree`, `dependency-cruiser`, `@mantine/core`, `@mantine/hooks`
- [nodejs.org/dist/index.json](https://nodejs.org/dist/index.json)
