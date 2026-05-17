# AC stock ingestion pipeline

End-to-end flow for the 12 Godrej AC SKUs: scrape product images → upload to Cloudinary → merge URLs into `ac-stock-2026.json` → seed MongoDB.

## Prerequisites

- Node 20.x, MongoDB running locally (or `MONGO_URI` set)
- `fixxer-backend/.env` with Cloudinary + Mongo (see `.env.example`)
- Playwright browsers (once): `npx playwright install chromium`

## Security

**Rotate your Cloudinary credentials** if they were ever pasted in chat, email, or tickets. Never commit `.env`. Only placeholders belong in `.env.example`.

## Stock data

| File | Purpose |
|------|---------|
| `ac-stock-upload.json` | Raw stock table (item codes, NLC, star, type) |
| `../data/ac-stock-2026.json` | Full appliance seed documents (slugs, copy, specs) |
| `data/ac-cloudinary-manifest.json` | Generated after upload — SKU → Cloudinary URLs |

Slug/model mapping comes from `ac-stock-2026.json` (e.g. `18F5TG` → `godrej-1-5t-5s-inverter-split-18f5tg`).

## Image folders

Per SKU:

```
src/scripts/ac-pipeline/images/{itemCode}/
  01-hero.jpg
  02-gallery-01.jpg
  description-01.jpg
```

These folders are gitignored.

## Commands

| Command | Description |
|---------|-------------|
| `npm run ac:scrape -- --sku=40101701SD01777` | Scrape one SKU (Flipkart → Amazon) |
| `npm run ac:scrape -- --sku=... --product-url=https://...` | Scrape a known product URL |
| `npm run ac:scrape -- --sku=... --force` | Re-download even if folder has images |
| `npm run ac:upload` | Upload all SKU folders to Cloudinary |
| `npm run ac:upload -- --sku=40101701SD01777` | Upload one SKU |
| `npm run ac:merge` | Merge manifest into `ac-stock-2026.json` only |
| `npm run ac:seed` | Merge + `npm run seed:appliances` |
| `npm run ac:pipeline` | Full flow: scrape → upload → merge (no DB seed) |
| `npm run ac:pipeline -- --step=seed` | Run merge + seed only |

Cloudinary path: `{CLOUDINARY_FOLDER}/{slug}/` (default `fixxer/appliances/{slug}/`).

## Run all 12 SKUs in parallel

**Orchestrator (recommended):**

```bash
npm run ac:pipeline -- --step=scrape --parallel=3
npm run ac:upload
npm run ac:seed
```

**xargs (3 workers):**

```bash
jq -r '.items[].itemCode' src/scripts/ac-pipeline/ac-stock-upload.json | \
  xargs -P 3 -I {} npm run ac:scrape -- --sku={}
```

## Manual fallback when scraping fails

Flipkart/Amazon often block headless browsers. If a SKU fails:

1. Open the product page in a browser.
2. Save images into `images/{sku}/` using the naming convention above.
3. Run `npm run ac:upload -- --sku=...` then `npm run ac:merge`.

SKUs without Cloudinary URLs keep existing Unsplash placeholders; the merge step logs them clearly.

## Typical full pipeline

```bash
cd fixxer-backend
npx playwright install chromium
cp .env.example .env   # fill CLOUDINARY_* and MONGO_URI

npm run ac:pipeline -- --step=scrape --parallel=2
npm run ac:upload
npm run ac:seed
```

## Blockers

- **Flipkart / Amazon bot detection** — CAPTCHA, empty search results, or 403s are common. Use `--product-url` or manual image drops.
- **Godrej site** — not automated here; use marketplace URLs or brand assets manually.
- **Rate limits** — default 2.5s delay between hosts; increase with `--delay=5000` on scrape.
