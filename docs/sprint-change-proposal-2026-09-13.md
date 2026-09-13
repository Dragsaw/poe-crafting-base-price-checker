---
title: "Sprint Change Proposal: Reconciling the UX spines with the PRD and the architecture spine"
status: approved
created: 2026-09-13
approved: 2026-09-13
scope: "Contradictions and build blockers only (items 1-6 of 15)"
classification: major
sources:
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md
  - docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/addendum.md
  - docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md
  - docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/DESIGN.md
  - docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/EXPERIENCE.md
  - docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/.memlog.md
  - docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/review-prd-conformance.md
  - docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/review-prd-conformance-trade-link.md
---

# Sprint Change Proposal

## 1. Issue Summary

**The problem.** The UX run (`docs/ux-designs/ux-poe-crafting-base-price-checker-2026-09-13/`, 2026-09-13) produced two spines that are now `status: final`. In reaching them, the run overrode decisions the PRD (rev 8) and the architecture spine (rev 8) had already settled, and it introduced two on-screen facts that no upstream data contract carries. Both documents are still at their pre-UX revisions. A builder reading the PRD and the spine today would build something the UX forbids, and would find two fields missing that every ranked row and every expansion row depends on.

**How this was discovered.** The UX run surfaced the divergences itself, in three places and deliberately:

- `.memlog.md` entries **46**, **136**, **149** and **158** each name `bmad-correct-course` as the route, rather than resolving the item UX-side.
- `review-prd-conformance.md` walked all 33 FRs and 10 NFRs against both spines and reported 4 CONTRADICTED, 1 SILENTLY DROPPED and 1 OVERRIDDEN.
- `review-prd-conformance-trade-link.md` spot-checked the late trade-link addition and returned finding **T1 (HIGH)**: the feature's premise depends on a field the PRD's data model never defines.

So this is not a change of direction discovered late. It is a set of departures the UX run recorded honestly and routed here on purpose. The UX documents are internally coherent; what is missing is the absorption pass upstream.

**Evidence.** Six items are in scope for this proposal. The full inventory of fifteen is in §6, with the nine deferred items listed so none is lost.

| # | Item | Kind | Authority |
| --- | --- | --- | --- |
| 1 | FR-12's per-row age suppressed below a 48h cut-off | Contradicts PRD | memlog 46 (`override`) + 47, `[OVERRIDE — memlog 46]` in EXPERIENCE.md |
| 2 | FR-33/AD-24/AD-25 promise a currency icon; the design has none | Contradicts PRD **and** spine | memlog 86 |
| 3 | UJ-2 narrates a drag; the control is a number input | Contradicts PRD narrative | memlog 36 + 37 (`override`) |
| 4 | Accepted Tier is printed on screen but is not a stored field | **Blocks build** | memlog 135, 136; review T-equivalent |
| 5 | The trade-site link needs a search id no artifact carries | **Blocks build** | memlog 149, 157; review finding T1 (HIGH) |
| 6 | FR-33 forbids "a runtime call to pathofexile.com" without distinguishing a player's own click | Needs PRD licence | memlog 158; review finding T2 (MEDIUM) |

**One defect neither review caught**, folded into item 5 below: memlog 149 asserts that "the syncer creates a search id on **every attempt**", and EXPERIENCE.md therefore renders the link for Price States `priced`, `no-listings` and `unresolvable`, absent "only for `not-yet-synced` rows". That rule is wrong in two directions, and the PRD is what makes it wrong:

- FR-24 and AD-6 detect unresolvability **offline, against the committed Trade Catalogue, before `sync` issues any request**. An entry that is `unresolvable` on first encounter therefore never had a search issued and can carry no id — yet the rule promises a link.
- FR-31 renders an observation from a previous league as `not-yet-synced` with reason `league-mismatch`. Such a row *has* been attempted, in the old league. A rule keyed on the presence of an attempt would hand the player a link into last league's search — which is the exact dishonesty FR-31 exists to prevent.

The fix in P6/A2 keys the link on the stored field and the active league rather than on Price State, which resolves both cases and also answers review finding T4 (a stale id has no owner) without a new requirement.

## 2. Impact Analysis

### 2.1 Epic impact — none, and this is the significant fact

There are no epics, no stories and no `sprint-status.yaml` in this repository. Planning ran brief → PRD → architecture → UX and stopped. Checklist §2 (Epic Impact Assessment) and §6.4 (update `sprint-status.yaml`) are therefore **N/A**, not skipped.

The consequence is favourable and should be stated plainly: **nothing is built, so nothing is rolled back and no story is rewritten.** These six items are expensive only if they are discovered during implementation. Absorbed now they are document edits.

### 2.2 Artifact conflicts

| Artifact | Sections touched | Severity |
| --- | --- | --- |
| `prd.md` (rev 8) | §2.3 UJ-2, §3 *Tracked Entry* / *Accepted Tier* / *Price Observation*, FR-12, FR-21, FR-22, FR-24, FR-33, §11 | 7 edits |
| `ARCHITECTURE-SPINE.md` (rev 8) | AD-5, AD-9, AD-10, AD-15, AD-16, AD-24, AD-25, Consistency Conventions | 8 edits |
| `WEIGHTS-FILE-SCHEMA.md` (4.1.0) | **none** | Contract not reissued |
| `EXPERIENCE.md` (final) | Interaction Primitives 6, Component Patterns, two `[NOTE FOR UX]` tags | 3 edits |
| `DESIGN.md` (final) | one `[NOTE FOR UX]` tag | 1 edit |
| `AGENT-WORKFLOW.md` | none | — |

### 2.3 Technical impact

Both blockers land in `contracts`, which is the one package everything depends on. Per NFR-4 and `AGENT-WORKFLOW.md`, **`contracts` changes are serialised and land alone, first**, with dependent work rebasing onto them. That sequencing is the whole technical consequence of this proposal:

- **`TrackedEntry` / `ModifierRef`** gains a declared, display-only `acceptedTier`. Hand-authored, never inferred, never part of the canonical key. Touches `contracts`, the `data/tracked.json` schema and the curation workflow. `core` and `sync` read it never; only `web` renders it.
- **The dataset entry** gains `lastSearchId` and `lastSearchLeague`, stamped by `sync` at exactly the moment it stamps `lastAttemptedAt`. Touches `contracts`, `sync`'s writer and `web`'s render. `core` reads neither.

