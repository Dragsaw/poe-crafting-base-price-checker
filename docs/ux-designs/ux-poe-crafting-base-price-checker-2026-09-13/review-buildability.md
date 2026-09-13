# Buildability review — DESIGN.md + EXPERIENCE.md

Reviewer lens: **buildability**. Question answered: *could a competent developer build
this product from these two documents alone, with Mantine v9 and nothing else to
consult?*

Reviewed: `DESIGN.md`, `EXPERIENCE.md`, `.memlog.md`, and
`.working/direction-fieldguide-v2.html` (reference render; the spines win on conflict).

Out of scope by decision and therefore **not reported**: accessibility, keyboard,
focus rings, ARIA, contrast targets (memlog 13); dark mode and responsive behaviour
below 1080px (memlog 10/12). Items carrying an explicit `[NOTE FOR UX]` are counted and
triaged in the last section, not ranked as defects.

---

## Verdict

**Mostly, but not without stopping to ask.** The two spines are unusually disciplined
where most UX spines are vague: every one of the 91 distinct `{token}` references
resolves, all 26 declared components have both a visual spec and a behavioural row, the
six-column budget sums exactly, the interaction set is closed and enumerated, and the
epistemic rules (silence means healthy, money slots, the three inks) are stated tightly
enough that a developer would not invent a fourth colour or a green tick. A developer
could build the ranked list — the hardest and most important part of the page — almost
directly from DESIGN.md's `components` block. What stops it being a clean build is
**vertical arithmetic and the surfaces around the list**: line-height is deliberately
left undeclared on every serif role, which is safe against a bare browser and *not*
safe against Mantine (whose `Text` supplies 1.55), so the 28px row and the "fits in
1920px" contract both rest on a value no document states; the declared
`{spacing.frame-slack}` of 250px does not reconcile with the reference render, which
carries roughly twice that; the masthead — the first block on the page — has no
component spec at all; two of the three tabular surfaces (appendix rows, combination
rows) have no column contract while the third's is called a contract; and the one
control on the page is described as a panel without the input ever being drawn. Expect
a competent developer to produce the top two-thirds of this page faithfully and then
send back eight to ten questions before the appendix, the expansion and the threshold
can be finished.

---

## The column arithmetic

Horizontal, as declared:

| Token | Value |
|---|---|
| `col-rank` | 32 |
| `col-base-type` | 222 |
| `col-ev` | 84 |
| `col-provenance` | 76 |
| `col-age` | 94 |
| `col-chase` | 504 |
| **sum** | **1012** |

- `32 + 222 + 84 + 76 + 94 + 504 = 1012` = `content-width` (1012). **Reconciles.**
- `chase-cell` × 3 = `168 × 3 = 504` = `col-chase`. **Reconciles.**
- `frame-width − 2 × frame-padding-x` = `1080 − 68 = 1012` = `content-width`.
  **Reconciles.**

So the declared budget is internally exact. One qualification, which is finding H1:
DESIGN.md also specifies a `{spacing.hairline}` `{colors.edge}` border on the frame, and
the reference render sets `* { box-sizing: border-box }` (as does Mantine's own reset).
Under border-box, `1080 − 2(border) − 68(padding) = 1010`, and 1012px of
`flex: 0 0 auto` columns do not fit in a 1010px box. In the mock this is invisible only
because `.frame` carries `overflow: hidden` — the third chase cell is silently clipped
by 2px. The arithmetic works on paper and is 2px short in the box the documents describe.

Vertical, reconstructed from the reference render's own values (serif roles at browser
default line-height ≈ 1.2, since none is declared — see finding B1):

| Block | px |
|---|---|
| frame borders (top + bottom) | 2 |
| masthead (34 pad + eyebrow + 38px title + 2-line dek + 20 pad) | ~168 |
| trust strip (2 rules + 11/12 pad + 2 lines @ 11.5 × 1.85) | ~68 |
| asking-price line | ~29 |
| column header (16 margin + label + 6 pad + rule) | ~35 |
| 20 ranked rows @ 28 | **560** |
| list expand affordance | ~29 |
| Unrankable appendix (title + 2-line lead + 7 rows @ 29 + padding) | ~305 |
| key block (rule + 3 lines @ 10.5 × 1.85) | ~108 |
| running foot | ~62 |
| **total committed** | **~1366** |
| **slack absorbed by `margin-top: auto`** | **~554** |

