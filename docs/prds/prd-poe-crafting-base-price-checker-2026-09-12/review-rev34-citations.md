---
title: 'Citation Review — PRD revision 4 against Architecture Spine revision 4'
type: review
created: '2026-09-13'
reviewed:
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/addendum.md
authorities:
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/WEIGHTS-FILE-SCHEMA.md
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md
---

# Citation Review — PRD rev 4 vs Spine rev 4

## Scope and method

Every `AD-n` token in `prd.md` and `addendum.md` was enumerated mechanically and each
citation site was judged against the cited AD's own text, read in full in the spine at
revision 4. Where the claim was not in the cited AD, the Weights File contract (3.0.0)
and `AGENT-WORKFLOW.md` were read to see whether the claim lives there instead.

- **AD tokens checked:** 320 (298 in `prd.md`, 22 in `addendum.md`).
- **Distinct citation sites:** 257 (a site being one parenthetical or inline group, so
  `(AD-11, AD-28, AD-5)` counts once as a site and three times as tokens).
- **Distinct ADs cited:** all 28.
- **Findings:** 5 — 3 wrong, 1 misattributed, 1 unlabelled extension. One further claim
  is **unverifiable** rather than wrong and is recorded separately.

The overwhelming majority of citations are sound, including every one in the areas the
brief flagged as highest risk except those listed below. In particular FR-16's overlap
predicate, FR-17's rotation and both halves of the `pinned` cap, FR-21's four search
traps, FR-22's cell-curation rule, FR-29's containment, scoping, edge-alignment and
straddle rules, FR-33's eight artifacts, and §10's OQ-8/OQ-9/OQ-10/OQ-11/OQ-12 records
were checked clause by clause against AD-26, AD-16, AD-28, AD-18, AD-24 and the spine's
Open Questions respectively, and each matches its cited authority — in several cases
verbatim.

---

## Findings

### F-1 — WRONG. §3 *Provenance*: the Weights File contract does **not** list the provenance values in the opposite order

**Where:** `prd.md` §3, *Provenance*, the paragraph after the rank table (line 105).

**The claim:**

> The ranks are explicit because "weakest" must not be inferred from enum declaration
> order: `WEIGHTS-FILE-SCHEMA.md` lists the values in the opposite order, and a builder
> implementing weakest-first as `minBy(enumIndex)` over that list would get `measured`
> as the weakest.

**What the authority says.** `WEIGHTS-FILE-SCHEMA.md`, Field rules, `provenance`:

> **Weakest to strongest: `"uniform-prior"` < `"modelled-split"` < `"measured"`** — the
> order AD-10 propagates on, **written the same way round here** so two builders cannot
> rank them differently.

The contract lists them weakest-first, the same direction as AD-10's table
(`absent`, `uniform-prior`, `modelled-split`, `measured`), and says so explicitly in the
same sentence. `minBy(enumIndex)` over the contract's list yields `uniform-prior` — the
weakest of the three file-side values — not `measured`.

**Why it matters.** The sentence is offered as the *reason* the PRD states explicit
numeric ranks, and it instructs a builder to distrust the contract's ordering. It is a
false statement about a companion authority, and it invents a trap that does not exist
while implying the contract is inconsistent with AD-10 when the contract was written
precisely to avoid that. The rank table itself is correct and matches AD-10 exactly; only
this justification is wrong.

**Suggested repair:** drop the "opposite order" clause. If a justification is wanted, the
true one is that `absent` is a `core`-side value absent from the contract's list, so the
two lists are not index-comparable even though they run the same way round.

---

### F-2 — WRONG. Addendum, *Curation Surface* → *What landed*: AD-21 **was** amended by revision 2

**Where:** `addendum.md`, *Curation Surface — Options Considered*, **What landed** (line 70).

**The claim:**

> Option 1 stands; AD-15, AD-21 and AD-23 were not disturbed by revision 2.

**What the authority says.** The spine's own revision-2 note:

> AD ids are stable; AD-5, AD-6, AD-8, AD-11, AD-12, AD-16, AD-17, AD-18, **AD-21** and
> AD-24 are amended in place, and AD-25 to AD-27 are new.

AD-21 is named as amended in place by revision 2, and its current text carries the
revision's fingerprints — the `data/currencies.json` row reads "`sync` **only** — it is
deliberately absent from AD-24's fetch set, which is why AD-26's cap is a `sync`-side
check", which cites an AD that did not exist before revision 2 and a cap introduced later
still.

