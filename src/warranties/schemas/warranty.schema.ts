import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WarrantyDocument = Warranty & Document;

@Schema({ timestamps: true })
export class Warranty {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Visit', required: true })
  visitId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SparePartUsage', required: true })
  sparePartUsageId: Types.ObjectId;

  @Prop({ required: true, enum: ['IN_HOUSE', 'THIRD_PARTY'] })
  warrantyType: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({
    type: String,
    enum: ['ACTIVE', 'EXPIRED'],
    default: 'ACTIVE',
  })
  status: string;
}

export const WarrantySchema = SchemaFactory.createForClass(Warranty);
