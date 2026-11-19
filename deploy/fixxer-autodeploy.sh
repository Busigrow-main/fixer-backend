#!/usr/bin/env bash
# Run by fixxer-autodeploy.timer every 2 min: deploy any new commit on origin/main.
# Skips an app that is pinned (after a manual rollback) or whose newest commit already failed.
set -uo pipefail
ROOT=/opt/fixxer
exec 9>"$ROOT/.deploy.lock"
flock -n 9 || exit 0            # a deploy is already running
export FIXXER_LOCKED=1

for app in backend frontend; do
  [[ -f $ROOT/state/$app.pinned ]] && continue
  repo=$ROOT/fixer-$app
  git -C "$repo" fetch --quiet origin main 2>/dev/null || { echo "[$app] fetch failed"; continue; }
  sha=$(git -C "$repo" rev-parse origin/main)
  live=$(cat "$ROOT/current/$app/.release-sha" 2>/dev/null || true)
  [[ $sha == "$live" ]] && continue
  [[ $sha == "$(cat "$ROOT/state/$app.failed" 2>/dev/null)" ]] && continue
  "$ROOT/bin/fixxer-release" deploy "$app" "$sha" || true
done
