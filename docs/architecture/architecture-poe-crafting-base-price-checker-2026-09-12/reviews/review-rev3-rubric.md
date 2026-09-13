# Rubric review — ARCHITECTURE-SPINE.md revision 3

**Reviewed:** `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md` @ revision 3 (working tree, uncommitted).
**Scope:** the revision-3 amendments — AD-11, AD-18, AD-19, AD-26, AD-27, the revision banner, the source tree — and their ripple through the rest of the spine and its companions.
**Baseline:** revision 2 (`git diff` against HEAD), PRD revision 2 §10 OQ-8..OQ-11, FR-17, `WEIGHTS-FILE-SCHEMA.md`, `AGENT-WORKFLOW.md`.

**Verdict: revise.** Two of the four items (OQ-10, OQ-11) land cleanly inside the spine but OQ-10 does not reach the two companion documents that restate the same rule, so the build instruction an agent actually follows still carries the defect. OQ-8 lands as a genuinely better-denominated rule but introduces a config field with no owner for its validation, no bound on its own value, and a summand whose unit the spine never states — and it legitimises a starvation state whose intra-pinned ordering is undefined. OQ-9's corrected rationale is better than the one it replaces but still does not survive contact with AD-6. None of this is a re-litigation of the four decisions, all of which are the right calls; it is the ripple that is incomplete.

---

## 1. What the amendments got right

Recorded first, because the review below is entirely about what is missing and that would otherwise read as a judgment on the decisions themselves.

- **OQ-11 is fully closed, including in the companion.** `valueMax?` and "an omitted `ref.valueMax` is unbounded above" are gone from AD-11 and AD-18; AD-11 now says "every field required and none nullable (AD-5)" and AD-18 adds the affirmative closure — *"There is no open-top form to handle … `contracts` rejects it at the schema."* A grep of the whole architecture folder finds no surviving optional-ceiling spelling in the spine or `WEIGHTS-FILE-SCHEMA.md` (whose 2.0.0 field rules already said *"Both are **required**; there is no open-top form"* and whose hard-error list already carries *"a missing or `null` `valueMax` on any band"*). AD-18's new sentence does real work beyond editorial cleanup: it names the package that enforces it, so an implementer reading AD-18 alone now learns the form is unconstructible rather than unhandled.
- **OQ-8's re-denomination is the correct diagnosis.** The PRD was right that ~1,500 searches across a full refresh and one search *per chunk* never composed, and the fix — a per-chunk denominator, plus the explicit argument that *"a chunk's real allowance is discovered at runtime … no compiled-in or declared number governs it"* — is the reasoning a load-time-only cap was always missing. Enforcing at both ends, with a stated reason why neither end is sufficient alone, is exactly the shape a good AD takes.
- **The rows-1–4 precedence paragraph is a real addition, not a restatement.** It closes a divergence the rev-2 text left open (`active` ∧ `unresolvable` is a reachable pair, and row 2 would re-select it every chunk), and it matches PRD FR-17's bullet word for word, so PRD and spine now agree.
- **OQ-10's narrowing is correct and its edge case is handled.** A raw-only base can never be `complete`; excluding it is right, excluding `pruned`-only bases follows from AD-23 by the same argument, and the explicit *"A base carrying **both** raw and crafted entries does count"* forecloses the reading that would otherwise have been the divergence.
- **The `config.json` ripple was noticed in two of the right places.** AD-19 now enumerates the field, with the useful guard *"and nothing else; it is a player-owned file, not a settings bag"*, and the Structural Seed source tree comment was updated. Many amendments of this shape update neither.

---

## 2. Findings

Severity: **critical** = two units will diverge or a stated rule is unenforceable; **major** = a real gap an implementer must resolve by invention; **minor** = editorial or consequential-but-contained.

### F-1 — critical — AD-27's amendment does not reach the two companions that restate it, and one of them is the build instruction

AD-27 is the gate that binds a layout decision, and it is restated normatively in two places outside the spine. Neither was amended.

`AGENT-WORKFLOW.md` — "Sequencing that matters", item 2, which is the instruction an agent executing the build actually reads:

> "Take the weights file the scraper project produces, and count what fraction of the **distinct `baseTypeId`s in `data/tracked.json`** have `poolCoverage: "complete"` in **both** slots."

`WEIGHTS-FILE-SCHEMA.md` — "Coverage is measured, not assumed":

> "AD-27 requires the fraction of the ***tracked* base types** resolving to `complete` in **both** slots to be measured before view work begins."

