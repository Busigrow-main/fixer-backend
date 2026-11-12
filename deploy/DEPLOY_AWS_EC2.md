# Fixxer — single-EC2 deployment (AWS Mumbai)

> **Fresh deployment.** The Azure VM (135.222.40.140) is gone, so this starts with an empty database seeded from the repo's scripts (§8).
> Your local `.env` used to tunnel into that VM's MongoDB, so production data (users, bookings, orders) is lost **unless** the VM's Azure managed disk or a snapshot still exists. Check Azure Portal → Disks before you give up on it (see §8, *Recovering old data*).

Everything (Next.js frontend, NestJS API, MongoDB, Elasticsearch, Nginx + TLS) runs on **one EC2 instance**.

```
                Internet
                   │  80 / 443
            ┌──────▼──────────────────────────── EC2 t4g.large (Ubuntu 24.04, arm64) ─┐
            │  Nginx + Let's Encrypt                                                    │
            │   ├─ /api/*, /v1/*  ──► NestJS  127.0.0.1:8081   (PM2: fixxer-api)        │
            │   └─ /*             ──► Next.js 127.0.0.1:3000   (PM2: fixxer-web)        │
            │                                                                           │
            │  Docker (localhost only)                                                  │
            │   ├─ mongo:7              127.0.0.1:27017   → /opt/fixxer/data/mongo      │
            │   └─ elasticsearch:8.13.4 127.0.0.1:9200    → /opt/fixxer/data/es         │
            └───────────────────────────────────────────────────────────────────────────┘
   External (unchanged): Cloudinary (images), Azure Communication Services (email OTP), Google Sign-In
```

The frontend calls the API on the **same domain** (`https://yourdomain/api/v1`), so you get no CORS problems and no mixed-content errors.

---

## 1. Sizing calculation

What the code needs (from `package.json`, `docker-compose.yml`, `main.ts`):

| Component | Why it's there | Steady RAM | Notes |
|---|---|---|---|
| Elasticsearch 8.13 | `SparePartsModule → SearchModule` (spare-part search) | **~1.6 GB** | 1 GB JVM heap plus off-heap/page cache. The biggest consumer. |
| MongoDB 7 | All data (Mongoose) | **~1.3 GB** | WiredTiger cache capped at 1 GB in the compose file |
| NestJS API | 22 modules, pdfkit, exceljs, `@Cron` every 5 min | ~300–450 MB | A single instance, so the cron job doesn't run twice |
| Next.js 16 SSR | `next start` | ~250–400 MB | |
| Ubuntu + Docker + Nginx + PM2 | | ~500 MB | |
| **Steady total** | | **≈ 4.0–4.3 GB** | |
| Build spike (`next build` / `nest build`) | Runs on the same box at deploy time | +1.5–2 GB | The 2 GB swap file is the safety net |

**Peak ≈ 6 GB → an 8 GB instance is the right size.** A 4 GB box can run it with ES at a 512 MB heap and Mongo at a 0.5 GB cache, but builds will swap heavily and may hit OOM.

CPU: the load is light (an API backed by a DB, with ES idle most of the time). 2 vCPUs are enough. t4g's baseline is 30% per vCPU, and a moderate-traffic launch stays under that. Builds use burst credits.

Disk: OS + Docker images (~3 GB for ES and Mongo) + node_modules + builds (~2 GB) + data + 7 days of local Mongo dumps + logs → **40 GB gp3** gives you plenty of headroom.

### Recommended: **t4g.large** (2 vCPU, 8 GB, Graviton/arm64), region **ap-south-1 (Mumbai)**

- Mumbai is closest to your users in India.
- Mongo 7, ES 8.13, Node 20 and `bcrypt` all have arm64 builds, so nothing changes in your code.
- In Mumbai, t4g.large costs **half as much** as the x86 t3.large ($0.0448/hr vs $0.0896/hr).

---

## 2. Monthly cost (on-demand, 730 hrs, USD)

| Item | Calculation | t4g.medium (4 GB, tight) | **t4g.large (8 GB, recommended)** | t4g.xlarge (16 GB, growth) |
|---|---|---|---|---|
| EC2 | $/hr × 730 | $16.35 | **$32.70** | $65.41 |
| EBS gp3 40 GB | 40 × $0.0912 | $3.65 | **$3.65** | $3.65 |
| Public IPv4 / Elastic IP | $0.005/hr × 730 | $3.65 | **$3.65** | $3.65 |
| EBS snapshots (daily, keep 7) | ~20 GB incremental × $0.05 | ~$1 | **~$1** | ~$1 |
| Data transfer out | First 100 GB/month is free | $0 | **$0** | $0 |
| **Subtotal** | | **$24.65** | **$41.00** | **$73.71** |
| + 18% GST (AWS India invoice) | | $29.09 | **$48.38** | $86.97 |
| ≈ INR (at ~₹88/$) | | ~₹2,560 | **~₹4,260** | ~₹7,650 |

