# Verification Review — ARCHITECTURE-SPINE.md

**Reviewer role:** verification (was every committed decision web-researched or reality-checked, rather than asserted from training data?)
**Target:** `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md`
**Date of review:** 2026-09-12
**Method:** live `npm view <pkg> version` against the npm registry, `nodejs.org/dist/index.json`, and web search / fetch against GGG's developer docs, GitHub docs and ecosystem reporting.

---

## Verdict

The **Stack table is exceptionally well verified** — every one of the nine npm versions is the exact current `latest` dist-tag, and the Node pin is the newest 24.x with the correct LTS codename. That is not a training-data artifact; it was checked.

The **claims about external systems are where the document is weakest.** Two load-bearing assertions about GGG's API — the one the entire zero-secret, static architecture rests on — are unverified against primary sources and at least one is contradicted by them.

---

## 1. Stack table — version verification

Every version was checked against the live npm registry today. Result:

| Name | Pinned | npm `latest` today | Verdict |
| --- | --- | --- | --- |
| Node.js | 24.21.0 (Krypton LTS) | 24.21.0, released 2026-09-07 | **Exact match.** Codename "Krypton" confirmed correct for the 24.x line via `nodejs.org/dist/index.json`. Newest 24.x, 5 days old. |
| TypeScript | 7.0.2 | 7.0.2 | Match — but see Finding V-2. |
| pnpm | 12.4.1 | 12.4.1 | Exact match. |
| React | 19.3.0 | 19.3.0 | Exact match. |
| Vite | 8.3.0 | 8.3.0 | Exact match. `previous` tag is 7.3.6. |
| Mantine | 9.6.1 | 9.6.1 | Exact match. |
| Zod | 4.6.2 | 4.6.2 | Exact match. |
| Vitest | 5.0.0 | 5.0.0 | Match — but see Finding V-3. |
| MSW | 2.15.0 | 2.15.0 | Exact match. |
| dependency-cruiser | 18.2.0 | 18.2.0 | Exact match. |

**Nothing in the Stack table is stale or wrong.** This is a strong result and the author clearly did check. The remaining risk is not staleness but *recency* — several of these are majors that landed very recently, and the document commits to them with no stated fallback.

### Cross-major compatibility — checked against published peer metadata

All of the following were read from the registry, not assumed:

- **Vitest 5.0.0 → Vite 8**: `peerDependencies.vite = "^6.4.0 || ^7.0.0 || ^8.0.0"`. Vite 8.3.0 satisfies. **Compatible.**
- **Vitest 5.0.0 → Node**: `engines.node = "^22.12.0 || ^24.0.0 || >=26.0.0"`. Node 24.21.0 satisfies. **Compatible.**
- **Vite 8.3.0 → Node**: `engines.node = "^20.19.0 || >=22.12.0"`. **Compatible.**
- **Mantine 9.6.1 → React 19**: `peerDependencies = { react: "^19.2.0", react-dom: "^19.2.0" }`. React 19.3.0 satisfies. **Mantine 9 does support React 19** — confirmed, and in fact *requires* it (React 18 is no longer a supported peer). Note `@mantine/hooks` is pinned to the exact same version `9.6.1`; the Stack table lists them together, which is correct.
- **Vite 8 → React plugin**: the current `@vitejs/plugin-react` is 6.1.1 with `peerDependencies.vite = "^8.0.0"`. **Compatible**, but note this package is *not listed in the Stack table* — a React-on-Vite build needs it, and its major moves independently. See Finding V-5.
- **MSW 2.15.0 → Vitest 5**: MSW declares only `peerDependencies = { typescript: ">= 4.8.x" }` and `engines.node = ">=18"`. It has no Vite/Vitest coupling — MSW 2 is runtime-interception, wired in via setup files, so **there is no version conflict with Vitest 5.** Confirmed compatible.
- **dependency-cruiser 18.2.0 → Node**: `engines.node = "^22||^24||>=26"`. **Compatible.**

### Technologies still exist / maintained / fit their role

All ten are live, actively published packages at current majors. None is deprecated, renamed, or abandoned. Each fits its stated role:

