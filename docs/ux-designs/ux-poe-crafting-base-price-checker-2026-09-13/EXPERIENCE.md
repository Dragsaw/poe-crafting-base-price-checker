---
title: PoE2 Crafting Base Price Checker — Experience
status: final
revision: 24
created: 2026-09-13
updated: 2026-10-04
sources:
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/brief.md
  - docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/addendum.md
  - .memlog.md (rows 239-279 hold the visual redesign)
peer-contract: DESIGN.md — the look and the token source. This document
  references its tokens by name and never restates their values.
---

# PoE2 Crafting Base Price Checker — Experience Spine

## Foundation

The product is one read-only page for one player. It has no second route, no
internal navigation, no account and no write path from the browser. The page
fetches the artifact set that AD-24 names and ranks against it locally. Then it
sits still on a second monitor, beside a dark game, for the length of a play
session.

**One outbound link is the sole exception.** `{components.trade-link}` opens the
trade site's own search for a Combination in a new tab (Interaction 6). It adds no
route, writes nothing and changes nothing on the page. It is not the runtime call
that FR-33 forbids (AD-15, AD-25). The click is the player's own navigation, and
the page makes no request of its own. The page may not call the trade site. Thus
the link can only point at a search that the syncer already issued and stored.

**This document writes each on-screen string once** (memlog 250, 251). These are
the labels, state words, reasons, tooltip text and footer text. All of them are in
the Copy Deck or in Epistemics, *Price trust*. This document also writes each fixed
value that the page prints or judges by: the 3-day, 3-listing and 70% price-trust
thresholds, the 8 lines an expansion opens on, and the 0.25 cold start. The PRD
keeps the capability and the player-level promise, and it cites this document.
Mechanism stays with the architecture spine.

**Substrate: Mantine v9** (`@mantine/core` + `@mantine/hooks` 9.6.1)
`[ASSUMPTION — memlog 8]`. The page inherits Mantine's component behaviour. This
document records only the behavioural deltas. DESIGN.md records the visual ones.

| Mantine default | Delta |
|---|---|
| `Collapse` animates height on open | Every expansion and the sync report open **in place, instantly** (memlog 14). |
| `Accordion` ships chevrons, padding and its own hover | Not used. A ranked row opens on its own click (Interaction 2). |
| `SegmentedControl` animates its indicator | `{components.recipe-toggle}` is a segmented control (memlog 243). Its indicator moves instantly or by a fast linear step (memlog 14). |
| `NumberInput` fires `onChange` on every keystroke | Kept, because FR-6 needs it. Re-ranking is debounced (Interaction 1). |
| `Slider` shows a floating value label while dragged | Off. The typed figure beside the slider shows the value. Snapping: Interaction 1. |
| `Tooltip` may wrap any element | Three kinds only (Interaction 8). A tooltip never holds a control. |
| `Skeleton` animated shimmer | Flat bars, no shimmer, no animation (memlog 211; state 22). |
| Focus ring and keyboard traversal | Out of scope (Accessibility Floor). |

Two rules read like Mantine deltas but are not. First, there is **no
virtualisation and no windowing**. Twenty rows paint at once, and a grown list
paints in full. Second, **the full text of cut text is one click down**. A tooltip
shows cut text only on a chase cell (memlog 273), and that full text is also one
click down.

DESIGN.md is the look. This document is the behaviour and the words.
[`mockups/key-redesign-dark.html`](mockups/key-redesign-dark.html) shows one
dataset in one state. It also holds a box of state specimens, which is annotation,
not product UI. Its sample text does not ship. **Where a mockup and a spine
disagree, the spine wins.** The two earlier paper mockups, `key-hero-resting.html`
and `key-expanded-states.html`, show a retired theme. They illustrate nothing
current.

**Tags and citations.** `[OPEN]`: the inputs do not decide it. `[ASSUMPTION]`:
held until the user confirms it. `[OVERRIDE]`: a deliberate departure from the
PRD or the brief. `[NOTE FOR ARCHITECT]`: mechanism this document needs from the
architecture side. `[NOTE FOR UX]`: a standing UX question. `(memlog N)` cites the
row of this folder's `.memlog.md` that holds the decision.

**Open items.** This document resolves none of them by invention.

- The share-of-EV formula and the stale-patch data source (`[NOTE FOR ARCHITECT]`
  in Epistemics; memlog 265).
- Strings drafted at build (Copy Deck).
- Two Combinations that read identically (`[NOTE FOR UX]`, Domain Vocabulary;
  memlog 143).
- The reason string that a recipe-scoped Unrankable would need (state 36). The PRD
  owns that extension.

**Known gaps for the build stories** (memlog 279). Nobody ruled on these. The
build story that meets a gap rules on it. This document does not invent an answer
now.

- The failure paths of UJ-3, UJ-4 and UJ-5.
- The page when `sync-report.json` is absent.
- State 35's branch boundary and the look of its suppressed ranks.
- The show-more affordance when the list has 20 rows or fewer.
- An expansion panel whose every line is pruned.
- A non-numeric threshold entry.

## Information Architecture

One surface. Everything below is a region of it, in fixed vertical order.

| Region | Reached from | Purpose |
|---|---|---|
| `{components.header-bar}` | Always visible, sticky | League eyebrow and title on the left. On the right: `{components.recipe-toggle}` with Craft Cost beside it, `{components.threshold-control}` and `{components.sync-button}` (memlog 243). It never grows a second line. Problems speak through the sync button (memlog 254) |
| `{components.sync-report-panel}` | Interaction 5 | The Sync Report, the attribution facts and any absence lines (FR-24, FR-25, FR-4, FR-18; memlog 258 N-7, N-8). Content: Epistemics, *The sync report* |
| `{components.list-statement}` | States 23, 25 and 35 | One plain declarative above the column header |
| `{components.column-header}` + twenty `{components.ranked-row}` | Always visible | The product. Crafted rows name an **Item Class**, and Raw Base rows name a **Base Type**, in one list (FR-3). UJ-1, UJ-2, UJ-4 |
| `{components.expansion-panel}` | Interaction 2 | Every Tracked Entry on that Item Class, or the one entry that a Raw Base names. UJ-3, UJ-5 |
| `{components.show-more}` (list) | Below row 20 | The remainder of the ranked list (FR-5; Interaction 4) |
| `{components.unrankable-appendix}` | Foot, above the footer | **Item Classes** kept out of the ordering, with their reason and count (FR-4). Every row is an Item Class. A Raw Base needs no Eligible Pool and ranks regardless |
| `{components.footer-legend}` | Foot | How to read the marks, the asking-price sentence, and where curation happens. It is the only place where the page says where curation happens. It renders in every state except the failure screens |

The header bar is the only pinned region. The sync report and every expansion open
**in place** and push the content below them down. Neither is a modal, a drawer,
an overlay, a dropdown or a second route.

`{components.failure-screen}` sits outside that order and replaces the whole page
(states 26, 28). While it shows, none of the regions above render. The page shows
nothing rather than a partial set.

**One list, two ranked units** (memlog 180, 241, 242). The list is mixed by design.
A crafted row names an Item Class, and a Raw Base row names a Base Type (FR-3).
They are peers. A row states which it is in two ways. First, its name takes the
game's rarity colour: `{colors.rarity-magic}` for a crafted Item Class and
`{colors.rarity-normal}` for a Raw Base, as the trade site prints magic and normal
items. Second, for a reader who cannot see colour, a Raw Base row prints the
sell-as-is line where a crafted row prints its Best combinations
(memlog 258 N-13). `{components.column-header}` names both units (Copy Deck).

**The appendix stays at the foot** (memlog 185). FR-4 leaves its prominence to UX.
**The page never switches layout on a data measurement.** It has one arrangement in
every data state. The count is readable without expanding anything (FR-4). The
coverage fraction with its denominator is one click down, in the sync report.

### The ranked list

- **Order.** EV under the active threshold and the active recipe (FR-1, FR-26).
  Columns are not sortable. The list shows the active recipe's rows only. `core`
  orders the cross product, FR-5's bound applies after the recipe filter, and a
  Raw Base renders under every recipe (AD-17). A Raw Base under the Payout
  Threshold leaves the ranking. It is absent from the top 20 and from the grown
  list.
- **Emphasis.** Ranks 1–5 are emphasised, and the rest are plain (memlog 258
  N-20). Emphasis depends on rank position only, never on branch. Under state 35
  it runs per branch.
- **The EV cell** reads, left to right: ≈ when it applies (Epistemics,
  *Estimated odds*), the figure, then the mark slot. The mark slot holds the row's
  trust mark or nothing (Epistemics, *Price trust*). A negative EV is dimmed and
  still printed as a real figure (state 21). For a missing figure, see
  Epistemics, *Missing figures*.
- **Best combinations, crafted.** The Combinations that contribute most to EV
  under the active threshold and recipe. Each prints as tier plus short form, one
  per cell, in three cells or two (Responsive & Platform). Fewer qualifying
  Combinations leave cells empty. None leaves every cell empty (state 21).
- **Raw Base rows.** The sell-as-is line replaces the chase cells. The EV is the
  base's own asking price, and the row never carries ≈.
- **The row** is one click target, with no per-row controls and no hidden actions
  (Interaction 2). Hover shows only a mark's reason and a cut chase cell's text
  (Interaction 8).

### The expansion

- **Context line.** Every panel opens with a context line that leads with the
  row's full name. Thus a name that the row cut has a full-text home (memlog 265).
  When the row carries ≈, the line continues with the ≈ sentence (Copy Deck).
  There is no title and no sub-line, because the sticky header always shows the
  threshold and the recipe that the figures depend on (memlog 258 N-11).
- **Lines.** One line per Combination (memlog 258 N-3). The line holds the
  Combination (tier plus short form, led by `* pinned` when pinned), the price in
  Divine or `—`, the trust cell, then the trade link (Interaction 6). An age
  prints only when there is a problem, inside the reason. Only a pruned line takes
  a second line, for its prune reason. Line treatments: states 1–10 and 20.
