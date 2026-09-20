---
title: Altitude lens review — PRD revision 14
type: review
target: prd.md revision 14
created: '2026-09-19'
---

# Altitude lens review — PRD revision 14

Scope: the ten edits named in the brief, and nothing else. Rules applied are §0's four:
(1) no sentence that would change if the architect chose a different mechanism for the same
player need; (2) no restating a companion's contract; (3) no revision narrative in the body;
(4) state a requirement, do not argue for a decision. Emptiness counts as a defect only where
an FR has no consequence a test could observe. Every citation introduced was resolved against
its owner, and the material each edit removed was checked against the owner that is supposed
to carry it.

**Verdict: the pass lands. Seven of the ten edits are clean; one states a rule its owner
contradicts, and four leave smaller defects — a tautological FR, an invented process noun,
marker asymmetry, and two mis-targeted citations.**

---

## Findings

### F-1 (High) — FR-29's second consequence states a rule AD-17 contradicts, and its own third bullet contradicts it

Edit 8 collapsed two error payloads and the edge-alignment predicate into:

> A Tracked List a Weights File cannot support is refused at load with the offending entry
> named, rather than ranked on a guess (AD-17; `IMPLEMENTATION-NOTES.md` §2.4, §2.5).

AD-17 says the opposite for exactly this class of failure. Its *four cross-file checks*
paragraph: `sync` aborts, but *"`web` **reports and still renders**: a cross-file failure is
not an invalid artifact under AD-3 — each file is valid on its own — so `web` surfaces the
failing check's payload, excludes the affected base's **crafted branch** from the ordering as
unrankable with that reason, and ranks every unaffected base normally."* The Tracked List is
not refused; one base's crafted branch leaves the ordering.

Revision 13 carried the guard that is now gone — *"'Refuses to render' applies to a
schema-invalid artifact. `web` reports a schema-valid artifact that fails a cross-file policy
check, and never meets such a failure with a file-level refusal."* Deleting it is right (AD-17
owns it), but the replacement had to inherit the owner's verb, and it inherited FR-16's
instead. The next bullet then says the view *"reports such a failure at load and still renders
the unaffected Base Types"*, so the two bullets as published read as refuse-then-render. A
builder reading FR-29 alone lands on the site-wide refusal AD-17 exists to prevent.

**Proposed replacement, citation only:** *"A reference the Weights File cannot support is
reported at load against the offending tracked entry, rather than ranked on a guess (AD-17;
`IMPLEMENTATION-NOTES.md` §2.4, §2.5)"* — §2.5 does carry the payload obligation ("report the
tracked entry by its canonical key… and name neither file as at fault"), and AD-17 carries
"every payload names that entry by its canonical key". With the verb corrected, bullets 2 and
3 stop fighting and the pair is accurate.

Everything else in edit 8 verifies: §2.4 is edge alignment, §2.5 is the empty containment set
and its payload, and bullet 4's rewrite to "the view" / "a sync run" removes the AD-1
decomposition leak exactly as intended.

### F-2 (Medium) — FR-20 now has no observable acceptance, and its second bullet is a tautology

Edit 5's two bullets:

> - The tool's traffic is paced so that access is never lost; losing it ends the product (R-7).
> - Exactly one governed client is the mechanism, and it is AD-8's (AD-8, NFR-9; `IMPLEMENTATION-NOTES.md` §5.3).

Bullet 1 is unfalsifiable — *access is never lost* is an outcome no test can observe, and the
clause after the semicolon is R-7's rationale, which is rule 4. Bullet 2 says the mechanism is
the mechanism; it asserts nothing a test could fail. FR-20 is the one FR in the reviewed set
that now fails the brief's own emptiness test: no consequence is observable, with or without
the spine.

It is also the only FR whose testable form already exists elsewhere in this document. NFR-9
states *"Requests identify the tool and a contact address, pace from live rate-limit headers
and honour `Retry-After` (AD-8)"* — three observable conditions, all cited. FR-20 as edited
carries strictly less than the NFR that cites the same decision.

