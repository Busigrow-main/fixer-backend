#!/usr/bin/env bash
# Fixxer release manager — versioned, atomic deploys with health-checked auto-rollback.
#
#   fixxer-release deploy   <backend|frontend|all> [git-ref]   default ref: origin/main
#   fixxer-release rollback <backend|frontend> [release-id]    default: release before current
#   fixxer-release unpin    <backend|frontend>                 resume auto-deploy after a rollback
#   fixxer-release list     <backend|frontend>
#   fixxer-release status
#
# Layout:
#   /opt/fixxer/releases/<app>/<YYYYmmdd-HHMMSS>-<sha7>/   one folder per build
#   /opt/fixxer/current/<app>  -> symlink to the live release (PM2 runs from here)
#   /opt/fixxer/shared/        .env files (symlinked into every release)
#   /opt/fixxer/state/         <app>.failed (sha that failed) / <app>.pinned (auto-deploy paused)
set -euo pipefail

ROOT=/opt/fixxer
BIN=$ROOT/bin
LOG=/var/log/fixxer/deploy.log
KEEP=${KEEP_RELEASES:-3}
[[ -f $ROOT/shared/ops.env ]] && source "$ROOT/shared/ops.env"   # e.g. ENABLE_SEARCH=1

declare -A REPO=( [backend]=$ROOT/fixer-backend [frontend]=$ROOT/fixer-frontend )
declare -A PM2N=( [backend]=fixxer-api [frontend]=fixxer-web )
declare -A HEALTH=( [backend]=http://127.0.0.1:8081/api/v1/services [frontend]=http://127.0.0.1:3000/ )

mkdir -p "$ROOT"/{releases/backend,releases/frontend,current,state,shared} "$(dirname "$LOG")"

log() { echo "$(date '+%F %T') [$1] ${*:2}" | tee -a "$LOG"; }
die() { log "${1}" "ERROR: ${*:2}"; exit 1; }
valid_app() { [[ ${REPO[$1]+x} ]] || { echo "app must be backend or frontend"; exit 2; }; }

current_release() { local t; t=$(readlink -f "$ROOT/current/$1" 2>/dev/null) && [[ -d $t ]] && basename "$t" || true; }
releases() { ls -1 "$ROOT/releases/$1" 2>/dev/null | sort; }

lock() {
  [[ -n ${FIXXER_LOCKED:-} ]] && return 0
  exec 9>"$ROOT/.deploy.lock"
  flock -w 3600 9 || { echo "another deploy is running"; exit 1; }
  export FIXXER_LOCKED=1
}

health_check() {
  local url=${HEALTH[$1]} i
  for i in $(seq 1 30); do
    curl -fsS -o /dev/null --max-time 5 "$url" && return 0
    sleep 3
  done
  return 1
}

pm2_switch() {   # (re)start the PM2 app so it runs from current/<app>
  local app=$1 name=${PM2N[$1]}
  if pm2 describe "$name" 2>/dev/null | grep -q "exec cwd.*$ROOT/current/$app"; then
    pm2 reload "$BIN/ecosystem.config.js" --only "$name" --update-env >/dev/null
  else
    pm2 delete "$name" >/dev/null 2>&1 || true
    pm2 start "$BIN/ecosystem.config.js" --only "$name" >/dev/null
  fi
  pm2 save >/dev/null
}

switch_to() {
  local app=$1 rel=$2
  ln -sfn "$ROOT/releases/$app/$rel" "$ROOT/current/.$app.tmp"
  mv -Tf "$ROOT/current/.$app.tmp" "$ROOT/current/$app"
  pm2_switch "$app"
}

build_release() {   # runs inside the new release dir
  local app=$1
  case $app in
    backend)
      ln -sfn "$ROOT/shared/backend.env" .env
      [[ ${SKIP_CI:-0} == 1 ]] || npm ci --no-audit --no-fund
      npm run build
      ;;
    frontend)
      ln -sfn "$ROOT/shared/frontend.env.production" .env.production
      [[ ${SKIP_CI:-0} == 1 ]] || npm ci --no-audit --no-fund
      NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1536 npm run build
      ;;
  esac
}

prune() {
  local app=$1 cur r; cur=$(current_release "$app")
  { releases "$app" | grep -vx "${cur:-none}" | head -n -$((KEEP - 1)) || true; } | while read -r r; do
    [[ -n $r ]] || continue
    rm -rf "${ROOT:?}/releases/$app/$r"; log "$app" "pruned old release $r"
  done
  return 0
}

data_services() {
  local args=()
  [[ ${ENABLE_SEARCH:-0} == 1 ]] && args=(--profile search)
  docker compose -f "$BIN/docker-compose.prod.yml" -p fixxer "${args[@]}" up -d >/dev/null 2>&1 \
    || log ops "WARNING: docker compose up failed"
}

self_update() {   # after a good backend deploy, refresh the ops scripts from that release
  local d=$ROOT/releases/backend/$1/deploy
  [[ -d $d ]] || return 0
  install -m755 "$d/fixxer-release.sh" "$BIN/fixxer-release"
  install -m755 "$d/fixxer-autodeploy.sh" "$BIN/fixxer-autodeploy"
  install -m644 "$d/ecosystem.config.js" "$d/docker-compose.prod.yml" "$BIN/"
}

