/**
 * Marketplace product-image URL filtering and normalization.
 */

const THUMB_PATH_RE =
  /\/image\/(32|40|48|64|96|128|150|200|240|276|312|416)\/(32|40|48|64|96|128|150|200|240|276|312|416)\//i;

const REJECT_URL_RE =
  /(thumb|thumbnail|sprite|icon|placeholder|badge|banner-ad|\/ads\/|related|similar|carousel-dot|swatch|\/q=\d{1,2}($|&))/i;

const PRODUCT_CDN_RE =
  /(rukminim\d*\.flixcart\.com|flixcart\.com\/image\/|images-eu\.ssl-images-amazon|m\.media-amazon)/i;

/** Flipkart / Amazon CDN path used to dedupe the same asset at different sizes. */
export function imageContentKey(url: string): string {
  try {
    const u = new URL(url);
    let p = u.pathname.replace(THUMB_PATH_RE, '/image/__SIZE__/__SIZE__/');
    p = p.replace(/\/image\/\d+\/\d+\//, '/image/__SIZE__/__SIZE__/');
    return `${u.hostname}${p}`;
  } catch {
    return url;
  }
}

export function upscaleMarketplaceImageUrl(url: string): string {
  let out = url;
  if (THUMB_PATH_RE.test(out)) {
    out = out.replace(THUMB_PATH_RE, '/image/832/832/');
  }
  out = out.replace(/\/image\/(\d{2,3})\/\1\//g, '/image/832/832/');
  try {
    const u = new URL(out);
    u.searchParams.delete('q');
    return u.toString();
  } catch {
    return out;
  }
}

export function isRejectedImageUrl(url: string): boolean {
  if (REJECT_URL_RE.test(url)) return true;
  if (!PRODUCT_CDN_RE.test(url) && !/\.(jpe?g|png|webp)(\?|$)/i.test(url)) return true;
  const m = url.match(/\/image\/(\d+)\/(\d+)\//i);
  if (m) {
    const w = Number(m[1]);
    const h = Number(m[2]);
    if (w < 200 || h < 200) return true;
  }
  return false;
}

export function isProductImageUrl(url: string): boolean {
  if (!url || url.startsWith('data:')) return false;
  if (isRejectedImageUrl(url)) return false;
  return PRODUCT_CDN_RE.test(url) || /\.(jpe?g|png|webp)(\?|$)/i.test(url);
}

/** Prefer larger variants, dedupe by content key, stable order. */
export function filterAndRankImageUrls(urls: string[]): string[] {
  const ranked = new Map<string, { url: string; score: number }>();

  for (const raw of urls) {
    const normalized = upscaleMarketplaceImageUrl(raw);
    if (!isProductImageUrl(normalized)) continue;

    const key = imageContentKey(normalized);
    const sizeMatch = normalized.match(/\/image\/(\d+)\/(\d+)\//i);
    const dim = sizeMatch ? Number(sizeMatch[1]) : 400;
    const score = dim;

    const prev = ranked.get(key);
    if (!prev || score > prev.score) {
      ranked.set(key, { url: normalized, score });
    }
  }

  return [...ranked.values()]
    .sort((a, b) => b.score - a.score)
    .map((x) => x.url);
}
