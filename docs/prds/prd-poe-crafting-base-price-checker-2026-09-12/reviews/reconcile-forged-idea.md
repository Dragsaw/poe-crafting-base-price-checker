# Reconcile: forged-idea.md against PRD rev 35 draft

Input: docs/forge/loot-filter-integration/forged-idea.md (plus the last 12 memlog lines as overrides).
Scope checked: UJ-7, glossary (Base Filter, Pick-up Filter, Raw Base), FR-35 to FR-37, section 6 non-goal, 7.1.

## Covered (no action)
- App wins / final treatment, adds visibility and hides nothing: FR-35 bullet 3.
- Quiet, one treatment per purpose, no EV levels: FR-37 bullets 1-2.
- Colours read the same in plain Base Filter: FR-37 intro and bullet 3.
- EV > 0 cutoff, threshold not reapplied: FR-36 bullet 2.
- Craft / sell raw / check rolls / jewel rules: FR-36 bullets 3-4.
- Memlog decisions (weak and stale unmarked, no-EV rule, NFR-10 not binding): FR-35 bullet 4, FR-36 bullet 5, FR-37 bullet 4.
- Mechanism (Import stub, Show/Continue, BaseType, filename, download): spine; FR-35 carries ASSUMPTION tag.
- Rejected alternatives: commit message.

## Gaps
1. Contradiction on the Item Level Floor of a Raw Base.
   - FR-36 bullet 1 says Raw Bases are named "at or above each one's Item Level Floor".
   - Glossary Item Level Floor (line 90), FR-16 and FR-22 say a Raw Base is exempt from the floor (AD-17).
   - Forged idea means the floor of the base's crafted class entries ("ilvl >= floor of B").
   - Fix: say "at or above the Item Level Floor its Item Class's crafted entries share (FR-22)"; state what a class with no crafted entry does (no floor).
2. Scope of "absent when unpriced" is wider than the forged idea.
   - FR-36 last bullet drops a no-price Raw Base from the whole filter. The check-the-rolls rule does not use price(B), only EV(C) > 0.
   - Memlog "an unpriced raw base is absent" is said about sell-raw only.
   - Fix: "A Raw Base with no price has no craft and no sell-raw entry (FR-9); its check-the-rolls entry depends on EV(C) only."
3. Staleness of the saved file is not a player-facing promise.
   - Forged idea: the file is a snapshot that goes stale; optional in-file marker; UJ-7 refreshes each session. The PRD says "snapshot" but nothing says the file does not follow later changes to dial or prices, and the stale-marker question is not in section 10.
   - Fix: add one FR-35 bullet "The saved filter does not change after it is saved; a changed dial or newer prices reach the game only on the next save", and either add an OQ owned by UX for a stale marker or drop it by commit message.
4. (Minor) The craft-worthiness premise is implicit.
   - Forged idea: the player curates raw entries to end-game bases, and the filter names only those. The Raw Base glossary line says "bases the player would craft on" but nothing says an untracked base keeps the Base Filter treatment because the list is the curation surface.
   - Fix: add "A base the Tracked List does not name is not named by the filter" to FR-36 bullet 1.