- Zod 4 as the single schema source with `z.infer` derivation (Consistency Conventions, AD-3) is exactly Zod's intended use.
- dependency-cruiser is the correct and conventional tool for mechanically enforcing AD-2's import graph in CI.
- MSW 2 for replaying recorded HTTP fixtures (AD-13) is its core use case.
- Mantine for a static data-dense view is appropriate.

---

## 2. Findings

### V-1 — HIGH — "The trade API is used unauthenticated" is load-bearing and is contradicted by the sources I could reach

The document asserts this in **three** places and builds the architecture on it:

- System view: `trade[PoE2 Trade API<br/>unauthenticated]`
- Deployment: "no secret material (the trade API is used unauthenticated)"
- Deferred: "`POESESSID` would raise the rate limit but adds a rotting credential."

That last line frames POESESSID as a *performance* upgrade. The evidence I found points the other way: community client libraries and integration guides for the PoE trade endpoints state that the trade API is reached through the **Session API** and that **POESESSID is required**, not optional; GGG's own developer docs describe the Public API, OAuth 2.1, and a POESESSID-based Session API, and do not document a public unauthenticated trade endpoint at all. Separately, there are many reports of `pathofexile.com` API requests returning **Cloudflare 403s** to automated third-party clients, with GGG support directing people to Cloudflare.

This is the single highest-leverage unverified claim in the document, because:

- **AD-15** ("no authenticated request", "no secret material") and the whole zero-upkeep premise depend on it.
- If POESESSID turns out to be required, it is not a deferred optimisation — it is a **rotting credential in the critical path**, which changes the Deployment section, the Config convention ("a small env overlay for the contact `User-Agent`" becomes secret handling), and arguably AD-7's "a CI runner must be a valid invoker" (a CI runner would now need a secret, and a session cookie in CI is materially worse than one on the player's own machine).

**Recommended action:** before any of `sync` is built, make one real unauthenticated request to the PoE2 trade2 search endpoint from a clean machine with a descriptive User-Agent and record the status code as a committed fixture. This is a ten-minute spike that de-risks the largest assumption in the architecture. If it 403s, the Deferred entry must be promoted into an AD.

### V-2 — HIGH — TypeScript 7.0.2 is a genuinely risky pin: the stable compiler API does not land until 7.1

TypeScript 7.0 is the Go-native compiler rewrite, GA'd 2026-07-08 — roughly two months old. It is correctly the `latest` tag. But the ecosystem situation is specific and material:

- **TS 7.0 ships without a stable programmatic compiler API**; that is slated for **7.1 (Autumn 2026)**. `next` is currently `7.1.0-dev.20260912.1`, so 7.1 is in flight but not released.
- Consequently **typescript-eslint closed its TS7-support request as "not planned"** for now and **ESLint core is blocked behind it**. Anything that imports the compiler as a library must stay on 6.0, via Microsoft's `@typescript/typescript6` compatibility package (which provides a `tsc6` binary).
- TS 7.0 also **turns 6.0's deprecations into hard errors**, with `strict` and `esnext` as defaults. Microsoft's own guidance is to adopt 6.0 first, then step to 7.0.

Impact on *this* stack specifically:

- **Vite 8 and Vitest 5 are fine** — they transpile via esbuild/oxc and never type-check, so they do not touch the compiler API.
- **dependency-cruiser 18.2.0 is fine on this axis** — I checked its dependency tree and it has **no `typescript` dependency at all** (it parses via `acorn` / `acorn-jsx` / `watskeburt`). AD-2's CI enforcement is therefore not blocked by TS 7.
- **Linting is the exposed surface.** The document never names a linter, but any real project will want one, and ESLint + typescript-eslint is currently the blocked path. The spine is silent on this, so the conflict is invisible to a builder until they hit it.

**Recommended action:** either (a) state explicitly that the project type-checks with `tsc` 7 and lints with something that does not use the compiler API (e.g. oxlint / Biome), or (b) pin TypeScript 6.x for now and note 7.x as a fast-follow once 7.1 ships. Do not leave this unstated — an agent building `web` in a worktree will pick ESLint by reflex and lose a day.

### V-3 — MEDIUM — Vitest 5.0.0 is days-to-weeks old and the 4.x line is still maintained

