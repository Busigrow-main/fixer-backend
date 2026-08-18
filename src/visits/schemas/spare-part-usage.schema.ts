import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SparePartUsageDocument = SparePartUsage & Document;

@Schema({ timestamps: true })
export class SparePartUsage {
  @Prop({ type: Types.ObjectId, ref: 'Visit', required: true })
  visitId: Types.ObjectId;

  @Prop({ required: true })
  isThirdParty: boolean;

  // In-house fields
  @Prop({ type: Types.ObjectId, ref: 'SparePart' })
  sparePartId?: Types.ObjectId;

  @Prop()
  quantity?: number;

  // Third-party fields
  @Prop()
  partName?: string;

  @Prop()
  cost?: number;

  @Prop()
  vendor?: string;

  @Prop()
  warrantyInfo?: string; // Pre-filled or calculated (like "24-hour replacement")

  /** INVENTORY = Fixxer stock; SELF = technician-sourced / third-party. */
  @Prop({ type: String, enum: ['INVENTORY', 'SELF'] })
  sourcedBy?: string;

  /** Platform fee charged to technician for self-sourced parts (₹100). */
  @Prop({ default: 0 })
  platformFeeAmount?: number;

  /** True once SELF_PART_FEE earning debit has been recorded. */
  @Prop({ default: false })
  platformFeeApplied?: boolean;

  /** Physical unit serial for warranty registration (normalized uppercase). */
  @Prop({ trim: true, uppercase: true, index: true })
  serialNumber?: string;

  /** Date the part was installed — warranty clock start. */
  @Prop({ type: Date })
  installedAt?: Date;

  /** Snapshot of warranty duration in months at install time. */
  @Prop()
  warrantyMonths?: number;

  /** True when this line replaces a still-covered original part (customer not charged). */
  @Prop({ default: false })
  warrantyCovered?: boolean;

  /** Original spare-part usage this line is replacing on a warranty claim. */
  @Prop({ type: Types.ObjectId, ref: 'SparePartUsage' })
  replacedUsageId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Warranty' })
  replacedWarrantyId?: Types.ObjectId;
}

export const SparePartUsageSchema = SchemaFactory.createForClass(SparePartUsage);

// Unique among usages that have a serial (sparse skips null/undefined)
SparePartUsageSchema.index(
  { serialNumber: 1 },
  { unique: true, sparse: true, name: 'spare_part_usage_serial_unique' },
);
