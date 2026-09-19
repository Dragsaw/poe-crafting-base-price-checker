---
title: 'Review — spine revision 10 reconciled against the approved sprint change proposal'
type: review
status: final
created: '2026-09-19'
reviews:
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/WEIGHTS-FILE-SCHEMA.md
authority: docs/sprint-change-proposal-2026-09-19.md
---

# Review — spine revision 10 against the approved change proposal

**Verdict.** Every architecture-side change the proposal approved landed in substance.
Three approved passages did not survive the simplification pass intact, and one of them —
*"a tier cannot be isolated, and a band spanning two tiers is legitimate"* — is a rule a
curator acts on, present in `prd.md` and absent from the spine. Nothing approved was
contradicted; what is missing is missing by omission.

**Scope note, and what this review deliberately does not report.** After the proposal was
approved the user authorised a simplification pass that merged 29 ADs down to 19. AD-2,
AD-6, AD-14, AD-18, AD-21, AD-22, AD-23, AD-26, AD-28 and AD-29 were retired and absorbed
per the spine's *Retired AD map*. Proposal §5.4's *"29 ADs remain"* and *"AD ids are
stable"* are therefore **deliberately** unmet and are **not** reported as defects here.
What is reported is approved **content** that went missing in the merge, plus the full
inventory of stale `prd.md` citations the merge created.

---

## 1. Item-by-item reconciliation

### §4.1 — AD-28, retire the decomposition → absorbed into AD-11

AD-11 is retitled *"Weights are a consumed file of raw tiers, and containment resolves the
overlap"*, which carries the approved retitle's meaning.

| Approved element of the new body | Landed | Where |
| --- | --- | --- |
| Value-axis / tier-axis statement + the 2026-09-13 measurement | **Yes** | AD-11 — *"the value axis does not partition the tier axis"*, 53 of 63 item classes, up to 36% of a weapon class's pool |
| *"The overlap is reported, and it is not resolved"* as a removed **operation** | **Yes** | AD-11 — *"the file reports the overlap rather than resolving it"*; *"the producer performs no split, no aggregation, no normalisation and no value derivation"* |
| The band-unit clause, verbatim, + the raised-stakes note | **Yes** | AD-11 — the unit is *"whatever quantity the trade stat filter compares, and no other"* (OQ-12), followed immediately by the exact-representability requirement |
| *"A tier's value interval is derived, and `core` derives it the one way"* | **Yes** | AD-11 — *"derived, and `core` derives it the one way, in one place"*; the derivation table is `IMPLEMENTATION-NOTES.md` §1 |
| Exact-representability + the three-or-more-`#` hazard (§4.5g) | **Yes** | AD-11 (one sentence, cites OQ-19), spine *Open Questions* OQ-19 in full, `IMPLEMENTATION-NOTES.md` §1 *Exactness* |
| Whole-tier containment, partly-overlapped tier contributes nothing | **Yes** | AD-11, restated in AD-17's denominator passage and `IMPLEMENTATION-NOTES.md` §1 |
| …**with both rejected alternatives and why** | **Partial** | Pro-rating survives under *Deferred* with its reason. **Whole-tier inclusion — over-counts, inflates `ΣP` — appears nowhere in the spine.** See F-2 |
| *"What whole-tier containment costs"* — direction, unevenness, the two bounds, the stated assumption | **Yes** | AD-11 (understates, unevenly, reorders rather than shifts; AD-16's ascending sort and AD-17's edge alignment as the two bounds); the `[ASSUMPTION]` tag sits in AD-16 rather than AD-11 |
| *"A tier cannot be isolated, and a band spanning two tiers is legitimate"* | **No** | **Missing from the spine.** See F-1 |

