import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ApplianceTypeDocument = ApplianceType & Document;

@Schema({ timestamps: true })
export class ApplianceType {
  @Prop({ required: true, unique: true, index: true })
  slug: string; // "refrigerator"

  @Prop({ required: true })
  name: string; // "Refrigerator"

  @Prop()
  description: string;

  @Prop()
  icon: string; // Now interpreted as a name for an SVG icon in frontend

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  sortOrder: number;

  @Prop({ default: 0 })
  partCount: number;
}

export const ApplianceTypeSchema = SchemaFactory.createForClass(ApplianceType);
