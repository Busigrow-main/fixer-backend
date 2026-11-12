import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ServicePerformanceSummaryDocument =
  HydratedDocument<ServicePerformanceSummary>;

export enum PerformanceSummaryGenerationStatus {
  PREPARING = 'PREPARING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Schema({ _id: false })
export class TechnicianPerformanceBreakdown {
  @Prop({ type: Types.ObjectId, ref: 'Technician', required: true })
  technicianId: Types.ObjectId;

  @Prop({ required: true, default: 0 })
  completedJobs: number;

  @Prop({ required: true, default: 0 })
  earnings: number;
}

export const TechnicianPerformanceBreakdownSchema =
  SchemaFactory.createForClass(TechnicianPerformanceBreakdown);

@Schema({ _id: false })
export class ServicePerformanceBreakdown {
  @Prop({ type: Types.ObjectId, ref: 'Service' })
  serviceId?: Types.ObjectId;

  @Prop()
  serviceType?: string;

  @Prop({ required: true, default: 0 })
  totalJobs: number;

  @Prop({ required: true, default: 0 })
  completedJobs: number;

  @Prop({ required: true, default: 0 })
  cancelledJobs: number;
}

export const ServicePerformanceBreakdownSchema =
  SchemaFactory.createForClass(ServicePerformanceBreakdown);

@Schema({ timestamps: true })
export class ServicePerformanceSummary {
  @Prop({ required: true, unique: true, index: true })
  businessDate: string;

  @Prop({ required: true, default: 'Asia/Kolkata' })
  timeZone: string;

  @Prop({ required: true })
  windowStart: Date;

  @Prop({ required: true })
  windowEnd: Date;

  @Prop({ required: true, default: 0 })
  totalJobs: number;

  @Prop({ required: true, default: 0 })
  completedJobs: number;

  @Prop({ required: true, default: 0 })
  pendingJobs: number;

  @Prop({ required: true, default: 0 })
  cancelledJobs: number;

  @Prop({ required: true, default: 0 })
  completionRate: number;

  @Prop({ required: true, default: 0 })
  totalTechnicianEarnings: number;

  @Prop({ required: true, default: 0 })
  totalSettlementsPrepared: number;

  @Prop({ required: true, default: 0 })
  totalSettlementsApproved: number;

  @Prop({ required: true, default: 0 })
  totalSettlementsPaid: number;

  @Prop({ required: true, default: 0 })
  failedSettlementPreparations: number;

  @Prop({ required: true, default: 0 })
  disputedSettlements: number;

  @Prop({
    type: [TechnicianPerformanceBreakdownSchema],
    default: [],
  })
  technicianBreakdown: TechnicianPerformanceBreakdown[];

  @Prop({
    type: [ServicePerformanceBreakdownSchema],
    default: [],
  })
  serviceBreakdown: ServicePerformanceBreakdown[];

  @Prop({
    type: String,
    enum: Object.values(PerformanceSummaryGenerationStatus),
    required: true,
    default: PerformanceSummaryGenerationStatus.PREPARING,
    index: true,
  })
  generationStatus: PerformanceSummaryGenerationStatus;

  @Prop()
  generationToken?: string;

  @Prop()
  generationLeaseUntil?: Date;

  @Prop()
  generationFailureReason?: string;
}

export const ServicePerformanceSummarySchema =
  SchemaFactory.createForClass(ServicePerformanceSummary);
