import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TechnicianDocument = Technician & Document;

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
}

export const TechnicianSchema = SchemaFactory.createForClass(Technician);
