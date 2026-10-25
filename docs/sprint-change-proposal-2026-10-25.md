# Sprint Change Proposal — 2026-10-25: a Raspberry Pi sync host

## 1. Issue summary

The operator wants sync to run and publish while the PC is off. `docs/forge/raspberry-pi-sync-host/forged-idea.md` holds the hardened idea. A Raspberry Pi 3B runs the long-running `pnpm sync` session under systemd. A 4 h systemd timer commits the sync-owned files and pushes them to `master`.

This is a hosting change, not a product change. AD-3 now makes publishing "a human act", and *Deployment & environments* puts the syncer on "the player's machine". Both texts conflict with an unattended publish tick.

## 2. Impact analysis

- **Epics and stories:** none. Epics 1–5 have the status `done`, and this change does not touch them. The change adds no player-facing capability, so it adds no epic and no story. The story-order step does not apply.
- **PRD:** none. FR-25 and FR-33 stay true. The product commits nothing, and publishing stays the act of the player, now on the player's own host.
- **UX:** none.
- **Architecture:** the AD-3 publishing paragraph, *Deployment & environments*, the Stack "Sync invoker" row, revision 42 and one `.memlog.md` row.
- **`AGENT-WORKFLOW.md`:** none. The runbook holds the per-checkout lock note and the service control of the agent.
- **`AGENTS.md`:** one pointer to the runbook.
- **Code:** `packages/` does not change. A new git-tracked `ops/pi/` holds the host files.

## 3. Recommended approach

Direct adjustment. Amend the spine at the altitude of an operator job. Build `ops/pi/` as a task outside the backlog. The effort is low, and the risk is low. The forged idea lists the open risks: a concurrent PC sync, a silent dead cookie, a power cut during a write, and SD wear.

## 4. Detailed change proposals

### A1 — `ARCHITECTURE-SPINE.md`, AD-3, the publishing paragraph

OLD:

> **Publishing is a human act.** The player commits and pushes the sync-owned files at whatever cadence he chooses, and that push is what deploys (*Deployment & environments*). The rule exists because AD-7 makes `sync` a bounded chunk invoked repeatedly: an automated commit-and-push per run produces thousands of commits a day, which buries the curation history the audit trail depends on (AD-19) and puts an unattended job on the write path of a shared remote. With no automated push, a non-fast-forward remote cannot arise from this product at all.

NEW:

> **Publishing is an operator job outside the product.** The operator of the sync host commits and pushes the sync-owned files, by hand or from a scheduled job on that host, and that push is what deploys (*Deployment & environments*). No component of the product commits, and no commit rides the chunk path. The rule exists because AD-7 makes `sync` a bounded chunk invoked repeatedly: a commit per chunk produces thousands of commits a day, which buries the curation history the audit trail depends on (AD-19). An operator job therefore commits only the sync-owned files, on its own cadence and never per chunk, and never force-pushes.

Rationale:

- The commit-volume reason stays.
- The operator accepts the unattended writer on purpose.
- Two hosts that push can make a non-fast-forward remote. "Never force-pushes" replaces the old guarantee against it.

### A2 — `ARCHITECTURE-SPINE.md`, *Deployment & environments*

Paragraph 1, NEW. It cites AD-3 and does not repeat who publishes.

> There is one environment. The syncer runs on the operator's sync host, either as the long-running `pnpm sync` session, which runs one chunk per entry and paces itself (AD-7, AD-8), or as `pnpm sync:batch` invoked repeatedly by an OS scheduler. Each chunk takes the lock, does its bounded work, writes the files it owns, and releases the lock (AD-3). Publishing is an operator job (AD-3). A push to the default branch triggers a **GitHub Actions workflow** that builds the Vite bundle and deploys to Pages — branch-published Pages runs Jekyll and cannot build this app, so the workflow is required, not optional. There is no staging environment, and the product has nothing to patch on a server. The trade API works unauthenticated, as confirmed, so the product needs no secret. The one optional secret is the operator's `POESESSID` (AD-30). It lives only in the sync host's local `.env`, never in git and never in CI, because only the sync host runs sync. Local development is `pnpm dev` against committed fixtures, with no network.

Paragraph 2, first sentence: "bounded by the player's push cadence" becomes "bounded by the publish cadence". Paragraph 3 does not change.

### A3 — `ARCHITECTURE-SPINE.md`, Stack row, revision, memlog

- Stack row "Sync invoker": "`pnpm sync:batch` under Windows Task Scheduler" becomes "`pnpm sync:batch` under an OS scheduler".
- Front matter: `revision: 42`, `updated: '2026-10-25'`.
- `.memlog.md`, one new row:

> - (decision) [USER] Spine revision 42 (2026-10-25, forge raspberry-pi-sync-host): publishing becomes an operator job outside the product (AD-3). The operator may commit and push the sync-owned files from a scheduled job on the sync host, on its own cadence and never per chunk, and never force-pushes. `sync` still makes no git write, and the git port stays read-only. *Deployment & environments* and the Stack row name a sync host and an OS scheduler, not a platform. Accepts an unattended writer on `master`. Binds the operator and `ops/`, not any package. Prevents a builder from reading AD-3 as a ban on the sync host's publish tick, or from moving that tick into `sync`.

### W1 — `AGENT-WORKFLOW.md`

Skipped. The edit is at implementation level. The runbook holds both facts.

### G1 — `AGENTS.md`, *Where things are*

> - Sync host (Raspberry Pi) runbook: `ops/pi/README.md`.

## 5. Implementation handoff

**Scope: Minor.** The Developer agent builds it as a task with `bmad-build`.

1. Land A1, A2, A3 and G1 in one docs commit.
2. Build the git-tracked `ops/pi/` as the forged idea locks it. It holds the runbook `README.md`, the tick script, the systemd `.service` and `.timer`, and `set-poesessid.sh`. Use placeholders for host, user and paths. Put no secrets in it. The build also covers these items:
   - Set the `TimeoutStopSec` of the unit above the longest paced entry. On SIGTERM, `sync.ts` lets the running entry finish. The systemd default of 90 s can kill that entry during a write.
   - In the runbook, state that the lock is per checkout (`data/sync.lock`). All hosts share one rate budget, so sync runs on one host at a time. The agent may start and stop the service.
   - In the runbook, add a measurement of CPU and memory per entry after the first pass. Add the `inputSignature` cache to `deferred-work.md` only if that measurement shows high CPU.
3. Provision the Pi over `ssh` as the runbook says. The player does the human-only steps: the Imager flash, the secret paste and the deploy-key approval. Check on the Pi that `pnpm install --prod` is sufficient to run `pnpm sync`.

**Success criteria:**

- With the PC off, a push from the Pi deploys a fresh `dataset.json` to Pages within one tick.
- The tick aborts when a path outside its list is dirty.
- The tick never force-pushes.
- The service continues after a reboot and after a power cut.
- `pnpm check` passes.
