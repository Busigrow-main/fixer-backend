import * as fs from 'fs';
import { STOCK_UPLOAD_JSON } from './paths';
import type { AcStockUploadFile, ParsedStockItem } from './types';

/** Extract model code from description e.g. "AC 1.5T DS WIC 18F5TG WA" → 18F5TG */
export function parseModelCode(description: string): string | null {
  const m = description.match(/\b([0-9]{2}[A-Z0-9]{3,6})\b/);
  return m ? m[1] : null;
}

export function parseSeries(description: string): string {
  const m = description.match(/\bDS\s+(WIC|HIC|HFC)\b/);
  return m ? m[1] : 'HIC';
}

export function parseCapacityTon(description: string): number {
  const m = description.match(/AC\s+([\d.]+)T/);
  return m ? parseFloat(m[1]) : 1.5;
}

export function loadStockUpload(filePath = STOCK_UPLOAD_JSON): ParsedStockItem[] {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as AcStockUploadFile;
  return raw.items.map((item) => {
    const modelCode = parseModelCode(item.description);
    if (!modelCode) {
      throw new Error(`Cannot parse model code from: ${item.description}`);
    }
    return {
      ...item,
      modelCode,
      series: parseSeries(item.description),
      capacityTon: parseCapacityTon(item.description),
      isInverter: item.type === 'Inverter',
    };
  });
}

export function filterBySku(items: ParsedStockItem[], sku?: string): ParsedStockItem[] {
  if (!sku) return items;
  const found = items.filter((i) => i.itemCode === sku);
  if (!found.length) {
    throw new Error(`SKU not in stock upload: ${sku}`);
  }
  return found;
}
