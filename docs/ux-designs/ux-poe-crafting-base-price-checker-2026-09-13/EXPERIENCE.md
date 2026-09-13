---
title: PoE2 Crafting Base Price Checker — Experience
status: final
created: 2026-09-13
updated: 2026-09-13
sources:
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/addendum.md
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/brief.md
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/addendum.md
  - docs/sprint-change-proposal-2026-09-13.md
peer-contract: DESIGN.md — the visual identity and token source. This document
  references its tokens by name and never restates their values.
---

# PoE2 Crafting Base Price Checker — Experience Spine

## Foundation

One page, read-only, for one player. There is no second route, no *internal*
navigation, no account and no write path from the browser. The page fetches
eight artifacts, ranks against them locally, and then sits still on a second
monitor for the length of a play session.

**One outbound link is the sole exception.** `{components.trade-link}` opens
the trade site's own search for a Combination, in a new tab, where the entry
carries a stored `lastSearchId` from a search run in the active league. It
leaves the page. It adds no route, writes nothing, and changes nothing the page
shows. The player can close the tab and return to the exact page he left.

**This is not the runtime call FR-33 forbids.** FR-33 (AD-15, AD-25) bars the
page itself from calling pathofexile.com at runtime — the page reads the
catalogue files instead, so a `statId` renders as text without that call. A
`{components.trade-link}` click is a different thing: the player's own click
tells the browser to open a new tab, and the page makes no request of its own
either before or after. **The PRD now states this distinction itself** (FR-33,
AD-15): the prohibition binds a request the page makes on its own behalf and
depends on for rendering, and not a navigation the player chooses. **The
consequence runs the other way too.** Because `web` may not make the call,
`web` cannot mint a trade-site search of its own, so the link can only ever
point at a search the syncer already issued and stored.

**Substrate: Mantine v9 (`@mantine/core` + `@mantine/hooks` 9.6.1)**
`[ASSUMPTION — memlog 8]`. Mantine's component *behaviour*, layout primitives
and CSS-variable theming are inherited. Only the behavioural deltas from
Mantine's defaults are recorded here:

| Mantine default | Delta |
|---|---|
| `Collapse` animates height on open | Every expansion opens **in place, instantly** — no height animation. Memlog 14 says animations are fast. The fastest transition on a 28px row is none. |
| `Accordion` ships chevrons, control padding and its own hover background | All three stripped, per `DESIGN.md`'s theme deltas. An affordance here is sepia text and a sign, with no button chrome. |
| `NumberInput` is controlled and fires `onChange` on **every keystroke** | The keystroke behaviour is kept — it is what FR-6 needs. The delta is twofold. Re-ranking is debounced ~150ms behind the keystroke `[ASSUMPTION — memlog 38]`. And the input takes the chrome and constraints `{components.payout-threshold}` declares: no field, no box, the figure itself is the input, with `min`, `max`, `step`, `decimalScale` and `clampBehavior` tokenised there. |
| `theme.primaryColor` defaults to blue | Repointed off blue, per `DESIGN.md`. Blue would tint carets, selections and every input focus on a page that contains no blue. |
| `theme.lineHeights` and `theme.headings` supply their own ramps | Both **replaced, not extended**. Every type role declares its own `lineHeight`. The 28px row, the 1920px fit and `{spacing.frame-slack}` are all computed against those declared values. |
| Font sizes resolved through `--mantine-scale`'s rem conversion | Sizes are passed as literal px, so the 9.5 / 10.5 / 11.5 / 12.5 / 13.5px roles cannot be rounded away. |
| `Skeleton` animated shimmer | The load state is skeleton rows in the final layout (memlog 50). Whether they shimmer is a `DESIGN.md` gap, not a behavioural one. |
| Focus ring and keyboard traversal | Out of scope — see Accessibility Floor. |

Two rules that are not Mantine deltas but read like them, recorded so nobody
adds them back: there is **no virtualisation and no windowing** — twenty rows
paint at once, and a grown list paints in full — and there are **no tooltips**,
on truncated text or anywhere else. Truncation is resolved one click down.

`DESIGN.md` is the visual identity reference. This document is the behaviour.

**Both spines win on conflict with any mock.** This rule holds for the two
mockups rendered from the final spines —
[`mockups/key-hero-resting.html`](mockups/key-hero-resting.html) and
[`mockups/key-expanded-states.html`](mockups/key-expanded-states.html) — and for
the superseded exploratory directions in `.working/`. The mockups show one
dataset in one state. Where a mockup and a spine disagree, the spine is correct
and the mockup is out of date.

Open items are tagged `[NOTE FOR UX]` in place through the document.

## Information Architecture

One surface. Everything below is a region of it, in fixed vertical order.

| Region | Reached from | Purpose |
|---|---|---|
| Masthead + `{components.payout-threshold}` | Always visible | Names the league and the Craft Recipe. Holds the one control on the page |
| `{components.trust-strip}` | Always visible | What the ranking rests on, as five plain facts: Weights File producer, `generatedAt`, `gamePatch`, last synced, tracked-list edit date (FR-10, FR-18). Raises a rust line when something is broken. The whole strip is a click target |
| `{components.sync-report-panel}` | Click `{components.trust-strip}` | The full Sync Report, opened in place beneath the strip (FR-24, FR-25, FR-4) |
| `{components.asking-price-line}` | Always visible | FR-13's framing, above the list, never below the fold |
| `{components.uniform-prior-banner}` | Raised by data condition | The whole-ranking warning (FR-11) |
| `{components.column-header}` + twenty `{components.ranked-row}` | Always visible | The product. UJ-1, UJ-2, UJ-4 |
| `{components.raw-base-row}` | Interleaved in the same list | Raw Bases, ranked at their own asking price (FR-3) |
| `{components.expand-affordance}` (list) | Below row 20 | Reads the remainder of the ranked list (FR-5) |
| `{components.expansion-panel}` | Click a ranked row | Every Tracked Entry on that Base Type. UJ-3, UJ-5 |
| `{components.tombstone-band}` | `▸ N pruned` inside the expansion | `pruned` tombstones with their reasons (FR-8, FR-15) |
| `{components.unrankable-appendix}` | Foot of the frame | Base Types kept out of the ordering, with their reason and count (FR-4) |
| `{components.key-block}` | Above the foot | How to read the page — required, see Epistemics |
| `{components.running-foot}` | Foot | What is read-only, and where curation actually happens |

Expansion opens **in place**, pushing the regions below it down inside the
frame. It is not a modal, not a drawer and not a second route. There is no
navigation to lose your place in.

Two screens sit outside that order and replace the page entirely rather than
joining it: `{components.refusal-screen}` and
`{components.fetch-failure-screen}`. When either is up, none of the regions
above render — the page shows nothing rather than a partial set.

→ Composition reference, both rendered from the final spines:
[`mockups/key-hero-resting.html`](mockups/key-hero-resting.html) shows the
resting order at 1060x1920, 1:1.
[`mockups/key-expanded-states.html`](mockups/key-expanded-states.html) shows
what the two expandable regions do to that order —
`{components.expansion-panel}` open below its row, and
`{components.sync-report-panel}` open below the strip. The exploratory
directions in `.working/` are superseded and are kept only as the record of how
the register was chosen.

`[NOTE FOR UX]` FR-4's 50–80% coverage band requires
`{components.unrankable-appendix}` to become a first-class surface rather than a
foot region. The IA above describes the ≥80% treatment only. Two things are
unsettled: what the first-class arrangement is, and whether the page reads the
published coverage fraction at runtime and switches band live or takes the band
as a build-time layout choice. Coverage is re-measured on every weights
regeneration, so this will recur.

## Domain Vocabulary

The PRD's §3 Glossary is binding and states that **a synonym introduced
anywhere is a discipline violation**. These terms appear on screen verbatim,
spelled exactly as below. No UI copy may substitute a friendlier word.

**Player-facing terms, used verbatim:** Base Type · Raw Base · Combination ·
Chase Combination · Tracked Entry · Tracked List · Curation Status · Price
State · Payout Threshold · Craft Recipe · Craft Cost · Expected Value (EV) ·
Provenance · Unrankable · Divine · `gamePatch` · Weights File · Item Level
Floor · Sync Report.

*Sync Report* is player-facing: it names what `{components.sync-report-panel}`
shows, and the affordance that opens it says so.

***Accepted Tier* moved groups** `[decision — memlog 139]`. It was listed here
as player-facing. It is now the fifth member of the group below: after memlog
134 its substance is on **every** row, as `T1`, and after memlog 139 the page
explains the vocabulary nowhere, so the two words themselves are never printed.

**Never printed as a word, but the concept is on screen:** *Dataset*, *Price
Observation*, *Trade Catalogue*, `lastAttemptedAt` and *Accepted Tier*. These
five are real Glossary terms whose *substance* the page shows and whose *name*
it does not:
the Dataset is simply what the page renders. A Price Observation appears as a
price with a sample size and an age. The Trade Catalogue is why a `statId`
reads as human text. `lastAttemptedAt` is spoken as *tried Nh ago* — FR-12
requires the page to label the **kind** of age, not the field that holds it. And
an Accepted Tier is spoken as the bare `T1` that opens every Combination.
Printing any of the five as a bare noun would be jargon without a job.