Ways to save:
- **1-year Savings Plan or Reserved Instance (no upfront)** on t4g.large: about $20.66/month for EC2, bringing the subtotal to **≈ $29/month (~$34 with GST)**, roughly 30% cheaper. Buy it after the first month, once you've confirmed the size is right.
- Optional extras: Route 53 hosted zone costs $0.50/month (or keep your current DNS provider). S3 for off-box Mongo backups costs a few cents a month.
- Turn on **AWS Budgets** with an alert at $55 so you hear about a surprise (e.g. T-unlimited CPU surcharge or data transfer above 100 GB) early.

---

## 3. AWS console setup (one-time, ~15 min)

1. **Region**: Asia Pacific (Mumbai) `ap-south-1`.
2. **Launch instance**
   - AMI: **Ubuntu Server 24.04 LTS (64-bit Arm)**
   - Type: **t4g.large**
   - Key pair: create one (e.g. `fixxer-prod.pem`) and keep it safe
   - Storage: **40 GB gp3**, *Delete on termination* = **off**
   - Credit specification: **Standard** (avoids unlimited-mode charges; switch to Unlimited if you see CPU throttling)
3. **Security group** `fixxer-prod-sg`, inbound rules:
   | Port | Source |
   |---|---|
   | 22 | **My IP only** |
   | 80 | 0.0.0.0/0, ::/0 |
   | 443 | 0.0.0.0/0, ::/0 |

   Do **not** open 27017, 9200, 3000 or 8081.
4. **Elastic IP**: allocate one and associate it with the instance.
5. **DNS**: add `A  yourdomain.com → <Elastic IP>` and `A  www → <Elastic IP>`. Wait for it to resolve before running certbot.
6. **Backups**: EC2 → Lifecycle Manager → policy on the instance's volume, daily, retain 7.
7. (Optional) Attach an IAM role with `s3:PutObject` on a backup bucket if you want off-box Mongo dumps.

---

## 4. Put the deploy files in the repo

Commit the `deploy/` folder in **fixer-backend** (the scripts expect it at `/opt/fixxer/fixer-backend/deploy`) and push it.

Make sure these are in `.gitignore` and never committed: `.env`, `.env.production`, `.env.local`.

---

## 5. Bootstrap the server

```bash
ssh -i fixxer-prod.pem ubuntu@<ELASTIC_IP>

# Give the box read access to your GitHub repos (deploy key)
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub     # add as a Deploy key on BOTH repos (read-only)

# Get the setup script (from the repo, or scp it up), then:
curl -o setup-ec2.sh <raw URL of deploy/setup-ec2.sh>   # or scp
sudo DOMAIN=yourdomain.com EMAIL=you@yourdomain.com \
     BACKEND_REPO=git@github.com:<you>/fixer-backend.git \
     FRONTEND_REPO=git@github.com:<you>/fixer-frontend.git \
     bash setup-ec2.sh
exit   # log back in so the docker group applies
```

