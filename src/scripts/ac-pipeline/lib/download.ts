import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export function isImageFile(name: string): boolean {
  return IMAGE_EXT.has(path.extname(name).toLowerCase());
}

export function listImageFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(isImageFile)
    .sort((a, b) => a.localeCompare(b));
}

export async function downloadImage(url: string, destPath: string): Promise<number> {
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 45_000,
    maxRedirects: 5,
    headers: {
      Accept: 'image/*,*/*',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const buf = Buffer.from(res.data);
  fs.writeFileSync(destPath, buf);
  return buf.length;
}

export function normalizeImageUrl(src: string | null | undefined): string | null {
  if (!src || src.startsWith('data:')) return null;
  if (src.startsWith('//')) return `https:${src}`;
  return src;
}

export function extFromUrl(url: string, fallback = '.jpg'): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).split('?')[0].toLowerCase();
    if (IMAGE_EXT.has(ext)) return ext;
  } catch {
    /* ignore */
  }
  return fallback;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
