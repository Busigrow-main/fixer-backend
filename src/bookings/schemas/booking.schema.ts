import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BookingDocument = Booking & Document;

@Schema({ timestamps: true })
export class Booking {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Service', required: true })
  serviceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  subCategoryId: Types.ObjectId;

  @Prop({ required: true })
  contactPhone: string;

  @Prop({ type: Object, required: true })
  addressData: {
    zip: string;
    text: string;
  };

  @Prop()
  description: string;

  @Prop({
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'RESCHEDULED', 'CANCELLED'],
    default: 'PENDING'
  })
  status: string;

  @Prop({ type: [String], default: [] })
  adminNotes: string[];
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
