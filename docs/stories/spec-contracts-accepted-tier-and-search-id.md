---
title: 'contracts: bootstrap the package carrying acceptedTier and the trade-search identifier'
type: 'feature'
created: '2026-09-13'
status: 'ready-for-dev'
route: 'full'
review_loop_iteration: 0
context:
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/AGENT-WORKFLOW.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The approved sprint change proposal (2026-09-13) requires `packages/contracts` to gain a display-only `acceptedTier` on `ModifierRef` and attempt-scoped `lastSearchId` / `lastSearchLeague` on the dataset entry. No code exists in this repository at all, so there is no schema for the fields to land on.

**Approach:** Stand up the pnpm workspace root and `packages/contracts` as Zod schemas with `z.infer`red types (AD-3, AD-22), carrying the entry shapes the two new fields belong to. Test-first throughout.

## Decisions

- **Scope is the minimal slice.** Only the shapes the two new fields touch, plus the `schemaVersion` refusal. The other eight AD-22 concepts arrive with the consumers that need them, rather than being guessed now.
- **`canonicalKey()` lives in `core`, not `contracts`** — following AGENT-WORKFLOW's "invariants live in `core` as exported pure functions" pattern. `core` is out of scope here, so **the proposal's key-exclusion requirement is deferred to the `core` landing** and is recorded in `docs/stories/deferred-work.md`. This landing discharges the *structural* half of it: the fields are shaped so that no correct encoder could pick them up.

## Boundaries & Constraints

**Always:**
- Zod 4.6.4 schemas are the single source of truth; every type is `z.infer`red and never declared in parallel (AD-3, AD-22).
- `acceptedTier` is an **optional free string** on **both** arms of the `ModifierRef` union, and a **sibling of the band, never nested inside it**. Its spelling is never validated, it is never derived from the band, never joined to the Weights File's `tierLabel`. A missing label loads clean (AD-5, FR-22).
- `lastSearchId` and `lastSearchLeague` are **optional**, sit on the **dataset entry**, never on `PriceObservation` (AD-9, FR-21).
- Every artifact schema carries `schemaVersion`; a consumer refuses an **unknown major** rather than guessing (NFR-8).
- Pinned stack versions exactly as the Stack table gives them. All six verified to resolve on the registry.
- Any invariant this task discovers is raised against the spine, never encoded locally (AGENT-WORKFLOW definition of done, item 5).

**Never:**
- No `core`, `sync`, or `web` package — this change lands alone and first (NFR-4, AGENT-WORKFLOW).
- **No canonical key encoder in this landing** — it belongs to `core` (see Decisions).
- No `packages/contracts` dependency on anything but Zod (AD-2: contracts imports nothing).
- No network call in any test (AD-13).
- No reissue of `WEIGHTS-FILE-SCHEMA.md`; it stays at 4.1.0.
- No GitHub Actions / Pages workflow — that is `web` deployment, out of scope here.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Banded ref with label | `{kind:'banded', statId, valueMin, valueMax, acceptedTier:'T1'}` | Parses; label preserved verbatim | No error expected |
| Label spans tiers | `acceptedTier: 'T1–T2'` (U+2013 en-dash) | Parses unchanged; en-dash preserved byte-for-byte | No error expected |
| Label absent | Modifier ref with no `acceptedTier` | Parses; field `undefined` — a curation gap | **Never** a validation error (FR-22) |
| Label on valueless arm | `{kind:'valueless', statId, acceptedTier:'T1'}` | Parses; optional on both arms (AD-5) | No error expected |
| Label spelling is free | `acceptedTier: 'whatever'` | Parses — nothing adjudicates spelling (§11) | **Never** rejected |
| Label is a band sibling | Parsed banded ref | `acceptedTier` sits at the top level of the ref, not inside the band edges | No error expected |
| Valueless has no edges | `{kind:'valueless', statId}` | No `valueMin`/`valueMax` — not a `1/1` sentinel | Edges on a valueless arm are rejected |
| Search fields on entry | Dataset entry with both fields | Both parse and are retained | No error expected |
| Search fields not on observation | `PriceObservation` given a `lastSearchId` | Field does **not** survive onto the observation | The misplacement the proposal warns of |
| Attempt without answer | 429/5xx/timeout: `lastAttemptedAt` stamped alone | Other two keep prior values; `lastSearchId` may be **older** than `lastAttemptedAt` (AD-9) | Not an error; must not be rejected |
| Never attempted | Entry with none of the three | Parses; all three `undefined` | No error expected |
| Unknown schema major | Artifact `schemaVersion: '2.0.0'` vs supported `1.x` | Refused | Typed refusal, never a silent downgrade |
| Known minor ahead | `schemaVersion: '1.9.0'` vs supported `1.0.0` | Accepted | No error expected |

