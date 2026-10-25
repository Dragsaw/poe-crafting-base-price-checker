# Sync host runbook: Raspberry Pi

A Raspberry Pi 3B runs the long-running sync session, the `sync` script's command run by node,
under systemd. Every 4 h a publish tick refreshes the currency rates, commits the tick-owned files
and pushes them to `master`, and that push deploys the site. The PC can stay off. Publishing is an
operator job outside the product (AD-3), so this directory is operator tooling, not a package.

| File | What it is |
|---|---|
| `poe-sync.service` | The sync session. Runs the command of the `sync` script with `node` itself, so that a stop sends exactly one SIGTERM. Removes a stale sync lock before each start. Starts at boot and restarts after a crash. |
| `poe-sync-tick.service` | The publish tick. Stops `poe-sync`, runs `tick.sh`, starts `poe-sync` again, also when the tick fails. |
| `poe-sync-tick.timer` | Starts the tick every 4 h. `Persistent=true` catches up a tick missed while the Pi was off. |
| `tick.sh` | Refreshes the currency rates, commits, rebases, reinstalls dependencies when `pnpm-lock.yaml` changed, and pushes. |
| `set-poesessid.sh` | Writes `POESESSID` into `.env` and restarts `poe-sync`. |

Steps marked **HUMAN** are for the operator only. The agent does every other step over
`ssh <pi-user>@<pi-host>.local` from the PC.

## Placeholders

Replace these everywhere. Never commit the real values to this directory.

| Placeholder | Meaning |
|---|---|
| `<pi-host>` | The hostname set in Raspberry Pi Imager. |
| `<pi-user>` | The user set in Raspberry Pi Imager. |
| `<repo-dir>` | The absolute path of the clone on the Pi, for example `/home/<pi-user>/poe-crafting-base-price-checker`. Use a path with no spaces, because the units put it in `ExecStart=`. |
| `<repo-ssh-url>` | The SSH clone URL of the GitHub repository. |
| `<noreply-email>` | The GitHub noreply address of the operator, `<id>+<login>@users.noreply.github.com`. |

## 1. Provision

1. **HUMAN: flash the card.** Use a high-endurance microSD card. In Raspberry Pi Imager, choose
   Raspberry Pi OS Lite (64-bit). In the OS customisation, set the hostname `<pi-host>`, the user
   `<pi-user>`, and SSH with public-key authentication only, with the public key of the PC. Leave
   Wi-Fi empty and connect Ethernet.
2. Check the access from the PC: `ssh <pi-user>@<pi-host>.local true`.
3. Update the OS and install the tools:

   ```sh
   sudo apt-get update && sudo apt-get full-upgrade -y
   sudo apt-get install -y git ca-certificates curl
   ```

4. Turn on the memory cgroup, so that `MemoryMax=` has an effect. Raspberry Pi kernels ship with it
   off. Append ` cgroup_enable=memory cgroup_memory=1` to the single line of
   `/boot/firmware/cmdline.txt`, then `sudo reboot`. After the reboot,
   `cat /sys/fs/cgroup/cgroup.controllers` must list `memory`.
5. Make boot wait for a synchronised clock. The Pi 3B has no clock battery, and `poe-sync.service`
   orders itself after `time-sync.target`:

   ```sh
   sudo systemctl enable systemd-time-wait-sync.service
   timedatectl show -p NTPSynchronized   # NTPSynchronized=yes
   ```

6. Install Node 24 for arm64, at the version that `engines` in `package.json` accepts, and enable
   Corepack so that `pnpm` follows `packageManager`:

   ```sh
   curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
   sudo apt-get install -y nodejs
   node --version
   sudo corepack enable
   ```

7. Make a deploy key and print its public half:

   ```sh
   ssh-keygen -t ed25519 -f ~/.ssh/poe_deploy -N '' -C '<pi-host> deploy key'
   cat ~/.ssh/poe_deploy.pub
   printf 'Host github.com\n  IdentityFile ~/.ssh/poe_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config
   chmod 600 ~/.ssh/config
   ```

8. **HUMAN: approve the deploy key.** In the GitHub repository, open *Settings → Deploy keys → Add
   deploy key*, paste the public key, and select *Allow write access*.
