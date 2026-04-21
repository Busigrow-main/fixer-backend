import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BrandDocument = Brand & Document;

@Schema({ timestamps: true })
export class Brand {
  @Prop({ required: true, unique: true, index: true })
  slug: string; // "samsung"

  @Prop({ required: true })
  name: string; // "Samsung"

  @Prop()
  logoUrl: string;

  @Prop({ type: [String], index: true })
  applianceTypes: string[]; // ["refrigerator", "washing-machine"]

  @Prop({ default: true })
  isActive: boolean;
}

export const BrandSchema = SchemaFactory.createForClass(Brand);