</frozen-after-approval>

## Code Map

Greenfield — every path below is new. There is no existing code to reuse or avoid.

- `package.json`, `pnpm-workspace.yaml` — workspace root; pins Node 24.x, wires `pnpm check` and `pnpm test`.
- `tsconfig.base.json` — strict TS 6.0.3 base the package extends.
- `eslint.config.js`, `.dependency-cruiser.cjs` — the two halves of `pnpm check` beyond typecheck. The cruiser ruleset encodes AD-2's graph now, while `contracts` is the only node, so `core`/`sync`/`web` land against a rule that already exists.
- `packages/contracts/src/modifier-ref.ts` — the `banded` | `valueless` discriminated union; `acceptedTier` optional on both arms.
- `packages/contracts/src/tracked-entry.ts` — `TrackedEntry` + `CurationStatus` (`active` | `pinned` | `pruned`).
- `packages/contracts/src/price-observation.ts` — the observation shape; deliberately carries **no** search identifier.
- `packages/contracts/src/dataset.ts` — dataset entry: `lastAttemptedAt`, `lastSearchId`, `lastSearchLeague`, optional `PriceObservation`.
- `packages/contracts/src/schema-version.ts` — the unknown-major refusal (NFR-8).

Authority, in precedence order: `ARCHITECTURE-SPINE.md` rev 9 (AD-2, AD-3, AD-5, AD-9, AD-22, Consistency Conventions) → `prd.md` rev 9 (FR-21, FR-22, FR-24, NFR-8) → the sprint change proposal. Read the first two; the proposal is history now that both are absorbed.

## Tasks & Acceptance

**Execution:**
- [ ] `package.json` + `pnpm-workspace.yaml` + `tsconfig.base.json` -- scaffold the workspace with the pinned stack -- nothing can be built or tested until `pnpm install` works.
- [ ] `eslint.config.js` + `.dependency-cruiser.cjs` -- encode AD-2's one-way graph -- definition of done item 1 requires `pnpm check` to pass, item 4 concerns the graph.
- [ ] `packages/contracts/package.json` + `tsconfig.json` + `vitest.config.ts` -- the package itself, Zod its only dependency.
- [ ] `packages/contracts/src/modifier-ref.ts` (+ test) -- the union with optional `acceptedTier` on both arms, sibling of the band -- item 1 of the proposal's developer row.
- [ ] `packages/contracts/src/tracked-entry.ts` (+ test) -- entry shape and curation status.
- [ ] `packages/contracts/src/price-observation.ts` (+ test) -- the observation, proven to carry no search identifier.
- [ ] `packages/contracts/src/dataset.ts` (+ test) -- the two attempt-scoped fields, including the stamped-alone case -- item 2.
- [ ] `packages/contracts/src/schema-version.ts` (+ test) -- unknown-major refusal -- item 4 / NFR-8.
- [ ] `packages/contracts/src/index.ts` -- the package's public surface.
- [ ] `docs/stories/deferred-work.md` -- record the deferred key-exclusion requirement so the `core` landing inherits it.

**Acceptance Criteria:**
- Given a clean checkout, when `pnpm install && pnpm check && pnpm test` runs, then all three succeed and no test makes a network call.
- Given any schema in the package, when its type is needed, then the type is `z.infer`red — grep finds no hand-declared parallel interface.
- Given `packages/contracts`, when its dependency graph is cruised, then Zod is its only runtime dependency.
- Given the proposal's developer row, when the suite runs, then items 1, 2 and 4 each have at least one test that fails if violated, and item 3 is recorded as deferred rather than silently dropped.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

**The en-dash is load-bearing.** `"T1–T2"` uses U+2013, confirmed by hex dump (`e2 80 93`). Any test fixture must carry the real en-dash, not a hyphen-minus.

**Forward compatibility over strictness.** Object schemas do not reject unknown keys, because NFR-8 makes minor versions additive and a strict schema would refuse a legitimate minor bump. The guardrail against misplacing `lastSearchId` onto `PriceObservation` is therefore that the field does not *survive* parsing, not that parsing throws.

**Deferred, deliberately:** AD-24's trade-link URL builder (`/trade2/search/:realm/:league/:lastSearchId`, league segment percent-encoded). Only `web` consumes it, so there is no two-spellings risk yet. It belongs in the landing that creates `web`.

## Verification

**Commands:**
- `pnpm install` -- expected: lockfile resolves at the pinned versions.
- `pnpm check` -- expected: typecheck, ESLint and dependency-cruiser all clean.
- `pnpm test` -- expected: all Vitest suites green, zero network.
