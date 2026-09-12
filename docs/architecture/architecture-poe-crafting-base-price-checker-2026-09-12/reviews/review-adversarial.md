---
title: 'Adversarial Review — Architecture Spine'
target: ARCHITECTURE-SPINE.md
reviewer: adversarial lens
created: 2026-09-12
verdict: not-ready-to-build
---

# Adversarial Review — PoE2 Crafting Base Price Checker Architecture Spine

## Method

The spine is attacked as a build substrate, not as prose. The test applied throughout:

> Two AI agents, each handed one epic one level down, each working in an isolated git worktree, each with the spine and the brief and nothing else. Each obeys **every** AD to the letter. Do they meet in the middle?

Where the answer is no, the pair is named concretely: unit A, unit B, and the exact incompatible choice each is entitled to make. Every such pair is a hole that must be closed by a new or tightened AD before parallel work starts.

Assumed epic decomposition one level down (the spine implies it; it does not state it — see F-19):

| Unit | Scope |
| --- | --- |
| **U-CONTRACTS** | Zod schemas, derived types, port interfaces |
| **U-CORE** | probability, threshold-truncated EV, provenance, craft cost |
| **U-SYNC-CLIENT** | governed trade client, rate-limit governor, fixtures |
| **U-SYNC-RUNNER** | chunk runner, resumption, dataset writer, run report, commits |
| **U-WEB** | static Mantine view, read-time ranking, threshold dial |
| **U-WEIGHTS** | weights-file schema + uniform-prior file |
| **U-CURATION** | tracked-list file, prune/pin, budget reporting |

Severity scale: **CRITICAL** — silently produces wrong numbers, or the two halves cannot be merged at all. **HIGH** — a visible defect or a rework-sized collision. **MEDIUM** — divergent but recoverable. **LOW** — polish.

---

## Verdict

**Not ready to build in parallel.** The spine is unusually strong on *direction* (AD-1, AD-2, AD-3, AD-15 are real, enforceable, and prevent the failure modes they name) and unusually weak on *arithmetic*. The document declares that valuation is the product and then never pins a single one of valuation's operational definitions: what is summed, what the threshold compares against, in what unit, how a tier-band tracked identity maps onto a per-modifier weights file, what the normalisation denominator is, or how craft cost is obtained and subtracted. Two competent agents will produce two different rankings from the same dataset and both will pass CI.

Beneath that, three structural defects: **AD-3 is contradicted by the spine's own system diagram** (the run report is a second sync→web channel), **AD-6 is contradicted by AD-9** (AD-6 mandates an error state that AD-9's tri-state has no member for), and **`contracts` — the one package AD-3 makes load-bearing — has no owner** while AD-2 actively funnels every agent into editing it.

---

## Findings

### F-1 — CRITICAL — The threshold has no defined comparand and no defined unit

**AD-4** names `threshold` as an input to the ranking function. Nothing in the spine says what it is compared against or what it is measured in. The brief says "sum `P(combination) × price(combination)` across only those combinations at or above the threshold, then subtract the full cost of the craft" — but the brief is a source, not a binding contract, and the spine is what the agents build to. Three readings survive every AD:

- **(a)** include combination `c` iff `price(c) >= threshold`
- **(b)** include `c` iff `price(c) - craftCost >= threshold` (net-per-outcome — defensible from "outcomes below the player's payout threshold are worth nothing to him", since an outcome that cost 0.3 div to produce and sells for 0.3 div paid nothing)
- **(c)** include everything, then suppress *bases* whose final score is below threshold

**The pair.** U-CORE implements (a) and exports `scoreBase(dataset, weights, threshold, recipe)`. U-WEB, building the expandable combination list and the "counted / not counted" affordance that the brief's central control demands, renders the inclusion badge under (b). The two disagree about which rows are in the sum, on screen, for every base. Neither violates an AD.

**Second axis: unit.** The Currency convention pins *prices* to divine. It says nothing about the threshold. The brief quotes thresholds in both divine ("a quarter of a divine", "≥1 divine") and exalts ("outcomes of 1–2 exalts are worth nothing"). U-WEB ships a dial calibrated in exalts because that is the resolution the player thinks in at 0.25 div, persists `threshold: 40` to browser storage per AD-15, and passes it to `scoreBase`. U-CORE compares 40 against divine-denominated prices and every base ranks at zero. This is a silent, total failure that no test catches, because U-CORE's tests use literal divine inputs and U-WEB's tests use MSW-served datasets with a stubbed score function.

**Third axis: boundary.** `>=` or `>`. The brief says "at or above"; the spine does not restate it. Off-by-one at exactly the dial's detent value — the single most likely value for a user to sit on.

