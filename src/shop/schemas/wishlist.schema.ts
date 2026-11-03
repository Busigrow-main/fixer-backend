import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import type { ShopProductType } from '../shop-pricing';

export type ShopWishlistDocument = ShopWishlist & Document;

@Schema({ _id: true })
export class ShopWishlistItem {
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
  brand?: string;

  @Prop()
  image?: string;

  @Prop({ required: true, min: 0 })
  unitPrice: number;

  @Prop({ min: 0 })
  originalPrice?: number;

  @Prop()
  detailHref?: string;

  @Prop({ min: 0 })
  warrantyMonths?: number;

  @Prop()
  isInStock?: boolean;
}

export const ShopWishlistItemSchema = SchemaFactory.createForClass(ShopWishlistItem);
ShopWishlistItemSchema.index({ productType: 1, productId: 1 });

@Schema({ timestamps: true, collection: 'shopwishlists' })
export class ShopWishlist {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: [ShopWishlistItemSchema], default: [] })
  items: Types.DocumentArray<ShopWishlistItem>;
}

export const ShopWishlistSchema = SchemaFactory.createForClass(ShopWishlist);
