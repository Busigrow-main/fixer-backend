#!/usr/bin/env bash
# Nightly MongoDB dump, kept 7 days locally (+ optional S3 copy).
# cron:  15 2 * * * /opt/fixxer/fixer-backend/deploy/backup-mongo.sh >> /var/log/fixxer/backup.log 2>&1
set -euo pipefail
TS=$(date +%F-%H%M)
OUT=/opt/fixxer/backups/fixxer-$TS.archive.gz
docker exec fixxer-mongo mongodump --db fixxer --archive --gzip > "$OUT"
find /opt/fixxer/backups -name 'fixxer-*.archive.gz' -mtime +7 -delete
# Optional off-box copy (needs an instance role with s3:PutObject):
# aws s3 cp "$OUT" "s3://YOUR-BUCKET/mongo/" --storage-class STANDARD_IA
echo "$(date -Is) backup ok: $OUT ($(du -h "$OUT" | cut -f1))"