Deletions the proposal ordered are all clean: no partition procedure, no
`weight(t, c) = w(t) × P(value ∈ c | t)`, no cohort-total argument, no mass conservation,
no `cohortTotals`, no summation-order or exact-comparison rules, no at-most-two-cohorts
bound, no value lattice paragraph, no interior-cell curation rule. A search of the spine
for *value cell*, *cohort*, *cohortTotals*, *statLineCounts* and *straddle* returns only
two hits, both explicit records of retirement (AD-17's *"the straddle rule and band
non-overlap are withdrawn"*, and the Structural Seed's *"not a cell in a cohort"*).

### §4.2 — AD-18, containment / alignment / straddle / denominator → absorbed into AD-17

| Approved | Landed | Where |
| --- | --- | --- |
| a. Containment table matching on an entry's `lines`, both kinds | **Yes** | `IMPLEMENTATION-NOTES.md` §1 *Containment*, as a predicate rather than a table |
| a. Whole weight once; merely-overlapping contributes nothing and is not an error; a `null` `statId` can never be contained but still enters the denominator | **Yes** | `IMPLEMENTATION-NOTES.md` §1, all three bullets present verbatim in substance |
| b. Edge alignment retargeted to derived intervals, with the worked accept/reject table | **Yes** | `IMPLEMENTATION-NOTES.md` §2.4, including the new fourth row (`43.0 – 60.0` rejected) and the floor-scoping warning |
| c. Straddle withdrawn, stated as **forced**; non-overlap withdrawn with it | **Yes** | AD-17 — *"the withdrawal is forced rather than chosen … would reject every crafted configuration on 53 of 63 item classes"*; Consistency Conventions *Bands* row |
| d. Check count five → four; kind agreement **retargeted**, read from `ranges` | **Yes** | AD-17 *"Four cross-file checks"*, AD-12 *"all four checks"*, `IMPLEMENTATION-NOTES.md` §2.3. No surviving *"five"* anywhere in the spine |
| e. Denominator collapses to a plain sum; invariant now **structural** | **Yes** | AD-17, with `mass(g)` and `sources(S)` gone from the document entirely |
| f. Empty containment set keeps both causes; nothing mechanical behind the second | **Yes** | AD-17 and `IMPLEMENTATION-NOTES.md` §2.5, which also carries the single-publisher asymmetry |

Everything the proposal listed as unchanged is unchanged: the `Prevents` clause, the
no-open-top rule (AD-5), floor dependence, both stated assumptions, independent draws, the
partial-pool/unrankable rule and the recipe rule.

### §4.3 — AD-29, one entry per tier → absorbed into AD-11

| Approved | Landed |
| --- | --- |
| `Prevents` narrows to the co-occurrence loss and the several-draws misreading | **Yes** — AD-11's `Prevents` keeps *"the permanent loss of the fact that two stats always roll together"*, and the body states *"all of one entry's lines roll together as a single draw"* |
| Emission model: one entry per source row, lines nested | **Yes** — AD-11, *"one entry is one tier of one modifier, and an entry and a source row are the same thing"* |
| The Body Armours worked case (one entry, weight 1000, two lines) and the *"replaces an explosion with a nesting"* framing | **No** — see F-3 |
| Three checks retire (one-cohort, group-consistency, `statLineCounts`) | **Yes** — subsumed by AD-11's *"`5.0.0` withdrew ten checks, each because its subject is gone rather than because the bar dropped"* |
| `coOccur` becomes a direct read of one entry's `lines`; the cohort clause retires | **Yes** — `IMPLEMENTATION-NOTES.md` §2.2, *"no cohort reasoning is involved"* |
| `statId: null` is data, never a file error, never a reason to declare a pool `partial` | **Yes** — AD-11, AD-9, AD-27, `WEIGHTS-FILE-SCHEMA.md` *Not a file error* |
| New closing passage: what `core` can still check and what it cannot | **Yes** — AD-11, *"What `core` can check, and what it cannot"*, naming the widened trust surface and the quiet case |

### §4.4 — AD-10, Provenance four → three

All landed. The three-value table is exactly as approved, rank and *Arises from* column
included. The `weightSource` mapping is stated once, in AD-10, with the
*`"absent"` → provenance `absent`* misreading called out. *"Two render treatments, not
three"* is present. The numerator-only propagation exception is explicitly retired
(*"with no exception — the numerator-only exception retired with `modelled-split`"*). The
revisit condition rides on the *Consumer-side pro-rating* Deferred item and names AD-10.
The revision-9 freshness cut-off content is untouched.

### §4.5 — Citation repairs and the new finding

| | Approved | Landed |
| --- | --- | --- |
| a | AD-11's file shape rewritten to entries + lines; *"the producer performs no value math"*; bootstrap gains `weightSource: "absent"` | **Yes** |
| b | AD-12 *"all four"*; the budget clause **reverses** | **Yes** — *"Under `5.0.0` the curation unit is the tier … that pressure is relieved rather than added to"* |
| c | AD-17 `coOccur` reads `lines`; cohort clause retires; kind agreement from `ranges` | **Yes** |
| d | A `null` `statId` is **skipped** by catalogue validation, and `sync` must not report it as uncatalogued | **Yes** — AD-9 (old AD-6's home), and restated in `WEIGHTS-FILE-SCHEMA.md` *Field rules* |
| e | Consistency Conventions — *Bands* records free overlap and the withdrawal at every scope; *Item level* reads "entry" | **Yes** |
| f | Structural Seed — `ModifierWeight` is one tier holding its lines, not a cell in a cohort | **Yes**, verbatim |
| g | **OQ-19** raised; the answer is a contract amendment, never an epsilon | **Yes** — spine *Open Questions*, `IMPLEMENTATION-NOTES.md` §1, `WEIGHTS-FILE-SCHEMA.md` *Producer expectations* |
| h | Deferred — three retire, one amended, three added | **Yes** — *measured split for value cells*, *`statLineCounts` required* and *numeric tolerance on the sum rules* are gone; *pricing a deliberate conjunction* is amended; consumer-side pro-rating, measuring the understatement and a mechanical guard are added, in the approved sequence |
| — | Open Questions — the filter-unit question amended to record two independently bound parties and a loud failure | **Yes** — OQ-12 |

### §4.12 — `WEIGHTS-FILE-SCHEMA.md`

Every item landed: `status: final`; `updated: '2026-09-19'`; `governed_by` gains AD-17;
the producer-side-draft callout is replaced by an authoritative-copy callout naming the
adoption date and this proposal; the gitignore claim is corrected and the `2.0.0`–`4.1.0`
text is declared recoverable from git with the adoption commit as the boundary;
*Repository placement* states this repo owns the document and that a producer copy is a
proposal with no effect, with the shared-package split left Deferred; the duplicate-
`statId`-within-one-entry hard error is added; the *Not a file error* bullet is amended to
state that the consumer does **not** derive disjoint intervals and that a producer must not
merge or trim tiers; and the line-arity note puts OQ-19 in front of the producer.

The file also carries an unrequested but correct addition: a header note recording that
spine revision 10 renumbered the AD citations (AD-6 → AD-9, AD-18 → AD-17, AD-28/AD-29 →
AD-11). Its own citations are all live ids.

### §5.4 — Architecture-relevant success criteria

| Criterion | Result |
| --- | --- |
| No surviving *Value Cell*, *Cohort*, *`cohortTotals`*, *`statLineCounts`*, *`modelled-split`*, *straddle* or *`provenance` field* in the spine, except as a record of retirement | **Met.** Two hits, both retirement records |
| …the same, in `prd.md` | **Met.** Every hit (L280, L292, L573, L721, L731, L784, L785, L816) is a record of a retirement or a retired-OQ log entry |
| Every `(AD-n)` citation in `prd.md` resolves | **Not met — by the authorised deviation.** 106 occurrences on 84 lines name a retired id. Inventory in §3 |
| `prd.md` contains exactly 33 FRs | **Met.** FR-1 … FR-33, no gaps |
| `ARCHITECTURE-SPINE.md` contains exactly 29 ADs | **Not met — deliberately.** 19 ADs, with a *Retired AD map* giving every retired id its home |
| `prd.md` §7.1 byte-identical to revision 9 | **Met.** Diffed against `HEAD:prd.md` (revision 9): §7.1 *In Scope*, lines 691–705, is unchanged. The differences in §7 fall entirely in §7.2 and §7.3, where the proposal ordered them |
| The cross-file gate described as **four** checks in AD-12, AD-17, AD-18, FR-14, FR-16, FR-29, with no surviving "five" | **Met in effect.** AD-12 *"all four checks"*, AD-17 *"Four cross-file checks"* (AD-18 is now part of AD-17). FR-16 and FR-29 each describe their own **two**, which compose to four; no "five" survives in either document. FR-14 describes four **sources** and no longer states a check count at all — not a stale figure, but the criterion's sixth location is unwitnessed |
| OQ-19 appears in `prd.md` §10, spine *Open Questions*, `WEIGHTS-FILE-SCHEMA.md` *Producer expectations* | **Met** in all three |

---

## 2. Findings — approved content that did not land

### F-1 — *"A tier cannot be isolated, and a band spanning two tiers is legitimate"* is absent from the spine — **Medium**

§4.1 lists this both under **Retained** and as the closing passage of AD-28's approved new
body. The spine contains no occurrence of *isolated*, *adjacent tiers* or *spanning*, and
neither AD-11 nor AD-17 states it. `prd.md` L596 carries it in full, including the
corollary that what a band must not do is reach partway into a tier.

Why it matters: this is the clause that licenses a curator to write `43.0 – 80.0` across
T7 and T8. Without it the spine's only trace of the permission is one row of
`IMPLEMENTATION-NOTES.md` §2.4's worked table (*"a run of adjacent tiers — accepted"*),
which is an example rather than a rule, and the reader is left with AD-17's containment
language, which reads as though one band should correspond to one tier.

**Fix:** one sentence in AD-11, immediately after the containment passage.

### F-2 — The rejected alternative *whole-tier inclusion* is unrecorded — **Low**

§4.1 approved the containment passage *"with both rejected alternatives and why"*.
Pro-rating survives, with its reason, as the first Deferred item. Whole-tier inclusion —
every overlapping tier contributes full weight, rejected because it over-counts and
inflates that base's `ΣP` — appears nowhere in the spine. The asymmetry matters because
inclusion is the reading a builder reaches for first when told that a partly-covered tier
"does not count": the natural correction is to count it whole, and nothing in the spine
says why that is wrong.

**Fix:** a clause in AD-11's containment passage, or a third Deferred entry.

### F-3 — AD-29's emission-model illustration and framing were dropped — **Low**

§4.3 approved the Body Armours case — one entry at weight 1000 with two lines — and the
framing *"Revision 10 replaces an explosion with a nesting"*. Neither survives. The
surviving illustration is `WEIGHTS-FILE-SCHEMA.md`'s hybrid evasion entry, which is the
same shape at the same weight but sits in the contract rather than in the decision, and
the framing sentence — which is what tells a reader of revision 9 that the entry count
*fell* rather than that the model changed — is gone. Consistent with the simplification
pass's stated aim ("it no longer argues for itself"), and recorded rather than pressed.

### F-4 — `WEIGHTS-FILE-SCHEMA.md` uses *cohorts* as live prose — **Low**

Line 101: *"**The file is not** deduplicated across cohorts."* Every other occurrence of a
retired term in that file sits in the §*5.0.0 — what changed and why* table, which is a
retirement record. This one is a live statement about the file using a unit the contract no
longer defines. §5.4's term sweep does not name this file, so this is below the criterion
rather than a breach of it.

**Fix:** *"across tiers of one family"*, which the same sentence already says.

### F-5 — Out of this review's scope, recorded so it is not lost — **informational**

`docs/ux-designs/…/EXPERIENCE.md` still contains `statLineCounts`. Proposal §4.11 routed
the UX spines to the designer and this review does not assess them; the hit is noted only
so the UX pass has it.

---

## 3. Stale `prd.md` citations naming a retired AD id

`prd.md` is at revision 10 and absorbed the same change, but it was written against the
29-AD spine. **106 citation occurrences, across 84 distinct lines, name one of the ten
retired ids.** `prd.md` L22 additionally asserts *"the spine's decisions AD-1 through AD-29
are **inherited, not re-decided**. **AD ids are stable…**"*, which is now false at the
document's own front — it should be the first line the PRD pass fixes.

Resolution targets, from the spine's *Retired AD map*:

| Retired | Now cite | Occurrences |
| --- | --- | --- |
| AD-2 | AD-1 | 2 |
| AD-6 | AD-9 | 8 |
| AD-14 | AD-19 | 6 |
| AD-18 | AD-17 | 30 |
| AD-21 | AD-3 | 6 |
| AD-22 | AD-3 | 2 |
| AD-23 | AD-12 | 10 |
| AD-26 | AD-7 | 13 |
| AD-28 | AD-11 | 10 |
| AD-29 | AD-11 | 19 |
| **Total** | | **106** |

Two lines need judgement rather than substitution. **L783** (*OQ-18 … became `sync`
run-start gates on AD-18's schedule*) and **L785** (*OQ-16 … reconciled to AD-18's
un-subscripted form*) are retired-OQ log entries describing what a past spine revision
decided; rewriting the id would falsify the record. Prefer *"AD-18, now AD-17"* or leave
them and note the map. The same reading applies to **L770** (AD-22) and **L787** (AD-6).

Full inventory, grouped by retired id, line number first:

### AD-2 — 2 citation(s)

- **L667** — ...aph mechanically, rather than review enforcing it. Two agents in two packages therefore touch no common file (AD-2). `contracts` changes are **serialised and land alone, firs...
- **L667** — ...ll pipeline against recorded fixtures and writes nowhere. These partitioning rules are `AGENT-WORKFLOW.md`'s. AD-2 supplies only the dependency graph that the partitioning ru...

### AD-6 — 8 citation(s)

- **L256** — ...tries and does not merely omit them. The existence of an `unresolvable` entry is the symptom of a game patch (AD-6).
- **L489** — - `sync` writes that entry's Price State as `unresolvable` **and** records that entry in the Sync Report (AD-6).
- **L490** — ...hat entry at its previous value. A patched-out modifier must not keep ranking on its last-good price forever (AD-6).
- **L491** — ...A tool that conflates the two states would report a patch-out every time a Combination simply had no sellers (AD-6, AD-9).
- **L493** — ...ads the Weights File and never writes the Weights File, so `sync` reports the failure rather than repairs it (AD-6, AD-21).
- **L502** — ...umed **per declared source** against the live bucket (AD-12, FR-14). The report records unresolvable entries (AD-6). The report records the date of the last tracked-list edit...
- **L506** — ...t is otherwise indistinguishable from a stalled Dataset. *Not reached* is a **rotation outcome, not a skip**: AD-6 forbids a skip, and FR-17's defined order is what makes the...
- **L787** — ...-only, never a `core` file-refusal, because `core` has no access to the catalogue. Retired by spine rev 5, in AD-6's direction. Amended: FR-27.

### AD-14 — 6 citation(s)

- **L110** — - **Dataset** — the published snapshot of the latest Price Observation per Tracked Entry (AD-14).
- **L310** — - A partially refreshed Dataset publishes and renders normally. Per-row freshness is what makes that honest (AD-14).
- **L626** — ...e. League filtering happens once, in `core`, so a league change does not blank the site while a re-sync runs (AD-14). `[ASSUMPTION: this makes a league change a config edit pl...
- **L626** — ...MPTION: this makes a league change a config edit plus a natural re-sync with no manual purge. It follows from AD-14 and AD-19 but has not been exercised against a real reset.]...
- **L683** — - **Price history features.** Git carries the history through sync commits. No v1 feature reads that history (AD-14). UJ-5's "returned no listings all league" judgment is ther...
- **L824** — ... config edit and a natural re-sync, with no Dataset rewrite and no manual purge. This assumption follows from AD-14 and AD-19, but nobody has exercised it against a real reset...

### AD-18 — 30 citation(s)

- **L26** — ...r, a pool with no item-level dimension, and unmeasured pool coverage — were absorbed into AD-5, AD-16, AD-17, AD-18, AD-27 and the Weights File schema; §10's *resolved by spin...
- **L94** — ...le Pool*, FR-29). `core` reads the id only at **load**, for the duplicate-entry check FR-27 specifies (AD-29, AD-18, AD-17).
- **L97** — ...ator itself. **The denominator is a plain sum over entries** — one entry, one tier, one weight, counted once (AD-18, AD-29, FR-29). **A partly-covered entry is in the denomina...
- **L97** — ...rovenance*, FR-29). A pool declared anything other than `complete` makes the pool's Base Type **Unrankable** (AD-18).
- **L108** — ...e Pool is incomplete or absent. The tool returns an Unrankable Base Type in a separate group with the reason (AD-18).
- **L132** — ...ighted is the tier that is priced. Both halves of the probability are scoped to the entry's Item Level Floor (AD-18, FR-29).
- **L160** — ...sent from the Weights File entirely is Unrankable. `core` excludes an Unrankable Base Type from the ordering (AD-18).
- **L165** — ...robability is an upper bound and not an estimate. A `partial` pool is the only path by which `absent` arises (AD-18, FR-10, FR-28).
- **L373** — ...lue that scopes every probability on that Base Type. FR-16 and FR-22 give a Base Type exactly one `L` (FR-29, AD-18).
- **L374** — ...se to load in its entirety, which is a worse waste than the per-entry failures those two checks catch (AD-17, AD-18).
- **L375** — ...builder rejects `data/tracked.json` site-wide, and **both readings satisfy the predicate as written** (AD-17, AD-18).
- **L471** — - That floor is what scopes the Eligible Pool that normalises every probability on the Base Type (FR-29, AD-18). The floor is a valuation input, not only a search paramet...
- **L523** — ...g does not change with the Craft Recipe, and two Craft Recipes differ only by the cost that `core` subtracts (AD-18). This is a documented limitation. An implementer must not ...
- **L549** — ...om the file entirely is likewise Unrankable. `core` has no other pool source, and `core` must not invent one (AD-18).
- **L556** — ...Base Type, slot)`. Containment is evaluated on an entry's `lines`, and depends on the reference's kind (AD-5, AD-18):
- **L564** — ...nal as `P(ref | base, slot, L)`. The conditional is over the **Modifier Reference**, which names a Stat Line (AD-18, AD-5).
- **L573** — ...`4.x` had to rule out by checking one-Cohort-per-group no longer has a shape in the file that could reach it (AD-18, AD-29).
- **L576** — ...he curator tracks a tier that cannot roll on the item being crafted. To contribute zero would hide that fact (AD-18).
- **L577** — ...gnment. `core` runs both exactly alike — `web` at load, `sync` at run start — per the ownership clause below (AD-18).
- **L579** — ...o reads the empty-containment-set error as a complete defence reads a check that, for this case, cannot fire (AD-18, AD-29).
- **L590** — ...s withdrawn. A check re-implemented in either shell would be the divergence that this rule exists to prevent (AD-18, AD-12).
- **L592** — ... be unrankable anyway. The defect would surface a day after `sync` spent the requests that proved the defect (AD-18, AD-12).
- **L593** — ...ho computes the containment set **unscoped** silently accepts exactly the references that this check catches (AD-18).
- **L597** — ...ifference. To correct the difference would need an exact-item-level filter that the trade API does not offer (AD-18).
- **L605** — ...er than a degradation to design around. There is no other pool source, and `core` must not invent one (AD-11, AD-18). Raw Bases are the exception and rank without the file, si...
- **L659** — ...re it spends anything should stop, and a shell that can only render should render (FR-29, AD-3, AD-24, AD-26, AD-18).
- **L708** — - **A second Craft Recipe** — AD-18 makes ordering recipe-invariant in v1. A second recipe ther...
- **L777** — ... — Does any single Stat Line carry three or more `#`, and if so, is its derived edge exactly representable?** AD-18 compares a curator's declared band edge against a derived t...
- **L783** — - **OQ-18** — AD-17's `coOccur` and cross-file kind-agreement checks became `sync` run-start gates on AD-18's schedule, closing an ownership gap AD-17 left open. Retir...
- **L785** — - **OQ-16** — The source-modifier mass function's two spellings (`mass(g)` vs `mass(g, L)`) reconciled to AD-18's un-subscripted form, backed by a new hard file error requ...

### AD-21 — 6 citation(s)

- **L323** — ...rcise. The Tracked List is a hand-owned, committed file. The browser never writes to the Tracked List (AD-15, AD-21). The system cannot discover a Combination that nobody tell...
- **L493** — ...e Weights File and never writes the Weights File, so `sync` reports the failure rather than repairs it (AD-6, AD-21).
- **L507** — ..., by explicit path — never `git add -A` — so an automated commit never includes an in-progress curation edit (AD-21).
- **L648** — ...`'s share of this file** — that check is `sync`'s, against `data/currencies.json`, which `web` never fetches (AD-21, AD-24). The cost of dropping the icon is small by construc...
- **L656** — ...json`. **`data/currencies.json`** is a sync-side workload declaration that `web` has no use for (AD-3, AD-24, AD-21). The eight are the complete set. A ninth artifact is an ar...
- **L668** — ...nd sync-owned outputs belong to the syncer. An agent that needs different data uses a fixture, never an edit (AD-21).

### AD-22 — 2 citation(s)

- **L521** — .... `core` computes a Craft Recipe's Craft Cost from synced exchange rates. `sync` never computes a Craft Cost (AD-22).
- **L770** — ...ment. The spine's revision-2 note records that OQ-1 routed the `itemLevelMin` amendment to architecture under AD-22. AD-5 and Weights File schema 2.0.0 then absorbed that amen...

### AD-23 — 10 citation(s)

- **L81** — - **Curation Status** — exactly one of `active`, `pinned` or `pruned` (AD-23, FR-17). A Chunk selects a `pinned` entry **first in every ...
- **L111** — ...ion records**, the measured pool-coverage fraction (FR-4), and the date of the last tracked-list edit (AD-12, AD-23, AD-26, AD-27).
- **L130** — ...Curation Status `pruned` is not a summand. Pruning therefore changes the ranking, and pruning is not a no-op (AD-23).
- **L317** — - The view labels prices as current asking prices from live instant-buyout listings (AD-23).
- **L349** — ... truncation normatively, in both of their owners. This consequence is a summary and defers to FR-17** (FR-17, AD-23, AD-26).
- **L350** — ...rkload **and** from the ranking sum. A `pruned` entry's last-good price never contributes to the ranking sum (AD-23, AD-17).
- **L406** — - The Sync Report records the date of the last tracked-list edit, and the view shows that date (AD-23).
- **L407** — ...nd-maintained field. A hand-maintained field would become stale exactly when the date mattered. `[ASSUMPTION: AD-23 requires the date be recorded but names no mechanism.]`
- **L502** — ...). The report records unresolvable entries (AD-6). The report records the date of the last tracked-list edit (AD-23). The report records the **pool-coverage fraction** measure...
- **L654** — ...curator's own decision, and an invitation to re-examine its market undercuts the reason it was pruned (FR-15, AD-23).

### AD-26 — 13 citation(s)

- **L22** — ...ich decisions each early round amended; git history carries the rest). AD-25 (the committed Trade Catalogue), AD-26 (Refresh Rotation), AD-27 (the pool-coverage gate), AD-28 (...
- **L82** — ...hen `pinned`, then `active` by oldest `lastAttemptedAt`, then bounded `unresolvable` retries, never `pruned` (AD-26, FR-17).
- **L86** — ... across the whole Tracked List, and the Refresh Rotation would silently degrade to canonical key order (AD-9, AD-26). `lastAttemptedAt` is reachable in **all four** Price Stat...
- **L109** — ...arches` is a **declared yardstick** read at exactly one place — FR-17's load-time `pinned` cap (FR-19, FR-31, AD-26).
- **L111** — ...ords**, the measured pool-coverage fraction (FR-4), and the date of the last tracked-list edit (AD-12, AD-23, AD-26, AD-27).
- **L349** — ...tion normatively, in both of their owners. This consequence is a summary and defers to FR-17** (FR-17, AD-23, AD-26).
- **L389** — ... choice. A Chunk selects entries in exactly this order. A Chunk stops when the Chunk reaches any Chunk bound (AD-26, FR-19).
- **L503** — ... `active` entry (FR-17). The record carries `discoveredAllowance`, `pinnedCount` and `activeRefreshed`, which AD-26 names. The record also carries **`declaredMinChunkSearches`...
- **L504** — ... the record exists to remove. Without the named shortfall, an oversized pinned set looks like a slow refresh (AD-26).
- **L505** — ...his list is not doing what he thinks it is. A report field that nothing renders is a field that nobody reads (AD-26).
- **L506** — ...y's turn has not come, and the report states that fact rather than implies that `sync` passed over the entry (AD-26).
- **L623** — ...*The file is not a settings bag. A fourth field is an architecture amendment**, not a config addition (AD-19, AD-26).
- **L659** — ...op before it spends anything should stop, and a shell that can only render should render (FR-29, AD-3, AD-24, AD-26, AD-18).

### AD-28 — 10 citation(s)

- **L22** — ...s the rest). AD-25 (the committed Trade Catalogue), AD-26 (Refresh Rotation), AD-27 (the pool-coverage gate), AD-28 (value-axis handling) and AD-29 (per-modifier Stat Lines) b...
- **L80** — ...2 and is therefore too rare to chase. The mechanical expression of the Accepted Tier depends on the modifier (AD-28, FR-22). For a modifier whose text carries **one** `#`, tie...
- **L80** — ... (AD-5). The label is a **string** — `"T1"`, or `"T1–T2"` where the curator accepted a run of adjacent tiers (AD-28, FR-22). **The label is display-only.** `core` and `sync` n...
- **L93** — ...ather than partition it — the overlap is reported, and this contract does not resolve it (§3 *Eligible Pool*, AD-28, AD-29). A Modifier Weight is consumed from the **Weights F...
- **L93** — ...AD-28, AD-29). A Modifier Weight is consumed from the **Weights File** and never produced by this app (AD-11, AD-28, AD-5).
- **L97** — ... now **expected rather than merely tolerated**, because contract `5.0.0` leaves tier overlap in the raw data (AD-28, AD-29). `core` scopes the pool to a Tracked Entry's Item L...
- **L445** — ...s, not integers.** Under an averaged unit the value lattice is half-integers, so `56.5` is a legitimate edge (AD-28). Whether the trade filter accepts a non-integer `min`/`max...
- **L446** — ...erted as a proven bound, because nobody has measured the mismatch against a real 5.0.0 file (§7.2).]` (AD-16, AD-28).
- **L462** — ...ppy.** `"T1–T2"` is legal. For a modifier whose text carries more than one `#`, tiers overlap in value space (AD-28), so a curator may genuinely be accepting a run of adjacent...
- **L776** — ...and no other**. FR-21 passes the band edges into the filter, and FR-29 counts the population that comes back (AD-28, AD-16). The evidence that the quantity is an average is in...

