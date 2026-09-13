# PRD Quality Review — PoE2 Crafting Base Price Checker (revision 5)

Rubric: `.claude/skills/bmad-prd/assets/prd-validation-checklist.md`
Target: `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md` (rev 5, final), with `addendum.md` as context.
Cross-read for verification: `ARCHITECTURE-SPINE.md` (rev 5), `WEIGHTS-FILE-SCHEMA.md` (4.0.0), `PRD-EDIT-PROPOSALS.md`, the architecture `.memlog.md`.

## Overall verdict

This is a decision-ready document and the revision-5 material is the strongest part of it: FR-29 states the numerator/denominator split with a formula, names the failure mode it prevents, and explains why a single-stat fixture cannot catch it — a builder can implement it without asking. Every count, fraction and version number I checked against the spine and the contract is accurate (560/8,437, 53/63, 4.0.0, the three revision-amendment lists, the eight-artifact fetch set, ~1,500/~2,400/62%). What is at risk is not the requirements but the **glossary contract the document claims for itself**: §0 declares §3 defines every domain noun and §4 uses those terms verbatim, and the new material introduces two load-bearing nouns — *cell* and *stat line* — that §3 never defines standalone, while one §3 entry now states a checkable claim ("exactly two purposes") that FR-27 contradicts. Secondarily, the `pinned` rule is now stated in three places with no binding copy named, in a document that elsewhere marks its binding copies scrupulously.

No CRITICAL findings. Four HIGH, six MEDIUM, five LOW.

---

## Decision-readiness — **strong**

The four locations the review was pointed at hold up under a "could a builder act on this alone?" test.

**§3** is normative and reads like it. Each entry states what the term *is*, then states the reading it is excluding and why that reading is wrong — *Modifier Reference* rejects the sentinel band with the argument (`1/1` passes every containment check while making FR-21 emit a filter for a stat with no value); *Source Modifier* fixes the granularity at one tier rather than a family and says *why* the contract fixes it rather than leaving it to the producer (both readings conform and they disagree about which items satisfy two references at once); *Cohort* explains why emission is per tier and not per cohort with the unrepresentability argument. This is the opposite of glossary furniture.

**FR-16** gives the overlap rule as a predicate with an explicit statement that branch order is load-bearing, then enumerates the four consequences including the two that successive enumerations missed. The `coOccur` fallback case — where the pool cannot answer, `coOccur` is `false` and the Tracked List still loads — is exactly the kind of thing that would otherwise produce two builders with opposite behaviours, and it says so.

**FR-27** gives eleven hard file errors as a list, and then does the harder thing: it explains why two of the keys are deliberately different (non-overlap narrowed by `sourceModifierId`, cohort-carriage not narrowed), and names the two producer obligations that are *unverifiable* rather than implying `core` checks them.

**FR-28** and **FR-29** are both actionable. FR-29's `mass(g)` carries no `L`, the reason is given, and the one place the spine still spells it differently is raised as OQ-16 with FR-29 named as the copy to build to.

Two residues are honest rather than dodged: OQ-12 is owned outside the repository and labelled blocking-for-correctness-not-building, and OQ-16 is a spine spelling conflict with the PRD's reading stated. Neither is a rhetorical question with an answer in the next sentence.

### Findings

- **high** *FR-29's empty-containment and edge-alignment errors blame the wrong file in the failure mode FR-28 just identified* (§4.8 / FR-29, against FR-28) — FR-29 states these are validation errors "against `data/tracked.json`, not the Weights File — the file is complete and the tracked reference is the thing that is wrong". FR-28's new bullet *"Completeness counts stat lines, not rows"* establishes that a file declaring `complete` can be missing stat lines, and FR-28 says plainly that this is the one direction the source-modifier denominator does **not** protect against and FR-27 has no mechanical check for. A producer that drops the second stat line of a multi-stat row therefore produces, for the curator, an error reported against his `tracked.json` for a defect in the file — and the PRD has just told him that error means his reference is wrong. *Fix:* add a consequence to FR-29 qualifying the attribution: an empty containment set or a failed alignment on a `complete`-declaring pool is *either* a curation error *or* a dropped stat line (FR-28), and the error text must name both readings, since `core` cannot distinguish them.

