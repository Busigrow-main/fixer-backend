import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ApplianceDocument = Appliance & Document;

@Schema({ timestamps: true })
export class Appliance {
  @Prop({ required: true, unique: true, index: true })
  slug: string; // URL-safe identifier, e.g., "godrej-1-5t-5s-inverter-split"

  @Prop({ required: true })
  name: string; // e.g., "Godrej 1.5 Ton 5 Star Inverter Split AC"

  @Prop({ required: true, index: true })
  brand: string; // Phase 1: always "Godrej"

  @Prop({ required: true })
  modelNumber: string; // e.g., "GIC 18TTC5-WTA"

  @Prop({ required: true })
  price: number; // in INR

  @Prop()
  originalPrice: number; // MRP for strikethrough display

  @Prop({ required: true, index: true })
  capacityTon: number; // 0.75 | 1.0 | 1.5 | 2.0

  @Prop({ required: true, index: true })
  starRating: number; // 1–5 BEE star rating

  @Prop({
    required: true,
    enum: ['split', 'window', 'cassette', 'portable'],
    index: true,
  })
  acType: string; // Type of AC

  @Prop({ required: true })
  isInverter: boolean; // Whether compressor is inverter-type

  @Prop({ required: true })
  description: string; // Full product description (HTML or Markdown supported)

  @Prop()
  shortDescription: string; // 2–3 line summary for listing cards

  @Prop({ type: [String], required: true })
  images: string[]; // Array of image URLs (CDN). First is primary thumbnail

  @Prop({
    type: {
      coolingCapacityBtu: String,
      energyConsumption: String,
      annualEnergyUnits: String,
      refrigerant: String,
      compressorType: String,
      noiseLevelIndoor: String,
      indoorUnitDimensions: String,
      outdoorUnitDimensions: String,
      colour: String,
      wifiEnabled: String,
      autoClean: String,
    },
  })
  specs: Record<string, any>; // Key-value specs table

  @Prop({ default: true, index: true })
  inStock: boolean; // Availability flag

  @Prop()
  warrantyYears: number; // Product warranty duration

  @Prop({ default: false })
  installationIncluded: boolean; // Whether Fixxer installation bundled

  @Prop({ required: true, index: true })
  applianceCategory: string; // "ac" | "fridge" | "washing-machine" (for future scaling)

  @Prop({ default: true, index: true })
  isActive: boolean; // Whether product is visible/listed

  // timestamps are added automatically by @Schema({ timestamps: true })
}

export const ApplianceSchema = SchemaFactory.createForClass(Appliance);

// Create compound indexes for common queries
ApplianceSchema.index({ applianceCategory: 1, brand: 1 });
ApplianceSchema.index({ applianceCategory: 1, capacityTon: 1 });
ApplianceSchema.index({ applianceCategory: 1, starRating: 1 });
ApplianceSchema.index({ applianceCategory: 1, price: 1 });
ApplianceSchema.index({ applianceCategory: 1, acType: 1 });
ApplianceSchema.index({ applianceCategory: 1, inStock: 1 });
