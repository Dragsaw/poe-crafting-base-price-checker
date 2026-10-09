# Review — spine revision 24, verification lens

- **Target:** `ARCHITECTURE-SPINE.md` revision 24 (new AD-30, amendments to AD-8, AD-9 and AD-12,
  Conventions, Deployment, Deferred) and `IMPLEMENTATION-NOTES.md` §13. Working-tree diff
  against `fa1a1a8`.
- **Lens:** each external fact that AD-30 and §13 rely on is web-researched or reality-checked,
  not asserted from training data. No library or version is bound in this change.
- **Evidence base:** `docs/research/technical-poesessid-vs-oauth-for-trade-api-rate-li-2026-10-02/research.md`
  and `digests/` (mainly `capture-trade2-headers.md`), `docs/stories/archive/spec-poesessid-sync/SPEC.md`,
  `.memlog.md` revision 24 entries.
- **Web re-check:** 2026-10-02, with WebFetch of `pathofexile.com/developer/docs`,
  `/developer/docs/authorization`, forum thread 3328601, POEFixer FixerWiki *Trade Cookies*, and
  WebSearch.
- **Verdict:** **issues.** The documented GGG facts (header format, 4xx counting, OAuth scopes,
  closed registration, sign-out revocation) are confirmed today. But two premises that the
  mid-run behaviour rests on are not evidenced: that a dead cookie gets a `401`/`403`, and that
  the trade API needs a browser `User-Agent` for a cookie request. The spine states both as
  fact, and the SPEC labels only the first as an assumption. The spine also says that `prd.md`
  records the NFR-9 departure. That is false in the working tree.

## Claim-by-claim check

