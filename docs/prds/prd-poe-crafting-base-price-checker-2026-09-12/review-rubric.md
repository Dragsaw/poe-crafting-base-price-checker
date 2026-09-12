# PRD Quality Review — PoE2 Crafting Base Price Checker

*Reviewed: 2026-09-12. Scope: `prd.md` + `addendum.md`, read against `ARCHITECTURE-SPINE.md` (AD-1..AD-24), which this PRD inherits rather than re-decides.*

## Overall verdict

This is a genuinely good PRD. It has a real thesis ("The ranking is not 'most expensive base,' and that distinction is the whole product", §1), the features serve it, the arithmetic half of the spec is airtight, and the honesty apparatus — Provenance, four Price States, counter-metrics — is earned rather than decorative. The architecture-inheritance posture works: FR-1, FR-18, FR-22 and FR-26 carry their formulas because those *are* the product, exactly as the addendum argues, and the `(AD-n)` citation discipline keeps the rationale in one place.

What is at risk is the presentational half. The computational FRs are specified to the decimal place; the FRs that govern what the player actually sees — how many bases are in the list, how many chase Combinations per row, what a refused artifact looks like, whether tombstones appear — are the thinnest in the document, and they are where the product's value is actually delivered. Secondarily, §4.6 quietly carries spine internals (`X-Rate-Limit-Rules` parsing, `git add -A`) that the addendum's own justification does not cover, and one Open Question (§9.4) names an existential risk to v1 without attaching a decision to it.

---

## Decision-readiness — strong

A decision-maker can act on this. Decisions are stated as decisions with the alternative named and priced: FR-18 accepts a median taken over a currency-spanning sample and says so — "This is accepted and recorded, not corrected with extra requests"; §6.2 gives every deferral a reason *and* a revisit trigger ("Revisit only if the tracked list must exceed ~1,500 entries"); FR-23 declares the identity distribution transform "a stated limitation, not an empty slot for an implementer to fill by invention". The `[NOTE FOR PM]` callouts sit at the two real tensions (§4.5 Notes on meta blindness; §6.2 on `no-listings` fraction), not at safe checkpoints. Nothing here "balances" everything.

The Open Questions are genuinely open — §9.4 and §9.5 have no answer in the next sentence, and §9.6 is honest that it has no mechanism at all ("the acknowledged price of the curation approach").

The one place a decision is missing is the one the PRD itself flags hardest. §9.4 says pool coverage "determines whether v1 is useful on day one" and then stops. §9.5, structurally identical, *does* attach its lever (the §6.2 coarser-fallback option moves "from 'held option' to 'needed'"). §9.4 has no counterpart — no bar, no contingency, no alternate cut.

### Findings

- **high** §9.4 names v1's largest existential risk with no attached decision (§9 OQ-4) — "How much of v1's ranked list this removes is not yet known — if coverage is poor, v1 ranks a small fraction of the catalogue." The PRD says to measure it "before committing to the v1 cut" but never says what any measurement would mean. Compare §9.5, which routes its bad outcome to a named §6.2 option. *Fix:* attach a rule — e.g. "below N% rankable Base Types, v1 does not ship the ranking; the fallback is X" — or name the contingency work item even without a number.
- **medium** The ~1,500-entry ceiling is a load-bearing number with no owner or enforcement (§4.5 FR-12, §8 SM-C1) — FR-12 says the list "is held to approximately 1,500 entries" and SM-C1 makes list size a counter-metric ("at ~10,000 entries it fails by a factor of four"), but no FR makes exceeding it a validation error, a warning in the Sync Report, or anything at all. FR-12's other two bullets are enforceable; this one is an aspiration in an enforceable list. *Fix:* either give FR-12 a testable consequence (loader warns / Sync Report records list size against the budget) or move the number to §8 as purely a counter-metric and say it is unenforced.

---

## Substance over theater — strong

No persona apparatus, and the document is better for it: §2.1 is five JTBD, each of which visibly drives something (JTBD 3 → FR-9/FR-10; JTBD 4 → the whole Payout Threshold feature; JTBD 5 → NFR-7 and SM-5). §2.2's Non-Users are real exclusions, not flattery. The Vision (§1) could not be pasted into another PRD — "A base with one jackpot combination and a base with many moderate ones swap places as the threshold moves" is a statement about this product only. NFRs carry numbers (100 ms, ~1,500 entries, ~2,400 searches/day, 4 decimal places) rather than adjectives. Success Metrics open by disclaiming instrumentation ("instrumenting it would be more work than the signal is worth") instead of inventing DAU.

