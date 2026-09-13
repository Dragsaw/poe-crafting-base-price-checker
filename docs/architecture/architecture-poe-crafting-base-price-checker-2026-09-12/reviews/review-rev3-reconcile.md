# Reconciliation Review — Architecture Spine revision 3 against PRD revision 2

**Reviewer role:** reconciliation reviewer
**Date:** 2026-09-13
**Inputs:**
- `docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/ARCHITECTURE-SPINE.md` (revision 3)
- `docs/prds/prd-poe-crafting-base-price-checker-2026-09-12/prd.md` (revision 2)

**Mandate.** Revision 3 exists to absorb the four items PRD §10 raised against the spine — OQ-8, OQ-9, OQ-10, OQ-11. Part 1 judges absorption. Part 2 looks for divergence the amendments themselves created. **The PRD is owned by a different skill and is not edited here; §B is a list of proposals only.**

**Headline.** All four items are genuinely absorbed. The cost is that revision 3 introduced three new build-visible artifacts of its own — a config field, a report line, and a runtime enforcement half — none of which the PRD knows about, and it invalidated two `[NOTE FOR PM]` callouts that now tell a builder to ignore wording the spine no longer contains. **Eight PRD edits are required**, five substantive and three bookkeeping.

---

## Part A — Absorption

### OQ-8 — The `pinned` cap is denominated against the wrong quantity → **ABSORBED**

The PRD's complaint was that AD-26 capped the pinned set at *25% of AD-12's search ceiling*, which is denominated across a full refresh of many chunks while `pinned` costs a search in **every** chunk — "the two do not compose into an inequality an implementer can write."

Revision 3 states the problem in the spine's own voice and then supplies a writable inequality plus a second, runtime half:

> "**The `pinned` cap is denominated against a chunk, not against a full refresh.** AD-12's ~1,500 searches is a ceiling across a full refresh of many chunks, while a `pinned` entry costs a search in **every** chunk — the two quantities never composed into an inequality anyone could write."

> | Load time, a `tracked.json` validation error | `count(pinned) + count(data/currencies.json) ≤ 0.5 × config.minChunkSearches` … |
> | Runtime, every chunk | If the discovered allowance cannot cover the pinned set **plus at least one `active` entry**, `sync` completes the chunk and records a pinned-starvation line in `sync-report.json` naming the shortfall. |

