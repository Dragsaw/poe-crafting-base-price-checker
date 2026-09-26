# `fixtures/`

Real captured trade-API responses (AD-13, NFR-2). Every offline test path runs
against what lives here, so what lives here has to be what the API actually
returned.

## How a fixture gets here

`pnpm fixtures:record`, invoked by a human, with `POE_SYNC_USER_AGENT` set (see
`.env.example`). The command issues live requests through the one governed trade
client and writes the payloads below. It is referenced by no vitest config and
by no test, and no agent runs it unattended.

Its output is a **diff against the committed files**, and that diff is the whole
point: a patch that changes the shape of a response shows up as a change a human
reviews, rather than as a production incident.

## The rules this directory holds itself to

- **Nobody writes a fixture by hand.** A hand-written mock records what the team
  believes the API returns, not what it returns — and it keeps passing on the
  day the belief becomes wrong.
- **One fixture per distinct shape of interaction**, named for the interaction
  and never for the test that reads it. A second test that needs the same shape
  reads the same file.
- **Remove bulk, never structure.** A field no code uses stays, because the day
  it disappears is a signal. Trimming a 500-entry list to 5 entries is fine;
  deleting the key that held it is not.
- **Every personal identifier is stripped at record time**, not at read time.
  Account names and character names are personal identifiers. The recorder
  replaces the value with `[redacted]` and keeps the key, so the shape survives.
- **UTF-8 without BOM, LF line endings, two-space JSON, trailing newline**
  (Consistency Conventions), so a re-record diffs as changed data rather than as
  reserialisation noise.

## What is recorded today

The leagues endpoint and the four `data/*` endpoints, as `trade-data-*.json`.
Since Story 1.7, also the POST search and its fetch leg for every non-pruned
entry of `data/tracked.json`, in the league `data/config.json` names, as
`trade-search-<digest>.json` and `trade-fetch-<digest>.json`. The search body
is built by the same builder the pricing step sends, and each file is named for
a digest of its own request (method, URL and body), so `pnpm sync:dry` serves
back only the answer to exactly that request. A search that found nothing has
no fetch file.