**On the implementation-detail question, judged on merits.** The addendum's §"Why the PRD Cites Architecture Decisions Instead of Restating Them" is a sound argument and it holds for the five FRs it names. FR-18's median-of-cheapest-ten, FR-1's truncated-EV formula, FR-8's four states, FR-26's whole-band aggregation and FR-22's Divine normalisation are all directly player-visible — each one changes what number appears on screen and in what order — and each is a place where two independently built packages could satisfy a looser wording incompatibly. That is a requirement, not an implementation detail, and the citation-not-restatement discipline is the right call.

The argument does *not* cover §4.6, and that is where detail has been smuggled in. The addendum promises "Everything genuinely implementation-shaped — the package split, the port-and-adapter structure, the stack, the source tree, the deployment path — stays in the spine." But FR-17 specifies header-parsing mechanics (`It reads X-Rate-Limit-Rules to learn the active rule names, then parses the policy and -State headers for each named rule`), FR-16 specifies lock-file exit semantics, and FR-21 specifies a git invocation (`never git add -A`). None of these is visible to the player. The *outcomes* are user requirements and are already stated — "Requests are unauthenticated; no credential is stored or required" serves JTBD 5 directly, and "The syncer assumes nothing about what invokes it" serves the maintenance-surface concern. The header names and the git flag do not; they are verbatim AD-8 and AD-21, creating exactly the "second, drifting source of truth" the addendum says it wants to avoid.

### Findings

- **medium** §4.6 restates spine internals outside the addendum's stated justification (§4.6 FR-16, FR-17, FR-21) — `X-Rate-Limit-Rules` / `-State` header parsing (FR-17), on-disk lock acquisition and `exits 0` (FR-16), `never git add -A` and the dirty-working-tree rule (FR-21). These are not player-visible and the addendum's justification names only FR-1, FR-8, FR-18, FR-22 and FR-26. They duplicate AD-8 and AD-21 word-for-word, so a spine amendment now has two places to land. *Fix:* keep the user-facing consequences (unauthenticated, credential-free, scheduler-agnostic, overlap is not a failure, curation edits are never swept into a sync commit) and replace the mechanics with a bare `(AD-8)` / `(AD-21)` citation, matching the treatment §7 already gives the package split.
- **low** NFR-4 and NFR-5 are development-process constraints in a product NFR list (§7) — "Parallel worktree development" and "One writer per file" bind agents and the repo, not the product. They are legitimately inherited from the brief, but they sit unlabelled beside NFR-6 (read-time budget) and NFR-10 (accessibility floor), which are product properties. *Fix:* a one-line subheading separating build-time constraints from runtime ones.

---

## Strategic coherence — strong

The thesis is stated, bet on, and traceable. §1 names it ("the ranking is not 'most expensive base'") and §4.2 turns it into the single control the product is organised around. Prioritization follows the thesis rather than ease: FR-9, FR-10 and FR-11 add zero ranking power and ship in MVP anyway, because the thesis includes "being honest about what it rests on" — and SM-C4 ("Apparent confidence... Counterbalances SM-4 directly, and is the reason FR-9 exists") closes that loop explicitly. Conversely, the loot-filter export — the obvious adjacent feature — is rejected in §5 on a thesis argument, not a cost one: "It would automate the easy half of the knowledge and cannot touch the hard half."

The Success Metrics validate the thesis rather than measuring activity. SM-2 ("The mental top-five goes away") is a direct test of the §1 problem framing. All four counter-metrics are specific and each names what it counterbalances — this is the strongest counter-metric set I would expect to see at any stakes level, let alone a solo hobby tool.

The MVP scope kind is coherent: problem-solving, with scope logic that matches (everything that makes the one number right and honest is in; everything that makes it prettier, faster or broader is out).

