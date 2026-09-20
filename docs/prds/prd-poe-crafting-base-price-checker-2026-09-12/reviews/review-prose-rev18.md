---
title: "Prose and structure review — prd.md revision 18 / addendum.md revision 7"
status: review
created: 2026-09-20
scope: passages changed in the working tree against the committed revision 14 / revision 6
---

# Prose review of the revision 18 changes

Method: `git diff` on `prd.md` and `addendum.md` against HEAD (prd.md rev 14, addendum rev 6), so the diff spans revisions 15–18. Findings are restricted to the changed passages and to unchanged sentences whose meaning the changed passages broke. Long sentences, em-dashes and semicolons are the document's voice and are not findings.

Verdict: the mechanical noun swap is clean — no article, agreement or doubling damage survives it, and no `Item Category` / `Base Type` residue is left in `prd.md` where the crafted branch is meant. Two substantive findings: one factual contradiction inside the new addendum section, and one unchanged requirement whose meaning depended on the old noun being a trade-site filter. The rest are local.

---

## H1 — `addendum.md` *Revision 18 rationale* → *What did not move* credits the band withdrawal to the wrong revision

> "FR-4's coverage bands stay withdrawn. **Revision 14 removed them** because a threshold over dozens of items measures the scraper's progress rather than how much product exists…"

Two sections above it say otherwise, both added by this same revision:

- *BQ-3 — The unmeasured gate*: "**What landed after the crafted branch moved off the Base Type (`prd.md` revision 17, refined at revision 18).** The bands are **withdrawn**."
- *Revision 17 rationale* → "Why FR-4's coverage bands were withdrawn rather than re-fitted".

The committed `prd.md` revision 14 still carries the three-band table and the `~20` assumption; the diff removes them. So "Revision 14" is false on the `prd.md` reading. On the spine reading it is also wrong: the only spine revision 14 fact recorded in this addendum is OQ-5 / recipe distribution, not the bands. Fix: "Revision 17 removed them", and if the spine also withdrew them name that revision separately. Severity: **high** — it is a dated attribution in the document whose job is to be the dated record, and it contradicts its own neighbours.

## H2 — FR-21's "the search is built from the Tracked Entry alone" no longer holds at class altitude

FR-21's consequence is unchanged apart from capitalisation:

> "- The search is built from the Tracked Entry alone (AD-16; `IMPLEMENTATION-NOTES.md` §5.2)."

That sentence was true while the crafted unit was the Item Category, because — as the new addendum states — `categoryId` **is** the trade site's own word and goes straight into the search. It is not true of the Item Class: the addendum's *Why per-class pricing turned out to cost nothing* says plainly that "the trade site does not accept a class name as a filter", and that a class is reached only by a **defence-signature** filter derived from knowing which defences the class's bases carry (or, for `jewel`, by `query.type` or by the pool itself). None of that is in the Tracked Entry; it is knowledge about the class held elsewhere.

This is exactly the failure mode the brief names: the old noun carried "how the trade site sorts items" and the new one does not. As written, a builder reading FR-21 alone will look for a class filter that does not exist. The minimum fix is a qualifier that the entry names the search's *subject* while the filter that isolates the class is the architecture's (cite the decision that closes OQ-25), or a matching consequence under FR-1/FR-21 stating that a class is reached by a discriminating filter rather than by name. Severity: **high**, and it is a meaning break rather than a style point.

## M1 — SM-C2 still counts "a second recipe" as a budget consumer, which the revision made false

> "**SM-C2: Refresh frequency.** A faster refresh spends budget that retries, currency rates **and a second recipe** need…"

Unchanged, but §7.2's "A second Craft Recipe" deferral is gone and FR-26 now ships two. The addendum's own note under *Recipe Count* says the opposite of SM-C2: "the budget objection does not carry over, because ranking happens in the browser over one synced Dataset and **a second recipe consumes no additional requests** (AD-4, AD-12)." The list item is now a stale cost centre. Either drop the clause or narrow it to the second recipe's *currency rates*, which is the only part that still spends requests. Severity: **medium**.