**Enum values shown as written, never translated.** Four sets:

- Price State — `priced`, `no-listings`, `not-yet-synced`, `unresolvable`.
- `not-yet-synced` reason — `never-synced`, `league-mismatch`,
  `no-exchange-rate`.
- Curation Status — `active`, `pinned`, `pruned`.
- Provenance — `measured`, `modelled-split`, `uniform-prior`, `absent`.

**Reason strings shown verbatim from FR-4:** `pool partial`, `base absent from
weights file`.

**Back-end only — must not appear on the page:** Modifier Reference, Stat Line,
Source Modifier, Eligible Pool, Value Cell, Cohort, Modifier Weight, Chunk,
Workload, Refresh Rotation, `cohortTotals`, `statLineCounts`,
`sourceModifierId`, `poolCoverage`, `tierLabel`. These may appear inside a
validation message, where the reader is the person fixing the file.
`tierLabel` is on this list for a second reason as well: the page must never
**read** it either. The tier it prints comes from the curator's declaration, not
from the Weights File `[decision — memlog 135]`.

**Four wordings an earlier draft had wrong. Do not reintroduce them**
`[decision — memlog 84]`:

| Write this | Never this | Why |
|---|---|---|
| The fourth column header and the key block's middle group read **Provenance** | "Weight" | A synonym for one Glossary term and a collision with *Modifier Weight*, which is banned from the page. It also misleads: `◇ prior only` under a `WEIGHT` header reads as a claim about how rarely a modifier rolls, not about where the figure came from |
| The EV column header reads **`EV (Divine)`** and the cell holds the figure alone | `div` after every figure | *Divine* is verbatim-only, so the page spells it or states it once in a header. Twenty repetitions of an invariant unit is noise in an 84px column |
| The Raw Base tag reads **`RAW BASE`**, with the item level spelled out in the row's note | `ILVL 82` | *Item Level Floor* is verbatim-only. `ILVL` is an abbreviation the Glossary does not license |
| **entries not reached in the last sync pass** | "in this Chunk" | *Chunk* is back-end-only, and this panel is read by the player, not by whoever is fixing a file |

**The trust strip's five labels, verbatim.** On-screen
wording is binding here as everywhere, so these are the strings and not a
description of them:

| Line | Lead | Fields |
|---|---|---|
| 1 | `Weights File` | `producer` · `generatedAt` · `gamePatch` |
| 2 | `Last synced` | `Tracked List last edited` |

Line one prints its three field names as FR-10 and the Glossary spell them —
they identify a file, and this strip is the one place on the page where that
spelling is licensed. Line two is plain English using *Tracked List* verbatim.
Fields on a line are separated by `|`.

**The masthead eyebrow** reads `League {activeLeague} · one perfect transmute +
one perfect augment` — the Craft Recipe printed as its composition, worded as
the Glossary words it. `[ASSUMPTION — memlog 107]` `[NOTE FOR UX]` **The Craft
Recipe has no canonical display name.** The Glossary defines it as "a named crafting-currency
composition" and then names only the composition. Nothing in `recipes.json`'s
stated contract is declared to the view as a display string. Printing the
composition is unambiguous while v1 has exactly one recipe (FR-26) and will not
survive a second. If `recipes.json` carries a display name, that name should
win — but nobody has confirmed that it does.

**Money figures read at 2 decimal places** `[decision — memlog 85]` — EV, price
and the threshold alike. `core` persists 4dp and the page never re-rounds
anything it passes on. A figure that is genuinely present, non-zero, and rounds
to `0.00` renders **`< 0.01`** — that is a quantity, not a missing figure, so it
is never a money-slot phrase.

**Provenance is spoken twice.** The enum value is the contract. The mark carries
a plain-English word beside it — `modelled-split` reads *split by model*,
`uniform-prior` reads *prior only*, `absent` reads *unknown*. The word is not a
synonym replacing the term. It is the term's gloss, and the enum value still
appears in the `{components.key-block}` and in the expansion.

**A Combination is written as tier plus short form, never as a value**
`[decision — memlog 134]`. `T1 Cold Res · T1 Mana`, not
`+35% Cold Res · +180 Mana`. The player operates on tiers and does not carry the
value spreads in their head, so the tier is the comparison the page should be
making. This governs **both** surfaces — the ranked list's chase cells and the
expansion's `{components.combination-row}` — so an exact value band appears
nowhere in the product, except in the fallback below.

**The tier is the Accepted Tier, declared by the curator** `[decision — memlog
135]`. The page reads it from a declared field on the Tracked List, written
beside the Modifier Reference's band. It is never derived from the band, and
never joined to the Weights File's display-only `tierLabel`. Choosing the tier
and choosing the band are one curation act (PRD memlog 13), so the label is a
fact somebody wrote down. That is what makes it honest: `T1` names the tier the
player chose to chase. It is not a claim about any item the search returned, and
the page never makes it one.

The declared field is `acceptedTier`, on the Modifier Reference beside its band
(PRD §3 *Accepted Tier*, FR-22; AD-5). It is display-only: never derived from
the band, never joined to the Weights File's `tierLabel`, and never part of a
Tracked Entry's canonical key. A reference missing the label renders in the
fallback form below, and never fails to load.

**A label may name a mixture** `[decision — memlog 137]`. `T1–T2` is legal. For
a modifier whose text carries more than one `#` — 53 of 63 item classes — AD-28
establishes that the value axis does not partition the tier axis, so a band near
a boundary necessarily includes the neighbouring tier's tail and the curator may
be accepting a range. The Weights File contract already names `"T7–T8"` as an
acceptable spelling. The page prints what the curator accepted, rather than
rounding to a single tier the band cannot isolate.

**The page never explains this vocabulary** `[decision — memlog 139]`. There is
one user and they wrote the Tracked List. The `{components.key-block}` gains
nothing, for the same reason it gained nothing in memlog 114.

**Chase Combination text uses canonical short forms** (memlog 34). One short
form per tracked modifier, from a hand-maintained abbreviation table, so the
same modifier always reads the same way on every row — that stability is what
makes a glance work. Short forms are never invented per row and never truncated
ad hoc. The table is written against a budget of roughly **27 characters** per
chase cell `[memlog 104]`. A short form that still overruns it ellipsises, and
the full text is one click down. The budget did not loosen when the values went
`[memlog 140]`: the modifier **name** was always the long part, and the longest
pairing still runs to 26 characters.

**How a short form may be coined** `[decision — memlog 118]` — a rule rather
than a list, because the table grows every time a modifier is tracked:

1. **A Glossary term is never abbreviated.** This rule governs modifier text
   only. *Divine*, *Item Level*, *Base Type* and every other §3 term are spelled.
2. **Borrow, never invent.** A coined form must be one the player already reads
   in the game or on the trade site. That ratifies `ES` for Energy Shield and
   rejects anything that exists only in this table — a form the player has to
   learn here is slower than the words it replaced.
3. **Unique across the whole table.** Two modifiers never share a short form.
4. **Written once, never varied per row.** Stability is the entire argument for
   having a table. A form that changes by context gives up the benefit.
5. **The tier prefix is never abbreviated or varied** `[decision — memlog 141]`.
   `T1`, never `1`, `t1` or `Tier 1`. A mixture takes an en dash: `T1–T2`. The
   tier is the comparison the row exists to make, so it is the one part of the
   cell that may never be shortened. This replaces the earlier rule protecting
   numerals and units, which assumed the quantity was what the player compared.
   That clause now lives in the fallback below, where numerals are the point.

**Escape valve.** A modifier whose shortest legitimate form still overruns 27
characters when paired is a **candidate for pruning, not for a shorter
coinage**. Never cut a word to make it fit. If it is worth tracking it is worth
reading, and if it cannot be read it is evidence about the Tracked List rather
than about the column.

**The fallback, and it covers two gaps rather than one** `[decision — memlog
138]`. A tracked modifier missing either piece — no entry in the short-form
table, or no declared Accepted Tier — falls back to the Trade Catalogue stat
name **plus the value band**. The fallback must be identifiable as a fallback,
so the gap gets noticed and filled `[ASSUMPTION — memlog 35]`. One treatment
covers both, because both are the same failure: nobody finished curating that
entry. In the fallback, and only there, numerals and units keep their full
symbols — `+35%`, `+180`, `118%`. That makes it the one place in the product
where a numeral from modifier text survives, which is what makes it
recognisable at a glance. `[NOTE FOR UX]` No treatment for that fallback
exists, and it cannot borrow one of the three semantic inks — those are spoken
for.

`[NOTE FOR UX]` `[memlog 143]` **Two Combinations can now read identically.**
FR-22 has the curator track an **interior cell**, and one tier can hold more
than one cell, so two tracked bands of the same modifier on the same Base Type
may both resolve to `T1`. The value text used to tell them apart, and the tier
does not. Rule 3 above guarantees uniqueness across the short-form **table**,
which does not reach this case. The specimen data avoids it only because every
band in it landed in a distinct tier. Nobody has ruled on what the second one
prints.

