import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TechnicianDocument = Technician & Document;

@Schema({ _id: false })
export class BankDetails {
  @Prop() accountName?: string;
  @Prop() accountNumber?: string;
  @Prop() ifsc?: string;
  @Prop() bankName?: string;
}
export const BankDetailsSchema = SchemaFactory.createForClass(BankDetails);

@Schema({ timestamps: true })
export class Technician {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  phone: string;

  @Prop()
  email?: string;

  @Prop({ type: [String], default: [] })
  skills: string[];

  @Prop({ type: [String], default: [] })
  serviceCategories: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({
    type: String,
    enum: ['AVAILABLE', 'ON_JOB', 'UNAVAILABLE'],
    default: 'AVAILABLE',
  })
  availabilityStatus: string;

  @Prop({ default: 0 })
  averageRating: number;

  @Prop({ default: 0 })
  totalCompletedJobs: number;

  @Prop({ default: 1 })
  onboardingStep: number;

  @Prop({ default: false })
  joiningFeePaid: boolean;

  @Prop({ default: false })
  profileCompleted: boolean;

  @Prop({ default: false })
  idVerified: boolean;

  @Prop({
    type: String,
    enum: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED'],
    default: 'DRAFT',
  })
  onboardingStatus: string;

  @Prop({
    type: String,
    enum: ['NOT_REQUESTED', 'REQUESTED', 'PENDING', 'VERIFIED', 'REJECTED'],
    default: 'NOT_REQUESTED',
  })
  verificationStatus: string;

  @Prop()
  profilePhotoUrl?: string;

  @Prop({ default: 0 })
  experienceYears: number;

  @Prop({ type: [String], default: [] })
  serviceAreas: string[];

  @Prop()
  pincode?: string;

  @Prop()
  aadhaarNumber?: string;

  @Prop()
  panNumber?: string;

  @Prop()
  address?: string;

  @Prop()
  city?: string;

  @Prop({ type: BankDetailsSchema, default: {} })
  bankDetails: BankDetails;

  @Prop()
  upiId?: string;

  @Prop()
  rejectionReason?: string;

  @Prop()
  submittedAt?: Date;

  @Prop()
  approvedAt?: Date;

  @Prop()
  onboardingCompletedAt?: Date;
}

export const TechnicianSchema = SchemaFactory.createForClass(Technician);