Neither field enters a ranking term, so AD-4 and AD-17 are untouched and NFR-6's 100 ms budget is unaffected. Neither field is fetched as a ninth artifact, so AD-24's eight-artifact set holds — both ride inside artifacts `web` already fetches (`tracked.json`, `dataset.json`). No schema **major** moves, so NFR-8's refusal rule does not fire against existing files; both fields are additive and optional on read.

The one real cost is curation: `acceptedTier` is a second thing the curator writes per affix. That cost is accepted below, with the reason.

## 3. Recommended Approach

**Direct Adjustment.** Amend the PRD and the architecture spine in place to absorb the six items, and correct the two UX clauses that the absorption proves wrong.

- **Effort:** Low. Fifteen document edits and one `contracts` schema change, ahead of any implementation.
- **Risk:** Low. No rollback (nothing built), no contract reissue, no MVP scope change. The highest-risk edit is the `acceptedTier` field, because it lands on the one entity whose identity rules are strict — mitigated by stating explicitly, in three places, that the field is display-only and excluded from the canonical key.
- **Timeline:** These edits are a prerequisite of the `contracts`-first task, which was already the first build task. No new critical path.

**Rollback** was evaluated and is **not viable** — there is no completed work to revert.

**MVP review** was evaluated and is **not needed**. None of the six items changes what v1 does. Items 1, 2 and 3 make the PRD describe the product the UX actually specifies; items 4, 5 and 6 add two fields and one licence clause. §7.1 In Scope is unchanged.

**The alternative considered and rejected** for items 4 and 5 was to leave both as `[NOTE FOR UX]` and let the builder resolve them. Rejected because both are cross-package contract questions, and `AGENT-WORKFLOW.md`'s definition of done requires that "any invariant the task discovered is raised against the spine rather than encoded locally". A builder resolving `acceptedTier` locally would put it on the canonical key, and a builder resolving the search id locally would put it on `PriceObservation` — where two of the three Price States that need it cannot reach it.

## 4. Detailed Change Proposals

Line references are to the files as they stand at this proposal's date.

---

### 4.1 PRD — `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md`

#### P1 — §2.3 UJ-2: the threshold is typed, not dragged *(item 3)*

**Section:** §2.3 Key User Journeys, UJ-2 (line 64)

OLD:
```
- **UJ-2. The threshold turn.** The player is now richer than at league start. He
  drags the threshold from a quarter of a Divine to one Divine. The list reorders
  immediately — steady moderate Base Types fall away, jackpot Base Types rise —
  and he re-reads the new top five.
```

NEW:
```
- **UJ-2. The threshold turn.** The player is now richer than at league start. He
  types a new threshold over the old one, from a quarter of a Divine to one
  Divine. The list reorders immediately — steady moderate Base Types fall away,
  jackpot Base Types rise — and he re-reads the new top five. **The control is a
  number input rather than a slider** (UX memlog 36/37). The player gives up the
  continuous sweep in which the list visibly reorders as the value moves, and
  gains exactness and masthead width. FR-6's requirement that the list reorder
  immediately is unaffected, and is satisfied by re-ranking on a valid parse of
  the input rather than on commit.
```

**Rationale.** UJ-2's verb is the only place the PRD asserts a control affordance, and the UX run overrode it deliberately with the user's ruling (memlog 36 `decision`, 37 `override`). FR-6 never named a widget, so nothing normative changes — but a journey that narrates a drag against a design that has no slider is a discrepancy a builder would have to adjudicate. Stating the departure and its cost in the journey keeps the record where the reader meets it.

---

#### P2 — FR-12: the age cut-off *(item 1)*

**Section:** §4.4 / FR-12, second consequence (line 307)

OLD:
```
- Every row carries an age **wherever an age exists**. The view takes the age from
  the row's `observedAt` where there is an observation, and from the row's
  `lastAttemptedAt` otherwise (AD-9).
```

NEW:
```
- **Which clock, always.** The view takes the age from the row's `observedAt`
  where there is an observation, and from the row's `lastAttemptedAt` otherwise
  (AD-9). This rule is unconditional and holds on every surface that shows an age.
- **Where an age appears is a freshness cut-off, not a blanket rule.** Every
  Tracked Entry carries an age **in the expansion**, wherever an age exists, with
  both clocks labelled. On the **collapsed ranked row**, a row younger than a
  declared freshness cut-off shows **no age at all**, and a row at or beyond the
  cut-off carries a visible stale mark with a word. **The cut-off is 48 hours**,
  chosen against the ~15-hour partial refresh cycle so that normal rotation never
  marks a row (UX memlog 46/47).
- **This is a deliberate departure from an earlier reading of this FR**, in which
  every row carried an age on every surface. The departure buys the ranked list a
  quiet default: a trust mark on the collapsed row then means something is wrong,
  rather than being present on all twenty rows and discriminating nothing — which
  is the same argument FR-11 makes about a Provenance badge identical on every
  row. **FR-12's intent is preserved rather than traded away.** The distinction
  this FR exists to protect — that the player can always tell an observation age
  from a last-attempted age — is fully carried in the expansion, where both
  clocks are labelled, and a *stale* row is never silent on either surface.
- A single dataset-level timestamp remains insufficient and must not be the only
  freshness signal (AD-7, AD-10). The cut-off suppresses an age on a **fresh**
  row; it never substitutes a dataset-level timestamp for a per-row one.
```

**Rationale.** This is the one item the UX run explicitly asked the PRD to absorb: memlog 46 types itself `override` and says "the PRD should absorb the deviation via `bmad-correct-course`". The literal text of the old consequence is contradicted by the design, and `review-prd-conformance.md` classified FR-12 as OVERRIDDEN rather than CONTRADICTED precisely because the departure was recorded and honest. Absorbing it converts a standing override into a requirement, and the final clause protects against a builder reading the cut-off as a licence to fall back to a dataset-level timestamp.

---

#### P3 — FR-33: no currency icon *(item 2)*

**Section:** §4.10 / FR-33, second consequence (line 733)