**What may be cut, and what may not** `[decision — memlog 103]`. Truncation is
legitimate only where the text has somewhere to go. A chase cell and a Base Type
name sit above an expansion holding the same content in full, so an ellipsis
there costs a click and nothing else. **The expansion is the bottom of the
page**: nothing sits beneath a `{components.combination-row}`, so nothing in one
may be cut — no ellipsis, no truncation, and no tooltip standing in for text
that did not fit. A trust mark may not be cut either, for the same reason and
one more: the word *is* the non-colour cue (memlog 41), so a shortened mark
fails the legibility rule rather than merely reading badly. This principle
governs every truncation question this document does not answer directly.

## Voice and Tone

Microcopy rules. Aesthetic posture lives in `DESIGN.md`.

The page speaks the way the brief speaks: plainly, to one player, about one
decision. Short declaratives. No exclamation, no encouragement, no second
person plural, no celebration of a good number.

| Do | Don't |
|---|---|
| "Every price here is a current asking price from a live instant-buyout listing." | "sells for", "worth", "market value", or anything implying an observed sale (FR-13) |
| "nobody is listing this right now — a jackpot and junk look alike here" | "no value", "worthless", "nothing here" |
| "The whole ranking rests on a uniform prior." | "Data quality: low" |
| "someone invented this weight" | "estimated weight" |
| "priced 5d ago" / "tried 9d ago" | an unlabelled "5d" |
| "never attempted" | "—", "n/a", "0" |
| "Read-only while you play." | "Editing is disabled" |
| Name the open question: *an open question*, *no figure yet*, *not valued*, *unknown* | Fill the gap with a number-shaped placeholder |

FR-13's asking-price sentence is the **only** mitigation in the whole system for
Risk R-1. It is not chrome, it does not move below the ranked list, and it is
not shortened.

## Component Patterns

Behavioural only. Visual specs live in `DESIGN.md.Components`.

→ [`mockups/key-hero-resting.html`](mockups/key-hero-resting.html) shows every
component of the resting page. [`mockups/key-expanded-states.html`](mockups/key-expanded-states.html)
shows `{components.expansion-panel}`, `{components.combination-row}` in both its
lines, `{components.tombstone-band}` closed and open, the Raw Base one-row
expansion, and `{components.sync-report-panel}`.

| Component | Use | Behavioural rules |
|---|---|---|
| `{components.ranked-row}` | Ranked list | The whole row is the target and it **toggles**: click anywhere opens `{components.expansion-panel}` for that Base Type, click the same row again closes it. No per-row controls, no hidden actions, nothing revealed on hover. An open row keeps `{components.ranked-row}`'s `openMarker` while any other row is hovered, so the source of an open panel is identifiable at all times. Rank, EV and the Chase Combination set are all recomputed when the Payout Threshold changes. EV displays at 2dp, or `< 0.01` for a real figure too small to print. |
| `{components.ranked-row-tier-1}`, `{components.ranked-row-tier-2}`, `{components.ranked-row-tier-3}` | Ranked list | Purely a function of rank position after a ranking pass. Tiers move when the list reorders. They are not sticky to a Base Type. |
| `{components.raw-base-row}` | Ranked list | Ranks in the same list as crafted rows (FR-3) but at its own asking price, not a craft outcome. **Expanding it shows one `{components.combination-row}`** `[decision — memlog 71]`, for the degenerate Combination of no affixes. Line one carries the same Price State and listing sample count as any other entry. Line two carries both labelled ages, each in its own cell. Its note is declared `[decision — memlog 117]`: `no affixes — this Base Type priced as it drops, at Item Level 82`. A Raw Base is a Tracked Entry and it has a Combination. An empty expansion would strand its exact ages, and those ages are what the FR-12 override promised to put here. **Below-threshold Raw Bases:** a Raw Base whose asking price is under the Payout Threshold leaves the *ranking* altogether. It is not ranked at its price, so it is absent from the top 20 **and** from the grown list behind the list affordance. Truncation is not what hides it, and it does not reappear further down. |
| `{components.column-header}` | Above the list | Static. Columns are **not** sortable — the one ordering is EV under the active threshold, and a second ordering would make the page a spreadsheet. **A column header never ellipsises and is never trimmed to fit** `[decision — memlog 119]`. `PROVENANCE`, the widest label, now sits inside the widened `{spacing.col-provenance}` with room to spare. The letter-space trim that used to buy it room is dropped. |
| Trust marks — `{components.trust-mark-split}`, `{components.trust-mark-prior}`, `{components.trust-mark-unknown}`, `{components.trust-mark-stale}`, `{components.trust-mark-never}`, `{components.trust-mark-unresolvable}` | Rows, appendix, expansion | Inline text, not interactive, no tooltip, no click target. A healthy row renders **no mark element at all** — the cell is empty, not filled. Six marks exist. A seventh needs a decision. |
| `{components.price-state-glyph}` | Expansion rows | Always accompanied by the Price State's name in words. The glyph never appears alone and never substitutes for the word. |
| `{components.money-slot}` | Any cell where a figure is missing | Holds a short phrase naming which question is open, never a number-shaped placeholder. See Epistemics. |
| `{components.payout-threshold}` | Masthead | **The figure is the input** `[decision — memlog 73]` — click the large serif number and type over it. No field, no box, no form chrome. The `Divine` suffix sits outside the editable region and cannot be typed over. Re-ranks on every valid parse. Constraints `[decision — memlog 74]`: min `0`, max `3`, step `0.05`, two decimals, clamped on blur — a negative threshold is not enterable. **The track and marker survive as a non-interactive readout**: they answer "where does 0.50 sit in the range I have", the marker cannot be dragged, and the track cannot be clicked. |
| `{components.trust-strip}` | Under the masthead | Carries **five plain facts, unconditionally**, with no mark and no colour on any of them. Line one carries `producer.id`, `generatedAt` and `gamePatch` (FR-10). Line two carries the last-synced time and the **tracked-list edit date** (FR-18) `[decision — memlog 89]`. Always present, never dismissible. `[ASSUMPTION — memlog 59]` Otherwise silent while fine — no counts of nothing, no "0 unresolvable", no green tick. **Loud when wrong** `[decision — memlog 70/88]`: it raises a third line carrying a rust mark with its glyph, its word **and its count**, on exactly two triggers that share the one line — `✕ N unresolvable` (FR-24) and `✕ pinned entries starved this run` (FR-17, FR-25). The line costs `{spacing.frame-reserve-health-line}` and is charged to the resting budget, because data raises it and no click does. **The whole strip is the click target** and it toggles `{components.sync-report-panel}`. |
| `{components.sync-report-panel}` | Opened from the strip | The full Sync Report — **five figure groups in three columns**: *the sync run* (requests per source, and entries not reached **in the last sync pass**), *what is broken* (the unresolvable count, FR-24, and the pinned-starvation records, FR-17/FR-25), *what the weights cover* (pool coverage as a fraction **with its denominator**, FR-4). The first column is what the run did, the second what broke, the third how much of the Tracked List the weights can speak to. **One heading per column, never per group** (`columnHeadingRule`): a column carrying two groups prints its heading once and separates the groups by vertical space — no second heading, no rule, no bullet. **The tracked-list edit date is not repeated here** `[decision — memlog 89]`. It is a resting fact on the strip two lines above. This panel holds what the resting page cannot show, so it does not restate what is already on screen. `[ASSUMPTION — memlog 59]` Opens **in place**, pushing the asking-price line, the list and the appendix down — not a modal, not a drawer, not a second surface. Closed on every load. Figures are read from `sync-report.json` and never recomputed by the page. |
| `{components.asking-price-line}` | Under the trust strip | Always rendered, in every state including the honest-empty one. Never dismissible. |
| `{components.uniform-prior-banner}` | Above the list | Raised by a data condition, never by a build flag (FR-11). Dismiss is per session only — it returns on the next page load while the condition holds, and it lowers itself the moment any `measured` or `modelled-split` figure appears. |
| `{components.unrankable-appendix}` | Foot | The count is readable without expanding anything (FR-4). Rows are not interactive and do not expand — an Unrankable Base Type has no ranking to explain. A Base Type with an Unrankable crafted branch and a ranking Raw Base branch appears in both places, each labelled for what that branch is. |
| `{components.key-block}` | Above the foot | Always rendered, in every state. It is what makes an empty cell mean something (memlog 42) and is not an optional legend. **It covers the resting page only** `[decision — memlog 114]`. It is deliberately not extended to the expansion's four Price State glyphs. Every glyph always appears beside its word, so nothing there is unreadable without a legend. Four more marks on the resting page, to explain a surface one click away, would cost quiet for no gain. The block exists because silent-when-fine makes an empty cell ambiguous, and that ambiguity belongs to the ranked list alone. |
| `{components.expansion-panel}` | Click a ranked row | Lists **every** Tracked Entry on the Base Type, priced or not, above or below the threshold, including `pruned` tombstones (FR-8). Repeats the active threshold and the asking-price framing, so a panel read on its own cannot be misread. |
| `{components.combination-row}` | Inside the expansion | **Two lines under one hairline** `[decision — memlog 101]`, and the two-line shape exists in the expansion only — the 28px ranked row is untouched. *Line one, the figure:* the Combination — **tier plus short form, never the value**, the same reading as the chase cell `[decision — memlog 134]` — the Price State with its glyph **and** its word, the price in Divine or a money phrase, and the listing sample count. *Line two, the evidence:* the note, then **both labelled ages in their own cells** — the observation age (*priced 11h ago*) and the last-attempted age (*tried 4h ago*). Each says which clock it reads, so the two are never collapsed (FR-12). Line two is **always present**, so rows scan evenly down the expansion. It **wraps rather than truncating**: a long note grows the row by whole `{spacing.combination-row-line-2-height}` lines, which is why `{spacing.combination-row-height}` is a minimum and not a height. That arithmetic holds only because line two is set in `{typography.combination-line-2}` `[decision — memlog 115]`, whose `lineHeight` is **absolute**. The wrap quantum equals the declared token, so a builder never has to compute it and the spine's `48 + 20n` stays literally true. Below-threshold entries are marked by the note reading *below the threshold — adds nothing to EV*. They are never greyed out and never hidden. |
| `{components.trade-link}` | Inside a `{components.combination-row}`, including the Raw Base's | The ↗ glyph, and only the glyph, is the click target. A click opens that Combination's trade-site search in a new tab. **It appears where the entry carries a stored `lastSearchId` and that search ran against the active league** (PRD FR-33, FR-21; AD-9, AD-24). The test reads the stored field, never the Price State. Most `priced`, `no-listings` and `unresolvable` rows therefore carry it. A row the syncer never issued a search for has no id, and a row whose last search ran in a previous league has an id the page will not use. Absence is absence: the cell is blank, not greyed and not disabled-looking. It never appears inside `{components.tombstone-band}` — a pruned entry has no market worth checking. It does not affect page state. The page is unchanged when the tab closes. |
| `{components.tombstone-band}` | Inside the expansion | Collapsed by default behind a `▸ N pruned` toggle (memlog 25). Toggling is local to that panel and resets when the panel closes. A tombstone row keeps line one's shape — Combination struck through, `† pruned`, *not tracked* in the money slot. It takes **its own line-two contract** `[decision — memlog 116]`: the prune reason in `{spacing.col-combination-note}`, then `{spacing.col-tombstone-removed}` reading `removed YYYY-MM-DD`. It does **not** borrow the two age cells. A removal date is a calendar fact about a decision somebody made. It is not a reading of `observedAt` or `lastAttemptedAt`, and a cell whose whole contract is *say which clock this is* would make it look like one. |
| `{components.expand-affordance}` | Below row 20 · tombstone toggle · trust strip · fetch-failure retry | Plain text affordance, one vocabulary everywhere it appears. **The list affordance** reads `+ Read the remaining N Base Types` closed and `— Show only the top 20` open, so the player knows the size of what is behind it and can put it back. It **grows the list in place** to the full ranked length — it does not replace ranks 1–20 and it does not page. Ranks 21 and beyond all take `{components.ranked-row-tier-3}`. The three tiers describe the top ten and nothing below needs a fourth. `{components.unrankable-appendix}`, `{components.key-block}` and `{components.running-foot}` stay below the grown list in the same order. This growth is clicked, so it may push the page into scrolling. |
| `{components.refusal-screen}` | Replaces the whole page | Shown when a fetched artifact is schema-invalid (FR-33, NFR-8). Names **which** artifact, which schema version it declared and which the page expects, with the artifact beside a `{components.trust-mark-unresolvable}` glyph and word. No list, no masthead, nothing stale served. There is no retry — a schema mismatch is fixed by publishing a valid set, and the page says so. |
| `{components.fetch-failure-screen}` | Replaces the whole page | Shown when one of the eight artifacts does not arrive. Names which one, and carries a `{components.expand-affordance}` reading `+ Try again` that re-attempts the whole fetch, never a partial one. One sentence explains that the page shows nothing rather than a partial set, because FR-33 requires a single consistent set and half a ranking is worse than no ranking. |
| `{components.running-foot}` | Foot | States that the page is read-only while playing, that exact ages sit one click down, and that pruning and pinning happen in `data/tracked.json` followed by a commit. This is the only place the page tells the player where curation actually happens. |