**Close with:** an AD fixing `threshold` as a divine-denominated scalar, compared with `>=` against the combination's gross `priceDivine`, before craft cost; craft cost subtracted once from the truncated sum, never per-outcome.

---

### F-2 — CRITICAL — The tracked identity is a tier *band*; the weights file is per *modifier*. Nothing maps one to the other

**AD-5** fixes identity as `(baseTypeId, {prefix: (statId, valueMin), suffix: (statId, valueMin)})` and states "'tier 1–2' exists only as a numeric floor on a stat." **AD-11** says the weights file carries "raw game spawn weights only, per base type and affix slot," and that converting weights to probabilities "happens in `core`."

These two shapes do not compose, and the spine never says how they compose. A single `statId` (e.g. *increased Spell Damage*) has many tiers, each with its own value range and its own spawn weight. A tracked entry `(statId, valueMin: 40)` is a *predicate over tiers* — it matches T1 and T2 and not T5. Therefore:

```
P(tracked prefix entry) = ( Σ weight(t) for tiers t of statId where t.valueMin >= entry.valueMin )
                          / ( Σ weight(u) for ALL eligible prefix tiers u on baseTypeId )
```

Nothing in the spine states this. It states neither the numerator's summation nor the denominator's pool.

**The pair.** U-WEIGHTS designs the schema keyed by `(baseTypeId, slot, statId, tierMinValue) -> weight`, one row per tier — the only shape that can represent game data, and the only shape AD-5 permits since it re-encodes nothing. U-CORE, reading AD-5's "A tracked combination is identified by `(statId, valueMin)`" and "no component may introduce a second modifier identity," implements weight lookup as a **direct key hit** on `(statId, valueMin)`. Every lookup misses for every entry whose floor does not coincide exactly with a tier boundary, and by F-5 below those misses become `absent` provenance, and the entire ranking silently collapses to the subset of entries that happened to align.

A second, subtler variant of the same pair: U-CORE-A sums tier weights above the floor (correct). U-CORE-B takes the weight of the *single highest* tier at or above the floor (a defensible reading of "tier 1–2" as "the T1 row"). The two produce probabilities differing by 2–5× on any stat with a deep tier ladder, which reorders the list.

**This is the largest hole in the document.** It sits precisely at the seam between the two units most likely to be built in parallel (weights schema and core valuation), and it is invisible until numbers are compared against a hand-worked example that nobody is required to produce.

**Close with:** an AD stating the tier-band semantics of `valueMin` explicitly, the numerator as a sum over matching tiers, and the denominator as the full eligible tier pool for `(baseTypeId, slot)` including tiers below the tracked floor and including stats that are not tracked at all.

---

### F-3 — CRITICAL — The normalisation denominator is unspecified in two independent ways

**AD-11** says "normalising over the eligible pool for a `(base, slot)`". Two ambiguities ride inside that phrase.

**(i) Does the eligible pool include untracked modifiers?** The tracked list is a curated subset chosen for budget reasons (AD-12). The *spawn* pool is the game's full mod list for that base. If U-CORE normalises over the tracked subset, every probability is inflated, the probabilities sum to 1 across a list the player pruned for cost reasons, and **pruning a junk combination raises the score of every other combination on that base** — a curation action silently changing the ranking, which is the opposite of what AD-12 intends. If U-CORE normalises over the full game pool, probabilities sum to well under 1 and the weights file must carry rows for modifiers the app never prices.

**The pair.** U-CURATION builds prune tooling on the premise that pruning removes a combination from consideration and changes nothing else (AD-12: "pruning combinations known to be worthless so they never consume capacity" — capacity, not score). U-CORE normalises over what it can see, which after `sync` is the tracked list. Player prunes twenty junk combinations off a wand; the wand jumps four places. Both units obeyed AD-11 and AD-12 to the letter.

**(ii) The two-mod joint probability is never defined.** A magic item reaches "one prefix + one suffix" via transmute (one mod) then augment (the other). The slot of the *first* mod is itself an outcome. Two readings:

- **Independent-slots:** `P(p,s) = w(p)/W_prefix × w(s)/W_suffix`. Simple, and what "normalising over the eligible pool for a (base, slot)" most literally says.
- **Sequential-draw:** the transmute draws from the *combined* prefix+suffix pool; the augment then draws from the remaining slot's pool. `P(p,s) = [w(p)/(W_pre+W_suf)] × [w(s)/W_suf] + [w(s)/(W_pre+W_suf)] × [w(p)/W_pre]`.

These differ by a base-dependent constant factor whenever `W_prefix ≠ W_suffix`, which is always. Because the factor is per-base, it **does not cancel in the ranking** — it reorders bases against each other. U-CORE picks one; U-WEIGHTS' uniform-prior file is generated under the other's assumption about what "eligible pool" means; the result is a plausible-looking list that is wrong in a way no test asserts against.