OLD:
```
- The two catalogue files are what let the view render a `statId` as its human
  text and a currency as its icon **without a runtime call to pathofexile.com**,
  which is forbidden (AD-15, AD-25). Without the two catalogue files the view
  would show raw stat ids, which is the same list in a form the player cannot
  read.
```

NEW:
```
- The two catalogue files are what let the view render a `statId` as its human
  text **without a runtime call to pathofexile.com**, which is forbidden (AD-15,
  AD-25). Without the two catalogue files the view would show raw stat ids, which
  is the same list in a form the player cannot read.
- **v1 renders a currency as text, and not as an icon** (UX memlog 86). The view
  defines no icon token and no icon component for a denomination.
  `catalogue/static.json` is fetched for the stat-text path and for currency id
  validation, and not for icons. The cost of this is small by construction:
  FR-23 normalises every price to a single denomination, so there is at most one
  denomination on screen and an icon would distinguish nothing. A future
  multi-denomination view would revisit this, and would need no new artifact —
  the icons are already in the file that is already fetched.
```

**Rationale.** The clause is one of the few places the PRD asserts a rendering, and the design contradicts it in writing. `review-prd-conformance.md` finding **F9** recorded the two spines disagreeing with *each other* on this — EXPERIENCE.md repeated the icon claim while DESIGN.md defined no icon anywhere — and memlog 86 resolved it in DESIGN.md's favour. Leaving the PRD unamended would leave a builder holding the only surviving instruction to render an icon. The retained justification matters more than the removal: it records *why* the icon costs nothing here, so a reader does not re-open the question every time the catalogue is discussed.

---

#### P4 — FR-33: a player-initiated outbound navigation is not a runtime call *(item 6)*

**Section:** §4.10 / FR-33 — new consequence, placed after the amended clause above

NEW:
```
- **FR-33's prohibition binds a request the page makes on its own behalf, and
  not a navigation the player chooses.** The forbidden thing is a fetch,
  XHR or WebSocket to pathofexile.com that the page's own rendering depends on —
  which is precisely what the two catalogue files exist to remove (AD-15, AD-25).
  A link the player clicks, which opens the trade site in a new tab
  (`target="_blank" rel="noopener"`), is a different act: the page issues no
  request, the page's rendering does not depend on the result, and the page is
  unchanged when the tab closes. **The view may therefore carry outbound links to
  the trade site**, and `{components.trade-link}` is v1's only one.
- **This does not weaken AD-15, and the boundary is worth stating once.** The
  link adds no write path, no authenticated request, no server-side state and no
  credential. It also does not let `web` mint a trade-site search at view time:
  the search identifier is `sync`-sourced (see FR-21's `lastSearchId`), because
  minting one would require exactly the runtime call this consequence still
  forbids. That is the reason the field is persisted rather than computed.
```

**Rationale.** Review finding **T2 (MEDIUM)**: the UX spines cleared the link against AD-15/AD-21's write-path argument, which is correct but adjacent, and never engaged with FR-33's literal wording, which is the clause closest to the risk. memlog 158 added the distinction to EXPERIENCE.md's Foundation and flagged it `[NOTE FOR UX]` for PRD confirmation, since the PRD does not address a player-initiated link either way. This edit is that confirmation. The second bullet is the part that earns its place: it makes the prohibition's surviving half do real work, by deriving from it *why* the search id must be persisted — which is the load-bearing constraint behind P6.

---

#### P5 — Accepted Tier becomes a declared field *(item 4)*

**Five coordinated edits.**

**P5a — §3 *Tracked Entry*** (line 76)

OLD:
```
- **Tracked Entry** — one unit of the curated workload. A Tracked Entry holds a
  Base Type, an optional prefix Modifier Reference, an optional suffix Modifier
  Reference, a declared **Item Level Floor**, and a **Curation Status**. An entry
  with both affixes absent is a **Raw Base**.
```

NEW:
```
- **Tracked Entry** — one unit of the curated workload. A Tracked Entry holds a
  Base Type, an optional prefix Modifier Reference, an optional suffix Modifier
  Reference, a declared **Item Level Floor**, and a **Curation Status**. Each
  present Modifier Reference carries, beside its band, a declared
  **`acceptedTier`** label (§3 *Accepted Tier*, FR-22). An entry with both affixes
  absent is a **Raw Base**.
```

**P5b — §3 *Accepted Tier*** — append to the existing entry (line 82)

NEW (appended):
```
  **The Accepted Tier is also a declared label, and not only a curation act.**
  The curator writes `acceptedTier` beside the Modifier Reference's band, in the
  same authoring act that chooses the band (AD-5). The label is a **string** —
  `"T1"`, or `"T1–T2"` where the band a curator accepted spans a tier boundary
  (AD-28, FR-22). **The label is display-only.** `core` and `sync` never read it,
  never branch on it and never validate it against a band. `web` prints it, and
  `web` is its only consumer.

  **Three properties are load-bearing, and each closes a reading a builder would
  otherwise reach for.** First, the label is **never derived from the band**. No
  pair of value edges isolates a tier for a modifier carrying more than one `#`
  (AD-28), so a derivation would be wrong on 53 of 63 item classes and would be
  *silently* wrong on the rest. Second, the label is **never joined to the
  Weights File's `tierLabel`**. `tierLabel` sits on a value **cell**, so a band
  spanning cells returns several labels and the join has no defined resolution —
  the contract never promised one (§3 *Modifier Weight*). Third, the label is
  **never part of a Tracked Entry's canonical key** (AD-5, and the spine's
  Consistency Conventions). Two entries that differ only in their label are the
  same entry, and a key that included the label would make a curator's relabelling
  orphan an entry's price history.

  **What the label buys, and what it costs.** It buys a Combination that reads as
  the comparison the player actually makes — the player operates on tiers, and
  does not carry value spreads in their head — so the ranked row prints
  `T1 Cold Res · T1 Mana` rather than `+35% Cold Res · +180 Mana`. It costs one
  more hand-authored field per affix, and a curator who omits it gets a visibly
  marked fallback rather than a wrong label (FR-22).
