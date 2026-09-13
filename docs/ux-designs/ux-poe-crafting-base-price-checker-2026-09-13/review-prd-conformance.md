# PRD Conformance Review — UX Spines

- **Lens:** PRD conformance (memlog 54)
- **Under review:** `DESIGN.md`, `EXPERIENCE.md` (rev 2026-09-13, draft)
- **Authority on deliberate departures:** `.memlog.md`
- **Source of truth:** `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md` (rev 8) + `addendum.md` (rev 5)
- **Date:** 2026-09-13

---

## Verdict

The spines are unusually faithful to the PRD: every numeric constraint the PRD
fixes is honoured or deliberately overridden (top 20, at most three Chase
Combinations, 100 ms, 0.25 Divine cold start, item level 82, the four-state
Price State enum with its three verbatim `not-yet-synced` reasons, *never
attempted*, the two Unrankable reason strings, the ≥80% footer treatment), FR-13's
forbidden words appear nowhere in any specified copy, FR-9's and FR-10's
distinctions all carry a non-colour cue, and each of the five known overrides is
recorded in `.memlog.md` and described honestly in the spines. The defects that
remain cluster in one place and share one root cause: **the trust-and-health
layer's "silent when fine" rule was applied to facts the PRD requires to be
visible when things are *not* fine.** FR-25's three health figures — the
pinned-starvation record, the unresolvable count and the tracked-list edit date —
were moved behind a click that starts closed on every load, and the resting strip
is then explicitly forbidden from carrying counts or a mark for any of them, so a
starving pinned set, a dozen patched-out entries and a Tracked List nobody has
touched in a year all produce exactly nothing on the resting page. That
contradicts FR-25's own argument ("a report field that nothing renders is a field
that nobody reads") and FR-18's "unconditionally … the player does not have to
search for the date". Beyond that cluster there is one real behavioural
contradiction (FR-8's expansion is switched off for Raw Bases), one silently
dropped state (FR-30's file-missing world, in which the product *is* the
appendix), and three §3 Glossary discipline violations the spines' own Domain
Vocabulary section forbids elsewhere in the same document. Nothing here
invalidates the direction; all ten findings are local and fixable inside the
existing token and component set.

**Counts.** FR (33): HONOURED 12 · OVERRIDDEN 1 · PARTIAL (gap disclosed in the
spines, not silent) 3 · CONTRADICTED 4 · SILENTLY DROPPED 1 · NOT A VIEW CONCERN
12. NFR (10): HONOURED 5 · NOT A VIEW CONCERN 5. Plus 3 CONTRADICTED findings
against §3 Glossary itself.

A note on **PARTIAL**: used where the spines neither honour nor quietly drop a
requirement, but name it as unsettled in a `[NOTE FOR UX]` and in the Coverage
Self-Check. That is disclosure, not a drop, and it is not reported in Findings.

---

## Requirement-by-requirement

| Req | Status | Note |
|---|---|---|
| FR-1 Rank by threshold-truncated EV | HONOURED | View displays EV order only; EXPERIENCE states the page "computes no ranking term itself (AD-4)". EV always in Divine with the unit written. |
| FR-2 Chase Combinations on collapsed row | HONOURED | Three fixed 168px cells = at most three; threshold-dependent set; empty cells where none clear (state 22). Ordering by `P × price` is core's output, not restated. |
| FR-3 Raw Bases on a separate branch, labelled | HONOURED | Tint + italic name + `RAW BASE · ILVL 82` tag = three cues, no colour-alone. Below-threshold Raw Base truncated out (Component Patterns). |
| FR-4 Surface Unrankable outside the ordering | PARTIAL | ≥80% footer treatment fully specified: count without expanding, reasons verbatim, `absent` as *unknown* never a number. The 50–80% first-class treatment is named as unsettled in both spines. Disclosed, not dropped. |
| FR-5 Bound the list to 20 | HONOURED | Twenty rows; affordance below row 20 names the count; core ranks the full list, view truncates. |
| FR-6 Threshold reorders immediately | HONOURED | Override of UJ-2's drag recorded (memlog 36/37) and labelled in both spines; FR-6 itself satisfied by re-rank on valid parse, ~150ms debounce disclosed as an assumption. |
| FR-7 Remember the threshold between visits | PARTIAL | Threshold + 0.25 cold start honoured. "the view preferences" left undefined and partly contradicted — see **F10**. |
| FR-8 Expand to the full tracked Combination list | **CONTRADICTED** | Honoured for crafted Base Types (every entry, tombstones, price, Price State, sample size, labelled age, below-threshold mark). Switched off for Raw Bases — see **F3**. |
| FR-9 Four Price States distinct, reason on `not-yet-synced` | HONOURED | Glyph + word always; all three reasons verbatim (states 5–7); money slot removes every `0`/blank/em-dash reading; `no-listings` framed as an open question. |
| FR-10 Propagate and display weakest Provenance | HONOURED | Three distinguishable treatments (silence / slate ◈ / ochre ◇ · ?), none colour-alone; `producer.id`, `generatedAt`, `gamePatch` on the trust strip. Column *label* is a synonym — see **F4**. |
| FR-11 Global uniform-prior caveat | HONOURED | Condition stated exactly as FR-11 states it; data-raised, self-lowering, dismiss per session, per-row badge kept regardless. |
| FR-12 Per-row freshness, say which clock | OVERRIDDEN | Sub-48h age suppression, memlog 46 (override) + 47 (cut-off). Spines label it `[OVERRIDE — memlog 46]`, keep *priced Nd ago* / *tried Nd ago* and *never attempted* verbatim, and say the PRD should absorb it. Accurately recorded. |
| FR-13 Asking prices, never realised value | HONOURED | Asking-price line is mandatory, above the list, never dismissible, never shortened. No "sells for" / "worth" in any specified string in either spine. |
| FR-14 Four declared request sources | NOT A VIEW CONCERN | Only the per-source counts reach the view, and they are in the sync report panel. |
| FR-15 Curation Status as schema behaviour | HONOURED | `pruned` tombstones with reasons; `pinned` marked (state 9, treatment disclosed as open). |
| FR-16 Reject an overlapping Tracked List | NOT A VIEW CONCERN | View half is the load-time report (state 28); placement named as unsettled. |
| FR-17 Deterministic Refresh Rotation | PARTIAL | Sync-side. Its one view clause — "`sync`, surfaced by `web`" for the runtime pinned truncation — lands in the closed-by-default panel. See **F1**. |
| FR-18 Surface the Tracked List's age | **CONTRADICTED** | Date is one click down behind a panel closed on every load. See **F2**. |
| FR-19 Bounded resumable Chunk runner | NOT A VIEW CONCERN | — |
| FR-20 One rate-limit-adaptive client | NOT A VIEW CONCERN | — |
| FR-21 Median of cheapest instant-buyout listings | NOT A VIEW CONCERN | Its one view obligation — show the sample size the estimate rested on — is honoured on the combination row (`0 listings found`, `no sample`). |
| FR-22 Item Level Floor from Accepted Tier | NOT A VIEW CONCERN | Curation-side. Raw Base's 82 appears on the row tag. |
| FR-23 Normalise to Divine at the sync boundary | NOT A VIEW CONCERN | The 4dp rule binds persistence. Its display corollary is silently dropped — see **F8**. |
| FR-24 Fail loudly on an unresolvable id | **CONTRADICTED** | Per-entry surfacing in the expansion is honoured (state 4). The count is invisible at rest — see **F1**. |
| FR-25 Publish a structured Sync Report | **CONTRADICTED** | Every field has an on-screen home (good, and memlog 57 fixed a real earlier gap), but "`web` surfaces the presence" is not satisfied at rest — see **F1**. |
| FR-26 Craft Cost in valuation | NOT A VIEW CONCERN | Masthead names the Craft Recipe; single recipe so no selector. Negative-EV formatting disclosed as open (state 22). |
| FR-27 Consume a conformant Weights File | NOT A VIEW CONCERN | View shows `producer.id` / `generatedAt` / `gamePatch` per FR-10. |
| FR-28 Pool-completeness in both directions | NOT A VIEW CONCERN | Consumer treatment (`absent`, Unrankable) surfaces via FR-4/FR-10, honoured. |
| FR-29 Aggregate weights by cell | NOT A VIEW CONCERN | View half is the cross-file load report (state 28), disclosed as unsettled. |
| FR-30 Weights File as a v1 prerequisite | **SILENTLY DROPPED** | The state FR-30 declares — every crafted Base Type Unrankable, "a white-base price list, not the product" — has no treatment, no state-table row and no memlog entry. See **F5**. |
| FR-31 Refuse another league's observations | HONOURED | State 24 + UJ-6: canonical order, `not-yet-synced` / `league-mismatch`, rank numerals suppressed, EV empty not zero, the order declared un-ranked. |
| FR-32 Validate the configured league | NOT A VIEW CONCERN | — |
| FR-33 Fetch eight artifacts as a consistent set | HONOURED | Eight artifacts, single transition (state 23), refusal on schema-invalid (state 27, treatment disclosed as open), cross-file failures reported not refused (state 28). Currency-icon corollary dropped — see **F9**. |
| NFR-1 Zero network in tests | NOT A VIEW CONCERN | — |
| NFR-2 Real captured fixtures | NOT A VIEW CONCERN | — |
| NFR-3 Determinism | NOT A VIEW CONCERN | — |
| NFR-4 Parallel worktrees | NOT A VIEW CONCERN | — |
| NFR-5 One writer per file | HONOURED | No write path from the browser; running foot states where curation happens. |
| NFR-6 Read-time budget < 100 ms | HONOURED | Stated at Interaction Primitives 1: "synchronous, local, under 100ms". |
| NFR-7 Static delivery, zero upkeep | HONOURED | "The page paints before it fetches; both font stacks are system-resident and nothing is downloaded." |
| NFR-8 Schema versioning at every boundary | HONOURED | State 27; refusal screen's appearance disclosed as undesigned. |
| NFR-9 Third-party citizenship | NOT A VIEW CONCERN | — |
| NFR-10 Colour never alone | HONOURED | Reframed as legibility per memlog 15, which memlog 13 licenses; three inks, each always with a glyph *and* a word; Price State, Provenance and Raw Base all carry non-colour cues. Two loose ends noted under **F4** and in *Minor observations*. |
| §3 Glossary — synonym discipline | **CONTRADICTED (×3)** | See **F4**, **F6**, **F7**. |

### The recorded overrides — confirmed, not defects

All five hold up. Each is in `.memlog.md`, each is labelled in the spines, and
none misrepresents what it gave up.

| Override | Memlog | Accurate? |
|---|---|---|
| FR-12 sub-48h age suppression | 46 (`override`) + 47 (`decision`, 48h) | Yes. Spines state the literal departure, preserve the intent in the expansion, and flag `bmad-correct-course`. |
| UJ-2 slider → number input | 36 (`decision`) + 37 (`override`) | Yes. Both spines carry `[OVERRIDE — memlog 36/37]`; FR-6 correctly kept as still binding. |
| Curation tooling out of scope | 22 + 25 (both `decision`) | Yes. Note that 25 *restores* FR-8 in full, so the departure is from UJ-5's narration only, not from any FR. EXPERIENCE says exactly that. |
| Named-protagonist rule | 21 (`override`) | Yes — and it departs from the UX method, not the PRD; the justification is itself §3 discipline. |
| NFR-10 as legibility, not accessibility | 15 (`decision`), on 13 | Yes. The colour rule survives intact; no conformance claim is made anywhere. Accessibility gaps are correctly not defects. |

---

## Findings

Ranked by what the player would experience or misread.

### F1 — HIGH — FR-25, FR-24, FR-17 — the health signals are silent when the list is broken, not only when it is fine

**Requirement.** FR-25: "**`web` surfaces the presence of the pinned-starvation
record**, alongside the tracked-list age (FR-18) and the unresolvable count
(FR-24). Those three figures are what tell a player that his list is not doing
what he thinks it is. A report field that nothing renders is a field that nobody
reads (AD-26)." FR-24: "`core` excludes `unresolvable` entries from valuation.
The view surfaces the existence of those entries." FR-17: the runtime pinned
truncation is owned by "**`sync`**, surfaced by `web`".

**Where the spines fail it.** All three figures live only in
`{components.sync-report-panel}`, which "Opens from the strip", is "Closed by
default on every load; the open state is not persisted" (EXPERIENCE, Component
Patterns; state 31: "This is the state on every load"). The resting strip is then
explicitly barred from carrying any of them: "At rest it obeys silent-when-fine:
those four facts and nothing more — **no counts, no '0 unresolvable'**, no green
tick. A semantic ink appears at rest **only where a headline fact is itself
degraded**" (EXPERIENCE; identically in DESIGN, *Trust strip*). The four headline
facts are enumerated as `producer.id`, `generatedAt`, `gamePatch` and last
synced — none of which is the unresolvable count, the starvation record or the
tracked-list age. So a Chunk that starved its pinned set, twelve entries patched
out by a GGG update, and a Tracked List last edited eleven months ago all render
as a page with nothing on it, indistinguishable from a healthy one. UJ-5 then
depends on the player deciding to click on a day when the page gave him no reason
to.

