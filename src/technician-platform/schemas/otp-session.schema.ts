import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OtpSessionDocument = OtpSession & Document;

@Schema({ timestamps: true })
export class OtpSession {
  @Prop({ required: true, index: true })
  phone: string;

  @Prop({ required: true })
  codeHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: 0 })
  attempts: number;

  @Prop({ default: false })
  verified: boolean;
}

export const OtpSessionSchema = SchemaFactory.createForClass(OtpSession);
OtpSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
