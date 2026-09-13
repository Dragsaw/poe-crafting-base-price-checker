# UX-Relevant Extraction — PRD: PoE2 Crafting Base Price Checker

Sources: `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md` (rev 8, final) and `.../addendum.md` (rev 5, final).

This is an extraction only. Nothing here is designed. Every item carries its FR/NFR/AD/UJ/OQ/BQ/R/SM id.

---

## 1. Surfaces implied

Every distinct screen, view, panel, group or region the PRD implies exists.

| # | Surface | What implies it |
| --- | --- | --- |
| S-1 | **The Ranked Base List** — "the first screen of the product. In most sessions the player reads nothing else." One ordered list of Base Types, most profitable first. | §4.1 description; FR-1; FR-5; UJ-1 |
| S-2 | **A collapsed ranked row** (per Base Type) — carries the Base Type's EV, its Chase Combinations, and the Provenance the EV rests on. | §4.1 description; FR-1; FR-2; FR-10 |
| S-3 | **The Chase Combination cluster inside the collapsed row** — at most three Combinations named without expanding. | FR-2; §3 *Chase Combination*; UJ-1 |
| S-4 | **The Raw Base branch / labelling** — Raw Bases ranked in the *same list* but valued differently and labelled as uncrafted; "The view shows each branch in its own place, labelled for what that branch is." | FR-3; FR-4 (second consequence) |
| S-5 | **The Unrankable group** — "a separate group with the reason", carrying a **count visible without expanding the group**. Its prominence (footer vs first-class surface) is set by the FR-4 coverage band. | FR-4; AD-18; AD-27 |
| S-6 | **The "expand the remainder of the ranked list" affordance** — top 20 shown; "The player reads the remainder behind an explicit expand." | FR-5 |
| S-7 | **The Payout Threshold control** — the product's central control, in Divine. | §4.2; FR-6; FR-7; UJ-2 |
| S-8 | **The expanded Base Type detail panel / Combination list** — every Tracked Entry on that Base Type, priced and unpriced alike, including `pruned` tombstones. | FR-8; §4.3; UJ-3; UJ-5 |
| S-9 | **A per-Combination detail row** inside S-8 — Combination, Price State, price in Divine, listing sample size, age, age-kind label, below-threshold mark. | FR-8; FR-9; FR-12 |
| S-10 | **The tombstone sub-region inside S-8** — `pruned` entries "visually separated and showing their prune reason." | FR-8; FR-15 |
| S-11 | **The global uniform-prior banner** — "persistent, dismissible-per-session". | FR-11 |
| S-12 | **Per-row Provenance badge** — "The per-row badge is required regardless." | FR-10; FR-11 |
| S-13 | **Per-row freshness / age indicator**, labelled by which clock it reads. | FR-12 |
| S-14 | **A Weights File attribution region** — producer, `generatedAt`, `gamePatch` shown "beside any figure they influenced". | FR-10; §3 *Weights File* |
| S-15 | **Sync / list-health surface** — the three figures `web` must surface: tracked-list age, unresolvable count, presence of the pinned-starvation record. | FR-18; FR-24; FR-25 |
| S-16 | **Tracked-list age display** — "The view shows the date unconditionally." | FR-18 |
| S-17 | **Cross-file validation report surface** — `web` **reports** edge-alignment, straddle, empty-containment-set, `coOccur` and kind-agreement failures at load rather than refusing to render. | FR-33; FR-29; FR-16 |
| S-18 | **Schema-invalid artifact refusal state** — "`web` refuses to render an invalid artifact rather than degrade." | FR-33; NFR-8; AD-3 |
| S-19 | **Honest-empty state across a league reset** — "The ranking goes honestly empty rather than quietly serving last league's numbers." | FR-31; UJ-6; §4.9 |
| S-20 | **Prices-are-asking-prices labelling region/copy layer** — "The view labels prices as current asking prices from live instant-buyout listings." | FR-13 |
| S-21 | **Refresh-rotation surfacing** — "how often a row gets re-priced is now something the view can state rather than imply." | addendum *Curation Surface*, What landed; FR-17 |
| S-22 | **Read-only curation surface** (Option 1 adopted): the view shows Curation Status, tracked-list age, `no-listings` entries and `unresolvable` entries; editing happens in a text editor followed by a commit. | addendum *Curation Surface*; FR-15; AD-15; AD-21 |

Explicitly **not** surfaces: any write path from the browser (AD-15, AD-21); copy-to-clipboard JSON snippets per row (rejected for v1, addendum *Curation Surface* option 2); any account/settings/sharing surface (§2.2, §6, AD-15); price-history/trend rendering (§6).

---

## 2. User journeys (§2.3, verbatim in substance)

Preamble (§2.3): "There is a single operator, a single role, no authentication and no multi-device handoff. These journeys are therefore written in the template's lighter form."

- **UJ-1. The pre-session read.** "The player is about to map for two hours. The player opens the view, glances at the top five Base Types under his current threshold, notes the two or three Chase Combinations on each Base Type, and closes the view. He picks up accordingly for the rest of the session."
- **UJ-2. The threshold turn.** "The player is now richer than at league start. He drags the threshold from a quarter of a Divine to one Divine. The list reorders immediately — steady moderate Base Types fall away, jackpot Base Types rise — and he re-reads the new top five."
- **UJ-3. The drill-down.** "The player is unsure why an unfamiliar Base Type ranks third. He expands that Base Type and reads the full tracked Combination list: which Combinations are priced, at what price, how old each price is, and which Combinations returned no listings."
- **UJ-4. The trust check.** "The player notices a Base Type that ranks suspiciously high. He sees that the price of that Base Type was observed three days ago, and that the whole ranking is flagged as resting on the uniform prior. He discounts that Base Type rather than acting on it."
- **UJ-5. The curation pass.** "The player reviews deliberately after a few weeks. He sees three Combinations that have returned no listings all league, and one Combination flagged unresolvable since the last patch. He opens `data/tracked.json`, tombstones the dead Combinations with a reason, pins one Combination he wants watched closely, and commits. The next sync run reflects the edit."
- **UJ-6. The league reset.** "A new league starts. The player edits the active league in `data/config.json` and commits. The ranking goes honestly empty rather than quietly serving last league's numbers, and the ranking refills over the following day."