```

**P5c — FR-22** — new consequences, after the existing `itemLevelMin` consequence (line 501)

NEW:
```
- **The curator declares `acceptedTier` per Modifier Reference, and nothing
  derives it.** A person authors the field by hand, in the same act that chooses
  the band. Neither `sync` nor `core` infers `acceptedTier`, adjusts
  `acceptedTier`, or checks `acceptedTier` against the band — exactly as neither
  infers or adjusts `itemLevelMin`. The field is display-only and `web` is its
  only reader (§3 *Accepted Tier*).
- **A declared label may name a mixture, and that is correct rather than sloppy.**
  `"T1–T2"` is legal. For a modifier whose text carries more than one `#`, the
  value axis does not partition the tier axis (AD-28), so a band near a boundary
  necessarily includes the neighbouring tier's tail and the curator may genuinely
  be accepting a range. `WEIGHTS-FILE-SCHEMA.md` already names `"T7–T8"` as an
  acceptable spelling of the same idea. The view prints what the curator accepted,
  rather than rounding to a single tier the band cannot isolate.
- **A missing label is a curation gap, and never a validation error.** A Modifier
  Reference with no `acceptedTier` still loads, still prices and still ranks —
  the field feeds no ranking term. The view renders such a reference in a
  visibly-marked fallback form carrying the Trade Catalogue stat name and the
  value band, so the gap is noticed and filled. A hard error here would stop the
  product over a display string, which is the wrong trade for a field that
  reaches no number.
```

**P5d — §11 Assumptions Index** — new entry

NEW:
```
- **§4.6 / FR-22** — `acceptedTier` is a display-only string with no defined
  grammar beyond the tier-prefix convention (`T1`, `T1–T2`). Nothing validates its
  spelling, because nothing in the trade API or the Weights File can adjudicate it.
```

**Rationale.** memlog 135 fixes the tier as "the Accepted Tier, declared by the curator", and memlog 136 records the consequence: "Decision 135 requires a **declared field that does not exist upstream**. The Tracked List schema, the PRD and the architecture spine must all absorb it before this is buildable. Route via `bmad-correct-course`." Today §3 *Accepted Tier* describes the concept purely as a curation act expressed through a band, and AD-5 says the choice of tier and the choice of band "are one authoring act" — with nothing stored. The chase cells and every combination row now print a tier, so the field is on the critical path for the primary surface.

The three excluded readings in P5b are the substance of this edit. memlog 136 already recorded the rejected join to `tierLabel` and its reason; the key-exclusion is added here because it is the failure a `contracts` author would actually commit, given that the canonical key encodes affixes as `[statId, valueMin, valueMax]` and a new sibling field looks like a fourth element.

---

#### P6 — The trade-site search identifier *(item 5)*

**Four coordinated edits.**

**P6a — §3 *Price Observation*** (line 86) — adjacent clarification

OLD:
```
- **Price Observation** — an observed price for a Tracked Entry. A Price
  Observation is normalised to Divine. A Price Observation is stamped with the
  observation time, the league, and the exchange observation used (AD-16, AD-19,
  AD-20).
```

NEW:
```
- **Price Observation** — an observed price for a Tracked Entry. A Price
  Observation is normalised to Divine. A Price Observation is stamped with the
  observation time, the league, and the exchange observation used (AD-16, AD-19,
  AD-20). **A Price Observation exists only where there is an observation**, so
  `no-listings` and `unresolvable` entries have none. A fact that must survive on
  an entry in every Price State therefore belongs on the **Dataset entry**
  alongside `lastAttemptedAt`, and never on a Price Observation —
  `lastSearchId` is the case in point (FR-21).
```

**P6b — FR-21** — new consequences, after the existing sample-size consequence (line 479)

NEW:
```
- **`sync` records the trade-site search identifier it issued, on every attempt.**
  Alongside `lastAttemptedAt`, `sync` writes **`lastSearchId`** — the identifier
  the trade site's search endpoint returned for that request — and
  **`lastSearchLeague`**, the league the request was issued against. Both fields
  sit on the **Dataset entry**, never on a Price Observation, because a
  `no-listings` entry has no Price Observation and needs the identifier just as
  much as a `priced` one does (§3 *Price Observation*).
- **The three fields are stamped together, or not at all.** `lastSearchId` and
  `lastSearchLeague` are written at exactly the moment `lastAttemptedAt` is
  written, and by the same rule: **only an attempt that issues a request stamps
  them** (§3 `lastAttemptedAt`). Offline work stamps none of the three — FR-24's
  catalogue validation above all. Tying the identifier to the attempt rather than
  to the outcome is what makes the field's presence decidable without reading
  Price State, which is the property FR-33's render rule depends on.
- **The identifier exists so that `web` can offer a link, and for nothing else.**
  `core` never reads it, and it enters no ranking term (AD-4). It is persisted
  rather than computed at view time because minting a fresh search would require
  a runtime call to pathofexile.com, which FR-33 forbids the page to make on its
  own behalf.
```

**P6c — FR-24** — new consequence, after the two-checks consequence (line 533)

NEW:
```
- **An `unresolvable` entry does not necessarily carry a search identifier, and
  a builder must not assume otherwise.** Detection is offline and precedes any
  request, so an entry that is `unresolvable` the first time `sync` meets it has
  never had a search issued: it carries no `lastAttemptedAt` and no
  `lastSearchId`. An entry that went `unresolvable` later carries both, from the
  last run in which its ids still resolved. Neither case is an error, and the
  presence of the identifier — never the Price State — is what decides whether a
  link can be offered (FR-21, FR-33).
```

**P6d — FR-33** — new consequence, after P4's clauses

NEW:
```
- **The view offers a trade-site link exactly where the stored identifier is
  usable, which is a test on data and never on Price State.** `web` renders
  `{components.trade-link}` for a Tracked Entry if and only if that entry's
  `lastSearchId` is present **and** its `lastSearchLeague` equals the active
  league of `data/config.json`. Both halves are load-bearing:
  - **Presence** covers the never-attempted cases honestly. A `not-yet-synced`
    entry with reason `never-synced` has no identifier. So does an entry that was
    `unresolvable` on first sight (FR-24). A rule keyed on Price State would
    promise a link for the second and a builder would have nothing to render.
  - **League agreement** is what stops the page handing the player a link into
    the previous league's search. FR-31 already refuses to *value* such an
    observation; a link that survived the refusal would reintroduce exactly the
    stale answer the honest-empty state exists to prevent, in the one affordance
    that leaves the page. After a league reset the links disappear with the
    prices and return as the rotation refills.
