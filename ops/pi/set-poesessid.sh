#!/usr/bin/env bash
# Writes the operator's POESESSID (AD-30) into the sync host's .env and restarts poe-sync.
# The human runs it: ssh -t <pi-user>@<pi-host>.local <repo-dir>/ops/pi/set-poesessid.sh
# The value comes from stdin and never reaches argv, the terminal or the log.
set -euo pipefail
set +x

repo_dir=${1:-${POE_REPO_DIR:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)}}
env_file="$repo_dir/.env"

value=''
IFS= read -rs -p 'POESESSID (input hidden): ' value || true
printf '\n' >&2
value=${value%$'\r'}
if [[ -z $value || $value =~ [[:space:]] ]]; then
  printf 'set-poesessid: the value is empty or holds whitespace; .env is unchanged\n' >&2
  exit 1
fi

source_file=/dev/null
if [[ -f $env_file ]]; then
  source_file=$env_file
else
  printf 'set-poesessid: %s did not exist; it now holds only POESESSID, so add POE_SYNC_USER_AGENT\n' "$env_file" >&2
fi

umask 077
tmp=$(mktemp "$repo_dir/.env.XXXXXX")
trap 'rm -f -- "$tmp"' EXIT
POE_NEW_VALUE=$value awk '
  /^POESESSID=/ { if (!done) { print "POESESSID=" ENVIRON["POE_NEW_VALUE"]; done = 1 } next }
  { print }
  END { if (!done) print "POESESSID=" ENVIRON["POE_NEW_VALUE"] }
' "$source_file" >"$tmp"
chmod 600 "$tmp"
mv -f -- "$tmp" "$env_file"
trap - EXIT
printf 'set-poesessid: POESESSID written to %s (mode 600)\n' "$env_file" >&2

# A running tick starts poe-sync at its end, and that start reads the new .env. A running oneshot
# is "activating", which is-active does not report as active.
tick_state=$(systemctl show -p ActiveState --value poe-sync-tick.service 2>/dev/null || true)
if [[ $tick_state == activating || $tick_state == active ]]; then
  printf 'set-poesessid: a tick is running; it starts poe-sync with the new value when it ends\n' >&2
else
  sudo systemctl try-restart --no-block poe-sync.service
  printf 'set-poesessid: if poe-sync was running, it restarts once the current entry finishes; watch journalctl -u poe-sync -f\n' >&2
fi