**Memlog.** 57 records moving the report behind the strip, and 61 records the
panel's contents; both frame the move as *satisfying* FR-18/FR-24/FR-25, and 59
is an assumption that the strip obeys silent-when-fine **at rest**. No entry
records a decision to depart from "surfaces the presence". This is therefore a
contradiction, not an override — and the earlier decision it replaced (26) was
itself found to be a conformance defect at memlog 56, so the direction of travel
was already known.

**What would fix it.** Keep the panel, and let the resting strip break silence
the way every row does: extend "a headline fact is itself degraded" to cover a
non-zero unresolvable count, a present pinned-starvation record, and a
tracked-list edit date past a stated cut-off, each as an existing rust mark with
its glyph and its word. That is consistent with silent-when-fine rather than
against it — "loud when wrong" is the other half of memlog 32 — and it needs no
new ink, no new component and no new region.

### F2 — HIGH — FR-18 — the tracked-list date is required unconditionally and is behind a click

**Requirement.** FR-18: "The Sync Report records the date of the last
tracked-list edit, **and the view shows that date** … **The view shows the date
unconditionally. A Tracked List that runs unattended for months is visible as
such, and the player does not have to search for the date.**" The `[NOTE FOR PM]`
attached to it adds that FR-18 exists so that Risk R-2's gap "prompts a periodic
deliberate review".

