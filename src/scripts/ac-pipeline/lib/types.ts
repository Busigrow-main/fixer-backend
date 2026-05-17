export type AcStockType = 'Inverter' | 'Fixed Speed';

export interface AcStockUploadItem {
  itemCode: string;
  description: string;
  nlc: number;
  star: number;
  type: AcStockType;
}

export interface AcStockUploadFile {
  source?: string;
  items: AcStockUploadItem[];
}

export interface ParsedStockItem extends AcStockUploadItem {
  modelCode: string;
  series: string;
  capacityTon: number;
  isInverter: boolean;
}

export interface SeedProductRef {
  slug: string;
  sku: string;
  modelNumber: string;
  name: string;
}

export interface CloudinarySkuManifest {
  slug: string;
  images: string[];
  files: Record<string, string>;
}

export interface CloudinaryManifest {
  generatedAt: string;
  cloudinaryFolder: string;
  skus: Record<string, CloudinarySkuManifest>;
}

export interface DescriptionSection {
  type: string;
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  imageAlt?: string;
  html?: string;
  features?: { icon: string; title: string; description: string }[];
  order?: number;
}

export interface SeedApplianceDoc {
  slug: string;
  sku: string;
  name: string;
  modelNumber: string;
  nlcPrice: number;
  starRating: number;
  isInverter: boolean;
  capacityTon: number;
  images: string[];
  descriptionSections?: DescriptionSection[];
  [key: string]: unknown;
}