Feature→journey mapping: §4.1 realises UJ-1, UJ-2, UJ-3. §4.2 realises UJ-2. §4.3 realises UJ-3, UJ-5. §4.4 realises UJ-4. §4.5 realises UJ-5. §4.9 realises UJ-6.

---

## 3. Every display requirement

### 3.1 The ranked list (FR-1, FR-2, FR-3, FR-4, FR-5)

- FR-1: "The player sees Base Types ordered by EV. The order is computed under the active Craft Recipe and the current Payout Threshold."
- FR-1: "`core` computes every ranking term. The view computes none of the ranking terms (AD-4)."
- §4.1: "Nothing in the published Dataset carries a rank, a score or an ordering."
- §4.1 / FR-2 / S-2: "Each row carries the Base Type's EV, the Combinations worth chasing on that Base Type, and the Provenance that the EV rests on."
- FR-2: "Each ranked row names the Combinations most worth chasing on that Base Type. The player does not expand the row to read them."
- FR-2: "Chase Combinations are ordered by contribution to EV — `P(combo) × price(combo)` — not by raw price." `[ASSUMPTION]`
- FR-2: "The collapsed row shows **at most three** Chase Combinations." `[ASSUMPTION]`
- FR-2: "Only Combinations at or above the Payout Threshold appear. The set therefore changes when the player changes the Payout Threshold."
- FR-2: "A Base Type whose priced Combinations are all below the Payout Threshold shows no Chase Combination. The EV of that Base Type is negative by its Craft Cost."
- FR-3: "`core` ranks uncrafted item-level-82 white Base Types in the same list. `core` values these Base Types differently, and the view labels them as uncrafted."
- FR-3: "The view renders a Raw Base distinguishably from a crafted Base Type. Colour alone does not carry that distinction (NFR-10)."
- FR-3: "A Raw Base priced below the Payout Threshold is truncated out of the list, and is not ranked at its price."
- FR-4: "Base Types that `core` cannot rank honestly appear in a separate group with the reason. `core` does not drop these Base Types silently, and `core` does not rank them anyway."
- FR-4: "The view shows the reason per Base Type ('pool partial', 'base absent from weights file')."
- FR-4: "The count of Unrankable Base Types is visible without expanding the group. A large count means that the ranked list covers a small fraction of what the player tracks."
- FR-4: "A Base Type carrying both a Raw Base and crafted entries can therefore have an Unrankable crafted branch while its raw branch ranks normally. The view shows each branch in its own place, labelled for what that branch is."
- FR-4: "Every probability derived from a `partial` pool carries Provenance `absent`. The view renders such a probability as an **unknown rather than a number**, because the probability is an upper bound and not an estimate."
- FR-5: "The list answers a question rather than presenting an inventory."
- FR-5: "The ranked list shows the top **20** Base Types by default. The player reads the remainder behind an explicit expand." `[ASSUMPTION]`
- FR-5: "The bound is a display concern only. `core` ranks the full Tracked List and the view truncates, so the Payout Threshold still reorders across everything."

### 3.2 The expansion / Combination detail (FR-8, FR-9)

- FR-8: "The player expands any ranked Base Type. The player then sees all Tracked Entries of that Base Type with their prices, their Price States and their ages."
- FR-8: "Every Tracked Entry for that Base Type appears, whether or not the Tracked Entry cleared the Payout Threshold. **`pruned` tombstones are included**, visually separated and showing their prune reason. The inclusion of the tombstones is what makes UJ-5's review possible without an open of the file."
- FR-8: "Each row shows its Combination, its Price State, its price in Divine where the entry is priced, the number of listings that the estimate rested on, and its age. The row labels the age as an observation age or as a last-attempted age per FR-12."
- FR-8: "The view visibly marks each entry below the Payout Threshold as an entry that does not contribute to the EV."
- §4.3: "The player can thus see what the ranking is built from. The player can equally see what the ranking deliberately excludes."
- FR-15: "A `pruned` entry carries its reason. … The view shows that reason (FR-8)."

### 3.3 Price States (FR-9) — must-not-collapse rules

- FR-9 headline: "The four Price States are four different things on screen. The view never collapses one Price State into another Price State."
- "The view renders no Price State as `0`, as blank, or as '—' in a way that reads as worthless (AD-9)."
- "The view presents `no-listings` as an open question and not as an answer. The view must not imply that the Combination is junk."
- "The view shows `unresolvable` entries and does not merely omit them. The existence of an `unresolvable` entry is the symptom of a game patch (AD-6)."
- "**`not-yet-synced` carries a reason** — `never-synced`, `league-mismatch` or `no-exchange-rate`. … The view displays the reason and does not merely store the reason."
- "The view does not carry the distinction between Price States by colour alone (NFR-10)."
- §3 *Price State*: "Absence is never `0`, `null`, or a missing key (AD-9)."
- FR-24: "`core` excludes `unresolvable` entries from valuation. The view surfaces the existence of those entries."

### 3.4 Provenance display (FR-10, FR-11)

