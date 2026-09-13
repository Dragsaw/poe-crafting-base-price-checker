---
title: 'Reviewer Gate — reconciliation review of ARCHITECTURE-SPINE.md revision 9'
lens: reconcile
input: docs/sprint-change-proposal-2026-09-13.md (approved, 2026-09-13)
target: docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md (revision 9)
reviewed: 2026-09-13
verdict: PASS with findings
---

# Reconciliation review — sprint change proposal 2026-09-13 → spine revision 9

## Verdict

**PASS.** All eight architecture edits (A1–A8) landed, each in the AD the proposal
named, and each carrying the approved wording **verbatim** — no clause dropped, no
clause softened, no clause paraphrased. The revision banner discharges every element
the §5.2 routing row required. Every architecture-side success criterion in §5.4 is
met. The routing row's optional item (the "Core entities" note under the ER diagram)
was also done, correctly, and covers both new fields rather than only `acceptedTier`.

Five findings follow. None is a failure of absorption. Two are defects the absorption
carried in from the approved wording or left behind in unamended text, and both are
worth raising back rather than living on as build-time surprises.

---

## 1. Edit-by-edit reconciliation

### A1 — AD-5: the tracked entry shape gains a declared label *(item 4)*

| Fragment | Proposal | Spine rev 9 | Verdict |
| --- | --- | --- | --- |
| `valueMax` paragraph, tracked-entry sentence | NEW, 3 sentences appended after "…or is **absent**." | line 135 | **verbatim** |
| `itemLevelMin` paragraph, retitled | NEW: "**`itemLevelMin` and `acceptedTier` are declared, never inferred.**" | line 139 | **verbatim** |
| "Why the tier has to be written down rather than recovered." | NEW paragraph | line 141 | **verbatim** |
| "The label is display-only, and three prohibitions follow." | NEW paragraph | line 143 | **verbatim** |

Nothing softened. The three prohibitions all survive with their force intact:
`core`/`sync` never read the label; no component validates it against a band; it is
**never part of a tracked entry's canonical key**. The "missing label is a curation
gap, never a load error" clause survives too, which is the clause a `contracts` author
is most likely to invert.

**Placement.** The proposal's OLD fragment for the first edit quoted the `valueMax`
paragraph's "final sentences", ending at "…or is **absent**." In rev 8 that sentence is
not in fact final: it is followed by "An entry with both affixes absent is a raw base,
and a raw base is how the data represents white ilvl-82 bases." The spine inserted the
three new sentences **between** those two, rather than after the raw-base sentence.
That is the correct reading — the insertion is about a *present* reference, the raw-base
sentence is about an *absent* one — and the paragraph reads in order. **No change of
meaning.**

