import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OnboardingEventDocument = OnboardingEvent & Document;

@Schema({ timestamps: true })
export class OnboardingEvent {
  @Prop({ type: Types.ObjectId, ref: 'Technician', required: true, index: true })
  technicianId: Types.ObjectId;

  @Prop({ required: true })
  event: string;

  @Prop()
  step?: number;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;
}

export const OnboardingEventSchema = SchemaFactory.createForClass(OnboardingEvent);
