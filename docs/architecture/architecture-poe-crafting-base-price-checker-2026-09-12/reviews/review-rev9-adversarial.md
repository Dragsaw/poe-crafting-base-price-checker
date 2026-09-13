# Adversarial Review — Architecture Spine revision 9

- **Lens:** adversarial. Build two conforming units one level down and make them incompatible.
- **Under review:** `ARCHITECTURE-SPINE.md` rev 9 (2026-09-13), amendments to AD-5, AD-9, AD-10, AD-15, AD-16, AD-24, AD-25 and the Consistency Conventions.
- **Method:** for each amended clause, construct a pair of implementations that each satisfy every AD verbatim and still produce different artifacts, different renders, or a refusal on one side and a render on the other.
- **Date:** 2026-09-13

## Verdict

Revision 9 is the first revision in this document's history whose amendments were driven by a downstream design rather than by the spine's own self-interrogation, and it shows: the new fields are placed correctly and their *ownership* prose is unusually careful, but three of the five amendments state an **intent** where the previous eight revisions would have stated a **rule with an owner, a value and a failure mode**. The two genuinely dangerous holes are (1) the three-field atomic stamping rule in AD-9/AD-16, which is **unsatisfiable** in the one case it explicitly claims to cover — a search that fails before returning an identifier — leaving the overwrite/clear/leave-stale question unanswered where two builders will answer it three different ways, and (2) `acceptedTier`'s "never a load error" promise, which **AD-3 actively contradicts** and which no clause in this spine (as opposed to the PRD) protects against a `contracts` author adding a spelling regex. Beyond those, AD-10's freshness cut-off is a rule with no declared value, no owner and no legal home in any file this spine defines, and AD-24's link rule contains an "if and only if" that is falsified three sentences later by its own `pruned` clause.

**Counts.** 2 CRITICAL, 2 HIGH, 3 MEDIUM, 2 LOW.

---

## A1 — CRITICAL — AD-9 / AD-16: the three-field stamping rule is unsatisfiable on a failed search, and nothing says what happens to the previous `lastSearchId`

**The two clauses.** AD-9: *"`sync` stamps all three together, under one rule: only an attempt that issues a request stamps any of them."* AD-16: *"The identifier is recorded for every search `sync` issues, whatever the search returns — a full result set, an empty one, or **a failure** — because the value of the identifier to the player does not depend on the outcome. The identifier is recorded at the same moment as `lastAttemptedAt` and under the same rule."* AD-9 also defines the value: *"`lastSearchId` is the identifier **the trade site returned** for that search."*

**The contradiction.** Take the failure case AD-16 names. `sync` issues a POST to `/api/trade2/search/<league>` and gets a 429 (AD-8 makes this a normal, expected outcome), a 500, a timeout, or a connection reset. A request **was** issued, so AD-9's rule says `lastAttemptedAt` is stamped, and "all three together" says `lastSearchId` is stamped too. But the trade site returned no identifier, so there is no value to stamp. AD-16 asserts the identifier is recorded on a failure; AD-9 defines the identifier as a thing only a response can supply. The two cannot both hold. The spine has written a biconditional it cannot honour.

**The two conforming units.**

- `sync-writer-A` reads "all three together" as an atomic triple and therefore, on a failed search, **clears** `lastSearchId` and `lastSearchLeague` to absent while stamping `lastAttemptedAt`. Rationale: the fields travel together, and a field that cannot be stamped must not be left carrying a value from a different attempt, because AD-9 calls it "attempt-scoped" and this is a new attempt.
- `sync-writer-B` reads "only an attempt that issues a request stamps any of them" as permissive — a failed search stamps what it can — and therefore **leaves the previous `lastSearchId` untouched** while advancing `lastAttemptedAt`. Rationale: AD-16 says the identifier's value to the player does not depend on the outcome, so throwing away a working link because a retry 429'd is the user-hostile reading.
- A third reading exists and is defensible: `sync-writer-C` treats a failed search as **not an attempt for stamping purposes** at all, since AD-26 row 3's *"an attempt that issues a request"* is about consuming budget, and stamps nothing — which silently breaks AD-26's rotation key for every entry whose searches are failing, re-selecting it forever. That is the precise starvation failure AD-26 row 2 and row 3 exist to prevent, re-entered through the new field's ambiguity.

