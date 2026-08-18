import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ServiceDocument = Service & Document;

@Schema()
export class SubCategory {
  @Prop({ type: Types.ObjectId, auto: true })
  _id: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  price: string;

  /** Canonical numeric price in paise (e.g. 24900 = ₹249). Null = legacy, fallback to string parse. */
  @Prop()
  priceNumeric?: number;
}
export const SubCategorySchema = SchemaFactory.createForClass(SubCategory);

@Schema({ timestamps: true })
export class Service {
  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  startingPrice: string;

  /** Canonical numeric starting price in paise. Null = legacy, fallback to string parse. */
  @Prop()
  startingPriceNumeric?: number;

  @Prop({ required: true })
  icon: string;

  @Prop({ required: true })
  image: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [String], default: [] })
  features: string[];

  @Prop({ type: [SubCategorySchema], default: [] })
  subCategories: Types.DocumentArray<SubCategory>;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);