**Close with:** an AD writing the joint-probability formula out in full, naming the denominator's membership rule, and stating that pruning must not alter any probability.

---

### F-4 — CRITICAL — AD-6 mandates an error state that AD-9's tri-state cannot represent

**AD-6:** an unresolvable stat id "fails that entry explicitly and records it in the run report as an error state. It is never skipped, never defaulted, never treated as zero listings."

**AD-9:** "Every combination's price is one of `priced` (with a value), `no-listings`, or `not-yet-synced`."

There is no fourth member. So when a game patch removes a stat id:

**The pair.** U-SYNC-RUNNER-A writes `state: 'unresolvable'` into the dataset. AD-3 requires `sync` to validate against the `contracts` schema before writing; the schema — authored by U-CONTRACTS from AD-9's closed three-member list — rejects it. Per the Error-shape convention, `sync` "throws only for genuinely unrecoverable run failures", so the agent must decide whether a schema rejection is unrecoverable; either it crashes the run (one dead stat id halts all syncing forever) or it swallows and drops the entry — "never skipped" violated.

U-SYNC-RUNNER-B reads AD-6 as satisfied by the *run report alone* ("records it in the run report") and leaves the dataset entry untouched. The entry keeps its last-good `priced` value with an old timestamp. A modifier that no longer exists in the game continues to rank #1, forever, backed by a real price. **This is precisely the silent disappearance AD-6 was written to prevent** — achieved by obeying AD-6 literally.

There is a third gap underneath: AD-6 gives no lifecycle. Does an unresolvable entry stay unresolvable on the next run, or is it retried? Does it revert to `not-yet-synced`? U-WEB has no way to render it, because AD-9's enum is what U-WEB validates against.

**Close with:** a fourth dataset state (`unresolvable`, carrying the failing `statId` and the run it first failed in), an AD stating that the stale price is cleared when it is set, retry semantics, and AD-9 amended so the enum is exhaustive by construction.

---

### F-5 — CRITICAL — "Weights absent for an eligible modifier" has no defined behaviour, and the choices are mutually incompatible

**AD-10** admits `absent` as a provenance value. The addendum guarantees partial coverage. **No AD says what `core` does with it.** Four behaviours each satisfy every AD:

1. **Treat as zero.** The combination contributes nothing and vanishes from the sum — the exact conflation AD-9 forbids for *prices*, reintroduced for *weights* because no AD forbids it there.
2. **Fall back to uniform prior within the pool**, provenance degrades to `uniform-prior`. Defensible by analogy with the v1 uniform-prior file.
3. **Exclude from the denominator**, renormalising over covered modifiers only. Probabilities sum to 1 across a partial pool — every covered combination's probability is inflated by `1/coverage`.
4. **Exclude the whole base** from the ranking as un-scoreable.

**The pair.** U-CORE implements (3) — the most natural implementation, because it falls out of writing `w/Σw` over the map you were handed. U-WEB, building the AD-10 provenance affordance, renders a "weight coverage: 62%" chip computed from the same weights file and expects the base's probabilities to sum to 0.62; it presents the residual as the "unmeasured" band the addendum's *partial coverage must be visible* requirement implies. The two are describing different distributions. Worse, under (3) a base with one measured modifier and forty absent ones gets `P = 1.0` on that modifier and rockets to the top of the list — an artifact that looks exactly like a discovery.

Note also that AD-10's "propagates the weakest provenance" never states the ordering. `absent` weaker than `uniform-prior` weaker than `measured` is intuitive but unwritten, and a `absent`-means-"we deliberately know there is no mod here" reading inverts it.

**Close with:** an AD naming exactly one of the four behaviours, fixing the provenance total order, and — whichever is chosen — forbidding renormalisation that inflates covered probabilities.

---

### F-6 — CRITICAL — AD-3's "only contract" is contradicted by the spine's own system diagram

**AD-3:** "`sync` and `web` communicate through one published dataset artifact and nothing else — no shared module state, no second channel."

The System view diagram draws `report --> web`. The Logging convention states "The report is data the view can read." AD-10 requires `web` to "surface dataset age," and AD-6's error states are recorded *only* in the run report, so `web` must read the report to show them. **The run report is a second channel from `sync` to `web`, required by three other ADs and drawn in the structural seed.**

**The pair.** U-CONTRACTS, honouring AD-3 literally, defines a Zod schema for the dataset and *not* for `SyncRunReport` — AD-3 says the dataset is the only contract, and the Validation convention says validate "before dataset write, on dataset load," mentioning no report. U-SYNC-RUNNER therefore writes `sync-report.json` in a shape of its own choosing (it is "structured records"; nothing constrains the structure). U-WEB parses it with a hand-written interpretation to render AD-6 errors and AD-10 freshness — and the Validation convention's "types are `z.infer`red, never hand-declared in parallel" is now impossible to honour for the one artifact carrying the error surface.