Both are the pre-amendment denominator — the exact quantity OQ-10 identified as wrong. The spine now says one thing and the document that tells an agent when and how to measure says another, so the measurement that gates view work will be computed on the un-narrowed denominator by anyone following the workflow rather than reading AD-27 directly. Because the two fractions differ only when raw-only or pruned-only bases are tracked — and FR-3/FR-22 guarantee raw bases *are* tracked — this is not hypothetical: the two documents will produce two different numbers from the same weights file, and the number selects between "footer" and "first-class surface" in `web`.

The `companions:` front-matter list makes both documents in-scope for an amendment that changes a rule they restate. **Fix:** propagate the `rankable(base)` predicate into both, or reduce both to a pointer at AD-27 so there is one statement of the denominator.

### F-2 — critical — the load-time cap has no owner, and one of the two components that validates `tracked.json` cannot compute it

The new rule is stated as a location, not an owner:

> "| Load time, a `tracked.json` validation error | `count(pinned) + count(data/currencies.json) ≤ 0.5 × config.minChunkSearches` |"

`tracked.json` is read by **both** `sync` and `web` (AD-21's writer table), and AD-3 binds `web` to *"validate on load and refuse to render an invalid artifact rather than degrading"*, while AD-17's sibling load-time rule (partition overlap) is likewise *"rejected at load"* with no owner named. So the rule as written lands on both readers — but `web` **cannot evaluate it**: AD-24 fixes `web`'s runtime fetch set at exactly eight artifacts and `data/currencies.json` is not among them. One summand of the inequality is unreachable from the read side.

Two builders resolve this differently and both are defensible: one has `web` skip the check (a `tracked.json` that `sync` rejects renders happily), the other has `web` treat it as a validation failure and, per AD-3, **refuse to render the entire site** because the player pinned one entry too many. The second outcome is also a design error on its own terms: a sync-budget concern should not be able to blank the read side, and nothing in AD-26 says whether it may.

Note the contrast with AD-6, which faced precisely this problem and solved it explicitly — a two-row table assigning each check an owner *because the two files are read in different places*, with the reasoning spelled out (*"AD-24 deliberately keeps `catalogue/items.json` out of `web`'s fetch set, so `core` cannot perform a base-type cross-check at load and must not pretend to"*). AD-26's new table has the same shape and omits the same column. **Fix:** name `sync` as the owner of the load-time cap in the table's "Where" column, and say in AD-26 (or AD-3) that this particular `tracked.json` validation is sync-only and is not a render-blocking error for `web`.

### F-3 — critical — `minChunkSearches` is player-authored and unbounded, so the load-time cap is a convention wearing a validator's clothes

> "`minChunkSearches` is a declared field of `data/config.json` (AD-19, player-owned per AD-21), **seeded from** AD-8's measured `30:300` search bucket."

"Seeded from" is not "validated against", and nothing anywhere bounds the field. The same human authors `tracked.json` and `config.json`, so the enforcement loop is closed on itself: a pinned set that fails the check is made to pass by raising one number in a file the player owns, with no second party and no rate-limit reality involved. AD-26 explicitly claims the load-time half exists because *"a runtime check alone would let a list be authored that can never work"* — but a self-selected denominator lets exactly that list be authored, so the stated justification for having a load-time half does not hold as written.

This also sits badly against AD-8's strongest rule: *"**No rate is hardcoded**; the measured values below are the expected shape, not a constant to compile in"* — with the runtime-discovered allowance as the authority. `minChunkSearches` is a declared number standing in for a discovered one, which AD-8 is otherwise careful to forbid; AD-26 acknowledges the tension (*"no compiled-in or declared number governs it"*) but then relies on a declared number anyway without saying what keeps it honest.

**Fix:** either bound the field in the `contracts` schema against AD-8's measured bucket (a max, and a minimum, with the measured `30` as the default), or have `sync` compare the declared value against the allowance it actually discovers and report a divergence in `sync-report.json` — which is nearly free given the runtime check in the row below already reads that allowance.

### F-4 — major — the currency summand is denominated in a unit AD-12 never states, and may not draw on the search bucket at all

`count(data/currencies.json)` appears as a summand of a **search** budget, on the stated ground that *"AD-20 spends it at step 0 of the same chunk"*. But no AD says a currency costs one search:

- AD-12's declared-source table gives `data/tracked.json` an explicit per-entry cost (*"one search + one fetch per entry"*) and gives `data/currencies.json` only *"small, fixed"* — deliberately unquantified, and "fixed" reads as *not* proportional to the file's length, which is the opposite of what a `count()` summand assumes.
- AD-8 distinguishes two policies with two separate buckets (`trade-search-request-limit`, `trade-fetch-request-limit`) and notes *"`X-Rate-Limit-Policy` names the active policy and distinguishes the search bucket from the fetch bucket"*. Nothing establishes that currency-rate requests are charged to the search bucket rather than the fetch bucket or a third policy on an exchange endpoint.

So an implementer writing the validator must invent the conversion from "the currencies file" to "searches". Two readings — one search per currency, versus a single fixed request for the whole set — differ by roughly an order of magnitude on the left-hand side of an inequality whose right-hand side is ~15. **Fix:** state the currency workload's cost in searches in AD-12's table (the same way the tracked row states it), and have AD-26 cite that number rather than `count()` of the file.

Worth checking numerically while fixing it: with `minChunkSearches` seeded at 30, the cap is `pinned + currencies ≤ 15`. Under the one-search-per-currency reading, a currency list of the size AD-20 implies (normalisation currencies plus every craft-cost currency in `recipes.json`) can consume most or all of 15 on its own, leaving room for one or two pinned entries — or making the inequality **unsatisfiable at zero pinned entries**, a validator that rejects every possible tracked list. AD-26 should say what happens then; right now the only escape is the unbounded field in F-3.

### F-5 — major — rev 3 legitimises pinned starvation as an ongoing state but leaves intra-pinned ordering undefined

Rev 2's cap was justified on the premise that the pinned set always fits a chunk, and the rev-2 adversarial review closed finding 6a on exactly that premise: *"because the whole set fits in a chunk by construction, intra-pinned ordering is never load-bearing."* Rev 3 removes that premise. The runtime row now describes a chunk in which the allowance **cannot** cover the pinned set, and prescribes that `sync` *"completes the chunk and records a pinned-starvation line"* — i.e. the run proceeds and the state recurs chunk after chunk until a human reads the report.

In that state, intra-pinned ordering becomes load-bearing and AD-26 defines it only by the tie-break: *"Ties break on the canonical entry key … so a run is reproducible."* A deterministic key order means the **same** pinned tail is dropped every chunk, forever — the entries the player explicitly marked "watch this closely" are the ones that never refresh, and AD-10's per-row age is the only symptom. Row 2's design solves precisely this problem for `active` entries with oldest-`lastAttemptedAt`-first, and row 1 does not inherit it.

Two builders will diverge here without either violating a word of AD-26: one truncates the pinned set at the canonical key order (deterministic, permanently starved tail), the other rotates within the pinned set by `lastAttemptedAt` (non-reproducible between a dry run and a real one unless the clock is passed identically, but no entry starves). **Fix:** one sentence in row 1 — under-allowance, pinned entries are themselves selected oldest-`lastAttemptedAt` first, which preserves both the determinism claim (the order is still a pure function of the tracked list, the dataset and the clock value) and the no-permanent-starvation property.

Related, smaller: *"plus at least one `active` entry"* is undefined when the tracked list contains no eligible `active` entry (every entry pinned, or every non-pinned entry `unresolvable`), in which case the condition trips every chunk and the report accumulates a starvation line per run describing a shortfall that no curation change can remove.

### F-6 — major — the corrected `unresolvable` rationale still does not hold against AD-6, and "attempt" is now undefined

The amendment replaces a rationale that did not hold with two that are asserted rather than derived, and the first of them is contradicted by AD-6:

> "it paces re-validation so a large unresolvable set does not re-check and re-report every chunk"

AD-6's check table says the opposite: *"every `statId` / `baseTypeId` in `data/tracked.json` exists in the catalogue | `sync`, **before issuing any request**"*. That is a blanket pre-flight over the **whole** tracked list, every run, surfaced as *"the entry's `unresolvable` state + `sync-report.json`"*. Re-validation and re-reporting therefore already happen for every entry every chunk, whatever row 3's bound says. The 24h bound paces nothing that AD-6 does not already do unconditionally. The second reason offered (*"keeps row 3 beneath row 2"*) is a property of the **precedence order**, not of the bound — the rows-1–4 paragraph immediately above already establishes it, and it would hold identically if the bound were deleted.

This matters for the same reason OQ-9 gave for fixing it in the first place: an implementer sizing the bound against a benefit it does not deliver will pick the wrong number, or will conclude the bound is decorative and drop it.

Underneath that sits a definitional gap the amendment creates. Row 3 bounds *"at most one **attempt** per entry per 24h, measured from that entry's `lastAttemptedAt`"*, while the new paragraph says the retry costs nothing until the catalogue changes. So what is an "attempt" at row 3 — the free offline re-validation, or a live search? Both readings break something:

- **If offline re-validation is an attempt,** it must stamp `lastAttemptedAt` for the bound to be measurable against it. But AD-6's pre-flight validates *every* entry every run, and AD-9 defines `lastAttemptedAt` as *"when `sync` last worked on the entry regardless of outcome"* — so on this reading every entry in the list gets its timestamp bumped every run, and **row 2's oldest-first ordering flattens to a tie across the entire tracked list**, decided by the canonical key. That silently destroys the rotation AD-26 exists to define.
- **If only a live search is an attempt,** then an entry that never becomes resolvable never acquires an attempt, its `lastAttemptedAt` never advances, and the 24h bound measured from it is vacuous — while an entry that *has* become resolvable is by definition no longer `unresolvable` and is a row-2 candidate, so row 3's selection set contains nothing that costs a request.

**Fix:** state explicitly whether AD-6's offline catalogue check stamps `lastAttemptedAt` (it should not, or F-6's first bullet follows), and re-ground the bound on what it actually buys — most plausibly determinism and report stability — or drop it and let row 3 be pure precedence.

