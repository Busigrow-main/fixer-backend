import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class ProductDetails {
  @Prop({ default: "" }) brand: string;
  @Prop({ default: "" }) modelNumber: string;
  @Prop({ default: "" }) serialNumber: string;
}
export const ProductDetailsSchema = SchemaFactory.createForClass(ProductDetails);

@Schema({ _id: false })
export class JobDetails {
  @Prop({ default: "" }) diagnosis: string;
  @Prop({ default: "" }) workDone: string;
  @Prop({ default: "" }) recommendations: string;
  @Prop({ default: "60 Days" }) warrantyPeriod: string;

  // New Job Sheet Fields
  @Prop({ default: "" }) asset: string;
  @Prop({ default: "" }) warrantyCode: string;
  @Prop({ default: "" }) warrantyDesc: string;
  @Prop({ default: "" }) assetSaleDate: string;
  @Prop({ default: "" }) assetExpiryDate: string;
  @Prop({ default: "" }) contractCode: string;
  @Prop({ default: "" }) contractDesc: string;
  @Prop({ default: "" }) contractStartDate: string;
  @Prop({ default: "" }) contractExpiryDate: string;
  @Prop({ default: "" }) visitCategory: string;
  @Prop({ default: "" }) invoiceNumber: string;
}
export const JobDetailsSchema = SchemaFactory.createForClass(JobDetails);

@Schema({ _id: false })
export class AdditionalCharge {
  @Prop({ required: true }) label: string;
  @Prop({ required: true, default: 0 }) amount: number;
}
export const AdditionalChargeSchema = SchemaFactory.createForClass(AdditionalCharge);

@Schema({ _id: false })
export class InvoiceData {
  @Prop() url: string;
  @Prop({ default: 0 }) serviceTotal: number;
  @Prop({ default: 0 }) partsTotal: number;
  @Prop({ type: [AdditionalChargeSchema], default: [] }) additionalCharges: AdditionalCharge[];
  @Prop({ 
    type: [{ 
      partName: String, 
      quantity: Number, 
      cost: Number, 
      isThirdParty: Boolean 
    }], 
    default: [] 
  }) spareParts: { partName: string, quantity: number, cost: number, isThirdParty: boolean }[];
  @Prop({ default: 0 }) totalAmount: number;
  @Prop() generatedAt: Date;
}
export const InvoiceDataSchema = SchemaFactory.createForClass(InvoiceData);

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

  @Prop({ type: ProductDetailsSchema, default: {} })
  productDetails: ProductDetails;

  @Prop({ type: JobDetailsSchema, default: {} })
  jobDetails: JobDetails;

  @Prop({ type: InvoiceDataSchema, default: {} })
  invoiceData: InvoiceData;

  @Prop({ type: [String], default: [] })
  adminNotes: string[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Visit' }], default: [] })
  visits: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Feedback' })
  feedbackId?: Types.ObjectId;

  @Prop()
  warrantyExpiry?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Booking' })
  parentId?: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Booking' }], default: [] })
  claimBookingIds: Types.ObjectId[];

  @Prop({ default: false })
  isBilled: boolean;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