**Why it is not cosmetic.** A and B disagree about **what the page renders**, not about an internal detail. Under A, a run of 429s makes every affected row's trade-site link vanish from the page and reappear on the next successful chunk — flicker the player will read as a bug. Under B, the link persists and points at a search issued days earlier. Under C, `sync` re-prices the same failing entries every chunk and never advances the rotation. All three pass every check the spine states. The `web` builder, meanwhile, has been told by AD-24 that presence of `lastSearchId` means "a search was issued for this entry"; under B that sentence is false, because presence now means "a search was issued for this entry **at some point**", which is a different fact and is not the fact AD-24's justification rests on.

**Aggravating detail.** AD-9's parallel case for `lastAttemptedAt` was written with exactly the care this clause lacks: revision 5 spent a full paragraph on *"the one entry with neither timestamp"*, naming absence as genuine and forbidding a placeholder, because a placeholder *"would render as an age on screen where there is no age."* The same question about `lastSearchId` — what does an entry carry when an attempt happened but produced no id — is not asked anywhere in revision 9.

**What would close it.** AD-9 states the failed-search rule explicitly and names the winner, with the reason. Suggested: *"A search that issues a request but returns no identifier — a 429, a 5xx, a timeout — stamps `lastAttemptedAt` and **leaves `lastSearchId` and `lastSearchLeague` exactly as they were**. The three fields are stamped under one rule, and the rule is conditional rather than atomic: an attempt stamps `lastAttemptedAt` unconditionally, and stamps the other two if and only if the trade site returned an identifier. Clearing the pair would delete a link the player can still use over a transport failure that says nothing about the entry, and AD-8 makes a 429 a routine outcome rather than an exceptional one. A `lastSearchId` may therefore be older than its entry's `lastAttemptedAt`, and that is the intended relation between the two."* If the opposite call is made, it needs the same explicitness — silence here is the defect, not the direction.

---

## A2 — CRITICAL — AD-5: "a missing `acceptedTier` is never a load error" is a promise AD-3 does not let `contracts` keep, and nothing in this spine forbids validating the label's spelling

Two separate holes ride on one field. Both are `contracts`-vs-`web` divergences, and `contracts` is the package AGENT-WORKFLOW.md says lands **alone and first** — so both are build-order blockers rather than late-integration surprises.

### A2a — required-vs-optional is undecided, and AD-3 breaks the tie the wrong way

AD-5 says, in one paragraph: *"A **present** modifier reference **carries** a declared, display-only `acceptedTier` label beside its band."* Four paragraphs later: *"A **missing** label is a curation gap that `web` renders as a marked fallback, and never a load error — the field reaches no number, so refusing over it would take the product down for a string."*

- `contracts-A` reads "carries" as the schema obligation it is written as, and makes the field **required** on the `banded` arm. This is the reading the sentence supports: every other field AD-5 describes with "carries" (`weight`, `itemLevelMin`) is required, and AD-11 says of the weights file *"Every field of the chosen kind is required, and no field is nullable."*
- `contracts-B` reads the later paragraph as controlling and makes the field **optional**.

Under `contracts-A`, a `tracked.json` with one unlabelled reference **fails Zod validation**, and AD-3 then says, without qualification: *"`web` validates on load, and **refuses to render an invalid artifact rather than degrading**."* So AD-5's "never a load error" is not merely unenforced — it is *overridden* by a rule in AD-3 that takes precedence at exactly the moment it matters. The product goes down for a string, which is the outcome AD-5 wrote a sentence to forbid. AD-5 asserts the outcome; it does not assign the obligation to the component that produces the outcome.

