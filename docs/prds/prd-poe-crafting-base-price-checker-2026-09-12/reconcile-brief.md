---
title: "Brief -> PRD Fidelity Reconciliation"
created: 2026-09-12
inputs:
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/brief.md
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/addendum.md
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/.memlog.md
target:
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/addendum.md
---

# Brief -> PRD Fidelity Reconciliation

Coverage and faithfulness only. Not a quality review. Every item below is either
material the sources assert that the PRD pair does not carry anywhere, or a place
where the PRD says something the sources contradict.

Verdict up front: **coverage is high**. All six brief Success Criteria, all eight
brief Non-Goals, all four Development Constraints and five of six named Risks survive
in some form, and the PRD is unusually good at preserving authorial tone ("welcome,
but not courted", "that freedom is load-bearing", "the dial that decides everything"
all survive close to verbatim). The losses cluster in three places: **the rationale
layer beneath decisions the PRD kept**, **two of the brief's six risks**, and **the
roadmap/aspiration framing**, which the PRD flattens into rejections.

---

## A. Known and intentional divergences (recorded, not defects)

**A-1. `ilvl >= ~78` superseded by a per-entry Item Level Floor.**
Brief body Scope ("Magic bases ... at endgame item levels") and memlog line 18
("Endgame filter: ilvl >= ~78") are replaced by FR-19's Accepted Tier rule and the
derivation in the PRD addendum. Done on later user instruction, explicitly flagged in
PRD §0 and Open Question 1. **Correct and well-handled.** The PRD addendum even
carries forward the cost the brief addendum attached to the tier restriction (T3
modifiers valuable due to build meta stay invisible; the restriction governs the
default, not the ceiling).

