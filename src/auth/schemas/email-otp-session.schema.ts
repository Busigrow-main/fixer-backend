import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EmailOtpSessionDocument = EmailOtpSession & Document;

@Schema({ timestamps: true })
export class EmailOtpSession {
  @Prop({ required: true, index: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  codeHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: 0 })
  attempts: number;

  @Prop({ default: false })
  verified: boolean;
}

export const EmailOtpSessionSchema =
  SchemaFactory.createForClass(EmailOtpSession);
EmailOtpSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