The unaddressed tension is between the thesis and what v1 can actually deliver. Under FR-25 every weight is `1`, so `P(Combination)` reduces to a function of Eligible Pool sizes alone. The threshold-truncation mechanic still works and the jackpot/moderate reordering of UJ-2 still occurs, so the thesis is not hollow — but modifier *rarity*, which is the largest driver of the distinction the thesis rests on, is exactly what a uniform prior erases. The PRD discloses the provenance thoroughly (§4.4 description, FR-25, §6.2, SM-C4, §2.1 JTBD 3) but never states the consequence for ordering quality.

### Findings

- **medium** No stated expectation of ordering quality under the uniform prior (§4.8 FR-25, §6.2, §1) — FR-25 says "the ranking formula does not change shape when measured weights arrive", which is true and is about code shape, not about answers. Nowhere does the PRD say how close v1's ordering is expected to be to the thesis it advertises in §1, and the only check is SM-4 ("Chase decisions made from the list match what actually sells"), which is manual, slow, and has no failure action. *Fix:* one paragraph in §4.8 or §6.2 stating plainly what a uniform prior does and does not preserve about the ordering, and — with §9.4 — what would make v1's ranking not worth acting on.

---

## Done-ness clarity — adequate

Split cleanly down the middle. The valuation and sync FRs are as done-ness-clear as a PRD gets: FR-1 gives the formula and then rules out three specific misreadings (gross not net, once not per-Combination, absent contributes nothing rather than zero); FR-18 specifies the search, the fetch count, the aggregation, the sample-size record and the zero case; FR-26 defines the band-sum rule, the denominator, the independence assumption and what a straddling band is. FR-14 even explains *why* the rejection is at load and not at ranking time. An engineer cannot diverge here.

The view FRs are where it thins, and unfortunately that is where the player meets the product. §4.1's Description says "A single ordered list of Base Types, most profitable first" — all of them, unbounded — while SM-C3 asserts the opposite constraint ("A longer list is not a better one... showing everything tracked would restore exactly the scanning burden it exists to remove") and UJ-1 assumes a top five. A counter-metric is doing work an FR should do. FR-2 has the same shape: it says a row "names the Combinations most worth chasing" and defines the *ordering* precisely (`P(combo) × price(combo)`) while never defining the *count*; UJ-1 says "two or three" and no FR picks it up.

FR-8 is the one FR where the consequences are not testable at all: "No Price State is rendered as `0`, blank, or '—' **in a way that reads as worthless**" and "`no-listings` is presented as an open question, not an answer: the view **must not imply** the Combination is junk." The intent is right and important — it is the substance of SM-C4 — but "reads as worthless" and "must not imply" are judgments, not conditions. Contrast FR-11, which solves exactly this problem correctly by banning specific strings ("sells for", "worth"). FR-11's technique should have been applied to FR-8.

There is also one internal contradiction and two FR/scope mismatches, below.

### Findings

- **high** The ranked list's information density — the product's core deliverable — is unspecified (§4.1, FR-2, §8 SM-C3) — no FR bounds how many Base Types appear (§4.1 implies all of them; SM-C3 says that is wrong; UJ-1 assumes five) and FR-2 never says how many chase Combinations a row shows (UJ-1 says "two or three"). Two builders will produce visibly different products from this. *Fix:* add a consequence to FR-1 bounding the default displayed list, and one to FR-2 fixing the chase-Combination count, both with the value from UJ-1.
- **medium** FR-3/FR-19 require an equality the declared schema field cannot express (§4.1 FR-3, §4.6 FR-19, §9 OQ-1) — FR-3 says a Raw Base's "search uses `normal` rarity and **item level exactly 82**" and FR-19 says "Raw Bases are pinned to item level exactly 82", but FR-19 also says the declared field is `itemLevelMin` and the Glossary defines Item Level Floor as "the **minimum** item level a Tracked Entry's search accepts". `itemLevelMin: 82` matches item level 83 and above. OQ-1 is amending this exact schema without noting the case. *Fix:* decide whether Raw Bases need an `itemLevelMax` (or an exact-match flag) and fold it into the OQ-1 amendment, or relax FR-3 to "at least 82" and say why that is acceptable.
- **medium** §6.1 promises tombstone surfacing that no FR delivers (§6.1, §4.5 FR-7, FR-13) — §6.1 puts "status, **tombstones** and tracked-list age surfaced read-only in the view" in MVP scope, and the addendum's adopted Curation Surface option says "The view shows Curation Status...". But FR-7 says "Every **non-`pruned`** Tracked Entry for that Base Type appears", and no other FR surfaces a pruned entry or its reason. FR-13's rationale — a reason recorded "so the same Combination is not re-added and re-learned each league" — only works if the player can see it while looking at the base. *Fix:* add a consequence to FR-7 for pruned entries (shown collapsed/greyed with their reason, explicitly not contributing), or drop tombstones from §6.1.
- **medium** FR-8's consequences are not testable (§4.3 FR-8) — "in a way that reads as worthless" and "must not imply the Combination is junk" are the two most important sentences in the honesty feature and neither can be verified. *Fix:* apply FR-11's technique — enumerate the required per-state treatment (label text, required non-colour affordance, forbidden renderings) as FR-11 enumerates forbidden phrases.
- **medium** No FR says what the player sees when an artifact is refused (§4.8 FR-24, §7 NFR-8) — FR-24 requires `core` to refuse "an unknown `schemaVersion` major" and to "refuse to rank from an invalid file rather than ranking partially"; NFR-8 generalises this to every trust boundary. The refusal semantics are thorough; the resulting screen is unspecified. FR-4 covers the per-Base-Type Unrankable case, so the gap is specifically whole-artifact failure and cold start with no Dataset. *Fix:* one FR (or a consequence on FR-4) defining the whole-artifact failure state and the no-data-yet state, including what it says about the cause.