- **medium** *The straddle rule is the one rule in FR-29 left as prose* (§4.8 / FR-29) — containment gets a table, scoping gets a set-builder, edge alignment gets two equations. Straddle gets a sentence ("A Weights File cell straddling a tracked reference's edge is a validation error, not a pro-rata split"), and the term is never defined against the closed-interval semantics §3 fixes. *Fix:* one line of the same shape as the alignment block — a cell straddles when it shares the `statId`, lies in scope, and overlaps the reference without being contained by it.

- **medium** *FR-27's "at most two cohorts" bound arrives without the assumption it rests on* (§4.8 / FR-27) — both `ARCHITECTURE-SPINE.md` (AD-28) and `WEIGHTS-FILE-SCHEMA.md` state it explicitly: *"no three tiers of one family overlap at a value; if real game data ever does, that is an amendment, not a workaround in a producer."* The PRD carries the rule and the rationale for its key choice but not the assumption. §7.3 makes this document the one the producer's owner reads for the contract, so the omission lands on exactly the wrong reader. *Fix:* carry the stated assumption into FR-27's consequence, with the escalation route.

- **medium** *`coOccur`'s cohort qualifier is vacuous as §3 now defines a Source Modifier* (§4.5 / FR-16) — `coOccur(x, y)` holds when some `sourceModifierId` emits an entry contained by `x` **and** an entry contained by `y`, *"in the same item-level cohort"*. §3 *Source Modifier* and §3 *Cohort* both establish that a source row is one tier and therefore sits in exactly one cohort, and FR-29 leans on that to drop `L` from `mass(g)`. The qualifier can never discriminate, and a builder implementing it literally writes a cohort-equality test that is always true — harmless, but it signals a dimension that does not exist and invites the reader to ask what a cross-cohort group would mean. *Fix:* delete the qualifier, or keep it and mark it as restating a property rather than adding a condition.

---

## Substance over theater — **strong**

No personas, no market sizing, no differentiation section — correct for the stakes, and §2 is Jobs-To-Be-Done rather than persona furniture. The NFRs carry thresholds and mechanisms, not adjectives: NFR-1 names `onUnhandledRequest: "error"`, NFR-6 names 100 ms, NFR-10 names the three distinctions it extends over and flags that the extension is the PRD's own. §8's success metrics are behavioural with the instrument named ("the player's own recollection — the only instrument available"), which is more honest than an invented number. Four counter-metrics, each naming what it counterbalances.

The Vision (§1) is product-specific and could not swap into another PRD: it names the memorisation tax, the league reset that destroys it, and the one distinction the whole system exists to preserve ("the ranking is not 'most expensive base'").

No findings.

## Strategic coherence — **strong**

The thesis is stated and load-bearing: threshold-truncated EV, with the threshold as a dial because a jackpot base and a steady base swap places as it moves. Every feature traces to it — FR-1 computes it, FR-6 turns the dial, FR-10/FR-11/FR-12 keep it honest about what it rests on, FR-4/FR-28 remove bases where it cannot be computed honestly rather than labelling them. §6's non-goals are argued, not listed: the loot-filter entry names the specific PoE2 syntax gap (`HasExplicitMod`) and concludes the brief's own stated outcome is not achievable, which is the kind of thing a backlog-with-headings never says.

Counter-metrics validate the thesis rather than activity. SM-C1 is denominated in searches rather than entries with the reason given.

No findings.

## Done-ness clarity — **strong**

