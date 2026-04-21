import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ModelDocument = Model & Document;

@Schema({ timestamps: true })
export class Model {
  @Prop({ required: true, index: true })
  modelNumber: string; // "RT28T3722S8"

  @Prop({ required: true })
  displayName: string; // "Samsung 253L Double Door"

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Brand', index: true })
  brandId: any;

  @Prop({ required: true, index: true })
  brandSlug: string; // "samsung"

  @Prop({ required: true, index: true })
  applianceTypeSlug: string; // "refrigerator"

  @Prop({ type: Object })
  specifications: Record<string, any>;

  @Prop()
  imageUrl: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const ModelSchema = SchemaFactory.createForClass(Model);
// Compound index for unique model number within a brand
ModelSchema.index({ modelNumber: 1, brandSlug: 1 }, { unique: true });
