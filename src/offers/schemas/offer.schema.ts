import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OfferDocument = Offer & Document;

export const OFFER_THEMES = ['RED', 'DARK', 'BLUE', 'GOLD'] as const;
export type OfferTheme = (typeof OFFER_THEMES)[number];

export const OFFER_AUDIENCES = ['ALL', 'SERVICES', 'SHOP'] as const;
export type OfferAudience = (typeof OFFER_AUDIENCES)[number];

@Schema({ timestamps: true })
export class Offer {
  /** Internal key used by repeatable seeds; omitted for normal admin campaigns. */
  @Prop({ unique: true, sparse: true, trim: true })
  campaignKey?: string;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ default: '', trim: true })
  description: string;

  @Prop({ default: 'Limited time', trim: true })
  badge: string;

  @Prop({ required: true, trim: true })
  discountText: string;

  @Prop({ default: '', uppercase: true, trim: true })
  couponCode: string;

  @Prop({ default: '', trim: true })
  imageUrl: string;

  @Prop({ default: 'Explore offer', trim: true })
  ctaLabel: string;

  @Prop({ default: '/services', trim: true })
  ctaHref: string;

  @Prop({ type: String, enum: OFFER_THEMES, default: 'RED' })
  theme: OfferTheme;

  @Prop({ type: String, enum: OFFER_AUDIENCES, default: 'ALL' })
  audience: OfferAudience;

  @Prop({ default: '', trim: true })
  terms: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  startsAt: Date | null;

  @Prop({ type: Date, default: null })
  endsAt: Date | null;

  @Prop({ default: 0, min: 0 })
  priority: number;
}

export const OfferSchema = SchemaFactory.createForClass(Offer);

OfferSchema.index({ isActive: 1, startsAt: 1, endsAt: 1, priority: -1 });
