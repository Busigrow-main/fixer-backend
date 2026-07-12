import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EarningDocument = Earning & Document;

@Schema({ timestamps: true })
export class Earning {
  @Prop({ type: Types.ObjectId, ref: 'Technician', required: true, index: true })
  technicianId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Booking' })
  bookingId?: Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: ['LABOUR', 'PARTS', 'BONUS', 'JOINING_FEE_REFUND'] })
  type: string;

  @Prop({ required: true, enum: ['CASH', 'UPI', 'CARD', 'ONLINE'] })
  paymentMethod: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  earnedAt: Date;
}

export const EarningSchema = SchemaFactory.createForClass(Earning);
