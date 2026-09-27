# Adversarial review — spine revision 23 (Provenance and the not-in-game tier)

- **Subject:** the uncommitted diff of `ARCHITECTURE-SPINE.md` revision 22 to 23. AD-10 maps
  `weightSource: "not-in-game"` to Provenance `measured` and adds the "input, never skipped"
  paragraph. AD-11 cites `WEIGHTS-FILE-SCHEMA.md` `6.1.0`, and the diagram and Structural Seed
  follow.
- **Lens:** build two units, one level down. Each unit obeys every AD to the letter, and the
  two still build incompatibly. The scope is Provenance and the not-in-game tier.
- **Read:** AD-10, AD-11, AD-17 and AD-27 in full. `IMPLEMENTATION-NOTES.md` §1, §2.2–§2.5, §3,
  §9 and §11. `WEIGHTS-FILE-SCHEMA.md` `6.1.0`, *pool-completeness* and *Validation*.
  `docs/epics.md` (the Provenance line of the requirements inventory, Stories 3.1 and 3.6).
  `packages/core/src/probability.ts` and its tests.
- **Measured against the committed `data/weights.json` (`6.1.0`, 2026-09-27):** 6,434
  `published` entries, 1,995 `absent` entries, 8 `not-in-game` entries and 0 `partial` pools.
  The 8 not-in-game tiers are all jewel tiers at `itemLevelMin` 1. Each has one
  `statId: null` line, and each sits in a pool that also holds 28 to 89 positive-weight
  entries. 24 of the 59 classes carry at least one `absent` tier. 8 of those 24 carry them in
  one slot only.

## Verdict: **not closed**

The mapping itself is sound. A weight-0 entry adds nothing to any numerator or denominator, so
`measured` changes no figure. It only stops the fold from degrading 8 jewel classes to
`uniform-prior` for a tier that can never be drawn. The row-2 edit and the "must not map it to
`uniform-prior`" sentence close the clash they target: one builder maps the tier to
`uniform-prior` and another maps it to `measured`.

The revision does not close the hole next to it. It restates that the fold runs over "the
scoped pool". The spine has three candidate sets for that phrase, and on today's file they
give different labels. The revision also gives weight-0 tiers a firmer place "like any other
entry" in the pool. It does not say what that means for the checks that count entries rather
than weights.

## Findings

### F1 — high — The fold's domain has three readings, and the readings disagree on today's file

**Unit A (Story 3.6, reading AD-10 literally):** folds Provenance over
`scoped(cat, slot, L)`. AD-10 says "every entry in its scoped pool", and rev 23 repeats "the
tier stays in the scoped pool … so it enters the fold".

**Unit B (Story 3.6, reading "a probability's inputs"):** folds over what the figure rests on.
That is `eligible(entry, recipe)` of §9, which is the set `probability.ts` `eligible()` returns
and `affixProbability` and `combinationProbability` sum. The unit can use `E_P ∪ E_S`, because
§11's `P(p ∧ s)` divides by `W_P + W_S`. Or the unit can use only the referenced slot's set,
because AD-10 was written against a per-slot `P(ref | cat, slot, L)`.

Both units obey AD-10, §9, §11 and Story 3.6. On the committed file they diverge:

- **Recipe floor.** 8 classes carry `absent` tiers only below item level 44, and 12 carry them
  only below 70. A greater-orb or perfect-orb row on such a class reads `uniform-prior` under
  A. It reads `measured` under B, because the recipe truncates every invented tier out of the
  set the probability divides by. Story 3.6's "one label per Item Class" then holds under A
  and fails under B, because B's label depends on the recipe.
- **Slot.** 8 classes carry `absent` tiers in exactly one slot. A per-slot fold and a
  both-slot fold give a combination on those classes different labels.

The two-treatment render in `web` makes the difference visible on the primary screen. A row is
plain in one build and degraded in the other. AD-10's own paragraph, "under `5.0.0` a
`weightSource: "absent"` tier weakens the denominator in fact", argues for B, because a
truncated tier is in no denominator. The rev-23 sentence, however, restates A.

