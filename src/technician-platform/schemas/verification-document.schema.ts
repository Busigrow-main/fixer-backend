import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VerificationDocumentDocument = VerificationDocument & Document;

@Schema({ timestamps: true })
export class VerificationDocument {
  @Prop({ type: Types.ObjectId, ref: 'Technician', required: true, index: true })
  technicianId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['AADHAAR', 'PAN', 'DRIVING_LICENSE'],
  })
  documentType: string;

  @Prop({ required: true })
  fileUrl: string;

  @Prop({
    required: true,
    enum: ['PENDING', 'VERIFIED', 'REJECTED'],
    default: 'PENDING',
  })
  status: string;

  @Prop()
  rejectionReason?: string;

  @Prop()
  reviewedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;
}

export const VerificationDocumentSchema =
  SchemaFactory.createForClass(VerificationDocument);