- **Line order** (memlog 265). Priced lines come first, by their contribution to
  EV, largest first. Then come below-threshold lines, then pending, then broken.
  Pruned lines come last, behind `+ N pruned` (Interaction 3).
- **Top lines.** The panel opens on the top 8 lines of that order (state 39).
- **A Raw Base** expands to one line (memlog 265). The line has no Combination
  text, because the context line names the base. It holds the price or `—`, the
  trust cell and the trade link.

## Domain Vocabulary

**On-screen words are this document's** (memlog 250, 251, 258 N-17). The PRD's §3
Glossary is the vocabulary of the contracts and of this document's prose. On
screen, the page speaks the player's words. The Copy Deck or Epistemics, *Price
trust*, writes every string that the page prints. A string not written there does
not ship.

### Mapping

| Glossary or internal term | On screen |
|---|---|
| Item Class | Its label (*Item Class labels*). As a kind, in the column header |
| Base Type, Raw Base | The base name, the sell-as-is line on its row, and the Raw Base item of the footer legend |
| Chase Combination | The Best combinations column |
| Payout Threshold | The threshold label, figure and unit |
| Craft Recipe | The recipe label and the option word (*Recipe option words*) |
| Craft Cost | The Craft Cost figure beside the recipe |
| Expected Value (EV) | The EV column header and the EV tooltip |
| Divine | Spelled out in the EV header. `div` after a figure in the header bar and the tooltip. A row figure carries no unit |
| Item Level Floor | The floor that FR-3 fixes, inside the sell-as-is line |
| Price State and its `not-yet-synced` reasons | A price-trust mark and a reason (Epistemics, *Price trust*). The enum values never print |
| Provenance (AD-10; internal only) | Never printed. `measured` prints nothing. `uniform-prior` prints ≈. `absent` prints its appendix reason and nothing else |
| Curation Status | `* pinned` and `† pruned`. `active` prints nothing |
| Sync Report | Opened by the sync button |
| Weights File, `generatedAt`, `gamePatch`, Tracked List edit date | Inside the sync report (Copy Deck) |
| Unrankable | The appendix title |

**Never printed as a word, but on screen** (memlog 139): *Dataset*, *Price
Observation*, *Trade Catalogue*, `lastAttemptedAt` and *Accepted Tier*. The Dataset
is what the page renders. A Price Observation shows as a price, and as an age only
when that age is a problem. The Trade Catalogue is why a `statId` reads as human
text. `lastAttemptedAt` prints as *tried N days ago*. An Accepted Tier is the bare
`T1` that opens every Combination.

**Back-end only, never on the page:** Modifier Reference, Stat Line, Source
Modifier, Eligible Pool, Modifier Weight, Chunk, Workload, Refresh Rotation,
`weightSource`, `lines`, `ranges`, `sourceModifierId`, `poolCoverage`,
`tierLabel`, the Price State enum values and AD-10's three values. These may appear
only in the cross-file diagnosis. They are allowed there because the diagnosis
quotes a file, not because another person reads it (memlog 206; Epistemics, *Two
registers in one panel*). The page never reads `tierLabel` either. The tier it
prints is the curator's declaration (memlog 135).

**Fixed wordings. Do not reintroduce the alternatives** (memlog 84, 258 N-17):

| Write this | Never this | Why |
|---|---|---|
| The EV header carries the unit, and the row cell holds the figure alone | `div` after every row figure | Twenty copies of an invariant unit are noise in `{spacing.col-ev}` |
| `item level 82+` | `ilvl 82`, `ILVL` | An abbreviation that the player must decode at a glance |
| **entries not reached in the last sync pass** | "in this Chunk" | *Chunk* is back-end only |
| `no published weight for one mod tier` | "prior", "uniform prior", "weight source" | The cue speaks about roll odds in the player's words (memlog 246) |
| No `Price trust` label | a `PRICE TRUST` column header or legend heading | The marks sit in the EV slot, and the legend names each one by its word (memlog 247) |

**The page never explains this vocabulary** (memlog 139). The page has one user,
and that user wrote the Tracked List. An explanation in the footer legend adds
nothing for them.

### Item Class labels

**An Item Class label is its source name, trimmed, with a defence-type suffix
spelled as defence words** (memlog 230, 249). Each underscore prints as a space. A
trailing defence-type suffix prints as a capitalised, slash-joined parenthetical.
`Helmets_str` reads `Helmets (Str)`, `Gloves_dex_int` reads `Gloves (Dex/Int)`, and
`Body_Armours_str_dex_int` reads `Body Armours (Str/Dex/Int)`. The plural stays:
`Amulets`, `Bows`. There is no per-class name table, and the label is for display
only. **The unit is never renamed.** The page names a class by its own name:
`Bows`, never `Bows class`.

### Recipe option words

The two v1 recipes differ only by orb grade. Thus each option prints that one word,
**derived from the grade prefix that the recipe's currency ids share**
(memlog 233). When every currency of a recipe carries the same grade prefix, the
word is that grade (`greater`, `perfect`). When no currency carries a grade
prefix, the word is `regular`. Two conditions make the recipe set invalid: mixed
grades within one recipe, or two recipes that derive the same word. An invalid
recipe set takes the refusal treatment (state 26). The control never shows an
invented name. The architect decides which prefixes count as grades and where the
derivation lives (memlog 233).

### Money

**Money figures read at 2 decimal places** (memlog 85): EV, price, Craft Cost and
the threshold alike. `core` stores figures at 4 decimal places, and the page
rounds each figure once, for display. A figure that is present and non-zero but
rounds to `0.00` prints **`< 0.01`**. That is a quantity, not a missing figure. A
negative figure takes the minus sign U+2212, not a hyphen.

**Craft Cost prints once**, beside the recipe (memlog 182, 258 N-16; FR-26). The
player checks every crafted EV against it. Where the recipe is **uncostable**, the
slot holds the uncostable phrase and never a number (FR-26, AD-20; state 35).

### Combinations and short forms

**A Combination is written as tier plus short form, never as a value**
(memlog 134). `T1 Cold Res · T1 Mana`, not `+35% Cold Res · +180 Mana`. The player
operates on tiers, so the tier is the comparison that the page makes. This rule
governs the chase cells and the expansion lines. Thus an exact value band appears
nowhere except in the fallback below.

**The tier is the Accepted Tier, declared by the curator** (memlog 135). The page
reads it from `acceptedTier` on the Modifier Reference, beside its band (PRD §3
*Accepted Tier*, FR-22; AD-5). It is for display only. It is never derived from
the band, never joined to the Weights File's `tierLabel` and never part of a
canonical key. `T1` names the tier that the player chose to chase. It is not a
claim about any item that a search returned.

**A label may name a mixture** (memlog 137). `T1–T2` is legal. For a multi-`#`
modifier, the value axis does not partition the tier axis (AD-28). Thus the page
prints what the curator accepted.

**Chase Combination text uses canonical short forms** (memlog 34). Each tracked
modifier has one short form, so the same modifier reads the same way on every row.
**The table is a product constant in `web`, keyed by `statId`** (memlog 231). A new
tracked modifier needs a code change before it reads in short form. Short forms are
never invented per row and never truncated ad hoc. The table is written against a
budget of about **27 characters** per chase cell (memlog 104, 140). That figure is
the working budget until the build measurement replaces it (DESIGN.md, *Measure at
build*; memlog 268). The same measurement sets how many chase cells a row shows
(Responsive & Platform). A form that still overruns ends in an ellipsis, and the
full text is one click down.

**How to coin a short form** (memlog 118):

1. **A Glossary term is never abbreviated.** This rule governs modifier text only.
2. **Borrow, never invent.** A coined form must be one that the player already
   reads in the game or on the trade site (`ES` for Energy Shield).
3. **Unique across the whole table.** Two modifiers never share a short form.
4. **Written once, never varied per row.**
5. **The tier prefix is never abbreviated or varied** (memlog 141). `T1`, never
   `1`, `t1` or `Tier 1`. A mixture takes an en dash: `T1–T2`.

**Escape valve.** A modifier whose shortest legitimate form still overruns the
budget when paired is a **candidate for pruning, not for a shorter coinage**.

**The fallback covers two gaps** (memlog 138, 231). A tracked modifier can have no
short-form entry or no declared Accepted Tier. Then it falls to the Trade Catalogue
stat name **plus the value band**, with numerals and units in full (`+35%`,
`+180`). A missing short form is a **product gap**, which the `web` table fills. A
missing Accepted Tier is a **curation gap**, which the Tracked List fills. The
fallback is set in the **verbatim register** (memlog 208). That register means
*the page quoted this text out of a file*, and it is reserved for that meaning. The
fallback takes no trust colour, because it states nothing about a price
(DESIGN.md, Typography, owns the treatment).

**A Hybrid Modifier affix is the tier label, then its lines** (PRD FR-34; CAP-7).
One affix has one Accepted Tier label, then the short form of each line,
comma-separated: `T1 % ES, % Evasion`. The `·` that joins two affixes is unchanged.
**Short forms are all or none** within one affix. If the tier, any line's short
form or any line's band is missing, every line prints in the fallback register.
The joined label obeys the chase-cell budget and ends in an ellipsis there. An
expansion line never cuts it. Three or more lines take the same rules. **The page
accepts the ambiguity with two separate affixes** (FR-34). It adds no glyph,
bracket or explanation.

`[NOTE FOR UX]` (memlog 143) **Two Combinations can still read identically.** The
page prints the curator's declared `acceptedTier`. Nothing requires two tracked
bands of one modifier on one Item Class to declare different tiers. Rule 3 makes
the short-form table unique, but it does not reach this case. Nobody ruled on what
the second Combination prints.

### What may be cut

Truncation is legitimate only where the text has somewhere to go (memlog 103).

- **On a ranked row, the name and the chase cells may end in an ellipsis.** The
  open expansion holds the same text in full. Its context line leads with the
  row's full name (memlog 265), and its lines hold every Combination. A cut chase
  cell also shows its full text on hover (memlog 273).