- FR-10 headline: "Every displayed derived figure states what that figure rests on."
- FR-10: "**Three distinguishable render treatments, not two**, and colour alone carries none of the three (NFR-10):"

| Provenance | Rendered as |
| --- | --- |
| `measured` | the plain figure |
| `modelled-split` | visibly distinct from **both** other treatments — a measured weight that a model distributed |
| `uniform-prior` / `absent` | visibly degraded. `absent` is an unknown and not a number (FR-4) |

- FR-10: "A collapse of `modelled-split` into the placeholder treatment would **understate a measured weight**. A collapse of `modelled-split` into `measured` would overstate an invented distribution."
- FR-10: "The view shows the Weights File's declared producer, `generatedAt` and **`gamePatch`** beside any figure they influenced. A file left behind by a patch is therefore visible as such."
- FR-10: "`core` propagates the **weakest** Provenance and the **oldest** timestamp of every input into each derived figure."
- FR-10: "**`modelled-split` propagates from the numerator only**… A weakest-Provenance rule across the whole pool would stamp `modelled-split` on nearly every weapon Base Type, since 53 of 63 item classes carry a decomposed family somewhere. A label that universal distinguishes nothing."
- FR-11 headline: "A Provenance badge that is identical on every row conveys no information. The view must not pretend otherwise."
- FR-11: "The view **reads the condition from the data and does not assume it of v1**."
- FR-11: "The banner condition is that **no probability in the loaded set carries `measured` or `modelled-split`** … The view then shows a **persistent, dismissible-per-session banner**. The banner states that the entire ranking rests on a uniform prior, and that relative ordering between Base Types is not evidence-backed."
- FR-11: "**A `modelled-split` figure does not trigger the banner.**"
- FR-11: "The banner **disappears on its own** once any `measured` or `modelled-split` figure is present. The banner is a function of the data, and not a build-time constant that someone must remember to remove."
- FR-11: "The per-row badge is required regardless (FR-10)."
- FR-11: "Where the badge cannot yet discriminate, **freshness** is the genuinely discriminating per-row signal (FR-12). The view gives freshness the visual weight that Provenance has not earned."
- SM-C4: "Rendering `uniform-prior` figures as cleanly as measured ones would make the tool feel more authoritative and be more dangerous."

### 3.5 Freshness display (FR-12)

- FR-12 headline: "Each row carries its own age. The age of an unpriced row is as meaningful as the age of a priced row."
- "A single dataset-level timestamp is insufficient and must not be the only freshness signal, because Chunked syncing guarantees that rows refresh at different times."
- "Every row carries an age **wherever an age exists**. The view takes the age from the row's `observedAt` where there is an observation, and from the row's `lastAttemptedAt` otherwise."
- "**A never-synced row is the one case with no age at all.** The view renders a never-synced row as *never attempted*, and not as an age or as a blank."
- "**The view labels which of the two ages it shows.** The two ages mean different things — *this price is three days old* versus *nothing has been found here for three days*. … A collapse of the two ages into one unlabelled '3d' would make the second row indistinguishable from the first row."
- "A partially refreshed Dataset publishes and renders normally. Per-row freshness is what makes that honest."

### 3.6 Copy / language rules (FR-13)

- FR-13 headline: "The view's language never implies that a player achieved a price."
- "The view labels prices as current asking prices from live instant-buyout listings."
- "No copy describes an estimate as 'sells for', as 'worth', or with any phrasing that implies an observed sale."
- "This rule is the *only* mitigation in the system for Risk R-1."

### 3.7 List-health / operational display (FR-18, FR-24, FR-25, FR-33)

- FR-18 headline: "The player can see the time since anyone last reviewed the Tracked List."
- FR-18: "The Sync Report records the date of the last tracked-list edit, and the view shows that date."
- FR-18: "The view shows the date unconditionally. A Tracked List that runs unattended for months is visible as such, and the player does not have to search for the date."
- FR-25: "**`web` surfaces the presence of the pinned-starvation record**, alongside the tracked-list age (FR-18) and the unresolvable count (FR-24). Those three figures are what tell a player that his list is not doing what he thinks it is. A report field that nothing renders is a field that nobody reads."
- FR-17 (runtime pinned truncation): owner `sync`, "surfaced by `web`". "A truncation is **not an error, and does not change the exit code**."
- FR-33: "The two catalogue files are what let the view render a `statId` as its human text and a currency as its icon **without a runtime call to pathofexile.com** … Without the two catalogue files the view would show raw stat ids, which is the same list in a form the player cannot read."
- FR-33: "`web` renders from a **single consistent set** and does not mix artifacts across a refresh."
- FR-33: "`web` refuses to render an invalid artifact rather than degrade." — but "**'Refuses to render' applies to a *schema-invalid* artifact.** `web` reports a schema-valid artifact that fails a **cross-file policy check**, and never meets such a failure with a file-level refusal."
- FR-33: "a builder could land on a refusal to render the entire site because the player pinned one row too many. That refusal would be a total outage of a product whose premise is a static page that always renders."
- FR-33: "`core` defines those three checks, and **`web` reports them at load rather than meets them with a file-level refusal**."
- FR-16: "Where the pool cannot answer, `coOccur` is `false`, and the Tracked List still loads. … A refusal instead would stop the **whole site** over a Base Type that was never going to rank."
- FR-29 (empty containment set error text): "The error therefore names the reference, names the reference's floor, and states that the scoped pool contains no cell for that `statId`. The error leaves which document is wrong to the reader."
- FR-27 (exactness refusal report): "A refusal reports the observed sum, the expected total and the **signed difference** between the two. A refusal never reports merely that the two disagreed." And for the group per-`statId` check: "the refusal reports every `statId`'s observed sum and the signed differences between those sums, and names no expected total."
- FR-16: "The tool rejects overlap at load and names the offending entries."

