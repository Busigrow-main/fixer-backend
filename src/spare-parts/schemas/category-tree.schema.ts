import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CategoryTreeDocument = CategoryTree & Document;

@Schema({ timestamps: true })
export class CategoryTree {
  @Prop({ required: true, unique: true, index: true })
  applianceTypeSlug: string;

  @Prop({ required: true })
  applianceTypeName: string;

  @Prop()
  applianceTypeIcon: string;

  @Prop({ default: 0 })
  sortOrder: number;

  @Prop({ type: [Object], default: [] })
  brands: Array<{
    brandSlug: string;
    brandName: string;
    logoUrl: string;
    partCount: number;
    hasUniversalParts: boolean;
  }>;

  @Prop({ default: 0 })
  universalPartsCount: number;

  @Prop({ default: 0 })
  totalPartsCount: number;
}

export const CategoryTreeSchema = SchemaFactory.createForClass(CategoryTree);