- **Nothing in an expansion line is cut.** There is no ellipsis, and no tooltip
  stands in for text that did not fit. The trust cell is wide enough for the
  longest reason to clear the ↗ (memlog 261).
- **Never cut:** a trust mark, ≈, the EV figure and a column-header label
  (memlog 119). Each mark *is* its non-colour cue. A long name yields before the EV
  cell does.
- **An expansion hides whole lines** behind `+ N more combinations` (state 39) and
  never cuts one. Thus every Tracked Entry stays one click away (FR-8).

## Voice and Tone

Microcopy rules. DESIGN.md holds the aesthetic posture.

The page speaks the way the brief speaks: plainly, to one player, about one
decision. Use short declaratives. Use no exclamation, no encouragement and no
celebration of a good number. State words are lower case. A reason is a fragment
with no full stop. A tooltip and the footer use sentences.

**An age names its clock**, the event it counts from. `priced` counts from the
price observation, and `tried` counts from the last attempt to price (FR-12). The
Tracked List edit date says whether it came from a commit (Copy Deck).

**Ages** (memlog 265, 275). Round N down.

- **In a reason:** `N min ago` under an hour, `N hours ago` under a day, and
  `N days ago` from one day.
- **On the sync button, compact** (memlog 279): `just now` under a minute, `Nm ago`
  under an hour, `Nh ago` under a day, and `Nd ago` from one day. The button reads
  `Synced just now`, `Synced Nm ago`, `Synced Nh ago` or `Synced Nd ago`. The
  compact forms keep the header inside its width budget (DESIGN.md, Layout &
  Spacing).

| Do | Don't |
|---|---|
| `Prices are live asking prices, not sales.` | "sells for", "sold for", "market value", or anything implying an observed sale (FR-13) |
| `no listings found` | "no value", "worthless", "nothing here": a jackpot and junk look alike when nobody lists |
| `rough · priced 5 days ago` | an unlabelled "5d" in a reason, or an age without its clock |
| `pending · not checked yet` | "unknown", "n/a", `0` |
| `broken · gone after a patch` | "error", "invalid", a raw id |
| `Some roll odds are estimated` | "prior", "uniform prior", "weight source", "data quality: low" |
| `—` beside a mark and its word | `—`, `0` or `0.00` for a missing price where no mark and word sit beside it |
| `Synced 1m ago ▾` and nothing else when healthy | a green dot, "All good", "0 problems" |
| `Read-only. Curation lives in data/tracked.json.` | "Editing is disabled" |

**`worth` carries the threshold's meaning only** (memlog 243, 270, 275). It
appears in the title, in the threshold label, and in the EV tooltip's count of
outcomes worth at least the threshold. No copy says that a figure *is worth* an
amount or *sells for* it.

**FR-13's asking-price framing prints twice** (memlog 243, 258 N-19): as the
footer sentence and as a sentence in the EV tooltip (Copy Deck). The footer sits at
the end of the page. Thus the tooltip keeps the framing one hover from every
figure. Do not shorten either one further.

## Copy Deck

This section holds every fixed string that the page prints, by place. Epistemics,
*Price trust*, holds the reasons and their variants. A mark character
(◐ ○ ✕ ≈ ▾ ↗ ■ ≥) in a string is shorthand for its drawing (DESIGN.md,
Typography). `N` stands for a count, and `N.NN` stands for a figure at 2 decimal
places. **Placeholders** are in angle brackets inside code:

| Placeholder | Stands for |
|---|---|
| `<league>` | the active league's name |
| `<age>` | a compact sync-button age (Voice and Tone, *Ages*) |
| `<threshold>` | the live threshold, at 2 decimal places |
| `<craft cost>` | the active recipe's Craft Cost, at 2 decimal places |
| `<name>` | the row's full name |
| `<word>`, `<reason>` | a trust word and its reason (Epistemics, *Price trust*) |
| `<file>` | an artifact's file name |

Braces in this document always mean a DESIGN.md token, never a placeholder.

### Header, list and tooltips

| Place | String |
|---|---|
| Header eyebrow | `<league>` alone, e.g. `Forbidden Rites` (memlog 243). A control never sits in the eyebrow (memlog 181) |
| Header title | `What's worth picking up` |
| Recipe | `Recipe` · the option word (`greater`, `perfect`, `regular`). One recipe published: `Recipe` · its word, as plain text (state 42). None published: nothing (state 43) |
| Craft Cost | `N.NN div / craft`; uncostable: `no figure yet` (state 35) |
| Threshold | `Worth ≥` · `N.NN div` (memlog 270) |
| Sync button, healthy | `Synced <age> ▾` |
| Sync button, sync time unknown | `Not synced yet ▾` (memlog 265) |
| Sync button, a problem holds | `✕ N problems ▾` (`✕ 1 problem ▾`) or `◐ N problems ▾` (`◐ 1 problem ▾`), in place of the age (Epistemics, *Loud when wrong*) |
| Column headers | `#` · `Item class / base` · `EV (Divine)` · `Best combinations` |
| EV tooltip | ¶1 `Expected value per craft.` `What one craft on this item class returns on average, in Divine. It counts only outcomes worth at least <threshold> div and subtracts the <craft cost> div craft cost.` ¶2 `For a base you sell as is, it is that base's asking price. Every price is a live asking price, not a sale.` ¶3 `≈ some roll odds are estimated · ◐ unreliable price · ○ no price yet · ✕ broken. Hover a mark for the reason.` |
| EV tooltip, recipe uncostable | ¶1's last sentence ends at `<threshold> div.` and is followed by `Craft cost is unknown for this recipe, so crafted rows have no figure yet.` (memlog 268, 278). ¶2 and ¶3 are unchanged |
| EV tooltip, no recipe published | ¶1's last sentence ends at `<threshold> div.` and is followed by `No recipe is published, so crafted rows have no figure yet.` ¶2 and ¶3 are unchanged |
| Raw Base row, chase slot | `Sell as is · item level 82+` |
| Mark tooltip | `<word> · <reason>`, e.g. `rough · 74% of this EV rests on unreliable prices` |
| Chase cell, cut | the cell's full Combination text on hover; no other string |
| Expansion context line | `<name>`, e.g. `Body Armours (Str/Dex/Int)` (memlog 265). With ≈ it continues: `<name> · ≈ Some roll odds are estimated: no published weight for one mod tier. All prices below are real listings.` |
| Expansion line, below threshold | `below threshold` |
| Curation marks | `* pinned` · `† pruned` |
| `{components.show-more}` | `+ N more combinations` / `− show fewer` (memlog 264) · `+ N pruned` · `+ Read the remaining N rows` / `− Show only the top 20` · `+ Try again` |
| Footer legend | Nine items, in this order: (1) `■ craft this class` (2) `■ sell this base as is` (3) `no mark = current price` (memlog 275) (4) `◐ rough unreliable price (a row: 70%+ of its EV)` (5) `○ pending no price yet` (6) `✕ broken can no longer be priced` (7) `† pruned · * pinned` (8) `≈ some roll odds estimated` (9) `Prices are live asking prices, not sales. Read-only. Curation lives in data/tracked.json.` |
| List statement, state 23 | `In canonical order, not ranked: no tracked unit has a price from <league> yet.` (without `yet` when every listed row is broken) |

### Sync report

The attribution lines (memlog 243). A `|` separates the fields on a line.

| Line | Lead | Fields |
|---|---|---|
| 1 | `Weights File` | `producer` · `generatedAt` · `gamePatch` |
| 2 | `Last synced` | `Tracked List last edited` |

Line one prints its three field names as FR-10 spells them. These names identify a
file, and this is the one place on the page that allows that spelling. A committed
Tracked List date prints bare. A date read from the file's last change prints with
the suffix `(not committed)` (memlog 209). With neither date, the field reads
`unknown` (FR-18, AD-12, AD-9).

The page prints one absence line per absent tolerable file (memlog 213, 258 N-8;
state 38). The lead is `Not published`, and the bodies are:

| Absent file | Body |
|---|---|
| `weights.json` | `weights.json — every crafted class is unrankable.` |
| `recipes.json` | `recipes.json — no crafted rows can be ranked.` |
| `sync-report.json` | `sync-report.json — the sync report is unavailable.` |

A coverage figure that the report omits reads `not measured` while a weights
envelope is loaded. Without an envelope, it reads `unknown` (memlog 212).

The headings, figure groups and diagnosis lead (memlog 278):

| Place | String |
|---|---|
| Sync report column headings | `Problems` · `Sync run` · `Weights coverage` · `Built from` (set uppercase) |
| Sync run figures | `Requests` · `price searches N` \| `league checks N`, for the `tracked-list` and `league-validation` sources; then `N entries not reached in the last sync pass` |
| Weights coverage figure | `Pool coverage` · `N% of N tracked Item Classes` (memlog 235) |
| Diagnosis lead | `Disagreements with the weights file` |

### Appendix and failure screens

| Place | String |
|---|---|
| Appendix title | `Appendix: Unrankable — N Item Classes` |
| Appendix reasons | `pool partial` · `class absent from weights file` · `class disagrees with weights file`, verbatim from FR-4. One string covers all five cross-file checks. FR-4 owns this enum, so re-read FR-4 on every absorption rather than trusting this copy |
| Appendix lead | `Tracked, but kept out of the ordering.` (memlog 278) |
| Appendix note, state 14 | `ranks once the weights file covers its whole pool` |
| Appendix note, state 15 | `may return after the next weights run` |
| Appendix note, state 15a | `fixable in data/tracked.json · the sync report has the detail` |
| Appendix note, state 16 | `some of its bases still rank, sold as is` |
| Refusal eyebrow | `✕ The page will not render this` (set uppercase; memlog 278) |
| Refusal title | `A required file cannot be used.` (memlog 220) |
| Refusal, fixed sentence | `The page renders again as soon as a valid set is published, and serves nothing old in the meantime.` |
| Fetch-failure eyebrow | `✕ The page could not load its data` (set uppercase; memlog 278) |
| Fetch-failure title | `One of the data files did not arrive.` (memlog 237) |
| Fetch-failure body | `<file> did not arrive.` then `The page shows nothing rather than a partial set, because half a ranking is worse than no ranking.` |