Vitest 5.0.0 is `latest`, but the dist-tags show `V4: 4.1.11` and `V3: 3.2.7` still being published, and the 5.0.0 line's `rc` (`5.0.0-rc.4`) and `beta` (`5.0.0-beta.7`) tags are recent. Pinning `5.0.0` exactly — the `.0` of a brand-new major — is the highest-variance choice in the table, and AD-13 makes the test path the mechanism that keeps unattended agent development working. A bad interaction here is a project-stopper, not an inconvenience.

Note the peer constraint is satisfied (`vite: ^6.4.0 || ^7.0.0 || ^8.0.0`), so there is no *known* incompatibility — this is recency risk, not a detected conflict. Also worth noting: Vitest 5's companion packages (`@vitest/coverage-v8`, `@vitest/ui`) are peer-pinned to the **exact** version `5.0.0`, so they must be bumped in lockstep. The Stack table does not mention them.

**Recommended action:** pin `^5.0.0` rather than `5.0.0`, or state the 4.1.x fallback.

### V-4 — MEDIUM — AD-8's rate-limit header list is incomplete and one named header is not a real header name

AD-8 says the client "parses `X-Rate-Limit-Policy` / `-Rules` / `-Client` from every response". Against GGG's developer docs, the documented header set is:

- `X-Rate-Limit-Policy`
- `X-Rate-Limit-Rules`
- `X-Rate-Limit-{rule}`
- `X-Rate-Limit-{rule}-State`
- `Retry-After`

Two problems:

1. **`X-Rate-Limit-Client` is not a fixed header name.** `client` is one of the *possible values* in the comma-delimited `X-Rate-Limit-Rules` list (alongside `ip` and `account`); the header name is derived from whatever rules that list actually contains. Hardcoding `-Client` is exactly the "no rate is hardcoded" mistake AD-8 is trying to prevent, one level up. The rule set must be read from `-Rules` and the header names built from it.
2. **The `-State` headers are missing, and they are the ones that matter.** `X-Rate-Limit-{rule}` carries the *limit* (three colon-separated numbers); `X-Rate-Limit-{rule}-State` carries the *current consumption* plus the seconds to wait until the restriction expires. A governor that reads only the policy and the rules, and not the state, cannot know how much budget is left. AD-8's "on an exhausted bucket it backs off" is unimplementable from the headers it names.
3. **`Retry-After` is not mentioned** despite AD-8 explicitly handling 429s.

The *substance* of AD-8 — one governed client, adapt to live policy, never hardcode a rate — is correct and well-judged. The header list is the part that was written from memory.

**Recommended action:** replace the header list in AD-8 with `X-Rate-Limit-Policy`, `X-Rate-Limit-Rules`, and the rule-derived `X-Rate-Limit-{rule}` / `X-Rate-Limit-{rule}-State` pairs, plus `Retry-After`.

### V-5 — MEDIUM — GitHub Pages will not build a Vite bundle from a commit; the stated deploy mechanism does not work as written

The Deployment section states: "That commit triggers the GitHub Pages build, which is the deploy." The Stack table says "Hosting | GitHub Pages (deploy is the sync commit)".

Per GitHub's own docs, publishing from a branch runs **Jekyll only**. There is no Node/Vite build. A Vite + React + Mantine bundle reaches Pages one of two ways: an **Actions workflow** that runs the build and deploys the artifact (GitHub's recommended path), or by **committing the built `dist/`** to the publishing branch or a `docs/` folder. Neither is what the sentence describes, and neither is in the Source tree (there is no `.github/workflows/`, and `dist` is not in the tree).

This interacts badly with the sync design: the sync commit changes `data/dataset.json`, which is a **data** file. For the published site to reflect it, either the site fetches `dataset.json` at runtime as a static asset (fine, and probably the intent — but then the "deploy" is just the file landing, and no build is involved), or the bundle must be rebuilt (which needs the workflow). **The document does not say which, and the two have different Source tree and CI consequences.** An agent building `web` will guess.

One related fact worth recording since it affects the Actions option: commits pushed *by* a workflow using `GITHUB_TOKEN` do not trigger further Pages builds. Sync commits here come from the player's machine under their own credential, so this does not bite — but it is a real constraint if sync ever migrates to a hosted runner (which the Deferred section contemplates).