## Epistemics

Half of this product is the ranking. The other half is being honest about what
the ranking rests on. The rules below are load-bearing and are not to be traded
for tidiness.

### Silence means healthy

A row whose weight is `measured`, whose pool is `complete`, and whose price was
observed inside the freshness cut-off carries **no glyph, no word and no
colour**. Its Provenance and Age cells are empty (memlog 32). Fourteen of twenty
rows are silent in the reference render, which is why the six that are not can
be read at an angle from across the desk.

There is deliberately no success mark. A green *measured* badge would put a
colour on nineteen rows in twenty and bury the one row that matters — the exact
failure FR-11 describes.

**The `{components.key-block}` is therefore mandatory.** Without its *Silence
means healthy* column an empty cell is ambiguous rather than quiet. It renders
in every state.

### And loud when wrong

Silence is only half the rule `[decision — memlog 70]`. The other half is that a
real problem has to be visible without anyone going to look for it. **Reading
silent-when-fine as *silent, always* is the failure mode of this rule** — a page
that says nothing when the list is broken looks exactly like a page that says
nothing because the list is fine, and the player cannot tell the two apart.

That is why `{components.trust-strip}` raises a rust line at rest, on exactly
two triggers `[decision — memlog 88]`: unresolvable entries exist (FR-24), and
pinned entries starved this run (FR-17, FR-25). Each carries its glyph, its word
*and* its count, because both requirements ask for a figure rather than a flag.
Both mean something actually broke. A healthy sync raises no line at all.

### Attribution is not a health signal

The tracked-list edit date is **not** one of those triggers, and there is no age
at which it turns red `[decision — memlog 88/89]`. It is attribution — the same
class of thing as the producer, the `generatedAt` and the `gamePatch`: a
statement of what this page was built from and when anyone last touched it.

That distinction is what governs the resting strip. **Silent-when-fine governs
health signals. It has never governed the strip's unconditional facts**, which
is exactly why the other four are always shown. So the edit date is printed
plainly as a fifth fact, which satisfies FR-18 as written — *the player does not
have to search for the date* — and does it without a staleness threshold nobody
could defend. A cut-off would have had to be invented, and inventing one would
have turned an honest fact into a judgement the data cannot support.

### Freshness

The cut-off is **48 hours** (memlog 47), roughly two play sessions, chosen
against the ~15-hour partial refresh cycle so that normal rotation never marks a
row.

A row younger than the cut-off shows **no age at all**. This began as a
departure from FR-12 `[memlog 46]`, and **FR-12 now states the rule itself**:
where an age appears is a freshness cut-off rather than a blanket rule, the
cut-off is 48 hours, and the obligation is discharged per row rather than per
surface (PRD FR-12; AD-10). The intent FR-12 protects — that the player can
always tell an observation age from a last-attempted age — is carried in the
expansion, where both are labelled for every entry, and a **stale** row is never
silent on either surface.

At or beyond the cut-off the row carries a rust mark that **says which clock it
reads**. *priced 5d ago* means the price is old. *tried 9d ago* means nothing
has been found here since. The two are never collapsed into one unlabelled age.
A never-synced row is the one row with no age at all and reads *never
attempted*, set in italic so it is distinct from a merely old row without
needing a fourth colour.

### Provenance

Four values, weakest first, and three of them are visible:

| Provenance | On a ranked row | Why it must not collapse |
|---|---|---|
| `measured` | Nothing at all | See *Silence means healthy* |
| `modelled-split` | `{components.trust-mark-split}` — *split by model* | Collapsing it into the degraded treatment understates a measured weight. Collapsing it into `measured` overstates an invented distribution (FR-10) |
| `uniform-prior` | `{components.trust-mark-prior}` — *prior only* | Someone invented this weight, and the page says so |
| `absent` | `{components.trust-mark-unknown}` — *unknown* | An upper bound, not an estimate. It renders as an unknown and never as a number (FR-4) |

`absent` cannot occur on a ranked row: a `partial` pool makes the Base Type
Unrankable, so `absent` is exercised only inside
`{components.unrankable-appendix}`, with the same mark vocabulary (memlog 44).

`core` propagates the weakest Provenance and the oldest timestamp of every
input into each derived figure. `modelled-split` propagates from the numerator
only. The page displays what it is given and computes no ranking term itself
(AD-4).

### The uniform-prior banner

Raised while **no probability in the loaded set carries `measured` or
`modelled-split`**. A `modelled-split` figure does not raise it. It states that
the entire ranking rests on a uniform prior and that relative ordering between
Base Types is not evidence-backed, and it points the player at per-row
freshness instead. It lowers itself when the condition stops holding, so nobody
has to remember to take it down. The per-row mark is required either way
(FR-11), and a `prior only` row still carries its mark while the banner is up.

### Money slots — the FR-9 / FR-4 resolution

`[decision — memlog 43]` A slot with no figure never holds a number-shaped
placeholder. It holds a short phrase naming **which** question is open:

| Condition | Phrase | Reading |
|---|---|---|
| `no-listings` | *an open question* | nobody is asking, today |
| `not-yet-synced` | *no figure yet* | the tool has not looked |
| `unresolvable` | *not valued* (in `{colors.rust}`) | the tool cannot look any more |
| Provenance `absent` | *unknown* | the pool cannot answer |
| `pruned` tombstone | *not tracked* | deliberately excluded |