**Strings drafted at build** (memlog 265): the list statements of states 25 and
35, the sync report's problem-list lines, and the refusal screen's per-cause body
sentences. The build drafts them under Voice and Tone. Their review happens in
the PR that builds them, and that PR writes them into this deck. Thus the rule still
holds: a string not written here does not ship.

## Component Patterns

This section is an index. Each component's behaviour is written once, in the home
that this table names. DESIGN.md, Components, owns its look under the same name.

| Component | Use | Behaviour lives in |
|---|---|---|
| `{components.header-bar}` | Top of the page, sticky | Information Architecture |
| `{components.recipe-toggle}` | Header bar | Interaction 1a; states 34, 35, 42 and 43; *What survives a reload*; Domain Vocabulary, *Recipe option words* |
| `{components.threshold-control}` | Header bar | Interaction 1 |
| `{components.sync-button}` | Header bar, right end | Epistemics, *Loud when wrong*; states 30 and 31; Interaction 5 |
| `{components.sync-report-panel}` | Under the header, when open | Epistemics, *The sync report*; Interaction 5; state 32 |
| `{components.list-statement}` | Above the column header | States 23, 25 and 35; Copy Deck. Not interactive |
| `{components.column-header}` | Above the list | Information Architecture, *The ranked list*; Copy Deck. Static and not sortable |
| `{components.ev-tooltip}` | Hover on the EV header | Interaction 8; Copy Deck |
| `{components.ranked-row}` | Ranked list | Information Architecture, *The ranked list*; Interaction 2; states 17, 18, 21, 40 and 41 |
| `{components.trust-mark}` | Ranked rows and expansion lines | Epistemics, *Price trust* |
| `{components.estimate-mark}` | Before a crafted row's EV | Epistemics, *Estimated odds* |
| `{components.mark-tooltip}` | Hover on a row's trust mark | Interaction 8; Copy Deck |
| `{components.chase-cell}` | Crafted rows | Information Architecture, *The ranked list*; Responsive & Platform; Interaction 8 |
| `{components.expansion-panel}` | Below an open row | Information Architecture, *The expansion*; Interactions 2 and 7; state 39 |
| `{components.expansion-line}` | Inside the expansion | Information Architecture, *The expansion*; states 1–10 and 20 |
| `{components.show-more}` | List foot, expansion, pruned lines and retry | Interactions 3, 4 and 7; state 28 |
| `{components.trade-link}` | Expansion lines | Interaction 6 |
| `{components.unrankable-appendix}` | Foot, above the footer | States 13–16, 36 and 37 |
| `{components.footer-legend}` | Foot | Information Architecture; Copy Deck |
| `{components.failure-screen}` | Replaces the whole page | States 26 and 28 |

## Epistemics

Half of this product is the ranking. The other half is honesty about what the
ranking rests on. The rules below are load-bearing.

### Silence means healthy

A row whose price is current and whose roll odds are measured carries **nothing**
in its mark slot and no ≈ before its EV. Silence is the statement. A healthy sync
puts nothing on the sync button but its age.

There is deliberately no success mark. A success colour on nineteen rows in twenty
would bury the one row that matters. The footer legend's `no mark = current price`
keeps the silence legible. Thus an empty slot reads as *current* and not as *not
computed*.

### Loud when wrong

Silence is only half the rule (memlog 70). A real problem must be visible without
anyone going to look for it. A page that is silent when broken looks exactly like a
page that is silent because it is fine.

**The sync button carries the alarm** (memlog 254, 265, 270). While any problem
holds, the problem count replaces the sync age on the button. The count leads with
✕ when any counted entry is broken, and with ◐ otherwise (Copy Deck). The player
then reads the age in the sync report. The button never holds the age and the
count at once, so the header never widens. Data raises the count, never a click.
Three things are problems:

1. **Broken entries exist.** At least one entry is `unresolvable` (FR-24). Its
   problem-list line leads with ✕.
2. **Pinned entries are starved** (FR-17, FR-25). This is unreliable, not broken,
   so its problem-list line leads with ◐ (memlog 265). The count comes from the
   pinned-starvation record that matches the loaded curation
   (AD-7; memlog 216, 222). M is the size of the pinned
   set. N is the number of pinned entries that the truncation left out. **When no
   record matches**, no problem is raised. The curation changed after the
   starvation, and the record stays in the sync report as diagnosis. **When N is
   0** (memlog 223), the pinned set left the rotation no search. That is still a
   problem, with its own wording. A record survives until the player's edit
   (AD-12), so the line never says *this run*.
3. **The game patch is stale.** This is unreliable, not broken, so its
   problem-list line leads with ◐ (memlog 265).

`[NOTE FOR ARCHITECT: memlog 254 counts a stale game patch as a problem, but the
page makes no call to the game and has no live patch to compare against
(state 29). The predicate needs a data source the page can read, for example a
patch the sync run records beside the Weights File's `gamePatch`. None exists yet,
so this problem cannot fire (memlog 265).]`

**The count is of affected entries, not of problem kinds** (memlog 265). Every
broken entry, and every pinned entry that the starvation left out, counts once. A
starvation that left out no entry counts as one. A stale game patch counts as one
(memlog 268).

A problem never comes from an age threshold on attribution, from an absent
tolerable file, or from a cross-file check failure. The player already sees that
failure as Unrankable rows (FR-4). The sync report lists its diagnosis but does not
count it (memlog 275).

### Attribution is not a problem

The Tracked List edit date, the Weights File producer, `generatedAt` and
`gamePatch` are attribution. They state what the page was built from and when
anyone last touched it (memlog 88, 89). They print plainly in the sync report, with
no mark and no colour. No age turns any of them red. An honest fact does not become
a judgement that the data cannot support.

### Price trust

The player asks one question of a price: *can I trust it?* The page answers with
one verdict per price, in four states (memlog 244, 253, 257). This section owns
the states, their thresholds and their words. DESIGN.md owns each mark's colour.

| State | Mark | Means |
|---|---|---|
| Current | none (the slot is empty) | the price is current |
| Rough | ◐ `rough` | the price is unreliable |
| Pending | ○ `pending` | there is no price yet |
| Broken | ✕ `broken` | the entry can no longer be priced |

**A price is unreliable (◐ rough) on either of two triggers:**

1. **It is old**: 3 days old or older, 72 hours from its observation (memlog 244,
   258 N-17). The 3-day threshold sits above the partial refresh cycle of about
   15 hours. Thus normal rotation never marks a row.
2. **It is thin**: it rests on fewer than 3 listings (memlog 263).

**Listing counts print only as the thin reason**, `only 1 listing` or
`only 2 listings`, and nowhere else on the page (memlog 263). **A price that is
both old and thin prints both reasons**, age first (memlog 268).

**One entry's verdict and reason** (memlog 257, 263). N is whole days, rounded
down.

| Entry condition | Mark · word | Reason on an expansion line | Reason in a Raw Base row's tooltip |
|---|---|---|---|
| `priced`, under 3 days, 3 listings or more | none | none, and no age prints | none |
| `priced`, 3 days or older | ◐ `rough` | `priced N days ago` | `priced N days ago` |
| `priced`, on 1 listing | ◐ `rough` | `only 1 listing` | `only 1 listing` |
| `priced`, on 2 listings | ◐ `rough` | `only 2 listings` | `only 2 listings` |
| `priced`, 3 days or older, on 1 or 2 listings | ◐ `rough` | `priced N days ago · only 1 listing` / `priced N days ago · only 2 listings` | the same |
| `no-listings` | ○ `pending` | `tried N days ago · no listings` | `no listings found` |
| `not-yet-synced` · `never-synced` | ○ `pending` | `not checked yet` | `not checked yet` |
| `not-yet-synced` · `league-mismatch` | ○ `pending` | `price from last league` | `price from last league` |
| `not-yet-synced` · `no-exchange-rate` | ○ `pending` | `no Divine rate for its currency` | `no Divine rate for its currency` |
| `unresolvable` | ✕ `broken` | `gone after a patch` | `gone after a patch` |

*Pending* covers two FR-9 Price States with one mark. Its reason text keeps all
four causes apart (memlog 257). After a league reset every row may read pending,
and that is honest (state 23).

**A Raw Base row's verdict is its one entry's verdict.** The row has one price, so
its own entry decides. Its tooltip carries that entry's reason.

**A crafted row's verdict** (memlog 245, 257, 265). The first rule that applies
decides:

- **No recipe is published** → ○ `pending`, EV cell `—`, reason
  `no recipe published` (state 43; memlog 275).
- **The active recipe is uncostable** → ○ `pending`, EV cell `—`, reason
  `no figure yet — craft cost unknown` (state 35). This rule takes precedence over
  every rule below, all-broken included (memlog 268).
- **Every entry is broken** → ✕ `broken`, EV cell `—`, reason
  `all combinations gone after a patch` (state 41).
- **No priced combination** → ○ `pending`, EV cell `—`, reason `no prices yet`
  (state 18).
- **At least 70% of the row's EV rests on unreliable prices** → ◐ `rough`.
  - *Unreliable:* either trigger. Thus a thin line counts as an old one does
    (memlog 263).
  - *Measured on* gross outcome value, before Craft Cost is subtracted. Pending
    lines are left out of both the part and the whole. Thus a row whose EV is at
    or below zero still has a defined verdict.
  - *Reason:* `N% of this EV rests on unreliable prices`. N is in whole percent,
    rounded down, so the printed figure never contradicts the rule.
  - *When gross outcome value is zero:* the measure is the share of the row's
    priced lines that are unreliable, against the same 70% (memlog 265). Reason:
    `N% of its priced combinations are unreliable` (memlog 268).
