#!/usr/bin/env bash
# Publish tick of the sync host (AD-3): refresh rates, commit the tick-owned files, rebase,
# reinstall dependencies when the lockfile moved, and push. poe-sync-tick.service stops poe-sync
# around it. Usage: tick.sh <repo-dir>, or set POE_REPO_DIR. Runbook: ops/pi/README.md.
set -Eeuo pipefail

readonly RATES=data/currencies.json
readonly OWNED=(data/dataset.json data/sync-progress.json data/sync-report.json "$RATES")
readonly REMOTE=origin
readonly BRANCH=master
readonly SUBJECT='chore(data): sync dataset'

log() { printf 'tick: %s\n' "$*"; }
warn() { printf 'tick: WARNING: %s\n' "$*" >&2; }
die() {
  local code=$1
  shift
  printf 'tick: ERROR: %s\n' "$*" >&2
  exit "$code"
}
on_error() {
  local rc=$?
  printf 'tick: ERROR: line %s exited %s: %s\n' "$1" "$rc" "$BASH_COMMAND" >&2
}
trap 'on_error "$LINENO"' ERR

git_path() { git rev-parse --git-path "$1"; }

is_rebase_in_progress() {
  [[ -d $(git_path rebase-merge) || -d $(git_path rebase-apply) ]]
}

is_owned() {
  local candidate=$1 owned
  for owned in "${OWNED[@]}"; do
    [[ $candidate == "$owned" ]] && return 0
  done
  return 1
}

clear_leftovers() {
  local lock
  lock=$(git_path index.lock)
  if [[ -e $lock ]]; then
    if command -v pgrep >/dev/null && pgrep -u "$(id -u)" -x git >/dev/null; then
      die 2 "a git process is running, so $lock is not stale"
    fi
    log "removing the stale $lock"
    rm -f -- "$lock"
  fi
  if is_rebase_in_progress; then
    log 'aborting a half-done rebase'
    git rebase --abort
  fi
  # The refresh renames its temp file into place, so a power cut can leave it behind.
  if [[ -e $RATES.tmp ]]; then
    log "removing the stale $RATES.tmp"
    rm -f -- "$RATES.tmp"
  fi
}

check_branch() {
  local current
  current=$(git symbolic-ref --quiet --short HEAD) || die 2 'HEAD is detached'
  [[ $current == "$BRANCH" ]] || die 2 "on branch $current, expected $BRANCH"
}

# Nobody curates on the sync host, so any other dirty or untracked path is drift.
check_drift() {
  local listing line path drift=0
  listing=$(git status --porcelain=v1 -z --untracked-files=all --no-renames | tr '\0' '\n')
  while IFS= read -r line; do
    [[ -n $line ]] || continue
    path=${line:3}
    if ! is_owned "$path"; then
      printf 'tick: ERROR: dirty path outside the tick-owned list: %s\n' "$path" >&2
      drift=1
    fi
  done <<<"$listing"
  ((drift == 0)) || die 3 'drift guard: clean the paths above by hand; nothing was committed'
}

# A failed refresh keeps the committed rates, so the sync data still publishes.
refresh_currencies() {
  if pnpm currencies:refresh; then
    return 0
  fi
  warn "pnpm currencies:refresh failed; restoring $RATES from HEAD"
  git checkout HEAD -- "$RATES"
}

commit_owned() {
  git add -- "${OWNED[@]}"
  if git diff --cached --quiet; then
    log 'no change in the tick-owned files, so no commit'
  else
    git commit --quiet -m "$SUBJECT"
    log "committed $(git rev-parse --short HEAD)"
  fi
}

pull_rebase() {
  if ! git pull --rebase --no-autostash "$REMOTE" "$BRANCH"; then
    if is_rebase_in_progress; then
      git rebase --abort
    fi
    die 4 'git pull --rebase failed; the local commit stays for the next tick'
  fi
}

push() {
  git push --no-verify "$REMOTE" "$BRANCH" || die 5 'git push failed; the local commit stays for the next tick'
}

# The stamp holds the lockfile blob that was last installed, so a failed install retries next tick.
# A missing stamp means the runbook's install of the current checkout.
seed_install_stamp() {
  local stamp
  stamp=$(git_path poe-tick-installed-lockfile)
  [[ -f $stamp ]] || git rev-parse HEAD:pnpm-lock.yaml >"$stamp"
}

install_if_lockfile_changed() {
  local stamp current
  stamp=$(git_path poe-tick-installed-lockfile)
  current=$(git rev-parse HEAD:pnpm-lock.yaml)
  [[ $(<"$stamp") == "$current" ]] && return 0
  log 'pnpm-lock.yaml changed; running pnpm install --prod --frozen-lockfile'
  # Without a TTY, pnpm aborts a node_modules purge (after a pnpm major bump) that asks to confirm.
  pnpm install --prod --frozen-lockfile --config.confirm-modules-purge=false ||
    die 6 'pnpm install failed; the next tick retries it'
  printf '%s\n' "$current" >"$stamp"
}

main() {
  local repo_dir=${1:-${POE_REPO_DIR:-}}
  [[ -n $repo_dir ]] || die 2 'usage: tick.sh <repo-dir>, or set POE_REPO_DIR'
  cd -- "$repo_dir" 2>/dev/null || die 2 "$repo_dir is not a directory"
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die 2 "$repo_dir is not a git work tree"

  clear_leftovers
  check_branch
  check_drift
  refresh_currencies
  seed_install_stamp
  commit_owned
  pull_rebase
  # Before the push, so a failed push does not leave the pulled code on the old node_modules.
  install_if_lockfile_changed
  push
  log 'done'
}

main "$@"