**Where the spines fail it.** Both spines carry the phrase "the tracked-list edit
date (FR-18, shown unconditionally)" — but place it inside the sync report panel,
which is closed on every load. "Unconditionally" is satisfied in the sense that
the date is never conditionally hidden *within* the panel; it is not satisfied in
the sense FR-18 means, which is the sentence right after it. A date one click
down is a date the player has to go and search for, and the whole purpose of the
requirement is to reach a player who was not already looking.

This is the sharper half of F1 because FR-18 is the only requirement in the PRD
that uses the word "unconditionally", and the spines quote that word while doing
the opposite.

**What would fix it.** Promote the tracked-list edit date to the resting strip as
a fifth headline fact — it is a property of the Tracked List, exactly the class
of thing the other four are — and leave the rest of the report behind the click.
The strip already has two lines and the date is short.

### F3 — MEDIUM — FR-8 — a Raw Base expansion shows no Tracked Entry at all

**Requirement.** FR-8: "The player expands any ranked Base Type. The player then
sees **all Tracked Entries of that Base Type** with their prices, their Price
States and their ages … Each row shows its Combination, its Price State, its
price in Divine where the entry is priced, **the number of listings that the
estimate rested on**, and its age." §3 is explicit that a Raw Base is not an
exception to this vocabulary: "**Combination** — … A Raw Base describes the
degenerate Combination of no affixes", and "**Raw Base** — a Tracked Entry with
no affixes."

