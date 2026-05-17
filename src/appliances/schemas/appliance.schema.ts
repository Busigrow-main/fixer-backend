import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ApplianceDocument = Appliance & Document;

// ── Nested type for structured specs ──────────────────────────
class DimensionSpec {
  width: number;
  height: number;
  depth: number;
}

class PerformanceSpecs {
  coolingCapacityBtu: string;
  iseerRating: number;
  annualEnergyUnits: number; // kWh/year
  energyConsumptionW: number; // Watts
  refrigerant: string;
  compressorType: string; // 'Inverter' | 'Fixed Speed'
  ambientTempRangeC: string; // e.g. "10°C to 54°C"
}

class SmartSpecs {
  wifiEnabled: boolean;
  autoCleanEnabled: boolean;
  pm25Filter: boolean;
  sleepMode: boolean;
  selfDiagnosis: boolean;
  operatingModes: string[]; // ["cool","dry","fan","auto","sleep"]
  noiseLevelIndoorDb: number;
  noiseLevelOutdoorDb: number;
}

class PhysicalSpecs {
  indoorDimensions: DimensionSpec; // mm
  outdoorDimensions: DimensionSpec; // mm
  indoorWeightKg: number;
  outdoorWeightKg: number;
  colour: string;
  voltageRequirement: string; // e.g. "230V ~ 50Hz"
  pipeLengthM: number; // standard pipe length included
}

class Highlight {
  icon: string;
  title: string;
  description: string;
}

export const DESCRIPTION_SECTION_TYPES = [
  'hero',
  'image_text',
  'feature_grid',
  'banner',
  'html',
  'image_full',
] as const;

export type DescriptionSectionType = (typeof DESCRIPTION_SECTION_TYPES)[number];

class DescriptionFeature {
  icon: string;
  title: string;
  description: string;
}

class DescriptionSection {
  type: DescriptionSectionType;
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  imageAlt?: string;
  html?: string;
  features?: DescriptionFeature[];
  order?: number;
}

class TechnicalSpec {
  label: string;
  value: string;
}

class TechnicalSection {
  title: string;
  specs: TechnicalSpec[];
}

class TechnicalDescription {
  sections: TechnicalSection[];
}

// ── Main Appliance Schema ──────────────────────────────────────
@Schema({ timestamps: true })
export class Appliance {
  // ── Identity ──────────────────────────────────────────────────
  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, index: true })
  brand: string;

  @Prop({ required: true })
  modelNumber: string; // official model number e.g. "FTKM50UV16VA"

  @Prop({ required: true, unique: true, index: true })
  sku: string; // stock item code e.g. "40101701SD01777"

  @Prop()
  series: string; // WIC | HIC | HFC

  @Prop()
  descriptionCode: string; // raw code from stock list e.g. "18F5TG"

  // ── Pricing ───────────────────────────────────────────────────
  @Prop({ required: true })
  price: number; // selling price (NLC × 1.18 + 1000)

  @Prop()
  originalPrice: number; // MRP for strikethrough

  @Prop({ required: true })
  nlcPrice: number; // net landed cost (raw, for reference)

  // ── Core Attributes ───────────────────────────────────────────
  @Prop({ required: true, index: true })
  capacityTon: number;

  @Prop({ required: true, index: true })
  starRating: number; // 1–5 BEE

  @Prop({
    required: true,
    enum: ['split', 'window', 'cassette', 'portable'],
    index: true,
  })
  acType: string;

  @Prop({ required: true })
  isInverter: boolean;

  @Prop()
  roomSizeRecommendation: string; // e.g. "120–180 sq. ft."

  // ── Content ───────────────────────────────────────────────────
  @Prop()
  description: string; // legacy HTML; optional when descriptionSections is set

  @Prop({ type: [Object] })
  descriptionSections: DescriptionSection[];

  @Prop({ type: Object })
  technicalDescription: TechnicalDescription;

  @Prop()
  shortDescription: string;

  @Prop({ type: [String], required: true })
  images: string[]; // First = primary. Will be Cloudinary URLs later.

  // ── Structured Specs ──────────────────────────────────────────
  @Prop({ type: Object })
  specsPerformance: PerformanceSpecs;

  @Prop({ type: Object })
  specsSmart: SmartSpecs;

  @Prop({ type: Object })
  specsPhysical: PhysicalSpecs;

  // ── Feature Highlights (for detail page cards) ────────────────
  @Prop({ type: [Object] })
  highlights: Highlight[];

  // ── What's in the Box ─────────────────────────────────────────
  @Prop({ type: [String] })
  whatsInBox: string[];

  // ── Availability / Meta ───────────────────────────────────────
  @Prop({ default: true, index: true })
  inStock: boolean;

  @Prop({ default: false })
  installationIncluded: boolean;

  @Prop()
  compressorWarrantyYears: number;

  @Prop()
  productWarrantyYears: number;

  @Prop({ required: true, index: true })
  applianceCategory: string; // "ac"

  @Prop({ default: true, index: true })
  isActive: boolean;
}

export const ApplianceSchema = SchemaFactory.createForClass(Appliance);

// ── Indexes ───────────────────────────────────────────────────
ApplianceSchema.index({ applianceCategory: 1, brand: 1 });
ApplianceSchema.index({ applianceCategory: 1, capacityTon: 1 });
ApplianceSchema.index({ applianceCategory: 1, starRating: 1 });
ApplianceSchema.index({ applianceCategory: 1, price: 1 });
ApplianceSchema.index({ applianceCategory: 1, acType: 1 });
ApplianceSchema.index({ applianceCategory: 1, inStock: 1 });
ApplianceSchema.index({ applianceCategory: 1, isInverter: 1 });
ApplianceSchema.index({ name: 'text', brand: 'text', sku: 'text' });
