import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FeedbackFollowUpDocument = FeedbackFollowUp & Document;

export const FEEDBACK_FOLLOW_UP_STATUSES = ['OPEN', 'RESOLVED'] as const;

@Schema({ timestamps: true })
export class FeedbackFollowUp {
  @Prop({
    type: Types.ObjectId,
    ref: 'Feedback',
    required: true,
    unique: true,
  })
  feedbackId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Booking',
    required: true,
    unique: true,
    index: true,
  })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  ownerId?: Types.ObjectId;

  @Prop()
  dueDate?: Date;

  @Prop({
    type: String,
    enum: FEEDBACK_FOLLOW_UP_STATUSES,
    default: 'OPEN',
    index: true,
  })
  status: (typeof FEEDBACK_FOLLOW_UP_STATUSES)[number];

  @Prop({ trim: true, maxlength: 2000 })
  resolution?: string;

  @Prop()
  resolvedAt?: Date;
}

export const FeedbackFollowUpSchema =
  SchemaFactory.createForClass(FeedbackFollowUp);
