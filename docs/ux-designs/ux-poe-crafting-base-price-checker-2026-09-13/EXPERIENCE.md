---
title: PoE2 Crafting Base Price Checker — Experience
status: final
revision: 9
created: 2026-09-13
updated: 2026-09-27
sources:
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/addendum.md
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/brief.md
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/addendum.md
  - docs/sprint-change-proposal-2026-09-13.md
  - docs/sprint-change-proposal-2026-09-19.md
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
| `Skeleton` animated shimmer | The load state is skeleton rows in the final layout (memlog 50). **No shimmer and no animation** `[decision — memlog 211]`: flat bars, whose treatment `DESIGN.md` owns under Components. |
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
| Masthead + `{components.craft-recipe}` + `{components.payout-threshold}` | Always visible | Names the league. Holds **both** controls on the page, as one right-floated group |
| `{components.trust-strip}` | Always visible | What the ranking rests on, as five plain facts: Weights File producer, `generatedAt`, `gamePatch`, last synced, tracked-list edit date (FR-10, FR-18). Names each absent tolerable artifact on a plain line of its own (state 38). Raises a rust line when something is broken. The whole strip is a click target |
| `{components.sync-report-panel}` | Click `{components.trust-strip}` | The full Sync Report, opened in place beneath the strip (FR-24, FR-25, FR-4) |
| `{components.asking-price-line}` | Always visible | FR-13's framing, above the list, never below the fold |
| `{components.uniform-prior-banner}` | Raised by data condition | The whole-ranking warning (FR-11) |
| `{components.column-header}` + twenty `{components.ranked-row}` | Always visible | The product. Crafted rows name an **Item Class** (FR-3). UJ-1, UJ-2, UJ-4 |
| `{components.raw-base-row}` | Interleaved in the same list | Raw Bases — single **Base Types**, ranked at their own asking price (FR-3) |
| `{components.expand-affordance}` (list) | Below row 20 | Reads the remainder of the ranked list (FR-5) |
| `{components.expansion-panel}` | Click a ranked row | Every Tracked Entry on that Item Class, or the one entry a Raw Base names. UJ-3, UJ-5 |
| `{components.tombstone-band}` | `+ N pruned` inside the expansion | `pruned` tombstones with their reasons (FR-8, FR-15) |
| `{components.unrankable-appendix}` | Foot of the frame | **Item Classes** kept out of the ordering, with their reason and count (FR-4) |
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

**One list, two ranked units** `[decision — memlog 180]`. The ranked list is
mixed by design: a crafted row names an **Item Class** and a raw row names a
**Base Type** (FR-3). They are peers — neither is the default kind of row — and
every row states which it is by carrying `{components.unit-glyph-class}` or
`{components.unit-glyph-raw}` before its name. `{components.column-header}` names
both, because a header describes what a column can hold and a glyph describes
what this row is.

*This changed at revision 3 and it is not a rename.* Through PRD revision 16 the
crafted branch ranked Base Types, so the list held one unit in two treatments.
It now holds two units, and the places that assumed one — the expansion's
contents, the appendix's rows, the Provenance mark's granularity, the list
affordance's copy — were each re-derived rather than swept.

**The appendix stays at the foot, now as a decision rather than a band**
`[change — memlog 185]`. A `[NOTE FOR UX]` stood here through revision 2: FR-4's
50–80% coverage band was said to require `{components.unrankable-appendix}` to
become a first-class surface, and this IA described the ≥80% treatment only.
**PRD revision 18 withdrew the bands** — coverage is "reported, not a gate: no
threshold and no layout binds to it, and how prominently the Unrankable group
sits beside the ranking is UX's" (FR-4). So the note closes by removal, and the
prominence question is now this document's outright. The reasoning for the foot
is in `DESIGN.md`, Layout & Spacing. Behaviourally what it fixes is this: **the
page never switches layout on a measurement.** There is one arrangement in every
data state, the count is readable without expanding anything (FR-4), and the
fraction with its denominator lives one click down in
`{components.sync-report-panel}`.

## Domain Vocabulary

The PRD's §3 Glossary is binding and states that **a synonym introduced
anywhere is a discipline violation**. These terms appear on screen verbatim,
spelled exactly as below. No UI copy may substitute a friendlier word.

**Player-facing terms, used verbatim:** Item Class · Base Type · Raw Base ·
Combination · Chase Combination · Tracked Entry · Tracked List · Curation
Status · Price State · Payout Threshold · Craft Recipe · Craft Cost · Expected
Value (EV) · Provenance · Unrankable · Divine · `gamePatch` · Weights File ·
Item Level Floor · Sync Report.

***Item Class* joined this group at revision 3** `[decision — memlog 180]`, when
the crafted branch began ranking it (FR-3). It carries a display rule of its own,
and the rule is the PRD's rather than this document's: **the page names a class
by its own name — *Bow* — and never prefixes it with the word *class***
(§3 *Item Class*, PRD-owned). So a ranked row reads `Bow`, never `Bow class` and
never `Class: Bow`. The two words *Item Class* are printed only where the page
is naming the **kind of thing** rather than an instance of it — the column
header and the appendix title — exactly as *Base Type* has always worked.

`[NOTE FOR UX]` **Some class names may read as source vocabulary rather than as
the player's.** §3's own `[ASSUMPTION]` says a class's name is already what the
player calls it, and then flags the exception: where several classes of one broad
kind differ only in defence type, the name may not be what he says. The PRD hands
the fix to this document explicitly — *"that is a display fix in `EXPERIENCE.md`,
never a change of unit"* — and no fix is specified here, because the real class
list has not been read against a player's vocabulary yet. It is a display
mapping if it is needed at all, so it can be settled against real data without
reopening anything. **It must never be settled by renaming the unit.**

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
- Provenance — `measured`, `uniform-prior`, `absent`.

**Reason strings shown verbatim from FR-4:** `pool partial`, `class absent from
weights file`, `class disagrees with weights file`. *The second was `base absent
from weights file` through PRD revision 16. The third was added when D-2 closed:
a class failing any of AD-17's five cross-file checks has a `complete`,
published pool, so neither of the first two is true of it.* The enum has exactly
three members, and **one string covers all five checks** — which check, which
entry and its canonical key are diagnosis and never reach the appendix.
**Standing check:** this enum is PRD-owned and has now moved in three
consecutive PRD revisions, so re-read FR-4 on every absorption rather than
trusting the copy here.

**Back-end only — must not appear on the page:** Modifier Reference, Stat Line,
Source Modifier, Eligible Pool, Modifier Weight, Chunk, Workload, Refresh
Rotation, `weightSource`, `lines`, `ranges`, `sourceModifierId`, `poolCoverage`,
`tierLabel`. These may appear in **diagnosis**, and the licence is one of
**register, not of audience** `[decision — memlog 206]`. It read *"where the
reader is the person fixing the file"* until then, which does not discriminate in
this product: there is exactly one user, he wrote the Tracked List, and he is the
person fixing the file. The same one-reader fact retires the word on the unit
glyphs (memlog 184). What still discriminates is **what kind of thing the text
is**. A figure-group label is read at a glance, in the page's voice. A canonical
key is a string he copies into an editor. Both are legitimate for this reader;
they are not legitimate in the same typographic breath — see *Two registers in
one panel*.
`weightSource` is on this list for a second reason as well: its own enum spells
`"absent"`, and Provenance spells `absent` for a different thing entirely, so
printing the field's words beside a Provenance mark would invite the reader to
read one as the other (PRD FR-10, §3 *`weightSource`*).
`tierLabel` is on this list for a second reason as well: the page must never
**read** it either. The tier it prints comes from the curator's declaration, not
from the Weights File `[decision — memlog 135]`.

**Four wordings an earlier draft had wrong. Do not reintroduce them**
`[decision — memlog 84]`:

| Write this | Never this | Why |
|---|---|---|
| The fourth column header and the key block's middle group read **Provenance** | "Weight" | A synonym for one Glossary term and a collision with *Modifier Weight*, which is banned from the page. It also misleads: `◊ prior only` under a `WEIGHT` header reads as a claim about how rarely a modifier rolls, not about where the figure came from |
| The EV column header reads **`EV (Divine)`** and the cell holds the figure alone | `div` after every figure | *Divine* is verbatim-only, so the page spells it or states it once in a header. Twenty repetitions of an invariant unit is noise in an 84px column |
| The item level is spelled out in the Raw Base row's note — *uncrafted at Item Level 82* | `ILVL 82` | *Item Level Floor* is verbatim-only. `ILVL` is an abbreviation the Glossary does not license. *This row said "the Raw Base tag reads `RAW BASE`" until revision 3; the tag retired, but the rule it protected did not — the item level was never in the tag, and it is still spelled in the note* |
| **entries not reached in the last sync pass** | "in this Chunk" | *Chunk* is back-end-only, and this is a **figure-group label** — read at a glance, in the page's voice. The rule stood on audience until memlog 206 and now stands on register: the same panel carries diagnosis in the file's words, and the two may not be written as one |

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

**The edit date says which clock it came from** `[decision — memlog 209]`. A
committed date prints bare. A date read from the file's last change, because the
Tracked List has no commit history, prints with the suffix `(not committed)`,
verbatim. The suffix is plain text in the fact's own ink, with no mark and no
colour: it is still attribution, not a health signal. With neither date, the
field reads *unknown* (FR-18, AD-12, AD-9).

**A missing file is named in the strip** `[decision — memlog 213]`. Each absent
tolerable artifact (AD-24) adds one line inside the strip, after line two and
before the health line. The lead is `Not published`, and the three bodies are
verbatim:

| Absent file | Body |
|---|---|
| `weights.json` | `weights.json — every crafted class is unrankable.` |
| `recipes.json` | `recipes.json — no crafted rows can be ranked.` |
| `sync-report.json` | `sync-report.json — the sync report is unavailable.` |

The lines carry no mark and no colour, like the five facts above them. AD-24
makes each file absent-tolerable, so its absence is attribution and not a health
signal, and a marked line would read as a fault in a state the page is built to
tolerate. The line gives the reason once, and nothing else on the page repeats
it: not the appendix (state 37) and not the *unknown* fields. The committed
deploy publishes `recipes.json` with no recipe in it (story 2.7 Decisions), so
no absence line prints there. The masthead dek says why no crafted Item Class is
ranked in that state. When `recipes.json` is absent, the absence line says why.
The dek and an absence line do not repeat one fact: the dek states what Epic 2
ranks (a capability), and the absence line states which file is missing (a
cause). `DESIGN.md`, Components, owns the treatment and the budget line.

**The masthead eyebrow** reads `League {activeLeague}` and nothing else. **The
Craft Recipe left it at revision 3** `[decision — memlog 181]`, and the open item
memlog 107 recorded is resolved rather than carried.

Through revision 2 the eyebrow printed the single recipe as its composition, with
a note saying that would "not survive a second" recipe. FR-26 now ships two and
the player chooses between them, so the recipe is a **control** and the eyebrow
is **attribution** — the line that states what the page was built from. The same
argument that keeps the tracked-list edit date out of the health signals keeps a
control out of the eyebrow: a thing the player turns does not belong in a line
that describes what he was given.