Never `0`, never `0.00%`, never blank, never an em dash. FR-9 forbids a mark
that reads as a quantity of zero. A word is not a quantity, so one slot
satisfies FR-9 and FR-4 together.

`no-listings` is presented as an open question and not as an answer. The page
never implies a Combination is junk — listings cannot tell a jackpot from junk,
and the page says exactly that.

### Sync health — quiet, but on the page

`[decision — memlog 57, superseding 26]` Sync health is two states, not two
places. **At rest** the strip carries five plain facts — `producer.id`,
`generatedAt`, `gamePatch`, last synced, and the tracked-list edit date — plus
the health line above when something is broken. **One click** opens
`{components.sync-report-panel}` with the figures behind those signals:
per-source request counts, entries not reached in the last sync pass, the
pinned-starvation records, the unresolvable count (FR-24) and the measured
pool-coverage fraction with its denominator (FR-4).

This is what satisfies FR-25's own argument that "a report field that nothing
renders is a field that nobody reads", without putting operational counts in
front of a player who is trying to read a ranking. `[event — memlog 58]` The
coverage fraction therefore has an on-screen home again, which means a coverage
drop across a game patch is visible in the product rather than only in
`sync-report.json`.

Nothing in the panel is computed by the page. It renders `sync-report.json` as
published.

## State Patterns

→ [`mockups/key-hero-resting.html`](mockups/key-hero-resting.html) shows states
11, 12, 13, 18, 19, 31 and 32 together on one page, which is the point: the
marked rows have to be findable among the silent ones.
[`mockups/key-expanded-states.html`](mockups/key-expanded-states.html) shows
states 1 to 7, 10, 21 and 33. The remaining states are specified here and
nowhere else, by decision — see memlog 98.

