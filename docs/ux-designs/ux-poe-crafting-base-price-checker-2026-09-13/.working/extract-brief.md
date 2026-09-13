# Brief extract for UX design

Sources:
- `docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/brief.md`
- `docs/briefs/brief-poe-crafting-base-price-checker-2026-09-12/addendum.md`

Extraction only — nothing below is designed or inferred.

## 1. Voice and framing

The brief speaks plainly, in the voice of a player, about a chore it wants
removed. Tone-carrying phrasings:

- "It is also gated behind memory."
- "That apprenticeship takes weeks, and it resets every league."
- "This tool replaces the memorization with a ranked list."
- "a short ordered list of what to chase"
- "The ranking is not 'most expensive base.' It is expected payout per craft."
- "pick up bases while mapping, apply a transmute and an augment, sell the winners."
- "It is destroyed by every league start — three to four times a year — at
  precisely the moment the information is worth the most."
- "This section is the product; everything else is presentation." (on value estimation)
- "The product answers exactly one decision: **is this base worth picking up?**"
- "that call stays with the player, who can already tell that an
  increased-stun-threshold roll is dead without being told."
- "The threshold is the dial that decides everything."
- "It is built for its author, published openly but unadvertised."
- "Secondarily, the friends he shares the link with, and anyone who happens to
  find it — welcome, but not courted."
- "This freedom is load-bearing: it is why the tool can assume one player's
  thresholds, one player's playstyle, and one player's judgment about when to
  trust it."
- "A stale top five that the user trusts is worse than no tool." (addendum)
- "the memorization goes away and the ranked list becomes the thing consulted
  before every session — a live read on which corner of the economy is worth
  farming this week rather than a fact learned last month."
- "The web view is the permanent product, not a stepping stone to the filter."

Note the brief consistently says **"the player"** and **"he"/"his"** — a single,
named-in-the-abstract person, not "users".

## 2. The player

- **Who:** the author himself, "primarily and by design". Then "the friends he
  shares the link with, and anyone who happens to find it". No growth goal, no
  monetization, no advertising. Single-user: "Accounts, sharing, per-user saved
  preferences, anything multi-user" are explicitly out.
- **Skill/stage:** targets **late endgame** ("crafts on everything picked up"),
  chosen "on the judgment that its value transfers downward to early play while
  the reverse is not true". Early endgame "triages before crafting, since perfect
  transmutes and augments are expensive relative to a small currency pool".
- **When and where used:** "read before a play session, or whenever the economy
  is worth a look"; "ready before a session begins and never blocks on a live API
  call"; "the ranked list becomes the thing consulted before every session".
  Contrast with the in-session decision: the augment call is "made dozens of times
  per session, far more often than the once-per-session read of the ranked list".
- **State of mind / constraint:** "The user's binding constraint is his own time
  — he would rather play than craft." Outcomes of 1–2 exalts "are worth nothing to
  him, because he would find that much currency simply playing."
- **Pace of the underlying loop:** "roughly twelve bases per five-minute map, the
  loop generates around 144 decisions an hour" — but the tool is read outside that
  loop, not during it.
- **Threshold by stage:** "~0.25 divine in early endgame, ≥1 divine once richer
  and stronger"; it "drifts upward through a league".
- **Explicit trust behavior wanted:** "The player stops opening the trade site
  mid-session." / "The player stops keeping a top-five list in his head."

## 3. Qualitative and aesthetic statements

Aesthetics are actively deprioritized, twice, in near-identical words:

- Out of scope: "Visual design beyond what an off-the-shelf framework provides."
- Development constraint: "**An existing UI framework or design system.**
  Appearance is explicitly not a priority."

No mood, reference, or "should feel like X" statement appears anywhere in either
document. No comparison of look-and-feel to another tool.

Frustration with existing tools (functional, not aesthetic):

- "the only ways to get that knowledge are to check the trade site item by item
  — which cannot be done at the pace the game produces items — or to memorize."