## M2 — §10 no longer lists the open question this revision turns on

§10's preamble: "Spine-owned questions are stated in full in `ARCHITECTURE-SPINE.md` *Open Questions* and are listed here by id and owner, never restated." The spine-owned list carries OQ-12, OQ-19, OQ-20, OQ-21. The new addendum sections say OQ-23 is still live ("that is a question for the spine revision closing OQ-23") and that OQ-25's residual `jewel` choice "is the spine's". Neither id appears anywhere in `prd.md`. A reader of the governing document therefore cannot see that the altitude that revision 18 just fixed rests on a question still open at the spine. If both are in fact closed by the spine, this is nothing; if not, they belong in §10's spine-owned list by id and owner, like the other four. Severity: **medium**, contingent on the spine's state.

## M3 — §3 *Tracked Entry*: "either of which may be absent" has three candidate antecedents

> "a **crafted** entry names an Item Class, a prefix Modifier Reference and a suffix Modifier Reference, either of which may be absent;"

The relative clause trails a three-item list, so *which* can be read as reaching back to the Item Class — precisely the reading the next sentence works to forbid ("told apart by **what the entry names**"). "…a prefix Modifier Reference and a suffix Modifier Reference, either affix being optional" or "…of which either may be absent" removes the ambiguity without touching the sense. Severity: **medium** for a glossary entry that the rest of the document is required to use verbatim.

## M4 — FR-1's new second consequence contains an incoherent image

> "A class is valued against its own bases alone, so a class the player would never craft on **cannot pull a class he would toward it, in either direction**."

*Pull toward* is directional; *in either direction* then contradicts it. The intended claim is that an off-class base can move the figure neither up nor down. Compare the document's established economy in the same bullet list — "not zero, nothing" (FR-1), "never as an age, a blank or a placeholder" (FR-12). Suggested: "…so a class the player would never craft on cannot move the figure for a class he would, in either direction." Severity: **medium**; it is newly written prose in the highest-traffic requirement in the document.

## L1 — §3 *Item Class* is the document's wordiest glossary entry, and part of it restates itself

Standard, three lines above it: "**Base Type** — a specific item base in PoE2, identified by the trade API's own id and never re-encoded (AD-5)." One sentence, one citation, one identity fact.

The new entry runs four sentences plus a two-sentence `[ASSUMPTION]`, and sentences two and three make one point twice: "A modifier pool belongs to a class, so the class is the level at which a Combination is curated, priced and valued" already establishes the altitude that "It is the finest unit the crafted branch values: a class holds several Base Types, and the branch does not descend to them" then re-establishes. The naming sentence ("The view names a class by its own name — *Bow* — and never prefixes it with the word *class*") is a view treatment sitting in the glossary; it is marked *(PRD-owned; treatment in `EXPERIENCE.md`)*, so it is defensible, but it is the third distinct job in one entry. Severity: **low** — tighten to the altitude sentence plus the naming sentence plus the tag.

## L2 — §3 *Item Class* never says what identifies a class, while *Base Type* does

*Base Type* is pinned to "the trade API's own id and never re-encoded". The new *Item Class* entry gives no identity source at all, and the addendum records why: `className` is the weights producer's word, `categoryId` is the trade site's, and which one keys the unit "is handed to the spine in `reply-rev18-class-altitude.md`". That is a legitimate deferral, but §3 opens with "Downstream readers and workflows use these terms exactly", and the one term the crafted branch is built on is the one with no stated identity. A half-line — that the unit's identifier is the spine's to key, cited to the decision — would close the asymmetry without importing mechanism. Severity: **low**.

## L3 — §3 *Combination*: "the degenerate Combination of an uncrafted base" is circular