- **A link is never offered on a `pruned` tombstone.** A `pruned` entry is dead
  by the curator's own decision, and an invitation to re-examine its market
  undercuts the reason it was pruned (FR-15, AD-23).
- **A stale identifier needs no further rule, and that is a consequence of the
  design rather than an omission.** An identifier is exactly as old as the
  attempt that produced it, and FR-12 already puts that attempt's age on the row.
  A player following a link from a row marked stale is told, before the click,
  how old the thing behind it is. If the trade site has since expired the search,
  the player lands on the trade site's own empty result — which costs a click and
  misleads nobody, because the page never claimed the search was live.
```

**Rationale.** Review finding **T1 (HIGH)** is the authority: "rendering a working trade-site link requires a persisted search identifier that no artifact in FR-33's fetched set, no field in §3's *Price Observation*, and no field in `WEIGHTS-FILE-SCHEMA.md` currently carries". memlog 157 upgraded the note in EXPERIENCE.md to a **build precondition**. This edit discharges it.

Two choices in the above are decisions rather than transcription, and both are forced by the PRD's own rules:

- **Placement on the Dataset entry, not on `PriceObservation`.** AD-9 declares `lastAttemptedAt` "on every entry in all four states", while a Price Observation exists only where there is an observation. Two of the three states that need a link — `no-listings` and `unresolvable` — have no Price Observation at all. Putting the identifier there would make the feature unbuildable for the majority of the rows that want it, and it is the placement a builder reaches for first, which is why P6a states the trap in the Glossary.
- **The render rule is keyed on the field and the league, not on Price State.** This corrects the defect described in §1 and simultaneously closes review finding T4 (a stale id has no owner) without inventing a requirement — the answer falls out of FR-12's per-row age, which the row already carries.

---

### 4.2 Architecture Spine — `ARCHITECTURE-SPINE.md`

Revision 8 → **revision 9**. Amends **AD-5, AD-9, AD-10, AD-15, AD-16, AD-24, AD-25** and the Consistency Conventions in place. **Adds no decision and renumbers none — 29 remains the total.** Reissues no contract: `WEIGHTS-FILE-SCHEMA.md` stays at **4.1.0** and no producer work is invalidated.

#### A1 — AD-5: the tracked entry shape gains a declared label *(item 4)*

**Section:** AD-5, the `valueMax` paragraph (line 132) and the `itemLevelMin` paragraph (line 136)

OLD (line 132, final sentences):
```
  A tracked entry is `(baseTypeId, itemLevelMin, prefix?, suffix?)`, where each
  affix is a modifier reference or is **absent**.
```

NEW:
```
  A tracked entry is `(baseTypeId, itemLevelMin, prefix?, suffix?)`, where each
  affix is a modifier reference or is **absent**. A present modifier reference
  carries a declared, display-only **`acceptedTier`** label beside its band. That
  label is not part of the reference's identity, and adding it introduces no
  second modifier identity: identity is still the stat id plus the band, and
  nothing else.
```

OLD (line 136):
```
  **`itemLevelMin` is declared, never inferred.** A curator authors
  `itemLevelMin` by hand as part of curation. Neither `sync` nor `core` derives or
  adjusts `itemLevelMin`. Choosing the accepted tier and choosing the band are one
  authoring act, and the curator records the item level that the choice implies
  next to the choice.
```

NEW:
```
  **`itemLevelMin` and `acceptedTier` are declared, never inferred.** A curator
  authors both by hand as part of curation. Neither `sync` nor `core` derives or
  adjusts either field. Choosing the accepted tier and choosing the band are one
  authoring act, and the curator records the item level that the choice implies
  next to the choice — **and now records the tier itself as a label, rather than
  leaving the tier implicit in the edges**.

  **Why the tier has to be written down rather than recovered.** The trade API
  has no tier concept, so the only two candidate sources are the band and the
  weights file, and neither can answer. Deriving the tier from the band is wrong
  wherever the value axis does not partition the tier axis, which is 53 of 63
  item classes (AD-28) — and wrong *silently* on the remainder, because a
  derivation that happens to be right for a single-`#` modifier gives a builder
  no signal that it is unsound in general. Reading the weights file's `tierLabel`
  fails differently: `tierLabel` sits on a value **cell**, so a band spanning
  cells returns several labels, and the contract never promised that join would
  resolve (AD-29). The curator is the only party that knows which tier they chose
  to chase, so the curator states it.

  **The label is display-only, and three prohibitions follow.** `core` and `sync`
  never read it. No component validates it against a band, because no component
  can. It is **never part of a tracked entry's canonical key** (Consistency
  Conventions), so two entries differing only in their label are one entry, and
  relabelling never orphans an entry's price history. A missing label is a
  curation gap that `web` renders as a marked fallback, and never a load error —
  the field reaches no number, so refusing over it would take the product down
  for a string.
```

#### A2 — AD-9: the dataset entry gains the search identifier *(item 5)*

**Section:** AD-9, after the `lastAttemptedAt` paragraph (line 184)

NEW paragraph:
```
  **The schema declares `lastSearchId` and `lastSearchLeague` beside
  `lastAttemptedAt`, on the entry and never on the observation.** `sync` stamps
  all three together, under one rule: only an attempt that issues a request
  stamps any of them, and offline work — AD-6's catalogue validation above all —
  stamps none. `lastSearchId` is the identifier the trade site returned for that
  search. `lastSearchLeague` is the league the search ran against.

  **The placement is forced, and the obvious alternative does not work.** A
  `PriceObservation` exists only where there is an observation, so `no-listings`
  and `unresolvable` entries have none — and those are two of the three states
  that need the identifier most, because they are the states where the player
  most wants to look at the market themselves. An identifier on the observation
  would therefore be unreachable for the majority of the rows that want it. The
  identifier is an attempt-scoped fact, exactly as `lastAttemptedAt` is, and it
  lives where the other attempt-scoped fact lives.

  **`core` never reads either field**, and neither enters a ranking term (AD-4).
  `web` is the only consumer, and AD-24 states the render rule.
