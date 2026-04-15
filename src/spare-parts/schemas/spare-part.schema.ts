import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SparePartDocument = SparePart & Document;

@Schema({ timestamps: true })
export class SparePart {
  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ unique: true, sparse: true, index: true })
  partNumber: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, index: true })
  category: string;

  @Prop({ index: true })
  subCategory: string;

  @Prop({ required: true })
  price: string;

  @Prop({ default: 0 })
  stock: number;

  @Prop()
  manufacturer: string;

  @Prop()
  seller: string;

  @Prop()
  deliveryEta: string;

  @Prop()
  warranty: string;

  @Prop({ default: false })
  supportsServiceBooking: boolean;

  @Prop({ type: [String], default: [] })
  compatibleModels: string[];

  @Prop({ type: [String], default: [] })
  highlights: string[];

  @Prop({ required: true })
  image: string;

  @Prop({ required: true })
  description: string;
}

export const SparePartSchema = SchemaFactory.createForClass(SparePart);