**The Epic 2 masthead dek** reads `The Base Types worth selling raw, ranked by
price. Crafted Item Classes are not ranked yet. Every figure is in Divine.` This
document owns that text `[decision — human, 2026-09-27,
spec-epic-2-retro-item-19, Decision]`. The copy states what the page ranks, not
which files are published, so it is true in every Epic 2 state: Epic 2 ranks no
crafted row even when recipes are present. *Yet* carries the reason, because the
crafted ranking is Epic 3's. In the committed state (a published `recipes.json`
with no recipe) the dek is the one place that says why no crafted Item Class is
on the page. The dek never names a file. Epic 3 rewrites the dek when it ranks
crafted rows.

**What `{components.craft-recipe}` prints, and why nothing is invented.** Memlog
107's problem was real — `recipes.json` declares no display string — and it turns
out not to need one. v1's two recipes are *one greater transmute + one greater
augment* and *one perfect transmute + one perfect augment*, so the orb grade is
the whole difference between them. The control prints that one distinguishing
word, `greater · perfect`, with the active one set solid. The word is lifted from
the composition the Glossary already words, so no name is coined and no contract
is assumed. **The limit travels with the rule:** it holds while every recipe in
`recipes.json` reduces to a distinct single word, and a recipe that does not is a
copy decision nobody has taken. It must not be settled by inventing a name.

**Money figures read at 2 decimal places** `[decision — memlog 85]` — EV, price
and the threshold alike. `core` persists 4dp and the page never re-rounds
anything it passes on. A figure that is genuinely present, non-zero, and rounds
to `0.00` renders **`< 0.01`** — that is a quantity, not a missing figure, so it
is never a money-slot phrase.

**Craft Cost is printed once, and its copy is fixed** `[decision — memlog 182]`.
The line under `{components.craft-recipe}`'s options reads `N.NN Divine / craft`
at the page's 2dp — the page's only printing of Craft Cost (FR-26). *Divine* is
spelled, because it is a Glossary term and the page either spells it or does not
print it. *per craft* is written `/ craft` because the cell is 216px wide and the
slash is the one abbreviation the page's own rule allows: it shortens no Glossary
term. Where the recipe is **uncostable** the line holds the money-slot phrase
*no figure yet* and never a number (FR-26, AD-20).

**The figure is set apart from its unit** `[decision — memlog 194]`. The figure
takes `{typography.recipe-cost-figure}` — 13px serif — and `Divine / craft`
stays at `{typography.recipe-cost}` in `{colors.ink-secondary}`, borrowing
`{components.payout-threshold}`'s figure-plus-quiet-unit anatomy. The whole line
was 9.5px sans through revision 3's first draft, which made **the figure that
validates every EV on the page less legible than a rank numeral**. Craft Cost is
subtracted once per Item Class and sits under every crafted EV in the ranking, so
if it is wrong or stale the whole crafted branch is wrong — and this is
deliberately the only place it is printed. The *no figure yet* fallback keeps its
italic sans treatment: a serif figure against an italic sans phrase is itself the
signal that one is a quantity and the other is an open question.

**Provenance is spoken twice.** The enum value is the contract. The mark carries
a plain-English word beside it — `uniform-prior` reads *prior only*, `absent`
reads *unknown*. The word is not a
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
recognisable once it is read. **What makes it recognisable *before* it is read is
the mono verbatim register** `[decision — memlog 208]`, which sets text the page
quoted out of a file rather than wrote, and which this fallback shares with the
cross-file diagnosis below. It takes no ink: an ink states that a figure's
footing is degraded or broken, and an uncurated entry states nothing about the
figure (`DESIGN.md`, Typography and Colors, which own the treatment).

`[NOTE FOR UX]` `[memlog 143, re-derived]` **Two Combinations can still read
identically.** The note was written on the `4.x` reading, in which FR-22 had the
curator track an **interior cell** and one tier could hold several. Contract
`5.0.0` withdrew that mechanism: an entry is a tier again, and FR-22 now has the
curator track a whole tier or a run of adjacent tiers. **The hazard survives the
mechanism that produced it.** The page prints the curator's declared
`acceptedTier`, and nothing requires two tracked bands of the same modifier on
the same Item Class to declare different ones. The value text used to tell them
apart, and the tier does not. Rule 3 above guarantees uniqueness across the
short-form **table**,
which does not reach this case. The specimen data avoids it only because every
band in it landed in a distinct tier. Nobody has ruled on what the second one
prints.

**What may be cut, and what may not** `[decision — memlog 103]`. Truncation is
legitimate only where the text has somewhere to go. A chase cell and a unit name
sit above an expansion holding the same content in full, so an ellipsis there
costs a click and nothing else. **The expansion is the bottom of the page**:
nothing sits beneath a `{components.combination-row}`, so nothing in one may be
cut — no ellipsis, no truncation, and no tooltip standing in for text that did
not fit. **A trust mark and a unit glyph may not be cut either**, for the same
reason and one more: in each case the mark *is* the non-colour cue (memlog 41,
184), so a shortened one fails the legibility rule rather than merely reading
badly. In the unit cell that has a concrete consequence — the glyph is
`flex: 0 0 auto` and **the name yields first**, so a long Item Class or Base Type
name ellipsises while the glyph never does. This principle governs every
truncation question this document does not answer directly.

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
| `{components.ranked-row}` | Ranked list | The whole row is the target and it **toggles**: click anywhere opens `{components.expansion-panel}` for that row's unit, click the same row again closes it. No per-row controls, no hidden actions, nothing revealed on hover. An open row keeps `{components.ranked-row}`'s `openMarker` while any other row is hovered, so the source of an open panel is identifiable at all times. **Every row opens with its unit glyph** — `{components.unit-glyph-class}` on a crafted row, `{components.unit-glyph-raw}` on a raw one — and the glyph is never omitted and never truncated (FR-3). Rank, EV and the Chase Combination set are all recomputed when the Payout Threshold changes **and when the active Craft Recipe changes** (FR-1, FR-26). EV displays at 2dp, or `< 0.01` for a real figure too small to print. |
| `{components.ranked-row-tier-1}`, `{components.ranked-row-tier-2}`, `{components.ranked-row-tier-3}` | Ranked list | Purely a function of rank position after a ranking pass. Tiers move when the list reorders. They are not sticky to a unit, and they say nothing about which branch a row is on — a Raw Base can hold rank 1 and take tier 1 like any other row. |
| `{components.unit-glyph-class}`, `{components.unit-glyph-raw}` | Every ranked row · appendix rows · expansion titles | Inline text, not interactive, no tooltip, no click target — the same rules a trust mark takes. **They are not trust marks**: they carry `{colors.sepia}` and say which unit the row names, never that something is wrong. Unlike a trust mark, a unit glyph is **never absent** — silence-means-healthy governs health signals, and a unit is not one, so there is no such thing as a row quiet about which unit it is. **They are the page's only wordless glyphs, and they carry no key-block entry** — see below. Both sit in one **fixed 14px box** so every unit name starts at the same x whatever branch the row is on; without it the two glyphs' different advances left a 3.3px ragged edge down the page's primary scan column `[decision — memlog 195]`. |

**The unit glyphs stand without a word, and that is a departure worth stating**
`[decision — memlog 184]`. Every other glyph on this page comes with a word: a
trust mark is *glyph, hair space, word*, and a `{components.price-state-glyph}`
never appears without its Price State spelled beside it. These two do not, and
they get no `{components.key-block}` entry either.

Three reasons, and the first is the user's own. **The player knows the
difference** — that was the direction, and it is not a guess about an audience:
there is exactly one user, he wrote the Tracked List, and telling him that *Bow*
is a class and *Stellar Amulet* is a base is telling him something he authored.
Second, **a word here would undo what the glyph bought.** The point of retiring
`RAW BASE` was to stop spending a cell on a fact the player reads instantly;
pairing the glyph with `ITEM CLASS` would reinstate the cost and add one to the
crafted rows that never had it. Third, **the key block earns its place on
ambiguity, and there is none here.** It exists because silence-means-healthy
makes an *empty* cell ambiguous (memlog 42). A unit glyph is never empty and
never optional — every row carries exactly one of two marks — so there is no
silence to disambiguate and nothing a legend would resolve.