**Proposed replacement, citation only:** keep one bullet that is observable and owned —
*"A run that meets the rate limit yields its Chunk rather than retrying, and the Sync Report
shows the requests it consumed (AD-8, FR-14, FR-25)"* — and let NFR-9 carry the citizenship
conditions rather than restating them. Bullet 2 should simply be deleted; the heading and the
`*Architecture-owned*` marker already say what it says.

### F-3 (Medium) — §0's marker definition prescribes a delivery process this document does not own

Edit 1's new sentence:

> A heading marked *Architecture-owned* names a capability whose acceptance conditions live in
> the cited decision rather than here; a workflow turning this document into stories raises a
> spike against the citation instead of writing an ordinary story from the bullets below it.

The first clause is exactly right and is what the marker needs. The second clause is a rule
about how stories get made, which is `AGENT-WORKFLOW.md`'s territory, not the PRD's, and it
turns on a noun — *spike* — that appears nowhere else in the planning corpus (no hit in the
architecture directory or in `docs/stories/`). A workflow instructed to raise a spike has
nothing to resolve the word against, and the PRD has quietly taken over a command-level rule.
This is rule 4 by way of ownership: the PRD is stating what another document decides.

**Proposal:** stop the sentence at "rather than here", and if the story-shaping consequence
must be stated, cite the owner — *"how a workflow treats such a heading is
`AGENT-WORKFLOW.md`'s"* — rather than inventing the treatment here.

### F-4 (Medium) — Marker asymmetry in both directions

The marker now sits on FR-16, FR-19, FR-20, FR-21, FR-27, FR-29 and FR-33.

**Missing where it belongs.** FR-32 is the clearest case: all three of its consequences cite
AD-19, AD-12 and AD-7, and the third says outright *"The player-visible consequence is
FR-31's"* — an FR that defers its entire player-visible surface to another FR, and whose
acceptance is otherwise the league gate AD-12 owns, is the definition of the marked class.
FR-17 is a weaker but real second case: its first consequence reproduces AD-7's selection
order (currency rates, `pinned`, `active` oldest-first, bounded `unresolvable` retries) rather
than citing it, which is a live rule-2 restatement sitting under a *(PRD-owned)* label.

**Present where it does not belong.** FR-33 carries acceptance a tester can observe without
opening the spine: the page names an absent artifact on screen, refuses an invalid one, shows
a crafted branch as Unrankable with a reason, and opens a trade link in a new tab as the
player's own act. Marking it tells a workflow *not* to write ordinary stories from those
bullets, which suppresses exactly the states `EXPERIENCE.md` will be built and tested against.
FR-29 has a softer version of the same problem: it is marked, yet carries a `[ASSUMPTION]`
that §11 indexes as *"a product inference this PRD owns"*. A heading cannot both delegate its
acceptance and own a product inference about it.

**Proposal:** add the marker to FR-32; either drop it from FR-33 or state the exception for
FR-33's player-visible bullets; for FR-17, replace the reproduced order with the AD-7 citation
it already carries and leave the *(PRD-owned)* label on the requirement alone.

### F-5 (Low–Medium) — FR-21's first bullet cites the wrong companion section, and the median rule loses its anchor

Edit 7 left:

> The search is built from the tracked entry alone (AD-16; `IMPLEMENTATION-NOTES.md` §4.3, §5.2).

§5.2 is *The four traps* and is the right target — it carries `query.type`, the
`"Buyout or Fixed Price"` option whose id is `null`, the band `max`, and the multi-`#` unit.
§4.3 is *The even-sample median*, which has nothing to do with how a search is built. The
median is claimed in the FR's own statement line ("the median of the cheapest live
instant-buyout listings"), and that line cites AD-16 only — so the section that actually binds
the median's tie-break is attached to the wrong sentence. AD-16 does carry the rule in prose
("on an even sample the median is the lower of the two middle values"), so nothing is lost,
but the citation should move up to the statement line where it resolves.