### F-7 — major — AD-27's narrowing stops one level short: a slot no probability term consumes still gates the base

The amendment's own argument is *"the denominator counts only bases that need a pool"*. Applied one level down, the same argument applies to slots, and rev 3 does not apply it:

> "Both slots must be `complete`, since one `partial` slot is enough to make the base unrankable under AD-18."

But AD-18 says *"`P(combination)` treats prefix and suffix as **independent draws**: `P(prefix) × P(suffix)`, **with `P = 1` for an absent affix**."* A base all of whose crafted entries leave the suffix absent never consults the suffix pool — no probability derived for that base depends on suffix coverage at all. Requiring the suffix slot to be `complete` excludes such a base from the ranked list, and depresses the coverage fraction, on the strength of a pool it does not need. That is the same defect OQ-10 raised, one level down, and it is not a marginal configuration: AD-17's overlap predicate discusses prefix-only and suffix-only entries at length, and the `WEIGHTS-FILE-SCHEMA.md` example ships a base with `"suffix": { "poolCoverage": "complete", "entries": [] }`.

The rev-2 adversarial review flagged the adjacent ambiguity (*"`poolCoverage` is declared per `(base, slot)` in the companion, and AD-18 excludes **bases**"*) and it was closed by choosing "both slots" — a defensible simplification when nobody had articulated the "needs a pool" test. Rev 3 articulates that test and does not re-examine the earlier choice against it. **Fix:** gate on the slots the base's crafted entries actually use — a slot is required `complete` only if some non-pruned crafted entry on that base names an affix in it. If the simplification is kept deliberately, AD-27 should say so and say why, since it now sits one paragraph away from an argument that contradicts it.