**Where the spines fail it.** EXPERIENCE, Component Patterns,
`{components.raw-base-row}`: "Expanding it shows **no Combination list** — it has
no tracked Combinations; the panel states that instead." A Raw Base *is* a
Tracked Entry and *does* have a Combination — the degenerate one — and the PRD
prices it like any other (FR-21 gives it a `normal`-rarity search and a listing
sample; FR-3 truncates it against the threshold like any other outcome).

**What the player loses.** For every Raw Base row: the Price State in words, the
listing sample size, the exact age and which clock that age reads. Under the
recorded FR-12 override, ages below 48h are suppressed on the ranked row and
"preserved in the expansion" — but for a Raw Base there is no expansion to
preserve them in, so the override's own mitigation does not reach this branch.
Nor is there a home for a Raw Base that is `no-listings`, `not-yet-synced` or
`unresolvable`: states 1–7 all site those on `{components.combination-row}`,
which a Raw Base never renders. No memlog entry decides any of this.

**What would fix it.** The Raw Base expansion shows one `combination-row` for the
degenerate Combination, with the same Price State, sample size and labelled ages
as any other entry, plus the existing note that the row is ranked at its own
asking price. For a Base Type carrying both branches, state 17's "appears in both
places" should also say which expansion holds the Raw Base entry.

