import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export const TECHNICIAN_PART_REQUEST_STATUSES = [
  'PENDING',
  'APPROVED',
  'PARTIALLY_ISSUED',
  'ISSUED',
  'FULFILLED',
  'DENIED',
  'CANCELLED',
] as const;
export type TechnicianPartRequestStatus =
  (typeof TECHNICIAN_PART_REQUEST_STATUSES)[number];

export type TechnicianPartRequestDocument = TechnicianPartRequest & Document;

@Schema({ timestamps: true, collection: 'technician_part_requests' })
export class TechnicianPartRequest {
  @Prop({ type: Types.ObjectId, ref: 'Technician', required: true, index: true })
  technicianId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Visit', required: true, index: true })
  visitId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SparePart', required: true, index: true })
  sparePartId: Types.ObjectId;

  @Prop({ required: true, min: 1, validate: Number.isInteger })
  requestedQuantity: number;

  @Prop({ default: 0, min: 0, validate: Number.isInteger })
  approvedQuantity: number;

  @Prop({ default: 0, min: 0, validate: Number.isInteger })
  issuedQuantity: number;

  @Prop({ default: 0, min: 0, validate: Number.isInteger })
  consumedQuantity: number;

  @Prop({ default: 0, min: 0, validate: Number.isInteger })
  unusedReturnedQuantity: number;

  @Prop({ default: 0, min: 0, validate: Number.isInteger })
  defectiveReturnedQuantity: number;

  @Prop({ type: String, enum: TECHNICIAN_PART_REQUEST_STATUSES, default: 'PENDING', index: true })
  status: TechnicianPartRequestStatus;

  @Prop({ required: true, unique: true, trim: true, maxlength: 200 })
  idempotencyKey: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop({ type: Date })
  reviewedAt?: Date;

  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  events: Array<{
    action: string;
    quantity?: number;
    actorRole: 'ADMIN' | 'TECHNICIAN';
    actorId: Types.ObjectId;
    reason?: string;
    idempotencyKey?: string;
    occurredAt: Date;
  }>;
}

export const TechnicianPartRequestSchema =
  SchemaFactory.createForClass(TechnicianPartRequest);

TechnicianPartRequestSchema.index({ technicianId: 1, createdAt: -1 });
TechnicianPartRequestSchema.index({ bookingId: 1, status: 1, createdAt: -1 });