Every symptom AD-3 exists to prevent now applies to the report, unguarded.

**Close with:** either (a) fold freshness and per-entry error state into the dataset and make the report strictly write-only diagnostics that `web` never reads — deleting the `report --> web` edge — or (b) amend AD-3 to "two published artifacts, both schema-pinned in `contracts`, both validated on write and on load." (a) is cleaner and keeps AD-3's teeth.

---

### F-7 — CRITICAL — `contracts` has no owner, and AD-2 funnels every unit into it

`contracts` is the package AD-3 makes the entire producer/consumer agreement depend on, and the one AD-2 names as the destination for all shared code: "Shared code goes *down* into `contracts` or `core`." The spine never says who owns it.

**The pair.** U-SYNC-RUNNER needs `SyncRunReportSchema` and a `ChunkCursor`; U-WEB needs a `RankedBase` type and a threshold type; U-WEIGHTS needs `WeightsFileSchema`; U-CORE needs `Provenance` and `PriceState`. All four, working in separate worktrees, add files to `packages/contracts/` and all four edit its barrel export. On merge: four-way conflict in the one file whose correctness the product depends on, resolved by whichever agent merges last, with no review step that understands all four intents. Worse than the conflict is the near-miss — two agents independently define `Provenance` in different files with different member sets, both compile, and `dependency-cruiser` (AD-2) reports nothing because no *edge* was violated.

This is the specific failure mode the brief's "parallel development across multiple git worktrees" hard requirement exists to avoid, and it lands on the highest-value file in the repo.

**Close with:** an AD making `contracts` a single-owner, change-by-proposal package — sequenced *before* any parallel epic starts, frozen during parallel work, and amended only by an explicit contract-change unit that all dependents rebase onto. Alternatively, one-schema-per-file with no barrel and a `dependency-cruiser` rule forbidding duplicate exported symbol names.

---

### F-8 — CRITICAL — Two owners of craft cost, and `CraftRecipe` has no home in the repo

The Brief Scope map says "Craft cost from currency prices | `sync` + `core` | AD-8, AD-1". That is two owners with no seam drawn.

**The pair.** U-SYNC-RUNNER reads "from currency prices" plus AD-1 ("no I/O in `core`") and concludes `sync` must resolve recipe cost to a divine figure and write `craftCostDivine` per recipe into the dataset. U-CORE reads AD-4 ("the dataset carries observations, never rankings or scores") and concludes a resolved craft cost is a derived figure, so `sync` publishes *currency observations* (`chaos→divine`, `exalt→divine`, `perfect-transmute-orb→divine`) and `core` multiplies them by the recipe's quantities. Both are defensible. The first produces a dataset the second cannot consume, and vice versa; neither schema validates against the other.

Underneath sit three further gaps:

- **`CraftRecipe` is a named core entity (Consistency Conventions, ER diagram) with no file in the Source tree.** `data/` holds `tracked.json`, `weights.json`, `dataset.json`, `sync-report.json`. There is no `recipes.json`. Yet AD-4 makes `recipe` an *input* to the ranking function, and the brief makes "base × recipe" the ranked unit. **An entity with no owner and no storage.** U-CORE hardcodes a recipe constant (AD-1 permits it — a literal is not config); U-WEB builds a recipe picker driven by a `data/recipes.json` it authors itself; U-SYNC prices currencies for a recipe list it invents.
- **No named source for the currency exchange rate.** The Currency convention says "normalised to a single unit (divine) at the adapter boundary, carrying the exchange observation used," but the trade API's currency exchange is a different endpoint and poe2scout was explicitly evaluated with "no reuse available." Whose port is this? AD-8 says all outbound trade traffic goes through one client, so presumably `sync` — but nothing says so, and the Open Questions do not flag it.
- **"Full cost of the craft" is ambiguous against the addendum's two-stage craft.** The addendum describes perfect-transmute everything, then perfect-augment only the promising. So expected cost per pickup is `transmuteCost + P(promising) × augmentCost`, not `transmuteCost + augmentCost`. The brief says "the full cost of the craft, paid on every attempt including the failures" — which supports the flat sum but contradicts the workflow the addendum documents. U-CORE-A implements flat; U-CORE-B implements conditional and must then invent `P(promising)`, which nothing supplies.

**Close with:** a `data/recipes.json` with a schema in `contracts`; an AD stating that `sync` publishes currency *observations* and `core` computes cost (or the inverse, explicitly); an AD defining cost as the flat per-attempt sum for v1 with the two-stage refinement deferred; and a named owner for the exchange-rate adapter.

