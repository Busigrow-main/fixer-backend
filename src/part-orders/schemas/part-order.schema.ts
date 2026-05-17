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

@Schema({ _id: false })
export class ApplianceOrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Appliance' })
  applianceId?: Types.ObjectId;

  @Prop({ required: true })
  slug: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  brand?: string;

  @Prop()
  modelNumber?: string;

  @Prop()
  price?: number;

  @Prop({ required: true, default: 1, min: 1 })
  quantity: number;
}
export const ApplianceOrderItemSchema = SchemaFactory.createForClass(ApplianceOrderItem);

@Schema({ _id: false })
export class BillLineItem {
  @Prop({ required: true })
  description: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  unitPrice: number;

  @Prop({ required: true, min: 0 })
  amount: number;
}
export const BillLineItemSchema = SchemaFactory.createForClass(BillLineItem);

@Schema({ _id: false })
export class OrderInvoiceData {
  @Prop({ type: [BillLineItemSchema], default: [] })
  lineItems: BillLineItem[];

  @Prop({ default: 0 })
  subtotal: number;

  @Prop({ default: 0 })
  taxPercent: number;

  @Prop({ default: 0 })
  taxAmount: number;

  @Prop({ default: 0 })
  totalAmount: number;

  @Prop()
  notes?: string;

  @Prop()
  generatedAt?: Date;

  @Prop()
  finalizedAt?: Date;
}
export const OrderInvoiceDataSchema = SchemaFactory.createForClass(OrderInvoiceData);

@Schema({ timestamps: true })
export class PartOrder {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: ['part', 'appliance'], default: 'part' })
  orderType: 'part' | 'appliance';

  @Prop({
    type: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String },
      address: { type: String, required: true },
      preferredDate: { type: String },
      preferredTime: { type: String },
      notes: { type: String },
    },
    required: true,
  })
  contactData: {
    name: string;
    phone: string;
    email?: string;
    address: string;
    preferredDate?: string;
    preferredTime?: string;
    notes?: string;
  };

  @Prop({ type: [OrderItemSchema], default: [] })
  items: Types.DocumentArray<OrderItem>;

  @Prop({ type: ApplianceOrderItemSchema })
  applianceItem?: ApplianceOrderItem;

  @Prop({
    type: String,
    enum: ['PENDING', 'PROCESSING', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'RETURNED'],
    default: 'PENDING',
  })
  status: string;

  @Prop({ type: Object })
  courierTracking?: {
    courierName: string;
    trackingNumber: string;
  };

  @Prop({ type: OrderInvoiceDataSchema, default: {} })
  invoiceData?: OrderInvoiceData;

  @Prop({
    type: String,
    enum: ['UNPAID', 'PAID'],
    default: 'UNPAID',
  })
  paymentStatus: 'UNPAID' | 'PAID';

  @Prop({ default: false })
  isBilled: boolean;
}

export const PartOrderSchema = SchemaFactory.createForClass(PartOrder);
