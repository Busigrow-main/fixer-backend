/**
 * Scrape product + description images for one or more AC SKUs.
 * Run: npm run ac:scrape -- --sku=40101701SD01777
 *      npm run ac:scrape -- --sku=40101701SD01777 --product-url=https://...
 *      npm run ac:scrape -- --limit=1 --force
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, type Page } from 'playwright';
import { getArg, getArgNumber, parseArgs } from './lib/cli';
import { downloadImage, extFromUrl, normalizeImageUrl, sleep } from './lib/download';
import { filterAndRankImageUrls } from './lib/image-urls';
import { validateImageFile } from './lib/image-meta';
import { ENV_PATH, skuImageDir } from './lib/paths';
import { filterBySku, loadStockUpload } from './lib/stock';
import { MAX_GALLERY_IMAGES } from './lib/verify-images';
import type { ParsedStockItem } from './lib/types';

dotenv.config({ path: ENV_PATH });

const RATE_LIMIT_MS = getArgNumber(parseArgs(process.argv), 'delay', 2500);
const MIN_GALLERY_BYTES = 8_000;
const MIN_HERO_BYTES = 5_000;
const MIN_DESC_BYTES = 1_500;
const MAX_DESCRIPTION = 5;

interface ScrapeResult {
  sku: string;
  ok: boolean;
  saved: string[];
  source?: string;
  error?: string;
}

function searchQuery(item: ParsedStockItem): string {
  return `Godrej ${item.modelCode} split air conditioner`;
}

function productUrlForItem(item: ParsedStockItem, singleSku: boolean, cliOverride?: string): string | undefined {
  if (item.productUrl?.trim()) return item.productUrl.trim();
  if (singleSku && cliOverride?.trim()) return cliOverride.trim();
  return undefined;
}

async function collectRawImageUrls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const add = (raw: string | null | undefined) => {
      if (!raw || raw.startsWith('data:')) return;
      const u = raw.startsWith('//') ? `https:${raw}` : raw;
      if (seen.has(u)) return;
      seen.add(u);
      out.push(u);
    };

    const galleryRoot =
      document.querySelector('[class*="col-7"]') ??
      document.querySelector('[class*="CXi68d"]') ??
      document.querySelector('div[class*="_3YfSX_"]');

    const roots: Element[] = galleryRoot ? [galleryRoot] : [document.body];

    for (const root of roots) {
      root.querySelectorAll('img').forEach((img) => {
        add(img.getAttribute('src'));
        add(img.getAttribute('data-src'));
        const srcset = img.getAttribute('srcset');
        if (srcset) {
          for (const part of srcset.split(',')) {
            add(part.trim().split(/\s+/)[0]);
          }
        }
      });
      root.querySelectorAll('source[srcset]').forEach((s) => {
        const srcset = s.getAttribute('srcset');
        if (srcset) {
          for (const part of srcset.split(',')) {
            add(part.trim().split(/\s+/)[0]);
          }
        }
      });
    }

    document.querySelectorAll('img[src*="rukminim"], img[src*="media-amazon"]').forEach((img) => {
      add(img.getAttribute('src'));
      add(img.getAttribute('data-src'));
    });

    return out;
  });
}

async function findProductUrl(page: Page, query: string, modelCode: string, host: string): Promise<string | null> {
  const searchUrl =
    host === 'flipkart'
      ? `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`
      : `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;

  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await sleep(2000);

  const modelUpper = modelCode.toUpperCase();

  const candidates = await page.evaluate(
    ({ h, model }) => {
      const results: { href: string; score: number }[] = [];
      const anchors = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];

      for (const a of anchors) {
        const href = a.href.split('?')[0];
        if (h === 'flipkart' && (!/\/p\//.test(href) || !href.includes('flipkart.com'))) continue;
        if (h === 'amazon' && (!/\/dp\//.test(href) || !href.includes('amazon.in'))) continue;

        const text = (a.innerText || a.getAttribute('title') || '').toUpperCase();
        const hrefUpper = href.toUpperCase();
        let score = 0;
        if (text.includes(model) || hrefUpper.includes(model)) score += 10;
        if (text.includes('GODREJ')) score += 2;
        if (text.includes('SPLIT')) score += 1;

        const existing = results.find((r) => r.href === href);
        if (existing) {
          existing.score = Math.max(existing.score, score);
        } else {
          results.push({ href, score });
        }
      }

      return results.sort((a, b) => b.score - a.score);
    },
    { h: host, model: modelUpper },
  );

  const best = candidates.find((c) => c.score >= 10) ?? candidates[0];
  return best?.href ?? null;
}

async function scrapeFromUrl(page: Page, productUrl: string): Promise<string[]> {
  await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await sleep(3000);

  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.4));
    await sleep(600);
  }

  const raw = await collectRawImageUrls(page);
  const normalized = raw.map((u) => normalizeImageUrl(u)).filter((u): u is string => Boolean(u));
  return filterAndRankImageUrls(normalized);
}

async function saveImage(
  url: string,
  dest: string,
  role: 'hero' | 'gallery' | 'description',
): Promise<boolean> {
  try {
    const bytes = await downloadImage(url, dest);
    const minBytes = role === 'hero' ? MIN_HERO_BYTES : role === 'gallery' ? MIN_GALLERY_BYTES : MIN_DESC_BYTES;
    const minWidth = role === 'description' ? 200 : 400;
    const minHeight = role === 'description' ? 200 : 400;

    const check = validateImageFile(dest, { minBytes, minWidth, minHeight });
    if (!check.ok) {
      fs.unlinkSync(dest);
      console.warn(`   ⚠ rejected ${path.basename(dest)}: ${check.reason} (downloaded ${bytes} bytes)`);
      return false;
    }
    return true;
  } catch (e) {
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    console.warn(`   ⚠ failed ${path.basename(dest)}: ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

async function scrapeSku(
  item: ParsedStockItem,
  productUrlOverride: string | undefined,
  singleSku: boolean,
  force = false,
): Promise<ScrapeResult> {
  const dir = skuImageDir(item.itemCode);
  fs.mkdirSync(dir, { recursive: true });

  const existing = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  if (existing.length > 0 && !productUrlOverride && !force) {
    console.log(`⏭  ${item.itemCode}: ${existing.length} images already on disk — skip (use --force to re-scrape)`);
    return { sku: item.itemCode, ok: true, saved: existing };
  }

  const resolvedUrl = productUrlForItem(item, singleSku, productUrlOverride);
  const query = searchQuery(item);
  const saved: string[] = [];
  let source: string | undefined;
  let lastError: string | undefined;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-IN',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    let imageUrls: string[] = [];

    if (resolvedUrl) {
      imageUrls = await scrapeFromUrl(page, resolvedUrl);
      source = resolvedUrl;
    } else {
      for (const host of ['flipkart', 'amazon'] as const) {
        try {
          const productUrl = await findProductUrl(page, query, item.modelCode, host);
          if (!productUrl) continue;
          imageUrls = await scrapeFromUrl(page, productUrl);
          if (imageUrls.length >= 2) {
            source = productUrl;
            break;
          }
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
        }
        await sleep(RATE_LIMIT_MS);
      }
    }

    if (imageUrls.length === 0) {
      throw new Error(lastError ?? 'No product images found on Flipkart/Amazon');
    }

    let heroUrl: string | undefined;
    for (const url of imageUrls.slice(0, 3)) {
      const dest = path.join(dir, `01-hero${extFromUrl(url)}`);
      if (await saveImage(url, dest, 'hero')) {
        heroUrl = url;
        saved.push(path.basename(dest));
        break;
      }
    }
    if (!heroUrl) throw new Error('Could not download a valid hero image');

    const afterHero = imageUrls.filter((u) => u !== heroUrl);
    const savedGalleryUrls: string[] = [];
    let galleryIndex = 0;
    for (const url of afterHero) {
      if (galleryIndex >= MAX_GALLERY_IMAGES) break;
      const name = `02-gallery-${String(galleryIndex + 1).padStart(2, '0')}${extFromUrl(url)}`;
      const dest = path.join(dir, name);
      if (await saveImage(url, dest, 'gallery')) {
        saved.push(name);
        savedGalleryUrls.push(url);
        galleryIndex++;
      }
      await sleep(400);
    }

    if (galleryIndex === 0) {
      throw new Error('No valid gallery images (all rejected as thumbnails or too small)');
    }

    let descIndex = 0;
    for (const url of afterHero.slice(galleryIndex)) {
      if (savedGalleryUrls.includes(url)) continue;
      if (descIndex >= MAX_DESCRIPTION) break;
      const name = `description-${String(descIndex + 1).padStart(2, '0')}${extFromUrl(url)}`;
      const dest = path.join(dir, name);
      if (await saveImage(url, dest, 'description')) {
        saved.push(name);
        descIndex++;
      }
      await sleep(400);
    }

    if (saved.length === 0) {
      throw new Error('All image downloads failed');
    }

    console.log(`✅ ${item.itemCode} (${item.modelCode}): saved ${saved.length} images from ${source ?? 'unknown'}`);
    return { sku: item.itemCode, ok: true, saved, source };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`❌ ${item.itemCode} (${item.modelCode}): ${msg}`);
    console.error(
      `   Tip: add productUrl in ac-stock-upload.json or npm run ac:scrape -- --sku=${item.itemCode} --product-url=<url>`,
    );
    return { sku: item.itemCode, ok: false, saved: [], error: msg };
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const sku = getArg(args, 'sku');
  const productUrlArg = getArg(args, 'product-url');
  const force = args.force === true;
  const limit = getArgNumber(args, 'limit', 0);

  let items = filterBySku(loadStockUpload(), sku);
  if (limit > 0) items = items.slice(0, limit);
  const singleSku = items.length === 1;

  if (productUrlArg && !singleSku) {
    console.warn('⚠  --product-url applies only when scraping a single SKU; use productUrl per item in ac-stock-upload.json');
  }

  if (force) {
    for (const item of items) {
      const dir = skuImageDir(item.itemCode);
      if (fs.existsSync(dir)) {
        for (const f of fs.readdirSync(dir)) {
          fs.unlinkSync(path.join(dir, f));
        }
      }
    }
  }

  const withUrl = items.filter((i) => i.productUrl?.trim()).length;
  console.log(
    `🔍 Scraping ${items.length} SKU(s)… (${withUrl} with productUrl in stock file, delay ${RATE_LIMIT_MS}ms)\n`,
  );

  const results: ScrapeResult[] = [];
  for (const item of items) {
    const urlOverride = productUrlForItem(item, singleSku, productUrlArg);
    results.push(await scrapeSku(item, urlOverride, singleSku, force));
    await sleep(RATE_LIMIT_MS);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n📊 Done: ${results.length - failed.length} ok, ${failed.length} failed`);
  if (failed.length) {
    console.log('   Run ac:verify after fixing URLs. Failed SKUs keep Unsplash placeholders after merge-and-seed.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
