# Handover to the architect — visual redesign (2026-10-04)

From: UX (Sally). To: Architect (Winston). Source decisions: `.memlog.md` rows 239–279.
Spines: `DESIGN.md` revision 19, `EXPERIENCE.md` revision 24. Mockup: `mockups/key-redesign-dark.html`.

Provenance (AD-10) is unchanged as a mechanism. Only its on-screen form changes. The items below
need an owner in `ARCHITECTURE-SPINE.md` or `IMPLEMENTATION-NOTES.md`.

1. **Row price-trust verdict (memlog 245, 257, 263, 265 item 7).** EXPERIENCE.md states the rule in
   player terms: a crafted row is ◐ rough when at least 70% of its EV rests on unreliable prices.
   Unreliable = observed 3 days ago or more, or fewer than 3 listings. Measure the share on
   **gross** outcome value, before Craft Cost, with pending lines left out of both sides. When the
   gross value is zero, use the share of priced lines that are unreliable. Open for you: whether
   below-threshold outcomes enter the gross value, and where the computation lives (`core` vs `web`).
   Write the formula in IMPLEMENTATION-NOTES and cite it from EXPERIENCE.md.
2. **Listing count per observation (memlog 263).** Rough needs the listing count behind each price.
   Confirm the dataset carries it for every observation (the current expansion prints it, so it
   likely does).
3. **Stale game patch as a problem (memlog 254, 265 item 16).** The sync button raises a problem
   for a stale `gamePatch`, but no source tells the page what the current patch is. Either name a
   source or rule that the problem cannot fire in v1.
4. **Bundled Inter (memlog 241).** A new web dependency (self-hosted font, e.g. `@fontsource/inter`).
   NFR-7 allows it (static bundle, no server). Add it to the spine's stack versions.
5. **Problem count (memlog 254, 265 item 2).** The count is over entries: broken entries, starved
   pinned entries, plus one for a stale patch. Confirm the sync report artifacts expose each.
6. **Code fix already specified:** `unitLabel()` in `packages/web/src/list/format.ts` must render a
   defence suffix as `Helmets (Str)` (memlog 249, critique P1).
