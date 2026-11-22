import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';

import { Booking, BookingDocument } from '../../bookings/schemas/booking.schema';
import { Feedback, FeedbackDocument } from '../../feedback/schemas/feedback.schema';
import { Visit, VisitDocument } from '../../visits/schemas/visit.schema';
import { Earning, EarningDocument } from '../schemas/earning.schema';
import {
  Settlement,
  SettlementDocument,
  SettlementReconciliationStatus,
  SettlementStatus,
} from '../settlements/schemas/settlement.schema';
import { SettlementItem, SettlementItemDocument } from '../settlements/schemas/settlement-item.schema';
import {
  PerformanceSummaryGenerationStatus,
  ServicePerformanceSummary,
  ServicePerformanceSummaryDocument,
} from './schemas/service-performance-summary.schema';
import { PerformanceSummaryQueryDto } from './performance-summary.dto';

const TIME_ZONE = 'Asia/Kolkata';
const GENERATION_LEASE_MS = 10 * 60 * 1000;
const ACTIVE_BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'ASSIGNED',
  'EN_ROUTE',
  'IN_PROGRESS',
  'RESCHEDULED',
];

type DateWindow = {
  businessDate: string;
  start: Date;
  end: Date;
};

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error &&
    (error as { code?: number }).code === 11000;
}

function parseBusinessDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new BadRequestException('Date must use YYYY-MM-DD');
  const date = new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  ));
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    throw new BadRequestException('Invalid business date');
  }
  return date;
}

