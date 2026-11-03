import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ShopSettingsDocument = ShopSettings & Document;

export const SHOP_SETTINGS_KEY = 'fixxer-shop';

@Schema({ timestamps: true, collection: 'shopsettings' })
export class ShopSettings {
  @Prop({ required: true, unique: true, default: SHOP_SETTINGS_KEY })
  key: string;

  /** When true, customer Fixxer Shop surfaces show the maintenance screen. */
  @Prop({ default: false })
  maintenanceEnabled: boolean;

  @Prop({
    default: 'Fixxer Shop is under maintenance. Please check back soon.',
    trim: true,
  })
  maintenanceMessage: string;

  @Prop()
  updatedBy?: string;
}

export const ShopSettingsSchema = SchemaFactory.createForClass(ShopSettings);