---

## 4. Every state the view must render

### 4.1 Price States (§3 *Price State*, AD-9, FR-9) — exactly one of four

| State | Meaning to the player | Notes |
| --- | --- | --- |
| `priced` | There is a current observed asking price in Divine for this Combination. | FR-21: median of cheapest ≤10 instant-buyout listings, normalised. |
| `no-listings` | Nobody is selling this right now — "either a jackpot or junk. Listings cannot tell the two cases apart." Must be presented "as an open question and not as an answer." | §4.3; FR-9; R-5. Has an age even with no observation (§3 `lastAttemptedAt`). |
| `not-yet-synced` | The tool has no usable figure yet; carries one of three reasons (below). | FR-9 |
| `unresolvable` | The `statId` or Base Type is no longer exposed by the trade API — "the symptom of a game patch." Excluded from valuation, but must be shown. | FR-9; FR-24; AD-6 |

**`not-yet-synced` reasons** (§3; "The reason enum is this PRD's own addition"):

| Reason | Meaning |
| --- | --- |
| `never-synced` | No request was ever issued for this entry. The one row with **no age at all**; render as *never attempted* (FR-12). |
| `league-mismatch` | The observation belongs to a different league than the active one; treated as absent, not stale-but-usable (FR-31). |
| `no-exchange-rate` | The listing currency had no current rate at sync time; there is deliberately no "priced but not yet convertible" state (FR-23). |

### 4.2 Curation Statuses (§3, AD-23, FR-15, FR-17) — exactly one of three

| Status | Meaning to the player |
| --- | --- |
| `active` | Ordinary rotation member; refreshed by oldest `lastAttemptedAt` first (FR-17 row 2). |
| `pinned` | Watched closely — "selected **first in every Chunk**", "never waits its turn in the `active` ordering". Capped and truncatable; a scarce designation (FR-15, FR-17, FR-14). |
| `pruned` | A tombstone carrying a reason. Excluded from sync workload **and** from the ranking sum; still shown in the expansion, visually separated, with its reason (FR-8, FR-15). |

"Curation Status is independent of Price State. An entry is `active` *and* `priced`, or `active` *and* `unresolvable`." (§3)

### 4.3 Provenance values (§3, AD-10) — four-value total order, weakest first

| Rank | Provenance | Means | Arises from |
| --- | --- | --- | --- |
| 0 | `absent` | "not an estimate at all — an upper bound" | "a `partial` pool, and nowhere else (FR-28)" |
| 1 | `uniform-prior` | "someone invented the weight" | "a bootstrap file, or a field filled by hand" |
| 2 | `modelled-split` | "someone **measured** the weight, but a **model** distributed the weight across Value Cells" | "AD-28's decomposition, and nowhere else" |
| 3 | `measured` | "someone measured the weight — never ground truth (R-3)" | "a producer's real spawn weights" |

"The ranks are explicit, so that no reader infers 'weakest' from an enum's declaration order." `absent` is `core`-side and must never appear in a file (FR-27).

### 4.4 Unrankable reasons (FR-4, FR-28, FR-30, AD-18)

- **"pool partial"** — a Base Type whose Eligible Pool for either slot is not `complete`. Its probabilities carry `absent` and render as an unknown, not a number.
- **"base absent from weights file"** — the Base Type is not in `weights.json` at all.
- An empty pool in a slot is also degraded-but-loadable and leaves the ordering (FR-27 last consequence).
- Whole-product case: "Until a conforming file exists, **every crafted Base Type is Unrankable** (FR-4)… What survives a missing file is therefore a white-base price list, not the product." (FR-30, §7.3)
- Recurring case: "**Freshly scraped classes may therefore go Unrankable immediately after a patch, until the source becomes current.**" (§7.3)
- Scope: "**This consequence governs the crafted branch only.**" Raw branches rank without a pool (FR-4, FR-3).

### 4.5 Empty / loading / stale / error conditions

- **Honest empty (league reset)**: "The ranking is honestly empty until data arrives, and the ranking refills without anyone rewriting the Dataset." (FR-31; UJ-6)
- **Partially refreshed dataset**: "A partially refreshed Dataset publishes and renders normally." (FR-12)
- **Not reached this Chunk**: a normal rotation outcome, distinct from starvation. "*Not reached* is a **rotation outcome, not a skip**." (FR-25)
- **Pinned starvation**: a curation defect the player must correct; distinct from "slow refresh"; `web` surfaces its presence. (FR-17, FR-25)
- **Stale Weights File**: visible via `producer.id`, `generatedAt`, `gamePatch` beside influenced figures. "A stale Weights File degrades Provenance, and a stale catalogue degrades id validation and display text. Neither stale file breaks the app." (FR-10; §7.3)
- **Schema-invalid artifact**: `web` refuses to render it (FR-33, NFR-8).
- **Cross-file check failures at load in `web`** (report, never refuse): edge alignment, straddle, empty containment set (FR-29); `coOccur` overlap and cross-file kind agreement (FR-16).
- **Uniform-prior global condition**: banner shown while no probability carries `measured` or `modelled-split` (FR-11).
- **Unresolvable count** and **tracked-list age** always present as health figures (FR-24, FR-18, FR-25).

---

## 5. Every interaction