**Fix:** State in AD-10 that a probability's Provenance folds over exactly the entries its
§9/§11 formula sums — `E_P ∪ E_S` after scope and recipe truncation, for the pair being valued
— and correct Story 3.6's "one label per Item Class" to "per `(itemClass, recipe)` row".

### F2 — medium — "Empty" is counted in entries in three places and in weight in the code, and not-in-game tiers make the two readings differ

Four places decide emptiness, and they measure it two ways:

- §3's `covered` requires that "neither slot's pool is empty".
- AD-17's third cause is "a pool … declaring `complete` over **no entries at all**".
- §9 says "an empty `eligible` set is a reason", and then says "`W` is `0`" as if the two were
  the same fact.
- `probability.ts` keys `empty-eligible-pool` on `total === 0`, which is weight and not entry
  count (`affixProbability` and `combinationProbability`).

Rev 23 establishes a pool that is non-empty by count and has `W = 0`. A slot, or a slot after
truncation, can hold only `not-in-game` tiers or published `0` tiers. For such a pool:

- **Unit A (sync, §3):** counts the class as `covered`, because the pool is not empty by count.
  Coverage then includes a class that AD-17 cannot rank under any recipe.
- **Unit B (core, AD-17 third cause, reading by count):** does not reach the third cause,
  falls through to §9, and reports an `empty-eligible-pool` pair reason for each recipe.
- **Unit C (core, reading "no entries" as "no drawable entries"):** reports the class-level
  third cause.

B and C put different reasons in the appendix, one per recipe against one per class. The
Provenance of the resulting unrankable row is also undecided. Story 3.6 puts Provenance in the
appendix ("`absent` is exercised only inside the appendix"). Under AD-10 as amended, a
not-in-game-only pool folds to `measured`, and a `measured` mark on an unrankable row is a
fourth appendix shape that no UX state names.

This shape does not occur on today's file: every not-in-game pool holds positive tiers, and
any recipe floor above 1 removes the jewel tiers on both sides together. The shape is legal,
and rev 23 is what makes it expressible as a routine input.

**Fix:** Define emptiness once, as `W = 0` (the sum of weights), in §3's `covered`, AD-17's
third cause and §9. State that an unrankable row carries no Provenance mark, or say which one
it carries.

### F3 — medium — A not-in-game tier with a resolved `statId` changes edge alignment and the empty-containment check, and "like any other entry" says it should

`WEIGHTS-FILE-SCHEMA.md` `6.1.0` says that a `null` line in a `complete` pool is either
not-in-game or internal. It does **not** say that a not-in-game entry's lines must be `null`.
The hard-error list has no such rule. `probability.test.ts` ("skips a weight-0 first draw …")
already builds a not-in-game tier with a resolved `statId`, and `contains()` matches it.

Suppose a future file publishes a not-in-game tier on a resolved `statId`. A tracked band then
meets two builders:

- **Unit A (Story 3.3, rev 23's "stays in the scoped pool like any other entry", "must not
  skip it"):** keeps the tier in `contained(ref)`. §2.4's extremes then include an interval
  that can never roll, and a band written to the drawable tiers fails alignment. A band that
  contains **only** the not-in-game tier passes §2.5, because the set is non-empty, and yields
  `P = 0` exactly. That ranks the pair at `−craftCost`, which is the "bad craft rather than an
  impossible one" outcome that §2.5 and §9 exist to prevent. §2.3's universal kind check also
  reads the undrawable line.
- **Unit B (Story 3.3, reading the schema's "can never be drawn"):** drops weight-0 tiers from
  `contained()` for §2.3, §2.4 and §2.5, and gives the opposite verdicts.

Published `weight: 0` has the same shape, and rev 23 explicitly calls the two "the same kind
of fact". Today's file carries 0 published zeros and 8 null-line not-in-game tiers, so the
hole is latent.

**Fix:** Either add a `6.1.x` hard error that every line of a `not-in-game` entry has
`statId: null`, or state in AD-17 whether a weight-0 entry is a member of `contained(ref)` for
§2.3–§2.5.

### F4 — medium — "From `weightSource` and nothing else" contradicts AD-10's own table, and row 1 has an undefined source

The requirements inventory of `docs/epics.md` ("It derives from `weightSource` and from
nothing else") and Story 3.6 ("it comes from the Weights File's own `weightSource`, and from
nothing else") state a source-of-truth rule. AD-10's table has two sources that are not
`weightSource`:

- rank 0 comes from `poolCoverage: "partial"`.
- rank 1 also arises from "**a bootstrap file**". No document defines that term.

Two builders result:

- **Unit A (Story 3.6 literal):** derives Provenance from `weightSource` alone, so a `partial`
  pool never yields `absent`.
- **Unit B (AD-10 row 1 literal):** needs a bootstrap-file detector. The only available
  heuristic is "every `weight: 1`", and that infers Provenance from the value. The schema
  forbids that for `weightSource` itself ("never inferred from the value").

Rev 23 edited row 2 of this table and left row 1's undefined source beside it.

**Fix:** Delete "or a bootstrap file" from AD-10 row 1, or define it as "a file whose entries
carry `weightSource: "absent"`". Correct the two `epics.md` sentences to cite AD-10's table
rather than restate a narrower rule.

### F5 — low — "Must not skip it" has no scope and can be read against §11's weight-0 guard

Rev 23 says "`core` must not skip it as a non-input". §11 guards exhaustion only "under a
positive weight". `orderedTerm` in `probability.ts` implements that guard with
`if (entry.weight === 0) continue;`, and a test pins it. A second builder can read the
unqualified sentence as a ban on skipping a not-in-game first draw anywhere in `core`. That
builder then returns `augment-exhausted` for a tier that can never be drawn, and the pair
becomes unrankable when it should not.

**Fix:** Scope the sentence to the Provenance fold ("must not skip it **in the fold**"), and
cite §11's positive-weight guard as the one place where a weight-0 entry is passed over.

### F6 — low — The rationale misstates the schema

Rev 23 calls the not-in-game `0` "the producer's stated fact … the same kind of fact as a
published `0`". `WEIGHTS-FILE-SCHEMA.md` `6.1.0` calls it the **one exception** to publishing
`DropChance` verbatim, taken from a hand-kept list that overrides whatever poe2db published.
So it is a producer assertion and not a measurement, which is what `measured`'s "Means" column
names. The decision stands on a different ground: a weight of 0 contributes nothing to any
sum, so its label cannot change any figure.

**Fix:** Replace the "same kind of fact" clause with "its weight contributes to no sum, so it
cannot weaken what any figure rests on".

### F7 — low — Stale `6.0.0` citations remain beside the new pin

AD-11 still says "The producer-6.0.0 file of 2026-09-26 satisfies the contract". The committed
file is the `6.1.0` file of 2026-09-27. Story 3.1's AC in `docs/epics.md` (line 1704) still
says it "accepts a file conforming to … `6.0.0`". A builder who conforms to that AC alone
refuses the committed file under the schema's own statement that a `6.0.0`-only reader
rejects `not-in-game`.

**Fix:** Retarget AD-11's verification sentence to the `6.1.0` file of 2026-09-27, and sweep
Story 3.1's AC to cite AD-11 rather than a version literal.

## Angles checked and found closed

- **The `null`-`statId` line against `partial` and coverage.** AD-11 ("never a reason to
  declare a pool `partial`"), AD-27 and §3 ("an unresolved stat line does not affect
  coverage") agree with `6.1.0`. `core` cannot distinguish an internal line from an
  unresolved one, but it never needs to, because `partial` is read from the producer's
  declaration.
- **"Stays in the scoped pool" against §9 `eligible()`.** There is no clash in the
  arithmetic. A weight-0 tier changes no `W` and no numerator whether it is kept or truncated,
  so §9 and §11 give the same `P` under both readings. The clash is in the Provenance fold's
  domain (F1) and in emptiness (F2), not in the value.
- **Two render treatments in `web`.** Mapping not-in-game to `measured` adds no third
  treatment, and `web` never prints `weightSource`'s words.
