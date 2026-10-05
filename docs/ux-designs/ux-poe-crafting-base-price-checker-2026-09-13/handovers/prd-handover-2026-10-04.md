# Handover to the PM — visual redesign (2026-10-04)

From: UX (Sally). To: PM (John). Source decisions: `.memlog.md` rows 239–279.
Spines: `DESIGN.md` revision 19, `EXPERIENCE.md` revision 24. Mockup: `mockups/key-redesign-dark.html`.

## Ownership ruling that frames this handover

The user ruled (memlog 250, 251) that the PRD keeps only high-level requirements and overall
promises to the player. Specific numbers, on-screen strings, states and their treatments move
to the UX spines; mechanism stays with the architecture spine and IMPLEMENTATION-NOTES. The user
will change the BMad ownership rule. **Also update `AGENTS.md`**: its *Known pitfalls* still say
`prd.md` owns "a product-owned number" and that a spine change needs a PRD edit when one changes.
Refresh `PRODUCT.md` after the PRD is slimmed.

Do not copy any string, threshold or state table from EXPERIENCE.md into the PRD. Cite it.

## Requirement-level changes

Each line states the promise as it now stands. Where the PRD's current wording conflicts, rewrite
the requirement in player terms and cite `EXPERIENCE.md` (Epistemics → *Price trust*, *Estimated
odds*; State Patterns; Voice and Tone) for the detail.

| Id | Conflict with the redesign | Promise to keep, in player terms |
|---|---|---|
| FR-3 | Crafted vs Raw Base told apart by rarity colour plus the `Sell as is` text; unit glyphs retired | Each row shows whether the player crafts it or sells it as is |
| FR-6 | "A number input, not a slider" — the threshold now has a draggable slider and a typed figure (memlog 255) | The player sets the payout threshold directly and the ranking follows at once |
| FR-7 | Cold-start 0.25 tagged PRD-owned (now UX-owned, memlog 258) | The threshold survives a reload |
| FR-8 | Listing count, an age on every entry, and every entry shown by default — now: top 8 + show more, age only when there is a problem, listing count only as a rough reason (memlog 258, 263, 264) | Opening a row shows every combination behind its figure, each with whether its price can be trusted |
| FR-9 | "Four Price States, never collapsed, no dash" — now four trust marks (none / rough / pending / broken); two Price States share ○ pending and differ in reason text; `—` stands beside a mark (memlog 253, 257) | A missing price is never shown as worthless, and the player can tell why it is missing |
| FR-10 | "Provenance" displayed; producer/patch beside the figure — now the word leaves the screen, estimated odds show as ≈, producer/patch sit in the sync report (memlog 244, 246, 258) | Every figure says when it rests on something weaker than a measured, current price |
| FR-11 | Global uniform-prior banner — retired; ≈ stays per row (memlog 256) | The player can see which figures rest on estimated roll odds |
| FR-12 | 48-hour cut-off, an age on every expansion entry, *never attempted* — now: rough at 3 days or under 3 listings, row rough at 70% of its EV, reasons owned by EXPERIENCE.md (memlog 245, 257, 263) | Each row says whether its price is current enough to act on |
| FR-13 | Bans "worth"; fixes the "instant-buyout" wording — copy is UX-owned now | The page never presents an asking price as a sale |
| FR-18 | Tracked List date shown unconditionally — now in the sync report, one click away (memlog 243) | The player can see when the tracked list last changed |
| FR-24 | Borderline: unresolvable entries now show ✕ broken and raise the problem count (memlog 253, 254) | A patch that breaks a tracked entry is loud |
| FR-25 | Three figures surfaced at rest — now the problem count at rest, detail in the sync report (memlog 254) | Sync health is visible without a click when something is wrong |
| NFR-10 | Names Provenance among colour-alone prohibitions — now: trust marks, ≈ and the craft/sell distinction each carry a non-colour cue | Colour alone never carries a meaning on the page |
| §3 Glossary | Verbatim on-screen rule and the `Bow` example — on-screen copy is UX-owned (memlog 250) | Glossary terms define the product's language; screen copy lives in EXPERIENCE.md |

## Not for the PRD

- The share-of-EV formula and a data source for "stale game patch" → architect handover
  (`handovers/architect-handover-2026-10-04.md`).
- Every string, threshold and state → EXPERIENCE.md.

## Suggested route

The change spans PRD, architecture, UX and the built epics. `bmad-correct-course` produces the
sprint change proposal that sequences the PRD slim, the spine notes and the new stories.