There is a second spelling of the same gap. If the field is optional, is a curation gap spelled as an **absent key** or as an **empty string**? `contracts-B` accepts both; `web-A` treats `""` as present-and-blank and renders an empty tier cell that looks like a healthy row; `web-B` treats `""` as missing and renders the marked fallback. The spine's Consistency Conventions have a precedent for exactly this — the entity-key row distinguishes three forms of an affix *"so an absent affix and a valueless affix can never collide"* — and revision 9 does not apply that precedent to the new field.

### A2b — "no component validates it against a band" does not say "nothing validates its spelling"

AD-5's prohibition is narrow and precise: *"No component validates it **against a band**, because no component can."* The sprint change proposal's P-series edit to the PRD says the broader thing — *"Nothing validates its spelling, because nothing in the trade API or the Weights File can adjudicate it"* — but **that sentence did not make it into the spine**, and the spine is what `contracts` is built from.

- `contracts-A` adds `z.string().regex(/^T\d+(–T\d+)?$/)`, on the entirely reasonable ground that the PRD names a *"tier-prefix convention (`T1`, `T1–T2`)"*, that a typed contract should type what it can, and that this validates the label against **nothing** — not a band, not the catalogue, not the weights file — so AD-5's prohibition is not touched.
- The curator, following AD-28's worked example and their own keyboard, writes `"T1-T2"` with an ASCII hyphen instead of the en dash, or `"T1/T2"`, or `"T1 (mixed)"`, or `"Prefix T1"`. `tracked.json` now fails to load, `web` refuses to render (AD-3), and the whole product is down — for a string, again, and this time through a check AD-5 permits.

This is not hypothetical drift: the en-dash-versus-hyphen distinction is invisible in most editors, and the spine's own Encoding row (*"All files UTF-8 without BOM"*) tells the curator nothing about which dash to type.

**What would close both.** AD-5 states the schema shape, not only the intent: *"`acceptedTier` is an **optional** `string` on a present modifier reference. Optionality is the mechanism by which this AD's 'never a load error' holds, because AD-3 obliges `web` to refuse any artifact that fails its schema, and a required field would convert a curation gap into a site-wide refusal. A gap is spelled as an **absent key**; the empty string is not a second spelling of a gap, and `contracts` rejects `""`. **No component validates the label at all** — not against a band, not against the catalogue, and not against any grammar, spelling or tier-prefix convention. The tier-prefix convention is guidance to the curator and never a check, because a label may legitimately name a mixture (AD-28) and no component can adjudicate a mixture's spelling."*

---

## A3 — HIGH — AD-10: the freshness cut-off has no value, no owner, and no legal home in any file this spine defines

AD-10's new clause turns on a quantity it never supplies: *"A row at or beyond **a declared freshness cut-off** is marked on every surface it appears on… A row younger than the cut-off may show no age on a collapsed listing."*

**Declared where, by whom?** Search the spine: the phrase appears once, at AD-10. The value — 48 hours — exists in the UX `EXPERIENCE.md` memlog 46/47 and in the sprint change proposal's P2 edit to PRD FR-12. It exists nowhere in this spine, in no schema, and in no file the source tree lists.

Worse, the obvious home is **closed by another AD**. AD-19: *"The active league id is configuration, held in `data/config.json`. `data/config.json` also carries AD-26's `minChunkSearches`, **and nothing else**, because `data/config.json` is a player-owned file rather than a settings bag."* A builder who puts `freshnessCutoffHours` into `config.json` violates AD-19 verbatim. A builder who invents a ninth artifact to hold it violates AD-24's closed eight-artifact set. So the only conforming homes left are a constant compiled into `web` or a constant in `contracts` — and the spine names neither.

**The two conforming units.**

- `web-A` compiles `48h` from the UX spine into the view module. It conforms, and `core` has no idea the constant exists.
- `web-B` reasons that a cut-off which decides whether a *provenance and freshness* obligation is discharged is a decision about data, and AD-4 forbids `web` computing terms, so it puts the threshold in `contracts` as a schema-adjacent constant and has `core` return a per-row `isStale` boolean. Also conforming, arguably better, and incompatible with A at every test boundary.
- A third unit, `web-C`, reads AD-10's older sentence — *"`web` must also surface per-row age, and not merely a single dataset-level timestamp"* — as unchanged for the **unrankable group** and the **tombstone list**, since the cut-off clause says "a collapsed listing" and those are not listings in the ranked sense. `web-C` prints every age everywhere except the ranked table. The rendered pages differ.