---

## Scope honesty — strong

No findings. This dimension is the document's best.

§5 carries eleven explicit Non-Goals, and almost none of them is a bare exclusion — each carries the reasoning that makes it survivable. The augment advisor is excluded *and* ranked ("the strongest v2 candidate if the pickup list proves out"); the loot filter is excluded on a technical fact (`HasExplicitMod` has no PoE2 equivalent) plus a product argument; variance-based ranking is excluded with the justification that makes it safe ("At ~144 crafting decisions an hour, attempt volume makes mean-based math sound"). §5's last entry does the hardest thing a Non-Goals section can do: it names the product's own unsolved problem — "Discovering Combinations the player did not think to track" — as a non-goal rather than omitting it.

§6.2's nine deferrals each carry a reason and a revisit condition, and two of them ("Mod-group conditional probability", "Coarser fallback pricing") are de-scopings that a less honest PRD would simply not have mentioned. The four `[ASSUMPTION]` tags roundtrip cleanly into §10, and each carries its justification inline rather than only in the index.

Open-items density — six Open Questions, four Assumptions, two `[NOTE FOR PM]` — is proportionate. For a solo build with a settled architecture, this is not an over-hedged document; the items are concentrated on the two genuinely unknown things (pool coverage, `no-listings` fraction) and one schema amendment with a named owner.

---

## Downstream usability — strong

This PRD is explicitly chain-top (it feeds epics and stories, per §0), so this dimension carries weight, and it holds up. The Glossary (§3) is unusually disciplined — every term is defined once, tied to its AD, and used verbatim in the FRs; "Price State", "Provenance", "Eligible Pool", "Curation Status" and "Item Level Floor" all appear in their Glossary casing throughout. The declaration "Introducing a synonym anywhere is a discipline violation" is actually honoured.

IDs are clean: FR-1..FR-28 contiguous with no gaps or duplicates across nine features, UJ-1..UJ-6, SM-1..SM-6 plus SM-C1..SM-C4, NFR-1..NFR-10. Reverse traceability works in both directions — every SM names the FRs it validates, and every UJ is claimed by at least one FR's "Realizes UJ-n". Sections extract cleanly: a story-creation pass could lift §4.6 or §4.8 alone and have everything it needs, because cross-references go through Glossary terms and FR ids rather than "see above".

The two defects are small and mechanical, both below.

### Findings

- **medium** Two cross-references point at §8 where §9 is meant (§0, §5) — §0's "That is an amendment the architecture must absorb under AD-22, **flagged in §8**" refers to Open Question 1, which is in §9; §5's "Recorded as an unsolved risk (§4.5 Notes, **§8**)" likewise means §9/§6.2. §8 is Success Metrics. Both are off by one, suggesting a section was inserted after these lines were written. This misroutes a reader on the PRD's own headline amendment. *Fix:* change both to §9.
- **low** NFR-6 defers instead of stating its bound (§7) — "**NFR-6 — Read-time budget.** See §4.1 — under 100 ms for a full ranking pass." It happens to include the number, but the pattern breaks §7's own extractability: a reader pulling the NFR list alone gets a pointer. *Fix:* state it self-containedly (the 100 ms figure plus the "memoise, never precompute" constraint from §4.1).