*What this does not license.* It is not permission to drop the word from any
other glyph. Every remaining glyph on the page marks a **state**, and a state is
exactly the kind of thing a reader cannot infer from the row it sits on. A unit
can be inferred from the name beside it; the glyph makes that instant rather than
making it possible. That is the whole distinction, and a glyph that fails it
takes its word.
| `{components.raw-base-row}` | Ranked list | Ranks in the same list as crafted rows (FR-3) but at its own asking price, not a craft outcome, and it names a **Base Type** where a crafted row names an Item Class. Three cues, none load-bearing alone: the `{colors.paper-raw}` tint, the italic name, and `{components.unit-glyph-raw}`. *The `RAW BASE` word tag retired at revision 3 and the glyph took its job* `[decision — memlog 184]` — the count of cues is unchanged and NFR-10 still holds, because a glyph survives the removal of colour and colour-coding would not. **A Raw Base carries no Provenance mark**, and that is not an omission: it needs no Eligible Pool (FR-4), so there is no pool for a Provenance value to come from, and the cell is empty exactly as a healthy crafted row's is. **Expanding it shows one `{components.combination-row}`** `[decision — memlog 71]`, for the degenerate Combination of no affixes. Line one carries the same Price State and listing sample count as any other entry. Line two carries both labelled ages, each in its own cell. Its note is declared `[decision — memlog 117]`: `no affixes — this Base Type priced as it drops, at Item Level 82`. A Raw Base is a Tracked Entry and it has a Combination. An empty expansion would strand its exact ages, and those ages are what the FR-12 override promised to put here. **Below-threshold Raw Bases:** a Raw Base whose asking price is under the Payout Threshold leaves the *ranking* altogether. It is not ranked at its price, so it is absent from the top 20 **and** from the grown list behind the list affordance. Truncation is not what hides it, and it does not reappear further down. |
| `{components.column-header}` | Above the list | Static. Columns are **not** sortable — the one ordering is EV under the active threshold **and the active Craft Recipe**, and a second ordering would make the page a spreadsheet. The second header reads `Item Class / Base Type` and names both units, because the column holds both (FR-3). **A column header never ellipsises and is never trimmed to fit** `[decision — memlog 119]`. `PROVENANCE` is the **tightest fit** — it sits inside the widened `{spacing.col-provenance}` with room to spare, and the letter-space trim that used to buy it room is dropped. `ITEM CLASS / BASE TYPE` is the **longest label** and clears `{spacing.col-unit}` comfortably; the two are different measurements and revision 3 separated them. |
| Trust marks — `{components.trust-mark-prior}`, `{components.trust-mark-unknown}`, `{components.trust-mark-stale}`, `{components.trust-mark-never}`, `{components.trust-mark-unresolvable}` | Rows, appendix, expansion | Inline text, not interactive, no tooltip, no click target. A healthy row renders **no mark element at all** — the cell is empty, not filled. Five marks exist. A sixth needs a decision — and the two unit glyphs do not make a sixth and a seventh, because they carry no ink and mark no state. A Provenance mark carries **one label per Item Class** and belongs to the ranked row: every combination row inside one expansion carries that same label, so the mark is never repeated there (FR-10, FR-11; AD-10). |
| `{components.price-state-glyph}` | Expansion rows | Always accompanied by the Price State's name in words. The glyph never appears alone and never substitutes for the word. |
| `{components.money-slot}` | Any cell where a figure is missing | Holds a short phrase naming which question is open, never a number-shaped placeholder. See Epistemics. |
| `{components.craft-recipe}` | Masthead, inboard of the threshold | The page's **second ranking dial** (FR-26) `[decision — memlog 181]`. Two options on one line, each the single word that distinguishes its composition — `greater | perfect`, divided by the trust strip's pipe rather than the page's middle dot, which joins two affixes in every chase cell and would carry the opposite operator here. **Both words carry a rule at rest and they carry different ones** `[decision — memlog 191]`: the inactive word takes the page's dotted sepia *this is clickable* mark **at rest**, going solid on hover exactly as `{components.expand-affordance}` does; the active word takes a 2px solid sepia rule, doubled so it cannot be read as `{components.payout-threshold}`'s 1px solid *you are hovering this* on the sibling panel 16px away. **Clicking the inactive option makes it active**; the active option is not a click target, because there is nothing to switch to, and it carries no dotted rule because dotted means *you can click this*. The switch re-ranks synchronously against the already-loaded artifacts, exactly as a threshold change does: no network request, no sync (FR-1, AD-24). It is **not debounced** — a click is a discrete, deliberate act, where a keystroke is one of several on the way to a value. A recipe change reorders the list *and* rewrites every crafted row's Chase Combination set, because a recipe changes which outcomes are reachable rather than only what an attempt costs (FR-26). **A Raw Base row does not move** relative to its own price, since a Raw Base has no Craft Cost — but its *rank* can change as crafted rows move around it. Craft Cost for the active recipe prints beneath the options, at 2dp, in Divine — the page's only printing of it (FR-26). An **uncostable** recipe (no current rate for a currency in the active league) shows *no figure yet* there and never a zero (FR-26, AD-20). **The active recipe persists across a reload** — see *What survives a reload*. |
| `{components.payout-threshold}` | Masthead | **The figure is the input** `[decision — memlog 73]` — click the large serif number and type over it. No field, no box, no form chrome. The `Divine` suffix sits outside the editable region and cannot be typed over. Re-ranks on every valid parse. Constraints `[decision — memlog 74]`: min `0`, max `3`, step `0.05`, two decimals, clamped on blur — a negative threshold is not enterable. **The track and marker survive as a non-interactive readout**: they answer "where does 0.50 sit in the range I have", the marker cannot be dragged, and the track cannot be clicked. |
| `{components.trust-strip}` | Under the masthead | Carries **five plain facts, unconditionally**, with no mark and no colour on any of them. Line one carries `producer.id`, `generatedAt` and `gamePatch` (FR-10). Line two carries the last-synced time and the **tracked-list edit date** (FR-18) `[decision — memlog 89]`. Always present, never dismissible. `[ASSUMPTION — memlog 59]` Otherwise silent while fine — no counts of nothing, no "0 unresolvable", no green tick. **Loud when wrong** `[decision — memlog 70/88]`: it raises a third line carrying a rust mark with its glyph, its word **and its count**, on exactly two triggers that share the one line — `× N unresolvable` (FR-24) and `× pinned entries starved this run` (FR-17, FR-25). The line costs `{spacing.frame-reserve-health-line}` and is charged to the resting budget, because data raises it and no click does. **An absent tolerable artifact adds a plain `Not published` line** after line two and before the health line, with no mark and no colour `[decision — memlog 213]` (state 38). **The whole strip is the click target** and it toggles `{components.sync-report-panel}`. |
| `{components.sync-report-panel}` | Opened from the strip | The full Sync Report — **six groups in three columns** `[decision — memlog 206]`: *the sync run* (requests per source, and entries not reached **in the last sync pass**), *what is broken* (the unresolvable count, FR-24; the pinned-starvation records, FR-17/FR-25; **and the cross-file check diagnosis**, state 27), *what the weights cover* (pool coverage as a fraction **with its denominator**, FR-4). *It was five groups until revision 4.* The sixth is the only one that is not a figure — it is a list, one line per failing check naming the check, the entry and that entry's canonical key — and it is therefore the only group whose length is unbounded, which is why the panel's cap is what makes it placeable at all. The first column is what the run did, the second what broke, the third how much of the Tracked List the weights can speak to. **One heading per column, never per group** (`columnHeadingRule`): a column carrying two groups prints its heading once and separates the groups by vertical space — no second heading, no rule, no bullet. **The tracked-list edit date is not repeated here** `[decision — memlog 89]`. It is a resting fact on the strip two lines above. This panel holds what the resting page cannot show, so it does not restate what is already on screen. `[ASSUMPTION — memlog 59]` Opens **in place**, pushing the asking-price line, the list and the appendix down — not a modal, not a drawer, not a second surface. Closed on every load. Figures are read from `sync-report.json` and never recomputed by the page. A coverage figure the report omits reads *not measured* while a weights envelope is loaded, and *unknown* without one `[decision — memlog 212]`. |
| `{components.asking-price-line}` | Under the trust strip | Always rendered, in every state including the honest-empty one. Never dismissible. |
| `{components.uniform-prior-banner}` | Above the list | Raised by a data condition, never by a build flag (FR-11). Dismiss is per session only — it returns on the next page load while the condition holds, and it lowers itself the moment any `measured` figure appears. |
| `{components.unrankable-appendix}` | Foot | The count is readable without expanding anything (FR-4). Rows are not interactive and do not expand — an Unrankable Item Class has no ranking to explain. **Every row here is an Item Class**: unrankability governs the crafted branch only, a Raw Base needs no Eligible Pool and ranks regardless (FR-4), so a Base Type never appears in this appendix. An Item Class sitting here may still have Base Types ranking on the raw branch; where it does, its note **names that fact and not a rank** — a class holds several Base Types, they do not rank together, and there is no single position to point at. The appendix's prominence is a UX decision as of revision 3, not a coverage band: the page never switches layout on a measurement `[change — memlog 185]`. **With no rows it shows its title alone**, the count in ink, and says nothing about why `[decision — memlog 214]` (state 37). |
| `{components.key-block}` | Above the foot | Always rendered, in every state. It is what makes an empty cell mean something (memlog 42) and is not an optional legend. **It covers the resting page only** `[decision — memlog 114]`. It is deliberately not extended to the expansion's four Price State glyphs. Every glyph always appears beside its word, so nothing there is unreadable without a legend. Four more marks on the resting page, to explain a surface one click away, would cost quiet for no gain. The block exists because silent-when-fine makes an empty cell ambiguous, and that ambiguity belongs to the ranked list alone. |
| `{components.expansion-panel}` | Click a ranked row | Lists **every** Tracked Entry on the Item Class, priced or not, above or below the threshold, including `pruned` tombstones (FR-8). A Raw Base row expands to the single entry it names. Its title carries the row's unit name led by the same glyph the row carries. Repeats the active threshold **and the active Craft Recipe**, plus the asking-price framing, so a panel read on its own cannot be misread — from revision 3 the recipe is the second thing the figures depend on, and naming only the threshold would repeat half the panel's own context. |
| `{components.combination-row}` | Inside the expansion | **Two lines under one hairline** `[decision — memlog 101]`, and the two-line shape exists in the expansion only — the 28px ranked row is untouched. *Line one, the figure:* the Combination — **tier plus short form, never the value**, the same reading as the chase cell `[decision — memlog 134]` — the Price State with its glyph **and** its word, the price in Divine or a money phrase, and the listing sample count. *Line two, the evidence:* the note, then **both labelled ages in their own cells** — the observation age (*priced 11h ago*) and the last-attempted age (*tried 4h ago*). Each says which clock it reads, so the two are never collapsed (FR-12). Line two is **always present**, so rows scan evenly down the expansion. It **wraps rather than truncating**: a long note grows the row by whole `{spacing.combination-row-line-2-height}` lines, which is why `{spacing.combination-row-height}` is a minimum and not a height. That arithmetic holds only because line two is set in `{typography.combination-line-2}` `[decision — memlog 115]`, whose `lineHeight` is **absolute**. The wrap quantum equals the declared token, so a builder never has to compute it and the spine's `48 + 20n` stays literally true. Below-threshold entries are marked by the note reading *below the threshold — adds nothing to EV*. They are never greyed out and never hidden. |
| `{components.trade-link}` | Inside a `{components.combination-row}`, including the Raw Base's | The ↗ glyph, and only the glyph, is the click target. A click opens that Combination's trade-site search in a new tab. **It appears where the entry carries a stored `lastSearchId` and that search ran against the active league** (PRD FR-33, FR-21; AD-9, AD-24). The test reads the stored field, never the Price State. Most `priced`, `no-listings` and `unresolvable` rows therefore carry it. A row the syncer never issued a search for has no id, and a row whose last search ran in a previous league has an id the page will not use. Absence is absence: the cell is blank, not greyed and not disabled-looking. It never appears inside `{components.tombstone-band}` — a pruned entry has no market worth checking. It does not affect page state. The page is unchanged when the tab closes. |
| `{components.tombstone-band}` | Inside the expansion | Collapsed by default behind a `+ N pruned` toggle (memlog 25). Toggling is local to that panel and resets when the panel closes. A tombstone row keeps line one's shape — Combination struck through, `† pruned`, *not tracked* in the money slot. It takes **its own line-two contract** `[decision — memlog 116]`: the prune reason in `{spacing.col-combination-note}`, then `{spacing.col-tombstone-removed}` reading `removed YYYY-MM-DD`. It does **not** borrow the two age cells. A removal date is a calendar fact about a decision somebody made. It is not a reading of `observedAt` or `lastAttemptedAt`, and a cell whose whole contract is *say which clock this is* would make it look like one. |
| `{components.expand-affordance}` | Below row 20 · tombstone toggle · trust strip · fetch-failure retry | Plain text affordance, one vocabulary everywhere it appears — and from revision 3 that is literally true rather than nearly true `[decision — memlog 196]`. Every openable thing on the page opens with `+` and closes with `−` (U+2212, not an em dash). The tombstone toggle used a `▸`/`▾` disclosure triangle until then, which was both a second vocabulary and a glyph that fell out of the page's typeface. **The list affordance** reads `+ Read the remaining N rows` closed and `− Show only the top 20` open, so the player knows the size of what is behind it and can put it back. **It names no unit**: the remainder holds Item Classes and Base Types together (FR-3), so either noun would misdescribe half of it. It read `N Base Types` until revision 3. It **grows the list in place** to the full ranked length — it does not replace ranks 1–20 and it does not page. Ranks 21 and beyond all take `{components.ranked-row-tier-3}`. The three tiers describe the top ten and nothing below needs a fourth. `{components.unrankable-appendix}`, `{components.key-block}` and `{components.running-foot}` stay below the grown list in the same order. This growth is clicked, so it may push the page into scrolling. |
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

