# Forged idea: host sync on a Raspberry Pi 3B

Outcome: HARDENED. The Pi runs `pnpm sync` and publishes on its own, so the PC can stay off.

## Locked

- **The Pi publishes to `master` itself.** A systemd timer runs a tick every 4 h, outside the sync chunk path.
- **The tick:** stop the sync service (AD-7 SIGTERM finishes the current entry) → commit only the sync-owned paths → `git pull --rebase` → push → `pnpm install --prod --frozen-lockfile` if `pnpm-lock.yaml` changed → start the service. The tick skips the commit when nothing changed. On any failure it aborts, logs, retries next tick, and never force-pushes. Code deploys to the Pi ride the same tick.
- **Drift guard:** the tick aborts loudly if any path outside its sync-owned list is dirty, because nobody curates on the Pi.
- **Where it lives:** git-tracked `ops/pi/` with generic instructions: placeholders for host, user and paths, no secrets. It contains the runbook `README.md`, the tick script, the systemd `.service`/`.timer` and `set-poesessid.sh`. It is not a package script.
- **Rebuild:** runbook only, which the developer agent executes over `ssh`. The runbook marks the human-only steps: Imager flash, secret paste, deploy-key approval. `AGENTS.md` points to it.
- **Provisioning:** Raspberry Pi OS Lite 64-bit via Pi Imager with hostname, user and SSH key preset. Prefer Ethernet. Node 24 arm64, `pnpm install --prod` (sync needs only `zod` at runtime; still to verify on the Pi). The Pi uses a repo-scoped write deploy key and commits with the GitHub noreply address.
- **Invoker:** the long-running `pnpm sync` session under systemd, not `sync:batch`. There is no tuning up front apart from a `MemoryMax` guard on the unit. After the first pass, the runbook measures CPU and memory per entry on the Pi. Only if CPU is high: cache parsed inputs in the session, keyed by `inputSignature` (a deferred app change).
- **Recovery after an outage:** the service is enabled at boot with `Restart=always`, `After=network-online.target` and `time-sync.target` (enable `systemd-time-wait-sync`, because the Pi 3B has no clock battery). The timer has `Persistent=true`. The tick removes a stale `.git/index.lock` and aborts a half-done rebase.
- **Access:** home LAN only (`ssh <pi-host>.local`). The agent has the same reach through the PC's Bash tool.
- **`POESESSID` rotation:** the user runs `set-poesessid.sh` over `ssh -t`. It reads stdin and writes `.env` with mode 600, then restarts the service. The agent never handles the cookie.
- **Docs:** amend AD-3 so the chunk path still makes no git write and publishing becomes an operator job outside the product. The spine's Deployment section and tech table stay platform-agnostic ("an OS scheduler: Windows Task Scheduler, systemd").
- **Does not change:** `packages/`.

## Rejected

- PC-side publishing (Pi only collects data): the site would still need the PC on.
- `data` branch + Action merge: the concern is merge conflicts, not blast radius. The Pi must pull `master` anyway, and a `GITHUB_TOKEN` push does not trigger `deploy.yml`.
- `pnpm publish:data`: mixes app logic with infra and still needs a timer.
- `SYNC_HOST` env guard against a second syncer: the user runs sync by hand and will stop doing so on the PC.
- Attention signal (cookie report record, ntfy push): the cookie is expected to last about half a year.
- `bootstrap.sh`: the agent follows the runbook.
- `sync:batch` on a timer: every run spends a league-gate request and a cookie-probe search, starts with cold pacing (no even spread), and pays Node startup again.
- Atomic artifact write and a JSON-validity guard in the tick: too much for the risk.
- Tailscale: deferred until access from outside the home is needed.

## Open risks

- A sync run on the PC shares the rate budget and can make the Pi's rebase conflict on `dataset.json`.
- A dead cookie downgrades silently (AD-30). The half-year lifetime is unverified (spine re-check due 2026-11-02).
- A power cut during a write can leave `dataset.json` empty or cut off (`writeTextFile` rewrites the file in place). The next tick commits it to `master`, and the deploy check keeps it off the site. Fix it by hand: `git checkout -- data/` on the Pi, then commit.
- SD wear: about 2.4 MB written per entry, about 5–7 GB a day, which is years on a decent card. The used card's unknown history and corruption on power loss matter more. Use a high-endurance card. Recovery loses at most one tick, because `dataset.json` and `sync-progress.json` are in git.
