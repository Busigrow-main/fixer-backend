# AC stock ingestion pipeline

Three-stage flow for the 12 Godrej AC SKUs: **scrape** → **verify** → **upload** → merge → seed.

## Prerequisites

- Node 20.x, MongoDB running locally (or `MONGO_URI` set)
- `fixxer-backend/.env` with Cloudinary + Mongo (see `.env.example`)
- Playwright browsers (once): `npx playwright install chromium`

## Security

**Rotate your Cloudinary credentials** if they were ever pasted in chat, email, or tickets. Never commit `.env`. Only placeholders belong in `.env.example`.

## Stock data

| File | Purpose |
|------|---------|
| `ac-stock-upload.json` | Raw stock table (item codes, NLC, star, type, optional `productUrl`) |
| `../data/ac-stock-2026.json` | Full appliance seed documents (slugs, copy, specs) |
| `data/ac-cloudinary-manifest.json` | Generated after upload — SKU → Cloudinary URLs |
| `data/verify-report.json` | Generated after verify — pass/fail per SKU |

Slug/model mapping comes from `ac-stock-2026.json` (e.g. `18F5TG` → `godrej-1-5t-5s-inverter-split-18f5tg`).

### Per-SKU product URLs (important)

Add a Flipkart or Amazon **product page URL** for each SKU in `ac-stock-upload.json`:

```json
{
  "itemCode": "40101701SD01777",
  "description": "AC 1.5T DS WIC 18F5TG WA",
  "productUrl": "https://www.flipkart.com/...",
  ...
}
```

Without `productUrl`, the scraper searches marketplaces and picks the first listing whose title contains the model code. Wrong or shared listings produce **identical images across SKUs** and **thumbnail-sized gallery files** after the fourth image.

## Image folders

Per SKU:

```
src/scripts/ac-pipeline/images/{itemCode}/
  01-hero.jpg
  02-gallery-01.jpg … 02-gallery-06.jpg
  description-01.jpg
```

These folders are gitignored. Gallery images should be ≥8 KB and ≥400×400 px (verify enforces this).

## Commands

| Command | Description |
|---------|-------------|
| `npm run ac:scrape -- --sku=40101701SD01777` | Scrape one SKU |
| `npm run ac:scrape -- --sku=... --product-url=https://...` | Scrape with CLI URL (single SKU only) |
| `npm run ac:scrape -- --sku=... --force` | Re-download even if folder has images |
| `npm run ac:scrape -- --limit=1 --force` | Re-scrape first SKU only (smoke test) |
| `npm run ac:verify` | Validate all SKU folders; writes `data/verify-report.json` |
| `npm run ac:verify -- --sku=...` | Verify one SKU |
| `npm run ac:verify -- --warn-only` | Report failures but exit 0 |
| `npm run ac:upload` | Upload verified SKU folders to Cloudinary |
| `npm run ac:merge` | Merge manifest into `ac-stock-2026.json` only |
| `npm run ac:seed` | Merge + `npm run seed:appliances` |
| `npm run ac:pipeline` | Full flow: scrape → verify → upload → seed |
| `npm run ac:pipeline -- --step=verify` | Verify only |
| `npm run ac:pipeline -- --skip-verify` | Scrape → upload → seed (not recommended) |

Cloudinary path: `{CLOUDINARY_FOLDER}/{slug}/` (default `fixxer/appliances/{slug}/`).

## Typical full pipeline

```bash
cd fixxer-backend
npx playwright install chromium

# 1. Add productUrl for each SKU in ac-stock-upload.json

# 2. Scrape (parallel) → verify → upload → seed
npm run ac:pipeline -- --step=scrape --parallel=2
npm run ac:verify
npm run ac:upload
npm run ac:seed
```

Or in one command (stops if verify fails):

```bash
npm run ac:pipeline
```

## Fixing failed SKUs

1. Open `data/verify-report.json` and find SKUs with `pass: false`.
2. Check errors: `file too small`, `dimensions too small`, or `duplicate hash across SKUs`.
3. Fix `productUrl` in `ac-stock-upload.json` for that model code.
4. Re-scrape and verify:

```bash
npm run ac:scrape -- --sku=40101701SD01801 --force
npm run ac:verify -- --sku=40101701SD01801
```

5. When verify passes for all SKUs, upload and seed.

## Run all 12 SKUs in parallel

```bash
npm run ac:pipeline -- --step=scrape --parallel=3
npm run ac:verify
npm run ac:upload
npm run ac:seed
```

## Manual fallback when scraping fails

Flipkart/Amazon often block headless browsers. If a SKU fails:

1. Open the correct product page in a browser.
2. Save full-size images into `images/{sku}/` using the naming convention above.
3. `npm run ac:verify -- --sku=...` then `npm run ac:upload -- --sku=...` then `npm run ac:merge`.

SKUs without Cloudinary URLs keep existing Unsplash placeholders; the merge step logs them clearly.

## Blockers

- **Missing/wrong `productUrl`** — causes duplicate heroes and tiny gallery-05+ thumbnails.
- **Flipkart / Amazon bot detection** — CAPTCHA, empty search results, or 403s. Use `productUrl` or manual image drops.
- **Rate limits** — default 2.5s delay between hosts/SKUs; increase with `--delay=5000` on scrape.