**This does not reconcile with `frame-slack: 250px`** (and therefore not with
`sync-report-max-height: 250px`, which DESIGN.md derives from it as "the slack,
measured"). The estimate carries roughly ±40px of uncertainty from unstated
line-heights, which is nowhere near the ~300px gap. See finding B2.

**The 28px row is achievable.** Tallest in-row type is 14px serif; at browser default
(~1.2) that is a ~17px line box, plus a 1px bottom hairline under border-box, inside a
28px flex row with `align-items: center`. It has ~10px of headroom. It is **not**
achievable under Mantine's default `Text` line-height of 1.55 (14 × 1.55 ≈ 22px, plus
the 10.5px chase text's own line box and the mark's 10px line box) — the row would
survive but every vertical estimate above shifts, and the 38px masthead title and the
18/20px panel titles would each gain 10–15px. That is finding B1, and it is the single
most consequential unstated value in the pair.

**Three chase cells of 168px fit horizontally**, but tightly: 168 − 10px right padding =
158px of usable width at 10.5px sans ≈ 28–29 characters. The reference render's own
longest strings already exceed that ("+240 Energy Shield · +30% Lightning Res" is 38
characters, ~200px) and are ellipsised on the page. That is legal — DESIGN.md says
"ellipsis on overflow" and EXPERIENCE.md bans tooltips and resolves truncation one click
down — but no document gives the canonical short-form table a character budget, which is
finding M2.

---

## Unresolved token and component references

| Reference | Where | Status |
|---|---|---|
| *(none)* | — | **All 91 distinct `{group.path}` references in both documents resolve against DESIGN.md's frontmatter.** |

| Component | Visual spec (DESIGN) | Behavioural spec (EXPERIENCE) |
|---|---|---|
| all 26 declared `components.*` | present | present, under the same name |

Two complements of that check do fail, and are carried as findings rather than as
unresolved references:

| Item | Problem |
|---|---|
| **Masthead** | Named in EXPERIENCE.md's IA table and drawn in the mock; **has no entry in DESIGN.md `components`**. Only three loose type tokens exist. Finding B5. |
| **Skeleton rows** | Named in both documents' behaviour; no component, no token. Known gap (`[NOTE FOR UX]`). |
| **Refusal screen / cross-file validation report** | Named in EXPERIENCE.md states 27 and 28; no component, no token. Known gap. |
| 11 orphan typography tokens | `eyebrow`, `masthead-title`, `dek`, `threshold-value-unit`, `threshold-range`, `row-rank`, `row-ev`, `row-ev-unit`, `row-mark`, `appendix-lead`, `appendix-row` are **defined but bound to no component spec and referenced in no prose**. Finding H7. |
| 4 orphan spacing tokens | `spacing.2`, `.3`, `.4`, `.5` are declared and never used by anything. Finding L4. |

---

## Findings

### Blockers — a developer cannot proceed without an answer

**B1 — Line-height is undeclared on every serif role, and Mantine will not give the
browser default.**

> "The mock sets no `lineHeight` on the serif display roles (`masthead-title`,
> `appendix-title`, `panel-title`, `row-base-type`, `detail-row`) — they rendered at
> browser default. The tokens above therefore omit it rather than invent a value."
> — DESIGN.md, Typography

Omitting a value only inherits the *browser* default in a bare document. Inside Mantine,
`Text` resolves `line-height` from `theme.lineHeights.md` (1.55) and `Title` from the
headings ramp — so "omitted" resolves to 1.55, not ~1.2. Every vertical number in both
documents (the 28px row's headroom, the 1920px fit, `frame-slack`, the masthead block,
the 29px appendix row) is computed against a value the documents refuse to state and the
substrate overrides. It is also OS-dependent: the serif stack resolves to *Iowan Old
Style* on macOS and *Palatino Linotype* on Windows (the stated dev platform), which have
different metrics.
**Fix:** measure the five serif roles off the reference render on the target OS and state
`lineHeight` explicitly on each, plus on `trust-strip`, `dek` and `key-body`. Add a
Mantine delta row: `theme.lineHeights` and `theme.headings` are replaced, not inherited.

