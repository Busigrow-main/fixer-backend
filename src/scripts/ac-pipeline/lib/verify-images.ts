import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { listImageFiles } from './download';
import { fileSha256, validateImageFile, type ImageValidationResult } from './image-meta';
import { skuImageDir } from './paths';
import type { ParsedStockItem } from './types';

export const DEFAULT_MIN_GALLERY_BYTES = 8_000;
export const DEFAULT_MIN_HERO_BYTES = 5_000;
export const DEFAULT_MIN_WIDTH = 400;
export const DEFAULT_MIN_HEIGHT = 400;
export const MAX_GALLERY_IMAGES = 6;

export interface FileCheck {
  file: string;
  role: 'hero' | 'gallery' | 'description' | 'other';
  ok: boolean;
  bytes: number;
  sha256?: string;
  reason?: string;
}

export interface SkuVerifyResult {
  sku: string;
  modelCode: string;
  productUrl?: string;
  pass: boolean;
  errors: string[];
  warnings: string[];
  files: FileCheck[];
}

export interface VerifyReport {
  generatedAt: string;
  passCount: number;
  failCount: number;
  warnCount: number;
  duplicateHashes: { hash: string; skus: string[]; files: string[] }[];
  skus: Record<string, SkuVerifyResult>;
}

export interface VerifyOptions {
  minGalleryBytes?: number;
  minHeroBytes?: number;
  minWidth?: number;
  minHeight?: number;
  checkCrossSkuDuplicates?: boolean;
}

function roleForFile(name: string): FileCheck['role'] {
  if (name.startsWith('01-hero')) return 'hero';
  if (name.startsWith('02-gallery')) return 'gallery';
  if (name.startsWith('description')) return 'description';
  return 'other';
}

function validateRole(
  filePath: string,
  role: FileCheck['role'],
  opts: VerifyOptions,
): ImageValidationResult {
  const minGalleryBytes = opts.minGalleryBytes ?? DEFAULT_MIN_GALLERY_BYTES;
  const minHeroBytes = opts.minHeroBytes ?? DEFAULT_MIN_HERO_BYTES;
  const minWidth = opts.minWidth ?? DEFAULT_MIN_WIDTH;
  const minHeight = opts.minHeight ?? DEFAULT_MIN_HEIGHT;

  if (role === 'description') {
    return validateImageFile(filePath, {
      minBytes: 1_500,
      minWidth: 200,
      minHeight: 200,
    });
  }

  if (role === 'hero') {
    return validateImageFile(filePath, {
      minBytes: minHeroBytes,
      minWidth,
      minHeight,
    });
  }

  if (role === 'gallery') {
    return validateImageFile(filePath, {
      minBytes: minGalleryBytes,
      minWidth,
      minHeight,
    });
  }

  return validateImageFile(filePath, { minBytes: minGalleryBytes, minWidth, minHeight });
}

export function verifySkuFolder(item: ParsedStockItem, opts: VerifyOptions = {}): SkuVerifyResult {
  const dir = skuImageDir(item.itemCode);
  const errors: string[] = [];
  const warnings: string[] = [];
  const files: FileCheck[] = [];

  if (!fs.existsSync(dir)) {
    return {
      sku: item.itemCode,
      modelCode: item.modelCode,
      productUrl: item.productUrl,
      pass: false,
      errors: ['image folder missing'],
      warnings,
      files,
    };
  }

  const names = listImageFiles(dir);
  const hero = names.find((n) => n.startsWith('01-hero'));
  const gallery = names.filter((n) => n.startsWith('02-gallery')).sort();

  if (!hero) {
    errors.push('missing 01-hero image');
  }

  if (gallery.length === 0) {
    errors.push('no 02-gallery-* images');
  } else if (gallery.length > MAX_GALLERY_IMAGES) {
    warnings.push(`more than ${MAX_GALLERY_IMAGES} gallery images (${gallery.length})`);
  }

  for (const name of names) {
    const role = roleForFile(name);
    const filePath = path.join(dir, name);
    const validation = validateRole(filePath, role, opts);
    const sha256 = validation.ok || role !== 'description' ? fileSha256(filePath) : undefined;

    const check: FileCheck = {
      file: name,
      role,
      ok: validation.ok,
      bytes: validation.bytes,
      sha256,
      reason: validation.reason,
    };
    files.push(check);

    if (!validation.ok) {
      const msg = `${name}: ${validation.reason}`;
      if (role === 'gallery' || role === 'hero') errors.push(msg);
      else warnings.push(msg);
    }
  }

  return {
    sku: item.itemCode,
    modelCode: item.modelCode,
    productUrl: item.productUrl,
    pass: errors.length === 0,
    errors,
    warnings,
    files,
  };
}

export function findCrossSkuDuplicateHashes(
  results: SkuVerifyResult[],
): VerifyReport['duplicateHashes'] {
  const hashIndex = new Map<string, { skus: Set<string>; files: string[] }>();

  for (const sku of results) {
    for (const f of sku.files) {
      if (!f.sha256 || f.role === 'description') continue;
      if (!hashIndex.has(f.sha256)) {
        hashIndex.set(f.sha256, { skus: new Set(), files: [] });
      }
      const entry = hashIndex.get(f.sha256)!;
      entry.skus.add(sku.sku);
      entry.files.push(`${sku.sku}/${f.file}`);
    }
  }

  return [...hashIndex.entries()]
    .filter(([, v]) => v.skus.size > 1)
    .map(([hash, v]) => ({
      hash,
      skus: [...v.skus].sort(),
      files: v.files,
    }));
}

export function buildVerifyReport(items: ParsedStockItem[], opts: VerifyOptions = {}): VerifyReport {
  const skuResults = items.map((item) => verifySkuFolder(item, opts));
  const duplicateHashes = opts.checkCrossSkuDuplicates !== false
    ? findCrossSkuDuplicateHashes(skuResults)
    : [];

  for (const dup of duplicateHashes) {
    for (const sku of dup.skus) {
      const r = skuResults.find((s) => s.sku === sku);
      if (r) {
        r.warnings.push(`duplicate image hash shared with: ${dup.skus.filter((s) => s !== sku).join(', ')}`);
        if (dup.skus.length > 1 && dup.files.some((f) => f.includes('/01-hero'))) {
          if (!r.errors.some((e) => e.includes('duplicate'))) {
            r.errors.push('hero/gallery hash duplicated across SKUs (likely wrong listing URL)');
          }
          r.pass = false;
        }
      }
    }
  }

  const skus: Record<string, SkuVerifyResult> = {};
  for (const r of skuResults) skus[r.sku] = r;

  return {
    generatedAt: new Date().toISOString(),
    passCount: skuResults.filter((r) => r.pass).length,
    failCount: skuResults.filter((r) => !r.pass).length,
    warnCount: skuResults.filter((r) => r.warnings.length > 0).length,
    duplicateHashes,
    skus,
  };
}

export function reportFingerprint(report: VerifyReport): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(report.skus))
    .digest('hex')
    .slice(0, 12);
}