The script installs Docker, Node 20, PM2, Nginx and Certbot. It sets up 2 GB swap and `vm.max_map_count=262144` (Elasticsearch won't start without it), enables the UFW firewall, clones both repos, configures Nginx and issues a TLS certificate.

## 6. Environment files

```bash
cd /opt/fixxer
cp fixer-backend/deploy/env.backend.production.example  fixer-backend/.env
cp fixer-backend/deploy/env.frontend.production.example fixer-frontend/.env.production
nano fixer-backend/.env            # fill in secrets, set your domain
nano fixer-frontend/.env.production
chmod 600 fixer-backend/.env fixer-frontend/.env.production
```

Settings to double-check:
- `NODE_ENV=production`. In production, `main.ts` allows **only** the origins listed in `CORS_ORIGIN` (no localhost fallback), so `CORS_ORIGIN` must contain `https://yourdomain.com,https://www.yourdomain.com`.
- `NEXT_PUBLIC_API_URL=https://yourdomain.com/api/v1`. This value is **baked in at build time**, so rebuild the frontend whenever you change it.
- Generate a **new** `FIXXER_CODE_KEY` (`openssl rand -base64 32`), a new `JWT_SECRET` and a new `DEFAULT_CUSTOMER_PASSWORD`. The database is empty, so there are no old codes or sessions to keep working.
- Set `ALLOW_ALL_PINCODES=false` once the pincodes are seeded.
- Cloudinary, Azure Communication Services (email OTP) and Google Sign-In are cloud services, not part of the dead VM, so your existing keys still work. Copy them from your local `.env`.
- In Google Cloud Console, add `https://yourdomain.com` to the OAuth client's **Authorized JavaScript origins**.

## 7. First deploy

```bash
bash /opt/fixxer/fixer-backend/deploy/deploy.sh          # everything
bash /opt/fixxer/fixer-backend/deploy/deploy.sh backend  # API only
bash /opt/fixxer/fixer-backend/deploy/deploy.sh frontend # web only
```

The script starts Mongo and ES and waits for them to be healthy. Then it runs `git pull`, `npm ci` and the build, does a zero-downtime `pm2 reload`, and finishes with a smoke test. Swagger is at `https://yourdomain.com/api/docs`.

## 8. Seed the empty database (first deploy only)

```bash
cd /opt/fixxer/fixer-backend/deploy
chmod +x *.sh
ADMIN_PHONE=9xxxxxxxxx ADMIN_PASSWORD='a-strong-password' bash seed-fresh.sh
# add DEMO=1 to also load the sample shop catalog, shop appliances and offers
```

The script refuses to run if the database already has collections. Several seeds `deleteMany()` first, so this protects you from wiping live data later.

| Step | Script | Loads |
|---|---|---|
| 1 | `seed-admin.js` | Admin user (phone + password you pass) |
| 2 | `seed-services.js` | Services catalog |
| 3 | `seed.js MARUTI_SPARE_2025.xlsx` | Spare-parts catalog |
| 4 | `npm run ac:seed` | AC appliances from `ac-stock-2026.json` with Cloudinary images |
| 5 | `seed-allowed-pincodes.ts` | 29 Patna pincodes (800001–800029) for technician onboarding |
| 6 | `POST /api/v1/spare-parts/refresh-tree` + `sync-search` | Category tree + Elasticsearch index |

Deliberately left out: `seed-spare-parts.js` and `seed-spare-parts-v2.js` (each wipes and replaces the spare parts with a small sample), `seed-5000-parts.js` (generated fake parts) and `seed-technicians.js` (fake technicians). Run any of them by hand if you want them.

Afterwards, log in as the admin. Add real serviceable pincodes, technicians and offers from the admin panel.

### Recovering old data (if the Azure disk survived)

If Azure Portal still lists the VM's OS or data disk (or a snapshot of it), you can still get the data back:
1. Create a new small Azure VM from that disk (or attach the disk to one).
2. Find the Mongo volume, e.g. `/var/lib/docker/volumes/*mongo*/_data`, and start a temporary `mongo:7` container on it.
3. Run `mongodump --db fixxer --archive --gzip > fixxer.archive.gz`, then copy the file to EC2.
4. On EC2, **instead of** running `seed-fresh.sh`, restore the dump with `docker exec -i fixxer-mongo mongorestore --archive --gzip --drop < fixxer.archive.gz`. Then run step 6 of the table above (sync-search) so search works.
5. In that case put the **old** `FIXXER_CODE_KEY` (from your local `.env`) in the server's `.env`, so existing codes still decrypt.

## 9. Backups and housekeeping

```bash
crontab -e
15 2 * * * /opt/fixxer/fixer-backend/deploy/backup-mongo.sh >> /var/log/fixxer/backup.log 2>&1
```

- Mongo dumps are kept for 7 days in `/opt/fixxer/backups`. Uncomment the `aws s3 cp` line in the script for an off-box copy.
- The DLM EBS snapshots (§3 step 6) cover the whole disk.
- Rotate logs with `pm2 install pm2-logrotate`.
- Certbot renews TLS automatically. Test it with `sudo certbot renew --dry-run`.

## 10. Day-to-day commands

```bash
pm2 status | pm2 logs fixxer-api | pm2 logs fixxer-web
docker ps ; docker logs -f fixxer-elasticsearch
free -h ; df -h
curl -s localhost:9200/_cluster/health?pretty
```

## 11. When to scale off one box

Move up to **t4g.xlarge** (a stop/start that changes the instance type, about 2 minutes of downtime) when any of these happen:
- `free -h` regularly shows swap use above 500 MB
- CPU credit balance keeps going down (CloudWatch → `CPUCreditBalance`)
- p95 API latency goes above ~500 ms

After that, the next step is moving Mongo to Atlas and ES to a managed service, which leaves the box stateless.

---

## Things in the code to fix before going live

1. **A real-looking `FIXXER_CODE_KEY` is committed in `fixer-backend/.env.example`.** Replace it with a placeholder. If that value is the live production key, treat it as leaked. Rotating it invalidates existing codes, so plan for that.
2. `docs/local-production-database.md` and the comments in `.env` describe the Azure SSH tunnel, which no longer exists. Point local development at a local Mongo (`docker compose up -d mongo`, `MONGO_URI=mongodb://127.0.0.1:27017/fixxer`), **not** at the new production box.
3. `src/common/swagger.ts` hard-codes the Azure IP `http://135.222.40.140` as the "Production" server. Change it to `https://yourdomain.com`, or read it from `APP_PUBLIC_URL`.
4. `.env.example` sets `APP_PUBLIC_URL` to the Azure IP. On EC2, use `https://yourdomain.com`.
5. Technician routes live under `/v1/*` (not `/api/v1`). The Nginx config already proxies them. Point the technician app's base URL at `https://yourdomain.com`.