- On prior art: "**poe2scout** was evaluated as prior art and found not to
  overlap … It carries nothing on magic base prices by modifier combination. No
  reuse available; no competitive overlap."
- "**pathofcrafting.net** was raised and struck — its attribution page returns
  404 and its game coverage could not be confirmed."

The only display-shaping demands in the documents are **epistemic honesty**
demands, not style demands:

- "the interface must distinguish a ranking built on measured weights from one
  resting on the placeholder."
- "Until real weights are in hand the tool ranks on a uniform prior — a genuine
  approximation, and one to label wherever it drives a number on screen."
- "**Partial coverage must be visible.** Weight coverage will be uneven — some
  bases measured, others defaulted, others absent. A ranking resting on real
  weights and one resting on the uniform placeholder must not render identically,
  or a placeholder will quietly be trusted months later with nothing to reveal it."
- "Segregating unknowns keeps them out of the ranking" (zero-listing combinations).

## 4. Scope statements

**In for v1** (verbatim list):

- "Magic bases — one prefix, one suffix — at endgame item levels."
- "White bases at item level 82 only, the one case where selling the raw base may
  beat crafting on it."
- "Ranked base list with chase modifiers, expandable to full tracked combinations."
- "Player-set payout threshold."
- "Background sync against the official trade API, rate-limit aware."
- "Curation controls: prune junk combinations, pin ones to watch."
- "A defined weights-file schema, and a uniform-prior file satisfying it."

**Explicitly out:**

- "Producing modifier weight data — the scraper that harvests it is a separate
  project."
- "Loot filter export."
- "Advice on whether to augment an item already in hand."
- "Rare items."
- "Accounts, sharing, per-user saved preferences, anything multi-user."
- "Visual design beyond what an off-the-shelf framework provides."

**Other scope facts bearing on the UI:**

- "**The ranked unit is a base paired with a crafting recipe**, not a base alone"
  — perfect vs greater transmute/augment "produce different tier distributions at
  different costs", so "the same base can win under one recipe and lose under
  another". Budget headroom is reserved for "a second recipe".
- Tracked combinations are restricted to "modifier tiers 1 and 2"; "The user adds
  such combinations by exception when he notices them. The restriction governs the
  default, not the ceiling."
- Ranking metric: "For each base, sum `P(combination) × price(combination)`
  across only those combinations at or above the threshold, then subtract the full
  cost of the craft, paid on every attempt including the failures."
- Prices "Refreshed daily"; addendum's estimator says "Cheapest ~10 live
  listings, instant-buyout only, refreshed every few hours". A full refresh takes
  "roughly fifteen hours" — so the list is continuously partly stale.
- "Variance was considered and dismissed … there is no need to rank on median or
  to expose a risk preference." (no risk control in the UI)
- "**Sell-through speed was considered and rejected** as a ranking term. The user
  was explicit that sell speed is not a factor."
- "**Coarser fallback pricing** … Not adopted; retained as an option if the
  unknown bucket proves unusable."
- Success is "Behavioral, not numeric" — the four criteria in §2 above.

**Things the brief wanted that a PRD may sand off:**

- The list "needs periodic deliberate review rather than running unattended" —
  a recurring human task the interface has to support or at least prompt.
- Curation is framed as an ongoing operating discipline, not a settings screen:
  "Discipline about what is tracked is a permanent operating requirement, not a
  one-time tuning exercise."
- The uniform-prior labeling requirement (§3) is stated three separate times.

## 5. Game context (PoE2)

- **The loop being supported:** "pick up bases while mapping, apply a transmute
  and an augment, sell the winners"; "~12 bases per 5-minute map (~144/hour)".
- **The two-stage craft:** "perfect transmute everything picked up, evaluate,
  then perfect augment only the promising items." The second decision is
  "deliberately excluded" from v1 but is "the strongest candidate for v2".
- **Currency vocabulary the UI will speak:** exalts and divines; "roughly a
  quarter of a divine in early endgame, a divine or more once the player is richer
  and stronger"; "a T3 roll worth two divine this league"; "outcomes of 1–2 exalts
  are worth nothing to him". Craft currencies: transmute and augment, in
  "perfect" and "greater" variants. "currency prices move during a league."
