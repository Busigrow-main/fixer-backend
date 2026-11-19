#!/usr/bin/env bash
# One-time switch from the old in-place deploy to versioned releases + auto-deploy.
# Run as ubuntu (NOT sudo):  bash /opt/fixxer/fixer-backend/deploy/install-autodeploy.sh
set -euo pipefail
ROOT=/opt/fixxer
SRC=$(cd "$(dirname "$0")" && pwd)
[[ $(id -un) == ubuntu ]] || { echo "run as ubuntu, without sudo"; exit 1; }

mkdir -p "$ROOT"/{bin,shared,state,current,releases/backend,releases/frontend}
install -m755 "$SRC/fixxer-release.sh"    "$ROOT/bin/fixxer-release"
install -m755 "$SRC/fixxer-autodeploy.sh" "$ROOT/bin/fixxer-autodeploy"
install -m644 "$SRC/ecosystem.config.js" "$SRC/docker-compose.prod.yml" "$ROOT/bin/"
sudo ln -sfn "$ROOT/bin/fixxer-release" /usr/local/bin/fixxer-release

echo "==> Moving .env files to $ROOT/shared (one copy for every release)"
[[ -f $ROOT/shared/backend.env ]]            || cp "$ROOT/fixer-backend/.env"             "$ROOT/shared/backend.env"
[[ -f $ROOT/shared/frontend.env.production ]] || cp "$ROOT/fixer-frontend/.env.production" "$ROOT/shared/frontend.env.production"
chmod 600 "$ROOT"/shared/*.env* 

echo "==> First versioned build (old processes keep serving until each new build is healthy)"
fixxer-release deploy backend
fixxer-release deploy frontend

echo "==> Enabling auto-deploy timer"
sudo install -m644 "$SRC/systemd/fixxer-autodeploy.service" "$SRC/systemd/fixxer-autodeploy.timer" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fixxer-autodeploy.timer
systemctl list-timers fixxer-autodeploy.timer --no-pager
echo; fixxer-release status
