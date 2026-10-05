import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ShopPartHelpRequestDocument = ShopPartHelpRequest & Document;

export const SHOP_PART_HELP_STATUSES = [
  'PENDING',
  'QUOTED',
  'ACCEPTED',
  'DECLINED',
  'CANCELLED',
  'CONVERTED',
] as const;

@Schema({ timestamps: true })
export class ShopPartHelpRequest {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String },
      address: { type: String, required: true },
    },
    required: true,
  })
  contactData: { name: string; phone: string; email?: string; address: string };

  @Prop({ required: true, trim: true })
  applianceType: string;

  @Prop({ trim: true })
  applianceBrand?: string;

  @Prop({ trim: true })
  applianceModel?: string;

  @Prop({ required: true, trim: true })
  partDescription: string;

  @Prop({ type: Types.ObjectId, ref: 'SparePart' })
  requestedSparePartId?: Types.ObjectId;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ required: true, min: 1, default: 1 })
  quantity: number;

  @Prop({ type: String, enum: SHOP_PART_HELP_STATUSES, default: 'PENDING', index: true })
  status: (typeof SHOP_PART_HELP_STATUSES)[number];

  @Prop({ type: Types.ObjectId, ref: 'SparePart' })
  suggestedSparePartId?: Types.ObjectId;

  // Quoted Shop prices are represented in rupees, matching order invoice unitPrice.
  @Prop({ min: 0 })
  quotedPrice?: number;

  @Prop()
  isAvailable?: boolean;

  @Prop({ trim: true })
  adminResponse?: string;

  @Prop()
  acceptedAt?: Date;

  @Prop()
  declinedAt?: Date;

  @Prop()
  cancelledAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'PartOrder' })
  convertedPartOrderId?: Types.ObjectId;
}

export const ShopPartHelpRequestSchema =
  SchemaFactory.createForClass(ShopPartHelpRequest);