**B2 — `frame-slack: 250px` does not reconcile with the render it claims to be measured
from, and nothing is budgeted for the uniform-prior banner.**

> "the vertical slack the appendix's `margin-top:auto` absorbs in the reference render,
> and therefore the ceiling on the expanded sync report" — DESIGN.md, `spacing`

Reconstructing the render's own block heights gives ~554px of slack, not 250px (see the
arithmetic above). Whichever number is right, two consumers depend on it:
`sync-report-max-height` is derived from it, and EXPERIENCE.md's overflow rule asserts
that "`{components.sync-report-panel}` alone never makes the frame scroll" — a claim that
is only true if the panel's cap is genuinely ≤ the slack. Separately, the
`{components.uniform-prior-banner}` is raised **by a data condition, not by a click**, so
under "nothing the player has not clicked may push the page past 1920px" its ~57px is a
hard charge against the resting budget — and it appears in no budget anywhere.
**Fix:** re-measure the slack in the built page, restate `frame-slack` and
`sync-report-max-height` as two independent numbers (the cap need not equal the slack),
and add the banner's height to the resting-state budget explicitly.

**B3 — "The frame scrolls" contradicts `frame-height: 1920px` as a constant. What
actually scrolls is undefined.**

> "When an expansion, or an expansion plus the sync report, exceeds what the slack can
> absorb, **the frame scrolls vertically**." — DESIGN.md, Layout & Spacing

Two readings a developer will split on. (a) The frame element keeps `height: 1920px` and
gains internal `overflow-y: auto`, so the appendix, key block and foot stay pinned and the
list scrolls beneath them. (b) The frame's height becomes a *minimum*, the element grows
past 1920px, and the browser window scrolls, carrying the appendix and foot off the
bottom. These produce visibly different products, and the rule "collapsing everything
restores the exact fit" is satisfiable by both. The reference render sets
`height: 1920px; overflow: hidden`, which is a third behaviour (silent clipping) and
cannot be what is meant.
**Fix:** state it as `min-height: {spacing.frame-height}` with the document scrolling, or
as a fixed-height frame with an internal scroll region, and name which regions travel.

**B4 — Two of the three tabular surfaces have no column contract.**

> "**The column budget is a contract** (memlog 40)." — DESIGN.md