**The unasked question: which clock does the cut-off measure?** AD-9 says *"`web` reports age from `observedAt` where an `observedAt` exists, and from `lastAttemptedAt` otherwise, labelled as what the reported age is."* Now apply a cut-off to that pair.

- `web-A` applies the cut-off to **whichever clock the row reports on**. A `no-listings` entry last attempted 9 days ago is marked stale.
- `web-B` applies the cut-off to `observedAt` **only**, on the ground that "freshness" in AD-10's title is about *observations* and AD-10's own rule is about "a figure that rests on" inputs — a `no-listings` row has no figure. That row shows nothing at all, on any surface, forever. It is exactly the row AD-9's revision-5 amendment was written to keep visible, and it goes silent through a clause added four revisions later.

And a row with **neither** timestamp — AD-9's never-attempted row — is at neither side of any cut-off, because it has no age. AD-9 says such a row renders as *never attempted*; AD-10's new clause does not say whether *never attempted* is a "mark" that satisfies "marked on every surface." `web-A` marks it stale; `web-B` prints *never attempted* without the stale ink and leaves it unmarked in a collapsed listing.

**What would close it.** AD-10 names the owner, the home and the clock: *"The freshness cut-off is a single declared constant in `contracts`, and **not** a field of `data/config.json` (AD-19 closes that file). Its value is **48 hours**, chosen against the observed ~15-hour partial-refresh cycle so that a normally rotating row is never marked. The cut-off is measured against **the clock the row reports on** (AD-9): `observedAt` where one exists, `lastAttemptedAt` otherwise. A row carrying **neither** timestamp is always marked, on every surface, as *never attempted*, which is a distinct mark from *stale* and not a suppressible age. The cut-off suppresses an age only on a **fresh** row in a collapsed listing; every other surface, including the unrankable group and the tombstone list, is unaffected by it."*

---

## A4 — HIGH — AD-24: the link rule states an "if and only if" and then adds a third condition, and its own justification invites a price-state reading it forbids

### A4a — the biconditional is false as written

AD-24, in one paragraph: *"`web` renders the link for a tracked entry **if and only if** the entry's `lastSearchId` is present (AD-9) **and** its `lastSearchLeague` equals the active league (AD-19)."* Three sentences later: *"A `pruned` entry never carries the link (AD-23)."*

A `pruned` entry satisfies the biconditional whenever it was attempted in the current league before being pruned. AD-14 keeps its dataset row (*"only the latest observation per tracked entry"* — pruning is a status change in `tracked.json`, not a dataset deletion), AD-23 keeps the tombstone visible (*"A `pruned` entry carries its reason, so nobody re-adds and re-learns the same combination each league"*), and the UX spines render tombstones inside the expansion. So the two sentences are in direct conflict on a row that exists.

- `web-A` implements the stated iff — the sentence is emphasised, it is the rule, and "if and only if" is the strongest form the document uses. Tombstones get links.
- `web-B` implements iff ∧ ¬pruned. No links on tombstones.

Both cite AD-24. The UX conformance review already treats the tombstone exclusion as settled (*"a link inviting a fresh trade-site look at a dead entry would contradict the reason it was pruned"*), so `web-A` ships a page the design rejects while conforming to the architecture's strongest-worded clause.

**Fix:** fold the condition into the biconditional rather than appending it — *"if and only if the entry's status is not `pruned` (AD-23), its `lastSearchId` is present, and its `lastSearchLeague` equals the active league."*

### A4b — the justification sentence licenses a price-state implementation the rule forbids

AD-24 is explicit that the test is on data and not on price state, and that is the right call. But the sentence justifying it reads: *"Presence covers the entries no search was ever issued for — a never-synced entry, and an entry found unresolvable before any request (AD-6)."* A builder is entitled to treat a justification as a specification of intent, and to implement the intent when the intent is easier to compute from what `core` already returns.