AD-15 and AD-23 are correctly described: neither appears in the revision-2 list, and
neither carries revision-2-specific text.

**Why it matters.** The sentence is the *What landed* note that tells a downstream reader
the analysis above it is still current. It is load-bearing for exactly the question it
gets wrong, and it is one of the few places the addendum asserts a negative about a
revision rather than a positive.

**Suggested repair:** "AD-15 and AD-23 were not disturbed by revision 2; AD-21 was
amended, but only to record which component reads `data/currencies.json`, which does not
affect this analysis."

---

### F-3 — WRONG. §0: the revision-3 list is **not** the corrected list it claims to be

**Where:** `prd.md` §0, *Document Purpose* (line 20).

**The claim, in one passage:**

> Revision 3 amended AD-11, AD-18, AD-19, AD-26 and AD-27 in place and added no decision.
> … `[NOTE FOR PM]` The spine's own revision notes are incomplete: the revision-4 note
> omits AD-17 and AD-27 and **the revision-3 note omits AD-9, AD-12 and AD-21, all five of
> which demonstrably carry amended text. The lists above are the corrected ones.**

**What the authority says.** The spine's revision-3 note:

> AD ids are stable; AD-11, AD-18, AD-19, AD-26 and AD-27 are amended in place and no AD
> is added.

