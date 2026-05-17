/**
 * Scrape product + description images for one or more AC SKUs.
 * Run: npm run ac:scrape -- --sku=40101701SD01777
 *      npm run ac:scrape -- --sku=40101701SD01777 --product-url=https://...
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, type Page } from 'playwright';
import { getArg, getArgNumber, parseArgs } from './lib/cli';
import { downloadImage, extFromUrl, normalizeImageUrl, sleep } from './lib/download';
import { ENV_PATH, skuImageDir } from './lib/paths';
import { filterBySku, loadStockUpload } from './lib/stock';
import type { ParsedStockItem } from './lib/types';

dotenv.config({ path: ENV_PATH });

const RATE_LIMIT_MS = getArgNumber(parseArgs(process.argv), 'delay', 2500);

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

async function collectImageUrls(page: Page): Promise<string[]> {
  const urls = await page.evaluate(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const add = (raw: string | null | undefined) => {
      if (!raw || raw.startsWith('data:')) return;
      const u = raw.startsWith('//') ? `https:${raw}` : raw;
      if (!u.match(/\.(jpg|jpeg|png|webp)/i) && !u.includes('/image/') && !u.includes('rukmin')) return;
      if (seen.has(u)) return;
      seen.add(u);
      out.push(u);
    };
    document.querySelectorAll('img').forEach((img) => {
      add(img.getAttribute('src'));
      add(img.getAttribute('data-src'));
      add(img.getAttribute('data-srcset')?.split(' ')[0]);
    });
    document.querySelectorAll('source[srcset]').forEach((s) => {
      const srcset = s.getAttribute('srcset');
      if (srcset) add(srcset.split(',')[0]?.trim().split(' ')[0]);
    });
    return out;
  });
  return urls.map((u) => normalizeImageUrl(u)).filter((u): u is string => Boolean(u));
}

async function findProductUrl(page: Page, query: string, host: string): Promise<string | null> {
  const searchUrl =
    host === 'flipkart'
      ? `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`
      : `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;

  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await sleep(2000);

  const link = await page.evaluate((h) => {
    const anchors = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    for (const a of anchors) {
      const href = a.href;
      if (h === 'flipkart' && /\/p\//.test(href) && href.includes('flipkart.com')) return href.split('?')[0];
      if (h === 'amazon' && /\/dp\//.test(href) && href.includes('amazon.in')) return href.split('?')[0];
    }
    return null;
  }, host);

  return link;
}

async function scrapeFromUrl(page: Page, productUrl: string): Promise<string[]> {
  await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await sleep(3000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await sleep(1500);
  return collectImageUrls(page);
}

async function scrapeSku(
  item: ParsedStockItem,
  productUrlOverride?: string,
  force = false,
): Promise<ScrapeResult> {
  const dir = skuImageDir(item.itemCode);
  fs.mkdirSync(dir, { recursive: true });

  const existing = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  if (existing.length > 0 && !productUrlOverride && !force) {
    console.log(`⏭  ${item.itemCode}: ${existing.length} images already on disk — skip (use --force to re-scrape)`);
    return { sku: item.itemCode, ok: true, saved: existing };
  }

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

    if (productUrlOverride) {
      imageUrls = await scrapeFromUrl(page, productUrlOverride);
      source = productUrlOverride;
    } else {
      for (const host of ['flipkart', 'amazon'] as const) {
        try {
          const productUrl = await findProductUrl(page, query, host);
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

    const hero = imageUrls[0];
    const gallery = imageUrls.slice(1, 7);
    const description = imageUrls.slice(7, 12);

    const jobs: { url: string; name: string }[] = [
      { url: hero, name: `01-hero${extFromUrl(hero)}` },
      ...gallery.map((url, i) => ({
        url,
        name: `02-gallery-${String(i + 1).padStart(2, '0')}${extFromUrl(url)}`,
      })),
      ...description.map((url, i) => ({
        url,
        name: `description-${String(i + 1).padStart(2, '0')}${extFromUrl(url)}`,
      })),
    ];

    for (const job of jobs) {
      const dest = path.join(dir, job.name);
      try {
        await downloadImage(job.url, dest);
        saved.push(job.name);
        await sleep(400);
      } catch (e) {
        console.warn(`   ⚠ failed ${job.name}: ${e instanceof Error ? e.message : e}`);
      }
    }

    if (saved.length === 0) {
      throw new Error('All image downloads failed');
    }

    console.log(`✅ ${item.itemCode} (${item.modelCode}): saved ${saved.length} images from ${source ?? 'unknown'}`);
    return { sku: item.itemCode, ok: true, saved, source };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`❌ ${item.itemCode} (${item.modelCode}): ${msg}`);
    console.error(`   Tip: npm run ac:scrape -- --sku=${item.itemCode} --product-url=<flipkart-or-amazon-url>`);
    return { sku: item.itemCode, ok: false, saved: [], error: msg };
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const sku = getArg(args, 'sku');
  const productUrl = getArg(args, 'product-url');
  const force = args.force === true;

  let items = filterBySku(loadStockUpload(), sku);
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

  console.log(`🔍 Scraping ${items.length} SKU(s)… (delay ${RATE_LIMIT_MS}ms between hosts)\n`);

  const results: ScrapeResult[] = [];
  for (const item of items) {
    results.push(await scrapeSku(item, productUrl, force));
    await sleep(RATE_LIMIT_MS);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n📊 Done: ${results.length - failed.length} ok, ${failed.length} failed`);
  if (failed.length) {
    console.log('   Failed SKUs will keep Unsplash placeholders after merge-and-seed.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