- `web-A` tests the two data fields, per the rule.
- `web-B` tests `priceState !== 'not-yet-synced' && priceState !== 'unresolvable'`, on the ground that AD-24's own sentence says presence "covers" exactly those cases, and `core` hands `web` the price state for free (AD-9: *"`core` reports each state separately"*) while `lastSearchId` requires a dataset join.

They diverge on two real rows, and the divergence runs **both ways**:

1. **AD-19's refusal.** An entry priced in the previous league and re-attempted this league (search issued, empty result) has a current-league `lastSearchId`, so `web-A` renders the link. But AD-19 says *"`core` refuses to value any observation whose league differs from the active league, and treats such an observation as `not-yet-synced`"* — so `web-B` sees `not-yet-synced` and renders **no** link. The row that most wants a link — the player has no price and wants to look at the market himself, which is AD-9's own stated motivation for the field — is exactly where the two implementations disagree.
2. **AD-6's post-request unresolvable.** An entry marked `unresolvable` by the catalogue gate before any request has no `lastSearchId`, and both units agree: no link. But an entry that was attempted and *then* found unresolvable carries an id; `web-A` links, `web-B` does not.

**Fix:** AD-24 states the negative explicitly — *"The test is on the two data fields and on nothing else. In particular `web` must **not** derive link visibility from the price state, even though the two agree on most rows: AD-19 re-states a previous-league observation as `not-yet-synced`, so a price-state test would suppress the link on precisely the row whose player most wants it."*

### A4c — AD-14 composition is sound; recorded as a non-issue

AD-14's *"only the latest observation per tracked entry"* composes correctly with the new fields, because the new fields are attempt-scoped and sit on the entry rather than the observation, so there is exactly one of each per entry and the snapshot semantics are unchanged. The Consistency Conventions correctly exclude all three fields from the canonical key, so a re-search does not orphan history. No finding.

---

## A5 — MEDIUM — AD-5: does a `valueless` reference carry `acceptedTier`? The discriminated union has two arms and the AD addresses one

AD-5's sentence places the field spatially: *"A present modifier reference carries a declared, display-only `acceptedTier` label **beside its band**."* AD-5's own table defines a `valueless` reference as *"`(statId)`, **no edges at all**"*, and AD-5 spends a paragraph insisting *"A valueless reference is not a degenerate band."*

- `contracts-A` puts `acceptedTier` on the `banded` arm only, reading "beside its band" literally and noting that a modifier which rolls no number has no tier to accept.
- `contracts-B` puts it on both arms, reading "a present modifier reference" as the subject — the sentence's grammatical subject is the reference, not the band — and noting that *"Loads an additional bolt"* is still a modifier a curator chose, and a curator may still want *"the only tier"* printed.

A curator authoring against `contracts-B`'s schema writes labels on valueless references; those files then fail against `contracts-A`'s schema with an unrecognised key (or silently drop the label, depending on Zod strictness — which the spine also does not pin for this schema). `web` renders a tier for a modifier that has no tier under B and never under A.

Related and equally unpinned: **what the marked fallback contains.** AD-5 says only *"`web` renders [a missing label] as a marked fallback"*. The sprint proposal specifies *"the Trade Catalogue stat name and the value band"*; the spine does not. `web-A` prints an em dash in the tier cell; `web-B` prints the band `[57–78.5]`; `web-C` prints the stat text. Three different rows, one AD.

**Fix:** AD-5 names the arm and the fallback — *"`acceptedTier` sits on the `banded` arm only. A `valueless` reference rolls no number, has no tier axis, and carries no label; `contracts` rejects the key on that arm, so the two arms cannot be confused. Where a `banded` reference's label is absent, `web` renders the band's edges in the label's place, visibly marked as a gap, so the row stays readable and the gap stays noticeable."*

---

## A6 — MEDIUM — nothing owns the search identifier's expiry, and AD-24's render rule has no age term