```

#### A3 — AD-16: the syncer records what it issued *(item 5)*

**Section:** AD-16, after the `PriceObservation` sentence (line 278)

OLD:
```
  The `PriceObservation` is the **median of those listings' prices after
  normalisation to divine** (AD-20), recorded with the sample size actually
  returned.
```

NEW:
```
  The `PriceObservation` is the **median of those listings' prices after
  normalisation to divine** (AD-20), recorded with the sample size actually
  returned.

  **`sync` also records the search identifier the search returned, on the entry
  rather than on the observation** (AD-9). The identifier is recorded for every
  search `sync` issues, whatever the search returns — a full result set, an empty
  one, or a failure — because the value of the identifier to the player does not
  depend on the outcome. The identifier is recorded at the same moment as
  `lastAttemptedAt` and under the same rule.
```

#### A4 — AD-15: a player's own navigation is not a write path *(item 6)*

**Section:** AD-15, the Rule (line 252)

OLD:
```
- **Rule:** `web` is a static bundle. `web` performs no authenticated request,
  stores no server-side state, and has no write path to anything but the viewer's
  own browser storage, which holds the threshold dial and view preferences. Any
  requirement that appears to need a backend is escalated, not implemented.
```

NEW:
```
- **Rule:** `web` is a static bundle. `web` performs no authenticated request,
  stores no server-side state, and has no write path to anything but the viewer's
  own browser storage. Any requirement that appears to need a backend is
  escalated, not implemented.

  **An outbound link the player clicks is permitted, and is not an exception to
  this rule.** `web` may carry `target="_blank" rel="noopener"` links to the trade
  site. Such a link issues no request from the page, touches no page state, and
  leaves the page unchanged when the tab closes — so it is not a write path, and
  it is not the runtime call to pathofexile.com that AD-24 and AD-25 forbid. The
  distinction is **who acts**: this AD and AD-24 bar a request the page makes on
  its own behalf and depends on for rendering. They do not bar a navigation the
  player chooses. **The consequence runs the other way too**: because `web` may
  not make the call, `web` cannot mint a trade-site search itself, so any search
  a link targets must have been issued by `sync` and persisted (AD-9, AD-16).
```

#### A5 — AD-24: no icon, and the render rule for the link *(items 2 and 6)*

**Section:** AD-24, the Rule (line 444)

OLD (the relevant sentence):
```
  The two catalogue files are what let `web` render a stat id as its human text
  and a currency as its icon **without a runtime call to pathofexile.com**, which
  AD-15 forbids.
```

NEW:
```
  The two catalogue files are what let `web` render a stat id as its human text
  **without a runtime call to pathofexile.com**, which AD-15 forbids. **v1
  denominates currency as text and defines no icon.** `catalogue/static.json` is
  fetched for the stat-text path and for currency id validation. AD-20
  normalises every price to one denomination, so at most one denomination is ever
  on screen and an icon would distinguish nothing. The icons remain in the
  fetched file, so a future multi-denomination view needs no new artifact.

  **`web` may carry an outbound link to the trade site, and the render rule is a
  test on data rather than on price state.** `web` renders the link for a tracked
  entry if and only if the entry's `lastSearchId` is present (AD-9) **and** its
  `lastSearchLeague` equals the active league (AD-19). Presence covers the
  entries no search was ever issued for — a never-synced entry, and an entry
  found unresolvable before any request (AD-6). League agreement stops the page
  linking into the previous league's search, which AD-19 refuses to value and
  which a surviving link would smuggle back in. A `pruned` entry never carries
  the link (AD-23).
```

#### A6 — AD-25: the catalogue table's consumption column *(item 2)*

**Section:** AD-25, the artifact table, `static.json` row (line 456)

OLD:
```
  | `static.json` | `/api/trade2/data/static` | currency ids + icons | `data/currencies.json` ids, icons in `web` |
```

NEW:
```
  | `static.json` | `/api/trade2/data/static` | currency ids + icons | `data/currencies.json` ids; **stat-text path in `web`. The icons this artifact carries are not consumed in v1 (AD-24)** |
```

#### A7 — AD-10: per-row age under a freshness cut-off *(item 1)*

**Section:** AD-10, the Rule (line 201, final sentence)

OLD:
```
  `web` must also surface per-row age, and not merely a single dataset-level
  timestamp, because AD-7 guarantees that rows refresh at different times.
```

NEW:
```
  `web` must also surface per-row age, and not merely a single dataset-level
  timestamp, because AD-7 guarantees that rows refresh at different times. **The
  obligation is discharged per row and not per surface.** A row at or beyond a
  declared freshness cut-off is marked on every surface it appears on, and every
  row's exact age, on both clocks and labelled, is reachable in its expansion. A
  row younger than the cut-off may show no age on a collapsed listing. What this
  rule forbids is a **single dataset-level timestamp standing in for per-row
  freshness**, and a cut-off that suppresses an age only on a **fresh** row does
  not do that — a stale row is never silent, which is the case the rule exists
  for.
```

#### A8 — Consistency Conventions: two exclusions *(items 4 and 5)*

**Section:** Consistency Conventions, "Entity keys" row (line 624)

OLD (final sentences):
```
  Every artifact that keys entries uses this one encoding. Internal surrogate ids
  are forbidden (AD-5), so the key is the identity, and two components must not
  spell the key differently.
```

NEW:
```
  Every artifact that keys entries uses this one encoding. Internal surrogate ids
  are forbidden (AD-5), so the key is the identity, and two components must not
  spell the key differently. **`acceptedTier` is never part of the key**, and an
  affix still encodes as exactly three elements — the label is a display-only
  sibling of the band, not a fourth element (AD-5). **`lastSearchId` and
  `lastSearchLeague` are never part of the key either**; both are attempt-scoped
  facts on a dataset entry, in the same class as `lastAttemptedAt` (AD-9). A key
  that admitted any of the three would make a relabelling or a re-search orphan
  an entry's history.
```

**Section:** Consistency Conventions, "Ids" row (line 622) — append

NEW (appended):
```
  **`lastSearchId` is a second field that names something the app does not
  define, and it is not a counter-example either.** It is the trade site's own
  search identifier, opaque to the app, stored verbatim, never parsed, never
  validated against the catalogue, and never treated as an entity identity. It
  appears only on a dataset entry, and only `web` reads it (AD-9, AD-24).