- **Otherwise** → no mark.

`[NOTE FOR ARCHITECT: the share-of-EV formula belongs in the architecture spine,
including whether below-threshold outcomes count in the gross value and which
lines the zero-value fallback counts as priced (memlog 265). State 25 puts every
crafted row on the fallback.]`

A crafted row carries ✕ only when every entry is broken. Otherwise the ranking
excludes broken entries (FR-24), and they show on their own expansion lines.

**Where the verdict shows** (memlog 247). On a ranked row, the mark stands alone in
the mark slot after the EV figure. Thus the glance from the game still sees it, and
only the reason waits for a hover. On an expansion line, the mark, the word and the
reason are inline. The cue is shape plus colour, never colour alone (NFR-10). The
mark is not a click target.

### Estimated odds

**≈ means the roll odds are estimated, and the price is real** (memlog 246). ≈
prints before the EV of a crafted row whose `(Item Class, recipe)` pair carries
AD-10's `uniform-prior` value. In that pair, at least one tier in the recipe's
eligible set has no published weight. Thus the pair's odds rest on at least one
invented weight (AD-10; memlog 275). On screen the cue keeps its words: *some roll
odds are estimated*. ≈ and ◐ share one colour and differ in shape (DESIGN.md).

- **It is not a price-trust state.** Price trust speaks about price only. A row can
  carry ≈ and ◐ at once, because they answer different questions.
- **One cue per `(Item Class, recipe)` pair** (memlog 238). Two recipes on one Item
  Class can differ. A recipe switch swaps the ≈ silently, in the same synchronous
  pass as rank, EV and chase cells. There is no transition, no highlight and no
  note.
- **Per row only, with no global banner** (memlog 256). ≈ stays on every affected
  row, even when every crafted row carries it. A mark that is true on every row
  still states a true fact. ≈ has no tooltip of its own. The EV tooltip and the
  footer legend explain it.
- **Stated once inside the expansion**, as the context line at the top of the
  panel. It is never repeated per line. Every line in one panel shares the pair's
  odds, so a per-line cue would repeat one fact and discriminate nothing.
- **≈ does not mean the pool is invented.** It states that something in the set is
  estimated. The cue, the context line and the tooltip must not say more.
- **A Raw Base never carries ≈**, because it rests on no modifier pool (FR-4).
- AD-10's `absent` value cannot reach a ranked row. A `partial` pool makes the Item
  Class Unrankable, and the appendix prints its reason alone (state 13).

`core` carries the weakest odds value and the oldest timestamp of every input into
each derived figure (AD-4). The page shows what it is given and computes no ranking
term itself.

### Missing figures

A missing price never holds a number-shaped placeholder (memlog 43, 258 N-5).

- **`—` stands for a missing price wherever a mark and its word sit beside it.**
  This covers an expansion line's price cell, beside its trust cell or
  `† pruned`. It also covers the EV cell of a pending or broken row, Raw Base or
  crafted. That includes every crafted row while the recipe is uncostable or none
  is published (its mark, with the word one hover away; memlog 265). The mark says
  *which* question is open, so the dash cannot read as worthless (FR-9).
- **Where no mark sits beside the slot, a phrase holds it.** The Craft Cost slot of
  an uncostable recipe reads `no figure yet` (state 35).
- Never `0`, never `0.00`, never blank. `< 0.01` is a quantity. A negative EV is a
  known figure, dimmed but printed (state 21).
- `no-listings` is an open question, never an answer that a Combination is junk.
  Listings cannot tell a jackpot from junk.

### The sync report

Interaction 5 opens `{components.sync-report-panel}`, and the panel starts closed
on every load. The panel reads its figures from `sync-report.json` and never
recomputes them. It prints only what the report publishes, with no figure, total or
class name of its own (memlog 235). Thus a coverage drop across a game patch is
visible in the product and not only in the file. The panel has four columns, in
this order. The Copy Deck holds the headings, and DESIGN.md owns the layout and the
height cap.

1. **Problems** (memlog 254, 275). Broken entries (FR-24), starved pinned entries
   (FR-17, FR-25) and a stale game patch. Each is a counted problem (*Loud when
   wrong*). The cross-file diagnosis follows them, listed and **not counted**
   (state 27). It has one line per failing check:
   `check · canonical key · detail`. With no failing check, the diagnosis is
   absent. With no weights envelope loaded, it is one `unknown` line.
2. **Sync run.** Requests per source, and entries not reached in the last sync pass
   (FR-25). The page never renders the `session-probe` source (AD-30).
3. **Weights coverage.** Pool coverage as a fraction **with its denominator**
   (FR-4), or its missing-figure phrase (Copy Deck).
4. **Built from.** The two attribution lines, and one `Not published` line per
   absent tolerable file (state 38).

### Two registers in one panel

(memlog 206, 208) The cross-file diagnosis makes the sync report the one region
that carries two registers.

**The page's voice**: every figure group and every attribution line. These are
counts, fractions with their denominators, and labels written as the player would
say them.

**The file's voice**: the cross-file diagnosis, and nothing else. The back-end-only
nouns are allowed here, because the text is a string that the player copies into
an editor. **The diagnosis alone is set in the verbatim register.** It is the same
non-colour cue that the Combination fallback takes, because both print text that
the page did not write. The diagnosis takes the panel's own size and line height,
so the panel's cap and internal scroll do not move. The diagnosis is never promoted
out of the panel.

## State Patterns

→ [`mockups/key-redesign-dark.html`](mockups/key-redesign-dark.html) shows states
1, 2, 4, 5, 11, 12, 17, 18, 20, 21, 30 and 39. Its specimen box shows state 31, the
row tooltips, state 32's panel and the list-statement slot (memlog 269). This
section specifies the remaining states, and no other place does (memlog 98).
**State numbers are stable identifiers** (memlog 189). A state is never
renumbered. A retired state keeps its number, and a new state takes the next free
number.