**Recommended action:** state explicitly that `web` fetches `data/dataset.json` as a runtime static asset, so the sync commit needs no rebuild; and add the one-line Actions workflow for the *bundle* build to the Source tree.

### V-6 — MEDIUM — GGG's documented User-Agent format is not the one AD-8 specifies

AD-8 requires "the GGG-requested descriptive `User-Agent` of the form `tool-name, contact@email`".

Both forms are attested, and this needs a deliberate choice rather than the current single assertion:

- **GGG's developer docs** specify `OAuth {clientId}/{version} (contact: {contact}) ...`, e.g. `OAuth mypoeapp/1.0.0 (contact: mypoeapp@gmail.com) SomeOptionalThingHere`. This is the documented requirement for the documented (OAuth) API surface.
- The `tool-name, contact@email` form **is** a real, widely-used convention cited by third-party PoE client libraries as "requested by GGG" for non-OAuth use.

So AD-8 is not wrong, but it is stated as *the* GGG-requested form when GGG's own docs say something else for their documented API. Given Finding V-1 — if POESESSID or OAuth turns out to be required, the OAuth-form UA becomes mandatory — this should be resolved at the same time as V-1.

**Recommended action:** record both forms and the condition under which each applies; make the UA a config value, not a literal in the adapter.

### V-7 — LOW — "HasExplicitMod does not exist in PoE2's filter syntax" is not in the document, and as a belief it appears to be wrong

I was asked to verify this claim. **It does not appear anywhere in ARCHITECTURE-SPINE.md** (grep for `HasExplicitMod`, `filter syntax`: no hits). The only adjacent content is the Deferred entry "Loot filter export, rare items, augment advice, accounts. Out of v1 by the brief" — which is justified by *scope*, not by a syntax limitation.

For the record: GGG's official item filter documentation **does list `HasExplicitMod`**, with numeric-count syntax (`HasExplicitMod >=2 "of Haast"`), on a page that explicitly annotates PoE2-only conditions — implying `HasExplicitMod` is not PoE2-exclusive-or-absent. I could not find a source stating PoE2 lacks it, and the community filter tooling (FilterBlade) covers both games.

So: if this belief exists in the team's head, it is likely wrong and would wrongly foreclose a future loot-filter-export feature. Since the Deferred rationale is scope-based, **nothing in v1 is affected** — hence LOW. But do not let "PoE2 has no HasExplicitMod" enter a later document unchecked.

### V-8 — LOW — GitHub Actions time limits are asserted nowhere, which is correct, but AD-7's motivation is now unsourced

I was asked to verify claims about GitHub Actions job time limits. **The document makes none** (no hits for "GitHub Actions", "6 hour", "360 min"). AD-7 refers only to "a host's wall-clock ceiling" in the abstract and says "a CI runner must be a valid invoker".

For the record, and confirmed against GitHub's docs today: **6 hours per job** on hosted runners (job is terminated and fails), and **35 days per workflow run** including waiting and approval time.

AD-7's abstraction is the right call architecturally — it deliberately avoids binding to one host's number. No change needed. Recording the real figure here so the next document does not have to guess: the ceiling AD-7 is defending against is **6 hours**.

---

## 3. What was NOT confirmed against the web, and should be

Flagging these explicitly, per the review's remit:

| Claim | Where | Status |
| --- | --- | --- |
| PoE2 trade API usable unauthenticated | System view, Deployment, Deferred | **Contradicted / unresolved.** See V-1. Highest priority. |
| `X-Rate-Limit-Client` is a header the client parses | AD-8 | **Wrong as written.** See V-4. |
| GGG-requested UA is `tool-name, contact@email` | AD-8 | **Partially confirmed**, but not GGG's documented form. See V-6. |
| "That commit triggers the GitHub Pages build, which is the deploy" | Deployment | **Not how Pages works** for a Vite bundle. See V-5. |
| "The trade API has no tier concept" | AD-5 | **Not verified.** This is a strong, load-bearing claim about the trade API's query model — the entire `(statId, valueMin)` identity in AD-5 rests on it. It is plausible and matches how the PoE trade stat filters work (numeric min/max on a stat id), but I found no primary source confirming PoE2 trade exposes no tier filter. Verify against a live `trade2` query payload at the same time as V-1. |
| Trade API exposes stat ids usable as stable identity across patches | AD-5, AD-6 | **Not verified.** AD-6's entire failure mode ("a stat id the trade API no longer exposes") presumes stat ids can churn across patches, which is sensible, but the stability characteristics were not researched. Low risk — AD-6 handles it correctly either way. |
| RePoE / poe2db as external catalogues | AD-5 | **Not verified** that either currently publishes usable PoE2 data. AD-5 only mentions them as examples entering through an adapter boundary, so this is low-stakes, but if either is the actual planned source it needs checking. |
| Craft-recipe tier-distribution numbers | Open Questions | **Correctly flagged as unknown by the document itself.** Good — this is the model of how the other gaps should have been handled. |

