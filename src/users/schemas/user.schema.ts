import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  /** Set at booking time for Google accounts. Required for phone sign-in. */
  @Prop({ unique: true, sparse: true })
  phone?: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop()
  email?: string;

  /** Google account subject (`sub`) when the user signed in with Google. */
  @Prop({ unique: true, sparse: true, index: true })
  googleId?: string;

  @Prop()
  fullName?: string;

  @Prop({ type: [{ label: String, zip: String, text: String }], default: [] })
  savedAddresses: Record<string, any>[];

  @Prop({ default: 'CUSTOMER', enum: ['CUSTOMER', 'ADMIN', 'TECHNICIAN'] })
  role: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