This clears the strictness bar comfortably. An implementer now has: a literal comparand (`0.5 × config.minChunkSearches`), a named source for it (`data/config.json`, seeded from AD-8's measured `30:300` bucket), an explicit statement that the currency set is a summand and why (AD-20 spends it at step 0 of the same chunk), a failure mode for each half, and an argument for why neither half alone suffices:

> "A load-time cap alone cannot be sound, because a chunk's real allowance is discovered at runtime from live rate-limit headers (AD-7, AD-8) and no compiled-in or declared number governs it; a runtime check alone would let a list be authored that can never work."

The 25% figure is gone from the spine entirely (verified by grep across the architecture directory — the only surviving `25%` occurrences are in `.memlog.md` and `PRD-EDIT-PROPOSALS.md`, both historical records).

**Residual, minor, for `contracts` rather than the spine:** AD-26 declares `minChunkSearches` a field of `data/config.json` but names no schema default and no behaviour when it is absent. Since AD-19 now says config.json carries the league "and `minChunkSearches` and nothing else", the natural reading is *required*, and NFR-8's validate-on-load rule then makes an absent field a load failure. Writable as stated; worth a sentence in the Zod schema task.

### OQ-9 — The `unresolvable` retry bound is justified by a cost AD-6 removed → **ABSORBED**

The PRD's complaint was that AD-26 justified the 24h bound as stopping a patched-out modifier "consuming the budget every chunk", when AD-6 detects unresolvability offline against the committed catalogue before any request is issued.

Revision 3 replaces the rationale outright, with a named paragraph:

> "**What the `unresolvable` retry bound actually buys.** It is *not* budget protection: AD-6 detects unresolvability **offline**, against the committed catalogue, before any request is issued, so a retry spends a search only once a human has run the catalogue refresh and the id resolves again. The bound is retained for two other reasons — it paces re-validation so a large unresolvable set does not re-check and re-report every chunk, and it keeps row 3 beneath row 2 so entries recovering after a catalogue refresh rejoin the rotation without displacing it."

And it names the consequence the PRD was worried about:

> "Stating this correctly matters because an implementer reasoning from the old rationale would size the bound against a budget it does not protect."

This is the strongest of the four absorptions: it does not merely delete the wrong reason, it supplies two replacement reasons that are each *load-bearing on the design* (report volume; row precedence), which is what makes the bound sizeable. The second reason is also new information relative to the PRD — FR-17 carries the row-3-beneath-row-2 precedence point, but as a partition argument, not as a justification for the retry interval.

### OQ-10 — AD-27's coverage denominator counts Base Types that need no pool → **ABSORBED**

Revision 3 adds a formal `rankable` predicate to AD-27 and uses it on **both** sides of the fraction:

> ```
> rankable(base) = base carries at least one tracked entry that is
>                  crafted (AD-5: at least one affix present)
>                  and not pruned (AD-23)
> ```

> "**The denominator counts only bases that need a pool.** A base tracked solely as a raw base has no probability term at all — it ranks on AD-17's separate branch — so it can never resolve to `complete` and counting it would depress a fraction that **binds a layout decision**, promoting the unrankable group on the strength of bases that were never unrankable."

It also resolves two adjacent cases the PRD's OQ-10 did not raise, and gets both right:
- **`pruned` entries are excluded** — correct, and it derives this from AD-23 rather than asserting it ("a base whose only crafted entries are tombstones needs no pool either").
- **A base carrying both raw and crafted entries does count** — correct, and consistent with FR-4's second consequence, which already says such a base can have its crafted branch Unrankable while its raw branch ranks.

The measurement is now a function an implementer can compute from `tracked.json` plus the weights file alone. ABSORBED.

### OQ-11 — The spine still writes `valueMax?` in two places → **ABSORBED**

Verified mechanically rather than by reading. A grep for `valueMax\?`, `unbounded above` and `omitted \`ref` across the whole architecture directory returns **zero hits in `ARCHITECTURE-SPINE.md` and zero in `WEIGHTS-FILE-SCHEMA.md`**; the surviving hits are all in `reviews/` and `.memlog.md`, which are historical records of the rev-2 state and correctly retain the old spelling.

The two cited sites now read:

- **AD-11:** "`(statId, valueMin, valueMax, itemLevelMin, weight)`, every field required and none nullable (AD-5)."
- **AD-18:** "a **closed band with both edges always present** (AD-5) … There is no open-top form to handle: a reference without a ceiling is a floor, and a floor is the BQ-1 defect AD-5 exists to remove, so `core` never encounters one — `contracts` rejects it at the schema."

AD-18's replacement clause is better than a deletion: it says *where* the open-top form is refused (`contracts`, at the schema), so an implementer reading AD-18 in isolation — the exact failure mode OQ-11 predicted — is now told the invariant and its enforcement point without needing AD-5.

### Absorption summary

| Item | Verdict | What did the work |
| --- | --- | --- |
| OQ-8 | **ABSORBED** | AD-26's two-ended cap: load-time inequality against `0.5 × config.minChunkSearches`, runtime starvation check + report line |
| OQ-9 | **ABSORBED** | AD-26's "What the `unresolvable` retry bound actually buys" paragraph — rationale replaced, not patched |
| OQ-10 | **ABSORBED** | AD-27's `rankable(base)` predicate, applied to both halves of the fraction |
| OQ-11 | **ABSORBED** | AD-11 and AD-18 respelled; zero residual optional-ceiling spellings in spine or schema (grep-verified) |

---

## Part B — New divergence, and the PRD edits it requires

Ordered by how badly the current PRD text would mislead a builder who reads only the PRD.

### 1. FR-17 — both `[NOTE FOR PM]` callouts are stale, and FR-17 now specifies only half of the pinned cap — **SEVERE**

Two distinct problems, one location.

**1a. The notes are stale.** FR-17 carries:

> "`[NOTE FOR PM]` Build to that requirement rather than to AD-26's literal *25% of AD-12's search ceiling*, which does not compose into a writable inequality — see §10 OQ-8."

> "`[NOTE FOR PM]` Build the bound as stated; its rationale in AD-26 is the part that does not hold — see §10 OQ-9."

Both now point at wording the spine does not contain. The first names a "25% of AD-12's search ceiling" cap that no longer exists and tells the builder to *ignore* the spine's cap — which is now the only place the writable inequality lives. The second tells the builder that AD-26's retry rationale "does not hold", when AD-26 now carries the corrected rationale the PRD itself argued for. A builder who obeys these notes will skip the two paragraphs that were written specifically to serve him.

**1b. The requirement itself is now incomplete, which is the worse half.** FR-17 currently says:

> "**The `pinned` set is capped**, enforced as a `data/tracked.json` validation error at load rather than left as a convention."

That is AD-26's load-time half only. AD-26 rev 3 is explicit that the load-time half **cannot be sound alone** and mandates a runtime check every chunk plus a `sync-report.json` line naming the shortfall. FR-17 as written would produce a `sync` that validates the tracked list and then silently starves, which is precisely the symptom AD-26 says is "indistinguishable from a slow refresh". FR-17 also states no comparand, and does not mention that the currency-set size is a summand of the cap.

**Proposed edit.** Delete both `[NOTE FOR PM]` callouts. Rewrite the cap bullet into two bullets mirroring AD-26's table:
- Load time: a `data/tracked.json` validation error when `count(pinned) + count(data/currencies.json) > 0.5 × config.minChunkSearches`, with the currency set a summand because FR-23/row 0 spends it in the same Chunk.
- Runtime, every Chunk: if the discovered allowance cannot cover the pinned set plus at least one `active` entry, the Chunk completes and the Sync Report carries a **pinned-starvation** line naming the shortfall (ties to edit 3).
- Retain the "why neither half alone" sentence — it is the part a builder will otherwise optimise away.

Keep the existing unresolvable-retry bullet's body (it already agrees with AD-26 rev 3) and simply drop its trailing note; optionally add AD-26's second reason — the bound keeps row 3 beneath row 2 so recovering entries rejoin without displacing the rotation.

### 2. FR-19 — "no number is compiled in" now reads as a contradiction of `config.minChunkSearches` — **HIGH**

FR-19 states, emphatically:

> "**Neither allowance is a configured constant.** Both are whatever the governed client's live rate-limit state says is still available in the tightest unsatisfied bucket (FR-20), so a Chunk's size is discovered at runtime and no number is compiled in."

Revision 3 introduces a **declared number about chunk size** into player-owned config. These are reconcilable — AD-26 is careful that `minChunkSearches` governs nothing at runtime and exists only as the load-time validator's yardstick, while "a chunk's real allowance is discovered at runtime from live rate-limit headers … and no compiled-in or declared number governs it". But a builder reading FR-19 alone faces two bad readings and no text steering him:

- **Reading A (config wins):** treat `minChunkSearches` as the per-Chunk search budget and stop the Chunk there — which would compile the Chunk size to a constant and defeat AD-8's adaptive pacing.
- **Reading B (FR-19 wins):** reject the config field as contradicting a requirement, and drop the load-time cap validator with it — which reopens OQ-8.

This is the one new divergence where the PRD's current text is not merely silent but actively points the wrong way.

**Proposed edit.** Add a consequence to FR-19: `data/config.json`'s `minChunkSearches` is a **declared floor assumption used only by the load-time pinned-cap validation of FR-17**; it is never a Chunk bound, never read by the rate governor, and does not qualify "neither allowance is a configured constant", which continues to hold of the actual allowances. Cross-reference FR-17 and AD-26.

### 3. FR-25 and §3 *Sync Report* — the enumeration omits the pinned-starvation line — **HIGH**

FR-25 is written as a closed enumeration:

> "The report records requests consumed **per declared source** (AD-12, FR-14), unresolvable entries (AD-6), and the date of the last tracked-list edit (AD-23)."
>
> "It also records entries **not reached in this Chunk**. This field is **this PRD's own addition** — no architecture decision requires it …"

The §3 Glossary entry enumerates the same four. AD-26 rev 3 now requires a fifth record type that no PRD text mentions. FR-25 therefore **needs an edit** — the new line is not merely unlisted, it is excluded by the enumerative framing, and NFR-8's validate-on-load rule means a `SyncRunReport` schema without it would make `web` refuse a report that `sync` correctly wrote.

There is a second, subtler hazard: pinned starvation looks close enough to "entries not reached in this Chunk" that a builder will be tempted to fold it in. That loses the thing AD-26 specifically asks for — the **shortfall**, a number. AD-26's whole argument for the runtime half is that without the named shortfall "the symptom is indistinguishable from a slow refresh", and folding starvation into *not reached* reproduces exactly that indistinguishability.

**Proposed edit.** Add a fifth item to FR-25's list and to the §3 *Sync Report* definition: a **pinned-starvation** record, present only on Chunks where the discovered allowance could not cover the pinned set plus at least one `active` entry, naming the shortfall (AD-26, FR-17). Add an explicit sentence that it is **distinct from** *entries not reached*: *not reached* is a normal rotation outcome, starvation is a curation defect the player must act on. Note the provenance difference too — *not reached* is the PRD's own addition, starvation is required by AD-26.

### 4. FR-31 and §3 — `data/config.json` is described as holding only the active league — **MEDIUM**

FR-31 says "The active league is configuration in `data/config.json`", §3's *Refresh Rotation* and glossary say nothing about a second field, UJ-6 describes a league reset as "edits the active league in `data/config.json`", and FR-33 lists `config.json` among the eight fetched artifacts validated on load. AD-19 rev 3 now reads:

> "The active league id is configuration (`data/config.json` — which also carries AD-26's `minChunkSearches` and nothing else; it is a player-owned file, not a settings bag) …"

No PRD sentence is *false* — FR-31 never claimed exclusivity — but no PRD sentence declares the second field either, and the PRD is where the builder of `contracts` will look for what a player-owned file contains. Two knock-ons: the `config.json` Zod schema gains a required field, and FR-33's validate-on-load rule applies to it in `web` even though only `sync` uses it.

**Proposed edit.** Add a consequence to FR-31 (or a short new bullet under FR-17, whichever the PM prefers as the home): `data/config.json` carries exactly two fields — the active league and `minChunkSearches` (FR-17, AD-19, AD-26) — and is player-owned per NFR-5. Add `minChunkSearches` to the §3 glossary entry for whichever term covers config, or to the *Chunk* entry. State that it is not a settings bag, so a third field is an architecture amendment.

*Note for the spine, not the PRD:* the spine's own Structural Seed system-view mermaid still labels the node `config.json — active league`, while the source-tree listing correctly says `active league (AD-19) + minChunkSearches (AD-26)`. Worth a one-word fix in the diagram on the next spine touch.

### 5. FR-4 — the coverage denominator is not narrowed — **MEDIUM**

FR-4's measurement clause reads:

> "Pool coverage across the tracked list — Base Types resolving to `complete` in **both** slots — is measured first, and the result binds the layout (AD-27, §10 BQ-3)"

with a table of bands identical to AD-27's. The bands agree; the **denominator no longer does**. AD-27 rev 3 divides only by bases that carry at least one crafted, non-pruned entry; FR-4 still says "across the tracked list", which is what OQ-10 identified as the defect.

FR-4 is directionally consistent — its second consequence already establishes that a Raw Base needs no Eligible Pool and that a base can have one branch Unrankable and the other ranking — so this is a gap rather than a contradiction. But FR-4 is explicitly "the copy to build to" per BQ-3, and the measurement is the **first build task before any view work**. A builder computing it from FR-4's wording gets a depressed fraction and may promote the Unrankable group to a first-class surface on the strength of raw-only bases, which is the exact outcome OQ-10 was raised to prevent.

**Proposed edit.** Insert AD-27's `rankable` predicate into FR-4 verbatim, and restate both halves of the fraction against it. Include the three cases AD-27 settles: raw-only bases excluded; bases whose only crafted entries are `pruned` excluded; bases carrying both raw and crafted entries included.

### 6. §10 — OQ-8 through OQ-11 are resolved and should be retired, and OQ-8's record is now factually stale — **LOW (bookkeeping, but visible)**

§10's heading *"Raised against the spine by this revision"* introduces the four items as open, with "**Owner: architecture**" on each. All four are now closed. Two specific hazards beyond ordinary staleness:

- **OQ-8's body still asserts** "AD-26 caps the pinned set at *25% of AD-12's search ceiling*". A reader checking the spine against that sentence will not find the text and may conclude the spine is the stale document.
- **OQ-10's body still asserts** "The gate divides by every distinct `baseTypeId` in `data/tracked.json`" — no longer true of AD-27.

**Proposed edit.** Mirror the treatment §10 already gives BQ-1..BQ-3: retitle to *"Raised against the spine by this revision — resolved by spine rev 3"*, retain each item's analysis as the record of why the decision is shaped as it is, and append a **Resolved:** clause to each naming the amended AD and the resolving text. This is the pattern the PRD established and it works well; the analysis in OQ-8 and OQ-10 in particular is worth keeping, since neither argument survives in the amended ADs.

### 7. §0 and front-matter — the PRD is pinned to "final at revision 2" — **LOW**

§0 states: "`ARCHITECTURE-SPINE.md` is final at revision **2**, and its decisions AD-1 through AD-27 are **inherited, not re-decided**. AD-25 …, AD-26 … and AD-27 … are **new in revision 2**." The `inherits` front-matter names the file without a revision, so it needs no change, but the prose does. The §0 banner's "all three were absorbed by **Architecture Spine revision 2**" framing is correct as history and can stay if the rev-3 absorption is added alongside it.

**Proposed edit.** Update §0 to revision 3, and note that revision 3 amended AD-11, AD-18, AD-19, AD-26 and AD-27 in place with no new AD — so the AD-1..AD-27 range and every existing `(AD-n)` citation in the PRD remain valid. That last clause is worth stating explicitly: it is the reassurance that no other FR's citations went stale.

### 8. FR-14 — worth an explicit "`minChunkSearches` is not a fifth source" — **LOW (defensive)**

FR-14's four-source table is unaffected: `minChunkSearches` generates no request, it constrains how a Chunk's discovered allowance is *validated against* a tracked list. **FR-14 needs no correction.** But FR-14 also carries the strong rule "**A fifth source is an architecture amendment, not an implementation detail**", and a builder encountering a new search-denominated number in config could reasonably wonder whether budget machinery moved. One clause forecloses that.

**Proposed edit (optional).** Add to FR-14: `minChunkSearches` (FR-17, FR-19) is a validation yardstick, not a request source, and does not alter the four-source enumeration or the ~1,500-search full-refresh ceiling.

Checked and confirmed clean, requiring no edit:
- **FR-19's Chunk bounds** — AD-26 rev 3 does not change what ends a Chunk; the three bounds of AD-7 are untouched. Only FR-19's *rhetoric* about configured constants needs the qualifier of edit 2.
- **FR-14's ~1,500-search ceiling and SM-C1** — AD-26 explicitly separates the full-refresh ceiling from the per-chunk quantity rather than redefining either.
- **FR-15, FR-24, FR-27, FR-28, FR-29, FR-33** — unaffected by the rev-3 amendments; AD-11's and AD-18's respelling matches what these FRs already said.

---

## Part C — Required PRD edits, consolidated

| # | Target | Severity | Nature | Driver |
| --- | --- | --- | --- | --- |
| 1 | FR-17 | **Severe** | Delete two stale `[NOTE FOR PM]`s; add AD-26's load-time inequality **and** the missing runtime starvation half | AD-26 |
| 2 | FR-19 | High | Qualify "no number is compiled in" so `minChunkSearches` is not read as the Chunk bound | AD-26, AD-19 |
| 3 | FR-25 + §3 *Sync Report* | High | Add the pinned-starvation line with its shortfall, distinct from *entries not reached* | AD-26 |
| 4 | FR-31 + §3 | Medium | Declare `config.json`'s second field; note the schema/validate-on-load knock-on | AD-19, AD-26 |
| 5 | FR-4 | Medium | Narrow the coverage denominator to `rankable` bases | AD-27 |
| 6 | §10 OQ-8..OQ-11 | Low | Retire to resolved; correct OQ-8's and OQ-10's now-false descriptions of spine text | all four |
| 7 | §0 | Low | Spine is final at revision 3; confirm AD-1..AD-27 citations still valid | — |
| 8 | FR-14 | Low (optional) | State that `minChunkSearches` is not a fifth request source | AD-26 |

**Total: 8, of which 1–5 are substantive.**

## Part D — Observation for the spine, outside this review's mandate

`AGENT-WORKFLOW.md` (a companion the PRD also inherits) still describes AD-26's rotation as "*pinned, then oldest-observation-first among `active`*". AD-26 has ordered on **`lastAttemptedAt`** since revision 2 — AD-9's whole `lastAttemptedAt` amendment exists because observation-ordering starves permanently `no-listings` entries. This is a rev-2 leftover rather than anything revision 3 caused, but it is in the inherited set and contradicts both current documents. Worth sweeping on the next spine touch, alongside the system-view diagram label noted in edit 4.

---

*This review proposes; it does not edit. The PRD remains owned by its own skill.*