| # | Claim the change relies on | Repo evidence | Web, 2026-10-02 | Result |
| --- | --- | --- | --- | --- |
| C1 | trade2 adds a rule to `X-Rate-Limit-Rules` when POESESSID is sent (AD-30 step 3, §13 line 1173) | `capture-trade2-headers.md`: `Ip` without the cookie, `Account,Ip` with it, for both the search and the fetch policy | No public PoE2 capture found (`verify-community.md` line 20 also found none). GGG docs list `account` as a common rule. | **Supported, one sample.** One IP, one account, one moment, four requests. See F3. |
| C2 | `X-Rate-Limit-Rules` is a comma-separated list of names (§13 line 1177) | Capture shows `Account,Ip` with no space. `verify-ggg.md` line 64. | **Confirmed.** Docs: "A comma-delimited list of applicable rules. Common rules are: ip, account, and client." | **Verified.** The trim and the case-fold cover the mixed case (`Ip` against `ip`). |
| C3 | A dead cookie gets a `401` or `403`, and not, for example, a 200 with fewer rules (AD-30 *Expiry mid-run*, line 1815; §13 *Downgrade*) | **None first-hand.** The capture used only a live cookie. The research rec 3 says "Treat a 401 or 403 as 'the cookie expired'" with no citation. The import's C40 asserts 401/403, and `import-gemini.md` F11 flags that this "does not obviously come from" its source. `verify-community.md` line 92 lists a low-reliability 401/403 claim as "not used as evidence". SPEC lists it under *Assumptions*. | **Unconfirmed.** FixerWiki (third-party, game unspecified) says the "trade site rejects the session or shows 401". No GGG source says what trade2 does with an invalidated session. The capture's own observation points the other way: a no-cookie response carried `set-cookie: POESESSID=…` (a new anonymous session), so the site can treat an unknown session as anonymous. | **Assumption, stated as fact in the spine.** See F1. |
| C4 | GGG counts `401`/`403` toward its invalid-request threshold (§5.3 line 614, which AD-30's probe carve-out relies on) | `IMPLEMENTATION-NOTES.md` §5.3 | **Confirmed.** Docs: invalid requests, 4xx "including 401, 403, 429", that pass a threshold restrict access. The docs cover the documented API. Whether trade2 applies the same threshold is not documented. | **Verified for the docs. Inferred for trade2** (the spine already treats it that way). See F4 for a consequence. |
| C5 | OAuth has no trade scope, and registration is closed (Deferred, line 2130) | `research.md` [1][2], `verify-ggg.md` | **Confirmed.** Twelve scopes, six `account:*` and six `service:*`, none for trade. "We are currently unable to process new applications." | **Verified.** The research sets a re-check by 2026-11-02, and the spine gives no date. See F6. |
| C6 | The trade API accepts a cookie request only with a browser `User-Agent` (AD-30 line 1828, AD-8 line 656) | **None recorded.** `research.md` line 116 strikes the open question with "Answered by the operator on 2026-10-02". This was changed in this same working-tree diff. No capture of a failed cookie request with the contact UA exists: no status code, no cf-ray, no body. The capture used a Chrome UA only. The 2026-09-12 unauthenticated capture worked with the contact UA. | **Not found.** No source says that trade2 refuses a non-browser UA for a cookie request only. Cloudflare UA-signature blocks (1010/1020) are a general pattern. They do not depend on the cookie. | **Unverified, one operator report, no artifact.** See F2. |
| C7 | Signing out revokes POESESSID (SPEC constraint, research rec 3) | `research.md` [5], `verify-ggg.md` line 96 | **Confirmed today** from forum thread 3328601: "just log out of the pathofexile.com website and back in again" / "Any previous session cookies you gave out before will now be invalid." | **Verified.** The source dates from 2022. The text is still live. A password change is still unknown. |
| C8 | The unauthenticated route still works, and the product needs no secret (Deployment) | Spine line 1057 (2026-09-12), capture 2026-10-02 (200 without a cookie, contact UA not used) | n/a | **Supported.** The 2026-10-02 sample used a browser UA. The contact-UA POST legs still rest on 2026-09-12 alone, as line 1059 already says. |
| C9 | `prd.md` records the NFR-9 departure (line 1830-1831) | `prd.md` is unmodified. NFR-9 (line 544) still requires that requests "identify the tool and a contact address". Line 569 says "Background sync: unauthenticated", and line 588 still lists "Authenticated sync" as a deferral. | n/a | **False in the working tree.** See F5. |
| C10 | No code change is needed to put a browser UA in `POE_SYNC_USER_AGENT` | `packages/sync/src/trade/user-agent.ts` passes the value verbatim and checks only that it is not blank | n/a | **True.** But the same variable also feeds `catalogue:refresh` (`catalogue-refresh.ts:300`) and `fixtures:record`. See F7. |

## Findings

### F1 — High. The mid-run expiry signal is an assumption, and the spine states it as a rule of fact

AD-30 (line 1815) and §13 *Downgrade* trigger the downgrade only on a `401` or `403` to a
request that carried the cookie. The SPEC puts this under *Assumptions*. The spine drops the
label. Nothing in the evidence shows what trade2 returns for a dead session. The capture shows
that the site gives an anonymous session to a request with no session (`set-cookie: POESESSID`).
So a plausible behaviour is that a revoked cookie gets a **200 that carries only `Ip`**. The
probe's structural test catches that at run start (`not-elevated`). Mid-run it is invisible:

- The client keeps the dead cookie for the rest of the process.
- The console line says `authenticated` while the run is anonymous. That breaks CAP-4's intent
  that the operator can tell the two apart.
- Pacing stays correct only because AD-8 reads the rules from every response. The process
  ledger is still not reset to cold, which is the case the "Prevents" bullet names
  ("authenticated rate-limit readings pacing unauthenticated requests"). The ledger replaces
  values on each reading, so the cost is small. It is still the cost the AD says it prevents.

The success signal of the SPEC (sign out, then run again) exercises only the probe path, so the
"sign out" test does not tell which behaviour is real.

**Fix:** (a) In AD-30, label the premise the way line 1057 labels its own: *"Assumed, not
measured: a revoked cookie gets a 401 or 403."* Add an open question with a cheap test: sign
out, then send one search with the old cookie, and record the status, `X-Rate-Limit-Rules` and
`set-cookie`. (b) Make the downgrade structural as well as status-based. A cookie-carrying 2xx
whose `X-Rate-Limit-Rules` lists no more names than the baseline (or that carries a
`set-cookie: POESESSID`) is also `expired`. This uses the same count test as §13 step 3, so
"two builders deciding liveness differently" stays prevented, and the rule works whichever
behaviour is real.

### F2 — Medium. "The trade API accepts a cookie request only with a browser User-Agent" rests on one operator report with no artifact

AD-30 line 1828 and AD-8 line 656 bind the operator to depart from NFR-9 on this basis. The
research diff in this same change strikes the open question and records it as "Answered by the
operator". It records no status code, cf-ray, body or date-time, and it does not say whether a
Cloudflare edge or GGG refused the request. That leaves three things open: (i) whether a contact
UA without a cookie also fails today, (ii) whether the refusal was a one-off Cloudflare
challenge, and (iii) which status the probe would see. The design is robust to (iii): a refusal
at the probe settles `probe-rejected` or `not-elevated`. So the risk is a policy departure
justified on an unrecorded observation, not a runtime fault.

**Fix:** Record the failing request in `digests/capture-trade2-headers.md` as a fifth and
sixth row: the contact UA with the cookie, and the contact UA without the cookie, each with
status, `server`, `cf-mitigated` and cf-ray. Cite that row from AD-30 in place of the bare
assertion. Until then, change AD-30's sentence to "the operator observed that…" and add a
re-check line.

### F3 — Medium. The structural liveness test rests on one capture of one account

The "more rule names than the baseline" test (AD-30 step 3) is the one way the design decides
liveness. Its only evidence is four requests in 15 s from one account (`capture-trade2-headers.md`,
*Limits of this evidence*). The research leaves "Do the `Account` numbers depend on the
account?" open. GGG also shipped a header-name bug in 2022 (research [10]). The test fails safe:
a false negative gives `not-elevated` and the run stays unauthenticated. A false positive would
need a cookie-less response to list extra rules, which nothing suggests. So the severity is
medium, not high.

**Fix:** Add a single-sample caveat to AD-30, with the re-check date that the research already
sets for rate-limit facts (2026-11-02). Make the first live cookie run's `authenticated` line
the confirming second sample: record the rule lists of the baseline and the probe (names only,
no values) in the story's dev notes.

### F4 — Medium. A dead cookie costs one GGG-counted 4xx on every process, which the "Prevents: wedging behind a penalty" bullet does not cover

GGG counts 401 and 403 toward its threshold (C4, confirmed today). §13 removes a probe 4xx from
the **client's** count. GGG still counts it. Auth state is per process, so under `sync:batch` or
a scheduler, a cookie that stays in `.env` after sign-out gets a probe 4xx in **every** process
(if F1's premise holds). The spine gives GGG's threshold as unknown, so the number of such
requests that is safe is not known.

**Fix:** State this cost in AD-30 as accepted, or bound it. One option: the `probe-rejected`
warning text tells the operator to remove `POESESSID` from `.env`, because each run spends one
counted 4xx. A stronger option: persist a value-free marker (for example, `probeRejectedAt`) in
`sync-progress.json`. While the marker is set, the next process does not probe until `.env`
changes. This is AD-7's "cleared by an input change" pattern.

### F5 — Medium. The spine says that `prd.md` records the NFR-9 departure, and it does not

Line 1830-1831: "This departs from NFR-9's contact rule, and `prd.md` records that departure."
`prd.md` is unmodified. NFR-9 (line 544) still requires a contact UA, line 569 says sync is
unauthenticated, and line 588 lists "Authenticated sync" as a spine-owned deferral that this
revision removes. Under the AGENTS.md owner rules this edit hits two of the five PRD triggers: a
scope boundary and player-visible behaviour, through NFR-9. The SPEC says the build "needs a
PRD scope edit".

**Fix:** Land the PRD edit (NFR-9 departure for cookie runs, a scope line, removal of the
"Authenticated sync" deferral) in the same commit. Until then, reword the spine to "the PRD
must record that departure (pending)".

### F6 — Low. The OAuth facts in the Deferred section carry no date

Line 2130 says OAuth "has no trade scope and is closed to new registrations". Both facts are
confirmed today. The research sets a one-month re-check (by 2026-11-02), because the docs page
shows no date.

**Fix:** Add "(GGG developer docs, accessed 2026-10-02)" to the sentence. The revisit trigger
"if GGG publishes a trade scope" then has a baseline date.

### F7 — Low. A browser UA in `POE_SYNC_USER_AGENT` also anonymises the cookie-free commands

The cookie run reuses `POE_SYNC_USER_AGENT`. That variable also feeds `catalogue:refresh` and
`fixtures:record`, which AD-30 keeps unauthenticated and which could keep the contact UA. With
one `.env`, an operator who opts in loses the contact UA on every command, not only on cookie
runs. That is a wider NFR-9 departure than AD-30 describes. The file comment in
`packages/sync/src/trade/user-agent.ts` ("the only `process.env` read in `sync`") also becomes
false when AD-30 is built.

**Fix:** In AD-30, either say that the departure covers every command that shares the `.env`,
or add an optional `POE_SYNC_COOKIE_USER_AGENT` that only the `sync` and `sync:batch` shells
read when a cookie is set. Note the comment update in the story that builds AD-30.

## Assumptions in AD-30, and whether the spine labels them

| Premise | Evidence | Labelled in spine? |
| --- | --- | --- |
| A revoked cookie gets a 401/403 mid-run | none (F1) | **No.** It is labelled only in SPEC *Assumptions*. |
| A cookie request needs a browser UA | operator report, no artifact (F2) | **No.** It is stated as fact. |
| A session adds a rule name | one capture (F3) | **No.** There is no sample caveat in the spine. The research says "one sample". |
| Sync runs only on the operator's machine | SPEC *Assumptions* | Stated as fact in Deployment. This is a product decision, so that is acceptable. |
| The downgrade's pacing reset costs at most one 429 | memlog (accepted cost) | In the memlog only. That is acceptable, because the rationale belongs in the memlog. |