### F-8 — minor — the sync-report starvation line has no reader, in an AD that binds `web`

AD-26 rests its case for the runtime half on visibility: *"The runtime half is what makes the failure AD-26 exists to prevent **visible** — … without the report line the symptom is indistinguishable from a slow refresh."* But nothing binds any component to surface it. `web` fetches `sync-report.json` (AD-24) and the Logging convention says *"The report is data the view reads"*, yet that is a permission, not an obligation; where the spine wants something surfaced it says so explicitly (AD-6: *"`web` must surface their existence"*; AD-23: *"`web` surfaces the tracked list's age"*). AD-26's **Binds** line already includes `web`, and after rev 3 the rule text gives `web` nothing to do.

The gap is consequential because of AD-7's deployment model: `sync` runs unattended under Task Scheduler and the Logging convention rules out free-text console output as the channel. A starvation line nobody renders is written to a file nobody opens, and the symptom stays exactly as indistinguishable from a slow refresh as it was before — the condition the amendment's own justification says it removes.

**Fix:** one clause in AD-26 (or AD-24's render obligations) requiring `web` to surface an active pinned-starvation condition, alongside the unresolvable count it already surfaces.

### F-9 — minor — the config schema has no named entity, while a second field makes it a real schema

AD-3 requires every named artifact to have *"a Zod schema in `contracts`"* carrying `schemaVersion`, and AD-22 requires every cross-boundary concept to have *"exactly one Zod schema in `contracts`"* — then enumerates ten entities, none of which is the config. `config.json` genuinely crosses a boundary: `sync` reads it (AD-19, Config convention) and `web` fetches it as one of AD-24's eight artifacts. With one field this was a defensible omission; with a second field that carries a numeric constraint (F-3) and is consumed by a validation rule, the config is now an entity with rules, and the entity list is where a builder looks for it.

Pre-existing in form, but rev 3 is what gives it weight. **Fix:** add `AppConfig` (or equivalent) to AD-22's enumeration and to the Consistency Conventions naming row, and let the `minChunkSearches` bound live in that schema.

### F-10 — minor — the Structural Seed system view still labels config as league-only

The source tree comment was updated; the system-view diagram three sections above it was not:

> `config[config.json — active league]`

It is the one remaining place the spine enumerates what `config.json` carries and does not mention `minChunkSearches`. Purely editorial, and listed only because the amendment updated its sibling.

### F-11 — pre-existing, critical, flagged under the "genuinely critical" allowance — `AGENT-WORKFLOW.md` still specifies the rotation on observation time

Not a revision-3 item, but it sits directly on amended material and is the same class of companion drift as F-1:

> `AGENT-WORKFLOW.md:72` — "AD-26 fixes the rotation order (pinned, then **oldest-observation-first** among `active`, then bounded `unresolvable` retries, never `pruned`)"

AD-26 row 2 and AD-9 both say `lastAttemptedAt`, and AD-9 spells out why the alternative is broken: *"without `lastAttemptedAt`, AD-26's rotation would re-select every `no-listings` entry forever — they never acquire an observation time."* An agent building `sync` from the workflow document builds precisely the defect AD-9 was amended to prevent. Since revision 3 already required opening `AGENT-WORKFLOW.md` for F-1, this should be corrected in the same pass.

---

## 3. Checklist disposition

| Check | Result |
| --- | --- |
| Every amended AD's Rule is enforceable | **No** — AD-26's load-time cap is unenforceable as written: no owner (F-2), a self-selected denominator (F-3), a summand with no stated unit (F-4). |
| The amendments prevent their stated divergence | **Partly** — OQ-11 yes; OQ-10 yes inside the spine, no in the companions (F-1); OQ-8 improves the denominator but opens F-2/F-3/F-5; OQ-9 substitutes a rationale that also does not hold (F-6). |
| The amendments miss no real divergence point | **No** — F-5 (intra-pinned order under starvation) and F-7 (slot-level residue of OQ-10's own argument) are live divergence points inside the amended material. |
| Nothing in Deferred / Open Questions lets two units diverge on amended material | **Yes.** Neither remaining open question (recipe distribution mechanics; per-tier item level at the producer) touches the pinned cap, the retry bound, the coverage denominator or the band spelling; the Deferred list is likewise untouched by the amendments. The rev-2 "Closed by revision 2" block is stale in labelling only — a `Closed by revision 3` block noting OQ-8..11 would help a later reader, but nothing diverges without it. |
| Amendments do not contradict or weaken another AD | **Two contradictions.** AD-26's pacing rationale against AD-6's unconditional pre-flight validation (F-6); AD-26's declared `minChunkSearches` against AD-8's no-hardcoded-rate / runtime-discovery rule (F-3). AD-26's load-time cap also silently interacts with AD-3's fail-closed load validation in `web` (F-2). |
| `config.minChunkSearches` reflected wherever config fields are enumerated | **Mostly.** AD-19 ✅, source tree ✅, AD-21 (unchanged, still correct — the player writes the file) ✅, AD-24 (unchanged, still correct — `web` already fetches `config.json`) ✅; AD-22 entity list ❌ (F-9), Structural Seed diagram ❌ (F-10), AD-12 (the search-budget AD the field is denominated against) ❌ (F-4). |
| `sync-report.json` starvation line reflected in artifacts / writers / schemas | **Partly.** AD-3 ✅ (no new artifact; the report is already a declared channel), AD-21 ✅ (`sync` already the sole writer), Consistency Conventions/Logging ✅ (structured records into the report). Missing: no reader obligation anywhere (F-8), and `SyncRunReport` is enumerated in AD-22 but the spine now expects three distinct report contents (per-source request counts — AD-12; tracked-list edit date — AD-23; pinned starvation — AD-26) with no single place saying so. |

---

## 4. Recommended minimum to accept

1. Name `sync` as the owner of the load-time cap, and say it is not a `web` render-blocking validation (F-2).
2. Bound `minChunkSearches` in the `contracts` schema, or reconcile it with AD-8's discovered allowance (F-3).
3. State the currency workload's cost in searches in AD-12 and cite it from AD-26 (F-4).
4. Define intra-pinned ordering under an insufficient allowance — oldest `lastAttemptedAt` first (F-5).
5. Re-ground or drop row 3's bound, and state whether AD-6's offline check stamps `lastAttemptedAt` (F-6).
6. Propagate AD-27's `rankable` denominator into `AGENT-WORKFLOW.md` and `WEIGHTS-FILE-SCHEMA.md`, and fix the observation-time rotation line in the same pass (F-1, F-11).

F-7 through F-10 are worth taking in the same edit but do not, on their own, block acceptance.
