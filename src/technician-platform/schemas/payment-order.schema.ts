import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentOrderDocument = PaymentOrder & Document;

@Schema({ timestamps: true })
export class PaymentOrder {
  @Prop({ type: Types.ObjectId, ref: 'Technician', required: true, index: true })
  technicianId: Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: ['JOINING_FEE', 'JOB_PAYMENT'] })
  purpose: string;

  @Prop({ required: true, enum: ['RAZORPAY', 'PHONEPE', 'CASHFREE'] })
  gateway: string;

  @Prop({ required: true })
  gatewayOrderId: string;

  @Prop({
    required: true,
    enum: ['CREATED', 'PAID', 'FAILED', 'EXPIRED'],
    default: 'CREATED',
  })
  status: string;

  @Prop({ type: Object, default: {} })
  gatewayPayload: Record<string, unknown>;
}

export const PaymentOrderSchema = SchemaFactory.createForClass(PaymentOrder);