---

### F-9 — CRITICAL — Concurrent sync runs are neither forbidden nor coordinated

**AD-7** says the syncer "makes no assumption about what invokes it, how often, or where it runs — Task Scheduler, cron, a VPS and a CI runner must all be valid invokers with no code change." Taken literally, this *forbids* assuming invocations are serialised. Nothing anywhere mandates a lock.

Concrete: Task Scheduler fires every 15 minutes. A run hits a 429, AD-8 backs off, the run lasts 22 minutes. Two syncers are now live. Both read `dataset.json`, both mutate their own in-memory copy, both write, both commit. Last writer wins and the first run's entire chunk is lost — silently, with a `SyncRunReport` claiming success. If both `git commit`, the second may fail on index lock, or produce two commits where the second reverts half the first.

**The pair.** U-SYNC-RUNNER-A assumes serial invocation (the deployment section says "invoked repeatedly," singular) and does a plain read-modify-write. U-SYNC-CLIENT-B, honouring AD-8's "adapts pacing to the live policy," implements backoff that can extend a run arbitrarily — the two assumptions are jointly false. Neither unit violates an AD.

Second variant: **sync racing a curation commit.** AD-12 says curation is "an edit and a commit." The player edits `data/tracked.json` in an editor while a sync run is mid-chunk. If U-SYNC-RUNNER commits with `git commit -a` or `git add data/`, it sweeps the player's half-finished tracked-list edit into a sync commit — corrupting the request budget and the git history AD-14 relies on. If it commits only named paths, the player's edit sits uncommitted and the *next* run reads a tracked list that git does not reflect, so AD-14's "git is the history" no longer reconstructs what was actually priced.

**Close with:** an AD mandating a single-writer lock (a lockfile with a PID/heartbeat, refusing to start if held), an explicit statement that the sync commit touches only `data/dataset.json` and `data/sync-report.json` by exact path, and a stated behaviour when the working tree is dirty.

---

### F-10 — CRITICAL — Resumption state has no defined location or shape

**AD-7:** "Progress is durable, committed state; a run that is killed loses at most the chunk in flight." The Source tree contains no progress file. So progress lives *somewhere* the two units must agree on.

**The pair.** U-SYNC-RUNNER-A adds `data/sync-state.json` holding a chunk cursor (`lastCombinationIndex`, `sweepId`, `sweepStartedAt`). U-SYNC-RUNNER-B (or a second agent building the budget report of AD-12) derives the next chunk implicitly: sort tracked combinations by `observedAt` ascending, take the oldest N — no cursor file, resumption is emergent, and `not-yet-synced` entries sort first. Both satisfy AD-7 exactly. They produce different repo contents, different commit shapes, and — critically — **different answers to "has a full sweep completed?"**, which F-11 and F-13 both need.

Note also that B's implicit scheme silently breaks the moment the tracked list is edited mid-sweep (AD-12 permits this at any time), and A's explicit cursor becomes stale for the same reason with no stated invalidation rule.

**Close with:** an AD naming the progress artifact, its schema in `contracts`, its invalidation rule when `tracked.json` changes, and the definition of a completed sweep.

---

### F-11 — HIGH — "Dataset age" is three different numbers on a chunked dataset

AD-7 guarantees the dataset is *always* a mix of observation ages — chunk 3 of 20 means today's prices for 15% of entries and yesterday's for the rest. AD-10 requires `web` to "surface dataset age." The spine never defines it.

**The pair.** U-SYNC-RUNNER writes a top-level `generatedAt` stamped at write time; U-WEB renders "updated 2 minutes ago" — a dataset where 85% of prices are a day old reads as fresh. Alternatively U-WEB computes age as `max(now - observedAt)` across entries and renders "23 hours old" on a dataset that just finished a chunk. Both obey AD-10.

The same ambiguity poisons AD-10's per-figure propagation: "the oldest timestamp of every input" — does a `no-listings` combination excluded from the sum by AD-9 still contribute its timestamp to the base's freshness? U-CORE-A propagates over summed inputs only; U-CORE-B over all inputs. Different freshness badges on the same base.

**Close with:** an AD defining dataset freshness as the oldest `observedAt` across all tracked entries, defining sweep completeness as a distinct published figure, and stating that excluded-by-AD-9 entries *do* contribute their timestamp to the base's freshness (they are inputs to the decision even when they contribute zero to the sum).

---

### F-12 — HIGH — The dataset's tri-state encoding is not pinned, and AD-3's fail-closed rule makes the mismatch fatal

