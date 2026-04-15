import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WarrantyDocument = Warranty & Document;

@Schema({ timestamps: true })
export class Warranty {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Visit' })
  visitId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SparePartUsage' })
  sparePartUsageId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['SERVICE', 'PART'],
    default: 'SERVICE',
  })
  type: string;

  @Prop({ required: true, enum: ['IN_HOUSE', 'THIRD_PARTY'] })
  warrantyType: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({
    type: String,
    enum: ['ACTIVE', 'EXPIRED', 'CLAIMED'],
    default: 'ACTIVE',
  })
  status: string;
}

export const WarrantySchema = SchemaFactory.createForClass(Warranty);