Three values, weakest first, and two of them are visible:

| Provenance | On a ranked row | Why it must not collapse |
|---|---|---|
| `measured` | Nothing at all | See *Silence means healthy* |
| `uniform-prior` | `{components.trust-mark-prior}` — *prior only* | Someone invented this weight, and the page says so |
| `absent` | `{components.trust-mark-unknown}` — *unknown* | An upper bound, not an estimate. It renders as an unknown and never as a number (FR-4) |

**There were four, and the fourth was removed rather than merged.**
`modelled-split` — *split by model*, a measured weight a model had spread across
a value interval — had exactly one source, the producer's value decomposition.
Weights contract `5.0.0` withdrew that decomposition, so the value became
unreachable (PRD §3 *Provenance*, FR-10; AD-10). **It was not folded into
`uniform-prior`.** The two say opposite things about where a number came from:
`prior only` says somebody invented this weight, and a `modelled-split` weight
was measured and then redistributed. Merging them would have had the page accuse
a measured weight of being invented, which is a worse lie than the one the mark
existed to prevent. The value retired, and the `trust-mark-split` component and
its ink retired with it — both are gone from `DESIGN.md`, so neither resolves as
a token any more. If consumer-side pro-rating is ever adopted, a middle
value must return in that same change (AD-10's revisit condition).

`absent` cannot occur on a ranked row: a `partial` pool makes the **Item Class**
Unrankable, so `absent` is exercised only inside
`{components.unrankable-appendix}`, with the same mark vocabulary (memlog 44).

**A Raw Base row has no Provenance at all**, which is a third case and not a
fourth value. A Raw Base needs no Eligible Pool (FR-4), so nothing propagates to
it and its Provenance cell is empty — indistinguishable on screen from a healthy
crafted row's, and correctly so. Both empties mean *nothing here is degraded*.
The `{components.key-block}`'s *Silence means healthy* column is what keeps that
legible, and it is one more reason the block is mandatory rather than a legend.

`core` propagates the weakest Provenance and the oldest timestamp of every input
into each derived figure, **with no exception**. The numerator-only rule retired
with the value it governed. The page displays what it is given and computes no
ranking term itself (AD-4).

**The mark discriminates between Item Classes, never within one**
`[decision — memlog 180, re-deriving memlog 175]`. A probability's inputs are
**pool-wide** — every entry in its scoped pool, numerator and denominator alike
— so one tier carrying an invented weight anywhere in that pool makes **every**
probability on that Item Class read `uniform-prior`, however many of the pool's
other tiers were published (PRD FR-10, FR-11; AD-10). One Item Class therefore
carries one label.

**The argument was made on the wrong noun at revision 2, and the correction
strengthens it.** Memlog 175 reasoned that a ranked row *is* a Base Type, so the
Provenance column marked exactly the unit it could speak about. PRD revision 18
moved the crafted branch to Item Classes (FR-3), which would have broken that
reasoning if the mark's granularity and the row's had come apart — and they have
not. **A modifier pool belongs to a class** (AD-11, PRD §3 *Item Class*), so a
Provenance label was always a per-class fact; at revision 2 it was being carried
on a unit one rung finer than the fact it described. At revision 18 the two
coincide. The column does not merely still earn its place — it earns it on the
unit the propagation rule actually has. The comparison the mark supports — this
ranked row rests on measured weights, that one does not — is still the comparison
the ranking already asks the player to make.

Two consequences the builder must not get wrong:

- **The mark is never repeated inside an expansion.** Every combination row in
  one panel carries the same label by construction, so a per-row Provenance mark
  there would repeat one fact eight times and discriminate nothing — the failure
  FR-11 exists to prevent, one surface further down.
- **A `prior only` badge does not mean the pool is invented.** It states the
  **weakest** input and never the pool's general condition. The honest reading is
  the literal one: something in this pool was invented, and the figure inherits
  it. The page must not word the mark, the key block or the banner in a way that
  says more.

### The uniform-prior banner

Raised while **no probability in the loaded set carries `measured`** — that is,
while every probability is `uniform-prior` or `absent`. It states that the
entire ranking rests on a uniform prior and that relative ordering between Item
Classes is not evidence-backed, and it points the player at per-row freshness
instead. It lowers itself when the condition stops holding, so nobody has to
remember to take it down. The per-row mark is required either way (FR-11), and a
`prior only` row still carries its mark while the banner is up.

**It needs a ranking to speak about** `[decision — memlog 213]`. The condition
above is vacuously true when no crafted row is ranked, which happens when
`weights.json` or `recipes.json` is absent, and in the committed state, where
`recipes.json` is published with no recipe. The banner is not raised then. Its
sentence would be false, because no ranking rests on a prior when no crafted
ranking exists. When a file is absent, the trust strip's absence line already
says why. In the committed state, the masthead dek says why. The banner stays
down in every case. This also sets the co-occurrence bound in `DESIGN.md`'s
vertical budget.

**What lowers it is one wholly published pool, and the page claims nothing about
how likely that is.** Because Provenance propagates pool-wide, an Item Class reads
`measured` only when **every** entry in its scoped pool was published — a single
invented tier is enough to hold the banner up across the whole loaded set. So
the banner is not a build-time placeholder that the first real file will
obviously clear, and it is not the rarity a per-tier reading of `weightSource`
would have suggested. It is a function of the data with a stated condition, and
what the first conforming file does to it is unknown until one lands. The page
reads the condition and says nothing else `[ASSUMPTION — the banner's frequency
is unmeasured; only its condition is specified]`.

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

One exception: while the list is honest-empty (state 23), every list-row EV cell
reads *no figure yet*, `no-listings` rows included. The expansion keeps the
table's phrase.

### Sync health — quiet, but on the page

`[decision — memlog 57, superseding 26]` Sync health is two states, not two
places. **At rest** the strip carries five plain facts — `producer.id`,
`generatedAt`, `gamePatch`, last synced, and the tracked-list edit date — plus
the health line above when something is broken. **One click** opens
`{components.sync-report-panel}` with the figures behind those signals:
per-source request counts, entries not reached in the last sync pass, the
pinned-starvation records, the unresolvable count (FR-24) and the measured
pool-coverage fraction with its denominator (FR-4).

**A missing coverage figure** `[decision — memlog 212]`. When `weights.json` is
loaded but `sync-report.json` carries no coverage figure, the panel reads *not
measured*. When `weights.json` is absent, it reads *unknown*. It is never `0`
and never marked. The page tells the two apart by the weights envelope it
loaded. The first case lasts only until `sync` measures coverage (Story 3.6).

This is what satisfies FR-25's own argument that "a report field that nothing
renders is a field that nobody reads", without putting operational counts in
front of a player who is trying to read a ranking. `[event — memlog 58]` The
coverage fraction therefore has an on-screen home again, which means a coverage
drop across a game patch is visible in the product rather than only in
`sync-report.json`.

Nothing in the panel is computed by the page. It renders `sync-report.json` as
published.

### Two registers in one panel

`[decision — memlog 206]` State 27's cross-file diagnosis lands here, and that
makes `{components.sync-report-panel}` the one region on the page carrying **two
registers at once**. The boundary is drawn here so a builder does not have to
guess at it, and so the vocabulary rules above stay coherent.

**The page's voice** — every figure group. Counts, fractions with their
denominators, and labels written as the player would say them: *entries not
reached in the last sync pass*, never *in this Chunk*. This is the register the
whole rest of the document is written in.

**The file's voice** — the cross-file diagnosis, and nothing else. One line per
failing check, naming the check, the entry and that entry's canonical key. Here
the back-end-only nouns are licensed, because the text is a string he copies into
an editor rather than a sentence he reads.

**The rule.** The two are visibly different kinds of thing, and the cue is **not
a semantic ink.** An ink states that a *figure's* footing is degraded or broken
(`DESIGN.md`, Colors); a failing cross-file check says nothing about any figure
on this page — the affected Item Classes are already in
`{components.unrankable-appendix}` carrying their reason. So the boundary takes a
**non-colour** cue, and it is settled `[decision — memlog 208]`: **the diagnosis
alone is set in the mono verbatim register**, which means *the page did not write
this text* and is reserved to that meaning. Every figure group keeps the page's
voice and its existing face. The register takes the panel's own size, weight and
line height, so nothing in the panel's cap or its internal scroll moves
(`DESIGN.md`, Typography, which owns the treatment).

*One cue, because it was one question.* This was held open jointly with the
curation fallback's, for the identical reason, so that it could not be answered
twice with two different cues (memlog 138). It is answered once, and the two
surfaces now carry the same register because they print the same kind of thing:
machine text, quoted. **The diagnosis is the case that proves the cue** — it is
there to be selected and pasted into an editor, and mono is the form that says
so, while also making a serialised canonical key legible in a way a proportional
face does not.

One consequence that is settled: the diagnosis is never promoted out of this
panel. It does not reach `{components.trust-strip}` — the strip has exactly two
health triggers (memlog 88) and a cross-file failure is not a third, because the
player already sees its result as Unrankable rows he can count without expanding
anything (FR-4).

## State Patterns

→ [`mockups/key-hero-resting.html`](mockups/key-hero-resting.html) shows states
11, 12, 17, 18, 30 and 31 together on one page, which is the point: the marked
rows have to be findable among the silent ones.
[`mockups/key-expanded-states.html`](mockups/key-expanded-states.html) shows
states 1 to 7, 10, 20 and 32. The remaining states are specified here and
nowhere else, by decision — see memlog 98.

**Both mockups were re-rendered at revision 3** against these spines, unlike the
revision-2 pass which deliberately left them stale (memlog 178). They now carry
the Item Class unit, both unit glyphs, `{components.craft-recipe}` with its Craft
Cost line, and the corrected reason string, and they no longer depict the retired
`modelled-split` mark. The standing rule is unchanged and still governs: **the
spine wins on conflict with any mockup**, because a mockup illustrates one
dataset in one state at one moment.

| # | State | Where | Treatment |
|---|---|---|---|
| 1 | Price State `priced` | `{components.combination-row}` | **Line one:** `●` plus the word `priced`, the figure in Divine at 2dp, the listing sample count. **Line two:** both clocks in their own cells — *priced Nh ago* and *tried Nh ago* |
| 2 | Price State `no-listings` | Combination row | **Line one:** `○` plus the word, `{components.money-slot}` *an open question*, `0 listings found`. **Line two:** note *nobody is listing this right now — a jackpot and junk look alike here*, then both clocks |
| 3 | Price State `not-yet-synced` | Combination row | **Line one:** `∆` plus the word **and its reason**, money slot *no figure yet*, `no sample`. **Line two:** the reason's note (states 5–7), then whichever clocks exist |
| 4 | Price State `unresolvable` | Combination row, and surfaced not omitted | **Line one:** `×` in `{colors.rust}` plus the word, money slot *not valued*, `no sample`. **Line two:** note *its id is gone from the trade API — a patch did this*, then *tried Nh ago*. `[decision — revision 9, 2026-09-27]` One wording for every `unresolvable` row, a Raw Base (its Base Type or category id) or a Combination (a stat id). The note does not name the id kind, because the row already names what it prices |
| 5 | reason `never-synced` | Combination row | Rendered *never attempted* — **the one row with no age at all**, so both age cells on line two are empty rather than filled. Note: *no request was ever issued for this entry* |
| 6 | reason `league-mismatch` | Combination row | Note: *the observation belongs to another league*. Treated as absent, never as stale-but-usable. The attempted clock still shows |
| 7 | reason `no-exchange-rate` | Combination row | Note: *the listing currency had no rate at sync time*. There is no "priced but not convertible" state. The attempted clock still shows |
| 8 | Curation Status `active` | Expansion | No marking. It is the ordinary case |
| 9 | Curation Status `pinned` | Expansion | `[decision — memlog 199]` Marked on its `{components.combination-row}` by `{components.curation-status-pinned}` — `* pinned`, **leading** line one ahead of tier plus short form. It takes no semantic ink and no sepia: an ink states that a figure's footing is degraded or broken and a Curation Status states nothing about the figure, and sepia carries operator choice, which this is not (`DESIGN.md`, Colors). **It is a lookup key, not a badge.** `{components.trust-strip}` raises `× pinned entries starved this run` (FR-17, FR-25) and names no entries, so this mark is what the player scans open expansions for afterwards — which is why it leads the cell and sits at `600` rather than being quieted to a tertiary decoration |
| 10 | Curation Status `pruned` | `{components.tombstone-band}` | Collapsed behind `+ N pruned`. Opened: line one is the Combination struck through with `† pruned` and *not tracked* in the money slot. Line two is the prune reason and `removed YYYY-MM-DD` in `{spacing.col-tombstone-removed}` — **not** the two age cells `[decision — memlog 116]`, because a removal date is not a reading of either clock |
| 11 | Provenance `measured` | Ranked row | Nothing. The empty cell is the statement |
| 12 | Provenance `uniform-prior` | Ranked row | `{components.trust-mark-prior}`, carried by **every** crafted row whose Item Class has one invented tier anywhere in its scoped pool |
| 12a | Provenance, Raw Base row | Ranked row | **Nothing** — the cell is empty, as on a healthy crafted row. A Raw Base needs no Eligible Pool (FR-4), so no Provenance propagates to it. Not a fourth value and not a gap |
| 13 | Provenance `absent` | Appendix only | `{components.trust-mark-unknown}` |
| 14 | Unrankable — `pool partial` | Appendix | Reason verbatim, plus a quiet note where one is known (e.g. which slot's pool has no entry for that stat) |
| 15 | Unrankable — `class absent from weights file` | Appendix | Reason verbatim. A freshly scraped class may carry a note that it may return after the next weights run. *This literal moved at revision 3 — see Domain Vocabulary's standing check* |
| 15a | Unrankable — `class disagrees with weights file` | Appendix | Reason verbatim, and **one string for all five cross-file checks** (state 27, FR-4). The distinguishing fact for the player is that this class's pool is `complete` and published — the disagreement is in his own Tracked List, so this is the one Unrankable row he can fix himself. The quiet note may say so; it may **not** name the check, the entry or its key, which are diagnosis and belong in `{components.sync-report-panel}`'s second column (state 27, memlog 206). Lettered rather than numbered, as 12a was, because the state numbers are stable identifiers others cite |
| 16 | Unrankable class whose Base Types still rank | Appendix + ranked list | The Item Class sits in the appendix with its reason. Its note **names the fact, not a rank**: *some of its Base Types rank on the raw branch*. A class holds several Base Types, they do not rank together, and pointing at one position would invent a relationship the list does not have. Those Base Types rank normally in the list, each carrying `{components.unit-glyph-raw}` |
| 17 | Stale row (≥48h) | Ranked row | `{components.trust-mark-stale}`, with the clock said in words |
| 18 | Never attempted | Ranked row | `{components.trust-mark-never}`, italic |
| 19 | Uniform-prior condition true | Banner | `{components.uniform-prior-banner}` above the list, dismissible for the session only |
| 20 | Below-threshold entry | Combination row | Note *below the threshold — adds nothing to EV*. Shown, never hidden, never greyed |
| 21 | Item Class with no Chase Combination | Ranked row | Chase cells empty. Its EV is negative by its Craft Cost and is shown as such, at 2dp, as a real quantity. A negative EV is never a money-slot phrase — the figure is known, and it is bad news rather than missing news. It is **ranked, not Unrankable** (FR-1): a threshold that excludes every outcome is an answer about that class, not an absence of data |
| 22 | Cold load / skeleton | Whole page | Masthead and twenty row slots paint immediately as placeholders in the final layout. The page never jumps (memlog 50). `[ASSUMPTION — memlog 51]` All eight artifacts resolve in a **single transition** — never row by row, because a partly filled list would show a ranking computed from an incomplete dataset. `[decision — memlog 211]` Flat `{colors.paper-inset}` bars with no shimmer, and the column header painted with its final labels. `DESIGN.md`, Components, owns the treatment |
| 23 | Honest empty — league reset | Whole list | `[decision — memlog 48]` Every tracked unit renders in **canonical order** — every Item Class and every Raw Base, each with its glyph — refilling over the following day. After a pure reset every unit carries Price State `not-yet-synced` reason `league-mismatch`. After a **mixed reset** some units already carry a new-league state, such as `no-listings`, and they sit among the others in the same canonical order. `[ASSUMPTION — memlog 49]` Rank numerals are **suppressed** and the list states that the order is canonical and not ranked. Without that the page asserts a ranking it does not have, which is the failure FR-31's honest-empty rule exists to prevent. `[decision — memlog 83]` **The EV cell is not blank.** `[decision — revision 8, 2026-09-27]` **Every EV cell holds *no figure yet*, whatever the row's own Price State.** This includes a row that already reads `no-listings` in the new league. In this state the EV column answers one question for the whole list: the ranking has no figure yet. The row's expansion keeps its own Price State and money phrase (state 2 for `no-listings`), so the observation is one click down and is never lost. This is the only exception to *Money slots*, and it holds only while the list is honest-empty. When one row ranks, every row reads its own phrase again. Assumption 49's "empty rather than zero" was aimed at the zero. Blank is the other thing the money slot forbids |
| 24 | Partially refreshed dataset | Whole list | Renders normally. Per-row freshness is what makes that honest. No global "stale" treatment |
| 25 | Nothing clears the threshold | Whole list | Distinct from state 24 and from state 23, and **it is the one state in this table the player typed** `[decision — memlog 204]`. Every crafted Item Class is still ranked, at an EV of minus its Craft Cost (FR-1) — so this is not an empty list, it is twenty rows carrying the same figure. Raw Bases under the threshold leave the ranking altogether, so the raw branch may be empty while the crafted one is full. **Rank numerals stay.** State 23 suppresses them because its order is canonical rather than ranked; here the order *is* computed and the figures merely tie, and hiding a computed result because it is flat would be the page editing its own answer. A plain declarative sits above the list, under `{components.asking-price-line}`, naming the live Payout Threshold figure at the page's 2dp — the condition, not an instruction. It is not `{components.uniform-prior-banner}`, which is raised by a data condition; this is not one. It is not a `{components.money-slot}` phrase either, because no figure is missing. **A tie of this size needs a declared tiebreak** or the order shifts between loads; AD-17 declares it, so the printed order is fully determined and identical across loads (AD-17) |
| 26 | Schema-invalid artifact | Whole page | `{components.refusal-screen}` replaces everything (FR-33, NFR-8). It names which artifact, which schema version it declared and which the page expects. The player can do nothing here and is not offered a retry — a schema mismatch is fixed by publishing a valid set. One sentence says the page renders again as soon as one exists, and that nothing old is served meanwhile |
| 27 | Cross-file policy check failure | Report, never refusal | **Five checks** — edge alignment, empty containment set, `coOccur` overlap, kind agreement, class discriminability — reported at load (AD-17). *Revision 3 read "four checks, not five", which was a correction aimed at the retired **straddle rule** — tiers overlap freely in the raw data and no band could satisfy it (AD-18, FR-29) — and not at class discriminability, which spine revision 17 added afterwards into the slot that sentence had emptied. Read as a rejection of the fifth check it was not, it argued against a binding rule, so it is struck rather than renumbered.* The page still renders, the affected Item Classes shown as Unrankable (FR-33). **The reason string is `"class disagrees with weights file"`**, FR-4's third, printed verbatim per `{components.unrankable-appendix}` — one string for all five checks, because such a class has a `complete`, published pool and neither of FR-4's other two strings is true of it. **Which check failed, which entry failed it and that entry's canonical key are diagnosis and never appear in the appendix.** **The diagnosis lands in `{components.sync-report-panel}`, as a third group in its second column** `[decision — memlog 206]` — under the existing *what is broken* heading, separated from the unresolvable count and the pinned-starvation records by vertical space alone, per `columnHeadingRule`. It is neither a global region nor inline on the Item Class. The panel is the only home that works: the diagnosis is the one piece of content on the page whose length is genuinely unbounded — one entry per failing check, across as many as every tracked Item Class — and the panel is the one region permitted to cap itself at `{spacing.sync-report-max-height}` and scroll inside its own band. Everywhere else, an unbounded list moves the page. See *Two registers in one panel* below, which is what this ruling costs |
| 28 | Artifact fetch failure (as against invalid) | Whole page | `{components.fetch-failure-screen}` replaces everything and names which of the eight files did not arrive. The player can click `+ Try again`, which re-attempts the whole set. **A partial set is never rendered** — FR-33 requires a single consistent set, and half a ranking is worse than no ranking |
| 29 | Stale Weights File after a patch | `{components.trust-strip}` | The page is static and makes no call to the game or the trade API, so it has **no live patch to compare against** and claims none. What it does is show the `gamePatch` the loaded Weights File declares, beside its producer and `generatedAt`, so the player — who knows which patch he is playing — can see the mismatch himself. Neither a stale weights file nor a stale catalogue breaks the page |
| 30 | Trust strip at rest, healthy | `{components.trust-strip}` | Two lines carrying five plain facts — producer, `generatedAt`, `gamePatch`. Last synced, tracked-list edit date — with no mark or colour on any of them `[decision — memlog 89]`, and nothing else `[ASSUMPTION — memlog 59]`. Affordance reads `+ the full sync report`, right-aligned. This is the state on every load |
| 31 | Trust strip at rest, something broken | `{components.trust-strip}` | `[decision — memlog 70/88]` A third line appears, carrying a rust mark, its word and its count. There are exactly two triggers and they share the one line: unresolvable entries exist (FR-24), and pinned entries starved this run (FR-17, FR-25). Data raises the line, never a click, and `{spacing.frame-reserve-health-line}` budgets it. The five resting facts are unaffected — an old edit date never turns red |
| 32 | Trust strip expanded | `{components.sync-report-panel}` | Opens in place beneath the strip, pushing the regions below it down `[ASSUMPTION — memlog 59]`. Affordance reads `− the full sync report`. Capped at `{spacing.sync-report-max-height}` (400px) and scrolls inside its own band past that. Because that cap sits inside the worst-case resting budget, the strip alone never makes the page scroll, in any data state |
| 33 | Ranked list grown past 20 | Ranked list | `{components.expand-affordance}` reads `− Show only the top 20` and the list holds every ranked unit — Item Classes and Raw Bases alike. Ranks 21+ all take `{components.ranked-row-tier-3}`. The appendix, key block and foot stay below in the same order. Clicked growth, so it may scroll the page. Clicking again restores the top 20 exactly |
| 34 | Craft Recipe switched | Whole list + `{components.craft-recipe}` | `[decision — memlog 181]` The clicked word becomes solid and takes the sepia rule; the other goes tertiary. The list **re-ranks synchronously** against loaded artifacts — no network, no sync (FR-1, AD-24) — and it is **not debounced**, because a click is one deliberate act where a keystroke is one of several. Ranks, EV figures **and Chase Combination sets** all change, since a recipe changes which outcomes are reachable and not only what an attempt costs (FR-26). The Craft Cost line updates with it. Open panels stay open and re-render against the new recipe; nothing closes. Raw Base rows keep their own prices — they have no Craft Cost — but their **ranks** can move as crafted rows reorder around them |
| 35 | Active recipe uncostable | `{components.craft-recipe}` + ranked list | A recipe naming a currency with no current rate for the active league is **uncostable**, never costed at zero (FR-26, AD-20). The Craft Cost line holds the money-slot phrase *no figure yet*. **The note that stood here is closed** `[decision — memlog 205]`, and PRD revision 19 now carries the player-visible half of it (FR-26, FR-5). **Every row stays.** No row leaves the list and no Item Class becomes Unrankable — the appendix would print an FR-4 reason that is false of a class whose pool is complete and agrees with the Weights File. **Each branch keeps its own order and neither is ordered against the other.** Craft Cost is one figure subtracted equally from every crafted row, so the crafted order and the Chase Combination sets are exactly what they would have been — the Payout Threshold compares against a Combination's gross price and never touches the cost (FR-1). What is unavailable is the *distance* between a crafted row and a Raw Base row, which is the missing figure itself. **So no rank numeral spans the two.** Numerals are suppressed, as in state 23 and for the same reason — a numeral is an explicit claim about position and the line below cannot retract it, where vertical adjacency under a stated limit is not a claim. `{components.ranked-row-tier-1/2/3}` run **per branch**, so two tier-1 rows is the correct render and is the only thing left saying *this is the strong end of its order*. A plain declarative sits above the list in state 25's register, naming the active recipe and stating that the two branches are not comparable while it holds. Every EV cell on a crafted row holds *no figure yet*, never `0.00`. **FR-5's bound applies per branch** — up to 20 rows of each, one `{components.expand-affordance}` under each, still naming no unit. The resting page can therefore hold 40 rows and scroll; `DESIGN.md`, Layout & Spacing carries that as an accepted overrun rather than a rule breach. Per PRD addendum revision 19 this state fires disproportionately on the costlier recipe, so it is a routine state and not a defensive one |
| 36 | An Item Class unrankable under one recipe only | Appendix or list | AD-17 truncates the Eligible Pool below a recipe's `modifierLevelMin`, and an empty surviving pool makes that `(Item Class, recipe)` pair unrankable. Under the one-recipe-at-a-time reading (see *A note on the recipe axis* below), the class is simply Unrankable while that recipe is active and ranks normally under the other. **FR-4's reason enum is not extended** — PRD memlog 151 declines a third string on the ground that no base is tracked below item level 70, so the case is defensive rather than live. `[NOTE FOR UX]` If it ever does fire, neither existing string describes it and the enum is the PRD's to extend, not this document's |
| 37 | Unrankable appendix with no rows | `{components.unrankable-appendix}` | `[decision — memlog 214]` The committed state: `weights.json` present and `recipes.json` published with no recipe (story 2.7 Decisions), so no `(itemClass, recipe)` pair exists and no class is Unrankable in FR-4's sense (AD-24). The same holds when `recipes.json` is absent. The appendix keeps its place and shows its title alone, `Appendix: Unrankable — 0 Item Classes`, with the count in ink rather than rust. No lead and no rows. **It does not say why it is empty.** In the committed state no absence line prints, and the masthead dek already says that crafted Item Classes are not ranked yet. When `recipes.json` is absent, state 38's absence line says so. The empty appendix must not say it again or contradict either. It never prints `class absent from weights file` while a weights envelope is loaded |
| 38 | A tolerable artifact absent | `{components.trust-strip}` | `[decision — memlog 213]` One plain `Not published` line per absent file, inside the strip after line two, with no mark and no colour. The strings are verbatim under Domain Vocabulary. Each line is budgeted at `{spacing.frame-reserve-absence-line}`. An absent `weights.json` also turns the strip's three line-one fields to *unknown*. An absent `weights.json` or `recipes.json` holds the uniform-prior banner down, because there is no crafted ranking for it to describe |

`{components.asking-price-line}`, `{components.key-block}` and
`{components.running-foot}` render in every state above except **26 and 28**, the
two screens that replace the page. A page that has no numbers still has to say
what its numbers would mean. A page that has no data at all should say only
that.

*Those two numbers were wrong until revision 3, and so were three more.* Memlog
170 renumbered rows 13–34 to 12–33 by script and the prose references to them
were not swept, so this sentence pointed at 27 and 29 — the cross-file check and
the stale-weights strip — while UJ-1's failure path and UJ-2's both pointed one
row past the state they meant. All five are corrected here. The numbers are
stable identifiers that other documents and reviews cite, so **a renumbering is a
sweep and not a script**.

**The recipe axis, ratified** `[decision — memlog 186]`. This document's
revision-3 reconciliation — `core` computes every `(Item Class, recipe)` pair and
the view renders the active recipe's pairs only — was written to PRD FR-1 by
directive and stated nowhere. **AD-17 now states it**, so the reading this
document was built on is the binding one and nothing here changes: the list does
not double, `{components.craft-recipe}` is a filter, and no row names its recipe.
The cross product is ordering-internal and never reaches the page. Two
consequences of AD-17's ruling bind this document: FR-5's bound is applied
**after** the recipe filter, and a Raw Base — carrying no recipe — renders under
both recipes, so a switch re-interleaves the mixed list without moving the raw
rows relative to each other.

**FR-30's world is specified, and the note is closed** `[decision — memlog 203]`,
superseding memlog 72 and its re-derivation at memlog 185. Until a conforming
Weights File exists, every **Item Class** is Unrankable and the product is a
white-base price list with an appendix holding the crafted branch entire — one
row per Item Class, on the order of 29 against a committed budget of 7.

Three rules were read as colliding there: the appendix is a *footer*, truncating
it is forbidden, and nothing unclicked may push the page past 1920px. **The first
two are mechanism and they hold; the third was a sentence, and `DESIGN.md` has
now split it into the two clauses it always contained.** Budgeted chrome still
may not overrun the frame. A resting row count above the twenty-row target
releases into scroll instead. So the behaviour in FR-30's world is the ordinary
behaviour: the appendix sits at the foot, holds every row untruncated, and the
document grows and scrolls beneath it.

Nothing here is deferred to implementation any more. The earlier acceptance of
designing it later is discharged, not still standing.

**A list of only `unresolvable` rows drops "yet"** `[decision — revision 9,
2026-09-27]`. State 23's statement holds whenever nothing is priced in the
active league, and `unresolvable` rows count toward it. Its copy ends in *yet*:
`In canonical order, not ranked: no tracked unit has a price from <league> yet.`
When every row the list shows is `unresolvable`, no sync will bring a price, so
the statement ends without the word:
`In canonical order, not ranked: no tracked unit has a price from <league>.`
When at least one row is `no-listings` or `not-yet-synced`, the statement keeps
*yet*, because it is true of those rows. The statement does not name the cause:
the trust strip's health line already carries `× N unresolvable` (state 31).

## Interaction Primitives

Mouse only. There are **seven** interactions on the whole page — six stay on it,
one leaves it. *It was six until revision 3, when the Craft Recipe became a
control (FR-26).*

→ [`mockups/key-expanded-states.html`](mockups/key-expanded-states.html) shows
the result of interactions 2, 3 and 5 — an open Item Class, the tombstone band
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
1a. **Switch the Craft Recipe.** `[decision — memlog 181]` Click the inactive
   word in `{components.craft-recipe}` — `greater` or `perfect`, whichever is
   not currently solid. The active word is **not** a click target: there is
   nothing to switch to, and a target that does nothing teaches the wrong thing.
   The ranking re-runs synchronously against the already-loaded artifacts, with
   **no debounce**, because a click is one deliberate act where a keystroke is
   one of several on the way to a value. Ranks, EV figures and Chase Combination
   sets all change together — a recipe changes which outcomes are *reachable*
   and not only what an attempt costs (FR-26), so this is a genuinely different
   ordering rather than the same ordering shifted by a constant. The Craft Cost
   line beneath updates with it. **Open panels stay open** and re-render against
   the new recipe, for the same reason a threshold change leaves them open: the
   player is comparing, and closing his comparison to answer his question would
   be the page taking his place away.

2. **Expand a ranked row.** Click anywhere on `{components.ranked-row}`. Click
   the same row again to close it. The panel opens in place, instantly, below
   the row. **Many panels may be open at once** — they are read against each
   other, and a page that closed one to open another would make comparison
   impossible on a surface whose whole argument is comparison. Nothing closes a
   panel except a second click on its own row.
3. **Toggle the tombstone band.** `+ N pruned` inside an open panel. Local to
   that panel, and it resets when the panel closes.
4. **Read the remainder of the list.** `{components.expand-affordance}` below
   row 20, reading `+ Read the remaining N rows` closed and `— Show only
   the top 20` open. It names no unit, because the remainder holds both (FR-3).
   It is reversible and it grows the list in place rather than paging. `core`
   ranks the full Tracked List. The page truncates, so the threshold and the
   recipe still reorder across everything (FR-5).
5. **Open the full sync report.** Click anywhere on `{components.trust-strip}`
   `[decision — memlog 62]`. The whole strip is the target — the player is
   mouse-only and there is no keyboard affordance to add. The affordance text
   sits right-aligned on the strip's first line and reads
   `+ the full sync report` closed, `− the full sync report` open, in
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

   **Finding T3 is closed, and it was a misreading rather than a tension**
   (review-prd-conformance-trade-link.md). It held that SM-1 sat in tension with
   the page's one link back to the trade site. **PRD SM-1 now rules it**, and
   this document does not restate the ruling: cite SM-1. What binds here is only
   the consequence — the link is not a metric failure, so nothing about it needs
   hiding or defending.

Plus one dismissal: the uniform-prior banner's *dismiss for this session ×*.

**What survives a reload, decided rather than left to silence** (FR-7). **The
Payout Threshold and the active Craft Recipe** persist, in the viewer's own
browser storage (FR-7, AD-15). Everything else resets: open panels, the
tombstone toggles inside them, the grown list, and the sync report all start
closed on every load, and the banner dismissal lasts the session only.

*The test is deliberate setting against reading position*, and it has not
changed — only the number of things that pass it. A value the player **sets**, and
would be annoyed to set twice, persists. A value that records **where he had got
to** does not, because a page that reopened four panels from last night would not
be the resting state the whole design is tuned for. The threshold passed that
test from the start. **The Craft Recipe passes it identically**
`[decision — memlog 183]`: FR-26 makes it a choice the player declares about how
he crafts, not a place he had scrolled to, and it changes the ordering he reads
in exactly the way the threshold does.

*FR-7 permits this and does not require it.* FR-7 promises persistence to the
threshold alone — "no other view state is promised persistence" — and then hands
the rest to this document by name: *"whether any of them survives is UX's
decision (`EXPERIENCE.md`)"*. So this is UX exercising a delegation, not an
overreach. A builder should still not persist **panel** state in order to satisfy
FR-7; the rule gained one member and did not loosen.

**Hover and active states.** `DESIGN.md` flagged these as open and has since
settled them. The behaviour is recorded here, and nothing lifts, glows or
rounds:

| Target | Hover | Active (pointer down) | Persistent |
|---|---|---|---|
| `{components.ranked-row}` | Background to `{colors.paper-inset}`. Cursor pointer. Nothing is revealed, nothing moves, no row changes height | Background to `{colors.paper-deep}` | A row **whose panel is open** takes the `openMarker` — a `{spacing.open-row-marker}` sepia left rule and a promoted bottom rule — and keeps it while any other row is hovered. Tone alone cannot mark the open row, because hover uses the same tone. `[decision — memlog 106]` The marker **bleeds into the gutter** rather than pushing the row. The row stays content-box at `{spacing.content-width}` and the rule takes a negative left margin. No column moves, and the list never jumps sideways when a row opens |
| `{components.raw-base-row}` | Background to `{colors.paper-raw-hover}`, so a hovered Raw Base row still reads as a Raw Base row instead of collapsing onto the ordinary hover tone | Same as any row | Same |
| `{components.expand-affordance}` | Its dotted rule becomes solid in `{colors.sepia}`. The text colour does not change | Text to `{colors.ink}` | — |
| `{components.craft-recipe}` inactive option | `{colors.ink-secondary}` to `{colors.ink}`, and **its resting dotted sepia rule goes solid** — the same promotion `{components.expand-affordance}` makes. Cursor pointer | Same colour, no further change | **At rest it already carries the dotted sepia rule.** That is the correction of revision 3's first draft, which put the rule on hover only and left the page's one new control with no resting affordance |
| `{components.craft-recipe}` active option | **No hover state and no pointer cursor.** It is not a target — there is nothing to switch to | — | **2px** solid sepia rule beneath the word, `{colors.ink}` at `700`. Two pixels, not one, so it is never read as the threshold's 1px solid hover |
| `{components.payout-threshold}` figure | Its resting dotted sepia underline goes solid sepia | — | While editing, the underline goes solid `{colors.rule-strong}`, the caret is `{colors.ink}` and the selection is `{colors.paper-deep}`. The readout track and marker never respond to the pointer |
| Banner dismiss | `{colors.ink-tertiary}` to `{colors.ink}` | — | — |
| `{components.trust-strip}` | Cursor pointer across the whole strip. Its affordance text takes the `{components.trust-strip}` `affordanceHoverRule` — a dotted `{colors.sepia}` underline. Nothing else about the resting strip changes | — | While open, the affordance reads `− the full sync report` |
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
- **Mantine's `SegmentedControl`, `Select`, `Radio` or `Switch` for the Craft
  Recipe.** All four bring a filled track, a radius or a form control's chrome,
  and the page has none of those. The recipe is two words and a rule, the same
  way the threshold is a figure and a rule (memlog 73, 181).

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
  still reads with every colour removed. It does: two semantic inks, each
  always spoken with a glyph *and* a word.
- **The third distinction is the one revision 3 rebuilt.** Raw-Base-versus-crafted
  was carried by a tint, an italic and the word `RAW BASE`. The user's direction
  was that the player knows the difference and does not need it spelled, and
  asked for a glyph or colour instead `[decision — memlog 184]`. **Colour alone
  was not available under this very rule**, so the word retired in favour of
  `{components.unit-glyph-raw}` and `{components.unit-glyph-class}` — and a glyph
  passes the colour-removed test exactly as a word does. The cue count is
  unchanged at three for a raw row, and a crafted row gained one where it
  previously relied on being the unmarked default. That last part is the real
  improvement: FR-3 makes the two units peers, and a distinction carried only by
  marking one side fails as soon as the other side stops being obvious.
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

1. **`{spacing.frame-slack}` is the expansion budget** — **530px** `[change —
   memlog 210]`, computed from the committed block heights at the declared
   line-heights, sitting between the last ranked row and the appendix. Three
   things are charged against it by *data* rather than by a click and therefore
   belong to the resting budget: `{spacing.frame-reserve-banner}` for the
   uniform-prior banner, `{spacing.frame-reserve-health-line}` for the trust
   strip's health line, and `{spacing.frame-reserve-absence-line}` for each
   absence line (state 38). They cannot all co-occur (`DESIGN.md`, Layout &
   Spacing). Worst-case resting height is 1485px, leaving 435px.
2. **The sync report opens against the slack first.** It is capped at
   `{spacing.sync-report-max-height}` — an independent **400px**, chosen to sit
   inside that 435px worst case — and scrolls inside its own band past that. So
   `{components.sync-report-panel}` alone never makes the page scroll, in any
   data state.
3. **A ranked row's expansion is deliberately uncapped.** Capping it would hide
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
4. He glances at the top five rows under his current threshold **and the recipe
   he left active last session**, which is where the page opens because both
   persist (FR-7). Each row opens with its glyph, so he can see at a glance that
   rank 2 is an Item Class he crafts on and rank 3 is a Base Type he sells raw —
   two different acts, in one ordering. Rank emphasis is carried by weight, so
   the top band reads first without being bigger.
5. He notes the two or three Chase Combinations on each crafted row, read as a
   tier and a canonical short form per affix — `T1 Cold Res · T1 Mana`. He does
   not have to recall what value spread a tier covers, which is the whole reason
   the tier is printed and the value is not. A raw row has no chase cells; it
   carries its note instead, because there is nothing to chase on it.
6. **Climax:** he closes nothing and touches nothing. The page is already at
   rest in the state he needs it in, and it stays that way on the second monitor
   for the whole session. He picks up accordingly — the classes to craft on and
   the bases to sell raw, told apart without reading a word of either.

Failure path: a published file does not match its schema and
`{components.refusal-screen}` replaces the page (**state 26**), naming which
file. Or one of the eight does not arrive and `{components.fetch-failure-screen}`
offers him `+ Try again` (**state 28**). Either way he plays without the tool
rather than with a wrong one, and never with half a ranking.

### UJ-2 — The threshold turn

1. The player is now richer than at league start.
2. He clicks the threshold figure itself and types `1` over `0.25` — the number
   is the input, so there is nothing to aim at but the number.
   `[OVERRIDE — memlog 36/37]` He types rather than drags. The slider is gone,
   though the track beneath still shows him where `1` sits in the range.
3. On the first valid parse, debounced ~150ms `[ASSUMPTION — memlog 38]`, the
   ranking re-runs synchronously against the already-loaded artifacts. No
   network request, no sync.
4. The list reorders. Steady moderate Item Classes fall away. Jackpot classes
   rise. Raw Bases move among them on their own prices. This is correct
   behaviour, not a bug (FR-6).
5. Chase Combination sets change with it — only Combinations at or above the new
   threshold remain, and some rows now show fewer than three, or none.
6. **Climax:** he re-reads the new top five. The page that answered one
   player's question a moment ago now answers a richer player's question, and
   nothing else on it moved.

Second turn, the same shape: **richer also means a different recipe.** He clicks
`perfect` in `{components.craft-recipe}` and the list reorders again — this time
because a different set of outcomes is reachable, not because a different set
clears the bar (FR-26). The Craft Cost line under the control tells him what the
better orbs cost him per attempt, which is the figure that makes the two
orderings comparable at all.

Failure path: he types a value nothing clears (**state 25**). The list does not
silently look like a data outage — the page must distinguish "nothing clears your
threshold" from "no data", and it is the only failure path in this document with
its own remedy already on screen: the figure he typed, 16px away. So the page
names the condition and the live threshold, states no instruction, and leaves the
rows where they are (state 25, memlog 204).

### UJ-3 — The drill-down

→ Steps 3 to 6 are the panel in
[`mockups/key-expanded-states.html`](mockups/key-expanded-states.html), which
carries all four Price States on one Item Class.

1. The player is unsure why an unfamiliar Item Class ranks third.
2. He clicks anywhere on its `{components.ranked-row}`.
3. `{components.expansion-panel}` opens in place, repeating the active threshold,
   the active Craft Recipe and the asking-price framing — the three things the
   figures above it depend on.
4. He reads every Tracked Entry on the Item Class: which are `priced` and at
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
   open and expand a second row beside it to read the two against each other —
   including a crafted row against a raw one, which is the comparison the mixed
   list exists to make possible.
7. **Climax:** the third rank stops being a claim and becomes an argument he can
   check. He either accepts it or does not, on evidence he just read.

### UJ-4 — The trust check

→ Steps 2, 4 and 5 read off
[`mockups/key-hero-resting.html`](mockups/key-hero-resting.html): the marked
rows among the silent ones, and the strip beneath the masthead.

1. The player notices an Item Class ranking suspiciously high.
2. Its Age cell is not empty — and on this page a non-empty cell is the whole
   signal. It reads *priced 5d ago*.
3. Above the list, `{components.uniform-prior-banner}` is up: the whole ranking
   rests on a uniform prior, and relative ordering between Item Classes is not
   evidence-backed.
4. He reads `{components.trust-strip}` and sees the `gamePatch` the weights file
   declares. The page does not tell him the patch is old — it has no way to know
   what patch is live — but he does, and the two facts sit next to each other.
5. **Climax:** he discounts that Item Class rather than acting on it. The page
   did not hide the weakness and did not apologise for it — it simply refused to
   look more confident than its data deserved.

*One mark he will not find, and should not look for.* If the suspicious row had
been a Raw Base, its Provenance cell would be empty — not because the page is
confident about it, but because a Raw Base rests on no modifier pool at all
(FR-4). Its trust lives entirely in its Age cell and its price. The key block's
*Silence means healthy* column is what stops that empty cell reading as a
withheld judgement.

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
   carrying a rust line, `× 12 unresolvable`, for days
   `[decision — memlog 70/88]`. Between them, that is why he is here.
3. He clicks the strip and opens `{components.sync-report-panel}` for the rest:
   the count behind that rust line (FR-24), the pinned-starvation records
   (FR-25) that tell him a pin he set is not being served, and the coverage
   fraction with its denominator, which tells him how much of what he tracks the
   ranking can speak for at all.
4. He expands the Item Classes those figures point at — several at once, left
   open side by side — and reads their full Combination lists. He finds three
   Combinations that have returned `no-listings` all league, and one flagged
   `unresolvable` since the last patch.
5. He opens `+ N pruned` on a panel and reads the existing tombstones with their
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
2. He opens the page. Every tracked unit renders in canonical order
   `[decision — memlog 48]` — every Item Class and every Raw Base, each with its
   glyph — carrying Price State `not-yet-synced` with reason `league-mismatch`.
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
- **State coverage — 39 states enumerated** across Price States and their
  reasons, Curation Statuses, Provenance values, Unrankable reasons, load,
  empty, stale, refusal, fetch-failure, report, sync-health, grown-list,
  **Craft Recipe** and **absent-artifact** conditions. Revision 3 added 12a (a
  Raw Base's absent Provenance), 34 (a recipe switch), 35 (an uncostable recipe)
  and 36 (a class unrankable under one recipe only). Revision 7 added 37 (the
  empty appendix) and 38 (a tolerable artifact absent). **One** carries `[NOTE
  FOR UX]`: the reason string a recipe-scoped Unrankable would need (36), which
  is the PRD's to extend and stays declined per PRD memlog 151. Revision 7
  closed the skeleton's appearance (22, memlog 211). *It was six, then five, and revision 4 closed three at once* — the
  nothing-clears copy (25, memlog 204), what crafted rows do under an uncostable
  recipe (35, memlog 205, with PRD revision 19 carrying the player-visible half),
  and the cross-file report's placement (27, memlog 206). The pinned mark closed
  the sixth at `[decision — memlog 199]` — state 9 now carries
  `{components.curation-status-pinned}` and no note. The count is a consequence
  and not a target.
- **State-number references swept.** Memlog 170 renumbered rows by script
  without sweeping the prose that cites them, so five references were off by
  one. All five are corrected at revision 3 and the numbers are now treated as
  stable identifiers: **renumbering is a sweep, not a script.**
- **Component coverage — every component named in `DESIGN.md.Components` has a
  behavioural row** in Component Patterns, under the same name, including
  `{components.sync-report-panel}`, `{components.refusal-screen}`,
  `{components.fetch-failure-screen}` and, new at revision 3,
  `{components.craft-recipe}`, `{components.unit-glyph-class}` and
  `{components.unit-glyph-raw}`. There was never a `raw-base-tag` *component*:
  the `RAW BASE` tag lived inside `{components.raw-base-row}` and retired with
  its typography role.
- **Interaction numbering deliberately not resequenced.** The Craft Recipe
  switch is numbered **1a** rather than 2, because prose elsewhere in this
  document and in the mockup captions cites interactions by number ("the result
  of interactions 2, 3 and 5"). Inserting a new 2 would have silently
  invalidated those. This is the same lesson the state-number sweep above
  records, applied before the fact rather than after it.
- **Token references — all resolve** against `DESIGN.md`'s declared token names,
  verified by script at revision 3: 148 distinct `{…}` references against 140
  declared tokens, nothing unresolved.
  **A retired token name is written without braces**, as `typography.row-ev-unit`
  rather than as a reference, so that `{…}` means *this resolves* and the check
  above can be run mechanically. Removed upstream and referenced nowhere:
  `typography.row-ev-unit`, `spacing.col-combination-age`, and — new at
  revision 3 — `typography.raw-base-tag`. Three tokens were **renamed** at
  revision 3 because their names described only the crafted branch's old unit:
  `spacing.col-base-type` → `{spacing.col-unit}`,
  `spacing.pad-base-type-right` → `{spacing.pad-unit-right}`, and
  `typography.row-base-type` → `{typography.row-unit-name}`. The widths are
  unchanged and no column sum was reopened. The newer
  `{typography.combination-line-2}`, `{spacing.col-tombstone-removed}`,
  `{spacing.recipe-panel-width}`, `{typography.row-unit-glyph}` and the
  `typography.recipe-*` roles are used where they apply.
- **Revision 3's new visual work went through an `impeccable` critique** before
  it closed — two isolated assessments, scored **26/36 (Good)**, snapshot in
  `.impeccable/critique/`. It found one P0 (`{components.craft-recipe}` had no
  resting affordance, memlog 191) and two P1s, and the mechanical half caught a
  ragged left edge (195) and a two-typeface glyph vocabulary (196) that the
  design half missed entirely. All were fixed. **One standing caveat: no browser
  automation existed in that session**, so nothing here has been rendered and
  verified by eye — every geometric claim is computed from the CSS and the font
  outlines. That is why the hanging-indent proposal was recorded rather than
  applied.
- **Column sums re-verified by script at revision 3**, not carried on trust:
  ranked row 32 + 222 + 84 + 88 + 94 + 492 = **1012**; frame 1060 − 2×24 =
  **1012**; chase 492 ÷ 164 = **3** cells; appendix 292 + 118 + 250 + 310 =
  **970**; combination line one 460 + 250 + 116 + 116 + 24 = **966**; line two
  560 + 200 + 206 = **966**; tombstone line two 560 + 406 = **966**. New this
  revision: masthead controls 216 + 16 + 276 = **508**, and 1012 − 508 − 24
  clearance = **480** = `{spacing.dek-max-width}`. Every chase Combination in
  both mockups is inside the 27-character budget; the longest is 25.
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
  - **FR-4's coverage bands, resolved by removal upstream** (185). PRD revision
    18 withdrew the 50–80% band, so the appendix's prominence is now a UX
    decision rather than a measurement, and the page never switches layout on a
    figure. This is the second item on this list closed by withdrawal rather
    than by answer.
  - **The Craft Recipe's display name** (181), which memlog 107 left open. No
    name is invented and none is needed: the control prints the one word that
    distinguishes each composition, lifted from the Glossary's own wording.
  - **Where Craft Cost lives** (182), which had no home in either spine although
    FR-26 requires it shown.
  - **How a mixed-unit list states each row's unit** (180, 184), which FR-3
    requires and which no treatment covered before revision 3.
- **Closed at revision 4** (203–206), four of them by one ruling apiece:
  - **The nothing-clears copy** (204, state 25). Ruled this document's, not the
    PRD's — the PRD's silence on it had been read as ownership.
  - **What crafted rows do under an uncostable recipe** (205, state 35). PRD
    revision 19 carries the player-visible half (FR-26, FR-5); the numerals, the
    per-branch tiers and the copy are here.
  - **Where the cross-file validation report lands** (206, state 27). The sync
    report panel's second column, which forced the back-end-only licence from
    audience onto register — see *Two registers in one panel*.
  - **FR-30's no-weights-file world** (203). Closed by ruling, not deferred. The
    three rules that looked to collide did not: two are mechanism and hold, and
    the third was a sentence `DESIGN.md` has now split into its two real clauses.
    The appendix stays at the foot, holds every row, and the page scrolls.
- **Closed at revision 5** (207, 208):
  - **The one non-colour cue, serving two boundaries** (208), which was two
    entries on this list held as one question: the curation fallback's treatment
    and the register boundary inside `{components.sync-report-panel}`. Both
    print **text the page did not write** — the Trade Catalogue's own stat name
    and value band in one case, the failing check, the entry and its canonical
    key in the other — so the distinction was always one distinction, and two
    cues for it was the failure the merge existed to prevent. The answer is a
    **third type stack, the mono verbatim register**, reserved to that meaning
    and to those two surfaces. It is not an ink, not a mark and not a glyph, so
    it neither joins the semantic ink family nor touches the open key-block
    question. It has no size of its own and reopens no verified number.
    `DESIGN.md` owns the treatment, in Typography.
  - **The declared tiebreak for equal EV** (`epics.md` finding D-4), which
    revision 4 carried as unresolved and `core`'s, on the ground that state 25
    ties every crafted row at minus its Craft Cost while the rank numerals print
    over that tie. **AD-17 already declares it**, and always did: the ranked list
    breaks ties on the row's unit key, then the recipe id, comparing the
    serialised canonical key of AD-5's arm rather than a bare string, and a raw
    row, having no recipe id, sorts before a crafted row at an equal EV — which
    makes the ordering total across the mixed list and not only within each
    branch. Unit keys are distinct, so even a twenty-way tie prints in an order
    that is fully determined and identical across loads. The gap was a citation
    gap and not a missing decision, so no treatment here changes: state 25 cites
    AD-17, and an acceptance criterion cites AD-17 directly because
    `IMPLEMENTATION-NOTES.md` does not own this rule. No story invents a
    tiebreak of its own.
- **Closed at revision 7** (210–214), from the `[NOTE FOR UX]` entries Epic 2
  logged in `docs/stories/deferred-work.md`:
  - **The vertical budget's 2px** (210). `{spacing.frame-slack}` is 530, not
    528; the gap was the frame's old border, which became an outline.
  - **The skeleton's appearance** (211, state 22). The flat-bar default is
    ratified, and the column header paints with its final labels.
  - **A coverage figure the report omits** (212). *not measured* with a weights
    envelope loaded, *unknown* without one.
  - **Absence lines** (213, state 38). Plain lines inside the trust strip, with
    a budget line of their own. The uniform-prior banner stays down when no
    crafted ranking exists, which bounds how many reservations can co-occur.
  - **The empty Unrankable appendix** (214, state 37). Its title alone, the
    count in ink.
- **Unresolved, reported not fixed.** None of these is resolved by invention:
  - Two Combinations that read identically (Domain Vocabulary; memlog 143).
  - The reason string a recipe-scoped Unrankable would need (state 36), which is
    the PRD's to extend and stays declined per PRD memlog 151.
  - Whether `† pruned` and `* pinned` belong in `{components.key-block}`, whose
    contract is to list every mark that can appear (`DESIGN.md`, Components;
    memlog 201).
  - **Whether any Item Class name needs a display mapping is closed, elsewhere.**
    `epics.md` records that none does: the only transform is AD-5's
    underscore-to-space trim at render time, identity left verbatim. It is listed
    here so the closure is not mistaken for an omission.
- **Closed by decision** (199, 200): the pinned mark. It is
  `{components.curation-status-pinned}`, and the reason it is loud rather than
  tasteful is recorded with it — it answers the trust strip's unnamed
  starvation line, so being findable in a scan *is* the requirement.
- **Closed against the architecture** (186): the ranked list shows one recipe at
  a time. AD-17 now rules that `core` orders the cross product and the view
  renders the active recipe's rows, ratifying the reconciliation these spines
  were already written to. No change here; cite AD-17.