Also: "Fewer than the full sample is valid and the true count is recorded" now uses a quantity
— *the full sample* — that the PRD no longer defines anywhere. AD-16 owns the ten and states
the same rule verbatim, so under the marker this is acceptable rather than a defect; noted
only because a reader of the PRD alone cannot tell what fraction "fewer" is fewer than.

The deleted OQ-20 bullet is genuinely carried: the spine's *Open Questions* states OQ-20 in
full, with `sync`'s builder as owner and *"blocking for a correct first price"*. But after the
deletion, OQ-20 is the only question in §10 with no referrer anywhere in the document.
Attaching `(OQ-20)` to this bullet would restore the pointer without restoring any prose.

### F-6 (Low) — FR-19's new bullet cites the wrong owner and duplicates FR-14's

Edit 6 added *"An unattended run that fails is visible in the Sync Report rather than only in
an exit code (AD-7, FR-25)"*. The rule belongs to AD-12, not AD-7: AD-12's run-start gate
paragraph is where *"an aborting run still commits and pushes `sync-report.json`… because a
record that never deploys is a record nobody reads"* lives. AD-7 carries the lock, the
rotation and the not-reached figure.

The same sentence is also edit 3's new FR-14 bullet ("…aborts it and is visible in the Sync
Report rather than only in an exit code"), so one requirement is now stated twice under two
different owners. FR-25 already requires the report to record "any run-start gate failure".
One statement, in FR-25, with FR-14 and FR-19 citing it, is the shape the ownership rule asks
for.

Separately, FR-19's heading still cites `IMPLEMENTATION-NOTES.md` §6 (the `pinned` cap
inequality and the `minChunkSearches` seeding argument), but after edit 6 no FR-19 bullet uses
it — the cap's consequences live in FR-15 and FR-25, which both cite §6 already. §7 is
correctly cited and is genuinely used by the lock bullet.

Otherwise edit 6 verifies: the lock bullet's two halves are both in AD-7 ("exits 0, because a
busy lock is a normal outcome") and §7 ("a run that breaks a stale lock takes it, proceeds,
and records `stale-lock-broken`"). Chunk sizing and resume left no observable hole — AD-7 owns
the three bounds and `sync-progress.json`, and the marker is what carries them.

### F-7 (Low) — §10 lists OQ-20 but not OQ-22, on the same blocking grounds