AD-9 names three states; AD-3 says the shape is "a Zod schema in `contracts`" and that `web` "refuses to render an invalid dataset rather than degrading." The spine does not say whether the encoding is a discriminated union or a flat record with an optional field. In Zod these are materially different, and `JSON.stringify` silently drops `undefined`.

**The pair.** U-SYNC-RUNNER writes `{ state: 'no-listings' }` with the `priceDivine` key *omitted*. U-CONTRACTS (per F-7, authored by whoever needed it first) declares `priceDivine: z.number().nullable()` — required, nullable. Load fails. Per AD-3, `web` renders nothing at all. **A single missing-vs-null decision takes the entire product offline**, and AD-3's fail-closed rule — correct in principle — converts a cosmetic mismatch into a total outage.

Adjacent unpinned shapes, each its own pair: numeric precision on `priceDivine` (U-SYNC rounds to 3dp; U-CORE compares raw floats against a threshold — `0.2495` vs `0.25` flips inclusion at exactly the dial detent players sit on); `valueMin` as `10` vs `10.0` in a string key; timestamp format (the Dates convention says ISO-8601 UTC but not whether milliseconds are included, which changes string-sort behaviour).

**Close with:** an AD mandating discriminated unions over optional fields for every state-carrying shape in the dataset, `z.strictObject` throughout, a fixed decimal precision for `priceDivine` with the rounding mode named, and a stated `Z`-suffixed millisecond-precision timestamp format.

---

### F-13 — HIGH — Two builders compute different rankings from the same dataset: the core/web seam on ranking is undrawn

This is the question asked directly, and the answer is yes — in four independent ways beyond F-1 through F-5.

**AD-4** says "the ranked list is a pure function of `(dataset, weights, threshold, recipe)` evaluated in the browser." It says *where* it runs. It does not say *which package exports it*. The Brief Scope map says "Ranked base list | `web` + `core`" — two owners again.

**The pair.** U-CORE exports `scoreBase(...) -> number` only, on the reading that ordering is presentation. U-WEB therefore writes its own `.sort()`. Meanwhile U-CORE's own tests assert an ordering it never exports. Now:

- **Tie-breaking is unspecified.** With a uniform-prior weights file (the v1 shipping configuration!), ties are *common* — identical pool sizes produce identical probabilities. `Array.prototype.sort` is stable per spec but over an input whose order is itself the dataset's insertion order, which `sync`'s chunking reshuffles between runs. **The ranked list reorders between syncs with no data change.** U-WEB-A tie-breaks by `baseTypeId` lexically; U-WEB-B leaves it to sort stability.
- **Negative scores are undefined.** A base whose truncated EV is below craft cost scores negative — "do not pick this up." Does it appear at the bottom of the list, or is it filtered out? U-WEB shows it (informative); U-CORE's `rankBases` filters it (it is not a base worth chasing). Different lists.
- **"Chase modifiers" on the collapsed row is undefined.** The brief promises "a short ordered list of what to chase, with the modifier combinations to look for on each." Top-N by *price* (the jackpot to recognise) or top-N by *contribution* `P × price` (what actually drives the score)? And N = ? U-WEB-A shows top 3 by price; U-WEB-B shows top 3 by contribution. Completely different guidance to the player from identical data — and this is the product's primary output.
- **The expandable list's sort and filter are undefined.** Ascending price, descending contribution, tracked order? Are below-threshold combinations hidden or greyed? AD-9 requires unknowns be shown "outside the ranking" — as a separate section, an inline badge, a collapsed drawer? "Outside the ranking" is a semantic statement being asked to carry a layout decision.

**Close with:** an AD stating that `core` exports the total order — `rankBases()` returning a fully-ordered array with an explicit documented tie-break chain — and that `web` renders that array without re-sorting; plus a stated rule for negative scores, a defined "chase modifier" selection, and a defined combination-list ordering.

---

### F-14 — HIGH — White ilvl-82 bases are in scope, have no representable identity, and have no owner

The brief puts white ilvl-82 bases in v1. AD-5's identity requires a prefix and a suffix. The ER diagram marks both `}o--||` — mandatory. `TrackedCombination` is the only entity carrying a `PriceObservation`. **A white base has no modifiers, so under AD-5 it cannot be tracked, priced, or ranked.** The Open Questions flag the *ranking* treatment but not the representational impossibility, and the Brief Scope map assigns white bases to `core` under AD-9 — a package that by AD-1 cannot obtain a price.

**The pair.** U-CONTRACTS makes both slots required (the ER diagram says so) and U-CURATION cannot express a white base in `tracked.json` at all — it gets escalated or, worse, encoded with a sentinel `statId: "none"`, which is a second modifier identity and violates AD-5. Alternatively U-CONTRACTS makes both slots optional, and now `{prefix: undefined, suffix: undefined}` is a valid tracked entry with no defined query, `{prefix: p}` alone is valid and ambiguous (is this a white base, a transmute-stage item, or a wildcard suffix?), and U-SYNC must decide what trade query a partial identity maps to — a decision with real request-budget consequences.

