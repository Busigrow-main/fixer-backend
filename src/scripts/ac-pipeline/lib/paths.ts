import * as path from 'path';

export const PIPELINE_ROOT = path.resolve(__dirname, '..');
export const STOCK_UPLOAD_JSON = path.join(PIPELINE_ROOT, 'ac-stock-upload.json');
export const IMAGES_ROOT = path.join(PIPELINE_ROOT, 'images');
export const MANIFEST_JSON = path.join(PIPELINE_ROOT, 'data', 'ac-cloudinary-manifest.json');
export const SEED_JSON = path.resolve(__dirname, '../../data/ac-stock-2026.json');
export const ENV_PATH = path.resolve(__dirname, '../../../../.env');

export function skuImageDir(sku: string): string {
  return path.join(IMAGES_ROOT, sku);
}