- **Item vocabulary:** magic items = "one prefix, one suffix"; white bases at
  item level 82; base types (~250 endgame-relevant); modifier tiers 1–2;
  "an increased-stun-threshold roll" as the archetypal dead modifier; wands carry
  "11 prefixes and 18 suffixes".
- **What the player looks at alongside the tool:** the official trade site
  (the behavior to displace: "The player stops opening the trade site
  mid-session"), and the game itself while mapping.
- **Trade mechanics:** "**PoE2 asynchronous trade** (Merchant Tabs, the NPC Ange,
  buyers paying listed price plus a gold fee, sellers transacting while offline)
  is what makes instant-buyout filtering meaningful."
- **Leagues:** "Three to four league resets a year wipe prices entirely"; active
  league at verification was "`Forbidden Rites`"; "The tool is least useful at
  league start, which is when the knowledge is worth the most."
- **Community tools named:** official trade API / trade site; poe2scout
  (currency rates, volume, uniques, price history, unique base data — no overlap);
  poe2db.tw (weights embedded in page scripts, per category page, e.g.
  `poe2db.tw/us/Bows`); Craft of Exile (`craftofexile.com/weightings?game=poe2`);
  RePoE fork (`repoe-fork.github.io/poe2/`, v4.5.5.2, weights all 1);
  pathofcrafting.net (struck); Prohibited Library Discord and Krakenbul
  (recombinator-derived weights); GGG's request that third-party tools send
  a descriptive `User-Agent` of the form `tool-name, contact@email`.
- **In-game filter ceiling:** "PoE2's item filter syntax has no working
  equivalent of PoE1's `HasExplicitMod`" — a generated filter "can express base
  type, item level and rarity, but never modifier combinations", so "the modifier
  knowledge stays in the web view."

## 6. Qualitative ideas at risk of being lost

Soft wants and asides that no scoped requirement captures:

- **"A stale top five that the user trusts is worse than no tool."** A statement
  about trust and staleness with no requirement attached — freshness has to be
  legible, not merely tracked.
- **Meta blindness as a standing, unsolved gap:** "The tool cannot discover what
  it is not told to watch … a combination that becomes valuable mid-league … stays
  invisible until he notices it himself." The mitigation named is "periodic
  deliberate review", which is a human ritual with no home in the scope list.
- **Cold start:** "seeding the list requires the knowledge the app exists to
  supply." Worst exactly at league start.
- **The tool never observes a sale:** "Listings are supply, not demand. Every
  price in the system is what someone is asking, filtered to be plausible. No sale
  is ever observed. The manual loop has a correction the tool does not: the player
  actually sells things and finds out." Nothing in scope closes this loop.
- **Zero-listing combinations are ambiguous by nature:** "either a jackpot or
  junk, and listings cannot distinguish them" — segregated, not resolved.
- **Imported weights inherit a bias:** "any imported weight carries the same
  listing bias this tool is already exposed to."
- **Off-tier exceptions:** "a T3 roll worth two divine this league is invisible
  to a tier-restricted tracked list, and … nothing in the system will surface it.
  The user adds such combinations by exception when he notices them."
- **The refresh is long and partial:** ~15 hours wall clock, "multi-hour,
  multi-chunk", "nothing is on a user-facing path" — but it means rows have
  different ages at any given moment.
- **The threshold reorders everything:** "A base with one jackpot combination and
  a base with many moderate ones swap places as it moves" — the aside that gives
  the control its drama.
- **v2 wishes named but not designed:** re-seeding from community sources
  (spawn weights for rarity, build-popularity for demand); the augment decision;
  loot filter export; polling to watch listings disappear ("the only approach that
  improves the longer the tool runs"); in-house weights derived from the tool's
  own accumulated pricing output.
- **The ambition, stated and then bounded:** "The 'eventually I won't have to
  memorize anything' outcome is not achievable."