```

---

### 4.3 UX spines — corrections the absorption proves necessary

These are the smallest possible edits. Both spines stay `status: final`; this is a live update, as memlog 153 established for the trade-link addition itself.

#### U1 — EXPERIENCE.md, Interaction Primitives item 6: the link's render condition *(item 5)*

**Section:** Interaction Primitives, item 6 (lines 629–643)

OLD:
```
   It appears wherever the syncer attempted a search for that entry — Price State
   `priced`, `no-listings`, or `unresolvable`. Every attempt creates a search id,
   whether or not it resolves to a price. It is absent only for `not-yet-synced`
   rows, where the syncer made no attempt. See Component Patterns. `[NOTE FOR UX]`
   **This is a build precondition, not a footnote** (review-prd-conformance-trade-
   link.md, finding T1): no PRD artifact — not a Price Observation, not any of
   FR-33's eight fetched files, not the Weights File — currently carries a search
   id field. The Tracked List schema, the PRD and the architecture spine must all
   absorb it, the same gap as the Accepted Tier field (memlog 136). Route via
   `bmad-correct-course` before a builder reaches this row.
```

NEW:
```
   It appears where the entry carries a stored `lastSearchId` **and** that search
   ran against the active league (PRD FR-33, FR-21; AD-9, AD-24). The test is on
   the stored field, never on Price State. In practice that means most `priced`,
   `no-listings` and `unresolvable` rows carry it, and two kinds of row do not.
   A row the syncer never issued a search for has no id — a `never-synced` row,
   and also an entry found `unresolvable` before any request was issued, since
   that detection is offline (PRD FR-24). A row whose last search ran in a
   previous league has an id the page will not use, because a link into last
   league's search is the stale answer the honest-empty state exists to prevent
   (PRD FR-31). See Component Patterns.
```

**Rationale.** This is the defect correction. The old rule promises a link for every `unresolvable` row, and the PRD's own offline-detection rule (FR-24/AD-6) means some of those rows have nothing to link to. It is also silent on the league-mismatch case, where an attempt exists but the link would be dishonest. The replacement is shorter, is decidable from the data, and drops the routing note now that the field exists.

#### U2 — EXPERIENCE.md and DESIGN.md: retire the two routing notes *(items 4 and 5)*

**EXPERIENCE.md**, Domain Vocabulary / tier section (lines 232–235)

OLD:
```
`[NOTE FOR UX]` `[ASSUMPTION — memlog 136]` The declared field does not exist
upstream yet — the Tracked List schema, the PRD and the architecture spine all
have to absorb it. Route via `bmad-correct-course`.
```

NEW:
```
The declared field is `acceptedTier`, on the Modifier Reference beside its band
(PRD §3 *Accepted Tier*, FR-22; AD-5). It is display-only: never derived from the
band, never joined to the Weights File's `tierLabel`, and never part of a Tracked
Entry's canonical key. A reference missing the label renders in the fallback form
below, and never fails to load.
```

**DESIGN.md**, line 904, carries the same note against the same decision and takes the same replacement, shortened to the first sentence plus the citation.

**EXPERIENCE.md**, Interaction Primitives (lines 645–652) — the T3/T4 note

OLD (the T4 half only):
```
   and no requirement says what the link does if the trade site's search id goes
   stale.
```

NEW:
```
   and a stale search id is now covered rather than open: an id is exactly as old
   as the attempt that produced it, and FR-12 already puts that attempt's age on
   the row, so a player following a link from a row marked stale was told how old
   it was before the click (PRD FR-33).
