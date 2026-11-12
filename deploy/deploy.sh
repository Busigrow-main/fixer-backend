#!/usr/bin/env bash
# Build + (re)start everything. Safe to rerun for every release.
# Usage: bash /opt/fixxer/fixer-backend/deploy/deploy.sh [backend|frontend|all]
set -euo pipefail
TARGET=${1:-all}
ROOT=/opt/fixxer
DEPLOY="$ROOT/fixer-backend/deploy"

# ENABLE_SEARCH=1 → also run Elasticsearch (needs ≥4 GB RAM). MONGO_CACHE_GB defaults to 0.25.
ENABLE_SEARCH=${ENABLE_SEARCH:-0}
PROFILE_ARGS=(); [[ $ENABLE_SEARCH == 1 ]] && PROFILE_ARGS=(--profile search)

echo "==> Data services (search=$ENABLE_SEARCH)"
docker compose -f "$DEPLOY/docker-compose.prod.yml" -p fixxer "${PROFILE_ARGS[@]}" up -d
echo -n "waiting for data services "
for i in $(seq 1 60); do
  if docker exec fixxer-mongo mongosh --quiet --eval 'db.adminCommand("ping").ok' >/dev/null 2>&1; then
    if [[ $ENABLE_SEARCH != 1 ]] || curl -fs http://127.0.0.1:9200/_cluster/health >/dev/null; then echo " ok"; break; fi
  fi
  echo -n "."; sleep 3
done

if [[ $TARGET == all || $TARGET == backend ]]; then
  echo "==> Backend"
  cd "$ROOT/fixer-backend"
  git pull --ff-only
  test -f .env || { echo "missing fixer-backend/.env"; exit 1; }
  npm ci
  npm run build
  # devDependencies kept on purpose: seed scripts need ts-node + dotenv
fi

if [[ $TARGET == all || $TARGET == frontend ]]; then
  echo "==> Frontend"
  cd "$ROOT/fixer-frontend"
  git pull --ff-only
  test -f .env.production || { echo "missing fixer-frontend/.env.production"; exit 1; }
  npm ci
  # NEXT_PUBLIC_* values are baked in at build time from .env.production
  NODE_OPTIONS=--max-old-space-size=1536 npm run build   # uses swap on a 2 GB box; slow but fine
fi

echo "==> Restart apps"
pm2 startOrReload "$DEPLOY/ecosystem.config.js" --update-env
pm2 save

sleep 5
echo "==> Smoke test"
curl -fsS -o /dev/null -w "api  %{http_code}\n" http://127.0.0.1:8081/api/v1/services || echo "api check FAILED"
curl -fsS -o /dev/null -w "web  %{http_code}\n" http://127.0.0.1:3000/ || echo "web check FAILED"
pm2 status
