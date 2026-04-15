import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BookingDocument = Booking & Document;

@Schema({ timestamps: true })
export class Booking {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Technician' })
  technicianId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Service', required: true })
  serviceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  subCategoryId: Types.ObjectId;

  @Prop({ required: true })
  contactPhone: string;

  @Prop({ type: Object, required: true })
  addressData: {
    zip: string;
    text: string;
  };

  @Prop()
  description: string;

  @Prop({
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'RESCHEDULED', 'CANCELLED'],
    default: 'PENDING'
  })
  status: string;

  @Prop({
    type: String,
    enum: ['REPAIR', 'INSTALLATION', 'MAINTENANCE', 'WARRANTY_CHECK'],
    default: 'REPAIR'
  })
  serviceType: string;

  @Prop({
    type: String,
    enum: ['UNPAID', 'PAID_CASH', 'PAID_ONLINE', 'WARRANTY_SERVICE'],
    default: 'UNPAID'
  })
  paymentStatus: string;

  @Prop({ type: Object, default: {} })
  productDetails?: {
    brand?: string;
    modelNumber?: string;
    serialNumber?: string;
  };

  @Prop({ type: [String], default: [] })
  adminNotes: string[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Visit' }], default: [] })
  visits: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Feedback' })
  feedbackId?: Types.ObjectId;

  @Prop({ type: Object })
  invoiceData?: {
    url?: string;
    totalAmount?: number;
    generatedAt?: Date;
    partsTotal?: number;
    serviceTotal?: number;
    additionalCharges?: { label: string, amount: number }[];
    grandTotal?: number;
  };

  @Prop({ type: Object, default: {} })
  jobDetails?: {
    diagnosis?: string;
    workDone?: string;
    recommendations?: string;
    warrantyPeriod?: string;
  };

  @Prop({ default: false })
  isBilled: boolean;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
