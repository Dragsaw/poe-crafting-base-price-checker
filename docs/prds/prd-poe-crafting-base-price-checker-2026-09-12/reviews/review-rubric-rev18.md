# PRD Quality Review — PoE2 Crafting Base Price Checker (revision 18)

Rubric: `.claude/skills/bmad-prd/assets/prd-validation-checklist.md`. Walked against the document as
committed on 2026-09-20, with the architecture spine (revision 16), `addendum.md` and `.memlog.md`
read as context rather than as review targets.

## Overall verdict

This is a strong PRD — it has a real thesis, it names what it gives up, and its altitude discipline is
better than almost any PRD of this size. The Item Class move is carried through the document cleanly at
the noun level: §3 is redefined rather than renamed, all 33 FRs and the §11 index round-trip, and no
"Item Category" survives anywhere. What is at risk is the *load-bearing new claim itself*: FR-1's
absolute guarantee that no base outside the class contributes to a crafted row's price is asserted
against citations (AD-16, AD-17) that currently say the opposite, and the spine's own open question
about exactly this residual (OQ-25) is missing from §10. The document is internally consistent; it is
its relationship to the layer it inherits from that is not.

## 1. Decision-readiness — adequate

The PRD states decisions as decisions and is unusually honest about what it is trading. FR-1's accepted
within-class spread is named as an accepted property with the direction of the error stated ("a strong
base in the class is understated and a weak one overstated"). §7.2 distinguishes product-scope calls
from technical deferrals with a player consequence. R-1's "mitigation is honesty only" and FR-13's "a
copywriting rule does not replace it" are exactly the kind of admission the rubric's red flag is looking
for the absence of. SM-4a is a genuine kill criterion — a PRD that names the condition under which its
central bet has failed is not smoothing anything to neutral.

The weakness is at one spot, and it is the spot this revision touched. FR-1's new absolute bullet reads
as settled, and the surrounding record says it is not: the decision log records the player accepting
"slight overlap" for one class family under one of the two candidate mechanisms, and records explicitly
that that tolerance is *not* in the PRD. A decision-maker reading only the PRD would believe the
guarantee is free and final. That is a real decision surface presented as a closed one.

### Findings

- **critical** FR-1's absolute guarantee is asserted against citations that contradict it (§4.1, FR-1
  bullet "No base outside the class contributes to that price") — the bullet cites AD-16 and AD-17. The
  spine at revision 16 states, in AD-16, that "a crafted search prices the category, not any one base in
  it", and that where a category carries several classes "the search cannot isolate the entry's own pool
  at all". Under §0's inheritance rule, a citation binds as the architecture, so the PRD's strongest new
  sentence is currently backed by text that denies it. The process is right — the PRD moves first on a
  player-visible change — but the document gives the reader no signal that the cited decisions lag it.
  *Fix:* mark the bullet as pending the spine's next revision (the same way §7.3 marks its dependency),
  or hold the bullet until the spine's class-altitude revision lands, so no reader inherits a guarantee
  the architecture has not yet made.

- **high** The open question the new guarantee depends on is absent from §10 (§10) — OQ-25 is spine-owned
  and, in the spine as committed, open and unmeasured: it is precisely the question of how far a crafted
  search's priced population is widened by classes it cannot exclude. §10 promises that spine-owned
  questions "are listed here by id and owner"; OQ-12, OQ-19, OQ-20 and OQ-21 are listed and OQ-25 is not.
  It is the only open question that bears directly on this revision's headline change. *Fix:* add
  `**OQ-25** — Owner: the spine.` to the spine-owned list, or, if the spine closes it in the same
  revision that adopts class altitude, land both together so the PRD is never the only document claiming
  the guarantee.

- **medium** FR-13's own mitigation bullet is not a consequence (§4.4, FR-13) — "This rule is the *only*
  mitigation in the system for Risk R-1" is an honest and valuable sentence, but it sits under
  **Consequences (testable)** and nothing about it is testable. It is a risk posture. *Fix:* move it to
  the FR's lead paragraph or to R-1, leaving the two testable copy rules under the heading.

## 2. Substance over theater — strong