| # | State | Where | Treatment |
|---|---|---|---|
| 1 | Price State `priced` | `{components.combination-row}` | **Line one:** `●` plus the word `priced`, the figure in Divine at 2dp, the listing sample count. **Line two:** both clocks in their own cells — *priced Nh ago* and *tried Nh ago* |
| 2 | Price State `no-listings` | Combination row | **Line one:** `○` plus the word, `{components.money-slot}` *an open question*, `0 listings found`. **Line two:** note *nobody is listing this right now — a jackpot and junk look alike here*, then both clocks |
| 3 | Price State `not-yet-synced` | Combination row | **Line one:** `△` plus the word **and its reason**, money slot *no figure yet*, `no sample`. **Line two:** the reason's note (states 5–7), then whichever clocks exist |
| 4 | Price State `unresolvable` | Combination row, and surfaced not omitted | **Line one:** `✕` in `{colors.rust}` plus the word, money slot *not valued*, `no sample`. **Line two:** note *the statId is gone from the trade API — a patch did this*, then *tried Nh ago* |
| 5 | reason `never-synced` | Combination row | Rendered *never attempted* — **the one row with no age at all**, so both age cells on line two are empty rather than filled. Note: *no request was ever issued for this entry* |
| 6 | reason `league-mismatch` | Combination row | Note: *the observation belongs to another league*. Treated as absent, never as stale-but-usable. The attempted clock still shows |
| 7 | reason `no-exchange-rate` | Combination row | Note: *the listing currency had no rate at sync time*. There is no "priced but not convertible" state. The attempted clock still shows |
| 8 | Curation Status `active` | Expansion | No marking. It is the ordinary case |
| 9 | Curation Status `pinned` | Expansion | Marked on its Combination row as `pinned`. `[NOTE FOR UX]` No visual treatment for the pinned mark exists in the chosen direction, and it cannot take a semantic ink |
| 10 | Curation Status `pruned` | `{components.tombstone-band}` | Collapsed behind `▸ N pruned`. Opened: line one is the Combination struck through with `† pruned` and *not tracked* in the money slot. Line two is the prune reason and `removed YYYY-MM-DD` in `{spacing.col-tombstone-removed}` — **not** the two age cells `[decision — memlog 116]`, because a removal date is not a reading of either clock |
| 11 | Provenance `measured` | Ranked row | Nothing. The empty cell is the statement |
| 12 | Provenance `modelled-split` | Ranked row | `{components.trust-mark-split}` |
| 13 | Provenance `uniform-prior` | Ranked row | `{components.trust-mark-prior}` |
| 14 | Provenance `absent` | Appendix only | `{components.trust-mark-unknown}` |
| 15 | Unrankable — `pool partial` | Appendix | Reason verbatim, plus a quiet note where one is known (e.g. which slot's pool has no cell) |
| 16 | Unrankable — `base absent from weights file` | Appendix | Reason verbatim. Freshly scraped classes may carry a note that the Base Type may return after the next weights run |
| 17 | Unrankable — both branches | Appendix + ranked list | The crafted branch sits in the appendix labelled *crafted branch* and names where its Raw Base branch ranks. The raw branch ranks normally in the list |
| 18 | Stale row (≥48h) | Ranked row | `{components.trust-mark-stale}`, with the clock said in words |
| 19 | Never attempted | Ranked row | `{components.trust-mark-never}`, italic |
| 20 | Uniform-prior condition true | Banner | `{components.uniform-prior-banner}` above the list, dismissible for the session only |
| 21 | Below-threshold entry | Combination row | Note *below the threshold — adds nothing to EV*. Shown, never hidden, never greyed |
| 22 | Base Type with no Chase Combination | Ranked row | Chase cells empty. Its EV is negative by its Craft Cost and is shown as such, at 2dp, as a real quantity. A negative EV is never a money-slot phrase — the figure is known, and it is bad news rather than missing news |
| 23 | Cold load / skeleton | Whole page | Masthead and twenty row slots paint immediately as placeholders in the final layout. The page never jumps (memlog 50). `[ASSUMPTION — memlog 51]` All eight artifacts resolve in a **single transition** — never row by row, because a partly filled list would show a ranking computed from an incomplete dataset. `[NOTE FOR UX]` No skeleton fill tone or placeholder shape is drawn anywhere |
| 24 | Honest empty — league reset | Whole list | `[decision — memlog 48]` Every tracked Base Type renders in **canonical order**, each carrying Price State `not-yet-synced` reason `league-mismatch`, refilling over the following day. `[ASSUMPTION — memlog 49]` Rank numerals are **suppressed** and the list states that the order is canonical and not ranked. Without that the page asserts a ranking it does not have, which is the failure FR-31's honest-empty rule exists to prevent. `[decision — memlog 83]` **The EV cell is not blank**: every EV there is missing for exactly one reason, so every cell holds the `not-yet-synced` money phrase **no figure yet**. Assumption 49's "empty rather than zero" was aimed at the zero. Blank is the other thing the money slot forbids, and the vocabulary memlog 43 built already answers this without an exemption |
| 25 | Partially refreshed dataset | Whole list | Renders normally. Per-row freshness is what makes that honest. No global "stale" treatment |
| 26 | Nothing clears the threshold | Whole list | Distinct from state 24 and from state 23. `[NOTE FOR UX]` The PRD does not settle whether this has its own copy. It must not be confused with "no data" |
| 27 | Schema-invalid artifact | Whole page | `{components.refusal-screen}` replaces everything (FR-33, NFR-8). It names which artifact, which schema version it declared and which the page expects. The player can do nothing here and is not offered a retry — a schema mismatch is fixed by publishing a valid set. One sentence says the page renders again as soon as one exists, and that nothing old is served meanwhile |
| 28 | Cross-file policy check failure | Report, never refusal | Edge alignment, straddle, empty containment set, `coOccur` overlap, kind agreement — reported at load. The page still renders. `[NOTE FOR UX]` Whether the report is a global region, inline on the affected Base Type, or both is unsettled. `{components.sync-report-panel}` is the obvious home, since it already carries every other operational figure, but nothing has ruled on it |
| 29 | Artifact fetch failure (as against invalid) | Whole page | `{components.fetch-failure-screen}` replaces everything and names which of the eight files did not arrive. The player can click `+ Try again`, which re-attempts the whole set. **A partial set is never rendered** — FR-33 requires a single consistent set, and half a ranking is worse than no ranking |
| 30 | Stale Weights File after a patch | `{components.trust-strip}` | The page is static and makes no call to the game or the trade API, so it has **no live patch to compare against** and claims none. What it does is show the `gamePatch` the loaded Weights File declares, beside its producer and `generatedAt`, so the player — who knows which patch he is playing — can see the mismatch himself. Neither a stale weights file nor a stale catalogue breaks the page |
| 31 | Trust strip at rest, healthy | `{components.trust-strip}` | Two lines carrying five plain facts — producer, `generatedAt`, `gamePatch`. Last synced, tracked-list edit date — with no mark or colour on any of them `[decision — memlog 89]`, and nothing else `[ASSUMPTION — memlog 59]`. Affordance reads `+ the full sync report`, right-aligned. This is the state on every load |
| 32 | Trust strip at rest, something broken | `{components.trust-strip}` | `[decision — memlog 70/88]` A third line appears, carrying a rust mark, its word and its count. There are exactly two triggers and they share the one line: unresolvable entries exist (FR-24), and pinned entries starved this run (FR-17, FR-25). Data raises the line, never a click, and `{spacing.frame-reserve-health-line}` budgets it. The five resting facts are unaffected — an old edit date never turns red |
| 33 | Trust strip expanded | `{components.sync-report-panel}` | Opens in place beneath the strip, pushing the regions below it down `[ASSUMPTION — memlog 59]`. Affordance reads `— the full sync report`. Capped at `{spacing.sync-report-max-height}` (400px) and scrolls inside its own band past that. Because that cap sits inside the worst-case resting budget, the strip alone never makes the page scroll, in any data state |
| 34 | Ranked list grown past 20 | Ranked list | `{components.expand-affordance}` reads `— Show only the top 20` and the list holds every ranked Base Type. Ranks 21+ all take `{components.ranked-row-tier-3}`. The appendix, key block and foot stay below in the same order. Clicked growth, so it may scroll the page. Clicking again restores the top 20 exactly |

`{components.asking-price-line}`, `{components.key-block}` and
`{components.running-foot}` render in every state above except 27 and 29, the
two screens that replace the page. A page that has no numbers still has to say
what its numbers would mean. A page that has no data at all should say only
that.

`[NOTE FOR UX]` **FR-30's world is deliberately unspecified** (memlog 72). Until
a conforming Weights File exists, every crafted Base Type is Unrankable and the
product is a white-base price list with an appendix holding the entire crafted
Tracked List. Three rules collide there: the appendix is a *footer*, truncating
it is forbidden, and nothing unclicked may push the page past 1920px. The user
has accepted designing this at implementation time. It is recorded so it is not
mistaken for an oversight, and it is close kin to the 50–80% coverage band.

## Interaction Primitives

Mouse only. There are six interactions on the whole page — five stay on it,
one leaves it.

→ [`mockups/key-expanded-states.html`](mockups/key-expanded-states.html) shows
the result of interactions 2, 3 and 5 — an open Base Type, the tombstone band
opened, and the sync report open.

1. **Set the Payout Threshold.** `[decision — memlog 73]` **The figure is the
   input.** Click the large serif number in `{components.payout-threshold}` and
   type over it — there is no field and no form chrome, and the resting dotted
   sepia underline is what makes it read as editable rather than as a label. The
   `Divine` suffix sits outside the editable region and cannot be typed over.
   `[OVERRIDE — memlog 36/37]` This departs from UJ-2, which narrates the player
   *dragging* the threshold. The continuous sweep is given up for exactness and
   for masthead width. FR-6 still binds: the list reorders immediately,
   satisfied by re-ranking on input change rather than on commit.
   `[ASSUMPTION — memlog 38]` Re-ranking fires on every valid parse, debounced
   ~150ms, so typing `0.25` does not re-rank at `0` and again at `0.2`. The pass
   is synchronous, local, under 100ms, and triggers no network request. The
   threshold also changes which Chase Combinations appear, since only
   Combinations at or above it are shown.
   *Constraints* `[decision — memlog 74]`: min `0`, max `3`, step `0.05`, two
   decimals, clamped on blur. A negative threshold is not enterable. **The track
   and marker survive as a non-interactive readout** — they answer where the
   current value sits in the range, which a bare number cannot show. The marker
   cannot be dragged and the track cannot be clicked. Cold start is `0.25`
   Divine `[ASSUMPTION — PRD FR-7]`.
2. **Expand a Base Type.** Click anywhere on `{components.ranked-row}`. Click
   the same row again to close it. The panel opens in place, instantly, below
   the row. **Many panels may be open at once** — they are read against each
   other, and a page that closed one to open another would make comparison
   impossible on a surface whose whole argument is comparison. Nothing closes a
   panel except a second click on its own row.
3. **Toggle the tombstone band.** `▸ N pruned` inside an open panel. Local to
   that panel, and it resets when the panel closes.
4. **Read the remainder of the list.** `{components.expand-affordance}` below
   row 20, reading `+ Read the remaining N Base Types` closed and `— Show only
   the top 20` open. It is reversible and it grows the list in place rather than
   paging. `core` ranks the full Tracked List. The page truncates, so the
   threshold still reorders across everything (FR-5).
5. **Open the full sync report.** Click anywhere on `{components.trust-strip}`
   `[decision — memlog 62]`. The whole strip is the target — the player is
   mouse-only and there is no keyboard affordance to add. The affordance text
   sits right-aligned on the strip's first line and reads
   `+ the full sync report` closed, `— the full sync report` open, in
   `{colors.sepia}`, taking a dotted sepia underline on hover. It reuses the
   `{components.expand-affordance}` vocabulary exactly rather than inventing a
   second one. Clicking again closes it. The panel starts closed on every load.

6. **Open a Combination's trade-site search.** Click the ↗ glyph on a
   `{components.combination-row}` (ordinary or the Raw Base's). It opens that
   Combination's search on the trade site, in a new tab — the only outbound
   navigation on the page. The glyph is the whole click target. The rest of
   the row does nothing when clicked. It appears where the entry carries a
   stored `lastSearchId` **and** that search ran against the active league
   (PRD FR-33, FR-21; AD-9, AD-24). The test is on the stored field, never on
   Price State. In practice that means most `priced`, `no-listings` and
   `unresolvable` rows carry it, and two kinds of row do not. A row the syncer
   never issued a search for has no id — a `never-synced` row, and also an
   entry found `unresolvable` before any request was issued, since that
   detection is offline (PRD FR-24). A row whose last search ran in a previous
   league has an id the page will not use, because a link into last league's
   search is the stale answer the honest-empty state exists to prevent
   (PRD FR-31). See Component Patterns.

   **A stale search id is covered rather than open** (finding T4, closed). An
   id is exactly as old as the attempt that produced it, and FR-12 already puts
   that attempt's age on the row. A player following a link from a row marked
   stale was told how old it was before the click. Expiry is stronger still:
   GGG expires a trade search roughly six months after its last use, and a
   temporary league is shorter-lived than that, so an id that passes the league
   test above is younger than the expiry window (PRD FR-33, AD-24). Only a
   **permanent** league reaches expiry. That case is accepted rather than
   handled. The cost is one wasted click onto the trade site's own explicit
   *"search is no longer valid"* page, which misleads nobody.

   `[NOTE FOR UX]` One smaller gap, reported not fixed
   (review-prd-conformance-trade-link.md, finding T3): the brief's SM-1
   metric ("the trade site stays closed mid-session") sits in tension with the
   page's one link back to that site. It is not resolved here —
   SM-1 most likely reads as "stays closed for habitual re-checking", which a
   deliberate one-off verification click does not violate, but nobody has
   ruled on it.

Plus one dismissal: the uniform-prior banner's *dismiss for this session ×*.

**What survives a reload, decided rather than left to silence** (FR-7). The
**Payout Threshold alone** persists, in the viewer's own browser storage
(FR-7, AD-15) — it is the one value the player sets deliberately and would be
annoyed to set twice. Everything else resets: open Base Type panels, the
tombstone toggles inside them, the grown list, and the sync report all start
closed on every load, and the banner dismissal lasts the session only. FR-7's
phrase "the view preferences" is read here as *the threshold*, because every
other piece of view state on this page is a reading position rather than a
preference, and a page that reopened four panels from last night would not be
the resting state the whole design is tuned for. This is a decision, not an
omission: a builder should not persist panel state in order to satisfy FR-7, and
if FR-7 is ever read more widely, this is the line to change.

**Hover and active states.** `DESIGN.md` flagged these as open and has since
settled them. The behaviour is recorded here, and nothing lifts, glows or
rounds:

| Target | Hover | Active (pointer down) | Persistent |
|---|---|---|---|
| `{components.ranked-row}` | Background to `{colors.paper-inset}`. Cursor pointer. Nothing is revealed, nothing moves, no row changes height | Background to `{colors.paper-deep}` | A row **whose panel is open** takes the `openMarker` — a `{spacing.open-row-marker}` sepia left rule and a promoted bottom rule — and keeps it while any other row is hovered. Tone alone cannot mark the open row, because hover uses the same tone. `[decision — memlog 106]` The marker **bleeds into the gutter** rather than pushing the row. The row stays content-box at `{spacing.content-width}` and the rule takes a negative left margin. No column moves, and the list never jumps sideways when a row opens |
| `{components.raw-base-row}` | Background to `{colors.paper-raw-hover}`, so a hovered Raw Base row still reads as a Raw Base row instead of collapsing onto the ordinary hover tone | Same as any row | Same |
| `{components.expand-affordance}` | Its dotted rule becomes solid in `{colors.sepia}`. The text colour does not change | Text to `{colors.ink}` | — |
| `{components.payout-threshold}` figure | Its resting dotted sepia underline goes solid sepia | — | While editing, the underline goes solid `{colors.rule-strong}`, the caret is `{colors.ink}` and the selection is `{colors.paper-deep}`. The readout track and marker never respond to the pointer |
| Banner dismiss | `{colors.ink-tertiary}` to `{colors.ink}` | — | — |
| `{components.trust-strip}` | Cursor pointer across the whole strip. Its affordance text takes the `{components.trust-strip}` `affordanceHoverRule` — a dotted `{colors.sepia}` underline. Nothing else about the resting strip changes | — | While open, the affordance reads `— the full sync report` |
| `{components.combination-row}`, appendix rows, `{components.sync-report-panel}` contents, trust marks | **No hover state.** They are not interactive, and a hover response on a non-target teaches the wrong thing | — | — |
| `{components.trade-link}` glyph | `{colors.ink-tertiary}` to `{colors.sepia}`, cursor pointer. Nothing else in the row responds | Same colour, no further change | — |

Any colour change is instantaneous or at most a fast linear step (memlog 14).
No fade on a 28px row — a fade on a row this size reads as lag.

**Out of scope, explicitly:** focus-visible styling, `Tab` traversal, keyboard
shortcuts, access keys, drag of any kind, right-click menus, and touch gestures.
Input is mouse-only (memlog 13).

**Banned everywhere:**

- Sorting by column.
- Hover-revealed row actions.
- Tooltips.
- Modals.
- Auto-refresh or polling that changes the list under the player's eyes.
- Any animation that attracts attention to a row.
- Any write path from the browser (AD-15, AD-21).
- Copy-to-clipboard JSON snippets per row, rejected for v1.

## Accessibility Floor

**This floor is thin because the user decided it should be, not because it was
overlooked** (memlog 13). This is a product for exactly one person, read on one
known monitor with a mouse in hand. Accessibility is explicitly not a
requirement. No WCAG level is targeted, no contrast ratio is claimed, no
screen-reader behaviour is specified, no keyboard path is provided, and no
reduced-motion handling is needed because nothing moves. **Do not infer any of
these from the fact that a floor section exists.** If the product ever acquires
a second user, this section is the first thing that has to be rewritten.

What does bind:

- **NFR-10, reframed as legibility** (memlog 15). Every product-meaningful
  distinction — Price State (FR-9), Provenance (FR-10), Raw Base versus crafted
  (FR-3) — carries a non-colour cue alongside any colour: a glyph, a word, a
  weight, a tint plus an italic, never hue alone. The test is whether the page
  still reads with every colour removed. It does: three semantic inks, each
  always spoken with a glyph *and* a word.
- The justification is the angled mid-session glance across a desk, not
  conformance. That is an honest statement of why the rule survived, and it is
  the same rule either way.
- **Rendered text, not raw ids.** The Trade Catalogue exists so a `statId`
  renders as its human text without a runtime call to the trade site (FR-33).
  Raw ids on the page are a legibility failure, not a cosmetic one.
  `[decision — memlog 86]` The denomination is rendered as **text**, not as an
  icon: there is one denomination on the whole page, so the currency-icon half
  of FR-33 has nothing to do here and no icon appears anywhere in the product.
  **The two catalogue files carry different halves of the rendering job**, and a
  live fetch on 2026-09-13 corrected an earlier claim here that
  `catalogue/static.json` served the stat-text path. It does not, and carries no
  stat text at all. `catalogue/stats.json` supplies a `statId`'s display text;
  `catalogue/static.json` supplies the **denomination's own label**, which the
  page prints rather than hardcoding a name the catalogue already owns
  (PRD FR-33, AD-24, AD-25).

## Responsive & Platform

Unusual, and stated explicitly so nobody adds what is missing.

- **The frame is a constant, not a breakpoint.** `{spacing.frame-width}` wide in
  a `{spacing.frame-height}` portrait frame, centred on any wider viewport with
  `{colors.surround}` to the sides.
- **Target: a 1080x1920 portrait second monitor**, beside the running game, for
  the length of a session.
- **The frame is 1060px, not 1080px, and that is deliberate**
  `[decision — memlog 120/121]`. **Do not "correct" it back to the viewport
  width.** The document scrolls by design once a panel is opened, and a vertical
  scrollbar eats ~15–17px of a 1080px monitor, so a 1080px frame would clip its
  right edge or force a horizontal scrollbar the moment the player expanded
  anything — and the 1px outline edge made it 2px worse again. 1060px leaves
  ~3px of slack against a 17px scrollbar.
- **The 20px came out of the gutters, not the columns.**
  `{spacing.frame-padding-x}` tightened to 24px so that
  `{spacing.content-width}` stays exactly 1012px: 1060 − 48 = 1012. **No column
  contract moves**, all five verified sums survive, and the chase budget stays
  at 27 characters `[memlog 122]`. Recutting the columns would have taken the
  20px from the chase cells under the ellipsis principle and dropped the budget
  to ~26 — and 27 had already forced coining `ES`. A gutter has no contract. A
  chase cell does. The open-row marker still bleeds 3px into the remaining 24px.
- **No breakpoints.** Nothing reflows, stacks, collapses or hides below
  `{spacing.frame-width}`. There is no phone layout and none is planned.
- **No dark mode.** Light mode is a decision (memlog 12/16) — warm paper chosen
  against the glare of a dark game at night.
- **No scrolling in the default state.** Twenty rows, the appendix, the key
  block and the foot fit inside `{spacing.frame-height}`.

**The overflow rule, stated plainly: *nothing the player has not clicked may
push the page past 1920px.*** `[decision — memlog 63/64/65]` The no-scroll rule
binds the resting state — what the player reads at a glance — and not a state he
opened himself.

1. **`{spacing.frame-slack}` is the expansion budget** — **528px**, computed
   from the committed block heights at the declared line-heights, sitting
   between the last ranked row and the appendix. Two things are charged against
   it by *data* rather than by a click and therefore belong to the resting
   budget: `{spacing.frame-reserve-banner}` for the uniform-prior banner, and
   `{spacing.frame-reserve-health-line}` for the trust strip's health line.
   Worst-case resting height is 1485px, leaving 433px.
2. **The sync report opens against the slack first.** It is capped at
   `{spacing.sync-report-max-height}` — an independent **400px**, chosen to sit
   inside that 433px worst case — and scrolls inside its own band past that. So
   `{components.sync-report-panel}` alone never makes the page scroll, in any
   data state.
3. **A Base Type expansion is deliberately uncapped.** Capping it would hide
   tracked Combinations or tombstones, which FR-8 forbids. An expansion — or an
   expansion plus the sync report — that exceeds the slack **makes the frame
   scroll**, and that is the intended behaviour, not a defect.
4. **Collapsing everything restores the exact fit.** The page must return to the
   same 1920px it started at.

**Which box scrolls** `[decision — memlog 80]`: the frame takes `min-height:
{spacing.frame-height}`, not `height`, and **the document scrolls**. The frame
never receives `overflow-y`, and neither does any region inside it except
`{components.sync-report-panel}`, the one capped band. So the appendix, the key
block and the running foot travel with the page rather than staying pinned over
a scrolling list — this is a page, and its printed order stays true when it gets
longer.

**Forbidden as overflow escape hatches:** shrinking rows, dropping columns,
truncating `{components.unrankable-appendix}`, hiding
`{components.key-block}`. Density is fixed and scrolling is the only release
valve.
- **Static delivery.** The page paints before it fetches. Both font stacks are
  system-resident and nothing is downloaded (NFR-7).

## Key Flows

The PRD's own journey names and substance, kept verbatim. `[OVERRIDE —
memlog 21]` These keep the PRD's **"the player"** wording rather than taking a
named protagonist, departing from the UX method's named-protagonist rule: the
product has exactly one user, the brief's singular voice already carries the
concreteness a name would add, and divergent naming across the PRD and this
document would be a discipline violation under the PRD's Glossary-anchored rule.

### UJ-1 — The pre-session read

→ Steps 2 to 6 are the page in
[`mockups/key-hero-resting.html`](mockups/key-hero-resting.html).

1. The player is about to map for two hours and opens the view on the second
   monitor.
2. Skeleton rows paint in the final layout and resolve in one transition
   `[ASSUMPTION — memlog 51]`.
3. He reads `{components.trust-strip}` in passing — producer, `generatedAt`,
   `gamePatch`, last synced. There is no third line on it, which is the strip
   saying nothing is wrong rather than the strip saying nothing at all.
4. He glances at the top five Base Types under his current threshold. Rank
   emphasis is carried by weight, so the top band reads first without being
   bigger.
5. He notes the two or three Chase Combinations on each, read as a tier and a
   canonical short form per affix — `T1 Cold Res · T1 Mana`. He does not have to
   recall what value spread a tier covers, which is the whole reason the tier is
   printed and the value is not.
6. **Climax:** he closes nothing and touches nothing. The page is already at
   rest in the state he needs it in, and it stays that way on the second monitor
   for the whole session. He picks up bases accordingly.

Failure path: a published file does not match its schema and
`{components.refusal-screen}` replaces the page (state 27), naming which file.
Or one of the eight does not arrive and `{components.fetch-failure-screen}`
offers him `+ Try again` (state 29). Either way he plays without the tool rather
than with a wrong one, and never with half a ranking.

### UJ-2 — The threshold turn

1. The player is now richer than at league start.
2. He clicks the threshold figure itself and types `1` over `0.25` — the number
   is the input, so there is nothing to aim at but the number.
   `[OVERRIDE — memlog 36/37]` He types rather than drags. The slider is gone,
   though the track beneath still shows him where `1` sits in the range.
3. On the first valid parse, debounced ~150ms `[ASSUMPTION — memlog 38]`, the
   ranking re-runs synchronously against the already-loaded artifacts. No
   network request, no sync.
4. The list reorders. Steady moderate Base Types fall away. Jackpot Base Types
   rise. This is correct behaviour, not a bug (FR-6).
5. Chase Combination sets change with it — only Combinations at or above the new
   threshold remain, and some rows now show fewer than three, or none.
6. **Climax:** he re-reads the new top five. The page that answered one
   player's question a moment ago now answers a richer player's question, and
   nothing else on it moved.

Failure path: he types a value nothing clears (state 26). The list does not
silently look like a data outage — the page must distinguish "nothing clears
your threshold" from "no data". `[NOTE FOR UX]` That copy is unsettled.

### UJ-3 — The drill-down

→ Steps 3 to 6 are the panel in
[`mockups/key-expanded-states.html`](mockups/key-expanded-states.html), which
carries all four Price States on one Base Type.

1. The player is unsure why an unfamiliar Base Type ranks third.
2. He clicks anywhere on its `{components.ranked-row}`.
3. `{components.expansion-panel}` opens in place, repeating the active threshold
   and the asking-price framing.
4. He reads every Tracked Entry on the Base Type: which are `priced` and at
   what, how old each price is, which returned `no-listings`, which are
   `not-yet-synced` and why, and which are `unresolvable`.
5. Entries below the threshold are present and marked as adding nothing to EV —
   he can see what the ranking deliberately excludes as well as what it is built
   from.
6. Exact ages sit here for every entry. Each combination row's **second line**
   carries the note and **both clocks in their own cells** — *priced 11h ago*
   beside *tried 4h ago* — so the two are never collapsed and neither is cut
   `[decision — memlog 101]`. That holds for rows that carried no age upstairs,
   and for a Raw Base, whose expansion holds the one degenerate Combination row
   rather than nothing at all `[decision — memlog 71]`. He can leave this panel
   open and expand a second Base Type beside it to read the two against each
   other.
7. **Climax:** the third rank stops being a claim and becomes an argument he can
   check. He either accepts it or does not, on evidence he just read.

### UJ-4 — The trust check

→ Steps 2, 4 and 5 read off
[`mockups/key-hero-resting.html`](mockups/key-hero-resting.html): the marked
rows among the silent ones, and the strip beneath the masthead.

1. The player notices a Base Type ranking suspiciously high.
2. Its Age cell is not empty — and on this page a non-empty cell is the whole
   signal. It reads *priced 5d ago*.
3. Above the list, `{components.uniform-prior-banner}` is up: the whole ranking
   rests on a uniform prior, and relative ordering between Base Types is not
   evidence-backed.
4. He reads `{components.trust-strip}` and sees the `gamePatch` the weights file
   declares. The page does not tell him the patch is old — it has no way to know
   what patch is live — but he does, and the two facts sit next to each other.
5. **Climax:** he discounts that Base Type rather than acting on it. The page
   did not hide the weakness and did not apologise for it — it simply refused to
   look more confident than its data deserved.

### UJ-5 — The curation pass

**Partially supported by design** `[OVERRIDE — memlog 22/25]`. The view has no
write path and offers no JSON snippet to paste. The *review* is fully supported
on the page. The *edit* happens in a text editor and git.

→ Steps 3 to 5 are in
[`mockups/key-expanded-states.html`](mockups/key-expanded-states.html): the sync
report open, and the tombstone band open inside a panel.

1. The player reviews deliberately after a few weeks.
2. He does not have to go looking, and he does not have to click anything to
   start. `{components.trust-strip}` has been carrying the tracked-list edit
   date in plain type all along — it reads six weeks back, which is what a few
   weeks of not reviewing looks like `[decision — memlog 89]` — and it has been
   carrying a rust line, `✕ 12 unresolvable`, for days
   `[decision — memlog 70/88]`. Between them, that is why he is here.
3. He clicks the strip and opens `{components.sync-report-panel}` for the rest:
   the count behind that rust line (FR-24), the pinned-starvation records
   (FR-25) that tell him a pin he set is not being served, and the coverage
   fraction with its denominator, which tells him how much of what he tracks the
   ranking can speak for at all.
4. He expands the Base Types those figures point at — several at once, left open
   side by side — and reads their full Combination lists. He finds three
   Combinations that have returned `no-listings` all league, and one flagged
   `unresolvable` since the last patch.
5. He opens `▸ N pruned` on a panel and reads the existing tombstones with their
   reasons — FR-8's inclusion of tombstones is what makes this review possible
   without opening the file.
6. `{components.running-foot}` tells him where the edit happens.
7. **Climax:** he leaves the page knowing exactly which entries to touch and
   why. He opens `data/tracked.json`, tombstones the dead Combinations with a
   reason, pins one Combination he wants watched closely, and commits. The next
   sync run reflects the edit, and the next time he opens the page the
   tombstones he wrote are in the band and the starvation record is gone from
   the report.

What stays unsupported: the edit itself. Nothing on the page writes, and no row
offers a snippet to paste. That is deliberate — `data/tracked.json` is
hand-owned (AD-15, AD-21) and this is an act performed a handful of times a
league.

### UJ-6 — The league reset

1. A new league starts. The player edits the active league in `data/config.json`
   and commits.
2. He opens the page. Every tracked Base Type renders in canonical order
   `[decision — memlog 48]`, each carrying Price State `not-yet-synced` with
   reason `league-mismatch`.
3. `[ASSUMPTION — memlog 49]` Rank numerals are suppressed and the list states
   that this order is canonical and not ranked. An ordering implies a ranking,
   and this ordering means nothing yet. `[decision — memlog 83]` Every EV cell
   holds the phrase **no figure yet** — not a blank, not a zero. The money slot
   answers this state with the vocabulary it already had.
4. `{components.asking-price-line}` and `{components.key-block}` still render.
   The page explains itself even with nothing to say.
5. Over the following day, rows acquire prices as the sync rotation reaches
   them, and ages start to differ row to row because the refresh is long and
   partial.
6. **Climax:** the ranking refills in front of him rather than appearing
   finished. He watches the recovery happen, which is why a takeover state was
   rejected — and at no point does the page serve last league's numbers as
   though they were this league's.

## Coverage Self-Check

Run against `references/validate.md` Pass 1.

- **Flow coverage — complete.** All six PRD journeys (UJ-1…UJ-6) have a Key
  Flow with numbered steps and a climax beat. Failure paths where one exists:
  UJ-1, UJ-2. UJ-5's partial support and UJ-6's honest-empty landing are stated
  as such. Protagonist is "the player" by deliberate override (memlog 21).
- **State coverage — 34 states enumerated** across Price States and their
  reasons, Curation Statuses, Provenance values, Unrankable reasons, load,
  empty, stale, refusal, fetch-failure, report, sync-health and grown-list
  conditions. Four carry `[NOTE FOR UX]` because no source settles them and none
  was invented: the pinned mark (9), the skeleton's own appearance (23), the
  nothing-clears copy (26) and the cross-file report's placement (28).
- **Component coverage — every component named in `DESIGN.md.Components` has a
  behavioural row** in Component Patterns, under the same name, including
  `{components.sync-report-panel}`, `{components.refusal-screen}` and
  `{components.fetch-failure-screen}`.
- **Token references — all resolve** against `DESIGN.md`'s declared token names.
  `{typography.row-ev-unit}` and `{spacing.col-combination-age}` are removed
  upstream and neither is referenced here. The newer
  `{typography.combination-line-2}` and `{spacing.col-tombstone-removed}` are
  used where they apply.
- **Note copy checked against its cell.** Every note string this document
  specifies is 39–68 characters, which sits inside
  `{spacing.col-combination-note}` less `{spacing.pad-combination-cell-right}`
  at `{typography.combination-line-2}` with room to spare — and line two wraps
  rather than truncating in any case, growing by whole absolute-line-height
  steps, so a longer note added later grows the row instead of losing text.
  Both clocks have their own cells
  (`{spacing.col-combination-age-observed}`,
  `{spacing.col-combination-age-attempted}`) and no longer share one.
- **Resolved since the first draft.** Each item below was open once and is now
  settled:
  - FR-18, by the tracked-list edit date printed as a plain fact on
    `{components.trust-strip}` (memlog 89).
  - FR-24 and FR-25, by the rust health line at rest and the figures behind it
    in `{components.sync-report-panel}` (57, 61, 70, 88).
  - FR-4's coverage fraction, in the same panel (58).
  - FR-8's Raw Base expansion (71, 117).
  - The threshold's range, step and readout (73, 74).
  - Both failure screens (75).
  - Display precision (85) and the honest-empty EV cell (83).
  - Glossary wordings (84) and currency as text (86).
  - Scroll semantics and the vertical budget (80, 81), and the 1060px frame
    (120, 121).
  - The two-line combination row and the tombstone contract (101, 105, 115,
    116).
  - The unreviewed cut-off, resolved **by removal** (88). The third loud
    trigger is gone and no threshold is defined, so nothing is left open there.
- **Unresolved, reported not fixed.** None of these is resolved by invention:
  - FR-4's 50–80% first-class treatment for
    `{components.unrankable-appendix}`, including whether the page switches band
    at runtime or at build time (Information Architecture).
  - FR-30's no-weights-file world (State Patterns), which is close kin to it.
    The user accepted designing it at implementation time.
  - The short-form fallback treatment (Domain Vocabulary).
  - The Craft Recipe's display name (Domain Vocabulary, memlog 107).
  - The pinned mark, the skeleton's appearance, and the nothing-clears copy.
  - Where a cross-file validation report lands.
