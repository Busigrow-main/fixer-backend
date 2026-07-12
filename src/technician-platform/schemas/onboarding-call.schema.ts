import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OnboardingCallDocument = OnboardingCall & Document;

@Schema({ timestamps: true })
export class OnboardingCall {
  @Prop({ type: Types.ObjectId, ref: 'Technician', required: true, index: true })
  technicianId: Types.ObjectId;

  @Prop({ required: true })
  duration: number;

  @Prop({ required: true })
  outcome: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  calledBy?: Types.ObjectId;

  @Prop()
  notes?: string;
}

export const OnboardingCallSchema = SchemaFactory.createForClass(OnboardingCall);
