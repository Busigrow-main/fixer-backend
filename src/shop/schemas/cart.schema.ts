import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import type { ShopProductType } from '../shop-pricing';

export type ShopCartDocument = ShopCart & Document;

@Schema({ _id: true })
export class ShopCartItem {
  @Prop({ type: String, enum: ['part', 'appliance'], required: true })
  productType: ShopProductType;

  @Prop({ type: Types.ObjectId, required: true })
  productId: Types.ObjectId;

  @Prop()
  sku?: string;

  @Prop()
  slug?: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  image?: string;

  @Prop({ required: true, min: 0 })
  unitPrice: number;

  @Prop({ min: 0 })
  originalPrice?: number;

  @Prop({ required: true, min: 1, default: 1 })
  quantity: number;

  @Prop()
  installationOptionId?: string;

  @Prop({ min: 0, default: 0 })
  installationCharge: number;
}

export const ShopCartItemSchema = SchemaFactory.createForClass(ShopCartItem);

@Schema({ _id: false })
export class ShopCartCoupon {
  @Prop({ required: true, uppercase: true, trim: true })
  code: string;

  @Prop()
  title?: string;

  @Prop()
  discountText?: string;
}

export const ShopCartCouponSchema = SchemaFactory.createForClass(ShopCartCoupon);

@Schema({ timestamps: true, collection: 'shopcarts' })
export class ShopCart {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: [ShopCartItemSchema], default: [] })
  items: Types.DocumentArray<ShopCartItem>;

  @Prop({ type: [ShopCartCouponSchema], default: [] })
  coupons: ShopCartCoupon[];
}

export const ShopCartSchema = SchemaFactory.createForClass(ShopCart);
