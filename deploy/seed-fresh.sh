#!/usr/bin/env bash
# Seed an EMPTY production database after the first deploy.
# Run ONCE, on the EC2 box, after deploy.sh has succeeded:
#   ADMIN_PHONE=9xxxxxxxxx ADMIN_PASSWORD='strong-pass' bash seed-fresh.sh
#   DEMO=1 ... bash seed-fresh.sh     # also load demo/sample data
set -euo pipefail
: "${ADMIN_PHONE:?set ADMIN_PHONE}"; : "${ADMIN_PASSWORD:?set ADMIN_PASSWORD}"
ADMIN_NAME=${ADMIN_NAME:-"Fixxer Admin"}
cd /opt/fixxer/fixer-backend
set -a; source .env; set +a          # MONGO_URI=mongodb://127.0.0.1:27017/fixxer

COUNT=$(docker exec fixxer-mongo mongosh fixxer --quiet --eval 'db.getCollectionNames().length')
if [ "$COUNT" != "0" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "!! Database 'fixxer' already has $COUNT collections. Several seeds wipe collections."
  echo "   Re-run with FORCE=1 only if you really mean it."; exit 1
fi

echo "==> 1/6 Admin user"
node seed-admin.js "$ADMIN_PHONE" "$ADMIN_PASSWORD" "$ADMIN_NAME"

echo "==> 2/6 Services catalog"
node seed-services.js

echo "==> 3/6 Spare parts (MARUTI_SPARE_2025.xlsx)"
node seed.js ./MARUTI_SPARE_2025.xlsx

echo "==> 4/6 AC appliances (ac-stock-2026.json + Cloudinary images)"
npm run ac:seed

echo "==> 5/6 Allowed technician pincodes"
npx ts-node -r tsconfig-paths/register -r dotenv/config src/scripts/seed-allowed-pincodes.ts

if [ "${DEMO:-0}" = "1" ]; then
  echo "==> extra: demo data"
  npm run seed:shop-catalog
  npm run seed:shop-appliances
  npm run seed:offers
fi

echo "==> 6/6 Rebuild category tree + Elasticsearch index via the API"
TOKEN=$(curl -fsS -X POST http://127.0.0.1:8081/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$ADMIN_PHONE\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).access_token))')
curl -fsS -X POST http://127.0.0.1:8081/api/v1/spare-parts/refresh-tree -H "Authorization: Bearer $TOKEN"; echo
if curl -fs http://127.0.0.1:9200 >/dev/null 2>&1; then
  curl -fsS -X POST http://127.0.0.1:8081/api/v1/spare-parts/sync-search -H "Authorization: Bearer $TOKEN"; echo
else
  echo "Elasticsearch not running → search uses the MongoDB fallback (skip sync-search)"
fi

echo "==> Counts"
docker exec fixxer-mongo mongosh fixxer --quiet --eval \
  'db.getCollectionNames().sort().forEach(c=>print(c.padEnd(28), db[c].countDocuments()))'
curl -s 'http://127.0.0.1:9200/_cat/indices?v' 2>/dev/null || true
echo "Done. Log in at https://<your-domain>/login with $ADMIN_PHONE"
