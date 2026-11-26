
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SettlementDocument = HydratedDocument<Settlement>;

export enum SettlementStatus {
    PREPARING = 'PREPARING',
    PREPARED = 'PREPARED',
    PREPARATION_FAILED = 'PREPARATION_FAILED',
    APPROVED = 'APPROVED',
    PAYABLE = 'PAYABLE',
    REJECTED = 'REJECTED',
    PAID = 'PAID',
    RECONCILED = 'RECONCILED',
    CANCELLED = 'CANCELLED',
  }

export enum SettlementPaymentStatus {
  NOT_INITIATED = 'NOT_INITIATED',
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum SettlementReconciliationStatus {
  PENDING = 'PENDING',
  MATCHED = 'MATCHED',
  DISPUTED = 'DISPUTED',
}

@Schema({ _id: false })
export class SettlementAuditEntry {
  @Prop({ required: true })
  action: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  performedBy?: Types.ObjectId;

  @Prop({ required: true, default: Date.now })
  performedAt: Date;

  @Prop()
  reason?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const SettlementAuditEntrySchema =
  SchemaFactory.createForClass(SettlementAuditEntry);

@Schema({ _id: true })
export class SettlementAdjustment {
  @Prop({ trim: true })
  idempotencyKey?: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, trim: true, maxlength: 500 })
  reason: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  performedBy: Types.ObjectId;

  @Prop({ required: true, default: Date.now })
  performedAt: Date;
}

export const SettlementAdjustmentSchema =
  SchemaFactory.createForClass(SettlementAdjustment);

@Schema({ timestamps: true })
export class Settlement {
  @Prop({
    type: Types.ObjectId,
    ref: 'Technician',
    required: true,
    index: true,
  })
  technicianId: Types.ObjectId;

  // Indian business date, YYYY-MM-DD.
  @Prop({ required: true })
  settlementDate: string;

  // Exact timestamp at which eligible earnings were collected.
  @Prop({ required: true })
  cutoffAt: Date;

  @Prop({ required: true, default: 0 })
  totalEarnings: number;

  @Prop({ required: true, default: 0 })
  adjustments: number;

  @Prop({ type: [SettlementAdjustmentSchema], default: [] })
  adjustmentEntries: SettlementAdjustment[];

  @Prop({ required: true, default: 0 })
  netPayable: number;

  @Prop({ default: 'INR', required: true })
  currency: string;

  @Prop({
    type: String,
    enum: Object.values(SettlementStatus),
    default: SettlementStatus.PREPARED,
    index: true,
  })
  status: SettlementStatus;

  @Prop({
    type: String,
    enum: Object.values(SettlementPaymentStatus),
    default: SettlementPaymentStatus.NOT_INITIATED,
  })
  paymentStatus: SettlementPaymentStatus;

  @Prop({
    type: String,
    enum: Object.values(SettlementReconciliationStatus),
    default: SettlementReconciliationStatus.PENDING,
  })
  reconciliationStatus: SettlementReconciliationStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop()
  approvedAt?: Date;

  @Prop()
  rejectedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  rejectedBy?: Types.ObjectId;

  @Prop()
  rejectionReason?: string;

  @Prop()
  paymentReference?: string;

  @Prop()
  paymentMethod?: string;

  @Prop()
  paymentInitiatedAt?: Date;

  @Prop()
  paidAt?: Date;

  @Prop()
  paymentFailureReason?: string;

  @Prop()
  preparationFailureReason?: string;

  @Prop()
  reconciledAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reconciledBy?: Types.ObjectId;

  @Prop()
  reconciliationNotes?: string;

  @Prop()
  preparationToken?: string;

  @Prop()
  preparationLeaseUntil?: Date;

  @Prop({ type: [SettlementAuditEntrySchema], default: [] })
  auditTrail: SettlementAuditEntry[];
}

export const SettlementSchema =
  SchemaFactory.createForClass(Settlement);

// One settlement per technician per Indian business date.
// Also makes a repeated nightly preparation idempotent at batch level.
SettlementSchema.index(
  { technicianId: 1, settlementDate: 1 },
  { unique: true },
);

SettlementSchema.index({ status: 1, settlementDate: -1 });
SettlementSchema.index({ paymentStatus: 1, settlementDate: -1 });
SettlementSchema.index({ paymentReference: 1 }, { unique: true, sparse: true });
