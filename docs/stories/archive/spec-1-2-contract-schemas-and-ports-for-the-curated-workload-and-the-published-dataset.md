---
title: 'Story 1.2: Contract schemas and ports for the curated workload and the published dataset'
type: 'feature'
created: '2026-09-20'
status: 'done'
route: 'full'
review_loop_iteration: 0
baseline_commit: '8fd611d2ea687abe6bf0ab07cea90fdf8f7ef86d'
context:
  - '{project-root}/docs/stories/epic-1-context.md'
  - '{project-root}/docs/architecture/architecture-poe-crafting-base-price-checker-2026-09-12/IMPLEMENTATION-NOTES.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `packages/contracts` holds one placeholder export. Every later story in the epic — the trade client, the catalogue, the chunk runner, the dataset — produces or consumes shapes that nothing yet defines, so a producer and a consumer can drift apart while both look correct.

**Approach:** Define each concept that crosses a package boundary exactly once, as a Zod schema in `contracts` with its static type `z.infer`red from it, plus the port interfaces for the four external effects. `contracts` lands alone and first; everything else rebases onto it.

## Boundaries & Constraints

**Always:**
- One Zod schema per concept, defined once, with no parallel type declared beside it. Every exported type is `z.infer`red (AD-3).
- `contracts` declares no workspace dependency. Its only new runtime dependency is `zod` at the Stack-table version, exact.
- `ModifierRef` and `TrackedEntry` are discriminated unions that name their own kind. No component infers a kind from what an entry omits, and an exhaustive `switch` over each type-checks (AD-5).
- `banded` carries both edges always and has no open-top form; `valueless` carries no edges at all and never sentinels. Band edges are `number`, never `integer` (AD-5, Consistency Conventions).
- `acceptedTier` is an optional free string on both arms, unused on `valueless`. Nothing validates it against a band, nothing validates its spelling, and it is never part of a canonical key (AD-5).
- The canonical key follows `IMPLEMENTATION-NOTES.md` §4.1 literally: kind first, declared field order, an affix is always exactly three elements or the literal `null`, and keys compare by UTF-8 code unit (Consistency Conventions).
- `TrackedEntry.status` — `active | pinned | pruned` — is a schema member, not a convention, and a `pruned` entry carries its reason as a free-form string (FR-15, AD-12).
- `CurrencyRate`'s schema description states the orientation: `rate` is divine per one unit of the named currency. Each rate carries its own `league` and `asOf` (AD-20).
- Ports are named `<Thing>Port`. The git port is read-only and carries exactly one operation — the author date of the last commit touching a path (AD-3; AD-12's surviving "commit, pull and push" phrasing is stale against spine revision 18).
- All persisted timestamps are ISO-8601 UTC strings.
- **Decided:** file-envelope schemas carry `schemaVersion` as a semver string and start at `1.0.0`. A consumer compares the major only and refuses an unknown one rather than guessing (NFR-8). Entity schemas that are members of a versioned file do not repeat the field.
- **Decided:** a `pruned` reason is a free string. No enum is invented — the PRD requires only that the reason be carried and shown.
- **Decided:** the dataset entry is declared here, not in Story 1.8. AD-9 pins `lastSearchId`, `lastSearchLeague`, `lastAttemptedAt` and the four Price States to that shape, and none of the eleven named schemas is it. `contracts` lands complete rather than leaving `PriceObservation` beside a hole.
- **Decided:** every file envelope is declared here — `tracked.json`, `currencies.json`, `config.json`, `sync-report.json`, `catalogue/*` and `dataset.json`. One versioning mechanism and one unknown-major refusal, spelled once. Later stories fill the envelopes rather than inventing them. `config.json` carries the active league, `minChunkSearches` and `schemaVersion`, and nothing else (AD-19).
- **Decided:** the tracked-list edit date has a filesystem fallback, and it names its own clock. The git port's author date is read first; where git yields nothing, the filesystem port's last-modified time answers instead. The value is therefore a tagged one — `git-author-date`, `file-modified` or absent — and no consumer may read the timestamp without reading the tag. An unlabelled fallback would let a working-tree mtime pass as a commit date, which is the ambiguity AD-12's *never a placeholder* rule exists to prevent, and the page already names the clock it reads elsewhere (FR-12). **This supersedes AD-12's "a file with no commit history yields no date at all" and its "an uncommitted working-tree edit does not move the date"; the spine needs the matching edit.**
- **Decided:** every port ships a pure in-memory fake beside its interface, in `contracts`. `contracts` has no `node:` types available, which forces the fake to hold state rather than touch a real effect. Stories 1.3 onward can test against a port before its adapter exists.

**Never:**
- No `ModifierWeight`, `CraftRecipe` or `RankedRow` — those three of the eleven belong to Epic 3.
- No validation predicates and no cross-file checks. The five checks and FR-16's overlap rejection are `core`'s, in Epic 3. `contracts` sees one file at a time.
- No adapter implementations. The HTTP adapter is Story 1.3, the filesystem and git adapters are Story 1.8.
- No `data/` file created or edited — each has a single non-agent writer.
- No schema may carry `lastSearchId`, `lastSearchLeague` or `lastAttemptedAt` on `PriceObservation`; those belong to the dataset entry (AD-9, AD-16).
- No `failed push` record in `SyncRunReport` — revision 18 removed every git write, so it cannot arise.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Kind named, not inferred | A `crafted` entry with neither `prefix` nor `suffix` | Parse fails — at least one affix is required | Zod issue naming the entry |
| Raw entry with an affix | A `raw` entry carrying `prefix` | Parse fails — the arm has no affix members | Zod issue on the unknown key |
| Open-top band | `banded` with `valueMin` and no `valueMax` | Parse fails | Zod issue on `valueMax` |
| Valueless with edges | `valueless` carrying `valueMin`/`valueMax` | Parse fails — never sentinel edges | Zod issue on the unknown key |
| Absent vs valueless affix | One entry omits `prefix`; another has a `valueless` prefix | Canonical keys differ — `null` versus `[statId, null, null]` | No error expected |
| Key space collision | A `crafted` and a `raw` entry otherwise alike | Keys differ on the leading kind tag; every `crafted` key sorts before every `raw` key | No error expected |
| Key ordering | Keys differing only by case or accent | Sort by UTF-8 code unit, not locale collation | No error expected |
| Unknown major | A file whose `schemaVersion` is `2.0.0` against an expected `1.x` | The consumer refuses it | Typed refusal naming both versions |
| Known major, newer minor | `1.4.0` against an expected `1.0.0` | Accepted | No error expected |
| Pruned entry | `status: 'pruned'` with no reason | Parse fails — a pruned entry carries its reason | Zod issue on the reason field |
| Edit date from git | The path has commit history | Tagged `git-author-date` with that author date | No error expected |
| Edit date fallback | The path has no commit history, but the file exists | Tagged `file-modified` with the filesystem time | No error expected |
| Edit date absent | Neither a commit nor a readable file | Absent — no timestamp and no placeholder | No error expected |
| Untagged date | A date value constructed without its source tag | Does not type-check; the tag is not optional | Compile-time, not runtime |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/index.ts` — the placeholder to replace. **`CONTRACTS_PLACEHOLDER` is re-exported by `packages/core/src/index.ts` and `packages/sync/src/index.ts`, and asserted by `packages/contracts/src/index.test.ts`** — removing it breaks all three, so retire it together with those call sites or keep it until a real export replaces it there too.
- `packages/contracts/package.json` — no `dependencies` block yet; add `zod` here, exact. `exports` maps types to `dist/index.d.ts` and default to `src/index.ts`, so Vitest runs the source while `tsc -b` type-checks against emitted declarations.
- `packages/contracts/tsconfig.json` — `composite`, `emitDeclarationOnly`, `rootDir: src`. No `types` array, so **no `node:` builtins are available in `contracts`**.
- `tsconfig.base.json` — `verbatimModuleSyntax` and `isolatedModules` are on: every type re-export must be written `export type { … }`. `noUncheckedIndexedAccess` and `noUnusedLocals`/`noUnusedParameters` also bite.
- `packages/contracts/vitest.config.ts` — `include: ['src/**/*.test.ts']`, so new co-located tests are picked up with no config change.
- `eslint.config.mjs` — `tseslint.configs.recommended`, no type-aware rules, no naming convention. `pnpm lint` runs with `--max-warnings=0`.
- `depcruise.rules.mjs` — `no-contracts-to-sibling` forbids any `packages/contracts` → sibling edge, `import type` included. `test/contracts-isolation.test.ts` fails on any `@poe/*` entry in the contracts manifest; a third-party dependency is fine.
- `pnpm-workspace.yaml` — carries `minimumReleaseAgeExclude`; pnpm 12's release-age gate may need an entry for `zod@4.6.5`.
- `docs/architecture/.../IMPLEMENTATION-NOTES.md` §4.1 — the canonical key rule, normative. Read, never edit.
- `docs/architecture/.../ARCHITECTURE-SPINE.md` — AD-3, AD-5, AD-9, AD-12, AD-16, AD-19, AD-20, AD-25 and the Consistency Conventions. Read, never edit.
- `data/weights.json` — the only real data file present. Out of scope; its schema is Epic 3's.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts/package.json` — add `zod` as an exact runtime dependency at the Stack-table version; add a `minimumReleaseAgeExclude` entry in `pnpm-workspace.yaml` only if the install refuses it.
- [x] `packages/contracts/src/schema-version.ts` — the `schemaVersion` semver field and the shared major-compatibility check used by every envelope.
- [x] `packages/contracts/src/base-type.ts`, `item-class.ts` — `BaseType` keyed on the trade API's own `type` string, never re-encoded; `ItemClass` as the pair `(categoryId, className)`, never `className` alone.
- [x] `packages/contracts/src/modifier-ref.ts` — the `banded`/`valueless` union with `acceptedTier` on both arms.
- [x] `packages/contracts/src/tracked-entry.ts` — the `crafted`/`raw` union, `status` with its prune reason, `itemLevelMin`.
- [x] `packages/contracts/src/canonical-key.ts` — serialise a `TrackedEntry` per §4.1, plus the code-unit comparator every tie-break in the system resolves on.
- [x] `packages/contracts/src/price-observation.ts` — league, `observedAt`, the exchange observation used, and the true sample size returned.
- [x] `packages/contracts/src/currency-rate.ts` — with the orientation stated in the schema description; its own `league` and `asOf`.
- [x] `packages/contracts/src/trade-catalogue.ts` — the four catalogue artifacts, with `stats.json`'s `{id, label, entries[]}` category groups flattened rather than assumed flat.
- [x] `packages/contracts/src/sync-run-report.ts` — figures and records typed apart, including the five named pinned-starvation fields.
- [x] `packages/contracts/src/dataset.ts` — the dataset entry: its `PriceObservation` where one exists, its Price State with `not-yet-synced`'s reason enum, and `lastSearchId`/`lastSearchLeague`/`lastAttemptedAt` on the entry rather than on the observation.
- [x] `packages/contracts/src/envelopes.ts` — the six file envelopes, each carrying `schemaVersion` over the entity schemas above.
- [x] `packages/contracts/src/ports/{http,filesystem,git,clock}.ts` — four `<Thing>Port` interfaces; the git port has one read-only operation, and the filesystem port carries a last-modified read beside its other operations.
- [x] `packages/contracts/src/tracked-list-age.ts` — the tagged edit-date value (`git-author-date` | `file-modified` | absent), consumed by `SyncRunReport`'s figure.
- [x] `packages/contracts/src/ports/fakes/*.ts` — one pure in-memory fake per port, holding its state in the closure. No `node:` import anywhere.
- [x] `packages/contracts/src/index.ts` — the barrel; `export type { … }` for every inferred type.
- [x] `packages/contracts/src/*.test.ts` — one co-located suite per module, covering every I/O matrix row.

**Acceptance Criteria:**
- Given each of the eight schemas, when the package is inspected, then each has exactly one Zod schema with no parallel definition anywhere, and every exported type is `z.infer`red from it.
- Given an exhaustive `switch` over `ModifierRef`'s two kinds and over `TrackedEntry`'s two kinds, when `pnpm check` runs, then it type-checks with no default arm.
- Given `pnpm check`, when it runs, then `contracts` still declares no workspace dependency and `no-contracts-to-sibling` reports no violation.
- Given a consumer and a file whose `schemaVersion` major it does not know, when it loads that file, then it refuses with a typed result naming both versions rather than parsing on.
- Given the four external effects this epic touches, when the package is inspected, then each is declared as a `<Thing>Port` interface, each ships an in-memory fake, and the git port exposes exactly one read-only operation.
- Given the tracked-list edit date, when a consumer reads it, then it reads the timestamp and its source tag together, and a timestamp cannot be reached without the tag that says which clock produced it.
- Given a dataset entry, when it is parsed, then its search fields sit on the entry and never on its `PriceObservation`, and a `not-yet-synced` state carries one of the three declared reasons.
- Given `pnpm test`, when it runs, then every I/O matrix row is asserted and the suite reaches no network.

## Implementation Notes

**`zod@4.6.5` installed without a release-age waiver.** `pnpm-workspace.yaml`'s
`minimumReleaseAgeExclude` is untouched — the gate did not refuse the version, and the task's
conditional said to add an entry only if it did.

**Two modules beyond the task list.** `src/primitives.ts` holds the scalars several concepts
share — `IsoTimestampSchema`, `LeagueIdSchema`, `DivineAmountSchema`, `ItemLevelSchema` — because
a second spelling of "an ISO-8601 UTC timestamp" is exactly the drift AD-3 exists to prevent.
`src/test-support.ts` holds one `without(value, key)` helper for the suites; it is deliberately
not re-exported from the barrel.

**The placeholder is retired, with its three call sites.** `CONTRACTS_PLACEHOLDER` is gone;
`packages/core/src/index.ts` and `packages/sync/src/index.ts` now prove their allowed workspace
edge against `INITIAL_SCHEMA_VERSION`, a real export, and both suites assert the new values.

**`resolveTrackedListAge` lives in `contracts` beside the tagged value.** The task named only the
value; the resolver is here because the *Decided* bullet fixes one resolution order (git author
date first, filesystem mtime second, absent third) and two shells spelling it differently is the
divergence the tag exists to prevent. It takes the two ports as arguments and performs no effect
of its own.

**`parseEnvelope` reads the version before it parses the body.** An unknown major is refused
*rather than parsed on*, so the refusal is one version mismatch rather than a pile of shape errors
a reader would go fixing fields over. The refusal names both versions, and a malformed version is
reported apart from an unknown one.

**`requestsBySource` is exhaustive over the three declared sources.** Zod's enum-keyed record
requires every key, so a chunk accounts for all three sources — `catalogue-refresh: 0` on a chunk
that did not refresh — and a fourth source does not parse, which is AD-12's amendment rule
enforced at the schema.

**No predicate beyond the two the I/O matrix fixes.** The *Never* list forbids validation
predicates, so the schemas carry exactly two cross-field rules: a `crafted` entry needs one affix,
and a `pruned` entry needs its reason. `valueMin <= valueMax`, "coverage and its denominator are
omitted together", and the five cross-file checks are all left to `core` in Epic 3.

**Catalogue schemas are loose, everything else is strict.** The four catalogue artifacts are
captured third-party payloads carrying fields this product does not consume, and a strict parse
would refuse a live response over a field GGG added. Every product-owned schema is a
`strictObject`, which is what turns "a raw entry carries no affix members" and "a
`PriceObservation` carries no search field" into parse failures rather than conventions.

**Four record kinds in `SyncRunReport`, per the Conventions *Logging* enumeration** —
`stale-lock-broken`, pinned-starvation, `unresolvable` and a cross-file gate failure. No
`failed push`. AD-12's *record the absence of `weights.json`* and AD-9's uncatalogued-weights-id
report have no record kind yet; Story 1.9 either maps them onto these four or the Conventions
list gains a member, and that is a decision for the story that has the payload in front of it.

**Spine edits this story's *Decided* bullets require, not made here.** The tagged tracked-list
edit date supersedes AD-12's "a file with no commit history yields no date at all" and its "an
uncommitted working-tree edit does not move the date"; AD-12's surviving "commit, pull and push"
phrasing is stale against revision 18. Both are spine edits, and `contracts` is the wrong
document to make them in.

**Verification run 2026-09-20:** `pnpm install` (zod 4.6.5, exact, no prompt), `pnpm check`
(typecheck, lint, depcruise — 57 modules, 113 dependencies, zero violations), `pnpm test`
(24 files, 127 tests after the review patches, no network). The `@ts-expect-error` in `tracked-list-age.test.ts` is
load-bearing: `tsc -b` compiles the suites, so an untagged date that started type-checking would
fail `pnpm check` on the unused directive.

## Spec Change Log

## Review Triage Log

Iteration 1 — blind-hunter, edge-case-hunter, verification-gap.

| Verdict | Finding | Evidence | Route |
|---|---|---|---|
| medium | Catalogue schemas use `z.object`, which **strips** unknown keys | Probed against zod 4.6.5: `z.object` drops `label`/`icon` on parse, `z.looseObject` keeps them. The module's own docstring says a refresh diff must stay a diff of the API's own response, and the "tolerates fields" test only asserts a known field survives. | patch |
| medium | `DivineAmountSchema` is a bare `z.number()` | `currencies.json` is hand-maintained; a typed `0` or `-0.0042` parses and silently zeroes or inverts every normalised price and every crafted EV. Nothing downstream can detect it — `currency-rate.ts`'s own docstring says so. | patch |
| medium | Five of the nine envelopes are never parsed by a test | `CurrenciesFile`, `SyncReportFile` and three catalogue envelopes appear only in a `schemaVersion`-key loop and a `toBeDefined()` list; the body could be mis-bound and the suite stays green. | patch |
| medium | Arm schemas exported from the barrel bypass the union's `superRefine` | `CraftedTrackedEntrySchema` parses a crafted entry with no affix, and either arm parses `status: 'pruned'` with no reason — the two matrix rows that must fail. | patch |
| low | `checkSchemaVersion`'s `malformed` is re-spelled `malformed-version` by a ternary | `envelopes.ts` maps any non-`unknown-major` reason onto `malformed-version` with no compile error, so a third reason would be silently mislabelled. | patch |
| low | `bmp` in `canonical-key.test.ts` is a literal U+FFFD | `cat -A` shows `M-oM-?M-=`. The assertion is correct today but the glyph is indistinguishable from encoding damage; the astral side is already escaped. | patch |
| low | `raw` fixture uses `baseTypeId: 'weapon.bow'` | A category id in a base-type field, which `item-class.ts` explicitly forbids; `tracked-entry.test.ts` uses a real base type. | patch |
| low | `index.test.ts` says "the six file envelopes" over a list of nine plus `parseEnvelope` | The spec's six are files (`catalogue/*` is one); the test title counts schemas. Title is simply wrong. | patch |
| low | `SYNC_CONTRACTS_ROOT` now holds a schema version | The constant proved the barrel's root export resolved; it now names a version, so the name states a fact that is no longer true. | patch |
| low | Implementation Notes say "exactly two cross-field rules"; `superRefine` has three | The third (a reason only on a pruned entry) is real and tested; only the count is wrong. Fix is a spec edit. | rejected |
| low | Tests assert `INITIAL_SCHEMA_VERSION` where they mean `SUPPORTED_SCHEMA_VERSION` | The two are aliases today and the refusal's `expected` is documented as the supported version; no behaviour change, and the drift is hypothetical. | rejected |
| low | `parseEnvelope` reports a non-string `schemaVersion` as `invalid`, not `malformed-version` | The refusal still names `schemaVersion` in its issues, the case needs a hand-broken file, and the fix adds a branch. | rejected |
| low | `parseEnvelope`'s `expected` is an unvalidated `string` | Caller-side only; every in-repo call uses the default. The fix adds a guard for a situation not shown reachable. | rejected |
| low | `compareByCodeUnit` compares code points, not code units | The name mirrors the Consistency Conventions wording the spec cites; the implementation and its docstring already state that UTF-8 byte order is code-point order. | rejected |
| low | `compareCanonicalKeys` is a bare alias of `compareByCodeUnit` | Two names, one behaviour — but the alias is the documented public spelling and the comparator is the primitive. Cosmetic. | rejected |
| low | `FakeHttpPort.requests` hands out the live array | Test-only surface; a test mutating its own recorded history harms nobody. | rejected |
| low | Fake filesystem `writeTextFile` does not advance `modifiedAt` | Real asymmetry, but `FakeFile` documents "omitted means no readable modification time" and `setFile` is the sanctioned way to stamp one. A clock inside the fake would add surface and break the passed-in-time rule (AD-1). | rejected |
| low | `PriceObservation` carries no original listed amount and currency | An addition beyond the fields the task enumerates, argued for auditability. Belongs to the story that computes the median (1.7), not to this one. | rejected |
| low | `AcceptedTierSchema` has no `.min(1)` | The spec says `acceptedTier` is a free string nothing validates; an empty one is a free string. | rejected |
| low | `IsoTimestampSchema` accepts both `…:00Z` and `…:00.000Z` | ISO-8601 UTC is what the spec requires; pinning one sub-second spelling is tightening beyond it. | rejected |
| low | `filterOptionIds` conflates "filter absent" with "filter has no options", and concatenates duplicate ids | A GGG rename would surface as every `categoryId` unknown rather than a named catalogue failure — a Story 1.4/1.9 reporting concern, not a contract defect. | rejected |
| low | `resolveTrackedListAge` does not validate the port's timestamp | The `GitPort` and `FilesystemPort` docstrings make ISO-8601 UTC the adapter's obligation; `contracts` trusting its own port contract is the design. | rejected |
| low | Code Map's reason for "no `node:` builtins" is inverted | Verified the conclusion holds (`node:fs` fails typecheck with TS2591); only the stated reason is wrong, and the fix is a spec edit. | rejected |
| false | Spec says `in-review` while `sprint-status.yaml` says `in-progress` | Not a defect in the change: the build workflow moves sprint-status to `review` at presentation, after this review step. | rejected |
| false | `ItemClassSchema` is exported but unused; the crafted arm inlines the pair | §4.1 fixes the canonical key as flat declared fields, so the crafted arm must carry `categoryId` and `className` directly; both spellings share `CategoryIdSchema`/`ClassNameSchema`, so there is no second source of truth. | rejected |

## Design Notes

**Why the canonical key is `contracts`' and not `core`'s.** Every tie-break in the system — the refresh rotation, the ranking's summands, the cross-file failure payloads that name an entry — resolves on this one serialisation. It has to exist before the first consumer, or two consumers will spell it differently and both will look right.

**Why the edit date is tagged rather than merely present.** Two clocks now answer the same question, and they mean different things: a commit date is a published edit, a file mtime is an edit that may never have been committed. The two are indistinguishable once flattened to a bare timestamp, and the trust strip's whole job is telling the player how much to trust what he is reading. Making the tag non-optional in the type is what stops a later consumer from quietly dropping it.

**The three affix forms are the point of §4.1.** An absent affix and a `valueless` affix are different facts about a tracked entry, and a schema that lets them serialise alike silently merges two entries the player wrote separately. Hence `null` versus `[statId, null, null]`, and hence the matrix row.

## Verification

**Commands:**
- `pnpm install` — expected: `zod` resolves at the pinned version, exact, with no credential prompt
- `pnpm check` — expected: typecheck, lint and depcruise all pass, zero violations
- `pnpm test` — expected: the contracts suite plus the existing root guards pass, no network call
- `git status` after both — expected: clean