### F4 — MEDIUM — §3 Glossary / FR-10 — the Provenance column is labelled "Weight" on screen

**Requirement.** §3 preamble: "Downstream readers and workflows use these terms
exactly. **A synonym introduced anywhere is a discipline violation.**" §3 names
the concept **Provenance**, and names a different concept **Modifier Weight** —
"the mass that one tier of one modifier contributes to one Value Cell".
EXPERIENCE's own Domain Vocabulary lists *Provenance* among the terms that
"appear on screen verbatim", and lists *Modifier Weight* among the terms that
"**must not appear on the page**".

**Where the spines fail it.** DESIGN's column budget names the fourth column
"**Weight (Provenance)**" and the rendered column header is therefore `WEIGHT`;
DESIGN's key block is specified as three columns: "*Silence means healthy*,
***Weight marks***, *Age marks*"; the Layout section repeats "The **Weight** and
Age columns are narrow on purpose", and the Do/Don't table repeats "Leave the
**Weight** and Age cells empty on a healthy row". EXPERIENCE's Epistemics section
uses the same word ("A row whose **weight** is `measured`"). So the one place the
player is *taught* how to read the page — the key block — teaches him a word the
Glossary does not contain, for a concept the Glossary names, and that word
collides with a back-end term the spine itself bans from the page.

**Why it matters beyond tidiness.** "Weight: prior only" reads naturally as a
statement about a modifier's spawn weight rather than about how the figure was
sourced. The player's correct inference from `◇ prior only` is *nobody measured
this*; the column header nudges him toward *this modifier is rare*, which is a
different claim about a different quantity.

**What would fix it.** Label the column and the key-block group **Provenance**
(EXPERIENCE already requires that term verbatim on screen), or record an explicit
override with the user's ruling.

### F5 — MEDIUM — FR-30 — no state exists for the world the PRD says v1 starts in

**Requirement.** FR-30: "Until a conforming file exists, **every crafted Base
Type is Unrankable** (FR-4). That is the honest outcome rather than a degradation
to design around … **What survives a missing file is therefore a white-base price
list, not the product.**" §7.3 confirms this is a live release dependency owned
outside the repository, and that "`partial` is a recurring state, not a
transitional one — **freshly scraped classes may therefore go Unrankable
immediately after a patch**".