AD-24 gates the link on **presence** and **league**, and on nothing else. The trade site's search identifier is a third-party, server-side artifact; AD-8 already records that `trade2` is *"unsupported surface that happens to work"* and may change without notice. A search id that GGG expires after N days makes the link open a dead page — while AD-24's rule still says to render it, because both its conditions still hold.

- `web-A` renders the link on any in-league id, however old — the rule's two conditions, and no more.
- `web-B` couples the link to A3's freshness cut-off, reasoning that a link derived from a stale attempt is a stale link and that AD-10 obliges `web` to mark what rests on old data. Links silently disappear from rows older than 48h.

Both conform. The UX conformance review flagged this as T4/LOW *"downstream of T1"* and routed it to the correct-course pass — the correct-course pass has now run, and the item is still unowned. A league rollover masks it for a while (AD-19's league test will retire every id at a league boundary, which bounds the worst case to one league's length), and that is worth stating as the reason it is tolerable, rather than leaving a reader to discover it.

**Fix:** one sentence in AD-24 — *"The link carries no age term. An identifier's lifetime is GGG's, not this product's, and no component may infer one; AD-19's league test bounds a link's maximum age to one league in the worst case. A link that opens a dead search is an accepted outcome, recorded here rather than engineered around, and `web` must not suppress a link on the strength of its entry's age (AD-10's cut-off governs the age mark and not the link)."*

---

## A7 — MEDIUM — AD-24 keeps `catalogue/static.json` for "currency id validation" that `web` has nothing to validate against, and that reading opens an unowned refusal path

Revision 9 dropped the icon but kept the file, and restated its purpose: *"`catalogue/static.json` is fetched for the stat-text path and for **currency id validation**."* Meanwhile AD-21 and AD-24 both state that `web` never fetches `data/currencies.json`, and AD-25's table gives static.json's consumption as *"`data/currencies.json` ids"* — a file `web` does not hold.

So: which currency ids does `web` validate? The only currency identifiers reachable in `web`'s eight artifacts are inside the exchange observation AD-20 stamps on each normalised price (*"rate, source, timestamp"*).

- `web-A` implements no currency validation, since the file it would validate is sync-side, and treats the clause as a leftover.
- `web-B` validates each observation's exchange source against `static.json` and, per AD-3 (*"validates on load, and refuses to render an invalid artifact rather than degrading"*), **refuses to render the whole page** when a `dataset.json` carries an exchange source that a stale `static.json` does not list. Since AD-25 refreshes the catalogue only at patch cadence and AD-8's risk note says GGG may rename ids without notice, this is a site-wide outage triggered by a routine upstream rename — and the Deployment section explicitly promises the opposite: *"A stale catalogue degrades id validation and display text. Neither stale file breaks the app."*

`web-B` is conforming and is the more diligent reading. The cheap fix is to say what the clause means: either drop "currency id validation" from `web`'s stated purpose for the file (it is `sync`'s check, by AD-6's own ownership logic — the component that holds both sides), or state that the check is report-only and never a refusal.

---

## A8 — LOW — `lastSearchLeague` comparison is not normalised, and two league fields now exist on one entry

Two small items in the same area.

**Comparison shape.** AD-24 says `lastSearchLeague` *"equals the active league"*. The Consistency Conventions' *Ids* row normalises `statId` and `baseTypeId` (*"the trade API's own identifiers, and no component re-encodes them"*) and now carves out `lastSearchId` as opaque — but says nothing about the **league id**, which is a user-typed string in `data/config.json` and is also whatever `sync` received from the leagues endpoint. `web-A` compares with `===`; `web-B` trims and case-folds, having been burned by a player typing `"Rise of the Abyssal"` against an API value of `"Rise Of The Abyssal"`. A link that renders on one build and not the other, from one config file. One sentence in the *Ids* row — *"`lastSearchLeague` and `config.json`'s league id are compared by exact string equality, and no component normalises case or whitespace; AD-19's run-start league validation against the live endpoint is what catches a mistyped value, and catches it in `sync` where the player sees it"* — closes it.