- **Set the Payout Threshold** — "The player sets a Payout Threshold in Divine. The ranked list then reorders in front of the player." (FR-6). UJ-2 describes it as a drag: "He drags the threshold from a quarter of a Divine to one Divine."
- **Synchronous re-rank** — "A change to the Payout Threshold re-runs the ranking synchronously against the artifacts that are already loaded. The change triggers no network request and no sync." (FR-6)
- **Reordering is expected behaviour** — "A Base Type with one jackpot Combination and a Base Type with many moderate Combinations swap order when the Payout Threshold crosses the moderate prices. This is the correct behaviour and not a bug." (FR-6)
- **Threshold affects Chase Combination set** — "Only Combinations at or above the Payout Threshold appear. The set therefore changes when the player changes the Payout Threshold." (FR-2)
- **Persistence** — "The Payout Threshold and the view preferences survive a page reload." Persisted "only in the viewer's own browser storage. There is no backend, no account, and no authenticated request." (FR-7, AD-15)
- **Cold start** — "A first visit has no stored value. The Payout Threshold then starts at a documented default." `[ASSUMPTION: 0.25 Divine]` (FR-7)
- **Expand a Base Type** — reveals the full tracked Combination list including tombstones. (FR-8, UJ-3)
- **Expand the ranked list beyond 20** — "The player reads the remainder behind an explicit expand." (FR-5)
- **Expand the Unrankable group** — implied: its count is "visible without expanding the group." (FR-4)
- **Dismiss the uniform-prior banner** — "persistent, dismissible-per-session". (FR-11)
- **Truncation as display concern** — the view truncates; `core` ranks everything. (FR-5)
- **Ordering rules the player sees**: ranked list by EV (FR-1); Chase Combinations by `P × price` (FR-2); expansion shows all entries regardless of threshold (FR-8).
- **No in-view editing** — "AD-15 forbids a write path from the browser and AD-21 makes `data/tracked.json` hand-owned, so 'prune junk, pin ones to watch' cannot be a UI action." Curation is read-only surfacing; "editing happens in a text editor, followed by a commit." (addendum *Curation Surface*; UJ-5)
- **Rejected interaction** — copy-to-clipboard JSON snippets per row: "Rejected for v1 as an authoring convenience for an act performed a handful of times a league." (addendum *Curation Surface*, option 2)
- **Out-of-view actions the player performs** that the view must reflect afterwards: editing `data/tracked.json` (tombstone/pin) and committing (UJ-5); editing the active league in `data/config.json` and committing (UJ-6); invoking `pnpm catalogue:refresh` at patch cadence (FR-24, NFR-4).

---

## 6. Every accessibility requirement

- **NFR-10 — Accessibility floor** (quoted in full): "AD-24 requires that colour alone must not carry the distinctions AD-10 mandates. This PRD **extends** that rule to every product-meaningful distinction — Price State (FR-9), crafted versus Raw Base (FR-3) and Provenance (FR-10). The reason AD-24 gives applies identically to all three distinctions. `[ASSUMPTION: the extension beyond AD-24's literal scope is this PRD's, not the spine's.]`"
- **FR-3**: "The view renders a Raw Base distinguishably from a crafted Base Type. Colour alone does not carry that distinction (NFR-10)."
- **FR-9**: "The view does not carry the distinction between Price States by colour alone (NFR-10)."
- **FR-10**: "**Three distinguishable render treatments, not two**, and colour alone carries none of the three (NFR-10)."
- **§11 Assumptions Index / NFR-10**: "The colour-alone prohibition extends beyond AD-24's literal scope, to Price State and Raw Base distinctions."
- Related non-colour legibility requirement, **FR-33**: the catalogue files exist so the view renders a `statId` as human text and a currency as an icon; "Without the two catalogue files the view would show raw stat ids, which is the same list in a form the player cannot read."
- No other NFR in §5 (NFR-1 … NFR-9) states an accessibility rule. NFR-6 (read-time budget) and NFR-7 (static delivery) bear on responsiveness rather than accessibility.

---

## 7. Layout constraints and layout decisions the PRD defers to UX

### 7.1 FR-4's coverage-band table — reproduced verbatim

Preamble: "**A measurement taken before any view work sets the group's prominence.** The measurement is a fraction over Base Types."

```
rankable(base) = base carries at least one tracked entry that is
                 crafted (at least one affix present)
                 and not pruned

covered(base)  = base is PRESENT in weights.json
               ∧ both slots declare poolCoverage "complete"
               ∧ neither slot's pool is empty

coverage = |{ baseTypeId ∈ tracked.json : rankable ∧ covered }|
           ──────────────────────────────────────────────────
           |{ baseTypeId ∈ tracked.json : rankable }|
```

"The result binds the layout, in **disjoint** bands (AD-27, §10 BQ-3):"

| Measured coverage | What this FR requires |
| --- | --- |
| **≥ 80%** | The Unrankable group is a footer to the ranked list, as specified above. |
| **≥ 50% and < 80%** | The group becomes a **first-class surface** alongside the ranking, and not a footer. At this coverage the group is a large share of what the player tracks, and hiding the group misrepresents the product. |
| **< 50%** | The ranking premise fails. Escalate rather than ship around the failure. Neither `core` nor the view resolves this case. |

Attached normative statements:

