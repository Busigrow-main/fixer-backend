import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  phone: string;

  @Prop()
  email?: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop()
  fullName?: string;

  @Prop({ type: [{ label: String, zip: String, text: String }], default: [] })
  savedAddresses: Record<string, any>[];

  @Prop({ default: 'CUSTOMER', enum: ['CUSTOMER', 'ADMIN'] })
  role: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