The same gap forecloses the addendum's **Coarser fallback pricing** option ("base + this prefix, any suffix"), listed in Deferred as a live escape hatch. Under a mandatory-both schema it cannot be added later without a breaking dataset migration.

**Close with:** an explicit `kind` discriminant on the tracked entry (`magic-combination` | `white-base`), both modifier slots required within `magic-combination`, and a stated decision on whether white bases share the ranked list and the threshold (Open Question — must close before `core` is built, as the spine itself says).

---

### F-15 — HIGH — "Yields the chunk" has two incompatible meanings

**AD-8:** "On a 429 or an exhausted bucket it backs off and yields the chunk rather than retrying tightly." **AD-7:** "a run that is killed loses at most the chunk in flight."

**The pair.** U-SYNC-CLIENT raises a `ChunkYielded` signal and treats the chunk's partial results as discarded — AD-7's phrasing directly supports losing the whole chunk. U-SYNC-RUNNER catches it and *persists what it already fetched* before exiting, reasoning that discarding paid-for requests wastes the very budget AD-12 exists to protect. Both are reasonable; they produce different dataset contents, different cursor positions (F-10), and different run reports after every rate-limit event — which, on a multi-hour refresh, is most runs.

The partial-persist path also interacts badly with F-10-B's implicit cursor: a partially-written chunk shifts the `observedAt` sort and can leave a subset of combinations permanently skipped.

**Close with:** an AD stating explicitly whether a yielded chunk's partial results are persisted, and defining the chunk as the atomic unit of both work and commit.

---

### F-16 — MEDIUM — The AD-12 budget report is meaningless under AD-7 chunking, and its denominator is unspecified

**AD-12:** "Sync must report the run's request count against the list size so budget drift is observable." Under AD-7 a *run* covers one chunk, so `requests / listSize` is a fraction of a fraction and observes nothing. The meaningful figure is requests per completed **sweep** — a concept that does not exist in the spine (F-10).

**The pair.** U-SYNC-RUNNER reports per-run; U-CURATION builds its prune tooling against a per-sweep figure it expects to find in the report and cannot. Second axis: does the request count include the currency-exchange calls of F-8 and any AD-6 retry? The addendum's model is "one search plus one fetch per priced combination" — a ratio of exactly 2.0 is the drift signal. Including currency calls makes the ratio base-load-dependent and destroys the signal.

**Close with:** an AD defining a sweep, requiring the report to carry per-sweep request totals, and pinning which request classes count toward the tracked-list ratio.

---

### F-17 — MEDIUM — Nothing pins a canonical string encoding for the composite key, so two units will invent two

AD-5's identity is a composite object. Every real implementation needs a string form: a `Map` key in `web`, an object key in `dataset.json`, a dedupe key in `sync`, a sort key in the chunk cursor.

**The pair.** U-SYNC writes `dataset.json` as an array of objects carrying the composite structurally. U-WEB builds `` `${baseTypeId}|${prefix.statId}:${prefix.valueMin}|${suffix.statId}:${suffix.valueMin}` ``. U-CORE builds `` `${baseTypeId}::${p}/${s}` `` with a different separator and `valueMin` formatted by `String(10.0)` → `"10"` where the other used `.toFixed(1)` → `"10.0"`. Nothing detects the mismatch; lookups just miss, and by F-5 a miss becomes `absent`, and by F-5's ambiguity an `absent` silently drops a combination from the sum. AD-5 forbids a second *identity*, which an agent will reasonably read as not covering a serialisation detail.

**Close with:** a single `combinationKey()` function exported from `contracts` (or `core`), declared the only permitted string form, with `valueMin` formatting pinned.

---

### F-18 — MEDIUM — CRITICAL blocker: the two declared companion documents do not exist

Frontmatter declares `WEIGHTS-FILE-SCHEMA.md` and `AGENT-WORKFLOW.md` as companions. Neither is present in the architecture directory (only `ARCHITECTURE-SPINE.md` and `.memlog.md`). **AD-11 binds the application to a schema document that does not exist**, and AD-11 is the AD governing the input on which every probability rests. Any unit assigned the weights consumer has no contract to build against and will invent one — which is F-2 and F-3 arriving by a second route.

Severity is MEDIUM only on the assumption these are queued for authoring; it is CRITICAL and blocking if parallel work starts first.

**Close with:** author `WEIGHTS-FILE-SCHEMA.md` before any epic touching `core` or weights begins, and make it the binding artifact AD-11 references.

---

### F-19 — MEDIUM — The spine names four packages but no epics, so the unit boundary itself is a guess