function businessDateFromInstant(at: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function windowForBusinessDate(businessDate: string): DateWindow {
  const day = parseBusinessDate(businessDate);
  const start = new Date(day.getTime() - (5 * 60 + 30) * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { businessDate, start, end };
}

function previousBusinessDate(at: Date): string {
  const current = parseBusinessDate(businessDateFromInstant(at));
  current.setUTCDate(current.getUTCDate() - 1);
  return current.toISOString().slice(0, 10);
}

@Injectable()
export class PerformanceSummaryService {
  private readonly logger = new Logger(PerformanceSummaryService.name);

  constructor(
    @InjectModel(ServicePerformanceSummary.name)
    private readonly summaryModel: Model<ServicePerformanceSummaryDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Earning.name)
    private readonly earningModel: Model<EarningDocument>,
    @InjectModel(Settlement.name)
    private readonly settlementModel: Model<SettlementDocument>,
    @InjectModel(SettlementItem.name)
    private readonly settlementItemModel: Model<SettlementItemDocument>,
    @InjectModel(Feedback.name)
    private readonly feedbackModel: Model<FeedbackDocument>,
    @InjectModel(Visit.name)
    private readonly visitModel: Model<VisitDocument>,
  ) {}

  async generatePreviousDay(now = new Date()) {
    return this.generateForDate(previousBusinessDate(now));
  }

  async generateForDate(businessDate: string) {
    const window = windowForBusinessDate(businessDate);
    const token = randomUUID();
    const leaseUntil = new Date(Date.now() + GENERATION_LEASE_MS);
    let summary: ServicePerformanceSummaryDocument | null;

    try {
      summary = await this.summaryModel.findOneAndUpdate(
        { businessDate },
        {
          $setOnInsert: {
            businessDate,
            timeZone: TIME_ZONE,
            windowStart: window.start,
            windowEnd: window.end,
            generationStatus: PerformanceSummaryGenerationStatus.PREPARING,
            generationToken: token,
            generationLeaseUntil: leaseUntil,
          },
        },
        { upsert: true, new: true },
      ).exec();
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      summary = await this.summaryModel.findOne({ businessDate }).exec();
    }

    if (!summary) throw new ConflictException('Unable to create performance summary');
    if (summary.generationStatus === PerformanceSummaryGenerationStatus.COMPLETED) {
      return summary;
    }

    const acquired = await this.summaryModel.findOneAndUpdate(
      {
        _id: summary._id,
        generationStatus: {
          $in: [
            PerformanceSummaryGenerationStatus.PREPARING,
            PerformanceSummaryGenerationStatus.FAILED,
          ],
        },
        $or: [
          { generationLeaseUntil: { $exists: false } },
          { generationLeaseUntil: { $lte: new Date() } },
          { generationToken: token },
        ],
      },
      {
        $set: {
          generationStatus: PerformanceSummaryGenerationStatus.PREPARING,
          generationToken: token,
          generationLeaseUntil: leaseUntil,
          generationFailureReason: undefined,
        },
      },
      { new: true },
    ).exec();

    if (!acquired) return summary;

    try {
      const metrics = await this.calculateMetrics(window);
      const completed = await this.summaryModel.findOneAndUpdate(
        { _id: acquired._id, generationToken: token },
        {
          $set: {
            ...metrics,
            generationStatus: PerformanceSummaryGenerationStatus.COMPLETED,
          },
          $unset: {
            generationToken: 1,
            generationLeaseUntil: 1,
            generationFailureReason: 1,
          },
        },
        { new: true },
      ).exec();
      if (!completed) return acquired;
      return completed;
    } catch (error) {
      await this.summaryModel.updateOne(
        { _id: acquired._id, generationToken: token },
        {
          $set: {
            generationStatus: PerformanceSummaryGenerationStatus.FAILED,
            generationFailureReason: error instanceof Error ? error.message : 'Unknown error',
          },
          $unset: {
            generationToken: 1,
            generationLeaseUntil: 1,
          },
        },
      ).exec();
      this.logger.error(`Performance summary generation failed for ${businessDate}`, error);
      throw error;
    }
  }

  async list(query: PerformanceSummaryQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query.date) {
      parseBusinessDate(query.date);
      filter.businessDate = query.date;
    } else if (query.fromDate || query.toDate) {
      if (query.fromDate) parseBusinessDate(query.fromDate);
      if (query.toDate) parseBusinessDate(query.toDate);
      if (query.fromDate && query.toDate && query.fromDate > query.toDate) {
        throw new BadRequestException('fromDate must not be after toDate');
      }
      filter.businessDate = {
        ...(query.fromDate ? { $gte: query.fromDate } : {}),
        ...(query.toDate ? { $lte: query.toDate } : {}),
      };
    }
    if (query.technicianId || query.serviceType) {
      const metricMatch: Record<string, unknown> = {};
      if (query.technicianId) metricMatch.technicianId = new Types.ObjectId(query.technicianId);
      if (query.serviceType) metricMatch.serviceType = query.serviceType;
      filter.$or = [
        { generationStatus: { $ne: PerformanceSummaryGenerationStatus.COMPLETED } },
        { metricsByTechnicianAndServiceType: { $elemMatch: metricMatch } },
      ];
    }

    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const [data, total] = await Promise.all([
      this.summaryModel.find(filter)
        .sort({ businessDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.summaryModel.countDocuments(filter).exec(),
    ]);
    return {
      data: data.map((summary) => this.applyBreakdownFilters(summary, query)),
      total,
      page,
      limit,
    };
  }

  async getByDate(businessDate: string, query: Partial<PerformanceSummaryQueryDto> = {}) {
    parseBusinessDate(businessDate);
    const summary = await this.summaryModel.findOne({
      businessDate,
    }).lean().exec();
    if (!summary) throw new NotFoundException('Performance summary not found');
    return this.applyBreakdownFilters(summary, query);
  }

  private applyBreakdownFilters(summary: any, query: Partial<PerformanceSummaryQueryDto>) {
    if (summary.generationStatus !== PerformanceSummaryGenerationStatus.COMPLETED) return summary;
    if (!query.technicianId && !query.serviceType) return summary;
    const groups = (summary.metricsByTechnicianAndServiceType || []).filter((group: any) =>
      (!query.technicianId || String(group.technicianId || '') === query.technicianId) &&
      (!query.serviceType || group.serviceType === query.serviceType),
    );
    const numericFields = [
      'totalJobs', 'completedJobs', 'pendingJobs', 'cancelledJobs', 'completionRateNumerator', 'earnings',
      'settlementsPrepared', 'settlementsApproved', 'settlementsPaid', 'failedSettlementPreparations',
      'disputedSettlements', 'backlogAgeTotalMs', 'backlogAgeJobs', 'assignmentDelayTotalMs',
      'assignmentDelayJobs', 'completionTimeTotalMs', 'completionTimeJobs', 'partsWaitTotalMs',
      'partsWaitJobs', 'partsWaitIntervals', 'repeatRepairJobs', 'repeatRepairEligibleJobs',
      'firstVisitCompletedJobs', 'firstVisitEligibleJobs', 'feedbackRatingTotal', 'feedbackRatingCount',
    ];
    const total: Record<string, number> = Object.fromEntries(numericFields.map((field) => [field, 0]));
    for (const group of groups) {
      for (const field of numericFields) total[field] += Number(group[field] || 0);
    }
    // Settlement counts are de-duplicated at the filtered dimension. A single
    // technician settlement can include earnings from several service types.
    if (query.technicianId && !query.serviceType) {
      const source = (summary.technicianBreakdown || []).find((row: any) => String(row.technicianId) === query.technicianId);
      for (const field of ['settlementsPrepared', 'settlementsApproved', 'settlementsPaid', 'failedSettlementPreparations', 'disputedSettlements']) total[field] = Number(source?.[field] || 0);
    } else if (query.serviceType && !query.technicianId) {
      const source = (summary.serviceBreakdown || []).find((row: any) => row.serviceType === query.serviceType);
      for (const field of ['settlementsPrepared', 'settlementsApproved', 'settlementsPaid', 'failedSettlementPreparations', 'disputedSettlements']) total[field] = Number(source?.[field] || 0);
    }
    const average = (sum: number, count: number) => (count ? sum / count : null);
    const completionRate = total.totalJobs ? Math.round(total.completionRateNumerator / total.totalJobs * 10000) / 100 : 0;
    const technicianMap = new Map<string, any>();
    const serviceMap = new Map<string, any>();
    for (const group of groups) {
      if (group.technicianId && Types.ObjectId.isValid(String(group.technicianId))) {
        const key = String(group.technicianId);
        const value = technicianMap.get(key) || { technicianId: group.technicianId, completedJobs: 0, earnings: 0, settlementsPrepared: 0, settlementsApproved: 0, settlementsPaid: 0, failedSettlementPreparations: 0, disputedSettlements: 0 };
        value.completedJobs += Number(group.completedJobs || 0);
        value.earnings += Number(group.earnings || 0);
        for (const field of ['settlementsPrepared', 'settlementsApproved', 'settlementsPaid', 'failedSettlementPreparations', 'disputedSettlements']) value[field] += Number(group[field] || 0);
        technicianMap.set(key, value);
      }
      if (group.serviceType) {
        const value = serviceMap.get(group.serviceType) || { serviceType: group.serviceType, totalJobs: 0, completedJobs: 0, cancelledJobs: 0, earnings: 0, settlementsPrepared: 0, settlementsApproved: 0, settlementsPaid: 0, failedSettlementPreparations: 0, disputedSettlements: 0 };
        value.totalJobs += Number(group.totalJobs || 0);
        value.completedJobs += Number(group.completedJobs || 0);
        value.cancelledJobs += Number(group.cancelledJobs || 0);
        value.earnings += Number(group.earnings || 0);
        for (const field of ['settlementsPrepared', 'settlementsApproved', 'settlementsPaid', 'failedSettlementPreparations', 'disputedSettlements']) value[field] += Number(group[field] || 0);
        serviceMap.set(group.serviceType, value);
      }
    }
    return {
      ...summary,
      ...total,
      completionRate,
      totalTechnicianEarnings: total.earnings,
      backlogAgeAverageMs: average(total.backlogAgeTotalMs, total.backlogAgeJobs),
      assignmentDelayAverageMs: average(total.assignmentDelayTotalMs, total.assignmentDelayJobs),
      completionTimeAverageMs: average(total.completionTimeTotalMs, total.completionTimeJobs),
      partsWaitAverageMs: average(total.partsWaitTotalMs, total.partsWaitJobs),
      repeatRepairRate: total.repeatRepairEligibleJobs
        ? Math.round(total.repeatRepairJobs / total.repeatRepairEligibleJobs * 10000) / 100
        : null,
      firstVisitCompletionRate: total.firstVisitEligibleJobs
        ? Math.round(total.firstVisitCompletedJobs / total.firstVisitEligibleJobs * 10000) / 100
        : null,
      averageFeedbackRating: total.feedbackRatingCount
        ? total.feedbackRatingTotal / total.feedbackRatingCount
        : null,
      technicianBreakdown: Array.from(technicianMap.values()),
      serviceBreakdown: Array.from(serviceMap.values()),
      metricsByTechnicianAndServiceType: groups,
    };
  }

  private async calculateMetrics(window: DateWindow) {
    const inWindow = { $gte: window.start, $lt: window.end };
    const created = await this.bookingModel.find({ createdAt: inWindow }).lean().exec() as any[];
    const completed = await this.bookingModel.find({
      jobClosed: true,
      jobClosedAt: inWindow,
      status: { $ne: 'CANCELLED' },
    }).lean().exec() as any[];
    const cancelled = await this.bookingModel.find({ cancelledAt: inWindow }).lean().exec() as any[];
    const openAtEnd = await this.bookingModel.find({
      createdAt: { $lt: window.end },
      $and: [
        { $or: [{ jobClosed: { $ne: true } }, { jobClosedAt: { $gte: window.end } }] },
        { $or: [{ jobClosedAt: { $exists: false } }, { jobClosedAt: { $gte: window.end } }] },
        { $or: [{ status: { $ne: 'CANCELLED' } }, { cancelledAt: { $gte: window.end } }] },
        { $or: [{ cancelledAt: { $exists: false } }, { cancelledAt: { $gte: window.end } }] },
      ],
    }).lean().exec() as any[];
    const firstAssigned = await this.bookingModel.find({ firstAssignedAt: inWindow }).lean().exec() as any[];

    type Bucket = Record<string, any>;
    const buckets = new Map<string, Bucket>();
    const defaultMetrics = {
      totalJobs: 0, completedJobs: 0, pendingJobs: 0, cancelledJobs: 0,
      completionRateNumerator: 0, earnings: 0,
      settlementsPrepared: 0, settlementsApproved: 0, settlementsPaid: 0,
      failedSettlementPreparations: 0, disputedSettlements: 0,
      backlogAgeTotalMs: 0, backlogAgeJobs: 0,
      assignmentDelayTotalMs: 0, assignmentDelayJobs: 0,
      completionTimeTotalMs: 0, completionTimeJobs: 0,
      partsWaitTotalMs: 0, partsWaitJobs: 0, partsWaitIntervals: 0,
      repeatRepairJobs: 0, repeatRepairEligibleJobs: 0,
      firstVisitCompletedJobs: 0, firstVisitEligibleJobs: 0,
      feedbackRatingTotal: 0, feedbackRatingCount: 0,
    };
    const bucketFor = (technicianRaw: unknown, serviceTypeRaw: unknown) => {
      const technicianId = technicianRaw && Types.ObjectId.isValid(String(technicianRaw))
        ? new Types.ObjectId(String(technicianRaw))
        : undefined;
      const serviceType = typeof serviceTypeRaw === 'string' && serviceTypeRaw.trim()
        ? serviceTypeRaw.trim()
        : undefined;
      const key = `${technicianId ? String(technicianId) : 'unknown'}|${serviceType || 'unknown'}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { ...defaultMetrics, ...(technicianId ? { technicianId } : {}), ...(serviceType ? { serviceType } : {}) };
        buckets.set(key, bucket);
      }
      return bucket;
    };
    const add = (technicianRaw: unknown, serviceTypeRaw: unknown, values: Record<string, number>) => {
      const bucket = bucketFor(technicianRaw, serviceTypeRaw);
      for (const [key, value] of Object.entries(values)) bucket[key] += value;
    };
    const activeTech = (booking: any) => booking.technicianId;
    const closingTech = (booking: any) => booking.jobClosedByTechnicianId;
    const serviceType = (booking: any) => booking.serviceType;

    const openIds = new Set(openAtEnd.map((booking) => String(booking._id)));
    for (const booking of created) {
      const closeAt = booking.jobClosedAt ? new Date(booking.jobClosedAt) : null;
      const cancelAt = booking.cancelledAt ? new Date(booking.cancelledAt) : null;
      const wasClosedByEnd = booking.jobClosed === true && closeAt && closeAt >= new Date(booking.createdAt) && closeAt < window.end;
      const wasCancelledByEnd = cancelAt && cancelAt < window.end;
      add(activeTech(booking), serviceType(booking), {
        totalJobs: 1,
        pendingJobs: openIds.has(String(booking._id)) ? 1 : 0,
        completionRateNumerator: wasClosedByEnd && !wasCancelledByEnd ? 1 : 0,
      });
    }
    for (const booking of completed) {
      add(closingTech(booking), serviceType(booking), { completedJobs: 1 });
      const acceptedAt = booking.acceptedAt ? new Date(booking.acceptedAt) : null;
      const closedAt = booking.jobClosedAt ? new Date(booking.jobClosedAt) : null;
      if (acceptedAt && closedAt && acceptedAt <= closedAt) {
        add(closingTech(booking), serviceType(booking), {
          completionTimeTotalMs: closedAt.getTime() - acceptedAt.getTime(),
          completionTimeJobs: 1,
        });
      }
    }
    for (const booking of cancelled) {
      add(activeTech(booking), serviceType(booking), { cancelledJobs: 1 });
    }
    for (const booking of openAtEnd) {
      const createdAt = booking.createdAt ? new Date(booking.createdAt) : null;
      if (!createdAt || createdAt >= window.end) continue;
      add(activeTech(booking), serviceType(booking), {
        backlogAgeTotalMs: window.end.getTime() - createdAt.getTime(),
        backlogAgeJobs: 1,
      });
    }
    for (const booking of firstAssigned) {
      const createdAt = booking.createdAt ? new Date(booking.createdAt) : null;
      const assignedAt = booking.firstAssignedAt ? new Date(booking.firstAssignedAt) : null;
      if (!createdAt || !assignedAt || assignedAt < createdAt) continue;
      add(booking.firstAssignedTechnicianId, serviceType(booking), {
        assignmentDelayTotalMs: assignedAt.getTime() - createdAt.getTime(),
        assignmentDelayJobs: 1,
      });
    }

    const waitBookings = await this.bookingModel.find({ partsWaitEvents: { $exists: true, $ne: [] } }).lean().exec() as any[];
    for (const booking of waitBookings) {
      let pendingStart: Date | null = null;
      let totalWaitMs = 0;
      let validIntervals = 0;
      const events = [...(booking.partsWaitEvents || [])].sort((a: any, b: any) => new Date(a.at).getTime() - new Date(b.at).getTime());
      for (const event of events) {
        const at = new Date(event.at);
        if (Number.isNaN(at.getTime())) continue;
        if (event.event === 'WAIT_STARTED') {
          pendingStart = at;
        } else if (event.event === 'PARTS_AVAILABLE' && pendingStart && at > pendingStart) {
          if (at >= window.start && at < window.end) {
            totalWaitMs += at.getTime() - pendingStart.getTime();
            validIntervals += 1;
          }
          pendingStart = null;
        }
      }
      if (validIntervals) {
        add(activeTech(booking), serviceType(booking), {
          partsWaitTotalMs: totalWaitMs,
          partsWaitJobs: 1,
          partsWaitIntervals: validIntervals,
        });
      }
    }

    const visits = completed.length
      ? await this.visitModel.find({ bookingId: { $in: completed.map((booking) => booking._id) } }).lean().exec() as any[]
      : [];
    const visitsByBooking = new Map<string, any[]>();
    for (const visit of visits) {
      const key = String(visit.bookingId);
      visitsByBooking.set(key, [...(visitsByBooking.get(key) || []), visit]);
    }
    for (const booking of completed) {
      const refs: string[] = Array.isArray(booking.visits) ? booking.visits.map((id: unknown) => String(id)) : [];
      const rows = visitsByBooking.get(String(booking._id)) || [];
      const actualIds = new Set(rows.map((visit) => String(visit._id)));
      const completeHistory = refs.length > 0 && new Set(refs).size === refs.length &&
        refs.length === rows.length && refs.every((id) => actualIds.has(id));
      if (!completeHistory) continue;
      const didCompleteFirstVisit = rows.length === 1;
      add(closingTech(booking), serviceType(booking), {
        firstVisitEligibleJobs: 1,
        firstVisitCompletedJobs: didCompleteFirstVisit ? 1 : 0,
      });
    }

    const repeatCandidates = completed.filter((booking) =>
      String(booking.serviceType || '').toUpperCase() === 'REPAIR' &&
      String(booking.productDetails?.serialNumber || '').trim() &&
      (booking.serviceId || booking.subCategoryId),
    );
    const parentIds = repeatCandidates.map((booking) => booking.parentId).filter(Boolean);
    const candidateIds = repeatCandidates.map((booking) => booking._id);
    const linkedParents = parentIds.length || candidateIds.length
      ? await this.bookingModel.find({
          $or: [
            ...(parentIds.length ? [{ _id: { $in: parentIds } }] : []),
            ...(candidateIds.length ? [{ correctiveBookingIds: { $in: candidateIds } }] : []),
          ],
        }).lean().exec() as any[]
      : [];
    const parentsById = new Map(linkedParents.map((booking) => [String(booking._id), booking]));
    for (const booking of repeatCandidates) {
      const serial = String(booking.productDetails?.serialNumber || '').trim().toUpperCase();
      const createdAt = booking.createdAt ? new Date(booking.createdAt) : null;
      const linked = linkedParents.filter((parent: any) =>
        String(parent._id) === String(booking.parentId || '') ||
        (parent.correctiveBookingIds || []).some((id: any) => String(id) === String(booking._id)),
      );
      const isRepeat = Boolean(createdAt && linked.some((parent: any) => {
        const parentClosedAt = parent.jobClosedAt ? new Date(parent.jobClosedAt) : null;
        const sameAppliance = String(parent.productDetails?.serialNumber || '').trim().toUpperCase() === serial;
        const relatedProblem = Boolean(
          (booking.subCategoryId && parent.subCategoryId && String(booking.subCategoryId) === String(parent.subCategoryId)) ||
          (booking.serviceId && parent.serviceId && String(booking.serviceId) === String(parent.serviceId)),
        );
        return parent.jobClosed === true && parentClosedAt && parentClosedAt <= createdAt &&
          String(parent.serviceType || '').toUpperCase() === 'REPAIR' && sameAppliance && relatedProblem;
      }));
      add(closingTech(booking), serviceType(booking), {
        repeatRepairEligibleJobs: 1,
        repeatRepairJobs: isRepeat ? 1 : 0,
      });
    }

    // Feedback is attributed to the reporting day of job closure, not submission time.
    const closedById = new Map(completed.map((booking) => [String(booking._id), booking]));
    const feedbackRows = completed.length
      ? await this.feedbackModel.find({
          bookingId: { $in: completed.map((booking) => booking._id) },
          rating: { $gte: 1, $lte: 5 },
        }).lean().exec() as any[]
      : [];
    for (const feedback of feedbackRows) {
      const booking = closedById.get(String(feedback.bookingId));
      const submittedAt = feedback.createdAt ? new Date(feedback.createdAt) : null;
      if (
        !booking ||
        !submittedAt ||
        Number.isNaN(submittedAt.getTime()) ||
        !Number.isFinite(Number(feedback.rating)) ||
        feedback.rating < 1 ||
        feedback.rating > 5
      ) {
        continue;
      }
      add(closingTech(booking), serviceType(booking), {
        feedbackRatingTotal: Number(feedback.rating),
        feedbackRatingCount: 1,
      });
    }

    const earnings = await this.earningModel.find({ earnedAt: inWindow }).lean().exec() as any[];
    const earningBookingIds = earnings.map((earning) => earning.bookingId).filter(Boolean);
    const earningBookings = earningBookingIds.length
      ? await this.bookingModel.find({ _id: { $in: earningBookingIds } }).select({ serviceType: 1 }).lean().exec() as any[]
      : [];
    const earningBookingById = new Map(earningBookings.map((booking) => [String(booking._id), booking]));
    for (const earning of earnings) {
      const booking = earning.bookingId ? earningBookingById.get(String(earning.bookingId)) : undefined;
      add(earning.technicianId, booking?.serviceType, { earnings: Number(earning.amount) || 0 });
    }

    const settlements = await this.settlementModel.find({ settlementDate: window.businessDate }).lean().exec() as any[];
    const settlementIds = settlements.map((settlement) => settlement._id);
    const settlementItems = settlementIds.length
      ? await this.settlementItemModel.find({ settlementId: { $in: settlementIds } }).select({ settlementId: 1, bookingId: 1 }).lean().exec() as any[]
      : [];
    const settlementBookingIds = settlementItems.map((item) => item.bookingId).filter(Boolean);
    const settlementBookings = settlementBookingIds.length
      ? await this.bookingModel.find({ _id: { $in: settlementBookingIds } }).select({ serviceType: 1 }).lean().exec() as any[]
      : [];
    const settlementBookingById = new Map(settlementBookings.map((booking) => [String(booking._id), booking]));
    const itemsBySettlement = new Map<string, any[]>();
    for (const item of settlementItems) {
      const key = String(item.settlementId);
      itemsBySettlement.set(key, [...(itemsBySettlement.get(key) || []), item]);
    }
    let preparedCount = 0;
    let approvedCount = 0;
    let paidCount = 0;
    let failedCount = 0;
    let disputedCount = 0;
    for (const settlement of settlements) {
      const prepared = [SettlementStatus.PREPARED, SettlementStatus.APPROVED, SettlementStatus.PAYABLE, SettlementStatus.PAID, SettlementStatus.RECONCILED].includes(settlement.status);
      const approved = [SettlementStatus.APPROVED, SettlementStatus.PAYABLE, SettlementStatus.PAID, SettlementStatus.RECONCILED].includes(settlement.status);
      const paid = [SettlementStatus.PAID, SettlementStatus.RECONCILED].includes(settlement.status);
      const failed = settlement.status === SettlementStatus.PREPARATION_FAILED;
      const disputed = settlement.reconciliationStatus === SettlementReconciliationStatus.DISPUTED;
      if (prepared) preparedCount += 1;
      if (approved) approvedCount += 1;
      if (paid) paidCount += 1;
      if (failed) failedCount += 1;
      if (disputed) disputedCount += 1;
      const settlementItemsForRow = itemsBySettlement.get(String(settlement._id)) || [];
      const categories = new Set(settlementItemsForRow.map((item) => settlementBookingById.get(String(item.bookingId))?.serviceType).filter((value): value is string => typeof value === 'string' && !!value));
      if (!categories.size) categories.add(undefined as any);
      for (const category of categories) {
        add(settlement.technicianId, category, {
          settlementsPrepared: prepared ? 1 : 0,
          settlementsApproved: approved ? 1 : 0,
          settlementsPaid: paid ? 1 : 0,
          failedSettlementPreparations: failed ? 1 : 0,
          disputedSettlements: disputed ? 1 : 0,
        });
      }
    }

    const rows = Array.from(buckets.values());
    const sum = (field: string) => rows.reduce((total, row) => total + Number(row[field] || 0), 0);
    const average = (amount: number, count: number) => (count ? amount / count : null);
    const technicians = new Map<string, Bucket>();
    const services = new Map<string, Bucket>();
    for (const row of rows) {
      if (row.technicianId) {
        const key = String(row.technicianId);
        const current = technicians.get(key) || { technicianId: row.technicianId, completedJobs: 0, earnings: 0, settlementsPrepared: 0, settlementsApproved: 0, settlementsPaid: 0, failedSettlementPreparations: 0, disputedSettlements: 0 };
        current.completedJobs += row.completedJobs;
        current.earnings += row.earnings;
        for (const field of ['settlementsPrepared', 'settlementsApproved', 'settlementsPaid', 'failedSettlementPreparations', 'disputedSettlements']) current[field] += row[field];
        technicians.set(key, current);
      }
      if (row.serviceType) {
        const key = row.serviceType;
        const current = services.get(key) || { serviceType: key, totalJobs: 0, completedJobs: 0, cancelledJobs: 0, earnings: 0, settlementsPrepared: 0, settlementsApproved: 0, settlementsPaid: 0, failedSettlementPreparations: 0, disputedSettlements: 0 };
        current.totalJobs += row.totalJobs;
        current.completedJobs += row.completedJobs;
        current.cancelledJobs += row.cancelledJobs;
        current.earnings += row.earnings;
        for (const field of ['settlementsPrepared', 'settlementsApproved', 'settlementsPaid', 'failedSettlementPreparations', 'disputedSettlements']) current[field] += row[field];
        services.set(key, current);
      }
    }
    return {
      totalJobs: sum('totalJobs'),
      completedJobs: sum('completedJobs'),
      pendingJobs: sum('pendingJobs'),
      cancelledJobs: sum('cancelledJobs'),
      completionRateNumerator: sum('completionRateNumerator'),
      completionRate: sum('totalJobs') ? Math.round(sum('completionRateNumerator') / sum('totalJobs') * 10000) / 100 : 0,
      totalTechnicianEarnings: earnings.reduce((total, row) => total + (Number(row.amount) || 0), 0),
      totalSettlementsPrepared: preparedCount,
      totalSettlementsApproved: approvedCount,
      totalSettlementsPaid: paidCount,
      failedSettlementPreparations: failedCount,
      disputedSettlements: disputedCount,
      backlogAgeAverageMs: average(sum('backlogAgeTotalMs'), sum('backlogAgeJobs')),
      backlogAgeJobs: sum('backlogAgeJobs'),
      assignmentDelayAverageMs: average(sum('assignmentDelayTotalMs'), sum('assignmentDelayJobs')),
      assignmentDelayJobs: sum('assignmentDelayJobs'),
      completionTimeAverageMs: average(sum('completionTimeTotalMs'), sum('completionTimeJobs')),
      completionTimeJobs: sum('completionTimeJobs'),
      partsWaitAverageMs: average(sum('partsWaitTotalMs'), sum('partsWaitJobs')),
      partsWaitJobs: sum('partsWaitJobs'),
      partsWaitIntervals: sum('partsWaitIntervals'),
      repeatRepairRate: sum('repeatRepairEligibleJobs')
        ? Math.round(sum('repeatRepairJobs') / sum('repeatRepairEligibleJobs') * 10000) / 100
        : null,
      repeatRepairJobs: sum('repeatRepairJobs'),
      repeatRepairEligibleJobs: sum('repeatRepairEligibleJobs'),
      firstVisitCompletionRate: sum('firstVisitEligibleJobs')
        ? Math.round(sum('firstVisitCompletedJobs') / sum('firstVisitEligibleJobs') * 10000) / 100
        : null,
      firstVisitCompletedJobs: sum('firstVisitCompletedJobs'),
      firstVisitEligibleJobs: sum('firstVisitEligibleJobs'),
      averageFeedbackRating: sum('feedbackRatingCount')
        ? sum('feedbackRatingTotal') / sum('feedbackRatingCount')
        : null,
      feedbackRatingCount: sum('feedbackRatingCount'),
      technicianBreakdown: Array.from(technicians.values()),
      serviceBreakdown: Array.from(services.values()),
      metricsByTechnicianAndServiceType: rows,
    };
  }
}