**Two leagues on one row.** An entry now carries a league on its `PriceObservation` (AD-14) and a league on the entry (`lastSearchLeague`, AD-9), and they can legitimately disagree: priced last league, re-attempted this league with an empty result. The spine never states which is which at render time, and a `web` builder joining them carelessly will render a last-league price beside a current-league link. AD-19 already forces the right behaviour on the price half (`core` refuses it), so the row is honest — but the *reason* it is honest deserves a sentence in AD-9, because the disagreement looks like a bug to whoever first sees it in a fixture.

---

## A9 — LOW — AD-16's search identifier clause is placed inside the pricing definition, where `sync`'s writer need not look

AD-16's amendment is correct in substance, but it sits at the end of the AD the spine itself calls *"the single most load-bearing definition in the product"* — an AD whose binding audience is whoever implements the estimator. The obligation it adds is a **writer** obligation. AD-21's writer table (`data/dataset.json` — written by `sync` only) carries no note, and AD-9's own statement of the rule is the one a `contracts` author will read. The risk is that the estimator author implements the median faithfully and the dataset writer, a different task in a different worktree, never learns that a failed search still has a stamping obligation. Cross-referencing AD-16's clause from AD-21's `dataset.json` row would cost one parenthesis.

---

## Confirmed non-issues

- **Placement of `lastSearchId` on the entry rather than the observation is right, and the justification is complete.** The argument from `no-listings`/`unresolvable` entries having no `PriceObservation` is decisive, and the ER diagram note in the Structural Seed restates it correctly.
- **`acceptedTier` exclusion from the canonical key is stated in three places** (AD-5, the Consistency Conventions entity-key row, the Structural Seed), and the entity-key row correctly preserves the three-element affix encoding so the new field cannot smuggle itself into a fourth position.
- **AD-15's "who acts" boundary is sound, and the reverse consequence is the valuable half.** The observation that a `web` which may not call pathofexile.com therefore cannot mint a search — and that this is *why* the id is persisted — is the strongest single paragraph in revision 9, and it closes the UX review's T2 finding properly.
- **The icon drop composes.** AD-20 does leave at most one denomination on screen, AD-24's rationale is correct, and AD-25's table records the unconsumed icons without pretending they are gone, so a future multi-denomination view needs no new artifact. The only residue is A7, which is about the *other* half of that sentence.
- **No new ranking term, no ninth artifact, no `core` obligation.** Verified against AD-4, AD-24's closed set and AD-17: all three amendments hold, and `WEIGHTS-FILE-SCHEMA.md` correctly stays at `4.1.0`.
- **AD-2's dependency graph is untouched.** `web` reads `tracked.json` and `dataset.json`, both already in its fetch set, so neither field adds an edge.

## Recommended disposition

| # | Severity | Amend | One-line ask |
|---|---|---|---|
| A1 | CRITICAL | AD-9, AD-16 | State the failed-search rule: which of the three fields a request-without-a-response stamps, and what happens to the previous id. |
| A2 | CRITICAL | AD-5 | Make `acceptedTier` optional *in the spine's own words*, spell a gap as an absent key, and forbid validating the label at all — not only against a band. |
| A3 | HIGH | AD-10 | Give the freshness cut-off a value, a home that AD-19 does not close, and a clock. |
| A4 | HIGH | AD-24 | Fold `pruned` into the biconditional; forbid the price-state implementation explicitly. |
| A5 | MEDIUM | AD-5 | Say whether the `valueless` arm carries the label, and what the marked fallback contains. |
| A6 | MEDIUM | AD-24 | Record that the link carries no age term and why that is tolerable. |
| A7 | MEDIUM | AD-24, AD-25 | Say what `web` validates with `static.json`, or stop claiming it validates currency ids. |
| A8 | LOW | Conventions, AD-9 | Pin league comparison to exact equality; note that the two league fields may legitimately disagree. |
| A9 | LOW | AD-21 | Cross-reference the stamping obligation from the `dataset.json` writer row. |