**A-2. `~2,000 tracked combinations` -> `~1,500`.**
Already superseded inside the brief addendum itself (Request Budget Analysis table,
and memlog line 56 recording the architecture run's live measurements). PRD FR-12 and
SM-C1 carry ~1,500 / ~2,400 / ~62% / ~15h consistently. **No action.**

---

## B. Material the brief or addendum asserts that the PRD does not carry anywhere

### B-1. "Listings are supply, not demand" survives only as a labelling rule, not as a risk

**Source (brief, Key Risks):** *"Every price in the system is what someone is asking,
filtered to be plausible. No sale is ever observed. The manual loop has a correction
the tool does not: the player actually sells things and finds out."*

This is OPEN CHALLENGE 1 in the memlog (line 16) and it was **never resolved** — the
brief records it as a standing, unmitigated risk. The PRD carries the first half
(§4.4 description: "Every price in the system is an asking price, no sale is ever
observed"; FR-11 forbids "sells for"/"worth" copy). What it drops is the second half:
**the tool is strictly worse than the loop it replaces on exactly one axis — the
manual loop has a real-sale feedback correction that the tool discards.**

That is the single most self-critical statement in the brief, and it is
emotionally/argumentatively load-bearing: it is the honest counterweight to SM-4 ("the
list holds up against reality"). In the PRD it has been converted from a risk the
product carries into a copywriting constraint on the view. Nothing in the PRD tells a
downstream reader that the tool gives something up.

**Severity: high.** Recommend restoring as a stated limitation, and noting that SM-4
is the only success metric with no instrumentation path precisely because of it.

### B-2. The PRD has no Risks / Known Limitations section at all

Consequence of B-1, and structural. The brief's six named risks land in the PRD only
where they happen to map onto a feature:

| Brief risk | PRD landing | Status |
|---|---|---|
| Cannot discover what it is not told to watch | §4.5 Notes, §5 Non-Goal, OQ-6 | Carried well |
| Request budget is the binding constraint | FR-12, SM-C1, §6.2 auth lever | Carried well |
| Zero-listing combinations | §4.3 description, FR-8, OQ-5 | Partially (see B-3) |
| No public modifier weight dataset | §4.8, FR-25 | Partially (see B-4) |
| League and patch churn | §4.9 (strong — keeps "central threat to the one-year horizon") | Carried well |
| Listings are supply, not demand | FR-11 only | Lost as a risk (B-1) |

Risks that map to a feature survive; risks that do not, evaporate. §9 Open Questions
is a *build-blocking* list, not a risk register, and the two are being conflated.

### B-3. Spawn-weight disambiguation of zero-listing combinations is missing entirely

**Source (brief, Key Risks):** *"Modifier spawn weights would [resolve it] — a
combination that is genuinely rare *and* unlisted is a plausible jackpot, while a
common unlisted one is junk."* Restated as brief addendum Alternative 3
("Spawn-weight disambiguation ... contingent on obtaining real weights").

The PRD carries the problem (jackpot-or-junk, §4.3) and it carries the *other* named
mitigation (coarser fallback pricing, §6.2 — brief addendum Alternative 2). It does
not carry this one anywhere: not in §6.2, not in §9, not in the addendum. This
matters because it is the **only identified route that actually resolves the unknown
bucket rather than working around it**, and it is a concrete payoff argument for
acquiring measured weights — which §6.2 currently defers with no stated benefit
beyond "the ranking improves."

**Severity: high.** It also orphans a link: §6.2 defers measured weights, OQ-5 worries
about the size of the `no-listings` bucket, and the sources connect those two facts.
The PRD does not.

### B-4. poe2db's listing-bias caveat — imported weights carry the same bias the tool already has

**Source (brief addendum, Data Source Notes):** *"poe2db's own bias caveat is worth
inheriting: trade listings skew toward more desirable and higher-tier modifiers,
mitigated by parsing the lowest-value listings ... This independently validates the
ascending-sort choice in the price estimator, and it means any imported weight carries
the same listing bias this tool is already exposed to."* Also brief Key Risks:
*"Whatever is obtained is someone's estimate carrying its own listing bias."*

Absent from the PRD. Two distinct losses:
- **The validation.** The brief found independent third-party confirmation for its own
  ascending-sort choice. FR-18 mandates ascending sort with no rationale at all
  (see B-6), so this corroboration has nowhere to live.
- **The warning.** A future measured Weights File is not a clean escape from listing
  bias — it imports the same bias by a different route. The PRD's Provenance model
  (`measured` / `uniform-prior` / `absent`) implicitly frames `measured` as the good
  state. Nothing tells a downstream reader that `measured` is still someone's
  listing-derived estimate.

**Severity: medium-high.** The second point risks the exact failure FR-9/SM-C4 exist
to prevent, just one level up.

### B-5. PoE2 asynchronous trade (Merchant Tabs / NPC Ange) — the mechanism that makes instant-buyout filtering meaningful

**Source (brief addendum, Price Estimator Rationale):** *"PoE2 asynchronous trade
(Merchant Tabs, the NPC Ange, buyers paying listed price plus a gold fee, sellers
transacting while offline) is what makes instant-buyout filtering meaningful.
Confirmed to exist."*

FR-18 mandates instant-buyout-only filtering. The PRD never says why that filter is
valid, and the fact that it *is* valid rested on a verified game-mechanics finding.
An implementer or a future reviewer asking "why exclude non-IBO listings, aren't we
throwing away most of the market?" finds no answer in the PRD.

**Severity: medium.**

### B-6. The price estimator's rationale — ascending sort, instant buyout, and the two rejected options

**Source (brief body, How Value Is Estimated):** *"Sorting ascending means stale
overpriced listings never reach the estimate; restricting to instant buyout means
underpriced listings would already have been bought."*

**Source (brief addendum, Price Estimator Rationale):** three options costed —
(1) face value at a low percentile [adopted], (2) poll repeatedly and treat listing
disappearance as a sale signal, (3) log the user's own actual sales as ground truth.

The PRD carries the *mechanics* (FR-18: ascending, IBO, cheapest 10) and none of the
reasoning or the rejections. Specifically missing:
- Why ascending. Why IBO. (Brief body, one sentence, entirely absent.)
- **Option 2 was noted as "the only approach that improves the longer the tool runs,
  and the only one poe2scout is not doing"** — a genuine strategic observation, and
  the rejection reason was that its payoff is sell-through data *which the user does
  not value* (which ties it to the sell-through non-goal the PRD does carry). Also
  "worthless at league start," which ties it to §4.9.
- Option 3 rejected as *"manual work inside a tool built to avoid manual work."* That
  is a principle, not a one-off decision — it applies to every future feature
  proposal, and the PRD has nowhere it is stated.

The PRD addendum explicitly disclaims repetition of the brief addendum but lists what
it is relying on the brief addendum for: "the request-budget analysis, the rejected
alternatives for combination discovery, the ranking-metric derivation and the
data-source notes." **The Price Estimator Rationale section is not in that list**, so
it is not deliberately delegated — it is simply unreferenced.

**Severity: medium.** §5 Non-Goals is the natural home for options 2 and 3.

### B-7. The ranking metric's founding insight: "the question has no answer until a denominator is named"

**Source (brief addendum, Ranking Metric — Derivation):** *"The question has no answer
until a denominator is named. Profitability per drop, per craft attempt, per inventory
slot, and per hour played rank X and Y differently."*

The PRD carries the conclusion (threshold-truncated EV, FR-1), the user's binding
constraint (JTBD "Spend time playing, not crafting"), and both dismissals (variance,
sell-through — both in §5). It does not carry the framing move that produced the
answer: that "which base is more profitable" is an ill-posed question until you choose
a denominator, and that **per craft attempt** is the chosen one.

This is not decoration. FR-1's consequences bullets specify that Craft Cost is
subtracted once per Base Type rather than per Combination, and that the threshold
compares against gross price — both of which are *consequences of the chosen
denominator*. Stated without it, they read as arbitrary arithmetic conventions that a
reasonable implementer could argue with.

**Severity: medium.**

### B-8. "With ~500k players, anything worth tracking will have listings"

**Source (memlog line 32, the decision that resolved OPEN CHALLENGE 4 by
segregation):** this population argument is the stated reason the team believed the
`no-listings` bucket would be small enough for segregation to be a workable answer.

PRD OQ-5 asks the open question ("What fraction of the tracked list returns
`no-listings`? Unknown until the first full refresh") without carrying the prior. A
reader cannot tell whether "small" or "large" is the expected outcome, or what
assumption a large result would falsify.

**Severity: low-medium.** One clause in OQ-5 fixes it.

### B-9. Prior art: poe2scout does not overlap

**Source (brief addendum, Data Source Notes, and memlog lines 15 and 50 — the latter a
verified user correction that removed the prior-art risk from the brief):**
*"poe2scout was evaluated as prior art and found not to overlap ... covers currency
exchange rates and volume, unique items, price history, and unique base reference data
... carries nothing on magic base prices by modifier combination. No reuse available;
no competitive overlap."*

The PRD never mentions poe2scout. The finding cost a research cycle and a correction
round-trip, and it is the answer to the first question any reviewer asks ("does this
already exist?"). It also has a live consequence the PRD does happen to state
independently but does not connect: §6.2 defers price history because git carries it
— poe2scout *does* offer price history, and the sources concluded that still does not
overlap.

**Severity: low-medium.** Belongs in §2 or the PRD addendum.

### B-10. RePoE is a recurring maintenance dependency

**Source (brief addendum):** *"[RePoE fork is] usable for modifier identity, tiers and
base-to-modifier mapping; useless for probability. **Still a recurring maintenance
dependency, since it tracks game patches.**"*

The PRD mentions RePoE twice (OQ-2 as the likely source for per-tier item levels;
OQ-4 as the source of the uniform-prior pool mapping) and in both cases treats it as a
one-time lookup. The brief's point — that RePoE must be re-consulted every game patch,
and therefore adds to the upkeep surface that JTBD "Keep a tool alive for a year"
declares a first-class concern — is not carried.

This interacts with FR-20 (`unresolvable` stat ids as the symptom of a patch): the PRD
has a patch-detection mechanism but no statement of the patch-driven *re-curation*
work that follows.

**Severity: medium.** Directly relevant to the one-year horizon, which the PRD
otherwise takes seriously.

### B-11. "Weights as a byproduct" — the tool's own output improves the longer it runs

**Source (brief addendum, Data Source Notes):** *"The tool's own pricing output is the
same raw material poe2db parses. Deriving in-house weights from accumulated
observations is therefore possible in principle, and gets better the longer the tool
runs — a third potential producer of the weights file."*

PRD §4.8 lists "weights derived in-house" as an acceptable producer — so the *fact*
survives as a one-word list item, but the *insight* does not: that the tool
accumulates the raw material for its own biggest missing input, and that this
compounds with runtime. That is the strongest long-horizon argument in the sources for
the decoupled-file design, and it is the reason the decoupling is an asset rather than
merely a tidiness choice.

**Severity: low-medium.**

### B-12. The scale argument against enumeration, and the ~250-base-type figure

**Source (brief addendum, Request Budget Analysis):** exhaustive enumeration costed at
~50,000 searches / ~500 hours / ~21 days, derived from the user's worked example
(wands: 11 prefixes, 18 suffixes, ~400 combinations per base restricted to T1-2,
~1,000+ searches for the wand category alone). *"Infeasible at any useful refresh rate
— which is the argument for curation, not against it."* Also: **~250 endgame-relevant
base types.**

The PRD states the adopted number (~1,500) and the ceiling (~2,400/day) but never the
counterfactual that makes curation obviously necessary rather than merely chosen. A
reader of the PRD alone cannot tell whether curation is a 30% saving or a 30x one.

The ~250 figure is separately useful and separately missing: it is the denominator for
OQ-4's genuinely worrying question ("how much of v1's ranked list does incomplete pool
coverage remove?"), which currently has no scale to be measured against.

**Severity: medium** for the ~250 figure (it makes OQ-4 answerable), **low** for the
enumeration counterfactual (arguably brief-addendum depth, and the PRD addendum does
delegate the request-budget analysis by name).

### B-13. "An existing UI framework or design system" exists only as a negative

Brief Development Constraints state four **hard requirements**, of which the third is
*"An existing UI framework or design system. Appearance is explicitly not a
priority."* Memlog line 12 records it as a decision.

The PRD carries three of the four as NFRs (NFR-1/2 testability and fixtures, NFR-4
parallel worktrees) and the fourth only as a §5 Non-Goal: "Visual design beyond an
off-the-shelf framework." The *positive obligation* — adopt an existing design system
rather than build one — is never stated as a requirement. A non-goal forbids custom
design; it does not require adoption of a framework, and an agent could satisfy §5
with unstyled HTML.

The fourth constraint, **"Two components: sync and aggregation, and display"**, is
likewise not stated in the PRD; it is presumably satisfied by the inherited spine's
package split, but the PRD does not say so.

**Severity: low-medium.** Both are probably covered by the inherited spine; flagged
because the brief marked them "hard requirements rather than preferences."

### B-14. The mid-league staleness cost of memorization

Brief, The Problem, second of three costs: *"It goes stale. Prices move within a
league as builds rise and fall. A base that paid last week may not this week, and
nothing tells you."*

PRD §1 Vision carries costs one (weeks to acquire) and three (destroyed by league
reset) and drops cost two. The JTBD "Know when the answer has gone stale" is about the
*tool's own data* freshness and Provenance, which is a different thing — that is FR-9
and FR-10, not this.

This is the cost that justifies the daily refresh and the "whenever the economy is
worth a look" usage mode, both of which the PRD keeps but no longer motivates. It is
also the only one of the three costs that applies *between* league resets, i.e. for
the large majority of the product's life.

**Severity: medium.** One sentence in §1.

### B-15. Why the loop is attractive in the first place

Brief, The Problem, opening: *"Base farming is attractive precisely because it is
low-effort: pick up bases while mapping, apply a transmute and an augment, sell the
winners. At roughly twelve bases per five-minute map, the loop generates around 144
decisions an hour."*

The PRD's Vision explains that the method is gated behind memory but never that it is
*attractive because low-effort* — the reader is never told why the player does this at
all rather than some other currency strategy. The ~144/hour figure survives (§5,
variance non-goal) but detached from the 12-bases-per-5-minute-map derivation, so it
appears as a bare assertion.

Note the figure is doing double duty in the sources: it justifies mean-based math
(carried) *and* it establishes that the pickup decision happens at a pace no manual
trade-site check can match (brief: *"which cannot be done at the pace the game
produces items"*) — that second use is dropped, and it is the reason SM-1 ("the trade
site stays closed mid-session") is a meaningful success signal rather than a
preference.

**Severity: low-medium.**

### B-16. The loot filter as roadmap, flattened into a pure rejection

Brief Vision: *"Beyond that, a generated loot filter so the game itself highlights what
to pick up — with a hard ceiling worth naming now."* Memlog line 20 records it as
*"(decision) Stretch vision: export a generated loot filter."*

The PRD carries the ceiling faithfully and well (§5 Non-Goals: no `HasExplicitMod`,
automates the easy half, cannot touch the hard half, the web view is the permanent
product). What it drops is that the filter **remains a wanted future thing**. In the
sources it is a stretch goal with a known limit; in the PRD it is only a rejection.
§6.2 "Out of Scope for MVP" lists eight items with revisit conditions — the filter is
not among them, it is in §5 "Non-Goals (Explicit)" alongside genuinely permanent
exclusions like rare items and multi-user.

Relatedly, the brief addendum's emotionally load-bearing conclusion is absent:
*"The 'eventually I won't have to memorize anything' outcome is not achievable."*
That sentence is the author confronting the fact that the product's own animating
wish cannot be fully granted. The PRD states the mechanical consequence and not the
disappointment.

**Severity: medium.** The categorisation change (roadmap item -> permanent non-goal) is
a real scope statement, not just tone.

### B-17. Vision's closing image: "a live read on the economy this week"

Brief Vision: *"the ranked list becomes the thing consulted before every session — a
live read on which corner of the economy is worth farming this week rather than a fact
learned last month."*

PRD §1 has "read before a play session, or whenever the economy is worth a look" —
which preserves the usage mode but loses the contrast that gives it meaning: **live
read this week vs. fact learned last month.** That contrast is the compressed
statement of the entire value proposition and it pairs directly with B-14.

**Severity: low.** Mostly tone, but it is the brief's closing line for a reason.

### B-18. "A stale top five that the user trusts is worse than no tool"

**Source (brief addendum, Alternatives Considered #1):** the sharpest statement of the
cold-start / meta-blindness risk.

It appears in the **PRD addendum** (Curation Surface, attributed to AD-23) but not in
the PRD proper. FR-15 (surface the tracked list's age) exists specifically to prevent
this outcome, and its Consequences explain the mechanism without ever stating the harm
it is defending against. SM-C4 ("Apparent confidence") is the closest analogue but is
about Provenance, not staleness of the tracked list itself.

**Severity: low.** Present in the pair, just not where it does the most work.

### B-19. Terminology decision not carried forward as an instruction

Memlog line 44: *"(decision) Terminology: prefer 'currency' and 'value'; avoid
'money'."* The PRD **complies** throughout (no occurrence of "money"), but does not
record the rule. §3 Glossary is explicitly the terminology contract for downstream
workflows ("Introducing a synonym anywhere is a discipline violation") and is the
natural home for it. Downstream story writers will not know.

**Severity: low.** Compliance is currently accidental rather than enforced.

---

## C. Places the PRD states something the sources contradict

### C-1. FR-18 specifies the **median** of the cheapest 10; no source says median

**Sources:** brief body — *"Prices come from the cheapest live instant-buyout
listings"*; brief addendum — *"Cheapest ~10 live listings, instant-buyout only"*, with
the adopted approach described as *"a middle ground closer to (1)"*, where option (1)
is *"Take listings at face value, **read a low percentile**."*

**PRD FR-18:** *"the Price Observation is the **median of those listings' prices**
after normalisation to Divine."*

The median of the cheapest 10 IBO listings is a defensible reading of "read a low
percentile" — the 50th percentile of a sample already truncated to the bottom of the
book is low in absolute terms. But the sources say "low percentile" and the PRD says
median, and those are different specifications that produce different numbers. Nothing
in the sources selects median over, say, the 25th percentile of the ten, or the
cheapest, or a trimmed mean.

This is the **single most load-bearing definition in the product** by the PRD's own
statement (§4.6 description: *"The single most load-bearing definition in the product
is how a price is estimated, and it is fixed here rather than left to whichever agent
writes the syncer"*) — and it is fixed by an inference that carries **no
`[ASSUMPTION]` tag** and does not appear in §10's Assumptions Index. §10 claims to
index "every `[ASSUMPTION]` in this document"; this one was never tagged, so the index
is complete but the tagging is not.

**Severity: high.** Not a contradiction of a stated source value, but an untagged
narrowing of an explicitly loose source specification, at the highest-stakes point in
the document. Recommend an `[ASSUMPTION]` tag plus an index entry, so the user can
confirm or correct it.

### C-2. Curation controls demoted from an in-scope product capability to hand-edited files

**Brief Scope, In for the first version:** *"Curation controls: prune junk
combinations, pin ones to watch."* Listed as a first-class v1 capability alongside the
ranked list and the threshold control.

**PRD:** §4.5 makes the tracked list "a hand-owned, committed file; the browser never
writes to it (AD-15, AD-21)"; UJ-5 has the player opening `data/tracked.json` in an
editor and committing; §6.1 lists "Curation via hand-edited committed files, with
status, tombstones and tracked-list age surfaced **read-only** in the view."

This is well-reasoned and explicitly worked (PRD addendum, "Curation Surface — Options
Considered", three options, adopted one justified against AD-15/AD-21). It is
nonetheless a **material narrowing of a brief in-scope item**, and the brief's phrasing
("controls") most naturally reads as in-app. The PRD does not flag it as a change from
the brief the way §0 flags the item-level change — it presents the file-editing model
as if it were what the brief asked for.

**Severity: medium.** The decision looks right; the *silence about it being a change*
is the issue. §0 already has the precedent for how to flag this.

### C-3. The brief's "base paired with a crafting recipe" as the ranked unit is satisfied only nominally

**Brief, How Value Is Estimated:** *"The ranked unit is a base paired with a crafting
recipe, not a base alone. Perfect and greater transmutes and augments produce
different tier distributions at different costs, and currency prices move during a
league, so the same base can win under one recipe and lose under another."*

**PRD:** FR-23 and §6.2 ship one recipe, with the distribution transform as identity,
making ordering **recipe-invariant** — so the brief's stated payoff ("the same base
can win under one recipe and lose under another") cannot occur in v1 by construction.

The PRD is **honest and explicit** about this (FR-23: "This is a stated limitation, not
an empty slot for an implementer to fill by invention"; §6.2 second-recipe deferral;
PRD addendum "Recipe Count for v1"; OQ-3). No fidelity failure — recording it because
it is the one place a brief assertion is carried in form while its substance is
deferred, and a reader skimming §6.1 ("One Craft Recipe ... with cost computed from
synced rates") would not notice.

**Severity: informational.** Well-handled; no change recommended.

### C-4. Refresh cadence — internal source drift, correctly resolved

Brief addendum Price Estimator Rationale still says *"refreshed every few hours"*;
brief body says *"Refreshed daily"*; memlog line 56 records the body being corrected to
daily after live rate-limit measurement, but the addendum's estimator sentence was not
updated. The PRD follows daily (~15h full refresh, SM-C2). **The PRD is right and the
brief addendum carries a stale clause.** No PRD action; flagged so the brief addendum
is not later read as authoritative on cadence.

### C-5. Component count — elaboration, not contradiction

Brief: *"Two components: sync and aggregation, and display."* PRD/spine: `sync`,
`core`, `view`, `contracts`. `core` is the "aggregation" half made a separate package
and `contracts` is a schema boundary; the brief's two responsibilities are both
present. Noted only because the brief called it a hard requirement and the PRD never
maps the one onto the other. See B-13.

---

## D. Vision and Success Criteria — did the substance survive?

### D-1. Vision: mostly, with the roadmap half hollowed out

Brief Vision has two movements. **Movement one** — memorization goes away, the list
becomes the pre-session ritual, a live read on the economy this week rather than a
fact learned last month — survives in PRD §1 and UJ-1, minus the closing contrast
(B-17) and minus the mid-league staleness that motivates "this week" (B-14).
**Movement two** — the loot filter as the next thing, with a named hard ceiling —
survives only as its ceiling (B-16). The PRD's §1 is a genuinely good Vision section
that is also strictly present-tense: it describes v1 and stops. The brief's Vision
describes where this goes and where it cannot go, and only the "cannot" was carried.

### D-2. Success Criteria: fully carried, and improved

All four brief criteria map cleanly and keep their behavioural framing:

| Brief criterion | PRD |
|---|---|
| Player stops opening the trade site mid-session | SM-1 |
| Player stops keeping a top-five list in his head | SM-2 |
| League start costs days, not weeks | SM-3 |
| Chase decisions hold up against what actually sells | SM-4 |

"Behavioral, not numeric" survives verbatim in the §8 preamble, with an added
justification (one user, instrumenting costs more than the signal is worth) that is
faithful to the brief's spirit. The PRD **adds** SM-5 (still running in a year — traces
to memlog line 7's "sustainability of upkeep is a first-class requirement"), SM-6
(agents ship unblocked — traces to the Development Constraints), and four
counter-metrics that have no source antecedent but are each derived from a real brief
risk. These are additions, not drift.

One tension worth naming: **SM-4 is unverifiable for exactly the reason B-1 describes**
— the tool never observes a sale, so "matches what actually sells" can only be checked
by the player doing manually the thing the tool exists to replace. The brief's risk
section made that visible; the PRD's SM-4 does not.

---

## E. Tone, framing and motivation — overall assessment

Better than typical for a structured-FR conversion. Preserved close to verbatim:

- "welcome, but not courted" and "This freedom is load-bearing" (§2.2)
- "The dial that decides everything" (§4.2)
- "he would rather play than craft" as the binding constraint (§2.1, JTBD)
- "that much currency turns up simply playing" (§2.1, §4.2)
- "an increased-stun-threshold roll is dead without being told" (§5)
- "least useful at league start ... the central threat to the one-year horizon" (§4.9)
- "This section is the product; everything else is presentation" (quoted in the PRD
  addendum as the justification for FRs carrying arithmetic)
- The one-year-not-a-weekend-project horizon, as a JTBD rather than a footnote

The PRD also does something the brief does not and should be credited for: it converts
several brief *warnings* into *counter-metrics* (SM-C1 tracked list size, SM-C4
apparent confidence), which is a stronger form of carrying them forward than
restatement.

**What the format dropped is consistently the "why beneath the what":** rationale for
adopted mechanics (B-4, B-5, B-6, B-7), reasons rejected options were rejected
(B-6 options 2 and 3), counterfactual scale (B-12), and the two pieces of self-criticism
the author put in the brief deliberately (B-1's lost feedback correction, B-16's
unachievable "never memorize anything again"). The FR "Consequences (testable)" format
is excellent at preserving *what must be true* and structurally hostile to *why we
chose this over that* — which is precisely the material the brief addendum exists to
hold, and which the PRD addendum declines to repeat without always confirming the
brief addendum actually covers it (see B-6).

---

## F. Recommended actions, ordered

1. **B-1 / B-2** — Add a short Risks / Known Limitations section, or fold into §9 with
   a clear split between "blocks build" and "standing risk." Restore "the manual loop
   has a correction the tool does not," and connect it to SM-4's unverifiability.
2. **C-1** — Tag FR-18's median choice as `[ASSUMPTION]` and index it in §10. Highest
   stakes, currently invisible to the user's confirmation pass.
3. **B-3** — Add spawn-weight disambiguation of zero-listing Combinations to §6.2 and
   link it from OQ-5 and from the measured-weights deferral.
4. **B-4** — Record that imported weights carry listing bias, so `measured` Provenance
   is not read as ground truth. One sentence in §4.8.
5. **B-16 / C-2** — Move loot filter export from §5 to §6.2 with its ceiling intact, or
   state in §5 that it remains a wanted roadmap item; and flag the curation-surface
   narrowing in §0 the way the item-level change is flagged.
6. **B-6 / B-5** — Add the rejected price-estimator options to §5, and one clause in
   FR-18 on why ascending + IBO (asynchronous trade makes IBO meaningful; ascending
   excludes stale overpriced listings).
7. **B-10 / B-13** — Note RePoE as a recurring patch-cadence maintenance dependency,
   and restore the positive "adopt an existing framework/design system" requirement.
8. **B-7 / B-12 / B-8 / B-14** — One-to-two-sentence restorations: the denominator
   framing, the ~250 base types and enumeration counterfactual, the ~500k-players
   prior in OQ-5, the mid-league staleness cost in §1.
9. **B-9 / B-11 / B-17 / B-18 / B-19** — Low-cost completeness: poe2scout prior art,
   weights-as-byproduct, the Vision closing contrast, "a stale top five ... worse than
   no tool" in FR-15, and the currency/value terminology rule in §3.