That contract covers the ranked row only. `{components.unrankable-appendix}` specifies
`rowHeight` and a list of what each row carries, with no widths; the mock uses 292 / 118 /
250 / flex. `{components.combination-row}` specifies height, typography and a bottom rule,
and names six pieces of content, with no widths; the mock uses 286 / 210 / 98 / 102 / 124
/ flex. Both surfaces are scanned down a column exactly like the ranked list, and DESIGN's
own argument against flexing ("a column that changes width row to row cannot be scanned
down") applies to them verbatim.
**Fix:** promote both to declared width sets in `spacing`, in the same shape as the six
ranked columns.

**B5 — The masthead has no component spec.**

EXPERIENCE.md's IA table opens with "Masthead + `{components.payout-threshold}`" and four
states depend on it painting. DESIGN.md's Components section never mentions it. A
developer has `eyebrow`, `masthead-title` and `dek` as orphan type tokens and nothing
else: no block padding, no gaps between the three lines, no dek measure (the mock caps it
at 640px), no statement of how the threshold panel is positioned relative to it (the mock
floats it right inside the masthead, uncleared), and no copy contract for what the eyebrow
and title actually say — the mock's "League Forbidden Rites · perfect transmute + perfect
augment" / "What is worth picking up" is the only source, and the mock is not the contract.
**Fix:** add a `masthead` component entry with padding, internal spacing, dek max-width,
the threshold panel's placement, and the copy pattern for eyebrow/title/dek.

**B6 — The one control on the page is specified as a panel; the input is never drawn.**

> "a `{spacing.threshold-panel-width}` inset panel: tracked label, the value at
> `{typography.threshold-value.fontSize}` with a small serif `div` suffix, a 4px
> sepia-filled track…" — DESIGN.md, Payout Threshold control
>
> "| `{components.payout-threshold}` input | Border to `{colors.edge}` | — | While
> editing, border to `{colors.rule-strong}` |" — EXPERIENCE.md, hover table

Reading (a): the 32px serif figure *is* the number input, styled bare, and "border to
edge" means the surrounding panel's 1px border changes colour on hover. Reading (b): there
is an inner bordered input box that no render contains and no token sizes, and the 32px
figure is a readout beside it. DESIGN's `payout-threshold` spec has a `border` key for the
panel and no input key at all, which makes (a) likelier — but (a) means a 32px serif
`NumberInput` with no visible field, which is an unusual thing to ship without it being
said out loud. Compounded by the `[NOTE FOR UX]` that the track and marker may not survive
at all.
**Fix:** state whether the value is the input; give the input its own spec (height,
padding, border in both states, caret and selection colours, whether the `div` suffix is
inside or outside the field).

**B7 — State 24 tells the developer to leave the EV column blank; the money-slot rule
forbids blank.**

> "the EV column **empty rather than zero**" — EXPERIENCE.md, state 24 / DESIGN.md,
> memlog 49 assumption
>
> "Never `0`, never `0.00%`, never blank, never an em dash." — EXPERIENCE.md, Money slots

`{components.money-slot}` exists precisely for "any cell where a figure is missing", and
in the honest-empty state every EV is missing. A developer following the money-slot rule
renders 44 rows of *no figure yet*; a developer following state 24 renders 44 empty cells.
**Fix:** either exempt the honest-empty state explicitly (and say why a blank column is
honest there when it is dishonest everywhere else), or replace "empty" with the
`not-yet-synced` phrase *no figure yet*.

**B8 — "Read the remaining N Base Types" has no result state.**

> "| `{components.expand-affordance}` (list) | Below row 20 | Reads the remainder of the
> ranked list (FR-5) |" — EXPERIENCE.md, IA

This is one of the five enumerated interactions and the only one whose outcome is never
described. Unanswered: does the list grow in place to 44 rows (adding ~672px, which forces
the frame to scroll — permitted, since it was clicked), or replace rows 1–20, or page? Is
it reversible, and what does the affordance read when open (the trust strip gets an
explicit `+` / `—` pair; this one gets only `+`)? Do the three emphasis tiers extend past
rank 20 or do ranks 21+ all take tier 3? Does the expanded list still sit above the
appendix? No entry exists for it in the 32-state enumeration.
**Fix:** add a state row and the open/closed copy, and say whether tier 3 covers
everything below rank 10.

### High

**H1 — `content-width` is 1012; the frame's content box is 1010 under border-box.**
Covered in the arithmetic section. The reference render hides it with
`overflow: hidden`, so the clipping is silent. **Fix:** state the frame's box model
explicitly — either draw the 1px edge as an outline/inset shadow substitute that does not
consume width, set the frame to 1082px, or reduce a column by 2px.

**H2 — The Raw Base hover colour does not exist in the token set.**

> "| `{components.raw-base-row}` | Same rule, one step up from `{colors.paper-raw}` |"
> — EXPERIENCE.md, hover table

The same paragraph claims "no new token is needed". But `paper-raw` (#F7F3E6) sits
*between* `paper` and `paper-inset` in tone; "one step up" could mean `paper-inset`
(#F5F1E4, the same value the plain row hovers to, which would erase the Raw Base tint on
hover), `paper-deep`, or an undeclared intermediate. **Fix:** name the hex, or name the
token.

**H3 — `paper-deep` is declared to be used exactly once, and then used a second time.**

> "`{colors.paper-deep}` `#F0EADA` goes one step further back and is used once, for the
> tombstone band." — DESIGN.md, Colors
>
> "| `{components.ranked-row}` | … | Active (pointer down) | Background to
> `{colors.paper-deep}` |" — EXPERIENCE.md, hover table

A direct contradiction between the two spines. **Fix:** either relax the "used once"
sentence, or give the active state its own value.

**H4 — Hover and "panel is open" are the same colour, so the open row is not
identifiable while the mouse is on the list.**

> "While its panel is open the row holds `{colors.paper-inset}`, so the source of an open
> panel is always identifiable" — EXPERIENCE.md, hover table

Hover is also `paper-inset`. The moment the player hovers any other row, two rows read as
inset and the claim fails; hovering the open row itself produces no feedback at all.
**Fix:** give the open row a different cue — the mock's vocabulary already has a
`{colors.sepia}` left rule and a `{colors.rule-strong}` rule available, neither of which
would violate the no-lift rule.

**H5 — State 30 asks the page to detect a mismatch against data it never receives.**

> "| 30 | Stale Weights File after a patch | … | Visible as a `gamePatch` that no longer
> matches the live patch |" — EXPERIENCE.md

The page is static, fetches eight published artifacts, and makes no network call to the
game or the trade API. It has no live patch to compare against. Reading (a): the page
merely prints `gamePatch` and the *player* notices — in which case the state needs no
treatment and should say so. Reading (b): the page marks the mismatch, which needs a
source for the live patch that no architecture provides. **Fix:** state (a) explicitly, or
name where the live patch comes from.

**H6 — The `NumberInput` delta misdescribes the Mantine default, and the input has no
constraints.**

> "| `NumberInput` committing on blur | Commits on every valid parse, debounced ~150ms |"
> — EXPERIENCE.md, Foundation

Mantine's `NumberInput` is controlled and already calls `onChange` on every keystroke; it
does not commit on blur. What *does* happen on blur is clamping to `min`/`max`, and
`onChange` hands back `string | number` including partial values (`""`, `"0."`, `"-"`) —
which is exactly what "on every valid parse" has to filter, and the documents never say
what "valid" means here. With `min` unstated (an acknowledged `[NOTE FOR UX]`), a negative
Payout Threshold is enterable and would re-rank against a threshold nothing can fail.
**Fix:** restate the delta as "debounce the existing per-keystroke `onChange` and ignore
non-numeric intermediate values", and give `min`, `max`, `step`, `decimalScale` and
`clampBehavior` values — the `[NOTE FOR UX]` on range/step/max is what blocks this.

**H7 — Eleven typography tokens are defined and bound to nothing; the trust marks have no
font size.**

`row-mark` (10px/600) is declared and never referenced by any of the six `trust-mark-*`
component specs, which carry only colour, glyph, word and weight. The reference render
puts marks at 10px in the ranked row, 11px in the appendix and 10.5px in the key block —
three sizes for one vocabulary that DESIGN insists is one vocabulary. Same class of gap
for `row-rank`, `row-ev`, `row-ev-unit`, the two threshold sub-roles, the two appendix
roles and the three masthead roles. **Fix:** bind each orphan token into the component
that uses it, and say whether a trust mark changes size by context.

### Medium

**M1 — Per-column padding is given as a range, not per column.**

> "no cell padding beyond the 8–12px that keeps a column off its neighbour" — DESIGN.md

The mock uses 10px (rank), 8px (base type), 12px (EV), 10px (chase cell) — four different
values inside the stated range. Because every one of these columns ellipsises, padding is
load-bearing for how much text survives. **Fix:** tokenise the four values.

**M2 — The canonical short-form table has no length budget.** 158px of usable chase-cell
width ≈ 28–29 characters at 10.5px sans; the reference render already overruns it. The
"Don't abbreviate ad hoc per row" rule means the budget has to live in the table, and the
table's author needs the number. **Fix:** state the character budget, and state what
happens when a canonical short form still overflows (ellipsis, presumably — say so).

**M3 — The `RAW BASE · ILVL 82` tag lives inside the ellipsised 222px Base Type cell.**
On a long Base Type name ("Advanced Dualstring Bow" plus the tag exceeds 222px at the
declared sizes) the tag is truncated away, leaving tint plus italic — two of the three
cues DESIGN says are deliberately redundant. **Fix:** make the tag a sibling of the
ellipsising name, or relocate it to the empty Weight column.

**M4 — The sync report's three columns have no content assignment.**

> "columns: '3 equal, matching {components.key-block}'" with six named figure groups.

Which group goes in which column, and in what order, is unstated; two developers produce
two different panels. `rowHeight: {spacing.detail-row-height}` is also declared on a panel
whose content is prose-with-figures, not rows. **Fix:** assign the six groups to the three
columns explicitly.

**M5 — The expansion panel's geometry is unstated.** It is "a bordered `{colors.paper}`
card" opening "in place, below the row". Unstated: does it span the full 1012px or inset
to align with a column; is there vertical margin above and below; does the border sit
flush against the row's hairline; does the ranked row's own bottom hairline survive. The
mock only shows it as a detached specimen in a 1080px container. **Fix:** state width,
margins and the join to the row above.

**M6 — Whether clicking an open row closes it is stated for the trust strip only.**
"Clicking again closes it" appears under interaction 5. Interaction 2 says only that the
panel opens. Combined with the acknowledged `[NOTE FOR UX]` on multiple panels, a
developer has to guess both the toggle and the multiplicity. **Fix:** one sentence.

**M7 — Three of the seven Mantine deltas are stated against things that are not Mantine
defaults, and four real ones are missing.** `Table`/`ScrollArea` virtualisation is not a
Mantine core feature; Mantine `Alert` does not auto-dismiss, and the auto-dismissing
notification manager lives in `@mantine/notifications`, which is not in the declared
dependency set; Mantine adds no tooltip to truncated text. (`Collapse` transition and
`Skeleton` shimmer are both real and correctly called out.) Missing deltas that *will*
fight this design: `theme.primaryColor` defaults to blue and colours every input focus
ring and caret on a page whose palette has no blue; `theme.headings` supplies its own
size/weight/line-height ramp that the 38px/20px/18px serif titles must override;
`Accordion`/`Collapse` ship chevrons, control padding and their own hover background, all
of which must be stripped to reach "no button chrome"; and Mantine converts theme font
sizes to `rem` and applies `--mantine-scale`, which will round the fractional 9.5 / 10.5 /
11.5 / 12.5 / 13.5px sizes unless they are passed as literal px. **Fix:** correct the
three, add the four.

**M8 — "Truncated out of the list entirely" is ambiguous about the remainder.**

> "A Raw Base priced below the Payout Threshold is truncated out of the list entirely and
> is never ranked at its price." — EXPERIENCE.md, `raw-base-row`

Reading (a): it is removed from the top-20 view but still present in the "remaining N Base
Types" expansion. Reading (b): it is removed from the ranking altogether, in which case it
should arguably appear in the Unrankable appendix, and the count in the expand affordance
changes. **Fix:** say which, and say whether the suppressed Raw Base is counted anywhere.

### Low

**L1 — The column header's layout mechanism is unstated**, and the mock's implementation
is wrong: it lays the six header labels out as `inline-block` spans separated by source
whitespace, which drifts each label right of its column by the width of a space (~20px
cumulative by the chase header) relative to the flex rows below. DESIGN's
`paddingBottom: {spacing.1}` (4px) also differs from the mock's 6px — legitimate, since
the spine wins and general spacing is quantised at 4px, but worth confirming it was
intended. **Fix:** say the header uses the same six fixed-width flex cells as the row.

**L2 — Last-row rule removal is unstated.** The mock removes the bottom hairline on the
final appendix row and the final tombstone row; DESIGN says only that these rows carry a
bottom rule. **Fix:** one line per list.

**L3 — `✕` in rust is specified twice at two weights** — 700 as
`trust-mark-unresolvable`, 600 as `price-state-glyph.unresolvable`. Probably intentional
(mark versus glyph, ranked row versus expansion), but a developer will read it as a
contradiction. **Fix:** say the two are distinct roles.

**L4 — `spacing.2`, `.3`, `.4`, `.5` are declared and used by nothing.** Harmless; noted
only because every other token in the file is load-bearing, which makes four dead ones
read as an omission somewhere else.

---

## Known gaps (`[NOTE FOR UX]`) — build-blocking versus decide-at-implementation

Thirteen distinct open items carry an explicit tag across the two documents (20 tag
occurrences, several cross-referencing the same item; EXPERIENCE's self-check counts 7 of
them as *state* gaps, which matches states 9, 22, 23, 26, 27, 28, 29). One tagged item —
DESIGN's "hover, focus and active appearance" — is in fact **closed**, by EXPERIENCE's
hover table; the tag should be retired, and findings H2/H3/H4 are against that closure,
not against the gap.

**Build-blocking — the developer cannot ship a correct page without a decision:**

| # | Gap | Why it blocks |
|---|---|---|
| 1 | **Serif line-heights** (DESIGN, Typography) | Not a cosmetic gap. The 28px row, the 1920px fit and `frame-slack` are all computed against it, and Mantine supplies 1.55 where the document assumes ~1.2. This is finding B1 and it is the highest-value item in the whole list. |
| 2 | **Threshold range, step, maximum** (EXPERIENCE, interaction 1) | The one control on the page has no constraints. Without `min` a negative threshold is enterable and the ranking is undefined. |
| 3 | **Whether the threshold readout track survives** (DESIGN, `payout-threshold`) | Blocks B6 with it: the panel cannot be laid out until it is known whether the track and its 11×14px marker are in it, and they occupy ~21px of a 276px panel's height. |
| 4 | **Refusal screen for a schema-invalid artifact** (state 27) | FR-33/NFR-8 make this reachable on any malformed published artifact, i.e. on a routine bad sync. It is the page's failure mode and it has no spec of any kind. A developer must ship *something*. |
| 5 | **Artifact fetch failure** (state 29) | The likeliest runtime failure on a static page fetching eight files, and the documents explicitly decline to invent a state. Same argument as 4: something ships regardless, so it should be decided rather than improvised. |
| 6 | **FR-4's 50–80% coverage band** (DESIGN Layout, EXPERIENCE IA) | Both spines describe the ≥80% footer treatment only, and coverage is re-measured on every weights regeneration — so the band *will* be crossed in normal operation. Also unsettled whether the switch is runtime or build-time, which is an architecture question, not a styling one. |

**Decide at implementation — a sensible default exists and the cost of being wrong is
low:**

| # | Gap | Reasonable default |
|---|---|---|
| 7 | **Skeleton fill tone and shape** (state 23) | A flat `{colors.paper-inset}` bar per cell at the declared column widths, no shimmer. The vocabulary already forbids animation that attracts attention; the only real decision (single transition, final layout) is already made by memlog 50/51. |
| 8 | **Multiple panels open at once / survive reload** (interaction 2) | Multiple open, none persisted — matches the sync report's stated "closed on every load" and needs no new mechanism. Worth a note only because it interacts with the frame-scroll budget. |
| 9 | **The `pinned` mark** (state 9) | Appears only inside an expansion, on a row that already has five text fields. A plain sans word `pinned` in `{colors.ink-tertiary}` costs nothing and breaks no rule (it takes no semantic ink, as required). |
| 10 | **Negative EV formatting** (state 22) | `−0.34 div` in the existing `row-ev` token, tabular, no colour. The three-ink rule already forbids marking it red. |
| 11 | **"Nothing clears the threshold" copy** (state 26, UJ-2 failure) | A single sentence in the money-slot register — the voice table already fixes the register precisely enough to write it ("Nothing in the Tracked List clears 3.00 div. This is your threshold, not a data outage."). Copy, not structure. |
| 12 | **Short-form fallback treatment** (DESIGN Components, EXPERIENCE vocabulary) | Constrained to a non-colour cue by the three-ink rule; the page's existing non-colour vocabulary (italic, a tracked-uppercase tag, a dotted rule) supplies an answer. Low risk because the fallback is meant to be rare and temporary by design. |
| 13 | **Cross-file policy report placement** (state 28) | The page still renders, so this is additive. The sync report panel is the obvious home — it already carries every other operational figure — and putting it there needs no new surface. |

Item 4 and item 5 are the two worth escalating first: they are the only gaps where the
product has *no* behaviour at all for a failure a normal week will produce.
