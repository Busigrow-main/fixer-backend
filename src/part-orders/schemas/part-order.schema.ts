import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PartOrderDocument = PartOrder & Document;

@Schema()
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'SparePart', required: true })
  partId: Types.ObjectId;

  @Prop({ required: true, default: 1 })
  quantity: number;

  @Prop()
  priceAtPurchase: string;
}
export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ timestamps: true })
export class PartOrder {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Object, required: true })
  contactData: {
    name: string;
    phone: string;
    email?: string;
    address: string;
  };

  @Prop({ type: [OrderItemSchema], required: true })
  items: Types.DocumentArray<OrderItem>;

  @Prop({
    type: String,
    enum: ['PENDING', 'PROCESSING', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'RETURNED'],
    default: 'PENDING'
  })
  status: string;

  @Prop({ type: Object })
  courierTracking?: {
    courierName: string;
    trackingNumber: string;
  };
}

export const PartOrderSchema = SchemaFactory.createForClass(PartOrder);
