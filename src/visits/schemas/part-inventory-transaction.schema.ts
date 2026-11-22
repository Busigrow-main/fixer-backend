import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export const PART_INVENTORY_TRANSACTION_TYPES = [
  'RESERVE',
  'RELEASE',
  'ISSUE',
  'CONSUME',
  'RETURN',
] as const;
export type PartInventoryTransactionType =
  (typeof PART_INVENTORY_TRANSACTION_TYPES)[number];

export type PartInventoryTransactionDocument =
  PartInventoryTransaction & Document;

@Schema({ timestamps: true })
export class PartInventoryTransaction {
  @Prop({ type: Types.ObjectId, ref: 'Technician', required: true, index: true })
  technicianId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Visit', required: true, index: true })
  visitId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'SparePart', required: true, index: true })
  sparePartId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'SparePartUsage',
    index: true,
  })
  sparePartUsageId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'TechnicianPartRequest', index: true })
  partRequestId?: Types.ObjectId;

  @Prop({ required: true, min: 1, validate: Number.isInteger })
  quantity: number;

  @Prop({
    type: String,
    enum: PART_INVENTORY_TRANSACTION_TYPES,
    required: true,
    index: true,
  })
  type: PartInventoryTransactionType;

  @Prop({ type: Types.ObjectId, ref: 'PartInventoryTransaction' })
  relatedTransactionId?: Types.ObjectId;

  @Prop({ type: String, enum: ['UNUSED', 'DEFECTIVE'] })
  returnCondition?: 'UNUSED' | 'DEFECTIVE';

  @Prop({ type: String, enum: ['ADMIN', 'TECHNICIAN', 'SYSTEM'] })
  actorRole?: 'ADMIN' | 'TECHNICIAN' | 'SYSTEM';

  @Prop({ type: Types.ObjectId })
  actorId?: Types.ObjectId;

  @Prop({ type: String, trim: true, maxlength: 500 })
  reason?: string;

  @Prop({ required: true, unique: true, trim: true })
  idempotencyKey: string;
}

export const PartInventoryTransactionSchema =
  SchemaFactory.createForClass(PartInventoryTransaction);

PartInventoryTransactionSchema.index({ technicianId: 1, createdAt: -1 });
PartInventoryTransactionSchema.index({ relatedTransactionId: 1, type: 1 });