---

## 4. What the document does well

Worth saying plainly, because the version discipline here is better than most:

- **Ten-for-ten on current npm versions.** Nothing stale, nothing hallucinated, nothing off by a patch. The Node codename is right. This was checked, not remembered.
- **Every cross-major pairing I tested actually holds.** Vitest 5 ↔ Vite 8, Mantine 9 ↔ React 19, dependency-cruiser 18 ↔ Node 24, MSW 2 ↔ Vitest 5. No compatibility landmines in the declared set.
- **AD-8's principle is correct even though its header list is not** — "parse the live policy, hardcode no rate" is the right instinct and survives the correction.
- **AD-7 deliberately refuses to bind to a host's time limit**, which is why V-8 found nothing to falsify. That is good architecture writing.
- **The Open Questions section names two real unknowns** rather than papering over them.

The pattern in the findings is consistent: **anything with a version number was verified; anything that is a sentence about how an external system behaves was not.** That is the gap to close.

---

## 5. Priority actions

1. **Spike the unauthenticated trade2 request** (V-1). One request, record the status code as a fixture. Everything else about secret handling, AD-15, and the Deferred POESESSID entry follows from the answer.
2. **Decide the TypeScript 7 lint story** (V-2), or step back to TS 6 until 7.1 ships.
3. **Fix AD-8's header list** (V-4) — add `-State` and `Retry-After`, derive rule names from `-Rules`.
4. **Say how the site actually deploys** (V-5) — runtime fetch of `dataset.json` plus an Actions build, and put the workflow in the Source tree.
5. **Loosen the Vitest pin** to `^5.0.0` and list the `@vitest/*` companions that must move in lockstep (V-3).

---

## Sources

- [npm registry](https://www.npmjs.com/) — via `npm view <pkg> version | dist-tags | peerDependencies | engines` for all ten packages
- [nodejs.org/dist/index.json](https://nodejs.org/dist/index.json)
- [Path of Exile Developer Docs](https://www.pathofexile.com/developer/docs)
- [Path of Exile Item Filter documentation](https://www.pathofexile.com/item-filter/about)
- [Limits in GitHub Actions](https://docs.github.com/en/actions/reference/actions-limits)
- [Configuring a publishing source for your GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Microsoft Releases TypeScript 7.0 with a Native Go Compiler (InfoQ)](https://www.infoq.com/news/2026/08/typescript-7-released/)
- [Why Angular, Vue, and ESLint Can't Upgrade to TypeScript 7.0 (Yet)](https://dev.to/the-modern-web/why-angular-vue-and-eslint-cant-upgrade-to-typescript-70-yet-and-why-ts-71-changes-441g)
- [TypeScript 7.0 RC Moves Microsoft's Go Rewrite Into the Mainline Compiler (Visual Studio Magazine)](https://visualstudiomagazine.com/articles/2026/06/22/typescript-7-0-rc-moves-microsofts-go-rewrite-into-the-mainline-compiler.aspx)
- [poe-api-ts](https://github.com/moepmoep12/poe-api-ts) — User-Agent convention and POESESSID requirement
- [Exiled-Exchange-2](https://github.com/kvan7/Exiled-Exchange-2) — PoE2 trade client prior art
- [API rate limit for trade searches (PoE forum)](https://www.pathofexile.com/forum/view-thread/3056323)
- [Blocked from Path Of Exile API (Cloudflare Community)](https://community.cloudflare.com/t/blocked-from-path-of-exile-api-but-not-allowed-to-contact-support/549055)
