import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SparePartUsageDocument = SparePartUsage & Document;

@Schema({ timestamps: true })
export class SparePartUsage {
  @Prop({ type: Types.ObjectId, ref: 'Visit', required: true })
  visitId: Types.ObjectId;

  @Prop({ required: true })
  isThirdParty: boolean;

  // In-house fields
  @Prop({ type: Types.ObjectId, ref: 'SparePart' })
  sparePartId?: Types.ObjectId;

  @Prop()
  quantity?: number;

  // Third-party fields
  @Prop()
  partName?: string;

  @Prop()
  cost?: number;

  @Prop()
  vendor?: string;

  @Prop()
  warrantyInfo?: string; // Pre-filled or calculated (like "24-hour replacement")
}

export const SparePartUsageSchema = SchemaFactory.createForClass(SparePartUsage);
