
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SettlementItemDocument = HydratedDocument<SettlementItem>;

export enum SettlementItemClaimStatus {
  CLAIMED = 'CLAIMED',
  FINALIZED = 'FINALIZED',
  RELEASED = 'RELEASED',
}

@Schema({ timestamps: true })
export class SettlementItem {
  @Prop({
    type: Types.ObjectId,
    ref: 'Settlement',
    required: true,
    index: true,
  })
  settlementId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Earning',
    required: true,
  })
  earningId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Technician',
    required: true,
    index: true,
  })
  technicianId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Booking',
  })
  bookingId?: Types.ObjectId;

  // Snapshot of the earning at settlement preparation time.
  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  earningType: string;

  @Prop()
  description?: string;

  @Prop()
  earnedAt: Date;

  @Prop()
  customerPaymentMethod?: string;

  @Prop({
    type: String,
    enum: Object.values(SettlementItemClaimStatus),
    default: SettlementItemClaimStatus.CLAIMED,
    required: true,
  })
  claimStatus: SettlementItemClaimStatus;
}

export const SettlementItemSchema =
  SchemaFactory.createForClass(SettlementItem);

// Never include the same earning twice in one settlement.
SettlementItemSchema.index(
  { settlementId: 1, earningId: 1 },
  { unique: true },
);

// An earning can belong to only one active or finalized settlement.
// RELEASED is retained for audit-compatible legacy/manual workflows; preparation
// recovery keeps CLAIMED items and finalizes them instead of releasing them.
SettlementItemSchema.index(
  { earningId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      claimStatus: {
        $in: [
          SettlementItemClaimStatus.CLAIMED,
          SettlementItemClaimStatus.FINALIZED,
        ],
      },
    },
  },
);

SettlementItemSchema.index({ technicianId: 1, createdAt: -1 });
