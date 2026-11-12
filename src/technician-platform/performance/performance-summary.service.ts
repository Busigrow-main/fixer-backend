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
import { Earning, EarningDocument } from '../schemas/earning.schema';
import {
  Settlement,
  SettlementDocument,
  SettlementReconciliationStatus,
  SettlementStatus,
} from '../settlements/schemas/settlement.schema';
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
    const filter: Record<string, unknown> = {
      generationStatus: PerformanceSummaryGenerationStatus.COMPLETED,
    };
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
    if (query.technicianId) {
      filter['technicianBreakdown.technicianId'] = new Types.ObjectId(query.technicianId);
    }
    if (query.serviceType) {
      filter['serviceBreakdown.serviceType'] = query.serviceType;
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
    return { data, total, page, limit };
  }

  async getByDate(businessDate: string) {
    parseBusinessDate(businessDate);
    const summary = await this.summaryModel.findOne({
      businessDate,
      generationStatus: PerformanceSummaryGenerationStatus.COMPLETED,
    }).lean().exec();
    if (!summary) throw new NotFoundException('Performance summary not found');
    return summary;
  }

  private async calculateMetrics(window: DateWindow) {
    const bookingWindow = {
      createdAt: { $gte: window.start, $lt: window.end },
    };
    const completedWindow = {
      jobClosed: true,
      jobClosedAt: { $gte: window.start, $lt: window.end },
    };
    const cancelledWindow = {
      status: 'CANCELLED',
      cancelledAt: { $gte: window.start, $lt: window.end },
    };

    const [
      bookingCounts,
      completedCounts,
      cancelledCounts,
      completedByTechnician,
      earningsByTechnician,
      settlements,
      serviceTotals,
      serviceCompletions,
      serviceCancellations,
    ] =
      await Promise.all([
        this.bookingModel.aggregate([
          { $match: bookingWindow },
          {
            $group: {
              _id: null,
              totalJobs: { $sum: 1 },
              completedCohortJobs: {
                $sum: { $cond: ['$jobClosed', 1, 0] },
              },
              pendingJobs: {
                $sum: {
                  $cond: [{ $in: ['$status', ACTIVE_BOOKING_STATUSES] }, 1, 0],
                },
              },
            },
          },
        ]).exec(),
        this.bookingModel.aggregate([
          { $match: completedWindow },
          { $count: 'completedJobs' },
        ]).exec(),
        this.bookingModel.aggregate([
          { $match: cancelledWindow },
          { $count: 'cancelledJobs' },
        ]).exec(),
        this.bookingModel.aggregate([
          { $match: completedWindow },
          {
            $group: {
              _id: '$technicianId',
              completedJobs: { $sum: 1 },
            },
          },
        ]).exec(),
        this.earningModel.aggregate([
          {
            $match: {
              earnedAt: { $gte: window.start, $lt: window.end },
            },
          },
          {
            $group: {
              _id: '$technicianId',
              earnings: { $sum: '$amount' },
            },
          },
        ]).exec(),
        this.settlementModel.aggregate([
          { $match: { settlementDate: window.businessDate } },
          {
            $group: {
              _id: null,
              prepared: {
                $sum: {
                  $cond: [
                    { $in: ['$status', [
                      SettlementStatus.PREPARED,
                      SettlementStatus.APPROVED,
                      SettlementStatus.PAID,
                    ]] },
                    1,
                    0,
                  ],
                },
              },
              approved: {
                $sum: {
                  $cond: [
                    { $in: ['$status', [SettlementStatus.APPROVED, SettlementStatus.PAID]] },
                    1,
                    0,
                  ],
                },
              },
              paid: {
                $sum: { $cond: [{ $eq: ['$status', SettlementStatus.PAID] }, 1, 0] },
              },
              failed: {
                $sum: { $cond: [{ $eq: ['$status', SettlementStatus.PREPARATION_FAILED] }, 1, 0] },
              },
              disputed: {
                $sum: {
                  $cond: [
                    { $eq: ['$reconciliationStatus', SettlementReconciliationStatus.DISPUTED] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]).exec(),
        this.bookingModel.aggregate([
          { $match: bookingWindow },
          {
            $group: {
              _id: {
                serviceType: '$serviceType',
              },
              totalJobs: { $sum: 1 },
            },
          },
        ]).exec(),
        this.bookingModel.aggregate([
          { $match: completedWindow },
          {
            $group: {
              _id: {
                serviceType: '$serviceType',
              },
              completedJobs: { $sum: 1 },
            },
          },
        ]).exec(),
        this.bookingModel.aggregate([
          { $match: cancelledWindow },
          {
            $group: {
              _id: {
                serviceType: '$serviceType',
              },
              cancelledJobs: { $sum: 1 },
            },
          },
        ]).exec(),
      ]);

    const counts = bookingCounts[0] || {
      totalJobs: 0,
      completedCohortJobs: 0,
      pendingJobs: 0,
    };
    const technicianMap = new Map<string, { completedJobs: number; earnings: number }>();
    for (const row of completedByTechnician) {
      technicianMap.set(String(row._id), {
        completedJobs: row.completedJobs,
        earnings: 0,
      });
    }
    for (const row of earningsByTechnician) {
      const key = String(row._id);
      const current = technicianMap.get(key) || { completedJobs: 0, earnings: 0 };
      current.earnings = row.earnings;
      technicianMap.set(key, current);
    }

    const settlementCounts = settlements[0] || {
      prepared: 0,
      approved: 0,
      paid: 0,
      failed: 0,
      disputed: 0,
    };

    return {
      totalJobs: counts.totalJobs,
      completedJobs: completedCounts[0]?.completedJobs || 0,
      pendingJobs: counts.pendingJobs,
      cancelledJobs: cancelledCounts[0]?.cancelledJobs || 0,
      completionRate: counts.totalJobs
        ? Math.round((counts.completedCohortJobs / counts.totalJobs) * 10000) / 100
        : 0,
      totalTechnicianEarnings: earningsByTechnician.reduce(
        (total: number, row: { earnings: number }) => total + row.earnings,
        0,
      ),
      totalSettlementsPrepared: settlementCounts.prepared,
      totalSettlementsApproved: settlementCounts.approved,
      totalSettlementsPaid: settlementCounts.paid,
      failedSettlementPreparations: settlementCounts.failed,
      disputedSettlements: settlementCounts.disputed,
      technicianBreakdown: Array.from(technicianMap.entries())
        .filter(([technicianId]) => Types.ObjectId.isValid(technicianId))
        .map(([technicianId, values]) => ({
          technicianId: new Types.ObjectId(technicianId),
          ...values,
        })),
      serviceBreakdown: this.mergeServiceBreakdown(
        serviceTotals,
        serviceCompletions,
        serviceCancellations,
      ),
    };
  }

  private mergeServiceBreakdown(
    totals: Array<{
      _id?: { serviceId?: Types.ObjectId; serviceType?: string };
      totalJobs: number;
    }>,
    completions: Array<{
      _id?: { serviceId?: Types.ObjectId; serviceType?: string };
      completedJobs: number;
    }>,
    cancellations: Array<{
      _id?: { serviceId?: Types.ObjectId; serviceType?: string };
      cancelledJobs: number;
    }>,
  ) {
    const breakdown = new Map<string, {
      serviceId?: Types.ObjectId;
      serviceType?: string;
      totalJobs: number;
      completedJobs: number;
      cancelledJobs: number;
    }>();
    const add = (
      rows: Array<{
        _id?: { serviceId?: Types.ObjectId; serviceType?: string };
        totalJobs?: number;
        completedJobs?: number;
        cancelledJobs?: number;
      }>,
    ) => {
      for (const row of rows) {
        if (!row._id || (!row._id.serviceId && !row._id.serviceType)) continue;
        const key = `${String(row._id.serviceId || '')}:${row._id.serviceType || ''}`;
        const current = breakdown.get(key) || {
          serviceId: row._id.serviceId,
          serviceType: row._id.serviceType,
          totalJobs: 0,
          completedJobs: 0,
          cancelledJobs: 0,
        };
        current.totalJobs += row.totalJobs || 0;
        current.completedJobs += row.completedJobs || 0;
        current.cancelledJobs += row.cancelledJobs || 0;
        breakdown.set(key, current);
      }
    };
    add(totals);
    add(completions);
    add(cancellations);
    return Array.from(breakdown.values());
  }
}
