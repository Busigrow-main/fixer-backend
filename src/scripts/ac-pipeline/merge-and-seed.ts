/**
 * Merge Cloudinary manifest into ac-stock-2026.json, then optionally seed MongoDB.
 * Run: npm run ac:merge
 *      npm run ac:seed   (merge + seed)
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { execSync } from 'child_process';
import * as path from 'path';
import { getArg, parseArgs } from './lib/cli';
import { MANIFEST_JSON, SEED_JSON, ENV_PATH } from './lib/paths';
import type { CloudinaryManifest, DescriptionSection, SeedApplianceDoc } from './lib/types';

dotenv.config({ path: ENV_PATH });

const SECTION_TYPES_WITH_IMAGE = new Set(['hero', 'image_text', 'banner', 'image_full']);

function sortCloudinaryUrls(urls: string[], files: Record<string, string>): string[] {
  const order = Object.keys(files).sort();
  const byUrl = new Map(Object.entries(files).map(([k, v]) => [v, k]));
  return [...urls].sort((a, b) => {
    const ka = byUrl.get(a) ?? a;
    const kb = byUrl.get(b) ?? b;
    return ka.localeCompare(kb);
  });
}

function applyImagesToSections(
  sections: DescriptionSection[] | undefined,
  images: string[],
  productName: string,
): DescriptionSection[] | undefined {
  if (!sections?.length || !images.length) return sections;

  let imageIdx = 0;
  const nextImage = () => images[imageIdx++ % images.length];

  return sections.map((section) => {
    if (!SECTION_TYPES_WITH_IMAGE.has(section.type)) return section;
    const url = section.type === 'hero' ? images[0] : nextImage();
    return {
      ...section,
      imageUrl: url,
      imageAlt: section.imageAlt ?? productName,
    };
  });
}

function mergeManifestIntoSeed(manifest: CloudinaryManifest): { updated: string[]; skipped: string[] } {
  const products = JSON.parse(fs.readFileSync(SEED_JSON, 'utf-8')) as SeedApplianceDoc[];
  const updated: string[] = [];
  const skipped: string[] = [];

  for (const doc of products) {
    const entry = manifest.skus[doc.sku];
    if (!entry?.images?.length) {
      skipped.push(doc.sku);
      console.log(`   ⏭  ${doc.sku}: no Cloudinary images — keeping Unsplash placeholders`);
      continue;
    }

    const images = sortCloudinaryUrls(entry.images, entry.files);
    doc.images = images;
    doc.descriptionSections = applyImagesToSections(doc.descriptionSections, images, doc.name);
    if (doc.descriptionSections?.[0]?.type === 'hero' && images[0]) {
      const hero = doc.descriptionSections[0];
      hero.imageUrl = images[0];
    }
    updated.push(doc.sku);
    console.log(`   ✔ ${doc.sku}: ${images.length} Cloudinary URLs`);
  }

  fs.writeFileSync(SEED_JSON, JSON.stringify(products, null, 2));
  return { updated, skipped };
}

async function runSeed(): Promise<void> {
  const root = path.resolve(__dirname, '../../..');
  console.log('\n🌱 Running seed:appliances…');
  execSync('npm run seed:appliances', { cwd: root, stdio: 'inherit' });
}

async function main() {
  const args = parseArgs(process.argv);
  const shouldSeed =
    args.seed === true ||
    getArg(args, 'seed') === 'true' ||
    process.env.npm_lifecycle_event === 'ac:seed';

  if (!fs.existsSync(MANIFEST_JSON)) {
    throw new Error(`Manifest not found: ${MANIFEST_JSON}. Run npm run ac:upload first.`);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_JSON, 'utf-8')) as CloudinaryManifest;
  console.log(`📝 Merging manifest (${Object.keys(manifest.skus).length} SKUs) into ${SEED_JSON}\n`);

  const { updated, skipped } = mergeManifestIntoSeed(manifest);
  console.log(`\n📊 Merge: ${updated.length} updated, ${skipped.length} unchanged (fallbacks)`);

  if (shouldSeed) {
    await runSeed();
  } else {
    console.log('\nℹ️  Skipping MongoDB seed (pass --seed or use npm run ac:seed)');
  }
}

main().catch((err) => {
  console.error('❌ Merge failed:', err);
  process.exit(1);
});
