import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DEFAULT_OPS_THRESHOLDS,
  OPS_SETTINGS_KEY,
  OpsSettings,
  OpsSettingsDocument,
} from './schemas/ops-settings.schema';

export type OpsThresholds = {
  unclaimedEscalateMinutes: number;
  acceptedNotStartedHours: number;
  partsWaitHours: number;
  visitOverdueHours: number;
  reviewOverdueHours: number;
  alertCooldownMinutes: number;
};

@Injectable()
export class OpsSettingsService {
  constructor(
    @InjectModel(OpsSettings.name)
    private readonly settingsModel: Model<OpsSettingsDocument>,
  ) {}

  async getThresholds(): Promise<OpsThresholds> {
    const settings = await this.getSettings();
    return {
      unclaimedEscalateMinutes:
        settings.unclaimedEscalateMinutes ??
        DEFAULT_OPS_THRESHOLDS.unclaimedEscalateMinutes,
      acceptedNotStartedHours:
        settings.acceptedNotStartedHours ??
        DEFAULT_OPS_THRESHOLDS.acceptedNotStartedHours,
      partsWaitHours:
        settings.partsWaitHours ?? DEFAULT_OPS_THRESHOLDS.partsWaitHours,
      visitOverdueHours:
        settings.visitOverdueHours ?? DEFAULT_OPS_THRESHOLDS.visitOverdueHours,
      reviewOverdueHours:
        settings.reviewOverdueHours ?? DEFAULT_OPS_THRESHOLDS.reviewOverdueHours,
      alertCooldownMinutes:
        settings.alertCooldownMinutes ??
        DEFAULT_OPS_THRESHOLDS.alertCooldownMinutes,
    };
  }

  async getSettings(): Promise<OpsSettingsDocument> {
    const existing = await this.settingsModel
      .findOne({ key: OPS_SETTINGS_KEY })
      .exec();
    if (existing) return existing;
    return this.settingsModel.create({
      key: OPS_SETTINGS_KEY,
      ...DEFAULT_OPS_THRESHOLDS,
    });
  }

  async updateSettings(
    input: Partial<OpsThresholds> & { updatedBy?: string },
  ): Promise<OpsSettingsDocument> {
    const $set: Record<string, unknown> = {};
    for (const key of Object.keys(DEFAULT_OPS_THRESHOLDS) as Array<
      keyof OpsThresholds
    >) {
      if (input[key] === undefined) continue;
      const value = Number(input[key]);
      if (!Number.isFinite(value) || value < 1) {
        throw new BadRequestException(`${key} must be a number >= 1`);
      }
      $set[key] = Math.floor(value);
    }
    if (input.updatedBy) $set.updatedBy = input.updatedBy;

    const $setOnInsert: Record<string, unknown> = { key: OPS_SETTINGS_KEY };
    for (const [key, value] of Object.entries(DEFAULT_OPS_THRESHOLDS)) {
      if (!Object.prototype.hasOwnProperty.call($set, key)) {
        $setOnInsert[key] = value;
      }
    }

    const settings = await this.settingsModel
      .findOneAndUpdate(
        { key: OPS_SETTINGS_KEY },
        { $set, $setOnInsert },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();

    return settings as OpsSettingsDocument;
  }
}