- "A commitment to a layout before that number exists is a commitment to an assumption about how much of the product there is. For that reason the measurement is sequenced ahead of the view rather than alongside the view."
- "**What 'first-class surface' looks like is a UX decision, not a requirements one.** This FR fixes *when* the decision turns and *that* the decision turns. This measurement binds the concrete treatment, and the UX pass settles it. **The requirement a design must satisfy is that at 50–80% coverage a reader cannot come away with the impression that the ranked list is the whole product.**"
- "**The measurement recurs. The measurement is not a gate that is spent.** `core` re-measures coverage **on every regeneration of the Weights File**. The bands above bind on every measurement… A product that measured 85% before launch can therefore sit at 60% the week after a patch."
- "**The figure is published, not merely computed.**" — `sync-report.json` carries it (FR-25).
- "The fraction is not meaningful on a very small Tracked List… `[ASSUMPTION: … The bands are treated as advisory below ~20 rankable Base Types, and the measurement is reported with its denominator so that the reader can see when that applies.]`"
- BQ-3 owner note: "**Owner: build, first task, before any view work.**"

### 7.2 Other layout / design latitude and constraints

- **§6 Non-Goals**: "**Visual design beyond an off-the-shelf framework.** Appearance is explicitly not a priority."
- **FR-11**: "The view gives freshness the visual weight that Provenance has not earned." — a relative-prominence instruction without a concrete treatment.
- **FR-10**: the three Provenance treatments must be mutually distinguishable, but *what* the treatments are is unspecified.
- **FR-8**: `pruned` tombstones "visually separated" — separation mechanism unspecified.
- **FR-8**: below-threshold entries "visibly marked" — marking unspecified.
- **FR-4**: branch labelling — "The view shows each branch in its own place, labelled for what that branch is" — placement unspecified.
- **FR-5 / SM-C3**: list length bounded at 20 `[ASSUMPTION]`; "A longer list is not a better one."
- **FR-2**: "Three is the count that fits a scannable row, and three matches the 'top five bases' reading pattern of UJ-1." `[ASSUMPTION]`
- **`[NOTE FOR PM]` at FR-18**: "The tool cannot show a Combination that nobody told the tool to watch (Risk R-2, §9). FR-18 exists so that the gap prompts a periodic deliberate review. FR-18 does not close the gap."
- **`[NOTE FOR PM]` at §7.2**: "Coarser fallback pricing for zero-listing Combinations… This is the likeliest thing to be missed if `no-listings` turns out to be a large fraction of the Tracked List. Check after the first full refresh (§10 OQ-6)."
- **Open question bearing on content, not layout — OQ-12**: which quantity a multi-`#` stat filter compares. Owned by the weights scraper project; "Blocking for correctness, not for building."
- **OQ-6**: "What fraction of the Tracked List returns `no-listings`? … If the fraction is large, the deferred coarser-fallback pricing moves from 'held option' to 'needed.'" — directly sizes the unknown bucket the view must present.
- **Stack constraint (from CLAUDE.md / architecture spine, not the PRD)**: the UI uses Mantine v9.

---

## 8. Numbers and thresholds the view must honour

| Value | What it governs | Source |
| --- | --- | --- |
| **Top 20** Base Types shown by default; remainder behind an explicit expand | ranked list length | FR-5 `[ASSUMPTION]`, §11 |
| **At most three** Chase Combinations per collapsed row | collapsed row content | FR-2 `[ASSUMPTION]`, §11 |
| **Top five** — the reading pattern the row count is tuned to; what the player actually acts on | scannability target | UJ-1, UJ-2, FR-5, SM-2 |
| **"two or three" Chase Combinations** noted per Base Type in the pre-session read | UJ-1 |
| **Under 100 ms** for a full ranking pass on a mid-range machine, re-run synchronously on threshold change | perceived responsiveness of the threshold control | §4.1 feature NFR; NFR-6 |
| **0.25 Divine** cold-start Payout Threshold default | first visit | FR-7 `[ASSUMPTION]`, §11 |
| **0.25 → 1 Divine** the realistic threshold range (early endgame → richer player) | control range framing | §4.2, UJ-2 |
| **Divine** — the single denomination for all prices, Craft Costs and the threshold | every money figure on screen | §3 *Divine*, FR-6, AD-20 |
| **4 decimal places** for persisted Divine prices, rounded once at sync; `core` never re-rounds | price precision the view displays from | FR-23, OQ-13 |
| **≥ 80% / 50–80% / < 50%** coverage bands | Unrankable-group prominence | FR-4, AD-27 |
| **~20 rankable Base Types** — below this the bands are advisory, and the fraction is reported with its denominator | FR-4 `[ASSUMPTION]` |
| **Item level 82** — Raw Bases pinned here | Raw Base labelling | FR-3, FR-22 |
| **Cheapest 10 listings**, median (lower of two middle values on an even sample); fewer than 10 valid and the true count recorded | the "number of listings that the estimate rested on" shown per row | FR-21, FR-8 |
| **Zero results = `no-listings`**, never a price | FR-21, AD-9 |
| **24h** — at most one retry attempt per `unresolvable` entry per 24h | rotation cadence the view may state | FR-17 row 3 |
| **~1,500 searches** per full refresh against **~2,400 searches/day** measured ceiling | why curation discipline is surfaced | FR-14, SM-C1, R-4 |
| **~15 hours** for a full refresh, **~62%** of the daily search budget | why rows have different ages | §4.6 |
| **Pinned cap**: `count(pinned) + currencyStepSearches ≤ 0.5 × config.minChunkSearches` at load; runtime truncation reserving ≥1 `active` entry | pinned-starvation surfacing | FR-17 |
| **Exactly 8 artifacts** fetched at runtime: `dataset.json`, `sync-report.json`, `weights.json`, `recipes.json`, `tracked.json`, `config.json`, `catalogue/stats.json`, `catalogue/static.json` | what the view can possibly display | FR-33 |
| **4 files deliberately not fetched**: `sync-progress.json`, `catalogue/items.json`, `catalogue/filters.json`, `data/currencies.json` | what the view cannot know | FR-33 |
| **One Craft Recipe** in v1 (one perfect transmute + one perfect augment); ordering is recipe-invariant in v1 | recipe selector has nothing to choose between | FR-26, AD-18, addendum *Recipe Count* |
| **3–4 league resets a year** | frequency of the honest-empty state | §1, §4.9, R-6 |
| **Magic only** — at most one prefix and one suffix | the shape of a Combination | §2.2, §6, §7.1 |
| **53 of 63 item classes** carry a multi-`#` modifier; **560 of 8,437** rows publish >1 stat | why `modelled-split` would be near-universal if propagated from the denominator | FR-10, FR-29, §3 |

