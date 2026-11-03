import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SHOP_SETTINGS_KEY,
  ShopSettings,
  ShopSettingsDocument,
} from './schemas/shop-settings.schema';

@Injectable()
export class ShopSettingsService {
  constructor(
    @InjectModel(ShopSettings.name)
    private readonly settingsModel: Model<ShopSettingsDocument>,
  ) {}

  async getSettings(): Promise<ShopSettingsDocument> {
    const existing = await this.settingsModel.findOne({ key: SHOP_SETTINGS_KEY }).exec();
    if (existing) return existing;
    return this.settingsModel.create({
      key: SHOP_SETTINGS_KEY,
      maintenanceEnabled: false,
      maintenanceMessage: 'Fixxer Shop is under maintenance. Please check back soon.',
    });
  }

  async getPublicStatus() {
    const settings = await this.getSettings();
    return {
      maintenance: Boolean(settings.maintenanceEnabled),
      message:
        settings.maintenanceMessage ||
        'Fixxer Shop is under maintenance. Please check back soon.',
    };
  }

  async isMaintenanceEnabled(): Promise<boolean> {
    const settings = await this.getSettings();
    return Boolean(settings.maintenanceEnabled);
  }

  async updateSettings(input: {
    maintenanceEnabled?: boolean;
    maintenanceMessage?: string;
    updatedBy?: string;
  }) {
    const $set: Record<string, unknown> = {};
    if (typeof input.maintenanceEnabled === 'boolean') {
      $set.maintenanceEnabled = input.maintenanceEnabled;
    }
    if (typeof input.maintenanceMessage === 'string') {
      const trimmed = input.maintenanceMessage.trim();
      if (trimmed) $set.maintenanceMessage = trimmed.slice(0, 280);
    }
    if (input.updatedBy) $set.updatedBy = input.updatedBy;

    // Defaults only for fields not already in $set (Mongo forbids the same path in both).
    const $setOnInsert: Record<string, unknown> = { key: SHOP_SETTINGS_KEY };
    if (!Object.prototype.hasOwnProperty.call($set, 'maintenanceEnabled')) {
      $setOnInsert.maintenanceEnabled = false;
    }
    if (!Object.prototype.hasOwnProperty.call($set, 'maintenanceMessage')) {
      $setOnInsert.maintenanceMessage =
        'Fixxer Shop is under maintenance. Please check back soon.';
    }

    const settings = await this.settingsModel
      .findOneAndUpdate(
        { key: SHOP_SETTINGS_KEY },
        { $set, $setOnInsert },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();

    return settings;
  }
}