Every FR carries a *Consequences (testable)* block. I looked for the rubric's tells — "gracefully", "reasonable", "user-friendly" — and found none used as a requirement. Where a decision is genuinely a UX one, FR-4 says so and still states the requirement a design must satisfy ("at 50–80% coverage a reader cannot come away with the impression that the ranked list is the whole product"), which is testable by review.

The arithmetic-bearing FRs are the strongest: FR-21 pins the even-sample median as the lower of the two middle values *and* argues it, FR-23 pins 4 decimal places *and* explains that the grid is set by the cheapest persisted value rather than the price, FR-29 gives containment as a table and alignment as two equations.

### Findings

- **high** *`cell` and `stat line` are load-bearing nouns with no Glossary entry, against §0's own claim* (§3, used in FR-21, FR-22, FR-27, FR-28, FR-29) — §0 states "§3 defines every domain noun, and §4's features and FRs use those terms verbatim". *Cell* is currently defined in passing inside three different entries (*Modifier Weight*: "a raw game spawn weight for one **value cell**"; *Cohort*: the per-`(tier, cell)` emission; *Eligible Pool*: "the complete set of **value cells**"), and *interior cell* — the noun FR-22's entire curation rule turns on — is defined nowhere. *Stat line* is the unit AD-29 is about and is glossed only inside *Modifier Reference* and *Source Modifier*. A curator reading FR-22's "curate to interior cells by default" has to reverse-engineer what a cell is from an entry about weights. *Fix:* promote **Cell** to a §3 entry (an interval of the family-wide value partition, cut once across all tiers, carrying one cohort's mass) with *interior cell* named in it, and **Stat Line** to an entry of its own; the existing entries then reference them instead of re-glossing.

- **low** *FR-2's "at most three" and FR-5's "top 20" rest on assumptions with no check-back* (§4.1) — both are tagged `[ASSUMPTION]` and indexed, which satisfies scope honesty; neither has a revisit trigger the way OQ-6 does. At these stakes this is fine and is noted only so it is not mistaken for an oversight.

## Scope honesty — **strong**

§6 has ten non-goals, each argued. §7.2 has eleven deferrals, most with a revisit condition and several with a stated cost — the *"Pricing a deliberate conjunction of co-occurring stats"* entry is new in this revision and does real work: it records **why** FR-16 rejects a configuration a curator will plausibly try, which is the difference between a rejection that reads as a defect and one that reads as a decision. §7.3 states the release dependency, both its gates, and the fact that a second breaking contract revision has landed against a near-complete producer.

Open-items density is low and well-sorted: two live questions, both with an owner, one of them outside the repository. Ten indexed assumptions, each roundtripping to an inline tag. Two `[NOTE FOR PM]` callouts, both at real tensions (the discovery gap R-2, and the `no-listings` fraction).

### Findings

- **medium** *"The project is near completion" is an undated, unsourced claim about the gating dependency* (§7.3) — the whole of §7.3 exists because leaving a prerequisite implicit is how it gets discovered at integration, and the one sentence characterising the prerequisite's state carries no date and no source, in a section that has just recorded a **breaking** contract change landing against that same project. *Fix:* date it, or replace it with the contract fact (a 3.0.0 file in flight is refused at load) which is already there and is the part that matters.

## Downstream usability — **adequate**

This is a chain-top PRD feeding stories, so this dimension carries weight. FR ids are contiguous 1–33, unique, and every `FR-n` cross-reference I followed resolves. UJ-1…UJ-6 each have a protagonist carrying context inline, and each FR that realises one says so. The Assumptions Index roundtrips cleanly in both directions. Sections pull out alone: FR-29 is readable without FR-27 because it re-states the scoping rather than saying "see above".

What weakens it is drift surface, not absence. The document is unusually good at naming its binding copy where it has thought about it — "FR-4 carries the current fraction and is the copy to build to", "FR-29 is the copy to build to" in OQ-16, "FR-4 states the bands normatively" in §7.3 — which makes the places it has *not* done so read as omissions rather than as a house style.

### Findings

