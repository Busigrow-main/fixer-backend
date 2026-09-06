import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CustomerApplianceDocument = CustomerAppliance & Document;

@Schema({ timestamps: true, collection: 'customer_appliances' })
export class CustomerAppliance {
  /** Normalized unique identity of the physical appliance. */
  @Prop({ required: true, unique: true, uppercase: true, trim: true, index: true })
  serialNumber: string;

  /** Associated contact phones (normalized 10-digit). */
  @Prop({ type: [String], default: [] })
  phones: string[];

  @Prop({ default: '' })
  brand: string;

  @Prop({ default: '' })
  modelNumber: string;

  /** Booking that first established the serial mapping. */
  @Prop({ type: Types.ObjectId, ref: 'Booking', default: null })
  primaryBookingId: Types.ObjectId | null;

  /** Related service bookings linked to this appliance. */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Booking' }], default: [] })
  bookingIds: Types.ObjectId[];

  @Prop({
    type: String,
    enum: ['ADMIN', 'TECHNICIAN', 'SYSTEM'],
    default: 'ADMIN',
  })
  mappedBy: 'ADMIN' | 'TECHNICIAN' | 'SYSTEM';

  @Prop({ type: Date, default: null })
  mappedAt: Date | null;
}

export const CustomerApplianceSchema =
  SchemaFactory.createForClass(CustomerAppliance);

CustomerApplianceSchema.index({ phones: 1 });
