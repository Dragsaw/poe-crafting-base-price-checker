# Review: research.md — POESESSID vs OAuth for trade API rate limits (2026-10-02)

- **Content:** `docs/research/technical-poesessid-vs-oauth-for-trade-api-rate-li-2026-10-02/research.md` (docs)
- **Lenses:** structure, then prose (prose on top of the structure findings)
- **Invoked by:** bmad-deep-recon finalize (`doc_standards`)
- **Outcome:** the caller applied every finding in this file to `research.md` unless the row says otherwise.

## Structure

| Location | Finding | Fix | Outcome |
|---|---|---|---|
| Executive summary, item 2 | The policy evidence is only in the summary, and no body section gives it | Move it to a new body section *Policy and terms*. Condense item 2 to the conclusion | Applied |
| Executive summary, item 3 | Repeats the evidence trail from the body | Condense it to the verdict | Applied |
| Executive summary, item 1 | "Hard gates" is used before the matrix defines it | Name the gates inline | Applied |
| Cloudflare bullet | Belongs with enforcement, not with the auth routes | Move it to *Implementation reality* | Applied |
| Import-matrix-errors paragraph | Audits the import, which does not help the decision | Condense to one sentence that points at [27] | Applied |
| Decision matrix heading | It is a synthesis, but it sits among the dimensions | Add a one-line lead-in | Applied |
| Staleness closing paragraph | The dates that decide whether the report is still valid appear only at the end | Move them into *Biggest caveat* | Applied |
| "Earliest re-check date" sentence | Repeats the table and leads to no action | Cut it | Applied |
| Frontmatter `claims_tally` | Contains process narrative | Condense to counts | Applied |
| Recommendation 5 | No body finding supports it | Add a User-Agent bullet to the body | Applied |
| Decision line, verdict restatements, cross-dimension bullet 3, source appendix | Look cuttable | Preserve them | Preserved |

## Prose

| Location | Finding | Fix | Outcome |
|---|---|---|---|
| Throughout | "budget", "limit", "allowance" and "bucket" name one thing. "Local" and "loopback" redirect name one thing | Use **budget**, **rule**, **session cookie** and **loopback redirect** | Applied in the body. "Rate limit" is kept where it names the API feature or the topic |
| Confidence tags | Several forms | Use the form "**Status: …. Confidence: ….**" | Applied |
| POESESSID bullet | Opposite tags stand next to each other | Put the tag first and state the gap plainly | Applied |
| Quotes | Double periods (`." [1].`) | End the sentence once | Applied |
| "overturned" | Passive, and the agent is not clear | "The verification overturned …" | Applied |
| "GGG says it haven't" | The pronoun does not agree with the verb | "GGG said that they …" | Applied (moved to *Policy and terms*) |
| Shared budget | "therefore" comes after the PoE1 note | Reorder the sentences. Add the serial comma | Applied |
| Acronyms | GGG, ABE, APT, EE2, ToS and PKCE are not defined | Spell each one out at first use | Applied in the body. The appendix keeps the short forms |
| Units | "10 h", "7 d", "6 s" | Spell out the units | Applied in running text |
| Rate notation | "4 per 6 s" and "4/6s" are both used | Use one form | Applied. Prose uses "4 per 6 seconds". Header values keep "4/6s" |
| Gate conditions | Not clear whether one or both conditions are needed | "only when both conditions are true" | Applied |
| Jargon | "reduces to", "costs minutes", "again and again", "No fix is recorded", "dies", "blacklisted", "Malware-shaped", "Heavy", "compound", "Re-weight freely", "burst", "moot" | Replace each with plain words | Applied |
| CAPTCHA workaround | "a CAPTCHA … or a new IP" | "solve a CAPTCHA … or change the IP address" | Applied |
| Log-out wording | Microsoft style uses "sign in" and "sign out" | Use those terms | Applied. The quoted feature name in recommendation 4 is kept |
| Staleness windows | The sentence is a fragment | Rewrite it as two sentences | Applied |
| Refresh-date sentence | The condition comes last | Put the condition first | Applied (moved to the summary) |
| H1 | Not in sentence case, and uses "vs" | "Technical research: … versus …" | Applied (H1 and frontmatter title) |
| Recommendation 5 | Wording is unclear, and it has no target label | Reword it and add "Architecture spine:" | Applied |
| Minor | "Pub date" header, "plain-HTTP" hyphenation, "Few endpoints" | "Published", "plain HTTP", "Only a few" | Applied |