Cross-citation check: A1 cites AD-29 for the `tierLabel`-on-a-cell argument, and
`WEIGHTS-FILE-SCHEMA.md` §`tierLabel` (line 363) independently confirms the claim
("For display only… after decomposition a cell may name a mixture of tiers. The value
`"T7–T8"` is acceptable"). The two documents agree with no contract reissue, which is
what let the schema stay at 4.1.0.

### A2 — AD-9: the dataset entry gains the search identifier *(item 5)*

Three new paragraphs, lines 195–199, **verbatim** against the proposal:
the schema-declaration paragraph, the "placement is forced" paragraph, and the
`core`-never-reads paragraph.

**Placement deviation — deliberate, and correct.** The proposal specified "after the
`lastAttemptedAt` paragraph (line 184)". Rev 8's AD-9 carries *two* consecutive
`lastAttemptedAt` paragraphs: the stamping rule (rev 8 line 184 / rev 9 line 191) and
the never-synced-entry paragraph that qualifies it (rev 9 line 193). The spine inserted
after the **second**. Inserting after the first would have split a rule from the
qualification that makes it readable, and would have left the never-synced paragraph
citing a stamping rule three paragraphs above it. The content is intact and the order of
argument is improved. **No change of meaning.**

### A3 — AD-16: the syncer records what it issued *(item 5)*

New paragraph at line 295, **verbatim**. Placed exactly where the proposal said —
immediately after the `PriceObservation` median sentence. See finding F4 below on a
flow cost this placement carries; the content is unaffected.

### A4 — AD-15: a player's own navigation is not a write path *(item 6)*

Two changes, both landed:

- The Rule's deletion: "…browser storage, **which holds the threshold dial and view
  preferences**." → "…browser storage." (line 265). The strike is complete.
- The new "outbound link" paragraph (line 267), **verbatim**, including the
  "who acts" distinction and the reverse-direction consequence (`web` cannot mint a
  search, which is why the identifier is persisted).

This deletion also discharges, as a side effect, half of deferred item 7 (§6): the
spine no longer contains the phrase "view preferences" anywhere. A full-text sweep for
`preference` returns nothing outside this now-removed text. The remaining half of item 7
is a PRD-side vagueness in FR-7 and is correctly out of scope here.

### A5 — AD-24: no icon, and the render rule for the link *(items 2 and 6)*

Both halves landed **verbatim**:

- The icon replacement is spliced into the AD-24 Rule paragraph (line 461) in place of
  the old "and a currency as its icon" sentence, followed by the four new sentences.
- The link render rule stands as its own paragraph (line 463).

**Placement deviation — deliberate, and correct.** The proposal's NEW block for A5 runs
two paragraphs together under one "Rule (line 444)" heading. AD-24's Rule is a single
long paragraph that continues past the catalogue sentence into bundling, `schemaVersion`,
the 100 ms budget and the colour rule. Splicing the link rule inline would have buried a
render rule inside a delivery-budget paragraph. Lifting it to its own paragraph
immediately after preserves the flow of both. **No change of meaning.**

The render rule's two halves are both present and both load-bearing as approved:
`lastSearchId` present **and** `lastSearchLeague` equal to the active league, with the
never-attempted and offline-unresolvable cases named, and the `pruned` exclusion named.
Nothing is keyed on price state.

### A6 — AD-25: the catalogue table's consumption column *(item 2)*

`static.json` row, line 475, **verbatim** against the proposal, including the bolded
"The icons this artifact carries are not consumed in v1 (AD-24)". The `Carries` column
is unchanged at "currency ids + icons", as the proposal intended — the file still
carries icons; v1 simply does not read them. See finding F1: the approved replacement
text for the `Consumed for` column contains an error of fact that is now in the spine.

### A7 — AD-10: per-row age under a freshness cut-off *(item 1)*

Appended to the AD-10 Rule's final sentence, line 214, **verbatim**. All four clauses
survive: the obligation is per row not per surface; a stale row is marked on every
surface; every exact age on both clocks is reachable in an expansion; a fresh row may
show none. Critically, the protective final clause — that what the rule still forbids is
a **single dataset-level timestamp standing in for per-row freshness** — is present and
unsoftened. That is the clause the proposal's P2 rationale identified as the guard
against a builder reading the cut-off as licence to fall back to a dataset stamp.

### A8 — Consistency Conventions: two exclusions *(items 4 and 5)*

Both rows landed **verbatim**:

- **Entity keys** (line 643): the `acceptedTier` exclusion with the "exactly three
  elements, not a fourth" spelling, the `lastSearchId`/`lastSearchLeague` exclusion, and
  the orphaned-history consequence.
- **Ids** (line 641): the `lastSearchId` appendix, correctly framed as a *second*
  non-counter-example beside `sourceModifierId`, with all five prohibitions (opaque,
  verbatim, never parsed, never catalogue-validated, never an entity identity).

---

## 2. The revision banner against §5.2's routing row

The routing row required four things of the banner. All four are present in the
revision-9 note (line 26):

| Required | Present | Where |
| --- | --- | --- |
| Name the seven amended ADs | **Yes** | "Revision 9 amends AD-5, AD-9, AD-10, AD-15, AD-16, AD-24 and AD-25 in place, along with the Consistency Conventions" |
| State no decision is added | **Yes** | "adds no AD — 29 remains the total", and earlier "Revision 9 … adds no ninth fetched artifact" |
| State none is renumbered | **Yes** | "AD ids are stable." |
| State `WEIGHTS-FILE-SCHEMA.md` stays at 4.1.0 | **Yes** | "**`WEIGHTS-FILE-SCHEMA.md` stays at `4.1.0`**, and no producer work is invalidated." |

The banner also carries the *reasons*, not merely the list — the 53-of-63 derivation
argument, the forced placement of the identifier, the who-acts distinction, and the
per-row-not-per-surface narrowing — which is the house style of revisions 2 through 8
and keeps the note usable to a reader who never opens the proposal.

Two extras worth recording as correct rather than as drift:

- The banner adds "Revision 9 adds no checkable rule to `core`", which is true and is a
  useful statement the proposal did not ask for: neither field enters a `core` code path.
- The `sources:` frontmatter gained `docs/sprint-change-proposal-2026-09-13.md`, and
  `updated:` moved to `2026-09-13`. Both correct.

**The routing row's conditional item was done.** The row asked the architect to "update
the 'Core entities' note under the ER diagram if `acceptedTier` warrants a mention
there". Line 755 now carries both: `ModifierRef` "carrying a declared, display-only
`acceptedTier` label that no component reads but `web` (AD-5)", and a new sentence
placing `lastSearchId`/`lastSearchLeague` on the dataset entry and never on the
observation (AD-9). Covering the second field as well was not asked for and is right —
the ER diagram is exactly where a reader would otherwise hang the identifier off
`PriceObservation`, which is the trap P6a and A2 exist to close.

---

## 3. §5.4 success criteria — architecture side

| Criterion | Status | Evidence |
| --- | --- | --- |
| `ARCHITECTURE-SPINE.md` at rev 9, with a banner naming what moved | **Met** | frontmatter `revision: 9`; banner line 26 |
| No AD added or renumbered | **Met** | AD-1…AD-29 contiguous, AD-29 still last, no AD-30; every rev-8 AD heading text unchanged except within the seven amended bodies |
| `WEIGHTS-FILE-SCHEMA.md` untouched at 4.1.0 | **Met** | schema frontmatter `schemaVersion: '4.1.0'`; no rev-9 entry in its changelog; no diff implied by any of A1–A8 |
| The eight-artifact fetch set of AD-24 unchanged | **Met** | AD-24 line 461 still enumerates exactly the same eight and still says "The eight artifacts are the complete set, and a ninth requires an amendment to this AD" |
| `web` fetches no ninth artifact | **Met** | both new fields ride inside `dataset.json`, already fetched; `acceptedTier` rides inside `tracked.json`, already fetched; banner states this explicitly |

Corroborating checks that the criteria do not name but that a ninth artifact would have
broken, all still consistent:

- AD-6 (line 158) still asserts "AD-24 deliberately keeps `catalogue/items.json` out of
  `web`'s fetch set" — still true.
- AD-26 (line 512) still rests its `web`-cannot-evaluate argument on
  `data/currencies.json` being absent from "AD-24's eight-artifact fetch set" — still
  true, and still says "eight".
- AD-3 still routes sync→web state through exactly `dataset.json` and
  `sync-report.json`. `lastSearchId` and `lastSearchLeague` are new *fields* on an
  existing artifact, not a third channel, so AD-3 needed no amendment and correctly
  received none.
- AD-21's writer table is unchanged and still correct: `sync` writes `dataset.json`, the
  player writes `tracked.json`. The two new sync-written fields and the one
  hand-authored field each land on a file whose declared writer already owns them.

---

## 4. Quiet requirements in the proposal's rationale

I walked each rationale block for obligations the AD text might have dropped. The
architecture side carries them all:

- **"Neither field enters a ranking term, so AD-4 and AD-17 are untouched"** (§2.3).
  Carried: A2's third paragraph states "`core` never reads either field, and neither
  enters a ranking term (AD-4)"; A1 states `core` and `sync` never read the label.
  AD-4 and AD-17 are correctly left unamended.
- **"Both fields are additive and optional on read"** (§2.3). Partly carried — see
  finding F5. The *effect* is carried for `acceptedTier` ("a missing label is a curation
  gap … never a load error"), and for the search fields by AD-9's long-standing
  declared-vs-present distinction, which A2 deliberately reuses ("only an attempt that
  issues a request stamps any of them"). No AD says the word "optional", and none needs
  to.
- **"Stated explicitly, in three places, that the field is display-only and excluded
  from the canonical key"** (§3, the risk mitigation). All three places exist on the
  architecture side: AD-5 (line 143), the Consistency Conventions Entity-keys row
  (line 643), and the ER-diagram note (line 755). The PRD carries its own three.
- **§5.0's two approval-record calls** — key exclusion, and dataset-entry placement —
  are each stated twice on the architecture side, once in the owning AD and once in the
  Conventions. Neither is hedged.
- **P6d's "a stale identifier needs no further rule"** is a PRD-side clause, and A5
  does not restate it. That is correct: the reason (FR-12 already puts the attempt's age
  on the row) is a PRD requirement, and AD-10's amendment is what makes the row carry
  the mark. No architecture obligation is lost.
- **§2.3's "the two new fields need fixture coverage in `sync`'s writer tests"** is a
  `3.4 Other artifacts` note routed to the developer, not to the spine. AD-13's
  zero-network fixture rule already governs it unchanged.

---

## 5. Findings

### F1 — MEDIUM — AD-25's table now says `static.json` feeds the stat-text path, and it does not

A6's approved replacement text for the `static.json` row's `Consumed for` column reads:

> `data/currencies.json` ids; **stat-text path in `web`. The icons this artifact carries are not consumed in v1 (AD-24)**

`static.json` carries currency ids and icons. It carries no stat text. The stat-text
path is `stats.json`, and the row directly above it in the same table says so
("stat ids + display text … modifier text in `web`"). AD-24's amended sentence repeats
the same attribution: "`catalogue/static.json` is fetched for the stat-text path and for
currency id validation."

The likely intent is the one AD-24's preceding sentence states correctly — *the two
catalogue files together* are what let `web` render a stat id as human text without a
runtime call, and `static.json`'s own share of that job is currency id validation. As
written, AD-25's table now contradicts itself about which file carries stat text, in the
one AD that exists to be the identity authority.

This is **not a failure of absorption**: the spine transcribed the approved wording
exactly, which is the right thing for a reviewer gate to want. It is a defect in the
approved wording, inherited identically by the PRD's P3. Recommend raising it back as a
one-line correction to both documents rather than letting a `web` author reconcile it at
build time. Suggested: `data/currencies.json` id validation; **the icons this artifact
carries are not consumed in v1 (AD-24)**.

### F2 — MEDIUM — AD-9's `Binds` list still omits `sync`, though revision 9 puts a stamping obligation on `sync` there

AD-9's `Binds` is `contracts`, `core`, `web`. A2's new first paragraph reads:
"**`sync` stamps all three together, under one rule: only an attempt that issues a
request stamps any of them**, and offline work … stamps none."

That is a rule binding `sync`, stated in an AD that does not bind `sync`. A builder
reading `Binds` to find which ADs constrain the syncer's writer will not find this one.
The obligation is partly redundant with AD-16 (which does bind `sync`, and which A3
amended) and with AD-26's stamping definition, so nothing is unbuildable — but the
redundancy is not complete, because the *offline work stamps none* rule for the two new
fields appears only here and in AD-16's shorter restatement.

The spine has twice fixed exactly this shape: revision 5 added `sync` to AD-28's `Binds`
"which AD-28's band-unit clause was already constraining", and revision 7 added `sync`
to AD-18's. The same argument applies. Note the proposal did not ask for it — A2 says
nothing about `Binds` — so this is a gate finding rather than a missed edit. Recommend
a one-word amendment in a later pass, recorded in that revision's note.

### F3 — LOW/MEDIUM — AD-9's "This is the only state with no age" is now stale against AD-10's cut-off

AD-9 line 193 ends: "Such a row carries no age at all, and `web` renders the row as
*never attempted*, which is a different fact from an old attempt and is shown as a
different fact. **This is the only state with no age.** A `no-listings` or
`unresolvable` entry that has been attempted has an age."

Under rev 9's A7, a *fresh* row — any row younger than the 48-hour cut-off — also shows
no age on a collapsed listing. The sentence is defensible read strictly about the
**data** ("has an age" = has a timestamp), and A7's own wording keeps that reading
available, since a fresh row's age is still reachable in the expansion. But the
surrounding sentences of that paragraph are about **rendering** ("`web` renders the row
as *never attempted*"), which invites the display reading, and under the display reading
the sentence is now false.

This is the one place in the spine where the freshness cut-off and the never-synced
state can be read as contradicting each other. AD-9 was not on the amendment list and
correctly went unamended, so this is a gate finding, not a missed edit. Recommend a
clarifying half-sentence in a later pass — for example, "This is the only state with no
age *to report*; AD-10 governs where a reported age is shown."

### F4 — LOW — A3's placement splits AD-16's median rule from its even-sample qualification

The new search-identifier paragraph (line 295) sits between "The `PriceObservation` is
the **median** of those listings' prices…" (line 293) and "**On an even sample the
median is the lower of the two middle values**…" (line 297). The second paragraph
qualifies the first, and a paragraph about a different subject now stands between them.

This is exactly where the proposal said to put it ("after the `PriceObservation`
sentence"), so the spine followed instruction. The content of all three paragraphs is
intact and nothing is ambiguous to build — the even-sample paragraph names its own
subject in its first clause. Flagged only because the median definition is the one the
brief calls "the product; everything else is presentation", and because the spine's
author moved two other insertion points for precisely this reason (see A2 and A5). Moving
this one after line 297 would be consistent with those two and would cost nothing.

### F5 — LOW — "A present modifier reference **carries** a declared … `acceptedTier`" reads as mandatory

A1's first inserted sentence uses "carries", which a `contracts` author scanning AD-5
for the schema shape can read as *required*. The developer routing row (§5.2) says
"optional display-only `acceptedTier`", and A1's own fourth paragraph resolves it three
paragraphs later ("A missing label is a curation gap … and never a load error"). AD-5's
`valueMax` rule, a few lines above, uses the same verb for a genuinely required field
("`valueMax` is required, everywhere"), which sharpens the ambiguity by proximity.

The resolution is present and unambiguous once read, and this is the approved wording
verbatim, so no action is required. Recorded so that the `contracts` task — which lands
alone and first — does not encode the field as required on the strength of the first
sentence alone.

---

## 6. Staleness sweep

Checked every place the rev-9 edits could have orphaned:

| Risk | Result |
| --- | --- |
| Other mentions of currency **icons** | Three occurrences only: the banner, AD-24 (now "defines no icon"), and AD-25's `Carries` column (descriptive, and now annotated by A6). No surviving instruction to render an icon anywhere in the spine. |
| Other mentions of **"view preferences"** in browser storage | None. A4's deletion was the only occurrence. |
| What `web` fetches, and why | AD-24 (eight, unchanged), AD-6's items.json carve-out, AD-26's currencies.json carve-out, AD-21's read-by column, AD-3's channel rule, the system-view diagram's `catalogue --> web` edge — all consistent with rev 9 and none stale. |
| The ER diagram and its note | Updated; see §2. The diagram itself needed no new edge, since neither field is an entity. |
| Per-row age obligations outside AD-10 | AD-9's reporting clause (line 191, "from `observedAt` … from `lastAttemptedAt` otherwise, labelled") is a *which clock* rule and survives A7 intact — it matches P2's "This rule is unconditional and holds on every surface". AD-14's "per-row freshness (AD-10) is what makes publishing a partial refresh honest" still holds under the narrowed obligation, because a stale row is still marked on every surface. Only F3 is affected. |
| `pruned` and the link | AD-23 unamended and needed no amendment; A5 carries the exclusion and cites AD-23 correctly. |
| Deferred list / Open Questions | Neither mentions icons, per-row age, or a search identifier. Nothing there is invalidated, and nothing in the proposal asked for a new Deferred entry. |
| Brief Scope → Architecture Map | No row covers the trade link or the tier label, and none is made wrong by rev 9. Adding a row was not asked for and is not needed. |

---

## 7. Recommendation

Accept revision 9 as a faithful absorption of §4.2 A1–A8.

Route **F1** back to the proposal's authors as a factual correction affecting both the
PRD (P3) and the spine (A5, A6) — it is a two-word fix in each, and the only finding
here that a builder could act on wrongly. Hold **F2**, **F3** and **F4** for the next
spine pass; each is a sentence, none blocks the `contracts` task, and none contradicts
an approved decision. **F5** needs no action beyond the `contracts` author reading AD-5
to its fourth paragraph.

No finding requires a further revision before the `contracts` change lands.