9. Trust GitHub's host key and check the deploy key. Write the scanned key to a temporary file
   first, and print its fingerprint:

   ```sh
   ssh-keyscan -t ed25519 github.com > /tmp/github_host_key
   ssh-keygen -lf /tmp/github_host_key
   ```

   Compare the printed `SHA256:` fingerprint with the `ed25519` fingerprint that GitHub publishes
   in *GitHub's SSH key fingerprints* (docs.github.com). Only when they are equal, append the key
   and test the deploy key. When they differ, stop and append nothing.

   ```sh
   cat /tmp/github_host_key >> ~/.ssh/known_hosts && rm /tmp/github_host_key
   ssh -T git@github.com   # "successfully authenticated"
   ```

10. Make a full clone. Do not use `--depth`: the git port reads the author date of
    `data/tracked.json` (AD-12), which a shallow clone does not have.

    ```sh
    git clone <repo-ssh-url> <repo-dir>
    cd <repo-dir>
    git config user.name '<pi-host> sync'
    git config user.email '<noreply-email>'
    ```

11. Install the production dependencies. The `prepare` script sets `core.hooksPath`, so the
    commit-msg hook checks the tick's commits:

    ```sh
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm install --prod --frozen-lockfile
    git config core.hooksPath   # .githooks
    ```

12. **HUMAN: write `.env`.** The agent never reads or writes this file. Create `<repo-dir>/.env`
    with the `POE_SYNC_USER_AGENT=` line (required) and `chmod 600` it. Set the optional
    `POESESSID` with `set-poesessid.sh` (*Rotate POESESSID* below), never by hand in a shared
    terminal.

## 2. Install the units

Fill in the placeholders, install the units, and start them:

```sh
repo_dir=<repo-dir>
for unit in poe-sync.service poe-sync-tick.service poe-sync-tick.timer; do
  sed -e "s|<pi-user>|$USER|g" -e "s|<repo-dir>|$repo_dir|g" "$repo_dir/ops/pi/$unit" \
    | sudo tee "/etc/systemd/system/$unit" >/dev/null
done
sudo systemctl daemon-reload
sudo systemctl enable --now poe-sync.service poe-sync-tick.timer
systemctl list-timers poe-sync-tick.timer
```

Run this block again after a pull changes `ops/pi/*.service`, `ops/pi/*.timer`, or the `sync`
script in `package.json`, because `poe-sync.service` holds a copy of that script's command. The
tick does not reinstall the units. This check prints nothing while the installed units match the
checkout:

```sh
repo_dir=<repo-dir>
for unit in poe-sync.service poe-sync-tick.service poe-sync-tick.timer; do
  sed -e "s|<pi-user>|$USER|g" -e "s|<repo-dir>|$repo_dir|g" "$repo_dir/ops/pi/$unit" \
    | diff -u "/etc/systemd/system/$unit" -
done
```

## 3. Operate

| Task | Command |
|---|---|
| Session state | `systemctl status poe-sync` |
| Session log | `journalctl -u poe-sync -f` |
| Last ticks | `journalctl -u poe-sync-tick -n 50` |
| Next tick | `systemctl list-timers poe-sync-tick.timer` |
| Tick now | `sudo systemctl start poe-sync-tick.service` |
| Tick by hand, without the unit | `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 bash <repo-dir>/ops/pi/tick.sh <repo-dir>` |
| Pause syncing | The block under *Pause syncing* below |
| Resume syncing | `sudo systemctl enable --now poe-sync poe-sync-tick.timer` |

**Pause syncing.** Disable the timer, wait for a running tick to end, then disable the service:

```sh
sudo systemctl disable --now poe-sync-tick.timer
while [ "$(systemctl show -p ActiveState --value poe-sync-tick.service)" = activating ]; do sleep 10; done
sudo systemctl disable --now poe-sync
```

A running tick is `activating`, and its `ExecStopPost` starts `poe-sync` again when it ends. The
wait lets that start happen before the last line stops `poe-sync` for good. `disable --now` keeps
both units off after a reboot.

The agent may stop and start `poe-sync` and the timer.

A tick through the unit (*Tick now*) always starts `poe-sync` through its `ExecStopPost`, also
while syncing is paused. While paused, use *Tick by hand*: it runs `tick.sh` as `<pi-user>`
without the unit, so nothing starts `poe-sync`. Run it only while `poe-sync` is stopped, because
sync writes the files that the tick commits.

**One syncer at a time.** The sync lock is per checkout: `data/sync.lock` is git-ignored and local,
so a sync on the PC does not see the lock of the Pi. `poe-sync.service` removes the lock before
each start, which is safe only because systemd runs one session per checkout. All hosts share one
rate budget, and a PC sync also makes the next rebase of the Pi conflict on `data/dataset.json`.

**PC hand-off.** To sync on the PC:

1. Run the *Pause syncing* block on the Pi.
2. Run *Tick by hand* on the Pi. It publishes the data of the Pi.
3. On the PC, pull, sync, commit the three sync files and push. Run `pnpm currencies:refresh`
   when the rates matter for the run, because the paused Pi does not refresh them.

To give syncing back to the Pi:

1. Run *Tick by hand* on the Pi first. The Pi pulls the data of the PC before sync writes again.
2. Resume syncing on the Pi.

**Nobody curates on the Pi.** Edit `data/tracked.json` and the code on the PC and push. The next
tick pulls the change, and a code deploy rides the same tick. The tick refuses to commit when a
path other than the four tick-owned files is dirty or untracked: the three sync files
`data/dataset.json`, `data/sync-progress.json` and `data/sync-report.json`, and the rates file
`data/currencies.json`. It logs each such path and exits with status 3. Clean the path by hand.
Git-ignored files, such as `.env` and the sync lock, are not drift.

**What a tick does.** It removes a stale `.git/index.lock`, aborts a half-done rebase, and removes
a `data/currencies.json.tmp` that a power cut during a refresh left behind. It checks that `master`
is checked out and that no other path is dirty. It runs `pnpm currencies:refresh`, which rewrites
`data/currencies.json` from poe2scout while `poe-sync` is stopped, so the restarted `poe-sync`
reads the new rates. A failed refresh does not fail the tick: the tick logs a warning, restores
`data/currencies.json` with `git checkout --`, and publishes the sync data as usual. It commits the
four tick-owned files as `chore(data): sync dataset`, or skips the commit when they did not change.
Then it runs `git pull --rebase`. When `pnpm-lock.yaml` differs from the one last installed, it runs
`pnpm install --prod --frozen-lockfile --config.confirm-modules-purge=false` before the push.
The last flag lets pnpm purge `node_modules` without a prompt, for example after a pnpm major
bump, because the tick has no terminal. The install runs before the push so a failed push does not leave the
pulled code on the old dependencies. Last, it runs a plain `git push --no-verify`, never a
force-push, also when it made no commit. `--no-verify` skips the pre-push hook, which runs
`pnpm check` and needs the dev dependencies. `deploy.yml` still gates the deploy on `pnpm check`.
A failure ends the tick with a non-zero status, and the local commit stays for the next tick. A
failed install runs again in the next tick.

| Exit status | Meaning |
|---|---|
| 2 | Wrong setup: no repository directory, no git work tree, detached `HEAD`, another branch, or a running git process |
| 3 | Drift guard |
| 4 | `git pull --rebase` failed. A conflicting rebase was aborted. |
| 5 | `git push` failed |
| 6 | `pnpm install` failed |
| Other non-zero | An unexpected failure. The ERR trap logs the line, the status and the command. |

### Rotate POESESSID

**HUMAN:** from the PC, run

```sh
ssh -t <pi-user>@<pi-host>.local <repo-dir>/ops/pi/set-poesessid.sh
```

and paste the cookie at the hidden prompt. The script replaces or adds only the `POESESSID=` line
of `.env`, keeps the other lines, sets mode 600, and restarts `poe-sync`. When a tick runs at that
moment, the script does not restart `poe-sync`, and the tick starts it with the new value at its
end.

### Measure CPU and memory after the first pass

After the first full pass over the tracked list, measure the cost of one entry on the Pi. Each
tick restarts `poe-sync`, which resets its CPU and memory counters. So take both samples between
two ticks, one hour apart, or stop the timer for the window with
`sudo systemctl stop poe-sync-tick.timer` and start it again after the second sample. At the first
sample, note the time. At each sample, run:

```sh
systemctl show poe-sync -p CPUUsageNSec -p ActiveEnterTimestamp
cat /sys/fs/cgroup/system.slice/poe-sync.service/memory.peak
```

`ActiveEnterTimestamp` must be the same in both samples. At the second sample, count the entries
of the window:

```sh
journalctl -u poe-sync --since '<time of the first sample>' | grep -c ', 1 completed'
```

CPU per entry is the `CPUUsageNSec` difference divided by the number of entries in the window.
Also compute the average load: the difference divided by 3600 s. Write the numbers in the pull
request or issue that records the measurement. Only if CPU is high, meaning the session
averages more than half a core or `memory.peak` comes near `MemoryMax`, append an entry to
`docs/stories/deferred-work.md`: cache the parsed inputs in the session, keyed by
`inputSignature`. Otherwise add nothing.

