import * as fs from 'fs';
import { SEED_JSON } from './paths';
import type { SeedApplianceDoc, SeedProductRef } from './types';

export function loadSeedProducts(): SeedApplianceDoc[] {
  const raw = JSON.parse(fs.readFileSync(SEED_JSON, 'utf-8')) as
    | SeedApplianceDoc[]
    | { products: SeedApplianceDoc[] };
  if (Array.isArray(raw)) return raw;
  return raw.products ?? [];
}

export function buildSkuIndex(): Map<string, SeedProductRef> {
  const map = new Map<string, SeedProductRef>();
  for (const p of loadSeedProducts()) {
    map.set(p.sku, {
      slug: p.slug,
      sku: p.sku,
      modelNumber: p.modelNumber,
      name: p.name,
    });
  }
  return map;
}

export function slugForSku(sku: string): string | undefined {
  return buildSkuIndex().get(sku)?.slug;
}