Edit 10's preamble now claims spine-owned questions "are stated in full in
`ARCHITECTURE-SPINE.md` *Open Questions*", which is true of OQ-12, OQ-19, OQ-20 and OQ-21 —
all four resolve, and all four one-liners match their owners' substance, including OQ-12's two
owners (the scraper project for the unit, `sync`'s builder for the `valueless` filter edge).

The spine carries two further open items the PRD does not list: **OQ-22** (the `trade2`
exchange surface — *"blocking for a correct first price, alongside OQ-20"*, owner `sync`'s
builder) and the unnumbered search-identifier-field question (*not blocking*). Listing OQ-20
while omitting OQ-22, when the spine gives them the same blocking status and the same owner,
is an inconsistency in a list whose whole job is to be a complete pointer. OQ-22 also bears on
a product-owned number — `currencyStepSearches` feeds the `pinned` cap FR-15 and FR-25 surface.

**Proposal:** one line, id and owner only — *"**OQ-22** — what the exchange surface is and what
one query returns. Owner: the sync builder."* Omitting the non-blocking identifier question is
defensible either way.

### F-8 (Low) — FR-31's replacement still names the mechanism, and the newly marked FRs were not swept for package names

Edit 4's replacement — *"The player sets the active league in a committed config file, and the
edit is the whole act (AD-19)"* — is a large improvement: the three-field inventory and the
amendment rule are genuinely AD-19's (*"held in `data/config.json`, which also carries AD-7's
`minChunkSearches` and the `schemaVersion` every file carries — **and nothing else**"*), and
`web`'s obligation to fetch and validate the file survives in AD-24's required-for-render
table. Nothing was lost.

What remains is faint rule 1: *committed config file* is the architect's answer, not the
player's need. The player-observable act is that the player declares which league is active
and commits the change; whether that declaration is a file, a flag or an environment value is
AD-19's. "The player declares the active league and commits it, and the edit is the whole act
(AD-19)" says the same thing without inheriting the mechanism. Low, because UJ-6 already names
the file and the citation is correct.

Related, and worth one sweep: edit 8 replaced FR-29's package names with "the view" and "a
sync run", but the other newly marked FRs were not given the same treatment. FR-16's last
bullet still reads *"The check runs in the view at load and in `sync` as a run-start gate"* —
half converted — and FR-33's statement line is *"`web` reads its data at runtime"*. Under §0's
own rule 1, naming a package to assign behaviour breaks altitude by construction, so the
cleanup should finish across the marked set rather than stopping at FR-29.

---

## Edits that verify clean

- **Edit 2 (FR-29, first consequence).** The numerator/denominator clause is gone and the kept
  consequence is exactly `IMPLEMENTATION-NOTES.md` §1's: *"A merely-overlapping entry
  contributes **nothing** to the numerator **and is not an error**."* The citation resolves and
  the owner states the rule.
- **Edit 3 (FR-14, consequences 2 and 3).** AD-12 carries the whole of what left: the three
  run-start gates, which failures abort the run, and the obligation to record the abort in
  `sync-report.json` so it is visible on the surface `web` reads. The `~1,500 searches` figure
  that left with the cost table survives where the PRD owns it, in SM-C1. The replacement
  bullet is observable (a run with a bad premise spends no budget and leaves a report record)
  and mechanism-free. Only the owner attribution noted in F-6 is off.
- **Edit 9 (FR-28, final bullet).** The moved argument is in `addendum.md` under *The Weights
  File (FR-27, FR-28, FR-30)* — *"Why FR-28 states the producer's obligation at all"* — which
  is where rule 4 says it belongs. The surviving four bullets all resolve:
  `WEIGHTS-FILE-SCHEMA.md` has a section literally titled *The pool-completeness rule*, and the
  trust statement ("no mechanical check stands behind a dropped tier or a dropped Stat Line")
  is a requirement about what the ranking rests on, not an argument for a decision.
- **Edit 10 (§10 preamble and the four spine-owned OQs).** The reduction to id, half-line and
  owner is correct at altitude, the "by id and owner, never restated" wording is a real
  improvement over "by id only", and OQ-21's `[NOTE FOR PM]` is preserved. All four one-liners
  match their owners. Only the OQ-22 omission in F-7 stands against it.

## Citation resolution table

| Citation introduced | Resolves | Owner states the material |
| --- | --- | --- |
| `IMPLEMENTATION-NOTES.md` §1 | yes | yes — partly-covered entry contributes nothing, not an error |
| `IMPLEMENTATION-NOTES.md` §2.4, §2.5 | yes | yes — edge alignment; empty-containment payload naming the entry |
| `IMPLEMENTATION-NOTES.md` §4.3 | yes | yes, but attached to the wrong bullet (F-5) |
| `IMPLEMENTATION-NOTES.md` §5.2 | yes | yes — search construction, the four traps |
| `IMPLEMENTATION-NOTES.md` §5.3 | yes | yes — runtime rule-name discovery, per-bucket pacing |
| `IMPLEMENTATION-NOTES.md` §6, §7 | yes | §7 yes (lock, staleness); §6 unused by FR-19's bullets (F-6) |
| AD-8 | yes | yes — one adapter, no hardcoded rate, `Retry-After` |
| AD-12 | yes | yes — four sources, three gates, abort, report commit |
| AD-19 | yes | yes — config file, its three fields and "nothing else" |
| AD-17 (FR-29 bullets) | yes | partly — owner says *report and still render*, PRD says *refused* (F-1) |
| NFR-9, R-7, FR-25 | yes | yes — all live in this document |
| Spine *Open Questions* (OQ-12/19/20/21) | yes | yes — all four stated in full, owners match |