## 4. Recovery

**Rebase conflict.** A sync on another host changed the same files, and each tick exits with
status 4. Each failed tick leaves one more local commit. This recovery works for any number of
them: it sets the checkout to the remote and commits the data of the Pi once. A rates refresh on
the PC conflicts on `data/currencies.json` the same way, and this recovery covers it too. The data
of the Pi is the newer data when the Pi is the only syncer.

First run the *Pause syncing* block (*3. Operate*). Then:

```sh
cd <repo-dir>
git rebase --abort 2>/dev/null || true   # only acts on a half-done rebase
keep=$(mktemp -d)
cp data/dataset.json data/sync-progress.json data/sync-report.json data/currencies.json "$keep/"
git fetch origin
git reset --hard origin/master
cp "$keep/dataset.json" "$keep/sync-progress.json" "$keep/sync-report.json" "$keep/currencies.json" data/
rm -r "$keep"
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 bash <repo-dir>/ops/pi/tick.sh <repo-dir>
sudo systemctl enable --now poe-sync poe-sync-tick.timer
```

The tick refreshes the rates, commits the four files as `chore(data): sync dataset` and pushes. To
keep the remote's data instead, skip the second `cp` line. Then the tick commits at most the rates
that its refresh rewrote. Do not use `git rebase --continue`, `--ours` or `--theirs`: with more than one local commit, the rebase stops
again for each of them.

**Truncated `dataset.json`.** A power cut during a write can leave `data/dataset.json` empty or cut
off, because sync rewrites the file in place. The deploy check keeps a bad file off the site.
Check the file:

```sh
node -e "JSON.parse(require('node:fs').readFileSync('data/dataset.json', 'utf8'))"
```

When the check fails, run the *Pause syncing* block. If the bad file is not committed yet, run
`git checkout -- data/dataset.json data/sync-progress.json data/sync-report.json data/currencies.json`.
If a tick already committed it, restore the three sync files from the last good commit with
`git checkout <good-commit> -- data/dataset.json data/sync-progress.json data/sync-report.json`
and run *Tick by hand*. Restore the three sync files together, so the progress cursor matches the
dataset. Leave `data/currencies.json` at `HEAD`: the tick refreshes it again. Then resume syncing.

**Leftovers.** The next tick removes a stale `.git/index.lock` and a stale
`data/currencies.json.tmp`, and aborts a half-done rebase. No step is necessary.

**Dead SD card.** Flash a new card and run this runbook again. `dataset.json` and
`sync-progress.json` are in git, so the loss is at most the data since the last tick.

## 5. First-run checklist

Do these checks on the first provisioned Pi, and write the results in the pull request or issue
that records the run.

- [ ] `pnpm install --prod --frozen-lockfile` is enough: `poe-sync` runs, and the journal shows
      `, 1 completed` lines with no module-not-found error.
- [ ] A stop is graceful: `sudo systemctl stop poe-sync` logs `pnpm sync: stopped`, and
      `systemctl status poe-sync` shows `status=0/SUCCESS`, not a signal.
- [ ] With the PC off, a push from the Pi deploys a fresh `dataset.json` to Pages within one tick:
      the commit `chore(data): sync dataset` is on `master`, and the `deploy.yml` run for it passes.
- [ ] The drift guard aborts: `touch <repo-dir>/stray.txt`, run a tick, see status 3 and the path
      `stray.txt` in `journalctl -u poe-sync-tick`, see no new commit, then remove the file.
- [ ] No force-push: the only `git push` in `tick.sh` has no force flag, and the
      *Activity* page of the GitHub repository, filtered to force pushes, lists none.
- [ ] The service survives a reboot: `sudo reboot`, then `systemctl status poe-sync` is active and
      `systemctl list-timers` shows the next tick.
- [ ] The service survives a power cut: pull the power during an entry, restore it, and check that
      `poe-sync` is active and the next tick pushes. Also, either the JSON check of `dataset.json`
      passes, or it fails and the *Truncated `dataset.json`* recovery was done and recorded.
- [ ] The tick refreshes the rates: after a tick, `journalctl -u poe-sync-tick` shows
      `currencies:refresh: wrote` and no `WARNING`, the tick commit on `master` holds
      `data/currencies.json` with a fresh `asOf`, and `pnpm currencies:refresh` ran on the
      `--prod` install with no module-not-found error.
- [ ] `MemoryMax` has an effect: `cat /sys/fs/cgroup/system.slice/poe-sync.service/memory.max`
      prints `734003200`, not `max` and not an error.
