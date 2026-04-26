import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PartCategoryDocument = PartCategory & Document;

@Schema({ timestamps: true })
export class PartCategory {
  @Prop({ required: true, unique: true, index: true })
  slug: string; // "compressors"

  @Prop({ required: true })
  name: string; // "Compressors"

  @Prop({ required: true, index: true })
  applianceTypeSlug: string; // "refrigerator"

  @Prop()
  icon: string; // Material icon name e.g. "settings"

  @Prop()
  description: string;

  @Prop({ default: 0 })
  sortOrder: number;

  @Prop({ default: 0 })
  partCount: number; // denormalized, refreshed with tree

  @Prop({ default: true, index: true })
  isActive: boolean;
}

export const PartCategorySchema = SchemaFactory.createForClass(PartCategory);

// Compound index for lookups by appliance type
PartCategorySchema.index({ applianceTypeSlug: 1, sortOrder: 1 });