Everything above assumes a decomposition. The spine supplies a package graph and a scope→package map, but no statement of which units are built in parallel, in what order, or what each owns. The four packages are not four equal epics — `contracts` must be complete before the others start (F-7), `core` cannot be built before the Open Questions close (the spine says so about white bases and says nothing about the more serious recipe gap), and `sync` splits naturally into client and runner with a seam (F-15) the spine does not draw.

Consequence: an agent handed "build `sync`" and an agent handed "build `web`" will *both* extend `contracts`, and neither will consider itself the owner of the seam.

**Close with:** an explicit unit/epic map with owned paths per unit, a sequencing statement, and a rule that no two concurrently-active units own the same path.

---

### F-20 — LOW — Threshold persistence contradicts the sharing premise

AD-15 permits browser storage for "the threshold dial and view preferences." The brief has the author sharing the link with friends. U-WEB-A persists threshold to `localStorage` only; U-WEB-B mirrors it into the URL query so a shared link carries the ranking the author is describing. B's choice is strictly better for the stated use and is equally AD-compliant; unspecified, it is a coin flip. Also unstated: the default threshold on first load (0.25 div? 1 div?), which determines what a first-time visitor sees.

---

### F-21 — LOW — `core` must be browser-safe, and nothing says so

AD-2 lets `web` import `core`. Nothing forbids `core` from depending on a Node-only package or carrying module-level side effects that defeat tree-shaking. `dependency-cruiser` checks package edges, not runtime environment. U-CORE pulls in a Node-targeted decimal library to fix F-12's precision problem; U-WEB's Vite build breaks or bloats. A `dependency-cruiser` rule restricting `core` to zero runtime dependencies (or to an explicit allowlist) closes it mechanically, in keeping with AD-2's own spirit.

---

## What the spine gets right

Stated so the rewrite does not lose it:

- **AD-1, AD-2, AD-13, AD-15** are model ADs: each names a real failure, states a mechanically checkable rule, and is enforceable without judgement. AD-2's "a violation fails CI via `dependency-cruiser`, not review" is exactly the right register.
- **AD-9's tri-state** is the single most valuable decision in the document — it directly protects the addendum's unresolved zero-listing risk. It needs a fourth member (F-4), not rethinking.
- **AD-12's "the tracked list is the request budget"** correctly turns the addendum's binding constraint into a structural property rather than a guideline.
- **AD-4's read-time ranking** correctly identifies that precomputation would make the product's central control a lie. It needs an owner (F-13), not reversal.
- **AD-10's provenance propagation** is the right answer to the addendum's *partial coverage must be visible* requirement. It needs an `absent` rule (F-5) and a total order.

---

## Recommended closures, ordered

| # | Closure | Closes |
| --- | --- | --- |
| 1 | Author `WEIGHTS-FILE-SCHEMA.md`; make it binding | F-18, F-2, F-3 |
| 2 | **AD-16 Valuation arithmetic**: write the formula out in full — joint probability, denominator membership, tier-band summation, `>=` gross-price threshold in divine, flat craft cost subtracted once, `absent`-weight rule | F-1, F-2, F-3, F-5, F-8 |
| 3 | **AD-17 Single-owner contracts**: `contracts` sequenced first, frozen during parallel work, one schema per file, no shared barrel | F-7, F-12, F-19 |
| 4 | **AD-18 Ranking ownership**: `core` exports the total order with a documented tie-break chain; `web` never re-sorts; negative-score and chase-modifier rules stated | F-13 |
| 5 | Amend **AD-9** with an `unresolvable` state; amend **AD-6** to require clearing the stale price | F-4 |
| 6 | Resolve **AD-3** vs the `report --> web` edge — fold freshness and error state into the dataset, or schema-pin the report | F-6, F-11 |
| 7 | **AD-19 Single-writer sync**: lockfile, exact commit paths, dirty-tree behaviour, named progress artifact, sweep definition, yielded-chunk persistence rule | F-9, F-10, F-15, F-16 |
| 8 | **AD-20 Serialisation discipline**: discriminated unions, `strictObject`, pinned decimal precision and rounding, one canonical `combinationKey()` | F-12, F-17 |
| 9 | Add `data/recipes.json` + schema; name the exchange-rate adapter's owner | F-8 |
| 10 | Add a `kind` discriminant covering white bases; close the two Open Questions before `core` starts | F-14 |
| 11 | Publish the epic/unit map with owned paths and sequencing | F-19 |
| 12 | `dependency-cruiser` rule: `core` has zero runtime dependencies | F-21 |

Items 1–5 are prerequisites to writing a line of `core`. Items 6–8 are prerequisites to starting `sync` and `web` concurrently.