```

The **T3 half — the SM-1 tension — is left exactly as it stands**, unresolved and flagged. It is item 14 and out of this proposal's scope.

---

## 5. Implementation Handoff

### 5.0 Approval record

**Approved as written, 2026-09-13**, by the project owner, in the `bmad-correct-course` run that produced this document.

The approval covers all six in-scope items and all 18 edits — 7 PRD, 8 architecture, 3 UX. It covers, explicitly and on the record, the two calls in this proposal that are decisions rather than transcriptions of an existing ruling:

- **`acceptedTier` is excluded from a Tracked Entry's canonical key** (P5b, A1, A8). An affix still encodes as exactly three elements.
- **`lastSearchId` and `lastSearchLeague` sit on the Dataset entry, never on a `PriceObservation`** (P6a, A2), because `no-listings` and `unresolvable` entries have no observation and are two of the three states that need the identifier.

No conditions were attached. The nine deferred items of §6 are **not** approved for change and remain open.

### 5.1 Scope classification: **Major**

This is a Major change, and the classification rests on one fact rather than on size: the two blockers land in **`contracts`**, and `contracts` is the package every other package depends on (AD-2, NFR-4). `AGENT-WORKFLOW.md` requires that `contracts` changes are **serialised, land alone, and land first**, with dependent work rebasing onto them. A change with that property is a replan of the build's first task, not a backlog adjustment — even though the diff is small and nothing is built yet.

The secondary reason is authority: seven architecture decisions are amended in place, which is the architect's call rather than a developer's.

### 5.2 Routing

| Recipient | Deliverable | Responsibility |
| --- | --- | --- |
| **Product Manager** (`bmad-agent-pm` / `bmad-prd`) | `prd.md` rev 8 → **rev 9**; addendum unchanged | Apply P1–P6. Add a revision-8→9 banner in §0 naming the six items and stating that no FR is added and no FR is renumbered. Confirm §7.1 In Scope is unchanged. |
| **Solution Architect** (`bmad-agent-architect` / `bmad-architecture`) | `ARCHITECTURE-SPINE.md` rev 8 → **rev 9** | Apply A1–A8. Add a revision banner naming the seven amended ADs, stating that no decision is added, none is renumbered, and `WEIGHTS-FILE-SCHEMA.md` stays at 4.1.0. Update the "Core entities" note under the ER diagram if `acceptedTier` warrants a mention there. |
| **UX Designer** (`bmad-agent-ux-designer` / `bmad-ux`) | `DESIGN.md`, `EXPERIENCE.md`, `.memlog.md` | Apply U1–U2. Append memlog entries recording that memlog 46, 136, 149 and 158 are discharged, and that U1 corrects a defect the absorption exposed. Both spines stay `status: final`. |
| **Developer** (`bmad-agent-dev`) | `packages/contracts` | **After** the PM and Architect edits land. `TrackedEntry`/`ModifierRef` gains optional display-only `acceptedTier`; the dataset entry gains optional `lastSearchId` and `lastSearchLeague`. Neither enters the canonical key encoder. Lands alone, first, per `AGENT-WORKFLOW.md`. |

### 5.3 Sequencing

The order is not interchangeable — the `contracts` change is the one that blocks, and it should not land against unreconciled prose:

1. **PM and Architect edits land together.** They cite each other (P5b ↔ A1, P6b ↔ A2/A3, P4 ↔ A4/A5), so landing one without the other creates exactly the cross-document drift this proposal exists to remove.
2. **UX corrections land next.** U1 depends on the render rule that P6d and A5 establish.
3. **`contracts` lands alone, first among code changes**, once the prose is settled.
4. **Epic and story generation runs after**, against the reconciled rev 9 documents. It has not run yet, which is why there is no story impact anywhere in this proposal.

### 5.4 Success criteria

- `prd.md` is at rev 9 and `ARCHITECTURE-SPINE.md` at rev 9, with banners naming what moved.
- No FR is added, removed or renumbered. No AD is added or renumbered. `WEIGHTS-FILE-SCHEMA.md` is untouched at 4.1.0.
- A re-run of the PRD-conformance lens over both UX spines returns **zero** findings against items 1, 2, 3, 4, 5 and 6. F9 (the icon disagreement) and T1, T2 and T4 are closed.
- `.memlog.md` entries 46, 136, 149 and 158 no longer route anywhere — each names the requirement that absorbed it.
- No `[NOTE FOR UX]` tag anywhere in either UX spine still says `bmad-correct-course`.
- The eight-artifact set of AD-24/FR-33 is unchanged. `web` fetches no ninth artifact.

## 6. Deferred — the nine items out of scope

Recorded so that nothing found in this analysis is lost. None blocks the build; each is a live candidate for a later pass.

| # | Item | Why it can wait |
| --- | --- | --- |
| 7 | FR-7's "view preferences" narrowed to threshold-only (memlog 92) | The UX ruling is explicit and a builder reading EXPERIENCE.md gets the right answer. The PRD is merely vaguer than the design, not in conflict with it. AD-15's mention of "view preferences" is removed by A4 as a side effect, which narrows the drift. |
| 8 | Display precision: 2dp for EV, price and threshold, with a `< 0.01` floor (memlog 85) | Purely additive. The PRD fixes *persisted* precision at 4dp and is silent on display, so the UX rule contradicts nothing. Worth absorbing into FR-23 eventually, since it is the rule that stops a present figure rendering as `0.00`. |
| 9 | Threshold range 0–3 Divine, step 0.05 (memlog 74) | Additive. The PRD names only the 0.25 cold start. |
| 10 | UJ-5 now begins on the page rather than in the file (memlog 22/25) | memlog 25 restored FR-8 in full, so there is no FR departure — only the journey's narration is dated. |
| 11 | FR-30's file-missing world deliberately unspecified (memlog 72) | The user accepted designing it at implementation time. `review-prd-conformance.md` **F5** notes the appendix-length problem this creates against the no-scroll rule; that is a UX question, not a PRD one. |
| 12 | FR-4's 50–80% coverage treatment unsettled | Correctly blocked: FR-4 says the UX settles it, and the UX cannot draw a band nobody has measured. The measurement is already the build's first task. |
| 13 | Two interior cells of one modifier read identically (memlog 143) | Real, and FR-22 permits the configuration that causes it. Needs a ruling from whoever owns the short-form table. Flagged in both spines. |
| 14 | SM-1 tension with the trade link (review T3) | A brief-level metric question. The likely reading — a deliberate verification click is not the habitual re-checking SM-1 measures — is recorded in EXPERIENCE.md but unruled. |
| 15 | The Craft Recipe has no canonical display name (memlog 107) | The masthead prints the composition verbatim, which is unambiguous while v1 has exactly one recipe (FR-26) and breaks on the second. `recipes.json` gaining a `displayName` is the obvious fix. |

## 7. Checklist Record

| Section | Status | Note |
| --- | --- | --- |
| 1.1 Triggering story | **[N/A]** | No stories exist. The trigger is the UX run's own recorded routings — memlog 46, 136, 149, 158 — plus two conformance reviews. |
| 1.2 Core problem | **[x]** | Categorised as *misunderstanding of original requirements* in part (items 1–3, where the UX ruled against settled text) and *technical limitation discovered during design* in part (items 4–6, where design surfaced two missing contract fields). |
| 1.3 Impact and evidence | **[x]** | §1. Every item traces to a memlog entry typed `override`/`decision` or to a numbered review finding. |
| 2.1–2.5 Epic impact | **[N/A]** | No epics, no stories, no `sprint-status.yaml`. Planning stopped at UX. |
| 3.1 PRD conflicts | **[x]** | 7 edits across §2.3, §3, FR-12, FR-21, FR-22, FR-24, FR-33, §11. MVP unaffected; §7.1 unchanged. |
| 3.2 Architecture conflicts | **[x]** | 8 edits across AD-5, AD-9, AD-10, AD-15, AD-16, AD-24, AD-25, Consistency Conventions. Data model and contracts affected; stack, integration points and package graph untouched. |
| 3.3 UI/UX conflicts | **[x]** | 3 edits. U1 corrects a real defect in the trade-link render rule; U2 retires two routing notes. |
| 3.4 Other artifacts | **[!]** | `packages/contracts` must absorb both fields, serialised and first (NFR-4, `AGENT-WORKFLOW.md`). No deployment, CI, IaC or observability impact. Testing: the two new fields need fixture coverage in `sync`'s writer tests. |
| 4.1 Direct Adjustment | **[Viable]** | Effort **Low**, risk **Low**. Selected. |
| 4.2 Rollback | **[Not viable]** | Nothing built. |
| 4.3 MVP review | **[Not viable / not needed]** | No item changes what v1 does. |
| 4.4 Recommended path | **[x]** | Direct Adjustment. §3. |
| 5.1–5.5 Proposal components | **[x]** | §1–§5. |
| 6.4 `sprint-status.yaml` | **[N/A]** | File does not exist; no epics to record. |