**Where the spines fail it.** EXPERIENCE enumerates 32 states, including a cold
load, an honest-empty league reset, a partially refreshed dataset, a schema-
invalid refusal and a stale Weights File. There is no state for *the Weights File
is absent or wholly `partial`*. In that state the ranked list holds only Raw Base
rows and `{components.unrankable-appendix}` holds the entire crafted Tracked
List — while the spines pin the appendix to the foot as a footer treatment,
forbid truncating it ("Forbidden as overflow escape hatches: … truncating
`{components.unrankable-appendix}`"), and simultaneously require that "**nothing
the player has not clicked may push the page past 1920px**". Those three rules
cannot all hold once the appendix is long, which it is by construction in this
state. No memlog entry decides any of it.

This overlaps FR-4's 50–80% band, but is not the same item: that band is
disclosed as unsettled in both spines and in the Coverage Self-Check, whereas the
file-missing state is not mentioned anywhere. It is also the more likely of the
two on day one.

**What would fix it.** Add a state: what the page says when the ranked list is
Raw Bases only, and how a long appendix behaves against the no-scroll rule
(almost certainly: the appendix is itself the surface, and the resting-state rule
yields to it). Settling this also gives the 50–80% first-class treatment most of
its answer.

### F6 — MEDIUM-LOW — §3 Glossary — `div` and `ILVL` are introduced abbreviations

**Requirement.** §3: "**Divine** — the single currency denomination that crosses
every boundary"; "**Item Level Floor** — the minimum item level a Tracked Entry's
search accepts". EXPERIENCE lists both, verbatim, as player-facing terms: "These
terms appear on screen verbatim, spelled exactly as below … Divine · … · Item
Level Floor."

**Where the spines fail it.** DESIGN, *Ranked row*: "The EV cell carries the
figure in serif with a sans **`div` suffix** … EV is always in Divine and the
unit is always written" — the unit written is `div`, not `Divine`. The threshold
control repeats it: "a small serif `div` suffix". DESIGN, *Raw Base row*: the tag
reads `RAW BASE · **ILVL 82**`. Both are abbreviations the Glossary does not
license, and the second is an abbreviation of a term EXPERIENCE has just declared
verbatim-only. The sentence "the unit is always written" is itself inaccurate
about its own spec.

**What would fix it.** Either spell the terms, or record a deliberate exception
for the two space-constrained slots (the 84px EV column and the Raw Base tag) —
the constraint is real and a ruling here is cheap, but it has to be a ruling.

### F7 — MEDIUM-LOW — §3 Glossary — `Chunk` is banned from the page and printed on it; six §3 terms are unclassified

**Requirement.** §3 defines *Chunk*, *Sync Report*, *Dataset*, *Price
Observation*, *Trade Catalogue*, *Accepted Tier* and *`lastAttemptedAt`* as
domain nouns under the same synonym discipline as every other term.

**Where the spines fail it.** EXPERIENCE's Domain Vocabulary lists *Chunk* under
"**Back-end only — must not appear on the page**". Both spines then specify the
sync report panel as carrying "**entries not reached in this Chunk**" — DESIGN,
*Trust strip → Expanded*, and EXPERIENCE, Component Patterns and Epistemics.
Either that phrase is screen copy, in which case the spine violates its own rule,
or it is a description of a field whose screen wording is unspecified, in which
case a builder must invent one for a figure FR-25 requires. The escape clause
("These may appear inside a validation message, where the reader is the person
fixing the file") does not cover a report panel read by the player.

Separately, six §3 terms appear in neither the player-facing nor the back-end-only
list: **Sync Report** (which is on screen — the affordance reads `+ the full sync
report`), **Dataset**, **Price Observation**, **Trade Catalogue**, **Accepted
Tier** and **`lastAttemptedAt`**. The Domain Vocabulary presents itself as a
complete routing of §3, and it is not one.

**What would fix it.** Route the six explicitly, and settle the Chunk phrase —
either license *Chunk* as player-facing (defensible: FR-25's field name is
literally "entries not reached in this Chunk", and the running foot already talks
about sync) or fix the panel's wording.

### F8 — LOW — FR-23 / FR-1 — no display precision for any money figure, and no rule for a figure that rounds to zero

**Requirement.** FR-23: "`sync` rounds persisted Divine prices to **4 decimal
places**, once, and `core` never re-rounds a persisted price." Its rationale is
explicitly about what happens when a small figure is coarsened: "On a 2-decimal
grid a cheap orb therefore rounds toward `0.00`, the Craft Cost term collapses,
and **FR-1's subtraction becomes a silent no-op that inflates every EV in the
product**."

**Where the spines fail it.** Neither spine states how many decimal places an EV,
a price or the threshold shows. `.working/extract-prd.md` raised the question
directly — open item 8, "How is EV formatted (decimal places shown, given 4dp
persisted — FR-23)" — and neither spine nor `.memlog.md` answers it, while the
sibling half of that same extraction item (negative EV formatting) *was* carried
forward as a `[NOTE FOR UX]` at state 22. The omission is therefore a drop from a
list the run had already made, not an oversight of an unseen requirement.

**Why it matters.** The money-slot rule exists so that no missing figure ever
reads as a quantity of zero ("Never `0`, never `0.00%`, never blank, never an em
dash"). A *present* EV of 0.0003 Divine displayed on a 2dp grid renders `0.00` —
the exact reading the money slot was built to prevent, arriving through the
number rather than through the gap.

**What would fix it.** State the display precision for EV, price and threshold,
and state what the page does with a non-zero figure that rounds to zero at that
precision (a floor such as `< 0.01` reads honestly and costs no width).

### F9 — LOW — FR-33 — one spine promises currency icons, the other defines none

**Requirement.** FR-33: "The two catalogue files are what let the view render a
`statId` as its human text and **a currency as its icon** without a runtime call
to pathofexile.com, which is forbidden (AD-15, AD-25)."

**Where the spines fail it.** EXPERIENCE repeats the claim in the Accessibility
Floor — "a `statId` renders as human text and **a currency as an icon** without a
runtime call (FR-33)" — while DESIGN defines no icon token, no icon component and
no icon anywhere in the page's vertical order, and specifies every money figure
as a numeral plus a text suffix. `catalogue/static.json` is fetched (one of the
eight) with no stated consumer. Low severity because FR-23 normalises everything
to one denomination, so an icon has little to do; but the spines disagree with
each other in writing, and a builder has to pick.

**What would fix it.** One line either way: state that v1 renders the
denomination as text and that `catalogue/static.json` is fetched for the stat
text path only, or specify the icon.

### F10 — LOW — FR-7 — "the view preferences" is never defined, and one piece of view state is explicitly not persisted

**Requirement.** FR-7: "**The Payout Threshold and the view preferences** survive
a page reload … The tool persists these values only in the viewer's own browser
storage."

**Where the spines fail it.** EXPERIENCE persists the threshold and then says
"Which other 'view preferences' persist is unstated" — accurate disclosure — but
also fixes two of them in the other direction without a recorded decision: the
sync report panel is "Closed by default on every load; the open state is **not**
persisted" (state 31: "This is the state on every load"), and the tombstone
toggle "resets when the panel closes". Whether an open panel counts as a "view
preference" is genuinely arguable, and FR-11's explicit per-session banner
dismissal is a precedent for not persisting session state — which is why this is
low and not medium. But the spines settle it silently in one direction while
calling it unstated.

**What would fix it.** Name the set FR-7 covers — threshold only, on this
reading — and say so, so a builder does not persist panel state to satisfy FR-7
and thereby break state 31.

---

## Minor observations (not findings)

- **NFR-10, two loose ends.** The open-panel indicator is "the row holds
  `{colors.paper-inset}`" — a tint with no non-colour companion. It is adjacency-
  evident (the panel is directly below it), so it is not a conformance defect, but
  it is the one product-meaningful state carried by hue alone. Separately, state
  9's `pinned` mark has no treatment and is correctly disclosed as open.
- **FR-9 / state 4 copy** shows the player a raw field name: "the statId is gone
  from the trade API — a patch did this". `statId` is not on either vocabulary
  list, and the Accessibility Floor says "Raw ids on the page are a legibility
  failure". Worth a pass over microcopy that names fields.
- **FR-2's chase ordering** (by `P × price`, not raw price) is a core output and
  is correctly not restated — but nothing in either spine says the three cells are
  rendered in the order `core` supplies them. One clause would close it.
- **State 24** assigns every Base Type reason `league-mismatch` in the honest-empty
  state; a newly added entry would carry `never-synced` instead. Cosmetic.
- **memlog labelling.** Entries 22 and 25 are typed `decision` but are referenced
  in EXPERIENCE as `[OVERRIDE — memlog 22/25]`. Harmless — and since 25 restores
  FR-8 in full, there is no PRD departure there to record.

---

## Method

Every FR-1…FR-33 and NFR-1…NFR-10 was walked against both spines, including each
FR's "Consequences (testable)" list rather than its headline alone. Departures
were checked against `.memlog.md` before being called defects; the five recorded
overrides named in the review brief were verified present, accurately typed and
honestly described, and are not reported as defects. Accessibility gaps are out of
scope per memlog 13 and are not reported; NFR-10's colour rule was checked as a
legibility rule per memlog 15 and holds. The PRD's verbatim strings were checked
literally: the `not-yet-synced` reason enum, the two Unrankable reason strings,
"never attempted", and FR-13's two forbidden phrases across every piece of
specified copy in both documents.