deploy_app() {
  local app=$1 ref=${2:-origin/main}
  local repo=${REPO[$app]}
  git -C "$repo" fetch --quiet origin || die "$app" "git fetch failed"
  local sha; sha=$(git -C "$repo" rev-parse --verify "${ref}^{commit}" 2>/dev/null) || die "$app" "unknown ref '$ref'"
  local short=${sha:0:7} cur; cur=$(current_release "$app")
  if [[ ${cur##*-} == "$short" && ${FORCE:-0} != 1 ]]; then
    log "$app" "already live on $short — nothing to do (FORCE=1 to rebuild)"; return 0
  fi

  local id; id="$(date +%Y%m%d-%H%M%S)-$short"
  local dir=$ROOT/releases/$app/$id
  log "$app" "building $id — $(git -C "$repo" log -1 --format='%s (%an)' "$sha")"
  mkdir -p "$dir"
  git -C "$repo" archive "$sha" | tar -x -C "$dir"
  echo "$sha" > "$dir/.release-sha"

  SKIP_CI=0
  if [[ -n $cur && -d $ROOT/releases/$app/$cur/node_modules ]] \
     && cmp -s "$dir/package-lock.json" "$ROOT/releases/$app/$cur/package-lock.json"; then
    cp -al "$ROOT/releases/$app/$cur/node_modules" "$dir/node_modules"   # hard-link: fast, no extra disk
    SKIP_CI=1
  fi

  if ! (cd "$dir" && SKIP_CI=$SKIP_CI build_release "$app") 2>&1 | tee -a "$LOG"; then
    rm -rf "$dir"
    echo "$sha" > "$ROOT/state/$app.failed"
    log "$app" "BUILD FAILED for $short — site still serving ${cur:-nothing}. Details above in $LOG"
    return 1
  fi

  [[ $app == backend ]] && data_services
  switch_to "$app" "$id"
  if health_check "$app"; then
    rm -f "$ROOT/state/$app.failed"
    log "$app" "LIVE: $id"
    [[ $app == backend ]] && self_update "$id"
    prune "$app"
  else
    log "$app" "HEALTH CHECK FAILED for $id (${HEALTH[$app]})"
    echo "$sha" > "$ROOT/state/$app.failed"
    pm2 logs "${PM2N[$app]}" --nostream --lines 30 2>&1 | tee -a "$LOG" || true
    if [[ -n $cur ]]; then
      switch_to "$app" "$cur"
      health_check "$app" && log "$app" "AUTO-ROLLED BACK to $cur" || log "$app" "rollback to $cur ALSO unhealthy — check pm2 logs"
      rm -rf "$dir"   # never keep a release that failed its health check
    fi
    return 1
  fi
}

rollback_app() {
  local app=$1 target=${2:-} cur; cur=$(current_release "$app")
  if [[ -z $target ]]; then
    target=$(releases "$app" | awk -v c="$cur" '$0 < c' | tail -1)
  fi
  [[ -n $target ]] || die "$app" "no earlier release to roll back to (see: fixxer-release list $app)"
  [[ -d $ROOT/releases/$app/$target ]] || die "$app" "no such release '$target'"
  switch_to "$app" "$target"
  touch "$ROOT/state/$app.pinned"
  if health_check "$app"; then
    log "$app" "ROLLED BACK $cur -> $target. Auto-deploy PAUSED for $app (run: fixxer-release unpin $app)"
  else
    log "$app" "rolled back to $target but health check fails — check: pm2 logs ${PM2N[$app]}"; return 1
  fi
}

list_app() {
  local cur r; cur=$(current_release "$1")
  for r in $(releases "$1"); do
    local sha; sha=$(cat "$ROOT/releases/$1/$r/.release-sha" 2>/dev/null || echo "")
    printf '%s %s  %s\n' "$([[ $r == "$cur" ]] && echo '*' || echo ' ')" "$r" \
      "$(git -C "${REPO[$1]}" log -1 --format=%s "$sha" 2>/dev/null)"
  done
}

status() {
  local app
  for app in backend frontend; do
    local cur; cur=$(current_release "$app")
    echo "== $app: ${cur:-<none>}"
    [[ -f $ROOT/state/$app.pinned ]] && echo "   auto-deploy: PAUSED (after rollback) — fixxer-release unpin $app"
    [[ -f $ROOT/state/$app.failed ]] && echo "   last failed commit: $(cut -c1-7 "$ROOT/state/$app.failed") (skipped until a new commit lands)"
    git -C "${REPO[$app]}" fetch --quiet origin 2>/dev/null || true
    local head; head=$(git -C "${REPO[$app]}" rev-parse --short origin/main 2>/dev/null || echo '?')
    echo "   origin/main: $head"
  done
  echo; pm2 status
  echo; tail -n 8 "$LOG" 2>/dev/null || true
}

cmd=${1:-status}; shift || true
case $cmd in
  deploy)
    target=${1:?usage: fixxer-release deploy <backend|frontend|all> [ref]}
    lock
    if [[ $target == all ]]; then
      rc=0; deploy_app backend "${2:-origin/main}" || rc=1; deploy_app frontend "${2:-origin/main}" || rc=1; exit $rc
    fi
    valid_app "$target"; rm -f "$ROOT/state/$target.pinned"; deploy_app "$target" "${2:-origin/main}"
    ;;
  rollback) valid_app "${1:?app}"; lock; rollback_app "$1" "${2:-}" ;;
  unpin)    valid_app "${1:?app}"; rm -f "$ROOT/state/$1.pinned"; echo "auto-deploy resumed for $1" ;;
  list)     valid_app "${1:?app}"; list_app "$1" ;;
  status)   status ;;
  *) sed -n '2,10p' "$0"; exit 2 ;;
esac
