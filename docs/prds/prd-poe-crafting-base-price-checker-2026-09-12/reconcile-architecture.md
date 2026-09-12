---
title: 'PRD ↔ Architecture Reconciliation'
status: draft
created: 2026-09-12
scope: 'Fidelity check only — coverage and faithfulness, not quality'
target: docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md
against:
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/WEIGHTS-FILE-SCHEMA.md
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md
---

# PRD ↔ Architecture Reconciliation

This is a **fidelity** check against a settled spine the PRD was instructed to inherit rather than re-decide. It is not a quality review. Three verdicts are used:

- **Reflected** — the AD surfaces in the PRD at the cited FR/NFR/section.
- **Structural (not reflected, correctly)** — the AD governs internal shape that is invisible to the player; its absence from a requirements document is right.
- **MISSING** — the AD has a player-visible or requirement-bearing consequence the PRD does not carry.

Headline: coverage is high. All 24 ADs are accounted for, none contradicted outright, all three spine Open Questions are handled, and the one intentional divergence is flagged in three places. The substantive findings are (a) an unreconciled consequence of that divergence on AD-18's eligible-pool model, (b) the dropped half of the weights-file pool-completeness rule, and (c) a small family of AD-24 over-citations.

---

## 1. AD Coverage Table

| AD | Subject | Verdict | Where in PRD |
| --- | --- | --- | --- |
| AD-1 | Valuation is pure; outside world is a port | **Reflected** (partially; correctly so) | NFR-3 ("time, randomness and configuration enter only as passed-in values"). The port/adapter mechanics themselves are structural and rightly absent. |
| AD-2 | One-way, mechanically enforced dependency direction | **Reflected** | NFR-4 — "disjoint directories with a one-way acyclic dependency graph, mechanically enforced in CI rather than by review". |
| AD-3 | Sync↔web only via schema-pinned artifacts | **Reflected** (thin) | NFR-8 carries `schemaVersion` + validate-on-load + refuse-unknown-major. The "exactly two sync-produced artifacts, adding a third amends this AD" clause is structural and correctly absent. **Gap:** AD-3's *"`web` … refuses to render an invalid artifact rather than degrading"* is a player-visible failure mode and appears only for the weights file (FR-24), not for `dataset.json`/`sync-report.json`. |
| AD-4 | Ranking computed at read time | **Reflected** | §4.1 description, FR-1 last bullet, FR-5 second bullet, §4.1 feature NFR. |
| AD-5 | Canonical modifier identity `(statId, valueMin)` | **Reflected** (and intentionally extended) | Glossary "Base Type", "Modifier Reference", "Tracked Entry", "Raw Base"; FR-19 third bullet. See §4 for the `itemLevelMin` extension. |
| AD-6 | Unresolvable stat id is a loud failure | **Reflected** | FR-20 (all three bullets), FR-8 third bullet. |
| AD-7 | Bounded, resumable, single-instance chunk runner | **Reflected** | FR-16; Glossary "Chunk"; FR-10 first bullet. |
| AD-8 | One governed trade client | **Reflected** | FR-17; NFR-9. |
| AD-9 | Four-state price; absence is never zero | **Reflected** | Glossary "Price State"; FR-8; FR-1 fourth bullet; FR-18 third bullet; FR-22 fourth bullet. |
| AD-10 | Provenance and freshness propagate upward | **Reflected** | FR-9, FR-10; Glossary "Provenance"; NFR-10. |
| AD-11 | Weights are a consumed file | **Reflected** | FR-24; §5 first non-goal; §4.8 description. |
| AD-12 | Workload is two declared sets; tracked list is the budget | **Reflected** | FR-12 (incl. the ~1,500 / ~2,400 sizing); FR-21 first bullet; SM-C1. |
| AD-13 | Test path has zero network | **Reflected** | NFR-1, NFR-2. |
| AD-14 | Dataset is the snapshot; git is the history | **Reflected** | FR-27 fourth bullet; FR-10 second bullet; §5 "Price history features"; Glossary "Dataset". |
| AD-15 | Browser writes nothing; no backend | **Reflected** | FR-6 first bullet; NFR-7; §2.2 fourth bullet; §5 "Accounts, sharing…". |
| AD-16 | Price = cheapest live instant-buyout listings | **Reflected** | FR-18 (all four bullets); FR-3 third bullet. |
| AD-17 | Ranking formula, threshold, unit | **Reflected** | FR-1 (bullets 1–3), FR-3 first bullet (raw-base branch), FR-14 (mutual exclusivity), FR-5. |
| AD-18 | Weight aggregation and normalisation | **Reflected** | FR-26 (all five bullets), FR-4, FR-23 third bullet, §6.2 "Mod-group conditional probability". |
| AD-19 | League is part of every observation's identity | **Reflected** | FR-27, FR-28; UJ-6; SM-3. |
| AD-20 | One currency unit crosses every boundary | **Reflected** | FR-22; Glossary "Divine"; FR-5 first bullet. |
| AD-21 | One writer, one entity, one commit path | **Reflected** | NFR-5; FR-21 bullets 2–3; §4.5 description. |
| AD-22 | Every shared concept defined once in `contracts` | **Reflected** (thin, correctly) | FR-23 first bullet; §0 and §9 Open Question 1 invoke AD-22 as the amendment route. The rest is structural. |
| AD-23 | Curation is a deliberate, reviewed act | **Reflected** | FR-13, FR-15, FR-11; Glossary "Curation Status"; §4.5 Notes; UJ-5. |
| AD-24 | Dataset delivery and the read-time budget | **Partially reflected** | Read-time budget → §4.1 feature NFR + NFR-6. Colour rule → NFR-10 (over-extended, see §2). **MISSING:** the delivery half — *"`web` fetches exactly six artifacts at runtime as separate cache-busted requests … never bundled into the JS, so a sync commit updates data without rebuilding the app"* and *"renders from a single consistent set and does not mix artifacts across a refresh."* The first is player-visible (data freshens without a redeploy, which is what makes UJ-6's "refills over the following day" true), and the second is a visible correctness property (no torn read across a refresh). Neither appears anywhere in the PRD. |

### Items MISSING or thin, consolidated

1. **AD-24 delivery clause** — no FR or NFR states that data is fetched rather than bundled, nor that the view renders from one consistent artifact set. Recommend a bullet under FR-10 or a new NFR.
2. **AD-3's "refuse to render an invalid artifact rather than degrading"** — present for the weights file only.
3. **"Rotation" is used but never defined.** FR-13 inherits AD-23's phrase *"`pinned` means refreshed every chunk, exempt from rotation"* verbatim, but neither the spine nor the PRD defines what rotation is — i.e. how AD-7's chunk runner selects which `active` entries a chunk refreshes. FR-16 describes only the chunk's *end* conditions, not its selection policy. This is inherited from the spine rather than introduced by the PRD, but the PRD is the document where a player-visible refresh policy ("how often does a given row get re-priced?") ought to be a requirement, and it is not.

---

## 2. Mis-citation List

Seven citations do not (or do not fully) say what the PRD attributes to them. Three are the same class.

### M-1 through M-3 — AD-24's colour rule is scoped to AD-10 distinctions only (three sites)

**AD-24 text:** *"Distinctions AD-10 requires must not be carried by colour alone."*

AD-10's distinctions are provenance (`measured` vs `uniform-prior` vs `absent`) and per-row age. AD-24 does not extend the colour rule to any other distinction.

- **M-1 — FR-3, second consequence:** *"A Raw Base is rendered distinguishably from a crafted Base Type, and that distinction is not carried by colour alone (AD-24)."* Raw-vs-crafted is an AD-5/AD-17 distinction, not an AD-10 one. Not supported by AD-24.
- **M-2 — FR-8, fourth consequence:** *"The distinction between states is not carried by colour alone (AD-24)."* Price State is AD-9. Not supported by AD-24.
- **M-3 — NFR-10:** *"Distinctions the product requires — Price State, Provenance, crafted versus Raw Base — are never carried by colour alone (AD-24)."* Only the middle term is AD-24-supported.

By contrast **FR-9's** *"not by colour alone (AD-10, AD-24)"* **is correct** — that one is a provenance distinction.

*Severity: low.* Broadening an accessibility floor is a defensible product decision. But it is a decision the PRD is making, not one it is inheriting, and it is presented as inherited. It should either be marked `[ASSUMPTION]` or raised as an AD-24 amendment.

### M-4 — FR-3: "item level exactly 82" attributed to AD-16

**PRD text (FR-3, third consequence):** *"A Raw Base's search uses `normal` rarity and item level exactly 82; a crafted entry's uses `magic` (AD-16)."*

**AD-16 text:** *"…that base, endgame item level, `magic` rarity for an entry carrying affixes and `normal` for a raw base (AD-5)…"*

AD-16 supports the rarity half. It does **not** supply 82 — it says "endgame item level" and the spine explicitly lists the value as unresolved: *"**Endgame item-level floor.** AD-16 filters on 'endgame item level'; the brief says ilvl ≥ ~78 for magic and exactly 82 for white bases. Confirm the magic floor before `sync` is built."* The 82 figure comes from the brief via that Open Question, and is settled by the PRD's own FR-19, not by AD-16. Citation should be `(AD-16 rarity; FR-19 floor)`.

### M-5 — FR-24: "must not pre-aggregate bands" attributed to AD-11

**PRD text (FR-24, first consequence):** *"The file carries raw spawn weights per Base Type and affix slot, keyed by Modifier Reference; producers must not normalise and must not pre-aggregate bands (AD-11)."*

**AD-11 text:** *"The file carries **raw game spawn weights only**, per base type and affix slot. Conversion to probabilities is AD-18 and happens only in `core`."*

AD-11 forbids normalising. The "must not pre-aggregate bands" clause is from `WEIGHTS-FILE-SCHEMA.md` (*"Producers must not normalise, and must not pre-aggregate bands"*), not AD-11. Correct citation is the schema, or `(AD-11, AD-18)`.

### M-6 — FR-21: "entries skipped and why" attributed to AD-12/AD-23

**PRD text (FR-21, first consequence):** *"The report records requests consumed per declared set against the live bucket, unresolvable entries, entries skipped and why, and the last tracked-list edit date (AD-12, AD-23)."*

AD-12 requires per-set request accounting; AD-23 requires the last tracked-list edit date. Neither mentions skipped entries. More importantly, **AD-6 states an entry "is never skipped, never defaulted, never left at its previous value"** for the unresolvable case, so "entries skipped" needs its own definition of what skipping legitimately means (an entry the chunk simply did not reach this run, presumably). The Consistency Conventions' Error shape row (*"everything else lands in `sync-report.json`"*) is the nearest support. As written the bullet sits uneasily against AD-6 and is cited to two ADs that do not cover it.

### M-7 — FR-5: threshold denomination attributed to AD-20

**PRD text (FR-5, first consequence):** *"The control is denominated in Divine — the same unit as every price and Craft Cost it filters (AD-20)."*

**AD-20** governs normalisation at the sync adapter boundary; it never mentions the threshold. The decision that *"**Threshold**, all prices, and craft cost are denominated in divine (AD-20)"* is **AD-17's**. The correct citation is `(AD-17)` or `(AD-17, AD-20)`.

*Severity: very low — the claim is true, the pointer is one hop off.*

**Mis-citation count: 7** (M-1…M-7), of which three (M-1, M-2, M-3) are one recurring over-extension of AD-24.

---

## 3. Contradictions

No flat contradictions were found — nowhere does the PRD assert something the spine forbids. Four items are *tensions* worth recording, in descending order of consequence. The first is a genuine unreconciled conflict introduced by the FR-19 divergence and is analysed in full in §4.

### C-1 — FR-19's per-entry item level vs AD-18's item-level-blind eligible pool *(material)*

See §4.3. In short: FR-19 makes the accepted tier — and therefore which modifier bands can roll — a function of item level, while AD-18 and the weights file model one eligible pool per `(baseTypeId, slot)` with no item-level dimension. Entries on the same base at different floors are then summed against a denominator that describes neither population.

### C-2 — FR-26/FR-4 drop the `partial`-pool provenance half of the schema's rule *(moderate)*

**Schema text:** *"A producer that cannot guarantee that declares `poolCoverage: "partial"`. `core` then treats every probability derived from that pool as provenance `absent` — it is a lower bound on the denominator, so the probabilities are upper bounds — and the view renders it as an unknown (AD-10), not as a number to trust."*

**PRD (FR-26, last consequence):** *"A Base Type whose pool is not `complete`, or which is absent from the file, is **Unrankable** (FR-4). A Provenance label does not change a sort, so an inflated denominator must remove the Base Type from the ordering rather than merely annotate it."*

The PRD carries the exclusion (AD-18's half) and drops the provenance-`absent` treatment (the schema's half). These are complementary, not alternatives: the base leaves the ordering *and* its probabilities are stamped `absent` so the unrankable group can render them as unknowns. As written, the PRD's Glossary defines Provenance `absent` as a legal value but no FR ever says when it arises — `absent` is otherwise unreachable in the PRD's model. Not a contradiction (the PRD does not forbid it), but a faithful reading of the companion requires both halves.

### C-3 — The producer's enumeration obligation is not stated anywhere in the PRD *(moderate)*

The schema calls pool-completeness *"the contract's load-bearing clause and the easiest thing for a producer to get wrong"*, and spells out the obligation:

> *"A `(baseTypeId, slot)` entry declaring `poolCoverage: "complete"` **must enumerate every modifier that can roll in that slot on that base**, including worthless ones, with their true weights."*
> *"`weight` … `0` means 'cannot roll here' and is meaningful; omitting the entry instead breaks `poolCoverage: complete`."*
> *"There is no third option."*

FR-24 and FR-26 state what `core` does with the pool (denominator; incomplete → unrankable) but never state the obligation the file's producer is under. Since FR-24 is the PRD's requirement for the weights-file contract and FR-25 commissions a producer (the uniform-prior generator), the enumeration rule belongs here. Its absence is the single largest companion-coverage gap.

### C-4 — FR-21's "entries skipped" vs AD-6's "never skipped" *(low)*

See M-6. Resolvable by wording ("entries not reached in this chunk"), but currently reads against AD-6.

### Checked and found consistent

- §4.6's arithmetic ("roughly fifteen hours … about 62% of the daily search budget") is consistent with AD-12's ~1,500 entries and AD-8's measured 600 searches/6h = 2,400/day (1500 ÷ 2400 = 62.5%; 1500 ÷ 100/hr = 15h).
- FR-12's ~1,500 correctly adopts AD-12's sizing and does not resurface the addendum's superseded ~2,000.
- FR-16's exit-0-on-held-lock matches AD-7 exactly, including the rationale.
- FR-1's craft-cost-subtracted-once and gross-price-threshold match AD-17 exactly.
- FR-27/FR-28 match AD-19 including the not-filtered-on-write clause from AD-14.
- §6.2 and §5 between them cover every entry in the spine's Deferred list.

---

## 4. The One Intentional Divergence — `TrackedEntry.itemLevelMin`

### 4.1 Is it flagged adequately? — **Yes, exemplary.**

The addition is declared in four places, at increasing depth:

1. **§0 Document Purpose**, under its own heading: *"**One thing this PRD changes rather than inherits.** The spine left 'endgame item level' as an Open Question. It is resolved here (FR-19) into a per-entry rule, and that resolution adds a field to `TrackedEntry`. That is an amendment the architecture must absorb under AD-22, flagged in §8, not a local invention."*
2. **FR-19** states the rule, the worked bow example, the authoring discipline (*"`itemLevelMin` is a declared field on the Tracked Entry, authored by hand. Neither `sync` nor `core` infers or adjusts it"*), and its reconciliation with AD-5 (*"The Accepted Tier decision and the Modifier Reference's value floor are **one act** — since the trade API has no tier concept (AD-5)"*).
3. **§9 Open Question 1** assigns it: *"This needs to land as a `contracts` schema amendment under AD-22 — landed alone and first, per the agent workflow — before `sync` is built. **Owner: architecture. Blocks: sync.**"* That correctly invokes AGENT-WORKFLOW's *"`contracts` changes are serialised … Land contract changes alone, first."*
4. **`addendum.md` §"The Item Level Rule — Derivation"** gives the derivation, the user's stated rule, the bow table, and a "Consequence for `contracts`" paragraph.

One nit: §0 says *"flagged in §8"*, but §8 is Success Metrics — the flag is in **§9** Open Questions. A stale cross-reference.

A second nit: the **Glossary's "Tracked Entry"** entry silently lists "a declared **Item Level Floor**" alongside the AD-5 fields with no citation and no divergence marker. A reader entering at §3 gets the amended shape presented as settled vocabulary. A `(FR-19; amends AD-5)` marker there would close it.

### 4.2 Does it break AD-12's budget? — **No.**

AD-12 budgets by request count: *"`sync`'s entire workload is the union of exactly two schema-pinned, committed files"*, sized at ~1,500 entries against 2,400 searches/day. `itemLevelMin` is a per-entry *parameter* of the single search AD-16 already issues for that entry — it adds no search, no fetch, and no new workload set. FR-18 correctly substitutes it into AD-16's existing search shape (*"that entry's Item Level Floor"* in place of *"endgame item level"*) rather than adding a request.

The only latent budget risk is if `itemLevelMin` became an *identity* axis — i.e. if the same `(baseTypeId, prefix, suffix)` could be tracked twice at two floors, doubling searches for that combination. The PRD neither permits nor forbids this; see 4.4.

### 4.3 Does it break AD-16's search construction? — **No, it completes it.**

AD-16's search parameter list contains an undefined term: *"that base, **endgame item level**, `magic` rarity for an entry carrying affixes and `normal` for a raw base (AD-5), the entry's modifier references as stat filters with their value floors, instant buyout only, sorted by price ascending."* The spine's own Open Question names this as the thing to resolve *"before `sync` is built."* FR-19 supplies the value; FR-18 restates the search with the value in place. Nothing in AD-16 is contradicted. This is the divergence working as intended.

### 4.4 Does it break AD-17's mutual-exclusivity validation? — **Yes, it leaves it under-specified.**

**AD-17 text:** *"**Summands must be mutually exclusive.** The sum is over a partition, not a list. Two tracked entries for one base whose outcome sets overlap — the same `statId` in the same slot at nested floors, or a partial-affix entry subsuming a full one — would double-count… Overlap is therefore a **validation error on `data/tracked.json`**, rejected at load."*

**FR-14** restates exactly those two overlap forms and nothing more:

> *"The same `statId` in the same slot at nested value floors is a validation error, as is a partial-affix entry subsuming a full one (AD-17)."*

AD-17's enumeration was written against AD-5's three-field entry, where `(baseTypeId, prefix, suffix)` fully determined the outcome set. With a fourth field that *also* narrows the population, the enumeration is no longer exhaustive, and the PRD does not say whether `itemLevelMin` participates in overlap detection.

Concretely: two entries, same base, same prefix, same suffix, one at `itemLevelMin: 75` and one at `itemLevelMin: 82`. Their outcome sets are **nested, not disjoint** — every ilvl-82 item matching those affixes also matches the ilvl-75 search. Under FR-14 as written they are not an overlap (different entries, no nested *value* floor, neither subsumes by affix), so both would be summands, double-counting the ilvl-82 population and inflating `ΣP` — precisely the failure AD-17's clause exists to prevent.

FR-19's own last bullet makes this configuration look sanctioned rather than forbidden: *"The tracked list's per-Base-Type floor visible to the player is the maximum across that Base Type's entries"* — a statement that only has content if entries on one base may carry different floors.

**Required fix:** FR-14 must say whether `itemLevelMin` is (a) part of the identity, in which case the overlap rule extends to "the same affix pair at nested item-level floors is an overlap", or (b) constrained to be uniform per `(baseTypeId, prefix, suffix)`, or (c) constrained to be uniform per Base Type. Option (c) is the cleanest and is what 4.5 below argues for on independent grounds.

### 4.5 Does it break AD-18 / the weights model? — **Yes. This is the unflagged consequence.**

This is the finding the PRD does not address anywhere, including in the addendum.

**AD-18's model:** *"`P(modifier | base, slot)` is that summed weight divided by the **total weight of the complete eligible pool for that `(base, slot)`** — the denominator is the whole pool, never the tracked subset."* The weights file's shape confirms it: `bases.<baseTypeId>.{prefix,suffix}.entries[]`. **There is no item-level dimension anywhere in the pool model.** One pool per `(base, slot)`, full stop.

**FR-19's rule presupposes the opposite.** Its entire mechanism is that tier availability is a function of item level: *"the **Accepted Tier** of a modifier is tier 1, **except** where tier 1 first becomes available at item level 81 or 82."* And the addendum's bow table is explicit: increased physical damage T1 is available at ilvl 82, T2 at ilvl 75. So on a bow searched at ilvl ≥ 75, the true eligible prefix pool is *not* the same set as on a bow at ilvl ≥ 82 — the T1 band cannot roll on part of the population the ilvl-75 search returns.

Three consequences:

1. **The denominator describes a population the search does not.** `P(combo)` for an entry filtered at ilvl 75 is computed over a pool that includes bands (ilvl-81/82 tiers) which cannot roll on most items that search returns. The probability is wrong — understated for the accessible bands, and wrong in a direction that varies per base.
2. **AD-17's partition breaks across floors.** If entries on one base carry different `itemLevelMin`, their `P(combo)` terms are drawn from different real populations but one shared denominator. `Σ P(combo) × price(combo)` is then not an expectation over any single crafting act — which is the thing AD-17's "sum is over a partition, not a list" clause protects.
3. **It interacts with C-2/C-3.** A pool declared `complete` under the schema's rule (*"every modifier that can roll in that slot on that base"*) is ambiguous once item level matters: complete *at what item level*? The schema has no field to say. A producer answering honestly for ilvl 82 and a curator searching at ilvl 75 are describing different sets while both believing the contract is satisfied.

**This is not fatal, and there is a cheap resolution** — constrain `itemLevelMin` to be uniform per Base Type (FR-19's "maximum across that Base Type's entries" already gestures at a per-base figure), and state that the eligible pool is read as the pool at that Base Type's floor. But the PRD makes no such statement, and its §9 Open Question 1 scopes the amendment narrowly to *"an addition to AD-5's `(baseTypeId, prefix?, suffix?)` shape"* — i.e. as a contracts-schema change only. The AD-18 consequence is not named in §0, FR-19, §9, or the addendum.

**Recommendation:** raise this against the spine as an AD-18 amendment alongside the AD-5/AD-22 one, not as a schema field addition alone.

### 4.6 Does it break the weights-file straddling-band rule? — **No. It strengthens it.**

**AD-18 text:** *"A weights-file band that straddles a tracked floor is a **validation error**, not a pro-rata split: the producer must emit bands whose edges align to the floors in use."*

FR-19's third consequence is exactly the discipline that rule needs: *"The Accepted Tier decision and the Modifier Reference's value floor are **one act** — since the trade API has no tier concept (AD-5), 'accept tier 2' means setting `valueMin` to the tier 2 band's floor."* Because accepted tiers are chosen by picking a **band's own floor**, every `valueMin` in use is by construction a band edge, so no straddle can arise from the item-level rule. FR-26's fourth consequence carries the rule forward faithfully (*"a **hard file error**, not a pro-rata split"*). No conflict.

---

## 5. Architecture Open Questions

The spine lists three. **The PRD handles all three — none is silently dropped.**

| Spine Open Question | Disposition | Where |
| --- | --- | --- |
| **Recipe distribution mechanics** — *"nothing in the inputs supplies the actual numbers for how perfect vs greater transmute/augment shift the tier distribution. v1 can ship a single recipe under a documented assumption; ranking per `(base, recipe)` as the brief describes needs this resolved."* | **Carried forward, verbatim in substance, and acted on.** | PRD §9 OQ-3 (*"**Deferred to v2**"*); FR-23 third consequence commits to the identity transform as a stated limitation; §6.2 defers a second recipe with AD-18's reasoning; addendum §"Recipe Count for v1" records the three options and why (1) was adopted. |
| **Endgame item-level floor** — *"AD-16 filters on 'endgame item level'… Confirm the magic floor before `sync` is built."* | **RESOLVED** — and resolved differently from how the question was posed. The spine asked for *a number*; the PRD answers that the premise of a single global floor was the error, and replaces it with a per-entry derived floor. | FR-19; §0; §9 OQ-1 (the contracts amendment) and OQ-2 (the per-tier item-level data source); addendum §"The Item Level Rule". |
| **Uniform-prior pool completeness** — *"the v1 file's eligible pools come from a RePoE→stat-id mapping whose coverage is unknown… determines how much of v1's ranking is an upper bound rather than an estimate."* | **Carried forward, with an owner and a sharper framing.** | PRD §9 OQ-4, restated with *"**How much of v1's ranked list this removes is not yet known** … Measure this early; it determines whether v1 is useful on day one. **Owner: build. Measure before committing to the v1 cut."* |

**One nuance worth recording.** The spine framed the pool-completeness question in terms of *upper bounds* — *"how much of v1's ranking is an upper bound rather than an estimate"*, matching the weights file's *"the probabilities are upper bounds … rendered as an unknown."* The PRD reframes it entirely as *removal from the ranking* (unrankable), which is AD-18's half of the answer. So the question is carried forward but its "upper bound / render as unknown" framing is the piece that goes missing — the same drop recorded as **C-2**.

**The PRD also adds three Open Questions of its own** (OQ-2 Accepted Tier data source, OQ-5 `no-listings` fraction, OQ-6 cold-start seeding), all downstream of decisions it made, all with owners. None conflicts with the spine.

---

## 6. Companion Coverage

### 6.1 `WEIGHTS-FILE-SCHEMA.md` — pool-completeness rule: **partially faithful**

| Schema clause | PRD | Verdict |
| --- | --- | --- |
| Consumed, never produced; producer irrelevant | FR-24; §4.8 description; §5 non-goal 1 | Faithful |
| Raw weights, not probabilities; producers must not normalise, must not pre-aggregate | FR-24 first consequence | Faithful (mis-cited — see M-5) |
| Not recipe-aware; recipe effects modelled in `core` | FR-24 second consequence | Faithful |
| **`complete` must enumerate every modifier that can roll, including worthless ones** | — | **MISSING (C-3).** The producer's obligation appears nowhere. |
| **`weight: 0` is meaningful; omitting the entry instead breaks `complete`** | — | **MISSING (C-3).** |
| **"There is no third option"** | — | **MISSING.** FR-26 implies a binary but never states the prohibition on claiming `complete` while omitting modifiers. |
| **`partial` → probabilities are provenance `absent`, rendered as unknown, upper bounds** | — | **MISSING (C-2).** PRD carries only the exclusion. |
| Base absent from file → unrankable; `core` must not invent a pool | FR-4 (both bullets), FR-26 last consequence | Faithful |
| Denominator is the whole pool, never the tracked subset | FR-26 second consequence | Faithful, verbatim |
| Floor spans tiers; whole bands only | FR-26 first consequence | Faithful, verbatim |
| Straddling band is a hard file error, not a pro-rata split | FR-26 fourth consequence | Faithful, verbatim |
| Independent prefix/suffix draws, `P = 1` for an absent affix | FR-26 third consequence | Faithful |
| Unknown `schemaVersion` major refused; invalid file refused rather than ranked partially | FR-24 third consequence; NFR-8 | Faithful |
| Other hard errors: duplicate `(statId, valueMin)`, overlapping bands, negative weight, missing `poolCoverage` | — | Not enumerated; arguably acceptable under FR-24's general "refuses to rank from an invalid file". Structural. |
| `producer.id` and `gamePatch` surfaced alongside influenced figures | FR-9 third consequence | Faithful |
| v1 uniform-prior file: `weight: 1`, `provenance: "uniform-prior"`, `producer.id: "uniform-prior"`; a real file, not a stub; generated once and committed as data | FR-25 (all four consequences) | Faithful, near-verbatim |
| Listing bias inherited, `measured` means *measured by someone* | — | Not reflected. Arguably player-visible (it qualifies what a `measured` label is worth), but a defensible omission — the PRD covers the asking-price half in FR-11. |

**Verdict: the load-bearing clause is half-represented.** The PRD carries what `core` does with a pool and drops what a producer owes and what `partial` means for provenance. Since FR-24/FR-25 are the PRD's contract with weights producers — including the in-house uniform-prior generator FR-25 commissions — the producer obligation belongs in FR-24's consequences.

### 6.2 `AGENT-WORKFLOW.md` — offline guarantee: **fully reflected**

| Workflow clause | PRD | Verdict |
| --- | --- | --- |
| *"No test at any level makes a network call"* | NFR-1 | Faithful, verbatim |
| MSW `onUnhandledRequest: "error"`, *"fails the test loudly instead of escaping"* | NFR-1 | Faithful, verbatim |
| Rationale — *"red test means 'the code is wrong' rather than 'GGG was slow'"* | NFR-1 (quoted almost exactly) | Faithful |
| Fixtures are real captured responses, never hand-written | NFR-2 | Faithful |
| `pnpm fixtures:record` is explicit, human-invoked, never in a test run; the diff is how GGG's changes become visible | NFR-2 | Faithful, verbatim |
| Clock is a port; no wall-clock dependence; backoff tested by injecting headers | NFR-3 | Faithful, verbatim |
| Sync ordering deterministic given a tracked list | FR-16 last consequence | Faithful |
| Personal identifiers scrubbed at record time | — | Not reflected. Structural (fixture hygiene), correctly absent. |
| *"An agent can run the entire suite on a plane"* | SM-6 (*"tests passing offline and no live API in the loop"*) | Reflected as a success metric |

### 6.3 `AGENT-WORKFLOW.md` — worktree partitioning: **mostly reflected, two gaps**

| Workflow clause | PRD | Verdict |
| --- | --- | --- |
| Disjoint package directories, acyclic one-way graph, *"two agents working in two packages touch no common file"* | NFR-4 | Faithful, verbatim |
| `dependency-cruiser` fails the build, *"without a reviewer"* | NFR-4 (*"mechanically enforced in CI rather than by review"*) | Faithful |
| *"`data/` has one writer per file (AD-21) — never an agent's feature branch … An agent that needs different data uses a fixture, not an edit"* | NFR-5 (*"An agent needing different data uses a fixture, never an edit"*) | Faithful, verbatim |
| *"Never `git add -A` in anything sync-related"* | FR-21 second consequence | Faithful |
| **`contracts` changes are serialised — land alone, first, dependent work rebases** | §9 OQ-1 only, in passing (*"landed alone and first, per the agent workflow"*) | **Gap.** This is the single most conflict-prone rule in parallel development and appears only as an aside inside one Open Question, not in NFR-4 where a reader looking for parallelism constraints would find it. |
| **No worktree runs `pnpm sync` against the live API; an agent verifying sync uses `pnpm sync:dry`** | — | **Gap.** `sync:dry` — described in the workflow as *"the debugging affordance that matters most"* and load-bearing for SM-6 — is not named anywhere in the PRD. Neither is the prohibition on live sync from a worktree, which is a real operating rule with a rate-limit consequence (AD-8's shared budget). |
| *"A task spanning packages is a signal that a contract is missing"* | — | Structural. Correctly absent. |
| Definition of done (5 items) | Distributed across NFR-1/2/4/8 | Adequately reflected |

**Recommendation:** fold the two gaps into NFR-4 — *"`contracts` changes land alone and first; no worktree runs a live sync, and sync behaviour is verified against fixtures."*

---

## 7. Summary of Actions

| # | Item | Type | Where |
| --- | --- | --- | --- |
| A-1 | `itemLevelMin` vs AD-18's item-level-blind eligible pool — probabilities computed against a denominator describing a different population; AD-17's partition breaks across mixed floors on one base | **Contradiction / unflagged consequence** | §4.5, C-1 |
| A-2 | FR-14's overlap enumeration is no longer exhaustive with a fourth narrowing field; nested item-level floors would double-count | **Contradiction** | §4.4 |
| A-3 | Weights-file producer enumeration obligation (`complete` must list everything, `weight: 0` is meaningful, no third option) absent from the PRD | **Companion gap** | C-3, §6.1 |
| A-4 | `partial` pool → provenance `absent` / upper-bound framing dropped; `absent` is unreachable in the PRD's model | **Companion gap** | C-2, §6.1 |
| A-5 | AD-24's delivery clause (fetched not bundled; single consistent artifact set) not reflected | **MISSING AD coverage** | §1 AD-24 |
| A-6 | AD-24 colour rule over-extended to Price State and raw-vs-crafted at three sites | **Mis-citation ×3** | M-1, M-2, M-3 |
| A-7 | "item level exactly 82" attributed to AD-16, which does not supply it | **Mis-citation** | M-4 |
| A-8 | "must not pre-aggregate bands" attributed to AD-11; it is the schema's clause | **Mis-citation** | M-5 |
| A-9 | "entries skipped and why" cited to AD-12/AD-23 and reads against AD-6 | **Mis-citation / tension** | M-6, C-4 |
| A-10 | Threshold denomination cited to AD-20; it is AD-17's decision | **Mis-citation** | M-7 |
| A-11 | `contracts`-serialisation and `pnpm sync:dry` / no-live-sync-from-a-worktree missing from NFR-4 | **Companion gap** | §6.3 |
| A-12 | "Rotation" used in FR-13 but defined nowhere; chunk selection policy unspecified | **Inherited gap** | §1 item 3 |
| A-13 | §0 cross-reference points to §8; the flag is in §9 | **Editorial** | §4.1 |
| A-14 | Glossary "Tracked Entry" presents the amended shape with no divergence marker | **Editorial** | §4.1 |

**Mis-citations found: 7** (A-6 counts as three sites of one class).
