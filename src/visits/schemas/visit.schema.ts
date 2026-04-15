import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VisitDocument = Visit & Document;

@Schema({ timestamps: true })
export class Visit {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true })
  bookingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Technician', required: true })
  technicianId: Types.ObjectId;

  @Prop({ required: true, enum: [1, 2] })
  visitOrder: number;

  @Prop()
  scheduledDate?: Date;

  @Prop()
  timeIn?: Date;

  @Prop()
  timeOut?: Date;

  @Prop()
  jobDescription?: string;

  @Prop({
    type: String,
    enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'],
    default: 'SCHEDULED',
  })
  status: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'SparePartUsage' }], default: [] })
  partsUsed: Types.ObjectId[];
}

export const VisitSchema = SchemaFactory.createForClass(Visit);