There is no persona theater: one player, one role, and §2.3 says so and writes the journeys in the
lighter form rather than manufacturing six protagonists. §2.2's Non-Users do real work — "Anyone needing
their own settings … That freedom is load-bearing" converts an absence into a design licence that AD-15
then spends.

The NFRs are not boilerplate. NFR-1 names the reason (an agent iterating against a rate-limited service),
NFR-2 names what the fixture diff buys, NFR-9 ties citizenship to R-7 rather than to good manners. The
Vision is not swappable: "the ranking is not 'most expensive base'" is a falsifiable claim about this
product, and SM-4a is built to falsify it.

Two soft spots. NFR-6 and the §4.1 feature-specific NFR both state the same 100 ms bound on the same
"mid-range machine" — the number is duplicated inside one document, and "mid-range machine" is the one
unbounded adjective in an otherwise bounded set. FR-20's first consequence, "The tool's traffic is paced
so that access is never lost", is unfalsifiable as written, and its third consequence ("The mechanism is
AD-8's single governed client") restates the FR's own lead sentence rather than adding a consequence.

### Findings

- **medium** FR-20's consequences do not carry their weight (§4.6, FR-20) — of three bullets, one is
  unfalsifiable ("never lost"), one restates the FR statement, and only the second ("No component but the
  governed client issues a trade request") is testable. For an FR whose failure ends the product, that is
  thin. *Fix:* keep the second bullet, fold the third into the lead sentence, and replace the first with
  the player-observable condition — no run is throttled out of its budget, and a throttle response is
  recorded in the Sync Report.

- **low** The 100 ms bound is stated twice (§4.1 feature NFRs and §5 NFR-6) — two homes for one number
  is the drift shape this project's own pitfalls warn about, applied inside a single document.
  *Fix:* keep NFR-6 and have §4.1 cite it.

## 3. Strategic coherence — strong

The thesis is stated in §1 and every feature serves it: the bet is that *threshold-truncated expected
value beats raw price*, and the threshold is a dial precisely because the bet only shows itself as the
dial moves. FR-5's bound, FR-2's three Chase Combinations and UJ-1's top-five reading pattern are one
decision seen three times, not three independent choices.

Prioritisation follows the thesis rather than ease. The honesty apparatus (FR-10 through FR-13) is in
v1 even though it is pure cost, and §8's SM-C4 explains why in one sentence: rendering a placeholder as
cleanly as a measurement "would make the tool feel more authoritative and make it more dangerous".
Counter-metrics exist for every primary metric and each names what it counterbalances. SM-C1 is held in
*searches* rather than entries with the reason given — a metric that has been thought about.

Scope kind is coherent: a problem-solving MVP with an explicitly permanent product shape (§6's "The web
view is the permanent product, not a step toward another one"), and §7.3 admits that until the external
file arrives what ships is "a white-base price list, not the product". That is the honest version of a
release dependency.

No findings.

## 4. Done-ness clarity — adequate

Most FRs would survive story creation without a conversation. FR-9's four states with a three-member
reason enum, FR-7's 0.25 Divine cold start, FR-12's 48-hour cut-off with the clock named, FR-5's top 20
— these are testable and the numbers are owned here rather than borrowed. The *Architecture-owned*
convention in §0 is doing genuine work: an FR marked that way sends the story writer to the cited
decision for acceptance instead of pretending the PRD has it.

The gap is FR-1. The new bullet is a *guarantee*, and a guarantee needs an observable failure. What does
the player see if a class's price turns out to include a sibling class's bases? Nothing in FR-1, FR-4 or
FR-9 describes that condition — there is no reason string for it, no Price State, no Provenance value.
Contrast FR-28's treatment of the analogous producer-side trust problem, which states plainly that "no
mechanical check catches a dropped tier" and names the assertion the ranking rests on. FR-1's guarantee
gets no such sentence, so it reads as enforced when nothing in the document enforces it.

FR-22's first consequence is also borderline for a different reason: "tier 1, except where tier 1 first
appears at item level 81 or 82 and is too rare to chase" is a curation rule the player never observes,
with "too rare to chase" as an unbounded judgement, sitting one bullet above a citation to
`IMPLEMENTATION-NOTES.md` §8 that owns the derivation.

### Findings

- **high** FR-1's guarantee has no stated failure mode (§4.1, FR-1) — the document says no base outside
  the class contributes, and says nothing about what the player sees if that does not hold. Every other
  trust claim in this PRD names the thing it rests on (FR-28's `poolCoverage` assertion, FR-10's
  Provenance, FR-30's uniform-prior caveat). *Fix:* add one consequence in FR-28's voice — state what the
  guarantee rests on, whether anything detects a breach, and if nothing does, say so. If the architecture
  cannot guarantee it for every class, that is a product decision this document owns and should state,
  not one the spine should absorb silently.

- **medium** "Too rare to chase" is an unbounded judgement inside a testable-consequences list (§4.6,
  FR-22 bullet 1) — two implementers would not produce the same Tracked List from this sentence, and the
  bullet is marked *(PRD-owned)*, so there is no cited decision to fall back on. It also reads as a
  curation procedure rather than player-observable behaviour. *Fix:* either state the observable product
  decision (accepted tiers are hand-declared per entry, and the curator's rule of thumb is rationale for
  `addendum.md`), or keep the rule and give it a bound.

## 5. Scope honesty — strong

§6 is a real Non-Goals section: each entry names why, and three of them name what would have to be true
to revisit. §7.2 goes further than most PRDs dare by listing deferrals whose absence the player will
*feel*, and by flagging the one a curator will plausibly attempt and find rejected (the co-occurring-stat
conjunction). §7.3 separates the schema, which is in scope, from the file, which is not, and states the
consequence of the file being late in player terms.

Open-items density is well calibrated: ten assumptions, six open questions, two `[NOTE FOR PM]` callouts
against a one-player tool with an external hard dependency. The two PM notes are at genuine tensions —
OQ-21's effect on §7.2's deferrals, and the no-listings fraction that would promote a held option to a
needed one — not at safe checkpoints. §11's framing sentence ("none is an architecture decision") is the
right guard for this project's ownership rule.

The single gap is the one already recorded under Decision-readiness: the residual overlap question is not
tagged anywhere — not as an assumption, not as an open question, not as a note. Given how carefully every
other uncertainty in this document is marked, its absence reads as an oversight rather than a judgement.

### Findings

- **medium** No `[ASSUMPTION]` or `[NOTE FOR PM]` marks the residual class-isolation question (§4.1,
  FR-1) — every other unmeasured operating bet in this PRD carries a tag, including the closely analogous
  whole-tier containment bet at FR-29. *Fix:* if the guarantee is being taken on trust pending the
  spine, tag it the way FR-29's bet is tagged and index it in §11.

## 6. Downstream usability — adequate

This is a chain-top PRD feeding UX, architecture and stories, so this dimension matters. The
infrastructure is good: §3 is comprehensive, §0 states the verbatim-usage rule, FR ids are contiguous
1–33 with none reused, UJ-1–6 and SM-1–6 (plus SM-4a and SM-C1–C4) all resolve, and every internal
cross-reference I followed lands on a real target. Sections pull out alone — FR-9 read in isolation is
complete because it cites FR-31 and FR-23 for its reason causes rather than saying "see above".

Two things degrade it. First, FR-3 bullet 1 declares itself the owner of the two-ranked-units fact and
says "The rest of the document cites this statement" — and then §1, §2.1 and UJ-1 all restate the fact in
full without citing it, and §3's *Item Class* entry restates the crafted half while citing FR-1 rather
than FR-3. Vision prose restating a fact is defensible; a glossary entry citing the wrong owner is not,
because the glossary is what downstream workflows extract from.

Second, §3's "a synonym introduced anywhere is a discipline violation" is broken by the new FR-1 bullets
themselves, which run on bare "class" and "base" ("not any one base in it", "a class the player would
never craft on", "its own bases alone"). The prose is clearer for it, and §3's own *Item Class* entry
licenses bare "class" for *display*, not for normative text. As written, the rule and the document
disagree.

### Findings

- **medium** §3 *Item Class* cites the wrong owner for the crafted-branch ranking fact (§3) — the entry
  says "the unit the tool's crafted branch ranks" and cites AD-5/AD-11, then "It is the finest unit the
  crafted branch values … (FR-1)". FR-3 bullet 1 is the designated owner of that fact. *Fix:* cite FR-3
  in the *Item Class* entry, as the *Base Type* entry already correctly does.

- **medium** The new FR-1 bullets use bare "class" and "base" where §3 forbids synonyms (§4.1, FR-1
  bullets 5–6) — §3 is absolute ("a synonym introduced anywhere is a discipline violation") and this
  revision's own new text is the clearest violation of it in the document. *Fix:* either tighten the two
  bullets to the glossary nouns, or narrow §3's rule to normative statements and say that unqualified
  "class"/"base" is permitted in explanatory prose — the rule as stated is one no PRD of this length can
  keep.

- **low** §1's Vision still says "base-and-modifier combinations" (§1) — a pre-class-move phrasing that
  describes the crafted unit as a base. Cosmetic, but it is the first paragraph a downstream reader
  meets, and it contradicts FR-3 bullet 1. *Fix:* "class-and-modifier combinations", or cite the
  glossary term Combination.

## 7. Shape fit — strong

The shape matches the product. Single operator, so §2.3 says outright that the journeys are written in
the lighter form and six UJs carry situation rather than persona. Success Metrics are behavioural with a
stated reason ("instrumenting the tool would be more work than the signal is worth") — the correct call
for a one-user tool, and far better than inventing funnel metrics. The capability-spec shape dominates
where it should (§4.6's sync FRs) and the UJ shape appears only where reading behaviour actually drives a
requirement (FR-5's bound, FR-2's three).

Chain-top status is handled by the *Architecture-owned* marker and by the citation discipline, which is
the right mechanism for a PRD that inherits a settled spine. Nothing here is over-formalised, and nothing
consumer-shaped has been forced onto an internal tool.

No findings.

## Mechanical notes

- **Assumptions Index round-trip: clean.** Ten inline `[ASSUMPTION]` tags (§3 Item Class; FR-2 ×2; FR-3;
  FR-5; FR-7; FR-11; FR-26; FR-29; NFR-10) against ten §11 entries, in document order, with matching
  section labels and matching text. No orphans in either direction.
- **ID continuity: clean.** FR-1–FR-33 contiguous with no gaps or reuse. UJ-1–6, SM-1–6 + SM-4a,
  SM-C1–C4, R-1–R-7, NFR-1–NFR-10 all present and all referenced at least once. §10's non-contiguous OQ
  list is explained in its own preamble.
- **Cross-references: resolve,** with the caveat at the top of this review — the FR→FR and FR→UJ
  references all land, but several AD citations now point at spine text that describes the pre-revision-18
  unit. FR-1, FR-4, FR-16, FR-22, FR-25 and §3's *Eligible Pool* and *Unrankable* entries are the ones to
  re-check when the spine's class-altitude revision lands.
- **Glossary drift.** Beyond the bare class/base usage noted above: "Raw Base", "raw Base Type" (§7.1),
  "white base" (§3, FR-3) and "white-base price list" (FR-30) are four spellings of one concept. Low
  impact, but §3 claims zero tolerance.
- **Downstream literal drift (outside this document, caused by it).** FR-4's reason strings are PRD-owned
  and correct here as `"pool partial"` and `"class absent from weights file"`. `EXPERIENCE.md` (lines 164,
  614) and `DESIGN.md` (line 1455) still quote `base absent from weights file` — the revision-16 spelling,
  now two revisions stale. This is the second consecutive revision to change that literal without a
  consumer sweep. Worth a standing check rather than a PRD edit.
- **Altitude: two small leaks.** FR-28's final bullet names the producer's `poolCoverage` field, which is
  a field identifier and belongs to `WEIGHTS-FILE-SCHEMA.md`; the sentence works without it ("the
  producer's completeness assertion"). §3's *Tracked List* entry and UJ-5/UJ-6 name `data/tracked.json`
  and `data/config.json` — file paths, which §0 excludes and which this repository has already renamed
  once. The journeys need "a committed file he edits", not the path.
- **FR-33 under-claims its journeys.** §4.10's description realises UJ-1 and UJ-6; FR-33, its only FR,
  says "Realises UJ-1." UJ-6's league reset depends on runtime loading for its "refills over the
  following day" beat. One-word fix.