| # | State | Where | Treatment |
|---|---|---|---|
| 1 | Price State `priced` | `{components.expansion-line}` | The price in Divine at 2 decimal places. The trust cell follows *Price trust*: empty under 3 days on 3 listings or more, ◐ when old or thin |
| 2 | Price State `no-listings` | Expansion line | Price `—`. ○ `pending` with its reason (*Price trust*). A `no-listings` entry carries no observation, so its clock is the attempt's |
| 3 | Price State `not-yet-synced` | Expansion line | Price `—`. ○ `pending` with the reason of states 5–7, so the three causes never collapse in words (FR-9) |
| 4 | Price State `unresolvable` | Expansion line, surfaced not omitted | Price `—`. ✕ `broken` with one reason for every broken entry, Raw Base or Combination, because the line already names what it prices. Excluded from the ranking (FR-24) and counted as a problem (state 31) |
| 5 | reason `never-synced` | Expansion line | ○ `pending`. No age, because no request was ever issued |
| 6 | reason `league-mismatch` | Expansion line | ○ `pending`. Treated as absent, never as stale-but-usable (FR-31) |
| 7 | reason `no-exchange-rate` | Expansion line | ○ `pending`. There is no "priced but not convertible" state |
| 8 | Curation Status `active` | Expansion | No marking. It is the ordinary case |
| 9 | Curation Status `pinned` | Expansion line | `* pinned` **leads** the line, ahead of tier plus short form (memlog 199). **It is a lookup key, not a badge.** The starvation problem names no entries, so this mark is what the player scans open panels for |
| 10 | Curation Status `pruned` | Inside the expansion, behind `+ N pruned` | Collapsed by default (memlog 25; Interaction 3). When opened: the Combination struck through, `† pruned`, price `—`, and a **second line that carries the prune reason alone** (memlog 116, 234, 258 N-3). No age, because a prune is a decision, not a reading of either clock. No trade link |
| 11 | Odds `measured` | Ranked row | Nothing before the EV. The absence is the statement |
| 12 | Odds `uniform-prior` | Ranked row + expansion | ≈ before the EV (*Estimated odds*). Its expansion opens with the ≈ context line (Copy Deck) |
| 12a | Raw Base odds | Ranked row | **Nothing.** A Raw Base needs no Eligible Pool (FR-4), so no odds value reaches it. Not a gap |
| 13 | Odds `absent` | Appendix only | The row prints its FR-4 reason and **no mark** (memlog 258 N-9) |
| 14 | Unrankable, `pool partial` | Appendix | Reason verbatim, plus its note (Copy Deck) |
| 15 | Unrankable, `class absent from weights file` | Appendix | Reason verbatim. A freshly scraped class carries its note (Copy Deck) |
| 15a | Unrankable, `class disagrees with weights file` | Appendix | Reason verbatim, **one string for all five cross-file checks** (state 27, FR-4). This class's pool is `complete` and published. Thus this is the Unrankable row that the player can fix without help, and its note says so (Copy Deck). The note never names the check, the entry or its key, which are diagnosis (memlog 206) |
| 16 | Unrankable class whose Base Types still rank | Appendix + ranked list | The class sits in the appendix with its reason. Its note **names the fact, not a rank** (Copy Deck). Those Base Types rank normally as Raw Base rows |
| 17 | Rough row | Ranked row | ◐ in the mark slot, and the reason in `{components.mark-tooltip}`. Crafted: the 70% rule. Raw Base: its own price is old or thin (*Price trust*) |
| 18 | Pending row | Ranked row | ○ in the mark slot, EV `—`. Raw Base: its entry is pending, and the tooltip carries the entry's reason. Crafted: no combination is priced, reason `no prices yet`. This holds in every state, not only in state 23 (memlog 265). States 35 and 43 take their own reasons (*Price trust*) |
| 19 | Retired (memlog 256) | — | The global estimated-odds banner, its dismiss control and its copy are retired. ≈ is per row only (state 12) |
| 20 | Below-threshold entry | Expansion line | **Dimmed**, with `below threshold` in the trust cell and no mark (memlog 258 N-3). Shown, never hidden (FR-8). **It prints only `below threshold`**, even when its price is also unreliable (memlog 265) |
| 21 | Item Class with no qualifying Combination | Ranked row | Chase cells empty. Its EV is negative by its Craft Cost and prints at 2 decimal places, **dimmed** (memlog 258 N-20). It is a known figure and bad news, not missing news. Thus it is never `—` and never a phrase. It is **ranked, not Unrankable** (FR-1) |
| 22 | Cold load / skeleton | Whole page | `{components.header-bar}`, the column header with its final labels, and twenty skeleton rows paint at once in the final layout. The eyebrow stays blank until the league is known (memlog 211). The page never jumps (memlog 50). `[ASSUMPTION — memlog 51]` Every artifact resolves in a **single transition**, never row by row |
| 23 | Honest empty: league reset | Whole list | (memlog 48) Every tracked unit, every Item Class and every Raw Base, renders in **canonical order**. The list refills over the following day. `[ASSUMPTION — memlog 49]` Rank numerals are **suppressed**, and the list statement says that the order is canonical (Copy Deck). Every row reads ○ pending, or ✕ broken for a broken entry, and every EV cell reads `—` (memlog 257). After a pure reset, the pending reason is `price from last league`. After a mixed reset, some rows carry a new-league reason such as `no listings found`. Each expansion keeps its entries' own reasons. The statement drops `yet` when every listed row is broken, and keeps it while one row is pending. It names no cause, because the sync button's count already carries broken entries |
| 24 | Partially refreshed dataset | Whole list | Renders normally. Per-row price trust makes that honest. No global "stale" treatment |
| 25 | Nothing clears the threshold | Whole list | **The one state the player typed** (memlog 204). Every crafted Item Class is still ranked, at minus its Craft Cost (FR-1), and dimmed (state 21). Raw Bases under the threshold leave the ranking. **Rank numerals stay.** The order is computed and the figures tie, so AD-17's declared tiebreak orders them. Thus the order is identical across loads. A plain list statement names the live threshold at 2 decimal places. It states the condition with no instruction, because the remedy is on screen in the header. It is not a missing figure, so it is not a phrase in any cell |
| 26 | Refused artifact | Whole page | The refusal variant of `{components.failure-screen}` replaces everything (FR-33, NFR-8; memlog 221). The cause is one of three: a fetched artifact is schema-invalid, declares a version that the page does not read, or is required and not published. The title names no cause (memlog 220). The body names which artifact and why. No retry: the fix for a refusal is a valid published set, and the fixed sentence says so (Copy Deck). An invalid recipe set takes this treatment (*Recipe option words*) |
| 27 | Cross-file policy check failure | Report, never refusal | Five cross-file checks run at load (AD-17). The page still renders. The affected Item Classes are Unrankable with `class disagrees with weights file` (state 15a). **The sync report's Problems column lists the diagnosis**, in the file's register, and **does not count it** (memlog 206, 275) |
| 28 | Artifact fetch failure | Whole page | The fetch-failure variant of `{components.failure-screen}`, shown when an artifact does not arrive (AD-24). Its title and body name the file (Copy Deck). `+ Try again` re-attempts the whole set, never a partial one. **A partial set is never rendered** (FR-33) |
| 29 | Stale Weights File after a patch | `{components.sync-report-panel}` | The page makes no call to the game. It shows the `gamePatch` that the Weights File declares, in the sync report (memlog 258 N-8). The player knows which patch they play. When the page can tell that the patch is stale, it is a counted problem (*Loud when wrong* and its `[NOTE FOR ARCHITECT]`). Neither a stale weights file nor a stale catalogue breaks the page |
| 30 | Sync button at rest, healthy | `{components.sync-button}` | `Synced <age> ▾` and nothing else: no dot, no colour, no count (memlog 254). This is the state on most loads |
| 31 | Sync button, a problem holds | `{components.sync-button}` | The count in place of the age (*Loud when wrong*; Copy Deck). Attribution never raises it |
| 32 | Sync report open | `{components.sync-report-panel}` | Interaction 5 opens it. Its content follows *The sync report*. It caps its height and scrolls inside past the cap (DESIGN.md) |
| 33 | Ranked list grown past 20 | Ranked list | Interaction 4 grows it. The list holds every ranked unit. Ranks 21+ are plain. The appendix and footer stay below. A click caused the growth, so it may scroll the page |
| 34 | Craft Recipe switched | Whole list + `{components.recipe-toggle}` | Interaction 1a. A row's ≈ swaps silently when the new pair differs (memlog 238) |
| 35 | Active recipe uncostable | `{components.recipe-toggle}` + ranked list | A recipe that names a currency with no current rate is **uncostable**. It is never costed at zero (FR-26, AD-20). Craft Cost reads `no figure yet`. **Every row stays** (memlog 205), and no class becomes Unrankable. **Each branch keeps its own order, and no rank numeral spans the two.** Rank numerals are suppressed, and the top-five emphasis runs **per branch**. A list statement names the active recipe. It says that the two branches are not comparable while the state holds. Every crafted row reads ○ with EV `—` (*Price trust*). **FR-5's bound applies per branch**: up to 20 rows of each, with one list affordance under each. Thus the resting page can hold 40 rows and scroll |
| 36 | An Item Class unrankable under one recipe only | Appendix or list | AD-17 truncates the Eligible Pool below a recipe's `modifierLevelMin`. An empty surviving pool makes that pair unrankable. The class is Unrankable while that recipe is active, and it ranks under the other. **FR-4's reason enum is not extended** (the PRD's memlog, row 151). `[NOTE FOR UX]` If it ever fires, neither string describes it, and the enum is the PRD's to extend |
| 37 | Unrankable appendix with no rows | `{components.unrankable-appendix}` | (memlog 214) No recipe published (state 43), or `recipes.json` absent. The appendix keeps its place and shows its title alone, `Appendix: Unrankable — 0 Item Classes`, with a neutral count. **It does not say why it is empty.** It never prints `class absent from weights file` while a weights envelope is loaded |
| 38 | A tolerable file absent | `{components.sync-report-panel}` | (memlog 213, 258 N-8) One plain `Not published` line per absent file in the Built from column, with no mark and no colour. **Not a counted problem.** The line gives the reason once. Nothing else on the page repeats it: not the appendix (state 37) and not the `unknown` fields. An absent `weights.json` also turns the *Weights File* fields to `unknown`. An absent `recipes.json` also gives state 43 |
| 39 | Expansion on its top lines | `{components.expansion-panel}` | (memlog 264) A panel opens on the **top 8 lines** of its line order (Information Architecture, *The expansion*). It ends with `+ N more combinations`, where N counts the hidden lines without the pruned lines. Interaction 7 shows the rest and hides them again. A panel of 8 lines or fewer shows them all, with no affordance. Every Tracked Entry stays one click away (FR-8, by reachability) |
| 40 | Broken Raw Base row | Ranked row | A listed Raw Base whose entry is broken (always under state 23). It shows ✕ in the mark slot, EV `—`, and the entry's reason in the tooltip |
| 41 | Broken crafted row | Ranked row | (memlog 265) A crafted row whose every entry is broken: ✕ in the mark slot, EV `—`, reason per *Price trust*. Its expansion shows each broken line (state 4). Under state 35 or 43 the row reads as that state instead (memlog 268) |
| 42 | One recipe published | `{components.recipe-toggle}` + ranked list | (memlog 275) The header prints `Recipe` and the one option word as plain text, with no toggle, and Craft Cost beside them. There is nothing to switch (Interaction 1a). The list ranks as usual |
| 43 | No recipe published | `{components.recipe-toggle}` + ranked list | (memlog 275) The published recipe set is empty, or `recipes.json` is absent (state 38). The recipe label, the toggle and Craft Cost are hidden. Raw Bases rank normally, with rank numerals (memlog 279). Crafted rows sit below them, unranked, in canonical order. Each crafted row reads ○ with EV `—`, reason `no recipe published`. The EV tooltip takes its no-recipe sentence (Copy Deck). The appendix shows its title alone (state 37) |

## Interaction Primitives

Mouse only. Interactions 1–7 are clicks or a drag, and 6 is the only one that
leaves the page. Interaction 8 is the one hover. The numbers are stable
identifiers.

1. **Set the Payout Threshold** (memlog 255, 275). There are two ways onto one
   value, and each moves the other:
   - **Drag the slider.** The thumb snaps to steps of 0.05. The ranking sweeps
     **live**. It re-ranks at each step that the thumb crosses, with no debounce,
     because every step is a valid value. The figure follows the thumb. **A click
     on the track jumps the value** to the nearest step under the pointer, and the
     list re-ranks once (memlog 265).
   - **Click the figure and type**, to 0.01. The `div` unit is outside the
     editable region. Re-ranking fires on every valid parse, debounced about
     150 ms `[ASSUMPTION — memlog 38]`. Thus typing `0.25` does not re-rank at `0`
     and again at `0.2`. Out-of-range input is clamped on blur. The slider follows
     the typed value. Its thumb sits between steps when the value does.
   - **Constraints, shared by both** (memlog 74): min `0`, max `3`, 2 decimal
     places. The slider is linear across that range. A negative threshold cannot
     be entered.
   - **Cold start is `0.25` Divine** (memlog 258 N-17).
   - Each pass is synchronous, local and under 100 ms (NFR-6), and makes no
     network request. The threshold also changes which Combinations reach the
     chase cells and which expansion lines read `below threshold`.

1a. **Switch the Craft Recipe** (memlog 181, 243). The recipe toggle is the page's
   **second ranking dial** (FR-26). Click the inactive segment. The active segment
   is not a target. The ranking re-runs synchronously against the loaded artifacts,
   with no network and no sync (FR-1, AD-24). It is **not debounced**, because a
   click is one deliberate act. Ranks, EV figures, trust verdicts **and Best
   combinations** change together, because a recipe changes which outcomes are
   reachable (FR-26). Craft Cost updates. A Raw Base keeps its own price, but its
   rank can move as crafted rows move around it. **Open panels stay open** and
   re-render. The player is comparing, and closing their comparison would take
   their place away. With one recipe published, there is nothing to switch
   (state 42). With none, there is no toggle (state 43).

2. **Expand a ranked row.** Click anywhere on `{components.ranked-row}`. Click it
   again to close. The panel opens in place, instantly, below the row. **Many
   panels may be open at once**, because the player reads them against each other.
   Nothing closes a panel except a second click on its own row.

3. **Show the pruned lines.** `+ N pruned` inside an open panel. It is local to
   that panel and resets when the panel closes.

4. **Read the remainder of the list.** The list affordance below row 20 is
   `+ Read the remaining N rows` / `− Show only the top 20`. It names no unit,
   because the remainder holds both units. It is reversible. It grows the list in
   place to the full ranked length, and a second click restores the top 20
   exactly. `core` ranks the full Tracked List and the page truncates. Thus the
   threshold and the recipe reorder across everything (FR-5).

5. **Open the sync report.** Click `{components.sync-button}` (memlog 254,
   258 N-7). The panel opens in place under the header bar and pushes the list
   down. It opens **on the problem list when one holds**. If the page is scrolled
   at the click, the page scrolls to the top, so the panel opens in view
   (memlog 265). Click again to close.

6. **Open a Combination's trade-site search.** Click the ↗ on an expansion line,
   including a Raw Base's line. It opens that search in a new tab. This is the only
   outbound navigation, and the mark is the whole target. **The ↗ appears where the
   entry carries a stored `lastSearchId` and that search ran against the active
   league** (PRD FR-33, FR-21; AD-9, AD-24). The test reads the stored field, never
   the Price State. Two kinds of entry have no id: a never-synced entry, and an
   entry found `unresolvable` before any request was issued (FR-24). The page does
   not use an id from a previous league. A link into last league's search is the
   stale answer that FR-31 exists to prevent. The ↗ never appears on a pruned line.
   Where it does not appear, the cell is empty.

   **A stale search id is covered.** An id is exactly as old as the attempt that
   produced it. GGG expires a search about six months after its last use, and a
   temporary league is shorter. Thus an id that passes the league test is inside
   the window. Only a permanent league reaches expiry. The cost is one wasted click
   onto the trade site's own *"search is no longer valid"* page. PRD SM-1 rules
   that this is not a metric failure.

7. **Reveal the rest of a panel** (memlog 264; state 39). `+ N more combinations`
   at the foot of an open panel's top 8 lines shows the rest. `− show fewer` hides
   them again. It is local to that panel and resets when the panel closes.

8. **Read an explanation on hover** (memlog 247, 273). There are three kinds, and
   nothing else on the page has a tooltip:
   - a ranked row's trust mark opens `{components.mark-tooltip}`, with its word and
     reason
   - `EV (Divine)` opens `{components.ev-tooltip}`
   - a chase cell that its width cut shows its full text, in the shared tooltip
     look (memlog 279)

   Pointer leave closes them. A tooltip explains. It never holds a control.

**One interaction vocabulary: four looks, plus the ranked row** (memlog 248,
258 N-12). A look means one thing everywhere, so the player learns it once.
DESIGN.md specifies each look.

| Look | Means | Where |
|---|---|---|
| Dotted underline + help cursor | Hover for an explanation | `EV (Divine)`. A row's trust mark takes the help cursor alone |
| Accent ▾ + outline on hover | Click to open | `{components.sync-button}` |
| Accent text | Show more, or act | `{components.show-more}` in all its uses. ↗ turns accent on hover |
| Accent-filled control | A setting | `{components.recipe-toggle}`, `{components.threshold-control}` |
| Row hover highlight + open-row bar | A ranked row opens on click | `{components.ranked-row}` |

**Hover and persistent states.** Nothing lifts, glows or bounces. DESIGN.md owns
the tones.

| Target | Hover | Persistent |
|---|---|---|
| `{components.ranked-row}`, both variants | Row highlight and cursor pointer. No row changes height | An open row keeps its bar while any other row is hovered, and its panel carries the same bar. No column moves when a row opens |
| `{components.trust-mark}` on a row | Help cursor. Opens `{components.mark-tooltip}` | — |
| `EV (Divine)` | Opens `{components.ev-tooltip}` | — |
| `{components.chase-cell}`, cut | Shows its full text in the shared tooltip look (memlog 279). The cursor stays the row's | — |
| `{components.sync-button}` | Outline and cursor pointer | While the panel is open, the button shows its open state |
| `{components.recipe-toggle}` inactive segment | Cursor pointer | The active segment is not a target |
| `{components.threshold-control}` | The figure invites typing. The thumb invites a drag | While editing, the figure shows its editing look |
| `{components.show-more}` | Cursor pointer | — |
| `{components.trade-link}` | Turns accent, with cursor pointer. Nothing else in the line responds | — |
| `{components.expansion-line}`, appendix rows, panel contents | **No hover state.** They are not interactive | — |

**Pointer-down** (memlog 265, 268). A pressed `{components.ranked-row}`,
`{components.sync-button}` or inactive `{components.recipe-toggle}` segment shows
its pressed look until release (DESIGN.md). Text-only targets
(`{components.show-more}`, `{components.trade-link}`) and the slider have no
pressed state. Any colour change is instantaneous or at most a fast linear step
(memlog 14).

**What survives a reload** (FR-7). **The Payout Threshold and the active Craft
Recipe** persist, in the viewer's own browser storage (FR-7, AD-15). Everything
else resets. Open panels, the lines revealed and the pruned lines shown inside
them, the grown list and the sync report all start closed. The test: a value that
the player deliberately sets persists, and a value that records how far the player
read does not. The recipe is a deliberate setting, like the threshold (memlog 183).
FR-7 hands that decision to this document by name. **If a saved recipe is no
longer published, the page silently uses the first published recipe**
(memlog 275).

**Out of scope, explicitly:** focus-visible styling, `Tab` traversal, keyboard
shortcuts, access keys, right-click menus and touch gestures. Input is mouse-only
(memlog 13).

**Banned everywhere:**

- Sorting by column.
- Hover-revealed row actions.
- Tooltips other than Interaction 8's three kinds, any tooltip that holds a
  control, and any tooltip that stands in for cut text other than a chase cell's.
- Modals, drawers, overlays and dropdown panels.
- Auto-refresh or polling that changes the list under the player's eyes.
- Any animation that attracts attention to a row.
- Any write path from the browser (AD-15, AD-21).
- Copy-to-clipboard JSON snippets per row, rejected for v1.

## Accessibility Floor

**This floor is thin because the user decided it should be** (memlog 13). This is
a product for one person, read on one known monitor with a mouse in hand. No WCAG
level is targeted. No screen-reader behaviour is specified. No keyboard path is
provided. No reduced-motion handling is needed, because nothing moves. If the
product ever gets a second user, rewrite this section first.

What does bind:

- **A contrast floor** (memlog 258 N-18, 265). Every piece of text, dimmed text
  included, reaches at least **4.5:1** against `{colors.ground}` and against every
  surface it sits on (`{colors.surface}`, `{colors.surface-raised}`), tooltips
  included. The trust and rarity colours meet it as text. DESIGN.md, Colors, holds
  the measurements. The reason is the angled mid-session glance across a desk at a
  dark page, not conformance.
- **NFR-10, as legibility** (memlog 15). Colour alone never carries a
  product-meaningful distinction. The test: the page still reads with every colour
  removed.
  - **Price trust**: by silhouette. ◐, ○ and ✕ differ, and an empty slot is the
    fourth state. The word is inline on an expansion line and one hover away on a
    row (memlog 247).
  - **Estimated odds**: by ≈, which no other mark resembles.
  - **Crafted versus Raw Base**: by the sell-as-is line that a Raw Base row prints
    in place of chase combinations (memlog 258 N-13). On a Raw Base's expansion,
    by its lone entry.
  - **Rank emphasis, dimmed figures and below-threshold lines**: by weight, the
    minus sign and the words `below threshold`, never by tone alone.
- **Rendered text, not raw ids.** A `statId` renders as its catalogue display text
  without a runtime call (FR-33, AD-25; memlog 86). The denomination is text, and
  AD-24 owns where its label comes from (memlog 229). The marks are inline SVG
  drawings, the same on every machine (memlog 274). Every word and figure beside
  them is text.
- **A Hybrid Modifier label adds no binding** (PRD FR-34). The comma is text. The
  page does not claim to carry the difference between a hybrid and two affixes.

## Responsive & Platform

These platform rules are unusual. This section states them so that nobody adds
what is deliberately absent.

- **Target: a 1080×1920 portrait second monitor**, beside the running game, for
  the length of a session (memlog 258 N-22).
- **The frame is bounded, not fixed**, and centred (DESIGN.md, Layout & Spacing;
  memlog 258 N-22). Below its minimum the page scrolls sideways. There is no phone
  layout, and none is planned.
- **One width-dependent rule** (memlog 273). Best combinations shows three cells
  when the chase column fits a third cell uncut at the measured budget. Otherwise
  it shows two, each wider. DESIGN.md, *The chase column*, owns the widths. The
  switch changes every crafted row at once. A cell that still overflows ends in an
  ellipsis and shows its full text on hover (Interaction 8). The remaining
  combinations stay one click away in the expansion. Nothing else reflows, stacks,
  collapses or hides at any width.
- **The page is as tall as its content** (memlog 243), and the document scrolls.
  The header bar is the only pinned region. The sync report is the only region
  with its own scroll. The appendix and the footer move with the page, so its
  printed order stays true when it grows.
- **What grows the page.** A click: an expansion, its revealed lines, its pruned
  lines, the sync report, the grown list. Data: a long appendix, and state 35's
  two branches. In the FR-30 case (memlog 203), every Item Class is Unrankable
  until a conforming Weights File exists. The appendix then holds every row,
  untruncated, at the foot, and the page scrolls beneath it. Scrolling is the only
  release valve. **Forbidden as overflow escape hatches:** shrinking rows,
  dropping columns, truncating `{components.unrankable-appendix}`, hiding
  `{components.footer-legend}`.
- **Static delivery.** The page paints before it fetches. Its fonts ship as
  DESIGN.md, Typography, says (memlog 242). The page fetches no font from a third
  party.

## Key Flows

The PRD's own journey names. `[OVERRIDE — memlog 21]` These flows keep the PRD's
**"the player"** as the protagonist. The product has one user, and the brief's
singular voice carries the concreteness that a name would add.

### UJ-1 — The pre-session read

→ Steps 3 to 5 are the page in
[`mockups/key-redesign-dark.html`](mockups/key-redesign-dark.html).

1. The player is about to map for two hours and opens the view on the second
   monitor.
2. The header bar and skeleton rows paint in the final layout and resolve in one
   transition `[ASSUMPTION — memlog 51]`.
3. The player's eye crosses the header bar in passing. It sees the league, and the
   recipe and threshold they left last session (both persist, FR-7). It sees the
   sync button reading its age, not a count. The button says that nothing is
   wrong. It is not silent.
4. They read the top five. Blue names are Item Classes they craft on. Grey names
   are Base Types they sell as is, and each of those says so in words where the
   blue rows list combinations. These are two different acts in one ordering. The
   mark slots after the EV figures are empty, so every price they read is current.
5. They note the Best combinations on each crafted row, read as a tier and a short
   form per affix: `T1 Cold Res · T1 Mana`. They do not recall value spreads. The
   tier is the comparison.
6. **Climax:** they close nothing and touch nothing. The page is already at rest in
   the state they need. It stays that way on the second monitor for the whole
   session. They pick up accordingly: the classes to craft on and the bases to
   sell as is, told apart by colour at a glance.

Failure path: a required file cannot be used. It does not match its schema,
declares a version that the page does not read, or was not published. The refusal
screen replaces the page (**state 26**) and names which file and why. Or a data
file does not arrive, and the fetch-failure screen offers `+ Try again`
(**state 28**). Either way the player plays without the tool rather than with a
wrong one, and never with half a ranking.

### UJ-2 — The threshold turn

1. The player is now richer than at league start.
2. They take the slider's thumb and drag it right (memlog 255). The list sweeps
   under their hand. Steady moderate Item Classes drop, jackpot classes rise, and
   Raw Bases move among them on their own prices (FR-6).
3. They release the thumb near `1`, then click the figure and type `1` exactly. On
   the first valid parse, debounced about 150 ms `[ASSUMPTION — memlog 38]`, the
   ranking re-runs synchronously against the loaded artifacts. There is no network
   request.
4. Best combinations change with it. Only Combinations at or above the new
   threshold remain, and some rows now show fewer, or none.
5. **Climax:** they read the new top five again. The page answered one player's
   question a moment ago. Now it answers a richer player's question, and nothing
   else on it moved.

Second turn, the same shape: **richer also means a different recipe.** They click
`perfect` in `{components.recipe-toggle}`, and the list reorders again. This time a
different set of outcomes is reachable (FR-26). The Craft Cost beside the toggle
tells them what the better orbs cost per attempt. That figure makes the two
orderings comparable.

Failure path: they set a value that nothing clears (**state 25**). The page does
not look like a data outage. The list statement names the condition and the live
threshold, states no instruction, and leaves the rows where they are. The remedy
is already under their hand in the header (memlog 204).

### UJ-3 — The drill-down

→ Steps 3 to 5 are the open Bows panel in
[`mockups/key-redesign-dark.html`](mockups/key-redesign-dark.html).

1. The player is unsure why an unfamiliar Item Class ranks second.
2. They click anywhere on its `{components.ranked-row}`.
3. `{components.expansion-panel}` opens in place. Its first line names the class in
   full. Then it says in plain words that some roll odds are estimated and that
   every price below is a real listing. The threshold and recipe that the figures
   depend on are in the sticky header above.
4. They read its top 8 lines. First come the priced Combinations, by what each adds
   to the EV. They are quiet where the price is current, and one reads
   `◐ rough · priced 5 days ago`. Then a dimmed line reads `below threshold`. It
   shows what the ranking deliberately leaves out, as well as what the ranking
   uses. Then lines read `○ pending · tried 2 days ago · no listings` and
   `○ pending · not checked yet`.
5. They click `+ N more combinations` (memlog 264) and read every other Tracked
   Entry on the class, down to one `✕ broken · gone after a patch`. Each problem
   line names its clock, so an old price and a long search are never one
   unlabelled age. `− show fewer` returns the panel to its top lines.
6. They leave this panel open and expand a second row beside it: a Raw Base. They
   read its one line against the crafted ones. That comparison is the reason for
   the mixed list.
7. **Climax:** the second rank stops being a claim and becomes an argument they can
   check. They accept it or not, on evidence they just read.

### UJ-4 — The trust check

→ Steps 2 and 3 come from the specimen box of
[`mockups/key-redesign-dark.html`](mockups/key-redesign-dark.html).

1. The player notices an Item Class that ranks suspiciously high.
2. Its mark slot is not empty. On this page a mark is the whole signal. A ◐ sits
   after the EV, and an ≈ before it.
3. They rest the pointer on the ◐:
   `rough · 74% of this EV rests on unreliable prices`. They rest it on
   `EV (Divine)`. The tooltip decodes the ≈ as *some roll odds are estimated*, a
   statement about odds, not price.
4. They open the row. The lines that carry the figure read
   `◐ rough · priced 5 days ago`, and the context line names the estimated odds.
5. They click `Synced 1m ago ▾` and read the Weights File's `gamePatch` in the
   sync report. The page cannot know which patch is live, but the player does. The
   two facts are one click apart.
6. **Climax:** they discount that Item Class rather than act on it. The page did
   not hide the weakness and did not apologise for it. It refused to look more
   confident than its data deserved.

*One mark that the player will not find, and should not look for.* A Raw Base never
carries ≈, because it rests on no modifier pool (FR-4). Its trust lives entirely in
its own price's verdict. An empty slot there means that the price is current, as
the footer legend says.

### UJ-5 — The curation pass

**Partially supported by design** `[OVERRIDE — memlog 22, 25]`. The view has no
write path and offers no snippet to paste. The page fully supports the *review*.
The *edit* happens in a text editor and git.

1. The player reviews deliberately after a few weeks.
2. They do not have to go looking. For days the sync button shows a red
   `✕ N problems` in place of its age (memlog 254, 265, 270). It is red because a
   counted entry is broken. That is why the player is here.
3. They click it. The sync report opens under the header, on its problem list. It
   shows broken entries (FR-24) and a pinned-starvation record (FR-25). The record
   tells them that the rotation does not serve a pin they set. Beside them, the
   Tracked List edit date reads six weeks back. The coverage fraction with its
   denominator tells them how much of what they track the ranking can speak for.
4. The report counts what broke but does not say which Item Class holds it
   (memlog 235). So they open panels, several at once and side by side, and show
   their full lists with `+ N more combinations`. They find three Combinations that
   read `○ pending · tried N days ago · no listings` all league, and one
   `✕ broken · gone after a patch`.
5. They open `+ N pruned` on a panel and read the existing pruned lines with their
   reasons. FR-8 includes pruned entries, so this review needs no visit to the
   file.
6. The footer tells them where the edit happens:
   `Curation lives in data/tracked.json.`
7. **Climax:** they leave the page knowing exactly which entries to touch and why.
   They open `data/tracked.json`, prune the dead Combinations with a reason, pin
   one they want to watch closely, and commit. The next sync reflects it. The next
   time they open the page, the button reads its age again, and the entries they
   pruned are behind `+ N pruned`.

What stays unsupported: the edit itself. `data/tracked.json` is hand-owned (AD-15,
AD-21). The player does this a handful of times a league.

### UJ-6 — The league reset

1. A new league starts. The player edits the active league in `data/config.json`
   and commits.
2. They open the page. Every tracked unit renders in canonical order (memlog 48),
   every Item Class and every Raw Base. Each carries ○ in its mark slot, and the
   tooltip reads `pending · price from last league`.
3. `[ASSUMPTION — memlog 49]` Rank numerals are suppressed, and the list statement
   says that the order is canonical and not ranked. Every EV cell reads `—` beside
   its ○: not a blank, not a zero. The page states honestly, on every row, that it
   has no figure yet (memlog 257).
4. The footer legend still renders. The page explains itself even with nothing to
   say.
5. Over the following day, rows lose their ○ as the sync rotation reaches them. The
   ranking takes shape row by row, because the refresh is long and partial.
6. **Climax:** the ranking refills in front of the player rather than appearing
   finished. They watch the recovery happen. At no point does the page serve last
   league's numbers as this league's.

## Coverage Self-Check

- **Flow coverage: complete.** All six PRD journeys (UJ-1 to UJ-6) have a Key Flow
  with numbered steps and a climax beat. Failure paths: UJ-1 and UJ-2. The other
  failure paths are known gaps (Foundation). UJ-5's partial support and UJ-6's
  honest-empty landing are stated as such. The protagonist is "the player" by
  override (memlog 21).
- **State coverage: 45 numbered rows, 44 live.** States 1–43 plus 12a and 15a.
  State 19 is retired (memlog 256). States 42 and 43 cover one published recipe
  and none (memlog 275).
- **Component coverage.** Every component in DESIGN.md's token sheet has a row in
  the Component Patterns index under the same name: header-bar, recipe-toggle,
  threshold-control, sync-button, sync-report-panel, list-statement, column-header,
  ev-tooltip, ranked-row, trust-mark, estimate-mark, mark-tooltip, chase-cell,
  expansion-panel, expansion-line, show-more, trade-link, unrankable-appendix,
  footer-legend and failure-screen.
- **Token references.** Every brace reference in this document resolves to a token
  that DESIGN.md declares. Copy placeholders use angle brackets (Copy Deck). A
  retired token name is written without braces.
- **Open items:** Foundation.
