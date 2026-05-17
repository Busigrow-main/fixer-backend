/**
 * Bulk-upload SKU image folders to Cloudinary.
 * Run: npm run ac:upload
 *      npm run ac:upload -- --sku=40101701SD01777
 */
import { v2 as cloudinary } from 'cloudinary';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { getArg, parseArgs } from './lib/cli';
import { listImageFiles } from './lib/download';
import { ENV_PATH, MANIFEST_JSON, skuImageDir } from './lib/paths';
import { slugForSku } from './lib/seed-index';
import { filterBySku, loadStockUpload } from './lib/stock';
import type { CloudinaryManifest, CloudinarySkuManifest } from './lib/types';

dotenv.config({ path: ENV_PATH });

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in .env (see .env.example)`);
  return v;
}

function cloudinaryFolderBase(): string {
  return process.env.CLOUDINARY_FOLDER || 'fixxer/appliances';
}

async function uploadFile(
  localPath: string,
  folder: string,
  publicId: string,
): Promise<{ secure_url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      localPath,
      {
        folder,
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
      },
      (err, result) => {
        if (err || !result?.secure_url) reject(err ?? new Error('No upload result'));
        else resolve({ secure_url: result.secure_url, public_id: result.public_id });
      },
    );
  });
}

async function uploadSkuFolder(sku: string, slug: string): Promise<CloudinarySkuManifest | null> {
  const dir = skuImageDir(sku);
  const files = listImageFiles(dir);
  if (!files.length) {
    console.warn(`⚠  ${sku}: no images in ${dir} — skip upload`);
    return null;
  }

  const base = cloudinaryFolderBase();
  const skuFolder = `${base}/${slug}`;
  const manifest: CloudinarySkuManifest = { slug, images: [], files: {} };

  for (const file of files) {
    const localPath = path.join(dir, file);
    const publicId = path.parse(file).name;
    try {
      const result = await uploadFile(localPath, skuFolder, publicId);
      manifest.files[file] = result.secure_url;
      manifest.images.push(result.secure_url);
      console.log(`   ↑ ${file} → ${result.secure_url}`);
    } catch (e) {
      console.error(`   ✗ ${file}: ${e instanceof Error ? e.message : e}`);
    }
  }

  manifest.images.sort((a, b) => {
    const fa = Object.entries(manifest.files).find(([, url]) => url === a)?.[0] ?? '';
    const fb = Object.entries(manifest.files).find(([, url]) => url === b)?.[0] ?? '';
    return fa.localeCompare(fb);
  });

  return manifest.images.length ? manifest : null;
}

async function main() {
  requireEnv('CLOUDINARY_CLOUD_NAME');
  requireEnv('CLOUDINARY_API_KEY');
  requireEnv('CLOUDINARY_API_SECRET');

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  const args = parseArgs(process.argv);
  const skuFilter = getArg(args, 'sku');
  const items = filterBySku(loadStockUpload(), skuFilter);

  const manifest: CloudinaryManifest = {
    generatedAt: new Date().toISOString(),
    cloudinaryFolder: cloudinaryFolderBase(),
    skus: {},
  };

  if (fs.existsSync(MANIFEST_JSON) && !skuFilter) {
    try {
      const prev = JSON.parse(fs.readFileSync(MANIFEST_JSON, 'utf-8')) as CloudinaryManifest;
      manifest.skus = { ...prev.skus };
    } catch {
      /* fresh manifest */
    }
  }

  console.log(`☁️  Uploading to Cloudinary folder: ${manifest.cloudinaryFolder}\n`);

  for (const item of items) {
    const slug = slugForSku(item.itemCode);
    if (!slug) {
      console.warn(`⚠  ${item.itemCode}: no slug in ac-stock-2026.json — skip`);
      continue;
    }
    console.log(`📦 ${item.itemCode} → ${slug}`);
    const entry = await uploadSkuFolder(item.itemCode, slug);
    if (entry) manifest.skus[item.itemCode] = entry;
  }

  fs.mkdirSync(path.dirname(MANIFEST_JSON), { recursive: true });
  fs.writeFileSync(MANIFEST_JSON, JSON.stringify(manifest, null, 2));
  console.log(`\n✅ Manifest written: ${MANIFEST_JSON}`);
  console.log(`   SKUs with URLs: ${Object.keys(manifest.skus).length}`);
}

main().catch((err) => {
  console.error('❌ Upload failed:', err);
  process.exit(1);
});