---

## Shape fit — strong

No findings. The shape matches the product on every axis the rubric names.

Hobby/solo is handled correctly: §8 opens by declining instrumentation, and the metrics that follow are behavioural observations one person can make about himself ("The trade site stays closed mid-session", "The mental top-five goes away"). There is no stakeholder map, no rollout plan, no adoption target — and §2.2 forecloses the growth framing outright ("no growth goal, no monetization, no advertising"). Rigor is light where rigor would be theatre and heavy where the money is.

The UJ treatment is right for a single-operator tool. §2.3 says so explicitly — "Single operator, single role, no authentication and no multi-device handoff, so these are written in the template's lighter form" — and the six UJs are single-paragraph scenarios rather than stepped flows. The protagonist is "the player" throughout rather than a name, which for a one-user tool is the correct call, not a defect: there is exactly one person and inventing a persona name for him would be the theatre this document otherwise avoids. The UJs are load-bearing despite the light form — UJ-2's threshold turn and UJ-4's trust check are each claimed by multiple FRs, and UJ-5/UJ-6 exist specifically to cover the two flows (curation, league reset) that live partly outside the app in a text editor and a commit. That is the right place to have used a journey.

The one thing that could read as over-formalization — 28 FRs and 10 NFRs for a one-user hobby tool — is justified by a different axis: this PRD is written for agent builders working in parallel worktrees (NFR-4), where a looser requirement is a divergence rather than a conversation. The granularity is buying buildability, not ceremony. §0 says exactly this, and the document behaves consistently with it.

---

## Mechanical notes

- **Glossary drift.** None found. Spot-checked "Payout Threshold", "Price State", "Curation Status", "Eligible Pool", "Provenance", "Tracked Entry", "Raw Base", "Combination", "Item Level Floor" across §1–§10 — casing and phrasing are consistent, and the Glossary/schema-field pairs (Item Level Floor ↔ `itemLevelMin`, Tracked Entry ↔ `TrackedEntry`) are used deliberately rather than interchangeably.
- **ID continuity.** FR-1..FR-28 contiguous, unique, no gaps. UJ-1..UJ-6, SM-1..SM-6, SM-C1..SM-C4, NFR-1..NFR-10 all clean. Every "Realizes UJ-n" resolves; every SM's "Validates FR-n/NFR-n" resolves.
- **AD citations.** All AD references verified against `ARCHITECTURE-SPINE.md`. Every cited AD exists and says what the PRD attributes to it, including the less obvious ones (FR-23 and §6.2 citing AD-18 for recipe-invariant ordering — correct, AD-18's final paragraph; FR-4 citing AD-18 for Unrankable — correct). No citation drift found.
- **Cross-references.** Two broken: §0 "flagged in §8" and §5 "(§4.5 Notes, §8)" should both be §9. See Downstream usability.
- **Assumptions Index roundtrip.** Clean. Four inline `[ASSUMPTION]` tags (FR-2, FR-6, and the two indexed to §4.7/FR-23 and §2.3/UJ-6); all four appear in §10, and §10 introduces nothing not inline. Note that the §4.7/FR-23 and §2.3/UJ-6 entries are indexed without a visible inline tag at those locations — the substance is present in the body text but the marker is not, so a mechanical extractor would find 2, not 4.
- **UJ protagonists.** All six carry "The player" with context inline; no floating UJs. Appropriate for single-operator — see Shape fit.
- **FR-19 arithmetic.** Verified against the addendum's worked table: crit T1 @ 73, phys T2 @ 75, max = 75. PRD and addendum agree.
- **Budget arithmetic.** Verified: §4.6's "about 62% of the daily search budget" matches FR-12's 1,500 / ~2,400. Consistent.
- **Required sections.** All present for the agreed stakes and shape. Personas correctly absent; a Risks section is absent but its content is distributed across §4.5 Notes, §5, §6.2 and §9, which for this size is a reasonable trade.

**Finding counts:** 0 critical · 2 high · 8 medium · 2 low.
