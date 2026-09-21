import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ServiceablePincodeDocument = ServiceablePincode & Document;

@Schema({ timestamps: true, collection: 'serviceablepincodes' })
export class ServiceablePincode {
  @Prop({ required: true, unique: true, index: true })
  pincode: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  state: string;

  @Prop({ default: true, index: true })
  isActive: boolean;
}

export const ServiceablePincodeSchema =
  SchemaFactory.createForClass(ServiceablePincode);