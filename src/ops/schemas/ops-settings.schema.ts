import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OpsSettingsDocument = OpsSettings & Document;

export const OPS_SETTINGS_KEY = 'fixxer-ops';

export const DEFAULT_OPS_THRESHOLDS = {
  /** Documented / configurable; dispatch cron still uses its own 10-minute constant. */
  unclaimedEscalateMinutes: 10,
  acceptedNotStartedHours: 4,
  partsWaitHours: 24,
  visitOverdueHours: 2,
  reviewOverdueHours: 24,
  alertCooldownMinutes: 60,
} as const;

@Schema({ timestamps: true, collection: 'opssettings' })
export class OpsSettings {
  @Prop({ required: true, unique: true, default: OPS_SETTINGS_KEY })
  key: string;

  @Prop({ default: DEFAULT_OPS_THRESHOLDS.unclaimedEscalateMinutes, min: 1 })
  unclaimedEscalateMinutes: number;

  @Prop({ default: DEFAULT_OPS_THRESHOLDS.acceptedNotStartedHours, min: 1 })
  acceptedNotStartedHours: number;

  @Prop({ default: DEFAULT_OPS_THRESHOLDS.partsWaitHours, min: 1 })
  partsWaitHours: number;

  @Prop({ default: DEFAULT_OPS_THRESHOLDS.visitOverdueHours, min: 1 })
  visitOverdueHours: number;

  @Prop({ default: DEFAULT_OPS_THRESHOLDS.reviewOverdueHours, min: 1 })
  reviewOverdueHours: number;

  @Prop({ default: DEFAULT_OPS_THRESHOLDS.alertCooldownMinutes, min: 1 })
  alertCooldownMinutes: number;

  @Prop()
  updatedBy?: string;
}

export const OpsSettingsSchema = SchemaFactory.createForClass(OpsSettings);
