import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type LeadDocument = HydratedDocument<Lead>;

export enum LeadType {
  BUSINESS = 'BUSINESS',
  TECHNICIAN = 'TECHNICIAN',
}

export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  IN_PROGRESS = 'IN_PROGRESS',
  CONVERTED = 'CONVERTED',
  REJECTED = 'REJECTED',
}

@Schema({ timestamps: true })
export class Lead {
  @Prop({
    required: true,
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  })
  userId: mongoose.Types.ObjectId;

  @Prop({
    required: true,
    enum: LeadType,
    index: true,
  })
  type: LeadType;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ trim: true })
  email?: string;

  // Business fields
  @Prop({ trim: true })
  shopName?: string;

  @Prop({ trim: true })
  shopAddress?: string;

  // Technician fields
  @Prop({ trim: true })
  address?: string;

  @Prop({ trim: true })
  applianceExpertise?: string;

  @Prop({
    enum: LeadStatus,
    default: LeadStatus.NEW,
    index: true,
  })
  status: LeadStatus;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);