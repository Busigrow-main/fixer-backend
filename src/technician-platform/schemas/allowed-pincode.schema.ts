import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AllowedPincodeDocument = AllowedPincode & Document;

@Schema({ timestamps: true })
export class AllowedPincode {
  @Prop({ required: true, unique: true })
  pincode: string;

  @Prop({ required: true })
  city: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const AllowedPincodeSchema = SchemaFactory.createForClass(AllowedPincode);