### AD-29 — 19 citation(s)

- **L22** — ...ttled architecture**. `ARCHITECTURE-SPINE.md` is final at revision 10, and the spine's decisions AD-1 through AD-29 are **inherited, not re-decided**. **AD ids are stable acro...
- **L22** — ...d Trade Catalogue), AD-26 (Refresh Rotation), AD-27 (the pool-coverage gate), AD-28 (value-axis handling) and AD-29 (per-modifier Stat Lines) bear most directly on the require...
- **L72** — ...l. `sourceModifierId` therefore re-encodes nothing, and the flat-ids rule does not forbid `sourceModifierId` (AD-29).
- **L73** — ...ModifierId` is never part of a Modifier Reference, a Tracked Entry, or a Tracked Entry's canonical key (AD-5, AD-29). A **`banded`** reference is a trade API `statId` paired w...
- **L92** — ...r. A Stat Line is what the trade API exposes, and therefore a Stat Line is all a curator can filter on (AD-5, AD-29). **Pool completeness has two halves, and both are the prod...
- **L93** — ...han partition it — the overlap is reported, and this contract does not resolve it (§3 *Eligible Pool*, AD-28, AD-29). A Modifier Weight is consumed from the **Weights File** a...
- **L94** — ...*Eligible Pool*, FR-29). `core` reads the id only at **load**, for the duplicate-entry check FR-27 specifies (AD-29, AD-18, AD-17).
- **L97** — ...expected rather than merely tolerated**, because contract `5.0.0` leaves tier overlap in the raw data (AD-28, AD-29). `core` scopes the pool to a Tracked Entry's Item Level Fl...
- **L97** — ...self. **The denominator is a plain sum over entries** — one entry, one tier, one weight, counted once (AD-18, AD-29, FR-29). **A partly-covered entry is in the denominator and...
- **L133** — ..., because **this** is the FR that asserts the `ΣP ≤ 1` premise that those rejections exist to protect (AD-17, AD-29).
- **L372** — ...pe) that the entry-per-tier shape now makes definitionally true, rather than adding a case to exclude (AD-17, AD-29).
- **L472** — ... of these"* as one outcome, which is why FR-16 rejects the configuration rather than approximating it (AD-17, AD-29).
- **L541** — ...he denominator counts the entry once either way. `WEIGHTS-FILE-SCHEMA.md` states both halves of completeness. AD-29 supplies the underlying fact that one modifier may publish ...
- **L542** — ... `statId: null` is data about the source, never a file error and never a completeness defect (§3 *Stat Line*, AD-29).
- **L573** — ...ad to rule out by checking one-Cohort-per-group no longer has a shape in the file that could reach it (AD-18, AD-29).
- **L579** — ...s `statId` had a **single** publisher. Where a **second Source Modifier publishes the same `statId`** — which AD-29 expressly permits (§3 *Eligible Pool*) — the other modifier...
- **L579** — ... the empty-containment-set error as a complete defence reads a check that, for this case, cannot fire (AD-18, AD-29).
- **L712** — ...rejects a configuration that a curator will plausibly try, and **why** that rejection is not a defect (FR-22, AD-29).
- **L730** — ...y this PRD states the version number here rather than leaves the version number to the contract alone (AD-11, AD-29).

TOTAL citation occurrences: 106
