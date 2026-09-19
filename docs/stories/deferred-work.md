# Deferred work

Append-only. Each entry names work carved out of a spec so it is not lost.

- source_spec: `docs/stories/spec-contracts-accepted-tier-and-search-id.md`
  summary: The canonical key encoder, and the explicit test that `acceptedTier`, `lastSearchId` and `lastSearchLeague` never enter it.
  evidence: Sprint change proposal 2026-09-13 §5.2 requires the key-exclusion test, but `canonicalKey()` was placed in `core` rather than `contracts`, and `core` is out of scope for the contracts-only landing. The encoder must produce `(baseTypeId, itemLevelMin, prefixBand, suffixBand)` in that field order, with each affix encoding as literal `null` when absent, `[statId, valueMin, valueMax]` when banded, and `[statId, null, null]` when valueless (Consistency Conventions, AD-5). An affix must remain exactly three elements, and `acceptedTier` must never become a fourth.
