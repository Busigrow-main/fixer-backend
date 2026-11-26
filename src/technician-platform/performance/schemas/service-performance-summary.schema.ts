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

  @Prop({ default: 0 }) settlementsPrepared: number;
  @Prop({ default: 0 }) settlementsApproved: number;
  @Prop({ default: 0 }) settlementsPaid: number;
  @Prop({ default: 0 }) failedSettlementPreparations: number;
  @Prop({ default: 0 }) disputedSettlements: number;
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

  @Prop({ default: 0 }) earnings: number;
  @Prop({ default: 0 }) settlementsPrepared: number;
  @Prop({ default: 0 }) settlementsApproved: number;
  @Prop({ default: 0 }) settlementsPaid: number;
  @Prop({ default: 0 }) failedSettlementPreparations: number;
  @Prop({ default: 0 }) disputedSettlements: number;
}

export const ServicePerformanceBreakdownSchema =
  SchemaFactory.createForClass(ServicePerformanceBreakdown);

@Schema({ _id: false })
export class ServicePerformanceMetricBreakdown {
  @Prop({ type: Types.ObjectId, ref: 'Technician' })
  technicianId?: Types.ObjectId;

  @Prop()
  serviceType?: string;

  @Prop({ default: 0 }) totalJobs: number;
  @Prop({ default: 0 }) completedJobs: number;
  @Prop({ default: 0 }) pendingJobs: number;
  @Prop({ default: 0 }) cancelledJobs: number;
  @Prop({ default: 0 }) completionRateNumerator: number;
  @Prop({ default: 0 }) earnings: number;
  @Prop({ default: 0 }) settlementsPrepared: number;
  @Prop({ default: 0 }) settlementsApproved: number;
  @Prop({ default: 0 }) settlementsPaid: number;
  @Prop({ default: 0 }) failedSettlementPreparations: number;
  @Prop({ default: 0 }) disputedSettlements: number;
  @Prop({ default: 0 }) backlogAgeTotalMs: number;
  @Prop({ default: 0 }) backlogAgeJobs: number;
  @Prop({ default: 0 }) assignmentDelayTotalMs: number;
  @Prop({ default: 0 }) assignmentDelayJobs: number;
  @Prop({ default: 0 }) completionTimeTotalMs: number;
  @Prop({ default: 0 }) completionTimeJobs: number;
  @Prop({ default: 0 }) partsWaitTotalMs: number;
  @Prop({ default: 0 }) partsWaitJobs: number;
  @Prop({ default: 0 }) partsWaitIntervals: number;
  @Prop({ default: 0 }) repeatRepairJobs: number;
  @Prop({ default: 0 }) repeatRepairEligibleJobs: number;
  @Prop({ default: 0 }) firstVisitCompletedJobs: number;
  @Prop({ default: 0 }) firstVisitEligibleJobs: number;
  @Prop({ default: 0 }) feedbackRatingTotal: number;
  @Prop({ default: 0 }) feedbackRatingCount: number;
}

export const ServicePerformanceMetricBreakdownSchema =
  SchemaFactory.createForClass(ServicePerformanceMetricBreakdown);

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
  completionRateNumerator: number;

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

  /** Null when the eligible cohort is empty (do not treat as zero). */
  @Prop({ type: Number, default: null }) backlogAgeAverageMs: number | null;
  @Prop({ default: 0 }) backlogAgeJobs: number;
  @Prop({ type: Number, default: null }) assignmentDelayAverageMs: number | null;
  @Prop({ default: 0 }) assignmentDelayJobs: number;
  @Prop({ type: Number, default: null }) completionTimeAverageMs: number | null;
  @Prop({ default: 0 }) completionTimeJobs: number;
  @Prop({ type: Number, default: null }) partsWaitAverageMs: number | null;
  @Prop({ default: 0 }) partsWaitJobs: number;
  @Prop({ default: 0 }) partsWaitIntervals: number;
  @Prop({ type: Number, default: null }) repeatRepairRate: number | null;
  @Prop({ default: 0 }) repeatRepairJobs: number;
  @Prop({ default: 0 }) repeatRepairEligibleJobs: number;
  @Prop({ type: Number, default: null }) firstVisitCompletionRate: number | null;
  @Prop({ default: 0 }) firstVisitCompletedJobs: number;
  @Prop({ default: 0 }) firstVisitEligibleJobs: number;
  @Prop({ type: Number, default: null }) averageFeedbackRating: number | null;
  @Prop({ default: 0 }) feedbackRatingCount: number;

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

  @Prop({ type: [ServicePerformanceMetricBreakdownSchema], default: [] })
  metricsByTechnicianAndServiceType: ServicePerformanceMetricBreakdown[];

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