- **high** *§3 *Source Modifier* says `core` reads `sourceModifierId` "for exactly two purposes"; FR-27 has it read for four more* (§3 vs §4.8 / FR-27) — §3 enumerates de-duplicating the denominator (FR-29) and detecting co-occurrence (FR-16). FR-27 then makes `core` use the same id for the duplicate-tuple key, for narrowing the non-overlap rule, for the group per-`statId` sum-agreement check, and — by explicit exclusion — for *not* narrowing the cohort-carriage count. §3 is declared normative for every FR that uses its terms, and "exactly two" is a closed, checkable claim; a builder taking §3 at its word has a reason to treat FR-27's group-consistency check as out of scope for `core`, and that check is FR-27's own "only mechanical check on the explosion". *Fix:* change §3 to "`core` reads it in valuation for exactly two purposes … and at load as a key in FR-27's file validation", or drop the enumeration.

- **high** *The `pinned` truncate-and-reserve rule is stated three times with no binding copy named* (§3 *Curation Status*, FR-15, FR-17) — §3 states it in compressed form ("capped at load, and truncated for a Chunk whose discovered allowance cannot also fund the rotation below it"); FR-15's first consequence states it nearly in full ("a Chunk whose discovered allowance cannot also fund at least one `active` entry truncates the pinned set rather than freezing the rotation, and says so in the Sync Report"); FR-17's two-row table states it normatively with the owner, the inequality and the reserve rule. Three copies of a rule with a runtime branch in it, and nothing says which one governs — in a document that marks the binding copy for the coverage fraction and for `mass(g)`. The same shape applies to the `pinned` selection order, which §3 *Refresh Rotation*, §3 *Curation Status* and FR-17 row 1 each state. *Fix:* mark FR-17's table as the binding copy, and reduce §3 and FR-15 to a pointer plus the one fact each genuinely needs (that a cap exists; that truncation is not an error).

