import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type SparePartDocument = SparePart & Document;

@Schema({ timestamps: true })
export class SparePart {
  @Prop({ required: true, unique: true, index: true })
  sku: string; // "SP-REF-SAM-RT28-COMP-001"

  @Prop({ required: true, index: true })
  slug: string; // URL-friendly name

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ type: [String] })
  imageUrls: string[];

  // === CATEGORIZATION ===
  @Prop({ required: true, index: true })
  applianceTypeSlug: string; // "refrigerator"

  @Prop({ default: false, index: true })
  isUniversal: boolean;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Brand', index: true })
  brandId: any;

  @Prop({ index: true })
  brandSlug: string; // "samsung"

  @Prop({ type: [Object], index: true })
  compatibleModels: Array<{
    modelId: MongooseSchema.Types.ObjectId;
    modelNumber: string;
    displayName: string;
  }>;

  @Prop({ type: [String], index: true })
  crossBrandCompatibility: string[];

  // === PART METADATA ===
  @Prop({ index: true })
  partCategory: string; // "Cooling & Compressor"

  @Prop({ unique: true, sparse: true, index: true })
  partNumber: string; // OEM part number

  @Prop({ type: [String] })
  alternatePartNumbers: [string];

  @Prop({
    type: {
      type: String,
      enum: ['OEM', 'OEM-Equivalent', 'Aftermarket', 'Universal'],
    },
  })
  partType: {
    type: string;
  };

  // === PRICING & INVENTORY ===
  @Prop({ required: true })
  price: number; // in paise

  @Prop()
  mrp: number; // in paise

  @Prop({ default: 0 })
  stock: number;

  @Prop({ default: true, index: true })
  isInStock: boolean;

  // === SEARCH & DISCOVERY ===
  @Prop({ type: [String], index: true })
  tags: string[];

  @Prop({ type: [String] })
  searchKeywords: string[];

  // === CONTENT ===
  @Prop({
    type: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard', 'Professional Only'],
    },
  })
  installationDifficulty: {
    type: string;
  };

  @Prop()
  warrantyMonths: number;

  // === META ===
  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ default: false, index: true })
  isFeatured: boolean;

  @Prop({ default: 0 })
  viewCount: number;

  @Prop({ default: 0 })
  soldCount: number;

  @Prop({
    type: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
  })
  rating: {
    average: number;
    count: number;
  };
}

export const SparePartSchema = SchemaFactory.createForClass(SparePart);

// Basic text index for search
SparePartSchema.index({ 
  name: 'text', 
  description: 'text', 
  tags: 'text', 
  searchKeywords: 'text',
  partNumber: 'text',
  sku: 'text'
});