---

## 9. Vocabulary the UI must use verbatim (§3 Glossary)

§3 preamble: "Downstream readers and workflows use these terms exactly. **A synonym introduced anywhere is a discipline violation.**"

| Term | Plain one-line meaning | Player already knows it? |
| --- | --- | --- |
| **Base Type** | A specific item base in PoE2 (e.g. a particular bow). | **Game jargon** — player knows it. |
| **Raw Base** | An uncrafted white base at item level 82, tracked with no affixes. | **Tool term** built on game jargon ("white base" is the game's word). |
| **Combination** | This Base Type carrying this prefix and this suffix — the outcome being priced. | **Tool term**; "prefix"/"suffix" are game jargon. |
| **Chase Combination** | One of the few Combinations on a Base Type that contributes most to its EV — what to look for. | **Tool term**; "chase" is player slang. |
| **Modifier Reference** | The canonical identity of one Stat Line — a `statId` plus either a closed value band or no edges at all. | **Tool term** (mostly back-end; may surface in validation messages). |
| **Stat Line** | One trade-API-visible stat that a modifier publishes. | **Tool term**; the *text* it renders is game-familiar. |
| **Source Modifier** | One game modifier as the game actually rolls it — one spawn weight, possibly several stats at once. | **Tool term**; "modifier" is game jargon. |
| **Tracked Entry** | One unit of the curated workload: a Base Type + optional prefix + optional suffix + item level floor + curation status. | **Tool term.** |
| **Tracked List** | The whole curated set — "what the tool watches and the tool's entire request budget." | **Tool term.** |
| **Item Level Floor** | The minimum item level an entry's search accepts. | "Item level" is **game jargon**; "Floor" is the tool's. |
| **Accepted Tier** | The highest modifier tier worth chasing — tier 1 normally, tier 2 where tier 1 needs ilvl 81/82. | "Tier" is **game jargon**; "Accepted Tier" is the tool's. Note: "The trade API has no tier concept. 'Tier 1' and 'tier 2' exist in this product only as bands." |
| **Curation Status** | `active`, `pinned` or `pruned` — how the tool treats an entry. | **Tool term.** |
| **Refresh Rotation** | The deterministic order in which a Chunk picks entries to re-price. | **Tool term.** |
| **Price State** | `priced`, `no-listings`, `not-yet-synced`, `unresolvable` — what the tool knows about a Combination's price. | **Tool term.** |
| **Price Observation** | One observed price for an entry, normalised to Divine and stamped with time, league and exchange rate used. | **Tool term.** |
| **`lastAttemptedAt`** | When `sync` last issued a request for this entry, whatever the outcome. | **Tool term** (a field name; the view must label the *kind* of age it shows — FR-12). |
| **Divine** | The one currency denomination every figure uses. | **Game jargon** — player knows it. |
| **Payout Threshold** | The player-set gross price below which an outcome counts for nothing. | **Tool term.** |
| **Craft Recipe** | A named crafting-currency composition (v1: one perfect transmute + one perfect augment). | "Transmute"/"augment" are **game jargon**; "Craft Recipe" is the tool's. |
| **Craft Cost** | The Divine cost of one craft attempt, paid on every attempt including failures. | **Tool term.** |
| **Expected Value (EV)** | The ranking figure: threshold-truncated expected payout less Craft Cost. | **Tool term** (borrowed from general statistics). |
| **Provenance** | What a derived figure rests on: `measured` / `modelled-split` / `uniform-prior` / `absent`. | **Tool term.** |
| **Unrankable** | A Base Type excluded from the ordering because its pool is incomplete or absent. | **Tool term.** |
| **Eligible Pool** | All modifier weight entries that can roll in one Base Type + slot at any item level — the denominator of every probability. | **Tool term.** |
| **Value Cell** / **interior cell** | One interval of a value axis; an interior cell is one a single tier carries. | **Tool term.** |
| **Cohort** | The tiers of a family sharing one `itemLevelMin`. | **Tool term.** |
| **Modifier Weight** | One file entry: the mass one tier of one modifier contributes to one Value Cell. | **Tool term.** |
| **Weights File** | The externally produced file of Modifier Weights (contract 4.1.0). | **Tool term.** |
| **`gamePatch`** | The GGG patch the weights file's numbers describe; shown beside producer and `generatedAt`. | "Patch" is **game jargon**; the field is the tool's. |
| **Trade Catalogue** | The committed mirror of the trade API's data endpoints — identity and display text only. | **Tool term.** |
| **Chunk** | One bounded, resumable unit of sync work. | **Tool term.** |
| **Dataset** | The published snapshot of the latest Price Observation per Tracked Entry. | **Tool term.** |
| **Sync Report** | The published structured record of a sync run. | **Tool term.** |
| **Workload** | The entries and currencies a Chunk may spend requests on. | **Tool term.** |
| **`cohortTotals` / `statLineCounts` / `sourceModifierId` / `poolCoverage`** | File-contract fields; may appear in validation messages. | **Tool terms** (producer-facing). |

Additional verbatim strings the view must show:
- Unrankable reasons, as worded in FR-4: **"pool partial"**, **"base absent from weights file"**.
- Price State reason values: **`never-synced`**, **`league-mismatch`**, **`no-exchange-rate`** (FR-9).
- FR-12's *never attempted* rendering for a never-synced row.
- FR-13's forbidden copy: never **"sells for"**, never **"worth"**, never any phrasing implying an observed sale; prices are **"current asking prices from live instant-buyout listings"**.

---

## 10. Gaps — questions the PRD does not settle

Layout and prominence
1. What does "first-class surface" concretely mean for the Unrankable group in the 50–80% band (FR-4) — a tab, a sibling column, an interleaved section, a header count?
2. Where do the Raw Base branch and the crafted branch of the *same* Base Type sit relative to each other, given "The view shows each branch in its own place" (FR-4)?
3. Is there one list containing both raw and crafted rows, or two lists? FR-3 says "in the same list"; FR-4 says "each branch in its own place."
4. Does the view re-read the published coverage fraction from `sync-report.json` at runtime and switch layout bands live, or is the band a build-time layout choice (FR-4 requires re-measurement on every regeneration but does not say the view adapts)?
5. Is the coverage fraction itself displayed to the player, and if so where (FR-25 publishes it; no FR requires the view to render it)?

Ranked row composition
6. What exactly identifies a Base Type on a row — name only, name plus item class, an icon (the catalogue supplies currency icons, not base icons — FR-33)?
7. How is a Chase Combination rendered as text — the two Stat Lines' catalogue display text, with or without the value band edges?
8. How is EV formatted (decimal places shown, given 4dp persisted — FR-23), and how is a negative EV shown (FR-2 says an all-below-threshold Base Type has EV negative by its Craft Cost)?
9. Is Craft Cost itself shown on the row, or only folded into EV (FR-1, FR-26)?
10. Does the row show how many tracked Combinations exist on the Base Type, or how many are priced?

Threshold control
11. Is the threshold a slider (UJ-2 says "drags"), a numeric input, or both? What is its range, step and maximum?
12. What happens at threshold values where the entire list empties — is there a distinct empty state for "nothing clears your threshold" versus "no data"?
13. Which "view preferences" besides the threshold persist (FR-7 says "the view preferences" without enumerating them)?

States and treatments
14. What are the three concrete Provenance treatments (FR-10 requires three mutually distinguishable, colour not carrying any of them)?
15. What is the non-colour distinction mechanism for each of the four Price States (FR-9, NFR-10)?
16. What is the non-colour distinction mechanism for Raw Base versus crafted (FR-3, NFR-10)?
17. How is an `absent`-provenance probability rendered as "an unknown rather than a number" (FR-4) — a dash is explicitly risky under FR-9's "—" prohibition; what glyph or word?
18. How are ages formatted (relative "3d", absolute timestamp, both), and how is the age-kind label worded so it distinguishes "price is 3 days old" from "nothing found here for 3 days" (FR-12)?
19. What is the exact wording of the uniform-prior banner (FR-11 states its content but not its copy), and where does it sit?
20. Does "dismissible-per-session" mean `sessionStorage`, in-memory, or something else (FR-11)?
21. How are cross-file check failures reported in `web` — a global panel, inline on the affected Base Type, or both (FR-33 says "reports", FR-29 says the error names the reference and its floor)?
22. What does the schema-invalid refusal state look like to a player (FR-33, NFR-8)?
23. Is there a loading state at all, given eight runtime fetches that must render as "a single consistent set" (FR-33)? The PRD never describes one.
24. Is there an error state for a failed artifact fetch (as opposed to an invalid one)?

Expansion and detail
25. Can more than one Base Type be expanded at once? Does expansion state persist across reload (FR-7's "view preferences" is unspecified)?
26. What is the ordering of entries inside an expanded Base Type — by EV contribution, by price, by Price State, by age?
27. Where do tombstones sit inside the expansion, and what is "visually separated" concretely (FR-8)?
28. How is "below the Payout Threshold, does not contribute to the EV" visibly marked (FR-8)?
29. Is the Refresh Rotation position or expected next-refresh time actually shown per row? The addendum says the view *can* state it (FR-17); no FR requires it.

Health surfacing
30. Where do the three health figures live — tracked-list age, unresolvable count, pinned-starvation presence (FR-25) — a header strip, a footer, a dedicated panel?
31. Is there a threshold of tracked-list age past which the display escalates in prominence (FR-18 requires unconditional display only)?
32. How is the pinned-starvation record explained to the player so it reads as a curation defect rather than a slow refresh (FR-25 names the distinction but not the copy)?
33. Are "entries not reached in this Chunk" surfaced at all? FR-25 requires the field; no FR requires the view to render it.

Vocabulary and readability
34. Which glossary terms appear on screen verbatim versus which are back-end only — the PRD forbids synonyms but does not say which terms are player-facing.
35. Do jargon terms get any inline explanation for a passer-by with the link (§2.2 says friends and passers-by are "welcome and explicitly not courted")?

Responsive / platform
36. Is the view used on a second monitor while playing, on a phone, or both? The PRD never states a viewport, device or window size.
37. Does the view need to be readable at a glance while the game is in the foreground (UJ-1 is a pre-session read; nothing says mid-session)?

Accessibility beyond colour
38. NFR-10 covers colour alone only. Are keyboard navigation, focus order, screen-reader semantics, contrast ratios or reduced-motion in scope? The PRD names no standard (no WCAG level, no target).
39. Does the 100 ms ranking budget (NFR-6) imply any requirement about perceived responsiveness during expansion or first paint? The PRD budgets only the ranking pass.