- **medium** *§10 retains three of the eight items §0 says revision 5 answered, and the spine words the same set differently* (§0 vs §10) — §0 says "Revision 5 answered the eight items **this PRD's revision 4** raised back against the spine — seven of them in the PRD's own direction". `PRD-EDIT-PROPOSALS.md` §23 supports the count and the seven-of-eight split, so the number is not invented. But the spine's own revision-5 banner words it as "the five items PRD revision 4 raised back against this spine, three smaller drifts alongside them", and §10's *"Raised against the spine by revision 4 — resolved by spine rev 5"* section retains only OQ-13, OQ-14 and OQ-15. The other five (AD-9's `lastAttemptedAt` self-contradiction, AD-16's even-sample median, AD-17's cross-file kind agreement, AD-28's `Binds`, the contract's status/identity-tuple drift) are absorbed into FR text with no retirement line. §10 exists precisely as the audit record — this is the same under-reporting shape OQ-15 was raised about, one document over. *Fix:* either add five one-line retirement entries, or change §0 to "five items and three smaller drifts" and say the drifts are recorded in the spine rather than here.

- **medium** *§0 cites a §10 heading that no longer reads that way* (§0, second blockquote) — it points at "§10, *Raised against the spine by this revision — resolved by spine rev 3 and rev 4*"; the actual heading is "Raised against the spine by **revision 2** — resolved by spine rev 3 and rev 4". A self-reference that went stale when the section was re-titled for a later revision. *Fix:* one-word correction.

- **low** *OQ ids begin at 4; OQ-1, OQ-2 and OQ-3 appear nowhere and are not marked retired* (§10) — the spine cites "PRD §9 OQ-1" in its revision-2 banner, so the ids existed. §10 opens by saying everything below *Non-blocking* is closed and retained, which sets the expectation that closed items are kept. *Fix:* one line noting OQ-1…OQ-3 were absorbed in an earlier revision and where.

- **low** *Glossary case drift in the new material* (§3 vs FR-16, FR-27, FR-29) — **Cohort** is capitalised in §3 and lowercase throughout FR-27 and FR-29 ("item-level cohort"); **Source Modifier** appears as "source modifier" and "source row" in FR-29; **Refresh Rotation** is capitalised in §3, §7.1 and FR-14 but is "the rotation" throughout FR-17, the FR that defines it. Harmless to a human, and exactly the class of thing that makes a term-extraction pass over this document noisier than it needs to be.

- **low** *§0's other §10 citation is a truncated heading* (§0, first blockquote) — "§10, *Resolved by spine rev 2*" against the actual "Resolved by spine rev 2 — retained as the record of why the valuation model is shaped this way". Cosmetic.

- **low** *The Modifier Weight tuple is stated verbatim in three documents with no binding copy* (§3 *Modifier Weight*, FR-27, `WEIGHTS-FILE-SCHEMA.md`) — the two PRD copies are currently identical and correct, and the contract owns the shape. Lower risk than the `pinned` case because the tuple is short and mechanical, but it is the same omission. *Fix:* name `WEIGHTS-FILE-SCHEMA.md` as the binding copy in FR-27.

## Shape fit — **strong**

Single operator, single role, no auth — and §2.3 says so explicitly before writing the UJs in the lighter form, which is the right call and the right way to signal it. Six UJs for a tool of this size is at the upper end but each drives something: UJ-5 is the reason FR-8 includes tombstones, UJ-6 is the reason FR-31 exists. Not over-formalised. The capability-spec shape dominates §4, correctly, and the operational success metrics in §8 match the shape rather than reaching for user-facing ones.

The deliberate breach of capabilities-not-implementation — arithmetic stated for FR-1, FR-9, FR-21, FR-23 and FR-29 — is justified in the addendum's closing section on the brief's own framing, and each is cited to its AD so the rationale stays in one place. I have no argument against any of the five; they are the places two independently built components could satisfy a looser requirement incompatibly, which is the correct test.

No findings.

---

## Mechanical notes

- **ID continuity.** FR-1…FR-33 contiguous, unique, all cross-references resolve. UJ-1…UJ-6, SM-1…SM-6, SM-C1…SM-C4, R-1…R-7, NFR-1…NFR-10, BQ-1…BQ-3 all clean. OQ ids run 4…16 with 1–3 unexplained (LOW above); 12 and 16 correctly identified as the only live ones.
- **Assumptions Index roundtrip.** Ten entries; every one appears inline with an `[ASSUMPTION]` tag, and every inline tag is indexed. Clean in both directions.
- **`[NOTE FOR PM]` placement.** Two, both at genuine tensions (FR-18 / R-2, and §7.2's coarser-fallback deferral). Neither at a safe checkpoint.
- **Counts and versions verified against source.** 560 of 8,437 in-scope rows ✓ (spine AD-29, contract 4.0.0). 53 of 63 item classes ✓ (spine AD-28, contract). Contract 4.0.0 ✓ (`WEIGHTS-FILE-SCHEMA.md` frontmatter). The rev-3 (nine ADs), rev-4 (seven + AD-28) and rev-5 (nine + AD-29) lists at OQ-15 ✓ against the spine's corrected banners, including the AD-24 correction OQ-15 was raised for. "Fifteen decisions amended across rev 3–5" ✓ (the union of the three lists is exactly fifteen distinct ADs). Eight fetched artifacts ✓ and four not-fetched ✓ (FR-33, AD-24). Four catalogue requests ✓ against four catalogue files. ~1,500 / ~2,400 ≈ 62% ✓ (§4.6). ~10,000 ≈ 4× ~2,400 ✓ (SM-C1). OQ-16's premise ✓ — AD-18 writes `mass(g)` and says it carries no `L`; AD-29 still writes `mass(g, L)`. I found no stale count, fraction or version number.
- **UJ protagonists.** All six carry context inline; none floating.
- **Required sections for the stakes.** All present; nothing forced in that does not earn its place.