Old: "A Raw Base describes the degenerate Combination **of no affixes**". New: "…the degenerate Combination **of an uncrafted base**". Since a Raw Base is defined one line above as "an uncrafted white base at item level 82", the new phrasing defines the degenerate case by repeating the subject. The change was presumably made because a crafted entry may now also have an affix absent, but "of no affixes" was the precise half of that distinction; "of the base with neither affix" keeps the precision without colliding. Severity: **low**.

## L4 — FR-3: "The rest of the document cites this statement."

A bare meta-sentence in the middle of a testable-consequence bullet. Nothing else in §4 addresses the document's own citation graph; the convention for that is §Conventions and the *(PRD-owned)* marker. It is not wrong, but it is the only sentence of its kind in the FR bodies and it is not testable, which is what the bullet list promises. Consider moving the claim to the §Conventions paragraph or dropping it, since the citations themselves already point here. Severity: **low**.

## L5 — addendum, *Why per-class pricing turned out to cost nothing*: the `jewel` paragraph changes budget units mid-argument

The paragraph above establishes the unit: "The crafted branch therefore still spends **one search per tracked entry**." The `jewel` paragraph then closes with "both **at one search per class**". Those are different denominators — a class carries many tracked entries — and read together the second looks like a cheaper, different guarantee rather than the same one. If the point is that neither jewel option costs anything extra, say that in the established unit: "both still at one search per tracked entry". Severity: **low**, but it is the sentence that closes the budget argument, so the slip is load-bearing.

## L6 — addendum, "It is not a residue"

> "`jewel` is the one fan-out category the defence signature cannot reach, its 8 classes carrying no defences. **It is not a residue**: the player closed it two ways…"

*Residue* is doing metaphorical work the surrounding prose does not; the section's register elsewhere is concrete ("the change is free at the budget", "the contradictory entry cannot be authored"). "It is not an open hole" or simply "It is closed:" states the same thing in the document's voice. Severity: **low**, stylistic-adjacent — listed only because the word is newly introduced and has no antecedent use in either document.

## L7 — addendum header note mixes two revision series in one sequence

> "They are superseded by everything from contract `5.0.0` and spine revision 10 onward. Revision 10 withdrew value cells… **later revisions moved more of it**, up to `prd.md` revision 18's move of the crafted branch to class altitude."

"Revision 10" here is the spine's, "revision 18" is the PRD's, and "later revisions" belongs to neither explicitly. Every other revision reference in the addendum is qualified (`prd.md` revision 13, spine rev 14, spine rev 3/4). Qualify these two as well. Severity: **low**.

---

## Checks that came back clean

- **Article and agreement after the swap.** Every occurrence takes *an Item Class* / *a class*; no *a Item*, no doubled words, no singular/plural mismatch introduced. `Chase Combination`'s shift from "that contributes" to "that contribute" is correct with the new plural antecedent.
- **Residue.** No `Item Category`, `category` or `categoryId` remains in `prd.md`; the addendum's uses are all inside sections explicitly framed as historical.
- **Reason strings.** `"class absent from weights file"` in FR-4 matches the addendum's account of why the enum kept two members, and FR-4's predicate was rewritten to match ("for which the Weights File publishes no pool at all"), so string and predicate no longer disagree.
- **Withdrawn bands.** FR-4's table, the `~20` note and its §11 entry are all gone together; §7.2 and §7.3 were updated in step ("measured and reported, never gated", "The figure informs the release judgement; no threshold and no layout binds to it"). No orphan band reference survives in `prd.md`.
- **Assumptions index.** The one added tag is indexed in §11, first, in document order, with text matching the inline tag verbatim.
- **Terms defined but no longer used.** `Source Modifier` was replaced by "game modifier" in FR-16 and is not a §3 term, so nothing is stranded; every other §3 term still has at least one use.
- **Retired OQ-5.** Removed from §10 and recorded in the addendum's closed-questions register with its closing revision, per the document's own convention.