The PRD's revision-3 list is that note reproduced **verbatim**. It does not include AD-9,
AD-12 or AD-21 — the three the very next sentence says the spine's note wrongly omits. So
"the lists above are the corrected ones" is true of the revision-4 list (which does add
AD-17 and AD-27 to the spine's five) and false of the revision-3 list, which is the
uncorrected one.

This is an internal contradiction within a single paragraph, and it is the paragraph a
downstream reader consults to learn which decisions moved. A reader following the PM note
would look for AD-9, AD-12 and AD-21 in the list and not find them.

**Suggested repair:** either extend the revision-3 sentence to "amended AD-9, AD-11,
AD-12, AD-18, AD-19, AD-21, AD-26 and AD-27", or change "The lists above are the corrected
ones" to name which list was corrected and which was left as the spine spells it.

---

### F-4 — MISATTRIBUTED. FR-27's catalogue hard-error belongs to the Weights File contract and contradicts AD-6

**Where:** `prd.md` FR-27, last bullet of the hard-file-error list (line 570):

> - a `statId` or Base Type key absent from the committed Trade Catalogue (FR-24).

The list is introduced as "Hard file errors reject the file outright (schema **3.0.0**)",
and FR-27's subject is `core`.

**Where the claim actually lives.** `WEIGHTS-FILE-SCHEMA.md`, *Validation*, hard errors:
"a `statId` or `bases` key absent from the committed catalogue (AD-25)". The rule is real,
and it is the weights contract's, not the spine's.

**What the spine says instead.** AD-6 assigns this check explicitly, and to the other
component, with the opposite consequence:

> | every `statId` / `baseTypeId` in `data/weights.json` exists in the catalogue | `sync`,
> reading the file … | **`sync-report.json` only; the file is never rewritten** |

and, in the same AD:

> `sync` owns both because it is the only component holding the full catalogue: AD-24
> deliberately keeps `catalogue/items.json` out of `web`'s fetch set, so **`core` cannot
> perform a base-type cross-check at load and must not pretend to.**

So under the spine the Base Type half of this check is not merely owned elsewhere, it is
*impossible* in the component FR-27 places it in, and the `statId` half is report-only
rather than grounds for refusing the file. The PRD's own FR-24 states the spine's position
correctly ("Every id in the Weights File is checked and a failure is a Sync Report line
**only** — `sync` reads that file and never writes it, so it is reported, not repaired
(AD-6, AD-21)"), so FR-27 and FR-24 disagree, and the bullet cites FR-24 while saying the
opposite of it.

**Assessment.** The PRD is faithfully transcribing the weights contract; the underlying
conflict is between the contract's hard-error list and AD-6/AD-24. But as it stands the
citation points a builder at FR-24 for a rule FR-24 denies, and attributes to "schema
3.0.0" an ownership assignment the spine has already made differently.

**Suggested repair:** qualify the bullet — the `statId` check is `core`-evaluable
(`catalogue/stats.json` is in AD-24's fetch set) and can be a file error; the Base Type
key check is `sync`'s and report-only per AD-6 — and raise the contract's unqualified
wording against the weights contract rather than absorbing it here.

---

### F-5 — UNLABELLED EXTENSION. FR-25's pinned-starvation record names six fields where AD-26 names three

**Where:** `prd.md` FR-25, second consequence (line 519):

> It carries `declaredMinChunkSearches`, `discoveredAllowance`, `pinnedCount`,
> `currencyCost`, `pinnedRefreshed` and `activeRefreshed` — named as fields because "the
> shortfall" is at least four different numbers and a report line nobody can parse is a
> report line nobody acts on.

**What AD-26 says.** The runtime half of the cap:

> …records a distinct **pinned-starvation** record in `sync-report.json`, **carrying the
> allowance it saw, the pinned count, and how many `active` entries it managed.**

That is three contents: `discoveredAllowance`, `pinnedCount`, `activeRefreshed`.
`currencyCost` is fairly derivable from AD-26's load-time half ("`sync` reports the figure
it used", via AD-12's per-source accounting). `declaredMinChunkSearches` and
`pinnedRefreshed` have no counterpart in AD-26 or anywhere else in the spine — they are
this PRD's own refinement, and a good one, since the declaration is exactly what the
runtime half is auditing.

**Why it is a finding.** The extension is not flagged, and it sits two bullets above one
that *is* flagged with exemplary care ("This field is **this PRD's own addition** — no
architecture decision requires it"). The asymmetry will read to a downstream agent as
"the field list is the spine's", which it is not.

**Suggested repair:** a half-sentence in the same style — "AD-26 names three of these;
`declaredMinChunkSearches` and `pinnedRefreshed` are this PRD's addition, so the record
audits the declaration rather than only reporting the shortfall."

---

## Recorded but not counted as a finding

### U-1 — Unverifiable: §0 places AD-27 among revision 4's amendments

§0 states that revision 4 "amended AD-5, AD-10, AD-11, AD-16, AD-17, AD-18 and AD-27 in
place", and the PM note says the spine's revision-4 note "omits AD-17 and AD-27 … which
demonstrably carry amended text".

For **AD-17** this is confirmed: its overlap predicate now carries the line "true if both
are `valueless`" and the paragraph "One kind pairing is unreachable rather than handled: a
`statId` either rolls a value or does not", both of which depend on the `valueless` kind
that revision 4 introduced in AD-5.

For **AD-27** I could not find supporting text. AD-27 contains no reference to AD-28, to
cells, to kinds or to `modelled-split`, and its two substantive paragraphs beyond the
original gate — the `rankable`/`covered` predicates and the denominator narrowing — are
the revision-3 change the spine's revision-3 note already claims (PRD OQ-10). The nearest
candidate is the re-measurement paragraph:

> **Coverage is re-measured on every weights-file regeneration, not once before the view.**
> It was written as a pre-view gate, but the fraction moves: a patch introduces modifiers
> the source publishes unnamed, a producer must drop those rows, and the affected pools
> fall back to `partial` …

which carries no revision marker and rests on the placeholder-row rule that already existed
at contract 2.0.0. So the claim may be right — nothing in the spine contradicts it — but it
is not demonstrable from the documents, and the PRD asserts it as demonstrable. Recording
it rather than calling it wrong, per the standing instruction not to convert an unfound
support into a defect.

### N-1 — Not a finding: §3 *Sync Report* lists "entries not reached" inside an AD citation group

The glossary entry closes its contents list with "(AD-12, AD-23, AD-26, AD-27)", and
"entries not reached in this Chunk" sits inside that list. FR-25 labels that field
unambiguously as the PRD's own addition, so the extension *is* labelled in the normative
place; the glossary is a summary and the four ADs each govern a different item in the
list. Noted only because a reader arriving at §3 first will not see the label.

### N-2 — Not a finding: FR-19 re-homes an AD-8 violation to itself

AD-26 says an implementation that lets `minChunkSearches` "cap, pace, or shorten a chunk
has violated **AD-8**"; FR-19 says such an implementation "has violated **this FR**".
FR-19 does itself state the rule in question ("Neither allowance is a configured
constant … so a Chunk's size is discovered at runtime"), so the PRD's assignment is a
superset rather than a contradiction, and AD-8's own requirement is FR-20, cited on the
adjacent line. Checked and accepted.

---

## Areas checked clean

Recorded so a later reviewer does not re-walk them, and because two earlier false
positives on this project came from judging an AD's subject without reading it.

| Area | Cited | Verified against |
| --- | --- | --- |
| §0 revision-4 amendment list, AD-28's subject, contract 3.0.0 | AD-28, AD-25, AD-26, AD-27 | spine revision-4 note; AD-28 title and rule |
| §3 *Modifier Reference* — two kinds, sentinel rejection, required `valueMax` | AD-5 | AD-5, incl. "A valueless reference is not a degenerate band" |
| §3 *Modifier Weight*, *Cohort*, *cohortTotals*, *Eligible Pool* | AD-28, AD-11, AD-5, AD-18 | AD-28 steps 1–3, the `tiers(ℓ)` equality, the conservation paragraph; AD-18's scoping |
| §3 *Provenance* rank table (the table itself) | AD-10 | AD-10's four-value table, weakest first, incl. `modelled-split` numerator-only |
| §3 *Weights File* — `gamePatch` operator-asserted, never branched on | AD-11 | AD-11's `gamePatch` paragraph |
| FR-4 coverage predicates, disjoint bands, re-measurement, publication | AD-27, AD-18 | AD-27 in full — predicates, three-condition numerator, denominator narrowing, bands, re-measurement |
| FR-10 three render treatments, numerator-only propagation | AD-10 | AD-10's rendering clause and its `modelled-split` paragraph |
| FR-11 banner condition | AD-10, weights contract | per-entry `provenance`; no AD claimed for the banner itself |
| FR-16 overlap predicate, both-valueless branch, shared floor, raw exemption | AD-17 | AD-17's predicate verbatim, incl. the prefix-only/suffix-only case |
| FR-17 rotation rows 0–4, both cap halves, `web` not obliged, resumed chunk | AD-26, AD-9, AD-1 | AD-26 in full |
| FR-19 chunk bounds, `minChunkSearches` as yardstick, cadence arithmetic | AD-7, AD-26 | AD-7; AD-26's yardstick and cadence paragraphs |
| FR-21 search shape and the four traps; half-integer edges | AD-16, AD-5, AD-25, AD-28 | AD-16's filter table and trap list; AD-28's lattice paragraph |
| FR-22 cell curation, interior cells, two-step floor derivation | AD-28, AD-5, AD-17, AD-16 | AD-28's curation rule and worked example; contract's nine-cell example |
| FR-25 per-source accounting, starvation vs not-reached, commit path | AD-12, AD-6, AD-23, AD-27, AD-26, AD-21 | AD-12, AD-26, AD-21 (field list excepted — see F-5) |
| FR-27 producer obligations, hard-error list, `cohortTotals` check | AD-11, AD-5, AD-28, contract 3.0.0 | contract's *Validation* section (catalogue bullet excepted — see F-4) |
| FR-28 both directions, no anonymous-weight field | AD-18, AD-10 | contract's pool-completeness rule; spine *Deferred* → "Unidentified pool weight" |
| FR-29 containment, scoping, empty set, edge alignment, straddle ownership | AD-5, AD-18, AD-28 | AD-18 in full — the two formulas appear verbatim |
| FR-31 `config.json`'s three fields, league mismatch, unfiltered dataset | AD-19, AD-26, AD-14 | AD-19 ("and nothing else; … not a settings bag"), AD-14 |
| FR-33 eight artifacts, four omissions, cross-file checks reported not refused | AD-24, AD-3, AD-21, AD-15, AD-25, AD-26 | AD-24's eight-artifact list verbatim; AD-26's `web` paragraph |
| §5 NFR-1…NFR-10, incl. NFR-10's labelled extension beyond AD-24 | AD-13, AD-1, AD-2, AD-21, AD-15, AD-3, AD-8, AD-24, AD-10 | spine + `AGENT-WORKFLOW.md` (NFR-4's worktree rules correctly attributed to the workflow doc) |
| §10 OQ-8 … OQ-12 resolutions | AD-26, AD-6, AD-27, AD-5, AD-11, AD-18, AD-28, AD-16 | AD-26's re-denominated cap and replaced rationale; AD-27's predicates; AD-11/AD-18's rewritten shapes; spine Open Questions |
| Addendum *Item Level Rule*, *Recipe Count*, *Three Blocking Defects* | AD-5, AD-18, AD-12, AD-17, AD-16, AD-27, AD-25, AD-11, AD-28 | AD-5's authoring-act clause; AD-18's recipe clause; AD-12's search denomination; AD-27's source-agnostic clause (AD-21 claim excepted — see F-2) |
